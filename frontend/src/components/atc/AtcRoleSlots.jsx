import { LogOut, Radio, TowerControl } from 'lucide-react';
import { OWNER_ROLE } from './atcStripModel';
import { t } from '../../utils/locale';

function SlotCard({
  role,
  slot,
  userId,
  onClaim,
  onRelease,
  disabled,
  compact = false,
}) {
  const isMine = slot?.userId === userId;
  const isGround = role === OWNER_ROLE.GROUND;
  const occupied = Boolean(slot?.userId);
  const Icon = isGround ? Radio : TowerControl;
  const roleLabel = isGround ? t('atc.roles.ground') : t('atc.roles.tower');
  const shortRole = isGround ? 'GND' : 'TWR';

  let status = t('atc.slots.available');
  if (occupied && !isMine) status = slot.username || t('atc.slots.occupiedBy', { name: '?' });
  if (isMine) status = t('atc.slots.yourPosition');

  if (compact) {
    return (
      <div
        className={`atc-slot atc-slot--compact ${isMine ? 'atc-slot--mine' : ''} ${occupied && !isMine ? 'atc-slot--busy' : ''}`}
        title={occupied && !isMine ? t('atc.slots.occupiedBy', { name: slot.username }) : roleLabel}
      >
        <div className="atc-slot__header">
          <Icon className="atc-slot__icon" />
          <span>{shortRole}</span>
        </div>
        <span className={`atc-slot__status ${isMine ? 'atc-slot__status--mine' : ''}`}>{status}</span>
        {isMine ? (
          <button type="button" className="atc-slot__btn atc-slot__btn--icon" onClick={() => onRelease?.(role)} title={t('atc.slots.release')}>
            <LogOut className="atc-slot__icon" />
          </button>
        ) : (
          <button
            type="button"
            className="atc-slot__btn atc-slot__btn--primary atc-slot__btn--icon"
            disabled={disabled || (occupied && !isMine)}
            onClick={() => onClaim?.(role)}
            title={t('atc.slots.claim')}
          >
            <Icon className="atc-slot__icon" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`atc-slot ${isMine ? 'atc-slot--mine' : ''} ${occupied && !isMine ? 'atc-slot--busy' : ''}`}>
      <div className="atc-slot__header">
        <Icon className="w-4 h-4" />
        <span>{roleLabel}</span>
      </div>
      <div className="atc-slot__body">
        {!occupied && <span className="atc-slot__status">{t('atc.slots.available')}</span>}
        {occupied && !isMine && (
          <span className="atc-slot__status">{t('atc.slots.occupiedBy', { name: slot.username })}</span>
        )}
        {isMine && <span className="atc-slot__status atc-slot__status--mine">{t('atc.slots.yourPosition')}</span>}
      </div>
      <div className="atc-slot__actions">
        {isMine ? (
          <button type="button" className="atc-slot__btn" onClick={() => onRelease?.(role)}>
            <LogOut className="w-3.5 h-3.5" />
            {t('atc.slots.release')}
          </button>
        ) : (
          <button
            type="button"
            className="atc-slot__btn atc-slot__btn--primary"
            disabled={disabled || (occupied && !isMine)}
            onClick={() => onClaim?.(role)}
          >
            {t('atc.slots.claim')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AtcRoleSlots({
  roleSlots,
  userId,
  claimedRole,
  onClaim,
  onRelease,
  compact = false,
}) {
  if (!userId) {
    return (
      <div className={`atc-slots atc-slots--guest ${compact ? 'atc-slots--compact' : ''}`}>
        {t('atc.errors.loginRequired')}
      </div>
    );
  }

  const mustReleaseFirst = Boolean(claimedRole);

  return (
    <div className={`atc-slots ${compact ? 'atc-slots--compact' : ''}`}>
      <SlotCard
        role={OWNER_ROLE.GROUND}
        slot={roleSlots?.GROUND}
        userId={userId}
        onClaim={onClaim}
        onRelease={onRelease}
        disabled={mustReleaseFirst && claimedRole !== OWNER_ROLE.GROUND}
        compact={compact}
      />
      <SlotCard
        role={OWNER_ROLE.TOWER}
        slot={roleSlots?.TOWER}
        userId={userId}
        onClaim={onClaim}
        onRelease={onRelease}
        disabled={mustReleaseFirst && claimedRole !== OWNER_ROLE.TOWER}
        compact={compact}
      />
    </div>
  );
}
