import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';
import { getAirportById, default as airports } from '../config/airports.config.js';

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
  airframeRegistry: path.join(DCORE_LIDC_DBRIDGE_DIR, 'Export_LIDC_AirframeRegistry.json'),
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

function deckTotalsMap(deck, unitsById) {
  const totals = new Map();
  buildWarehouseDeltasFromDeck(deck, unitsById).forEach(({ dcsType, qty }) => {
    totals.set(dcsType, qty);
  });
  return totals;
}

export function computeWarehouseDeltaDiff(oldDeck, newDeck, unitsById) {
  const oldTotals = deckTotalsMap(oldDeck, unitsById);
  const newTotals = deckTotalsMap(newDeck, unitsById);
  const allTypes = new Set([...oldTotals.keys(), ...newTotals.keys()]);
  const deltas = [];

  allTypes.forEach((dcsType) => {
    const diff = (newTotals.get(dcsType) || 0) - (oldTotals.get(dcsType) || 0);
    if (diff !== 0) {
      deltas.push({ dcsType, qty: diff });
    }
  });

  return deltas;
}

function hasBlockingInUseAirframes(squadron, dcsType, unitsById) {
  const airframes = Array.isArray(squadron?.airframes) ? squadron.airframes : [];
  return airframes.some((airframe) => {
    const unit = unitsById.get(airframe?.unitId);
    if (getUnitDcsType(unit) !== dcsType) return false;
    return (airframe?.dcsState || 'in_hangar') === 'in_use';
  });
}

function readWarehouseOpsState() {
  const parsed = loadJson(DOC.LIDC_WAREHOUSE_OPS, { ops: [], updatedAt: Date.now() }, WAREHOUSE_OPS_FILE);
  return {
    ops: Array.isArray(parsed?.ops) ? parsed.ops : [],
    updatedAt: Number(parsed?.updatedAt) || Date.now(),
  };
}

function writeWarehouseOpsState(state) {
  saveJson(DOC.LIDC_WAREHOUSE_OPS, {
    ops: state.ops,
    updatedAt: Date.now(),
  });
}

export function queueWarehouseDeltaOps({
  squadronId,
  baseId,
  deltas = [],
  unitsById,
  squadron = null,
}) {
  const dcsAirbaseName = resolveDcsAirbaseName(baseId);
  if (!dcsAirbaseName) {
    console.warn(`LIDC warehouse ops skipped: unknown baseId ${baseId}`);
    return [];
  }

  const normalizedDeltas = Array.isArray(deltas)
    ? deltas.filter((entry) => entry?.dcsType && Number(entry?.qty) !== 0)
    : [];
  if (normalizedDeltas.length === 0) return [];

  const state = readWarehouseOpsState();
  const createdAt = Date.now();
  const newOps = normalizedDeltas.map(({ dcsType, qty }) => {
    const delta = Math.floor(Number(qty) || 0);
    const blocked = delta < 0
      && squadron
      && hasBlockingInUseAirframes(squadron, dcsType, unitsById);

    return {
      opId: `whop_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
      squadronId,
      baseId,
      dcsAirbaseName,
      dcsType,
      delta,
      createdAt,
      status: blocked ? 'deferred' : 'pending',
      deferredReason: blocked ? 'airframe_in_use' : null,
    };
  });

  state.ops = [...state.ops, ...newOps];
  writeWarehouseOpsState(state);
  exportPendingWarehouseOps();
  return newOps;
}

export function queueWarehouseOpsForSquadronDeck({
  squadronId,
  baseId,
  deck,
  unitsById,
  squadron = null,
}) {
  const deltas = buildWarehouseDeltasFromDeck(deck, unitsById);
  return queueWarehouseDeltaOps({
    squadronId,
    baseId,
    deltas,
    unitsById,
    squadron,
  });
}

export function processDeferredWarehouseOps(squadrons = [], unitsById) {
  const state = readWarehouseOpsState();
  let changed = false;

  state.ops = state.ops.map((op) => {
    if (op.status !== 'deferred') return op;

    const squadron = squadrons.find((entry) => entry?.id === op.squadronId) || null;
    if (!squadron || !hasBlockingInUseAirframes(squadron, op.dcsType, unitsById)) {
      changed = true;
      return {
        ...op,
        status: 'pending',
        deferredReason: null,
        releasedAt: Date.now(),
      };
    }

    return op;
  });

  if (changed) {
    writeWarehouseOpsState(state);
    exportPendingWarehouseOps();
  }

  return { released: changed };
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

function normalizeAirbaseLookup(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function resolveBaseIdFromDcsAirbaseName(dcsAirbaseName) {
  const target = normalizeAirbaseLookup(dcsAirbaseName);
  if (!target) return null;

  const match = airports.find((airport) => {
    const aliases = [
      airport?.name,
      airport?.displayName,
      airport?.csvPrefix?.replace(/_/g, ' '),
      airport?.id?.replace(/-/g, ' '),
    ];
    return aliases.some((alias) => normalizeAirbaseLookup(alias) === target);
  });

  return match?.id || null;
}
