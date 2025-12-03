/**
 * Airport Configuration
 * Add new airports here to make them visible in the system
 *
 * Coordinates are in decimal degrees (converted from DMS)
 * Distances calculated using Euclidean distance in Nautical Miles
 */
export const airports = [
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true, // Main base with infinite supplies
    csvPrefix: 'Adana Sakirpasa', // Prefix used in CSV filenames
    coordinates: { lat: 36.982222, lon: 35.281111 }, // 36°58'55"N, 35°16'52"E
  },
  {
    id: 'incirlik',
    name: 'Incirlik',
    displayName: 'Incirlik Air Base',
    isMainBase: false,
    csvPrefix: 'Incirlik',
    coordinates: { lat: 37.000000, lon: 35.425833 }, // 37°00'00"N, 35°25'33"E
  },
  {
    id: 'farp-base',
    name: 'FARP_BASE',
    displayName: 'FARP Base',
    isMainBase: false,
    csvPrefix: 'FARP_BASE',
    coordinates: { lat: 37.066944, lon: 35.974722 }, // 37°04'01"N, 35°58'29"E
  },
];

/**
 * Get airport by ID
 */
export function getAirportById(id) {
  return airports.find(airport => airport.id === id);
}

/**
 * Get main base airport
 */
export function getMainBase() {
  return airports.find(airport => airport.isMainBase);
}

export default airports;
