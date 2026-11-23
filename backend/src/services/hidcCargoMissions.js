/**
 * HIDC "Trasporto cargo" missions (operations panel, Produzione tab).
 *
 * A BLUE production point that reaches its maximum stock (DCORE DSCORE_Rigs export: stock >= max_stock)
 * puts a cargo mission on the board: bring its production crates to the nearest BLUE airport.
 * One mission per production point at a time; a pilot takes it for themself and can queue up to
 * HIDC_CARGO_MAX_ACTIVE (default 3) of them. For the queued missions the site plans the shortest route:
 * departure airport, then every pickup before its delivery, with HIDC_CARGO_ROUTE_CAPACITY crates on board
 * at once (default 1: production crates are sling loads).
 *
 * Completion: DCORE DWAREHOUSE logs every production crate consumed at a BLUE airport
 * (Export_Production_Deliveries.json: crate, origin zone, airbase). A mission is done when
 * HIDC_CARGO_CRATES crates (default 1) from its production point reach its destination after it was
 * accepted, and the pilot flew in DCS after accepting (same rule as the other HIDC missions).
 */
import crypto from 'crypto';
import fs from 'fs';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envIntOrZero(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const CARGO_TYPE = 'CARGO';

export const CARGO_RULES = Object.freeze({
  durationMs: envInt('HIDC_CARGO_DURATION_MIN', 120) * 60 * 1000,
  maxActive: envInt('HIDC_CARGO_MAX_ACTIVE', 3),
  crates: envInt('HIDC_CARGO_CRATES', 1),
  capacity: envInt('HIDC_CARGO_ROUTE_CAPACITY', 1),
  xp: envIntOrZero('HIDC_MISSION_XP_CARGO', 40),
  requireFlight: String(process.env.HIDC_MISSION_REQUIRE_FLIGHT || 'true').toLowerCase() !== 'false',
});

const HISTORY_LIMIT = 300;
const RECENT_LIMIT = 3;
const SEEN_LIMIT = 600;
const EARTH_RADIUS_NM = 3440.065;

export function distanceNm(a, b) {
  if (!a || !b) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function point(value) {
  const lat = Number(value?.lat);
  const lon = Number(value?.lon);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

export function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "PP_001" / "PP 1" -> "1": DCORE and the map do not always pad production point numbers the same way. */
function ppKey(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? `PP${Number(match[1])}` : normalizeName(raw);
}

export function ppLabel(value) {
  const match = String(value || '').trim().match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? `PP_${match[1].padStart(2, '0')}` : String(value || '');
}

export function isFullProductionPoint(pp) {
  const max = Number(pp?.max_stock) || 0;
  return String(pp?.owner || '').toUpperCase() === 'BLUE'
    && pp?.built === true
    && max > 0
    && (Number(pp?.stock) || 0) >= max
    && Boolean(point(pp?.coordinates));
}

/** Nearest airport to a point (airports: { id, name, coordinates }). */
export function nearestAirport(target, airports) {
  let best = null;
  (airports || []).forEach((airport) => {
    const nm = distanceNm(target, point(airport.coordinates));
    if (nm != null && (!best || nm < best.nm)) best = { airport, nm };
  });
  return best;
}

/**
 * Shortest route through the queued missions.
 * tasks: [{ id, pickup: {lat, lon, name}, dropoff: {lat, lon, name} }]
 * Every pickup comes before its delivery, at most `capacity` loads on board. The route starts from the
 * airport nearest to the first pickup (where the pilot takes off) and ends at the last delivery.
 * At most 3 missions (720 orders at worst): plain search is enough.
 */
export function planCargoRoute(tasks, airports, capacity = 1) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  const n = tasks.length;
  let best = null;

  const visit = (sequence, picked, dropped, load, cost) => {
    if (best && cost >= best.cost) return;
    if (sequence.length === n * 2) {
      best = { sequence: [...sequence], cost };
      return;
    }
    const last = sequence.length ? sequence[sequence.length - 1] : null;
    const lastPoint = last ? (last.kind === 'pickup' ? tasks[last.index].pickup : tasks[last.index].dropoff) : null;
    for (let i = 0; i < n; i += 1) {
      if (!picked[i] && load < capacity) {
        const target = tasks[i].pickup;
        // First leg: from the airport nearest to the first pickup.
        const leg = lastPoint ? distanceNm(lastPoint, target) : (nearestAirport(target, airports)?.nm || 0);
        picked[i] = true;
        sequence.push({ kind: 'pickup', index: i });
        visit(sequence, picked, dropped, load + 1, cost + leg);
        sequence.pop();
        picked[i] = false;
      }
      if (picked[i] && !dropped[i]) {
        const leg = distanceNm(lastPoint, tasks[i].dropoff);
        dropped[i] = true;
        sequence.push({ kind: 'dropoff', index: i });
        visit(sequence, picked, dropped, load - 1, cost + leg);
        sequence.pop();
        dropped[i] = false;
      }
    }
  };
  visit([], new Array(n).fill(false), new Array(n).fill(false), 0, 0);
  if (!best) return null;

  const firstPickup = tasks[best.sequence[0].index].pickup;
  const departure = nearestAirport(firstPickup, airports);
  const stops = [];
  if (departure) {
    const coords = point(departure.airport.coordinates);
    stops.push({
      kind: 'departure',
      name: departure.airport.name,
      airportId: departure.airport.id,
      lat: coords.lat,
      lon: coords.lon,
      legNm: 0,
      missionIds: [],
    });
  }
  best.sequence.forEach((step) => {
    const task = tasks[step.index];
    const at = step.kind === 'pickup' ? task.pickup : task.dropoff;
    const prev = stops[stops.length - 1];
    // Same place twice in a row (two crates from one PP, two deliveries to one airport): one stop.
    if (prev && prev.kind === step.kind && prev.name === at.name) {
      prev.missionIds.push(task.id);
      return;
    }
    stops.push({
      kind: step.kind,
      name: at.name,
      airportId: at.airportId || null,
      lat: at.lat,
      lon: at.lon,
      legNm: prev ? Math.round(distanceNm(prev, at) * 10) / 10 : 0,
      missionIds: [task.id],
    });
  });
  const totalNm = stops.reduce((sum, stop) => sum + stop.legNm, 0);
  return { stops, totalNm: Math.round(totalNm * 10) / 10, capacity };
}

/**
 * @param {object} deps
 * @param {() => Array} deps.getProductionPoints   normalized production points (server.js)
 * @param {() => Array} deps.getAirports           BLUE airports { id, name, aliases, coordinates }
 * @param {() => Array|null} deps.readDeliveries   DCORE deliveries [{ id, crate, zone, airbase, at }], null = no file
 * @param {(user: object, minLevel: number, action: string) => object} deps.requirePilot
 * @param {(discordId: string, sinceMs: number) => boolean|null} deps.flewSince
 * @param {(event: string, payload: object) => void} deps.emit
 * @param {(event: object) => void} [deps.pushFeed]
 */
export function createHidcCargoMissions(deps) {
  function readState() {
    const raw = loadJson(DOC.HIDC_CARGO_MISSIONS, null) || {};
    return {
      board: raw.board && typeof raw.board === 'object' ? raw.board : {},
      active: Array.isArray(raw.active) ? raw.active : [],
      history: Array.isArray(raw.history) ? raw.history : [],
      xp: raw.xp && typeof raw.xp === 'object' ? raw.xp : {},
      // delivery id -> { firstSeen, usedBy } (DCORE timestamps may be missing: firstSeen is the fallback)
      seen: raw.seen && typeof raw.seen === 'object' ? raw.seen : {},
    };
  }

  function writeState(state) {
    const seen = Object.entries(state.seen)
      .sort((a, b) => (b[1].firstSeen || 0) - (a[1].firstSeen || 0))
      .slice(0, SEEN_LIMIT);
    saveJson(DOC.HIDC_CARGO_MISSIONS, {
      board: state.board,
      active: state.active,
      history: state.history.slice(0, HISTORY_LIMIT),
      xp: state.xp,
      seen: Object.fromEntries(seen),
    });
  }

  function airportList() {
    return (deps.getAirports() || []).filter((airport) => airport?.id && point(airport.coordinates));
  }

  function destinationFor(pp, airports) {
    const found = nearestAirport(point(pp.coordinates), airports);
    if (!found) return null;
    const coords = point(found.airport.coordinates);
    return {
      id: found.airport.id,
      name: found.airport.name,
      aliases: [...new Set([found.airport.name, ...(found.airport.aliases || [])].map(normalizeName).filter(Boolean))],
      lat: coords.lat,
      lon: coords.lon,
      nm: Math.round(found.nm * 10) / 10,
    };
  }

  /** Full production points get a mission, the others lose theirs (unless a pilot already took it). */
  function syncBoard(state, now) {
    const pps = deps.getProductionPoints() || [];
    if (pps.length === 0) return false; // no export yet: leave the board alone
    const airports = airportList();
    if (airports.length === 0) return false;
    const taken = new Set(state.active.map((entry) => entry.missionId));
    const full = new Map(pps.filter(isFullProductionPoint).map((pp) => [ppKey(pp.id), pp]));
    let changed = false;

    Object.values(state.board).forEach((mission) => {
      if (taken.has(mission.id)) return;
      const pp = full.get(ppKey(mission.ppId));
      if (!pp) {
        delete state.board[mission.id];
        changed = true;
        return;
      }
      // Destination lost (airport captured or closed): pick the nearest one again.
      if (!airports.some((airport) => airport.id === mission.destination?.id)) {
        const destination = destinationFor(pp, airports);
        if (destination) mission.destination = destination;
        else delete state.board[mission.id];
        changed = true;
      }
    });

    const onBoard = new Set(Object.values(state.board).map((mission) => ppKey(mission.ppId)));
    full.forEach((pp, key) => {
      if (onBoard.has(key)) return;
      const destination = destinationFor(pp, airports);
      if (!destination) return;
      const id = `${CARGO_TYPE}:${pp.id}:${now}`;
      const origin = point(pp.coordinates);
      state.board[id] = {
        id,
        ppId: pp.id,
        ppName: ppLabel(pp.zone_name || pp.id),
        origin,
        destination,
        stock: Number(pp.stock) || 0,
        maxStock: Number(pp.max_stock) || 0,
        createdAt: now,
      };
      changed = true;
    });
    return changed;
  }

  function closeAssignment(state, assignment, status, now, extra = {}) {
    state.active = state.active.filter((entry) => entry.id !== assignment.id);
    // The production point gets a fresh mission at the next sync if it is still full.
    delete state.board[assignment.missionId];
    const closed = { ...assignment, ...extra, status, closedAt: now };
    state.history.unshift(closed);
    return closed;
  }

  function award(state, assignment) {
    const xp = CARGO_RULES.xp;
    const row = state.xp[assignment.discordId] || { total: 0, completed: 0, byType: {} };
    row.total += xp;
    row.completed += 1;
    row.byType[CARGO_TYPE] = (row.byType[CARGO_TYPE] || 0) + 1;
    state.xp[assignment.discordId] = row;
    return xp;
  }

  /** Records the deliveries in the DCORE file and gives each one to at most one assignment. */
  function creditDeliveries(state, now) {
    const deliveries = deps.readDeliveries();
    if (!Array.isArray(deliveries)) return false;
    let changed = false;
    deliveries.forEach((delivery) => {
      const id = String(delivery?.id || '');
      if (!id) return;
      if (!state.seen[id]) {
        state.seen[id] = { firstSeen: now, usedBy: null };
        changed = true;
      }
      const seen = state.seen[id];
      if (seen.usedBy) return;
      const at = Number(delivery.at) > 0 ? Number(delivery.at) * 1000 : seen.firstSeen;
      const zone = ppKey(delivery.zone);
      const airbase = normalizeName(delivery.airbase);
      const assignment = state.active
        .filter((entry) => !entry.deliveredAt
          && ppKey(entry.ppId) === zone
          && (entry.destination?.aliases || []).includes(airbase)
          && at >= entry.acceptedAt)
        .sort((a, b) => a.acceptedAt - b.acceptedAt)[0];
      if (!assignment) return;
      seen.usedBy = assignment.id;
      assignment.delivered = (Number(assignment.delivered) || 0) + 1;
      if (assignment.delivered >= assignment.crates) assignment.deliveredAt = now;
      changed = true;
    });
    return changed;
  }

  function evaluate(state, now) {
    const events = [];
    [...state.active].forEach((assignment) => {
      if (assignment.deliveredAt) {
        const flew = deps.flewSince(assignment.discordId, assignment.acceptedAt);
        if (flew === true || !CARGO_RULES.requireFlight) {
          const xp = award(state, assignment);
          events.push({ kind: 'completed', entry: closeAssignment(state, assignment, 'completed', now, { xp }) });
          return;
        }
      }
      if (now > assignment.expiresAt) {
        events.push({
          kind: 'expired',
          entry: closeAssignment(state, assignment, 'expired', now, assignment.deliveredAt ? { reason: 'no-flight' } : {}),
        });
      }
    });
    return events;
  }

  function announce(events) {
    events.forEach(({ kind, entry }) => {
      if (kind !== 'completed') return;
      deps.pushFeed?.({
        type: 'ato.mission.completed',
        title: 'Trasporto cargo completato',
        message: `${entry.pilotName || 'Un pilota'} ha portato il cargo di ${entry.ppName} a ${entry.destination?.name || '?'} (+${entry.xp} XP)`,
        actor: entry.pilotName || null,
        metadata: { production_point_id: entry.ppId, airport_id: entry.destination?.id || null, type: CARGO_TYPE, xp: entry.xp },
      });
    });
  }

  function tick(now = Date.now()) {
    const state = readState();
    const before = JSON.stringify([state.board, state.active]);
    const boardChanged = syncBoard(state, now);
    const delivered = creditDeliveries(state, now);
    const events = evaluate(state, now);
    // Deliveries just consumed by a closed mission free its production point for a new one.
    if (events.length > 0) syncBoard(state, now);
    if (boardChanged || delivered || events.length > 0) {
      writeState(state);
      if (JSON.stringify([state.board, state.active]) !== before) {
        deps.emit('hidc:campaign-updated', { reason: 'cargo' });
      }
    }
    announce(events);
    return events;
  }

  function httpError(message, status) {
    const error = new Error(message);
    error.status = status;
    return error;
  }

  function accept(user, missionId, now = Date.now()) {
    const pilot = deps.requirePilot(user, 0, 'accettare un trasporto cargo');
    const state = readState();
    syncBoard(state, now);
    const mission = state.board[missionId];
    if (!mission) throw httpError('Missione non piu disponibile.', 404);
    if (state.active.some((entry) => entry.missionId === missionId)) {
      throw httpError('Questo trasporto e gia stato preso da un altro pilota.', 409);
    }
    const mine = state.active.filter((entry) => entry.discordId === user.id);
    if (mine.length >= CARGO_RULES.maxActive) {
      throw httpError(`Puoi accodare al massimo ${CARGO_RULES.maxActive} trasporti cargo.`, 409);
    }
    const assignment = {
      id: crypto.randomUUID(),
      missionId,
      type: CARGO_TYPE,
      ppId: mission.ppId,
      ppName: mission.ppName,
      origin: mission.origin,
      destination: mission.destination,
      crates: CARGO_RULES.crates,
      delivered: 0,
      deliveredAt: null,
      discordId: user.id,
      pilotName: pilot.stats?.name || pilot.link?.name || user.username || null,
      acceptedAt: now,
      expiresAt: now + CARGO_RULES.durationMs,
    };
    state.active.push(assignment);
    writeState(state);
    deps.emit('hidc:campaign-updated', { reason: 'cargo-accepted' });
    deps.pushFeed?.({
      type: 'ato.mission.accepted',
      title: 'Trasporto cargo accettato',
      message: `${assignment.pilotName || 'Un pilota'} porta il cargo di ${assignment.ppName} a ${assignment.destination.name}`,
      actor: assignment.pilotName,
      metadata: { production_point_id: assignment.ppId, airport_id: assignment.destination.id, type: CARGO_TYPE, expires_at: assignment.expiresAt },
    });
    return assignment;
  }

  function abandon(user, assignmentId, now = Date.now()) {
    const state = readState();
    const assignment = state.active.find((entry) => entry.id === assignmentId && entry.discordId === user.id);
    if (!assignment) throw httpError('Missione non trovata.', 404);
    closeAssignment(state, assignment, 'abandoned', now);
    syncBoard(state, now);
    writeState(state);
    deps.emit('hidc:campaign-updated', { reason: 'cargo-abandoned' });
  }

  function xpFor(discordId) {
    const row = readState().xp[discordId];
    return row
      ? { total: Number(row.total) || 0, completed: Number(row.completed) || 0, byType: row.byType || {} }
      : { total: 0, completed: 0, byType: {} };
  }

  function allXp() {
    return readState().xp;
  }

  function publicStop(value) {
    return value ? { lat: value.lat, lon: value.lon } : null;
  }

  function publicMission(mission) {
    return {
      id: mission.id,
      type: CARGO_TYPE,
      ppId: mission.ppId,
      ppName: mission.ppName,
      origin: publicStop(mission.origin),
      destination: mission.destination
        ? { id: mission.destination.id, name: mission.destination.name, lat: mission.destination.lat, lon: mission.destination.lon }
        : null,
      distanceNm: mission.destination?.nm ?? null,
      stock: mission.stock,
      maxStock: mission.maxStock,
      crates: CARGO_RULES.crates,
      xp: CARGO_RULES.xp,
      createdAt: mission.createdAt,
    };
  }

  function publicAssignment(entry) {
    return {
      ...publicMission({ ...entry, id: entry.missionId }),
      id: entry.id,
      missionId: entry.missionId,
      crates: entry.crates,
      delivered: Number(entry.delivered) || 0,
      xp: entry.xp ?? CARGO_RULES.xp,
      acceptedAt: entry.acceptedAt,
      expiresAt: entry.expiresAt,
      awaitingFlight: Boolean(entry.deliveredAt),
      status: entry.status || 'active',
      closedAt: entry.closedAt || null,
      reason: entry.reason || null,
    };
  }

  function routeFor(assignments) {
    const tasks = assignments
      .filter((entry) => !entry.deliveredAt && entry.origin && entry.destination)
      .map((entry) => ({
        id: entry.id,
        pickup: { ...entry.origin, name: entry.ppName },
        dropoff: { lat: entry.destination.lat, lon: entry.destination.lon, name: entry.destination.name, airportId: entry.destination.id },
      }));
    return planCargoRoute(tasks, airportList(), CARGO_RULES.capacity);
  }

  function getPublicState(user, now = Date.now()) {
    const state = readState();
    const discordId = user?.id || null;
    const taken = new Set(state.active.map((entry) => entry.missionId));
    const mine = discordId ? state.active.filter((entry) => entry.discordId === discordId) : [];
    return {
      rules: {
        durationMin: Math.round(CARGO_RULES.durationMs / 60000),
        maxActive: CARGO_RULES.maxActive,
        crates: CARGO_RULES.crates,
        capacity: CARGO_RULES.capacity,
        xp: CARGO_RULES.xp,
        requireFlight: CARGO_RULES.requireFlight,
      },
      available: Object.values(state.board)
        .filter((mission) => !taken.has(mission.id))
        .map(publicMission)
        .sort((a, b) => (a.distanceNm ?? 0) - (b.distanceNm ?? 0) || a.ppName.localeCompare(b.ppName, undefined, { numeric: true })),
      mine: discordId
        ? {
          active: mine.map(publicAssignment),
          recent: state.history.filter((entry) => entry.discordId === discordId).slice(0, RECENT_LIMIT).map(publicAssignment),
          canAccept: mine.length < CARGO_RULES.maxActive,
          route: routeFor(mine),
        }
        : null,
      now,
    };
  }

  return { tick, accept, abandon, xpFor, allXp, getPublicState, _internals: { readState, syncBoard, creditDeliveries, evaluate } };
}

/** Reads DCORE Export_Production_Deliveries.json ({ deliveries: [...] }); null when the file is missing. */
export function readDeliveriesFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.deliveries) ? parsed.deliveries : []);
  } catch (error) {
    console.error('HIDC cargo deliveries read error:', error.message);
    return null;
  }
}

export default { createHidcCargoMissions, planCargoRoute, readDeliveriesFile, CARGO_RULES };
