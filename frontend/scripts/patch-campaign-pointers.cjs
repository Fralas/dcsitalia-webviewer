const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../src/components/landing/CampaignPointers.jsx');

const content = `import { useEffect, useRef, useState } from 'react';
import { CAMPAIGNS } from '../../config/campaigns';

const POINTER_CAMPAIGNS = CAMPAIGNS.filter((campaign) => campaign.showPointer !== false);

const POINTER_ALTITUDE = 0.02;
const OUTWARD_PX = 52;
const ARM_PX = 22;
const FADE_IN_STEP = 0.1;
const FADE_OUT_STEP = 0.14;
const DOT_RADIUS = 5;
const SNAP_ANGLE_DEG = 60;

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
  return Math.min(160, Math.max(48, Math.round(text.length * 8.5)));
}

function normalizeVector(vector) {
  const len = Math.hypot(vector.x, vector.y) || 1;
  return { x: vector.x / len, y: vector.y / len };
}

function computeStemDirection(anchor, center) {
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;
  const len = Math.hypot(dx, dy) || 1;
  const upward = Math.max(Math.abs(dy), len * 0.25) / len;
  return normalizeVector({
    x: dx / len,
    y: -upward,
  });
}

function elbowInternalAngleDeg(anchor, elbow, armEnd) {
  const ax = anchor.x - elbow.x;
  const ay = anchor.y - elbow.y;
  const bx = armEnd.x - elbow.x;
  const by = armEnd.y - elbow.y;
  const dot = ax * bx + ay * by;
  const cross = ax * by - ay * bx;
  return Math.atan2(Math.abs(cross), dot) * (180 / Math.PI);
}

function armEndForSide(elbow, side) {
  return side === 'left'
    ? { x: elbow.x - ARM_PX, y: elbow.y }
    : { x: elbow.x + ARM_PX, y: elbow.y };
}

function resolvePointerSide(anchor, elbow, preferredSide, previousSide) {
  const preferred = preferredSide === 'left' ? 'left' : 'right';
  const opposite = preferred === 'left' ? 'right' : 'left';

  const angleFor = (side) => (
    elbowInternalAngleDeg(anchor, elbow, armEndForSide(elbow, side))
  );

  const preferredAngle = angleFor(preferred);
  const oppositeAngle = angleFor(opposite);

  if (previousSide === 'left' || previousSide === 'right') {
    const activeAngle = angleFor(previousSide);
    if (activeAngle >= SNAP_ANGLE_DEG) return previousSide;
    return previousSide === 'left' ? 'right' : 'left';
  }

  if (preferredAngle >= SNAP_ANGLE_DEG) return preferred;
  if (oppositeAngle >= SNAP_ANGLE_DEG) return opposite;
  return oppositeAngle > preferredAngle ? opposite : preferred;
}

function computePointerGeometry(anchor, center, side = 'right', underlineWidth = 72) {
  const stemDir = computeStemDirection(anchor, center);
  const elbow = {
    x: anchor.x + stemDir.x * OUTWARD_PX,
    y: anchor.y + stemDir.y * OUTWARD_PX,
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
    case 'right':
    default:
      underlineStart = { x: elbow.x + ARM_PX, y: elbow.y };
      underlineEnd = { x: underlineStart.x + underlineWidth, y: elbow.y };
      label = { ...underlineStart };
      break;
  }

  return { anchor, elbow, underlineStart, underlineEnd, label, side };
}

function buildPointerTargets(globe, container, campaigns, sideByCampaign) {
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
        sideByCampaign.delete(campaign.id);
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
      if (distFromCenter > maxRadius) {
        sideByCampaign.delete(campaign.id);
        return null;
      }

      const underlineWidth = underlineWidthForCampaign(campaign);
      const preferredSide = campaign.pointerSide || 'right';
      const previousSide = sideByCampaign.get(campaign.id) || null;
      const stemDir = computeStemDirection(anchor, center);
      const elbow = {
        x: anchor.x + stemDir.x * OUTWARD_PX,
        y: anchor.y + stemDir.y * OUTWARD_PX,
      };
      const side = resolvePointerSide(anchor, elbow, preferredSide, previousSide);
      sideByCampaign.set(campaign.id, side);

      const geometry = computePointerGeometry(anchor, center, side, underlineWidth);
      return {
        campaign,
        ...geometry,
      };
    })
    .filter(Boolean);
}

function applyPointerOpacity(previous, targets) {
  const targetById = new Map(targets.map((entry) => [entry.campaign.id, entry]));
  const next = [];
  const seen = new Set();

  targetById.forEach((target, id) => {
    seen.add(id);
    const prev = previous.get(id);
    const opacity = Math.min(1, (prev?.opacity ?? 0) + FADE_IN_STEP);
    const frame = { ...target, opacity };
    previous.set(id, frame);
    next.push(frame);
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
  const sideByCampaignRef = useRef(new Map());
  const [pointers, setPointers] = useState([]);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!globe) return undefined;

    const tick = () => {
      const container = overlayRef.current?.parentElement;
      if (container) {
        const targets = buildPointerTargets(
          globe,
          container,
          POINTER_CAMPAIGNS,
          sideByCampaignRef.current,
        );
        const next = applyPointerOpacity(smoothedRef.current, targets);
        setPointers(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const resizeObserver = new ResizeObserver(() => {
      smoothedRef.current.clear();
      sideByCampaignRef.current.clear();
    });
    if (overlayRef.current?.parentElement) {
      resizeObserver.observe(overlayRef.current.parentElement);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      resizeObserver.disconnect();
      smoothedRef.current.clear();
      sideByCampaignRef.current.clear();
    };
  }, [globe]);

  return (
    <div ref={overlayRef} className="campaign-pointers" role="tablist" aria-label="Campaigns">
      <svg className="campaign-pointers__svg">
        {pointers.map(({ campaign, anchor, elbow, underlineStart, underlineEnd, opacity }) => {
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
                className={\`campaign-pointers__dot\${isActive ? ' is-active' : ''}\`}
                cx={anchor.x}
                cy={anchor.y}
                r={DOT_RADIUS}
              />
              <path
                className={\`campaign-pointers__line\${isActive ? ' is-active' : ''}\`}
                d={\`M \${anchor.x} \${anchor.y} L \${elbow.x} \${elbow.y} L \${underlineStart.x} \${underlineStart.y} L \${underlineEnd.x} \${underlineEnd.y}\`}
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
            className={\`campaign-pointers__label campaign-pointers__label--\${sideClass}\${isActive ? ' is-active' : ''}\`}
            style={{
              left: \`\${label.x}px\`,
              top: \`\${label.y}px\`,
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
`;

fs.writeFileSync(target, content.replace(/^\uFEFF/, ''), 'utf8');

const head = fs.readFileSync(target);
if (head[1] === 0) {
  throw new Error('File still UTF-16');
}

require('@babel/parser').parse(head.toString('utf8'), {
  sourceType: 'module',
  plugins: ['jsx'],
});

console.log('CampaignPointers.jsx written OK');
