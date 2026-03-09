import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Input source directory (legacy Lua or new DMAP JSON exports)
const SOURCE_DIR = process.env.DYZONE_SOURCE_DIR
  ? path.resolve(process.env.DYZONE_SOURCE_DIR)
  : path.join(__dirname, '../../../csvexample');

function pickDefaultInputPath(candidateFiles) {
  for (const fileName of candidateFiles) {
    const candidate = path.join(SOURCE_DIR, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Fallback to first candidate for clearer error messages if source files are missing
  return path.join(SOURCE_DIR, candidateFiles[0]);
}

function getLuaPaths() {
  return {
    statusPath: process.env.DYZONE_STATUS_EXPORT_FILE
      ? path.resolve(process.env.DYZONE_STATUS_EXPORT_FILE)
      : process.env.DYZONE_STATUS_FILE
      ? path.resolve(process.env.DYZONE_STATUS_FILE)
      : pickDefaultInputPath(['Export_Dzone_Status.json', 'Dyzone_Status.lua']),
    taskPath: process.env.DYZONE_TASK_EXPORT_FILE
      ? path.resolve(process.env.DYZONE_TASK_EXPORT_FILE)
      : process.env.DYZONE_TASK_FILE
      ? path.resolve(process.env.DYZONE_TASK_FILE)
      : pickDefaultInputPath(['Export_Dzone_ActiveTask.json', 'ActDyzone_Task.lua']),
    positionPath: process.env.DYZONE_POSITION_EXPORT_FILE
      ? path.resolve(process.env.DYZONE_POSITION_EXPORT_FILE)
      : process.env.DYZONE_POSITION_FILE
      ? path.resolve(process.env.DYZONE_POSITION_FILE)
      : pickDefaultInputPath(['Export_Dzone_Position.json', 'Dyzone_Position.lua']),
    outputJsonPath: process.env.DYZONE_OUTPUT_JSON
      ? path.resolve(process.env.DYZONE_OUTPUT_JSON)
      : path.join(__dirname, '../../../frontend/src/config/frontlineZones.json')
  };
}

const DEFAULT_BUFFER_FILE = path.resolve(process.cwd(), 'lua-zones-buffer.json');
const DEFAULT_INTERVAL_MS = 5 * 60 * 1000;
let lastLuaMtimes = null;

function getBufferFilePath(customPath) {
  return customPath ? path.resolve(customPath) : DEFAULT_BUFFER_FILE;
}

function parseJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function parseTaskString(value) {
  if (value === null || value === undefined) {
    return [];
  }

  return String(value)
    .split(',')
    .map(task => task.trim())
    .filter(Boolean);
}

function parsePositionString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const match = String(value).trim().match(/^(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)$/);
  if (!match) {
    return null;
  }

  return {
    lat: parseFloat(match[1]),
    lon: parseFloat(match[2])
  };
}

/**
 * Parse Dyzone_Status.lua file
 * Format: zone_00 = "BLUE"
 * @returns {Object} Map of zone_id -> status
 */
function parseDyzoneStatus() {
  try {
    const { statusPath } = getLuaPaths();

    if (statusPath.toLowerCase().endsWith('.json')) {
      const parsed = parseJsonFile(statusPath);
      const zoneStatus = {};

      for (const [zoneId, status] of Object.entries(parsed || {})) {
        zoneStatus[zoneId] = String(status || '').trim().toUpperCase();
      }

      return zoneStatus;
    }

    const content = fs.readFileSync(statusPath, 'utf8');
    const zoneStatus = {};

    // Match pattern: zone_XX = "STATUS"
    const regex = /(zone_\d+)\s*=\s*"([^"]+)"/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const [, zoneId, status] = match;
      zoneStatus[zoneId] = status.trim().toUpperCase();
    }

    return zoneStatus;
  } catch (error) {
    console.error('[lua] Error parsing Dyzone_Status.lua:', error.message);
    return {};
  }
}

/**
 * Parse ActDyzone_Task.lua file
 * Format: zone_31 : SEAD
 *         zone_37 : SEAD, DEAD, CAS
 * @returns {Object} Map of zone_id -> tasks array
 */
function parseActDyzoneTask() {
  try {
    const { taskPath } = getLuaPaths();

    if (taskPath.toLowerCase().endsWith('.json')) {
      const parsed = parseJsonFile(taskPath);
      const zoneTasks = {};

      for (const [zoneId, value] of Object.entries(parsed || {})) {
        if (Array.isArray(value)) {
          zoneTasks[zoneId] = value
            .map(task => String(task).trim())
            .filter(Boolean);
          continue;
        }

        zoneTasks[zoneId] = parseTaskString(value);
      }

      return zoneTasks;
    }

    const content = fs.readFileSync(taskPath, 'utf8');
    const zoneTasks = {};

    // Match pattern: zone_XX : TASK1, TASK2, TASK3
    const regex = /(zone_\d+)\s*:\s*([^\n]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const [, zoneId, tasksString] = match;
      const tasks = parseTaskString(tasksString);

      zoneTasks[zoneId] = tasks;
    }

    return zoneTasks;
  } catch (error) {
    console.error('[lua] Error parsing ActDyzone_Task.lua:', error.message);
    return {};
  }
}

/**
 * Parse Dyzone_Position.lua file
 * Format: zone_00 = "36.999599 35.347506"
 * @returns {Object} Map of zone_id -> {lat, lon}
 */
function parseDyzonePosition() {
  try {
    const { positionPath } = getLuaPaths();

    if (positionPath.toLowerCase().endsWith('.json')) {
      const parsed = parseJsonFile(positionPath);
      const zonePositions = {};

      for (const [zoneId, value] of Object.entries(parsed || {})) {
        if (value && typeof value === 'object' && Number.isFinite(value.lat) && Number.isFinite(value.lon)) {
          zonePositions[zoneId] = {
            lat: Number(value.lat),
            lon: Number(value.lon)
          };
          continue;
        }

        const parsedPosition = parsePositionString(value);
        if (parsedPosition) {
          zonePositions[zoneId] = parsedPosition;
        }
      }

      return zonePositions;
    }

    const content = fs.readFileSync(positionPath, 'utf8');
    const zonePositions = {};

    // Match pattern: zone_XX = "LAT LON"
    const regex = /(zone_\d+)\s*=\s*"(-?[0-9.]+)\s+(-?[0-9.]+)"/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const [, zoneId, lat, lon] = match;
      zonePositions[zoneId] = {
        lat: parseFloat(lat),
        lon: parseFloat(lon)
      };
    }

    return zonePositions;
  } catch (error) {
    console.error('[lua] Error parsing Dyzone_Position.lua:', error.message);
    return {};
  }
}

/**
 * Determine zone status based on Dyzone_Status and active tasks
 * Logic:
 * - NEUTRAL: zones with no status entry or explicitly marked NEUTRAL
 * - UNDER_ATTACK: zones marked as UNDER_ATTACK in Dyzone_Status
 * - RED with tasks: zones marked RED in Dyzone_Status AND have tasks
 * - BLUE: zones marked BLUE in Dyzone_Status
 * - RED without tasks: zones marked RED but no tasks (inactive)
 *
 * @param {string} status - Status from Dyzone_Status.lua
 * @param {Array} tasks - Tasks from ActDyzone_Task.lua
 * @returns {string} Final status
 */
function determineZoneStatus(status, tasks) {
  if (!status) {
    return 'NEUTRAL';
  }

  if (status === 'NEUTRAL') {
    return 'NEUTRAL';
  }

  if (status === 'UNDER_ATTACK') {
    return 'UNDER_ATTACK';
  }

  return status;
}

/**
 * Generate zone name from zone ID
 * @param {string} zoneId - Zone ID (e.g., "zone_00")
 * @returns {string} Zone name (e.g., "Zone 00")
 */
function generateZoneName(zoneId) {
  const num = zoneId.replace('zone_', '');
  return `Zone ${num.padStart(2, '0')}`;
}

function readZoneBuffer(bufferFilePath) {
  const targetPath = getBufferFilePath(bufferFilePath);
  if (!fs.existsSync(targetPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(targetPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('[lua] Error reading zone buffer:', error.message);
    return null;
  }
}

function writeZoneBuffer(payload, bufferFilePath) {
  const targetPath = getBufferFilePath(bufferFilePath);
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  return targetPath;
}

function writeFrontlineZones(zones) {
  const { outputJsonPath } = getLuaPaths();
  fs.writeFileSync(outputJsonPath, JSON.stringify(zones, null, 2), 'utf8');
}

function buildZonesFromLua() {
  const zoneStatus = parseDyzoneStatus();
  const zoneTasks = parseActDyzoneTask();
  const zonePositions = parseDyzonePosition();

  const allZoneIds = new Set([
    ...Object.keys(zoneStatus),
    ...Object.keys(zoneTasks),
    ...Object.keys(zonePositions)
  ]);

  const zones = [];

  for (const zoneId of Array.from(allZoneIds).sort()) {
    const status = zoneStatus[zoneId];
    const tasks = zoneTasks[zoneId] || [];
    const position = zonePositions[zoneId];

    if (!position) {
      console.warn(`[lua] Skipping ${zoneId}: no position data`);
      continue;
    }

    const finalStatus = determineZoneStatus(status, tasks);

    zones.push({
      id: zoneId,
      name: generateZoneName(zoneId),
      coordinates: position,
      status: finalStatus,
      isActive: tasks.length > 0 || finalStatus === 'UNDER_ATTACK' || finalStatus === 'NEUTRAL',
      tasks: tasks
    });
  }

  return {
    zones,
    counts: {
      status: Object.keys(zoneStatus).length,
      tasks: Object.keys(zoneTasks).length,
      positions: Object.keys(zonePositions).length
    }
  };
}

export function buildLuaZoneBuffer(bufferFilePath) {
  try {
    const { statusPath, taskPath, positionPath } = getLuaPaths();
    const currentMtimes = {
      status: fs.existsSync(statusPath) ? fs.statSync(statusPath).mtimeMs : 0,
      task: fs.existsSync(taskPath) ? fs.statSync(taskPath).mtimeMs : 0,
      position: fs.existsSync(positionPath) ? fs.statSync(positionPath).mtimeMs : 0,
    };

    if (
      lastLuaMtimes &&
      currentMtimes.status === lastLuaMtimes.status &&
      currentMtimes.task === lastLuaMtimes.task &&
      currentMtimes.position === lastLuaMtimes.position
    ) {
      const cached = readZoneBuffer(bufferFilePath);
      if (cached && Array.isArray(cached.zones)) {
        return {
          success: true,
          count: cached.zones.length,
          zones: cached.zones,
          counts: cached.counts || {},
          bufferPath: getBufferFilePath(bufferFilePath),
          skipped: true
        };
      }
    }

    const { zones, counts } = buildZonesFromLua();
    lastLuaMtimes = currentMtimes;
    const payload = {
      updatedAt: new Date().toISOString(),
      counts,
      zones
    };

    const targetPath = writeZoneBuffer(payload, bufferFilePath);
    console.log(`[lua] Buffer updated: ${targetPath}`);

    return {
      success: true,
      count: zones.length,
      zones,
      counts,
      bufferPath: targetPath
    };
  } catch (error) {
    console.error('[lua] Error building buffer:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export function syncBufferToJson(bufferFilePath) {
  try {
    const buffered = readZoneBuffer(bufferFilePath);
    if (!buffered || !Array.isArray(buffered.zones)) {
      return {
        success: false,
        error: 'Zone buffer missing or invalid'
      };
    }

    writeFrontlineZones(buffered.zones);
    console.log(`[lua] Synced ${buffered.zones.length} zones to frontlineZones.json`);

    return {
      success: true,
      count: buffered.zones.length,
      zones: buffered.zones,
      counts: buffered.counts || {}
    };
  } catch (error) {
    console.error('[lua] Error syncing buffer to JSON:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

export function refreshBufferAndSync(bufferFilePath) {
  const buildResult = buildLuaZoneBuffer(bufferFilePath);
  if (!buildResult.success) {
    return buildResult;
  }

  writeFrontlineZones(buildResult.zones);
  console.log(`[lua] Synced ${buildResult.count} zones to frontlineZones.json`);

  return buildResult;
}

/**
 * Backwards-compatible entry point
 */
export function syncLuaToJson(bufferFilePath) {
  return refreshBufferAndSync(bufferFilePath);
}

/**
 * Initialize buffered sync with scheduled updates.
 * @param {Function} onSync - Optional callback after successful sync
 * @param {Object} options - Optional settings
 * @param {string} options.bufferFilePath - Custom buffer file path
 * @param {number} options.intervalMs - Refresh interval in ms
 */
export function initialize(onSync = null, options = {}) {
  const intervalMs = Number.isFinite(options.intervalMs)
    ? options.intervalMs
    : DEFAULT_INTERVAL_MS;
  const bufferFilePath = getBufferFilePath(options.bufferFilePath);

  console.log(`[lua] Initializing buffered zone sync (interval ${intervalMs}ms)`);

  const initialResult = refreshBufferAndSync(bufferFilePath);
  if (onSync && initialResult.success) {
    onSync(initialResult);
  }

  const intervalId = setInterval(() => {
    const result = refreshBufferAndSync(bufferFilePath);
    if (onSync && result.success) {
      onSync(result);
    }
  }, intervalMs);

  return {
    intervalId,
    bufferFilePath,
    stop: () => clearInterval(intervalId)
  };
}
