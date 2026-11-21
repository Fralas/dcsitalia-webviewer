import { useEffect, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { CARTO_DARK_NOLABELS_TILE_URL } from '../../config/cartoBasemap';

/**
 * Small live map of an AI logistics route (HidcAirliftWizard): every airport the aircraft can use as a dim dot,
 * departure and arrival highlighted, dashed great-circle-ish line between them. Not interactive: it follows the form.
 */

const EMPTY = { type: 'FeatureCollection', features: [] };

function routeLine(from, to, steps = 32) {
  const coords = [];
  for (let i = 0; i <= steps; i += 1) {
    const k = i / steps;
    coords.push([from.lon + (to.lon - from.lon) * k, from.lat + (to.lat - from.lat) * k]);
  }
  return coords;
}

export default function HidcRoutePreview({ airports = [], from = null, to = null }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(false);

  const data = useMemo(() => ({
    airports: {
      type: 'FeatureCollection',
      features: airports
        .filter((airport) => Number.isFinite(airport?.coordinates?.lat) && Number.isFinite(airport?.coordinates?.lon))
        .map((airport) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [airport.coordinates.lon, airport.coordinates.lat] },
          properties: { role: airport.id === from?.id ? 'from' : airport.id === to?.id ? 'to' : 'idle' },
        })),
    },
    route: from?.coordinates && to?.coordinates
      ? { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeLine(from.coordinates, to.coordinates) }, properties: {} }] }
      : EMPTY,
  }), [airports, from, to]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const fit = (map, animate) => {
    const points = [from, to].filter((airport) => airport?.coordinates).map((airport) => airport.coordinates);
    const all = points.length > 0 ? points : airports.map((airport) => airport.coordinates).filter(Boolean);
    if (all.length === 0) return;
    const bounds = all.reduce(
      (b, c) => b.extend([c.lon, c.lat]),
      new maplibregl.LngLatBounds([all[0].lon, all[0].lat], [all[0].lon, all[0].lat]),
    );
    map.fitBounds(bounds, { padding: points.length === 2 ? 48 : 28, maxZoom: points.length === 1 ? 8 : 9, duration: animate ? 600 : 0 });
  };

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: { base: { type: 'raster', tiles: [CARTO_DARK_NOLABELS_TILE_URL], tileSize: 256 } },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#0b0b0b' } },
          { id: 'base', type: 'raster', source: 'base', paint: { 'raster-opacity': 0.9 } },
        ],
      },
      center: [36.5, 34.5],
      zoom: 5.5,
      interactive: false,
      attributionControl: false,
    });
    mapRef.current = map;
    map.on('load', () => {
      map.addSource('airports', { type: 'geojson', data: dataRef.current.airports });
      map.addSource('route', { type: 'geojson', data: dataRef.current.route });
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#ffbb00', 'line-width': 2, 'line-dasharray': [2, 2] },
      });
      map.addLayer({
        id: 'airports',
        type: 'circle',
        source: 'airports',
        paint: {
          'circle-radius': ['match', ['get', 'role'], 'idle', 2.5, 5],
          'circle-color': ['match', ['get', 'role'], 'from', '#ffffff', 'to', '#ffbb00', '#6b7280'],
          'circle-stroke-color': '#0b0b0b',
          'circle-stroke-width': ['match', ['get', 'role'], 'idle', 0, 2],
        },
      });
      readyRef.current = true;
      fit(map, false);
    });
    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; data and camera follow in the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.getSource('airports')?.setData(data.airports);
    map.getSource('route')?.setData(data.route);
    fit(map, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return <div ref={containerRef} className="hidc-alw-preview__map" aria-hidden="true" />;
}
