import { useMemo, useState } from 'react';
import { OWNER_ROLE } from './atcStripModel';
import { t } from '../../utils/locale';

const ROLE_FILTERS = [
  { id: 'ALL', labelKey: 'atc.history.filterAll' },
  { id: OWNER_ROLE.GROUND, labelKey: 'atc.history.filterGround' },
  { id: OWNER_ROLE.TOWER, labelKey: 'atc.history.filterTower' },
];

function formatTime(ts) {
  if (!Number.isFinite(ts)) return '--:--:--';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function AtcHistoryPanel({ entries = [], filterCallsign = '' }) {
  const [roleFilter, setRoleFilter] = useState('ALL');

  const filtered = useMemo(() => entries.filter((entry) => {
    if (roleFilter !== 'ALL' && entry.role !== roleFilter) return false;
    if (!filterCallsign.trim()) return true;
    const q = filterCallsign.trim().toLowerCase();
    return String(entry.callsign || '').toLowerCase().includes(q)
      || String(entry.action || '').toLowerCase().includes(q);
  }), [entries, roleFilter, filterCallsign]);

  return (
    <div className="atc-history-panel">
      <div className="atc-history-panel__header">
        <div className="atc-history-panel__title">{t('atc.history.title')}</div>
        <div className="atc-history-panel__filters" role="group" aria-label={t('atc.history.filterLabel')}>
          {ROLE_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`atc-history-panel__filter ${roleFilter === opt.id ? 'atc-history-panel__filter--active' : ''} ${opt.id !== 'ALL' ? `atc-history-panel__filter--${opt.id.toLowerCase()}` : ''}`}
              onClick={() => setRoleFilter(opt.id)}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <span className="atc-history-panel__count">{filtered.length}</span>
      </div>
      <div className="atc-history-panel__list">
        {filtered.length === 0 && (
          <div className="atc-history-panel__empty">{t('atc.history.empty')}</div>
        )}
        {filtered.map((entry) => (
          <div key={entry.id || `${entry.timestamp}-${entry.stripId}-${entry.action}`} className="atc-history-panel__row">
            <span className="atc-history-panel__time">{formatTime(entry.timestamp)}</span>
            <span className={`atc-history-panel__role atc-history-panel__role--${(entry.role || 'none').toLowerCase()}`}>
              {entry.role || '—'}
            </span>
            <span className="atc-history-panel__action">{entry.action}</span>
            <span className="atc-history-panel__callsign">{entry.callsign || '-'}</span>
            <span className="atc-history-panel__detail">
              {entry.fromBay && entry.toBay ? `${entry.fromBay} → ${entry.toBay}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
