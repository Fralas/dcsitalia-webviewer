import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getLidcAirportById } from '../config/lidcAfghanistanAirports';
import { CARTO_DARK_ALL_TILE_URL } from '../config/cartoBasemap';
import LidcMapAirportPointers from './LidcMapAirportPointers';

/** Approximate Afghanistan theater viewport [west, south, east, north]. */
const AFGHANISTAN_THEATER_BOUNDS = [58.0, 29.5, 71.5, 38.2];
const MIN_PITCH = 0;
const MAX_PITCH = 85;
const BASE_FOCUS_ZOOM = 6;

const MAP_STYLE = {
  version: 8,
  sources: {
    cartoDark: {
      type: 'raster',
      tiles: [CARTO_DARK_ALL_TILE_URL],
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

function flyToAirport(map, airportId) {
  const airport = getLidcAirportById(airportId);
  if (!map || !airport) return;

  map.flyTo({
    center: [airport.lon, airport.lat],
    zoom: BASE_FOCUS_ZOOM,
    essential: true,
    duration: 1100,
  });
}

function fitTheaterBounds(map) {
  const [west, south, east, north] = AFGHANISTAN_THEATER_BOUNDS;
  map.fitBounds([[west, south], [east, north]], {
    padding: { top: 28, right: 28, bottom: 28, left: 28 },
    duration: 0,
  });
}

export default function LidcTheaterMap({
  layoutKey = 0,
  selectedAirportId = '',
  onSelectAirport = null,
  onClearAirport = null,
  orderAlerts = {},
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return undefined;

    const map = new maplibregl.Map({
      container,
      style: MAP_STYLE,
      center: [66.0, 34.0],
      zoom: 5.0,
      pitch: MIN_PITCH,
      bearing: 0,
      minZoom: 4,
      maxZoom: BASE_FOCUS_ZOOM,
      minPitch: MIN_PITCH,
      maxPitch: MAX_PITCH,
      attributionControl: false,
      fadeDuration: 0,
    });

    mapRef.current = map;

    map.on('load', () => {
      fitTheaterBounds(map);
      setMapInstance(map);
    });

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      setMapInstance(null);
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

  useEffect(() => {
    if (!mapInstance || !selectedAirportId) return undefined;
    flyToAirport(mapInstance, selectedAirportId);
    return undefined;
  }, [mapInstance, selectedAirportId]);

  useEffect(() => {
    if (!mapInstance || typeof onClearAirport !== 'function') return undefined;

    const handleMapClick = (event) => {
      if (event?.originalEvent?.defaultPrevented) return;
      onClearAirport();
    };

    mapInstance.on('click', handleMapClick);
    return () => {
      mapInstance.off('click', handleMapClick);
    };
  }, [mapInstance, onClearAirport]);

  return (
    <div className="lidc-theater-map-root">
      <div
        ref={containerRef}
        className="lidc-theater-map"
        role="application"
        aria-label="Interactive Afghanistan theater map"
      />
      {mapInstance && (
        <LidcMapAirportPointers
          map={mapInstance}
          selectedAirportId={selectedAirportId}
          onSelectAirport={onSelectAirport}
          orderAlerts={orderAlerts}
        />
      )}
    </div>
  );
}
