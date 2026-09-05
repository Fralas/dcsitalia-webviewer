import { useEffect, useState } from 'react';
import './HidcMapAirportHoverPointer.css';

const BASE_OUTWARD_PX = 44;
const BASE_LABEL_GAP_PX = 2;
const BASE_NAME_FONT_PX = 12;
const BASE_ZONE_FONT_PX = 10;
const POINTER_REFERENCE_ZOOM = 8;

function getPointerScale(zoom) {
  const scaled = 2 ** ((zoom - POINTER_REFERENCE_ZOOM) / 3);
  return Math.max(0.55, Math.min(1.12, scaled));
}

function measureNameWidth(name, fontSizePx) {
  const text = String(name || '').toUpperCase();
  if (!text) return 56;

  if (typeof document === 'undefined') {
    return Math.max(56, text.length * fontSizePx * 0.74);
  }

  if (!measureNameWidth.canvas) {
    measureNameWidth.canvas = document.createElement('canvas');
  }
  const ctx = measureNameWidth.canvas.getContext('2d');
  ctx.font = `700 ${fontSizePx}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const letterSpacing = fontSizePx * 0.08;
  return Math.max(56, ctx.measureText(text).width + Math.max(0, text.length - 1) * letterSpacing);
}

function buildPointerPath(side, anchor, elbow, underlineStart, underlineEnd) {
  if (side === 'left') {
    return `M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineEnd.x} ${underlineEnd.y} L ${underlineStart.x} ${underlineStart.y}`;
  }
  return `M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineStart.x} ${underlineStart.y} L ${underlineEnd.x} ${underlineEnd.y}`;
}

function getMapWidth(map, engine) {
  if (engine === 'leaflet') return map.getSize()?.x || 0;
  return map.getCanvas()?.clientWidth || 0;
}

function projectAirport(map, engine, airport) {
  if (engine === 'leaflet') {
    const point = map.latLngToContainerPoint([airport.lat, airport.lon]);
    return { x: point.x, y: point.y };
  }
  return map.project([airport.lon, airport.lat]);
}

function subscribeMapView(map, engine, onChange) {
  map.on('move', onChange);
  map.on('zoom', onChange);
  map.on('resize', onChange);
  return () => {
    map.off('move', onChange);
    map.off('zoom', onChange);
    map.off('resize', onChange);
  };
}

function buildPointerFrame(map, engine, airport) {
  const width = getMapWidth(map, engine);
  if (!width) return null;

  const anchor = projectAirport(map, engine, airport);
  if (!Number.isFinite(anchor?.x) || !Number.isFinite(anchor?.y)) return null;

  const scale = getPointerScale(map.getZoom());
  const side = anchor.x >= width / 2 ? 'right' : 'left';
  const leanX = Math.max(-0.4, Math.min(0.4, (anchor.x - width / 2) / 260));
  const stemLen = Math.hypot(leanX, 1) || 1;
  const outwardPx = BASE_OUTWARD_PX * scale;
  const labelGapPx = BASE_LABEL_GAP_PX * scale;

  const elbow = {
    x: anchor.x + (leanX / stemLen) * outwardPx,
    y: anchor.y - (1 / stemLen) * outwardPx,
  };

  const nameFontSize = BASE_NAME_FONT_PX * scale;
  const zoneFontSize = BASE_ZONE_FONT_PX * scale;
  const underlineWidth = measureNameWidth(airport.name, nameFontSize);
  let underlineStart;
  let underlineEnd;

  if (side === 'left') {
    underlineEnd = { x: elbow.x - labelGapPx, y: elbow.y };
    underlineStart = { x: underlineEnd.x - underlineWidth, y: elbow.y };
  } else {
    underlineStart = { x: elbow.x + labelGapPx, y: elbow.y };
    underlineEnd = { x: underlineStart.x + underlineWidth, y: elbow.y };
  }

  return {
    name: airport.name,
    zoneNumber: airport.zoneNumber ? String(airport.zoneNumber) : '',
    coalition: airport.coalition === 'blue' || airport.coalition === 'red' ? airport.coalition : 'neutral',
    anchor,
    label: { ...underlineStart },
    labelWidth: underlineWidth,
    strokeWidth: Math.max(1.6, 2.5 * scale),
    nameFontSize,
    zoneFontSize,
    pathD: buildPointerPath(side, anchor, elbow, underlineStart, underlineEnd),
  };
}

export default function HidcMapAirportHoverPointer({ map, airport, engine = 'maplibre' }) {
  const [frame, setFrame] = useState(null);
  const airportKey = airport
    ? `${airport.lon}:${airport.lat}:${airport.name}:${airport.coalition || 'neutral'}:${airport.zoneNumber || ''}`
    : '';

  useEffect(() => {
    if (!map || !airport) {
      setFrame(null);
      return undefined;
    }

    const syncFrame = () => {
      setFrame(buildPointerFrame(map, engine, airport));
    };

    syncFrame();
    return subscribeMapView(map, engine, syncFrame);
  }, [map, engine, airport, airportKey]);

  if (!frame) return null;

  return (
    <div className="hidc-airport-pointer" aria-hidden="true">
      <svg className="hidc-airport-pointer__svg">
        <path
          key={airportKey}
          className="hidc-airport-pointer__line"
          d={frame.pathD}
          pathLength="1"
          strokeWidth={frame.strokeWidth}
        />
      </svg>
      <div
        key={`${airportKey}-label`}
        className={`hidc-airport-pointer__label hidc-airport-pointer__label--${frame.coalition || 'neutral'}`}
        style={{
          left: `${frame.label.x}px`,
          top: `${frame.label.y}px`,
          fontSize: `${frame.nameFontSize}px`,
        }}
      >
        {frame.name}
        {frame.zoneNumber ? (
          <span
            className="hidc-airport-pointer__zone"
            style={{ fontSize: `${frame.zoneFontSize}px` }}
          >
            {frame.zoneNumber}
          </span>
        ) : null}
      </div>
    </div>
  );
}
