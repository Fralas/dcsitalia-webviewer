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
    // Check if weapon is important for this type of base (airport vs heliport)
    if (!isImportantWeapon(weapon.item, recipientAirport.isHeliport)) {
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

    // Get source airport object for aircraft recommendation
    const sourceAirport = getAirportById(bestSource.airportId);

    // Determine recommended aircraft
    const recommendedAircraft = determineRecommendedAircraft(
      sourceAirport,
      recipientAirport,
      bestSource.distance,
      priority
    );

    // Create mission with source airport and recommended aircraft
    const missionId = historicalData.createMission(
      recipientAirportId,
      weapon.item,
      quantityNeeded,
      weapon.quantity,
      missionRules.mission.missionExpiry,
      bestSource.airportId,
      bestSource.distance,
      recommendedAircraft
    );

    console.log(`✈️  Generated ${priority.toUpperCase()} mission ${missionId}`);
    console.log(`   Route: ${bestSource.airportName} → ${recipientAirport.displayName} (${bestSource.distance}nm)`);
    console.log(`   Weapon: ${weapon.item} (current: ${weapon.quantity}, needed: ${quantityNeeded})`);
    console.log(`   Recommended: ${recommendedAircraft.toUpperCase()}`);

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
export function findBestSourceAirport({ recipientAirport, weaponId, quantityNeeded, allAirportsData }) {
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
 * Determine recommended aircraft for mission based on multiple factors
 *
 * Logic:
 * 1. If donor base has herculesBase = false → helicopter
 * 2. If distance < 35 NM → helicopter
 * 3. If destination is heliport → helicopter
 * 4. If mission is CRITICAL → always airplane
 * 5. BUT if CRITICAL to heliport → airdrop (airplane without landing)
 * 6. Otherwise → airplane
 *
 * @param {Object} sourceAirport - Source airport object
 * @param {Object} recipientAirport - Recipient airport object
 * @param {number} distance - Distance in nautical miles
 * @param {string} priority - Mission priority (critical, high, medium)
 * @returns {string} 'helicopter', 'airplane', or 'airdrop'
 */
export function determineRecommendedAircraft(sourceAirport, recipientAirport, distance, priority) {
  const isCritical = priority === 'critical';
  const isDestinationHeliport = recipientAirport.isHeliport === true;
  const isSourceHerculesBase = sourceAirport.herculesBase === true;
  const isShortDistance = distance < 35;

  // Special case: CRITICAL to heliport → always airdrop
  if (isCritical && isDestinationHeliport) {
    return 'airdrop';
  }

  // CRITICAL missions always use airplane (unless to heliport, handled above)
  if (isCritical) {
    return 'airplane';
  }

  // If source cannot support Hercules → helicopter
  if (!isSourceHerculesBase) {
    return 'helicopter';
  }

  // If short distance → helicopter
  if (isShortDistance) {
    return 'helicopter';
  }

  // If destination is heliport → helicopter
  if (isDestinationHeliport) {
    return 'helicopter';
  }

  // Default: airplane
  return 'airplane';
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
  findBestSourceAirport,
  getWeaponDisplayName,
  getMissionPriority,
};
