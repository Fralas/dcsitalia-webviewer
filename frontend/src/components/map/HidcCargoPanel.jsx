import { useState } from 'react';
import { Check, Clock, Loader2, Package, PlaneLanding, PlaneTakeoff, Route, X } from 'lucide-react';
import { t } from '../../utils/locale';
import { acceptHidcCargoMission, abandonHidcCargoMission } from '../../services/api';
import { formatCountdown, formatHours, useNow } from './HidcMissionRows';

/**
 * "Trasporto cargo" missions in the operations panel Produzione tab (backend services/hidcCargoMissions.js):
 * a full production point -> its nearest BLUE airport. The pilot queues up to rules.maxActive of them and
 * gets the shortest route through the queue (also drawn on the map).
 */

const RESULT_VISIBLE_MS = 15 * 60 * 1000;
const STOP_ICONS = { departure: PlaneTakeoff, pickup: Package, dropoff: PlaneLanding };

function formatNm(nm) {
  const value = Number(nm);
  if (!Number.isFinite(value)) return '';
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} NM`;
}

function cratesLabel(count) {
  return t(count === 1 ? 'map.rightPanel.ops.cargo.crates' : 'map.rightPanel.ops.cargo.cratesMany', { count });
}

function legTitle(mission) {
  return mission.destination?.name ? `${mission.ppName} → ${mission.destination.name}` : mission.ppName;
}

/** Shortest order through the queued transports: departure, pickups and deliveries. */
function CargoRoute({ route, onFocusPoint }) {
  if (!route?.stops?.length) return null;
  return (
    <div className="hidc-cargo-route">
      <div className="hidc-cargo-route__head">
        <Route strokeWidth={2.2} aria-hidden="true" />
        <span className="hidc-cargo-route__title">{t('map.rightPanel.ops.cargo.route')}</span>
        <span className="hidc-cargo-route__total">
          {formatNm(route.totalNm)}
          <span className="hidc-mission__sep">·</span>
          {t(route.trips === 1 ? 'map.rightPanel.ops.cargo.trip' : 'map.rightPanel.ops.cargo.trips', { count: route.trips })}
        </span>
      </div>
      <ol className="hidc-cargo-route__stops">
        {route.stops.map((stop, index) => {
          const Icon = STOP_ICONS[stop.kind] || Package;
          return (
            <li key={`${stop.kind}-${stop.name}-${index}`}>
              <button
                type="button"
                className={`hidc-cargo-route__stop hidc-cargo-route__stop--${stop.kind}`}
                onClick={() => onFocusPoint?.({ key: `cargo-stop:${index}`, lat: stop.lat, lon: stop.lon })}
              >
                <span className="hidc-cargo-route__dot" aria-hidden="true">
                  <Icon strokeWidth={2.2} />
                </span>
                <span className="hidc-cargo-route__kind">{t(`map.rightPanel.ops.cargo.${stop.kind}`)}</span>
                <span className="hidc-cargo-route__name">{stop.name}</span>
                {stop.kind === 'pickup' && stop.crates > 0 && (
                  <span className="hidc-cargo-route__crates">{cratesLabel(stop.crates)}</span>
                )}
                {stop.trips > 1 && <span className="hidc-cargo-route__trips">{`×${stop.trips}`}</span>}
                {stop.legNm > 0 && <span className="hidc-cargo-route__leg">{formatNm(stop.legNm)}</span>}
              </button>
            </li>
          );
        })}
      </ol>
      <p className="hidc-cargo-route__hint">
        {route.capacity > 1
          ? t('map.rightPanel.ops.cargo.routeHintMulti', { capacity: route.capacity, airport: route.dropoff?.name })
          : t('map.rightPanel.ops.cargo.routeHint', { airport: route.dropoff?.name })}
      </p>
    </div>
  );
}

function CargoActive({ assignment, busy, onAbandon, onFocusPoint }) {
  const now = useNow(true);
  const remaining = assignment.expiresAt - now;
  const share = Math.max(0, Math.min(1, remaining / Math.max(1, assignment.expiresAt - assignment.acceptedAt)));
  const focus = () => assignment.origin && onFocusPoint?.({ key: `cargo:${assignment.id}`, ...assignment.origin });
  return (
    <div
      className={`map-ops-section__row hidc-mission hidc-mission--active hidc-cargo${assignment.awaitingFlight ? ' is-awaiting' : ''}`}
      role="button"
      tabIndex={0}
      onClick={focus}
      onKeyDown={(event) => { if (event.key === 'Enter') focus(); }}
    >
      <div className="hidc-mission__head">
        <span className="map-ops-section__row-title">{legTitle(assignment)}</span>
        <span className="hidc-mission__timer">
          <Clock strokeWidth={2.4} aria-hidden="true" />
          {formatCountdown(remaining)}
        </span>
      </div>
      <p className="hidc-mission__desc">
        {assignment.awaitingFlight
          ? t('map.rightPanel.ops.missions.awaitingFlight')
          : t('map.rightPanel.ops.cargo.delivered', { done: assignment.delivered, total: assignment.crates })}
      </p>
      <div className="hidc-mission__foot">
        <span className="hidc-mission__reward">
          {t('map.rightPanel.ops.missions.inProgress')}
          <span className="hidc-mission__sep">·</span>
          <strong>~+{assignment.xp} XP</strong>
        </span>
        <button
          type="button"
          className="hidc-mission__link"
          disabled={busy}
          onClick={(event) => { event.stopPropagation(); onAbandon(assignment); }}
        >
          {busy ? <Loader2 className="spin" strokeWidth={2.4} /> : t('map.rightPanel.ops.missions.abandonShort')}
        </button>
      </div>
      <span className="hidc-mission__progress" aria-hidden="true">
        <span style={{ width: `${share * 100}%` }} />
      </span>
    </div>
  );
}

function CargoRow({ mission, canAccept, blockedReason, busy, onAccept, onFocusPoint }) {
  const focus = () => mission.origin && onFocusPoint?.({ key: `cargo:${mission.id}`, ...mission.origin });
  return (
    <div
      className="map-ops-section__row hidc-mission hidc-cargo"
      role="button"
      tabIndex={0}
      onClick={focus}
      onKeyDown={(event) => { if (event.key === 'Enter') focus(); }}
    >
      <div className="hidc-mission__head">
        <span className="map-ops-section__row-title">{mission.ppName}</span>
        {mission.nearestNm != null && (
          <span className="map-ops-section__row-meta" title={t('map.rightPanel.ops.cargo.nearestHint')}>
            {`≈ ${formatNm(mission.nearestNm)}`}
          </span>
        )}
      </div>
      <div className="hidc-cargo__leg">
        <Package strokeWidth={2.2} aria-hidden="true" />
        <span>{t('map.rightPanel.ops.cargo.emptyPoint', { crates: cratesLabel(mission.crates) })}</span>
      </div>
      <div className="hidc-mission__foot">
        <span className="hidc-mission__reward">
          <strong>~+{mission.xp} XP</strong>
          <span className="hidc-mission__sep">·</span>
          <Clock strokeWidth={2.4} aria-hidden="true" />
          {formatHours(mission.durationMin)}
        </span>
        <button
          type="button"
          className="hidc-mission__accept"
          disabled={!canAccept || busy}
          title={canAccept ? t('map.rightPanel.ops.cargo.desc') : blockedReason}
          onClick={(event) => { event.stopPropagation(); onAccept(mission); }}
        >
          {busy ? <Loader2 className="spin" strokeWidth={2.4} /> : t('map.rightPanel.ops.cargo.queue')}
        </button>
      </div>
    </div>
  );
}

function CargoResult({ entry }) {
  const now = useNow(false);
  if (!entry?.closedAt || now - entry.closedAt > RESULT_VISIBLE_MS || entry.status === 'abandoned') return null;
  const key = entry.status === 'expired' && entry.reason === 'no-flight' ? 'expiredNoFlight' : entry.status;
  return (
    <div className={`hidc-mission-result hidc-mission-result--${entry.status}`}>
      {entry.status === 'completed' ? <Check strokeWidth={2.6} aria-hidden="true" /> : <X strokeWidth={2.6} aria-hidden="true" />}
      <span>
        {t(`map.rightPanel.ops.cargo.result.${key}`, { pp: entry.ppName, crates: cratesLabel(entry.crates), xp: entry.xp })}
      </span>
    </div>
  );
}

export default function HidcCargoPanel({ campaign, onCampaignChange, onFocusPoint }) {
  const cargo = campaign?.cargo;
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  if (!cargo) return null;

  const mine = cargo.mine;
  const active = mine?.active || [];
  const maxActive = cargo.rules?.maxActive ?? 3;
  const blockedReason = !campaign.me
    ? t('map.rightPanel.ops.missions.loginRequired')
    : !campaign.me.linked
      ? t('map.rightPanel.ops.missions.linkRequired')
      : !mine?.canAccept
        ? t('map.rightPanel.ops.cargo.queueFull', { max: maxActive })
        : '';
  const canAccept = Boolean(campaign.me?.linked && mine?.canAccept);

  const run = async (id, action) => {
    setBusyId(id);
    setError('');
    try {
      const next = await action();
      if (next) onCampaignChange?.(next);
    } catch (err) {
      setError(err?.message || t('map.rightPanel.ops.missions.error'));
    } finally {
      setBusyId('');
    }
  };

  return (
    <>
      {error && <div className="hidc-mission-error" role="alert">{error}</div>}
      {active.length > 0 && (
        <>
          <div className="hidc-cargo__heading">
            {t('map.rightPanel.ops.cargo.queueHeading')}
            <span className="hidc-cargo__count">{`${active.length}/${maxActive}`}</span>
          </div>
          <CargoRoute route={mine.route} onFocusPoint={onFocusPoint} />
          {active.map((assignment) => (
            <CargoActive
              key={assignment.id}
              assignment={assignment}
              busy={busyId === assignment.id}
              onAbandon={(entry) => run(entry.id, () => abandonHidcCargoMission(entry.id))}
              onFocusPoint={onFocusPoint}
            />
          ))}
        </>
      )}
      {active.length === 0 && <CargoResult entry={mine?.recent?.[0]} />}

      <div className="hidc-cargo__heading">{t('map.rightPanel.ops.cargo.availableHeading')}</div>
      {cargo.available.length === 0 ? (
        <div className="map-ops-section__row map-ops-section__row--empty">
          <span>{t('map.rightPanel.ops.cargo.empty')}</span>
        </div>
      ) : cargo.available.map((mission) => (
        <CargoRow
          key={mission.id}
          mission={mission}
          canAccept={canAccept}
          blockedReason={blockedReason}
          busy={busyId === mission.id}
          onAccept={(entry) => run(entry.id, () => acceptHidcCargoMission(entry.id))}
          onFocusPoint={onFocusPoint}
        />
      ))}
    </>
  );
}
