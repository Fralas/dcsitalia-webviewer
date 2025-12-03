import fs from 'fs';
import path from 'path';
import { isImportantWeapon } from '../config/rules.config.js';

const DATA_DIR = './data/historical';
const SNAPSHOTS_FILE = path.join(DATA_DIR, 'snapshots.json');
const MISSIONS_FILE = path.join(DATA_DIR, 'missions.json');

// Ensure directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize files if they don't exist
if (!fs.existsSync(SNAPSHOTS_FILE)) {
  fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify([], null, 2));
}
if (!fs.existsSync(MISSIONS_FILE)) {
  fs.writeFileSync(MISSIONS_FILE, JSON.stringify([], null, 2));
}

/**
 * Read snapshots from file (READ-ONLY for CSV files)
 */
function readSnapshots() {
  try {
    const data = fs.readFileSync(SNAPSHOTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading snapshots:', error.message);
    return [];
  }
}

/**
 * Write snapshots to file (NEVER writes to CSV files)
 */
function writeSnapshots(snapshots) {
  try {
    fs.writeFileSync(SNAPSHOTS_FILE, JSON.stringify(snapshots, null, 2));
  } catch (error) {
    console.error('Error writing snapshots:', error.message);
  }
}

/**
 * Read missions from file
 */
function readMissions() {
  try {
    const data = fs.readFileSync(MISSIONS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading missions:', error.message);
    return [];
  }
}

/**
 * Write missions to file (NEVER writes to CSV files)
 */
function writeMissions(missions) {
  try {
    fs.writeFileSync(MISSIONS_FILE, JSON.stringify(missions, null, 2));
  } catch (error) {
    console.error('Error writing missions:', error.message);
  }
}

/**
 * Save warehouse snapshot (only important weapons for efficiency)
 */
export function saveSnapshot(airportId, data) {
  const snapshots = readSnapshots();

  // Filter only important weapons to reduce file size
  const importantWeapons = data.weapons ? data.weapons.filter(w => isImportantWeapon(w.item)) : [];

  snapshots.push({
    airport_id: airportId,
    timestamp: Date.now(),
    weapons: importantWeapons,
  });

  // Cleanup old snapshots (older than 7 days)
  const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  const filteredSnapshots = snapshots.filter(s => s.timestamp >= sevenDaysAgo);

  writeSnapshots(filteredSnapshots);

  // Log cleanup if any were removed
  const removed = snapshots.length - filteredSnapshots.length;
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} old snapshots (>7 days)`);
  }
}

/**
 * Get historical data for an airport
 */
export function getHistory(airportId, hoursBack = 24) {
  const snapshots = readSnapshots();
  const timestamp = Date.now() - (hoursBack * 60 * 60 * 1000);

  return snapshots
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
  const snapshots = readSnapshots();
  const timestamp = Date.now() - (days * 24 * 60 * 60 * 1000);

  const history = snapshots
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
  const snapshots = readSnapshots();

  const airportSnapshots = snapshots.filter(s => s.airport_id === airportId);
  if (airportSnapshots.length === 0) return null;

  const latest = airportSnapshots[airportSnapshots.length - 1];
  return {
    timestamp: latest.timestamp,
    weapons: latest.weapons || latest.data?.weapons || [],
  };
}

/**
 * Create a new mission
 */
export function createMission(airportId, weaponId, quantityNeeded, currentQuantity, expiryHours = 24) {
  const missions = readMissions();

  const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + (expiryHours * 60 * 60 * 1000);

  missions.push({
    id: missionId,
    airport_id: airportId,
    weapon_id: weaponId,
    quantity_needed: quantityNeeded,
    current_quantity: currentQuantity,
    status: 'pending',
    created_at: createdAt,
    expires_at: expiresAt,
    accepted_at: null,
    accepted_by: null,
    completed_at: null,
  });

  writeMissions(missions);
  return missionId;
}

/**
 * Get all active missions
 */
export function getActiveMissions() {
  const missions = readMissions();
  const now = Date.now();

  return missions.filter(m =>
    (m.status === 'pending' || m.status === 'accepted') &&
    m.expires_at > now
  );
}

/**
 * Get missions for an airport
 */
export function getAirportMissions(airportId) {
  const missions = readMissions();
  const now = Date.now();

  return missions.filter(m =>
    m.airport_id === airportId &&
    (m.status === 'pending' || m.status === 'accepted') &&
    m.expires_at > now
  );
}

/**
 * Accept a mission
 */
export function acceptMission(missionId, userId) {
  const missions = readMissions();

  const mission = missions.find(m => m.id === missionId && m.status === 'pending');
  if (!mission) return false;

  mission.status = 'accepted';
  mission.accepted_at = Date.now();
  mission.accepted_by = userId;

  writeMissions(missions);
  return true;
}

/**
 * Complete a mission
 */
export function completeMission(missionId) {
  const missions = readMissions();

  const mission = missions.find(m => m.id === missionId && m.status === 'accepted');
  if (!mission) return false;

  mission.status = 'completed';
  mission.completed_at = Date.now();

  writeMissions(missions);
  return true;
}

/**
 * Cancel a mission
 */
export function cancelMission(missionId) {
  const missions = readMissions();

  const mission = missions.find(m => m.id === missionId);
  if (!mission) return false;

  mission.status = 'cancelled';

  writeMissions(missions);
  return true;
}

/**
 * Check if a mission already exists for this weapon (to avoid duplicates)
 */
export function missionExistsForWeapon(airportId, weaponId) {
  const missions = readMissions();
  const now = Date.now();

  return missions.some(m =>
    m.airport_id === airportId &&
    m.weapon_id === weaponId &&
    (m.status === 'pending' || m.status === 'accepted') &&
    m.expires_at > now
  );
}

/**
 * Clean up expired missions
 */
export function cleanupExpiredMissions() {
  const missions = readMissions();
  const now = Date.now();

  let expiredCount = 0;
  missions.forEach(m => {
    if ((m.status === 'pending' || m.status === 'accepted') && m.expires_at <= now) {
      m.status = 'expired';
      expiredCount++;
    }
  });

  if (expiredCount > 0) {
    writeMissions(missions);
  }

  return expiredCount;
}

/**
 * Clear all missions (DEBUG ONLY)
 */
export function clearAllMissions() {
  writeMissions([]);
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
