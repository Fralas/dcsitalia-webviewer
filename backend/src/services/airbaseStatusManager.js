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
 * Check if an airbase is active
 * @param {string} airbaseName - Name of the airbase
 * @returns {boolean} True if active, false otherwise
 */
export function isAirbaseActive(airbaseName) {
  // If no status file loaded, default to active (backward compatibility)
  if (Object.keys(airbaseStatus).length === 0) {
    return true;
  }

  if (Object.prototype.hasOwnProperty.call(airbaseStatus, airbaseName)) {
    return airbaseStatus[airbaseName] !== false;
  }

  const normalizedName = normalizeAirbaseName(airbaseName);
  if (Object.prototype.hasOwnProperty.call(normalizedAirbaseStatus, normalizedName)) {
    return normalizedAirbaseStatus[normalizedName] !== false;
  }

  // If airbase not in status file, default to active
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

  return airports.filter(airport => {
    // Main base is always active
    if (airport.isMainBase) {
      return true;
    }

    // Check if airport is active in status file
    return isAirbaseActive(airport.name);
  });
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
  getActiveAirports,
  getActiveAirportById,
};
