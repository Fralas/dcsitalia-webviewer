import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const LUA_DIR = path.join(__dirname, '../../../csvexample');
const DYZONE_STATUS_PATH = path.join(LUA_DIR, 'Dyzone_Status.lua');
const DYZONE_TASK_PATH = path.join(LUA_DIR, 'ActDyzone_Task.lua');
const DYZONE_POSITION_PATH = path.join(LUA_DIR, 'Dyzone_Position.lua');
const OUTPUT_JSON_PATH = path.join(__dirname, '../../../frontend/src/config/frontlineZones.json');

/**
 * Parse Dyzone_Status.lua file
 * Format: zone_00 = "BLUE"
 * @returns {Object} Map of zone_id -> status
 */
function parseDyzoneStatus() {
  try {
    const content = fs.readFileSync(DYZONE_STATUS_PATH, 'utf8');
    const zoneStatus = {};

    // Match pattern: zone_XX = "STATUS"
    const regex = /(zone_\d+)\s*=\s*"([^"]+)"/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const [, zoneId, status] = match;
      zoneStatus[zoneId] = status;
    }

    return zoneStatus;
  } catch (error) {
    console.error('Error parsing Dyzone_Status.lua:', error);
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
    const content = fs.readFileSync(DYZONE_TASK_PATH, 'utf8');
    const zoneTasks = {};

    // Match pattern: zone_XX : TASK1, TASK2, TASK3
    const regex = /(zone_\d+)\s*:\s*([^\n]+)/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      const [, zoneId, tasksString] = match;
      // Split by comma and trim whitespace
      const tasks = tasksString.split(',').map(t => t.trim());
      zoneTasks[zoneId] = tasks;
    }

    return zoneTasks;
  } catch (error) {
    console.error('Error parsing ActDyzone_Task.lua:', error);
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
    const content = fs.readFileSync(DYZONE_POSITION_PATH, 'utf8');
    const zonePositions = {};

    // Match pattern: zone_XX = "LAT LON"
    const regex = /(zone_\d+)\s*=\s*"([0-9.]+)\s+([0-9.]+)"/g;
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
    console.error('Error parsing Dyzone_Position.lua:', error);
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
  // If no status, it's NEUTRAL
  if (!status) {
    return 'NEUTRAL';
  }

  // If explicitly marked NEUTRAL
  if (status === 'NEUTRAL') {
    return 'NEUTRAL';
  }

  // UNDER_ATTACK keeps its status
  if (status === 'UNDER_ATTACK') {
    return 'UNDER_ATTACK';
  }

  // For RED and BLUE, return as-is
  // (tasks will be stored separately in the tasks array)
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

/**
 * Sync Lua files to JSON
 * Reads all three Lua files, combines data, and writes to frontlineZones.json
 * @returns {Object} Sync result with count and success flag
 */
export function syncLuaToJson() {
  try {
    console.log('🔄 Starting Lua → JSON sync...');

    // Parse all three Lua files
    const zoneStatus = parseDyzoneStatus();
    const zoneTasks = parseActDyzoneTask();
    const zonePositions = parseDyzonePosition();

    // Get all unique zone IDs
    const allZoneIds = new Set([
      ...Object.keys(zoneStatus),
      ...Object.keys(zoneTasks),
      ...Object.keys(zonePositions)
    ]);

    // Build zone objects
    const zones = [];

    for (const zoneId of Array.from(allZoneIds).sort()) {
      const status = zoneStatus[zoneId];
      const tasks = zoneTasks[zoneId] || [];
      const position = zonePositions[zoneId];

      // Skip zones without position data
      if (!position) {
        console.warn(`⚠️  Skipping ${zoneId}: no position data`);
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

    // Write to JSON file
    fs.writeFileSync(OUTPUT_JSON_PATH, JSON.stringify(zones, null, 2), 'utf8');

    console.log(`✅ Synced ${zones.length} zones to frontlineZones.json`);
    console.log(`   - Status entries: ${Object.keys(zoneStatus).length}`);
    console.log(`   - Task entries: ${Object.keys(zoneTasks).length}`);
    console.log(`   - Position entries: ${Object.keys(zonePositions).length}`);

    return {
      success: true,
      count: zones.length,
      zones: zones
    };
  } catch (error) {
    console.error('❌ Error syncing Lua to JSON:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Start file watcher for Lua files
 * Automatically syncs when any Lua file changes
 * @param {Function} onSync - Optional callback function called after successful sync
 */
export function startLuaWatcher(onSync = null) {
  const luaFiles = [
    DYZONE_STATUS_PATH,
    DYZONE_TASK_PATH,
    DYZONE_POSITION_PATH
  ];

  console.log('👁️  Starting Lua file watcher...');
  console.log('   Watching:');
  luaFiles.forEach(file => console.log(`   - ${path.basename(file)}`));

  const watcher = chokidar.watch(luaFiles, {
    persistent: true,
    ignoreInitial: true, // Don't trigger on startup
    awaitWriteFinish: {
      stabilityThreshold: 1000, // Wait 1s for file to finish writing
      pollInterval: 100
    }
  });

  watcher.on('change', (filePath) => {
    const fileName = path.basename(filePath);
    console.log(`📝 Detected change in ${fileName}`);

    // Sync Lua to JSON
    const result = syncLuaToJson();

    // Call callback if provided
    if (onSync && result.success) {
      onSync(result);
    }
  });

  watcher.on('error', (error) => {
    console.error('❌ Watcher error:', error);
  });

  return watcher;
}

/**
 * Initialize: perform initial sync and start watcher
 */
export function initialize(onSync = null) {
  console.log('🚀 Initializing Lua Zone Sync Service...');

  // Perform initial sync
  syncLuaToJson();

  // Start watcher
  const watcher = startLuaWatcher(onSync);

  return watcher;
}
