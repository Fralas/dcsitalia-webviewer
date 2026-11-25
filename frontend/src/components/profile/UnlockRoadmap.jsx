import { Check, Lock } from 'lucide-react';
import { Section } from './StatsCharts';

/**
 * Unlock roadmap: only the levels where something unlocks (assets, Tactical Commander slot, vote,
 * airlift), from profile.unlocks (GET /api/hidc/pilot/me, levels from DCORE unlock_levels).
 * Reached milestones are filled, the next one is highlighted with the levels left.
 */
function groupByLevel(unlocks) {
  const byLevel = new Map();
  (unlocks || []).forEach((entry) => {
    const level = Number(entry.level) || 0;
    if (!byLevel.has(level)) byLevel.set(level, []);
    byLevel.get(level).push(entry);
  });
  return [...byLevel.entries()].sort((a, b) => a[0] - b[0]).map(([level, items]) => ({ level, items }));
}

export default function UnlockRoadmap({ unlocks, level, linked }) {
  const milestones = groupByLevel(unlocks);
  if (milestones.length === 0) return null;

  const current = linked ? Number(level) || 0 : null;
  const reached = (m) => m.items.every((item) => item.unlocked);
  const nextIndex = milestones.findIndex((m) => !reached(m));
  const done = milestones.filter(reached).length;
  const hint = linked ? `${done} / ${milestones.length} sbloccati` : 'Collega l\'account DCS';

  return (
    <Section title="Roadmap sblocchi" hint={hint} className="pf-roadmap">
      <ol className="pf-roadmap__list">
        {milestones.map((milestone, index) => {
          const isDone = reached(milestone);
          const isNext = index === nextIndex;
          const state = isDone ? 'is-done' : isNext ? 'is-next' : 'is-locked';
          const left = current != null ? milestone.level - current : null;
          return (
            <li key={milestone.level} className={`pf-roadmap__step ${state}`}>
              <div className="pf-roadmap__node">
                <span className="pf-roadmap__dot" aria-hidden="true">
                  {isDone ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                </span>
                <span className="pf-roadmap__level">Lv {milestone.level}</span>
                {isNext && left != null && left > 0 && (
                  <span className="pf-roadmap__left">{left === 1 ? 'prossimo livello' : `tra ${left} livelli`}</span>
                )}
              </div>
              <ul className="pf-roadmap__items">
                {milestone.items.map((item) => (
                  <li key={item.key} className="pf-roadmap__item">
                    <span className="pf-roadmap__group">{item.group}</span>
                    <span className="pf-roadmap__label">{item.label}</span>
                    {item.detail && <span className="pf-roadmap__detail">{item.detail}</span>}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </Section>
  );
}
