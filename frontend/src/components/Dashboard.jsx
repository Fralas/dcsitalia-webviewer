import { useState } from 'react';
import { Package, AlertTriangle, Plane, Activity, FolderOpen } from 'lucide-react';
import AirportCard from './AirportCard';
import { selectPDFDirectory, isFileSystemAccessSupported } from '../utils/fileSystemAccess';
import { isImportantWeapon } from '../config/weapons';
import { t } from '../utils/locale';

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
export default function Dashboard({ airports, missions, stats, onMissionsUpdate, selectedAirportId, selectedAirportToken }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, critical

  // Handle PDF directory selection
  const handleSelectPDFDirectory = async () => {
    const success = await selectPDFDirectory();
    if (success) {
      alert(`${t('dashboard.pdfTooltip')}\n\n${t('dashboard.emptySubtitle')}`);
    }
  };

  // Filter and sort airports
  let filteredAirports = Object.values(airports).filter(airport => {
    if (!airport || !airport.name) return false;
    return airport.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  if (sortBy === 'critical') {
    filteredAirports = filteredAirports.sort((a, b) => {
      const getPriorityScore = (airport) => {
        if (!airport.data || !airport.data.weapons) return 0;

        const isHeliport = airport.name && airport.name.toLowerCase().includes('farp');
        let score = 0;

        airport.data.weapons.forEach(w => {
          const important = isImportantWeapon(w.item, isHeliport);
          if (!important) return;

          // Calculate priority score (higher = more urgent)
          if (w.quantity <= 5) {
            score += 1000; // CRITICAL
          } else if (w.quantity <= 20) {
            score += 100; // HIGH
          } else if (w.quantity <= 40) {
            score += 10; // MEDIUM
          }
        });

        return score;
      };

      return getPriorityScore(b) - getPriorityScore(a);
    });
  } else {
    filteredAirports = filteredAirports.sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div className="space-y-4">
      {/* Stats Row - Compatta e moderna */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatsCard
          title={t('dashboard.stats.airports')}
          value={stats.totalAirports || 0}
          icon={Plane}
          color="text-yt-accent"
          bgColor="bg-yt-accent/20"
        />
        <StatsCard
          title={t('dashboard.stats.critical')}
          value={stats.criticalAirports || 0}
          icon={AlertTriangle}
          color="text-red-400"
          bgColor="bg-red-400/20"
        />
        <StatsCard
          title={t('dashboard.stats.missions')}
          value={stats.activeMissions || 0}
          icon={Package}
          color="text-yellow-400"
          bgColor="bg-yellow-400/20"
        />
        <StatsCard
          title={t('dashboard.stats.accepted')}
          value={stats.acceptedMissions || 0}
          icon={Activity}
          color="text-green-400"
          bgColor="bg-green-400/20"
        />
      </div>

      {/* Controls - Compatte stile YouTube */}
      <div className="bg-yt-bg-secondary rounded-lg p-3 border border-yt-border">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1">
            <input
              type="text"
              placeholder={t('dashboard.searchPlaceholder')}
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
              {t('dashboard.sortByName')}
            </button>
            <button
              onClick={() => setSortBy('critical')}
              className={`px-3 py-2 rounded text-sm font-medium transition-all ${
                sortBy === 'critical'
                  ? 'bg-yt-accent text-white'
                  : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border hover:text-yt-text-primary'
              }`}
            >
              {t('dashboard.sortByCriticality')}
            </button>
            {isFileSystemAccessSupported() && (
              <button
                onClick={handleSelectPDFDirectory}
                className="px-3 py-2 rounded text-sm font-medium bg-green-400 text-white hover:bg-green-400/80 flex items-center gap-1.5 transition-all"
                title={t('dashboard.pdfTooltip')}
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
            <p className="text-lg text-yt-text-primary font-medium">{t('dashboard.emptyTitle')}</p>
            <p className="text-sm text-yt-text-secondary mt-1">{t('dashboard.emptySubtitle')}</p>
          </div>
        ) : (
          filteredAirports.map(airport => (
            <AirportCard
              key={airport.id}
              airport={airport}
              missions={missions}
              onMissionsUpdate={onMissionsUpdate}
              shouldExpand={airport.id === selectedAirportId}
              expandToken={selectedAirportToken}
            />
          ))
        )}
      </div>
    </div>
  );
}
