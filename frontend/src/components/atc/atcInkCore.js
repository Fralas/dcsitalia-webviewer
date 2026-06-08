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

/** Penna/stylus o mouse: ok per disegnare. Il dito (touch) è escluso su tablet/mobile. */
export function isInkDrawPointer(event) {
  return event?.pointerType === 'pen' || event?.pointerType === 'mouse';
}

export function isTouchPointer(event) {
  return event?.pointerType === 'touch';
}

export function getInkPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(rect.width, 1);
  const scaleY = canvas.height / Math.max(rect.height, 1);
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
    pressure: event.pressure ?? 0.5,
  };
}

export function drawInkStrokes(ctx, strokes, width, height) {
  ctx.clearRect(0, 0, width, height);
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  (strokes || []).forEach((stroke) => {
    if (!stroke.points?.length) return;
    ctx.strokeStyle = stroke.color || '#111';
    ctx.lineWidth = stroke.width || 2.4;
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
