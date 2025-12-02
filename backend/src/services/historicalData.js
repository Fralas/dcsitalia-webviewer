import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = './data/historical';
const DB_PATH = path.join(DB_DIR, 'warehouse.db');

// Ensure directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS warehouse_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    airport_id TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    data TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_airport_timestamp
    ON warehouse_snapshots(airport_id, timestamp);

  CREATE TABLE IF NOT EXISTS missions (
    id TEXT PRIMARY KEY,
    airport_id TEXT NOT NULL,
    weapon_id TEXT NOT NULL,
    quantity_needed INTEGER NOT NULL,
    current_quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    accepted_at INTEGER,
    accepted_by TEXT,
    completed_at INTEGER,
    expires_at INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_missions_status
    ON missions(status, created_at);

  CREATE INDEX IF NOT EXISTS idx_missions_airport
    ON missions(airport_id, status);
`);

/**
 * Save warehouse snapshot
 */
export function saveSnapshot(airportId, data) {
  const stmt = db.prepare(`
    INSERT INTO warehouse_snapshots (airport_id, timestamp, data)
    VALUES (?, ?, ?)
  `);

  stmt.run(airportId, Date.now(), JSON.stringify(data));
}

/**
 * Get historical data for an airport
 */
export function getHistory(airportId, hoursBack = 24) {
  const timestamp = Date.now() - (hoursBack * 60 * 60 * 1000);

  const stmt = db.prepare(`
    SELECT timestamp, data
    FROM warehouse_snapshots
    WHERE airport_id = ? AND timestamp >= ?
    ORDER BY timestamp ASC
  `);

  const rows = stmt.all(airportId, timestamp);
  return rows.map(row => ({
    timestamp: row.timestamp,
    data: JSON.parse(row.data),
  }));
}

/**
 * Get latest snapshot for an airport
 */
export function getLatestSnapshot(airportId) {
  const stmt = db.prepare(`
    SELECT timestamp, data
    FROM warehouse_snapshots
    WHERE airport_id = ?
    ORDER BY timestamp DESC
    LIMIT 1
  `);

  const row = stmt.get(airportId);
  if (!row) return null;

  return {
    timestamp: row.timestamp,
    data: JSON.parse(row.data),
  };
}

/**
 * Create a new mission
 */
export function createMission(airportId, weaponId, quantityNeeded, currentQuantity, expiryHours = 24) {
  const missionId = `mission_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = Date.now();
  const expiresAt = createdAt + (expiryHours * 60 * 60 * 1000);

  const stmt = db.prepare(`
    INSERT INTO missions (id, airport_id, weapon_id, quantity_needed, current_quantity, status, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)
  `);

  stmt.run(missionId, airportId, weaponId, quantityNeeded, currentQuantity, createdAt, expiresAt);
  return missionId;
}

/**
 * Get all active missions
 */
export function getActiveMissions() {
  const stmt = db.prepare(`
    SELECT *
    FROM missions
    WHERE status IN ('pending', 'accepted') AND expires_at > ?
    ORDER BY created_at DESC
  `);

  return stmt.all(Date.now());
}

/**
 * Get missions for an airport
 */
export function getAirportMissions(airportId) {
  const stmt = db.prepare(`
    SELECT *
    FROM missions
    WHERE airport_id = ? AND status IN ('pending', 'accepted') AND expires_at > ?
    ORDER BY created_at DESC
  `);

  return stmt.all(airportId, Date.now());
}

/**
 * Accept a mission
 */
export function acceptMission(missionId, userId) {
  const stmt = db.prepare(`
    UPDATE missions
    SET status = 'accepted', accepted_at = ?, accepted_by = ?
    WHERE id = ? AND status = 'pending'
  `);

  const result = stmt.run(Date.now(), userId, missionId);
  return result.changes > 0;
}

/**
 * Complete a mission
 */
export function completeMission(missionId) {
  const stmt = db.prepare(`
    UPDATE missions
    SET status = 'completed', completed_at = ?
    WHERE id = ? AND status = 'accepted'
  `);

  const result = stmt.run(Date.now(), missionId);
  return result.changes > 0;
}

/**
 * Cancel a mission
 */
export function cancelMission(missionId) {
  const stmt = db.prepare(`
    UPDATE missions
    SET status = 'cancelled'
    WHERE id = ?
  `);

  const result = stmt.run(missionId);
  return result.changes > 0;
}

/**
 * Check if a mission already exists for this weapon (to avoid duplicates)
 */
export function missionExistsForWeapon(airportId, weaponId) {
  const stmt = db.prepare(`
    SELECT COUNT(*) as count
    FROM missions
    WHERE airport_id = ? AND weapon_id = ?
      AND status IN ('pending', 'accepted')
      AND expires_at > ?
  `);

  const result = stmt.get(airportId, weaponId, Date.now());
  return result.count > 0;
}

/**
 * Clean up expired missions
 */
export function cleanupExpiredMissions() {
  const stmt = db.prepare(`
    UPDATE missions
    SET status = 'expired'
    WHERE status IN ('pending', 'accepted') AND expires_at <= ?
  `);

  const result = stmt.run(Date.now());
  return result.changes;
}

export default {
  saveSnapshot,
  getHistory,
  getLatestSnapshot,
  createMission,
  getActiveMissions,
  getAirportMissions,
  acceptMission,
  completeMission,
  cancelMission,
  missionExistsForWeapon,
  cleanupExpiredMissions,
};
