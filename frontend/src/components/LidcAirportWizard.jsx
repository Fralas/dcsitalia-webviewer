import { useMemo, useState } from 'react';
import {
  Coins,
  Crosshair,
  Droplets,
  Helicopter,
  Loader2,
  Plane,
  Shield,
  X,
} from 'lucide-react';
import * as mgrs from 'mgrs';
import { formatLidcAirportLabel, getLidcAirportById } from '../config/lidcAfghanistanAirports';
import * as api from '../services/api';
import { t } from '../utils/locale';
import { getLidcUnitImageUrl } from '../utils/lidcUnitImages';
import InlineError from './InlineError';
import './LidcAirportWizard.css';

const TABS = ['overview', 'logistics'];

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

function LogisticsRow({
  item,
  kind,
  canPurchase,
  buyingKey,
  onPurchase,
}) {
  const [quantity, setQuantity] = useState(1);
  const fill = item.capacity > 0 ? Math.min(100, Math.round((item.quantity / item.capacity) * 100)) : 0;
  const cost = item.unitCost * quantity;
  const rowKey = `${kind}:${item.id}`;
  const isBuying = buyingKey === rowKey;
  const remaining = Math.max(0, item.capacity - item.quantity);

  return (
    <div className="lidc-airport-wizard-stock">
      <div className="lidc-airport-wizard-stock__copy">
        <strong>{item.label}</strong>
        <span>
          {formatStock(item.quantity)} / {formatStock(item.capacity)} {item.unit}
        </span>
        <div className="lidc-airport-wizard-meter" aria-hidden="true">
          <i style={{ width: `${fill}%` }} />
        </div>
      </div>
      <div className="lidc-airport-wizard-stock__buy">
        <input
          type="number"
          min={1}
          max={Math.max(1, remaining)}
          value={quantity}
          disabled={!canPurchase || remaining < 1}
          onChange={(event) => setQuantity(Math.max(1, Math.floor(Number(event.target.value) || 1)))}
          aria-label={t('lidc.map.airportWizard.quantity')}
        />
        <button
          type="button"
          className="lidc-btn lidc-btn-primary"
          disabled={!canPurchase || remaining < 1 || isBuying}
          onClick={() => onPurchase(kind, item.id, quantity)}
        >
          {isBuying ? <Loader2 size={13} className="spin" /> : t('lidc.map.airportWizard.buy')}
          <span>{cost}</span>
        </button>
      </div>
    </div>
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
  const logistics = occupancy?.logistics || { fuel: [], armament: [], credits: 0 };
  const resources = occupancy?.resources || {};

  const totals = useMemo(() => {
    return squadrons.reduce((acc, squadron) => {
      acc.aircrafts += Number(squadron?.counts?.aircrafts || 0);
      acc.helicopters += Number(squadron?.counts?.helicopters || 0);
      acc.groundAssets += Number(squadron?.counts?.groundAssets || 0);
      acc.members += Number(squadron?.memberCount || 0);
      return acc;
    }, { aircrafts: 0, helicopters: 0, groundAssets: 0, members: 0 });
  }, [squadrons]);

  async function handlePurchase(kind, itemId, quantity) {
    if (!isLogged || !airport?.id) return;
    const rowKey = `${kind}:${itemId}`;
    setBuyingKey(rowKey);
    setPurchaseError('');
    try {
      const result = await api.purchaseLidcAirportLogistics(airport.id, { kind, itemId, quantity });
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

        <div className="lidc-wizard-body lidc-airport-wizard-body">
          {activeTab === 'overview' && (
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
                  <div>
                    <Crosshair size={16} />
                    <span>{t('lidc.map.airportWizard.armament')}</span>
                    <strong>{formatStock(resources.armamentQuantity)}</strong>
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
          )}

          {activeTab === 'logistics' && (
            <div className="lidc-airport-wizard-logistics">
              <div className="lidc-airport-wizard-credits">
                <Coins size={16} />
                <span>{t('lidc.map.airportWizard.credits')}</span>
                <strong>{formatStock(logistics.credits)}</strong>
              </div>
              {!isLogged && (
                <p className="lidc-occupancy-panel__hint">{t('lidc.map.airportWizard.loginToBuy')}</p>
              )}
              {purchaseError && <InlineError message={purchaseError} />}

              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.fuel')}</h3>
                {(logistics.fuel || []).map((item) => (
                  <LogisticsRow
                    key={item.id}
                    item={item}
                    kind="fuel"
                    canPurchase={isLogged}
                    buyingKey={buyingKey}
                    onPurchase={handlePurchase}
                  />
                ))}
              </section>

              <section className="lidc-airport-wizard-block">
                <h3>{t('lidc.map.airportWizard.armament')}</h3>
                {(logistics.armament || []).map((item) => (
                  <LogisticsRow
                    key={item.id}
                    item={item}
                    kind="armament"
                    canPurchase={isLogged}
                    buyingKey={buyingKey}
                    onPurchase={handlePurchase}
                  />
                ))}
              </section>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
