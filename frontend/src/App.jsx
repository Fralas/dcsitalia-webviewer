import { useState, useEffect, useMemo } from 'react';
import { Activity, AlertCircle } from 'lucide-react';
import FrontlineMap from './components/FrontlineMap';
import UserMenu from './components/UserMenu';
import UserProfile from './components/UserProfile';
import * as api from './services/api';
import socketService from './services/socket';
import { t } from './utils/locale';
import bannerImg from '../img/DCS_ITALIA_ICON.png';
import { useUser } from './contexts/UserContext';

function buildFrontlineSummary(zones = []) {
  const summary = {
    total: 0,
    RED: 0,
    BLUE: 0,
    NEUTRAL: 0,
    UNDER_ATTACK: 0,
  };

  zones.forEach((zone) => {
    summary.total += 1;
    if (summary[zone.status] !== undefined) {
      summary[zone.status] += 1;
    }
  });

  return summary;
}

function App() {
  const [currentView, setCurrentView] = useState('frontline');
  const [airports, setAirports] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [frontlineSummary, setFrontlineSummary] = useState({
    total: 0,
    RED: 0,
    BLUE: 0,
    NEUTRAL: 0,
    UNDER_ATTACK: 0,
  });
  const { user } = useUser();
  const allowedViews = useMemo(() => new Set(['frontline', 'profile']), []);

  const goToView = (view) => {
    setCurrentView(allowedViews.has(view) ? view : 'frontline');
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!allowedViews.has(currentView)) {
      setCurrentView('frontline');
    }
  }, [currentView, allowedViews]);

  useEffect(() => {
    socketService.connect();

    const unsubscribeInitial = socketService.on('data:initial', (data) => {
      setAirports(data);
    });

    const unsubscribeUpdated = socketService.on('data:updated', (data) => {
      setAirports(data);
    });

    const unsubscribeFrontline = socketService.on('frontline:updated', (data) => {
      const zones = data?.zones || [];
      if (Array.isArray(zones)) {
        setFrontlineSummary(buildFrontlineSummary(zones));
      }
    });

    return () => {
      unsubscribeInitial();
      unsubscribeUpdated();
      unsubscribeFrontline();
      socketService.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [airportsData, zonesData] = await Promise.all([
        api.getAirports(),
        api.getFrontlineZones(),
      ]);

      setAirports(airportsData);

      const zones = zonesData?.zones || zonesData;
      if (Array.isArray(zones)) {
        setFrontlineSummary(buildFrontlineSummary(zones));
      }
    } catch (err) {
      setError(err.message);
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
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
    <div className="h-screen bg-yt-bg-primary flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 border-b border-yt-border/80 bg-[#0b1119f2] shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="mx-auto w-full px-4 py-1.5">
          <div className="flex h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => goToView(user ? 'profile' : 'frontline')}
                className="flex items-center gap-2 text-left transition-opacity hover:opacity-90"
                title={user ? 'Apri profilo' : 'Frontline'}
              >
                <img
                  src={bannerImg}
                  alt="DCS Italia"
                  className="h-7 w-7 object-contain"
                />
                <div className="leading-tight">
                  <div className="text-[13px] font-bold uppercase tracking-[0.12em] text-yt-text-primary">Monitor DCS Frontline</div>
                  <div className="text-[10px] uppercase tracking-[0.12em] text-yt-text-secondary">Realtime theater status</div>
                </div>
              </button>

              {currentView === 'frontline' && (
                <div className="hidden lg:flex items-center gap-1.5 rounded-md border border-yt-border/80 bg-[#141b25] px-2 py-1">
                  <span className="inline-flex items-center gap-1 rounded-sm bg-green-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-green-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                    Live
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                    {frontlineSummary.total}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {frontlineSummary.RED}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                    {frontlineSummary.BLUE}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                    {frontlineSummary.NEUTRAL}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-orange-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                    {frontlineSummary.UNDER_ATTACK}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <UserMenu onProfileOpen={() => setCurrentView('profile')} />
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 ${currentView === 'frontline' ? 'overflow-hidden' : 'container mx-auto px-4 py-4 overflow-y-auto'}`}>
        {currentView === 'frontline' && (
          <FrontlineMap airportsData={Object.values(airports)} />
        )}
        {currentView === 'profile' && (
          <UserProfile />
        )}
      </main>

      {currentView !== 'frontline' && (
        <footer className="bg-yt-bg-secondary border-t border-yt-border mt-8">
          <div className="container mx-auto px-4 py-3 text-center text-xs text-yt-text-secondary">
            <p>DCS Italia Warehouse Viewer v1.0 - Real-time logistics management</p>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
