/**
 * Important weapons configuration for frontend
 * This should match the backend configuration in backend/src/config/rules.config.js
 */

// Important weapons for AIRPORTS (fixed-wing aircraft)
// These are air-to-air missiles, guided bombs, and heavy ordnance for planes
export const importantWeaponsAirports = [
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

  // Guided bombs for jets
  'weapons.bombs.GBU_12',
  'weapons.bombs.GBU_24',
  'weapons.bombs.GBU_54_V_1B',
  'weapons.bombs.GBU_38',
  'weapons.bombs.GBU_31_V_3B',
  'weapons.bombs.GBU_31',

  // Cluster and unguided bombs for jets
  'weapons.bombs.CBU_105',
  'weapons.bombs.CBU_97',
  'weapons.bombs.Mk_82',
  'weapons.bombs.Mk_84',
];

// Important weapons for HELIPORTS (rotary-wing aircraft)
// These are ATGMs, rocket pods, and light ordnance for helicopters
export const importantWeaponsHeliports = [
  // Anti-tank guided missiles for helicopters
  'weapons.missiles.Vikhr_M',
  'weapons.missiles.AGM_114K',
  'weapons.missiles.AGM_114',
  'weapons.missiles.Ataka_9M120',

  // Rocket pods for helicopters
  'weapons.nurs.C_8OFP2',
  'weapons.nurs.C_13',
  'weapons.missiles.AGR_20A',
  'weapons.missiles.AGR_20_M282',

  // Air-to-air missiles for helicopters
  'weapons.missiles.Igla_1E',
  'weapons.missiles.OH58D_FIM_92',
  'weapons.missiles.P_60',
];

// Important weapons for CARRIERS (carrier-based aircraft)
// These are naval aviation weapons for carrier operations
export const importantWeaponsCarriers = [
  // Air-to-air missiles for carrier aircraft
  'weapons.missiles.AIM_120C',
  'weapons.missiles.AIM_9X',
  'weapons.missiles.AIM_54C_Mk60',
  'weapons.missiles.AIM_7',

  // Air-to-ground missiles for carrier aircraft
  'weapons.missiles.AGM_65D',
  'weapons.missiles.AGM_65F',
  'weapons.missiles.AGM_65H',
  'weapons.missiles.AGM_88',
  'weapons.missiles.AGM_154',
  'weapons.missiles.ADM_141A',

  // Guided bombs for carrier aircraft
  'weapons.bombs.GBU_12',
  'weapons.bombs.GBU_24',
  'weapons.bombs.GBU_54_V_1B',
  'weapons.bombs.GBU_38',
  'weapons.bombs.GBU_31_V_3B',
  'weapons.bombs.GBU_31',

  // Cluster and unguided bombs for carrier aircraft
  'weapons.bombs.CBU_105',
  'weapons.bombs.CBU_97',
  'weapons.bombs.Mk_82',
  'weapons.bombs.Mk_84',
];

/**
 * Check if a weapon is important for a given base type
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
    return importantWeaponsCarriers.includes(weaponId);
  } else if (isHeliport) {
    // Heliports only have heliport weapons
    return importantWeaponsHeliports.includes(weaponId);
  } else {
    // Airports have both airport and heliport weapons
    return importantWeaponsAirports.includes(weaponId) || importantWeaponsHeliports.includes(weaponId);
  }
}
