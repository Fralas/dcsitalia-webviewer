import { useEffect, useRef, useState } from 'react';
import { CAMPAIGNS } from '../../config/campaigns';

const POINTER_ALTITUDE = 0.02;
const OUTWARD_PX = 22;
const ARM_PX = 8;
const SMOOTHING = 0.12;
const MAX_STEP_PX = 22;
const FADE_IN_STEP = 0.1;
const FADE_OUT_STEP = 0.14;

function latLngToUnit(lat, lng) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return {
    x: -Math.sin(phi) * Math.cos(theta),
    y: Math.cos(phi),
    z: Math.sin(phi) * Math.sin(theta),
  };
}

function isFacingCamera(lat, lng, pov) {
  const point = latLngToUnit(lat, lng);
  const cam = latLngToUnit(pov.lat, pov.lng);
  return point.x * cam.x + point.y * cam.y + point.z * cam.z > 0.08;
}

function underlineWidthForCampaign(campaign) {
  const text = campaign.theaterName || '';
  return Math.min(120, Math.max(36, Math.round(text.length * 6.5)));
}

function computePointerGeometry(anchor, center, side = 'right', underlineWidth = 72) {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const elbow = {
    x: anchor.x + ux * OUTWARD_PX,
    y: anchor.y + uy * OUTWARD_PX,
  };

  let underlineStart;
  let underlineEnd;
  let label;

  switch (side) {
    case 'left':
      underlineEnd = { x: elbow.x - ARM_PX, y: elbow.y };
      underlineStart = { x: underlineEnd.x - underlineWidth, y: elbow.y };
      label = { ...underlineStart };
      break;
    case 'top':
      underlineEnd = { x: elbow.x, y: elbow.y - ARM_PX };
      underlineStart = { x: underlineEnd.x - underlineWidth / 2, y: underlineEnd.y };
      label = { x: underlineStart.x, y: underlineEnd.y };
      break;
    case 'bottom':
      underlineEnd = { x: elbow.x, y: elbow.y + ARM_PX };
      underlineStart = { x: underlineEnd.x - underlineWidth / 2, y: underlineEnd.y };
      label = { x: underlineStart.x, y: underlineEnd.y };
      break;
    case 'right':
    default:
      underlineStart = { x: elbow.x + ARM_PX, y: elbow.y };
      underlineEnd = { x: underlineStart.x + underlineWidth, y: elbow.y };
      label = { ...underlineStart };
      break;
  }

  return { anchor, elbow, underlineStart, underlineEnd, label, side };
}

function buildPointerTargets(globe, container, campaigns) {
  if (!globe || !container) return [];

  const { width, height } = container.getBoundingClientRect();
  if (!width || !height) return [];

  const center = { x: width / 2, y: height / 2 };
  const pov = globe.pointOfView();

  return campaigns
    .map((campaign) => {
      const anchorCoords = campaign.pointerAnchor;
      if (!anchorCoords) return null;

      if (!isFacingCamera(anchorCoords.lat, anchorCoords.lng, pov)) {
        return null;
      }

      const screen = globe.getScreenCoords(
        anchorCoords.lat,
        anchorCoords.lng,
        POINTER_ALTITUDE,
      );
      if (!screen || !Number.isFinite(screen.x) || !Number.isFinite(screen.y)) {
        return null;
      }

      const anchor = { x: screen.x, y: screen.y };
      const distFromCenter = Math.hypot(anchor.x - center.x, anchor.y - center.y);
      const maxRadius = Math.min(width, height) * 0.46;
      if (distFromCenter > maxRadius) return null;

      const underlineWidth = underlineWidthForCampaign(campaign);
      const geometry = computePointerGeometry(anchor, center, campaign.pointerSide || 'right', underlineWidth);
      return {
        campaign,
        ...geometry,
      };
    })
    .filter(Boolean);
}

function smoothPoint(current, target, alpha) {
  if (!current) return { ...target };
  let dx = target.x - current.x;
  let dy = target.y - current.y;
  const dist = Math.hypot(dx, dy);
  if (dist > MAX_STEP_PX) {
    const scale = MAX_STEP_PX / dist;
    dx *= scale;
    dy *= scale;
    return { x: current.x + dx, y: current.y + dy };
  }
  return {
    x: current.x + dx * alpha,
    y: current.y + dy * alpha,
  };
}

function smoothPointerFrame(previous, targets) {
  const targetById = new Map(targets.map((entry) => [entry.campaign.id, entry]));
  const next = [];
  const seen = new Set();

  targetById.forEach((target, id) => {
    seen.add(id);
    const prev = previous.get(id);
    const opacity = Math.min(1, (prev?.opacity ?? 0) + FADE_IN_STEP);
    const smoothed = {
      campaign: target.campaign,
      anchor: smoothPoint(prev?.anchor, target.anchor, SMOOTHING),
      elbow: smoothPoint(prev?.elbow, target.elbow, SMOOTHING),
      underlineStart: smoothPoint(prev?.underlineStart, target.underlineStart, SMOOTHING),
      underlineEnd: smoothPoint(prev?.underlineEnd, target.underlineEnd, SMOOTHING),
      label: smoothPoint(prev?.label, target.label, SMOOTHING),
      side: target.side,
      opacity,
    };
    previous.set(id, smoothed);
    next.push(smoothed);
  });

  previous.forEach((prev, id) => {
    if (seen.has(id)) return;
    const opacity = Math.max(0, (prev.opacity ?? 1) - FADE_OUT_STEP);
    if (opacity <= 0.02) {
      previous.delete(id);
      return;
    }
    const faded = { ...prev, opacity };
    previous.set(id, faded);
    next.push(faded);
  });

  return next;
}

export default function CampaignPointers({ globe, selectedCampaignId, onSelect }) {
  const overlayRef = useRef(null);
  const smoothedRef = useRef(new Map());
  const [pointers, setPointers] = useState([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!globe) return undefined;

    const tick = () => {
      const container = overlayRef.current?.parentElement;
      if (container) {
        const targets = buildPointerTargets(globe, container, CAMPAIGNS);
        const next = smoothPointerFrame(smoothedRef.current, targets);
        setPointers(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver(() => {
      smoothedRef.current.clear();
    });
    if (overlayRef.current?.parentElement) {
      resizeObserver.observe(overlayRef.current.parentElement);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      smoothedRef.current.clear();
    };
  }, [globe]);

  return (
    <div ref={overlayRef} className="campaign-pointers" role="tablist" aria-label="Campaigns">
      <svg className="campaign-pointers__svg">
        {pointers.map(({ campaign, anchor, elbow, underlineStart, underlineEnd, label, opacity }) => {
          const isActive = campaign.id === selectedCampaignId;
          const accent = campaign.highlightColor || '#FF6B01';
          return (
          <g
            key={campaign.id}
            style={{
              opacity,
              ...(isActive ? { '--pointer-accent': accent } : {}),
            }}
          >
            <circle
              className={`campaign-pointers__dot${isActive ? ' is-active' : ''}`}
              cx={anchor.x}
              cy={anchor.y}
              r={3}
            />
            <path
              className={`campaign-pointers__line${isActive ? ' is-active' : ''}`}
              d={`M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineStart.x} ${underlineStart.y} L ${underlineEnd.x} ${underlineEnd.y}`}
            />
          </g>
          );
        })}
      </svg>

      {pointers.map(({ campaign, label, side, opacity }) => {
        const isActive = campaign.id === selectedCampaignId;
        const accent = campaign.highlightColor || '#FF6B01';
        const sideClass = side || campaign.pointerSide || 'right';
        return (
          <button
            key={campaign.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`campaign-pointers__label campaign-pointers__label--${sideClass}${isActive ? ' is-active' : ''}`}
            style={{
              left: `${label.x}px`,
              top: `${label.y}px`,
              opacity,
              '--pointer-accent': accent,
            }}
            onClick={() => onSelect(campaign.id)}
          >
            <span className="campaign-pointers__label-type">{campaign.type}</span>
            <span className="campaign-pointers__label-name">{campaign.theaterName}</span>
          </button>
        );
      })}
    </div>
  );
}
