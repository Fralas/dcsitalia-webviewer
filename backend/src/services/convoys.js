import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data/historical');
const CONVOYS_FILE = path.join(DATA_DIR, 'convoys.json');
const WRITE_DELAY_MS = 400;
const MAX_HISTORY_PER_CONVOY = 200;
const MAX_PATH_POINTS = 500;

let convoysCache = [];
let convoysById = new Map();
let writeTimer = null;
let dirty = false;

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CONVOYS_FILE)) {
    fs.writeFileSync(CONVOYS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return fallback;
  }
}

async function writeJsonAtomic(filePath, payload) {
  const tempPath = `${filePath}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, filePath);
}

function scheduleWrite() {
  dirty = true;
  if (writeTimer) return;

  writeTimer = setTimeout(async () => {
    writeTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await writeJsonAtomic(CONVOYS_FILE, convoysCache);
    } catch (error) {
      console.error('Error writing convoys file:', error.message);
    }
  }, WRITE_DELAY_MS);
}

function rebuildIndex() {
  convoysById = new Map();
  convoysCache.forEach((convoy) => {
    if (convoy?.convoy_id) {
      convoysById.set(convoy.convoy_id, convoy);
    }
  });
}

function sanitizeString(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function sanitizePosition(position) {
  if (!position || typeof position !== 'object') return null;
  const lat = Number(position.lat);
  const lon = Number(position.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function pushPathPoint(convoy, position, timestamp) {
  if (!position) return;
  const lastPoint = convoy.path[convoy.path.length - 1];
  if (lastPoint && Math.abs(lastPoint.lat - position.lat) < 0.000001 && Math.abs(lastPoint.lon - position.lon) < 0.000001) {
    convoy.last_position = position;
    return;
  }

  convoy.path.push({
    lat: position.lat,
    lon: position.lon,
    ts: timestamp,
  });
  if (convoy.path.length > MAX_PATH_POINTS) {
    convoy.path = convoy.path.slice(convoy.path.length - MAX_PATH_POINTS);
  }
  convoy.last_position = position;
}

function pushHistory(convoy, entry) {
  convoy.history.push(entry);
  if (convoy.history.length > MAX_HISTORY_PER_CONVOY) {
    convoy.history = convoy.history.slice(convoy.history.length - MAX_HISTORY_PER_CONVOY);
  }
}

ensureStorage();
convoysCache = readJson(CONVOYS_FILE, []);
rebuildIndex();

export const CONVOY_EVENT_TYPES = new Set(['spawned', 'update', 'arrived', 'destroyed']);

export function getConvoys(status = null) {
  if (!status) return convoysCache;
  return convoysCache.filter((convoy) => convoy.status === status);
}

export function getConvoyById(convoyId) {
  return convoysById.get(convoyId) || null;
}

export function clearAllConvoys() {
  convoysCache = [];
  convoysById = new Map();
  scheduleWrite();
  return true;
}

export function recordConvoyEvent(payload = {}) {
  const eventType = sanitizeString(payload.event).toLowerCase();
  if (!CONVOY_EVENT_TYPES.has(eventType)) {
    throw new Error('Invalid convoy event type');
  }

  const convoyId = sanitizeString(payload.convoy_id);
  if (!convoyId) {
    throw new Error('convoy_id is required');
  }

  const timestamp = Number.isFinite(payload.ts) ? Number(payload.ts) : Date.now();
  const originZone = sanitizeString(payload.origin_zone);
  const destinationZone = sanitizeString(payload.destination_zone);
  const groupName = sanitizeString(payload.group_name);
  const position = sanitizePosition(payload.position);
  const originPosition = sanitizePosition(payload.origin_position);
  const destinationPosition = sanitizePosition(payload.destination_position);
  const unitsTotal = Number.isFinite(payload.units_total) ? Number(payload.units_total) : null;
  const unitsAlive = Number.isFinite(payload.units_alive) ? Number(payload.units_alive) : null;

  let convoy = convoysById.get(convoyId);
  if (!convoy) {
    convoy = {
      convoy_id: convoyId,
      origin_zone: originZone || null,
      destination_zone: destinationZone || null,
      origin_position: originPosition || null,
      destination_position: destinationPosition || null,
      group_name: groupName || null,
      status: eventType === 'destroyed' ? 'destroyed' : eventType === 'arrived' ? 'arrived' : 'active',
      spawned_at: eventType === 'spawned' ? timestamp : null,
      arrived_at: eventType === 'arrived' ? timestamp : null,
      destroyed_at: eventType === 'destroyed' ? timestamp : null,
      last_update: timestamp,
      units_total: unitsTotal,
      units_alive: unitsAlive,
      last_position: null,
      path: [],
      history: [],
    };

    convoysCache.push(convoy);
    convoysById.set(convoyId, convoy);
  }

  if (originZone) convoy.origin_zone = originZone;
  if (destinationZone) convoy.destination_zone = destinationZone;
  if (originPosition) convoy.origin_position = originPosition;
  if (destinationPosition) convoy.destination_position = destinationPosition;
  if (groupName) convoy.group_name = groupName;
  if (unitsTotal !== null) convoy.units_total = unitsTotal;
  if (unitsAlive !== null) convoy.units_alive = unitsAlive;
  convoy.last_update = timestamp;

  if (eventType === 'spawned') {
    convoy.status = 'active';
    convoy.spawned_at = convoy.spawned_at || timestamp;
  } else if (eventType === 'arrived') {
    convoy.status = 'arrived';
    convoy.arrived_at = timestamp;
  } else if (eventType === 'destroyed') {
    convoy.status = 'destroyed';
    convoy.destroyed_at = timestamp;
  } else if (eventType === 'update' && convoy.status !== 'destroyed' && convoy.status !== 'arrived') {
    convoy.status = 'active';
  }

  if (eventType === 'spawned' && position && !convoy.origin_position) {
    convoy.origin_position = position;
  }

  if ((eventType === 'arrived' || eventType === 'destroyed') && position && !convoy.destination_position) {
    convoy.destination_position = position;
  }

  pushPathPoint(convoy, position, timestamp);
  pushHistory(convoy, {
    type: eventType,
    ts: timestamp,
    position,
    units_alive: unitsAlive,
    units_total: unitsTotal,
  });

  scheduleWrite();
  return convoy;
}

export default {
  CONVOY_EVENT_TYPES,
  getConvoys,
  getConvoyById,
  clearAllConvoys,
  recordConvoyEvent,
};
