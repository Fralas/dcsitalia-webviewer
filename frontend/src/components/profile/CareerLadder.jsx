import RankInsignia from './RankInsignia';
import { getRankTier, PILOT_RANK_TIERS } from '../../config/pilotRanks';

/**
 * Full rank list 0-100 in the standings-row style: past ranks plain, current in accent,
 * ranks not reached yet dimmed. No inner scroll: the whole ladder is always visible.
 */
export default function CareerLadder({ level = 0, linked = false }) {
  const current = linked ? getRankTier(level) : null;
  const currentIndex = current ? PILOT_RANK_TIERS.indexOf(current) : -1;

  return (
    <div className="pf-ladder">
      {[...PILOT_RANK_TIERS].reverse().map((tier) => {
        const index = PILOT_RANK_TIERS.indexOf(tier);
        const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'locked';
        return (
          <div key={tier.key} className={`pf-ladder__row is-${state}`}>
            <RankInsignia level={tier.from} size={28} />
            <span className="pf-ladder__name">{tier.name}</span>
            <span className="pf-ladder__range">{tier.from === tier.to ? tier.from : `${tier.from}–${tier.to}`}</span>
          </div>
        );
      })}
    </div>
  );
}
