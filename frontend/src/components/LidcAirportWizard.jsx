import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCheck,
  Coins,
  Droplets,
  Helicopter,
  Loader2,
  Minus,
  Pencil,
  Plane,
  Plus,
  Shield,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import * as mgrs from 'mgrs';
import ammoContainerImage from '../../img/crates/container_blue_mid.png';
import ammoHeliContainerImage from '../../img/crates/container_green_small.png';
import ammoCrateImage from '../../img/crates/prop_mil_crate_01.png';
import ammoHeliCrateImage from '../../img/crates/prop_box_ammo03a_set2.png';
import { formatLidcAirportLabel, getLidcAirportById } from '../config/lidcAfghanistanAirports';
import * as api from '../services/api';
import { t } from '../utils/locale';
import { getLidcUnitImageUrl } from '../utils/lidcUnitImages';
import InlineError from './InlineError';
import './LidcAirportWizard.css';

const TABS = ['overview', 'logistics'];

function shopImageFor(item) {
  if (item.kind === 'container') {
    return item.destination === 'helicopters' ? ammoHeliContainerImage : ammoContainerImage;
  }
  return item.destination === 'helicopters' ? ammoHeliCrateImage : ammoCrateImage;
}

function contentsLabel(item) {
  return (Array.isArray(item.contents) ? item.contents : [])
    .map((entry) => `${entry.label} ×${entry.quantity}`)
    .join(' · ');
}

function ShopCard({ item, canAdd, onAdd }) {
  const transport = Array.isArray(item.transport) ? item.transport : [];
  const imageUrl = shopImageFor(item);
  const contents = contentsLabel(item);

  return (
    <button
      type="button"
      className="lidc-airport-wizard-shop-card"
      disabled={!canAdd}
      title={contents}
      onClick={() => onAdd(item.id)}
    >
      <span className="lidc-airport-wizard-shop-card__transport" aria-hidden="true">
        <Plane size={14} />
        {transport.includes('helicopter') && <Helicopter size={14} />}
      </span>
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : null}
      <strong>{item.name}</strong>
      <em>{t(`lidc.map.airportWizard.${item.kind}`)}</em>
      <p>{contents}</p>
      <span className="lidc-airport-wizard-shop-card__cost">
        <Coins size={14} />
        {formatStock(item.cost)}
      </span>
    </button>
  );
}

function ShopGroup({ items, remainingCredits, canPurchase, onAdd, ignoreCreditLimit = false }) {
  if (!items.length) return null;

  return (
    <div className="lidc-airport-wizard-shop">
      {items.map((item) => (
        <ShopCard
          key={item.id}
          item={item}
          canAdd={canPurchase && (ignoreCreditLimit || remainingCredits >= item.cost)}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

function formatMgrs(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '—';

  try {
    const raw = String(mgrs.forward([longitude, latitude], 5) || '').toUpperCase();
    const match = raw.match(/^(\d{1,2}[C-X])([A-Z]{2})(\d+)$/);
    if (!match) return raw || '—';
    const digits = match[3];
    const half = Math.floor(digits.length / 2);
    return `${match[1]} ${match[2]} ${digits.slice(0, half)} ${digits.slice(half)}`;
  } catch (error) {
    return '—';
  }
}

function formatStock(value) {
  return Number(value || 0).toLocaleString();
}

const FUEL_LOW_RATIO = 0.2;

function isFuelLow(item) {
  const capacity = Number(item?.capacity) || 0;
  if (capacity <= 0) return false;
  return (Number(item?.quantity) || 0) / capacity < FUEL_LOW_RATIO;
}

function FuelStock({ item }) {
  const fill = item.capacity > 0 ? Math.min(100, Math.round((item.quantity / item.capacity) * 100)) : 0;
  const low = isFuelLow(item);

  return (
    <div className={`lidc-airport-wizard-stock ${low ? 'is-low' : ''}`}>
      <strong>{item.label}</strong>
      <span>
        {formatStock(item.quantity)} / {formatStock(item.capacity)} {item.unit}
      </span>
      <div className="lidc-airport-wizard-meter" aria-hidden="true">
        <i style={{ width: `${fill}%` }} />
      </div>
    </div>
  );
}

function OccupancyAirframe({ airframe }) {
  const model = airframe.unitLabel || airframe.unitId || '-';
  const imageUrl = getLidcUnitImageUrl(airframe.unitId);

  return (
    <div className="lidc-airport-wizard-airframe" title={`${model} · ${airframe.boardNumber || '-'}`}>
      <span>{airframe.boardNumber || '-'}</span>
      {imageUrl ? (
        <img src={imageUrl} alt={model} draggable={false} />
      ) : (
        <em>{model}</em>
      )}
    </div>
  );
}

export default function LidcAirportWizard({
  airport,
  occupancy,
  activeTab = 'overview',
  isLogged = false,
  variant = 'lidc',
  onPurchase,
  onUpdateOrder,
  onChangeTab,
  onClose,
  onLogisticsUpdated,
  overviewExtra = null,
}) {
  const [cart, setCart] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [purchaseError, setPurchaseError] = useState('');
  const [editingOrderId, setEditingOrderId] = useState('');
  const [orderBusyId, setOrderBusyId] = useState('');
  const catalogAirport = getLidcAirportById(airport?.id) || occupancy?.airport || airport;
  const airportLat = catalogAirport?.lat ?? catalogAirport?.coordinates?.lat;
  const airportLon = catalogAirport?.lon ?? catalogAirport?.coordinates?.lon;
  const squadrons = Array.isArray(occupancy?.squadrons) ? occupancy.squadrons : [];
  const resources = occupancy?.resources || {};
  const logistics = occupancy?.logistics || { fuel: [] };
  const shop = Array.isArray(occupancy?.shop) ? occupancy.shop : [];
  const orders = Array.isArray(occupancy?.orders) ? occupancy.orders : [];
  const editingOrder = orders.find((order) => order.id === editingOrderId) || null;
  const factionEconomy = variant === 'hidc' || occupancy?.economy === 'faction';
  const showSquadrons = !factionEconomy;
  const aircraftShop = useMemo(
    () => shop.filter((item) => item.destination !== 'helicopters'),
    [shop],
  );
  const helicopterShop = useMemo(
    () => shop.filter((item) => item.destination === 'helicopters'),
    [shop],
  );
  const shopper = occupancy?.shopper || null;
  const knownCredits = Number.isFinite(Number(shopper?.credits)) ? Number(shopper.credits) : null;

  const shopById = useMemo(() => {
    return new Map(shop.map((item) => [item.id, item]));
  }, [shop]);

  const cartLines = useMemo(() => {
    return Object.entries(cart)
      .map(([itemId, quantity]) => {
        const item = shopById.get(itemId);
        const qty = Math.max(0, Math.floor(Number(quantity) || 0));
        if (!item || qty < 1) return null;
        return {
          item,
          quantity: qty,
          cost: item.cost * qty,
        };
      })
      .filter(Boolean);
  }, [cart, shopById]);

  const cartTotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.cost, 0),
    [cartLines],
  );
  const spendBudget = editingOrder
    ? Number(editingOrder.squadronCredits || 0) + Number(editingOrder.cost || 0)
    : (knownCredits == null ? 0 : knownCredits);
  const remainingCredits = factionEconomy
    ? Number.POSITIVE_INFINITY
    : (Number.isFinite(spendBudget) ? Math.max(0, spendBudget - cartTotal) : 0);
  const canPurchase = factionEconomy
    ? isLogged
    : isLogged && (editingOrder ? Boolean(editingOrder.canEdit) : Boolean(shopper));
  const shouldShowCart = activeTab === 'logistics' && (cartLines.length > 0 || Boolean(editingOrder));
  const [cartMounted, setCartMounted] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const cartLinesSnapshot = useRef([]);

  if (cartLines.length > 0) {
    cartLinesSnapshot.current = cartLines;
  }

  const visibleCartLines = cartLines.length > 0
    ? cartLines
    : (editingOrder ? [] : cartLinesSnapshot.current);
  const visibleCartTotal = visibleCartLines.reduce((sum, line) => sum + line.cost, 0);
  const visibleCartCount = visibleCartLines.length;
  const editingEmptyCart = Boolean(editingOrder) && cartLines.length === 0;

  useEffect(() => {
    if (shouldShowCart) {
      setCartMounted(true);
      const frame = window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setCartOpen(true));
      });
      return () => window.cancelAnimationFrame(frame);
    }

    setCartOpen(false);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !cartMounted) {
      setCartMounted(false);
      return undefined;
    }

    const timeout = window.setTimeout(() => setCartMounted(false), 520);
    return () => window.clearTimeout(timeout);
  }, [shouldShowCart, cartMounted]);

  useEffect(() => {
    if (!editingOrderId) return;
    if (editingOrder?.canEdit) return;
    setEditingOrderId('');
    setCart({});
  }, [editingOrderId, editingOrder]);

  const totals = useMemo(() => {
    return squadrons.reduce((acc, squadron) => {
      acc.aircrafts += Number(squadron?.counts?.aircrafts || 0);
      acc.helicopters += Number(squadron?.counts?.helicopters || 0);
      acc.groundAssets += Number(squadron?.counts?.groundAssets || 0);
      acc.members += Number(squadron?.memberCount || 0);
      return acc;
    }, { aircrafts: 0, helicopters: 0, groundAssets: 0, members: 0 });
  }, [squadrons]);

  function addToCart(itemId) {
    const item = shopById.get(itemId);
    if (!item || !canPurchase) return;
    if (!factionEconomy && remainingCredits < item.cost) return;
    setPurchaseError('');
    setCart((prev) => ({
      ...prev,
      [itemId]: Math.max(0, Math.floor(Number(prev[itemId]) || 0)) + 1,
    }));
  }

  function copyOrderCode(code) {
    const value = String(code || '').trim();
    if (!value || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(value).catch(() => {});
  }

  function setCartQuantity(itemId, nextQuantity) {
    const qty = Math.max(0, Math.floor(Number(nextQuantity) || 0));
    setCart((prev) => {
      const next = { ...prev };
      if (qty < 1) {
        delete next[itemId];
      } else {
        next[itemId] = qty;
      }
      return next;
    });
  }

  async function confirmOrder() {
    if (!canPurchase || !airport?.id || cartLines.length === 0) return;
    if (!factionEconomy && (remainingCredits < 0 || cartTotal > spendBudget)) return;
    setConfirming(true);
    setPurchaseError('');
    try {
      const payload = {
        items: cartLines.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
      };
      const result = editingOrder
        ? await (onUpdateOrder
          ? onUpdateOrder(airport.id, editingOrder.id, payload)
          : api.updateLidcAirportOrder(airport.id, editingOrder.id, payload))
        : await (onPurchase
          ? onPurchase(airport.id, payload)
          : api.purchaseLidcAirportLogistics(airport.id, payload));
      setCart({});
      setEditingOrderId('');
      onLogisticsUpdated?.(result);
      onChangeTab?.('overview');
    } catch (error) {
      setPurchaseError(error.message || t(editingOrder ? 'lidc.map.airportWizard.orderActionFailed' : 'lidc.map.airportWizard.purchaseFailed'));
    } finally {
      setConfirming(false);
    }
  }

  function startEditOrder(order) {
    if (!order?.canEdit) return;
    const nextCart = {};
    (order.items || []).forEach((item) => {
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0));
      if (!item.itemId || qty < 1) return;
      nextCart[item.itemId] = (nextCart[item.itemId] || 0) + qty;
    });
    setPurchaseError('');
    setEditingOrderId(order.id);
    setCart(nextCart);
    onChangeTab?.('logistics');
  }

  function cancelEditOrder() {
    setEditingOrderId('');
    setCart({});
    setPurchaseError('');
    onChangeTab?.('overview');
  }

  async function cancelEditingOrder() {
    if (!canPurchase || !airport?.id || !editingOrder?.id) return;
    setConfirming(true);
    setPurchaseError('');
    try {
      const result = await (onUpdateOrder
        ? onUpdateOrder(airport.id, editingOrder.id, { action: 'cancel' })
        : api.updateLidcAirportOrder(airport.id, editingOrder.id, { action: 'cancel' }));
      setCart({});
      setEditingOrderId('');
      onLogisticsUpdated?.(result);
      onChangeTab?.('overview');
    } catch (error) {
      setPurchaseError(error.message || t('lidc.map.airportWizard.orderActionFailed'));
    } finally {
      setConfirming(false);
    }
  }

  async function runOrderAction(order, action) {
    if (!airport?.id || !order?.id) return;
    setOrderBusyId(order.id);
    setPurchaseError('');
    try {
      const result = await (onUpdateOrder
        ? onUpdateOrder(airport.id, order.id, { action })
        : api.updateLidcAirportOrder(airport.id, order.id, { action }));
      onLogisticsUpdated?.(result);
    } catch (error) {
      setPurchaseError(error.message || t('lidc.map.airportWizard.orderActionFailed'));
    } finally {
      setOrderBusyId('');
    }
  }

  return (
    <div className="lidc-wizard-root lidc-airport-wizard-root">
      <div className="lidc-wizard-backdrop" onClick={onClose} aria-hidden="true" />
      <div className={`lidc-airport-wizard-shell ${cartOpen ? 'is-cart-open' : ''}`}>
      <section
        className="lidc-wizard-card lidc-airport-wizard-card"
        role="dialog"
        aria-modal="true"
        aria-label={formatLidcAirportLabel(catalogAirport) || catalogAirport?.displayName || catalogAirport?.name}
      >
        <header className="lidc-airport-wizard-head">
          <div>
            <span className="lidc-occupancy-panel__type">{catalogAirport?.subtitle}</span>
            <h2>{catalogAirport?.name}</h2>
            <p>{t('lidc.map.airportWizard.subtitle')}</p>
          </div>
          <button
            type="button"
            className="lidc-wizard-close"
            onClick={onClose}
            aria-label={t('lidc.wizard.close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className="lidc-airport-wizard-tabs" role="tablist">
          <span
            className={`lidc-airport-wizard-tab-glider is-${activeTab}`}
            aria-hidden="true"
          />
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={activeTab === tab}
              className={`lidc-airport-wizard-tab ${activeTab === tab ? 'is-active' : ''}`}
              onClick={() => onChangeTab(tab)}
            >
              {t(`lidc.map.airportWizard.${tab}`)}
            </button>
          ))}
        </div>

        <div className={`lidc-airport-wizard-stage is-${activeTab}`}>
          <div className="lidc-airport-wizard-panes">
            <div
              className="lidc-airport-wizard-pane"
              role="tabpanel"
              aria-hidden={activeTab !== 'overview'}
              inert={activeTab !== 'overview'}
            >
              <div className="lidc-airport-wizard-overview">
              <section className={`lidc-airport-wizard-facts${factionEconomy ? ' is-single' : ''}`}>
                <article>
                  <span>{t('lidc.map.airportWizard.mgrs')}</span>
                  <strong className="lidc-airport-wizard-mgrs">{formatMgrs(airportLat, airportLon)}</strong>
                </article>
                {!factionEconomy && (
                <article>
                  <span>{t('lidc.map.occupancy.squadrons')}</span>
                  <strong>{squadrons.length}</strong>
                </article>
                )}
              </section>

              {!factionEconomy && (
              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.resources')}</h3>
                <div className="lidc-airport-wizard-resource-grid">
                  <div>
                    <Plane size={16} />
                    <span>{t('lidc.map.airportWizard.fixedWing')}</span>
                    <strong>{totals.aircrafts}</strong>
                  </div>
                  <div>
                    <Helicopter size={16} />
                    <span>{t('lidc.map.airportWizard.rotary')}</span>
                    <strong>{totals.helicopters}</strong>
                  </div>
                  <div>
                    <Shield size={16} />
                    <span>{t('lidc.map.airportWizard.ground')}</span>
                    <strong>{totals.groundAssets}</strong>
                  </div>
                  <div>
                    <Droplets size={16} />
                    <span>{t('lidc.map.airportWizard.fuel')}</span>
                    <strong>{formatStock(resources.fuelQuantity)} kg</strong>
                  </div>
                </div>
              </section>
              )}

              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.orders')}</h3>
                {orders.length === 0 && (
                  <p className="lidc-occupancy-panel__hint">{t('lidc.map.airportWizard.orderEmpty')}</p>
                )}
                {purchaseError && activeTab === 'overview' && <InlineError message={purchaseError} />}
                {orders.map((order) => {
                  const isAccepted = order.status === 'accepted';
                  const busy = orderBusyId === order.id;
                  return (
                    <article
                      key={order.id}
                      className={`lidc-airport-wizard-order ${isAccepted ? 'is-accepted' : ''}`}
                    >
                      <header>
                        <div className="lidc-airport-wizard-order-title">
                          <h4>{order.squadronName || '—'}</h4>
                          {order.code && (
                            <button
                              type="button"
                              className="lidc-airport-wizard-order-code"
                              title={t('lidc.map.airportWizard.copyOrderCode')}
                              onClick={() => copyOrderCode(order.code)}
                            >
                              {t('lidc.map.airportWizard.orderCode')} {order.code}
                            </button>
                          )}
                        </div>
                        <div className="lidc-airport-wizard-order-tools">
                          {(order.canAccept || order.canComplete || order.canUnaccept || order.canEdit) && (
                            <div className="lidc-airport-wizard-order-actions">
                              {order.canEdit && (
                                <button
                                  type="button"
                                  disabled={busy || Boolean(editingOrderId)}
                                  onClick={() => startEditOrder(order)}
                                >
                                  <Pencil size={12} />
                                  {t('lidc.map.airportWizard.editOrder')}
                                </button>
                              )}
                              {order.canUnaccept && (
                                <button
                                  type="button"
                                  className="is-undo"
                                  disabled={busy}
                                  onClick={() => runOrderAction(order, 'unaccept')}
                                >
                                  {busy ? <Loader2 size={12} className="spin" /> : <Undo2 size={12} />}
                                  {t('lidc.map.airportWizard.unacceptOrder')}
                                </button>
                              )}
                              {order.canAccept && (
                                <button
                                  type="button"
                                  className="is-accept"
                                  disabled={busy}
                                  onClick={() => runOrderAction(order, 'accept')}
                                >
                                  {busy ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                                  {t('lidc.map.airportWizard.acceptOrder')}
                                </button>
                              )}
                              {order.canComplete && (
                                <button
                                  type="button"
                                  className="is-complete"
                                  disabled={busy}
                                  onClick={() => runOrderAction(order, 'complete')}
                                >
                                  {busy ? <Loader2 size={12} className="spin" /> : <CheckCheck size={12} />}
                                  {t('lidc.map.airportWizard.completeOrder')}
                                </button>
                              )}
                            </div>
                          )}
                          <strong>{formatStock(order.cost)}</strong>
                        </div>
                      </header>
                      <div className="lidc-airport-wizard-order-items">
                        {(order.items || []).map((item, index) => (
                          <div key={`${order.id}-${item.itemId}-${index}`}>
                            <img src={shopImageFor(item)} alt="" draggable={false} />
                            <strong>{item.name}</strong>
                            <em>×{item.quantity}</em>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })}
              </section>

              {overviewExtra}

              {showSquadrons && (
              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.occupancy.squadrons')}</h3>
                {squadrons.length === 0 && (
                  <p className="lidc-occupancy-panel__hint">{t('lidc.map.occupancy.empty')}</p>
                )}
                {squadrons.map((squadron) => {
                  const flying = (squadron.airframes || []).filter((entry) => entry.category !== 'groundAssets');
                  const ground = (squadron.airframes || []).filter((entry) => entry.category === 'groundAssets');
                  return (
                    <article key={squadron.id} className="lidc-airport-wizard-squadron">
                      <header>
                        {squadron.logoDataUrl ? (
                          <img src={squadron.logoDataUrl} alt="" />
                        ) : (
                          <span>{(squadron.name || '?').charAt(0)}</span>
                        )}
                        <div>
                          <h4>{squadron.name}</h4>
                          <p>
                            {squadron.isHome ? t('lidc.map.occupancy.home') : t('lidc.map.occupancy.visiting')}
                            {' · '}
                            {squadron.memberCount} {t('lidc.map.airportWizard.members')}
                            {Array.isArray(squadron.specializationNames) && squadron.specializationNames.length > 0
                              ? ` · ${squadron.specializationNames.join(' / ')}`
                              : ''}
                          </p>
                        </div>
                      </header>
                      <div className="lidc-airport-wizard-airframes">
                        {flying.map((airframe) => (
                          <OccupancyAirframe key={airframe.id} airframe={airframe} />
                        ))}
                        {ground.map((airframe) => (
                          <OccupancyAirframe key={airframe.id} airframe={airframe} />
                        ))}
                        {flying.length === 0 && ground.length === 0 && (
                          <p className="lidc-occupancy-panel__hint">{t('lidc.map.occupancy.emptyAirframes')}</p>
                        )}
                      </div>
                    </article>
                  );
                })}
              </section>
              )}
              </div>
            </div>

            <div
              className="lidc-airport-wizard-pane"
              role="tabpanel"
              aria-hidden={activeTab !== 'logistics'}
              inert={activeTab !== 'logistics'}
            >
              <div className="lidc-airport-wizard-logistics">
              <div className="lidc-airport-wizard-credits">
                <Coins size={16} />
                <span>{t(factionEconomy ? 'lidc.map.airportWizard.blueFactionPoints' : 'lidc.map.airportWizard.credits')}</span>
                <strong>{knownCredits == null ? '—' : formatStock(knownCredits)}</strong>
              </div>
              {!isLogged && (
                <p className="lidc-occupancy-panel__hint">{t('lidc.map.airportWizard.loginToBuy')}</p>
              )}
              {isLogged && !factionEconomy && !shopper && (
                <p className="lidc-occupancy-panel__hint">{t('lidc.map.airportWizard.joinToBuy')}</p>
              )}
              {purchaseError && <InlineError message={purchaseError} />}

              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.fuel')}</h3>
                <div className="lidc-airport-wizard-fuel-row">
                  {(logistics.fuel || []).map((item) => (
                    <FuelStock key={item.id} item={item} />
                  ))}
                </div>
              </section>

              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.shopAircraft')}</h3>
                <ShopGroup
                  items={aircraftShop}
                  remainingCredits={remainingCredits}
                  canPurchase={canPurchase}
                  ignoreCreditLimit={factionEconomy}
                  onAdd={addToCart}
                />
              </section>

              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.shopHelicopters')}</h3>
                <ShopGroup
                  items={helicopterShop}
                  remainingCredits={remainingCredits}
                  canPurchase={canPurchase}
                  ignoreCreditLimit={factionEconomy}
                  onAdd={addToCart}
                />
              </section>
              </div>
            </div>
          </div>
        </div>
      </section>

      {cartMounted && (
        <aside
          className={`lidc-airport-wizard-cart ${cartOpen ? 'is-open' : ''}`}
          aria-hidden={!cartOpen}
          aria-label={t('lidc.map.airportWizard.cart')}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <header>
            <h3>{editingOrder ? t('lidc.map.airportWizard.editOrder') : t('lidc.map.airportWizard.cart')}</h3>
            <strong>{visibleCartCount}</strong>
          </header>
          <div className="lidc-airport-wizard-cart__body">
            {visibleCartLines.length === 0 ? (
              <p className="lidc-occupancy-panel__hint">{t('lidc.map.airportWizard.cartEmpty')}</p>
            ) : visibleCartLines.map((line) => (
              <article key={line.item.id} className="lidc-airport-wizard-cart__line">
                <img src={shopImageFor(line.item)} alt="" draggable={false} />
                <div>
                  <strong>{line.item.name}</strong>
                  <span>{t(`lidc.map.airportWizard.${line.item.kind}`)}</span>
                </div>
                <div className="lidc-airport-wizard-cart__qty">
                  <button
                    type="button"
                    className="is-remove"
                    onClick={() => setCartQuantity(line.item.id, line.quantity - 1)}
                    aria-label={t('lidc.map.airportWizard.removeItem')}
                  >
                    {line.quantity <= 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                  </button>
                  <em>{line.quantity}</em>
                  <button
                    type="button"
                    className="is-add"
                    disabled={!canPurchase || (!factionEconomy && remainingCredits < line.item.cost)}
                    onClick={() => addToCart(line.item.id)}
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <b>{formatStock(line.cost)}</b>
              </article>
            ))}
          </div>
          <footer>
            <div>
              <span>{t('lidc.map.airportWizard.cartTotal')}</span>
              <strong>{formatStock(cartLines.length > 0 ? cartTotal : visibleCartTotal)}</strong>
            </div>
            {editingEmptyCart ? (
              <button
                type="button"
                className="lidc-btn lidc-btn-primary lidc-btn-block"
                disabled={!canPurchase || confirming}
                onClick={cancelEditingOrder}
              >
                {confirming ? <Loader2 size={14} className="spin" /> : null}
                {t('lidc.map.airportWizard.cancelOrder')}
              </button>
            ) : (
              <button
                type="button"
                className="lidc-btn lidc-btn-primary lidc-btn-block"
                disabled={!canPurchase || confirming || cartLines.length === 0 || (!factionEconomy && cartTotal > spendBudget)}
                onClick={confirmOrder}
              >
                {confirming ? <Loader2 size={14} className="spin" /> : null}
                {t(editingOrder ? 'lidc.map.airportWizard.saveOrder' : 'lidc.map.airportWizard.confirmOrder')}
              </button>
            )}
            {editingOrder && (
              <button
                type="button"
                className="lidc-btn lidc-btn-outline lidc-btn-block"
                disabled={confirming}
                onClick={cancelEditOrder}
              >
                {t('lidc.map.airportWizard.cancelEdit')}
              </button>
            )}
          </footer>
        </aside>
      )}
      </div>
    </div>
  );
}
