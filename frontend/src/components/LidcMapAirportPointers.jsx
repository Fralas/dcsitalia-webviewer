import { useEffect, useState } from 'react';
import { LIDC_AFGHANISTAN_AIRPORTS } from '../config/lidcAfghanistanAirports';
import { t } from '../utils/locale';

const BASE_OUTWARD_PX = 44;
const BASE_LABEL_GAP_PX = 2;
const BASE_DOT_RADIUS = 5;
const BASE_TYPE_FONT_PX = 11;
const BASE_NAME_FONT_PX = 13;
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

function buildPointerPath(side, anchor, elbow, underlineStart, underlineEnd) {
  if (side === 'left') {
    return `M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineEnd.x} ${underlineEnd.y} L ${underlineStart.x} ${underlineStart.y}`;
  }
  return `M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineStart.x} ${underlineStart.y} L ${underlineEnd.x} ${underlineEnd.y}`;
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

  if (side === 'left') {
    underlineEnd = { x: elbow.x - labelGapPx, y: elbow.y };
    underlineStart = { x: underlineEnd.x - underlineWidth, y: elbow.y };
  } else {
    underlineStart = { x: elbow.x + labelGapPx, y: elbow.y };
    underlineEnd = { x: underlineStart.x + underlineWidth, y: elbow.y };
  }

  return {
    airport,
    anchor,
    elbow,
    underlineStart,
    underlineEnd,
    label: { ...underlineStart },
    labelWidth: underlineWidth,
    side,
    scale,
    dotRadius: BASE_DOT_RADIUS * scale,
    strokeWidth: Math.max(1.4, 2.5 * scale),
    typeFontSize: BASE_TYPE_FONT_PX * scale,
    nameFontSize: BASE_NAME_FONT_PX * scale,
    pathD: buildPointerPath(side, anchor, elbow, underlineStart, underlineEnd),
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

export default function LidcMapAirportPointers({
  map,
  selectedAirportId = '',
  onSelectAirport = null,
  orderAlerts = {},
}) {
  const [frames, setFrames] = useState([]);
  const selectable = typeof onSelectAirport === 'function';

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
    <div
      className={`lidc-map-pointers ${selectable ? 'is-selectable' : ''}`}
      aria-hidden={selectable ? undefined : frames.length === 0}
    >
      <svg className="lidc-map-pointers__svg">
        {frames.map((frame) => {
          const isSelected = frame.airport.id === selectedAirportId;
          const orderCount = Math.max(0, Math.floor(Number(orderAlerts[frame.airport.id]) || 0));
          const hasOrders = orderCount > 0;
          return (
            <g
              key={frame.airport.id}
              className={`lidc-map-pointers__group ${isSelected ? 'is-selected' : ''} ${selectable ? 'is-selectable' : ''} ${hasOrders ? 'has-orders' : ''}`}
              style={{ '--pointer-accent': isSelected ? '#ffbb00' : frame.airport.highlightColor }}
            >
              <path
                className="lidc-map-pointers__line"
                d={frame.pathD}
                strokeWidth={frame.strokeWidth}
              />
              {selectable && (
                <circle
                  className="lidc-map-pointers__hit"
                  cx={frame.anchor.x}
                  cy={frame.anchor.y}
                  r={Math.max(16, frame.dotRadius * 3.2)}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectAirport(frame.airport.id);
                  }}
                />
              )}
              {hasOrders && (
                <circle
                  className="lidc-map-pointers__pulse"
                  cx={frame.anchor.x}
                  cy={frame.anchor.y}
                  r={frame.dotRadius}
                />
              )}
              <circle
                className="lidc-map-pointers__dot"
                cx={frame.anchor.x}
                cy={frame.anchor.y}
                r={frame.dotRadius}
                strokeWidth={Math.max(1, frame.strokeWidth * 0.6)}
              />
            </g>
          );
        })}
      </svg>
      {frames.map((frame) => {
        const isSelected = frame.airport.id === selectedAirportId;
        const orderCount = Math.max(0, Math.floor(Number(orderAlerts[frame.airport.id]) || 0));
        const LabelTag = selectable ? 'button' : 'div';
        const alertLabel = orderCount > 0 ? t('lidc.map.occupancy.orderAlert', { count: orderCount }) : '';
        return (
          <LabelTag
            key={`${frame.airport.id}-label`}
            type={selectable ? 'button' : undefined}
            className={`lidc-map-pointers__label ${selectable ? 'is-selectable' : ''} ${isSelected ? 'is-selected' : ''}`}
            style={{
              left: `${frame.label.x}px`,
              top: `${frame.label.y}px`,
              width: `${frame.labelWidth}px`,
              transform: 'translate(0, -100%)',
              '--pointer-accent': isSelected ? '#ffbb00' : frame.airport.highlightColor,
            }}
            onClick={selectable ? (event) => {
              event.stopPropagation();
              onSelectAirport(frame.airport.id);
            } : undefined}
            aria-pressed={selectable ? isSelected : undefined}
            aria-label={selectable
              ? `${frame.airport.name} ${frame.airport.subtitle}${alertLabel ? `, ${alertLabel}` : ''}`
              : undefined}
          >
            <span
              className="lidc-map-pointers__label-type"
              style={{ fontSize: `${frame.typeFontSize}px` }}
            >
              {frame.airport.subtitle}
            </span>
            <span
              className="lidc-map-pointers__label-name"
              style={{ fontSize: `${frame.nameFontSize}px` }}
            >
              {frame.airport.name}
            </span>
          </LabelTag>
        );
      })}
    </div>
  );
}
