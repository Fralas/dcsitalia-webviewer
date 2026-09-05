import fs from 'fs';
import path from 'path';
import { optionalPath } from '../config/envPaths.js';

const SCORE_FILE_ENV = 'DSCORE_SCORE_FILE';
const CAS_ATTEMPTS = 12;
const CAS_RETRY_MS = 40;

const BLUE_KEYS = [
  'blue',
  'BLUE',
  'Blue',
  'blue_score',
  'blueScore',
  'BlueScore',
  'BLUE_SCORE',
  'score_blue',
  'scoreBlue',
  'fp_blue',
  'blue_fp',
  'bluePoints',
  'blue_points',
  'BLUE_POINTS',
];

const WRAP_KEYS = [
  'scores',
  'score',
  'points',
  'fp',
  'faction',
  'coalitions',
  'coalition',
  'data',
  'DSCORE',
  'dscore',
  'state',
];

const ROOT_SCORE_KEYS = ['score', 'balance', 'points', 'fp', 'value'];

function resolveScoreFile() {
  const explicit = optionalPath(SCORE_FILE_ENV);
  if (explicit) return explicit;

  const productionPoints = optionalPath('PRODUCTION_POINTS_FILE');
  if (productionPoints) {
    return path.join(path.dirname(productionPoints), 'score.json');
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.floor(n));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function setAtPath(node, keyPath, value) {
  let cursor = node;
  for (let i = 0; i < keyPath.length - 1; i += 1) {
    const key = keyPath[i];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keyPath[keyPath.length - 1]] = value;
}

function locateBlueScore(node, trail = []) {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return null;

  for (const key of BLUE_KEYS) {
    const parsed = asInt(node[key]);
    if (parsed != null && Object.prototype.hasOwnProperty.call(node, key)) {
      return { path: [...trail, key], value: parsed };
    }
  }

  for (const wrap of WRAP_KEYS) {
    if (node[wrap] && typeof node[wrap] === 'object' && !Array.isArray(node[wrap])) {
      const nested = locateBlueScore(node[wrap], [...trail, wrap]);
      if (nested) return nested;
    }
  }

  if (Array.isArray(node.coalitions) || Array.isArray(node.scores)) {
    const list = node.coalitions || node.scores;
    const idx = list.findIndex((entry) => /blue/i.test(String(entry?.coalition || entry?.name || entry?.id || '')));
    if (idx >= 0) {
      const parsed = asInt(list[idx]?.score ?? list[idx]?.points ?? list[idx]?.value);
      if (parsed != null) {
        const scoreKey = list[idx].score != null ? 'score' : (list[idx].points != null ? 'points' : 'value');
        return { path: [...trail, node.coalitions ? 'coalitions' : 'scores', idx, scoreKey], value: parsed };
      }
    }
  }

  if (trail.length === 0) {
    for (const key of ROOT_SCORE_KEYS) {
      const parsed = asInt(node[key]);
      if (parsed != null && Object.prototype.hasOwnProperty.call(node, key) && typeof node[key] !== 'object') {
        return { path: [key], value: parsed };
      }
    }
  }

  return null;
}

function parseLuaTable(raw) {
  let text = String(raw || '').trim();
  text = text.replace(/^\uFEFF/, '');
  const assignment = text.match(/^(?:local\s+)?([A-Za-z_][\w]*)\s*=\s*(\{[\s\S]*\})$/);
  if (assignment) {
    text = assignment[2];
  } else {
    text = text.replace(/^[\s\S]*?return\s+/, '');
  }
  text = text.replace(/--[^\n]*/g, '');
  text = text.replace(/,(\s*[}\]])/g, '$1');
  text = text.replace(/([,{]\s*)([A-Za-z_][\w]*)\s*=/g, '$1"$2":');
  text = text.replace(/([,{]\s*)\[(\d+)\]\s*=/g, '$1$2:');
  text = text.replace(/([,{]\s*)\["((?:\\.|[^"\\])*)"\]\s*=/g, '$1"$2":');
  text = text.replace(/\bnil\b/g, 'null');
  return {
    data: JSON.parse(text),
    assignmentName: assignment ? assignment[1] : null,
  };
}

function toLuaValue(value, indent = 0) {
  const pad = '  '.repeat(indent);
  const next = '  '.repeat(indent + 1);
  if (value == null) return 'nil';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'nil';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return '{}';
    const lines = value.map((entry) => `${next}${toLuaValue(entry, indent + 1)}`);
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    const lines = keys.map((key) => {
      const luaKey = /^[A-Za-z_][\w]*$/.test(key) ? key : `[${JSON.stringify(key)}]`;
      return `${next}${luaKey} = ${toLuaValue(value[key], indent + 1)}`;
    });
    return `{\n${lines.join(',\n')}\n${pad}}`;
  }
  return 'nil';
}

function serializeScoreDocument(doc) {
  if (doc.format === 'lua') {
    const table = toLuaValue(doc.data);
    if (doc.assignmentName) return `${doc.assignmentName} = ${table}\n`;
    return `return ${table}\n`;
  }
  return `${JSON.stringify(doc.data, null, 2)}\n`;
}

function parseScoreDocument(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return null;

  try {
    const data = JSON.parse(trimmed);
    if (!data || typeof data !== 'object') return null;
    const located = locateBlueScore(data);
    if (!located) return null;
    return { format: 'json', data, located };
  } catch {
    try {
      const parsed = parseLuaTable(trimmed);
      if (!parsed?.data || typeof parsed.data !== 'object') return null;
      const located = locateBlueScore(parsed.data);
      if (!located) return null;
      return { format: 'lua', data: parsed.data, located, assignmentName: parsed.assignmentName };
    } catch {
      return null;
    }
  }
}

function readScoreSnapshot(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  const parsed = parseScoreDocument(raw);
  if (!parsed) return null;
  return {
    raw,
    format: parsed.format,
    data: parsed.data,
    located: parsed.located,
    assignmentName: parsed.assignmentName || null,
    blue: parsed.located.value,
  };
}

function writeScoreSnapshotAtomic(filePath, snapshot, nextBlue) {
  const nextData = cloneJson(snapshot.data);
  setAtPath(nextData, snapshot.located.path, nextBlue);
  const payload = serializeScoreDocument({
    format: snapshot.format,
    data: nextData,
    assignmentName: snapshot.assignmentName,
  });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, payload, 'utf8');
  fs.renameSync(tempPath, filePath);
}

export function createDscoreFactionPoints({
  scoreFile = resolveScoreFile(),
  onChange = null,
} = {}) {
  let cachedBlue = null;
  let syncSignature = '';
  let queue = Promise.resolve();

  function emitIfChanged(nextBlue, force = false) {
    const normalized = asInt(nextBlue);
    const changed = force || normalized !== cachedBlue;
    cachedBlue = normalized;
    if (changed && typeof onChange === 'function') {
      onChange(cachedBlue);
    }
    return cachedBlue;
  }

  function readFromDisk() {
    const snapshot = readScoreSnapshot(scoreFile);
    if (!snapshot) return null;
    emitIfChanged(snapshot.blue);
    syncSignature = snapshot.raw;
    return snapshot.blue;
  }

  function syncFromFile() {
    try {
      if (!scoreFile || !fs.existsSync(scoreFile)) return cachedBlue;
      const raw = fs.readFileSync(scoreFile, 'utf8');
      if (!raw || raw.trim() === '') return cachedBlue;
      if (raw === syncSignature) return cachedBlue;
      const parsed = parseScoreDocument(raw);
      if (!parsed) return cachedBlue;
      syncSignature = raw;
      return emitIfChanged(parsed.located.value);
    } catch (error) {
      console.error('Failed DSCORE score sync from file:', error.message);
      return cachedBlue;
    }
  }

  async function applyDelta(delta) {
    const amount = Math.floor(Number(delta) || 0);
    if (!amount) return readFromDisk();
    if (!scoreFile) {
      throw new Error('DSCORE score file is not configured');
    }

    let lastError = new Error('Could not update DSCORE score file');
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt += 1) {
      const snapshot = readScoreSnapshot(scoreFile);
      if (!snapshot) {
        throw new Error('DSCORE score file is missing or unreadable');
      }

      const nextBlue = snapshot.blue + amount;
      if (nextBlue < 0) {
        throw new Error('Insufficient BLUE faction points');
      }

      try {
        writeScoreSnapshotAtomic(scoreFile, snapshot, nextBlue);
      } catch (error) {
        lastError = error;
        await sleep(CAS_RETRY_MS);
        continue;
      }

      const verified = readScoreSnapshot(scoreFile);
      if (!verified) {
        lastError = new Error('DSCORE score file became unreadable after write');
        await sleep(CAS_RETRY_MS);
        continue;
      }

      // DSCORE won the race: adopt its file and retry the same delta on the new value.
      if (verified.blue !== nextBlue) {
        lastError = new Error('DSCORE overwrote the score file');
        await sleep(CAS_RETRY_MS);
        continue;
      }

      syncSignature = verified.raw;
      return emitIfChanged(verified.blue, true);
    }

    throw lastError;
  }

  function transact(work) {
    const run = queue.then(() => work({
      read: () => readFromDisk(),
      get: () => cachedBlue,
      spend: (cost) => applyDelta(-Math.max(0, Math.floor(Number(cost) || 0))),
      credit: (amount) => applyDelta(Math.max(0, Math.floor(Number(amount) || 0))),
    }));
    queue = run.then(() => undefined, () => undefined);
    return run;
  }

  return {
    getScoreFile: () => scoreFile,
    getBluePoints: () => cachedBlue,
    readBluePoints: () => readFromDisk(),
    syncFromFile,
    transact,
    spendBluePoints: (cost) => transact(({ spend }) => spend(cost)),
    creditBluePoints: (amount) => transact(({ credit }) => credit(amount)),
  };
}
