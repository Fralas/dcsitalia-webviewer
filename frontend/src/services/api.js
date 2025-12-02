const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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
 * Get overall statistics
 */
export async function getStats() {
  return fetchAPI('/stats');
}

export default {
  getAirports,
  getAirport,
  getAirportHistory,
  getMissions,
  getAirportMissions,
  acceptMission,
  completeMission,
  cancelMission,
  getStats,
};
