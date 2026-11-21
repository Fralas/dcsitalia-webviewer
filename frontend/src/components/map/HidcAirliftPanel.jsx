import { useEffect, useMemo, useState } from 'react';
import { Helicopter, Loader2, Lock, Minus, Package, Plane, Plus, Search, X } from 'lucide-react';
import { getAirport, orderHidcAirlift } from '../../services/api';
import { t } from '../../utils/locale';

/**
 * HIDC "Logistica" tab: order an AI CH-47 / C-130 that moves munitions between two BLUE airports
 * (backend services/hidcAirLift.js, DCORE DBRIDGE_AirLift.lua), follow the flights and the crash sites to recover.
 */

const ORDER_LIMIT = 8;
const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

function itemName(id) {
  const parts = String(id || '').split('.');
  const raw = parts[0] === 'weapons' && parts.length > 2 ? parts.slice(2).join('.') : String(id || '');
  return raw.replace(/[{}]/g, '').replace(/_/g, ' ').trim() || '?';
}

function itemCategory(id) {
  const parts = String(id || '').split('.');
  return parts[0] === 'weapons' && parts.length > 2 ? parts[1] : 'other';
}

function AircraftIcon({ aircraft, ...rest }) {
  return aircraft === 'CH47' ? <Helicopter {...rest} /> : <Plane {...rest} />;
}

function aircraftShort(key) {
  return key === 'CH47' ? 'CH-47' : 'C-130J-30';
}

// ------------------------------------------------------------------ order form

function OrderForm({ airlift, renderSelect, departureIcon, arrivalIcon, onCancel, onOrdered }) {
  const aircraftList = airlift?.rules?.aircraft || [];
  const firstUnlocked = aircraftList.find((entry) => entry.unlocked)?.key || 'CH47';
  const [aircraft, setAircraft] = useState(firstUnlocked);
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [stock, setStock] = useState(null);
  const [stockError, setStockError] = useState('');
  const [query, setQuery] = useState('');
  const [cargo, setCargo] = useState({}); // item id -> qty
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const rules = aircraftList.find((entry) => entry.key === aircraft) || null;
  const airports = useMemo(() => (airlift?.airports || [])
    .filter((airport) => !(rules?.runwayOnly && airport.isHeliport))
    .sort((a, b) => a.name.localeCompare(b.name, 'it')), [airlift, rules]);

  // The C-130 cannot use heliports: drop a choice that is no longer valid.
  useEffect(() => {
    if (fromId && !airports.some((airport) => airport.id === fromId)) setFromId('');
    if (toId && !airports.some((airport) => airport.id === toId)) setToId('');
  }, [airports, fromId, toId]);

  useEffect(() => {
    setCargo({});
    setStock(null);
    setStockError('');
    if (!fromId) return undefined;
    let cancelled = false;
    getAirport(fromId)
      .then((airport) => {
        if (cancelled) return;
        const rows = (Array.isArray(airport?.data?.weapons) ? airport.data.weapons : [])
          .map((row) => ({ id: String(row.item), qty: Math.max(0, Math.floor(Number(row.quantity) || 0)) }))
          .filter((row) => row.qty > 0 && row.id.startsWith('weapons.'))
          .sort((a, b) => itemCategory(a.id).localeCompare(itemCategory(b.id)) || itemName(a.id).localeCompare(itemName(b.id), 'it'));
        setStock(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        setStock([]);
        setStockError(err?.message || t('map.rightPanel.ops.airlift.stockError'));
      });
    return () => { cancelled = true; };
  }, [fromId]);

  const visibleStock = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (stock || []).filter((row) => !q || itemName(row.id).toLowerCase().includes(q) || row.id.toLowerCase().includes(q));
  }, [stock, query]);

  const units = Object.values(cargo).reduce((sum, qty) => sum + qty, 0);
  const cost = rules ? rules.baseCost + Math.ceil(units * (airlift?.rules?.costPerUnit || 0)) : 0;
  const bluePoints = Number.isFinite(Number(airlift?.bluePoints)) ? Number(airlift.bluePoints) : null;
  const affordable = bluePoints == null || bluePoints >= cost;
  const canSubmit = rules?.unlocked && fromId && toId && fromId !== toId && units > 0 && affordable && !busy;

  const setQty = (id, max, value) => {
    const qty = Math.max(0, Math.min(max, Math.floor(Number(value) || 0)));
    setCargo((prev) => {
      const next = { ...prev };
      if (qty > 0) next[id] = qty;
      else delete next[id];
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    setError('');
    try {
      const next = await orderHidcAirlift({
        aircraft,
        fromId,
        toId,
        items: Object.entries(cargo).map(([id, qty]) => ({ id, qty })),
      });
      onOrdered?.(next);
    } catch (err) {
      setError(err?.message || t('map.rightPanel.ops.airlift.orderError'));
    } finally {
      setBusy(false);
    }
  };

  const airportOptions = (placeholder, excludeId) => [
    { value: '', label: placeholder },
    ...airports.filter((airport) => airport.id !== excludeId).map((airport) => ({ value: airport.id, label: airport.name })),
  ];

  return (
    <div className="hidc-airlift-form">
      <div className="hidc-airlift-form__head">
        <span>{t('map.rightPanel.ops.airlift.newTitle')}</span>
        <button type="button" className="hidc-airlift-icon-btn" onClick={onCancel} aria-label={t('map.rightPanel.ops.airlift.cancel')}>
          <X strokeWidth={2.4} />
        </button>
      </div>

      <div className="hidc-airlift-form__aircraft" role="radiogroup" aria-label={t('map.rightPanel.ops.airlift.aircraft')}>
        {aircraftList.map((entry) => (
          <button
            key={entry.key}
            type="button"
            role="radio"
            aria-checked={aircraft === entry.key}
            disabled={!entry.unlocked}
            className={`hidc-airlift-aircraft${aircraft === entry.key ? ' is-active' : ''}${entry.unlocked ? '' : ' is-locked'}`}
            onClick={() => setAircraft(entry.key)}
            title={entry.unlocked ? undefined : t('map.rightPanel.ops.airlift.unlockAt', { level: entry.minLevel })}
          >
            {entry.unlocked
              ? <AircraftIcon aircraft={entry.key} strokeWidth={2} aria-hidden="true" />
              : <Lock strokeWidth={2.2} aria-hidden="true" />}
            <span className="hidc-airlift-aircraft__name">{aircraftShort(entry.key)}</span>
            <span className="hidc-airlift-aircraft__meta">
              {entry.unlocked
                ? t('map.rightPanel.ops.airlift.base', { cost: entry.baseCost })
                : t('map.rightPanel.ops.airlift.levelShort', { level: entry.minLevel })}
            </span>
          </button>
        ))}
      </div>
      {rules?.runwayOnly && <p className="hidc-airlift-form__note">{t('map.rightPanel.ops.airlift.runwayOnly')}</p>}

      <div className="hidc-airlift-form__route">
        {renderSelect({
          id: 'airlift-from',
          icon: departureIcon,
          value: fromId,
          onChange: setFromId,
          ariaLabel: t('map.rightPanel.ops.departure'),
          options: airportOptions(t('map.rightPanel.ops.departure'), toId),
        })}
        {renderSelect({
          id: 'airlift-to',
          icon: arrivalIcon,
          value: toId,
          onChange: setToId,
          ariaLabel: t('map.rightPanel.ops.arrival'),
          options: airportOptions(t('map.rightPanel.ops.arrival'), fromId),
        })}
      </div>

      <div className="hidc-airlift-form__cargo">
        {!fromId ? (
          <p className="hidc-airlift-form__note">{t('map.rightPanel.ops.airlift.pickDeparture')}</p>
        ) : stock === null ? (
          <p className="hidc-airlift-form__note"><Loader2 className="spin" strokeWidth={2.4} /> {t('map.rightPanel.ops.airlift.loadingStock')}</p>
        ) : (
          <>
            <label className="hidc-airlift-search">
              <Search strokeWidth={2.4} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('map.rightPanel.ops.airlift.searchCargo')}
                aria-label={t('map.rightPanel.ops.airlift.searchCargo')}
              />
            </label>
            {stockError && <p className="hidc-airlift-error">{stockError}</p>}
            {visibleStock.length === 0 ? (
              <p className="hidc-airlift-form__note">{t('map.rightPanel.ops.airlift.noStock')}</p>
            ) : (
              <ul className="hidc-airlift-stock">
                {visibleStock.map((row) => {
                  const qty = cargo[row.id] || 0;
                  return (
                    <li key={row.id} className={qty > 0 ? 'is-selected' : ''} title={row.id}>
                      <span className="hidc-airlift-stock__name">{itemName(row.id)}</span>
                      <span className="hidc-airlift-stock__have">{fmt(row.qty)}</span>
                      <span className="hidc-airlift-stepper">
                        <button type="button" onClick={() => setQty(row.id, row.qty, qty - 1)} disabled={qty <= 0} aria-label="-1">
                          <Minus strokeWidth={2.6} />
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={row.qty}
                          value={qty || ''}
                          placeholder="0"
                          onChange={(event) => setQty(row.id, row.qty, event.target.value)}
                          aria-label={itemName(row.id)}
                        />
                        <button type="button" onClick={() => setQty(row.id, row.qty, qty + 1)} disabled={qty >= row.qty} aria-label="+1">
                          <Plus strokeWidth={2.6} />
                        </button>
                      </span>
                      <button type="button" className="hidc-airlift-stock__max" onClick={() => setQty(row.id, row.qty, qty >= row.qty ? 0 : row.qty)}>
                        {qty >= row.qty ? t('map.rightPanel.ops.airlift.none') : t('map.rightPanel.ops.airlift.max')}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {error && <p className="hidc-airlift-error" role="alert">{error}</p>}

      <div className="hidc-airlift-form__foot">
        <div className="hidc-airlift-form__sum">
          <strong>{t('map.rightPanel.ops.airlift.costPoints', { cost: fmt(cost) })}</strong>
          <span className={affordable ? '' : 'is-bad'}>
            {t('map.rightPanel.ops.airlift.unitsBlue', { units: fmt(units), blue: bluePoints == null ? '—' : fmt(bluePoints) })}
          </span>
        </div>
        <button type="button" className="hidc-airlift-primary" disabled={!canSubmit} onClick={submit}>
          {busy ? <Loader2 className="spin" strokeWidth={2.4} /> : t('map.rightPanel.ops.airlift.order')}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ list

function statusLabel(status) {
  return t(`map.rightPanel.ops.airlift.status.${status}`) || status;
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
        <span className={`hidc-airlift-chip hidc-airlift-chip--${order.status}`}>{statusLabel(order.status)}</span>
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

export default function HidcAirliftPanel({
  airlift, onAirliftChange, onFocusPoint, renderSelect, departureIcon, arrivalIcon, formOpen = false, onFormOpenChange,
}) {
  const setFormOpen = (open) => onFormOpenChange?.(open);
  const me = airlift?.me || null;
  const anyUnlocked = (airlift?.rules?.aircraft || []).some((entry) => entry.unlocked);
  const minLevel = Math.min(...(airlift?.rules?.aircraft || [{ minLevel: 6 }]).map((entry) => entry.minLevel));
  const blockedReason = !me
    ? t('map.rightPanel.ops.missions.loginRequired')
    : !me.linked
      ? t('map.rightPanel.ops.missions.linkRequired')
      : !anyUnlocked
        ? t('map.rightPanel.ops.airlift.unlockAt', { level: minLevel })
        : '';

  if (formOpen && airlift) {
    return (
      <OrderForm
        airlift={airlift}
        renderSelect={renderSelect}
        departureIcon={departureIcon}
        arrivalIcon={arrivalIcon}
        onCancel={() => setFormOpen(false)}
        onOrdered={(next) => {
          if (next) onAirliftChange?.(next);
          setFormOpen(false);
        }}
      />
    );
  }

  const sites = airlift?.sites || [];
  const orders = (airlift?.orders || []).slice(0, ORDER_LIMIT);
  return (
    <>
      <div className="hidc-airlift-bar">
        <button
          type="button"
          className="hidc-airlift-primary"
          disabled={!airlift || Boolean(blockedReason)}
          title={blockedReason || undefined}
          onClick={() => setFormOpen(true)}
        >
          <Plus strokeWidth={2.6} aria-hidden="true" />
          {t('map.rightPanel.ops.airlift.newMission')}
        </button>
        {blockedReason && <span className="hidc-airlift-bar__hint">{blockedReason}</span>}
      </div>
      {sites.map((site) => <SiteRow key={site.id} site={site} onFocusPoint={onFocusPoint} />)}
      {orders.map((order) => <OrderRow key={order.id} order={order} onFocusPoint={onFocusPoint} />)}
    </>
  );
}
