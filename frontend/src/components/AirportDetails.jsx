import { ArrowLeft, Plane, Helicopter, Anchor, MapPin } from 'lucide-react';
import AirportCard from './AirportCard';
import { t } from '../utils/locale';
import airportsConfig from '../config/airports';

function formatDms(value, positiveLabel, negativeLabel) {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutesFloat = (abs - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 60);

  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }

  const hemisphere = value >= 0 ? positiveLabel : negativeLabel;
  return `${degrees} ${minutes}'${seconds}" ${hemisphere}`;
}

function getAirportCoordinates(airport) {
  if (airport?.coordinates) return airport.coordinates;
  const fallback = airportsConfig.find(item => item.id === airport?.id);
  return fallback?.coordinates || null;
}

function getAirportType(airport) {
  if (airport?.isMainBase) return { label: t('airportsDirectory.tags.mainBase'), color: 'text-fuchsia-400' };
  if (airport?.isCarrier) return { label: t('airportsDirectory.tags.carrier'), color: 'text-green-400' };
  if (airport?.isHeliport) return { label: t('airportsDirectory.tags.heliport'), color: 'text-cyan-400' };
  return { label: t('airportsDirectory.tags.airport'), color: 'text-yt-accent' };
}

export default function AirportDetails({ airport, missions, onMissionsUpdate, onBack }) {
  if (!airport) {
    return (
      <div className="bg-yt-bg-secondary rounded-lg p-8 text-center border border-yt-border">
        <Plane className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
        <p className="text-base text-yt-text-primary font-medium">{t('airportDetails.emptyTitle')}</p>
        <p className="text-xs text-yt-text-secondary mt-1">{t('airportDetails.emptySubtitle')}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded text-sm font-medium transition-all"
        >
          {t('airportDetails.back')}
        </button>
      </div>
    );
  }

  const coords = getAirportCoordinates(airport);
  const dmsLat = coords ? formatDms(coords.lat, 'N', 'S') : '-';
  const dmsLon = coords ? formatDms(coords.lon, 'E', 'W') : '-';
  const typeInfo = getAirportType(airport);
  const icao = (airport.icao || airport.csvPrefix || airport.id || '').toUpperCase();

  return (
    <div className="space-y-3">
      <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-yt-text-primary">{airport.displayName || airport.name}</h2>
          <p className="text-xs text-yt-text-secondary">{t('airportDetails.subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3 py-2 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded text-sm font-medium transition-all flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('airportDetails.back')}
        </button>
      </div>

      <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {airport.isCarrier ? (
              <Anchor className={`w-5 h-5 ${typeInfo.color}`} />
            ) : airport.isHeliport ? (
              <Helicopter className={`w-5 h-5 ${typeInfo.color}`} />
            ) : (
              <Plane className={`w-5 h-5 ${typeInfo.color}`} />
            )}
            <span className={`text-xs font-bold uppercase tracking-wide ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
          </div>
          <div className="text-xs text-yt-text-secondary">
            <span className="font-medium text-yt-text-primary">{t('airportsDirectory.labels.icao')}:</span> {icao}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-yt-text-secondary">
            <MapPin className="w-3.5 h-3.5" />
            <span>{dmsLat} | {dmsLon}</span>
          </div>
        </div>
      </div>

      <AirportCard
        airport={airport}
        missions={missions}
        onMissionsUpdate={onMissionsUpdate}
        shouldExpand
        expandToken={1}
        forceExpanded
        showOrders={false}
      />
    </div>
  );
}
