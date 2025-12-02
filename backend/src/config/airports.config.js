/**
 * Airport Configuration
 * Add new airports here to make them visible in the system
 */
export const airports = [
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true, // Main base with infinite supplies
    csvPrefix: 'Adana Sakirpasa', // Prefix used in CSV filenames
    coordinates: { lat: 37.0, lon: 35.4 }, // Optional: for future map view
  },
  // Add more airports following this structure:
  // {
  //   id: 'incirlik',
  //   name: 'Incirlik',
  //   displayName: 'Incirlik Air Base',
  //   isMainBase: false,
  //   csvPrefix: 'Incirlik',
  //   coordinates: { lat: 37.0, lon: 35.4 },
  // },
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
