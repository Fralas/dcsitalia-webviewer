import { useEffect, useState } from 'react';
import { Check, Clock, Loader2, Users, X } from 'lucide-react';
import { t } from '../../utils/locale';

/**
 * HIDC missions in the operations panel "Missione" tab (backend services/hidcMissions.js):
 * the pilot's mission in progress with its 2 h countdown, and the missions they can accept.
 */

export const HIDC_MISSION_FILTERS = ['SEAD', 'DEAD', 'CAS', 'LOGISTICS'];
const RESULT_VISIBLE_MS = 15 * 60 * 1000;

export function missionTypeLabel(type) {
  return type === 'LOGISTICS' ? t('map.rightPanel.ops.missions.logisticsShort') : type;
}

function zoneNumber(zoneId) {
  const match = String(zoneId || '').match(/\d+/);
  return match ? match[0] : String(zoneId || '?');
}

function formatCountdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function useNow(enabled) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return now;
}

function TypeTag({ type }) {
  return (
    <span className={`map-ops-section__tag hidc-mission__type hidc-mission__type--${String(type).toLowerCase()}`}>
      {missionTypeLabel(type)}
    </span>
  );
}

/** Mission in progress (pinned at the top of the list). */
export function HidcActiveMission({ assignment, busy, onAbandon, onSelectZone }) {
  const now = useNow(true);
  const remaining = assignment.expiresAt - now;
  const share = Math.max(0, Math.min(1, remaining / Math.max(1, assignment.expiresAt - assignment.acceptedAt)));
  return (
    <div
      className={`map-ops-section__row hidc-mission hidc-mission--active${assignment.awaitingFlight ? ' is-awaiting' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelectZone?.(assignment.zoneId)}
      onKeyDown={(event) => { if (event.key === 'Enter') onSelectZone?.(assignment.zoneId); }}
    >
      <div className="map-ops-section__row-top">
        <span className="map-ops-section__row-title">
          {t('map.rightPanel.ops.zone', { number: zoneNumber(assignment.zoneId) })}
        </span>
        <span className="hidc-mission__timer">
          <Clock strokeWidth={2.4} aria-hidden="true" />
          {formatCountdown(remaining)}
        </span>
      </div>
      <div className="hidc-mission__line">
        <TypeTag type={assignment.type} />
        <span className="hidc-mission__state">
          {assignment.awaitingFlight
            ? t('map.rightPanel.ops.missions.awaitingFlight')
            : t('map.rightPanel.ops.missions.inProgress')}
        </span>
        <span className="hidc-mission__xp">+{assignment.xp} XP</span>
        <button
          type="button"
          className="hidc-mission__abandon"
          disabled={busy}
          onClick={(event) => { event.stopPropagation(); onAbandon?.(assignment); }}
          title={t('map.rightPanel.ops.missions.abandon')}
          aria-label={t('map.rightPanel.ops.missions.abandon')}
        >
          {busy ? <Loader2 className="spin" strokeWidth={2.4} /> : <X strokeWidth={2.4} />}
        </button>
      </div>
      <span className="hidc-mission__progress" aria-hidden="true">
        <span style={{ width: `${share * 100}%` }} />
      </span>
    </div>
  );
}

/** Outcome of the pilot's last mission, shown for a few minutes after it closed. */
export function HidcMissionResult({ entry }) {
  const now = useNow(false);
  if (!entry?.closedAt || now - entry.closedAt > RESULT_VISIBLE_MS || entry.status === 'abandoned') return null;
  const key = entry.status === 'expired' && entry.reason === 'no-flight' ? 'expiredNoFlight' : entry.status;
  return (
    <div className={`hidc-mission-result hidc-mission-result--${entry.status}`}>
      {entry.status === 'completed' ? <Check strokeWidth={2.6} aria-hidden="true" /> : <X strokeWidth={2.6} aria-hidden="true" />}
      <span>
        {t(`map.rightPanel.ops.missions.result.${key}`, {
          type: missionTypeLabel(entry.type),
          number: zoneNumber(entry.zoneId),
          xp: entry.xp,
        })}
      </span>
    </div>
  );
}

/** A mission the pilot can accept. */
export function HidcMissionRow({ mission, distance, canAccept, blockedReason, busy, onAccept, onSelectZone }) {
  const pilots = mission.pilots.length;
  return (
    <div
      className={`map-ops-section__row hidc-mission${mission.mine ? ' is-mine' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelectZone?.(mission.zoneId)}
      onKeyDown={(event) => { if (event.key === 'Enter') onSelectZone?.(mission.zoneId); }}
    >
      <div className="map-ops-section__row-top">
        <span className="map-ops-section__row-title">
          {t('map.rightPanel.ops.zone', { number: zoneNumber(mission.zoneId) })}
        </span>
        <span className="map-ops-section__row-meta">{distance}</span>
      </div>
      <div className="hidc-mission__line">
        <TypeTag type={mission.type} />
        {pilots > 0 && (
          <span className="hidc-mission__pilots" title={mission.pilots.join(', ')}>
            <Users strokeWidth={2.4} aria-hidden="true" />
            {pilots}
          </span>
        )}
        <span className="hidc-mission__xp">+{mission.xp} XP</span>
        {!mission.mine && (
          <button
            type="button"
            className="hidc-mission__accept"
            disabled={!canAccept || busy}
            title={canAccept ? undefined : blockedReason}
            onClick={(event) => { event.stopPropagation(); onAccept?.(mission); }}
          >
            {busy ? <Loader2 className="spin" strokeWidth={2.4} /> : t('map.rightPanel.ops.missions.accept')}
          </button>
        )}
      </div>
    </div>
  );
}
