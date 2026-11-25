/**
 * Pilot level unlocks on the map (same keys as backend/src/config/pilotUnlocks.config.js).
 * Levels come from GET /api/hidc/unlocks (DCORE DBRIDGE_Config.pilots.unlock_levels); the backend
 * enforces them, the menu only shows the lock.
 */

const MENU_ACTION_UNLOCK_KEYS = Object.freeze({
  'air-asset:CAP': 'cap',
  'air-asset:CAS': 'cas',
  'air-asset:DRONE': 'drone',
  'air-asset:EWAR': 'ewar',
  'air-asset:ASW': 'asw',
  'mark-attack:BOMB': 'bomb',
  'mark-attack:CRUISE': 'cruise',
  'mark-attack:SHIP': 'ship',
  'tanker:BOOM': 'tanker',
  'tanker:BASKET': 'tanker',
});

/** Unlock key of a context menu action ({ type, keyword }), or null when it has no level requirement. */
export function unlockKeyForMenuAction(action) {
  if (!action) return null;
  return MENU_ACTION_UNLOCK_KEYS[`${action.type}:${String(action.keyword || '').toUpperCase()}`] || null;
}

/**
 * Lock state of a menu action from the /api/hidc/unlocks payload.
 * @returns {{ level: number, label: string, reason: string } | null} null when usable.
 */
export function menuActionLock(action, unlockState) {
  const key = unlockKeyForMenuAction(action);
  if (!key || !unlockState) return null;
  const entry = (unlockState.unlocks || []).find((item) => item.key === key);
  if (!entry || entry.unlocked) return null;
  const me = unlockState.me;
  let reason;
  if (!me) reason = `Accedi e collega l'account DCS: serve il livello ${entry.level}.`;
  else if (!me.linked) reason = `Collega l'account DCS dal profilo: serve il livello ${entry.level}.`;
  else reason = `${entry.label} si sblocca al livello ${entry.level} (sei al livello ${me.level ?? 0}).`;
  return { level: entry.level, label: entry.label, reason };
}
