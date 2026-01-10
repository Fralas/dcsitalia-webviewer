import fs from 'fs';
import path from 'path';

const DATA_DIR = './data/profiles';
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');

const DEFAULT_PROFILE = {
  selectedAircraft: [],
  stats: {
    missionsCompleted: 0,
    ordersCompleted: 0,
  },
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(PROFILES_FILE)) {
  fs.writeFileSync(PROFILES_FILE, JSON.stringify({}, null, 2));
}

function readProfiles() {
  try {
    const data = fs.readFileSync(PROFILES_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading profiles:', error.message);
    return {};
  }
}

function writeProfiles(profiles) {
  try {
    fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
  } catch (error) {
    console.error('Error writing profiles:', error.message);
  }
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
