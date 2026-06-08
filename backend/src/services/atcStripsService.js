import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  ATC_BAYS,
  OWNER_ROLE,
  STRIP_DIRECTION,
  applyAction,
  applyMove,
  acceptCoordination,
  acceptGroundCoordination,
  rejectCoordination,
  rejectGroundCoordination,
  cancelHandoff,
  isHandoffToGround,
  isHandoffToTower,
  HANDOFF_TARGET,
  createEmptyStripFields,
  getDefaultBayForDirection,
  getDefaultBayForCreate,
  getDefaultOwnerForCreate,
  getDefaultModelForDirection,
  getNextStep,
  buildDemoStrips,
  isGroundStorageBay,
  isTowerBay,
  defaultRunwayConfig,
  canEditStrip,
} from './atcStripModel.js';

const DATA_DIR = path.resolve(process.cwd(), 'data/atc');
const BOARD_FILE = path.join(DATA_DIR, 'board.json');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const MAX_HISTORY = 5000;

let boardState = { airports: {}, settings: { manualSort: false } };
let historyState = { entries: [] };
let initialized = false;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(filePath, data) {
  ensureDataDir();
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, filePath);
}

function normalizeStrip(raw = {}) {
  const direction = raw.direction === STRIP_DIRECTION.ARR ? STRIP_DIRECTION.ARR : STRIP_DIRECTION.DEP;
  const defaults = createEmptyStripFields(direction);
  const fields = { ...defaults };

  Object.keys(defaults).forEach((key) => {
    if (raw[key] !== undefined) fields[key] = raw[key];
  });

  return {
    id: raw.id || crypto.randomUUID(),
    airportId: String(raw.airportId || 'aleppo'),
    model: raw.model || getDefaultModelForDirection(direction),
    direction,
    bayId: raw.bayId || getDefaultBayForDirection(direction),
    position: Number.isFinite(raw.position) ? raw.position : 0,
    ownerRole: raw.ownerRole || null,
    coordinationStatus: raw.coordinationStatus || null,
    operationalState: raw.operationalState || 'planned',
    handoffActive: Boolean(raw.handoffActive),
    handoffTarget: raw.handoffTarget || (raw.handoffActive ? HANDOFF_TARGET.TOWER : null),
    handoffFromBay: raw.handoffFromBay || null,
    queuePosition: Number.isFinite(raw.queuePosition) ? raw.queuePosition : null,
    flags: {
      highlighted: Boolean(raw.flags?.highlighted),
      unread: Boolean(raw.flags?.unread),
      dynamic: Boolean(raw.flags?.dynamic),
    },
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
    updatedAt: Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
    createdBy: raw.createdBy || null,
    ...fields,
  };
}

function persist() {
  writeJsonAtomic(BOARD_FILE, boardState);
  writeJsonAtomic(HISTORY_FILE, historyState);
}

function appendHistory(entry) {
  historyState.entries.push({
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry,
  });
  if (historyState.entries.length > MAX_HISTORY) {
    historyState.entries = historyState.entries.slice(-MAX_HISTORY);
  }
}

function createEmptyRoleSlots() {
  return { GROUND: null, TOWER: null };
}

function getAirportBoard(airportId) {
  if (!boardState.airports[airportId]) {
    boardState.airports[airportId] = {
      strips: [],
      manualSort: false,
      roleSlots: createEmptyRoleSlots(),
      tocQueue: [],
      runwayConfig: defaultRunwayConfig(),
    };
  }
  const board = boardState.airports[airportId];
  if (!board.roleSlots) board.roleSlots = createEmptyRoleSlots();
  if (!Array.isArray(board.tocQueue)) board.tocQueue = [];
  if (!board.runwayConfig) board.runwayConfig = defaultRunwayConfig();
  return board;
}

function syncQueuePositions(board) {
  board.tocQueue.forEach((stripId, index) => {
    const strip = board.strips.find((s) => s.id === stripId);
    if (strip) strip.queuePosition = index + 1;
  });
}

function enqueueHandoff(board, stripId) {
  if (!board.tocQueue.includes(stripId)) {
    board.tocQueue.push(stripId);
  }
  syncQueuePositions(board);
}

function dequeueHandoff(board, stripId) {
  board.tocQueue = board.tocQueue.filter((id) => id !== stripId);
  syncQueuePositions(board);
}

function reconcileTocQueue(board) {
  const handoffIds = board.strips.filter((s) => s.handoffActive).map((s) => s.id);
  board.tocQueue = board.tocQueue.filter((id) => handoffIds.includes(id));
  handoffIds.forEach((id) => {
    if (!board.tocQueue.includes(id)) board.tocQueue.push(id);
  });
  syncQueuePositions(board);
}

function getUserClaimedRole(board, userId) {
  if (!userId) return null;
  if (board.roleSlots.GROUND?.userId === userId) return OWNER_ROLE.GROUND;
  if (board.roleSlots.TOWER?.userId === userId) return OWNER_ROLE.TOWER;
  return null;
}

function assertRoleClaimed(board, user, role) {
  if (!user?.id) return { error: 'NOT_AUTHENTICATED', status: 401 };
  const slot = board.roleSlots[role];
  if (!slot || slot.userId !== user.id) {
    return { error: 'ROLE_NOT_CLAIMED', status: 403 };
  }
  return null;
}

function assertStripEditableByRole(strip, role, { allowCancelHandoff = false, allowCoordinate = false } = {}) {
  if (allowCoordinate) {
    if (role === OWNER_ROLE.TOWER && isHandoffToTower(strip)) return null;
    if (role === OWNER_ROLE.GROUND && isHandoffToGround(strip)) return null;
  }
  if (allowCancelHandoff) {
    if (role === OWNER_ROLE.GROUND && isHandoffToTower(strip)) return null;
    if (role === OWNER_ROLE.TOWER && isHandoffToGround(strip)) return null;
  }
  if (!canEditStrip(strip, role)) {
    return { error: 'STRIP_NOT_IN_YOUR_SECTOR', status: 403 };
  }
  return null;
}

function assertTargetBayForRole(targetBayId, role) {
  if (targetBayId === ATC_BAYS.G_HANDOFF && role === OWNER_ROLE.GROUND) return null;
  if (targetBayId === ATC_BAYS.T_HANDOFF && role === OWNER_ROLE.TOWER) return null;

  if (role === OWNER_ROLE.GROUND) {
    if (isGroundStorageBay(targetBayId)) return null;
    return { error: 'TARGET_BAY_NOT_ALLOWED', status: 403 };
  }

  if (role === OWNER_ROLE.TOWER) {
    if (isTowerBay(targetBayId)) return null;
    return { error: 'TARGET_BAY_NOT_ALLOWED', status: 403 };
  }

  return { error: 'INVALID_ROLE', status: 400 };
}

function findStrip(airportId, stripId) {
  const board = getAirportBoard(airportId);
  const strip = board.strips.find((s) => s.id === stripId);
  return { board, strip };
}

function nextStripPosition(board, bayId) {
  const inBay = board.strips.filter((s) => s.bayId === bayId);
  const maxPos = inBay.reduce((max, s) => Math.max(max, Number.isFinite(s.position) ? s.position : 0), 0);
  return maxPos + 1;
}

export function initAtcStripsService() {
  if (initialized) return;
  ensureDataDir();
  boardState = readJson(BOARD_FILE, { airports: {}, settings: { manualSort: false } });
  historyState = readJson(HISTORY_FILE, { entries: [] });

  if (!boardState.airports.aleppo?.strips?.length) {
    seedDemoBoard('aleppo');
  }

  initialized = true;
}

export function seedDemoBoard(airportId = 'aleppo') {
  const board = getAirportBoard(airportId);
  board.strips = buildDemoStrips(airportId);
  persist();
  return board.strips;
}

export function getBoardPayload(airportId) {
  const board = getAirportBoard(airportId);
  reconcileTocQueue(board);
  const recentHistory = historyState.entries
    .filter((e) => e.airportId === airportId)
    .slice(-100)
    .reverse();

  const nextActions = {};
  board.strips.forEach((strip) => {
    const next = getNextStep(strip);
    if (next?.action) nextActions[strip.id] = next;
  });

  return {
    airportId,
    strips: board.strips,
    manualSort: board.manualSort,
    runwayConfig: { ...defaultRunwayConfig(), ...board.runwayConfig },
    recentHistory,
    nextActions,
    roleSlots: board.roleSlots,
    tocQueue: board.tocQueue,
  };
}

export function claimRole(airportId, role, user) {
  if (!user?.id) return { error: 'NOT_AUTHENTICATED', status: 401 };
  if (role !== OWNER_ROLE.GROUND && role !== OWNER_ROLE.TOWER) {
    return { error: 'INVALID_ROLE', status: 400 };
  }

  const board = getAirportBoard(airportId);
  const otherRole = role === OWNER_ROLE.GROUND ? OWNER_ROLE.TOWER : OWNER_ROLE.GROUND;
  const currentRole = getUserClaimedRole(board, user.id);

  if (currentRole && currentRole !== role) {
    return { error: 'MUST_RELEASE_CURRENT_ROLE', status: 409 };
  }

  const occupied = board.roleSlots[role];
  if (occupied && occupied.userId !== user.id) {
    return {
      error: 'ROLE_OCCUPIED',
      status: 409,
      occupiedBy: occupied,
    };
  }

  board.roleSlots[role] = {
    userId: user.id,
    username: user.globalName || user.username || user.id,
    claimedAt: Date.now(),
  };

  appendHistory({
    airportId,
    action: 'CLAIM_ROLE',
    role,
    userId: user.id,
    callsign: null,
    meta: { role },
  });
  persist();
  return { payload: getBoardPayload(airportId), claimedRole: role };
}

export function releaseRole(airportId, role, user) {
  if (!user?.id) return { error: 'NOT_AUTHENTICATED', status: 401 };

  const board = getAirportBoard(airportId);
  const slot = board.roleSlots[role];
  if (!slot || slot.userId !== user.id) {
    return { error: 'ROLE_NOT_CLAIMED', status: 403 };
  }

  board.roleSlots[role] = null;
  appendHistory({
    airportId,
    action: 'RELEASE_ROLE',
    role,
    userId: user.id,
  });
  persist();
  return { payload: getBoardPayload(airportId) };
}

export function setManualSort(airportId, manualSort) {
  const board = getAirportBoard(airportId);
  board.manualSort = Boolean(manualSort);
  persist();
  return getBoardPayload(airportId);
}

export function setRunwayConfig(airportId, config, user, role) {
  if (!user?.id) return { error: 'NOT_AUTHENTICATED', status: 401 };
  const board = getAirportBoard(airportId);
  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;

  const current = { ...defaultRunwayConfig(), ...board.runwayConfig };
  const next = { ...current };

  if (config.end1 !== undefined) next.end1 = String(config.end1).slice(0, 3);
  if (config.end2 !== undefined) next.end2 = String(config.end2).slice(0, 3);
  if (config.qnh !== undefined) next.qnh = String(config.qnh).slice(0, 8);
  if (config.wind !== undefined) next.wind = String(config.wind).slice(0, 16);
  if (config.qfu !== undefined) next.qfu = String(config.qfu).slice(0, 8);
  if (config.cloud !== undefined) next.cloud = String(config.cloud).slice(0, 24);

  if (config.activeEnd !== undefined) {
    if (role !== OWNER_ROLE.TOWER) {
      return { error: 'TOWER_ONLY', status: 403 };
    }
    next.activeEnd = config.activeEnd === '2' ? '2' : '1';
  }

  board.runwayConfig = next;
  appendHistory({
    airportId,
    action: 'RUNWAY_CONFIG',
    role,
    userId: user.id,
    callsign: null,
    meta: next,
  });
  persist();
  return getBoardPayload(airportId);
}

export function createStrip(airportId, payload, user) {
  const board = getAirportBoard(airportId);
  const role = payload.role;
  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;
  const direction = payload.direction === STRIP_DIRECTION.ARR ? STRIP_DIRECTION.ARR : STRIP_DIRECTION.DEP;
  const defaultBay = getDefaultBayForCreate(role, direction);
  const strip = normalizeStrip({
    ...createEmptyStripFields(direction),
    ...payload,
    airportId,
    direction,
    bayId: payload.bayId || defaultBay,
    ownerRole: getDefaultOwnerForCreate(role),
    operationalState: direction === STRIP_DIRECTION.ARR && role === OWNER_ROLE.TOWER
      ? 'inbound_pending'
      : (direction === STRIP_DIRECTION.DEP && role === OWNER_ROLE.TOWER ? 'tower_active' : 'planned'),
    createdBy: user?.id || user?.userId || null,
    flags: { highlighted: false, unread: false, dynamic: true },
  });

  strip.position = nextStripPosition(board, strip.bayId);

  board.strips.push(strip);
  appendHistory({
    airportId,
    stripId: strip.id,
    action: 'CREATE',
    role: payload.role || null,
    userId: strip.createdBy,
    callsign: strip.callsign,
    meta: { direction },
  });
  persist();
  return { strip, payload: getBoardPayload(airportId), lastAction: 'CREATE' };
}

export function updateStrip(airportId, stripId, payload, user) {
  const { board, strip } = findStrip(airportId, stripId);
  if (!strip) return { error: 'STRIP_NOT_FOUND', status: 404 };

  const role = payload.role;
  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;
  const sectorErr = assertStripEditableByRole(strip, role, { allowCancelHandoff: true });
  if (sectorErr) return sectorErr;

  const editableKeys = [
    ...Object.keys(createEmptyStripFields(strip.direction)),
    'runway', 'flags',
  ];

  editableKeys.forEach((key) => {
    if (payload[key] !== undefined) strip[key] = payload[key];
  });

  strip.updatedAt = Date.now();
  appendHistory({
    airportId,
    stripId,
    action: 'UPDATE',
    role: payload.role || null,
    userId: user?.id || null,
    callsign: strip.callsign,
    meta: payload,
  });
  persist();
  return { strip, payload: getBoardPayload(airportId), lastAction: 'UPDATE' };
}

export function moveStrip(airportId, stripId, { bayId, position, action, role, operationalState }, user) {
  const { board, strip } = findStrip(airportId, stripId);
  if (!strip) return { error: 'STRIP_NOT_FOUND', status: 404 };

  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;

  const sectorErr = assertStripEditableByRole(strip, role);
  if (sectorErr) return sectorErr;

  if (bayId) {
    const targetErr = assertTargetBayForRole(bayId, role);
    if (targetErr) return targetErr;
  }

  let result;
  if (action) {
    result = applyAction(strip, action);
  } else if (bayId) {
    result = applyMove(strip, bayId, role, { operationalState });
    if (result.ok && bayId === strip.bayId && operationalState && result.strip) {
      result.strip.operationalState = operationalState;
    }
  } else {
    return { error: 'MISSING_TARGET', status: 400 };
  }

  if (!result.ok) return { error: result.error, status: 400 };

  const updated = { ...result.strip, updatedAt: Date.now() };
  if (Number.isFinite(position)) {
    updated.position = position;
  } else if (bayId && result.toBay !== result.fromBay) {
    updated.position = nextStripPosition(board, updated.bayId);
  }

  if (result.enqueue) enqueueHandoff(board, stripId);
  if (result.dequeue) dequeueHandoff(board, stripId);

  const idx = board.strips.findIndex((s) => s.id === stripId);
  board.strips[idx] = updated;

  appendHistory({
    airportId,
    stripId,
    action: action || 'MOVE',
    fromBay: result.fromBay,
    toBay: result.toBay,
    role: role || null,
    userId: user?.id || null,
    callsign: updated.callsign,
  });
  persist();
  return { strip: updated, payload: getBoardPayload(airportId), lastAction: action || 'MOVE' };
}

export function coordinateStrip(airportId, stripId, { accept, note, role }, user) {
  const { board, strip } = findStrip(airportId, stripId);
  if (!strip) return { error: 'STRIP_NOT_FOUND', status: 404 };

  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;

  if (role === OWNER_ROLE.TOWER && !isHandoffToTower(strip)) {
    return { error: 'ONLY_TOWER_CAN_COORDINATE_TOC', status: 403 };
  }
  if (role === OWNER_ROLE.GROUND && !isHandoffToGround(strip)) {
    return { error: 'ONLY_GROUND_CAN_COORDINATE_AOG', status: 403 };
  }
  if (role !== OWNER_ROLE.TOWER && role !== OWNER_ROLE.GROUND) {
    return { error: 'INVALID_ROLE', status: 400 };
  }

  const sectorErr = assertStripEditableByRole(strip, role, { allowCoordinate: true });
  if (sectorErr) return sectorErr;

  let result;
  if (role === OWNER_ROLE.TOWER) {
    result = accept ? acceptCoordination(strip) : rejectCoordination(strip, note);
  } else {
    result = accept ? acceptGroundCoordination(strip) : rejectGroundCoordination(strip, note);
  }
  if (!result.ok) return { error: result.error, status: 400 };

  const updated = { ...result.strip, updatedAt: Date.now() };
  if (result.dequeue || strip.handoffActive) dequeueHandoff(board, stripId);

  const idx = board.strips.findIndex((s) => s.id === stripId);
  board.strips[idx] = updated;

  appendHistory({
    airportId,
    stripId,
    action: result.action,
    fromBay: result.fromBay,
    toBay: result.toBay,
    role: role || null,
    userId: user?.id || null,
    callsign: updated.callsign,
    meta: { note: note || null },
  });
  persist();
  return { strip: updated, payload: getBoardPayload(airportId), lastAction: result.action };
}

export function cancelHandoffStrip(airportId, stripId, { targetBay, role }, user) {
  const { board, strip } = findStrip(airportId, stripId);
  if (!strip) return { error: 'STRIP_NOT_FOUND', status: 404 };

  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;

  if (role === OWNER_ROLE.GROUND && !isHandoffToTower(strip)) {
    return { error: 'ONLY_GROUND_CAN_CANCEL_TOC_HANDOFF', status: 403 };
  }
  if (role === OWNER_ROLE.TOWER && !isHandoffToGround(strip)) {
    return { error: 'ONLY_TOWER_CAN_CANCEL_TOG_HANDOFF', status: 403 };
  }
  if (role !== OWNER_ROLE.GROUND && role !== OWNER_ROLE.TOWER) {
    return { error: 'INVALID_ROLE', status: 400 };
  }

  const sectorErr = assertStripEditableByRole(strip, role, { allowCancelHandoff: true });
  if (sectorErr) return sectorErr;

  const result = cancelHandoff(strip, targetBay);
  if (!result.ok) return { error: result.error, status: 400 };

  const updated = { ...result.strip, updatedAt: Date.now() };
  if (result.dequeue) dequeueHandoff(board, stripId);

  const idx = board.strips.findIndex((s) => s.id === stripId);
  board.strips[idx] = updated;

  appendHistory({
    airportId,
    stripId,
    action: result.action,
    fromBay: result.fromBay,
    toBay: result.toBay,
    role,
    userId: user?.id || null,
    callsign: updated.callsign,
    meta: { targetBay: targetBay || null },
  });
  persist();
  return { strip: updated, payload: getBoardPayload(airportId), lastAction: result.action };
}

export function deleteStrip(airportId, stripId, user, role) {
  const { board, strip } = findStrip(airportId, stripId);
  if (!strip) return { error: 'STRIP_NOT_FOUND', status: 404 };

  const authErr = assertRoleClaimed(board, user, role);
  if (authErr) return authErr;
  const sectorErr = assertStripEditableByRole(strip, role);
  if (sectorErr) return sectorErr;

  if (strip.handoffActive) dequeueHandoff(board, stripId);
  board.strips = board.strips.filter((s) => s.id !== stripId);
  appendHistory({
    airportId,
    stripId,
    action: 'DELETE',
    role: role || null,
    userId: user?.id || null,
    callsign: strip.callsign,
  });
  persist();
  return { payload: getBoardPayload(airportId), lastAction: 'DELETE' };
}

export function getHistory({ airportId, stripId, limit = 200 } = {}) {
  let entries = historyState.entries;
  if (airportId) entries = entries.filter((e) => e.airportId === airportId);
  if (stripId) entries = entries.filter((e) => e.stripId === stripId);
  return entries.slice(-limit).reverse();
}

export function getNextActionForStrip(stripId, airportId) {
  const { strip } = findStrip(airportId, stripId);
  if (!strip) return null;
  return getNextStep(strip);
}

export function getAllBays() {
  return ATC_BAYS;
}
