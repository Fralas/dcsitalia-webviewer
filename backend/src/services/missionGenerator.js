import { missionRules, isImportantWeapon, getPriority, getSupplyQuantityForPriority } from '../config/rules.config.js';
import { airports, getMainBase, getAirportById } from '../config/airports.config.js';
import * as historicalData from './historicalData.js';
import { calculateDistance, findBestDonor } from '../utils/distanceCalculator.js';

/**
 * Check weapons and generate missions with smart donor selection
 * @param {string} recipientAirportId - Airport ID that needs supplies
 * @param {Array} recipientWeapons - Array of weapon objects at recipient
 * @param {Object} allAirportsData - Object containing all airports' current data
 * @returns {Array} Array of generated mission IDs
 */
export function checkAndGenerateMissions(recipientAirportId, recipientWeapons, allAirportsData = {}) {
  const mainBase = getMainBase();
  const recipientAirport = getAirportById(recipientAirportId);

  // Don't generate missions for the main base
  if (!recipientAirport || recipientAirport.isMainBase) {
    return [];
  }

  const generatedMissions = [];

  recipientWeapons.forEach(weapon => {
    // Check if weapon is important
    if (!isImportantWeapon(weapon.item)) {
      return;
    }

    // Check if quantity is below medium threshold (generates for CRITICAL, HIGH, MEDIUM)
    if (weapon.quantity > missionRules.mediumThreshold) {
      return;
    }

    // Check if a mission already exists for this weapon
    if (historicalData.missionExistsForWeapon(recipientAirportId, weapon.item)) {
      console.log(`Mission already exists for ${weapon.item} at ${recipientAirportId}`);
      return;
    }

    // Calculate priority and quantity needed
    const priority = getPriority(weapon.quantity);
    const quantityNeeded = getSupplyQuantityForPriority(priority);

    // Find best donor for this weapon
    const bestSource = findBestSourceAirport({
      recipientAirport,
      weaponId: weapon.item,
      quantityNeeded,
      allAirportsData,
    });

    // Create mission with source airport
    const missionId = historicalData.createMission(
      recipientAirportId,
      weapon.item,
      quantityNeeded,
      weapon.quantity,
      missionRules.mission.missionExpiry,
      bestSource.airportId,
      bestSource.distance
    );

    console.log(`✈️  Generated ${priority.toUpperCase()} mission ${missionId}`);
    console.log(`   Route: ${bestSource.airportName} → ${recipientAirport.displayName} (${bestSource.distance}nm)`);
    console.log(`   Weapon: ${weapon.item} (current: ${weapon.quantity}, needed: ${quantityNeeded})`);

    generatedMissions.push(missionId);
  });

  return generatedMissions;
}

/**
 * Find the best source airport (donor or main base) for a weapon
 *
 * @param {Object} params - Parameters
 * @param {Object} params.recipientAirport - Recipient airport object
 * @param {string} params.weaponId - Weapon ID
 * @param {number} params.quantityNeeded - Quantity needed
 * @param {Object} params.allAirportsData - All airports current data
 * @returns {Object} {airportId, airportName, distance, isDonor}
 */
function findBestSourceAirport({ recipientAirport, weaponId, quantityNeeded, allAirportsData }) {
  const mainBase = getMainBase();
  const minDonorQty = missionRules.donor.minQuantityToDonate;
  const bufferQty = missionRules.mediumThreshold + missionRules.donor.bufferAfterDonation; // 50 + 25 = 75
  const distanceThreshold = missionRules.donor.distanceThreshold;

  // Calculate distance from main base to recipient
  const mainBaseDistance = calculateDistance(mainBase.coordinates, recipientAirport.coordinates);

  // Find potential donors
  const potentialDonors = [];

  airports.forEach(airport => {
    // Skip recipient airport and main base
    if (airport.id === recipientAirport.id || airport.isMainBase) {
      return;
    }

    // Get weapon data for this airport
    const airportData = allAirportsData[airport.id];
    if (!airportData || !airportData.data || !airportData.data.weapons) {
      return;
    }

    const weaponData = airportData.data.weapons.find(w => w.item === weaponId);
    if (!weaponData) {
      return;
    }

    const currentQty = weaponData.quantity;

    // Check if eligible as donor:
    // 1. Must have > minQuantityToDonate (150)
    // 2. After donation, must keep at least bufferQty (75)
    if (currentQty > minDonorQty && (currentQty - quantityNeeded) >= bufferQty) {
      const distance = calculateDistance(airport.coordinates, recipientAirport.coordinates);

      potentialDonors.push({
        airport,
        quantity: currentQty,
        distance,
      });
    }
  });

  // Find best donor using algorithm
  const bestDonor = findBestDonor({
    potentialDonors,
    mainBase,
    mainBaseDistance,
    distanceThreshold,
  });

  // If no suitable donor or main base is better, use main base
  if (!bestDonor) {
    return {
      airportId: mainBase.id,
      airportName: mainBase.displayName,
      distance: mainBaseDistance,
      isDonor: false,
    };
  }

  // Use donor
  return {
    airportId: bestDonor.airport.id,
    airportName: bestDonor.airport.displayName,
    distance: bestDonor.distance,
    isDonor: true,
  };
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
  if (currentQuantity <= missionRules.criticalThreshold) return 'critical';  // <= 5
  if (currentQuantity <= missionRules.highThreshold) return 'high';          // <= 20
  if (currentQuantity <= missionRules.mediumThreshold) return 'medium';      // <= 50
  return 'ok';
}

export default {
  checkAndGenerateMissions,
  getWeaponDisplayName,
  getMissionPriority,
};
