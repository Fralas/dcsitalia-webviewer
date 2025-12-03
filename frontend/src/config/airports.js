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
  },
  {
    id: 'incirlik',
    name: 'Incirlik',
    displayName: 'Incirlik Air Base',
    isMainBase: false,
  },
  {
    id: 'farp-base',
    name: 'FARP_BASE',
    displayName: 'FARP Base',
    isMainBase: false,
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
