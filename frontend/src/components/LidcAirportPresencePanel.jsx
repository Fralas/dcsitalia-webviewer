import { ChevronRight, Helicopter, Loader2, Plane, X } from 'lucide-react';
import { formatLidcAirportLabel } from '../config/lidcAfghanistanAirports';
import { t } from '../utils/locale';
import InlineError from './InlineError';

function SquadronKindCounts({ counts }) {
  const aircrafts = Number(counts?.aircrafts || 0);
  const helicopters = Number(counts?.helicopters || 0);

  return (
    <div className="lidc-occupancy-counts">
      <span className="lidc-occupancy-count">
        <Plane size={13} aria-hidden="true" />
        <strong>{aircrafts}</strong>
      </span>
      <span className="lidc-occupancy-count">
        <Helicopter size={13} aria-hidden="true" />
        <strong>{helicopters}</strong>
      </span>
    </div>
  );
}

function formatBadgeCount(count) {
  const value = Math.max(0, Math.floor(Number(count) || 0));
  if (value < 1) return '';
  return value > 99 ? '99+' : String(value);
}

function countLowFuelTanks(fuel) {
  return (Array.isArray(fuel) ? fuel : []).filter((entry) => {
    const capacity = Number(entry?.capacity) || 0;
    if (capacity <= 0) return false;
    return (Number(entry?.quantity) || 0) / capacity < 0.2;
  }).length;
}

export default function LidcAirportPresencePanel({
  airport,
  occupancy,
  loading = false,
  error = '',
  orderAlertCount = 0,
  fuelAlertCount = 0,
  showSquadrons = true,
  onClose,
  onOpenWizard,
  children = null,
}) {
  const squadrons = showSquadrons && Array.isArray(occupancy?.squadrons) ? occupancy.squadrons : [];
  const occupancyMatches = occupancy?.airport?.id === airport?.id;
  const orderCount = occupancyMatches && Array.isArray(occupancy?.orders)
    ? occupancy.orders.length
    : Math.max(0, Math.floor(Number(orderAlertCount) || 0));
  const fuelCount = occupancyMatches
    ? countLowFuelTanks(occupancy?.logistics?.fuel)
    : Math.max(0, Math.floor(Number(fuelAlertCount) || 0));
  const orderBadge = formatBadgeCount(orderCount);
  const fuelBadge = formatBadgeCount(fuelCount);

  return (
    <aside
      className="lidc-occupancy-panel"
      aria-label={formatLidcAirportLabel(airport)}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="lidc-occupancy-panel__head">
        <div className="lidc-occupancy-panel__identity">
          <span className="lidc-occupancy-panel__type">{airport?.subtitle}</span>
          <h3 className="lidc-occupancy-panel__name">{airport?.name}</h3>
        </div>
        <button
          type="button"
          className="lidc-occupancy-panel__close"
          onClick={onClose}
          aria-label={t('lidc.map.occupancy.close')}
        >
          <X size={16} />
        </button>
      </header>

      <div className="lidc-occupancy-panel__menus" role="navigation" aria-label={t('lidc.map.airportWizard.menus')}>
        <button type="button" className="lidc-occupancy-menu" onClick={() => onOpenWizard('overview')}>
          {t('lidc.map.airportWizard.overview')}
          {orderBadge ? (
            <span className="lidc-occupancy-menu__badge" aria-label={t('lidc.map.occupancy.orderAlert', { count: orderCount })}>
              {orderBadge}
            </span>
          ) : null}
        </button>
        <button type="button" className="lidc-occupancy-menu" onClick={() => onOpenWizard('logistics')}>
          {t('lidc.map.airportWizard.logistics')}
          {fuelBadge ? (
            <span className="lidc-occupancy-menu__badge" aria-label={t('lidc.map.occupancy.fuelAlert', { count: fuelCount })}>
              {fuelBadge}
            </span>
          ) : null}
        </button>
      </div>

      <div className="lidc-occupancy-panel__body">
        {loading && (
          <div className="lidc-loading">
            <Loader2 size={14} className="spin" />
            <span>{t('lidc.general.loading')}</span>
          </div>
        )}
        {!loading && error && (
          <InlineError message={error} />
        )}
        {!loading && !error && showSquadrons && squadrons.length === 0 && !children && (
          <p className="lidc-occupancy-panel__hint">{t('lidc.map.occupancy.empty')}</p>
        )}
        {children}
        {!loading && !error && squadrons.map((squadron) => (
          <button
            key={squadron.id}
            type="button"
            className="lidc-occupancy-squadron is-button"
            onClick={() => onOpenWizard('overview')}
          >
            {squadron.logoDataUrl ? (
              <img
                src={squadron.logoDataUrl}
                alt=""
                className="lidc-occupancy-squadron__logo"
              />
            ) : (
              <span className="lidc-occupancy-squadron__logo is-empty" aria-hidden="true">
                {(squadron.name || '?').charAt(0)}
              </span>
            )}
            <div className="lidc-occupancy-squadron__copy">
              <div className="lidc-occupancy-squadron__title-row">
                <h4>{squadron.name}</h4>
                <span className={`lidc-occupancy-badge ${squadron.isHome ? 'is-home' : 'is-visiting'}`}>
                  {squadron.isHome
                    ? t('lidc.map.occupancy.home')
                    : t('lidc.map.occupancy.visiting')}
                </span>
                <SquadronKindCounts counts={squadron.counts} />
              </div>
            </div>
            <ChevronRight size={16} className="lidc-occupancy-squadron__open" aria-hidden="true" />
          </button>
        ))}
      </div>
    </aside>
  );
}
