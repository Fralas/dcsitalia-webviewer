import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Loader2, Lock, Minus, Plus, Search, X } from 'lucide-react';
import { getAirport, orderHidcAirlift } from '../../services/api';
import { t } from '../../utils/locale';
import HidcRoutePreview from './HidcRoutePreview';
import '../LidcAirportWizard.css';
import './HidcAirliftWizard.css';

/**
 * "Trasporto logistico": order an HIDC AI logistics flight (same shell as the airport wizard).
 * Left: aircraft, route with a live map preview, chosen cargo, cost. Right (slides out like the logistics cart once a
 * departure is picked): the departure warehouse. Backend services/hidcAirLift.js, DCORE DBRIDGE_AirLift.lua.
 */

const CATEGORY_ORDER = ['missiles', 'bombs', 'nurs', 'torpedoes', 'shells', 'containers', 'droptanks', 'adapters', 'other'];
const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

export function itemName(id) {
  const parts = String(id || '').split('.');
  const raw = parts[0] === 'weapons' && parts.length > 2 ? parts.slice(2).join('.') : String(id || '');
  return raw.replace(/[{}]/g, '').replace(/_/g, ' ').trim() || '?';
}

function itemCategory(id) {
  const parts = String(id || '').split('.');
  const key = parts[0] === 'weapons' && parts.length > 2 ? parts[1] : 'other';
  return CATEGORY_ORDER.includes(key) ? key : 'other';
}

export function aircraftShort(key) {
  return key === 'CH47' ? 'CH-47' : 'C-130J-30';
}

function distanceNm(a, b) {
  if (!a || !b) return null;
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return (2 * 6371 * Math.asin(Math.sqrt(h))) / 1.852;
}

function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`;
}

/** Airport picker with search. */
function AirportSelect({ label, value, options, onChange, marker }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef(null);
  const selected = options.find((option) => option.id === value) || null;

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') { event.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const visible = options.filter((option) => !q || option.name.toLowerCase().includes(q));

  return (
    <div className={`hidc-alw-field${open ? ' is-open' : ''}`} ref={rootRef}>
      <span className="hidc-alw-label">{label}</span>
      <button type="button" className="hidc-alw-select" aria-haspopup="listbox" aria-expanded={open} onClick={() => { setOpen((v) => !v); setQuery(''); }}>
        <i className={`hidc-alw-marker hidc-alw-marker--${marker}`} aria-hidden="true" />
        <span className={selected ? '' : 'is-placeholder'}>{selected ? selected.name : t('map.rightPanel.ops.airlift.pickAirport')}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <div className="hidc-alw-menu">
          <label className="hidc-alw-menu__search">
            <Search size={14} aria-hidden="true" />
            <input autoFocus type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('map.rightPanel.ops.airlift.searchAirport')} />
          </label>
          <ul role="listbox" aria-label={label}>
            {visible.length === 0 && <li className="is-empty">{t('map.rightPanel.ops.airlift.noAirport')}</li>}
            {visible.map((option) => (
              <li key={option.id} role="option" aria-selected={option.id === value}>
                <button type="button" onClick={() => { onChange(option.id); setOpen(false); }}>
                  <span>{option.name}</span>
                  {option.isHeliport && <em>{t('map.rightPanel.ops.airlift.heliport')}</em>}
                  {option.id === value && <Check size={14} aria-hidden="true" />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function HidcAirliftWizard({ airlift, onClose, onOrdered }) {
  const aircraftList = airlift?.rules?.aircraft || [];
  const [aircraft, setAircraft] = useState(() => aircraftList.find((entry) => entry.unlocked)?.key || 'CH47');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [stock, setStock] = useState(null);
  const [stockError, setStockError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [cargo, setCargo] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rules = aircraftList.find((entry) => entry.key === aircraft) || null;
  const airports = useMemo(() => (airlift?.airports || [])
    .filter((airport) => !(rules?.runwayOnly && airport.isHeliport))
    .sort((a, b) => a.name.localeCompare(b.name, 'it')), [airlift, rules]);
  const from = airports.find((airport) => airport.id === fromId) || null;
  const to = airports.find((airport) => airport.id === toId) || null;

  useEffect(() => {
    const onKey = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The C-130J-30 cannot use heliports: drop a choice that is no longer valid.
  useEffect(() => {
    if (fromId && !airports.some((airport) => airport.id === fromId)) setFromId('');
    if (toId && !airports.some((airport) => airport.id === toId)) setToId('');
  }, [airports, fromId, toId]);

  useEffect(() => {
    setCargo({});
    setStock(null);
    setStockError('');
    setCategory('all');
    setQuery('');
    if (!fromId) return undefined;
    let cancelled = false;
    getAirport(fromId)
      .then((airport) => {
        if (cancelled) return;
        setStock((Array.isArray(airport?.data?.weapons) ? airport.data.weapons : [])
          .map((row) => ({ id: String(row.item), qty: Math.max(0, Math.floor(Number(row.quantity) || 0)) }))
          .filter((row) => row.qty > 0 && row.id.startsWith('weapons.'))
          .sort((a, b) => itemName(a.id).localeCompare(itemName(b.id), 'it')));
      })
      .catch((err) => {
        if (cancelled) return;
        setStock([]);
        setStockError(err?.message || t('map.rightPanel.ops.airlift.stockError'));
      });
    return () => { cancelled = true; };
  }, [fromId]);

  const categories = useMemo(() => {
    const present = new Set((stock || []).map((row) => itemCategory(row.id)));
    return CATEGORY_ORDER.filter((key) => present.has(key));
  }, [stock]);

  const visibleStock = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (stock || []).filter((row) => (category === 'all' || itemCategory(row.id) === category)
      && (!q || itemName(row.id).toLowerCase().includes(q) || row.id.toLowerCase().includes(q)));
  }, [stock, query, category]);

  const stockById = useMemo(() => new Map((stock || []).map((row) => [row.id, row.qty])), [stock]);
  const selected = Object.entries(cargo).map(([id, qty]) => ({ id, qty }));
  const units = selected.reduce((sum, row) => sum + row.qty, 0);
  const cost = rules ? rules.baseCost + Math.ceil(units * (airlift?.rules?.costPerUnit || 0)) : 0;
  const bluePoints = Number.isFinite(Number(airlift?.bluePoints)) ? Number(airlift.bluePoints) : null;
  const affordable = bluePoints == null || bluePoints >= cost;
  const nm = distanceNm(from?.coordinates, to?.coordinates);
  const minutes = nm != null && rules?.speedKmh ? (nm * 1.852 * 60) / rules.speedKmh : null;
  const missing = !rules?.unlocked
    ? t('map.rightPanel.ops.airlift.unlockAt', { level: rules?.minLevel ?? '?' })
    : !fromId || !toId
      ? t('map.rightPanel.ops.airlift.needRoute')
      : units === 0
        ? t('map.rightPanel.ops.airlift.needCargo')
        : !affordable
          ? t('map.rightPanel.ops.airlift.needPoints')
          : '';
  const canSubmit = !missing && !busy;
  const cartOpen = Boolean(fromId);

  const setQty = (id, value) => {
    const max = stockById.get(id) || 0;
    const qty = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
    setCargo((prev) => {
      const next = { ...prev };
      if (qty > 0) next[id] = qty;
      else delete next[id];
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const next = await orderHidcAirlift({ aircraft, fromId, toId, items: selected });
      onOrdered?.(next);
    } catch (err) {
      setError(err?.message || t('map.rightPanel.ops.airlift.orderError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lidc-wizard-root hidc-alw-root">
      <div className="lidc-wizard-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`lidc-airport-wizard-shell hidc-alw-shell${cartOpen ? ' is-cart-open' : ''}`}>
        <section className="lidc-wizard-card hidc-alw-card" role="dialog" aria-modal="true" aria-label={t('map.rightPanel.ops.airlift.newTitle')}>
          <header className="hidc-alw-head">
            <h2>{t('map.rightPanel.ops.airlift.newTitle')}</h2>
            <button type="button" className="lidc-wizard-close" onClick={onClose} aria-label={t('lidc.wizard.close')}>
              <X size={18} />
            </button>
          </header>

          <div className="hidc-alw-body">
            <div className="hidc-alw-seg" role="radiogroup" aria-label={t('map.rightPanel.ops.airlift.aircraft')}>
              {aircraftList.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="radio"
                  aria-checked={aircraft === entry.key}
                  disabled={!entry.unlocked}
                  className={aircraft === entry.key ? 'is-active' : ''}
                  onClick={() => setAircraft(entry.key)}
                  title={entry.unlocked ? undefined : t('map.rightPanel.ops.airlift.unlockAt', { level: entry.minLevel })}
                >
                  {!entry.unlocked && <Lock size={12} aria-hidden="true" />}
                  {aircraftShort(entry.key)}
                  {!entry.unlocked && <small>{t('map.rightPanel.ops.airlift.levelShort', { level: entry.minLevel })}</small>}
                </button>
              ))}
            </div>
            {rules && (
              <p className="hidc-alw-note">
                {rules.runwayOnly ? t('map.rightPanel.ops.airlift.runwayShort') : t('map.rightPanel.ops.airlift.anyBaseShort')}
                {' · '}
                {t('map.rightPanel.ops.airlift.base', { cost: rules.baseCost })}
              </p>
            )}

            <div className="hidc-alw-route">
              <AirportSelect
                label={t('map.rightPanel.ops.departure')}
                value={fromId}
                options={airports.filter((airport) => airport.id !== toId)}
                onChange={setFromId}
                marker="from"
              />
              <AirportSelect
                label={t('map.rightPanel.ops.arrival')}
                value={toId}
                options={airports.filter((airport) => airport.id !== fromId)}
                onChange={setToId}
                marker="to"
              />
            </div>

            <div className="hidc-alw-preview">
              <HidcRoutePreview airports={airports} from={from} to={to} />
              <span className="hidc-alw-preview__info">
                {nm != null
                  ? `${fmt(Math.round(nm))} NM · ${formatDuration(minutes)}`
                  : t('map.rightPanel.ops.airlift.needRoute')}
              </span>
            </div>

            <div className="hidc-alw-chosen">
              <div className="hidc-alw-chosen__head">
                <span className="hidc-alw-label">{t('map.rightPanel.ops.airlift.summary')}</span>
                {units > 0 && <span className="hidc-alw-label">{t('map.rightPanel.ops.airlift.unitsShort', { units: fmt(units) })}</span>}
              </div>
              {selected.length === 0 ? (
                <p className="hidc-alw-note">{fromId ? t('map.rightPanel.ops.airlift.summaryEmpty') : t('map.rightPanel.ops.airlift.pickDeparture')}</p>
              ) : (
                <ul>
                  {selected.map((row) => (
                    <li key={row.id}>
                      <span>{itemName(row.id)}</span>
                      <strong>{fmt(row.qty)}</strong>
                      <button type="button" onClick={() => setQty(row.id, 0)} aria-label={t('map.rightPanel.ops.airlift.remove')}>
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <footer className="hidc-alw-foot">
            <div className="hidc-alw-cost">
              <span className="hidc-alw-label">{t('map.rightPanel.ops.airlift.costLabel')}</span>
              <strong>{fmt(cost)} pt</strong>
              <span className={affordable ? '' : 'is-bad'}>
                {t('map.rightPanel.ops.airlift.blueAvailable', { blue: bluePoints == null ? '—' : fmt(bluePoints) })}
              </span>
            </div>
            <div className="hidc-alw-actions">
              <button type="button" className="lidc-btn lidc-btn-outline" onClick={onClose}>{t('map.rightPanel.ops.airlift.cancel')}</button>
              <button type="button" className="lidc-btn lidc-btn-primary" disabled={!canSubmit} onClick={submit} title={missing || undefined}>
                {busy ? <Loader2 size={16} className="spin" /> : t('map.rightPanel.ops.airlift.confirm')}
              </button>
            </div>
            {error && <p className="hidc-alw-error" role="alert">{error}</p>}
          </footer>
        </section>

        {/* Departure warehouse: slides out like the logistics cart, only once a departure is picked. */}
        <aside
          className={`lidc-airport-wizard-cart hidc-alw-drawer${cartOpen ? ' is-open' : ''}`}
          aria-hidden={!cartOpen}
          inert={cartOpen ? undefined : ''}
          aria-label={t('map.rightPanel.ops.airlift.cargo')}
        >
          <header>
            <h3>{from ? t('map.rightPanel.ops.airlift.warehouseOf', { name: from.name }) : t('map.rightPanel.ops.airlift.cargo')}</h3>
            {selected.length > 0 && <strong>{selected.length}</strong>}
          </header>
          {stock === null ? (
            <div className="hidc-alw-empty"><Loader2 size={16} className="spin" /> {t('map.rightPanel.ops.airlift.loadingStock')}</div>
          ) : (
            <div className="hidc-alw-drawer__body">
              <label className="lidc-airport-wizard-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('map.rightPanel.ops.airlift.searchCargo')} aria-label={t('map.rightPanel.ops.airlift.searchCargo')} />
              </label>
              <div className="hidc-alw-tabs" role="tablist">
                {['all', ...categories].map((key) => (
                  <button key={key} type="button" role="tab" aria-selected={category === key} className={category === key ? 'is-active' : ''} onClick={() => setCategory(key)}>
                    {key === 'all' ? t('map.rightPanel.ops.airlift.allCategories') : t(`lidc.map.airportWizard.armamentCategories.${key}`)}
                  </button>
                ))}
              </div>
              {stockError && <p className="hidc-alw-error">{stockError}</p>}
              {visibleStock.length === 0 ? (
                <div className="hidc-alw-empty">{t('map.rightPanel.ops.airlift.noStock')}</div>
              ) : (
                <ul className="hidc-alw-stock">
                  {visibleStock.map((row) => {
                    const qty = cargo[row.id] || 0;
                    return (
                      <li key={row.id} className={qty > 0 ? 'is-selected' : ''} title={row.id}>
                        <div className="hidc-alw-stock__info">
                          <strong>{itemName(row.id)}</strong>
                          <span>
                            {t('map.rightPanel.ops.airlift.available', { count: fmt(row.qty) })}
                            {qty < row.qty && (
                              <>
                                {' · '}
                                <button type="button" onClick={() => setQty(row.id, row.qty)}>{t('map.rightPanel.ops.airlift.takeAll')}</button>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="hidc-alw-qty">
                          <button type="button" onClick={() => setQty(row.id, qty - 1)} disabled={qty <= 0} aria-label="-1"><Minus size={12} /></button>
                          <input type="number" min={0} max={row.qty} value={qty || ''} placeholder="0" onChange={(event) => setQty(row.id, event.target.value)} aria-label={itemName(row.id)} />
                          <button type="button" onClick={() => setQty(row.id, qty + 1)} disabled={qty >= row.qty} aria-label="+1"><Plus size={12} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
