/**
 * Fake map markers for the hidden marker debug panel (?hidcDebug=1).
 * Purely client-side: the items are merged into the map render data on this page only,
 * to check how each marker type looks. Nothing is sent to the backend or DCS.
 * Every fake id starts with DEBUG_ so it is easy to spot.
 */

export const DEBUG_MARKER_TYPES = [
  { id: 'dcsar_pending', group: 'CSAR', label: 'CSAR in attesa' },
  { id: 'dcsar_accepted', group: 'CSAR', label: 'CSAR accettato' },
  { id: 'farp_blue', group: 'Basi', label: 'FARP / heliport BLUE' },
  { id: 'farp_red', group: 'Basi', label: 'FARP / heliport RED' },
  { id: 'airport_blue', group: 'Basi', label: 'Aeroporto BLUE' },
  { id: 'airport_red', group: 'Basi', label: 'Aeroporto RED' },
  { id: 'airport_main', group: 'Basi', label: 'Base principale BLUE' },
  { id: 'dbuild_draft', group: 'DBUILD', label: 'Cantiere bozza' },
  { id: 'dbuild_active', group: 'DBUILD', label: 'Cantiere attivo' },
  { id: 'dbuild_built', group: 'DBUILD', label: 'Struttura costruita' },
  { id: 'crate_single', group: 'Casse', label: 'Cassa singola' },
  { id: 'crate_cluster', group: 'Casse', label: 'Gruppo di casse' },
  { id: 'pp_blue', group: 'Production Point', label: 'PP BLUE costruito' },
  { id: 'pp_red', group: 'Production Point', label: 'PP RED' },
  { id: 'pp_neutral', group: 'Production Point', label: 'PP neutrale' },
  { id: 'pp_upgrading', group: 'Production Point', label: 'PP in upgrade' },
  { id: 'ship_blue', group: 'Navi', label: 'Nave alleata' },
  { id: 'ship_carrier', group: 'Navi', label: 'Portaerei alleata' },
  { id: 'ship_helicarrier', group: 'Navi', label: 'Portaelicotteri alleata' },
  { id: 'ship_red', group: 'Navi', label: 'Nave nemica' },
  { id: 'ship_civilian', group: 'Navi', label: 'Nave civile' },
  { id: 'ship_boarded', group: 'Navi', label: 'Nave abbordata' },
  { id: 'convoy', group: 'Movimenti', label: 'Convoglio RED' },
  { id: 'airlift_c130', group: 'Movimenti', label: 'Airlift C-130' },
  { id: 'airlift_ch47', group: 'Movimenti', label: 'Airlift CH-47' },
  { id: 'airlift_mi8', group: 'Movimenti', label: 'Airlift Mi-8' },
  { id: 'airlift_uh1', group: 'Movimenti', label: 'Airlift UH-1' },
  { id: 'airlift_site', group: 'Movimenti', label: 'Sito recupero airlift' },
  { id: 'tanker', group: 'Movimenti', label: 'Rotta tanker' },
];

export const DEBUG_MARKER_GROUPS = [...new Set(DEBUG_MARKER_TYPES.map((type) => type.group))];

// Each type gets its own slot on a grid around the anchor (km east, km north), so nothing overlaps.
const SLOT_KM = {
  dcsar_pending: [-24, 18],
  dcsar_accepted: [-16, 18],
  farp_blue: [-8, 18],
  farp_red: [0, 18],
  airport_blue: [8, 18],
  airport_red: [16, 18],
  airport_main: [24, 18],
  dbuild_draft: [-24, 9],
  dbuild_active: [-16, 9],
  dbuild_built: [-8, 9],
  crate_single: [0, 9],
  crate_cluster: [8, 9],
  pp_blue: [-24, 0],
  pp_red: [-16, 0],
  pp_neutral: [-8, 0],
  pp_upgrading: [0, 0],
  ship_blue: [-24, -9],
  ship_carrier: [-16, -9],
  ship_helicarrier: [-8, -9],
  ship_red: [0, -9],
  ship_civilian: [8, -9],
  ship_boarded: [16, -9],
  convoy: [-24, -18],
  airlift_c130: [-12, -18],
  airlift_ch47: [-6, -18],
  airlift_mi8: [0, -18],
  airlift_uh1: [6, -18],
  airlift_site: [14, -18],
  tanker: [-24, -27],
};

function offset(anchor, eastKm, northKm) {
  const lat = anchor.lat + (northKm / 111.32);
  const lon = anchor.lon + (eastKm / (111.32 * Math.cos((anchor.lat * Math.PI) / 180)));
  return { lat, lon };
}

function bearingDeg(from, to) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const dLon = toRad(to.lon - from.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = (Math.cos(lat1) * Math.sin(lat2)) - (Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function emptyDebugMarkers() {
  return {
    dcsarPoints: [],
    airports: [],
    dbuildMarkers: [],
    crateClusters: [],
    productionPoints: [],
    ships: [],
    convoys: [],
    airliftPlayers: [],
    airliftSites: [],
    tankerRoutes: [],
  };
}

/**
 * @param {Set<string>} enabled  ids from DEBUG_MARKER_TYPES
 * @param {{lat:number, lon:number}|null} anchor
 */
export function buildDebugMarkers(enabled, anchor) {
  const out = emptyDebugMarkers();
  if (!anchor || !Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon) || !enabled || enabled.size === 0) {
    return out;
  }
  // Grid compressed so the whole set fits the view the "Centra" button flies to.
  const SCALE = 0.4;
  const at = (id, dx = 0, dy = 0) => {
    const [east, north] = SLOT_KM[id] || [0, 0];
    return offset(anchor, (east + dx) * SCALE, (north + dy) * SCALE);
  };
  const on = (id) => enabled.has(id);
  const now = Date.now();

  // CSAR
  if (on('dcsar_pending')) {
    out.dcsarPoints.push({ id: 'DEBUG_CSAR_PENDING', ...at('dcsar_pending'), status: 'pending', accepted: false, accepted_by: null, nearest_airbase: null, nearest_distance_nm: null });
  }
  if (on('dcsar_accepted')) {
    out.dcsarPoints.push({ id: 'DEBUG_CSAR_ACCEPTED', ...at('dcsar_accepted'), status: 'accepted', accepted: true, accepted_by: 'DEBUG', nearest_airbase: null, nearest_distance_nm: null });
  }

  // Airports / FARP (merged into the map airport list only)
  const airport = (id, name, coalition, isHeliport, isMainBase = false) => {
    const coordinates = at(id);
    out.airports.push({
      id: `DEBUG_${id.toUpperCase()}`,
      name,
      displayName: name,
      coordinates,
      coalition,
      isHeliport,
      isCarrier: false,
      isMainBase,
      isActive: true,
      isAlwaysActive: true,
      zoneNumber: '',
    });
  };
  if (on('farp_blue')) airport('farp_blue', 'DEBUG FARP BLUE', 'blue', true);
  if (on('farp_red')) airport('farp_red', 'DEBUG FARP RED', 'red', true);
  if (on('airport_blue')) airport('airport_blue', 'DEBUG Airbase BLUE', 'blue', false);
  if (on('airport_red')) airport('airport_red', 'DEBUG Airbase RED', 'red', false);
  if (on('airport_main')) airport('airport_main', 'DEBUG Main Base', 'blue', false, true);

  // DBUILD (already in marker form: not selectable, so no placement calls)
  const dbuild = (id, kind, status, label) => {
    out.dbuildMarkers.push({ id: `DEBUG_${id}`, ...at(id), kind, label, status, placementId: null, selectable: false, structureName: label });
  };
  if (on('dbuild_draft')) dbuild('dbuild_draft', 'hammer-white', 'draft', 'FARP DBUILD');
  if (on('dbuild_active')) dbuild('dbuild_active', 'hammer-green', 'active', 'NASAMS DBUILD');
  if (on('dbuild_built')) dbuild('dbuild_built', 'rook-blue', 'built', 'EWR DBUILD');

  // Crates (already in cluster form)
  if (on('crate_single')) {
    out.crateClusters.push({ id: 'DEBUG_CRATE_SINGLE', ...at('crate_single'), count: 1, kind: 'box', types: { AMMO: 1 } });
  }
  if (on('crate_cluster')) {
    out.crateClusters.push({ id: 'DEBUG_CRATE_CLUSTER', ...at('crate_cluster'), count: 6, kind: 'boxes', types: { BUILD: 3, FUEL: 2, AMMO: 1 } });
  }

  // Production points
  const pp = (id, num, owner, built, level, upgrading) => {
    const coordinates = at(id);
    out.productionPoints.push({
      id: `PP_${num}`,
      zone_name: `PP_${num}`,
      owner,
      built,
      level,
      upgrading,
      stock: built ? 4 : 0,
      lat: coordinates.lat,
      lon: coordinates.lon,
      coordinates,
      debug: true,
    });
  };
  if (on('pp_blue')) pp('pp_blue', '991', 'BLUE', true, 2, false);
  if (on('pp_red')) pp('pp_red', '992', 'RED', true, 1, false);
  if (on('pp_neutral')) pp('pp_neutral', '993', 'NEUTRAL', false, 0, false);
  if (on('pp_upgrading')) pp('pp_upgrading', '994', 'BLUE', true, 1, true);

  // Ships
  const ship = (id, group, kind, extra = {}) => {
    out.ships.push({ id: `DEBUG_${id.toUpperCase()}`, group, kind, heading: 45, ...at(id), ...extra });
  };
  if (on('ship_blue')) ship('ship_blue', 'DEBUG_BLUE_FRIGATE', 'blue', { class: 'ship' });
  if (on('ship_carrier')) ship('ship_carrier', 'DEBUG_CVN_CARRIER', 'blue', { class: 'carrier' });
  if (on('ship_helicarrier')) ship('ship_helicarrier', 'DEBUG_LHA_TARAWA', 'blue', { class: 'helicarrier' });
  if (on('ship_red')) ship('ship_red', 'DEBUG_RED_CORVETTE', 'red', { class: 'ship' });
  if (on('ship_civilian')) ship('ship_civilian', 'DEBUG_CIVSHIP', 'civilian');
  if (on('ship_boarded')) ship('ship_boarded', 'DEBUG_BOARDED', 'red', { status: 'boarded', boarded: true });

  // Convoy (render form: [lat, lon] points)
  if (on('convoy')) {
    const origin = at('convoy', -3, 0);
    const destination = at('convoy', 7, 0);
    const moving = at('convoy', 2, 0);
    out.convoys.push({
      convoy_id: 'DEBUG_CONVOY',
      status: 'active',
      routeLine: [[origin.lat, origin.lon], [destination.lat, destination.lon]],
      bearing: bearingDeg(moving, destination),
      movingPosition: [moving.lat, moving.lon],
      lastPosition: [moving.lat, moving.lon],
      lastUpdateTs: now,
    });
  }

  // Airlift players (render form)
  const airlift = (id, airframe, altM, heading) => {
    out.airliftPlayers.push({
      id: `DEBUG_${id.toUpperCase()}`,
      name: `DEBUG ${airframe}`,
      unit_name: `DEBUG_${airframe}`,
      group_name: `DEBUG_${airframe}`,
      coalition: 'blue',
      airframe,
      type_name: airframe,
      alt_m: altM,
      heading_deg: heading,
      ...at(id),
    });
  };
  if (on('airlift_c130')) airlift('airlift_c130', 'C-130J-30', 3000, 90);
  if (on('airlift_ch47')) airlift('airlift_ch47', 'CH-47Fbl1', 600, 135);
  if (on('airlift_mi8')) airlift('airlift_mi8', 'Mi-8MT', 400, 180);
  if (on('airlift_uh1')) airlift('airlift_uh1', 'UH-1H', 300, 270);

  if (on('airlift_site')) {
    const site = at('airlift_site');
    out.airliftSites.push({
      id: 'DEBUG_AIRLIFT_SITE',
      lat: site.lat,
      lon: site.lon,
      cratesLeft: 3,
      units: 2,
      from: 'DEBUG A',
      to: 'DEBUG B',
      crates: [at('airlift_site', 0.4, 0.2), at('airlift_site', -0.3, 0.3), at('airlift_site', 0.1, -0.4)],
    });
  }

  // Tanker route
  if (on('tanker')) {
    out.tankerRoutes.push({
      id: 'DEBUG_TANKER',
      keyword: 'DEBUG_TANKER',
      label: 'DEBUG Tanker',
      platform: 'KC-135',
      tacan: '99X',
      speed_kt: 280,
      altitude_ft: 22000,
      distance_nm: 40,
      wp1: at('tanker'),
      wp2: at('tanker', 40, 0),
    });
  }

  return out;
}
