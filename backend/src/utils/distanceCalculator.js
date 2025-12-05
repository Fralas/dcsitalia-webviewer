/**
 * Distance Calculator Utility
 * Calculates Euclidean distance between airports in Nautical Miles
 *
 * Note: Uses simple Euclidean distance formula for short distances (<170nm)
 * 1 degree ≈ 60 nautical miles
 */

/**
 * Calculate Euclidean distance between two points in Nautical Miles
 *
 * @param {Object} coord1 - First coordinate {lat, lon} in decimal degrees
 * @param {Object} coord2 - Second coordinate {lat, lon} in decimal degrees
 * @returns {number} Distance in Nautical Miles (nm)
 */
export function calculateDistance(coord1, coord2) {
  const latDiff = coord2.lat - coord1.lat;
  const lonDiff = coord2.lon - coord1.lon;

  // Euclidean distance in degrees
  const distanceDegrees = Math.sqrt(latDiff ** 2 + lonDiff ** 2);

  // Convert to nautical miles (1 degree ≈ 60 nm)
  const distanceNm = distanceDegrees * 60;

  return Math.round(distanceNm * 10) / 10; // Round to 1 decimal place
}

/**
 * Calculate distances from one airport to multiple airports
 *
 * @param {Object} sourceCoord - Source coordinate {lat, lon}
 * @param {Array} airports - Array of airport objects with coordinates
 * @returns {Array} Array of {airportId, distance} sorted by distance (ascending)
 */
export function calculateDistancesToAirports(sourceCoord, airports) {
  const distances = airports.map(airport => ({
    airport,
    distance: calculateDistance(sourceCoord, airport.coordinates),
  }));

  // Sort by distance (closest first)
  return distances.sort((a, b) => a.distance - b.distance);
}

/**
 * Find the best donor airport based on distance and quantity
 *
 * @param {Object} params - Parameters object
 * @param {Array} params.potentialDonors - Array of {airport, quantity, distance}
 * @param {Object} params.mainBase - Main base airport object
 * @param {number} params.mainBaseDistance - Distance from main base to recipient
 * @param {number} params.distanceThreshold - Distance threshold in nm
 * @returns {Object|null} Best donor {airport, quantity, distance} or null for main base
 */
export function findBestDonor({ potentialDonors, mainBase, mainBaseDistance, distanceThreshold }) {
  if (!potentialDonors || potentialDonors.length === 0) {
    return null; // Use main base
  }

  // Sort by distance first
  const sortedDonors = [...potentialDonors].sort((a, b) => a.distance - b.distance);

  // Get closest donor
  const closestDonor = sortedDonors[0];

  // Check distance threshold: if difference < threshold, use main base
  const distanceDifference = mainBaseDistance - closestDonor.distance;
  if (distanceDifference < distanceThreshold) {
    return null; // Main base is similar distance, prefer it
  }

  // Return closest donor (already accounts for quantity > 0 in potential donors list)
  return closestDonor;
}

export default {
  calculateDistance,
  calculateDistancesToAirports,
  findBestDonor,
};
