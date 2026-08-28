import { useEffect, useRef } from 'react';

const SEGMENT_COUNT = 26;
const GRAVITY = 0.24;
const FRICTION = 0.985;
const CONSTRAINT_ITERATIONS = 10;
const MOUSE_RADIUS = 78;
const MOUSE_STRENGTH = 5.2;

function createPoints(anchorA, anchorB, count) {
  const points = [];
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const x = anchorA.x + (anchorB.x - anchorA.x) * t;
    const y = anchorA.y + (anchorB.y - anchorA.y) * t;
    points.push({
      x,
      y,
      prevX: x,
      prevY: y,
      pinned: i === 0 || i === count,
    });
  }
  return points;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function getLocalPoint(clientX, clientY, container) {
  const rect = container.getBoundingClientRect();
  const scaleX = container.offsetWidth > 0 ? rect.width / container.offsetWidth : 1;
  const scaleY = container.offsetHeight > 0 ? rect.height / container.offsetHeight : 1;

  return {
    x: (clientX - rect.left) / scaleX,
    y: (clientY - rect.top) / scaleY,
  };
}

function getAnchorPoint(pinEl, anchorNorm, container) {
  if (!pinEl || !container) return null;

  const pinRect = pinEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const scaleX = container.offsetWidth > 0 ? containerRect.width / container.offsetWidth : 1;
  const scaleY = container.offsetHeight > 0 ? containerRect.height / container.offsetHeight : 1;

  return {
    x: (pinRect.left - containerRect.left) / scaleX + (pinRect.width / scaleX) * anchorNorm.x,
    y: (pinRect.top - containerRect.top) / scaleY + (pinRect.height / scaleY) * anchorNorm.y,
  };
}

function setPinTransform(group, x, y) {
  if (!group) return;
  group.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
}

export default function LidcStorylineWhiteboardString({
  connection,
  pinRefs,
  containerRef,
  interactive = true,
}) {
  const svgRef = useRef(null);
  const pointsRef = useRef([]);
  const mouseRef = useRef({ x: -9999, y: -9999, active: false });
  const anchorsRef = useRef({ a: { x: 0, y: 0 }, b: { x: 0, y: 0 } });
  const rafRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) return undefined;

    const pathEl = svg.querySelector('.lidc-whiteboard-string-path');
    const hitEl = svg.querySelector('.lidc-whiteboard-string-hit');
    const pinFrom = svg.querySelector('[data-pin="from"]');
    const pinTo = svg.querySelector('[data-pin="to"]');

    const readAnchors = () => {
      const fromPin = pinRefs.current[connection.from];
      const toPin = pinRefs.current[connection.to];
      const a = getAnchorPoint(fromPin, connection.fromAnchor, container);
      const b = getAnchorPoint(toPin, connection.toAnchor, container);

      if (a && b) {
        anchorsRef.current = { a, b };
        if (pointsRef.current.length !== SEGMENT_COUNT + 1) {
          pointsRef.current = createPoints(a, b, SEGMENT_COUNT);
        }
      }
    };

    const onPointerMove = (event) => {
      if (!interactive) {
        mouseRef.current.active = false;
        return;
      }
      mouseRef.current = { ...getLocalPoint(event.clientX, event.clientY, container), active: true };
    };

    const onPointerLeave = () => {
      mouseRef.current.active = false;
    };

    const observer = new ResizeObserver(readAnchors);
    observer.observe(container);
    Object.values(pinRefs.current).forEach((el) => {
      if (el) observer.observe(el);
    });

    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerleave', onPointerLeave);

    const step = () => {
      readAnchors();

      const { a, b } = anchorsRef.current;
      if (!a || !b || distance(a, b) < 1) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      let points = pointsRef.current;
      if (points.length !== SEGMENT_COUNT + 1) {
        points = createPoints(a, b, SEGMENT_COUNT);
        pointsRef.current = points;
      }

      const segmentLength = distance(a, b) / SEGMENT_COUNT;
      const mouse = mouseRef.current;

      for (let i = 0; i < points.length; i += 1) {
        const point = points[i];

        if (point.pinned) {
          const anchor = i === 0 ? a : b;
          point.x = anchor.x;
          point.y = anchor.y;
          point.prevX = anchor.x;
          point.prevY = anchor.y;
          continue;
        }

        const velocityX = (point.x - point.prevX) * FRICTION;
        const velocityY = (point.y - point.prevY) * FRICTION;
        point.prevX = point.x;
        point.prevY = point.y;
        point.x += velocityX;
        point.y += velocityY + GRAVITY;

        if (interactive && mouse.active) {
          const dx = point.x - mouse.x;
          const dy = point.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.001 && dist < MOUSE_RADIUS) {
            const push = (1 - dist / MOUSE_RADIUS) * MOUSE_STRENGTH;
            point.x += (dx / dist) * push * 9;
            point.y += (dy / dist) * push * 9;
          }
        }
      }

      for (let iteration = 0; iteration < CONSTRAINT_ITERATIONS; iteration += 1) {
        for (let i = 0; i < points.length - 1; i += 1) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const diff = (segmentLength - dist) / dist;
          const offsetX = dx * diff * 0.5;
          const offsetY = dy * diff * 0.5;

          if (!p1.pinned) {
            p1.x -= offsetX;
            p1.y -= offsetY;
          }
          if (!p2.pinned) {
            p2.x += offsetX;
            p2.y += offsetY;
          }
        }

        points[0].x = a.x;
        points[0].y = a.y;
        points[points.length - 1].x = b.x;
        points[points.length - 1].y = b.y;
      }

      const pathData = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ');

      pathEl?.setAttribute('d', pathData);
      hitEl?.setAttribute('d', pathData);
      setPinTransform(pinFrom, a.x, a.y);
      setPinTransform(pinTo, b.x, b.y);

      rafRef.current = requestAnimationFrame(step);
    };

    readAnchors();
    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafRef.current);
      observer.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [connection, containerRef, interactive, pinRefs]);

  return (
    <svg ref={svgRef} className="lidc-whiteboard-string" aria-hidden="true">
      <path className="lidc-whiteboard-string-hit" />
      <path className="lidc-whiteboard-string-path" />
      <g className="lidc-whiteboard-string-pin" data-pin="from">
        <line className="lidc-whiteboard-string-pin-needle" x1="0" y1="0" x2="0" y2="14" />
        <circle className="lidc-whiteboard-string-pin-head" cx="0" cy="0" r="8.2" />
        <circle className="lidc-whiteboard-string-pin-highlight" cx="-2.2" cy="-2.4" r="2.1" />
      </g>
      <g className="lidc-whiteboard-string-pin" data-pin="to">
        <line className="lidc-whiteboard-string-pin-needle" x1="0" y1="0" x2="0" y2="14" />
        <circle className="lidc-whiteboard-string-pin-head" cx="0" cy="0" r="8.2" />
        <circle className="lidc-whiteboard-string-pin-highlight" cx="-2.2" cy="-2.4" r="2.1" />
      </g>
    </svg>
  );
}
