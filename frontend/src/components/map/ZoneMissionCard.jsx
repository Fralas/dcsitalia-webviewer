import { ChevronDown, CircleHelp } from 'lucide-react';
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
  return '';
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
        <div className="zone-mission-card__header-chip" aria-hidden="true">
          <span className="zone-mission-card__chip-ring" />
          <ChevronDown strokeWidth={3} className="zone-mission-card__chip-chevron" />
        </div>

        <div className="zone-mission-card__zone-select">
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
          <ChevronDown strokeWidth={3} className="zone-mission-card__select-chevron" aria-hidden="true" />
        </div>

        <button type="button" className="zone-mission-card__help" aria-label="Zone help">
          <CircleHelp strokeWidth={2} />
        </button>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__meta">
        <div className="zone-mission-card__meta-col">
          <p className="zone-mission-card__meta-line">
            Owner:{' '}
            <span className={`zone-mission-card__meta-value ${getOwnerClass(zone.status)}`}>
              {zone.status || '-'}
            </span>
          </p>
          <p className="zone-mission-card__meta-line">
            Last Change:{' '}
            <span className="zone-mission-card__meta-value">{formatShortRelativeTime(changedAt)}</span>
          </p>
        </div>
        <div className="zone-mission-card__meta-col zone-mission-card__meta-col--coords">
          <p className="zone-mission-card__meta-line">
            Coordinate DMS:{' '}
            <span className="zone-mission-card__meta-value">{coordinatesDms}</span>
          </p>
          <p className="zone-mission-card__meta-line">
            Coordinate MGRS:{' '}
            <span className="zone-mission-card__meta-value">{coordinatesMgrs}</span>
          </p>
        </div>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__section">
        <p className="zone-mission-card__section-title">Task</p>
        <div className="zone-mission-card__pills zone-mission-card__pills--task">
          {tasks.length > 0 ? tasks.map((task) => (
            <span key={task} className="zone-mission-card__pill">{task}</span>
          )) : (
            <span className="zone-mission-card__pill zone-mission-card__pill--empty">No tasks</span>
          )}
        </div>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__section">
        <p className="zone-mission-card__section-title">Surrounded</p>
        <div className="zone-mission-card__pills zone-mission-card__pills--neighbor">
          {neighborZones.length > 0 ? neighborZones.map((neighbor) => (
            <span key={neighbor.id} className="zone-mission-card__pill">
              ZONE {neighbor.zoneNumber}
            </span>
          )) : (
            <span className="zone-mission-card__pill zone-mission-card__pill--empty">-</span>
          )}
        </div>
      </div>

      <div className="zone-mission-card__divider" />

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
