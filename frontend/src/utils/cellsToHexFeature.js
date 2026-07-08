import { cellToBoundary } from 'h3-js';

export function cellsToHexFeature(cells, properties) {
  const cellList = [...cells];
  if (!cellList.length) return null;

  const polygons = cellList.map((cell) => {
    const boundary = cellToBoundary(cell, true).reverse();
    return [boundary];
  });

  return {
    type: 'Feature',
    properties: {
      ...properties,
      ...(properties?.theaterHighlight ? { theaterCellIds: cellList } : {}),
    },
    geometry: polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons },
  };
}
