import { Check, X } from 'lucide-react';
import {
  isHandoffToGround,
  isHandoffToTower,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
} from './atcStripModel';
import { t } from '../../utils/locale';

export default function AtcActionBar({
  strip,
  nextAction,
  operatorRole,
  onAction,
  onCoordinate,
  onCancelHandoff,
}) {
  const canAcceptToc = isPendingTowerCoordination(strip) && operatorRole === 'TOWER';
  const canAcceptAog = isPendingGroundCoordination(strip) && operatorRole === 'GROUND';
  const canCancelHandoff = (
    (operatorRole === 'GROUND' && isHandoffToTower(strip))
    || (operatorRole === 'TOWER' && isHandoffToGround(strip))
  );

  return (
    <div className="atc-action-bar" onClick={(e) => e.stopPropagation()}>
      {canCancelHandoff ? (
        <button
          type="button"
          className="atc-action-btn atc-action-btn--reject"
          onClick={() => onCancelHandoff?.(strip)}
        >
          {t('atc.actions.cancelHandoff')}
        </button>
      ) : canAcceptToc ? (
        <div className="atc-action-bar__coord">
          <button type="button" className="atc-action-btn atc-action-btn--accept" onClick={() => onCoordinate?.(strip, true)}>
            <Check className="w-3.5 h-3.5" />
            {t('atc.actions.acceptToc')}
          </button>
          <button type="button" className="atc-action-btn atc-action-btn--reject" onClick={() => onCoordinate?.(strip, false)}>
            <X className="w-3.5 h-3.5" />
            {t('atc.actions.rejectToc')}
          </button>
        </div>
      ) : canAcceptAog ? (
        <div className="atc-action-bar__coord">
          <button type="button" className="atc-action-btn atc-action-btn--accept" onClick={() => onCoordinate?.(strip, true)}>
            <Check className="w-3.5 h-3.5" />
            {t('atc.actions.acceptAog')}
          </button>
          <button type="button" className="atc-action-btn atc-action-btn--reject" onClick={() => onCoordinate?.(strip, false)}>
            <X className="w-3.5 h-3.5" />
            {t('atc.actions.rejectAog')}
          </button>
        </div>
      ) : nextAction?.action ? (
        <button
          type="button"
          className="atc-action-btn atc-action-btn--primary"
          onClick={() => onAction?.(strip, nextAction.action)}
        >
          {nextAction.action}
        </button>
      ) : (
        <span className="atc-action-bar__hint">{t('atc.actions.dragOrWait')}</span>
      )}
    </div>
  );
}
