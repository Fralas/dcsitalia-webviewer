/**
 * Mission Generation Rules Configuration
 * Configure thresholds and important weapons here
 */

export const missionRules = {
  // Priority thresholds for automatic order generation
  criticalThreshold: 5,   // CRITICAL: quantity <= 5
  highThreshold: 20,      // HIGH: quantity <= 20
  mediumThreshold: 40,    // MEDIUM: quantity <= 40

  // Important weapons for AIRPORTS (fixed-wing aircraft)
  // These are air-to-air missiles, guided bombs, and heavy ordnance for planes
  importantWeaponsAirports: [
    // Air-to-air missiles for jets
    'weapons.missiles.AIM_120C',
    'weapons.missiles.AIM_9X',
    'weapons.missiles.AIM_54C_Mk60',
    'weapons.missiles.AIM_7',

    // Air-to-ground missiles for jets
    'weapons.missiles.AGM_65D',
    'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_65H',
    'weapons.missiles.AGM_88',
    'weapons.missiles.AGM_154',
    'weapons.missiles.ADM_141A',
    'weapons.missiles.AGR_20A',
    'weapons.missiles.AGR_20_M282',

    // Guided bombs for jets
    'weapons.bombs.GBU_12',
    'weapons.bombs.GBU_24',
    'weapons.bombs.GBU_54_V_1B',
    'weapons.bombs.GBU_38',
    'weapons.bombs.GBU_31_V_3B',
  
    // Cluster and unguided bombs for jets
    'weapons.bombs.CBU_105',
    'weapons.bombs.CBU_97',
    'weapons.bombs.Mk_82',
    'weapons.bombs.Mk_84',
  ],

  // Important weapons for HELIPORTS (rotary-wing aircraft)
  // These are ATGMs, rocket pods, and light ordnance for helicopters
  importantWeaponsHeliports: [
    // Anti-tank guided missiles for helicopters
    'weapons.missiles.Vikhr_M',
    'weapons.missiles.AGM_114K',
    'weapons.missiles.AGM_114',
    'weapons.missiles.Ataka_9M120',
    

    // Rocket pods for helicopters
    'weapons.nurs.C_8OFP2',
    'weapons.nurs.C_13',
    "weapons.nurs.HYDRA_70_M229",
    'weapons.missiles.AGR_20A',


    // Air-to-air missiles for helicopters
    'weapons.missiles.Igla_1E',
    'weapons.missiles.OH58D_FIM_92',
    'weapons.missiles.P_60',
  ],

  // Important weapons for CARRIERS (carrier-based aircraft)
  // These are naval aviation weapons for carrier operations
  importantWeaponsCarriers: [
    // Air-to-air missiles for carrier aircraft
    'weapons.missiles.AIM_120C',
    'weapons.missiles.AIM_9X',
    'weapons.missiles.AIM_9',
    'weapons.missiles.AIM_54C_Mk60',
    'weapons.missiles.AIM_7',

    // Air-to-ground missiles for carrier aircraft
    'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_88',
    'weapons.missiles.AGM_154',
    'weapons.missiles.ADM_141A',
    'weapons.missiles.AGM_84H',
    'weapons.missiles.AGM_84D',

    // Guided bombs for carrier aircraft
    'weapons.bombs.GBU_12',
    'weapons.bombs.GBU_24',
    'weapons.bombs.GBU_38',
    'weapons.bombs.GBU_32_V_2B',
    'weapons.bombs.GBU_31_V_3B',

    // Unguided bombs for carrier aircraft
    'weapons.bombs.Mk_82',
    'weapons.bombs.Mk_84',
  ],

  // Liquids configuration
  liquids: {
    1: { name: 'Jet Fuel', criticalThreshold: 100000, warningThreshold: 500000 },
    2: { name: 'Aviation Gasoline', criticalThreshold: 50000, warningThreshold: 200000 },
    3: { name: 'MW-50', criticalThreshold: 10000, warningThreshold: 50000 },
    0: { name: 'Diesel', criticalThreshold: 20000, warningThreshold: 100000 },
  },

  // Mission generation settings
  mission: {
    // Supply quantities based on priority
    supplyQuantityByPriority: {
      critical: 95,   // CRITICAL priority (quantity <= 5)
      high: 80,       // HIGH priority (quantity <= 20)
      medium: 60,      // MEDIUM priority (quantity <= 40)
    },

    // Default supply quantity (fallback if priority can't be determined)
    defaultSupplyQuantity: 80,

    // Minimum time between missions for same weapon (minutes)
    missionCooldown: 60,

    // Auto-expire missions after X hours if not accepted
    missionExpiry: 24,
  },

  // Donor airport configuration
  donor: {
    // Minimum quantity to be eligible as donor
    minQuantityToDonate: 150,

    // Buffer quantity: donor must keep at least (mediumThreshold + buffer) after donation
    // Example: mediumThreshold=50, buffer=25 → must keep at least 75
    bufferAfterDonation: 25,

    // Distance threshold (nm): if (mainBaseDistance - donorDistance) < threshold, use main base
    distanceThreshold: 30,
  }
};

/**
 * Check if a weapon is important
 * @param {string} weaponId - The weapon ID to check
 * @param {boolean} isHeliport - Whether the airport is a heliport
 * @param {boolean} isCarrier - Whether the airport is a carrier
 * @returns {boolean} - True if the weapon is important for this type of base
 *
 * Logic:
 * - Heliports: Only show heliport weapons
 * - Carriers: Only show carrier weapons
 * - Airports: Show BOTH airport and heliport weapons (since they can support both fixed and rotary wing)
 */
export function isImportantWeapon(weaponId, isHeliport = false, isCarrier = false) {
  if (isCarrier) {
    // Carriers only have carrier weapons
    return missionRules.importantWeaponsCarriers.includes(weaponId);
  } else if (isHeliport) {
    // Heliports only have heliport weapons
    return missionRules.importantWeaponsHeliports.includes(weaponId);
  } else {
    // Airports have both airport and heliport weapons
    return missionRules.importantWeaponsAirports.includes(weaponId) || missionRules.importantWeaponsHeliports.includes(weaponId);
  }
}

/**
 * Get priority based on current quantity
 */
export function getPriority(quantity) {
  if (quantity <= missionRules.criticalThreshold) return 'critical';
  if (quantity <= missionRules.highThreshold) return 'high';
  if (quantity <= missionRules.mediumThreshold) return 'medium';
  return 'ok';
}

/**
 * Get supply quantity based on priority
 */
export function getSupplyQuantityForPriority(priority) {
  return missionRules.mission.supplyQuantityByPriority[priority] || missionRules.mission.defaultSupplyQuantity;
}

export default missionRules;
