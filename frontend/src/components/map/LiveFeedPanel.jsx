import { ChevronRight } from 'lucide-react';
import './LiveFeedPanel.css';

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

function getFeedTypeLabel(type) {
  if (type === 'zone.status_changed') return 'Zone';
  if (type?.startsWith('logistics.')) return 'Logistics';
  if (type?.startsWith('ato.')) return 'ATO';
  if (type?.startsWith('convoy.')) return 'Convoy';
  if (type?.startsWith('dcsar.')) return 'CSAR';
  if (type?.startsWith('user.')) return 'User';
  if (type?.startsWith('dcore.pp_upgrade') || type?.startsWith('dcore.pp_retrieve')) return 'Production';
  if (type?.startsWith('dcore.spawn')) return 'Spawn';
  if (type?.startsWith('dcore.dbuild')) return 'Build';
  return 'System';
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'just now';
  const deltaMs = Date.now() - timestamp;
  const sec = Math.max(1, Math.floor(deltaMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function LiveFeedPanel({
  events = [],
  collapsed = false,
  onToggleCollapsed,
}) {
  return (
    <aside
      className={`live-feed-panel${collapsed ? ' live-feed-panel--collapsed' : ''}`}
      aria-label="Live feed"
    >
      <div className="live-feed-panel__header">
        {!collapsed && <h2 className="live-feed-panel__title">Live Feed</h2>}
        <button
          type="button"
          className="live-feed-panel__toggle"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Open feed' : 'Close feed'}
          title={collapsed ? 'Open feed' : 'Close feed'}
        >
          <ChevronRight
            className={`live-feed-panel__toggle-icon${collapsed ? ' live-feed-panel__toggle-icon--collapsed' : ''}`}
            strokeWidth={3}
          />
        </button>
      </div>

      {!collapsed && (
        <div className="live-feed-panel__list">
          {events.length === 0 ? (
            <div className="live-feed-item live-feed-item--empty">
              <p className="live-feed-item__title">No events yet</p>
              <p className="live-feed-item__message">Activity will appear here as it happens.</p>
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
                <h3 className="live-feed-item__title">{event.title || 'Activity update'}</h3>
                {event.message && (
                  <p className="live-feed-item__message">{event.message}</p>
                )}
              </article>
            ))
          )}
        </div>
      )}
    </aside>
  );
}
