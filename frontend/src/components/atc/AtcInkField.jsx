import { useCallback, useEffect, useRef } from 'react';

const INK_PREFIX = 'ink:';

function parseInkValue(value) {
  if (!value || !String(value).startsWith(INK_PREFIX)) return null;
  try {
    return JSON.parse(value.slice(INK_PREFIX.length));
  } catch {
    return null;
  }
}

function serializeInk(strokes) {
  return `${INK_PREFIX}${JSON.stringify(strokes)}`;
}

function getPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = event.touches?.[0] || event;
  return {
    x: ((src.clientX - rect.left) / rect.width) * canvas.width,
    y: ((src.clientY - rect.top) / rect.height) * canvas.height,
    pressure: event.pressure ?? (event.touches ? 0.5 : 0.35),
  };
}

function drawStrokes(ctx, strokes, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  strokes.forEach((stroke) => {
    if (!stroke.points?.length) return;
    ctx.strokeStyle = '#111';
    ctx.lineWidth = Math.max(1.2, (stroke.width || 2) * (stroke.points[0]?.pressure || 0.5));
    ctx.beginPath();
    stroke.points.forEach((pt, i) => {
      const x = (pt.x / 100) * width;
      const y = (pt.y / 100) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  });
}

function InkCanvas({ strokes, onChange, onCommit, onFocus, onBlur, className }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const strokesRef = useRef(strokes);

  useEffect(() => {
    strokesRef.current = strokes;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    drawStrokes(ctx, strokes, canvas.width, canvas.height);
  }, [strokes]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * 2));
    canvas.height = Math.max(1, Math.floor(rect.height * 2));
    const ctx = canvas.getContext('2d');
    drawStrokes(ctx, strokesRef.current, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  const toNorm = (pt, canvas) => ({
    x: (pt.x / canvas.width) * 100,
    y: (pt.y / canvas.height) * 100,
    pressure: pt.pressure,
  });

  const handlePointerDown = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    onFocus?.();
    const pt = toNorm(getPoint(event, canvas), canvas);
    strokesRef.current = [...strokesRef.current, { width: 2.2, points: [pt] }];
    onChange?.(serializeInk(strokesRef.current));
  };

  const handlePointerMove = (event) => {
    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = toNorm(getPoint(event, canvas), canvas);
    const next = [...strokesRef.current];
    const last = next[next.length - 1];
    if (!last) return;
    last.points = [...last.points, pt];
    strokesRef.current = next;
    const ctx = canvas.getContext('2d');
    drawStrokes(ctx, next, canvas.width, canvas.height);
    onChange?.(serializeInk(next));
  };

  const endStroke = (event) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event?.pointerId && canvasRef.current?.hasPointerCapture?.(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    onCommit?.(serializeInk(strokesRef.current));
    onBlur?.();
  };

  return (
    <canvas
      ref={canvasRef}
      className={`atc-ink-field__canvas ${className || ''}`.trim()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerLeave={endStroke}
      onPointerCancel={endStroke}
    />
  );
}

function InkPreview({ value, className }) {
  const canvasRef = useRef(null);
  const strokes = parseInkValue(value) || [];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * 2));
    canvas.height = Math.max(1, Math.floor(rect.height * 2));
    drawStrokes(canvas.getContext('2d'), strokes, canvas.width, canvas.height);
  }, [value, strokes]);

  return <canvas ref={canvasRef} className={`atc-ink-field__preview ${className || ''}`.trim()} aria-hidden />;
}

export default function AtcInkField({
  value = '',
  onChange,
  onCommit,
  onFocus,
  onBlur,
  editable = false,
  className = '',
}) {
  const strokes = parseInkValue(value) || [];

  if (!editable) {
    if (parseInkValue(value)) {
      return (
        <span className={`atc-ink-field atc-ink-field--readonly ${className}`.trim()}>
          <InkPreview value={value} />
        </span>
      );
    }
    return (
      <span className={`atc-ink-field atc-ink-field--readonly ${className}`.trim()}>
        <span className="atc-fit-field__text">{value}</span>
      </span>
    );
  }

  return (
    <span
      className={`atc-ink-field atc-ink-field--editable ${className}`.trim()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <InkCanvas
        strokes={strokes}
        onChange={onChange}
        onCommit={onCommit}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    </span>
  );
}

export { INK_PREFIX, parseInkValue };
