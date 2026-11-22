import { X } from 'lucide-react';
import { t } from '../../utils/locale';
import './ZoneMissionCard.css';

/**
 * Card of the zone selected on the map: owner, last change, coordinates, tasks, adjacent zones.
 * Missions are accepted from the operations panel ("Missione" tab), not from here.
 */

function formatShortRelativeTime(timestamp) {
  if (!timestamp) return '—';
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const totalMinutes = Math.floor(deltaMs / 60000);
  if (totalMinutes < 1) return t('map.rightPanel.timeAgo.justNow');
  if (totalMinutes < 60) return t('map.rightPanel.timeAgo.minutes', { count: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return t('map.rightPanel.timeAgo.hours', { count: hours });
  return t('map.rightPanel.timeAgo.days', { count: Math.floor(hours / 24) });
}

function statusTone(status) {
  const value = String(status || 'NEUTRAL').toUpperCase();
  if (value === 'BLUE') return 'blue';
  if (value === 'RED') return 'red';
  if (value === 'UNDER_ATTACK') return 'attack';
  return 'neutral';
}

function formatStatusLabel(status) {
  return t(`map.rightPanel.zoneCard.status.${statusTone(status)}`);
}

function formatCardDms(dms) {
  if (!dms || dms === '-') return dms || '—';
  return String(dms).replace(', ', '  ');
}

export default function ZoneMissionCard({
  zone,
  neighborZones = [],
  changedAt,
  zoneNumber,
  coordinatesDms,
  coordinatesMgrs,
  onClose,
}) {
  if (!zone) return null;

  const tasks = Array.isArray(zone.tasks) ? zone.tasks.filter(Boolean) : [];
  const ownerTone = statusTone(zone.status);

  return (
    <section
      className="zone-mission-card"
      aria-label={t('map.rightPanel.ops.zone', { number: zoneNumber })}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="zone-mission-card__head">
        <div className="zone-mission-card__identity">
          <span className={`zone-mission-card__type zone-mission-card__type--${ownerTone}`}>
            {formatStatusLabel(zone.status)}
          </span>
          <span className="zone-mission-card__name">
            {t('map.rightPanel.ops.zone', { number: zoneNumber })}
          </span>
        </div>

        <div className="zone-mission-card__tools">
          <button
            type="button"
            className="zone-mission-card__icon-btn"
            aria-label={t('map.rightPanel.closeSidebar')}
            onClick={onClose}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <div className="zone-mission-card__body">
        <dl className="zone-mission-card__meta">
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.owner')}</dt>
            <dd className={`zone-mission-card__meta-value zone-mission-card__meta-value--${ownerTone}`}>
              {formatStatusLabel(zone.status)}
            </dd>
          </div>
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.lastChange')}</dt>
            <dd>{formatShortRelativeTime(changedAt)}</dd>
          </div>
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.dms')}</dt>
            <dd className="zone-mission-card__meta-coords">{formatCardDms(coordinatesDms)}</dd>
          </div>
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.mgrs')}</dt>
            <dd className="zone-mission-card__meta-coords">{coordinatesMgrs || '—'}</dd>
          </div>
        </dl>

        <div className="zone-mission-card__section">
          <p className="zone-mission-card__section-title">{t('map.rightPanel.zoneCard.task')}</p>
          <div className="zone-mission-card__tags">
            {tasks.length > 0 ? tasks.map((task) => (
              <span key={task} className="zone-mission-card__tag">{task}</span>
            )) : (
              <span className="zone-mission-card__tag is-empty">{t('map.rightPanel.zoneCard.noTasks')}</span>
            )}
          </div>
        </div>

        <div className="zone-mission-card__section">
          <p className="zone-mission-card__section-title">{t('map.rightPanel.zoneCard.surrounded')}</p>
          <div className="zone-mission-card__tags">
            {neighborZones.length > 0 ? neighborZones.map((neighbor) => (
              <span key={neighbor.id} className="zone-mission-card__tag">
                {t('map.rightPanel.ops.zone', { number: neighbor.zoneNumber })}
              </span>
            )) : (
              <span className="zone-mission-card__tag is-empty">—</span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
