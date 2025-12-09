import { useState, useEffect } from 'react';
import { Plane, Package, Activity, AlertCircle, Map, Shield } from 'lucide-react';
import Dashboard from './components/Dashboard';
import MapView from './components/MapView';
import AdminPanel from './components/AdminPanel';
import * as api from './services/api';
import socketService from './services/socket';
import { t } from './utils/locale';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, missions
  const [airports, setAirports] = useState({});
  const [missions, setMissions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [highlightedMissionId, setHighlightedMissionId] = useState(null);
  const [selectedAirportId, setSelectedAirportId] = useState(null);
  const [selectedAirportToken, setSelectedAirportToken] = useState(0);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  // Setup WebSocket
  useEffect(() => {
    socketService.connect();

    const unsubscribeConnect = socketService.on('connect', () => {
      setConnectionStatus('connected');
      console.log('✅ WebSocket connected');
    });

    const unsubscribeDisconnect = socketService.on('disconnect', () => {
      setConnectionStatus('disconnected');
      console.log('❌ WebSocket disconnected');
    });

    const unsubscribeInitial = socketService.on('data:initial', (data) => {
      console.log('📊 Received initial data');
      setAirports(data);
    });

    const unsubscribeUpdated = socketService.on('data:updated', (data) => {
      console.log('🔄 Data updated');
      setAirports(data);
      loadStats(); // Reload stats
    });

    const unsubscribeMissions = socketService.on('missions:updated', (data) => {
      console.log('🚨 Missions updated');
      setMissions(data.missions);
      loadStats(); // Reload stats
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      unsubscribeInitial();
      unsubscribeUpdated();
      unsubscribeMissions();
      socketService.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [airportsData, missionsData, statsData] = await Promise.all([
        api.getAirports(),
        api.getMissions(),
        api.getStats(),
      ]);
      setAirports(airportsData);
      setMissions(missionsData);
      setStats(statsData);
    } catch (err) {
      setError(err.message);
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await api.getStats();
      setStats(statsData);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleMissionUpdate = async () => {
    // Reload missions after an update
    try {
      const missionsData = await api.getMissions();
      setMissions(missionsData);
      await loadStats();
    } catch (err) {
      console.error('Failed to reload missions:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-yt-bg-primary flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 text-yt-accent animate-spin mx-auto mb-4" />
          <p className="text-xl text-yt-text-secondary">{t('general.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-yt-bg-primary flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-xl text-red-400 mb-2">{t('general.errorTitle')}</p>
          <p className="text-yt-text-secondary mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-yt-accent hover:bg-yt-accent/80 text-white rounded font-bold transition-all"
          >
            {t('general.retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-yt-bg-primary">
      {/* Header - Compatto stile YouTube */}
      <header className="bg-yt-bg-secondary border-b border-yt-border sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center justify-between">
            {/* Logo compatto */}
            <div className="flex items-center gap-2">
              <img
                src="/img/DCS_ITALIA_ICON.png"
                alt="DCS Italia"
                className="h-10 w-auto object-contain"
              />
              <div>
                <h1 className="text-lg font-bold text-yt-text-primary">{t('general.appTitle')}</h1>
                <p className="text-xs text-yt-text-secondary">{t('general.appSubtitle')}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection Status - compatto */}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-yt-bg-tertiary rounded">
                <div className={`w-1.5 h-1.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : connectionStatus === 'disconnected' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                <span className="text-xs text-yt-text-secondary">
                  {connectionStatus === 'connected'
                    ? t('general.connection.online')
                    : connectionStatus === 'disconnected'
                      ? t('general.connection.offline')
                      : t('general.connection.connecting')}
                </span>
              </div>

              {/* Navigation - compatta e moderna */}
              <nav className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentView('dashboard')}
                  className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-all ${
                    currentView === 'dashboard'
                      ? 'bg-yt-bg-tertiary text-yt-text-primary'
                      : 'text-yt-text-secondary hover:bg-yt-bg-tertiary/50 hover:text-yt-text-primary'
                  }`}
                >
                  <Plane className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('general.navigation.dashboard')}</span>
                </button>
                <button
                  onClick={() => setCurrentView('map')}
                  className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-all ${
                    currentView === 'map'
                      ? 'bg-yt-bg-tertiary text-yt-text-primary'
                      : 'text-yt-text-secondary hover:bg-yt-bg-tertiary/50 hover:text-yt-text-primary'
                  }`}
                >
                  <Map className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('general.navigation.map')}</span>
                </button>
                <button
                  onClick={() => setCurrentView('admin')}
                  className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1.5 transition-all ${
                    currentView === 'admin'
                      ? 'bg-red-500/20 text-red-400'
                      : 'text-yt-text-secondary hover:bg-red-500/10 hover:text-red-400'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span className="hidden sm:inline">{t('general.navigation.admin')}</span>
                </button>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - padding ridotto */}
      <main className={currentView === 'map' || currentView === 'admin' ? '' : 'container mx-auto px-4 py-4'}>
        {currentView === 'dashboard' && (
          <Dashboard
            airports={airports}
            missions={missions}
            stats={stats}
            onMissionsUpdate={handleMissionUpdate}
            selectedAirportId={selectedAirportId}
            selectedAirportToken={selectedAirportToken}
          />
        )}
        {currentView === 'map' && (
          <MapView
            missions={missions}
            airportsData={Object.values(airports)}
            onNavigateToMissions={(missionId) => {
              const mission = missions.find((m) => m.id === missionId);
              setHighlightedMissionId(missionId);
              setSelectedAirportId(mission?.airport_id || null);
              setSelectedAirportToken(Date.now());
              setCurrentView('dashboard');
            }}
          />
        )}
        {currentView === 'admin' && (
          <AdminPanel />
        )}
      </main>

      {/* Footer - compatto */}
      <footer className="bg-yt-bg-secondary border-t border-yt-border mt-8">
        <div className="container mx-auto px-4 py-3 text-center text-xs text-yt-text-secondary">
          <p>DCS Italia Warehouse Viewer v1.0 • Real-time logistics management</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
