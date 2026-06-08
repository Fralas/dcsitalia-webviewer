import { useCallback, useEffect, useRef } from 'react';
import {
  drawInkStrokes,
  getInkPoint,
  normalizeInkPoint,
  parseInkValue,
  serializeInk,
} from './atcInkCore';
import { TAP_SLOP_PX, useDoubleTapHandler } from './atcPointerGestures';

const LONG_PRESS_MS = 550;
const LONG_PRESS_MOVE_PX = 8;

export default function AtcStripInkOverlay({
  value = '',
  editable = false,
  onChange,
  onCommit,
  onLongPress,
  onDoubleTap,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const gestureDrewRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const longPressOriginRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const tapOriginRef = useRef(null);
  const strokesRef = useRef(parseInkValue(value) || []);
  const { registerTap, reset: resetDoubleTap, afterStroke } = useDoubleTapHandler(onDoubleTap);

  useEffect(() => {
    strokesRef.current = parseInkValue(value) || [];
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawInkStrokes(canvas.getContext('2d'), strokesRef.current, canvas.width, canvas.height);
  }, [value]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawInkStrokes(canvas.getContext('2d'), strokesRef.current, canvas.width, canvas.height);
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(rect.width * 2));
    canvas.height = Math.max(1, Math.floor(rect.height * 2));
    redraw();
  }, [redraw]);

  useEffect(() => {
    resizeCanvas();
    const ro = new ResizeObserver(resizeCanvas);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => ro.disconnect();
  }, [resizeCanvas]);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  }, []);

  const startStroke = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    gestureDrewRef.current = true;
    resetDoubleTap();
    const pt = normalizeInkPoint(getInkPoint(event, canvas), canvas);
    strokesRef.current = [...strokesRef.current, { width: 2.4, color: '#111', points: [pt] }];
    redraw();
    onChange?.(serializeInk(strokesRef.current));
  }, [onChange, redraw, resetDoubleTap]);

  const handlePointerDown = (event) => {
    if (!editable && !onDoubleTap) return;
    event.preventDefault();
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;

    gestureDrewRef.current = false;
    longPressTriggeredRef.current = false;
    tapOriginRef.current = { x: event.clientX, y: event.clientY };
    clearLongPress();

    if (!editable) return;

    if (onLongPress) {
      longPressOriginRef.current = { x: event.clientX, y: event.clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        clearLongPress();
        resetDoubleTap();
        onLongPress();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40);
        }
      }, LONG_PRESS_MS);
      return;
    }

    startStroke(event);
  };

  const handlePointerMove = (event) => {
    if (!editable && !onDoubleTap) return;

    if (longPressTimerRef.current && longPressOriginRef.current) {
      const dx = event.clientX - longPressOriginRef.current.x;
      const dy = event.clientY - longPressOriginRef.current.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_PX) {
        clearLongPress();
        startStroke(event);
      }
      return;
    }

    if (!drawingRef.current) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pt = normalizeInkPoint(getInkPoint(event, canvas), canvas);
    const next = [...strokesRef.current];
    const last = next[next.length - 1];
    if (!last) return;
    last.points = [...last.points, pt];
    strokesRef.current = next;
    redraw();
    onChange?.(serializeInk(next));
  };

  const endStroke = (event) => {
    clearLongPress();
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    if (gestureDrewRef.current) {
      afterStroke();
      gestureDrewRef.current = false;
      if (!drawingRef.current) return;
      drawingRef.current = false;
      if (event?.pointerId && canvasRef.current?.hasPointerCapture?.(event.pointerId)) {
        canvasRef.current.releasePointerCapture(event.pointerId);
      }
      onCommit?.(serializeInk(strokesRef.current));
      return;
    }

    if (onDoubleTap && tapOriginRef.current && event) {
      const dx = event.clientX - tapOriginRef.current.x;
      const dy = event.clientY - tapOriginRef.current.y;
      if (Math.hypot(dx, dy) <= TAP_SLOP_PX) {
        registerTap(tapOriginRef.current.x, tapOriginRef.current.y);
      } else {
        resetDoubleTap();
      }
    }

    tapOriginRef.current = null;
  };

  return (
    <canvas
      ref={canvasRef}
      className={[
        'atc-strip-ink-overlay',
        editable ? 'atc-strip-ink-overlay--editable' : '',
        !editable && onDoubleTap ? 'atc-strip-ink-overlay--tappable' : '',
      ].filter(Boolean).join(' ')}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endStroke}
      onPointerLeave={endStroke}
      onPointerCancel={endStroke}
    />
  );
}
