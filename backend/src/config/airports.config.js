/**
 * Airport Configuration
 * Add new airports here to make them visible in the system
 *
 * Coordinates are in decimal degrees (converted from DMS)
 * Tool to convert DMS to decimal: https://www.latlong.net/lat-long-dms.html
 * Distances calculated using Euclidean distance in Nautical Miles
 *
 * isHeliport: true if this is a heliport/FOB (only helicopters can land)
 * isCarrier: true if this is a carrier (naval aviation base)
 * herculesBase: true if C-130 Hercules can spawn/operate from this base
 *
 */
export const airports = [
  // ==== MAIN BASE (Turkey) ====
  {
    id: 'adana-sakirpasa',
    name: 'Adana Sakirpasa',
    displayName: 'Adana Sakirpasa',
    isMainBase: true, // Main base with infinite supplies
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Adana Sakirpasa',
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
    csvPrefix: 'Incirlik',
    coordinates: { lat: 37.000000, lon: 35.425833 }, // 37°00'00"N, 35°25'33"E
  },
  {
    id: 'gaziantep',
    name: 'Gaziantep',
    displayName: 'Gaziantep',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Gaziantep',
    coordinates: { lat: 36.947222, lon: 37.471389 }, // 36°56'50"N, 37°28'17"E
  },
  {
    id: 'hatay',
    name: 'Hatay',
    displayName: 'Hatay',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Hatay',
    coordinates: { lat: 36.362778, lon: 36.282222 }, // 36°21'46"N, 36°16'56"E
  },
  {
    id: 'sanliurfa',
    name: 'Sanliurfa',
    displayName: 'Sanliurfa',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Sanliurfa',
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
    csvPrefix: 'Aleppo',
    coordinates: { lat: 36.180833, lon: 37.224444 }, // 36°10'51"N, 37°13'28"E
  },
  {
    id: 'bassel-al-assad',
    name: 'Bassel Al-Assad',
    displayName: 'Bassel Al-Assad (Latakia)',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Bassel Al-Assad',
    coordinates: { lat: 35.401111, lon: 35.948611 }, // 35°24'04"N, 35°56'55"E
  },
  {
    id: 'abu-al-duhur',
    name: 'Abu al-Duhur',
    displayName: 'Abu al-Duhur',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Abu al-Duhur',
    coordinates: { lat: 35.732500, lon: 37.103056 }, // 35°43'57"N, 37°06'11"E
  },
  {
    id: 'jirah',
    name: 'Jirah',
    displayName: 'Jirah',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Jirah',
    coordinates: { lat: 36.098333, lon: 37.935278 }, // 36°05'54"N, 37°56'07"E
  },
  {
    id: 'kuweires',
    name: 'Kuweires',
    displayName: 'Kuweires',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Kuweires',
    coordinates: { lat: 36.181944, lon: 37.576667 }, // 36°10'55"N, 37°34'36"E
  },
  {
    id: 'minakh',
    name: 'Minakh',
    displayName: 'Minakh',
    isMainBase: false,
    isHeliport: true,
    herculesBase: false,
    csvPrefix: 'Minakh',
    coordinates: { lat: 36.520000, lon: 37.039444 }, // 36°31'12"N, 37°02'22"E
  },
  {
    id: 'tabqa',
    name: 'Tabqa',
    displayName: 'Tabqa',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Tabqa',
    coordinates: { lat: 35.756389, lon: 38.566111 }, // 35°45'23"N, 38°33'58"E
  },
  {
    id: 'taftanaz',
    name: 'Taftanaz',
    displayName: 'Taftanaz',
    isMainBase: false,
    isHeliport: true, // Heliport
    herculesBase: false,
    csvPrefix: 'Taftanaz',
    coordinates: { lat: 35.972500, lon: 36.783333 }, // 35°58'21"N, 36°47'00"E
  },
  {
    id: 'kharab-ishk',
    name: 'Kharab Ishk',
    displayName: 'Kharab Ishk',
    isMainBase: false,
    isHeliport: true,
    herculesBase: false,
    csvPrefix: 'Kharab Ishk',
    coordinates: { lat: 36.544722, lon: 38.587222 }, // 36°32'41"N, 38°35'14"E
  },
  {
    id: 'tal-siman',
    name: 'Tal Siman',
    displayName: 'Tal Siman',
    isMainBase: false,
    isHeliport: true,
    herculesBase: false,
    csvPrefix: 'Tal Siman',
    coordinates: { lat: 36.260278, lon: 38.929444 }, // 36°15'37"N, 38°55'46"E
  },

  // ==== CYPRUS AIRPORTS ====
  {
    id: 'paphos',
    name: 'Paphos',
    displayName: 'Paphos',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Paphos',
    coordinates: { lat: 34.718333, lon: 32.484167 }, // 34°43'06"N, 32°29'03"E
  },
  {
    id: 'akrotiri',
    name: 'Akrotiri',
    displayName: 'Akrotiri',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Akrotiri',
    coordinates: { lat: 34.590278, lon: 32.988056 }, // 34°35'25"N, 32°59'17"E
  },
  {
    id: 'pinarbashi',
    name: 'Pinarbashi',
    displayName: 'Pinarbashi',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Pinarbashi',
    coordinates: { lat: 35.274444, lon: 33.267778 }, // 35°16'28"N, 33°16'04"E
  },
  {
    id: 'lakatamia',
    name: 'Lakatamia',
    displayName: 'Lakatamia',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Lakatamia',
    coordinates: { lat: 35.104444, lon: 33.321667 }, // 35°06'16"N, 33°19'18"E
  },
  {
    id: 'ercan',
    name: 'Ercan',
    displayName: 'Ercan',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Ercan',
    coordinates: { lat: 35.155000, lon: 33.502222 }, // 35°09'18"N, 33°30'08"E
  },
  {
    id: 'larnaca',
    name: 'Larnaca',
    displayName: 'Larnaca',
    isMainBase: false,
    isHeliport: false,
    herculesBase: true,
    csvPrefix: 'Larnaca',
    coordinates: { lat: 34.873611, lon: 33.623611 }, // 34°52'25"N, 33°37'25"E
  },
  {
    id: 'kingsfield',
    name: 'Kingsfield',
    displayName: 'Kingsfield',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Kingsfield',
    coordinates: { lat: 35.014722, lon: 33.717222 }, // 35°00'53"N, 33°43'02"E
  },
  {
    id: 'gecitkale',
    name: 'Gecitkale',
    displayName: 'Gecitkale',
    isMainBase: false,
    isHeliport: false,
    herculesBase: false,
    csvPrefix: 'Gecitkale',
    coordinates: { lat: 35.235833, lon: 33.719444 }, // 35°14'09"N, 33°43'10"E
  },

  // ==== FOB ====
  {
    id: 'fob-base',
    name: 'FOB_BASE',
    displayName: 'FOB Base',
    isMainBase: false,
    isHeliport: true, // FOB is heliport only
    herculesBase: false,
    csvPrefix: 'FOB_BASE',
    coordinates: { lat: 37.066944, lon: 35.974722 }, // 37°04'01"N, 35°58'29"E
  },

  // ==== CARRIERS ====
  {
    id: 'carrier-1',
    name: 'carrier_group',
    displayName: 'Carrier Group',
    isMainBase: false,
    isHeliport: false,
    isCarrier: true, // This is a carrier
    herculesBase: false,
    csvPrefix: 'CARRIER',
    coordinates: { lat: 36.4475, lon: 34.6219 }, // 36°26'51"N, 34°37'19"E
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
