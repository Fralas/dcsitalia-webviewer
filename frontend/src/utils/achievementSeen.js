function getSeenStorageKey(userId) {
  return `dcsitalia.achievements.seen.${userId}`;
}

function emptyState() {
  return { seeded: false, keys: new Set() };
}

export function loadSeenAwards(userId) {
  if (!userId || typeof window === 'undefined' || !window.localStorage) {
    return emptyState();
  }

  try {
    const raw = window.localStorage.getItem(getSeenStorageKey(userId));
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const keys = Array.isArray(parsed?.keys) ? parsed.keys : [];
    return {
      seeded: parsed?.seeded === true,
      keys: new Set(keys.map((key) => String(key || '').trim()).filter(Boolean)),
    };
  } catch {
    return emptyState();
  }
}

export function saveSeenAwards(userId, { seeded, keys }) {
  if (!userId || typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(getSeenStorageKey(userId), JSON.stringify({
      seeded: Boolean(seeded),
      keys: [...keys],
    }));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export function rememberAwardKeys(userId, keysToAdd) {
  const current = loadSeenAwards(userId);
  const nextKeys = new Set(current.keys);
  (keysToAdd || []).forEach((key) => {
    const normalized = String(key || '').trim();
    if (normalized) nextKeys.add(normalized);
  });
  saveSeenAwards(userId, { seeded: true, keys: nextKeys });
  return nextKeys;
}
