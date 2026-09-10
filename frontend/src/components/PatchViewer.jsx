import { useEffect, useRef } from 'react';
import velcroTextureImg from '../../img/velcrotexture.jpg';

const PATCH_SLICE_Z = [-5, -3, -1, 1, 3, 5];
const PATCH_FACE_Z = 6;
const PATCH_GIMBAL_EPSILON_DEG = 0.05;
const PATCH_SPIN_DEG_PER_PX = 0.45;
const PATCH_MOMENTUM_FRICTION_PER_FRAME = 0.94;
const PATCH_MIN_MOMENTUM_DEG_PER_MS = 0.01;

function avoidOrthogonalYaw(yawDeg) {
  const normalized = ((yawDeg % 180) + 180) % 180;
  if (Math.abs(normalized - 90) < 0.0001) {
    return yawDeg + PATCH_GIMBAL_EPSILON_DEG;
  }
  return yawDeg;
}

export default function PatchViewer({ achievement, onClose }) {
  const spinRef = useRef(null);
  const hitRef = useRef(null);
  const yawRef = useRef(0);
  const zoomRef = useRef(1);
  const dragRef = useRef({ active: false, lastX: 0, lastMoveTs: 0 });
  const momentumRef = useRef({
    velocityDegPerMs: 0,
    lastTs: 0,
    rafId: null,
  });

  const applyTransform = (withEase) => {
    const node = spinRef.current;
    if (!node) return;
    const yaw = avoidOrthogonalYaw(yawRef.current);
    const zoom = zoomRef.current;
    node.style.transition = withEase ? 'transform 120ms ease-out' : 'none';
    node.style.transform = `scale(${zoom}) rotateY(${yaw}deg)`;
  };

  const stopMomentum = () => {
    if (momentumRef.current.rafId !== null) {
      window.cancelAnimationFrame(momentumRef.current.rafId);
      momentumRef.current.rafId = null;
    }
    momentumRef.current.velocityDegPerMs = 0;
    momentumRef.current.lastTs = 0;
  };

  const startMomentum = () => {
    const initialVelocity = momentumRef.current.velocityDegPerMs;
    if (!Number.isFinite(initialVelocity) || Math.abs(initialVelocity) < PATCH_MIN_MOMENTUM_DEG_PER_MS) {
      stopMomentum();
      return;
    }

    stopMomentum();
    momentumRef.current.velocityDegPerMs = initialVelocity;
    momentumRef.current.lastTs = 0;

    const tick = (timestamp) => {
      const state = momentumRef.current;
      if (!state.lastTs) state.lastTs = timestamp;
      const dtMs = Math.max(0, timestamp - state.lastTs);
      state.lastTs = timestamp;

      if (dtMs > 0) {
        yawRef.current += state.velocityDegPerMs * dtMs;
        applyTransform(false);
        const friction = Math.pow(PATCH_MOMENTUM_FRICTION_PER_FRAME, dtMs / 16.6667);
        state.velocityDegPerMs *= friction;
      }

      if (Math.abs(state.velocityDegPerMs) < PATCH_MIN_MOMENTUM_DEG_PER_MS) {
        stopMomentum();
        applyTransform(true);
        return;
      }

      state.rafId = window.requestAnimationFrame(tick);
    };

    momentumRef.current.rafId = window.requestAnimationFrame(tick);
  };

  useEffect(() => {
    yawRef.current = 0;
    zoomRef.current = 1;
    applyTransform(false);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };

    const hit = hitRef.current;
    const onWheel = (event) => {
      event.preventDefault();
      const next = event.deltaY < 0 ? zoomRef.current + 0.12 : zoomRef.current - 0.12;
      zoomRef.current = Math.max(1, Math.min(2.2, next));
      applyTransform(false);
    };
    hit?.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
      hit?.removeEventListener('wheel', onWheel);
      document.body.style.overflow = previousOverflow;
      stopMomentum();
    };
  }, [achievement?.imageUrl, onClose]);

  const handlePointerDown = (event) => {
    stopMomentum();
    dragRef.current = {
      active: true,
      lastX: event.clientX,
      lastMoveTs: performance.now(),
    };
    momentumRef.current.velocityDegPerMs = 0;
    hitRef.current?.classList.add('is-dragging');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragRef.current.active) return;
    const dx = event.clientX - dragRef.current.lastX;
    const nowTs = performance.now();
    const dtMs = Math.max(1, nowTs - dragRef.current.lastMoveTs);
    const deltaYaw = dx * PATCH_SPIN_DEG_PER_PX;
    momentumRef.current.velocityDegPerMs = (momentumRef.current.velocityDegPerMs * 0.65) + ((deltaYaw / dtMs) * 0.35);
    dragRef.current.lastX = event.clientX;
    dragRef.current.lastMoveTs = nowTs;
    yawRef.current += deltaYaw;
    applyTransform(false);
  };

  const handlePointerUp = (event) => {
    const wasDragging = dragRef.current.active;
    dragRef.current.active = false;
    hitRef.current?.classList.remove('is-dragging');
    if (wasDragging) startMomentum();
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const imageUrl = achievement?.imageUrl || '';
  const name = achievement?.name || 'Patch';
  const description = achievement?.description || 'Nessuna descrizione disponibile.';

  return (
    <div className="profile-viewer" onClick={onClose}>
      <button
        type="button"
        className="profile-viewer__close"
        onClick={(event) => {
          event.stopPropagation();
          onClose();
        }}
      >
        Chiudi
      </button>
      <div className="profile-viewer__stage" onClick={(event) => event.stopPropagation()}>
        <p className="profile-viewer__name">{name}</p>
        <p className="profile-viewer__desc">{description}</p>
        <div className="profile-viewer__canvas">
          <div
            ref={hitRef}
            className="profile-viewer__hit"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div ref={spinRef} className="profile-viewer__spin">
              {PATCH_SLICE_Z.map((depth) => (
                <div
                  key={depth}
                  className="profile-viewer__slice"
                  style={{
                    transform: `translateZ(${depth}px)`,
                    WebkitMaskImage: `url(${imageUrl})`,
                    maskImage: `url(${imageUrl})`,
                    backgroundImage: `url(${velcroTextureImg})`,
                  }}
                />
              ))}
              <img
                className="profile-viewer__face profile-viewer__face--front"
                src={imageUrl}
                alt={name}
                draggable={false}
                style={{ transform: `translateZ(${PATCH_FACE_Z}px)` }}
              />
              <div
                className="profile-viewer__face profile-viewer__face--back"
                style={{
                  transform: `rotateY(180deg) translateZ(${PATCH_FACE_Z}px)`,
                  WebkitMaskImage: `url(${imageUrl})`,
                  maskImage: `url(${imageUrl})`,
                  backgroundImage: `url(${velcroTextureImg})`,
                }}
                aria-label="Retro patch velcro"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
