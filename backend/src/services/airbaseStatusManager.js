/**
 * Airbase Status Manager
 * Centralized management of active/inactive airbases
 * This module maintains the state loaded from airbase_status.lua
 */

import { airports } from '../config/airports.config.js';

// Internal state
let airbaseStatus = {};
let normalizedAirbaseStatus = {};

function normalizeAirbaseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectAirportStatusAliases(airport) {
  const aliases = new Set();
  const add = (value) => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;
    aliases.add(raw);
    aliases.add(normalizeAirbaseName(raw));
  };

  add(airport?.name);
  add(airport?.displayName);
  add(airport?.csvPrefix);
  add(airport?.id);
  add(airport?.id?.replace(/-/g, '_'));

  return aliases;
}

function lookupAirbaseStatusValue(airport) {
  for (const alias of collectAirportStatusAliases(airport)) {
    if (Object.prototype.hasOwnProperty.call(airbaseStatus, alias)) {
      return airbaseStatus[alias];
    }
    if (Object.prototype.hasOwnProperty.call(normalizedAirbaseStatus, alias)) {
      return normalizedAirbaseStatus[alias];
    }
  }

  return undefined;
}

/**
 * Check if an airport is forced active regardless of status file.
 * Main base, carriers and explicitly flagged always-active airbases are forced active.
 * @param {Object} airport - Airport config/data object
 * @returns {boolean}
 */
export function isAirportAlwaysActive(airport) {
  return Boolean(airport?.isMainBase || airport?.isCarrier || airport?.isAlwaysActive);
}

/**
 * Update the airbase status (called when lua file changes)
 * @param {Object} newStatus - New status object from lua file
 */
export function updateAirbaseStatus(newStatus) {
  airbaseStatus = newStatus || {};
  normalizedAirbaseStatus = {};

  for (const [name, status] of Object.entries(airbaseStatus)) {
    normalizedAirbaseStatus[normalizeAirbaseName(name)] = status;
  }
}

/**
 * Get current airbase status
 * @returns {Object} Current airbase status
 */
export function getAirbaseStatus() {
  return airbaseStatus;
}

/**
 * Check if an airbase is active by name (legacy helper).
 * @param {string} airbaseName - Name of the airbase
 * @returns {boolean} True if active, false otherwise
 */
export function isAirbaseActive(airbaseName) {
  return isAirportActive({ name: airbaseName });
}

/**
 * Check if an airport is coalition-active using status aliases.
 * @param {Object} airport - Airport config/data object
 * @returns {boolean}
 */
export function isAirportActive(airport) {
  if (isAirportAlwaysActive(airport)) {
    return true;
  }

  if (Object.keys(airbaseStatus).length === 0) {
    return true;
  }

  const statusValue = lookupAirbaseStatusValue(airport);
  if (statusValue !== undefined) {
    return statusValue !== false;
  }

  return true;
}

/**
 * Get list of active airports
 * Filters the full airport list based on airbase_status.lua
 * @returns {Array} Array of active airport objects
 */
export function getActiveAirports() {
  if (Object.keys(airbaseStatus).length === 0) {
    // If no status file loaded, return all airports (backward compatibility)
    return airports;
  }

  return airports.filter((airport) => isAirportActive(airport));
}

/**
 * Get active airport by ID
 * Returns null if airport is not active
 * @param {string} airportId - Airport ID
 * @returns {Object|null} Airport object or null
 */
export function getActiveAirportById(airportId) {
  const activeAirports = getActiveAirports();
  return activeAirports.find(a => a.id === airportId) || null;
}

export default {
  updateAirbaseStatus,
  getAirbaseStatus,
  isAirbaseActive,
  isAirportActive,
  isAirportAlwaysActive,
  getActiveAirports,
  getActiveAirportById,
};
