import { useState } from 'react';
import { Award, ChevronDown } from 'lucide-react';

const COLLAPSED = 9;

function formatDate(ms) {
  if (!Number.isFinite(Number(ms)) || !ms) return null;
  return new Date(Number(ms)).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function PatchArt({ achievement }) {
  return achievement.imageUrl ? (
    <img src={achievement.imageUrl} alt="" className="pf-awards__art" loading="lazy" />
  ) : (
    <span className="pf-awards__fallback"><Award className="h-6 w-6" /></span>
  );
}

/**
 * Patches as a 3x3 square. Collapsed, the whole square is one button that opens the full list
 * (empty slots are placeholders); expanded, every patch shows name and date and opens the viewer.
 */
export default function AwardsGrid({ achievements = [], onOpen }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = [...achievements].sort((a, b) => (Number(b?.awardedAt) || 0) - (Number(a?.awardedAt) || 0));
  const extra = Math.max(0, sorted.length - COLLAPSED);

  if (!expanded) {
    const shown = sorted.slice(0, COLLAPSED);
    const slots = Array.from({ length: COLLAPSED }, (_, i) => shown[i] || null);
    return (
      <button
        type="button"
        className="pf-awards pf-awards--square"
        onClick={() => setExpanded(true)}
        aria-expanded="false"
        aria-label={`Riconoscimenti: ${sorted.length}. Apri l'elenco completo`}
      >
        {slots.map((achievement, i) => (
          <span key={achievement ? (achievement.awardId || achievement.achievementId || i) : `empty-${i}`} className={`pf-awards__slot${achievement ? '' : ' is-empty'}`}>
            {achievement && <PatchArt achievement={achievement} />}
            {i === COLLAPSED - 1 && extra > 0 && <span className="pf-awards__more">+{extra}</span>}
          </span>
        ))}
      </button>
    );
  }

  return (
    <div className="pf-awards-open">
      <div className="pf-awards pf-awards--list">
        {sorted.map((achievement) => (
          <button
            key={achievement.awardId || achievement.achievementId}
            type="button"
            className="pf-awards__item"
            onClick={() => onOpen?.(achievement)}
            disabled={!achievement.imageUrl}
            title={achievement.imageUrl ? 'Apri patch' : 'Patch non disponibile'}
          >
            <span className="pf-awards__slot"><PatchArt achievement={achievement} /></span>
            <span className="pf-awards__name">{achievement.name}</span>
            {formatDate(achievement.awardedAt) && <span className="pf-awards__date">{formatDate(achievement.awardedAt)}</span>}
          </button>
        ))}
      </div>
      <button type="button" className="pf-ladder__toggle" onClick={() => setExpanded(false)} aria-expanded="true">
        Riduci <ChevronDown className="h-3.5 w-3.5 rotate-180" />
      </button>
    </div>
  );
}
