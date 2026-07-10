import { useEffect, useState } from 'react';
import { LIDC_AFGHANISTAN_AIRPORTS } from '../config/lidcAfghanistanAirports';

const BASE_OUTWARD_PX = 44;
const BASE_LABEL_GAP_PX = 2;
const BASE_DOT_RADIUS = 5;
const EDGE_MARGIN = 24;
const POINTER_REFERENCE_ZOOM = 8;

function getPointerScale(zoom) {
  const scaled = 2 ** ((zoom - POINTER_REFERENCE_ZOOM) / 3);
  return Math.max(0.48, Math.min(1.18, scaled));
}

function underlineWidthForName(name, scale) {
  const base = Math.min(150, Math.max(52, String(name || '').length * 8.2));
  return base * scale;
}

function buildPointerFrame(anchor, width, airport, scale) {
  const side = airport.pointerSide || (anchor.x >= width / 2 ? 'right' : 'left');
  const leanX = Math.max(-0.4, Math.min(0.4, (anchor.x - width / 2) / 260));
  const stemLen = Math.hypot(leanX, 1) || 1;
  const outwardPx = BASE_OUTWARD_PX * scale;
  const labelGapPx = BASE_LABEL_GAP_PX * scale;

  const elbow = {
    x: anchor.x + (leanX / stemLen) * outwardPx,
    y: anchor.y - (1 / stemLen) * outwardPx,
  };

  const underlineWidth = underlineWidthForName(airport.name, scale);
  let underlineStart;
  let underlineEnd;
  let label;

  if (side === 'left') {
    underlineEnd = { x: elbow.x - labelGapPx, y: elbow.y };
    underlineStart = { x: underlineEnd.x - underlineWidth, y: elbow.y };
    label = { ...underlineStart };
  } else {
    underlineStart = { x: elbow.x + labelGapPx, y: elbow.y };
    underlineEnd = { x: underlineStart.x + underlineWidth, y: elbow.y };
    label = { ...underlineStart };
  }

  return {
    airport,
    anchor,
    elbow,
    underlineStart,
    underlineEnd,
    label,
    side,
    scale,
    dotRadius: BASE_DOT_RADIUS * scale,
    strokeWidth: Math.max(1.4, 2.5 * scale),
  };
}

function buildPointerFrames(map, airports) {
  if (!map) return [];

  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return [];

  const scale = getPointerScale(map.getZoom());

  return airports
    .map((airport) => {
      const anchor = map.project([airport.lon, airport.lat]);
      if (!Number.isFinite(anchor?.x) || !Number.isFinite(anchor?.y)) return null;

      if (
        anchor.x < -EDGE_MARGIN
        || anchor.y < -EDGE_MARGIN
        || anchor.x > width + EDGE_MARGIN
        || anchor.y > height + EDGE_MARGIN
      ) {
        return null;
      }

      return buildPointerFrame(anchor, width, airport, scale);
    })
    .filter(Boolean);
}

export default function LidcMapAirportPointers({ map }) {
  const [frames, setFrames] = useState([]);

  useEffect(() => {
    if (!map) return undefined;

    const syncFrames = () => {
      setFrames(buildPointerFrames(map, LIDC_AFGHANISTAN_AIRPORTS));
    };

    syncFrames();
    map.on('move', syncFrames);
    map.on('zoom', syncFrames);
    map.on('resize', syncFrames);
    map.on('load', syncFrames);

    return () => {
      map.off('move', syncFrames);
      map.off('zoom', syncFrames);
      map.off('resize', syncFrames);
      map.off('load', syncFrames);
    };
  }, [map]);

  return (
    <div className="lidc-map-pointers" aria-hidden={frames.length === 0}>
      <svg className="lidc-map-pointers__svg">
        {frames.map((frame) => (
          <g
            key={frame.airport.id}
            className="lidc-map-pointers__group"
            style={{ '--pointer-accent': frame.airport.highlightColor }}
          >
            <path
              className="lidc-map-pointers__line"
              d={`M ${frame.anchor.x} ${frame.anchor.y} L ${frame.elbow.x} ${frame.elbow.y} L ${frame.underlineStart.x} ${frame.underlineStart.y} L ${frame.underlineEnd.x} ${frame.underlineEnd.y}`}
              strokeWidth={frame.strokeWidth}
            />
            <circle
              className="lidc-map-pointers__dot"
              cx={frame.anchor.x}
              cy={frame.anchor.y}
              r={frame.dotRadius}
              strokeWidth={Math.max(1, frame.strokeWidth * 0.6)}
            />
          </g>
        ))}
      </svg>
      {frames.map((frame) => (
        <div
          key={`${frame.airport.id}-label`}
          className={`lidc-map-pointers__label lidc-map-pointers__label--${frame.side}`}
          style={{
            left: `${frame.label.x}px`,
            top: `${frame.label.y}px`,
            transform: `translate(0, -100%) scale(${frame.scale})`,
            transformOrigin: frame.side === 'left' ? 'right bottom' : 'left bottom',
            '--pointer-accent': frame.airport.highlightColor,
          }}
        >
          <span className="lidc-map-pointers__label-type">{frame.airport.subtitle}</span>
          <span className="lidc-map-pointers__label-name">{frame.airport.name}</span>
        </div>
      ))}
    </div>
  );
}
