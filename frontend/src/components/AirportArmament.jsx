import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Loader2, Search, X } from 'lucide-react';
import * as api from '../services/api';
import { t } from '../utils/locale';
import InlineError from './InlineError';

/**
 * Airport armament from the DCS warehouse CSV (<airport>_weapons.csv, rows "weapons.<category>.<item>,<qty>"),
 * grouped by category. Read-only: the site never writes the CSV.
 */

// Category order and keys (DCS warehouse paths).
const CATEGORIES = ['missiles', 'bombs', 'nurs', 'torpedoes', 'shells', 'containers', 'droptanks', 'adapters', 'other'];
const REFRESH_MS = 60 * 1000;

function categoryOf(item) {
  const parts = String(item || '').split('.');
  const key = parts[0] === 'weapons' && parts.length > 2 ? parts[1] : 'other';
  return CATEGORIES.includes(key) ? key : 'other';
}

/** "weapons.missiles.AIM_120C" -> "AIM 120C"; "{INV-SMOKE-WHITE}" -> "INV-SMOKE-WHITE". */
function itemName(item) {
  const parts = String(item || '').split('.');
  const raw = parts[0] === 'weapons' && parts.length > 2 ? parts.slice(2).join('.') : String(item || '');
  return raw.replace(/[{}]/g, '').replace(/_/g, ' ').trim() || '?';
}

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

function groupWeapons(weapons, query) {
  const q = query.trim().toLowerCase();
  const groups = new Map(CATEGORIES.map((key) => [key, { key, items: [], empty: 0, units: 0 }]));
  (Array.isArray(weapons) ? weapons : []).forEach((row) => {
    const quantity = Math.max(0, Math.floor(Number(row?.quantity) || 0));
    const name = itemName(row?.item);
    if (q && !name.toLowerCase().includes(q) && !String(row?.item || '').toLowerCase().includes(q)) return;
    const group = groups.get(categoryOf(row?.item));
    if (quantity < 1) {
      group.empty += 1;
      return;
    }
    group.items.push({ id: row.item, name, quantity });
    group.units += quantity;
  });
  return [...groups.values()]
    .map((group) => ({ ...group, items: group.items.sort((a, b) => a.name.localeCompare(b.name, 'it')) }))
    .filter((group) => group.items.length > 0 || group.empty > 0);
}

export default function AirportArmament({ airportId, active = true }) {
  const [weapons, setWeapons] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(() => new Set(['missiles', 'bombs']));

  useEffect(() => {
    if (!airportId || !active) return undefined;
    let cancelled = false;
    const load = () => {
      api.getAirport(airportId)
        .then((airport) => {
          if (cancelled) return;
          setWeapons(Array.isArray(airport?.data?.weapons) ? airport.data.weapons : []);
          setUpdatedAt(Number(airport?.data?.timestamp) || null);
          setError('');
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err?.status === 404 ? '' : (err?.message || t('lidc.map.airportWizard.armamentError')));
          if (err?.status === 404) setWeapons([]);
        });
    };
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [airportId, active]);

  const groups = useMemo(() => groupWeapons(weapons, query), [weapons, query]);
  const searching = query.trim().length > 0;
  const totalUnits = groups.reduce((sum, group) => sum + group.units, 0);
  const totalTypes = groups.reduce((sum, group) => sum + group.items.length, 0);

  const toggle = (key) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  if (weapons === null && !error) {
    return (
      <div className="lidc-loading">
        <Loader2 size={14} className="spin" />
        <span>{t('lidc.general.loading')}</span>
      </div>
    );
  }

  return (
    <div className="airport-armament">
      {error && <InlineError message={error} />}

      <div className="airport-armament__summary">
        <div><strong>{fmt(totalTypes)}</strong><span>{t('lidc.map.airportWizard.armamentTypes')}</span></div>
        <div><strong>{fmt(totalUnits)}</strong><span>{t('lidc.map.airportWizard.armamentUnits')}</span></div>
        {updatedAt && (
          <div className="is-time">
            <span>{t('lidc.map.airportWizard.armamentUpdated')}</span>
            <em>{new Date(updatedAt).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</em>
          </div>
        )}
      </div>

      <label className="lidc-airport-wizard-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onMouseDown={(event) => event.stopPropagation()}
          placeholder={t('lidc.map.airportWizard.armamentSearch')}
          aria-label={t('lidc.map.airportWizard.armamentSearch')}
        />
        {query ? (
          <button
            type="button"
            className="lidc-airport-wizard-search__clear"
            onClick={() => setQuery('')}
            aria-label={t('lidc.map.airportWizard.clearSearch')}
          >
            <X size={14} />
          </button>
        ) : null}
      </label>

      {groups.length === 0 ? (
        <p className="lidc-occupancy-panel__hint">
          {searching ? t('lidc.map.airportWizard.searchEmpty') : t('lidc.map.airportWizard.armamentEmpty')}
        </p>
      ) : (
        <div className="airport-armament__groups">
          {groups.map((group) => {
            const isOpen = searching || open.has(group.key);
            return (
              <section key={group.key} className={`airport-armament__group${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="airport-armament__head"
                  aria-expanded={isOpen}
                  onClick={() => toggle(group.key)}
                >
                  <span className="airport-armament__title">{t(`lidc.map.airportWizard.armamentCategories.${group.key}`)}</span>
                  <span className="airport-armament__meta">
                    {fmt(group.items.length)} {t('lidc.map.airportWizard.armamentTypesShort')} · {fmt(group.units)} {t('lidc.map.airportWizard.armamentUnitsShort')}
                  </span>
                  <ChevronDown size={16} className="airport-armament__chevron" aria-hidden="true" />
                </button>
                {isOpen && (
                  <ul className="airport-armament__list">
                    {group.items.map((item) => (
                      <li key={item.id} title={item.id}>
                        <span>{item.name}</span>
                        <strong>{fmt(item.quantity)}</strong>
                      </li>
                    ))}
                    {group.empty > 0 && (
                      <li className="is-empty">
                        <span>{t('lidc.map.airportWizard.armamentOut', { count: group.empty })}</span>
                      </li>
                    )}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
