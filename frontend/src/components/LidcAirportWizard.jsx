import { useMemo, useState } from 'react';
import {
  Coins,
  Droplets,
  Helicopter,
  Loader2,
  Plane,
  Shield,
  X,
} from 'lucide-react';
import * as mgrs from 'mgrs';
import ammoContainerImage from '../../img/crates/container_blue_mid.png';
import ammoCrateImage from '../../img/crates/prop_mil_crate_01.png';
import { formatLidcAirportLabel, getLidcAirportById } from '../config/lidcAfghanistanAirports';
import * as api from '../services/api';
import { t } from '../utils/locale';
import { getLidcUnitImageUrl } from '../utils/lidcUnitImages';
import InlineError from './InlineError';
import './LidcAirportWizard.css';

const TABS = ['overview', 'logistics'];

const SHOP_IMAGES = {
  container: ammoContainerImage,
  crate: ammoCrateImage,
};

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

function FuelStock({ item }) {
  const fill = item.capacity > 0 ? Math.min(100, Math.round((item.quantity / item.capacity) * 100)) : 0;

  return (
    <div className="lidc-airport-wizard-stock">
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

function ShopCard({ item, credits, canPurchase, buyingKey, onPurchase }) {
  const isBuying = buyingKey === item.id;
  const canAfford = credits >= item.cost;
  const enabled = canPurchase && canAfford && !isBuying;
  const transport = Array.isArray(item.transport) ? item.transport : [];
  const imageUrl = SHOP_IMAGES[item.kind] || '';

  return (
    <button
      type="button"
      className="lidc-airport-wizard-shop-card"
      disabled={!enabled}
      onClick={() => onPurchase(item.id)}
    >
      <span className="lidc-airport-wizard-shop-card__transport" aria-hidden="true">
        <Plane size={16} />
        {transport.includes('helicopter') && <Helicopter size={16} />}
      </span>
      {imageUrl ? (
        <img src={imageUrl} alt="" draggable={false} />
      ) : null}
      <strong>{t(`lidc.map.airportWizard.${item.kind}`)}</strong>
      <span className="lidc-airport-wizard-shop-card__cost">
        {isBuying ? <Loader2 size={14} className="spin" /> : <Coins size={14} />}
        {formatStock(item.cost)}
      </span>
    </button>
  );
}

export default function LidcAirportWizard({
  airport,
  occupancy,
  activeTab = 'overview',
  isLogged = false,
  onChangeTab,
  onClose,
  onLogisticsUpdated,
}) {
  const [buyingKey, setBuyingKey] = useState('');
  const [purchaseError, setPurchaseError] = useState('');
  const catalogAirport = getLidcAirportById(airport?.id) || airport;
  const squadrons = Array.isArray(occupancy?.squadrons) ? occupancy.squadrons : [];
  const resources = occupancy?.resources || {};
  const logistics = occupancy?.logistics || { fuel: [] };
  const shop = Array.isArray(occupancy?.shop) ? occupancy.shop : [];
  const shopper = occupancy?.shopper || null;
  const squadronCredits = Number(shopper?.credits || 0);

  const totals = useMemo(() => {
    return squadrons.reduce((acc, squadron) => {
      acc.aircrafts += Number(squadron?.counts?.aircrafts || 0);
      acc.helicopters += Number(squadron?.counts?.helicopters || 0);
      acc.groundAssets += Number(squadron?.counts?.groundAssets || 0);
      acc.members += Number(squadron?.memberCount || 0);
      return acc;
    }, { aircrafts: 0, helicopters: 0, groundAssets: 0, members: 0 });
  }, [squadrons]);

  async function handlePurchase(itemId) {
    if (!isLogged || !shopper || !airport?.id) return;
    setBuyingKey(itemId);
    setPurchaseError('');
    try {
      const result = await api.purchaseLidcAirportLogistics(airport.id, { itemId, quantity: 1 });
      onLogisticsUpdated?.(result);
    } catch (error) {
      setPurchaseError(error.message || t('lidc.map.airportWizard.purchaseFailed'));
    } finally {
      setBuyingKey('');
    }
  }

  return (
    <div className="lidc-wizard-root lidc-airport-wizard-root">
      <div className="lidc-wizard-backdrop" onClick={onClose} aria-hidden="true" />
      <section
        className="lidc-wizard-card lidc-airport-wizard-card"
        role="dialog"
        aria-modal="true"
        aria-label={formatLidcAirportLabel(catalogAirport)}
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
              <section className="lidc-airport-wizard-facts">
                <article>
                  <span>{t('lidc.map.airportWizard.mgrs')}</span>
                  <strong className="lidc-airport-wizard-mgrs">{formatMgrs(catalogAirport?.lat, catalogAirport?.lon)}</strong>
                </article>
                <article>
                  <span>{t('lidc.map.occupancy.squadrons')}</span>
                  <strong>{squadrons.length}</strong>
                </article>
              </section>

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
                <span>{t('lidc.map.airportWizard.credits')}</span>
                <strong>{shopper ? formatStock(squadronCredits) : '—'}</strong>
              </div>
              {!isLogged && (
                <p className="lidc-occupancy-panel__hint">{t('lidc.map.airportWizard.loginToBuy')}</p>
              )}
              {isLogged && !shopper && (
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
                <div className="lidc-airport-wizard-shop">
                  {shop.map((item) => (
                    <ShopCard
                      key={item.id}
                      item={item}
                      credits={squadronCredits}
                      canPurchase={isLogged && Boolean(shopper)}
                      buyingKey={buyingKey}
                      onPurchase={handlePurchase}
                    />
                  ))}
                </div>
              </section>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
