import {
  missionRules,
  isImportantWeapon,
  getWeaponPriority,
  getWeaponThresholds,
  getOrderQuantityForWeapon,
  getIsoFillForWeapon
} from '../config/rules.config.js';
import { getMainBase, getAirportById } from '../config/airports.config.js';
import * as historicalData from './historicalData.js';
import { calculateDistance, findBestDonor } from '../utils/distanceCalculator.js';
import * as airbaseStatusManager from './airbaseStatusManager.js';
import { calculateTotalWeight } from '../config/weaponWeights.config.js';

const PRIORITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  ok: 3,
};

function getPriorityRank(priority) {
  return PRIORITY_RANK[priority] ?? PRIORITY_RANK.ok;
}

function getMissionPriorityFromOrders(orders) {
  let best = 'ok';
  let bestRank = PRIORITY_RANK.ok;
  orders.forEach(order => {
    const rank = getPriorityRank(order.priority);
    if (rank < bestRank) {
      bestRank = rank;
      best = order.priority;
    }
  });
  return best;
}

/**
 * Check weapons and generate missions with smart donor selection
 * @param {string} recipientAirportId - Airport ID that needs supplies
 * @param {Array} recipientWeapons - Array of weapon objects at recipient
 * @param {Object} allAirportsData - Object containing all airports' current data
 * @returns {Array} Array of generated mission IDs
 */
export function checkAndGenerateMissions(recipientAirportId, recipientWeapons, allAirportsData = {}) {
  const recipientAirport = getAirportById(recipientAirportId);

  // Don't generate missions for the main base
  if (!recipientAirport || recipientAirport.isMainBase) {
    return [];
  }

  const generatedMissions = [];

  // Get list of logistics weapons and filter by base type
  const logisticsWeapons = Object.keys(missionRules.weaponLogistics);
  const importantWeapons = logisticsWeapons.filter(weaponId =>
    isImportantWeapon(weaponId, recipientAirport.isHeliport === true, recipientAirport.isCarrier === true)
  );

  const orders = [];
  const seenOrderWeapons = new Set();

  // Check each logistics weapon (including those missing or at 0)
  importantWeapons.forEach(weaponId => {
    // Find weapon in current inventory
    const weaponData = recipientWeapons.find(w => w.item === weaponId);
    const currentQuantity = weaponData ? weaponData.quantity : 0;

    const thresholds = getWeaponThresholds(weaponId);

    // Check if quantity is below medium threshold (generates for CRITICAL, HIGH, MEDIUM)
    if (currentQuantity > thresholds.medium) {
      return;
    }

    // Check if a mission already exists for this weapon
    if (historicalData.missionExistsForWeapon(recipientAirportId, weaponId)) {
      console.log(`Mission already exists for ${weaponId} at ${recipientAirportId}`);
      return;
    }

    // Calculate priority and quantity needed
    const priority = getWeaponPriority(weaponId, currentQuantity);
    const quantityNeeded = getOrderQuantityForWeapon(weaponId);
    const isoUnits = getIsoFillForWeapon(weaponId);
    const totalWeightLbs = calculateTotalWeight(weaponId, quantityNeeded);

    // Find best donor for this weapon
    const bestSource = findBestSourceAirport({
      recipientAirport,
      weaponId: weaponId,
      quantityNeeded,
      allAirportsData,
      donorThreshold: thresholds.donor,
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

    if (seenOrderWeapons.has(weaponId)) {
      return;
    }
    seenOrderWeapons.add(weaponId);

    orders.push({
      weapon_id: weaponId,
      quantity_needed: quantityNeeded,
      current_quantity: currentQuantity,
      iso_units: isoUnits,
      total_weight_lbs: totalWeightLbs,
      priority,
      source_airport_id: bestSource.airportId,
      source_airport_name: bestSource.airportName,
      distance_nm: bestSource.distance,
      recommended_aircraft: recommendedAircraft,
    });
  });

  if (orders.length === 0) {
    return generatedMissions;
  }

  const ordersByRoute = new Map();
  orders.forEach(order => {
    const key = `${order.source_airport_id}::${order.recommended_aircraft}`;
    if (!ordersByRoute.has(key)) {
      ordersByRoute.set(key, {
        source_airport_id: order.source_airport_id,
        source_airport_name: order.source_airport_name,
        distance_nm: order.distance_nm,
        recommended_aircraft: order.recommended_aircraft,
        orders: [],
      });
    }
    ordersByRoute.get(key).orders.push(order);
  });

  const maxLoadUnits = missionRules.logistics.maxLoadUnits;

  ordersByRoute.forEach(group => {
    const sortedOrders = [...group.orders].sort((a, b) => {
      const priorityDiff = getPriorityRank(a.priority) - getPriorityRank(b.priority);
      if (priorityDiff !== 0) return priorityDiff;
      return (b.iso_units || 0) - (a.iso_units || 0);
    });

    const groupMissions = [];

    let currentOrders = [];
    let currentUnits = 0;

    const createOrderChunk = (order, units) => {
      const baseUnits = Number(order.iso_units || 0);
      const ratio = baseUnits > 0 ? units / baseUnits : 0;
      const chunkQuantity = Math.floor((order.quantity_needed || 0) * ratio);
      const chunkWeight = Number.isFinite(order.total_weight_lbs) ? order.total_weight_lbs * ratio : 0;

      return {
        weapon_id: order.weapon_id,
        quantity_needed: chunkQuantity,
        current_quantity: order.current_quantity,
        iso_units: units,
        total_weight_lbs: chunkWeight,
        priority: order.priority,
      };
    };

    const flushMission = () => {
      if (currentOrders.length === 0) return;

      const missionPriority = getMissionPriorityFromOrders(currentOrders);
      const totalWeight = currentOrders.reduce((sum, o) => sum + (o.total_weight_lbs || 0), 0);
      const totalIsoUnits = currentOrders.reduce((sum, o) => sum + (o.iso_units || 0), 0);

      groupMissions.push({
        airportId: recipientAirportId,
        sourceAirportId: group.source_airport_id,
        distance: group.distance_nm,
        recommendedAircraft: group.recommended_aircraft,
        orders: currentOrders.map(o => ({
          weapon_id: o.weapon_id,
          quantity_needed: o.quantity_needed,
          current_quantity: o.current_quantity,
          iso_units: o.iso_units,
          total_weight_lbs: o.total_weight_lbs,
          priority: o.priority,
        })),
        totalWeightLbs: totalWeight,
        totalIsoUnits: totalIsoUnits,
        priority: missionPriority,
        expiryHours: missionRules.mission.missionExpiry,
      });
      currentOrders = [];
      currentUnits = 0;
    };

    sortedOrders.forEach(order => {
      let remainingUnits = Number(order.iso_units || 0);
      if (remainingUnits <= 0) return;

      while (remainingUnits > 0) {
        const remainingCapacity = maxLoadUnits - currentUnits;
        if (remainingCapacity <= 0 && currentOrders.length > 0) {
          flushMission();
          continue;
        }

        const unitsToAdd = Math.min(remainingUnits, maxLoadUnits - currentUnits);
        if (unitsToAdd <= 0) {
          flushMission();
          continue;
        }

        currentOrders.push(createOrderChunk(order, unitsToAdd));
        currentUnits += unitsToAdd;
        remainingUnits -= unitsToAdd;

        if (currentUnits >= maxLoadUnits - 1e-6) {
          flushMission();
        }
      }
    });

    flushMission();

    const almostEqual = (value, target) => Math.abs(value - target) < 1e-6;

    const applySimpleSmallShare = () => {
      const donors = groupMissions.filter(mission => almostEqual(mission.totalIsoUnits, 1.0));
      const receivers = groupMissions.filter(mission => almostEqual(mission.totalIsoUnits, 2.0));

      if (donors.length === 0 || receivers.length < 2) {
        return;
      }

      const donor = donors[0];
      const receiverA = receivers[0];
      const receiverB = receivers[1];

      const donorPool = donor.orders.map(order => ({
        order,
        remaining_units: Number(order.iso_units || 0),
      }));

      const takeFromPool = (targetUnits) => {
        const chunkOrders = [];
        let remaining = targetUnits;

        for (const entry of donorPool) {
          if (remaining <= 0) break;
          if (entry.remaining_units <= 0) continue;

          const takeUnits = Math.min(entry.remaining_units, remaining);
          if (takeUnits <= 0) continue;

          chunkOrders.push(createOrderChunk(entry.order, takeUnits));
          entry.remaining_units -= takeUnits;
          remaining -= takeUnits;
        }

        return { chunkOrders, usedUnits: targetUnits - remaining };
      };

      const chunkA = takeFromPool(0.5);
      const chunkB = takeFromPool(0.5);

      if (!almostEqual(chunkA.usedUnits + chunkB.usedUnits, 1.0)) {
        return;
      }

      receiverA.orders = receiverA.orders.concat(chunkA.chunkOrders);
      receiverB.orders = receiverB.orders.concat(chunkB.chunkOrders);

      [receiverA, receiverB].forEach(receiver => {
        receiver.totalIsoUnits = receiver.orders.reduce((sum, o) => sum + (o.iso_units || 0), 0);
        receiver.totalWeightLbs = receiver.orders.reduce((sum, o) => sum + (o.total_weight_lbs || 0), 0);
        receiver.priority = getMissionPriorityFromOrders(receiver.orders);
      });

      const donorIndex = groupMissions.indexOf(donor);
      if (donorIndex >= 0) {
        groupMissions.splice(donorIndex, 1);
      }
    };

    applySimpleSmallShare();

    groupMissions.forEach(mission => {
      const missionId = historicalData.createMission(mission);
      console.log(`?o^???  Generated ${mission.priority.toUpperCase()} mission ${missionId}`);
      console.log(`   Route: ${group.source_airport_name} -> ${recipientAirport.displayName} (${group.distance_nm}nm)`);
      console.log(`   Orders: ${mission.orders.length} (load ${mission.totalIsoUnits.toFixed(2)}/${maxLoadUnits})`);
      console.log(`   Recommended: ${group.recommended_aircraft.toUpperCase()}`);
      generatedMissions.push(missionId);
    });
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
 * @param {number} params.donorThreshold - Per-weapon donor threshold
 * @returns {Object} {airportId, airportName, distance, isDonor}
 */
export function findBestSourceAirport({ recipientAirport, weaponId, quantityNeeded, allAirportsData, donorThreshold }) {
  const mainBase = getMainBase();
  const minDonorQty = Number.isFinite(donorThreshold) ? donorThreshold : missionRules.donor.minQuantityToDonate;
  const distanceThreshold = missionRules.donor.distanceThreshold;

  // Calculate distance from main base to recipient
  const mainBaseDistance = calculateDistance(mainBase.coordinates, recipientAirport.coordinates);

  // Find potential donors (only from active airports)
  const potentialDonors = [];
  const activeAirports = airbaseStatusManager.getActiveAirports();

  activeAirports.forEach(airport => {
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
    // 1. Must have >= minQuantityToDonate (per-weapon X*2)
    // 2. Must have enough to cover the order
    if (currentQty >= minDonorQty && (currentQty - quantityNeeded) >= 0) {
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
 * 1. If donor base has herculesBase = false -> helicopter
 * 2. If distance < 35 NM -> helicopter
 * 3. If destination is heliport -> helicopter
 * 4. If mission is CRITICAL -> always airplane
 * 5. BUT if CRITICAL to heliport -> airdrop (airplane without landing)
 * 6. Otherwise -> airplane
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

  // If source cannot support Hercules -> helicopter (always)
  if (!isSourceHerculesBase) {
    return 'helicopter';
  }

  // Special case: CRITICAL to heliport -> always airdrop
  if (isCritical && isDestinationHeliport) {
    return 'airdrop';
  }

  // CRITICAL missions always use airplane (unless to heliport, handled above)
  if (isCritical) {
    return 'airplane';
  }

  // If short distance -> helicopter
  if (isShortDistance) {
    return 'helicopter';
  }

  // If destination is heliport -> helicopter
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
 * Get mission priority based on current quantity (fallback)
 */
export function getMissionPriority(currentQuantity) {
  if (currentQuantity <= missionRules.criticalThreshold) return 'critical';
  if (currentQuantity <= missionRules.highThreshold) return 'high';
  if (currentQuantity <= missionRules.mediumThreshold) return 'medium';
  return 'ok';
}

export default {
  checkAndGenerateMissions,
  findBestSourceAirport,
  getWeaponDisplayName,
  getMissionPriority,
};
