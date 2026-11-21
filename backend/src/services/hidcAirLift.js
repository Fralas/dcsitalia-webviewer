/**
 * HIDC AI logistics missions (tab Logistica): a pilot orders an AI CH-47 or C-130 to move munitions
 * from one BLUE airport's warehouse to another, paying BLUE points.
 *
 *   - CH-47 from level HIDC_AIRLIFT_CH47_MIN_LEVEL (6), airports + heliports/FARPs
 *   - C-130 from level HIDC_AIRLIFT_C130_MIN_LEVEL (25), airports with a runway only
 *   - cost = aircraft base + HIDC_AIRLIFT_COST_PER_UNIT per munition carried; no cap on the load
 *
 * The order goes to DCS through the DBRIDGE queue (type "ai_airlift"): DCORE DBRIDGE_AirLift.lua re-checks stock
 * and points, moves the (simulated) cargo and flies the aircraft. Its state file Export_AirLift.json (read-only here)
 * carries the flights and the crash sites: if the aircraft goes down, 15 crates with the cargo wait at the crash point
 * to be slung to a BLUE airport. Crash sites are persistent in DCORE (they survive a mission restart).
 */
import fs from 'fs';
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function envFloat(name, fallback) {
  const value = Number.parseFloat(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const AIRLIFT_AIRCRAFT = Object.freeze({
  CH47: Object.freeze({
    key: 'CH47',
    label: 'CH-47F Chinook',
    minLevel: envInt('HIDC_AIRLIFT_CH47_MIN_LEVEL', 6),
    baseCost: envInt('HIDC_AIRLIFT_CH47_BASE_COST', 50),
    runwayOnly: false,
    // Cruise speed of the AI (DCORE DBRIDGE_Config.lua airlift.aircraft.CH47.speed_kmh): route time estimate on the site.
    speedKmh: 250,
  }),
  C130: Object.freeze({
    key: 'C130',
    label: 'C-130J-30 Super Hercules',
    minLevel: envInt('HIDC_AIRLIFT_C130_MIN_LEVEL', 25),
    baseCost: envInt('HIDC_AIRLIFT_C130_BASE_COST', 120),
    runwayOnly: true,
    speedKmh: 500,
  }),
});

export const AIRLIFT_RULES = Object.freeze({
  costPerUnit: envFloat('HIDC_AIRLIFT_COST_PER_UNIT', 0.5),
  cratesPerLoad: 15,
});

const ORDER_HISTORY = 60;
// CSV ids such as "weapons.droptanks.1100L Tank Empty" or "weapons.containers.{INV-SMOKE-WHITE}": spaces allowed, no commas / newlines.
const ITEM_PATTERN = /^weapons\.[A-Za-z0-9_]+\.[^,\r\n]{1,100}$/;

export function airliftCost(aircraftKey, units) {
  const aircraft = AIRLIFT_AIRCRAFT[aircraftKey];
  if (!aircraft) return 0;
  return aircraft.baseCost + Math.ceil(Math.max(0, units) * AIRLIFT_RULES.costPerUnit);
}

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/**
 * @param {object} deps
 * @param {string|null} deps.stateFile                Export_AirLift.json (DCORE, read-only)
 * @param {() => Array} deps.getActiveAirports         BLUE airports (config objects: id, name, csvPrefix, isHeliport, isCarrier, coordinates)
 * @param {(airportId: string) => Array} deps.getAirportStock  warehouse rows [{ item, quantity }] from the CSV buffer
 * @param {() => number|null} deps.readBluePoints
 * @param {(user, minLevel, action) => object} deps.requirePilot
 * @param {(user) => number} deps.levelOf
 * @param {(cmd: object) => object} deps.enqueueWebCommand
 * @param {(id: string) => object|null} deps.getWebCommandResult
 * @param {(event: string, payload: object) => void} deps.emit
 * @param {(event: object) => void} [deps.pushFeed]
 */
export function createHidcAirLift(deps) {
  let lastStateMtime = 0;
  let lastResultSignature = '';

  function readOrders() {
    const raw = loadJson(DOC.HIDC_AIRLIFT, null) || {};
    return Array.isArray(raw.orders) ? raw.orders : [];
  }

  function writeOrders(orders) {
    saveJson(DOC.HIDC_AIRLIFT, { orders: orders.slice(0, ORDER_HISTORY) });
  }

  function readDcoreState() {
    try {
      if (!deps.stateFile || !fs.existsSync(deps.stateFile)) return { flights: [], sites: [], available: false };
      const raw = fs.readFileSync(deps.stateFile, 'utf8');
      const parsed = raw.trim() ? JSON.parse(raw) : {};
      return {
        flights: Array.isArray(parsed.flights) ? parsed.flights : [],
        sites: Array.isArray(parsed.sites) ? parsed.sites : [],
        updatedAt: Number(parsed.updated_at) || null,
        available: true,
      };
    } catch (error) {
      console.error('HIDC airlift state read error:', error.message);
      return { flights: [], sites: [], available: false };
    }
  }

  function airportOptions() {
    return (deps.getActiveAirports() || [])
      .filter((airport) => airport && airport.id && !airport.isCarrier)
      .map((airport) => ({
        id: airport.id,
        name: airport.displayName || airport.name || airport.id,
        dcsName: airport.csvPrefix || airport.name,
        isHeliport: airport.isHeliport === true,
        coordinates: airport.coordinates || null,
      }));
  }

  function order(user, body, now = Date.now()) {
    const aircraft = AIRLIFT_AIRCRAFT[String(body?.aircraft || '').toUpperCase()];
    if (!aircraft) throw httpError('Mezzo non valido.');
    const pilot = deps.requirePilot(user, aircraft.minLevel, `ordinare un ${aircraft.label}`);

    const airports = airportOptions();
    const from = airports.find((airport) => airport.id === String(body?.fromId || ''));
    const to = airports.find((airport) => airport.id === String(body?.toId || ''));
    if (!from || !to) throw httpError('Partenza e arrivo devono essere aeroporti BLUE.');
    if (from.id === to.id) throw httpError('Partenza e arrivo coincidono.');
    if (aircraft.runwayOnly && (from.isHeliport || to.isHeliport)) {
      throw httpError(`Il ${aircraft.label} non può partire o atterrare su eliporti e FARP.`);
    }

    const stock = new Map((deps.getAirportStock(from.id) || []).map((row) => [String(row.item), Math.max(0, Math.floor(Number(row.quantity) || 0))]));
    const merged = new Map();
    (Array.isArray(body?.items) ? body.items : []).forEach((row) => {
      const id = String(row?.id || '').trim();
      const qty = Math.floor(Number(row?.qty) || 0);
      if (!ITEM_PATTERN.test(id) || qty <= 0) return;
      merged.set(id, (merged.get(id) || 0) + qty);
    });
    if (merged.size === 0) throw httpError('Scegli almeno una munizione da trasportare.');
    const items = [...merged.entries()].map(([id, qty]) => {
      const have = stock.get(id) || 0;
      if (qty > have) throw httpError(`Stock insufficiente a ${from.name}: ${id.split('.').pop()} ${have}/${qty}.`);
      return { id, qty };
    });
    const units = items.reduce((sum, item) => sum + item.qty, 0);
    const cost = airliftCost(aircraft.key, units);
    const blue = deps.readBluePoints();
    if (Number.isFinite(blue) && blue < cost) throw httpError(`Punti BLUE insufficienti (${blue}/${cost}).`, 409);

    const id = `AL${now.toString(36).toUpperCase()}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const pilotName = pilot.stats?.name || pilot.link?.name || user.username || null;
    const commandId = `airlift_${id}`;
    deps.enqueueWebCommand({
      id: commandId,
      type: 'ai_airlift',
      mission_id: id,
      aircraft: aircraft.key,
      from: from.dcsName,
      to: to.dcsName,
      items,
      cost,
      pilot: pilotName || '',
      requested_by: pilotName || '',
      requested_by_id: user.id,
      ts: now,
    });
    const entry = {
      id,
      commandId,
      discordId: user.id,
      pilotName,
      aircraft: aircraft.key,
      fromId: from.id,
      toId: to.id,
      fromName: from.name,
      toName: to.name,
      items,
      units,
      cost,
      createdAt: now,
    };
    writeOrders([entry, ...readOrders()]);
    deps.emit('hidc:airlift-updated', { reason: 'ordered' });
    deps.pushFeed?.({
      type: 'logistics.airlift.ordered',
      title: 'Missione logistica IA',
      message: `${pilotName || 'Un pilota'} ha ordinato un ${aircraft.label}: ${from.name} → ${to.name}, ${units} munizioni`,
      actor: pilotName,
      metadata: { aircraft: aircraft.key, from: from.id, to: to.id, units, cost },
    });
    return entry;
  }

  /** Order status: DCS result first (refused?), then the flight in the DCORE state file. */
  function publicOrder(entry, flightsById) {
    const flight = flightsById.get(entry.id) || null;
    const result = deps.getWebCommandResult(entry.commandId);
    let status = 'queued';
    let message = null;
    if (result && result.ok === false) {
      status = 'refused';
      message = result.message || null;
    } else if (flight) {
      status = flight.status || 'enroute';
      message = flight.reason || null;
    } else if (result && result.ok === true) {
      status = 'enroute';
    }
    return {
      id: entry.id,
      aircraft: entry.aircraft,
      pilotName: entry.pilotName,
      mine: false,
      fromId: entry.fromId,
      toId: entry.toId,
      fromName: entry.fromName,
      toName: entry.toName,
      items: entry.items,
      units: entry.units,
      cost: entry.cost,
      createdAt: entry.createdAt,
      status,
      message,
      position: flight && Number.isFinite(Number(flight.lat)) && flight.status === 'enroute'
        ? { lat: Number(flight.lat), lon: Number(flight.lon) }
        : null,
      endedAt: flight?.ended_at ? Number(flight.ended_at) * 1000 : null,
      siteId: flight?.site_id || null,
    };
  }

  function publicSite(site) {
    const crates = (Array.isArray(site.crates) ? site.crates : [])
      .filter((crate) => Number.isFinite(Number(crate.lat)) && Number.isFinite(Number(crate.lon)));
    const units = crates.reduce((sum, crate) => sum + (crate.items || []).reduce((s, it) => s + (Number(it.qty) || 0), 0), 0);
    return {
      id: String(site.id),
      flightId: site.flight_id || null,
      aircraft: site.aircraft || null,
      pilotName: site.pilot || null,
      from: site.from || null,
      to: site.to || null,
      lat: Number(site.lat),
      lon: Number(site.lon),
      createdAt: site.created_at ? Number(site.created_at) * 1000 : null,
      cratesLeft: crates.length,
      recovered: Number(site.recovered) || 0,
      lost: Number(site.lost) || 0,
      units,
      crates: crates.map((crate) => ({ lat: Number(crate.lat), lon: Number(crate.lon) })),
    };
  }

  function getPublicState(user) {
    const dcore = readDcoreState();
    const flightsById = new Map(dcore.flights.map((flight) => [String(flight.id), flight]));
    const level = user?.id ? deps.levelOf(user) : null;
    const orders = readOrders().map((entry) => ({
      ...publicOrder(entry, flightsById),
      mine: Boolean(user?.id && entry.discordId === user.id),
    }));
    return {
      available: dcore.available,
      rules: {
        costPerUnit: AIRLIFT_RULES.costPerUnit,
        cratesPerLoad: AIRLIFT_RULES.cratesPerLoad,
        aircraft: Object.values(AIRLIFT_AIRCRAFT).map((aircraft) => ({
          ...aircraft,
          unlocked: level != null && level >= aircraft.minLevel,
        })),
      },
      me: user?.id ? { level, linked: level != null } : null,
      bluePoints: deps.readBluePoints(),
      airports: airportOptions().map(({ dcsName, ...rest }) => rest),
      orders,
      sites: dcore.sites
        .map(publicSite)
        .filter((site) => site.cratesLeft > 0 && Number.isFinite(site.lat) && Number.isFinite(site.lon)),
    };
  }

  /** Tells the clients when DCS rewrites the state file or answers a command. */
  function tick() {
    let changed = false;
    try {
      if (deps.stateFile && fs.existsSync(deps.stateFile)) {
        const mtime = fs.statSync(deps.stateFile).mtimeMs;
        if (mtime !== lastStateMtime) {
          changed = lastStateMtime !== 0;
          lastStateMtime = mtime;
        }
      }
    } catch {
      // state file being rewritten: next tick
    }
    const signature = readOrders().slice(0, 20)
      .map((entry) => `${entry.id}:${deps.getWebCommandResult(entry.commandId)?.ok ?? '-'}`).join('|');
    if (signature !== lastResultSignature) {
      changed = changed || lastResultSignature !== '';
      lastResultSignature = signature;
    }
    if (changed) deps.emit('hidc:airlift-updated', { reason: 'dcs' });
  }

  return { order, getPublicState, tick, readDcoreState };
}

export default { createHidcAirLift, airliftCost, AIRLIFT_AIRCRAFT, AIRLIFT_RULES };
