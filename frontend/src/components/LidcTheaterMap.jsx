import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Satellite } from 'lucide-react';
import { getLidcAirportById } from '../config/lidcAfghanistanAirports';
import {
  LIDC_POI_CATEGORIES,
  LIDC_POI_CATEGORY_COLORS,
  LIDC_POINTS_OF_INTEREST,
} from '../config/lidcPointsOfInterest';
import { CARTO_DARK_ALL_TILE_URL } from '../config/cartoBasemap';
import LidcMapAirportPointers from './LidcMapAirportPointers';
import LidcMapPoiPointers from './LidcMapPoiPointers';
import LidcRegionBorders from './LidcRegionBorders';

/** Approximate Afghanistan theater viewport [west, south, east, north]. */
const AFGHANISTAN_THEATER_BOUNDS = [58.0, 29.5, 71.5, 38.2];
const MIN_PITCH = 0;
const MAX_PITCH = 85;
const BASE_FOCUS_ZOOM = 6;
const MAX_MAP_ZOOM = 10;

const BASEMAP_MODE_DARK = 'dark';
const BASEMAP_MODE_SATELLITE = 'satellite';
const ESRI_SATELLITE_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const LIDC_BASEMAP_STORAGE_KEY = 'lidc.theaterBasemap';

function readStoredBasemapMode() {
  if (typeof window === 'undefined' || !window.localStorage) return BASEMAP_MODE_DARK;
  try {
    const stored = window.localStorage.getItem(LIDC_BASEMAP_STORAGE_KEY);
    return stored === BASEMAP_MODE_SATELLITE ? BASEMAP_MODE_SATELLITE : BASEMAP_MODE_DARK;
  } catch {
    return BASEMAP_MODE_DARK;
  }
}

const MAP_STYLE = {
  version: 8,
  sources: {
    cartoDark: {
      type: 'raster',
      tiles: [CARTO_DARK_ALL_TILE_URL],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    },
    esriSatellite: {
      type: 'raster',
      tiles: [ESRI_SATELLITE_TILE_URL],
      tileSize: 256,
      attribution: 'Tiles &copy; Esri',
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
      layout: {
        visibility: 'visible',
      },
    },
    {
      id: 'esri-satellite-layer',
      type: 'raster',
      source: 'esriSatellite',
      layout: {
        visibility: 'none',
      },
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
  const [poiEnabled, setPoiEnabled] = useState(true);
  const [legendOpen, setLegendOpen] = useState(false);
  const [activePoiCategories, setActivePoiCategories] = useState(() => (
    Object.values(LIDC_POI_CATEGORIES)
  ));
  const [includeOutsidePois, setIncludeOutsidePois] = useState(true);
  const [showRegionBorders, setShowRegionBorders] = useState(true);
  const [basemapMode, setBasemapMode] = useState(readStoredBasemapMode);

  const visiblePois = useMemo(() => {
    if (!poiEnabled) return [];
    const active = new Set(activePoiCategories);
    return LIDC_POINTS_OF_INTEREST.filter((poi) => {
      if (!active.has(poi.category)) return false;
      if (!includeOutsidePois && poi.mapStatus !== 'Dentro la mappa') return false;
      return true;
    });
  }, [poiEnabled, activePoiCategories, includeOutsidePois]);

  function toggleBasemapMode() {
    setBasemapMode((prev) => {
      const next = prev === BASEMAP_MODE_SATELLITE ? BASEMAP_MODE_DARK : BASEMAP_MODE_SATELLITE;
      try {
        window.localStorage.setItem(LIDC_BASEMAP_STORAGE_KEY, next);
      } catch {
        // Ignore quota / private-mode failures.
      }
      return next;
    });
  }

  useEffect(() => {
    if (!mapInstance) return undefined;
    const showSatellite = basemapMode === BASEMAP_MODE_SATELLITE;
    if (mapInstance.getLayer('carto-dark-layer')) {
      mapInstance.setLayoutProperty('carto-dark-layer', 'visibility', showSatellite ? 'none' : 'visible');
    }
    if (mapInstance.getLayer('esri-satellite-layer')) {
      mapInstance.setLayoutProperty('esri-satellite-layer', 'visibility', showSatellite ? 'visible' : 'none');
    }
    return undefined;
  }, [mapInstance, basemapMode]);

  function togglePoiCategory(category) {
    setActivePoiCategories((prev) => (
      prev.includes(category)
        ? prev.filter((entry) => entry !== category)
        : [...prev, category]
    ));
  }

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
      maxZoom: MAX_MAP_ZOOM,
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
      {mapInstance && poiEnabled && visiblePois.length > 0 && (
        <LidcMapPoiPointers map={mapInstance} pois={visiblePois} />
      )}
      {mapInstance && (
        <LidcRegionBorders map={mapInstance} visible={showRegionBorders} />
      )}
      <div className="lidc-poi-legend">
        <div className="lidc-poi-legend__buttons">
          <button
            type="button"
            className={`lidc-poi-legend__toggle${basemapMode === BASEMAP_MODE_SATELLITE ? ' is-active' : ''}`}
            onClick={toggleBasemapMode}
            aria-pressed={basemapMode === BASEMAP_MODE_SATELLITE}
            title={basemapMode === BASEMAP_MODE_SATELLITE ? 'Torna alla mappa scura' : 'Passa alla mappa satellitare'}
          >
            <Satellite size={13} aria-hidden="true" />
            Sat
          </button>
          <button
            type="button"
            className="lidc-poi-legend__toggle"
            onClick={() => setLegendOpen((prev) => !prev)}
            aria-expanded={legendOpen}
          >
            <span
              className="lidc-poi-legend__dot"
              aria-hidden="true"
            />
            {`POI · ${visiblePois.length}/150`}
          </button>
        </div>
        {legendOpen && (
          <div className="lidc-poi-legend__panel">
            <label className="lidc-poi-legend__row">
              <input
                type="checkbox"
                checked={poiEnabled}
                onChange={(event) => setPoiEnabled(event.target.checked)}
              />
              Mostra punti di interesse
            </label>
            {Object.values(LIDC_POI_CATEGORIES).map((category) => (
              <label key={category} className="lidc-poi-legend__row">
                <input
                  type="checkbox"
                  checked={activePoiCategories.includes(category)}
                  onChange={() => togglePoiCategory(category)}
                />
                <span
                  className="lidc-poi-legend__swatch"
                  style={{ backgroundColor: LIDC_POI_CATEGORY_COLORS[category] }}
                  aria-hidden="true"
                />
                {category}
              </label>
            ))}
            <label className="lidc-poi-legend__row">
              <input
                type="checkbox"
                checked={includeOutsidePois}
                onChange={(event) => setIncludeOutsidePois(event.target.checked)}
              />
              Fuori mappa / da verificare
            </label>
            <label className="lidc-poi-legend__row">
              <input
                type="checkbox"
                checked={showRegionBorders}
                onChange={(event) => setShowRegionBorders(event.target.checked)}
              />
              Confini province
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
