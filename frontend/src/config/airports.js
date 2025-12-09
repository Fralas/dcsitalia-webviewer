/**
 * Airport Configuration (Frontend)
 * Mirrors backend configuration for UI display
 *
 * isHeliport: true if this is a heliport/FARP (only helicopters can land)
 * herculesBase: true if C-130 Hercules can spawn/operate from this base
 */

const airports = [
  // ==== MAIN BASE (Turkey) ====
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true, // Main base with infinite supplies
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 36.982222, lon: 35.281111 }, // 36°58'55"N, 35°16'52"E
  },

  // ==== TURKEY AIRPORTS ====
  {
    id: 'incirlik',
    name: 'Incirlik',
    displayName: 'Incirlik Air Base',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 37.000000, lon: 35.425833 }, // 37°00'00"N, 35°25'33"E
  },
  {
    id: 'gaziantep',
    name: 'Gaziantep',
    displayName: 'Gaziantep',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 36.947222, lon: 37.471389 }, // 36°56'50"N, 37°28'17"E
  },
  {
    id: 'hatay',
    name: 'Hatay',
    displayName: 'Hatay',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    coordinates: { lat: 36.362778, lon: 36.282222 }, // 36°21'46"N, 36°16'56"E
  },
  {
    id: 'sanliurfa',
    name: 'Sanliurfa',
    displayName: 'Sanliurfa',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 37.441111, lon: 38.902778 }, // 37°26'28"N, 38°54'10"E
  },

  // ==== SYRIA AIRPORTS ====
  {
    id: 'aleppo',
    name: 'Aleppo',
    displayName: 'Aleppo International',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 36.180833, lon: 37.224444 }, // 36°10'51"N, 37°13'28"E
  },
  {
    id: 'bassel-al-assad',
    name: 'Bassel Al-Assad',
    displayName: 'Bassel Al-Assad (Latakia)',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    coordinates: { lat: 35.401111, lon: 35.948611 }, // 35°24'04"N, 35°56'55"E
  },
  {
    id: 'abu-al-duhur',
    name: 'Abu al-Duhur',
    displayName: 'Abu al-Duhur',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    coordinates: { lat: 35.732500, lon: 37.103056 }, // 35°43'57"N, 37°06'11"E
  },
  {
    id: 'jirah',
    name: 'Jirah',
    displayName: 'Jirah',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    coordinates: { lat: 36.098333, lon: 37.935278 }, // 36°05'54"N, 37°56'07"E
  },
  {
    id: 'kuweires',
    name: 'Kuweires',
    displayName: 'Kuweires',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    coordinates: { lat: 36.181944, lon: 37.576667 }, // 36°10'55"N, 37°34'36"E
  },
  {
    id: 'minakh',
    name: 'Minakh',
    displayName: 'Minakh',
    isMainBase: false,
    isHeliport: true,
    herculesBase: false,
    coordinates: { lat: 36.520000, lon: 37.039444 }, // 36°31'12"N, 37°02'22"E
  },
  {
    id: 'tabqa',
    name: 'Tabqa',
    displayName: 'Tabqa',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    coordinates: { lat: 35.756389, lon: 38.566111 }, // 35°45'23"N, 38°33'58"E
  },
  {
    id: 'taftanaz',
    name: 'Taftanaz',
    displayName: 'Taftanaz',
    isMainBase: false,
    isHeliport: true, // Heliport
    herculesBase: false,
    coordinates: { lat: 35.972500, lon: 36.783333 }, // 35°58'21"N, 36°47'00"E
  },
  {
    id: 'kharab-ishk',
    name: 'Kharab Ishk',
    displayName: 'Kharab Ishk',
    isMainBase: false,
    isHeliport: true,
    herculesBase: false,
    coordinates: { lat: 36.544722, lon: 38.587222 }, // 36°32'41"N, 38°35'14"E
  },
  {
    id: 'tal-siman',
    name: 'Tal Siman',
    displayName: 'Tal Siman',
    isMainBase: false,
    isHeliport: true,
    herculesBase: false,
    coordinates: { lat: 36.260278, lon: 38.929444 }, // 36°15'37"N, 38°55'46"E
  },

  // ==== FARP ====
  {
    id: 'farp-base',
    name: 'FARP_BASE',
    displayName: 'FARP Base',
    isMainBase: false,
    isHeliport: true, // FARP is heliport only
    herculesBase: false,
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
 * Get airport name by ID
 */
export function getAirportName(id) {
  const airport = getAirportById(id);
  return airport ? airport.displayName || airport.name : id;
}

export default airports;
