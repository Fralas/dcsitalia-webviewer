import { useState, useEffect, useRef } from 'react';
import { AlertCircle, BookOpen, CalendarSync, ChevronDown, TowerControl } from 'lucide-react';
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
import enFlagImg from '../img/flags/en.svg';
import itFlagImg from '../img/flags/it.svg';
import { useUser } from './contexts/UserContext';
import CampaignHeaderTabs from './components/CampaignHeaderTabs';
import BootSplash from './components/BootSplash';
import {
  DEFAULT_CAMPAIGN_ID,
  getCampaignNavTarget,
} from './config/campaigns';
import {
  DEFAULT_TACTICAL_MAP_ID,
  getTacticalMapByCampaignId,
  resolveTacticalMapFromPath,
} from './config/tacticalMaps';
import { canAccessAtc } from './config/featureAccess';
import './AppHeader.css';

const MIN_BOOT_MS = 1600;
const BOOT_SETTLE_MS = 480;
const BOOT_FADE_MS = 700;

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

function isSplashPreviewUrl() {
  if (typeof window === 'undefined') {
    return false;
  }
  return new URLSearchParams(window.location.search).has('splash');
}

function setSplashPreviewUrl(enabled) {
  if (typeof window === 'undefined') {
    return;
  }
  const url = new URL(window.location.href);
  if (enabled) {
    url.searchParams.set('splash', '1');
  } else {
    url.searchParams.delete('splash');
  }
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextUrl !== currentUrl) {
    window.history.replaceState({}, '', nextUrl);
  }
}

function isTypingTarget(target) {
  if (!target || typeof target !== 'object') {
    return false;
  }
  const element = target;
  const tag = String(element.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || Boolean(element.isContentEditable);
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
  const { user, loading: userLoading } = useUser();
  const showAtc = canAccessAtc(user?.id);
  const bootStartedAt = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const bootRevealDone = useRef(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);
  const [splashKey, setSplashKey] = useState(0);
  const [splashPreview, setSplashPreview] = useState(() => isSplashPreviewUrl());
  const bootReady = !loading && !userLoading;

  const hideSplash = () => {
    setSplashFading(true);
    window.setTimeout(() => {
      setSplashVisible(false);
      setSplashFading(false);
    }, BOOT_FADE_MS);
  };

  const replaySplash = () => {
    setSplashFading(false);
    setSplashVisible(true);
    setSplashKey((key) => key + 1);
  };

  const closeSplashPreview = () => {
    setSplashPreview(false);
    setSplashPreviewUrl(false);
    hideSplash();
  };

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
      : null;

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
    if (splashPreview) {
      bootRevealDone.current = true;
      return undefined;
    }

    if (!bootReady || bootRevealDone.current) {
      return undefined;
    }

    let cancelled = false;
    let fadeTimerId = 0;

    const waitForPaint = () => new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      });
    });

    const reveal = async () => {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - bootStartedAt.current;
      const remaining = Math.max(0, MIN_BOOT_MS - elapsed);
      const fontsReady = document.fonts?.ready ?? Promise.resolve();

      await Promise.all([
        fontsReady.catch(() => undefined),
        new Promise((resolve) => {
          window.setTimeout(resolve, remaining);
        }),
      ]);

      await waitForPaint();
      await new Promise((resolve) => {
        window.setTimeout(resolve, BOOT_SETTLE_MS);
      });
      if (cancelled) return;

      bootRevealDone.current = true;
      setSplashFading(true);
      fadeTimerId = window.setTimeout(() => {
        if (!cancelled) {
          setSplashVisible(false);
        }
      }, BOOT_FADE_MS);
    };

    reveal();

    return () => {
      cancelled = true;
      window.clearTimeout(fadeTimerId);
    };
  }, [bootReady, splashPreview]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'Escape' && splashVisible) {
        event.preventDefault();
        if (splashPreview) {
          closeSplashPreview();
        } else {
          hideSplash();
        }
        return;
      }

      if ((event.key === 'S' || event.key === 's') && event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        replaySplash();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [splashVisible, splashFading, splashPreview]);

  useEffect(() => {
    // Canonicalize URL (supports old ?view=changelogs links and unknown paths).
    syncUrlWithView(currentView, { replace: true, tacticalMapId: activeTacticalMapId });
  }, [currentView, activeTacticalMapId]);

  useEffect(() => {
    if (currentView === 'atc' && !showAtc) {
      setCurrentView('frontline');
      syncUrlWithView('frontline', { replace: true });
    }
  }, [currentView, showAtc]);

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

  return (
    <>
      {splashVisible && (
        <BootSplash
          key={splashKey}
          fading={splashFading}
          preview={splashPreview}
          status={t('general.bootStatus')}
          hint={splashPreview ? t('general.bootPreviewHint') : t('general.bootHint')}
          replayLabel={t('general.bootReplay')}
          closeLabel={t('general.bootClose')}
          onReplay={replaySplash}
          onClose={closeSplashPreview}
        />
      )}

      {bootReady && error ? (
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
      ) : null}

      {!error && (bootReady || !splashVisible) ? (
    <div
      className={`app-shell h-screen flex flex-col overflow-hidden ${(currentView === 'landing' || currentView === 'lidc') ? 'bg-[#0E0E0E]' : 'bg-yt-bg-primary'}`}
      aria-hidden={splashVisible}
      {...(splashVisible ? { inert: '' } : {})}
    >
      <header className={`app-header${currentView === 'landing' ? ' app-header--landing' : ''}${currentView === 'lidc' ? ' app-header--lidc' : ''}${currentView === 'frontline' ? ' app-header--frontline' : ''}`}>
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
            {currentView === 'lidc' && (
              <div id="app-header-debug-slot" className="app-header__debug-slot" />
            )}

            <button
              type="button"
              onClick={toggleLanguage}
              className="app-header__lang"
              aria-label={isItalian ? 'Switch language to English' : 'Switch language to Italian'}
              title={isItalian ? 'Switch language to English' : 'Switch language to Italian'}
            >
              <img
                src={isItalian ? itFlagImg : enFlagImg}
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
      {(currentView === 'landing' || currentView === 'frontline') && (
        <div
          className={`app-header-fade${currentView === 'landing' ? ' app-header-fade--landing' : ''}${currentView === 'frontline' ? ' app-header-fade--frontline' : ''}`}
          aria-hidden="true"
        />
      )}

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
        {currentView === 'lidc' && (
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
      ) : null}
    </>
  );
}

export default App;
