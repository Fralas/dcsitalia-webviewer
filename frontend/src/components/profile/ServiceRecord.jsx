import Donut from './Donut';
import RankInsignia from './RankInsignia';
import { getNextTier, getPilotRank, getRankTier, PILOT_MAX_LEVEL } from '../../config/pilotRanks';

function formatDuration(seconds) {
  const totalMin = Math.round((Number(seconds) || 0) / 60);
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, '0')}m`;
}

function formatRelative(unixSec) {
  if (!unixSec) return '—';
  const diffMin = Math.floor((Date.now() / 1000 - Number(unixSec)) / 60);
  if (diffMin < 2) return 'ora';
  if (diffMin < 60) return `${diffMin} min fa`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'ieri' : `${days} giorni fa`;
}

function formatDate(ms) {
  if (!ms) return '—';
  return new Date(Number(ms)).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

/** Road to the next rank: one notch per level, current level filled with the in-level progress. */
function RankTrack({ levelInfo }) {
  const level = levelInfo.level;
  const rank = getPilotRank(level);
  const tier = getRankTier(level);
  const next = getNextTier(level);
  const inLevel = levelInfo.nextLevelXp
    ? Math.min(1, (levelInfo.xp - levelInfo.levelXp) / Math.max(1, levelInfo.nextLevelXp - levelInfo.levelXp))
    : 1;
  const toNextLevel = levelInfo.nextLevelXp ? levelInfo.nextLevelXp - levelInfo.xp : 0;

  const levels = [];
  const lastLevel = next ? next.from : tier.to + 1;
  for (let l = tier.from; l < lastLevel; l += 1) levels.push(l);

  let caption = 'Grado massimo raggiunto';
  if (next) {
    const left = next.from - level;
    caption = `Livello ${level + 1} tra ${fmt(toNextLevel)} XP · ${left === 1 ? 'ultimo livello' : `${left} livelli`} al prossimo grado`;
  }

  return (
    <div className="pf-track">
      <div className="pf-track__end">
        <RankInsignia level={level} size={56} />
        <span className="pf-track__rank">
          <strong>{rank.fullName}</strong>
          <small>Grado attuale</small>
        </span>
      </div>
      <div className="pf-track__line">
        {levels.map((l) => {
          const fill = l < level ? 1 : l === level ? inLevel : 0;
          return (
            <span key={l} className={`pf-track__seg${l === level ? ' is-current' : ''}`} title={`Livello ${l}`}>
              <i style={{ width: `${Math.round(fill * 100)}%` }} />
            </span>
          );
        })}
        <span className="pf-track__caption">{caption}</span>
      </div>
      {next && (
        <div className="pf-track__end is-next">
          <RankInsignia level={next.from} size={40} />
          <span className="pf-track__rank">
            <strong>{next.name}</strong>
            <small>Livello {next.from}</small>
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Service record: current rank and road to the next one, XP composition, flight figures.
 * Only for pilots with a linked DCS account (the header shows the link flow otherwise).
 */
export default function ServiceRecord({ profile, patchCount = 0, boardPosition = null }) {
  if (!profile?.linked) return null;
  const stats = profile.stats || {};
  const rules = profile.rules || {};
  const levelInfo = profile.level || { level: 0, xp: 0 };

  const flightSec = Number(stats.flightSec) || 0;
  const sorties = Number(stats.sorties) || 0;
  const fromBot = rules.source === 'dcsserverbot';
  const flightXp = stats.flightXp ?? Math.floor(flightSec / 60) * (Number(rules.xp_per_flight_minute) || 0);
  const sortieXp = stats.sortieXp ?? sorties * (Number(rules.xp_per_sortie) || 0);
  const sum = flightXp + sortieXp;
  const pct = (v) => (sum ? Math.round((v / sum) * 100) : 0);

  const figures = [
    [fromBot ? 'In slot' : 'In volo', formatDuration(flightSec)],
    ['Sortite', fmt(sorties)],
    ['Media sortita', sorties ? formatDuration(flightSec / sorties) : '—'],
    ['Ultimo volo', formatRelative(stats.lastSeen)],
    ['Classifica', boardPosition ? `${boardPosition}°` : '—'],
    ['Patch', fmt(patchCount)],
    profile.link?.linkedAt ? ['In servizio dal', formatDate(profile.link.linkedAt)] : null,
  ].filter(Boolean);

  return (
    <section className="pf-block">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Stato di servizio</h2>
        <span className="pf-hint">Livello {levelInfo.level} / {levelInfo.maxLevel ?? PILOT_MAX_LEVEL}</span>
      </div>

      <RankTrack levelInfo={levelInfo} />

      <div className="pf-service">
        <div className="pf-service__xp">
          <Donut
            value={fmt(levelInfo.xp)}
            label="XP totali"
            segments={[
              { value: flightXp, color: 'var(--profile-accent)' },
              { value: sortieXp, color: '#8a5a20' },
            ]}
          />
          <ul className="pf-legend">
            <li><i className="is-flight" />{fromBot ? 'Tempo in slot' : 'Volo'}<span>{fmt(flightXp)} · {pct(flightXp)}%</span></li>
            <li><i className="is-sortie" />Sortite<span>{fmt(sortieXp)} · {pct(sortieXp)}%</span></li>
          </ul>
        </div>
        <dl className="pf-figures">
          {figures.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
