import { useCallback, useEffect, useRef, useState } from 'react';
import { CAMPAIGNS } from '../../config/campaigns';

const POINTER_ALTITUDE = 0.02;
const OUTWARD_PX = 30;
const ARM_PX = 72;

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

function computePointerGeometry(anchor, center) {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  const elbow = {
    x: anchor.x + ux * OUTWARD_PX,
    y: anchor.y + uy * OUTWARD_PX,
  };

  const horizontal = Math.abs(ux) >= Math.abs(uy);
  let label;
  if (horizontal) {
    const dir = ux >= 0 ? 1 : -1;
    label = { x: elbow.x + dir * ARM_PX, y: elbow.y };
  } else {
    const dir = uy >= 0 ? 1 : -1;
    label = { x: elbow.x, y: elbow.y + dir * 40 };
  }

  return { anchor, elbow, label };
}

function buildPointerState(globe, container, campaigns) {
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

      const geometry = computePointerGeometry(anchor, center);
      return {
        campaign,
        ...geometry,
      };
    })
    .filter(Boolean);
}

export default function CampaignPointers({ globe, selectedCampaignId, onSelect }) {
  const overlayRef = useRef(null);
  const [pointers, setPointers] = useState([]);
  const rafRef = useRef(0);

  const updatePointers = useCallback(() => {
    const container = overlayRef.current?.parentElement;
    if (!container || !globe) return;
    setPointers(buildPointerState(globe, container, CAMPAIGNS));
  }, [globe]);

  useEffect(() => {
    if (!globe) return undefined;

    const tick = () => {
      updatePointers();
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    const controls = globe.controls?.();
    const onControlChange = () => updatePointers();
    controls?.addEventListener?.('change', onControlChange);

    const resizeObserver = new ResizeObserver(updatePointers);
    if (overlayRef.current?.parentElement) {
      resizeObserver.observe(overlayRef.current.parentElement);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      controls?.removeEventListener?.('change', onControlChange);
      resizeObserver.disconnect();
    };
  }, [globe, updatePointers]);

  return (
    <div ref={overlayRef} className="campaign-pointers" role="tablist" aria-label="Campaigns">
      <svg className="campaign-pointers__svg">
        {pointers.map(({ campaign, anchor, elbow, label }) => (
          <g key={campaign.id}>
            <circle
              className={`campaign-pointers__dot${campaign.id === selectedCampaignId ? ' is-active' : ''}`}
              cx={anchor.x}
              cy={anchor.y}
              r={3}
            />
            <path
              className={`campaign-pointers__line${campaign.id === selectedCampaignId ? ' is-active' : ''}`}
              d={`M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${label.x} ${label.y}`}
            />
          </g>
        ))}
      </svg>

      {pointers.map(({ campaign, label }) => {
        const isActive = campaign.id === selectedCampaignId;
        const accent = campaign.highlightColor || '#FF6B01';
        return (
          <button
            key={campaign.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`campaign-pointers__label${isActive ? ' is-active' : ''}`}
            style={{
              left: `${label.x}px`,
              top: `${label.y}px`,
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
