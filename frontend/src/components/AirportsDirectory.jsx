import { useMemo } from 'react';
import { Plane, Helicopter, Anchor, MapPin } from 'lucide-react';
import airportsConfig from '../config/airports';
import { t } from '../utils/locale';

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

function getAirportType(airport) {
  if (airport.isMainBase) return { label: t('airportsDirectory.tags.mainBase'), color: 'text-fuchsia-400' };
  if (airport.isCarrier) return { label: t('airportsDirectory.tags.carrier'), color: 'text-green-400' };
  if (airport.isHeliport) return { label: t('airportsDirectory.tags.heliport'), color: 'text-cyan-400' };
  return { label: t('airportsDirectory.tags.airport'), color: 'text-yt-accent' };
}

function getAirportCoordinates(airport) {
  if (airport.coordinates) return airport.coordinates;
  const fallback = airportsConfig.find(item => item.id === airport.id);
  return fallback?.coordinates || null;
}

export default function AirportsDirectory({ airports, onSelectAirport }) {
  const airportList = useMemo(() => {
    const items = Object.values(airports || {}).filter(item => item && item.name);
    return items
      .filter(item => item.isActive !== false)
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
  }, [airports]);

  return (
    <div className="space-y-3">
      <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-yt-accent/20 rounded">
            <Plane className="w-5 h-5 text-yt-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-yt-text-primary">{t('airportsDirectory.title')}</h2>
            <p className="text-xs text-yt-text-secondary">{t('airportsDirectory.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {airportList.length === 0 ? (
          <div className="bg-yt-bg-secondary rounded-lg p-8 text-center border border-yt-border">
            <Plane className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
            <p className="text-base text-yt-text-primary font-medium">{t('airportsDirectory.emptyTitle')}</p>
            <p className="text-xs text-yt-text-secondary mt-1">{t('airportsDirectory.emptySubtitle')}</p>
          </div>
        ) : (
          airportList.map(airport => {
            const coords = getAirportCoordinates(airport);
            const dmsLat = coords ? formatDms(coords.lat, 'N', 'S') : '-';
            const dmsLon = coords ? formatDms(coords.lon, 'E', 'W') : '-';
            const typeInfo = getAirportType(airport);
            const icao = (airport.icao || airport.csvPrefix || airport.id || '').toUpperCase();

            return (
              <button
                key={airport.id}
                type="button"
                onClick={() => onSelectAirport && onSelectAirport(airport.id)}
                className="w-full text-left bg-yt-bg-secondary rounded-lg border border-yt-border p-4 hover:border-yt-border/60 hover:shadow-lg transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">
                      {airport.isCarrier ? (
                        <Anchor className={`w-5 h-5 ${typeInfo.color}`} />
                      ) : airport.isHeliport ? (
                        <Helicopter className={`w-5 h-5 ${typeInfo.color}`} />
                      ) : (
                        <Plane className={`w-5 h-5 ${typeInfo.color}`} />
                      )}
                    </div>
                    <div>
                      <div className="text-base font-bold text-yt-text-primary">{airport.displayName || airport.name}</div>
                      <div className="text-xs text-yt-text-secondary mt-1">
                        <span className="font-medium text-yt-text-primary">{t('airportsDirectory.labels.icao')}:</span> {icao}
                      </div>
                      <div className="text-xs text-yt-text-secondary mt-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{dmsLat} | {dmsLon}</span>
                      </div>
                    </div>
                  </div>
                  <span className={`text-xs font-bold uppercase tracking-wide ${typeInfo.color}`}>
                    {typeInfo.label}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
