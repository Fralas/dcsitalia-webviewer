import { useState, useEffect } from 'react';
import { Activity, AlertCircle, BookOpen, CalendarSync, TowerControl, Users } from 'lucide-react';
import FrontlineMap from './components/FrontlineMap';
import UserMenu from './components/UserMenu';
import UserProfile from './components/UserProfile';
import ChangelogPage from './components/ChangelogPage';
import WikiPage from './components/WikiPage';
import LidcPage from './components/LidcPage';
import AtcStripPage from './components/atc/AtcStripPage';
import * as api from './services/api';
import socketService from './services/socket';
import { t } from './utils/locale';
import bannerImg from '../img/DCS_ITALIA_ICON.png';
import gbFlagImg from '../img/flags/gb.svg';
import itFlagImg from '../img/flags/it.svg';
import { useUser } from './contexts/UserContext';
import { canAccessAtc, canAccessLidc } from './config/featureAccess';

const VIEW_TO_PATH = Object.freeze({
  frontline: '/',
  profile: '/profile',
  changelogs: '/changelogs',
  wiki: '/wiki',
  lidc: '/lidc',
  atc: '/atc',
});
const DEFAULT_WIKI_LANGUAGE = 'en';

function normalizeView(view) {
  return Object.prototype.hasOwnProperty.call(VIEW_TO_PATH, view) ? view : 'frontline';
}

function normalizePath(pathname = '/') {
  const cleaned = String(pathname || '/').replace(/\/+$/, '');
  return cleaned || '/';
}

function viewFromLocation() {
  if (typeof window === 'undefined') {
    return 'frontline';
  }

  const currentPath = normalizePath(window.location.pathname);

  if (currentPath === '/changelogs') {
    return 'changelogs';
  }
  if (currentPath === '/wiki') {
    return 'wiki';
  }
  if (currentPath === '/profile') {
    return 'profile';
  }
  if (currentPath === '/lidc') {
    return 'lidc';
  }
  if (currentPath === '/atc') {
    return 'atc';
  }

  const params = new URLSearchParams(window.location.search);
  const viewFromQuery = params.get('view');
  if (viewFromQuery) {
    return normalizeView(viewFromQuery);
  }

  const hashView = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (hashView) {
    return normalizeView(hashView);
  }

  return 'frontline';
}

function syncUrlWithView(view, { replace = false } = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const targetView = normalizeView(view);
  const targetPath = VIEW_TO_PATH[targetView];
  const url = new URL(window.location.href);
  url.pathname = targetPath;
  url.searchParams.delete('view');

  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

  if (nextUrl === currentUrl) {
    return;
  }

  if (replace) {
    window.history.replaceState({}, '', nextUrl);
    return;
  }

  window.history.pushState({}, '', nextUrl);
}

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
  const [currentView, setCurrentView] = useState(() => viewFromLocation());
  const [appLanguage, setAppLanguage] = useState(DEFAULT_WIKI_LANGUAGE);
  const [airports, setAirports] = useState({});
  const [airportCatalog, setAirportCatalog] = useState([]);
  const [airbaseStatus, setAirbaseStatus] = useState({});
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
  const showLidc = canAccessLidc(user?.id);
  const showAtc = canAccessAtc(user?.id);

  const goToView = (view) => {
    const normalized = normalizeView(view);
    setCurrentView(normalized);
    syncUrlWithView(normalized);
  };
  const isItalian = appLanguage === 'it';

  const toggleLanguage = () => {
    setAppLanguage((prev) => (prev === 'it' ? 'en' : 'it'));
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    // Canonicalize URL (supports old ?view=changelogs links and unknown paths).
    syncUrlWithView(currentView, { replace: true });
  }, [currentView]);

  useEffect(() => {
    if ((currentView === 'lidc' && !showLidc) || (currentView === 'atc' && !showAtc)) {
      setCurrentView('frontline');
      syncUrlWithView('frontline', { replace: true });
    }
  }, [currentView, showLidc, showAtc]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentView(viewFromLocation());
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    socketService.connect();

    const unsubscribeInitial = socketService.on('data:initial', (data) => {
      setAirports(data);
    });

    const unsubscribeUpdated = socketService.on('data:updated', (data) => {
      setAirports(data);
    });

    const unsubscribeAirbaseStatus = socketService.on('airbase:status', (data) => {
      setAirbaseStatus(data || {});
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
      unsubscribeAirbaseStatus();
      unsubscribeFrontline();
      socketService.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [airportsData, zonesData, airbaseStatusData, airportCatalogData] = await Promise.all([
        api.getAirports(),
        api.getFrontlineZones(),
        api.getAirbaseStatus().catch(() => ({})),
        api.getAirportCatalog().catch(() => []),
      ]);

      setAirports(airportsData);
      setAirbaseStatus(airbaseStatusData || {});
      setAirportCatalog(Array.isArray(airportCatalogData) ? airportCatalogData : []);

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
    <div className="app-shell h-screen bg-yt-bg-primary flex flex-col overflow-hidden">
      <header className="sticky top-0 z-50 border-b border-yt-border/80 bg-[#0b1119f2] shadow-[0_8px_28px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="mx-auto w-full px-4 py-1.5">
          <div className="flex h-10 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => goToView('frontline')}
                className="flex items-center gap-2 text-left transition-opacity hover:opacity-90"
                title="Frontline"
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
              <button
                type="button"
                onClick={toggleLanguage}
                className="inline-flex h-[34px] w-[84px] items-center justify-center bg-transparent p-0 transition-opacity hover:opacity-95"
                role="switch"
                aria-checked={isItalian}
                aria-label={isItalian ? 'Switch language to English' : 'Switch language to Italian'}
                title={isItalian ? 'Switch language to English' : 'Switch language to Italian'}
              >
                <span className="relative flex h-7 w-[84px] items-center rounded-md border border-yt-border/80 bg-[#101a29]">
                  <span
                    className={`pointer-events-none absolute top-0.5 h-6 w-[38px] rounded-sm border border-yt-accent/50 bg-yt-accent/20 shadow-[0_0_10px_rgba(78,197,255,0.2)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isItalian ? 'translate-x-[43px]' : 'translate-x-0.5'
                    }`}
                  />
                  <span className="relative z-10 inline-flex w-1/2 items-center justify-center" aria-hidden="true">
                    <img src={gbFlagImg} alt="" className="h-2.5 w-4 rounded-[2px] object-cover" />
                  </span>
                  <span className="relative z-10 inline-flex w-1/2 items-center justify-center" aria-hidden="true">
                    <img src={itFlagImg} alt="" className="h-2.5 w-4 rounded-[2px] object-cover" />
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => goToView('changelogs')}
                className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                  currentView === 'changelogs'
                    ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                    : 'border-yt-border/80 bg-[#151b25] text-yt-text-primary hover:border-yt-accent hover:text-white'
                }`}
                title="Apri changelog"
                aria-label="Apri changelog"
              >
                <CalendarSync className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => goToView('wiki')}
                className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                  currentView === 'wiki'
                    ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                    : 'border-yt-border/80 bg-[#151b25] text-yt-text-primary hover:border-yt-accent hover:text-white'
                }`}
                title="Apri wiki"
                aria-label="Apri wiki"
              >
                <BookOpen className="w-4 h-4" />
              </button>
              {showLidc && (
                <button
                  type="button"
                  onClick={() => goToView('lidc')}
                  className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                    currentView === 'lidc'
                      ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                      : 'border-yt-border/80 bg-[#151b25] text-yt-text-primary hover:border-yt-accent hover:text-white'
                  }`}
                  title="Apri LIDC"
                  aria-label="Apri LIDC"
                >
                  <Users className="w-4 h-4" />
                </button>
              )}
              {showAtc && (
                <button
                  type="button"
                  onClick={() => goToView('atc')}
                  className={`inline-flex items-center gap-2 rounded border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors ${
                    currentView === 'atc'
                      ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                      : 'border-yt-border/80 bg-[#151b25] text-yt-text-primary hover:border-yt-accent hover:text-white'
                  }`}
                  title="ATC Strips"
                  aria-label="ATC Strips"
                >
                  <TowerControl className="w-4 h-4" />
                </button>
              )}
              <UserMenu onOpenProfile={() => goToView('profile')} />
            </div>
          </div>
        </div>
      </header>

      <main className={`flex-1 ${(currentView === 'frontline' || currentView === 'lidc' || currentView === 'atc') ? 'overflow-hidden' : 'container mx-auto px-4 py-4 overflow-y-auto'}`}>
        {currentView === 'frontline' && (
          <FrontlineMap
            airportsData={Object.values(airports)}
            airportCatalog={airportCatalog}
            airbaseStatus={airbaseStatus}
          />
        )}
        {currentView === 'profile' && (
          <UserProfile />
        )}
        {currentView === 'changelogs' && (
          <ChangelogPage language={appLanguage} />
        )}
        {currentView === 'wiki' && (
          <WikiPage language={appLanguage} />
        )}
        {currentView === 'lidc' && showLidc && (
          <LidcPage />
        )}
        {currentView === 'atc' && showAtc && (
          <AtcStripPage />
        )}
      </main>

      {currentView !== 'frontline' && currentView !== 'lidc' && currentView !== 'atc' && (
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
