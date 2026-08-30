import path from 'path';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

const PLACEMENTS_FILE = path.resolve(process.cwd(), 'data/historical/dbuild_placements.json');

let placementsCache = [];

function readPlacements() {
  const parsed = loadJson(DOC.DBUILD_PLACEMENTS, [], PLACEMENTS_FILE);
  return Array.isArray(parsed) ? parsed : [];
}

function writePlacementsAtomic(list) {
  saveJson(DOC.DBUILD_PLACEMENTS, list);
}

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
