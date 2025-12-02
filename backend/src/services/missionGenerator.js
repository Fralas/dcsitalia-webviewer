import { missionRules, isImportantWeapon } from '../config/rules.config.js';
import { getMainBase } from '../config/airports.config.js';
import * as historicalData from './historicalData.js';

/**
 * Check weapons and generate missions if needed
 * @param {string} airportId - Airport ID
 * @param {Array} weapons - Array of weapon objects
 * @returns {Array} Array of generated mission IDs
 */
export function checkAndGenerateMissions(airportId, weapons) {
  const mainBase = getMainBase();

  // Don't generate missions for the main base
  if (mainBase && airportId === mainBase.id) {
    return [];
  }

  const generatedMissions = [];

  weapons.forEach(weapon => {
    // Check if weapon is important
    if (!isImportantWeapon(weapon.item)) {
      return;
    }

    // Check if quantity is below threshold
    if (weapon.quantity > missionRules.criticalThreshold) {
      return;
    }

    // Check if a mission already exists for this weapon
    if (historicalData.missionExistsForWeapon(airportId, weapon.item)) {
      console.log(`Mission already exists for ${weapon.item} at ${airportId}`);
      return;
    }

    // Generate mission
    const quantityNeeded = missionRules.mission.defaultSupplyQuantity;
    const missionId = historicalData.createMission(
      airportId,
      weapon.item,
      quantityNeeded,
      weapon.quantity,
      missionRules.mission.missionExpiry
    );

    console.log(`✈️  Generated mission ${missionId} for ${weapon.item} at ${airportId} (current: ${weapon.quantity}, needed: ${quantityNeeded})`);
    generatedMissions.push(missionId);
  });

  return generatedMissions;
}

/**
 * Get weapon display name (remove prefix for better readability)
 */
export function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

/**
 * Get mission priority based on current quantity
 */
export function getMissionPriority(currentQuantity) {
  if (currentQuantity <= 5) return 'critical';
  if (currentQuantity <= missionRules.criticalThreshold) return 'high';
  return 'medium';
}

export default {
  checkAndGenerateMissions,
  getWeaponDisplayName,
  getMissionPriority,
};
