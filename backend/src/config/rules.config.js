/**
 * Mission Generation Rules Configuration
 * Configure thresholds and important weapons here
 */

export const missionRules = {
  // Priority thresholds for automatic order generation
  criticalThreshold: 5,   // CRITICAL: quantity <= 5
  highThreshold: 20,      // HIGH: quantity <= 20
  mediumThreshold: 50,    // MEDIUM: quantity <= 50

  // Important weapons that trigger missions when low
  // Add DCS weapon identifiers here
  importantWeapons: [
    'weapons.missiles.AIM_120C',
    'weapons.missiles.AGM_154', 
    'weapons.missiles.AGM_154A',
    'weapons.bombs.Mk_84AIR_TP',
    'weapons.bombs.GBU_31_V_3B',
    'weapons.bombs.CBU_105',
    'weapons.bombs.GBU_12',
    'weapons.bombs.CBU_103',
    'weapons.bombs.GBU_15_V_31_B',
    'weapons.bombs.GBU_28',
    'weapons.missiles.AGM_84D',
    'weapons.missiles.AIM_54C_Mk47',
    'weapons.bombs.GBU_32_V_2B',
    'weapons.missiles.ADM_141B',
    'weapons.bombs.ROCKEYE',
    'weapons.missiles.AGM_114',
    'weapons.missiles.AGM_65D',
    'weapons.missiles.AGM_65H',
    'weapons.missiles.AGM_84H',
    'weapons.bombs.GBU_54_V_1B',
    'weapons.missiles.ADM_141A',
    'weapons.missiles.AGM_65L',
    'weapons.bombs.GBU_31_V_4B',
    'weapons.missiles.AIM_9X',
    'weapons.bombs.Mk_84AIR_GP',
    'weapons.bombs.GBU_24',
    'weapons.bombs.GBU_31',
    'weapons.bombs.GBU_31_V_2B',
    'weapons.nurs.HYDRA_70_M151',
    'weapons.nurs.HYDRA_70_M229',
    'weapons.missiles.AGM_88',
    'weapons.containers.ah-64d_radar',
    'weapons.containers.AAQ-28_LITENING', //TBC
    'weapons.missiles.LAU_61_APKWS_M282',
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
      critical: 150,   // CRITICAL priority (quantity <= 5)
      high: 100,       // HIGH priority (quantity <= 20)
      medium: 50,      // MEDIUM priority (quantity <= 50)
    },

    // Default supply quantity (fallback if priority can't be determined)
    defaultSupplyQuantity: 100,

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
 */
export function isImportantWeapon(weaponId) {
  return missionRules.importantWeapons.includes(weaponId);
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
