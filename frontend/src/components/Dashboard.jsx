import { useState } from 'react';
import { Package, AlertTriangle, Plane, Activity } from 'lucide-react';
import AirportCard from './AirportCard';

/**
 * Stats Card Component
 */
function StatsCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className={`text-3xl font-bold ${color}`}>{value}</p>
        </div>
        <div className={`p-3 rounded-lg ${color.replace('text-', 'bg-')}/20`}>
          <Icon className={`w-8 h-8 ${color}`} />
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard Component
 */
export default function Dashboard({ airports, missions, stats }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, critical

  // Filter and sort airports
  let filteredAirports = Object.values(airports).filter(airport => {
    if (!airport || !airport.name) return false;
    return airport.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (sortBy === 'critical') {
    filteredAirports = filteredAirports.sort((a, b) => {
      const getCriticalCount = (airport) => {
        if (!airport.data || !airport.data.weapons) return 0;
        return airport.data.weapons.filter(w => w.quantity <= 5).length;
      };
      return getCriticalCount(b) - getCriticalCount(a);
    });
  } else {
    filteredAirports = filteredAirports.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Airports"
          value={stats.totalAirports || 0}
          icon={Plane}
          color="text-blue-400"
        />
        <StatsCard
          title="Critical Airports"
          value={stats.criticalAirports || 0}
          icon={AlertTriangle}
          color="text-red-400"
        />
        <StatsCard
          title="Active Missions"
          value={stats.activeMissions || 0}
          icon={Package}
          color="text-yellow-400"
        />
        <StatsCard
          title="Accepted Missions"
          value={stats.acceptedMissions || 0}
          icon={Activity}
          color="text-green-400"
        />
      </div>

      {/* Controls */}
      <div className="bg-slate-800 rounded-lg p-4 border border-gray-700">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search airports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 bg-slate-900 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('name')}
              className={`px-4 py-2 rounded font-bold ${sortBy === 'name' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
            >
              Sort by Name
            </button>
            <button
              onClick={() => setSortBy('critical')}
              className={`px-4 py-2 rounded font-bold ${sortBy === 'critical' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
            >
              Sort by Critical
            </button>
          </div>
        </div>
      </div>

      {/* Airports Grid */}
      <div className="grid grid-cols-1 gap-4">
        {filteredAirports.length === 0 ? (
          <div className="bg-slate-800 rounded-lg p-12 text-center border border-gray-700">
            <Plane className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-xl text-gray-400">No airports found</p>
          </div>
        ) : (
          filteredAirports.map(airport => (
            <AirportCard
              key={airport.id}
              airport={airport}
              missions={missions}
            />
          ))
        )}
      </div>
    </div>
  );
}
