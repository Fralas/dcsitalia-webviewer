/**
 * Pilot level unlocks (HIDC).
 *
 * DCORE is the source of truth for the asset levels: DBRIDGE_Config.pilots.unlock_levels is exported
 * as "unlock_levels" in Export_Pilot_Stats.json and overrides the defaults below. DCORE enforces them
 * on in-game F10 markers (DMAS) and on the Tactical Commander slot (hook DPILOT_SlotHook.lua); the site
 * enforces them on map actions and tanker spawns (server.js) and shows them in the profile roadmap.
 * Site-only unlocks (region vote, AI airlift) keep their own .env levels and are added by hidcCampaign.
 */

/** @type {ReadonlyArray<{ key: string, level: number, label: string, group: string, detail?: string }>} */
export const PILOT_ASSET_UNLOCKS = Object.freeze([
  { key: 'tactical_commander', level: 3, label: 'Tactical Commander', group: 'Slot', detail: 'Slot Combined Arms' },
  { key: 'tanker', level: 8, label: 'Tanker', group: 'Air asset', detail: 'BOOM / BASKET' },
  { key: 'cap', level: 4, label: 'CAP', group: 'Air asset', detail: 'F-15C' },
  { key: 'cas', level: 10, label: 'CAS', group: 'Air asset', detail: 'A-10CII' },
  { key: 'bomb', level: 7, label: 'BOMB', group: 'Mark attack', detail: 'F-117' },
  { key: 'drone', level: 15, label: 'DRONE', group: 'Air asset', detail: 'MQ-9' },
  { key: 'ewar', level: 20, label: 'EWAR', group: 'Air asset', detail: 'F-18C' },
  { key: 'cruise', level: 30, label: 'CRUISE', group: 'Mark attack', detail: 'B-52' },
  { key: 'asw', level: 35, label: 'ASW', group: 'Air asset', detail: 'Anti-sub' },
  { key: 'ship', level: 40, label: 'SHIP', group: 'Mark attack', detail: 'Strike Tomahawk' },
].map((entry) => Object.freeze(entry)));

/** Map right-click actions and tanker spawns -> unlock key (null = no level requirement). */
const WEB_ACTION_UNLOCK_KEYS = Object.freeze({
  'air_asset:CAP': 'cap',
  'air_asset:CAS': 'cas',
  'air_asset:DRONE': 'drone',
  'air_asset:EWAR': 'ewar',
  'air_asset:ASW': 'asw',
  'mark_attack:BOMB': 'bomb',
  'mark_attack:CRUISE': 'cruise',
  'mark_attack:SHIP': 'ship',
  'tanker_spawn:BOOM': 'tanker',
  'tanker_spawn:BASKET': 'tanker',
});

export function unlockKeyForWebAction(commandType, keyword) {
  const key = `${String(commandType || '').trim()}:${String(keyword || '').trim().toUpperCase()}`;
  return WEB_ACTION_UNLOCK_KEYS[key] || null;
}

export default { PILOT_ASSET_UNLOCKS, unlockKeyForWebAction };
