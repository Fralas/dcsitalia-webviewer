import { AlertTriangle } from 'lucide-react';
import {
  OWNER_ROLE,
  isHandoffToGround,
  isHandoffToTower,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
} from './atcStripModel';
import { t } from '../../utils/locale';

export default function AtcCoordinationPanel({
  strips = [],
  tocQueue = [],
  operatorRole,
  onAccept,
  onReject,
}) {
  const queueIds = new Set(tocQueue);
  const pending = strips
    .filter((strip) => {
      if (operatorRole === OWNER_ROLE.TOWER) {
        return isPendingTowerCoordination(strip) && isHandoffToTower(strip);
      }
      if (operatorRole === OWNER_ROLE.GROUND) {
        return isPendingGroundCoordination(strip) && isHandoffToGround(strip);
      }
      return false;
    })
    .sort((a, b) => {
      const ai = tocQueue.indexOf(a.id);
      const bi = tocQueue.indexOf(b.id);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

  if (pending.length === 0) return null;

  const isTower = operatorRole === OWNER_ROLE.TOWER;

  return (
    <div className="atc-coord-panel">
      <div className="atc-coord-panel__title">
        <AlertTriangle className="w-4 h-4" />
        {isTower ? t('atc.coord.titleToc') : t('atc.coord.titleAog')} ({pending.length})
      </div>
      <ul className="atc-coord-panel__list">
        {pending.map((strip, index) => (
          <li key={strip.id} className="atc-coord-panel__item">
            <div>
              <span className="atc-coord-panel__queue">#{queueIds.has(strip.id) ? index + 1 : '—'}</span>
              <strong>{strip.callsign || 'N/A'}</strong>
              <span>{strip.direction === 'arr' ? t('atc.direction.arr') : t('atc.direction.dep')}</span>
            </div>
            <div className="atc-coord-panel__actions">
              <button type="button" onClick={() => onAccept?.(strip)}>
                {isTower ? t('atc.actions.acceptToc') : t('atc.actions.acceptAog')}
              </button>
              <button type="button" onClick={() => onReject?.(strip)}>
                {isTower ? t('atc.actions.rejectToc') : t('atc.actions.rejectAog')}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
