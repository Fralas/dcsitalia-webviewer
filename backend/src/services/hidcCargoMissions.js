/**
 * HIDC "Trasporto cargo" missions (operations panel, Produzione tab).
 *
 * A BLUE production point with at least HIDC_CARGO_MIN_CRATES crates in stock (default 3, DCORE DSCORE_Rigs
 * export) puts a cargo mission on the board: empty it, i.e. fly all its crates to a BLUE airport. The number of
 * crates is the stock when the pilot takes the mission. One mission per production point at a time; a pilot takes
 * it for themself and can queue up to HIDC_CARGO_MAX_ACTIVE (default 3) of them.
 *
 * Destination: any BLUE airport counts. For the queue the site picks one single drop-off airport, the one that
 * gives the shortest route for all the queued production points (HIDC_CARGO_ROUTE_CAPACITY crates per trip,
 * default 1: production crates are sling loads, so every trip is airport -> production point -> airport).
 *
 * XP: per delivered crate, HIDC_CARGO_XP_PER_CRATE + HIDC_CARGO_XP_PER_CRATE_NM x distance from the production
 * point to the airport where it was delivered (capped at HIDC_CARGO_XP_MAX_NM).
 *
 * Completion: DCORE DWAREHOUSE logs every production crate consumed at a BLUE airport
 * (Export_Production_Deliveries.json: crate, origin zone, airbase). The mission is done when all its crates
 * reached an airport after it was accepted, and the pilot flew in DCS after accepting (same rule as the other
 * HIDC missions).
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

function envNumber(name, fallback) {
  const value = Number.parseFloat(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const CARGO_TYPE = 'CARGO';

export const CARGO_RULES = Object.freeze({
  minCrates: envInt('HIDC_CARGO_MIN_CRATES', 3),
  maxActive: envInt('HIDC_CARGO_MAX_ACTIVE', 3),
  capacity: envInt('HIDC_CARGO_ROUTE_CAPACITY', 1),
  // Time to complete: the longer of the base and minPerCrate x crates.
  durationMin: envInt('HIDC_CARGO_DURATION_MIN', 120),
  minPerCrate: envIntOrZero('HIDC_CARGO_MIN_PER_CRATE', 15),
  xpPerCrate: envNumber('HIDC_CARGO_XP_PER_CRATE', 4),
  xpPerCrateNm: envNumber('HIDC_CARGO_XP_PER_CRATE_NM', 0.4),
  xpMaxNm: envInt('HIDC_CARGO_XP_MAX_NM', 100),
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

const round1 = (value) => Math.round(value * 10) / 10;

export function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "PP_001" / "PP 1" -> "PP1": DCORE and the map do not always pad production point numbers the same way. */
function ppKey(value) {
  const raw = String(value || '').trim();
  const match = raw.match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? `PP${Number(match[1])}` : normalizeName(raw);
}

export function ppLabel(value) {
  const match = String(value || '').trim().match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? `PP_${match[1].padStart(2, '0')}` : String(value || '');
}

export function isCargoReady(pp, minCrates = CARGO_RULES.minCrates) {
  return String(pp?.owner || '').toUpperCase() === 'BLUE'
    && pp?.built === true
    && (Number(pp?.stock) || 0) >= minCrates
    && Boolean(point(pp?.coordinates));
}

/** XP for `crates` crates flown `nm` nautical miles. */
export function cargoXp(crates, nm) {
  const distance = Math.min(Math.max(0, Number(nm) || 0), CARGO_RULES.xpMaxNm);
  return Math.round((Number(crates) || 0) * (CARGO_RULES.xpPerCrate + CARGO_RULES.xpPerCrateNm * distance));
}

export function cargoDurationMs(crates) {
  return Math.max(CARGO_RULES.durationMin, (Number(crates) || 0) * CARGO_RULES.minPerCrate) * 60 * 1000;
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
 * Route through the queued production points with ONE drop-off airport for all of them.
 * tasks: [{ id, name, lat, lon, crates }]
 * With `capacity` crates per trip, a production point of n crates takes ceil(n / capacity) round trips
 * airport -> production point -> airport. The airport is the one with the shortest total; it is also where the
 * pilot takes off. Production points are visited nearest first.
 */
export function planCargoRoute(tasks, airports, capacity = 1) {
  const list = (tasks || []).filter((task) => point(task));
  if (list.length === 0) return null;
  const perTrip = Math.max(1, capacity);
  let best = null;
  (airports || []).forEach((airport) => {
    const at = point(airport.coordinates);
    if (!at) return;
    let cost = 0;
    list.forEach((task) => {
      cost += Math.ceil(Math.max(1, task.crates) / perTrip) * 2 * distanceNm(at, task);
    });
    if (!best || cost < best.cost) best = { airport, at, cost };
  });
  if (!best) return null;

  const legs = list
    .map((task) => ({ task, nm: distanceNm(best.at, task), trips: Math.ceil(Math.max(1, task.crates) / perTrip) }))
    .sort((a, b) => a.nm - b.nm);
  const dropoff = { id: best.airport.id, name: best.airport.name, lat: best.at.lat, lon: best.at.lon };
  const stops = [{ kind: 'departure', name: dropoff.name, airportId: dropoff.id, lat: dropoff.lat, lon: dropoff.lon, legNm: 0, missionIds: [] }];
  legs.forEach(({ task, nm, trips }) => {
    stops.push({
      kind: 'pickup',
      name: task.name,
      lat: task.lat,
      lon: task.lon,
      legNm: round1(nm),
      crates: task.crates,
      trips,
      missionIds: [task.id],
    });
    stops.push({
      kind: 'dropoff',
      name: dropoff.name,
      airportId: dropoff.id,
      lat: dropoff.lat,
      lon: dropoff.lon,
      legNm: round1(nm),
      crates: task.crates,
      trips,
      missionIds: [task.id],
    });
  });
  return {
    dropoff,
    stops,
    totalNm: round1(best.cost),
    trips: legs.reduce((sum, leg) => sum + leg.trips, 0),
    capacity: perTrip,
    distanceById: Object.fromEntries(legs.map(({ task, nm }) => [task.id, round1(nm)])),
  };
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

  /** Production points with enough crates get a mission; the others lose theirs (unless a pilot took it). */
  function syncBoard(state, now) {
    const pps = deps.getProductionPoints() || [];
    if (pps.length === 0) return false; // no export yet: leave the board alone
    const airports = airportList();
    const taken = new Set(state.active.map((entry) => entry.missionId));
    const takenPp = new Set(state.active.map((entry) => ppKey(entry.ppId)));
    const ready = new Map(pps.filter((pp) => isCargoReady(pp)).map((pp) => [ppKey(pp.id), pp]));
    let changed = false;

    Object.values(state.board).forEach((mission) => {
      if (taken.has(mission.id)) return;
      const pp = ready.get(ppKey(mission.ppId));
      if (!pp) {
        delete state.board[mission.id];
        changed = true;
        return;
      }
      // The mission empties the production point: follow its stock until someone takes it.
      const stock = Number(pp.stock) || 0;
      if (mission.crates !== stock) {
        mission.crates = stock;
        changed = true;
      }
      if (mission.nearestNm === undefined) {
        const nearest = nearestAirport(mission.origin, airports);
        mission.nearestNm = nearest ? round1(nearest.nm) : null;
        delete mission.destination; // missions saved before the single drop-off airport
        changed = true;
      }
    });

    const onBoard = new Set(Object.values(state.board).map((mission) => ppKey(mission.ppId)));
    ready.forEach((pp, key) => {
      if (onBoard.has(key) || takenPp.has(key)) return;
      const origin = point(pp.coordinates);
      const nearest = nearestAirport(origin, airports);
      const id = `${CARGO_TYPE}:${pp.id}:${now}`;
      state.board[id] = {
        id,
        ppId: pp.id,
        ppName: ppLabel(pp.zone_name || pp.id),
        origin,
        crates: Number(pp.stock) || 0,
        nearestNm: nearest ? round1(nearest.nm) : null,
        createdAt: now,
      };
      changed = true;
    });
    return changed;
  }

  function closeAssignment(state, assignment, status, now, extra = {}) {
    state.active = state.active.filter((entry) => entry.id !== assignment.id);
    // The production point gets a fresh mission at the next sync if it has enough crates again.
    delete state.board[assignment.missionId];
    const closed = { ...assignment, ...extra, status, closedAt: now };
    state.history.unshift(closed);
    return closed;
  }

  function award(state, assignment) {
    const xp = Math.round(Number(assignment.xpEarned) || 0);
    const row = state.xp[assignment.discordId] || { total: 0, completed: 0, byType: {} };
    row.total += xp;
    row.completed += 1;
    row.byType[CARGO_TYPE] = (row.byType[CARGO_TYPE] || 0) + 1;
    state.xp[assignment.discordId] = row;
    return xp;
  }

  function airportByDcsName(name) {
    const wanted = normalizeName(name);
    if (!wanted) return null;
    return airportList().find((airport) => (
      [airport.name, ...(airport.aliases || [])].some((alias) => normalizeName(alias) === wanted)
    )) || null;
  }

  /** Records the deliveries in the DCORE file and gives each crate to at most one assignment. */
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
      const assignment = state.active
        .filter((entry) => !entry.deliveredAt && ppKey(entry.ppId) === zone && at >= entry.acceptedAt)
        .sort((a, b) => a.acceptedAt - b.acceptedAt)[0];
      if (!assignment) return;
      // XP on the real distance: production point -> airport where the crate was delivered.
      const airport = airportByDcsName(delivery.airbase);
      const nm = airport
        ? distanceNm(assignment.origin, point(airport.coordinates))
        : (nearestAirport(assignment.origin, airportList())?.nm || 0);
      seen.usedBy = assignment.id;
      assignment.delivered = (Number(assignment.delivered) || 0) + 1;
      assignment.xpEarned = (Number(assignment.xpEarned) || 0) + cargoXp(1, nm);
      assignment.deliveredNm = round1((Number(assignment.deliveredNm) || 0) + nm);
      assignment.lastAirport = airport?.name || String(delivery.airbase || '') || null;
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
        message: `${entry.pilotName || 'Un pilota'} ha svuotato ${entry.ppName}: ${entry.crates} casse consegnate (+${entry.xp} XP)`,
        actor: entry.pilotName || null,
        metadata: { production_point_id: entry.ppId, crates: entry.crates, type: CARGO_TYPE, xp: entry.xp },
      });
    });
  }

  function tick(now = Date.now()) {
    const state = readState();
    const before = JSON.stringify([state.board, state.active]);
    const boardChanged = syncBoard(state, now);
    const delivered = creditDeliveries(state, now);
    const events = evaluate(state, now);
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
    const crates = Math.max(CARGO_RULES.minCrates, Number(mission.crates) || 0);
    const assignment = {
      id: crypto.randomUUID(),
      missionId,
      type: CARGO_TYPE,
      ppId: mission.ppId,
      ppName: mission.ppName,
      origin: mission.origin,
      crates,
      delivered: 0,
      xpEarned: 0,
      deliveredNm: 0,
      deliveredAt: null,
      discordId: user.id,
      pilotName: pilot.stats?.name || pilot.link?.name || user.username || null,
      acceptedAt: now,
      expiresAt: now + cargoDurationMs(crates),
    };
    state.active.push(assignment);
    writeState(state);
    deps.emit('hidc:campaign-updated', { reason: 'cargo-accepted' });
    deps.pushFeed?.({
      type: 'ato.mission.accepted',
      title: 'Trasporto cargo accettato',
      message: `${assignment.pilotName || 'Un pilota'} svuota ${assignment.ppName} (${crates} casse)`,
      actor: assignment.pilotName,
      metadata: { production_point_id: assignment.ppId, crates, type: CARGO_TYPE, expires_at: assignment.expiresAt },
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

  function publicMission(mission) {
    return {
      id: mission.id,
      type: CARGO_TYPE,
      ppId: mission.ppId,
      ppName: mission.ppName,
      origin: mission.origin ? { lat: mission.origin.lat, lon: mission.origin.lon } : null,
      crates: mission.crates,
      // Estimate on the nearest BLUE airport; the queue may end up on another one.
      nearestNm: mission.nearestNm ?? null,
      xp: cargoXp(mission.crates, mission.nearestNm),
      durationMin: Math.round(cargoDurationMs(mission.crates) / 60000),
      createdAt: mission.createdAt,
    };
  }

  function publicAssignment(entry, route = null) {
    const nm = route?.distanceById?.[entry.id];
    const remaining = Math.max(0, entry.crates - (Number(entry.delivered) || 0));
    return {
      id: entry.id,
      missionId: entry.missionId,
      type: CARGO_TYPE,
      ppId: entry.ppId,
      ppName: entry.ppName,
      origin: entry.origin ? { lat: entry.origin.lat, lon: entry.origin.lon } : null,
      crates: entry.crates,
      delivered: Number(entry.delivered) || 0,
      destination: route?.dropoff ? { ...route.dropoff, nm: nm ?? null } : (entry.lastAirport ? { name: entry.lastAirport } : null),
      // Closed: XP given. Open: XP so far + the rest flown to the planned airport.
      xp: entry.xp ?? Math.round((Number(entry.xpEarned) || 0) + cargoXp(remaining, nm ?? 0)),
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
      .filter((entry) => !entry.deliveredAt && entry.origin)
      .map((entry) => ({
        id: entry.id,
        name: entry.ppName,
        lat: entry.origin.lat,
        lon: entry.origin.lon,
        crates: Math.max(1, entry.crates - (Number(entry.delivered) || 0)),
      }));
    return planCargoRoute(tasks, airportList(), CARGO_RULES.capacity);
  }

  function getPublicState(user, now = Date.now()) {
    const state = readState();
    const discordId = user?.id || null;
    const taken = new Set(state.active.map((entry) => entry.missionId));
    const mine = discordId ? state.active.filter((entry) => entry.discordId === discordId) : [];
    const route = mine.length ? routeFor(mine) : null;
    return {
      rules: {
        minCrates: CARGO_RULES.minCrates,
        maxActive: CARGO_RULES.maxActive,
        capacity: CARGO_RULES.capacity,
        xpPerCrate: CARGO_RULES.xpPerCrate,
        xpPerCrateNm: CARGO_RULES.xpPerCrateNm,
        requireFlight: CARGO_RULES.requireFlight,
      },
      available: Object.values(state.board)
        .filter((mission) => !taken.has(mission.id))
        .map(publicMission)
        .sort((a, b) => b.crates - a.crates || a.ppName.localeCompare(b.ppName, undefined, { numeric: true })),
      mine: discordId
        ? {
          active: mine.map((entry) => publicAssignment(entry, route)),
          recent: state.history.filter((entry) => entry.discordId === discordId).slice(0, RECENT_LIMIT).map((entry) => publicAssignment(entry)),
          canAccept: mine.length < CARGO_RULES.maxActive,
          route: route ? { ...route, distanceById: undefined } : null,
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

export default { createHidcCargoMissions, planCargoRoute, readDeliveriesFile, cargoXp, CARGO_RULES };
