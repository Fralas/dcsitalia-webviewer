import { useState } from 'react';
import { Award } from 'lucide-react';
import PatchCarousel from './PatchCarousel';

const COLLAPSED = 9;

function PatchArt({ achievement }) {
  return achievement.imageUrl ? (
    <img src={achievement.imageUrl} alt="" className="pf-awards__art" loading="lazy" />
  ) : (
    <span className="pf-awards__fallback"><Award className="h-6 w-6" /></span>
  );
}

/**
 * Patches as a 3x3 square (newest first, "+N" on the last slot). Clicking the square opens every patch
 * in a full-screen carousel, starting from the clicked slot ("+N" and empty slots start from the ninth / first).
 */
export default function AwardsGrid({ achievements = [], onSeen }) {
  const [carousel, setCarousel] = useState(null); // { start, origin } while open
  const sorted = [...achievements].sort((a, b) => (Number(b?.awardedAt) || 0) - (Number(a?.awardedAt) || 0));
  const extra = Math.max(0, sorted.length - COLLAPSED);
  const shown = sorted.slice(0, COLLAPSED);
  const slots = Array.from({ length: COLLAPSED }, (_, i) => shown[i] || null);

  const open = (event) => {
    const slot = event.target.closest?.('[data-index]');
    const clicked = slot ? Number(slot.dataset.index) : 0;
    const rect = event.currentTarget.getBoundingClientRect();
    setCarousel({
      start: Math.min(clicked, sorted.length - 1),
      origin: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    });
  };

  return (
    <>
      <button
        type="button"
        className="pf-awards pf-awards--square"
        onClick={open}
        aria-haspopup="dialog"
        aria-label={`Riconoscimenti: ${sorted.length}. Apri a schermo intero`}
      >
        {slots.map((achievement, i) => (
          <span
            key={achievement ? (achievement.awardId || achievement.achievementId || i) : `empty-${i}`}
            className={`pf-awards__slot${achievement ? '' : ' is-empty'}`}
            data-index={achievement ? i : undefined}
          >
            {achievement && <PatchArt achievement={achievement} />}
            {i === COLLAPSED - 1 && extra > 0 && <span className="pf-awards__more">+{extra}</span>}
          </span>
        ))}
      </button>
      {carousel && sorted.length > 0 && (
        <PatchCarousel
          achievements={sorted}
          startIndex={carousel.start}
          origin={carousel.origin}
          onClose={() => setCarousel(null)}
          onSeen={onSeen}
        />
      )}
    </>
  );
}
