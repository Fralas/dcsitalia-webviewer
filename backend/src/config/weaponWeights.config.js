/**
 * Weapon Weights Configuration
 * Weights are in pounds (lb) as specified in DCS
 */

export const weaponWeights = {
  // Air-to-air missiles for jets
  'weapons.missiles.AIM_120C': 330,
  'weapons.missiles.AIM_9X': 187,
  'weapons.missiles.AIM_54C_Mk60': 1040,
  'weapons.missiles.P_60': 143,
  'weapons.missiles.AIM_7': 509,

  // Air-to-ground missiles for jets
  'weapons.missiles.AGM_65D': 485,
  'weapons.missiles.AGM_65F': 674,
  'weapons.missiles.AGM_65H': 465,
  'weapons.missiles.AGM_65L': 474,
  'weapons.missiles.AGM_88': 795,
  'weapons.missiles.AGM_154A': 1064,
  'weapons.missiles.AGM_154': 1064,
  'weapons.missiles.ADM_141A': 396,
  'weapons.missiles.LAU_61_APKWS_M282': 32,
  'weapons.missiles.AGM_84D': 1144,

  // Guided bombs for jets
  'weapons.bombs.GBU_12': 507,
  'weapons.bombs.GBU_10': 1998,
  'weapons.bombs.GBU_24': 2348,
  'weapons.bombs.GBU_54_V_1B': 558,
  'weapons.bombs.GBU_38': 558,
  'weapons.bombs.GBU_31_V_3B': 2162,
  'weapons.bombs.GBU_31': 2058,

  // Cluster and unguided bombs for jets
  'weapons.bombs.CBU_105': 970,
  'weapons.bombs.CBU_103': 944,
  'weapons.bombs.CBU_97': 950,
  'weapons.bombs.Mk_82': 500,
  'weapons.bombs.Mk_84': 2040,
  'weapons.bombs.CBU_87': 910,

  // Anti-tank guided missiles for helicopters
  'weapons.missiles.Vikhr_M': 99,
  'weapons.missiles.AGM_114K': 99,
  'weapons.missiles.AGM_114': 110,
  'weapons.missiles.Ataka_9M120': 105,
  'weapons.missiles.Ataka_9M120F': 105,

  // Rocket pods for helicopters
  'weapons.nurs.HYDRA_70_M151': 15,
  'weapons.nurs.HYDRA_70_M229': 15,
  'weapons.nurs.HYDRA_70_M274': 15,
  'weapons.nurs.HYDRA_70_M282': 15,
  'weapons.nurs.C_8OFP2': 20,
  'weapons.nurs.C_8OM': 20,
  'weapons.nurs.C_13': 150,
  'weapons.nurs.S_5M': 11,
  'weapons.nurs.S-24B': 518,
  'weapons.missiles.AGR_20A': 32,
  'weapons.missiles.AGR_20_M282': 32,

  // Air-to-air missiles for helicopters
  'weapons.missiles.Igla_1E': 22,
  'weapons.missiles.OH58D_FIM_92': 33,
};

/**
 * Get weight for a weapon ID
 * @param {string} weaponId - The weapon ID
 * @returns {number} - Weight in pounds, or 0 if not found
 */
export function getWeaponWeight(weaponId) {
  return weaponWeights[weaponId] || 0;
}

/**
 * Calculate total weight for a mission
 * @param {string} weaponId - The weapon ID
 * @param {number} quantity - The quantity of weapons
 * @returns {number} - Total weight in pounds
 */
export function calculateTotalWeight(weaponId, quantity) {
  const unitWeight = getWeaponWeight(weaponId);
  return unitWeight * quantity;
}

/**
 * Format weight for display
 * @param {number} weightLbs - Weight in pounds
 * @returns {string} - Formatted weight string (e.g., "1,500 lb" or "2,500 lb (1.1 tons)")
 */
export function formatWeight(weightLbs) {
  const formattedLbs = weightLbs.toLocaleString();

  // If weight is over 2000 lbs, also show tons
  if (weightLbs >= 2000) {
    const tons = (weightLbs / 2000).toFixed(1);
    return `${formattedLbs} lb (${tons} tons)`;
  }

  return `${formattedLbs} lb`;
}

export default weaponWeights;
