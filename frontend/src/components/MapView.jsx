import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Plane, Helicopter, ArrowRight, Weight } from 'lucide-react';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';
import { formatWeight } from '../utils/weightFormatter';

/**
 * Get weapon display name
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
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
const createAirportIcon = (isMainBase, missionCount, isHeliport) => {
  const color = isMainBase ? '#facc15' : '#3b82f6';
  const size = isMainBase ? 16 : 12;
  const icon = isHeliport ? '🚁' : '✈️';

  return L.divIcon({
    className: 'custom-airport-marker',
    html: `
      <div style="position: relative;">
        <div style="
          width: ${size * 2}px;
          height: ${size * 2}px;
          background: ${color};
          border: 3px solid ${isMainBase ? '#fbbf24' : '#2563eb'};
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">
          ${icon}
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
 * Mission Card Component (sidebar)
 */
function MissionCard({ mission, airport, onHover, onSelect, isHighlighted, isSelected }) {
  const sourceName = mission.source_airport_id ? getAirportName(mission.source_airport_id) : 'Main Base';
  const distance = mission.distance_nm ? `${mission.distance_nm}nm` : '-';
  const isPending = mission.status === 'pending';

  return (
    <div
      className={`bg-slate-800 p-3 rounded border-2 transition-all cursor-pointer ${
        isSelected
          ? 'border-yellow-400 shadow-lg shadow-yellow-400/30 scale-105'
          : isHighlighted
          ? 'border-yellow-400 shadow-lg shadow-yellow-400/20'
          : isPending ? 'border-blue-500/30' : 'border-red-500/30'
      }`}
      onMouseEnter={() => onHover(mission.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(mission.id)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="font-mono text-xs text-white mb-1">{getWeaponDisplayName(mission.weapon_id)}</div>
          <div className="text-xs text-gray-400">
            Qty: <span className="font-bold text-white">{mission.quantity_needed}</span>
          </div>
          {mission.total_weight_lbs && mission.total_weight_lbs > 0 && (
            <div className="flex items-center gap-1 text-xs text-cyan-400 mt-1">
              <Weight className="w-3 h-3" />
              <span className="font-mono">{formatWeight(mission.total_weight_lbs)}</span>
            </div>
          )}
        </div>
        <div>
          <span className={`px-2 py-1 rounded text-xs ${
            isPending ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'
          }`}>
            {isPending ? 'PENDING' : 'ACCEPTED'}
          </span>
        </div>
      </div>

      {/* Route */}
      <div className="flex items-center gap-1 text-xs bg-slate-900/50 px-2 py-1 rounded">
        <span className="text-blue-400">{sourceName}</span>
        <ArrowRight className="w-3 h-3 text-gray-500" />
        <span className="text-green-400">{airport?.displayName}</span>
        <span className="text-gray-500">•</span>
        <span className="text-cyan-400 font-mono">{distance}</span>
      </div>

      {isSelected && (
        <div className="mt-2 pt-2 border-t border-yellow-400/30 text-xs text-yellow-400 text-center">
          👆 Clicca di nuovo per andare alla pagina Missions
        </div>
      )}
    </div>
  );
}

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
        color: isSelected ? '#facc15' : isPending ? '#60a5fa' : '#f87171',
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
          <div className="font-bold">{getWeaponDisplayName(mission.weapon_id)}</div>
          <div className="text-gray-600">
            {sourceAirport.displayName} → {destAirport.displayName}
          </div>
          <div className="text-gray-600">
            {mission.distance_nm ? `${mission.distance_nm}nm` : '-'}
          </div>
          <div className="mt-1">
            <span className={`px-2 py-1 rounded text-xs ${
              isPending ? 'bg-blue-500/20 text-blue-600' : 'bg-red-500/20 text-red-600'
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
export default function MapView({ missions, airportsData, onNavigateToMissions }) {
  const [hoveredMission, setHoveredMission] = useState(null);
  const [selectedMission, setSelectedMission] = useState(null);

  // Memoize airports calculations to prevent re-renders
  const validAirports = useMemo(() => airports.filter(a => a.coordinates), []);

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
  missions.forEach(mission => {
    if (!missionsByAirport[mission.airport_id]) {
      missionsByAirport[mission.airport_id] = [];
    }
    missionsByAirport[mission.airport_id].push(mission);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <MapIcon className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mappa delle Rotte</h1>
              <p className="text-gray-400">Visualizzazione geografica delle missioni di rifornimento</p>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 border-t-2 border-dashed border-blue-400"></div>
              <span className="text-gray-300">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 bg-red-400"></div>
              <span className="text-gray-300">Accepted</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">✈️</span>
              <span className="text-gray-300">Aeroporto</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🚁</span>
              <span className="text-gray-300">Eliporto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-400 border-2 border-yellow-500"></div>
              <span className="text-gray-300">Main Base</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg overflow-hidden border border-gray-700" style={{ height: '700px' }}>
            <MapContainer
              center={center}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              {/* OpenStreetMap tiles */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
                    icon={createAirportIcon(airport.isMainBase, missionCount, airport.isHeliport)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <div className="font-bold text-base">{airport.displayName}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {airport.isMainBase && (
                            <span className="text-yellow-600 text-xs font-semibold">MAIN BASE</span>
                          )}
                          <span className="text-blue-600 text-xs font-semibold">
                            {airport.isHeliport ? '🚁 ELIPORTO' : '✈️ AEROPORTO'}
                          </span>
                        </div>
                        <div className="text-gray-600 text-xs mt-1">
                          {airport.coordinates.lat.toFixed(6)}°N, {airport.coordinates.lon.toFixed(6)}°E
                        </div>
                        {missionCount > 0 && (
                          <div className="mt-2 text-xs">
                            <span className="px-2 py-1 bg-red-500 text-white rounded">
                              {missionCount} missioni attive
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

          {/* Mission List Sidebar */}
          <div className="bg-slate-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-400" />
              Missioni Attive ({missions.length})
            </h3>

            <div className="space-y-2 max-h-[640px] overflow-y-auto">
              {missions.length === 0 ? (
                <div className="text-center py-8">
                  <Plane className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Nessuna missione attiva</p>
                </div>
              ) : (
                missions.map(mission => {
                  const airport = airportsData?.find(a => a.id === mission.airport_id);
                  return (
                    <MissionCard
                      key={mission.id}
                      mission={mission}
                      airport={airport}
                      onHover={setHoveredMission}
                      onSelect={handleSelectMission}
                      isHighlighted={hoveredMission === mission.id}
                      isSelected={selectedMission === mission.id}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
