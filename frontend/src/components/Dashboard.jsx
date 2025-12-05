import { useState } from 'react';
import { Package, AlertTriangle, Plane, Activity, FolderOpen } from 'lucide-react';
import AirportCard from './AirportCard';
import { selectPDFDirectory, isFileSystemAccessSupported } from '../utils/fileSystemAccess';

/**
 * Stats Card Component - YouTube Style
 */
function StatsCard({ title, value, icon: Icon, color, bgColor }) {
  return (
    <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border hover:border-yt-border/50 transition-all">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-yt-text-secondary uppercase tracking-wide mb-0.5">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
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

  // Handle PDF directory selection
  const handleSelectPDFDirectory = async () => {
    const success = await selectPDFDirectory();
    if (success) {
      alert(
        'Directory PDF configurata con successo!\n\n' +
        'Tutti i PDF verranno ora salvati nella directory selezionata.\n' +
        'La directory verrà ricordata per le prossime sessioni.'
      );
    }
  };

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
    <div className="space-y-4">
      {/* Stats Row - Compatta e moderna */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title="Aeroporti"
          value={stats.totalAirports || 0}
          icon={Plane}
          color="text-yt-accent"
          bgColor="bg-yt-accent/20"
        />
        <StatsCard
          title="Critici"
          value={stats.criticalAirports || 0}
          icon={AlertTriangle}
          color="text-red-400"
          bgColor="bg-red-500/20"
        />
        <StatsCard
          title="Missioni"
          value={stats.activeMissions || 0}
          icon={Package}
          color="text-yellow-400"
          bgColor="bg-yellow-500/20"
        />
        <StatsCard
          title="Accettate"
          value={stats.acceptedMissions || 0}
          icon={Activity}
          color="text-green-400"
          bgColor="bg-green-500/20"
        />
      </div>

      {/* Controls - Compatte stile YouTube */}
      <div className="bg-yt-bg-secondary rounded-lg p-3 border border-yt-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder="🔍 Cerca aeroporti..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 bg-yt-bg-primary border border-yt-border rounded text-yt-text-primary placeholder-yt-text-secondary text-sm focus:outline-none focus:border-yt-accent transition-all"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                sortBy === 'name'
                  ? 'bg-yt-accent text-white'
                  : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border hover:text-yt-text-primary'
              }`}
            >
              📝 Nome
            </button>
            <button
              onClick={() => setSortBy('critical')}
              className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                sortBy === 'critical'
                  ? 'bg-yt-accent text-white'
                  : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border hover:text-yt-text-primary'
              }`}
            >
              ⚠️ Criticità
            </button>
            {isFileSystemAccessSupported() && (
              <button
                onClick={handleSelectPDFDirectory}
                className="px-3 py-2 rounded text-sm font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1.5 transition-all"
                title="Seleziona la directory dove salvare i PDF delle chart"
              >
                <FolderOpen className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Airports Grid - compatta */}
      <div className="grid grid-cols-1 gap-3">
        {filteredAirports.length === 0 ? (
          <div className="bg-yt-bg-secondary rounded-lg p-12 text-center border border-yt-border">
            <Plane className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
            <p className="text-lg text-yt-text-primary font-medium">Nessun aeroporto trovato</p>
            <p className="text-sm text-yt-text-secondary mt-1">Prova a modificare i filtri di ricerca</p>
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
