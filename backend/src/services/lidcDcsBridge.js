import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getAirportById } from '../config/airports.config.js';

const DATA_DIR = path.resolve(process.cwd(), 'data/lidc');
const WAREHOUSE_OPS_FILE = path.join(DATA_DIR, 'warehouse-ops.json');

const DCORE_LIDC_DBRIDGE_DIR = process.env.DCORE_LIDC_DBRIDGE_DIR
  ? path.resolve(process.env.DCORE_LIDC_DBRIDGE_DIR)
  : 'C:\\DCS SERVER\\MISSION SCRIPTS\\DCORE-LIDC\\src\\DBRIDGE';

export const LIDC_EXPORT_FILES = Object.freeze({
  linkRequests: path.join(DCORE_LIDC_DBRIDGE_DIR, 'Export_LIDC_LinkRequests.json'),
  airframeState: path.join(DCORE_LIDC_DBRIDGE_DIR, 'Export_LIDC_AirframeState.json'),
  policy: path.join(DCORE_LIDC_DBRIDGE_DIR, 'Export_LIDC_Policy.json'),
  warehouseOps: path.join(DCORE_LIDC_DBRIDGE_DIR, 'Export_LIDC_WarehouseOps.json'),
  warehouseOpsAck: path.join(DCORE_LIDC_DBRIDGE_DIR, 'Export_LIDC_WarehouseOps_Ack.json'),
});

export function writeJsonAtomic(targetPath, payload) {
  const tempPath = `${targetPath}.tmp`;
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tempPath, targetPath);
}

export function readJsonFile(targetPath, fallback = null) {
  try {
    if (!fs.existsSync(targetPath)) return fallback;
    const raw = fs.readFileSync(targetPath, 'utf8');
    if (!raw || raw.trim() === '') return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`LIDC DCS read error (${targetPath}):`, error.message);
    return fallback;
  }
}

export const WAREHOUSE_SPAWNABLE_CATEGORIES = Object.freeze([
  'aircrafts',
  'helicopters',
  'logistics',
]);

const DEFAULT_UNIT_DCS_TYPES = Object.freeze({
  f16c: 'F-16C_50',
  fa18c: 'F/A-18C_hornet',
  f15e: 'F-15ESE',
  a10c2: 'A-10C_2',
  m2000c: 'M-2000C',
  ah64d: 'AH-64D_BLK_II',
  oh58d: 'OH58D',
  ka50: 'Ka-50',
  mi24p: 'Mi-24P',
  sa342: 'SA342M',
  c130j: 'C-130J-30',
  ch47f: 'CH-47Fbl1',
  mi8mt: 'Mi-8MT',
  uh1h: 'UH-1H',
});

export function isWarehouseSpawnableCategory(category) {
  return WAREHOUSE_SPAWNABLE_CATEGORIES.includes(category);
}

export function getUnitDcsType(unit) {
  if (!unit || typeof unit !== 'object') return null;
  const explicit = typeof unit.dcsType === 'string' ? unit.dcsType.trim() : '';
  if (explicit) return explicit;
  const fallback = DEFAULT_UNIT_DCS_TYPES[unit.id];
  return fallback || null;
}

/**
 * Resolve a LIDC baseId to the DCS in-game airbase name (airbase:GetName()).
 * Uses the airport display name first, then csvPrefix with underscores as spaces.
 */
export function resolveDcsAirbaseName(baseId) {
  const airport = getAirportById(baseId);
  if (!airport) return null;

  const name = typeof airport.name === 'string' ? airport.name.trim() : '';
  if (name) return name;

  const csvPrefix = typeof airport.csvPrefix === 'string' ? airport.csvPrefix.trim() : '';
  if (!csvPrefix) return null;

  return csvPrefix.replace(/_/g, ' ');
}

/**
 * Resolve a LIDC baseId to the warehouse CSV filename prefix (e.g. Al_Dumayr).
 */
export function resolveWarehouseCsvPrefix(baseId) {
  const airport = getAirportById(baseId);
  if (!airport) return null;
  const csvPrefix = typeof airport.csvPrefix === 'string' ? airport.csvPrefix.trim() : '';
  return csvPrefix || null;
}

/**
 * Build warehouse inventory deltas from a deck manifest.
 * Returns [{ dcsType, qty }] for spawnable categories only.
 */
export function buildWarehouseDeltasFromDeck(deck, unitsById) {
  if (!deck || typeof deck !== 'object') return [];

  const totals = new Map();

  WAREHOUSE_SPAWNABLE_CATEGORIES.forEach((category) => {
    const entries = Array.isArray(deck[category]) ? deck[category] : [];
    entries.forEach((entry) => {
      const unitId = typeof entry?.unitId === 'string' ? entry.unitId : '';
      const qty = Math.floor(Number(entry?.quantity) || 0);
      if (!unitId || qty <= 0) return;

      const unit = unitsById.get(unitId);
      if (!unit || !isWarehouseSpawnableCategory(unit.category)) return;

      const dcsType = getUnitDcsType(unit);
      if (!dcsType) return;

      totals.set(dcsType, (totals.get(dcsType) || 0) + qty);
    });
  });

  return Array.from(totals.entries()).map(([dcsType, qty]) => ({ dcsType, qty }));
}

function readWarehouseOpsState() {
  try {
    if (!fs.existsSync(WAREHOUSE_OPS_FILE)) {
      return { ops: [], updatedAt: Date.now() };
    }
    const raw = fs.readFileSync(WAREHOUSE_OPS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ops: Array.isArray(parsed?.ops) ? parsed.ops : [],
      updatedAt: Number(parsed?.updatedAt) || Date.now(),
    };
  } catch (error) {
    console.error('LIDC warehouse ops read error:', error.message);
    return { ops: [], updatedAt: Date.now() };
  }
}

function writeWarehouseOpsState(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  writeJsonAtomic(WAREHOUSE_OPS_FILE, {
    ops: state.ops,
    updatedAt: Date.now(),
  });
}

export function queueWarehouseOpsForSquadronDeck({
  squadronId,
  baseId,
  deck,
  unitsById,
}) {
  const dcsAirbaseName = resolveDcsAirbaseName(baseId);
  if (!dcsAirbaseName) {
    console.warn(`LIDC warehouse ops skipped: unknown baseId ${baseId}`);
    return [];
  }

  const deltas = buildWarehouseDeltasFromDeck(deck, unitsById);
  if (deltas.length === 0) return [];

  const state = readWarehouseOpsState();
  const createdAt = Date.now();
  const newOps = deltas.map(({ dcsType, qty }) => ({
    opId: `whop_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
    squadronId,
    baseId,
    dcsAirbaseName,
    dcsType,
    delta: qty,
    createdAt,
    status: 'pending',
  }));

  state.ops = [...state.ops, ...newOps];
  writeWarehouseOpsState(state);
  exportPendingWarehouseOps();
  return newOps;
}

export function exportPendingWarehouseOps() {
  const state = readWarehouseOpsState();
  const pending = state.ops.filter((op) => op.status === 'pending');
  writeJsonAtomic(LIDC_EXPORT_FILES.warehouseOps, {
    ops: pending.map((op) => ({
      opId: op.opId,
      base: op.dcsAirbaseName,
      dcsType: op.dcsType,
      delta: op.delta,
      createdAt: op.createdAt,
    })),
    updatedAt: Date.now(),
  });
  return pending;
}

export function processWarehouseOpsAck(appliedOpIds = []) {
  if (!Array.isArray(appliedOpIds) || appliedOpIds.length === 0) {
    return { applied: 0 };
  }

  const appliedSet = new Set(appliedOpIds.map((id) => String(id)));
  const state = readWarehouseOpsState();
  let applied = 0;

  state.ops = state.ops.map((op) => {
    if (op.status === 'pending' && appliedSet.has(op.opId)) {
      applied += 1;
      return { ...op, status: 'applied', appliedAt: Date.now() };
    }
    return op;
  });

  if (applied > 0) {
    writeWarehouseOpsState(state);
    exportPendingWarehouseOps();
  }

  return { applied };
}
