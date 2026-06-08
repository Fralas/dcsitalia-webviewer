import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data/historical');
const PLACEMENTS_FILE = path.join(DATA_DIR, 'dbuild_placements.json');

let placementsCache = [];

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PLACEMENTS_FILE)) {
    fs.writeFileSync(PLACEMENTS_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readPlacements() {
  try {
    const raw = fs.readFileSync(PLACEMENTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading DBUILD placements file:', error.message);
    return [];
  }
}

function writePlacementsAtomic(list) {
  const tempPath = `${PLACEMENTS_FILE}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(list, null, 2), 'utf-8');
  fs.renameSync(tempPath, PLACEMENTS_FILE);
}

ensureStorage();
placementsCache = readPlacements();

export function getPlacements() {
  return placementsCache.slice().sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));
}

export function getPlacementById(id) {
  return placementsCache.find((entry) => entry.id === id) || null;
}

export function createPlacement(entry) {
  placementsCache.push(entry);
  writePlacementsAtomic(placementsCache);
  return entry;
}

export function updatePlacement(id, patch) {
  const index = placementsCache.findIndex((entry) => entry.id === id);
  if (index < 0) return null;
  placementsCache[index] = { ...placementsCache[index], ...patch };
  writePlacementsAtomic(placementsCache);
  return placementsCache[index];
}

export function deletePlacement(id) {
  const before = placementsCache.length;
  placementsCache = placementsCache.filter((entry) => entry.id !== id);
  if (placementsCache.length !== before) {
    writePlacementsAtomic(placementsCache);
    return true;
  }
  return false;
}

export default {
  getPlacements,
  getPlacementById,
  createPlacement,
  updatePlacement,
  deletePlacement,
};
