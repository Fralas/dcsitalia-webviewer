import { ChevronRight } from 'lucide-react';
import MapOperationsPanel from './MapOperationsPanel';
import { t } from '../../utils/locale';
import './LiveFeedPanel.css';

const FEED_TYPE_KEYS = {
  'zone.status_changed': 'zone',
  'logistics.': 'logistics',
  'ato.': 'ato',
  'convoy.': 'convoy',
  'dcsar.': 'dcsar',
  'user.': 'user',
  'dcore.pp_upgrade': 'production',
  'dcore.pp_retrieve': 'production',
  'dcore.spawn': 'spawn',
  'dcore.dbuild': 'build',
};

function getFeedTypeClass(type) {
  if (type === 'zone.status_changed') return 'live-feed-item__badge--zone';
  if (type?.startsWith('logistics.')) return 'live-feed-item__badge--logistics';
  if (type?.startsWith('ato.')) return 'live-feed-item__badge--ato';
  if (type?.startsWith('convoy.')) return 'live-feed-item__badge--convoy';
  if (type?.startsWith('dcsar.')) return 'live-feed-item__badge--dcsar';
  if (type?.startsWith('user.')) return 'live-feed-item__badge--user';
  if (type?.startsWith('dcore.pp_upgrade') || type?.startsWith('dcore.pp_retrieve')) return 'live-feed-item__badge--production';
  if (type?.startsWith('dcore.spawn')) return 'live-feed-item__badge--spawn';
  if (type?.startsWith('dcore.dbuild')) return 'live-feed-item__badge--build';
  return 'live-feed-item__badge--system';
}

function getFeedTypeKey(type) {
  if (type === 'zone.status_changed') return 'zone';
  for (const [prefix, key] of Object.entries(FEED_TYPE_KEYS)) {
    if (prefix.endsWith('.') && type?.startsWith(prefix)) return key;
    if (type?.startsWith(prefix)) return key;
  }
  return 'system';
}

function getFeedTypeLabel(type) {
  return t(`map.rightPanel.feedTypes.${getFeedTypeKey(type)}`);
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return t('map.rightPanel.timeAgo.justNow');
  const deltaMs = Date.now() - timestamp;
  const sec = Math.max(1, Math.floor(deltaMs / 1000));
  if (sec < 60) return t('map.rightPanel.timeAgo.seconds', { count: sec });
  const min = Math.floor(sec / 60);
  if (min < 60) return t('map.rightPanel.timeAgo.minutes', { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t('map.rightPanel.timeAgo.hours', { count: hours });
  const days = Math.floor(hours / 24);
  return t('map.rightPanel.timeAgo.days', { count: days });
}

export default function LiveFeedPanel({
  language = 'en',
  events = [],
  collapsed = false,
  onToggleCollapsed,
  zones,
  combatMissionByZone,
  logisticsMissions,
  productionPoints,
  airports,
  onSelectZone,
  onSelectLogisticsMission,
  onSelectProductionPoint,
}) {
  void language;

  return (
    <div className="live-feed-dock">
      <button
        type="button"
        className="live-feed-panel__toggle"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? t('map.rightPanel.openSidebar') : t('map.rightPanel.closeSidebar')}
        title={collapsed ? t('map.rightPanel.openSidebar') : t('map.rightPanel.closeSidebar')}
      >
        <ChevronRight
          className={`live-feed-panel__toggle-icon${collapsed ? ' live-feed-panel__toggle-icon--collapsed' : ''}`}
          strokeWidth={3}
        />
      </button>

      <aside
        className={`live-feed-panel${collapsed ? ' live-feed-panel--collapsed' : ''}`}
        aria-label={t('map.rightPanel.ariaLabel')}
        aria-expanded={!collapsed}
      >
        <div className="live-feed-panel__inner">
          <div className="live-feed-panel__header">
            <h2 className="live-feed-panel__title">{t('map.rightPanel.liveFeed')}</h2>
          </div>

          <div className="live-feed-panel__body" aria-hidden={collapsed}>
            <div className="live-feed-panel__feed">
              <div className="live-feed-panel__list">
              {events.length === 0 ? (
                <div className="live-feed-item live-feed-item--empty">
                  <p className="live-feed-item__title">{t('map.rightPanel.emptyEventsTitle')}</p>
                  <p className="live-feed-item__message">{t('map.rightPanel.emptyEventsMessage')}</p>
                </div>
              ) : (
                events.map((event) => (
                  <article
                    key={event.id || `${event.type}-${event.timestamp}`}
                    className="live-feed-item"
                  >
                    <div className="live-feed-item__top">
                      <span className={`live-feed-item__badge ${getFeedTypeClass(event.type)}`}>
                        {getFeedTypeLabel(event.type)}
                      </span>
                      <time className="live-feed-item__time" dateTime={new Date(event.timestamp || 0).toISOString()}>
                        {formatRelativeTime(event.timestamp)}
                      </time>
                    </div>
                    <h3 className="live-feed-item__title">{event.title || t('map.rightPanel.activityUpdate')}</h3>
                    {event.message && (
                      <p className="live-feed-item__message">{event.message}</p>
                    )}
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="live-feed-panel__divider" aria-hidden="true" />

          <MapOperationsPanel
            language={language}
            collapsed={collapsed}
            zones={zones}
            combatMissionByZone={combatMissionByZone}
            logisticsMissions={logisticsMissions}
            productionPoints={productionPoints}
            airports={airports}
            onSelectZone={onSelectZone}
            onSelectLogisticsMission={onSelectLogisticsMission}
            onSelectProductionPoint={onSelectProductionPoint}
          />
        </div>
        </div>
      </aside>
    </div>
  );
}
