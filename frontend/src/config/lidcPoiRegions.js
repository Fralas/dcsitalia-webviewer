import { LIDC_POINTS_OF_INTEREST } from './lidcPointsOfInterest';
import { LIDC_REGION_LABELS } from './lidcRegionBorders';

/**
 * LIDC regions (REGION_01..28 from the .miz) grouped into 4 macro areas,
 * plus point-in-province assignment for every POI.
 *
 * Assignment uses nearest REGION label (Voronoi cell): labels sit at the
 * region centers placed by the mission author, so nearest-label is the
 * practical equivalent of "inside the province" without closed polygons.
 */

export const LIDC_MACRO_AREAS = Object.freeze([
  Object.freeze({ id: 'ovest', name: 'Ovest', regions: Object.freeze(['01', '02', '05', '06', '13', '22', '27']) }),
  Object.freeze({ id: 'sud', name: 'Sud', regions: Object.freeze(['14', '23', '24', '25', '28']) }),
  Object.freeze({ id: 'centro', name: 'Centro', regions: Object.freeze(['03', '04', '07', '08', '16', '17', '18']) }),
  Object.freeze({ id: 'est', name: 'Est', regions: Object.freeze(['09', '10', '11', '12', '19', '20', '21', '26']) }),
]);

const labelById = new Map(LIDC_REGION_LABELS.map((label) => [label.label, label]));

export function getRegionCenter(regionId) {
  return labelById.get(regionId) || null;
}

export function getMacroCenter(macro) {
  const points = (macro.regions || [])
    .map((id) => labelById.get(id))
    .filter(Boolean);
  if (points.length === 0) return null;
  return {
    lon: points.reduce((sum, p) => sum + p.lon, 0) / points.length,
    lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
  };
}

export function assignPoiRegion(poi) {
  if (!poi) return '';
  const cosLat = Math.cos(Number(poi.lat) * Math.PI / 180) || 1;
  let bestId = '';
  let bestD = Infinity;
  for (const label of LIDC_REGION_LABELS) {
    const dx = (Number(poi.lon) - label.lon) * cosLat;
    const dy = Number(poi.lat) - label.lat;
    const d = dx * dx + dy * dy;
    if (d < bestD) {
      bestD = d;
      bestId = label.label;
    }
  }
  return bestId;
}

function buildPoiRegionMap() {
  const map = new Map();
  for (const poi of LIDC_POINTS_OF_INTEREST) {
    map.set(poi.id, assignPoiRegion(poi));
  }
  return map;
}

export const LIDC_POI_REGION = buildPoiRegionMap();

export function getPoiRegionId(poiOrId) {
  const id = typeof poiOrId === 'string' ? poiOrId : poiOrId?.id;
  return LIDC_POI_REGION.get(id) || '';
}

export function getMacroOfRegion(regionId) {
  return LIDC_MACRO_AREAS.find((macro) => macro.regions.includes(regionId)) || null;
}
