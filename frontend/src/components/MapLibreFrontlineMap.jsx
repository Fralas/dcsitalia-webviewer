import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { CARTO_DARK_NOLABELS_TILE_URL } from '../config/cartoBasemap';
import socketService from '../services/socket';
import { getFrontlineZones } from '../services/api';

const DARK_RASTER_STYLE = {
  version: 8,
  sources: {
    cartoDark: {
      type: 'raster',
      tiles: [CARTO_DARK_NOLABELS_TILE_URL],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    },
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'cartoDark',
    },
  ],
};

function getInitialCenter(airportsData) {
  if (!Array.isArray(airportsData) || airportsData.length === 0) {
    return [37.5, 35.5];
  }

  const valid = airportsData.filter((a) => Number.isFinite(a?.coordinates?.lat) && Number.isFinite(a?.coordinates?.lon));
  if (valid.length === 0) return [37.5, 35.5];

  const sum = valid.reduce((acc, airport) => ({
    lat: acc.lat + airport.coordinates.lat,
    lon: acc.lon + airport.coordinates.lon,
  }), { lat: 0, lon: 0 });

  return [sum.lon / valid.length, sum.lat / valid.length];
}

function zonesToFeatureCollection(zones) {
  return {
    type: 'FeatureCollection',
    features: (Array.isArray(zones) ? zones : [])
      .filter((zone) => Number.isFinite(zone?.coordinates?.lat) && Number.isFinite(zone?.coordinates?.lon))
      .map((zone) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [zone.coordinates.lon, zone.coordinates.lat],
        },
        properties: {
          id: zone.id || '',
          name: zone.name || zone.id || 'zone',
          status: zone.status || 'UNKNOWN',
        },
      })),
  };
}

function airportsToFeatureCollection(airportsData) {
  return {
    type: 'FeatureCollection',
    features: (Array.isArray(airportsData) ? airportsData : [])
      .filter((airport) => Number.isFinite(airport?.coordinates?.lat) && Number.isFinite(airport?.coordinates?.lon))
      .map((airport) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [airport.coordinates.lon, airport.coordinates.lat],
        },
        properties: {
          id: airport.id || '',
          name: airport.displayName || airport.name || airport.id || 'airport',
          main: airport.isMainBase ? 1 : 0,
        },
      })),
  };
}

export default function MapLibreFrontlineMap({ airportsData }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [zones, setZones] = useState([]);
  const MIN_PITCH = 15;
  const MAX_PITCH = 80;
  const MAX_ZOOM_AT_HIGH_PITCH = 9.5;
  const HIGH_PITCH_THRESHOLD = 72;
  const [camera, setCamera] = useState({ zoom: 6.5, pitch: MIN_PITCH, bearing: 0 });
  const [selected, setSelected] = useState(null);
  const [middleDragState, setMiddleDragState] = useState(null);

  const center = useMemo(() => getInitialCenter(airportsData), [airportsData]);
  const zoneFeatures = useMemo(() => zonesToFeatureCollection(zones), [zones]);
  const airportFeatures = useMemo(() => airportsToFeatureCollection(airportsData), [airportsData]);

  useEffect(() => {
    let mounted = true;

    const loadZones = async () => {
      try {
        const response = await getFrontlineZones();
        const nextZones = response?.zones || response;
        if (mounted && Array.isArray(nextZones)) {
          setZones(nextZones);
        }
      } catch (error) {
        console.error('Failed to load frontline zones for maplibre:', error);
      }
    };

    loadZones();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribeFrontline = socketService.on('frontline:updated', (data) => {
      const nextZones = data?.zones || data;
      if (Array.isArray(nextZones)) {
        setZones(nextZones);
      }
    });

    return () => {
      unsubscribeFrontline && unsubscribeFrontline();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: DARK_RASTER_STYLE,
      center,
      zoom: 6.5,
      pitch: MIN_PITCH,
      bearing: 0,
      minPitch: MIN_PITCH,
      maxPitch: MAX_PITCH,
      minZoom: 4,
      maxZoom: 14,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      map.addSource('frontline-zones', {
        type: 'geojson',
        data: zoneFeatures,
      });
      map.addLayer({
        id: 'frontline-zones-layer',
        type: 'circle',
        source: 'frontline-zones',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'status'],
            'RED', '#ef4444',
            'BLUE', '#3b82f6',
            'UNDER_ATTACK', '#f97316',
            'NEUTRAL', '#e2e8f0',
            '#94a3b8',
          ],
          'circle-stroke-color': '#f8fafc',
          'circle-stroke-width': 1.5,
          'circle-opacity': 0.9,
        },
      });

      map.addSource('frontline-airports', {
        type: 'geojson',
        data: airportFeatures,
      });
      map.addLayer({
        id: 'frontline-airports-layer',
        type: 'circle',
        source: 'frontline-airports',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'main'], 1], 6.5, 5],
          'circle-color': ['case', ['==', ['get', 'main'], 1], '#4ec5ff', '#93c5fd'],
          'circle-stroke-color': '#f8fafc',
          'circle-stroke-width': 1.4,
          'circle-opacity': 0.95,
        },
      });
    });

    map.on('click', 'frontline-zones-layer', (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      setSelected({
        type: 'zone',
        id: feature.properties?.id || '',
        name: feature.properties?.name || '',
        status: feature.properties?.status || '',
      });
    });

    map.on('click', 'frontline-airports-layer', (event) => {
      const feature = event.features && event.features[0];
      if (!feature) return;
      setSelected({
        type: 'airport',
        id: feature.properties?.id || '',
        name: feature.properties?.name || '',
      });
    });

    map.on('mousemove', 'frontline-zones-layer', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'frontline-zones-layer', () => {
      map.getCanvas().style.cursor = '';
    });

    map.on('moveend', () => {
      setCamera({
        zoom: Number(map.getZoom().toFixed(2)),
        pitch: Number(map.getPitch().toFixed(1)),
        bearing: Number(map.getBearing().toFixed(1)),
      });
    });

    // Safety clamp to avoid camera clipping into the map at extreme pitch/zoom combos.
    map.on('move', () => {
      const currentPitch = map.getPitch();
      const currentZoom = map.getZoom();
      const clampedPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, currentPitch));
      if (Math.abs(clampedPitch - currentPitch) > 0.001) {
        map.setPitch(clampedPitch);
      }

      if (clampedPitch >= HIGH_PITCH_THRESHOLD && currentZoom > MAX_ZOOM_AT_HIGH_PITCH) {
        map.setZoom(MAX_ZOOM_AT_HIGH_PITCH);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center, zoneFeatures, airportFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('frontline-zones');
    if (source && source.setData) {
      source.setData(zoneFeatures);
    }
  }, [zoneFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('frontline-airports');
    if (source && source.setData) {
      source.setData(airportFeatures);
    }
  }, [airportFeatures]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();

    const onMouseDown = (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      setMiddleDragState({
        x: event.clientX,
        y: event.clientY,
      });
    };

    const onMouseMove = (event) => {
      if (!middleDragState) return;
      event.preventDefault();

      const dx = event.clientX - middleDragState.x;
      const dy = event.clientY - middleDragState.y;

      const nextBearing = map.getBearing() + (dx * 0.25);
      const nextPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, map.getPitch() - (dy * 0.2)));

      map.setBearing(nextBearing);
      map.setPitch(nextPitch);
      setMiddleDragState({
        x: event.clientX,
        y: event.clientY,
      });
      setCamera({
        zoom: Number(map.getZoom().toFixed(2)),
        pitch: Number(nextPitch.toFixed(1)),
        bearing: Number(nextBearing.toFixed(1)),
      });
    };

    const onMouseUp = () => {
      if (!middleDragState) return;
      setMiddleDragState(null);
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [middleDragState]);

  return (
    <div className="h-full overflow-hidden bg-yt-bg-primary p-3">
      <div className="relative h-full overflow-hidden rounded-2xl border border-yt-border bg-yt-bg-secondary/75">
        <div ref={containerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-yt-border bg-[#101827e0] px-3 py-2 text-[11px] text-yt-text-secondary">
          <div className="font-semibold text-yt-text-primary">MapLibre 3D Preview</div>
          <div>Zoom: {camera.zoom}</div>
          <div>Pitch: {camera.pitch}</div>
          <div>Bearing: {camera.bearing}</div>
          <div>Zones: {zoneFeatures.features.length}</div>
          <div>Airports: {airportFeatures.features.length}</div>
          <div className="mt-1">Middle mouse drag: rotate + tilt</div>
        </div>
        {selected && (
          <div className="absolute right-3 top-3 rounded-lg border border-yt-border bg-[#101827e0] px-3 py-2 text-[11px] text-yt-text-secondary">
            <div className="font-semibold text-yt-text-primary">{selected.type === 'zone' ? 'Zone' : 'Airport'} Selected</div>
            <div>ID: {selected.id || '-'}</div>
            <div>Name: {selected.name || '-'}</div>
            {selected.type === 'zone' && <div>Status: {selected.status || '-'}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
