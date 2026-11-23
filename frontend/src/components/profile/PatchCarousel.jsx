import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Award, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Patch3D from '../Patch3D';

const SWIPE_MIN_PX = 60;
const WHEEL_MIN_DELTA = 30;
const WHEEL_LOCK_MS = 450;

function formatDate(ms) {
  if (!Number.isFinite(Number(ms)) || !ms) return null;
  return new Date(Number(ms)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Full-screen patch carousel over a blurred page. Opens growing out of the awards square (origin = its
 * centre), one patch per slide. The current index is the state; the rail slides with a CSS transform.
 * Navigation: arrows, keyboard (←/→/Esc), thumbnails, swipe outside the patch, mouse wheel / trackpad.
 * Each patch is a 3D velcro patch from the start: dragging the patch spins it (Patch3D) instead of swiping.
 */
export default function PatchCarousel({ achievements, startIndex = 0, origin, onClose, onSeen }) {
  const thumbsRef = useRef(null);
  const swipeRef = useRef(null);
  const wheelLockRef = useRef(0);
  const count = achievements.length;
  const [index, setIndex] = useState(() => Math.max(0, Math.min(count - 1, startIndex)));
  const [animated, setAnimated] = useState(false); // no slide transition on the first paint
  const [closing, setClosing] = useState(false);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, 180);
  }, [onClose]);

  const goTo = useCallback((next) => {
    setIndex(Math.max(0, Math.min(count - 1, next)));
  }, [count]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setAnimated(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  // Page behind does not scroll while the carousel is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') close();
      else if (event.key === 'ArrowRight') setIndex((i) => Math.min(count - 1, i + 1));
      else if (event.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, count]);

  // Parent props change identity on every render: read them through a ref, react to the index only.
  const latest = useRef({ achievements, onSeen });
  latest.current = { achievements, onSeen };
  useEffect(() => {
    const current = latest.current.achievements[index];
    if (current) latest.current.onSeen?.(current);
    const strip = thumbsRef.current;
    const thumb = strip?.children[index];
    if (strip && thumb) strip.scrollLeft = thumb.offsetLeft - (strip.clientWidth - thumb.clientWidth) / 2;
  }, [index]);

  // One patch per wheel gesture (trackpad swipe or mouse wheel), whichever axis dominates.
  const handleWheel = (event) => {
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (Math.abs(delta) < WHEEL_MIN_DELTA) return;
    const now = performance.now();
    if (now < wheelLockRef.current) return;
    wheelLockRef.current = now + WHEEL_LOCK_MS;
    setIndex((i) => Math.max(0, Math.min(count - 1, i + (delta > 0 ? 1 : -1))));
  };

  // Swipe anywhere on the slide except the patch itself (dragging the patch rotates it).
  const handlePointerDown = (event) => {
    if (event.target.closest('.profile-viewer__hit, button')) return;
    swipeRef.current = { x: event.clientX, y: event.clientY };
  };
  const handlePointerUp = (event) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    // A plain click on the empty background (not on the patch or its texts) closes the carousel.
    const still = Math.abs(dx) < 6 && Math.abs(event.clientY - start.y) < 6;
    if (still && event.target.matches('.pf-carousel__track, .pf-carousel__rail, .pf-carousel__slide')) {
      close();
      return;
    }
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(event.clientY - start.y)) return;
    setIndex((i) => Math.max(0, Math.min(count - 1, i + (dx < 0 ? 1 : -1))));
  };

  const style = origin ? { '--pf-carousel-ox': `${origin.x}px`, '--pf-carousel-oy': `${origin.y}px` } : undefined;

  return createPortal(
    <div
      className={`pf-carousel${closing ? ' is-closing' : ''}`}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label="Riconoscimenti"
      onClick={close}
    >
      <div className="pf-carousel__frame" onClick={(event) => event.stopPropagation()}>
        <div className="pf-carousel__bar">
          <span className="pf-carousel__count">{index + 1} / {count}</span>
          <button type="button" className="pf-carousel__close" onClick={close} aria-label="Chiudi">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div
          className="pf-carousel__track"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerCancel={() => { swipeRef.current = null; }}
        >
          <div
            className={`pf-carousel__rail${animated ? ' is-animated' : ''}`}
            style={{ transform: `translateX(${-index * 100}%)` }}
          >
            {achievements.map((achievement, i) => {
              const date = formatDate(achievement.awardedAt);
              const near = Math.abs(i - index) <= 1;
              return (
                <div
                  key={achievement.awardId || achievement.achievementId || i}
                  className="pf-carousel__slide"
                  aria-hidden={i !== index}
                >
                  <div className="pf-carousel__art">
                    {!achievement.imageUrl && <Award className="pf-carousel__fallback" />}
                    {/* 3D on the current patch and its neighbours (at rest it looks like the flat image);
                        the key remounts it when it becomes current, so every patch starts facing front. */}
                    {achievement.imageUrl && near && (
                      <Patch3D key={i === index ? 'current' : 'side'} imageUrl={achievement.imageUrl} name={achievement.name} />
                    )}
                    {achievement.imageUrl && !near && (
                      <img src={achievement.imageUrl} alt={achievement.name || 'Patch'} draggable={false} loading="lazy" />
                    )}
                  </div>
                  <p className="pf-carousel__name">{achievement.name || 'Patch'}</p>
                  {date && <p className="pf-carousel__date">{date}</p>}
                  {achievement.description && <p className="pf-carousel__desc">{achievement.description}</p>}
                  {achievement.imageUrl && <p className="pf-carousel__hint">Trascina la patch per ruotarla</p>}
                </div>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="pf-carousel__nav is-prev"
          onClick={() => goTo(index - 1)}
          disabled={index === 0}
          aria-label="Patch precedente"
        >
          <ChevronLeft className="h-7 w-7" />
        </button>
        <button
          type="button"
          className="pf-carousel__nav is-next"
          onClick={() => goTo(index + 1)}
          disabled={index === count - 1}
          aria-label="Patch successiva"
        >
          <ChevronRight className="h-7 w-7" />
        </button>

        <div className="pf-carousel__thumbs" ref={thumbsRef}>
          {achievements.map((achievement, i) => (
            <button
              key={achievement.awardId || achievement.achievementId || i}
              type="button"
              className={`pf-carousel__thumb${i === index ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={achievement.name || `Patch ${i + 1}`}
              aria-current={i === index}
            >
              {achievement.imageUrl ? <img src={achievement.imageUrl} alt="" draggable={false} /> : <Award className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
