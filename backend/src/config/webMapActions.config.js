/**
 * Map right-click actions (AIR ASSET, GROUND ASSET, MARK ATTACK, LOGI & SUPPLY).
 * Menu types use hyphens; DCORE command types use underscores.
 */
export const WEB_MAP_ACTION_MENU_TYPES = Object.freeze({
  'air-asset': 'air_asset',
  'ground-asset': 'ground_asset',
  'mark-attack': 'mark_attack',
  'logi-supply': 'logi_supply',
});

export const WEB_MAP_ACTION_TYPES = Object.freeze([
  'air_asset',
  'ground_asset',
  'mark_attack',
  'logi_supply',
]);

/** @type {{ type: string, keyword: string, label: string, cost: number|null }[]} */
export const WEB_MAP_ACTION_OPTIONS = [
  { type: 'air_asset', keyword: 'CAS', label: 'CAS', cost: null },
  { type: 'air_asset', keyword: 'CAP', label: 'CAP', cost: null },
  { type: 'air_asset', keyword: 'EWAR', label: 'EWAR', cost: null },
  { type: 'air_asset', keyword: 'DRONE', label: 'DRONE', cost: null },

  { type: 'ground_asset', keyword: 'MBT', label: 'MBT', cost: 90 },
  { type: 'ground_asset', keyword: 'LAV25', label: 'LAV25', cost: 90 },
  { type: 'ground_asset', keyword: 'SCORPION', label: 'SCORPION', cost: 50 },
  { type: 'ground_asset', keyword: 'TOW', label: 'TOW', cost: 50 },
  { type: 'ground_asset', keyword: 'HMMWV', label: 'HMMWV', cost: 50 },
  { type: 'ground_asset', keyword: 'SCIMITAR', label: 'SCIMITAR', cost: 50 },
  { type: 'ground_asset', keyword: 'FIRTINA', label: 'FIRTINA', cost: 50 },
  { type: 'ground_asset', keyword: 'ATACMS', label: 'ATACMS', cost: 50 },
  { type: 'ground_asset', keyword: 'GMLRS', label: 'GMRLS', cost: 50 },
  { type: 'ground_asset', keyword: 'GEPARD', label: 'GEPARD', cost: 30 },
  { type: 'ground_asset', keyword: 'AVENGER', label: 'AVENGER', cost: 50 },
  { type: 'ground_asset', keyword: 'ROLAND', label: 'ROLAND', cost: 50 },
  { type: 'ground_asset', keyword: 'ADV', label: 'ADV', cost: null },
  { type: 'ground_asset', keyword: 'FMTV', label: 'FMTV', cost: null },

  { type: 'mark_attack', keyword: 'BOMB', label: 'BOMB', cost: null },
  { type: 'mark_attack', keyword: 'CRUISE', label: 'CRUISE', cost: null },
  { type: 'mark_attack', keyword: 'SHIP', label: 'SHIP', cost: null },

  { type: 'logi_supply', keyword: 'ADV', label: 'ADV', cost: null },
  { type: 'logi_supply', keyword: 'FMTV', label: 'FMTV', cost: null },
  { type: 'logi_supply', keyword: 'HELISUPPLY', label: 'HELISUPPLY', cost: null },
  { type: 'logi_supply', keyword: 'SUPPLY', label: 'SUPPLY', cost: null },
];

const WEB_MAP_ACTION_LOOKUP = new Map(
  WEB_MAP_ACTION_OPTIONS.map((entry) => [`${entry.type}:${entry.keyword}`, entry])
);

export function normalizeMapActionCommandType(rawType) {
  const trimmed = String(rawType || '').trim();
  if (!trimmed) return null;
  if (WEB_MAP_ACTION_MENU_TYPES[trimmed]) return WEB_MAP_ACTION_MENU_TYPES[trimmed];
  if (WEB_MAP_ACTION_TYPES.includes(trimmed)) return trimmed;
  return null;
}

export function resolveMapActionOption(commandType, keyword) {
  const normalizedType = normalizeMapActionCommandType(commandType);
  const normalizedKeyword = String(keyword || '').trim().toUpperCase();
  if (!normalizedType || !normalizedKeyword) return null;
  return WEB_MAP_ACTION_LOOKUP.get(`${normalizedType}:${normalizedKeyword}`) || null;
}
