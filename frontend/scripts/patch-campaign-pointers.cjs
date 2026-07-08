const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, '../src/components/landing/CampaignPointers.jsx');

const content = `import { useEffect, useRef } from 'react';
import { CAMPAIGNS } from '../../config/campaigns';

const POINTER_CAMPAIGNS = CAMPAIGNS.filter((campaign) => campaign.showPointer !== false);
const SVG_NS = 'http://www.w3.org/2000/svg';

const POINTER_ALTITUDE = 0.02;
const OUTWARD_PX = 52;
const ARM_PX = 22;
const FADE_IN_STEP = 0.1;
const FADE_OUT_STEP = 0.14;
const DOT_RADIUS = 5;
const SNAP_ANGLE_DEG = 60;
const MIN_ELBOW_ANGLE_DEG = SNAP_ANGLE_DEG;
const VERTICAL_DOWN_SNAP_FROM_BOTTOM = 0.35;
const VERTICAL_UP_SNAP_FROM_BOTTOM = 0.4;

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

function stemVertical(stemDir) {
  return stemDir.y <= 0 ? 'up' : 'down';
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

function scorePointerLayout(anchor, stemDir, side) {
  const elbow = {
    x: anchor.x + stemDir.x * OUTWARD_PX,
    y: anchor.y + stemDir.y * OUTWARD_PX,
  };
  return {
    stemDir,
    vertical: stemVertical(stemDir),
    side,
    elbow,
    angle: elbowInternalAngleDeg(anchor, elbow, armEndForSide(elbow, side)),
  };
}

function canonicalStemForVertical(anchor, center, vertical) {
  const dx = anchor.x - center.x;
  const leanX = Math.max(-0.45, Math.min(0.45, dx / 220));
  return vertical === 'down'
    ? normalizeVector({ x: leanX, y: 1 })
    : normalizeVector({ x: leanX, y: -1 });
}

function buildLayoutForVertical(anchor, center, vertical, side) {
  const stems = [
    canonicalStemForVertical(anchor, center, vertical),
    normalizeVector({ x: 0.25, y: vertical === 'down' ? 1 : -1 }),
  ];

  for (const stemDir of stems) {
    const layout = scorePointerLayout(anchor, stemDir, side);
    if (layout.angle >= MIN_ELBOW_ANGLE_DEG && layout.vertical === vertical) {
      return layout;
    }
  }

  return scorePointerLayout(anchor, stems[0], side);
}

function resolvePreferredVertical(anchor, containerHeight, previousVertical) {
  const downSnapY = containerHeight * (1 - VERTICAL_DOWN_SNAP_FROM_BOTTOM);
  const upSnapY = containerHeight * (1 - VERTICAL_UP_SNAP_FROM_BOTTOM);

  if (previousVertical === 'down') {
    if (anchor.y < upSnapY) return 'up';
    return 'down';
  }

  if (anchor.y > downSnapY) return 'down';
  return 'up';
}

function resolvePointerSide(anchor, center, vertical, preferredSide, previousSide) {
  const preferred = preferredSide === 'left' ? 'left' : 'right';
  const opposite = preferred === 'left' ? 'right' : 'left';
  const angleFor = (side) => buildLayoutForVertical(anchor, center, vertical, side).angle;

  if (previousSide === 'left' || previousSide === 'right') {
    if (angleFor(previousSide) >= MIN_ELBOW_ANGLE_DEG) return previousSide;
    return opposite;
  }

  if (angleFor(preferred) >= MIN_ELBOW_ANGLE_DEG) return preferred;
  if (angleFor(opposite) >= MIN_ELBOW_ANGLE_DEG) return opposite;
  return preferred;
}

function resolvePointerLayout(anchor, center, containerHeight, preferredSide, previousLayout) {
  const prevVertical = previousLayout?.vertical === 'down' ? 'down' : 'up';
  const prevSide = previousLayout?.side === 'left' ? 'left' : 'right';
  const offsetY = anchor.y - center.y;
  const vertical = resolvePreferredVertical(anchor, containerHeight, prevVertical);
  const verticalChanged = vertical !== prevVertical;
  const side = resolvePointerSide(
    anchor,
    center,
    vertical,
    preferredSide,
    verticalChanged ? null : prevSide,
  );
  return { ...buildLayoutForVertical(anchor, center, vertical, side), offsetY };
}

function computePointerGeometry(anchor, layout, underlineWidth = 72) {
  const { elbow, side, vertical } = layout;

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

  return { anchor, elbow, underlineStart, underlineEnd, label, side, vertical };
}

function buildPointerTargets(globe, container, campaigns, layoutByCampaign) {
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
        layoutByCampaign.delete(campaign.id);
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
        layoutByCampaign.delete(campaign.id);
        return null;
      }

      const underlineWidth = underlineWidthForCampaign(campaign);
      const preferredSide = campaign.pointerSide || 'right';
      const previousLayout = layoutByCampaign.get(campaign.id) || null;
      const layout = resolvePointerLayout(anchor, center, height, preferredSide, previousLayout);
      layoutByCampaign.set(campaign.id, {
        vertical: layout.vertical,
        side: layout.side,
        offsetY: layout.offsetY,
      });

      const geometry = computePointerGeometry(anchor, layout, underlineWidth);
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

function ensurePointerEntry(domById, overlay, campaign) {
  let entry = domById.get(campaign.id);
  if (entry) return entry;

  const svg = overlay.querySelector('.campaign-pointers__svg');
  const g = document.createElementNS(SVG_NS, 'g');
  const circle = document.createElementNS(SVG_NS, 'circle');
  circle.setAttribute('class', 'campaign-pointers__dot');
  circle.setAttribute('r', String(DOT_RADIUS));

  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('class', 'campaign-pointers__line');

  g.appendChild(circle);
  g.appendChild(path);
  svg.appendChild(g);

  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('role', 'tab');
  const sideClass = campaign.pointerSide || 'right';
  button.className = \`campaign-pointers__label campaign-pointers__label--\${sideClass}\`;

  const typeSpan = document.createElement('span');
  typeSpan.className = 'campaign-pointers__label-type';
  typeSpan.textContent = campaign.type;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'campaign-pointers__label-name';
  nameSpan.textContent = campaign.theaterName;

  button.appendChild(typeSpan);
  button.appendChild(nameSpan);
  overlay.appendChild(button);

  entry = { g, circle, path, button, sideClass, campaign };
  domById.set(campaign.id, entry);
  return entry;
}

function paintPointerEntry(entry, frame, isActive) {
  const accent = entry.campaign.highlightColor || '#FF8C00';
  const opacity = frame?.opacity ?? 0;
  const visible = opacity > 0.02;

  entry.g.style.opacity = String(opacity);
  entry.button.style.opacity = String(opacity);
  entry.g.style.display = visible ? '' : 'none';
  entry.button.style.display = visible ? '' : 'none';

  if (!frame || !visible) return;

  entry.circle.setAttribute('cx', String(frame.anchor.x));
  entry.circle.setAttribute('cy', String(frame.anchor.y));
  entry.path.setAttribute(
    'd',
    \`M \${frame.anchor.x} \${frame.anchor.y} L \${frame.elbow.x} \${frame.elbow.y} L \${frame.underlineStart.x} \${frame.underlineStart.y} L \${frame.underlineEnd.x} \${frame.underlineEnd.y}\`,
  );
  entry.button.style.left = \`\${frame.label.x}px\`;
  entry.button.style.top = \`\${frame.label.y}px\`;

  const sideClass = frame.side || entry.sideClass;
  entry.button.className = \`campaign-pointers__label campaign-pointers__label--\${sideClass}\${isActive ? ' is-active' : ''}\`;
  entry.circle.setAttribute('class', \`campaign-pointers__dot\${isActive ? ' is-active' : ''}\`);
  entry.path.setAttribute('class', \`campaign-pointers__line\${isActive ? ' is-active' : ''}\`);
  entry.button.setAttribute('aria-selected', isActive ? 'true' : 'false');

  entry.g.style.setProperty('--pointer-accent', accent);
  entry.button.style.setProperty('--pointer-accent', accent);
}

export default function CampaignPointers({ globe, selectedCampaignId, onSelect }) {
  const overlayRef = useRef(null);
  const domByIdRef = useRef(new Map());
  const smoothedRef = useRef(new Map());
  const layoutByCampaignRef = useRef(new Map());
  const rafRef = useRef(0);
  const selectedRef = useRef(selectedCampaignId);
  const onSelectRef = useRef(onSelect);

  selectedRef.current = selectedCampaignId;
  onSelectRef.current = onSelect;

  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return undefined;

    POINTER_CAMPAIGNS.forEach((campaign) => {
      const entry = ensurePointerEntry(domByIdRef.current, overlay, campaign);
      entry.button.onclick = () => onSelectRef.current?.(campaign.id);
    });

    return () => {
      domByIdRef.current.forEach((entry) => {
        entry.g.remove();
        entry.button.remove();
      });
      domByIdRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!globe) return undefined;

    const syncFrame = () => {
      const container = overlayRef.current?.parentElement;
      const overlay = overlayRef.current;
      if (!container || !overlay) return;

      const targets = buildPointerTargets(
        globe,
        container,
        POINTER_CAMPAIGNS,
        layoutByCampaignRef.current,
      );
      const frames = applyPointerOpacity(smoothedRef.current, targets);
      const framesById = new Map(frames.map((frame) => [frame.campaign.id, frame]));

      POINTER_CAMPAIGNS.forEach((campaign) => {
        const entry = ensurePointerEntry(domByIdRef.current, overlay, campaign);
        paintPointerEntry(
          entry,
          framesById.get(campaign.id) || null,
          campaign.id === selectedRef.current,
        );
      });
    };

    const tick = () => {
      syncFrame();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    const controls = globe.controls?.();
    controls?.addEventListener?.('change', syncFrame);

    const resizeObserver = new ResizeObserver(() => {
      smoothedRef.current.clear();
      layoutByCampaignRef.current.clear();
      syncFrame();
    });
    if (overlayRef.current?.parentElement) {
      resizeObserver.observe(overlayRef.current.parentElement);
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      controls?.removeEventListener?.('change', syncFrame);
      resizeObserver.disconnect();
      smoothedRef.current.clear();
      layoutByCampaignRef.current.clear();
    };
  }, [globe]);

  useEffect(() => {
    domByIdRef.current.forEach((entry, id) => {
      const frame = smoothedRef.current.get(id);
      if (frame) {
        paintPointerEntry(entry, frame, id === selectedCampaignId);
      }
    });
  }, [selectedCampaignId]);

  return (
    <div ref={overlayRef} className="campaign-pointers" role="tablist" aria-label="Campaigns">
      <svg className="campaign-pointers__svg" />
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
