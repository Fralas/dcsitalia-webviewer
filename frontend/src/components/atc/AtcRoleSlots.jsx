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
}) {
  const isMine = slot?.userId === userId;
  const isGround = role === OWNER_ROLE.GROUND;
  const occupied = Boolean(slot?.userId);
  const Icon = isGround ? Radio : TowerControl;

  return (
    <div className={`atc-slot ${isMine ? 'atc-slot--mine' : ''} ${occupied && !isMine ? 'atc-slot--busy' : ''}`}>
      <div className="atc-slot__header">
        <Icon className="w-4 h-4" />
        <span>{isGround ? t('atc.roles.ground') : t('atc.roles.tower')}</span>
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
}) {
  if (!userId) {
    return <div className="atc-slots atc-slots--guest">{t('atc.errors.loginRequired')}</div>;
  }

  const mustReleaseFirst = Boolean(claimedRole);

  return (
    <div className="atc-slots">
      <SlotCard
        role={OWNER_ROLE.GROUND}
        slot={roleSlots?.GROUND}
        userId={userId}
        onClaim={onClaim}
        onRelease={onRelease}
        disabled={mustReleaseFirst && claimedRole !== OWNER_ROLE.GROUND}
      />
      <SlotCard
        role={OWNER_ROLE.TOWER}
        slot={roleSlots?.TOWER}
        userId={userId}
        onClaim={onClaim}
        onRelease={onRelease}
        disabled={mustReleaseFirst && claimedRole !== OWNER_ROLE.TOWER}
      />
    </div>
  );
}
