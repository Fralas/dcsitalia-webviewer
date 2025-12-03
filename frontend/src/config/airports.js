/**
 * Airport Configuration (Frontend)
 * Mirrors backend configuration for UI display
 */

const airports = [
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true,
    coordinates: {
      lat: 36.982222,
      lon: 35.281111,
    },
  },
  {
    id: 'incirlik',
    name: 'Incirlik',
    displayName: 'Incirlik Air Base',
    isMainBase: false,
    coordinates: {
      lat: 37.000000,
      lon: 35.425833,
    },
  },
  {
    id: 'farp-base',
    name: 'FARP_BASE',
    displayName: 'FARP Base',
    isMainBase: false,
    coordinates: {
      lat: 37.066944,
      lon: 35.974722,
    },
  },
];

/**
 * Get airport by ID
 */
export function getAirportById(id) {
  return airports.find(airport => airport.id === id);
}

/**
 * Get airport display name by ID
 */
export function getAirportName(id) {
  const airport = getAirportById(id);
  return airport ? airport.displayName : id;
}

export default airports;
