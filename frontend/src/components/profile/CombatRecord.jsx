import Donut from './Donut';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

export const KILL_CATEGORIES = [
  { key: 'planes', label: 'Aerei', color: '#ff8c00' },
  { key: 'helicopters', label: 'Elicotteri', color: '#f5b041' },
  { key: 'sams', label: 'SAM', color: '#ef4444' },
  { key: 'ground', label: 'Terra', color: '#8a5a20' },
  { key: 'ships', label: 'Navi', color: '#60a5fa' },
];

function ratio(a, b) {
  if (!b) return a ? fmt(a) : '—';
  return (a / b).toLocaleString('it-IT', { maximumFractionDigits: 2 });
}

function percent(a, b) {
  if (!b) return '—';
  return `${Math.round((a / b) * 100)}%`;
}

/**
 * Combat record from DCSServerBot (userstats): kills by category as a ring, survival figures.
 * Hidden when the stats come from the DCORE tracker (no combat data there).
 */
export default function CombatRecord({ combat }) {
  if (!combat) return null;
  const killsBy = combat.killsBy || {};
  const kills = Number(combat.kills) || 0;

  const figures = [
    ['Kill / morti', ratio(kills, combat.deaths)],
    ['PvP', fmt(combat.pvp)],
    ['Morti', fmt(combat.deaths)],
    ['Rientri', percent(combat.landings, combat.takeoffs)],
    ['Decolli', fmt(combat.takeoffs)],
    ['Eiezioni', fmt(combat.ejections)],
    ['Crash', fmt(combat.crashes)],
    ['Fuoco amico', fmt(combat.teamkills)],
  ];

  return (
    <section className="pf-block">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Combattimento</h2>
        <span className="pf-hint">Dati DCSServerBot</span>
      </div>

      <div className="pf-service">
        <div className="pf-service__xp">
          <Donut
            value={fmt(kills)}
            label="Abbattimenti"
            segments={KILL_CATEGORIES.map((cat) => ({ value: killsBy[cat.key], color: cat.color }))}
          />
          <ul className="pf-legend">
            {KILL_CATEGORIES.map((cat) => (
              <li key={cat.key} className={Number(killsBy[cat.key]) ? '' : 'is-zero'}>
                <i style={{ background: cat.color }} />
                {cat.label}
                <span>{fmt(killsBy[cat.key])}</span>
              </li>
            ))}
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
