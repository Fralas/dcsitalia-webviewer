import { useState, useEffect } from 'react';
import { Plane, Package, Activity, AlertCircle, Map, Shield } from 'lucide-react';
import Dashboard from './components/Dashboard';
import MissionDispatch from './components/MissionDispatch';
import MapView from './components/MapView';
import AdminPanel from './components/AdminPanel';
import * as api from './services/api';
import socketService from './services/socket';

function App() {
  const [currentView, setCurrentView] = useState('dashboard'); // dashboard, missions
  const [airports, setAirports] = useState({});
  const [missions, setMissions] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [highlightedMissionId, setHighlightedMissionId] = useState(null);

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
      <div className="min-h-screen bg-dcs-darker flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-16 h-16 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-xl text-gray-400">Loading DCS Warehouse Viewer...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dcs-darker flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <p className="text-xl text-red-400 mb-2">Error Loading Data</p>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dcs-darker">
      {/* Header */}
      <header className="bg-slate-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Plane className="w-8 h-8 text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">DCS Warehouse Viewer</h1>
                <p className="text-sm text-gray-400">Logistics Management System</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : connectionStatus === 'disconnected' ? 'bg-red-400' : 'bg-yellow-400'}`} />
                <span className="text-sm text-gray-400 capitalize">{connectionStatus}</span>
              </div>

              {/* Navigation */}
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`px-4 py-2 rounded font-bold flex items-center gap-2 ${currentView === 'dashboard' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}`}
              >
                <Plane className="w-4 h-4" />
                Dashboard
              </button>
              <button
                onClick={() => setCurrentView('missions')}
                className={`px-4 py-2 rounded font-bold flex items-center gap-2 ${currentView === 'missions' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}`}
              >
                <Package className="w-4 h-4" />
                Missions
                {stats.activeMissions > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {stats.activeMissions}
                  </span>
                )}
              </button>
              <button
                onClick={() => setCurrentView('map')}
                className={`px-4 py-2 rounded font-bold flex items-center gap-2 ${currentView === 'map' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}`}
              >
                <Map className="w-4 h-4" />
                Mappa
              </button>
              <button
                onClick={() => setCurrentView('admin')}
                className={`px-4 py-2 rounded font-bold flex items-center gap-2 ${currentView === 'admin' ? 'bg-red-600 text-white' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'}`}
              >
                <Shield className="w-4 h-4" />
                Admin
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className={currentView === 'map' || currentView === 'admin' ? '' : 'container mx-auto px-4 py-6'}>
        {currentView === 'dashboard' && (
          <Dashboard
            airports={airports}
            missions={missions}
            stats={stats}
          />
        )}
        {currentView === 'missions' && (
          <MissionDispatch
            missions={missions}
            airports={Object.values(airports)}
            onUpdate={handleMissionUpdate}
            highlightedMissionId={highlightedMissionId}
          />
        )}
        {currentView === 'map' && (
          <MapView
            missions={missions}
            airportsData={Object.values(airports)}
            onNavigateToMissions={(missionId) => {
              setHighlightedMissionId(missionId);
              setCurrentView('missions');
              // Reset highlighted mission after navigation
              setTimeout(() => setHighlightedMissionId(null), 3000);
            }}
          />
        )}
        {currentView === 'admin' && (
          <AdminPanel />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-gray-800 mt-12">
        <div className="container mx-auto px-4 py-4 text-center text-sm text-gray-400">
          <p>DCS Italia Warehouse Viewer v1.0 | Real-time logistics management for DCS World</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
