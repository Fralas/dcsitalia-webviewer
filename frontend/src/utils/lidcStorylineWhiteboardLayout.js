import { LIDC_STORYLINE_WHITEBOARD_ITEMS } from '../config/lidcStorylineWhiteboardItems';

export const WHITEBOARD_PIN_LAYOUT_STORAGE_KEY = 'lidc-storyline-whiteboard-pin-layout-v4';

export function getDefaultWhiteboardPinLayout() {
  return Object.fromEntries(
    LIDC_STORYLINE_WHITEBOARD_ITEMS.map((item) => [
      item.id,
      {
        x: item.x,
        y: item.y,
        width: item.width,
        rotation: item.rotation,
      },
    ]),
  );
}

export function loadWhiteboardPinLayout() {
  const defaults = getDefaultWhiteboardPinLayout();

  try {
    const raw = window.localStorage.getItem(WHITEBOARD_PIN_LAYOUT_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    return Object.fromEntries(
      Object.entries(defaults).map(([id, fallback]) => [
        id,
        {
          ...fallback,
          ...(parsed[id] && typeof parsed[id] === 'object' ? parsed[id] : {}),
        },
      ]),
    );
  } catch {
    return defaults;
  }
}

export function persistWhiteboardPinLayout(layout) {
  window.localStorage.setItem(WHITEBOARD_PIN_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
}

export function mergeWhiteboardItems(layout) {
  return LIDC_STORYLINE_WHITEBOARD_ITEMS.map((item) => ({
    ...item,
    ...(layout?.[item.id] ?? {}),
  }));
}

function roundLayoutValue(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(Number(value) * factor) / factor;
}

export function roundPinLayout(layout) {
  return Object.fromEntries(
    Object.entries(layout).map(([id, pin]) => [
      id,
      {
        x: roundLayoutValue(pin.x),
        y: roundLayoutValue(pin.y),
        width: roundLayoutValue(pin.width),
        rotation: roundLayoutValue(pin.rotation),
      },
    ]),
  );
}

export function formatWhiteboardPinLayoutJson(layout) {
  return `${JSON.stringify(roundPinLayout(layout), null, 2)}\n`;
}
