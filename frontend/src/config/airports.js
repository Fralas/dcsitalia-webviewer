/**
 * Airport Configuration (Frontend)
 * Mirrors backend configuration for UI display
 *
 * isHeliport: true if this is a heliport/FOB (only helicopters can land)
 * isCarrier: true if this is a carrier (naval aviation base)
 * herculesBase: true if C-130 Hercules can spawn/operate from this base
 */

const airports = [
  // ==== MAIN BASE ====
  {
    id: 'aleppo',
    name: 'Aleppo',
    displayName: 'Aleppo International',
    isMainBase: true,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 36.180833, lon: 37.224444 },
  },

  // ==== THEATER AIRPORTS ====
  {
    id: 'hama',
    name: 'Hama',
    displayName: 'Hama',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 35.122655, lon: 36.722176 },
  },
  {
    id: 'deir-ez-zor',
    name: 'Deir ez Zor',
    displayName: 'Deir ez Zor',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 35.295367, lon: 40.173177 },
  },
  {
    id: 'rene-mouawad',
    name: 'Rene Mouawad',
    displayName: 'Rene Mouawad',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 34.58933, lon: 36.022315 },
  },
  {
    id: 'al-qusayr',
    name: 'Al Qusayr',
    displayName: 'Al Qusayr',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 34.568682, lon: 36.563393 },
  },
  {
    id: 'tiyas',
    name: 'Tiyas',
    displayName: 'Tiyas',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 34.527303, lon: 37.633076 },
  },
  {
    id: 'palmyra',
    name: 'Palmyra',
    displayName: 'Palmyra',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 34.563906, lon: 38.307199 },
  },
  {
    id: 'shayrat',
    name: 'Shayrat',
    displayName: 'Shayrat',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 34.492867, lon: 36.914471 },
  },
  {
    id: 'wujah-al-hajar',
    name: 'Wujah Al Hajar',
    displayName: 'Wujah Al Hajar',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 34.275138, lon: 35.69009 },
  },
  {
    id: 'an-nasiriyah',
    name: 'An Nasiriyah',
    displayName: 'An Nasiriyah',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.920519, lon: 36.868019 },
  },
  {
    id: 'sayqal',
    name: 'Sayqal',
    displayName: 'Sayqal',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.68075, lon: 37.218562 },
  },
  {
    id: 'at-tanf',
    name: 'At Tanf',
    displayName: 'At Tanf',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.506082, lon: 38.624984 },
  },
  {
    id: 'beirut-rafic-hariri',
    name: 'Beirut Rafic Hariri',
    displayName: 'Beirut Rafic Hariri',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.850118, lon: 35.530245 },
  },
  {
    id: 'rayak',
    name: 'Rayak',
    displayName: 'Rayak',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.851178, lon: 35.988426 },
  },
  {
    id: 'al-dumayr',
    name: 'Al Dumayr',
    displayName: 'Al Dumayr',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.610432, lon: 36.749977 },
  },
  {
    id: 'mezzeh',
    name: 'Mezzeh',
    displayName: 'Mezzeh',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.475672, lon: 36.307527 },
  },
  {
    id: 'damascus',
    name: 'Damascus',
    displayName: 'Damascus',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.465747, lon: 36.503406 },
  },
  {
    id: 'h4',
    name: 'H4',
    displayName: 'H4',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.541691, lon: 38.194947 },
  },
  {
    id: 'kiryat-shmona',
    name: 'Kiryat Shmona',
    displayName: 'Kiryat Shmona',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.213373, lon: 35.589903 },
  },
  {
    id: 'marj-ruhayyil',
    name: 'Marj Ruhayyil',
    displayName: 'Marj Ruhayyil',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.288127, lon: 36.45162 },
  },
  {
    id: 'khalkhalah',
    name: 'Khalkhalah',
    displayName: 'Khalkhalah',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 33.076368, lon: 36.540003 },
  },
  {
    id: 'rosh-pina',
    name: 'Rosh Pina',
    displayName: 'Rosh Pina',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.976718, lon: 35.553508 },
  },
  {
    id: 'tha-lah',
    name: 'Tha lah',
    displayName: 'Tha lah',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.706404, lon: 36.403529 },
  },
  {
    id: 'prince-hassan',
    name: 'Prince Hassan',
    displayName: 'Prince Hassan',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.165943, lon: 37.141848 },
  },
  {
    id: 'ramat-david',
    name: 'Ramat David',
    displayName: 'Ramat David',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.641654, lon: 35.209638 },
  },
  {
    id: 'king-hussein-air-college',
    name: 'King Hussein Air College',
    displayName: 'King Hussein Air College',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.352417, lon: 36.257367 },
  },
  {
    id: 'muwaffaq-salti',
    name: 'Muwaffaq Salti',
    displayName: 'Muwaffaq Salti',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 31.824266, lon: 36.797421 },
  },
  {
    id: 'eyn-shemer',
    name: 'Eyn Shemer',
    displayName: 'Eyn Shemer',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 32.453983, lon: 34.999371 },
  },
  {
    id: 'marka',
    name: 'Marka',
    displayName: 'Marka',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 31.969996, lon: 35.950959 },
  },

  // ==== CARRIERS ====
  {
    id: 'carrier-1',
    name: 'carrier_group',
    displayName: 'Carrier Group',
    isMainBase: false,
    isHeliport: false,
    isCarrier: true,
    herculesBase: false,
    coordinates: { lat: 36.4475, lon: 34.6219 },
  },
];

/**
 * Get airport by ID
 */
export function getAirportById(id) {
  return airports.find(airport => airport.id === id);
}

/**
 * Get airport name by ID
 */
export function getAirportName(id) {
  const airport = getAirportById(id);
  return airport ? airport.displayName || airport.name : id;
}

export default airports;
