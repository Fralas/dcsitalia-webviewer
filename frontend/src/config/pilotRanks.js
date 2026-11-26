/**
 * HIDC pilot ranks for levels 0-100 (DBRIDGE_Pilots.lua levels, 0-based).
 * Officer ladder of the Aeronautica Militare; each rank spans several levels shown with a
 * roman numeral step (Capitano I ... Capitano IX). Insignia drives the SVG badge:
 *   stripes = sleeve "binari" (thin / thick), stars + greca = general officers.
 */

export const PILOT_RANK_TIERS = Object.freeze([
  { key: 'recluta', from: 0, to: 0, name: 'Recluta', short: 'Rcl.', metal: 'steel', insignia: { roundel: true } },
  { key: 'allievo', from: 1, to: 5, name: 'Allievo Pilota', short: 'All.', metal: 'bronze', insignia: { chevrons: 1 } },
  { key: 'aspirante', from: 6, to: 10, name: 'Aspirante Ufficiale', short: 'Asp.', metal: 'silver', insignia: { thin: 1 } },
  { key: 'sottotenente', from: 11, to: 17, name: 'Sottotenente', short: 'S.Ten.', metal: 'gold', insignia: { thin: 1 } },
  { key: 'tenente', from: 18, to: 25, name: 'Tenente', short: 'Ten.', metal: 'gold', insignia: { thin: 2 } },
  { key: 'capitano', from: 26, to: 34, name: 'Capitano', short: 'Cap.', metal: 'gold', insignia: { thin: 3 } },
  { key: 'maggiore', from: 35, to: 44, name: 'Maggiore', short: 'Magg.', metal: 'gold', insignia: { thick: 1 } },
  { key: 'tenente-colonnello', from: 45, to: 54, name: 'Tenente Colonnello', short: 'Ten.Col.', metal: 'gold', insignia: { thick: 1, thin: 1 } },
  { key: 'colonnello', from: 55, to: 64, name: 'Colonnello', short: 'Col.', metal: 'gold', insignia: { thick: 1, thin: 2 } },
  { key: 'generale-brigata', from: 65, to: 74, name: 'Generale di Brigata Aerea', short: 'Gen.B.A.', metal: 'gold', insignia: { greca: true, stars: 1 } },
  { key: 'generale-divisione', from: 75, to: 84, name: 'Generale di Divisione Aerea', short: 'Gen.D.A.', metal: 'gold', insignia: { greca: true, stars: 2 } },
  { key: 'generale-squadra', from: 85, to: 94, name: 'Generale di Squadra Aerea', short: 'Gen.S.A.', metal: 'gold', insignia: { greca: true, stars: 3 } },
  { key: 'generale-squadra-is', from: 95, to: 99, name: 'Generale di Squadra Aerea con incarichi speciali', short: 'Gen.S.A. (i.s.)', metal: 'gold', insignia: { greca: true, stars: 4 } },
  { key: 'csma', from: 100, to: 100, name: "Capo di Stato Maggiore dell'Aeronautica", short: 'C.S.M.A.', metal: 'gold', insignia: { greca: true, stars: 4, crown: true } },
]);

export const PILOT_MAX_LEVEL = 100;

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

export function clampLevel(level) {
  const value = Math.floor(Number(level) || 0);
  return Math.max(0, Math.min(PILOT_MAX_LEVEL, value));
}

export function getRankTier(level) {
  const lv = clampLevel(level);
  return PILOT_RANK_TIERS.find((tier) => lv >= tier.from && lv <= tier.to) || PILOT_RANK_TIERS[0];
}

/** Label shown everywhere for a level: "Livello 25" (the rank name stays internal, only the insignia shows it). */
export function levelLabel(level) {
  return `Livello ${clampLevel(level)}`;
}

/**
 * @returns {{ level, tier, tierIndex, step, steps, name, fullName, short }}
 * name / fullName / short are all "Livello N": ranks are not shown by name.
 * tier.name keeps the Aeronautica rank for the insignia logic only.
 */
export function getPilotRank(level) {
  const lv = clampLevel(level);
  const tier = getRankTier(lv);
  const tierIndex = PILOT_RANK_TIERS.indexOf(tier);
  const steps = tier.to - tier.from + 1;
  const step = lv - tier.from + 1;
  const label = levelLabel(lv);
  return {
    level: lv,
    tier,
    tierIndex,
    step,
    steps,
    name: label,
    fullName: label,
    short: label,
  };
}

/** Next rank change (first level of the following tier), or null at the top. */
export function getNextTier(level) {
  const tier = getRankTier(level);
  const index = PILOT_RANK_TIERS.indexOf(tier);
  return PILOT_RANK_TIERS[index + 1] || null;
}
