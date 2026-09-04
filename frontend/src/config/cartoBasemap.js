export function cartoRasterTileUrl(style) {
  return `/api/basemap/carto/${style}/{z}/{x}/{y}.png`;
}

export const CARTO_DARK_ALL_TILE_URL = cartoRasterTileUrl('dark_matter');
export const CARTO_DARK_NOLABELS_TILE_URL = cartoRasterTileUrl('dark_matter_nolabels');
