import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Shield, Circle, Plane, Helicopter, Anchor } from 'lucide-react';
import frontlineZones from '../config/frontlineZones.json';
import airports from '../config/airports';
import { t } from '../utils/locale';

/**
 * Convert decimal coordinates to DMS (Degrees, Minutes, Seconds)
 */
function toDMS(decimal, isLat) {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesDecimal = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = Math.round((minutesDecimal - minutes) * 60);

  const direction = isLat
    ? (decimal >= 0 ? 'N' : 'S')
    : (decimal >= 0 ? 'E' : 'W');

  return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toString().padStart(2, '0')}"${direction}`;
}

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
 * Custom airport icon
 */
const createAirportIcon = (isMainBase, isHeliport, isCarrier) => {
  const color = isMainBase ? '#e879f9' : isCarrier ? '#22c55e' : isHeliport ? '#22d3ee' : '#3b82f6';
  const size = isMainBase ? 16 : 12;
  const iconSvg = isCarrier
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><path d="M12 22V8M5 12H2a10 10 0 0 0 20 0h-3"/></svg>`
    : isHeliport
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v-1a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m-4 0h4m-4 0v1.5m4-1.5v1.5m3-6.5h-3L11 9V4a1 1 0 0 0-2 0v5L7 6H4l4 5v3H6l-2 2v2h4v-1h8v1h4v-2l-2-2h-2v-3l4-5h-3z"/></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;

  return L.divIcon({
    className: 'custom-airport-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: ${size * 2}px;
          height: ${size * 2}px;
          background: ${color};
          border: 3px solid ${isMainBase ? '#d946ef' : isCarrier ? '#16a34a' : isHeliport ? '#06b6d4' : '#2563eb'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #1e293b;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          ${iconSvg}
        </div>
      </div>
    `,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  });
};

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
export default function FrontlineMap({ airportsData }) {
  // Memoize calculations
  const validZones = useMemo(() => {
    return frontlineZones.filter(z => z.coordinates && z.coordinates.lat && z.coordinates.lon);
  }, []);

  const validAirports = useMemo(() => {
    const airportsList = airportsData ? airportsData : airports;
    return airportsList.filter(a => a.coordinates && a.isActive !== false);
  }, [airportsData]);

  const center = useMemo(() =>
    validZones.length > 0
      ? [validZones[0].coordinates.lat, validZones[0].coordinates.lon]
      : [37.0, 35.5]
  , [validZones]);

  const allPositions = useMemo(() => {
    const zonePositions = validZones.map(z => [z.coordinates.lat, z.coordinates.lon]);
    const airportPositions = validAirports.map(a => [a.coordinates.lat, a.coordinates.lon]);
    return [...zonePositions, ...airportPositions];
  }, [validZones, validAirports]);

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
            <div className="flex items-center gap-3 text-xs">
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
              <div className="h-4 w-px bg-yt-border"></div>
              <div className="flex items-center gap-1.5">
                <Plane className="w-4 h-4 text-blue-500" />
                <span className="text-yt-text-secondary">Aeroporti</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Helicopter className="w-4 h-4 text-cyan-400" />
                <span className="text-yt-text-secondary">Eliporti</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-green-500" />
                <span className="text-yt-text-secondary">Portaerei</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-fuchsia-400 border-2 border-fuchsia-500"></div>
                <span className="text-yt-text-secondary">Base Principale</span>
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
                      <div className="text-gray-600 text-xs mt-1 font-mono">
                        {toDMS(zone.coordinates.lat, true)} {toDMS(zone.coordinates.lon, false)}
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}

            {/* Airport markers */}
            {validAirports.map(airport => {
              return (
                <Marker
                  key={airport.id}
                  position={[airport.coordinates.lat, airport.coordinates.lon]}
                  icon={createAirportIcon(airport.isMainBase, airport.isHeliport, airport.isCarrier)}
                >
                  <Popup>
                    <div className="text-sm">
                      <div className="font-bold text-base">{airport.displayName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {airport.isMainBase && (
                          <span className="text-fuchsia-600 text-xs font-semibold">BASE PRINCIPALE</span>
                        )}
                        <span className={`text-xs font-semibold ${airport.isCarrier ? 'text-green-600' : airport.isHeliport ? 'text-cyan-600' : 'text-blue-600'}`}>
                          {airport.isCarrier ? 'PORTAEREI' : airport.isHeliport ? 'ELIPORTO' : 'AEROPORTO'}
                        </span>
                      </div>
                      <div className="text-gray-600 text-xs mt-1 font-mono">
                        {toDMS(airport.coordinates.lat, true)} {toDMS(airport.coordinates.lon, false)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
