import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Parse airbase_status.lua file to extract active airbase status
 * @param {string} filePath - Path to the airbase_status.lua file
 * @returns {Object} - Object mapping airbase names to their status (true/false)
 */
function parseAirbaseStatus(filePath) {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const airbaseStatus = {};

    // Parse Lua table format: ["Airbase Name"] = true/false
    const pattern = /\["([^"]+)"\]\s*=\s*(true|false)/g;
    let match;

    while ((match = pattern.exec(fileContent)) !== null) {
      const airbaseName = match[1];
      const isActive = match[2] === 'true';
      airbaseStatus[airbaseName] = isActive;
    }

    console.log(`✅ Parsed airbase_status.lua: ${Object.keys(airbaseStatus).length} airbases found`);
    console.log(`   Active: ${Object.values(airbaseStatus).filter(v => v).length}, Inactive: ${Object.values(airbaseStatus).filter(v => !v).length}`);

    return airbaseStatus;
  } catch (error) {
    console.error('❌ Error parsing airbase_status.lua:', error.message);
    return {};
  }
}

/**
 * Load airbase status from the default location
 * @returns {Object} - Object mapping airbase names to their status
 */
function loadAirbaseStatus() {
  const defaultPath = path.join(__dirname, '../../../csvexample/airbase_status.lua');
  return parseAirbaseStatus(defaultPath);
}

/**
 * Get list of active airbase names
 * @param {Object} airbaseStatus - Airbase status object
 * @returns {Array<string>} - Array of active airbase names
 */
function getActiveAirbases(airbaseStatus) {
  return Object.entries(airbaseStatus)
    .filter(([_, isActive]) => isActive)
    .map(([name, _]) => name);
}

/**
 * Check if an airbase is active
 * @param {Object} airbaseStatus - Airbase status object
 * @param {string} airbaseName - Name of the airbase to check
 * @returns {boolean} - True if airbase is active, false otherwise
 */
function isAirbaseActive(airbaseStatus, airbaseName) {
  // If airbase not in status file, default to active (for backward compatibility)
  return airbaseStatus[airbaseName] !== false;
}

export {
  parseAirbaseStatus,
  loadAirbaseStatus,
  getActiveAirbases,
  isAirbaseActive
};

export default {
  parseAirbaseStatus,
  loadAirbaseStatus,
  getActiveAirbases,
  isAirbaseActive
};
