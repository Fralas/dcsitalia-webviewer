import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { aircraftName } from './Logbook';
import { ACCENT, AXIS, SERIES } from './chartPalette';

const nf = (n, digits = 0) => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });

export function duration(sec) {
  const m = Math.round((Number(sec) || 0) / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

function relative(ms) {
  if (!ms) return '—';
  const diffMin = Math.floor((Date.now() - Number(ms)) / 60000);
  if (diffMin < 2) return 'ora';
  if (diffMin < 60) return `${diffMin} min fa`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'ieri' : `${days} giorni fa`;
}

const THEATRES = {
  Caucasus: 'Caucaso', Syria: 'Siria', PersianGulf: 'Golfo Persico', MarianaIslands: 'Marianne',
  Nevada: 'Nevada', Normandy: 'Normandia', TheChannel: 'Canale della Manica', SinaiMap: 'Sinai',
  Kola: 'Kola', Afghanistan: 'Afghanistan', Iraq: 'Iraq', GermanyCW: 'Germania', Falklands: 'Falkland',
};
export const theatreName = (t) => (t ? (THEATRES[t] || t.replace(/([a-z])([A-Z])/g, '$1 $2')) : '—');

export function Section({ title, hint, children, className = '' }) {
  return (
    <section className={`pf-section ${className}`}>
      <div className="profile__section-head">
        <h2 className="profile__section-title">{title}</h2>
        {hint && <span className="pf-hint">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

export function Panel({ title, hint, children }) {
  return (
    <div className="pf-panel">
      {(title || hint) && (
        <div className="pf-panel__head">
          {title && <h3 className="pf-mini__title">{title}</h3>}
          {hint && <span className="pf-hint">{hint}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ KPI strip */

/** Headline numbers right under the header: one row of stat tiles. */
export function KpiStrip({ profile, boardPosition }) {
  const stats = profile?.stats || {};
  const combat = profile?.combat || null;
  const sorties = Number(stats.sorties) || 0;
  const flightSec = Number(stats.flightSec) || 0;
  const tiles = [
    ['Tempo in volo', duration(flightSec)],
    ['Sortite', nf(sorties)],
    ['Media sortita', sorties ? duration(flightSec / sorties) : '—'],
    combat && ['Abbattimenti', nf(combat.kills)],
    combat && ['Kill / morti', combat.deaths ? nf(combat.kills / combat.deaths, 2) : nf(combat.kills)],
    combat && ['Rientri', combat.takeoffs ? `${Math.round((combat.landings / combat.takeoffs) * 100)}%` : '—'],
    ['XP totali', nf(profile?.level?.xp)],
    ['Classifica', boardPosition ? `${boardPosition}°` : '—'],
    combat?.credits && ['Crediti', nf(combat.credits.points)],
    ['Ultimo volo', relative(stats.lastSeen ? stats.lastSeen * 1000 : null)],
  ].filter(Boolean);

  return (
    <dl className="pf-kpis">
      {tiles.map(([label, value]) => (
        <div key={label} className="pf-kpi">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------ monthly trend */

const monthShort = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' });
const monthLong = (key) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('it-IT', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function ChartTooltip({ active, payload, label, format }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="pf-tip">
      <p className="pf-tip__title">{monthLong(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="pf-tip__row">
          <i style={{ background: p.color }} />
          <span>{p.name}</span>
          <strong>{format ? format(p.value, p.dataKey) : nf(p.value)}</strong>
        </p>
      ))}
    </div>
  );
}

function legendText(value) {
  return <span className="pf-chart-legend">{value}</span>;
}

/** Two charts on the same months: flight hours (one series) and kills vs deaths (grouped, one axis). */
export function MonthlyTrend({ monthly }) {
  if (!Array.isArray(monthly) || monthly.length === 0) return null;
  const data = monthly.map((m) => ({ ...m, hours: Math.round((Number(m.sec) || 0) / 360) / 10 }));
  const axisProps = {
    tick: AXIS.tick, tickLine: false, axisLine: { stroke: AXIS.line },
  };

  return (
    <div className="pf-grid-2">
      <Panel title="Ore di volo" hint="Ultimi 12 mesi">
        <div className="pf-chart">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }}>
              <CartesianGrid stroke={AXIS.grid} vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthShort} {...axisProps} />
              <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip format={(v, key) => (key === 'hours' ? `${nf(v, 1)} h` : nf(v))} />} />
              <Bar dataKey="hours" name="Ore" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <Panel title="Abbattimenti e morti" hint="Ultimi 12 mesi">
        <div className="pf-chart">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -18 }} barGap={2}>
              <CartesianGrid stroke={AXIS.grid} vertical={false} />
              <XAxis dataKey="month" tickFormatter={monthShort} {...axisProps} />
              <YAxis {...axisProps} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} content={<ChartTooltip />} />
              <Legend verticalAlign="top" align="right" height={24} iconType="square" iconSize={9} formatter={legendText} />
              <Bar dataKey="kills" name="Abbattimenti" fill={SERIES.blue} radius={[4, 4, 0, 0]} maxBarSize={12} />
              <Bar dataKey="deaths" name="Morti" fill={SERIES.orange} radius={[4, 4, 0, 0]} maxBarSize={12} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------------------------------------ when you fly */

// Time-of-day bands, local time, in chart order: the day starts at 06:00 and the night closes it.
// The 12 day hours get half-width columns, so the three bands are equally wide.
const BANDS = [
  { key: 'day', label: 'Giorno', from: 6, to: 18, width: 0.5 },
  { key: 'evening', label: 'Sera', from: 18, to: 24, width: 1 },
  { key: 'night', label: 'Notte', from: 0, to: 6, width: 1 },
];
const HOUR_ORDER = BANDS.flatMap((b) => Array.from({ length: b.to - b.from }, (_, i) => ({ hour: b.from + i, band: b })));
const hh = (h) => `${String(h).padStart(2, '0')}:00`;

/**
 * Flight time by hour of day (24 bars, local time, 06:00 to 05:00) grouped in day / evening / night;
 * the favourite band is highlighted.
 * hours is the DCSServerBot 7x24 matrix in UTC: summed over the weekdays and shifted by the browser offset.
 */
export function FlightHours({ hours }) {
  if (!Array.isArray(hours) || hours.length !== 7) return null;
  const offset = Math.round(-new Date().getTimezoneOffset() / 60);
  const utc = Array.from({ length: 24 }, (_, h) => hours.reduce((s, row) => s + (Number(row?.[h]) || 0), 0));
  const local = Array.from({ length: 24 }, (_, h) => utc[(((h - offset) % 24) + 24) % 24]);
  const total = local.reduce((s, v) => s + v, 0);
  if (!total) return null;
  const max = Math.max(...local);
  const bands = BANDS.map((b) => ({ ...b, sec: local.slice(b.from, b.to).reduce((s, v) => s + v, 0) }));
  const top = bands.reduce((a, b) => (b.sec > a.sec ? b : a));
  const peak = local.indexOf(max);
  const zone = offset === 0 ? 'UTC' : `UTC${offset > 0 ? '+' : ''}${offset}`;

  return (
    <Panel title="Fascia oraria" hint={`Ora locale (${zone}) · picco ${hh(peak)}`}>
      <div className="pf-hours">
        <div className="pf-hours__lead">
          <strong>{top.label}</strong>
          <span>{hh(top.from)}–{hh(top.to % 24)} · {Math.round((top.sec / total) * 100)}% del tempo in volo</span>
        </div>
        <div
          className="pf-hours__plot"
          style={{ gridTemplateColumns: HOUR_ORDER.map(({ band }) => `minmax(0, ${band.width}fr)`).join(' ') }}
          role="img"
          aria-label={bands.map((b) => `${b.label} ${Math.round((b.sec / total) * 100)}%`).join(', ')}
        >
          {HOUR_ORDER.map(({ hour, band }) => {
            const sec = local[hour];
            return (
              <div key={hour} className={`pf-hours__col${band.key === top.key ? ' is-top' : ''}`}>
                <span className="pf-hours__bar" style={{ height: `${sec ? Math.max(3, (sec / max) * 100) : 0}%` }} />
                <span className="pf-hours__tip">{hh(hour)} · {sec ? duration(sec) : 'nessun volo'}</span>
              </div>
            );
          })}
        </div>
        <div className="pf-hours__bands">
          {bands.map((b) => (
            <div key={b.key} className={`pf-hours__band${b.key === top.key ? ' is-top' : ''}`}>
              <span className="pf-hours__band-name">{b.label}</span>
              <span className="pf-hours__band-value">{Math.round((b.sec / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/** Time by theatre (bars) and by coalition (one split bar). */
export function TheatreSplit({ theatres, sides }) {
  const list = (theatres || []).filter((t) => t.sec > 0);
  if (list.length === 0 && !sides) return null;
  const max = Math.max(1, ...list.map((t) => t.sec));
  const blue = Number(sides?.blue) || 0;
  const red = Number(sides?.red) || 0;
  const total = blue + red;

  return (
    <Panel title="Dove voli">
      {list.length > 0 && (
        <div className="pf-bars">
          {list.map((t) => (
            <div key={t.theatre} className="pf-bars__row">
              <div className="pf-bars__head">
                <span className="pf-bars__name">{theatreName(t.theatre)}</span>
                <span className="pf-bars__value">{duration(t.sec)}</span>
              </div>
              <div className="pf-bars__track">
                <span style={{ width: `${Math.max(2, Math.round((t.sec / max) * 100))}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {total > 0 && (
        <div className="pf-sides">
          <div className="pf-control__bar" role="img" aria-label={`Blue ${Math.round((blue / total) * 100)}%, Red ${Math.round((red / total) * 100)}%`}>
            <span className="is-blue" style={{ width: `${(blue / total) * 100}%` }} />
            <span className="is-red" style={{ width: `${(red / total) * 100}%` }} />
          </div>
          <div className="pf-control__legend">
            <span>Blue {duration(blue)} · {Math.round((blue / total) * 100)}%</span>
            <span>Red {duration(red)} · {Math.round((red / total) * 100)}%</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------ aircraft & weapons */

export function AircraftTable({ aircraft }) {
  const list = (aircraft || []).filter((a) => a.sec > 0);
  if (list.length === 0) return null;
  const max = Math.max(1, ...list.map((a) => a.sec));
  const hasDeaths = list.some((a) => a.deaths != null);

  return (
    <Panel>
      <table className="pf-table">
        <thead>
          <tr>
            <th>Tempo in slot</th>
            <th className="is-num">Decolli</th>
            <th className="is-num">Kill</th>
            {hasDeaths && <th className="is-num">K/D</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.type}>
              <td>
                <span className="pf-table__name">{aircraftName(a.type)}<small>{duration(a.sec)}</small></span>
                <span className="pf-bars__track"><span style={{ width: `${Math.max(2, Math.round((a.sec / max) * 100))}%` }} /></span>
              </td>
              <td className="is-num">{nf(a.takeoffs)}</td>
              <td className="is-num">{nf(a.kills)}</td>
              {hasDeaths && <td className="is-num">{a.deaths ? nf(a.kills / a.deaths, 1) : nf(a.kills)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

const weaponName = (w) => String(w || '?').replace(/_/g, '-');

export function WeaponsTable({ weapons }) {
  const list = weapons || [];
  if (list.length === 0) return null;
  const hasKills = list.some((w) => w.kills != null);

  return (
    <Panel>
      <table className="pf-table">
        <thead>
          <tr>
            <th>Precisione</th>
            <th className="is-num">Colpi</th>
            <th className="is-num">A segno</th>
            {hasKills && <th className="is-num">Kill</th>}
          </tr>
        </thead>
        <tbody>
          {list.map((w) => {
            const rate = w.shots ? Math.min(100, Math.round((w.hits / w.shots) * 100)) : 0;
            return (
              <tr key={w.weapon}>
                <td>
                  <span className="pf-table__name">{weaponName(w.weapon)}<small>{rate}%</small></span>
                  <span className="pf-bars__track is-rate"><span style={{ width: `${rate}%` }} /></span>
                </td>
                <td className="is-num">{nf(w.shots)}</td>
                <td className="is-num">{nf(w.hits)}</td>
                {hasKills && <td className="is-num">{nf(w.kills)}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

/* ------------------------------------------------------------ carrier traps */

// Greenieboard LSO grades, best first.
const GRADES = [
  ['_OK_', 'Perfetto'], ['OK', 'OK'], ['(OK)', 'Accettabile'], ['--', 'Sufficiente'],
  ['B', 'Bolter'], ['WO', 'Wave-off'], ['C', 'Cut'],
];

function CountBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="pf-cols" role="img" aria-label={items.map((i) => `${i.label}: ${i.value}`).join(', ')}>
      {items.map((i) => (
        <div key={i.key} className="pf-cols__col" title={`${i.title || i.label}: ${i.value}`}>
          <span className="pf-cols__value">{nf(i.value)}</span>
          <span className="pf-cols__bar"><i style={{ height: `${Math.max(i.value ? 4 : 0, Math.round((i.value / max) * 100))}%` }} /></span>
          <span className="pf-cols__label">{i.label}</span>
        </div>
      ))}
    </div>
  );
}

export function TrapsRecord({ traps }) {
  if (!traps?.traps) return null;
  const grades = traps.grades
    ? GRADES.map(([key, title]) => ({ key, label: key, title, value: Number(traps.grades[key]) || 0 }))
    : null;
  const wires = traps.wires
    ? [1, 2, 3, 4].map((n) => ({ key: n, label: `${n}`, title: `Cavo ${n}`, value: Number(traps.wires[n]) || 0 }))
    : null;
  const cases = traps.cases
    ? [1, 2, 3].map((n) => ({ key: n, label: ['I', 'II', 'III'][n - 1], title: `Case ${['I', 'II', 'III'][n - 1]}`, value: Number(traps.cases[n]) || 0 }))
    : null;

  return (
    <Section title="Appontaggi" hint="Greenieboard">
      <dl className="pf-kpis pf-kpis--compact">
        <div className="pf-kpi"><dt>Appontaggi</dt><dd>{nf(traps.traps)}</dd></div>
        <div className="pf-kpi"><dt>Media LSO</dt><dd>{traps.avgPoints != null ? nf(traps.avgPoints, 1) : '—'}</dd></div>
        <div className="pf-kpi"><dt>Cavo 3</dt><dd>{nf(traps.wire3)}</dd></div>
        {traps.night != null && <div className="pf-kpi"><dt>Notturni</dt><dd>{nf(traps.night)}</dd></div>}
      </dl>
      {(grades || wires || cases) && (
        <div className="pf-grid-3">
          {grades && <Panel title="Voti LSO"><CountBars items={grades} /></Panel>}
          {wires && <Panel title="Cavo preso"><CountBars items={wires} /></Panel>}
          {cases && <Panel title="Procedura"><CountBars items={cases} /></Panel>}
        </div>
      )}
    </Section>
  );
}
