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
    'weapons.missiles.P_77',
    'weapons.missiles.P_73',
    'weapons.missiles.P_27PE',
    'weapons.missiles.PL-PL_5EII',
    'weapons.missiles.SD-10',
    'weapons.missiles.AIM_120',
    'weapons.missiles.AIM_120C',
    'weapons.missiles.AIM_9X',
    'weapons.missiles.AIM_9',
    'weapons.missiles.AIM_54C_Mk60',
    'weapons.missiles.P_60',
    'weapons.missiles.R-60',

    // Air-to-ground missiles for jets
    'weapons.missiles.AGM_65D',
    'weapons.missiles.AGM_65H',
    'weapons.missiles.AGM_65L',
    'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_88',
    'weapons.missiles.AGM_154A',
    'weapons.missiles.X_29T',
    'weapons.missiles.LD-10',
    'weapons.missiles.Kh25MP_PRGS1VP',

    // Guided bombs for jets
    'weapons.bombs.GBU_12',
    'weapons.bombs.GBU_10',
    'weapons.bombs.GBU_24',
    'weapons.bombs.GBU_54_V_1B',
    'weapons.bombs.GBU_38',
    'weapons.bombs.GBU_31_V_3B',
    'weapons.bombs.GBU_31',
    'weapons.missiles.GB-6-SFW',
    'weapons.missiles.LS_6_500',
    'weapons.bombs.LS_6_100',

    // Cluster and unguided bombs for jets
    'weapons.bombs.CBU_105',
    'weapons.bombs.CBU_97',
    'weapons.bombs.Mk_82',
    'weapons.bombs.Mk_84',
    'weapons.bombs.CBU_87',
  ],

  // Important weapons for HELIPORTS (rotary-wing aircraft)
  // These are ATGMs, rocket pods, and light ordnance for helicopters
  importantWeaponsHeliports: [
    // Anti-tank guided missiles for helicopters
    'weapons.missiles.Vikhr_M',
    'weapons.missiles.AGM_114K',
    'weapons.missiles.AGM_114',
    'weapons.missiles.Ataka_9M120',
    'weapons.missiles.Ataka_9M120F',
    'weapons.missiles.TOW',
    'weapons.missiles.HOT3_MBDA',
    'weapons.missiles.SPIKE_ER',
    'weapons.missiles.SPIKE_ER2',
    'weapons.missiles.HJ-12',

    // Rocket pods for helicopters
    'weapons.nurs.HYDRA_70_M151',
    'weapons.nurs.HYDRA_70_M229',
    'weapons.nurs.HYDRA_70_M274',
    'weapons.nurs.HYDRA_70_M282',
    'weapons.nurs.C_8OFP2',
    'weapons.nurs.C_8OM',
    'weapons.nurs.C_13',
    'weapons.nurs.S_5M',
    'weapons.nurs.S-24B',

    // Air-to-air missiles for helicopters
    'weapons.missiles.Igla_1E',
    'weapons.missiles.Mistral',
    'weapons.missiles.OH58D_FIM_92',
    'weapons.missiles.R_550',

    // Light AGMs that can be used by helicopters
    'weapons.missiles.AGR_20A',
    'weapons.missiles.AGR_20_M282',
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
 * @returns {boolean} - True if the weapon is important for this type of base
 */
export function isImportantWeapon(weaponId, isHeliport = false) {
  if (isHeliport) {
    return missionRules.importantWeaponsHeliports.includes(weaponId);
  } else {
    return missionRules.importantWeaponsAirports.includes(weaponId);
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
