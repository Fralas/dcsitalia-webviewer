export const INK_PREFIX = 'ink:';

export function parseInkValue(value) {
  if (!value || !String(value).startsWith(INK_PREFIX)) return null;
  try {
    return JSON.parse(value.slice(INK_PREFIX.length));
  } catch {
    return null;
  }
}

export function serializeInk(strokes) {
  return strokes?.length ? `${INK_PREFIX}${JSON.stringify(strokes)}` : '';
}

export function popLastInkStroke(value) {
  const strokes = parseInkValue(value);
  if (!strokes?.length) return '';
  return serializeInk(strokes.slice(0, -1));
}

export function getInkPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = event.touches?.[0] || event;
  return {
    x: ((src.clientX - rect.left) / rect.width) * canvas.width,
    y: ((src.clientY - rect.top) / rect.height) * canvas.height,
    pressure: event.pressure ?? (event.touches ? 0.5 : 0.35),
  };
}

export function drawInkStrokes(ctx, strokes, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  (strokes || []).forEach((stroke) => {
    if (!stroke.points?.length) return;
    ctx.strokeStyle = stroke.color || '#111';
    ctx.lineWidth = Math.max(1.4, (stroke.width || 2.4) * (stroke.points[0]?.pressure || 0.5));
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

export function normalizeInkPoint(pt, canvas) {
  return {
    x: (pt.x / canvas.width) * 100,
    y: (pt.y / canvas.height) * 100,
    pressure: pt.pressure,
  };
}
