import { useCallback, useRef } from 'react';

export const DOUBLE_TAP_MS = 320;
export const TAP_SLOP_PX = 14;
export const STROKE_COOLDOWN_MS = 450;

export function useDoubleTapHandler(onDoubleTap) {
  const stateRef = useRef({ lastTap: null, cooldownUntil: 0 });
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;

  const reset = useCallback(() => {
    stateRef.current.lastTap = null;
  }, []);

  const afterStroke = useCallback(() => {
    stateRef.current.lastTap = null;
    stateRef.current.cooldownUntil = Date.now() + STROKE_COOLDOWN_MS;
  }, []);

  const registerTap = useCallback((x, y) => {
    if (!onDoubleTapRef.current) return false;
    const now = Date.now();
    const state = stateRef.current;
    if (now < state.cooldownUntil) {
      state.lastTap = null;
      return false;
    }
    if (state.lastTap && now - state.lastTap.time <= DOUBLE_TAP_MS) {
      const dx = x - state.lastTap.x;
      const dy = y - state.lastTap.y;
      if (Math.hypot(dx, dy) <= TAP_SLOP_PX) {
        state.lastTap = null;
        onDoubleTapRef.current();
        return true;
      }
    }
    state.lastTap = { x, y, time: now };
    return false;
  }, []);

  return { registerTap, reset, afterStroke };
}

export function isCoarsePointer(event) {
  return event.pointerType === 'touch' || event.pointerType === 'pen';
}
