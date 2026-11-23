import { useEffect, useRef, useState } from 'react';

const nf = (n, digits = 0) => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: digits, minimumFractionDigits: digits });

const LB_TO_KG = 0.45359237;
const ALL = '__all__';

// DCS tanker type -> readable name.
const TANKERS = {
  KC135MPRS: 'KC-135 MPRS',
  'KC-135': 'KC-135',
  KC130: 'KC-130',
  'KC130J': 'KC-130J',
  S3BTanker: 'S-3B Tanker',
  'IL-78M': 'Il-78M',
  'KC_10_Extender': 'KC-10',
  'KC_10_Extender_D': 'KC-10',
  'FA-18C_hornet': 'F/A-18C (buddy)',
};

export const tankerName = (type) => (type ? (TANKERS[type] || type.replace(/_/g, ' ')) : 'Sconosciuto');

function formatSec(sec) {
  if (sec == null) return '—';
  const s = Math.round(Number(sec) || 0);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

function Stat({ label, value }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Tanker name with a bare chevron that opens a site-styled list (keyboard: arrows, Enter, Esc). */
function TankerFilter({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const items = [{ value: ALL, label: 'Tutti i tanker', count: options.reduce((s, t) => s + (Number(t.refuels) || 0), 0) },
    ...options.map((t) => ({ value: t.tanker || '?', label: tankerName(t.tanker), count: t.refuels }))];
  const selected = Math.max(0, items.findIndex((item) => item.value === value));

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (options.length < 2) return <>{options[0] ? tankerName(options[0].tanker) : '—'}</>;

  const pick = (index) => {
    onChange(items[index].value);
    setOpen(false);
    buttonRef.current?.focus();
  };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); return; }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) { setActive(selected); setOpen(true); return; }
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => (i + step + items.length) % items.length);
    } else if ((event.key === 'Enter' || event.key === ' ') && open) {
      event.preventDefault();
      pick(active);
    }
  };

  return (
    <span className={`pf-filter${open ? ' is-open' : ''}`} ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className="pf-filter__button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Filtra per tanker: ${value === ALL ? 'tutti' : items[selected].label}`}
        onClick={() => { setActive(selected); setOpen((o) => !o); }}
      >
        <span className="pf-filter__label">{value === ALL ? 'Tutti' : items[selected].label}</span>
        <svg className="pf-filter__chevron" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="pf-filter__menu" role="listbox" aria-label="Tanker">
          {items.map((item, index) => (
            <li
              key={item.value}
              role="option"
              aria-selected={index === selected}
              className={`${index === selected ? 'is-selected' : ''} ${index === active ? 'is-active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(index)}
            >
              <span>{item.label}</span>
              <small>{nf(item.count)}</small>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

/**
 * Support work: cargo logistics, crates (sling or internal) and troops (DCORE DBRIDGE_Cargo), and
 * air-to-air refueling (DCSServerBot).
 * Shown to every linked pilot: zeros until the first delivery, a note when DCSServerBot is not connected.
 */
export default function SupportRecord({ cargo: cargoIn, refueling, linked = false, botConnected = false }) {
  const [tanker, setTanker] = useState(ALL);
  if (!linked) return null;
  // Nessun file del tracker DCORE ancora: il pilota non ha ancora trasportato nulla.
  const cargo = cargoIn || { deliveries: 0, kg: 0, km: 0, tkm: 0 };
  // Totale = casse (gancio o vano) + truppe; km e t·km sommano i due tipi di viaggio.
  const tonnes = ((Number(cargo.kg) || 0) + (Number(cargo.troopsKg) || 0)) / 1000;
  const km = (Number(cargo.km) || 0) + (Number(cargo.troopsKm) || 0);
  const tkm = (Number(cargo.tkm) || 0) + (Number(cargo.troopsTkm) || 0);

  const tankers = refueling?.byTanker || [];
  const picked = tanker === ALL ? null : tankers.find((t) => (t.tanker || '?') === tanker);
  const fuel = picked || refueling;
  const fuelKg = (Number(fuel?.lbs) || 0) * LB_TO_KG;

  return (
    <section className="pf-section">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Supporto</h2>
      </div>
      <div className="pf-support">
        <div className="pf-support__half">
          <div className="pf-support__lead">
            <strong>{nf(tonnes, tonnes < 10 ? 1 : 0)}<small>t</small></strong>
            <span>Carico trasportato (casse e truppe)</span>
          </div>
          <dl className="pf-figures pf-figures--flat pf-figures--4">
            <Stat label="Casse" value={nf(cargo.deliveries)} />
            <Stat label="Truppe" value={nf(cargo.troops)} />
            <Stat label="Distanza" value={`${nf(km, 0)} km`} />
            <Stat label="Tonnellate·km" value={nf(tkm, 0)} />
          </dl>
        </div>
        {!refueling && botConnected && (
          <div className="pf-support__half">
            <div className="pf-support__lead">
              <strong>—</strong>
              <span>Carburante preso in volo</span>
            </div>
            <p className="profile__empty">Nessun rifornimento in volo registrato.</p>
          </div>
        )}
        {refueling && (
          <div className="pf-support__half">
            <div className="pf-support__lead">
              <strong>{nf(fuelKg / 1000, 1)}<small>t</small></strong>
              <span>Carburante preso in volo ({nf(fuel.lbs)} lb)</span>
            </div>
            <dl className="pf-figures pf-figures--flat">
              <Stat label="Rifornimenti" value={nf(fuel.refuels)} />
              <Stat label="Tempo medio" value={formatSec(fuel.avgSec)} />
              <Stat
                label="Tanker"
                value={tankers.length > 0
                  ? <TankerFilter options={tankers} value={picked ? tanker : ALL} onChange={setTanker} />
                  : (refueling.topTanker ? tankerName(refueling.topTanker) : '—')}
              />
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
