import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Shield, Circle } from 'lucide-react';
import frontlineZones from '../config/frontlineZones.json';
import { t } from '../utils/locale';

/**
 * Component to fit bounds of all zones (only on mount)
 */
function FitBounds({ positions }) {
  const map = useMap();

  if (positions.length > 0) {
    setTimeout(() => {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }, 100);
  }

  return null;
}

/**
 * Get zone color based on status
 */
function getZoneColor(status) {
  switch (status) {
    case 'BLUE':
      return '#3b82f6'; // Blue
    case 'RED':
      return '#ef4444'; // Red
    case 'UNDER_ATTACK':
      return '#f97316'; // Orange
    default:
      return '#6b7280'; // Gray for unknown
  }
}

/**
 * Get zone status label
 */
function getStatusLabel(status) {
  switch (status) {
    case 'BLUE':
      return 'Controllata - Blu';
    case 'RED':
      return 'Controllata - Rosso';
    case 'UNDER_ATTACK':
      return 'Sotto Attacco';
    default:
      return 'Sconosciuto';
  }
}

/**
 * Frontline Map Component
 */
export default function FrontlineMap() {
  // Memoize calculations
  const validZones = useMemo(() => {
    return frontlineZones.filter(z => z.coordinates && z.coordinates.lat && z.coordinates.lon);
  }, []);

  const center = useMemo(() =>
    validZones.length > 0
      ? [validZones[0].coordinates.lat, validZones[0].coordinates.lon]
      : [37.0, 35.5]
  , [validZones]);

  const allPositions = useMemo(() =>
    validZones.map(z => [z.coordinates.lat, z.coordinates.lon])
  , [validZones]);

  // Group zones by status for stats
  const zoneStats = useMemo(() => {
    const stats = {
      BLUE: 0,
      RED: 0,
      UNDER_ATTACK: 0,
      total: validZones.length
    };

    validZones.forEach(zone => {
      if (stats[zone.status] !== undefined) {
        stats[zone.status]++;
      }
    });

    return stats;
  }, [validZones]);

  console.log('🗺️ FrontlineMap rendered with', validZones.length, 'zones');

  return (
    <div className="min-h-screen bg-yt-bg-primary p-4">
      <div className="max-w-[1800px] mx-auto">
        {/* Header */}
        <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yt-accent/20 rounded">
                <Shield className="w-6 h-6 text-yt-accent" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-yt-text-primary">Frontline</h1>
                <p className="text-xs text-yt-text-secondary">Mappa del fronte - Zone di controllo</p>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-blue-500 border-2 border-blue-600"></div>
                <span className="text-yt-text-secondary">Zone Blu ({zoneStats.BLUE})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-red-600"></div>
                <span className="text-yt-text-secondary">Zone Rosse ({zoneStats.RED})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-orange-500 border-2 border-orange-600"></div>
                <span className="text-yt-text-secondary">Sotto Attacco ({zoneStats.UNDER_ATTACK})</span>
              </div>
              <div className="flex items-center gap-1.5 ml-4 px-3 py-1 bg-yt-bg-tertiary rounded">
                <Circle className="w-4 h-4 text-yt-accent" />
                <span className="text-yt-text-primary font-bold">Totale: {zoneStats.total}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-yt-bg-secondary rounded-lg overflow-hidden border border-yt-border" style={{ height: '800px' }}>
          <MapContainer
            center={center}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={true}
          >
            {/* CyclOSM tiles */}
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="https://github.com/cyclosm/cyclosm-cartocss-style/releases">CyclOSM</a>'
              url="https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png"
            />

            {/* Fit bounds to show all zones */}
            <FitBounds positions={allPositions} />

            {/* Zone markers */}
            {validZones.map(zone => {
              const color = getZoneColor(zone.status);

              return (
                <CircleMarker
                  key={zone.id}
                  center={[zone.coordinates.lat, zone.coordinates.lon]}
                  radius={8}
                  pathOptions={{
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.6,
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold text-base">{zone.name}</div>
                      <div className="mt-1">
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: `${color}20`,
                            color: color
                          }}
                        >
                          {getStatusLabel(zone.status)}
                        </span>
                      </div>
                      <div className="text-gray-600 text-xs mt-1">
                        {zone.coordinates.lat.toFixed(6)}°N, {zone.coordinates.lon.toFixed(6)}°E
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
