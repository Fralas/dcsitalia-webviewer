import { useEffect } from 'react';
import { LIDC_REGION_BORDERS } from '../config/lidcRegionBorders';

const BORDERS_SOURCE_ID = 'lidc-region-borders';
const BORDERS_LINE_LAYER_ID = 'lidc-region-borders-line';

export default function LidcRegionBorders({ map, visible = true }) {
  useEffect(() => {
    if (!map) return undefined;

    if (!map.getSource(BORDERS_SOURCE_ID)) {
      map.addSource(BORDERS_SOURCE_ID, { type: 'geojson', data: LIDC_REGION_BORDERS });
    }
    if (!map.getLayer(BORDERS_LINE_LAYER_ID)) {
      map.addLayer({
        id: BORDERS_LINE_LAYER_ID,
        type: 'line',
        source: BORDERS_SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffd166',
          'line-width': 1.5,
          'line-opacity': 0.8,
        },
      });
    }

    return () => {
      if (map.getLayer(BORDERS_LINE_LAYER_ID)) map.removeLayer(BORDERS_LINE_LAYER_ID);
      if (map.getSource(BORDERS_SOURCE_ID)) map.removeSource(BORDERS_SOURCE_ID);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !map.getLayer(BORDERS_LINE_LAYER_ID)) return undefined;
    map.setLayoutProperty(BORDERS_LINE_LAYER_ID, 'visibility', visible ? 'visible' : 'none');
    return undefined;
  }, [map, visible]);

  return null;
}
