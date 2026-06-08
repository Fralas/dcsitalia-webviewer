import { t } from '../../utils/locale';

function formatTime(ts) {
  if (!Number.isFinite(ts)) return '--:--:--';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export default function AtcHistoryPanel({ entries = [], filterCallsign = '' }) {
  const filtered = entries.filter((entry) => {
    if (!filterCallsign) return true;
    return String(entry.callsign || '').toLowerCase().includes(filterCallsign.toLowerCase());
  });

  return (
    <div className="atc-history-panel">
      <div className="atc-history-panel__title">{t('atc.history.title')}</div>
      <div className="atc-history-panel__list">
        {filtered.length === 0 && (
          <div className="atc-history-panel__empty">{t('atc.history.empty')}</div>
        )}
        {filtered.map((entry) => (
          <div key={entry.id || `${entry.timestamp}-${entry.stripId}`} className="atc-history-panel__row">
            <span className="atc-history-panel__time">{formatTime(entry.timestamp)}</span>
            <span className="atc-history-panel__action">{entry.action}</span>
            <span className="atc-history-panel__callsign">{entry.callsign || '-'}</span>
            <span className="atc-history-panel__detail">
              {entry.fromBay && entry.toBay ? `${entry.fromBay} → ${entry.toBay}` : ''}
              {entry.role ? ` · ${entry.role}` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
