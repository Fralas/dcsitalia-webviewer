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
  NEUTRAL: 1,           // Massima priorità
  UNDER_ATTACK: 2,      // Priorità elevata
  RED_CAS_ONLY: 3,      // Priorità alta
  RED_CAS_DEAD: 4,      // Priorità media
  RED_CAS_DEAD_SEAD: 5, // Priorità bassa
};

/**
 * Calculate priority for a zone based on status and tasks
 * @param {Object} zone - Zone object from frontlineZones.json
 * @returns {number} Priority level (1 = highest)
 */
function calculateZonePriority(zone) {
  const { status, tasks = [] } = zone;

  // NEUTRAL zones have maximum priority
  if (status === 'NEUTRAL') {
    return PRIORITY_LEVELS.NEUTRAL;
  }

  // UNDER_ATTACK zones have elevated priority
  if (status === 'UNDER_ATTACK') {
    return PRIORITY_LEVELS.UNDER_ATTACK;
  }

  // RED zones - priority depends on tasks
  if (status === 'RED') {
    const hasCAS = tasks.includes('CAS');
    const hasDEAD = tasks.includes('DEAD');
    const hasSEAD = tasks.includes('SEAD');

    // Only CAS → Priority 3 (alta)
    if (hasCAS && !hasDEAD && !hasSEAD) {
      return PRIORITY_LEVELS.RED_CAS_ONLY;
    }

    // CAS + DEAD → Priority 4 (media)
    if (hasCAS && hasDEAD && !hasSEAD) {
      return PRIORITY_LEVELS.RED_CAS_DEAD;
    }

    // CAS + DEAD + SEAD → Priority 5 (bassa)
    if (hasCAS && hasDEAD && hasSEAD) {
      return PRIORITY_LEVELS.RED_CAS_DEAD_SEAD;
    }
  }

  // Default: no priority (zone doesn't require missions)
  return 999;
}

/**
 * Get priority label in Italian
 * @param {number} priority - Priority number
 * @returns {string} Priority label
 */
function getPriorityLabel(priority) {
  switch (priority) {
    case PRIORITY_LEVELS.NEUTRAL:
      return 'Massima';
    case PRIORITY_LEVELS.UNDER_ATTACK:
      return 'Elevata';
    case PRIORITY_LEVELS.RED_CAS_ONLY:
      return 'Alta';
    case PRIORITY_LEVELS.RED_CAS_DEAD:
      return 'Media';
    case PRIORITY_LEVELS.RED_CAS_DEAD_SEAD:
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
 * Only generates missions for zones that have tasks and meet priority criteria
 * @returns {Array} Array of generated combat missions
 */
export function generateCombatMissions() {
  const zones = loadFrontlineZones();
  const missions = [];

  zones.forEach(zone => {
    // Only generate missions for zones with tasks
    if (!zone.tasks || zone.tasks.length === 0) {
      return;
    }

    const priority = calculateZonePriority(zone);

    // Skip zones with no priority
    if (priority === 999) {
      return;
    }

    // Create a mission for each task in the zone
    zone.tasks.forEach(taskType => {
      const missionId = `combat_${Date.now()}_${missionIdCounter++}`;
      const mission = {
        id: missionId,
        zone_id: zone.id,
        zone_name: zone.name,
        coordinates: zone.coordinates,
        status: zone.status,
        task_type: taskType,
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
 * Refresh missions by regenerating from zones
 * This will clear current missions and regenerate
 */
export function refreshCombatMissions() {
  console.log('🔄 Refreshing combat missions...');
  return generateCombatMissions();
}

// Initialize missions on module load
generateCombatMissions();
