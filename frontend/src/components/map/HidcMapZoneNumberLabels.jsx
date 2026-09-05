import { useEffect, useState } from 'react';
import './HidcMapZoneNumberLabels.css';

const ZONE_NUMBER_MIN_ZOOM = 11;
const DOME_HEIGHT_METERS = 1000 * 0.28;
const LABEL_GAP_PX = 8;

function getZoneNumber(zone) {
  const source = String(zone?.id || zone?.name || '');
  const match = source.match(/\d+/);
  return match ? match[0] : '';
}

function getZoneTone(zone, selectedZoneId) {
  if (zone?.id && zone.id === selectedZoneId) return 'selected';
  if (zone?.status === 'RED') return 'red';
  if (zone?.status === 'BLUE') return 'blue';
  if (zone?.status === 'UNDER_ATTACK') return 'attack';
  return 'neutral';
}

function getMapSize(map, engine) {
  if (engine === 'leaflet') {
    const size = map.getSize?.();
    return { width: size?.x || 0, height: size?.y || 0 };
  }
  const canvas = map.getCanvas?.();
  return {
    width: canvas?.clientWidth || 0,
    height: canvas?.clientHeight || 0,
  };
}

function projectPoint(map, engine, lat, lon) {
  if (engine === 'leaflet') {
    const point = map.latLngToContainerPoint([lat, lon]);
    return { x: point.x, y: point.y };
  }
  return map.project([lon, lat]);
}

function metersToScreenPx(zoom, lat, meters) {
  const mPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  return meters / Math.max(mPerPx, 0.01);
}

function subscribeMapView(map, engine, onChange) {
  map.on('move', onChange);
  map.on('zoom', onChange);
  map.on('resize', onChange);
  if (engine !== 'leaflet') {
    map.on('pitch', onChange);
    map.on('rotate', onChange);
  }
  return () => {
    map.off('move', onChange);
    map.off('zoom', onChange);
    map.off('resize', onChange);
    if (engine !== 'leaflet') {
      map.off('pitch', onChange);
      map.off('rotate', onChange);
    }
  };
}

function buildFrames(map, engine, zones, selectedZoneId) {
  const zoom = map.getZoom();
  if (zoom < ZONE_NUMBER_MIN_ZOOM) return [];

  const { width, height } = getMapSize(map, engine);
  if (!width || !height) return [];

  const fontSize = 11 + Math.min(5, Math.max(0, zoom - ZONE_NUMBER_MIN_ZOOM) * 1.2);

  return (zones || []).flatMap((zone) => {
    const lat = Number(zone?.coordinates?.lat);
    const lon = Number(zone?.coordinates?.lon);
    const number = getZoneNumber(zone);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !number) return [];

    const point = projectPoint(map, engine, lat, lon);
    if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return [];

    const pitch = engine === 'leaflet' ? 0 : Number(map.getPitch?.() || 0);
    const pitchBoost = 1 / Math.max(0.35, Math.cos((pitch * Math.PI) / 180));
    const lift = metersToScreenPx(zoom, lat, DOME_HEIGHT_METERS) * Math.min(pitchBoost, 2.4) + LABEL_GAP_PX;
    const x = point.x;
    const y = point.y - lift;
    if (x < -48 || y < -48 || x > width + 48 || y > height + 48) return [];

    return [{
      id: zone.id || `${lon}:${lat}:${number}`,
      number,
      tone: getZoneTone(zone, selectedZoneId),
      x,
      y,
      fontSize,
    }];
  });
}

export default function HidcMapZoneNumberLabels({
  map,
  zones,
  visible = true,
  selectedZoneId = null,
  engine = 'maplibre',
}) {
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    if (!map || !visible) {
      setFrames([]);
      return undefined;
    }

    const sync = () => {
      setFrames(buildFrames(map, engine, zones, selectedZoneId));
    };

    sync();
    return subscribeMapView(map, engine, sync);
  }, [map, engine, zones, visible, selectedZoneId]);

  if (!visible || frames.length === 0) return null;

  return (
    <div className="hidc-zone-numbers" aria-hidden="true">
      {frames.map((frame) => (
        <span
          key={frame.id}
          className={`hidc-zone-numbers__label hidc-zone-numbers__label--${frame.tone}`}
          style={{
            left: `${frame.x}px`,
            top: `${frame.y}px`,
            fontSize: `${frame.fontSize}px`,
          }}
        >
          {frame.number}
        </span>
      ))}
    </div>
  );
}
