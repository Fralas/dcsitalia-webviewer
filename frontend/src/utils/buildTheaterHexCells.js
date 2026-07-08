import { cellToLatLng, latLngToCell, polygonToCells } from 'h3-js';
import { GLOBE_REGION_SPECS } from '../config/globeRegionSpecs';
import { GLOBE_EXTRA_DOTS } from '../config/globeMarkers';

const HEX_RESOLUTION = 3;
const SYRIA_CAMPAIGN_ID = 'hidc-modern-syria';
const EXTRA_FULL_THEATER_COUNTRIES = ['AF', 'PK'];

/**
 * Force-gray H3 cells that country/lat rules miss at res-3.
 * Bottom row of 3 gray dots in the reference.
 */
const THEATER_CELL_DENYLIST = new Set([
  '833e6cfffffffff', // IL — 30.34°N
  '833e6dfffffffff', // JO — 30.18°N
  '832d96fffffffff', // JO — 29.99°N
]);

/**
 * Turkey cells to highlight incrementally (user-confirmed one by one).
 */
const TURKEY_THEATER_CELL_ALLOWLIST = new Set([
  // Riga superiore (confermata)
  '832da9fffffffff', // 37.768, 38.794
  '832dadfffffffff', // 37.991, 37.411
  '832d13fffffffff', // 38.198, 36.009
  '832d10fffffffff', // 38.391, 34.591
  '832d14fffffffff', // 38.567, 33.156
  // Riga sotto (4 pallini: senza i 2 a sinistra + est circondato da arancioni)
  '832d16fffffffff', // 37.510, 33.718
  '832d12fffffffff', // 37.330, 35.131
  '832dacfffffffff', // 37.134, 36.529
  '832da8fffffffff', // 36.924, 37.909
  '832c30fffffffff', // 38.350, 41.048
  '832c33fffffffff', // 38.085, 42.395
  '832c32fffffffff', // 37.282, 41.498
  '832c36fffffffff', // 37.532, 40.156
  '832da5fffffffff', // 36.446, 34.265
  '833f69fffffffff', // 36.614, 32.858
]);

/**
 * Bottom gray row at the Negev / Aqaba tip (reference image).
 */
const COUNTRY_MIN_THEATER_LAT = {
  IL: 31.15,
  JO: 30.85,
};

function getCellsFromGeometry(geometry) {
  if (!geometry) return [];

  if (geometry.type === 'Polygon') {
    return polygonToCells(geometry.coordinates, HEX_RESOLUTION, true);
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flatMap((coords) => (
      polygonToCells(coords, HEX_RESOLUTION, true)
    ));
  }

  return [];
}

function cellInBbox(cell, bbox) {
  const [lat, lng] = cellToLatLng(cell);
  const [west, south, east, north] = bbox;
  return lat >= south && lat <= north && lng >= west && lng <= east;
}

function indexFeaturesByIsoA2(countryFeatures) {
  const map = new Map();
  countryFeatures.forEach((feature) => {
    const isoA2 = feature?.properties?.ISO_A2;
    if (isoA2) map.set(String(isoA2).toUpperCase(), feature);
  });
  return map;
}

function addCountryCells(cells, feature, isoA2) {
  const minLat = COUNTRY_MIN_THEATER_LAT[isoA2];
  getCellsFromGeometry(feature.geometry).forEach((cell) => {
    if (THEATER_CELL_DENYLIST.has(cell)) return;
    if (minLat != null && cellToLatLng(cell)[0] < minLat) return;
    cells.add(cell);
  });
}

function addTurkeyTheaterCells(cells) {
  TURKEY_THEATER_CELL_ALLOWLIST.forEach((cell) => cells.add(cell));
}

function applyDenylist(cells) {
  THEATER_CELL_DENYLIST.forEach((cell) => cells.delete(cell));
  return cells;
}

/**
 * Theater orange cells — tuned to the reference globe layout.
 */
export function buildTheaterHexCellSet(countryFeatures) {
  const spec = GLOBE_REGION_SPECS[SYRIA_CAMPAIGN_ID];
  const byIsoA2 = indexFeaturesByIsoA2(countryFeatures);
  const cells = new Set();

  [...(spec?.countries || []), ...EXTRA_FULL_THEATER_COUNTRIES].forEach((isoA2) => {
    const feature = byIsoA2.get(String(isoA2).toUpperCase());
    if (!feature) return;
    addCountryCells(cells, feature, String(isoA2).toUpperCase());
  });

  (spec?.zones || []).forEach((zone) => {
    (zone.countries || []).forEach((isoA2) => {
      if (String(isoA2).toUpperCase() === 'TR') return;

      const feature = byIsoA2.get(String(isoA2).toUpperCase());
      if (!feature) return;

      getCellsFromGeometry(feature.geometry)
        .filter((cell) => cellInBbox(cell, zone.bbox))
        .forEach((cell) => cells.add(cell));
    });
  });

  addTurkeyTheaterCells(cells);

  GLOBE_EXTRA_DOTS
    .filter((marker) => String(marker.ISO_A3).startsWith('CY-'))
    .forEach((marker) => {
      cells.add(latLngToCell(marker.lat, marker.lng, HEX_RESOLUTION));
    });

  applyDenylist(cells);

  return cells;
}

export function getCellsFromCountryFeature(feature) {
  return getCellsFromGeometry(feature?.geometry);
}
