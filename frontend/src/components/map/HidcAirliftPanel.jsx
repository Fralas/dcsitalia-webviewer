import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Helicopter, Package, Plane, Plus } from 'lucide-react';
import { t } from '../../utils/locale';
import HidcAirliftWizard, { aircraftShort } from './HidcAirliftWizard';

/**
 * HIDC "Logistica" tab: AI CH-47 / C-130J-30 flights and crash sites to recover
 * (backend services/hidcAirLift.js, DCORE DBRIDGE_AirLift.lua). "Nuova missione IA" opens the full-screen order window.
 */

const ORDER_LIMIT = 8;
const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

function AircraftIcon({ aircraft, ...rest }) {
  return aircraft === 'CH47' ? <Helicopter {...rest} /> : <Plane {...rest} />;
}

function SiteRow({ site, onFocusPoint }) {
  return (
    <button type="button" className="map-ops-section__row hidc-airlift-row hidc-airlift-row--site" onClick={() => onFocusPoint?.({ key: `site:${site.id}`, lat: site.lat, lon: site.lon })}>
      <div className="map-ops-section__row-top">
        <span className="map-ops-section__row-title">
          <Package strokeWidth={2.2} aria-hidden="true" />
          {t('map.rightPanel.ops.airlift.recovery')}
        </span>
        <span className="hidc-airlift-chip hidc-airlift-chip--crashed">{t('map.rightPanel.ops.airlift.cratesLeft', { left: site.cratesLeft })}</span>
      </div>
      <div className="map-ops-section__row-sub">
        {[
          site.aircraft ? aircraftShort(site.aircraft) : null,
          site.from && site.to ? `${site.from} → ${site.to}` : null,
          t('map.rightPanel.ops.airlift.unitsShort', { units: fmt(site.units) }),
        ].filter(Boolean).join(' • ')}
      </div>
    </button>
  );
}

function OrderRow({ order, onFocusPoint }) {
  const canFocus = Boolean(order.position);
  return (
    <button
      type="button"
      className={`map-ops-section__row hidc-airlift-row${order.mine ? ' is-mine' : ''}`}
      onClick={() => canFocus && onFocusPoint?.({ key: `flight:${order.id}:${order.position.lat}`, lat: order.position.lat, lon: order.position.lon })}
      title={order.message || undefined}
    >
      <div className="map-ops-section__row-top">
        <span className="map-ops-section__row-title">
          <AircraftIcon aircraft={order.aircraft} strokeWidth={2.2} aria-hidden="true" />
          {order.fromName} → {order.toName}
        </span>
        <span className={`hidc-airlift-chip hidc-airlift-chip--${order.status}`}>{t(`map.rightPanel.ops.airlift.status.${order.status}`)}</span>
      </div>
      <div className="map-ops-section__row-sub">
        {[
          aircraftShort(order.aircraft),
          t('map.rightPanel.ops.airlift.unitsShort', { units: fmt(order.units) }),
          t('map.rightPanel.ops.airlift.costShort', { cost: fmt(order.cost) }),
          order.pilotName,
          order.status === 'refused' && order.message ? order.message : null,
        ].filter(Boolean).join(' • ')}
      </div>
    </button>
  );
}

export default function HidcAirliftPanel({ airlift, onAirliftChange, onFocusPoint }) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const me = airlift?.me || null;
  const aircraft = airlift?.rules?.aircraft || [];
  const anyUnlocked = aircraft.some((entry) => entry.unlocked);
  const minLevel = aircraft.length ? Math.min(...aircraft.map((entry) => entry.minLevel)) : 6;
  const blockedReason = !me
    ? t('map.rightPanel.ops.missions.loginRequired')
    : !me.linked
      ? t('map.rightPanel.ops.missions.linkRequired')
      : !anyUnlocked
        ? t('map.rightPanel.ops.airlift.unlockAt', { level: minLevel })
        : '';

  const sites = airlift?.sites || [];
  const orders = (airlift?.orders || []).slice(0, ORDER_LIMIT);
  return (
    <>
      {/* Full-width row, same size and radius as the list rows below it. */}
      <button
        type="button"
        className="hidc-airlift-request"
        disabled={!airlift || Boolean(blockedReason)}
        onClick={() => setWizardOpen(true)}
      >
        <span className="hidc-airlift-request__icon" aria-hidden="true">
          <Plus strokeWidth={2.6} />
        </span>
        <span className="hidc-airlift-request__label">{t('map.rightPanel.ops.airlift.newMission')}</span>
        {blockedReason
          ? <span className="hidc-airlift-request__hint">{blockedReason}</span>
          : <ChevronRight className="hidc-airlift-request__chevron" strokeWidth={2.4} aria-hidden="true" />}
      </button>
      {sites.map((site) => <SiteRow key={site.id} site={site} onFocusPoint={onFocusPoint} />)}
      {orders.map((order) => <OrderRow key={order.id} order={order} onFocusPoint={onFocusPoint} />)}
      {wizardOpen && airlift && typeof document !== 'undefined' && createPortal(
        <HidcAirliftWizard
          airlift={airlift}
          onClose={() => setWizardOpen(false)}
          onOrdered={(next) => {
            if (next) onAirliftChange?.(next);
            setWizardOpen(false);
          }}
        />,
        document.body,
      )}
    </>
  );
}
