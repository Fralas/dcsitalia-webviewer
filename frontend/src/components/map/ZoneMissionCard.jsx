import { ChevronDown, CircleHelp, Users } from 'lucide-react';
import './ZoneMissionCard.css';

function formatShortRelativeTime(timestamp) {
  if (!timestamp) return '-';
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const totalMinutes = Math.floor(deltaMs / 60000);
  if (totalMinutes < 1) return '<1min';
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getOwnerClass(status) {
  if (status === 'BLUE') return 'zone-mission-card__meta-value--blue';
  if (status === 'RED') return 'zone-mission-card__meta-value--red';
  if (status === 'UNDER_ATTACK') return 'zone-mission-card__meta-value--attack';
  return 'zone-mission-card__meta-value--neutral';
}

function getDotClass(status) {
  if (status === 'BLUE') return 'zone-mission-card__dot--blue';
  if (status === 'RED') return 'zone-mission-card__dot--red';
  if (status === 'UNDER_ATTACK') return 'zone-mission-card__dot--attack';
  return 'zone-mission-card__dot--neutral';
}

export default function ZoneMissionCard({
  zone,
  zones = [],
  neighborZones = [],
  changedAt,
  zoneNumber,
  coordinatesDms,
  coordinatesMgrs,
  acceptedByCurrentUser = false,
  acceptedByOther = false,
  hasTasks = false,
  canAcceptMore = true,
  accepting = false,
  declining = false,
  onSelectZone,
  onAccept,
  onDecline,
}) {
  if (!zone) return null;

  const tasks = Array.isArray(zone.tasks) ? zone.tasks.filter(Boolean) : [];
  const acceptDisabled = (
    accepting
    || declining
    || !hasTasks
    || acceptedByCurrentUser
    || acceptedByOther
    || !canAcceptMore
  );

  return (
    <section className="zone-mission-card" aria-label={`Zone ${zoneNumber} mission card`}>
      <div className="zone-mission-card__header">
        <div className="zone-mission-card__select-wrap">
          <span className={`zone-mission-card__dot ${getDotClass(zone.status)}`} aria-hidden="true" />
          <select
            className="zone-mission-card__select"
            value={zone.id}
            onChange={(event) => onSelectZone?.(event.target.value)}
            aria-label="Select zone"
          >
            {zones.map((entry) => (
              <option key={entry.id} value={entry.id}>
                ZONE {entry.zoneNumber}
              </option>
            ))}
          </select>
          <ChevronDown size={12} className="zone-mission-card__chevron" aria-hidden="true" />
        </div>

        <div className="zone-mission-card__status" aria-label="Zone activity">
          <Users size={12} className="zone-mission-card__status-icon" />
          <span>{zone.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
          <ChevronDown size={12} aria-hidden="true" />
        </div>

        <button type="button" className="zone-mission-card__help" aria-label="Zone help">
          <CircleHelp size={13} />
        </button>
      </div>

      <div className="zone-mission-card__meta">
        <div className="zone-mission-card__meta-item">
          <span className="zone-mission-card__meta-label">Owner</span>
          <span className={`zone-mission-card__meta-value ${getOwnerClass(zone.status)}`}>
            {zone.status || '-'}
          </span>
        </div>
        <div className="zone-mission-card__meta-item">
          <span className="zone-mission-card__meta-label">Coordinate DMS</span>
          <span className="zone-mission-card__meta-value zone-mission-card__meta-value--mono">
            {coordinatesDms}
          </span>
        </div>
        <div className="zone-mission-card__meta-item">
          <span className="zone-mission-card__meta-label">Last Change</span>
          <span className="zone-mission-card__meta-value">{formatShortRelativeTime(changedAt)}</span>
        </div>
        <div className="zone-mission-card__meta-item">
          <span className="zone-mission-card__meta-label">Coordinate MGRS</span>
          <span className="zone-mission-card__meta-value zone-mission-card__meta-value--mono">
            {coordinatesMgrs}
          </span>
        </div>
      </div>

      <div className="zone-mission-card__section">
        <h3 className="zone-mission-card__section-title">Task</h3>
        <div className="zone-mission-card__pills">
          {tasks.length > 0 ? tasks.map((task) => (
            <span key={task} className="zone-mission-card__pill">{task}</span>
          )) : (
            <span className="zone-mission-card__pill zone-mission-card__pill--empty">No tasks</span>
          )}
        </div>
      </div>

      <div className="zone-mission-card__section">
        <h3 className="zone-mission-card__section-title">Surrounded</h3>
        <div className="zone-mission-card__pills">
          {neighborZones.length > 0 ? neighborZones.map((neighbor) => (
            <span key={neighbor.id} className="zone-mission-card__pill">
              ZONE {neighbor.zoneNumber}
            </span>
          )) : (
            <span className="zone-mission-card__pill zone-mission-card__pill--empty">No adjacent zones</span>
          )}
        </div>
      </div>

      <div className="zone-mission-card__footer">
        {acceptedByCurrentUser ? (
          <button
            type="button"
            className="zone-mission-card__action zone-mission-card__action--decline"
            disabled={declining || accepting}
            onClick={() => onDecline?.(zone)}
          >
            {declining ? 'Declining...' : 'Decline Mission'}
          </button>
        ) : (
          <button
            type="button"
            className="zone-mission-card__action zone-mission-card__action--accept"
            disabled={acceptDisabled}
            onClick={() => onAccept?.(zone)}
          >
            {accepting ? 'Accepting...' : 'Accept Mission'}
          </button>
        )}

        {!hasTasks && (
          <p className="zone-mission-card__hint">This zone has no available tasks.</p>
        )}
        {hasTasks && acceptedByOther && (
          <p className="zone-mission-card__hint">This zone is currently assigned to another pilot.</p>
        )}
        {hasTasks && !acceptedByCurrentUser && !canAcceptMore && (
          <p className="zone-mission-card__hint">You can accept at most 2 zones.</p>
        )}
      </div>
    </section>
  );
}
