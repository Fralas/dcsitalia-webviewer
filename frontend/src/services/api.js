const API_BASE = import.meta.env.VITE_API_URL
  || (typeof window !== 'undefined' ? `${window.location.origin}/api` : '/api');

/**
 * Fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Get all airports with current data
 */
export async function getAirports() {
  return fetchAPI('/airports');
}

/**
 * Get specific airport data
 */
export async function getAirport(airportId) {
  return fetchAPI(`/airports/${airportId}`);
}

/**
 * Get historical data for airport
 */
export async function getAirportHistory(airportId, hours = 24) {
  return fetchAPI(`/airports/${airportId}/history?hours=${hours}`);
}

/**
 * Get historical data for a specific weapon
 */
export async function getWeaponHistory(airportId, weaponId, days = 7) {
  const encodedWeaponId = encodeURIComponent(weaponId);
  return fetchAPI(`/airports/${airportId}/weapons/${encodedWeaponId}/history?days=${days}`);
}

/**
 * Get all active missions
 */
export async function getMissions() {
  return fetchAPI('/missions');
}

/**
 * Get missions for specific airport
 */
export async function getAirportMissions(airportId) {
  return fetchAPI(`/missions/airport/${airportId}`);
}

/**
 * Accept a mission
 */
export async function acceptMission(missionId, userId) {
  return fetchAPI(`/missions/${missionId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Complete a mission
 */
export async function completeMission(missionId) {
  return fetchAPI(`/missions/${missionId}/complete`, {
    method: 'POST',
  });
}

/**
 * Cancel a mission
 */
export async function cancelMission(missionId) {
  return fetchAPI(`/missions/${missionId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Create a manual supply order
 */
export async function createOrder(airportId, weaponId, quantity) {
  return fetchAPI(`/airports/${airportId}/create-order`, {
    method: 'POST',
    body: JSON.stringify({ weaponId, quantity }),
  });
}

/**
 * Get overall statistics
 */
export async function getStats() {
  return fetchAPI('/stats');
}

/**
 * DEBUG: Force generate orders for all airports
 */
export async function debugGenerateOrders() {
  return fetchAPI('/debug/generate-orders', {
    method: 'POST',
  });
}

/**
 * DEBUG: Clear all existing orders
 */
export async function debugClearOrders() {
  return fetchAPI('/debug/clear-orders', {
    method: 'POST',
  });
}

/**
 * Get all combat missions
 */
export async function getCombatMissions(status = null) {
  const queryParam = status ? `?status=${status}` : '';
  return fetchAPI(`/combat-missions${queryParam}`);
}

/**
 * Get available combat missions (not assigned)
 */
export async function getAvailableCombatMissions() {
  return fetchAPI('/combat-missions/available');
}

/**
 * Assign a combat mission to a pilot
 */
export async function assignCombatMission(missionId, pilotName, aircraft) {
  return fetchAPI(`/combat-missions/${missionId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ pilotName, aircraft }),
  });
}

/**
 * Complete a combat mission
 */
export async function completeCombatMission(missionId) {
  return fetchAPI(`/combat-missions/${missionId}/complete`, {
    method: 'POST',
  });
}

/**
 * Abort a combat mission
 */
export async function abortCombatMission(missionId) {
  return fetchAPI(`/combat-missions/${missionId}/abort`, {
    method: 'POST',
  });
}

/**
 * Refresh combat missions from zones
 */
export async function refreshCombatMissions() {
  return fetchAPI('/combat-missions/refresh', {
    method: 'POST',
  });
}

/**
 * Clear all combat missions
 */
export async function clearCombatMissions() {
  return fetchAPI('/combat-missions/clear', {
    method: 'POST',
  });
}

/**
 * Get missions for a specific pilot
 */
export async function getPilotCombatMissions(pilotName) {
  return fetchAPI(`/combat-missions/pilot/${encodeURIComponent(pilotName)}`);
}

/**
 * Get frontline zones
 */
export async function getFrontlineZones() {
  return fetchAPI('/frontline-zones');
}

/**
 * Get shared activity feed
 */
export async function getFeed(limit = 200) {
  return fetchAPI(`/feed?limit=${limit}`);
}

/**
 * Get convoys state
 */
export async function getConvoys(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchAPI(`/convoys${query}`);
}

/**
 * Get DCSAR exported points
 */
export async function getDcsar() {
  return fetchAPI('/dcsar');
}

/**
 * Accept a DCSAR rescue task
 */
export async function acceptDcsarTask(taskId, userId) {
  return fetchAPI(`/dcsar/${encodeURIComponent(taskId)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Complete a DCSAR rescue task
 */
export async function completeDcsarTask(taskId, userId) {
  return fetchAPI(`/dcsar/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Cancel a DCSAR rescue task
 */
export async function cancelDcsarTask(taskId, userId) {
  return fetchAPI(`/dcsar/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Post convoy event (external integration/testing)
 */
export async function postConvoyEvent(eventPayload, convoyToken = null) {
  const headers = convoyToken ? { 'x-convoy-token': convoyToken } : undefined;
  return fetchAPI('/convoys/events', {
    method: 'POST',
    headers,
    body: JSON.stringify(eventPayload),
  });
}

/**
 * Add user to an assigned combat mission
 */
export async function addUserToCombatMission(missionId, pilotName, aircraft) {
  return fetchAPI(`/combat-missions/${missionId}/add-user`, {
    method: 'POST',
    body: JSON.stringify({ pilotName, aircraft })
  });
}

/**
 * Get mock users for testing
 */
export async function getMockUsers() {
  return fetchAPI('/mock-users');
}

/**
 * Get logged-in users (real users from Discord OAuth)
 */
export async function getLoggedInUsers() {
  return fetchAPI('/logged-in-users');
}

/**
 * Get current user's profile
 */
export async function getUserProfile() {
  return fetchAPI('/profile', {
    credentials: 'include',
  });
}

/**
 * Save current user's profile
 */
export async function saveUserProfile(profile) {
  return fetchAPI('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
    credentials: 'include',
  });
}

export default {
  getAirports,
  getAirport,
  getAirportHistory,
  getWeaponHistory,
  getMissions,
  getAirportMissions,
  acceptMission,
  completeMission,
  cancelMission,
  createOrder,
  getStats,
  debugGenerateOrders,
  debugClearOrders,
  getCombatMissions,
  getAvailableCombatMissions,
  assignCombatMission,
  completeCombatMission,
  abortCombatMission,
  refreshCombatMissions,
  clearCombatMissions,
  getPilotCombatMissions,
  getFrontlineZones,
  getFeed,
  getConvoys,
  getDcsar,
  acceptDcsarTask,
  completeDcsarTask,
  cancelDcsarTask,
  postConvoyEvent,
  getUserProfile,
  saveUserProfile,
};
