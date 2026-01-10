import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to frontline zones
const ZONES_PATH = path.join(__dirname, '../../../frontend/src/config/frontlineZones.json');

// In-memory storage for combat missions
let combatMissions = [];
let missionIdCounter = 1;

/**
 * Priority levels for mission generation
 * Lower number = higher priority
 */
const PRIORITY_LEVELS = {
  NEUTRAL_LOGISTICS: 1,  // Massima priorità - missione logistica
  UNDER_ATTACK: 2,       // Priorità elevata
  ONE_TASK: 3,           // Priorità alta (1 task)
  TWO_TASKS: 4,          // Priorità media (2 tasks)
  THREE_PLUS_TASKS: 5,   // Priorità bassa (3+ tasks)
};

/**
 * Calculate priority for a zone based on status and number of tasks
 * @param {Object} zone - Zone object from frontlineZones.json
 * @returns {number} Priority level (1 = highest)
 */
function calculateZonePriority(zone) {
  const { status, tasks = [] } = zone;

  // NEUTRAL zones generate logistics mission with maximum priority
  if (status === 'NEUTRAL') {
    return PRIORITY_LEVELS.NEUTRAL_LOGISTICS;
  }

  // UNDER_ATTACK zones have elevated priority (regardless of task count)
  if (status === 'UNDER_ATTACK') {
    return PRIORITY_LEVELS.UNDER_ATTACK;
  }

  // For all other zones (RED, BLUE), priority depends on NUMBER of tasks
  const taskCount = tasks.length;

  // No tasks = no missions
  if (taskCount === 0) {
    return 999;
  }

  // 1 task → Priority 3 (alta)
  if (taskCount === 1) {
    return PRIORITY_LEVELS.ONE_TASK;
  }

  // 2 tasks → Priority 4 (media)
  if (taskCount === 2) {
    return PRIORITY_LEVELS.TWO_TASKS;
  }

  // 3+ tasks → Priority 5 (bassa)
  if (taskCount >= 3) {
    return PRIORITY_LEVELS.THREE_PLUS_TASKS;
  }

  return 999;
}

/**
 * Get priority label in Italian
 * @param {number} priority - Priority number
 * @returns {string} Priority label
 */
function getPriorityLabel(priority) {
  switch (priority) {
    case PRIORITY_LEVELS.NEUTRAL_LOGISTICS:
      return 'Massima';
    case PRIORITY_LEVELS.UNDER_ATTACK:
      return 'Elevata';
    case PRIORITY_LEVELS.ONE_TASK:
      return 'Alta';
    case PRIORITY_LEVELS.TWO_TASKS:
      return 'Media';
    case PRIORITY_LEVELS.THREE_PLUS_TASKS:
      return 'Bassa';
    default:
      return 'Nessuna';
  }
}

/**
 * Load frontline zones from JSON file
 * @returns {Array} Array of zone objects
 */
function loadFrontlineZones() {
  try {
    const data = fs.readFileSync(ZONES_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading frontline zones:', error);
    return [];
  }
}

/**
 * Generate combat missions from active zones
 * Creates ONE mission per zone (not per task)
 * - NEUTRAL zones: LOGISTICS mission (troop transport)
 * - Other zones: mission with all tasks for that zone
 * @returns {Array} Array of generated combat missions
 */
export function generateCombatMissions() {
  const zones = loadFrontlineZones();
  const missions = [];

  zones.forEach(zone => {
    const priority = calculateZonePriority(zone);

    // Skip zones with no priority (no tasks and not NEUTRAL)
    if (priority === 999) {
      return;
    }

    // NEUTRAL zones get a special LOGISTICS mission for troop transport
    if (zone.status === 'NEUTRAL') {
      const missionId = `combat_${Date.now()}_${missionIdCounter++}`;
      const mission = {
        id: missionId,
        zone_id: zone.id,
        zone_name: zone.name,
        coordinates: zone.coordinates,
        status: zone.status,
        tasks: ['LOGISTICS'], // Array with single task for NEUTRAL zones
        priority: priority,
        priority_label: getPriorityLabel(priority),
        is_active: zone.isActive || false,
        assigned_to: null,
        assigned_aircraft: null,
        mission_status: 'available', // available | assigned | completed | aborted
        created_at: Date.now(),
        assigned_at: null,
        completed_at: null,
      };
      missions.push(mission);
      return;
    }

    // For all other zones with tasks, create ONE mission with all tasks
    if (!zone.tasks || zone.tasks.length === 0) {
      return;
    }

    const missionId = `combat_${Date.now()}_${missionIdCounter++}`;
    const mission = {
      id: missionId,
      zone_id: zone.id,
      zone_name: zone.name,
      coordinates: zone.coordinates,
      status: zone.status,
      tasks: zone.tasks, // Array of all tasks for this zone
      priority: priority,
      priority_label: getPriorityLabel(priority),
      is_active: zone.isActive || false,
      assigned_to: null,
      assigned_aircraft: null,
      mission_status: 'available', // available | assigned | completed | aborted
      created_at: Date.now(),
      assigned_at: null,
      completed_at: null,
    };
    missions.push(mission);
  });

  // Sort by priority (lower number = higher priority)
  missions.sort((a, b) => a.priority - b.priority);

  // Store in memory
  combatMissions = missions;

  console.log(`🎯 Generated ${missions.length} combat missions from frontline zones`);
  return missions;
}

/**
 * Get all combat missions
 * @param {string} filterStatus - Optional filter by mission_status
 * @returns {Array} Array of combat missions
 */
export function getAllCombatMissions(filterStatus = null) {
  if (filterStatus) {
    return combatMissions.filter(m => m.mission_status === filterStatus);
  }
  return combatMissions;
}

/**
 * Get available combat missions (not assigned)
 * @returns {Array} Array of available missions sorted by priority
 */
export function getAvailableCombatMissions() {
  return combatMissions
    .filter(m => m.mission_status === 'available')
    .sort((a, b) => a.priority - b.priority);
}

/**
 * Assign a combat mission to a pilot with their aircraft
 * @param {string} missionId - Mission ID
 * @param {string} pilotName - Pilot name (from Discord user)
 * @param {string} aircraft - Aircraft type the pilot is using
 * @returns {Object|null} Updated mission or null if not found
 */
export function assignCombatMission(missionId, pilotName, aircraft) {
  const mission = combatMissions.find(m => m.id === missionId);

  if (!mission) {
    console.error(`Mission ${missionId} not found`);
    return null;
  }

  if (mission.mission_status !== 'available') {
    console.error(`Mission ${missionId} is not available (status: ${mission.mission_status})`);
    return null;
  }

  // Assign mission
  mission.assigned_to = pilotName;
  mission.assigned_aircraft = aircraft;
  mission.mission_status = 'assigned';
  mission.assigned_at = Date.now();

  console.log(`✈️  Mission ${missionId} assigned to ${pilotName} (${aircraft})`);
  console.log(`   Zone: ${mission.zone_name} | Task: ${mission.task_type} | Priority: ${mission.priority_label}`);

  return mission;
}

/**
 * Complete a combat mission
 * @param {string} missionId - Mission ID
 * @returns {Object|null} Updated mission or null if not found
 */
export function completeCombatMission(missionId) {
  const mission = combatMissions.find(m => m.id === missionId);

  if (!mission) {
    console.error(`Mission ${missionId} not found`);
    return null;
  }

  if (mission.mission_status !== 'assigned') {
    console.error(`Mission ${missionId} is not assigned (status: ${mission.mission_status})`);
    return null;
  }

  mission.mission_status = 'completed';
  mission.completed_at = Date.now();

  console.log(`✅ Mission ${missionId} completed by ${mission.assigned_to}`);

  return mission;
}

/**
 * Abort a combat mission
 * @param {string} missionId - Mission ID
 * @returns {Object|null} Updated mission or null if not found
 */
export function abortCombatMission(missionId) {
  const mission = combatMissions.find(m => m.id === missionId);

  if (!mission) {
    console.error(`Mission ${missionId} not found`);
    return null;
  }

  mission.mission_status = 'aborted';

  console.log(`❌ Mission ${missionId} aborted`);

  return mission;
}

/**
 * Get missions assigned to a specific pilot
 * @param {string} pilotName - Pilot name
 * @returns {Array} Array of missions assigned to the pilot
 */
export function getMissionsByPilot(pilotName) {
  return combatMissions.filter(m => m.assigned_to === pilotName);
}

/**
 * Refresh missions by intelligently updating from zones
 * - Preserves assigned/completed/aborted missions if their zone still exists
 * - Removes missions for zones that no longer exist
 * - Adds new missions for new zones
 * - Regenerates all "available" missions from current zone data
 */
export function refreshCombatMissions() {
  console.log('🔄 Refreshing combat missions intelligently...');

  // Load updated zones
  const zones = loadFrontlineZones();

  // Create a map of zone_id -> zone for quick lookup
  const zoneMap = new Map();
  zones.forEach(zone => zoneMap.set(zone.id, zone));

  // Separate missions by status
  const preservedMissions = [];
  let removedCount = 0;

  // Preserve assigned/completed/aborted missions if their zone still exists
  combatMissions.forEach(mission => {
    if (mission.mission_status !== 'available') {
      // Check if zone still exists
      if (zoneMap.has(mission.zone_id)) {
        // Update mission data from current zone state (coordinates, name, status)
        const zone = zoneMap.get(mission.zone_id);
        mission.status = zone.status;
        mission.coordinates = zone.coordinates;
        mission.zone_name = zone.name;
        // Keep tasks and priority as they were when assigned

        preservedMissions.push(mission);
        console.log(`✅ Preserved ${mission.mission_status} mission for ${mission.zone_name} (assigned to ${mission.assigned_to || 'N/A'})`);
      } else {
        removedCount++;
        console.log(`⚠️  Zone ${mission.zone_id} no longer exists, removing ${mission.mission_status} mission ${mission.id}`);
      }
    }
  });

  // Generate new available missions from zones
  const newAvailableMissions = [];

  zones.forEach(zone => {
    const priority = calculateZonePriority(zone);

    // Skip zones with no priority (no tasks and not NEUTRAL)
    if (priority === 999) {
      return;
    }

    // Check if there's already a preserved mission for this zone
    const hasPreservedMission = preservedMissions.some(m => m.zone_id === zone.id);

    // Only create new available mission if no preserved mission exists for this zone
    if (!hasPreservedMission) {
      // NEUTRAL zones get a special LOGISTICS mission for troop transport
      if (zone.status === 'NEUTRAL') {
        const missionId = `combat_${Date.now()}_${missionIdCounter++}`;
        const mission = {
          id: missionId,
          zone_id: zone.id,
          zone_name: zone.name,
          coordinates: zone.coordinates,
          status: zone.status,
          tasks: ['LOGISTICS'],
          priority: priority,
          priority_label: getPriorityLabel(priority),
          is_active: zone.isActive || false,
          assigned_to: null,
          assigned_aircraft: null,
          mission_status: 'available',
          created_at: Date.now(),
          assigned_at: null,
          completed_at: null,
        };
        newAvailableMissions.push(mission);
        return;
      }

      // For all other zones with tasks, create ONE mission with all tasks
      if (zone.tasks && zone.tasks.length > 0) {
        const missionId = `combat_${Date.now()}_${missionIdCounter++}`;
        const mission = {
          id: missionId,
          zone_id: zone.id,
          zone_name: zone.name,
          coordinates: zone.coordinates,
          status: zone.status,
          tasks: zone.tasks,
          priority: priority,
          priority_label: getPriorityLabel(priority),
          is_active: zone.isActive || false,
          assigned_to: null,
          assigned_aircraft: null,
          mission_status: 'available',
          created_at: Date.now(),
          assigned_at: null,
          completed_at: null,
        };
        newAvailableMissions.push(mission);
      }
    }
  });

  // Combine preserved and new missions
  combatMissions = [...preservedMissions, ...newAvailableMissions];

  // Sort by priority (lower number = higher priority)
  combatMissions.sort((a, b) => a.priority - b.priority);

  console.log(`🎯 Mission refresh complete:`);
  console.log(`   - Preserved: ${preservedMissions.length} (assigned/completed/aborted)`);
  console.log(`   - Removed: ${removedCount} (zones no longer exist)`);
  console.log(`   - New available: ${newAvailableMissions.length}`);
  console.log(`   - Total: ${combatMissions.length} missions`);

  return combatMissions;
}

/**
 * Clear all combat missions
 * @returns {number} Number of missions cleared
 */
export function clearAllCombatMissions() {
  const count = combatMissions.length;
  combatMissions = [];
  missionIdCounter = 1;
  console.log(`🗑️  Cleared ${count} combat missions`);
  return count;
}

// Initialize missions on module load
generateCombatMissions();
