import { Loader2, X } from 'lucide-react';
import { formatLidcAirportLabel } from '../config/lidcAfghanistanAirports';
import { t } from '../utils/locale';
import { getLidcUnitImageUrl } from '../utils/lidcUnitImages';
import InlineError from './InlineError';

function OccupancyAirframe({ airframe }) {
  const model = airframe.unitLabel || airframe.unitId || '-';
  const imageUrl = getLidcUnitImageUrl(airframe.unitId);

  return (
    <div
      className="lidc-occupancy-airframe"
      title={`${model} · ${airframe.boardNumber || '-'}`}
    >
      <span className="lidc-occupancy-airframe-board">{airframe.boardNumber || '-'}</span>
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={model}
          className="lidc-occupancy-airframe-image"
          draggable={false}
        />
      ) : (
        <span className="lidc-occupancy-airframe-fallback">{model}</span>
      )}
    </div>
  );
}

export default function LidcAirportPresencePanel({
  airport,
  occupancy,
  loading = false,
  error = '',
  onClose,
}) {
  const squadrons = Array.isArray(occupancy?.squadrons) ? occupancy.squadrons : [];
  const airframeCount = squadrons.reduce((total, squadron) => (
    total + (Array.isArray(squadron.airframes) ? squadron.airframes.length : 0)
  ), 0);

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

      <div className="lidc-occupancy-panel__meta">
        <span>{squadrons.length} {t('lidc.map.occupancy.squadrons')}</span>
        <span aria-hidden="true">·</span>
        <span>{airframeCount} {t('lidc.map.occupancy.aircraft')}</span>
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
        {!loading && !error && squadrons.length === 0 && (
          <p className="lidc-occupancy-panel__hint">{t('lidc.map.occupancy.empty')}</p>
        )}
        {!loading && !error && squadrons.map((squadron) => (
          <section key={squadron.id} className="lidc-occupancy-squadron">
            <div className="lidc-occupancy-squadron__head">
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
                </div>
                <p>
                  {Array.isArray(squadron.airframes) ? squadron.airframes.length : 0}
                  {' '}
                  {t('lidc.map.occupancy.aircraft')}
                </p>
              </div>
            </div>
            {(!squadron.airframes || squadron.airframes.length === 0) ? (
              <p className="lidc-occupancy-panel__hint is-compact">
                {t('lidc.map.occupancy.emptyAirframes')}
              </p>
            ) : (
              <div className="lidc-occupancy-airframes">
                {squadron.airframes.map((airframe) => (
                  <OccupancyAirframe key={airframe.id} airframe={airframe} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </aside>
  );
}
