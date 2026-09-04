export const WHITEBOARD_MIN_VIEW_SCALE = 0.38;
export const WHITEBOARD_PIN_CANVAS_PERCENT = 100 / WHITEBOARD_MIN_VIEW_SCALE;
export const WHITEBOARD_PIN_PAD_PERCENT = (WHITEBOARD_PIN_CANVAS_PERCENT - 100) / 2;

export function toPinCanvasPos(visiblePercent) {
  return ((WHITEBOARD_PIN_PAD_PERCENT + Number(visiblePercent)) / WHITEBOARD_PIN_CANVAS_PERCENT) * 100;
}

export function toPinCanvasSize(visiblePercent) {
  return (Number(visiblePercent) / WHITEBOARD_PIN_CANVAS_PERCENT) * 100;
}

export function fromPinCanvasPos(canvasPercent) {
  return (Number(canvasPercent) / 100) * WHITEBOARD_PIN_CANVAS_PERCENT - WHITEBOARD_PIN_PAD_PERCENT;
}

export function fromPinCanvasSize(canvasPercent) {
  return (Number(canvasPercent) / 100) * WHITEBOARD_PIN_CANVAS_PERCENT;
}

export function pinCanvasWidth(width) {
  const value = Number(width);
  if (value > 0 && value < 8) return value;
  return toPinCanvasSize(value);
}
