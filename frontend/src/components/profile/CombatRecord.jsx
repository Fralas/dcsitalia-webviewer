import Donut from './Donut';
import { CATEGORY_COLORS, OTHER } from './chartPalette';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

export const KILL_CATEGORIES = [
  { key: 'planes', label: 'Aerei', color: CATEGORY_COLORS.planes },
  { key: 'helicopters', label: 'Elicotteri', color: CATEGORY_COLORS.helicopters },
  { key: 'sams', label: 'SAM', color: CATEGORY_COLORS.sams },
  { key: 'ground', label: 'Terra', color: CATEGORY_COLORS.ground },
  { key: 'ships', label: 'Navi', color: CATEGORY_COLORS.ships },
];

function ratio(a, b) {
  if (!b) return a ? fmt(a) : '—';
  return (a / b).toLocaleString('it-IT', { maximumFractionDigits: 2 });
}


/**
 * Combat record from DCSServerBot (userstats): kills by category as a ring, survival figures.
 * Hidden without DCSServerBot data: the page shows a single notice for that.
 */
export default function CombatRecord({ combat, linked = false }) {
  if (!linked || !combat) return null;
  const killsBy = combat.killsBy || {};
  const kills = Number(combat.kills) || 0;

  // K/D and landing rate are in the KPI strip at the top of the page.
  const figures = [
    ['PvP', fmt(combat.pvp)],
    ['Morti', fmt(combat.deaths)],
    ['Decolli', fmt(combat.takeoffs)],
    ['Atterraggi', fmt(combat.landings)],
    ['Eiezioni', fmt(combat.ejections)],
    ['Crash', fmt(combat.crashes)],
    ['Fuoco amico', fmt(combat.teamkills)],
    ['Uccisioni per sortita', combat.takeoffs ? ratio(kills, combat.takeoffs) : '—'],
  ];

  return (
    <section className="pf-section">
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

      <div className="pf-combat-extra">
        <DeathCauses combat={combat} />
        <RankedList
          title="Bersagli preferiti"
          empty="Nessun abbattimento registrato."
          items={(combat.targets || []).map((t) => ({ key: t.type, name: unitName(t.type), sub: CATEGORY_LABELS[t.category] || null, count: t.count }))}
        />
        <RankedList
          title="Nemesi"
          empty="Nessuno ti ha ancora abbattuto."
          accent="is-red"
          items={(combat.nemeses || []).map((n) => ({
            key: `${n.player || ''}:${n.type}`,
            name: n.player || unitName(n.type),
            sub: n.player ? `Pilota · ${unitName(n.type)}` : (CATEGORY_LABELS[n.category] || null),
            count: n.count,
          }))}
        />
      </div>
    </section>
  );
}

// missionstats target_cat / init_cat values.
const CATEGORY_LABELS = {
  Airplanes: 'Aereo',
  Helicopters: 'Elicottero',
  'Ground Units': 'Unità di terra',
  Ships: 'Nave',
  Structures: 'Struttura',
  'Static Object': 'Oggetto statico',
  'Scenery Object': 'Scenario',
  Cargo: 'Carico',
};

function unitName(type) {
  return String(type || '?').replace(/_/g, ' ');
}

const DEATH_CAUSES = KILL_CATEGORIES;

/** Deaths split by what killed you; the rest (crashes, collisions, unknown) is "Altro". */
function DeathCauses({ combat }) {
  const by = combat.deathsBy || {};
  const deaths = Number(combat.deaths) || 0;
  const known = DEATH_CAUSES.reduce((sum, c) => sum + (Number(by[c.key]) || 0), 0);
  const causes = [...DEATH_CAUSES, { key: 'other', label: 'Altro', color: OTHER }]
    .map((c) => ({ ...c, value: c.key === 'other' ? Math.max(0, deaths - known) : Number(by[c.key]) || 0 }));
  const total = Math.max(deaths, known);

  return (
    <div className="pf-mini">
      <h3 className="pf-mini__title">Morti per causa</h3>
      {total === 0 ? (
        <p className="profile__empty">Nessuna morte registrata.</p>
      ) : (
        <>
          <div className="pf-stack" role="img" aria-label="Morti per causa">
            {causes.filter((c) => c.value > 0).map((c) => (
              <span key={c.key} style={{ width: `${(c.value / total) * 100}%`, background: c.color }} title={`${c.label}: ${c.value}`} />
            ))}
          </div>
          <ul className="pf-rank-list">
            {causes.filter((c) => c.value > 0).sort((a, b) => b.value - a.value).map((c) => (
              <li key={c.key}>
                <i style={{ background: c.color }} />
                <span className="pf-rank-list__name">{c.label}</span>
                <span className="pf-rank-list__count">{fmt(c.value)} · {Math.round((c.value / total) * 100)}%</span>
              </li>
            ))}
          </ul>
          {Number(by.pvp) > 0 && <p className="pf-mini__note">{fmt(by.pvp)} da altri piloti</p>}
        </>
      )}
    </div>
  );
}

function RankedList({ title, items, empty, accent = '' }) {
  const max = items.reduce((m, item) => Math.max(m, item.count), 0) || 1;
  return (
    <div className="pf-mini">
      <h3 className="pf-mini__title">{title}</h3>
      {items.length === 0 ? (
        <p className="profile__empty">{empty}</p>
      ) : (
        <ol className={`pf-ranked ${accent}`}>
          {items.map((item, index) => (
            <li key={item.key}>
              <span className="pf-ranked__pos">{index + 1}</span>
              <span className="pf-ranked__body">
                <span className="pf-ranked__name">{item.name}</span>
                {item.sub && <span className="pf-ranked__sub">{item.sub}</span>}
                <span className="pf-ranked__bar"><i style={{ width: `${Math.round((item.count / max) * 100)}%` }} /></span>
              </span>
              <span className="pf-ranked__count">{fmt(item.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
