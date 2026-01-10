const DEFAULT_PROFILE = {
  selectedAircraft: [],
  stats: {
    missionsCompleted: 0,
    ordersCompleted: 0,
  },
};

function getStorageKey(userId) {
  return `dcsitalia.profile.${userId}`;
}

function normalizeProfile(data) {
  if (!data || typeof data !== 'object') {
    return { ...DEFAULT_PROFILE, stats: { ...DEFAULT_PROFILE.stats } };
  }

  const selectedAircraft = Array.isArray(data.selectedAircraft) ? data.selectedAircraft : [];
  const stats = data.stats && typeof data.stats === 'object' ? data.stats : {};

  return {
    selectedAircraft,
    stats: {
      missionsCompleted: Number.isFinite(stats.missionsCompleted) ? stats.missionsCompleted : 0,
      ordersCompleted: Number.isFinite(stats.ordersCompleted) ? stats.ordersCompleted : 0,
    },
  };
}

export function getDefaultUserProfile() {
  return { ...DEFAULT_PROFILE, stats: { ...DEFAULT_PROFILE.stats } };
}

export function loadUserProfile(userId) {
  if (!userId) return getDefaultUserProfile();
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return getDefaultUserProfile();
    return normalizeProfile(JSON.parse(raw));
  } catch (error) {
    console.warn('Failed to load user profile:', error);
    return getDefaultUserProfile();
  }
}

export function saveUserProfile(userId, profile) {
  if (!userId) return;
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(profile));
  } catch (error) {
    console.warn('Failed to save user profile:', error);
  }
}
