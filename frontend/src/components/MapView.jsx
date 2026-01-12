import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Plane, Helicopter, Anchor } from 'lucide-react';
import airports from '../config/airports';
import { t } from '../utils/locale';

/**
 * Get weapon display name
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

function getMissionOrders(mission) {
  if (Array.isArray(mission.orders) && mission.orders.length > 0) {
    return mission.orders;
  }

  if (mission.weapon_id) {
    return [{
      weapon_id: mission.weapon_id,
      quantity_needed: mission.quantity_needed,
      current_quantity: mission.current_quantity,
      total_weight_lbs: mission.total_weight_lbs,
      priority: mission.priority,
    }];
  }

  return [];
}

function getMissionTitle(mission) {
  const orders = getMissionOrders(mission);
  if (orders.length === 0) return 'Missione';
  if (orders.length === 1) return getWeaponDisplayName(orders[0].weapon_id);
  return `${getWeaponDisplayName(orders[0].weapon_id)} +${orders.length - 1}`;
}

/**
 * Component to fit bounds of all airports (only on mount)
 */
function FitBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]); // Only run once on mount

  return null;
}

/**
 * Custom airport icon
 */
const createAirportIcon = (isMainBase, missionCount, isHeliport, isCarrier) => {
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
        ${missionCount > 0 ? `
          <div style="
            position: absolute;
            top: -8px;
            right: -8px;
            background: #dc2626;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 11px;
            font-weight: bold;
            border: 2px solid #1e293b;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${missionCount}</div>
        ` : ''}
      </div>
    `,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
  });
};

/**
 * Mission Polyline Component
 */
function MissionPolyline({ mission, sourceAirport, destAirport, isHighlighted, isSelected, onHover, onSelect }) {
  if (!sourceAirport || !destAirport) return null;

  const isPending = mission.status === 'pending';
  const positions = [
    [sourceAirport.coordinates.lat, sourceAirport.coordinates.lon],
    [destAirport.coordinates.lat, destAirport.coordinates.lon],
  ];

  // Enhanced visibility for pending missions
  const baseOpacity = isPending ? 0.65 : 0.5;
  const baseWeight = isPending ? 3 : 2;

  return (
    <Polyline
      positions={positions}
      pathOptions={{
        color: isSelected ? '#e879f9' : isPending ? '#60a5fa' : '#f87171',
        weight: isSelected ? 5 : isHighlighted ? 4 : baseWeight,
        opacity: isSelected ? 1 : isHighlighted ? 1 : baseOpacity,
        dashArray: isPending ? '10, 10' : undefined,
      }}
      eventHandlers={{
        mouseover: () => onHover(mission.id),
        mouseout: () => onHover(null),
        click: () => onSelect(mission.id),
      }}
    >
      <Popup>
        <div className="text-xs">
          <div className="font-bold">{getMissionTitle(mission)}</div>
          <div className="text-gray-600">
            {sourceAirport.displayName} → {destAirport.displayName}
          </div>
          <div className="text-gray-600">
            {mission.distance_nm ? `${mission.distance_nm}nm` : '-'}
          </div>
          <div className="text-gray-600">
            Ordini: {getMissionOrders(mission).length}
          </div>
          <div className="mt-1">
            <span className={`px-2 py-1 rounded text-xs ${
              isPending ? 'bg-blue-500/20 text-blue-600' : 'bg-red-400/20 text-red-400'
            }`}>
              {mission.status.toUpperCase()}
            </span>
          </div>
        </div>
      </Popup>
    </Polyline>
  );
}

/**
 * Map View Component
 */
export default function MapView({ missions, airportsData, onNavigateToMissions, embedded = false }) {
  const [hoveredMission, setHoveredMission] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);

  // Memoize airports calculations to prevent re-renders
  // Filter by coordinates AND by active status
  const validAirports = useMemo(() => {
    const airportsList = airportsData ? Object.values(airportsData) : airports;
    return airportsList.filter(a => a.coordinates && a.isActive !== false);
  }, [airportsData]);

  const center = useMemo(() =>
    validAirports.length > 0
      ? [validAirports[0].coordinates.lat, validAirports[0].coordinates.lon]
      : [37.0, 35.5]
  , [validAirports]);

  const allPositions = useMemo(() =>
    validAirports.map(a => [a.coordinates.lat, a.coordinates.lon])
  , [validAirports]);

  // Handle mission selection
  const handleSelectMission = (missionId) => {
    if (selectedMission === missionId) {
      // Second click - navigate to Missions page with mission ID
      if (onNavigateToMissions) {
        onNavigateToMissions(missionId);
      }
    } else {
      // First click - select mission
      setSelectedMission(missionId);
    }
  };

  // Debug logging - fixed dependencies
  console.log('🗺️ MapView rendered with', missions.length, 'missions');

  useEffect(() => {
    console.log('MapView - Missions:', missions);
    console.log('MapView - Valid Airports:', validAirports);
    missions.forEach(mission => {
      const sourceAirport = validAirports.find(a => a.id === mission.source_airport_id);
      const destAirport = validAirports.find(a => a.id === mission.airport_id);
      console.log(`Mission ${mission.id}:`, {
        source_airport_id: mission.source_airport_id,
        airport_id: mission.airport_id,
        sourceFound: !!sourceAirport,
        destFound: !!destAirport,
        sourceAirport,
        destAirport
      });
    });
  }, [missions]); // Only depend on missions, not validAirports

  // Group missions by airport for badge count
  const missionsByAirport = {};
  // Map layout sizing
  const mapHeight = embedded ? 520 : 750;
  missions.forEach(mission => {
    if (!missionsByAirport[mission.airport_id]) {
      missionsByAirport[mission.airport_id] = [];
    }
    missionsByAirport[mission.airport_id].push(mission);
  });

  return (
    <div className={embedded ? 'bg-yt-bg-secondary rounded-lg overflow-hidden border border-yt-border' : 'min-h-screen bg-yt-bg-primary p-4'}>
      <div className={embedded ? '' : 'max-w-[1800px] mx-auto'}>
        {!embedded && (
          <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-yt-accent/20 rounded">
                <MapIcon className="w-6 h-6 text-yt-accent" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-yt-text-primary">{t('mapView.title')}</h1>
                <p className="text-xs text-yt-text-secondary">{t('mapView.subtitle')}</p>
              </div>
            </div>

            {/* Legend compatta */}
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-0.5 border-t-2 border-dashed border-yellow-400"></div>
                <span className="text-yt-text-secondary">{t('mapView.legend.pending')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-0.5 bg-red-400"></div>
                <span className="text-yt-text-secondary">{t('mapView.legend.accepted')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Plane className="w-4 h-4 text-yt-accent" />
                <span className="text-yt-text-secondary">{t('mapView.legend.airport')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Helicopter className="w-4 h-4 text-cyan-400" />
                <span className="text-yt-text-secondary">{t('mapView.legend.heliport')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-green-500" />
                <span className="text-yt-text-secondary">{t('mapView.legend.carrier')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-fuchsia-400 border-2 border-fuchsia-500"></div>
                <span className="text-yt-text-secondary">{t('mapView.legend.base')}</span>
              </div>
            </div>
          </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          {/* Map - più largo */}
          <div className="bg-yt-bg-secondary rounded-lg overflow-hidden border border-yt-border" style={{ height: `${mapHeight}px` }}>
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

              {/* Fit bounds to show all airports */}
              <FitBounds positions={allPositions} />

              {/* Mission routes */}
              {missions.map(mission => {
                const sourceAirport = validAirports.find(a => a.id === mission.source_airport_id);
                const destAirport = validAirports.find(a => a.id === mission.airport_id);

                return (
                  <MissionPolyline
                    key={mission.id}
                    mission={mission}
                    sourceAirport={sourceAirport}
                    destAirport={destAirport}
                    isHighlighted={hoveredMission === mission.id}
                    isSelected={selectedMission === mission.id}
                    onHover={setHoveredMission}
                    onSelect={handleSelectMission}
                  />
                );
              })}

              {/* Airport markers */}
              {validAirports.map(airport => {
                const missionCount = missionsByAirport[airport.id]?.length || 0;

                return (
                  <Marker
                    key={airport.id}
                    position={[airport.coordinates.lat, airport.coordinates.lon]}
                    icon={createAirportIcon(airport.isMainBase, missionCount, airport.isHeliport, airport.isCarrier)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-base">{airport.displayName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {airport.isMainBase && (
                            <span className="text-fuchsia-600 text-xs font-semibold">MAIN BASE</span>
                          )}
                          <span className={`text-xs font-semibold ${airport.isCarrier ? 'text-green-600' : airport.isHeliport ? 'text-cyan-600' : 'text-blue-600'}`}>
                            {airport.isCarrier ? t('mapView.popup.carrier') : airport.isHeliport ? t('mapView.popup.heliport') : t('mapView.popup.airport')}
                          </span>
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          {airport.coordinates.lat.toFixed(6)}°N, {airport.coordinates.lon.toFixed(6)}°E
                        </div>
                        {missionCount > 0 && (
                          <div className="mt-2 text-xs">
                            <span className="px-2 py-1 bg-red-400 text-white rounded">
                              {t('mapView.popup.missions', { count: missionCount })}
                            </span>
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
