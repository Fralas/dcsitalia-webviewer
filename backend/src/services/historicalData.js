import fs from 'fs';
import path from 'path';
import { isImportantWeapon } from '../config/rules.config.js';
import { getAirportById } from '../config/airports.config.js';
import { calculateTotalWeight } from '../config/weaponWeights.config.js';

const DATA_DIR = './data/historical';
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
const MISSIONS_FILE = path.join(DATA_DIR, 'missions.json');

const SNAPSHOT_WRITE_DELAY_MS = 1000;
const MISSIONS_WRITE_DELAY_MS = 1000;

let snapshotsCache = [];
let missionsCache = [];
let missionsById = new Map();
let activeMissionIndex = new Map();
let snapshotsWriteTimer = null;
let missionsWriteTimer = null;
let snapshotsDirty = false;
let missionsDirty = false;

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(SNAPSHOTS_FILE)) {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(MISSIONS_FILE)) {
    fs.writeFileSync(MISSIONS_FILE, JSON.stringify([], null, 2));
  }
}

function readJsonFile(filePath, fallback) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
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

function scheduleSnapshotsWrite() {
  snapshotsDirty = true;
  if (snapshotsWriteTimer) return;

  snapshotsWriteTimer = setTimeout(async () => {
    snapshotsWriteTimer = null;
    if (!snapshotsDirty) return;
    snapshotsDirty = false;
    try {
      await writeJsonAtomic(SNAPSHOTS_FILE, snapshotsCache);
    } catch (error) {
      console.error('Error writing snapshots:', error.message);
    }
  }, SNAPSHOT_WRITE_DELAY_MS);
}

function scheduleMissionsWrite() {
  missionsDirty = true;
  if (missionsWriteTimer) return;

  missionsWriteTimer = setTimeout(async () => {
    missionsWriteTimer = null;
    if (!missionsDirty) return;
    missionsDirty = false;
    try {
      await writeJsonAtomic(MISSIONS_FILE, missionsCache);
    } catch (error) {
      console.error('Error writing missions:', error.message);
    }
  }, MISSIONS_WRITE_DELAY_MS);
}

function getMissionKey(airportId, weaponId) {
  return `${airportId}::${weaponId}`;
}

function isMissionActive(mission, now = Date.now()) {
  return (mission.status === 'pending' || mission.status === 'accepted') && mission.expires_at > now;
}

function addActiveIndex(mission, now = Date.now()) {
  if (!isMissionActive(mission, now)) return;
  const key = getMissionKey(mission.airport_id, mission.weapon_id);
  let ids = activeMissionIndex.get(key);
  if (!ids) {
    ids = new Set();
    activeMissionIndex.set(key, ids);
  }
  ids.add(mission.id);
}

function removeActiveIndex(mission) {
  const key = getMissionKey(mission.airport_id, mission.weapon_id);
  const ids = activeMissionIndex.get(key);
  if (!ids) return;
  ids.delete(mission.id);
  if (ids.size === 0) {
    activeMissionIndex.delete(key);
  }
}

function rebuildMissionIndex() {
  missionsById = new Map();
  activeMissionIndex = new Map();
  const now = Date.now();

  missionsCache.forEach(mission => {
    missionsById.set(mission.id, mission);
    addActiveIndex(mission, now);
  });
}

ensureStorage();

snapshotsCache = readJsonFile(SNAPSHOTS_FILE, []);
if (!Array.isArray(snapshotsCache)) {
  snapshotsCache = [];
}

missionsCache = readJsonFile(MISSIONS_FILE, []);
if (!Array.isArray(missionsCache)) {
  missionsCache = [];
}

rebuildMissionIndex();

/**
 * Save warehouse snapshot (only important weapons for efficiency)
 */
export function saveSnapshot(airportId, data) {
  const airport = getAirportById(airportId);

  // Filter only important weapons for this type of base (airport vs heliport vs carrier)
  const importantWeapons = data.weapons ? data.weapons.filter(w =>
    isImportantWeapon(w.item, airport?.isHeliport || false, airport?.isCarrier || false)
  ) : [];

  snapshotsCache.push({
    airport_id: airportId,
    timestamp: Date.now(),
    weapons: importantWeapons,
  });

  // Cleanup old snapshots (older than 7 days)
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const filteredSnapshots = snapshotsCache.filter(s => s.timestamp >= sevenDaysAgo);
  const removed = snapshotsCache.length - filteredSnapshots.length;
  snapshotsCache = filteredSnapshots;

  scheduleSnapshotsWrite();

  if (removed > 0) {
    console.log(`胑蘠 Cleaned up ${removed} old snapshots (>7 days)`);
  }
}

/**
 * Get historical data for an airport
 */
export function getHistory(airportId, hoursBack = 24) {
  const timestamp = Date.now() - (hoursBack * 60 * 60 * 1000);

  return snapshotsCache
    .filter(s => s.airport_id === airportId && s.timestamp >= timestamp)
    .map(s => ({
      timestamp: s.timestamp,
      weapons: s.weapons || s.data?.weapons || [], // Support both old and new format
    }));
}

/**
 * Get historical data for a specific weapon at an airport
 * @param {string} airportId - Airport ID
 * @param {string} weaponId - Weapon ID
 * @param {number} days - Number of days to look back (default: 7)
 * @returns {Array} Array of {timestamp, quantity} objects
 */
export function getWeaponHistory(airportId, weaponId, days = 7) {
  const timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

  const history = snapshotsCache
    .filter(s => s.airport_id === airportId && s.timestamp >= timestamp)
    .map(s => {
      // Find the weapon in this snapshot
      const weapons = s.weapons || s.data?.weapons || [];
      const weapon = weapons.find(w => w.item === weaponId);

      return {
        timestamp: s.timestamp,
        quantity: weapon ? weapon.quantity : null,
      };
    })
    .filter(h => h.quantity !== null); // Only include snapshots where weapon was found

  return history;
}

/**
 * Get latest snapshot for an airport
 */
export function getLatestSnapshot(airportId) {
  const airportSnapshots = snapshotsCache.filter(s => s.airport_id === airportId);
  if (airportSnapshots.length === 0) return null;

  const latest = airportSnapshots[airportSnapshots.length - 1];
  return {
    timestamp: latest.timestamp,
    weapons: latest.weapons || latest.data?.weapons || [],
  };
}

/**
 * Create a new mission with source routing
 */
export function createMission(airportId, weaponId, quantityNeeded, currentQuantity, expiryHours = 24, sourceAirportId = null, distance = null, recommendedAircraft = 'airplane') {
  const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + (expiryHours * 60 * 60 * 1000);

  // Calculate total weight for the cargo
  const totalWeightLbs = calculateTotalWeight(weaponId, quantityNeeded);

  const mission = {
    id: missionId,
    airport_id: airportId, // Destination (recipient)
    source_airport_id: sourceAirportId, // Source (donor or main base)
    distance_nm: distance, // Distance in nautical miles
    weapon_id: weaponId,
    quantity_needed: quantityNeeded,
    current_quantity: currentQuantity,
    total_weight_lbs: totalWeightLbs, // Total cargo weight in pounds
    status: 'pending',
    recommended_aircraft: recommendedAircraft, // 'helicopter', 'airplane', or 'airdrop'
    created_at: createdAt,
    expires_at: expiresAt,
    accepted_at: null,
    accepted_by: null,
    completed_at: null,
  };

  missionsCache.push(mission);
  missionsById.set(missionId, mission);
  addActiveIndex(mission, createdAt);
  scheduleMissionsWrite();
  return missionId;
}

/**
 * Get all active missions
 */
export function getActiveMissions() {
  const now = Date.now();

  return missionsCache.filter(m =>
    (m.status === 'pending' || m.status === 'accepted') &&
    m.expires_at > now
  );
}

/**
 * Get missions for an airport
 */
export function getAirportMissions(airportId) {
  const now = Date.now();

  return missionsCache.filter(m =>
    m.airport_id === airportId &&
    (m.status === 'pending' || m.status === 'accepted') &&
    m.expires_at > now
  );
}

/**
 * Accept a mission
 */
export function acceptMission(missionId, userId) {
  const mission = missionsById.get(missionId);
  if (!mission || mission.status !== 'pending') return false;

  mission.status = 'accepted';
  mission.accepted_at = Date.now();
  mission.accepted_by = userId;

  addActiveIndex(mission);
  scheduleMissionsWrite();
  return true;
}

/**
 * Complete a mission
 */
export function completeMission(missionId) {
  const mission = missionsById.get(missionId);
  if (!mission || mission.status !== 'accepted') return false;

  mission.status = 'completed';
  mission.completed_at = Date.now();

  removeActiveIndex(mission);
  scheduleMissionsWrite();
  return true;
}

/**
 * Cancel a mission
 */
export function cancelMission(missionId) {
  const mission = missionsById.get(missionId);
  if (!mission) return false;

  mission.status = 'cancelled';

  removeActiveIndex(mission);
  scheduleMissionsWrite();
  return true;
}

/**
 * Check if a mission already exists for this weapon (to avoid duplicates)
 */
export function missionExistsForWeapon(airportId, weaponId) {
  const now = Date.now();
  const key = getMissionKey(airportId, weaponId);
  const ids = activeMissionIndex.get(key);
  if (!ids || ids.size === 0) return false;

  let hasActive = false;
  for (const id of ids) {
    const mission = missionsById.get(id);
    if (!mission) {
      ids.delete(id);
      continue;
    }

    if (isMissionActive(mission, now)) {
      hasActive = true;
      break;
    }

    if (mission.status === 'pending' || mission.status === 'accepted') {
      mission.status = 'expired';
      removeActiveIndex(mission);
      scheduleMissionsWrite();
    }
  }

  if (ids.size === 0) {
    activeMissionIndex.delete(key);
  }

  return hasActive;
}

/**
 * Clean up expired missions
 */
export function cleanupExpiredMissions() {
  const now = Date.now();

  let expiredCount = 0;
  missionsCache.forEach(m => {
    if ((m.status === 'pending' || m.status === 'accepted') && m.expires_at <= now) {
      m.status = 'expired';
      removeActiveIndex(m);
      expiredCount++;
    }
  });

  if (expiredCount > 0) {
    scheduleMissionsWrite();
  }

  return expiredCount;
}

/**
 * Clear all missions (DEBUG ONLY)
 */
export function clearAllMissions() {
  missionsCache = [];
  missionsById = new Map();
  activeMissionIndex = new Map();
  scheduleMissionsWrite();
  return true;
}

export default {
  saveSnapshot,
  getHistory,
  getWeaponHistory,
  getLatestSnapshot,
  createMission,
  getActiveMissions,
  getAirportMissions,
  acceptMission,
  completeMission,
  cancelMission,
  missionExistsForWeapon,
  cleanupExpiredMissions,
  clearAllMissions,
};
