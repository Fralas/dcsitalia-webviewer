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
  feedEvents = [],
  feedCollapsed = false,
  onToggleFeedCollapsed,
  operationsCollapsed = false,
  onToggleOperationsCollapsed,
  zones,
  combatMissionByZone,
  logisticsMissions,
  productionPoints,
  dcsarPoints = [],
  airports,
  onSelectZone,
  onSelectLogisticsMission,
  onSelectProductionPoint,
  onSelectDcsar,
}) {
  void language;

  return (
    <div className="live-feed-dock">
      <aside
        className={`live-feed-card live-feed-card--feed${feedCollapsed ? ' is-collapsed' : ''}`}
        aria-label={t('map.rightPanel.liveFeed')}
      >
        <div className="live-feed-card__header live-feed-card__header--feed">
          {!feedCollapsed && (
            <h2 className="live-feed-card__title">{t('map.rightPanel.liveFeed')}</h2>
          )}
          <button
            type="button"
            className="live-feed-card__toggle"
            onClick={onToggleFeedCollapsed}
            aria-label={feedCollapsed ? t('map.rightPanel.openSidebar') : t('map.rightPanel.closeSidebar')}
            title={feedCollapsed ? t('map.rightPanel.openSidebar') : t('map.rightPanel.closeSidebar')}
          >
            <ChevronRight
              className={`live-feed-card__toggle-icon${feedCollapsed ? ' is-collapsed' : ''}`}
              strokeWidth={3}
            />
          </button>
        </div>
        {!feedCollapsed && (
          <>
            <div className="live-feed-card__divider" aria-hidden="true" />
            <div className="live-feed-card__body">
              <div className="live-feed-card__list">
                {feedEvents.length === 0 ? (
                  <div className="live-feed-item live-feed-item--empty">
                    <p className="live-feed-item__title">{t('map.rightPanel.emptyEventsTitle')}</p>
                    <p className="live-feed-item__message">{t('map.rightPanel.emptyEventsMessage')}</p>
                  </div>
                ) : (
                  feedEvents.map((event) => (
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
          </>
        )}
      </aside>

      <aside
        className={`live-feed-card live-feed-card--ops${operationsCollapsed ? ' is-collapsed' : ''}`}
        aria-label={t('map.rightPanel.ops.ariaLabel')}
      >
        <div className="live-feed-card__header live-feed-card__header--ops">
          <button
            type="button"
            className="live-feed-card__toggle"
            onClick={onToggleOperationsCollapsed}
            aria-label={operationsCollapsed ? t('map.rightPanel.openSidebar') : t('map.rightPanel.closeSidebar')}
            title={operationsCollapsed ? t('map.rightPanel.openSidebar') : t('map.rightPanel.closeSidebar')}
          >
            <ChevronRight
              className={`live-feed-card__toggle-icon${operationsCollapsed ? ' is-collapsed' : ''}`}
              strokeWidth={3}
            />
          </button>
        </div>
        {!operationsCollapsed && (
          <div className="live-feed-card__body live-feed-card__body--ops">
            <MapOperationsPanel
              language={language}
              collapsed={operationsCollapsed}
              zones={zones}
              combatMissionByZone={combatMissionByZone}
              logisticsMissions={logisticsMissions}
              productionPoints={productionPoints}
              dcsarPoints={dcsarPoints}
              airports={airports}
              onSelectZone={onSelectZone}
              onSelectLogisticsMission={onSelectLogisticsMission}
              onSelectProductionPoint={onSelectProductionPoint}
              onSelectDcsar={onSelectDcsar}
            />
          </div>
        )}
      </aside>
    </div>
  );
}
