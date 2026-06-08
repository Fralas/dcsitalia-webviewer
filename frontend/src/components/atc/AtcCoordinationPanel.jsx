import { AlertTriangle } from 'lucide-react';
import { COORDINATION_STATUS } from './atcStripModel';
import { t } from '../../utils/locale';

export default function AtcCoordinationPanel({ strips = [], tocQueue = [], onAccept, onReject }) {
  const queueIds = new Set(tocQueue);
  const pending = strips
    .filter((s) => s.coordinationStatus === COORDINATION_STATUS.PENDING_TOC && s.handoffActive)
    .sort((a, b) => {
      const ai = tocQueue.indexOf(a.id);
      const bi = tocQueue.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  const visible = pending;

  if (visible.length === 0) return null;

  return (
    <div className="atc-coord-panel">
      <div className="atc-coord-panel__title">
        <AlertTriangle className="w-4 h-4" />
        {t('atc.coord.title')} ({visible.length})
      </div>
      <ul className="atc-coord-panel__list">
        {visible.map((strip, index) => (
          <li key={strip.id} className="atc-coord-panel__item">
            <div>
              <span className="atc-coord-panel__queue">#{queueIds.has(strip.id) ? index + 1 : '—'}</span>
              <strong>{strip.callsign || 'N/A'}</strong>
              <span>{strip.direction === 'arr' ? t('atc.direction.arr') : t('atc.direction.dep')}</span>
            </div>
            <div className="atc-coord-panel__actions">
              <button type="button" onClick={() => onAccept?.(strip)}>{t('atc.actions.acceptToc')}</button>
              <button type="button" onClick={() => onReject?.(strip)}>{t('atc.actions.rejectToc')}</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
