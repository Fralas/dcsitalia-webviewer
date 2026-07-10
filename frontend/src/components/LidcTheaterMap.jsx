import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

/** Approximate Afghanistan theater viewport [west, south, east, north]. */
const AFGHANISTAN_THEATER_BOUNDS = [58.0, 29.5, 71.5, 38.2];

const MAP_STYLE = {
  version: 8,
  sources: {
    cartoDark: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background',
      paint: {
        'background-color': '#0a0a0a',
      },
    },
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'cartoDark',
    },
  ],
};

function fitTheaterBounds(map) {
  const [west, south, east, north] = AFGHANISTAN_THEATER_BOUNDS;
  map.fitBounds([[west, south], [east, north]], {
    padding: { top: 44, right: 44, bottom: 44, left: 44 },
    duration: 0,
  });
}

export default function LidcTheaterMap({ layoutKey = 0 }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [66.0, 34.0],
      zoom: 5.0,
      pitch: 0,
      bearing: 0,
      minZoom: 4,
      maxZoom: 12,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    map.on('load', () => {
      fitTheaterBounds(map);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const resizeMap = () => {
      map.resize();
    };

    resizeMap();
    const afterTransition = window.setTimeout(resizeMap, 720);

    return () => {
      window.clearTimeout(afterTransition);
    };
  }, [layoutKey]);

  return (
    <div
      ref={containerRef}
      className="lidc-theater-map"
      role="application"
      aria-label="Interactive Afghanistan theater map"
    />
  );
}
