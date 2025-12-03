import { useState, useEffect } from 'react';
import { Map, Plane, ArrowRight } from 'lucide-react';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';

/**
 * Get weapon display name
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

/**
 * Convert lat/lon to SVG coordinates
 */
function projectToSVG(lat, lon, bounds, width, height, padding = 60) {
  const x = ((lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * (width - 2 * padding) + padding;
  const y = height - (((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - 2 * padding) + padding);
  return { x, y };
}

/**
 * Calculate map bounds from airport coordinates
 */
function calculateBounds(airports) {
  const lats = airports.map(a => a.coordinates.lat);
  const lons = airports.map(a => a.coordinates.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Add 10% padding
  const latPadding = (maxLat - minLat) * 0.1;
  const lonPadding = (maxLon - minLon) * 0.1;

  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLon: minLon - lonPadding,
    maxLon: maxLon + lonPadding,
  };
}

/**
 * Mission Card Component (sidebar)
 */
function MissionCard({ mission, airport, onHover, isHighlighted }) {
  const sourceName = mission.source_airport_id ? getAirportName(mission.source_airport_id) : 'Main Base';
  const distance = mission.distance_nm ? `${mission.distance_nm}nm` : '-';
  const isPending = mission.status === 'pending';

  return (
    <div
      className={`bg-slate-800 p-3 rounded border-2 transition-all cursor-pointer ${
        isHighlighted
          ? 'border-yellow-400 shadow-lg shadow-yellow-400/20'
          : isPending ? 'border-blue-500/30' : 'border-red-500/30'
      }`}
      onMouseEnter={() => onHover(mission.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1">
          <div className="font-mono text-xs text-white mb-1">{getWeaponDisplayName(mission.weapon_id)}</div>
          <div className="text-xs text-gray-400">
            Qty: <span className="font-bold text-white">{mission.quantity_needed}</span>
          </div>
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
    </div>
  );
}

/**
 * Map View Component
 */
export default function MapView({ missions, airportsData }) {
  const [hoveredMission, setHoveredMission] = useState(null);
  const [svgSize] = useState({ width: 800, height: 600 });

  // Calculate bounds for the map
  const bounds = calculateBounds(airports.filter(a => a.coordinates));

  // Project airport coordinates to SVG
  const airportPositions = airports
    .filter(a => a.coordinates)
    .map(airport => ({
      ...airport,
      position: projectToSVG(
        airport.coordinates.lat,
        airport.coordinates.lon,
        bounds,
        svgSize.width,
        svgSize.height
      ),
    }));

  // Group missions by airport
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
              <Map className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Mappa delle Rotte</h1>
              <p className="text-gray-400">Visualizzazione delle missioni di rifornimento</p>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 border-t-2 border-dashed border-blue-400"></div>
              <span className="text-gray-300">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-12 h-0.5 bg-red-400"></div>
              <span className="text-gray-300">Accepted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-400"></div>
              <span className="text-gray-300">Aeroporto</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-yellow-400 bg-yellow-400/20"></div>
              <span className="text-gray-300">Main Base</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 bg-slate-800 rounded-lg p-6 border border-gray-700">
            <svg
              width={svgSize.width}
              height={svgSize.height}
              className="w-full h-auto"
              viewBox={`0 0 ${svgSize.width} ${svgSize.height}`}
            >
              {/* Background */}
              <rect width={svgSize.width} height={svgSize.height} fill="#0f172a" rx="8" />

              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width={svgSize.width} height={svgSize.height} fill="url(#grid)" />

              {/* Mission routes */}
              {missions.map(mission => {
                const sourceAirport = airportPositions.find(a => a.id === mission.source_airport_id);
                const destAirport = airportPositions.find(a => a.id === mission.airport_id);

                if (!sourceAirport || !destAirport) return null;

                const isPending = mission.status === 'pending';
                const isHighlighted = hoveredMission === mission.id;
                const opacity = isHighlighted ? 1 : 0.3;
                const strokeWidth = isHighlighted ? 3 : 2;

                return (
                  <g key={mission.id}>
                    {/* Route line */}
                    <line
                      x1={sourceAirport.position.x}
                      y1={sourceAirport.position.y}
                      x2={destAirport.position.x}
                      y2={destAirport.position.y}
                      stroke={isPending ? '#60a5fa' : '#f87171'}
                      strokeWidth={strokeWidth}
                      strokeDasharray={isPending ? '8,4' : '0'}
                      opacity={opacity}
                      className="transition-all cursor-pointer"
                      onMouseEnter={() => setHoveredMission(mission.id)}
                      onMouseLeave={() => setHoveredMission(null)}
                    />

                    {/* Arrow head */}
                    <circle
                      cx={destAirport.position.x}
                      cy={destAirport.position.y}
                      r={isHighlighted ? 6 : 4}
                      fill={isPending ? '#60a5fa' : '#f87171'}
                      opacity={opacity}
                      className="transition-all"
                    />
                  </g>
                );
              })}

              {/* Airport nodes */}
              {airportPositions.map(airport => (
                <g key={airport.id}>
                  {/* Outer ring for main base */}
                  {airport.isMainBase && (
                    <circle
                      cx={airport.position.x}
                      cy={airport.position.y}
                      r={16}
                      fill="none"
                      stroke="#facc15"
                      strokeWidth="2"
                      opacity="0.6"
                    />
                  )}

                  {/* Airport node */}
                  <circle
                    cx={airport.position.x}
                    cy={airport.position.y}
                    r={12}
                    fill={airport.isMainBase ? '#facc15' : '#3b82f6'}
                    opacity={airport.isMainBase ? 0.4 : 0.8}
                    className="transition-all"
                  />

                  {/* Airport icon */}
                  <text
                    x={airport.position.x}
                    y={airport.position.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                  >
                    ✈
                  </text>

                  {/* Airport label */}
                  <text
                    x={airport.position.x}
                    y={airport.position.y + 28}
                    textAnchor="middle"
                    fill="#e5e7eb"
                    fontSize="12"
                    fontWeight="600"
                  >
                    {airport.displayName}
                  </text>

                  {/* Mission count badge */}
                  {missionsByAirport[airport.id] && missionsByAirport[airport.id].length > 0 && (
                    <g>
                      <circle
                        cx={airport.position.x + 15}
                        cy={airport.position.y - 10}
                        r={10}
                        fill="#dc2626"
                        stroke="#1e293b"
                        strokeWidth="2"
                      />
                      <text
                        x={airport.position.x + 15}
                        y={airport.position.y - 10}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="white"
                        fontSize="10"
                        fontWeight="bold"
                      >
                        {missionsByAirport[airport.id].length}
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </svg>
          </div>

          {/* Mission List Sidebar */}
          <div className="bg-slate-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plane className="w-5 h-5 text-blue-400" />
              Missioni Attive ({missions.length})
            </h3>

            <div className="space-y-2 max-h-[600px] overflow-y-auto">
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
                      isHighlighted={hoveredMission === mission.id}
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
