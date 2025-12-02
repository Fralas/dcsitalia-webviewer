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
    'weapons.missiles.AIM_9X',
    'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_88',
    'weapons.missiles.AGM_154A',
    'weapons.missiles.AGM_122',
    'weapons.missiles.AGM_65G',
    'weapons.missiles.AGM_65H',
    'weapons.missiles.AGM_65D',
    'weapons.missiles.RB75',
    'weapons.missiles.X_58',
    'weapons.missiles.X_29T',
    'weapons.missiles.AGM_65A',
    'weapons.missiles.S_25L',
    'weapons.missiles.LD_10',
    'weapons.missiles.Kh25MP_PRGS1VP',
    'weapons.nurs.C_13',
    'weapons.nurs.C_8OFP2',
    'weapons.nurs.HYDRA_70_M151',
    'weapons.nurs.FFAR Mk5 HEAT',
    'weapons.nurs.AGR_20_M282',
    'weapons.nurs.AGR_20A',
    'weapons.missiles.BRM-1_90MM',
    'weapons.containers.AN_ASQ_228',
    'weapons.droptanks.FPU_8A',
    'weapons.bombs.GBU_16',
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
    // Default supply quantity to request
    defaultSupplyQuantity: 100,

    // Minimum time between missions for same weapon (minutes)
    missionCooldown: 60,

    // Auto-expire missions after X hours if not accepted
    missionExpiry: 24,
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

export default missionRules;
