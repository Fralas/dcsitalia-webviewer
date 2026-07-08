import { cellToBoundary, latLngToCell, polygonToCells } from 'h3-js';

const HEX_RESOLUTION = 3;

export function collectCountryHexCells(features, resolution = HEX_RESOLUTION) {
  const cells = new Set();

  if (!Array.isArray(features)) {
    return cells;
  }

  features.forEach((feature) => {
    const geo = feature?.geometry;
    if (!geo) return;

    if (geo.type === 'Polygon') {
      polygonToCells(geo.coordinates, resolution, true).forEach((idx) => cells.add(idx));
      return;
    }

    if (geo.type === 'MultiPolygon') {
      geo.coordinates.forEach((coords) => {
        polygonToCells(coords, resolution, true).forEach((idx) => cells.add(idx));
      });
    }
  });

  return cells;
}

/**
 * Snap theater markers to the globe hex grid and return GeoJSON polygons
 * that render with the same dot size as country hex cells.
 * Skips cells already covered by country polygons to avoid double-sized dots.
 */
export function buildExtraHexFeatures(markers, occupiedCells = new Set()) {
  if (!Array.isArray(markers) || markers.length === 0) {
    return [];
  }

  const seen = new Set();
  const polygons = [];

  markers.forEach((marker) => {
    const cell = latLngToCell(marker.lat, marker.lng, HEX_RESOLUTION);
    if (occupiedCells.has(cell) || seen.has(cell)) {
      return;
    }
    seen.add(cell);

    const boundary = cellToBoundary(cell, true).reverse();
    polygons.push({
      ring: boundary,
      ISO_A3: marker.ISO_A3,
    });
  });

  if (polygons.length === 0) {
    return [];
  }

  if (polygons.length === 1) {
    const [only] = polygons;
    return [{
      type: 'Feature',
      properties: {
        ISO_A3: only.ISO_A3,
        ADMIN: only.ISO_A3,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [only.ring],
      },
    }];
  }

  return [{
    type: 'Feature',
    properties: {
      ISO_A3: polygons[0].ISO_A3,
      ADMIN: 'Theater',
    },
    geometry: {
      type: 'MultiPolygon',
      coordinates: polygons.map(({ ring }) => [ring]),
    },
  }];
}
