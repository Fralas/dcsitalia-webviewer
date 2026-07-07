import { useState, useEffect } from 'react';
import { Activity, AlertCircle, BookOpen, CalendarSync, ChevronDown, TowerControl, Users } from 'lucide-react';
import FrontlineMap from './components/FrontlineMap';
import LandingPage from './components/landing/LandingPage';
import UserMenu from './components/UserMenu';
import UserProfile from './components/UserProfile';
import ChangelogPage from './components/ChangelogPage';
import WikiPage from './components/WikiPage';
import LidcPage from './components/LidcPage';
import AtcStripPage from './components/atc/AtcStripPage';
import * as api from './services/api';
import socketService from './services/socket';
import { t, getActiveLocale, setActiveLocale } from './utils/locale';
import bannerImg from '../img/DCS_ITALIA_ICON.png';
import gbFlagImg from '../img/flags/gb.svg';
import itFlagImg from '../img/flags/it.svg';
import { useUser } from './contexts/UserContext';
import { canAccessAtc, canAccessLidc } from './config/featureAccess';
import './AppHeader.css';

const VIEW_TO_PATH = Object.freeze({
  landing: '/',
  frontline: '/map',
  profile: '/profile',
  changelogs: '/changelogs',
  wiki: '/wiki',
  lidc: '/lidc',
  atc: '/atc',
});

function normalizeView(view) {
  return Object.prototype.hasOwnProperty.call(VIEW_TO_PATH, view) ? view : 'landing';
}

function normalizePath(pathname = '/') {
  const cleaned = String(pathname || '/').replace(/\/+$/, '');
  return cleaned || '/';
}

function viewFromLocation() {
  if (typeof window === 'undefined') {
    return 'landing';
  }

  const currentPath = normalizePath(window.location.pathname);

  if (currentPath === '/map') {
    return 'frontline';
  }
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
  if (currentPath === '/') {
    return 'landing';
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

  return 'landing';
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
  const [appLanguage, setAppLanguage] = useState(() => getActiveLocale());
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
    setAppLanguage((prev) => {
      const next = prev === 'it' ? 'en' : 'it';
      setActiveLocale(next);
      return next;
    });
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
    <div className={`app-shell h-screen flex flex-col overflow-hidden ${currentView === 'landing' ? 'bg-[#0b0b0d]' : 'bg-yt-bg-primary'}`}>
      <header className="app-header">
        <div className="app-header__inner">
          <div className="app-header__left">
            <button
              type="button"
              onClick={() => goToView('landing')}
              className="app-header__brand"
              title="Home"
            >
              <img
                src={bannerImg}
                alt="DCS Italia"
                className="app-header__logo"
              />
              <span className="app-header__title">DCS ITALIA</span>
            </button>

            {currentView === 'frontline' && (
              <div className="app-header__summary">
                <span className="app-header__summary-badge" style={{ color: '#86efac' }}>
                  <span className="app-header__summary-dot" style={{ background: '#4ade80' }} />
                  Live
                </span>
                <span className="app-header__summary-badge" style={{ color: '#e2e8f0' }}>
                  <span className="app-header__summary-dot" style={{ background: '#cbd5e1' }} />
                  {frontlineSummary.total}
                </span>
                <span className="app-header__summary-badge" style={{ color: '#fca5a5' }}>
                  <span className="app-header__summary-dot" style={{ background: '#f87171' }} />
                  {frontlineSummary.RED}
                </span>
                <span className="app-header__summary-badge" style={{ color: '#93c5fd' }}>
                  <span className="app-header__summary-dot" style={{ background: '#60a5fa' }} />
                  {frontlineSummary.BLUE}
                </span>
                <span className="app-header__summary-badge" style={{ color: '#cbd5e1' }}>
                  <span className="app-header__summary-dot" style={{ background: '#94a3b8' }} />
                  {frontlineSummary.NEUTRAL}
                </span>
                <span className="app-header__summary-badge" style={{ color: '#fdba74' }}>
                  <span className="app-header__summary-dot" style={{ background: '#fb923c' }} />
                  {frontlineSummary.UNDER_ATTACK}
                </span>
              </div>
            )}
          </div>

          <div className="app-header__right">
            <button
              type="button"
              onClick={toggleLanguage}
              className="app-header__lang"
              aria-label={isItalian ? 'Switch language to English' : 'Switch language to Italian'}
              title={isItalian ? 'Switch language to English' : 'Switch language to Italian'}
            >
              <img
                src={isItalian ? itFlagImg : gbFlagImg}
                alt=""
                className="app-header__lang-flag"
                aria-hidden="true"
              />
              <span className="app-header__lang-code">{isItalian ? 'IT' : 'EN'}</span>
              <ChevronDown className="app-header__lang-chevron" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => goToView('changelogs')}
              className={`app-header__nav-btn${currentView === 'changelogs' ? ' is-active' : ''}`}
              title="Apri changelog"
              aria-label="Apri changelog"
            >
              <CalendarSync className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => goToView('wiki')}
              className={`app-header__nav-btn${currentView === 'wiki' ? ' is-active' : ''}`}
              title="Apri wiki"
              aria-label="Apri wiki"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {showLidc && (
              <button
                type="button"
                onClick={() => goToView('lidc')}
                className={`app-header__nav-btn${currentView === 'lidc' ? ' is-active' : ''}`}
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
                className={`app-header__nav-btn${currentView === 'atc' ? ' is-active' : ''}`}
                title="ATC Strips"
                aria-label="ATC Strips"
              >
                <TowerControl className="w-4 h-4" />
              </button>
            )}

            <UserMenu onOpenProfile={() => goToView('profile')} variant="brand" />
          </div>
        </div>
      </header>

      <main className={`flex-1 ${(currentView === 'landing' || currentView === 'frontline' || currentView === 'lidc' || currentView === 'atc') ? 'overflow-hidden' : 'container mx-auto px-4 py-4 overflow-y-auto'}`}>
        {currentView === 'landing' && (
          <LandingPage
            language={appLanguage}
            onOpenCampaign={(view) => goToView(view)}
          />
        )}
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

      {currentView !== 'landing' && currentView !== 'frontline' && currentView !== 'lidc' && currentView !== 'atc' && (
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
