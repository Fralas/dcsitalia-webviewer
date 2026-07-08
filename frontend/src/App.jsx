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
import CampaignHeaderTabs from './components/CampaignHeaderTabs';
import {
  DEFAULT_CAMPAIGN_ID,
  getCampaignNavTarget,
} from './config/campaigns';
import {
  DEFAULT_TACTICAL_MAP_ID,
  getTacticalMapByCampaignId,
  resolveTacticalMapFromPath,
} from './config/tacticalMaps';
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
    return { view: 'landing', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }

  const currentPath = normalizePath(window.location.pathname);

  if (currentPath === '/map' || currentPath.startsWith('/map/')) {
    const tacticalMap = resolveTacticalMapFromPath(currentPath);
    return {
      view: 'frontline',
      tacticalMapId: tacticalMap?.campaignId || DEFAULT_TACTICAL_MAP_ID,
    };
  }
  if (currentPath === '/changelogs') {
    return { view: 'changelogs', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }
  if (currentPath === '/wiki') {
    return { view: 'wiki', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }
  if (currentPath === '/profile') {
    return { view: 'profile', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }
  if (currentPath === '/lidc') {
    return { view: 'lidc', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }
  if (currentPath === '/atc') {
    return { view: 'atc', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }
  if (currentPath === '/') {
    return { view: 'landing', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }

  const params = new URLSearchParams(window.location.search);
  const viewFromQuery = params.get('view');
  if (viewFromQuery) {
    return { view: normalizeView(viewFromQuery), tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }

  const hashView = window.location.hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  if (hashView) {
    return { view: normalizeView(hashView), tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
  }

  return { view: 'landing', tacticalMapId: DEFAULT_TACTICAL_MAP_ID };
}

function syncUrlWithView(view, { replace = false, tacticalMapId = null } = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  const targetView = normalizeView(view);
  let targetPath = VIEW_TO_PATH[targetView];
  if (targetView === 'frontline') {
    const map = getTacticalMapByCampaignId(tacticalMapId || DEFAULT_TACTICAL_MAP_ID);
    targetPath = map?.path || VIEW_TO_PATH.frontline;
  }
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


function App() {
  const initialRoute = viewFromLocation();
  const [currentView, setCurrentView] = useState(() => initialRoute.view);
  const [activeTacticalMapId, setActiveTacticalMapId] = useState(() => initialRoute.tacticalMapId);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => {
    return null;
  });
  const [appLanguage, setAppLanguage] = useState(() => getActiveLocale());
  const [airports, setAirports] = useState({});
  const [airportCatalog, setAirportCatalog] = useState([]);
  const [airbaseStatus, setAirbaseStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useUser();
  const showLidc = canAccessLidc(user?.id);
  const showAtc = canAccessAtc(user?.id);

  const goToView = (view, options = {}) => {
    const normalized = normalizeView(view);
    if (normalized === 'frontline') {
      const nextMapId = options.tacticalMapId || activeTacticalMapId || DEFAULT_TACTICAL_MAP_ID;
      setActiveTacticalMapId(nextMapId);
      setCurrentView('frontline');
      syncUrlWithView('frontline', { tacticalMapId: nextMapId, ...options });
      return;
    }
    if (normalized === 'landing') {
      setSelectedCampaignId(null);
    }
    setCurrentView(normalized);
    syncUrlWithView(normalized, options);
  };

  const handleSelectCampaign = (campaign) => {
    if (campaign?.id === 'lidc-afghanistan') {
      return;
    }
    const target = getCampaignNavTarget(campaign);
    if (target.type === 'hidc' || target.type === 'lidc') {
      openCampaignTarget(target);
      return;
    }
    setSelectedCampaignId(campaign.id);
    goToView('landing');
  };

  const headerActiveCampaignId = currentView === 'frontline'
    ? activeTacticalMapId
    : currentView === 'lidc'
      ? 'lidc-afghanistan'
      : selectedCampaignId;

  const openCampaignTarget = (target) => {
    if (target?.type === 'hidc' && target.tacticalMapId) {
      const map = getTacticalMapByCampaignId(target.tacticalMapId);
      if (!map?.enabled) return;
      goToView('frontline', { tacticalMapId: target.tacticalMapId });
      return;
    }
    if (target?.type === 'lidc') {
      goToView('lidc');
    }
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
    syncUrlWithView(currentView, { replace: true, tacticalMapId: activeTacticalMapId });
  }, [currentView, activeTacticalMapId]);

  useEffect(() => {
    if ((currentView === 'lidc' && !showLidc) || (currentView === 'atc' && !showAtc)) {
      setCurrentView('frontline');
      syncUrlWithView('frontline', { replace: true });
    }
  }, [currentView, showLidc, showAtc]);

  useEffect(() => {
    const handlePopState = () => {
      const route = viewFromLocation();
      setCurrentView(route.view);
      setActiveTacticalMapId(route.tacticalMapId);
      if (route.view === 'landing') {
        setSelectedCampaignId(null);
      }
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

    return () => {
      unsubscribeInitial();
      unsubscribeUpdated();
      unsubscribeAirbaseStatus();
      socketService.disconnect();
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [airportsData, airbaseStatusData, airportCatalogData] = await Promise.all([
        api.getAirports(),
        api.getAirbaseStatus().catch(() => ({})),
        api.getAirportCatalog().catch(() => []),
      ]);

      setAirports(airportsData);
      setAirbaseStatus(airbaseStatusData || {});
      setAirportCatalog(Array.isArray(airportCatalogData) ? airportCatalogData : []);
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
    <div className={`app-shell h-screen flex flex-col overflow-hidden ${currentView === 'landing' ? 'bg-[#0F0F0F]' : 'bg-yt-bg-primary'}`}>
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
          </div>

          <CampaignHeaderTabs
            activeCampaignId={headerActiveCampaignId}
            onSelectCampaign={handleSelectCampaign}
          />

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
              className={`app-header__nav-btn app-header__nav-btn--lang${currentView === 'changelogs' ? ' is-active' : ''}`}
              title="Apri changelog"
              aria-label="Apri changelog"
            >
              <CalendarSync className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => goToView('wiki')}
              className={`app-header__nav-btn app-header__nav-btn--lang${currentView === 'wiki' ? ' is-active' : ''}`}
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
            selectedCampaignId={selectedCampaignId}
            onSelectCampaign={setSelectedCampaignId}
            onOpenCampaign={openCampaignTarget}
          />
        )}
        {currentView === 'frontline' && (
          <FrontlineMap
            language={appLanguage}
            tacticalMapId={activeTacticalMapId}
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
