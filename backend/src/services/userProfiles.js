import path from 'path';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

const PROFILES_FILE = path.join('./data/profiles', 'profiles.json');

const DEFAULT_PROFILE = {
  selectedAircraft: [],
  stats: {
    missionsCompleted: 0,
    ordersCompleted: 0,
  },
};

function readProfiles() {
  const data = loadJson(DOC.USER_PROFILES, {}, PROFILES_FILE);
  return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
}

function writeProfiles(profiles) {
  saveJson(DOC.USER_PROFILES, profiles);
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

export function getProfile(userId) {
  const profiles = readProfiles();
  if (!profiles[userId]) {
    return { ...DEFAULT_PROFILE, stats: { ...DEFAULT_PROFILE.stats } };
  }
  return normalizeProfile(profiles[userId]);
}

export function saveProfile(userId, profile) {
  const profiles = readProfiles();
  const normalized = normalizeProfile(profile);
  profiles[userId] = normalized;
  writeProfiles(profiles);
  return normalized;
}

export default {
  getProfile,
  saveProfile,
};
