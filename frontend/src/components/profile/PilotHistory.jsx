import { aircraftName } from './Logbook';
import { tankerName } from './SupportRecord';

const fmt = (n, digits = 0) => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const LB_TO_KG = 0.45359237;
const WEEKS = 12;
const RECENT_LIMIT = 4;
const MISSING = 'Disponibile quando il sito è collegato a DCSServerBot.';

const THEATRES = {
  Caucasus: 'Caucaso',
  Syria: 'Siria',
  PersianGulf: 'Golfo Persico',
  MarianaIslands: 'Marianne',
  Nevada: 'Nevada',
  Normandy: 'Normandia',
  TheChannel: 'Canale della Manica',
  SinaiMap: 'Sinai',
  Kola: 'Kola',
  Afghanistan: 'Afghanistan',
  Iraq: 'Iraq',
  GermanyCW: 'Germania',
  Falklands: 'Falkland',
};
const theatreName = (t) => (t ? (THEATRES[t] || t.replace(/([a-z])([A-Z])/g, '$1 $2')) : null);

function duration(sec) {
  const m = Math.round((Number(sec) || 0) / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

const shortDate = (ms) => (ms ? new Date(ms).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : null);
const dateTime = (ms) => (ms ? new Date(ms).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');
const joinSub = (...parts) => parts.filter(Boolean).join(' · ');

function Block({ title, hint, children }) {
  return (
    <section className="pf-block pf-side">
      <div className="profile__section-head">
        <h2 className="profile__section-title">{title}</h2>
        {hint && <span className="pf-hint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------ activity calendar */

const utcKey = (date) => date.toISOString().slice(0, 10);

function level(sec) {
  if (!sec) return 0;
  if (sec < 3600) return 1;
  if (sec < 2 * 3600) return 2;
  if (sec < 3 * 3600) return 3;
  return 4;
}

/** 12 weeks x 7 days (Monday first), one square per UTC day, shaded by flight time. */
export function ActivityCalendar({ activity, linked, available }) {
  if (!linked) return null;
  if (!available) {
    return <Block title="Attività"><p className="profile__empty">{MISSING}</p></Block>;
  }
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const start = new Date(today);
  start.setUTCDate(today.getUTCDate() - mondayOffset - (WEEKS - 1) * 7);

  const cells = [];
  let totalSec = 0;
  let activeDays = 0;
  for (let i = 0; i < WEEKS * 7; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const key = utcKey(day);
    const data = activity?.[key];
    const future = day > today;
    if (data?.sec) {
      totalSec += data.sec;
      activeDays += 1;
    }
    cells.push({ key, day, data, future });
  }

  const months = [];
  for (let w = 0; w < WEEKS; w += 1) {
    const first = cells[w * 7].day;
    const prev = w > 0 ? cells[(w - 1) * 7].day : null;
    months.push(!prev || prev.getUTCMonth() !== first.getUTCMonth()
      ? first.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' })
      : '');
  }

  return (
    <Block title="Attività" hint="12 settimane">
      <div className="pf-cal__summary">
        <div><strong>{Math.round(totalSec / 3600)}<small>h</small></strong><span>In volo</span></div>
        <div><strong>{activeDays}</strong><span>Giorni attivi</span></div>
      </div>
      <div className="pf-cal">
        <div className="pf-cal__months" aria-hidden="true">
          {months.map((m, i) => <span key={i}>{m}</span>)}
        </div>
        <div className="pf-cal__body">
          <div className="pf-cal__days" aria-hidden="true">
            <span>L</span><span /><span>M</span><span /><span>V</span><span /><span>D</span>
          </div>
          <div className="pf-cal__grid" role="img" aria-label={`${activeDays} giorni attivi nelle ultime 12 settimane`}>
            {cells.map((c) => (
              <i
                key={c.key}
                className={c.future ? 'is-future' : `l${level(c.data?.sec)}`}
                title={c.future ? undefined : `${c.day.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })} · ${c.data?.sec ? `${duration(c.data.sec)} · ${c.data.sorties} sortite` : 'nessun volo'}`}
              />
            ))}
          </div>
        </div>
        <div className="pf-cal__legend" aria-hidden="true">
          Meno <i className="l0" /><i className="l1" /><i className="l2" /><i className="l3" /><i className="l4" /> Più
        </div>
      </div>
    </Block>
  );
}

/* ------------------------------------------------------------ personal records */

export function PersonalRecords({ records, cargo, linked, available }) {
  if (!linked) return null;
  const r = records || {};
  const items = [];
  if (r.longestSortie) {
    items.push({ key: 'sortie', label: 'Sortita più lunga', value: duration(r.longestSortie.value), sub: joinSub(aircraftName(r.longestSortie.type), shortDate(r.longestSortie.at)) });
  }
  if (r.mostKills) {
    items.push({ key: 'kills', label: 'Abbattimenti in una missione', value: fmt(r.mostKills.value), sub: joinSub(theatreName(r.mostKills.theatre), shortDate(r.mostKills.at)) });
  }
  if (r.cleanStreak) {
    items.push({ key: 'streak', label: 'Sortite di fila senza perdite', value: fmt(r.cleanStreak.value), sub: `Serie attuale: ${fmt(r.cleanStreak.current)}` });
  }
  if (r.biggestRefuel) {
    items.push({ key: 'refuel', label: 'Rifornimento più grande', value: <>{fmt((r.biggestRefuel.value * LB_TO_KG) / 1000, 1)}<small>t</small></>, sub: joinSub(tankerName(r.biggestRefuel.tanker), shortDate(r.biggestRefuel.at)) });
  }
  if (Number(cargo?.bestKm) > 0) {
    items.push({ key: 'cargo', label: 'Consegna sling load più lunga', value: <>{fmt(cargo.bestKm, cargo.bestKm < 10 ? 1 : 0)}<small>km</small></>, sub: joinSub(cargo.bestKg ? `${fmt(cargo.bestKg / 1000, 1)} t` : null, cargo.bestAt ? shortDate(cargo.bestAt * 1000) : null) });
  }

  return (
    <Block title="Record personali">
      {items.length === 0 ? (
        <p className="profile__empty">{available ? 'Ancora nessun record: vola una sortita per stabilirne uno.' : MISSING}</p>
      ) : (
        <ul className="pf-records">
          {items.map((item) => (
            <li key={item.key}>
              <span className="pf-records__label">{item.label}</span>
              <strong className="pf-records__value">{item.value}</strong>
              {item.sub && <span className="pf-records__sub">{item.sub}</span>}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

/* ------------------------------------------------------------ recent sorties */

const OUTCOMES = {
  landed: { label: 'Rientrato', cls: 'is-ok' },
  lost: { label: 'Abbattuto', cls: 'is-lost' },
  ejected: { label: 'Eiettato', cls: 'is-eject' },
  open: { label: 'In volo ora', cls: 'is-open' },
  unknown: { label: 'Uscito in volo', cls: 'is-unknown' },
};

export function RecentSorties({ sorties, linked, available }) {
  if (!linked) return null;
  const list = (sorties || []).slice(0, RECENT_LIMIT);
  return (
    <Block title="Ultime sortite">
      {list.length === 0 ? (
        <p className="profile__empty">{available ? 'Nessuna sortita registrata.' : MISSING}</p>
      ) : (
        <ol className="pf-sorties">
          {list.map((s) => {
            const outcome = OUTCOMES[s.outcome] || OUTCOMES.unknown;
            return (
              <li key={`${s.at}-${s.type}`} className={outcome.cls}>
                <i className="pf-sorties__dot" title={outcome.label} aria-label={outcome.label} />
                <span className="pf-sorties__body">
                  <span className="pf-sorties__type">{aircraftName(s.type)}</span>
                  <span className="pf-sorties__sub">
                    {s.outcome === 'open' ? <b>In volo ora</b> : joinSub(theatreName(s.theatre), dateTime(s.at))}
                  </span>
                </span>
                <span className="pf-sorties__figures">
                  <span>{duration(s.sec)}</span>
                  {s.kills > 0 && <span className="pf-sorties__kills">{fmt(s.kills)} K</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </Block>
  );
}
