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

export default function AirportsDirectory({ airports, missions = [], onSelectAirport }) {
  const airportList = useMemo(() => {
    const items = Object.values(airports || {}).filter(item => item && item.name);
    return items
      .filter(item => item.isActive !== false)
      .sort((a, b) => (a.displayName || a.name).localeCompare(b.displayName || b.name));
  }, [airports]);

  const activeAirportsCount = airportList.length;

  const missionsByAirport = useMemo(() => {
    return missions.reduce((acc, mission) => {
      const key = mission.airport_id;
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }, [missions]);

  return (
    <div className="space-y-3">
      <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
          <div className="p-2 bg-yt-accent/20 rounded">
            <Plane className="w-5 h-5 text-yt-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-yt-text-primary">{t('airportsDirectory.title')}</h2>
            <p className="text-xs text-yt-text-secondary">{t('airportsDirectory.subtitle')}</p>
          </div>
          </div>
          <div className="flex items-center gap-2 bg-yt-bg-tertiary border border-yt-border/70 rounded-full px-3 py-1">
            <span className="text-xs text-yt-text-secondary">{t('airportsDirectory.activeCount')}</span>
            <span className="text-sm font-bold text-yt-text-primary">{activeAirportsCount}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
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
            const isDefaultAirport = !airport.isMainBase && !airport.isCarrier && !airport.isHeliport;
            const icao = (airport.icao || airport.csvPrefix || airport.id || '').toUpperCase();
            const missionCount = missionsByAirport[airport.id] || 0;

            return (
              <button
                key={airport.id}
                type="button"
                onClick={() => onSelectAirport && onSelectAirport(airport.id)}
                className="w-full text-left bg-yt-bg-secondary rounded-xl border border-yt-border/70 p-4 hover:border-yt-border hover:-translate-y-0.5 hover:shadow-xl transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="rounded-lg bg-yt-bg-tertiary/80 p-2.5 border border-yt-border/70">
                      {airport.isCarrier ? (
                        <Anchor className={`w-5 h-5 ${typeInfo.color}`} />
                      ) : airport.isHeliport ? (
                        <Helicopter className={`w-5 h-5 ${typeInfo.color}`} />
                      ) : (
                        <Plane className={`w-5 h-5 ${typeInfo.color}`} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-base font-bold text-yt-text-primary truncate">{airport.displayName || airport.name}</div>
                      <div className="text-[11px] text-yt-text-secondary mt-1">
                        <span className="font-medium text-yt-text-primary">{t('airportsDirectory.labels.icao')}:</span> {icao}
                      </div>
                    </div>
                  </div>
                  <div />
                </div>
                <div className="mt-4 pt-3 border-t border-yt-border/60 flex items-center justify-between gap-3 text-[11px] text-yt-text-secondary">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-yt-text-secondary" />
                    <span className="font-mono">{dmsLat} | {dmsLon}</span>
                  </div>
                  {missionCount > 0 && (
                    <div className="inline-flex items-center gap-1.5 bg-yt-bg-tertiary border border-yt-border/70 px-2 py-1 rounded-full">
                      <span className="font-bold text-yt-text-primary">{missionCount}</span>
                      <span>{t('airportsDirectory.missions')}</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
