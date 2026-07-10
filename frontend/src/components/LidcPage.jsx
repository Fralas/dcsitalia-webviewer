import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Coins,
  Copy,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Disc3,
  Forklift,
  Helicopter,
  Loader2,
  Plane,
  Save,
  Settings,
  Trash2,
  Upload,
  Users,
  UserPlus,
  Warehouse,
  Maximize2,
  X,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import airports from '../config/airports';
import * as api from '../services/api';
import { t } from '../utils/locale';
import './LidcPage.css';

const WIZARD_STEPS = ['info', 'template', 'deck', 'review'];

const CATEGORY_META = [
  { key: 'aircrafts', labelKey: 'lidc.deck.categories.aircrafts' },
  { key: 'helicopters', labelKey: 'lidc.deck.categories.helicopters' },
  { key: 'logistics', labelKey: 'lidc.deck.categories.logistics' },
  { key: 'groundAssets', labelKey: 'lidc.deck.categories.groundAssets' },
];

const LIDC_SIDEBAR_VIEWS = Object.freeze({
  SQUADRON_DECK: 'squadronDeck',
  SQUADRON_MEMBERS: 'squadronMembers',
});

const DECK_SLOT_FLIP_MS = 520;
const DECK_SLOT_FLIP_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SHOW_SQUADRON_LEAVE_DELETE_UI = false;

function prefersReducedDeckMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function flipDeckSlot(deckSlot, firstRect) {
  if (!deckSlot || !firstRect) return;

  const lastRect = deckSlot.getBoundingClientRect();
  const dx = firstRect.left - lastRect.left;
  const dy = firstRect.top - lastRect.top;
  const sx = firstRect.width / Math.max(lastRect.width, 1);
  const sy = firstRect.height / Math.max(lastRect.height, 1);

  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.01 && Math.abs(sy - 1) < 0.01) {
    return;
  }

  deckSlot.classList.add('is-flip-animating');
  deckSlot.style.transformOrigin = 'top left';
  deckSlot.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
  deckSlot.style.transition = 'transform 0s';

  requestAnimationFrame(() => {
    deckSlot.style.transition = `transform ${DECK_SLOT_FLIP_MS}ms ${DECK_SLOT_FLIP_EASING}`;
    deckSlot.style.transform = '';
  });

  const onEnd = (event) => {
    if (event.target !== deckSlot || event.propertyName !== 'transform') return;
    deckSlot.style.transition = '';
    deckSlot.style.transform = '';
    deckSlot.style.transformOrigin = '';
    deckSlot.classList.remove('is-flip-animating');
    deckSlot.removeEventListener('transitionend', onEnd);
  };

  deckSlot.addEventListener('transitionend', onEnd);
}

function scheduleDeckLayoutTransition(deckSlot, firstRect) {
  if (!deckSlot || !firstRect) return;

  requestAnimationFrame(() => {
    flipDeckSlot(deckSlot, firstRect);
  });
}

const AIRFRAME_STATUSES = Object.freeze({
  AIRBORNE: 'airborne',
  GROUNDED: 'grounded',
  DESTROYED: 'destroyed',
});

const MOCK_MEMBER_PROFILES = Object.freeze([
  {
    userId: 'mock_member_01',
    globalName: 'Marco Valli',
    username: 'mvalli',
    avatarUrl: 'https://i.pravatar.cc/80?img=12',
    role: 'member',
  },
  {
    userId: 'mock_member_02',
    globalName: 'Luca Ferri',
    username: 'lferri',
    avatarUrl: 'https://i.pravatar.cc/80?img=15',
    role: 'member',
  },
  {
    userId: 'mock_member_03',
    globalName: 'Giulia Neri',
    username: 'gneri',
    avatarUrl: 'https://i.pravatar.cc/80?img=5',
    role: 'member',
  },
  {
    userId: 'mock_member_04',
    globalName: 'Alessio Rinaldi',
    username: 'arinaldi',
    avatarUrl: 'https://i.pravatar.cc/80?img=22',
    role: 'member',
  },
  {
    userId: 'mock_member_05',
    globalName: 'Francesca Sala',
    username: 'fsala',
    avatarUrl: 'https://i.pravatar.cc/80?img=32',
    role: 'member',
  },
  {
    userId: 'mock_member_06',
    globalName: 'Davide Conti',
    username: 'dconti',
    avatarUrl: 'https://i.pravatar.cc/80?img=41',
    role: 'member',
  },
]);

function createEmptyCategoryMap() {
  return {
    aircrafts: 0,
    helicopters: 0,
    logistics: 0,
    groundAssets: 0,
  };
}

function computeSpentByCategory(quantities, units) {
  const spent = createEmptyCategoryMap();

  units.forEach((unit) => {
    const quantity = Number(quantities?.[unit.id] || 0);
    if (quantity <= 0) return;

    const category = unit.category;
    if (spent[category] === undefined) return;
    spent[category] += Number(unit.cost || 0) * quantity;
  });

  return spent;
}

function buildDeckPayload(quantities, units) {
  const deck = {
    aircrafts: [],
    helicopters: [],
    logistics: [],
    groundAssets: [],
  };

  units.forEach((unit) => {
    const quantity = Math.floor(Number(quantities?.[unit.id] || 0));
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    if (!deck[unit.category]) return;

    deck[unit.category].push({ unitId: unit.id, quantity });
  });

  return deck;
}

function formatTimestamp(value) {
  if (!Number.isFinite(value)) return '-';
  return new Date(value).toLocaleString();
}

function formatLogTime(value) {
  if (!Number.isFinite(value)) return '--:--:--';
  return new Date(value).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatUserLabel(entry) {
  if (!entry) return '-';
  return entry.globalName || entry.username || entry.userId || entry.id || '-';
}

function getUserInitial(entry) {
  const label = formatUserLabel(entry);
  const trimmed = String(label || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

function getSquadronInitial(name) {
  const trimmed = String(name || '').trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
}

function hashText(value) {
  const source = String(value || '');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getMockStatusForAirframe(airframe) {
  const seed = hashText(`${airframe?.id || ''}:${airframe?.boardNumber || ''}`);
  const remainder = seed % 3;
  if (remainder === 0) return AIRFRAME_STATUSES.AIRBORNE;
  if (remainder === 1) return AIRFRAME_STATUSES.GROUNDED;
  return AIRFRAME_STATUSES.DESTROYED;
}

function getMockBaseForAirframe(airframe, airportList) {
  if (!Array.isArray(airportList) || airportList.length === 0) return null;
  const seed = hashText(`${airframe?.id || ''}:${airframe?.unitId || ''}`);
  const index = seed % airportList.length;
  return airportList[index] || null;
}

function buildMockAirframeLogs({ airframe, baseLabel, pilotLabel, status }) {
  const createdAt = Number.isFinite(airframe?.createdAt) ? airframe.createdAt : Date.now() - (12 * 60 * 60 * 1000);
  const board = airframe?.boardNumber || '---AA';
  const model = airframe?.unitLabel || airframe?.unitId || 'Airframe';
  const pilot = pilotLabel || 'Unassigned';

  const events = [
    { offsetMs: 30 * 60 * 1000, type: 'handover', detail: `Airframe ${board} assigned to ${pilot}` },
    { offsetMs: 90 * 60 * 1000, type: 'startup', detail: `Engine startup completed at ${baseLabel}` },
    { offsetMs: 140 * 60 * 1000, type: 'taxi', detail: `${model} taxiing to runway` },
    { offsetMs: 190 * 60 * 1000, type: 'takeoff', detail: `Takeoff registered from ${baseLabel}` },
    { offsetMs: 280 * 60 * 1000, type: 'position', detail: `Radar track update received (mock feed)` },
  ];

  if (status === AIRFRAME_STATUSES.AIRBORNE) {
    events.push({ offsetMs: 350 * 60 * 1000, type: 'airborne', detail: 'Status check: currently in air' });
  } else if (status === AIRFRAME_STATUSES.GROUNDED) {
    events.push({ offsetMs: 350 * 60 * 1000, type: 'landing', detail: `Landing confirmed at ${baseLabel}` });
  } else {
    events.push({ offsetMs: 350 * 60 * 1000, type: 'loss', detail: 'Destroyed event flagged by mock tracker' });
  }

  return events.map((event, index) => ({
    id: `${airframe?.id || 'airframe'}_${event.type}_${index}`,
    at: createdAt + event.offsetMs,
    type: event.type,
    detail: event.detail,
  }));
}

function formatInviteCode(code) {
  const normalized = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (normalized.length !== 8) return normalized;
  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

function isAuthenticationError(error) {
  const status = Number(error?.status);
  const message = String(error?.message || '').toLowerCase();
  return status === 401 || message.includes('not authenticated');
}

export default function LidcPage() {
  const { user } = useUser();

  const [templates, setTemplates] = useState([]);
  const [units, setUnits] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [catalogError, setCatalogError] = useState('');

  const [activeView, setActiveView] = useState(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);
  const [isSquadronManagementOpen, setIsSquadronManagementOpen] = useState(true);
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [isNarrowLayout, setIsNarrowLayout] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 1120;
  });
  const sidebarOpenTimerRef = useRef(null);
  const sidebarCloseTimerRef = useRef(null);
  const [panelMode, setPanelMode] = useState('home');
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [baseId, setBaseId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [quantities, setQuantities] = useState({});

  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joiningSquadron, setJoiningSquadron] = useState(false);
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false);
  const [inviteCodeRevealed, setInviteCodeRevealed] = useState(false);
  const [fullscreenPanelView, setFullscreenPanelView] = useState('');
  const [deckBoardExpanded, setDeckBoardExpanded] = useState(false);
  const [boardPanelsCollapsed, setBoardPanelsCollapsed] = useState(false);

  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [createdSquadron, setCreatedSquadron] = useState(null);

  const [loadingUserState, setLoadingUserState] = useState(false);
  const [userStateError, setUserStateError] = useState('');
  const [leavingSquadron, setLeavingSquadron] = useState(false);
  const [deletingSquadron, setDeletingSquadron] = useState(false);
  const [pendingSquadronAction, setPendingSquadronAction] = useState('');
  const [userLidcState, setUserLidcState] = useState({
    hasSquadron: false,
    squadron: null,
  });
  const [memberActionMenuForId, setMemberActionMenuForId] = useState('');
  const memberActionMenuRef = useRef(null);
  const deckSlotRef = useRef(null);
  const [activeSquadron, setActiveSquadron] = useState(null);
  const [listedSquadrons, setListedSquadrons] = useState([]);
  const [loadingListedSquadrons, setLoadingListedSquadrons] = useState(true);
  const [listedSquadronsError, setListedSquadronsError] = useState('');
  const [selectedListSquadronId, setSelectedListSquadronId] = useState('');
  const [loadingSquadronDetails, setLoadingSquadronDetails] = useState(false);
  const [squadronDetailsError, setSquadronDetailsError] = useState('');
  const [updatingAirframeId, setUpdatingAirframeId] = useState('');
  const [airframeUpdateError, setAirframeUpdateError] = useState('');
  const [selectedAirframeDraft, setSelectedAirframeDraft] = useState(null);
  const [airframeEditorError, setAirframeEditorError] = useState('');
  const [airframeEditorSaving, setAirframeEditorSaving] = useState(false);
  const [isPilotMenuOpen, setIsPilotMenuOpen] = useState(false);
  const pilotMenuRef = useRef(null);

  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [templateEditorRaw, setTemplateEditorRaw] = useState('');
  const [templateEditorError, setTemplateEditorError] = useState('');
  const [templateEditorSaving, setTemplateEditorSaving] = useState(false);

  function applyUserLidcState(response) {
    const nextState = {
      hasSquadron: Boolean(response?.hasSquadron),
      squadron: response?.squadron || null,
    };

    setUserLidcState(nextState);
    if (!nextState.hasSquadron) {
      setPanelMode('home');
      setActiveSquadron(null);
      setSelectedAirframeDraft(null);
      setAirframeEditorError('');
      setAirframeEditorSaving(false);
      setLeavingSquadron(false);
      setDeletingSquadron(false);
      setPendingSquadronAction('');
    }

    return nextState;
  }

  useEffect(() => {
    let mounted = true;

    async function loadCatalog() {
      if (!user?.id) {
        if (!mounted) return;
        setCatalogError('');
        setLoadingCatalog(false);
        return;
      }

      setLoadingCatalog(true);
      setCatalogError('');

      try {
        const response = await api.getLidcTemplates();
        if (!mounted) return;

        const nextTemplates = Array.isArray(response?.templates) ? response.templates : [];
        const nextUnits = Array.isArray(response?.units) ? response.units : [];

        setTemplates(nextTemplates);
        setUnits(nextUnits);

        if (nextTemplates.length > 0) {
          setTemplateId((prev) => {
            if (nextTemplates.some((entry) => entry.id === prev)) return prev;
            return nextTemplates[0].id;
          });
        }
      } catch (error) {
        if (!mounted) return;
        if (isAuthenticationError(error)) {
          setCatalogError('');
          return;
        }
        setCatalogError(error.message || t('lidc.errors.catalogLoadFailed'));
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    }

    loadCatalog();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;

    async function loadListedSquadrons() {
      if (!user?.id) {
        if (!mounted) return;
        setListedSquadrons([]);
        setListedSquadronsError('');
        setLoadingListedSquadrons(false);
        return;
      }

      setLoadingListedSquadrons(true);
      setListedSquadronsError('');

      try {
        const response = await api.getLidcSquadrons();
        if (!mounted) return;
        setListedSquadrons(Array.isArray(response?.squadrons) ? response.squadrons : []);
      } catch (error) {
        if (!mounted) return;
        setListedSquadrons([]);
        setListedSquadronsError(error.message || t('lidc.errors.squadronsListFailed'));
      } finally {
        if (mounted) setLoadingListedSquadrons(false);
      }
    }

    loadListedSquadrons();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const validViews = Object.values(LIDC_SIDEBAR_VIEWS);
    if (!validViews.includes(activeView)) {
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);
    }
  }, [activeView]);

  useEffect(() => {
    if (listedSquadrons.length === 0) return;

    const hasCurrentSelection = selectedListSquadronId
      && listedSquadrons.some((entry) => entry.id === selectedListSquadronId);
    if (hasCurrentSelection) return;

    const preferredId = userLidcState?.squadron?.id || '';
    if (preferredId && listedSquadrons.some((entry) => entry.id === preferredId)) {
      setSelectedListSquadronId(preferredId);
      return;
    }

    setSelectedListSquadronId(listedSquadrons[0].id);
  }, [listedSquadrons, userLidcState?.squadron?.id, selectedListSquadronId]);

  const isEntryWizardVisible = !isWizardOpen
    && !loadingUserState
    && Boolean(user?.id)
    && !Boolean(userLidcState.hasSquadron)
    && panelMode === 'join';
  const shouldBlurBehindOverlay = isWizardOpen || isEntryWizardVisible;

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const appShell = document.querySelector('.app-shell');
    const body = document.body;

    if (shouldBlurBehindOverlay) {
      appShell?.classList.add('lidc-wizard-open');
      body.classList.add('lidc-wizard-open');
    } else {
      appShell?.classList.remove('lidc-wizard-open');
      body.classList.remove('lidc-wizard-open');
    }

    return () => {
      appShell?.classList.remove('lidc-wizard-open');
      body.classList.remove('lidc-wizard-open');
    };
  }, [shouldBlurBehindOverlay]);

  useEffect(() => {
    if (!fullscreenPanelView || typeof document === 'undefined') return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || selectedAirframeDraft) return;
      closeFullscreenPanel();
    };

    document.body.classList.add('lidc-deck-expanded-open');
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.classList.remove('lidc-deck-expanded-open');
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [fullscreenPanelView, selectedAirframeDraft]);

  useEffect(() => {
    let mounted = true;

    async function loadUserState() {
      if (!user) {
        if (!mounted) return;
        setLoadingUserState(false);
        setUserStateError('');
        setUserLidcState({
          hasSquadron: false,
          squadron: null,
        });
        setActiveSquadron(null);
        setSquadronDetailsError('');
        setAirframeUpdateError('');
        setUpdatingAirframeId('');
        setSelectedAirframeDraft(null);
        setAirframeEditorError('');
        setAirframeEditorSaving(false);
        setLeavingSquadron(false);
        setDeletingSquadron(false);
        setPendingSquadronAction('');
        setPanelMode('home');
        return;
      }

      setLoadingUserState(true);
      setUserStateError('');

      try {
        const response = await api.getLidcMe();
        if (!mounted) return;
        applyUserLidcState(response);
      } catch (error) {
        if (!mounted) return;
        if (!isAuthenticationError(error)) {
          setUserStateError(error.message || t('lidc.errors.userStateFailed'));
        }
      } finally {
        if (mounted) setLoadingUserState(false);
      }
    }

    loadUserState();

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    setSelectedAirframeDraft(null);
    setAirframeEditorError('');
    setAirframeEditorSaving(false);
  }, [activeSquadron?.id]);

  useEffect(() => {
    let mounted = true;

    async function loadSquadronDetails() {
      const squadronId = selectedListSquadronId;
      if (!user?.id || !squadronId) {
        if (!mounted) return;
        setLoadingSquadronDetails(false);
        setSquadronDetailsError('');
        setActiveSquadron(null);
        return;
      }

      setLoadingSquadronDetails(true);
      setSquadronDetailsError('');

      try {
        const response = await api.getLidcSquadron(squadronId);
        if (!mounted) return;
        setActiveSquadron(response?.squadron || null);
      } catch (error) {
        if (!mounted) return;
        setActiveSquadron(null);
        setSquadronDetailsError(error.message || t('lidc.errors.squadronLoadFailed'));
      } finally {
        if (mounted) setLoadingSquadronDetails(false);
      }
    }

    loadSquadronDetails();

    return () => {
      mounted = false;
    };
  }, [user?.id, selectedListSquadronId]);

  useEffect(() => {
    setInviteCodeRevealed(false);
    setInviteCodeCopied(false);
  }, [activeSquadron?.id, activeSquadron?.inviteCode]);

  function clearSidebarTimers() {
    if (sidebarOpenTimerRef.current) {
      clearTimeout(sidebarOpenTimerRef.current);
      sidebarOpenTimerRef.current = null;
    }
    if (sidebarCloseTimerRef.current) {
      clearTimeout(sidebarCloseTimerRef.current);
      sidebarCloseTimerRef.current = null;
    }
  }

  function handleSidebarMouseEnter() {
    if (isNarrowLayout || isSidebarPinned) return;

    if (sidebarCloseTimerRef.current) {
      clearTimeout(sidebarCloseTimerRef.current);
      sidebarCloseTimerRef.current = null;
    }

    if (isSidebarHovered || sidebarOpenTimerRef.current) return;

    sidebarOpenTimerRef.current = setTimeout(() => {
      setIsSidebarHovered(true);
      sidebarOpenTimerRef.current = null;
    }, 50);
  }

  function handleSidebarMouseLeave() {
    if (isNarrowLayout || isSidebarPinned) return;

    if (sidebarOpenTimerRef.current) {
      clearTimeout(sidebarOpenTimerRef.current);
      sidebarOpenTimerRef.current = null;
    }

    if (sidebarCloseTimerRef.current) return;

    sidebarCloseTimerRef.current = setTimeout(() => {
      setIsSidebarHovered(false);
      sidebarCloseTimerRef.current = null;
    }, 170);
  }

  useEffect(() => {
    if (isNarrowLayout || isSidebarPinned) {
      clearSidebarTimers();
      setIsSidebarHovered(false);
    }
  }, [isNarrowLayout, isSidebarPinned]);

  useEffect(() => {
    return () => {
      clearSidebarTimers();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleResize = () => {
      setIsNarrowLayout(window.innerWidth <= 1120);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((entry) => entry.id === templateId) || null,
    [templates, templateId],
  );

  const unitsByCategory = useMemo(() => {
    const map = {
      aircrafts: [],
      helicopters: [],
      logistics: [],
      groundAssets: [],
    };

    units.forEach((unit) => {
      if (!map[unit.category]) return;
      map[unit.category].push(unit);
    });

    Object.keys(map).forEach((category) => {
      map[category].sort((a, b) => String(a.label).localeCompare(String(b.label)));
    });

    return map;
  }, [units]);

  const spentByCategory = useMemo(() => computeSpentByCategory(quantities, units), [quantities, units]);

  const capsByCategory = useMemo(() => {
    const caps = createEmptyCategoryMap();
    if (!selectedTemplate?.caps) return caps;

    CATEGORY_META.forEach(({ key }) => {
      caps[key] = Number(selectedTemplate.caps?.[key] || 0);
    });

    return caps;
  }, [selectedTemplate]);

  const remainingByCategory = useMemo(() => {
    const remaining = createEmptyCategoryMap();
    CATEGORY_META.forEach(({ key }) => {
      remaining[key] = Math.max(0, (capsByCategory[key] || 0) - (spentByCategory[key] || 0));
    });
    return remaining;
  }, [capsByCategory, spentByCategory]);

  const deckPayload = useMemo(() => buildDeckPayload(quantities, units), [quantities, units]);

  const totalDeckUnits = useMemo(() => {
    return Object.values(quantities).reduce((sum, value) => {
      const quantity = Math.floor(Number(value || 0));
      return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);
  }, [quantities]);

  const effectiveTotalDeckUnits = useMemo(() => {
    if (activeSquadron?.costSummary?.totalUnits != null) {
      return Number(activeSquadron.costSummary.totalUnits) || 0;
    }
    return totalDeckUnits;
  }, [activeSquadron, totalDeckUnits]);

  const validation = useMemo(() => {
    const infoValid = name.trim().length > 0 && baseId.trim().length > 0;
    const templateValid = Boolean(selectedTemplate);
    const deckHasUnits = totalDeckUnits > 0;

    let capsValid = Boolean(templateValid);
    CATEGORY_META.forEach(({ key }) => {
      if ((spentByCategory[key] || 0) > (capsByCategory[key] || 0)) {
        capsValid = false;
      }
    });

    return {
      infoValid,
      templateValid,
      deckHasUnits,
      capsValid,
      canSubmit: infoValid && templateValid && deckHasUnits && capsValid,
    };
  }, [name, baseId, selectedTemplate, totalDeckUnits, spentByCategory, capsByCategory]);

  const currentStepKey = WIZARD_STEPS[currentStep] || WIZARD_STEPS[0];
  const isLogged = Boolean(user?.id);
  const userHasSquadron = Boolean(userLidcState.hasSquadron);
  const isViewingOwnSquadron = userHasSquadron
    && Boolean(selectedListSquadronId)
    && selectedListSquadronId === String(userLidcState?.squadron?.id || '');
  const isManagementFocusView = isViewingOwnSquadron
    && activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS;
  const showMemberManagementView = isViewingOwnSquadron
    && activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS;
  const effectivePreviewBaseId = baseId
    || activeSquadron?.baseId
    || createdSquadron?.baseId
    || userLidcState?.squadron?.baseId
    || '';
  const previewBase = useMemo(
    () => airports.find((entry) => entry.id === effectivePreviewBaseId) || null,
    [effectivePreviewBaseId],
  );

  const previewIdentity = useMemo(() => {
    const baseSquadron = activeSquadron || createdSquadron || userLidcState.squadron || null;
    return {
      name: name || baseSquadron?.name || t('lidc.preview.fallbackName'),
      description: description || baseSquadron?.description || t('lidc.preview.fallbackDescription'),
      baseLabel: previewBase?.displayName || previewBase?.name || baseSquadron?.baseId || '-',
      templateName: baseSquadron?.templateName || selectedTemplate?.name || '-',
    };
  }, [activeSquadron, createdSquadron, userLidcState.squadron, name, description, previewBase, selectedTemplate]);

  function resetWizardDraft() {
    setCurrentStep(0);
    setName('');
    setDescription('');
    setLogoDataUrl('');
    setBaseId('');
    setQuantities({});
    setJoinInviteCode('');
    setJoinError('');
    setSubmitError('');
    setCreatedSquadron(null);

    if (templates.length > 0) {
      setTemplateId(templates[0].id);
    }
  }

  function openCreateWizard() {
    resetWizardDraft();
    setIsWizardOpen(true);
  }

  function closeWizard() {
    setIsWizardOpen(false);
    setCurrentStep(0);
    setSubmitError('');
  }

  function updateQuantity(unit, nextQuantity) {
    const quantity = Math.max(0, Math.floor(Number(nextQuantity || 0)));

    if (selectedTemplate) {
      const category = unit.category;
      const currentQuantity = Number(quantities[unit.id] || 0);
      const diff = quantity - currentQuantity;

      if (diff > 0) {
        const projectedSpent = (spentByCategory[category] || 0) + (diff * Number(unit.cost || 0));
        if (projectedSpent > (capsByCategory[category] || 0)) return;
      }
    }

    setQuantities((prev) => {
      const next = { ...prev };
      if (quantity <= 0) {
        delete next[unit.id];
      } else {
        next[unit.id] = quantity;
      }
      return next;
    });
  }

  async function handleJoinSquadron() {
    const code = joinInviteCode.trim();
    if (!code || joiningSquadron) return;

    setJoinError('');
    setJoiningSquadron(true);

    try {
      const response = await api.joinLidcSquadronByInviteCode(code);
      const joined = response?.squadron || null;

      const stateResponse = await api.getLidcMe();
      applyUserLidcState(stateResponse);

      if (joined) {
        setActiveSquadron(joined);
        setSelectedListSquadronId(joined.id);
      }

      setPanelMode('home');
      setJoinInviteCode('');
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);

      try {
        const listResponse = await api.getLidcSquadrons();
        setListedSquadrons(Array.isArray(listResponse?.squadrons) ? listResponse.squadrons : []);
      } catch (_) {
        // Non-blocking refresh after join.
      }
    } catch (error) {
      if (Number(error?.status) === 409) {
        try {
          const stateResponse = await api.getLidcMe();
          const nextState = applyUserLidcState(stateResponse);
          if (nextState.hasSquadron) {
            setPanelMode('home');
            setJoinInviteCode('');
            return;
          }
        } catch (_) {
          // Fall back to default error rendering.
        }
      }

      setJoinError(error.message || t('lidc.errors.joinFailed'));
    } finally {
      setJoiningSquadron(false);
    }
  }

  async function copyInviteCode(code) {
    const formatted = formatInviteCode(code);
    if (!formatted) return;

    setInviteCodeRevealed(true);

    try {
      await navigator.clipboard.writeText(formatted);
      setInviteCodeCopied(true);
      window.setTimeout(() => setInviteCodeCopied(false), 2000);
    } catch (_) {
      // Clipboard unavailable.
    }
  }

  function toggleInviteCodeVisibility() {
    setInviteCodeRevealed((prev) => !prev);
  }

  function openFullscreenPanel(view) {
    if (view !== 'deck' && view !== 'members') return;

    const deckSlot = deckSlotRef.current;

    if (prefersReducedDeckMotion()) {
      setBoardPanelsCollapsed(true);
      setDeckBoardExpanded(true);
      setFullscreenPanelView(view);
      setMemberActionMenuForId('');
      setIsPilotMenuOpen(false);
      return;
    }

    const firstRect = deckSlot?.getBoundingClientRect();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setBoardPanelsCollapsed(true);
        setDeckBoardExpanded(true);
        setFullscreenPanelView(view);
        setMemberActionMenuForId('');
        setIsPilotMenuOpen(false);
        scheduleDeckLayoutTransition(deckSlot, firstRect);
      });
    });
  }

  function closeFullscreenPanel() {
    const deckSlot = deckSlotRef.current;

    if (prefersReducedDeckMotion()) {
      setBoardPanelsCollapsed(false);
      setDeckBoardExpanded(false);
      setFullscreenPanelView('');
      setMemberActionMenuForId('');
      return;
    }

    const firstRect = deckSlot?.getBoundingClientRect();

    requestAnimationFrame(() => {
      setBoardPanelsCollapsed(false);
      setDeckBoardExpanded(false);

      scheduleDeckLayoutTransition(deckSlot, firstRect);

      window.setTimeout(() => {
        setFullscreenPanelView('');
        setMemberActionMenuForId('');
      }, DECK_SLOT_FLIP_MS);
    });
  }

  function handlePreviewExpandKeyDown(event, view) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openFullscreenPanel(view);
  }

  function handleLogoUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setLogoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  function buildSubmitError() {
    if (!validation.infoValid) return t('lidc.errors.infoRequired');
    if (!validation.templateValid) return t('lidc.errors.templateRequired');
    if (!validation.deckHasUnits) return t('lidc.errors.deckEmpty');
    if (!validation.capsValid) return t('lidc.errors.deckCapsExceeded');
    if (!isLogged) return t('lidc.errors.loginRequired');
    return '';
  }

  function getStepBlockingError(stepKey) {
    if (stepKey === 'info' && !validation.infoValid) return t('lidc.errors.infoRequired');
    if (stepKey === 'template' && !validation.templateValid) return t('lidc.errors.templateRequired');
    if (stepKey === 'deck') {
      if (!validation.deckHasUnits) return t('lidc.errors.deckEmpty');
      if (!validation.capsValid) return t('lidc.errors.deckCapsExceeded');
    }
    if (stepKey === 'review') return buildSubmitError();
    return '';
  }

  const currentStepBlockingError = getStepBlockingError(currentStepKey);
  const canGoNextStep = currentStep < (WIZARD_STEPS.length - 1) && currentStepBlockingError === '';

  function goToNextStep() {
    if (!canGoNextStep) return;
    setCurrentStep((prev) => Math.min(WIZARD_STEPS.length - 1, prev + 1));
  }

  async function handleCreateSquadron() {
    const validationError = buildSubmitError();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setSubmitError('');
    setSubmitting(true);

    try {
      const payload = {
        name,
        description,
        logoDataUrl,
        baseId,
        templateId: selectedTemplate.id,
        deck: deckPayload,
      };

      const response = await api.createLidcSquadron(payload);
      const created = response?.squadron || null;
      setCreatedSquadron(created);
      setActiveSquadron(created);

      if (created) {
        setUserLidcState((prev) => ({
          ...prev,
          hasSquadron: true,
          squadron: {
            id: created.id,
            name: created.name,
            templateName: created.templateName,
            baseId: created.baseId,
            createdAt: created.createdAt,
          },
        }));
        setSelectedListSquadronId(created.id);
      }

      try {
        const listResponse = await api.getLidcSquadrons();
        setListedSquadrons(Array.isArray(listResponse?.squadrons) ? listResponse.squadrons : []);
      } catch (_) {
        // Non-blocking refresh after create.
      }

      closeWizard();
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);
    } catch (error) {
      if (Number(error?.status) === 409) {
        try {
          const stateResponse = await api.getLidcMe();
          const nextState = applyUserLidcState(stateResponse);
          if (nextState.hasSquadron) {
            setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);
            setPanelMode('home');
            closeWizard();
            return;
          }
        } catch (_) {
          // Fall back to default error rendering.
        }
      }

      setSubmitError(error.message || t('lidc.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  function openSquadronActionConfirm(action) {
    if (isSquadronActionBusy) return;
    if (action !== 'leave' && action !== 'delete') return;
    if (action === 'delete' && !isCurrentUserOwner) return;
    setPendingSquadronAction(action);
  }

  function closeSquadronActionConfirm() {
    if (isSquadronActionBusy) return;
    setPendingSquadronAction('');
  }

  async function handleLeaveSquadron() {
    const squadronId = activeSquadron?.id || userLidcState?.squadron?.id || '';
    if (!squadronId || leavingSquadron) return;

    setLeavingSquadron(true);
    setPendingSquadronAction('');
    setUserStateError('');
    setSquadronDetailsError('');
    setAirframeUpdateError('');
    setUpdatingAirframeId('');
    setSelectedAirframeDraft(null);
    setAirframeEditorError('');
    setAirframeEditorSaving(false);
    setMemberActionMenuForId('');

    try {
      await api.leaveLidcSquadron(squadronId);

      const stateResponse = await api.getLidcMe();
      applyUserLidcState(stateResponse);

      setCreatedSquadron(null);
      setActiveSquadron(null);
      setSelectedListSquadronId('');
      setPanelMode('home');
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);

      try {
        const listResponse = await api.getLidcSquadrons();
        setListedSquadrons(Array.isArray(listResponse?.squadrons) ? listResponse.squadrons : []);
      } catch (_) {
        // Non-blocking refresh after leave.
      }
    } catch (error) {
      setUserStateError(error.message || t('lidc.errors.leaveFailed'));
    } finally {
      setLeavingSquadron(false);
    }
  }

  async function handleDeleteSquadron() {
    const squadronId = activeSquadron?.id || userLidcState?.squadron?.id || '';
    if (!squadronId || deletingSquadron) return;

    setDeletingSquadron(true);
    setPendingSquadronAction('');
    setUserStateError('');
    setSquadronDetailsError('');
    setAirframeUpdateError('');
    setUpdatingAirframeId('');
    setSelectedAirframeDraft(null);
    setAirframeEditorError('');
    setAirframeEditorSaving(false);
    setMemberActionMenuForId('');

    try {
      await api.deleteLidcSquadron(squadronId);

      const stateResponse = await api.getLidcMe();
      applyUserLidcState(stateResponse);

      setCreatedSquadron(null);
      setActiveSquadron(null);
      setSelectedListSquadronId('');
      setPanelMode('home');
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK);

      try {
        const listResponse = await api.getLidcSquadrons();
        setListedSquadrons(Array.isArray(listResponse?.squadrons) ? listResponse.squadrons : []);
      } catch (_) {
        // Non-blocking refresh after delete.
      }
    } catch (error) {
      setUserStateError(error.message || t('lidc.errors.deleteFailed'));
    } finally {
      setDeletingSquadron(false);
    }
  }

  async function confirmPendingSquadronAction() {
    if (isSquadronActionBusy) return;
    if (pendingSquadronAction === 'leave') {
      await handleLeaveSquadron();
      return;
    }
    if (pendingSquadronAction === 'delete') {
      await handleDeleteSquadron();
    }
  }

  function openTemplateEditor() {
    setTemplateEditorError('');
    setTemplateEditorRaw(JSON.stringify({ templates, units }, null, 2));
    setIsTemplateEditorOpen(true);
  }

  async function saveTemplateEditor() {
    setTemplateEditorError('');
    let parsed;

    try {
      parsed = JSON.parse(templateEditorRaw);
    } catch (error) {
      setTemplateEditorError(t('lidc.admin.invalidJson'));
      return;
    }

    setTemplateEditorSaving(true);
    try {
      const response = await api.updateLidcTemplates(parsed);
      const nextTemplates = Array.isArray(response?.templates) ? response.templates : [];
      const nextUnits = Array.isArray(response?.units) ? response.units : [];

      setTemplates(nextTemplates);
      setUnits(nextUnits);

      if (!nextTemplates.some((entry) => entry.id === templateId) && nextTemplates.length > 0) {
        setTemplateId(nextTemplates[0].id);
      }

      setIsTemplateEditorOpen(false);
    } catch (error) {
      setTemplateEditorError(error.message || t('lidc.admin.saveFailed'));
    } finally {
      setTemplateEditorSaving(false);
    }
  }

  const squadronMembers = useMemo(() => {
    const list = Array.isArray(activeSquadron?.memberProfiles) ? activeSquadron.memberProfiles : [];
    const map = new Map();

    list.forEach((member) => {
      const memberId = String(member?.userId || '');
      if (!memberId) return;
      map.set(memberId, member);
    });

    MOCK_MEMBER_PROFILES.forEach((mockMember) => {
      const memberId = String(mockMember.userId || '');
      if (!memberId) return;
      if (!map.has(memberId)) {
        map.set(memberId, mockMember);
      }
    });

    return Array.from(map.values())
      .sort((a, b) => formatUserLabel(a).localeCompare(formatUserLabel(b), 'en', { sensitivity: 'base' }));
  }, [activeSquadron]);

  const squadronMembersById = useMemo(() => {
    const map = new Map();
    squadronMembers.forEach((member) => {
      const memberId = String(member?.userId || '');
      if (memberId) {
        map.set(memberId, member);
      }
    });
    return map;
  }, [squadronMembers]);

  const currentUserId = String(user?.id || '');
  const currentUserProfile = currentUserId ? (squadronMembersById.get(currentUserId) || null) : null;
  const currentUserRole = String(currentUserProfile?.role || '').toLowerCase();
  const isCurrentUserOwner = currentUserRole === 'owner'
    || (currentUserId !== '' && currentUserId === String(activeSquadron?.createdBy?.id || ''));
  const isSquadronActionBusy = leavingSquadron || deletingSquadron;

  const squadronAirframes = useMemo(() => {
    const list = Array.isArray(activeSquadron?.airframes) ? activeSquadron.airframes : [];
    return [...list].sort((a, b) => {
      const categoryCompare = String(a?.category || '').localeCompare(String(b?.category || ''), 'en', { sensitivity: 'base' });
      if (categoryCompare !== 0) return categoryCompare;
      const labelCompare = String(a?.unitLabel || '').localeCompare(String(b?.unitLabel || ''), 'en', { sensitivity: 'base' });
      if (labelCompare !== 0) return labelCompare;
      return String(a?.boardNumber || '').localeCompare(String(b?.boardNumber || ''), 'en', { numeric: true, sensitivity: 'base' });
    });
  }, [activeSquadron]);

  const airframeRows = useMemo(() => {
    return squadronAirframes.map((airframe) => {
      const model = String(airframe.unitLabel || airframe.unitId || '-');
      const pilotUserId = String(airframe.assignedPilotUserId || '');
      const pilotProfile = pilotUserId ? (squadronMembersById.get(pilotUserId) || null) : null;
      const pilotLabel = pilotProfile ? formatUserLabel(pilotProfile) : t('lidc.airframes.unassigned');
      const baseEntry = getMockBaseForAirframe(airframe, airports);
      const baseIdValue = String(baseEntry?.id || activeSquadron?.baseId || userLidcState?.squadron?.baseId || '');
      const baseLabel = baseEntry?.displayName || baseEntry?.name || baseIdValue || '-';
      const boardNumber = String(airframe.boardNumber || '').toUpperCase();
      const status = getMockStatusForAirframe(airframe);
      const logs = buildMockAirframeLogs({
        airframe,
        baseLabel,
        pilotLabel,
        status,
      });

      return {
        ...airframe,
        model,
        pilotUserId,
        pilotLabel,
        baseId: baseIdValue,
        baseLabel,
        boardNumber,
        status,
        logs,
      };
    });
  }, [squadronAirframes, squadronMembersById, activeSquadron?.baseId, userLidcState?.squadron?.baseId]);

  const memberRows = useMemo(() => {
    return squadronMembers.map((member) => {
      const memberId = String(member?.userId || '');
      const role = String(member?.role || 'member').toLowerCase();
      const roleLabel = role === 'owner'
        ? t('lidc.members.owner')
        : (role === 'admin' ? t('lidc.members.admin') : t('lidc.members.member'));
      const displayName = formatUserLabel(member);
      const counts = airframeRows.reduce((acc, row) => {
        if (String(row?.pilotUserId || '') !== memberId) return acc;
        const category = String(row?.category || '').toLowerCase();
        if (category === 'aircrafts') acc.a += 1;
        if (category === 'helicopters') acc.h += 1;
        if (category === 'logistics') acc.l += 1;
        return acc;
      }, { a: 0, h: 0, l: 0 });

      return {
        memberId,
        displayName,
        role,
        roleLabel,
        avatarUrl: String(member?.avatarUrl || ''),
        avatarFallback: getUserInitial(member),
        assignedAircraftCountA: counts.a,
        assignedAircraftCountH: counts.h,
        assignedAircraftCountL: counts.l,
      };
    });
  }, [squadronMembers, airframeRows]);

  const squadronSummaryStats = useMemo(() => {
    const memberProfiles = Array.isArray(activeSquadron?.memberProfiles) ? activeSquadron.memberProfiles : [];
    const totalPersonnel = memberRows.length > 0 ? memberRows.length : memberProfiles.length;
    const totalAirframes = airframeRows.filter((row) => {
      const category = String(row?.category || '').toLowerCase();
      return category === 'aircrafts' || category === 'helicopters';
    }).length;

    return {
      totalPersonnel,
      totalAirframes,
    };
  }, [memberRows, airframeRows, activeSquadron?.memberProfiles]);

  const selectedAirframeRow = useMemo(() => {
    const selectedId = String(selectedAirframeDraft?.id || '');
    if (!selectedId) return null;
    return airframeRows.find((entry) => entry.id === selectedId) || null;
  }, [selectedAirframeDraft?.id, airframeRows]);

  const selectedPilotUserId = String(selectedAirframeDraft?.pilotUserId || '');
  const selectedPilotProfile = selectedPilotUserId ? (squadronMembersById.get(selectedPilotUserId) || null) : null;
  const selectedPilotLabel = selectedPilotProfile ? formatUserLabel(selectedPilotProfile) : t('lidc.airframes.unassigned');
  const selectedPilotAvatarUrl = String(selectedPilotProfile?.avatarUrl || '');

  useEffect(() => {
    if (!selectedAirframeDraft || !isPilotMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (pilotMenuRef.current && !pilotMenuRef.current.contains(event.target)) {
        setIsPilotMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsPilotMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedAirframeDraft, isPilotMenuOpen]);

  useEffect(() => {
    if (!memberActionMenuForId) return undefined;

    const handlePointerDown = (event) => {
      if (memberActionMenuRef.current && !memberActionMenuRef.current.contains(event.target)) {
        setMemberActionMenuForId('');
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMemberActionMenuForId('');
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [memberActionMenuForId]);

  useEffect(() => {
    if (!pendingSquadronAction) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !isSquadronActionBusy) {
        setPendingSquadronAction('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pendingSquadronAction, isSquadronActionBusy]);

  function getAirframeStatusLabel(statusKey) {
    const path = `lidc.airframes.statusOptions.${statusKey}`;
    const label = t(path);
    return label === path ? statusKey : label;
  }

  function openAirframeEditor(row) {
    if (!row) return;
    setAirframeEditorError('');
    setIsPilotMenuOpen(false);
    setSelectedAirframeDraft({
      id: row.id,
      pilotUserId: row.pilotUserId,
    });
  }

  function closeAirframeEditor() {
    setSelectedAirframeDraft(null);
    setAirframeEditorError('');
    setAirframeEditorSaving(false);
    setIsPilotMenuOpen(false);
  }

  function updateAirframeDraft(value) {
    setSelectedAirframeDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, pilotUserId: value };
    });
    setIsPilotMenuOpen(false);
  }

  async function saveAirframeEditorDraft() {
    if (!selectedAirframeDraft) return;

    const row = airframeRows.find((entry) => entry.id === selectedAirframeDraft.id);
    if (!row) {
      closeAirframeEditor();
      return;
    }

    const pilotUserId = String(selectedAirframeDraft.pilotUserId || '');

    if (pilotUserId && !squadronMembersById.has(pilotUserId)) {
      setAirframeEditorError(t('lidc.airframes.validation.pilotMustBeMember'));
      return;
    }

    setAirframeEditorError('');
    setAirframeEditorSaving(true);
    setAirframeUpdateError('');

    try {
      const squadronId = activeSquadron?.id || userLidcState?.squadron?.id || '';
      const currentPilotUserId = String(row.assignedPilotUserId || '');
      if (squadronId && pilotUserId !== currentPilotUserId) {
        setUpdatingAirframeId(row.id);
        const response = await api.assignLidcAirframePilot(
          squadronId,
          row.id,
          pilotUserId || null,
        );
        setActiveSquadron(response?.squadron || null);
      }

      closeAirframeEditor();
    } catch (error) {
      setAirframeEditorError(error.message || t('lidc.errors.airframeAssignFailed'));
    } finally {
      setUpdatingAirframeId('');
      setAirframeEditorSaving(false);
    }
  }

  function getPendingSquadronActionText() {
    if (pendingSquadronAction === 'leave') return t('lidc.center.confirmActionLeave');
    if (pendingSquadronAction === 'delete') return t('lidc.center.confirmActionDelete');
    return '';
  }

  function renderSquadronManagementActions() {
    if (!SHOW_SQUADRON_LEAVE_DELETE_UI || !isViewingOwnSquadron) return null;

    return (
      <div className="lidc-squadron-management-actions">
        {!isCurrentUserOwner && (
          <span className="lidc-squadron-management-actions-hint">
            {t('lidc.center.deleteOwnerOnlyHint')}
          </span>
        )}
        <button
          type="button"
          className="lidc-btn lidc-btn-outline"
          onClick={() => openSquadronActionConfirm('leave')}
          disabled={isSquadronActionBusy}
        >
          {leavingSquadron ? <Loader2 size={14} className="spin" /> : <X size={14} />}
          {t('lidc.center.leaveSquadron')}
        </button>
        <button
          type="button"
          className="lidc-btn lidc-btn-danger"
          onClick={() => openSquadronActionConfirm('delete')}
          disabled={isSquadronActionBusy || !isCurrentUserOwner}
          title={!isCurrentUserOwner ? t('lidc.center.deleteOwnerOnlyHint') : t('lidc.center.deleteSquadron')}
        >
          {deletingSquadron ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
          {t('lidc.center.deleteSquadron')}
        </button>
      </div>
    );
  }

  function renderAirframeTable({ interactive = false } = {}) {
    if (loadingSquadronDetails) {
      return (
        <div className="lidc-loading">
          <Loader2 size={14} className="spin" />
          <span>{t('lidc.general.loading')}</span>
        </div>
      );
    }

    if (squadronDetailsError) {
      return <div className="lidc-inline-error">{squadronDetailsError}</div>;
    }

    if (airframeRows.length === 0) {
      return <div className="lidc-muted-box">{t('lidc.airframes.empty')}</div>;
    }

    return (
      <>
        {interactive && airframeUpdateError && (
          <div className="lidc-inline-error">{airframeUpdateError}</div>
        )}
        <div className={`lidc-airframe-table-wrap ${interactive ? 'is-interactive' : 'is-readonly'}`}>
        <table className="lidc-airframe-table">
          <thead>
            <tr>
              <th>{t('lidc.airframes.columns.model')}</th>
              <th>{t('lidc.airframes.columns.pilot')}</th>
              <th>{t('lidc.airframes.columns.base')}</th>
              <th>{t('lidc.airframes.columns.boardNumber')}</th>
              <th>{t('lidc.airframes.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {airframeRows.map((airframe) => {
              const statusClassName = `lidc-status-pill is-${airframe.status}`;
              const isUpdating = updatingAirframeId === airframe.id;

              return (
                <tr
                  key={airframe.id}
                  className={[
                    isUpdating ? 'is-updating' : '',
                    interactive ? 'is-clickable' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={interactive ? () => openAirframeEditor(airframe) : undefined}
                >
                  <td>
                    <div className="lidc-airframe-cell-main">
                      <strong>{airframe.model}</strong>
                      <span>{airframe.unitLabel || airframe.unitId}</span>
                    </div>
                  </td>
                  <td>{airframe.pilotLabel}</td>
                  <td>{airframe.baseLabel}</td>
                  <td><code>{airframe.boardNumber}</code></td>
                  <td>
                    <span className={statusClassName}>
                      {getAirframeStatusLabel(airframe.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {interactive && (
          <div className="lidc-airframe-table-hint">{t('lidc.airframes.rowHint')}</div>
        )}
        </div>
      </>
    );
  }

  function renderMembersTable({ interactive = false, flush = false } = {}) {
    if (loadingSquadronDetails) {
      return (
        <div className="lidc-loading">
          <Loader2 size={14} className="spin" />
          <span>{t('lidc.general.loading')}</span>
        </div>
      );
    }

    if (squadronDetailsError) {
      return <div className="lidc-inline-error">{squadronDetailsError}</div>;
    }

    if (memberRows.length === 0) {
      return <div className="lidc-muted-box">{t('lidc.members.empty')}</div>;
    }

    return (
      <div className={`lidc-airframe-table-wrap lidc-member-table-wrap ${interactive ? 'is-interactive' : 'is-readonly'} ${flush ? 'is-flush' : ''}`}>
        <table className="lidc-airframe-table lidc-member-table">
          <thead>
            <tr>
              <th>{t('lidc.members.columns.user')}</th>
              <th title={t('lidc.members.columns.aircrafts')}>
                <span className="lidc-member-count-head">
                  <Plane size={14} />
                  <span className="lidc-member-count-head-label">{t('lidc.members.columns.aircraftsShort')}</span>
                </span>
              </th>
              <th title={t('lidc.members.columns.helicopters')}>
                <span className="lidc-member-count-head">
                  <Helicopter size={14} />
                  <span className="lidc-member-count-head-label">{t('lidc.members.columns.helicoptersShort')}</span>
                </span>
              </th>
              <th title={t('lidc.members.columns.logistics')}>
                <span className="lidc-member-count-head">
                  <Forklift size={14} />
                  <span className="lidc-member-count-head-label">{t('lidc.members.columns.logisticsShort')}</span>
                </span>
              </th>
              <th>{t('lidc.members.columns.role')}</th>
              {interactive && <th>{t('lidc.members.columns.actions')}</th>}
            </tr>
          </thead>
          <tbody>
            {memberRows.map((member) => (
              <tr key={member.memberId}>
                <td>
                  <div className="lidc-member-user-cell">
                    {member.avatarUrl ? (
                      <img src={member.avatarUrl} alt={member.displayName} className="lidc-member-table-avatar" />
                    ) : (
                      <span className="lidc-member-table-avatar lidc-member-table-avatar-fallback">{member.avatarFallback}</span>
                    )}
                    <div className="lidc-airframe-cell-main">
                      <strong>{member.displayName}</strong>
                    </div>
                  </div>
                </td>
                <td className="lidc-member-count-cell">
                  <span className={`lidc-member-count-badge ${member.assignedAircraftCountA === 0 ? 'is-zero' : ''}`}>
                    {member.assignedAircraftCountA}
                  </span>
                </td>
                <td className="lidc-member-count-cell">
                  <span className={`lidc-member-count-badge ${member.assignedAircraftCountH === 0 ? 'is-zero' : ''}`}>
                    {member.assignedAircraftCountH}
                  </span>
                </td>
                <td className="lidc-member-count-cell">
                  <span className={`lidc-member-count-badge ${member.assignedAircraftCountL === 0 ? 'is-zero' : ''}`}>
                    {member.assignedAircraftCountL}
                  </span>
                </td>
                <td>
                  <span className={`lidc-member-role-chip ${member.role === 'owner' ? 'is-owner' : ''} ${member.role === 'admin' ? 'is-admin' : ''}`}>
                    {member.roleLabel}
                  </span>
                </td>
                {interactive && (
                  <td>
                    <div className="lidc-member-actions" ref={memberActionMenuForId === member.memberId ? memberActionMenuRef : null}>
                      <button
                        type="button"
                        className={`lidc-member-action-trigger ${memberActionMenuForId === member.memberId ? 'is-open' : ''}`}
                        onClick={() => setMemberActionMenuForId((prev) => (prev === member.memberId ? '' : member.memberId))}
                      >
                        {t('lidc.members.actions.label')}
                        <ChevronDown size={12} />
                      </button>

                      {memberActionMenuForId === member.memberId && (
                        <div className="lidc-member-action-menu" role="menu">
                          <button
                            type="button"
                            className="lidc-member-action-menu-item"
                            disabled={member.role === 'owner' || member.role === 'admin'}
                          >
                            {t('lidc.members.actions.promote')}
                          </button>
                          <button
                            type="button"
                            className="lidc-member-action-menu-item"
                            disabled={member.role === 'owner' || member.role !== 'admin'}
                          >
                            {t('lidc.members.actions.demote')}
                          </button>
                          <button
                            type="button"
                            className="lidc-member-action-menu-item is-danger"
                            disabled={member.role === 'owner'}
                          >
                            {t('lidc.members.actions.remove')}
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function renderExpandedPanelContent() {
    if (fullscreenPanelView === 'deck') {
      return (
        <div className="lidc-panel-deck-expanded-content">
          {renderAirframeTable({ interactive: true })}
        </div>
      );
    }

    if (fullscreenPanelView === 'members') {
      return (
        <div className="lidc-panel-deck-expanded-content is-members-expanded">
          {renderSquadronManagementActions()}
          {renderMembersTable({ interactive: true, flush: true })}
        </div>
      );
    }

    return null;
  }

  function renderMembersExpandHint() {
    if (
      fullscreenPanelView
      || !isManagementFocusView
      || loadingSquadronDetails
      || squadronDetailsError
    ) {
      return null;
    }

    return (
      <button
        type="button"
        className="lidc-panel-deck-expand-hint"
        onClick={() => openFullscreenPanel('members')}
      >
        <Maximize2 size={13} />
        {t('lidc.members.expandHint')}
      </button>
    );
  }

  function renderExpandableTablePreview({ view, title, hint, children, flush = false }) {
    const canExpand = !loadingSquadronDetails && !squadronDetailsError;

    if (!canExpand) {
      return (
        <div className={['lidc-panel-table-preview-static', flush && 'is-flush'].filter(Boolean).join(' ')}>
          {children}
        </div>
      );
    }

    if (flush) {
      return (
        <div className="lidc-panel-table-preview-static is-flush">
          {children}
        </div>
      );
    }

    return (
      <div
        className="lidc-panel-table-preview"
        role="button"
        tabIndex={0}
        onClick={() => openFullscreenPanel(view)}
        onKeyDown={(event) => handlePreviewExpandKeyDown(event, view)}
        aria-label={hint}
      >
        <div className="lidc-panel-table-preview-head">
          <span>{title}</span>
          <span className="lidc-panel-table-preview-hint">
            <Maximize2 size={13} />
            {hint}
          </span>
        </div>
        {children}
      </div>
    );
  }

  function renderDeckVisualizationView() {
    return (
      <div className="lidc-squadron-view-stack lidc-deck-visualization">
        {renderExpandableTablePreview({
          view: 'deck',
          title: t('lidc.views.deck'),
          hint: t('lidc.deck.expandHint'),
          children: renderAirframeTable({ interactive: false }),
        })}
      </div>
    );
  }

  function renderMemberManagementView() {
    return renderExpandableTablePreview({
      view: 'members',
      title: t('lidc.sidebar.memberManagement'),
      hint: t('lidc.members.expandHint'),
      flush: true,
      children: renderMembersTable({ interactive: false, flush: true }),
    });
  }

  function renderCenterStage() {
    const adminEditorButton = user?.canEditWiki ? (
      <button type="button" className="lidc-btn lidc-btn-outline" onClick={openTemplateEditor}>
        <Settings size={14} />
        {t('lidc.admin.openEditor')}
      </button>
    ) : null;

    if (loadingUserState) {
      return (
        <div className="lidc-center-card">
          <div className="lidc-loading">
            <Loader2 size={16} className="spin" />
            <span>{t('lidc.general.loadingUserState')}</span>
          </div>
        </div>
      );
    }

    if (panelMode === 'join') {
      return (
        <div className="lidc-center-card">
          <div className="lidc-center-head">
            <h2>{t('lidc.center.joinTitle')}</h2>
            <p>{t('lidc.center.joinHint')}</p>
          </div>

          <div className="lidc-join-code-panel">
            <label className="lidc-field">
              <span>{t('lidc.inviteCode.label')}</span>
              <input
                value={joinInviteCode}
                onChange={(event) => setJoinInviteCode(event.target.value.toUpperCase())}
                placeholder={t('lidc.inviteCode.placeholder')}
                maxLength={9}
                className="lidc-invite-code-input"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            {joinError && <div className="lidc-inline-error">{joinError}</div>}
          </div>

          <div className="lidc-center-actions">
            <button
              type="button"
              className="lidc-btn lidc-btn-outline"
              onClick={() => {
                setPanelMode('home');
                setJoinError('');
                setJoinInviteCode('');
              }}
            >
              <ChevronLeft size={14} />
              {t('lidc.center.backHome')}
            </button>
            <button
              type="button"
              className="lidc-btn lidc-btn-primary"
              onClick={handleJoinSquadron}
              disabled={!joinInviteCode.trim() || joiningSquadron}
            >
              {joiningSquadron ? <Loader2 size={14} className="spin" /> : <UserPlus size={14} />}
              {t('lidc.home.joinSquadron')}
            </button>
          </div>
          {adminEditorButton}
        </div>
      );
    }

    return null;
  }

  function renderSquadronListPanel() {
    return (
      <section className="lidc-panel lidc-panel-list">
        <h2 className="lidc-panel-title">{t('lidc.sidebar.squadronList')}</h2>
        <div className="lidc-panel-rows">
          {isLogged && loadingListedSquadrons && (
            <div className="lidc-panel-row lidc-panel-row--static">
              <Loader2 size={18} className="spin" />
              <span>{t('lidc.general.loading')}</span>
            </div>
          )}

          {isLogged && !loadingListedSquadrons && listedSquadronsError && (
            <div className="lidc-inline-error">{listedSquadronsError}</div>
          )}

          {isLogged && !loadingListedSquadrons && !listedSquadronsError && listedSquadrons.length === 0 && (
            <div className="lidc-muted-box">{t('lidc.squadrons.listEmpty')}</div>
          )}

          {isLogged && !loadingListedSquadrons && listedSquadrons.map((squadron) => {
            const isSelected = selectedListSquadronId === squadron.id;
            const logo = String(squadron.logoDataUrl || '');

            return (
              <button
                key={squadron.id}
                type="button"
                className={`lidc-panel-row lidc-panel-row--squadron ${isSelected ? 'is-active' : ''}`}
                onClick={() => setSelectedListSquadronId(squadron.id)}
              >
                {logo ? (
                  <img src={logo} alt="" className="lidc-panel-row-logo" />
                ) : (
                  <span className="lidc-panel-row-logo lidc-panel-row-logo-fallback" aria-hidden="true">
                    {getSquadronInitial(squadron.name)}
                  </span>
                )}
                <span className="lidc-panel-row-name">{squadron.name}</span>
              </button>
            );
          })}
        </div>
      </section>
    );
  }

  function renderMySquadronRows() {
    if (loadingUserState) {
      return (
        <div className="lidc-panel-row lidc-panel-row--static">
          <Loader2 size={18} className="spin" />
          <span>{t('lidc.general.loadingUserState')}</span>
        </div>
      );
    }

    if (!isLogged) {
      return null;
    }

    if (!userHasSquadron) {
      return null;
    }

    const rows = [
      { label: t('lidc.squadrons.totalPersonnel'), value: String(squadronSummaryStats.totalPersonnel) },
      { label: t('lidc.squadrons.totalAirframes'), value: String(squadronSummaryStats.totalAirframes) },
    ];

    return rows.map((row) => (
      <div key={row.label} className="lidc-panel-row lidc-panel-row--static">
        <span>{row.label}</span>
        <strong>{row.value}</strong>
      </div>
    ));
  }

  function renderMySquadronPanel() {
    const showNoSquadronActions = isLogged && !userHasSquadron && !loadingUserState;
    const showDiscordCta = !isLogged && !loadingUserState;
    const squadronTitle = userHasSquadron
      ? previewIdentity.name
      : t('lidc.home.mySquadronTitle');

    return (
      <section className="lidc-panel lidc-panel-squadron">
        <h2 className="lidc-panel-title">{squadronTitle}</h2>

        {isLogged && !showNoSquadronActions && (
          <div className="lidc-panel-rows">
            {renderMySquadronRows()}
          </div>
        )}

        {isLogged && catalogError && <div className="lidc-inline-error lidc-panel-inline-error">{catalogError}</div>}

        {showNoSquadronActions && (
          <div className="lidc-panel-squadron-actions">
            <button
              type="button"
              className="lidc-panel-squadron-action-btn lidc-panel-squadron-action-btn--primary"
              onClick={openCreateWizard}
            >
              {t('lidc.home.createSquadronAction')}
            </button>
            <button
              type="button"
              className="lidc-panel-squadron-action-btn"
              onClick={() => {
                setPanelMode('join');
                setJoinError('');
              }}
            >
              {t('lidc.home.joinSquadron')}
            </button>
          </div>
        )}

        {userHasSquadron && isViewingOwnSquadron && activeSquadron?.inviteCode && (
          <div className="lidc-invite-code-box">
            <span className="lidc-invite-code-label">{t('lidc.inviteCode.shareLabel')}</span>
            <div className="lidc-invite-code-row">
              <button
                type="button"
                className={`lidc-invite-code-value ${inviteCodeRevealed ? 'is-revealed' : 'is-blurred'}`}
                onClick={toggleInviteCodeVisibility}
                title={inviteCodeRevealed ? t('lidc.inviteCode.hide') : t('lidc.inviteCode.reveal')}
              >
                {formatInviteCode(activeSquadron.inviteCode)}
              </button>
              <button
                type="button"
                className="lidc-invite-code-copy"
                onClick={() => copyInviteCode(activeSquadron.inviteCode)}
              >
                {inviteCodeCopied ? <Check size={14} /> : <Copy size={14} />}
                {inviteCodeCopied ? t('lidc.inviteCode.copied') : t('lidc.inviteCode.copy')}
              </button>
            </div>
            <p className="lidc-invite-code-hint">{t('lidc.inviteCode.shareHint')}</p>
          </div>
        )}

        {showDiscordCta && (
          <a href="/api/auth/discord" className="lidc-discord-btn">
            Join our DISCORD
          </a>
        )}

        {showInlineCenterStage && (
          <div className="lidc-panel-center-stage">
            {renderCenterStage()}
          </div>
        )}
      </section>
    );
  }

  function renderDeckViewNav() {
    if (!isViewingOwnSquadron) return null;

    return (
      <div className="lidc-deck-view-nav">
        <button
          type="button"
          className={`lidc-deck-view-nav-btn ${activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_DECK ? 'is-active' : ''}`}
          onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_DECK)}
          aria-label={t('lidc.views.deck')}
          title={t('lidc.views.deck')}
        >
          <Warehouse size={16} />
        </button>
        <span className="lidc-deck-view-nav-sep" aria-hidden="true">|</span>
        <button
          type="button"
          className={`lidc-deck-view-nav-btn ${activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS ? 'is-active' : ''}`}
          onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS)}
          aria-label={t('lidc.sidebar.memberManagement')}
          title={t('lidc.sidebar.memberManagement')}
        >
          <Users size={16} />
        </button>
      </div>
    );
  }

  function renderSquadronDeckPanel() {
    const showLockedOverlay = !userHasSquadron && !loadingUserState && !fullscreenPanelView;
    const hasSelectedSquadron = Boolean(activeSquadron);
    const expandedTitle = fullscreenPanelView === 'deck'
      ? t('lidc.deck.fullscreenTitle')
      : fullscreenPanelView === 'members'
        ? t('lidc.members.fullscreenTitle')
        : '';

    return (
      <section
        className={[
          'lidc-panel',
          'lidc-panel-deck',
          isManagementFocusView ? 'is-management-focus' : '',
          fullscreenPanelView ? 'is-expanded' : '',
        ].filter(Boolean).join(' ')}
        aria-expanded={Boolean(fullscreenPanelView)}
      >
        {fullscreenPanelView ? (
          <header className="lidc-panel-deck-expanded-head">
            <h2 className="lidc-panel-title">{expandedTitle}</h2>
            <button
              type="button"
              className="lidc-panel-deck-expanded-close"
              onClick={closeFullscreenPanel}
              aria-label={t('lidc.wizard.close')}
            >
              <X size={18} />
            </button>
          </header>
        ) : (
          <header className="lidc-panel-deck-head">
            <div className="lidc-panel-deck-head-main">
              <h2 className="lidc-panel-title">SQUADRON DECK</h2>
              {renderDeckViewNav()}
            </div>
            {renderMembersExpandHint()}
          </header>
        )}

        <div className="lidc-panel-deck-body">
          {fullscreenPanelView ? (
            renderExpandedPanelContent()
          ) : showMemberManagementView ? (
            renderMemberManagementView()
          ) : loadingSquadronDetails ? (
            <div className="lidc-loading">
              <Loader2 size={14} className="spin" />
              <span>{t('lidc.general.loading')}</span>
            </div>
          ) : squadronDetailsError ? (
            <div className="lidc-inline-error">{squadronDetailsError}</div>
          ) : hasSelectedSquadron ? (
            renderDeckVisualizationView()
          ) : selectedListSquadronId ? (
            <div className="lidc-loading">
              <Loader2 size={14} className="spin" />
              <span>{t('lidc.general.loading')}</span>
            </div>
          ) : (
            <div className="lidc-panel-rows">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={`deck-placeholder-${index}`} className="lidc-panel-row lidc-panel-row--placeholder" />
              ))}
            </div>
          )}
        </div>
        {showLockedOverlay && <div className="lidc-panel-overlay" aria-hidden="true" />}
      </section>
    );
  }

  function renderMapPanel() {
    return (
      <aside className="lidc-panel-map" aria-label="Theater map">
        <div className="lidc-map-frame" />
      </aside>
    );
  }

  const wizardPortalTarget = typeof document !== 'undefined' ? document.body : null;
  const showNotInSquadronHomePopup = isLogged && !userHasSquadron && panelMode === 'home' && !loadingUserState;
  const showInlineCenterStage = !isWizardOpen
    && !isEntryWizardVisible
    && !showNotInSquadronHomePopup
    && !userHasSquadron
    && isLogged;

  const isDeckBoardExpanded = deckBoardExpanded;

  return (
    <div className={`lidc-page ${isDeckBoardExpanded ? 'is-deck-panel-open' : ''}`}>
      <div className="lidc-shell">
        <div className={`lidc-board ${isDeckBoardExpanded ? 'is-deck-expanded' : ''}`}>
          <div
            className={`lidc-board-slot lidc-board-slot-list ${boardPanelsCollapsed ? 'is-collapsed' : ''}`}
            aria-hidden={boardPanelsCollapsed}
          >
            {renderSquadronListPanel()}
          </div>
          <div
            className={`lidc-board-slot lidc-board-slot-squadron ${boardPanelsCollapsed ? 'is-collapsed' : ''}`}
            aria-hidden={boardPanelsCollapsed}
          >
            {renderMySquadronPanel()}
          </div>
          <div
            className={`lidc-board-slot lidc-board-slot-map ${boardPanelsCollapsed ? 'is-collapsed' : ''}`}
            aria-hidden={boardPanelsCollapsed}
          >
            {renderMapPanel()}
          </div>
          <div
            ref={deckSlotRef}
            className={`lidc-board-slot lidc-board-slot-deck ${isDeckBoardExpanded ? 'is-expanded' : ''}`}
          >
            {renderSquadronDeckPanel()}
          </div>
        </div>
      </div>

      {isEntryWizardVisible && wizardPortalTarget && createPortal(
        <div className="lidc-center-stage lidc-center-stage-global">
          {renderCenterStage()}
        </div>,
        wizardPortalTarget,
      )}

      {isWizardOpen && wizardPortalTarget && createPortal(
        <div className="lidc-wizard-root">
          <div className="lidc-wizard-backdrop" onClick={closeWizard} aria-hidden="true" />

          <section
            className={`lidc-wizard-card ${currentStepKey === 'template' ? 'lidc-wizard-card--template' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lidc-wizard-title"
          >
            <header className="lidc-wizard-head">
              <div className="lidc-wizard-head-main">
                <h2 id="lidc-wizard-title">{t('lidc.wizard.title')}</h2>
                <p>{t('lidc.wizard.subtitle')}</p>
              </div>
              <button
                type="button"
                className="lidc-wizard-close"
                onClick={closeWizard}
                aria-label={t('lidc.wizard.close')}
                title={t('lidc.wizard.close')}
              >
                <X size={18} />
              </button>
            </header>

            <div className="lidc-wizard-stepper-shell">
              <div className="lidc-wizard-steps" aria-label="Wizard steps">
                {WIZARD_STEPS.map((stepKey, index) => {
                  const isComplete = index < currentStep;
                  const isActive = index === currentStep;
                  const isUpcoming = index > currentStep;

                  return (
                    <div key={stepKey} className="lidc-wizard-step-col">
                      <button
                        type="button"
                        onClick={() => isComplete && setCurrentStep(index)}
                        disabled={!isComplete}
                        className={`lidc-progress-node ${
                          isComplete ? 'is-complete' : isActive ? 'is-active' : 'is-upcoming'
                        }`}
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={t(`lidc.steps.${stepKey}`)}
                      >
                        {isComplete ? <Check size={13} /> : <span>{index + 1}</span>}
                        {isActive && <span className="lidc-progress-pulse" aria-hidden="true" />}
                      </button>

                      <span className={`lidc-progress-label ${isActive ? 'is-active' : ''}`}>
                        {t(`lidc.steps.${stepKey}`)}
                      </span>

                      {index < WIZARD_STEPS.length - 1 && (
                        <div className={`lidc-progress-connector ${index < currentStep ? 'is-complete' : ''}`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={`lidc-wizard-body ${currentStepKey === 'template' ? 'lidc-wizard-body--template' : ''}`}>
              {currentStepKey === 'info' && (
                <section className="lidc-step-section">
                  <header className="lidc-step-section-head">
                    <h3>{t('lidc.wizard.sections.infoTitle')}</h3>
                    <p>{t('lidc.wizard.sections.infoHint')}</p>
                  </header>

                  <div className="lidc-form-stack">
                    <label className="lidc-field">
                      <span>{t('lidc.info.name')}</span>
                      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={120} />
                    </label>

                    <label className="lidc-field">
                      <span>{t('lidc.info.description')}</span>
                      <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} maxLength={1200} />
                    </label>

                    <label className="lidc-field">
                      <span>{t('lidc.info.base')}</span>
                      <select value={baseId} onChange={(event) => setBaseId(event.target.value)}>
                        <option value="">{t('lidc.info.basePlaceholder')}</option>
                        {airports.map((entry) => (
                          <option key={entry.id} value={entry.id}>{entry.displayName || entry.name}</option>
                        ))}
                      </select>
                    </label>

                    <div className="lidc-field">
                      <span>{t('lidc.info.logo')}</span>
                      <label className="lidc-upload-btn">
                        <Upload size={14} />
                        <span>{t('lidc.info.logoUpload')}</span>
                        <input type="file" accept="image/*" onChange={handleLogoUpload} />
                      </label>
                      {logoDataUrl && <img src={logoDataUrl} alt="Logo preview" className="lidc-logo-preview" />}
                    </div>
                  </div>
                </section>
              )}

              {currentStepKey === 'template' && (
                <section className="lidc-step-section">
                  <header className="lidc-step-section-head">
                    <h3>{t('lidc.wizard.sections.templateTitle')}</h3>
                    <p>{t('lidc.wizard.sections.templateHint')}</p>
                  </header>

                  <div className="lidc-template-plan-list">
                    {templates.map((entry, index) => {
                      const isSelected = templateId === entry.id;
                      const totalCap = CATEGORY_META.reduce((sum, { key }) => sum + Number(entry?.caps?.[key] || 0), 0);
                      return (
                        <button
                          type="button"
                          key={entry.id}
                          className={`lidc-template-plan ${isSelected ? 'is-selected' : ''}`}
                          onClick={() => setTemplateId(entry.id)}
                        >
                          <div className="lidc-template-plan-main">
                            <div className="lidc-template-plan-head">
                              <span className={`lidc-template-radio ${isSelected ? 'is-selected' : ''}`} aria-hidden="true" />
                              <div className="lidc-template-plan-title-wrap">
                                <h4>{entry.name}</h4>
                                {index === 0 && <span className="lidc-template-badge">{t('lidc.template.recommended')}</span>}
                              </div>
                            </div>

                            <p>{entry.description || t('lidc.template.noDescription')}</p>

                            <ul className="lidc-template-plan-features">
                              {CATEGORY_META.map(({ key, labelKey }) => (
                                <li key={key}>
                                  <Check size={13} />
                                  <span>{t(labelKey)}: <strong>{Number(entry?.caps?.[key] || 0)}</strong></span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          <div className="lidc-template-plan-footer">
                            <span>{t('lidc.template.totalCap')}</span>
                            <strong>{totalCap}</strong>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {currentStepKey === 'deck' && (
                <section className="lidc-step-section">
                  <header className="lidc-step-section-head">
                    <h3>{t('lidc.wizard.sections.deckTitle')}</h3>
                    <p>{t('lidc.wizard.sections.deckHint')}</p>
                  </header>

                  <div className="lidc-deck-sections">
                    {CATEGORY_META.map(({ key, labelKey }) => (
                      <section key={key} className="lidc-deck-category">
                        <header>
                          <h3>{t(labelKey)}</h3>
                          <span className={`lidc-cap-pill ${spentByCategory[key] > capsByCategory[key] ? 'is-over' : ''}`}>
                            {t('lidc.deck.remaining')}: <strong>{remainingByCategory[key]}</strong>
                          </span>
                        </header>

                        <div className="lidc-unit-list">
                          {(unitsByCategory[key] || []).map((unit) => {
                          const qty = Number(quantities[unit.id] || 0);
                          const canIncrease = selectedTemplate && ((remainingByCategory[key] || 0) >= unit.cost || qty > 0);
                          const isBlocked = qty <= 0 && !canIncrease;
                          const rowClassName = [
                            'lidc-unit-row',
                            isBlocked ? 'is-blocked' : '',
                          ].filter(Boolean).join(' ');

                          return (
                              <div key={unit.id} className={rowClassName}>
                                <div className="lidc-unit-main">
                                  <div className="lidc-unit-name"><strong>{unit.label}</strong></div>
                                  <div className="lidc-unit-meta">
                                    <span className={`lidc-unit-cost-chip ${qty > 0 ? 'is-selected' : ''}`} title={t('lidc.deck.unitCost', { cost: unit.cost })}>
                                      <Coins size={13} />
                                      <strong>{qty > 0 ? unit.cost * qty : unit.cost}</strong>
                                    </span>
                                  </div>
                                </div>
                                <div className="lidc-stepper-controls">
                                  <button type="button" className="lidc-icon-btn" onClick={() => updateQuantity(unit, qty - 1)} disabled={qty <= 0}>-</button>
                                  <span className="lidc-unit-qty">{qty}</span>
                                  <button type="button" className="lidc-icon-btn" onClick={() => updateQuantity(unit, qty + 1)} disabled={!canIncrease}>+</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>
              )}

              {currentStepKey === 'review' && (
                <section className="lidc-step-section">
                  <header className="lidc-step-section-head">
                    <h3>{t('lidc.wizard.sections.reviewTitle')}</h3>
                    <p>{t('lidc.wizard.sections.reviewHint')}</p>
                  </header>

                  <div className="lidc-review-panel">
                    <div className="lidc-review-line"><span>{t('lidc.info.name')}</span><strong>{name || '-'}</strong></div>
                    <div className="lidc-review-line"><span>{t('lidc.info.base')}</span><strong>{previewBase?.displayName || '-'}</strong></div>
                    <div className="lidc-review-line"><span>{t('lidc.template.title')}</span><strong>{selectedTemplate?.name || '-'}</strong></div>
                    <div className="lidc-review-line"><span>{t('lidc.inviteCode.generatedOnCreate')}</span><strong>{t('lidc.inviteCode.yes')}</strong></div>
                    <div className="lidc-review-line"><span>{t('lidc.deck.totalUnits')}</span><strong>{totalDeckUnits}</strong></div>

                    <div className="lidc-review-assets">
                      <h4>{t('lidc.review.assetsTitle')}</h4>
                      {CATEGORY_META.map(({ key, labelKey }) => {
                        const entries = deckPayload[key] || [];
                        if (entries.length === 0) return null;

                        return (
                          <section key={key} className="lidc-review-assets-group">
                            <div className="lidc-review-assets-head">
                              <span>{t(labelKey)}</span>
                              <strong>{spentByCategory[key] || 0}</strong>
                            </div>
                            <div className="lidc-review-assets-list">
                              {entries.map((entry) => {
                                const unit = units.find((candidate) => candidate.id === entry.unitId);
                                const unitCost = Number(unit?.cost || 0);
                                const quantity = Number(entry.quantity || 0);
                                return (
                                  <div key={`${key}-${entry.unitId}`} className="lidc-review-asset-item">
                                    <span>{unit?.label || entry.unitId} x{quantity}</span>
                                    <strong>{unitCost * quantity}</strong>
                                  </div>
                                );
                              })}
                            </div>
                          </section>
                        );
                      })}
                    </div>

                    {submitError && <div className="lidc-inline-error">{submitError}</div>}
                  </div>
                </section>
              )}
            </div>

            <footer className="lidc-wizard-actions">
              <button
                type="button"
                className="lidc-btn lidc-btn-outline"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                disabled={currentStep === 0}
              >
                <ChevronLeft size={14} />
                {t('lidc.general.back')}
              </button>

              {currentStep < WIZARD_STEPS.length - 1 ? (
                <button type="button" className="lidc-btn lidc-btn-primary" onClick={goToNextStep} disabled={!canGoNextStep}>
                  {t('lidc.general.next')}
                  <ChevronRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  className="lidc-btn lidc-btn-primary"
                  onClick={handleCreateSquadron}
                  disabled={!validation.canSubmit || submitting}
                >
                  {submitting ? <Loader2 size={14} className="spin" /> : <Disc3 size={14} />}
                  {t('lidc.review.createButton')}
                </button>
              )}
            </footer>

            {currentStepBlockingError && currentStep < WIZARD_STEPS.length - 1 && (
              <div className="lidc-inline-error lidc-wizard-error">{t('lidc.wizard.requiredToContinue')}: {currentStepBlockingError}</div>
            )}
          </section>
        </div>,
        wizardPortalTarget,
      )}

      {selectedAirframeDraft && (
        <div className="lidc-modal-root">
          <button type="button" className="lidc-modal-backdrop" onClick={closeAirframeEditor} />
          <div className="lidc-modal-card lidc-airframe-modal-card">
            <div className="lidc-modal-head">
              <h3>{t('lidc.airframes.editorTitle')}</h3>
            </div>

            {selectedAirframeRow ? (
              <>
                <div className="lidc-airframe-meta-stack">
                  <div className="lidc-airframe-readonly-grid">
                    <article className="lidc-airframe-readonly-item">
                      <span>{t('lidc.airframes.columns.model')}</span>
                      <strong>{selectedAirframeRow.model}</strong>
                    </article>
                    <article className="lidc-airframe-readonly-item">
                      <span>{t('lidc.airframes.columns.base')}</span>
                      <strong>{selectedAirframeRow.baseLabel}</strong>
                    </article>
                    <article className="lidc-airframe-readonly-item">
                      <span>{t('lidc.airframes.columns.boardNumber')}</span>
                      <strong>{selectedAirframeRow.boardNumber}</strong>
                    </article>
                    <article className="lidc-airframe-readonly-item">
                      <span>{t('lidc.airframes.columns.status')}</span>
                      <strong>{getAirframeStatusLabel(selectedAirframeRow.status)}</strong>
                    </article>
                  </div>

                  <div className="lidc-airframe-pilot-grid">
                    <article className="lidc-airframe-pilot-cell">
                      <div className="lidc-airframe-pilot-box">
                        <div className="lidc-airframe-inline-field" ref={pilotMenuRef}>
                          <span>{t('lidc.airframes.columns.pilot')}</span>
                          <button
                            type="button"
                            className={`lidc-airframe-pilot-trigger ${isPilotMenuOpen ? 'is-open' : ''}`}
                            aria-haspopup="listbox"
                            aria-expanded={isPilotMenuOpen}
                            onClick={() => setIsPilotMenuOpen((prev) => !prev)}
                          >
                            <span className="lidc-airframe-pilot-trigger-main">
                              {selectedPilotAvatarUrl ? (
                                <img src={selectedPilotAvatarUrl} alt={selectedPilotLabel} className="lidc-airframe-pilot-avatar" />
                              ) : (
                                <span className="lidc-airframe-pilot-avatar lidc-airframe-pilot-avatar-fallback">
                                  {selectedPilotProfile ? getUserInitial(selectedPilotProfile) : '-'}
                                </span>
                              )}
                              <span className="lidc-airframe-pilot-trigger-label">{selectedPilotLabel}</span>
                            </span>
                            <ChevronDown size={13} className={`lidc-airframe-pilot-caret ${isPilotMenuOpen ? 'is-open' : ''}`} />
                          </button>

                          {isPilotMenuOpen && (
                            <div className="lidc-airframe-pilot-menu" role="listbox">
                              <button
                                type="button"
                                className={`lidc-airframe-pilot-option ${selectedPilotUserId ? '' : 'is-selected'}`}
                                onClick={() => updateAirframeDraft('')}
                              >
                                <span className="lidc-airframe-pilot-avatar lidc-airframe-pilot-avatar-fallback">-</span>
                                <span className="lidc-airframe-pilot-option-label">{t('lidc.airframes.unassigned')}</span>
                              </button>
                              {squadronMembers.map((member) => {
                                const memberId = String(member.userId || '');
                                const label = formatUserLabel(member);
                                const avatarUrl = String(member.avatarUrl || '');
                                const isSelected = selectedPilotUserId === memberId;

                                return (
                                  <button
                                    type="button"
                                    key={memberId}
                                    className={`lidc-airframe-pilot-option ${isSelected ? 'is-selected' : ''}`}
                                    onClick={() => updateAirframeDraft(memberId)}
                                  >
                                    {avatarUrl ? (
                                      <img src={avatarUrl} alt={label} className="lidc-airframe-pilot-avatar" />
                                    ) : (
                                      <span className="lidc-airframe-pilot-avatar lidc-airframe-pilot-avatar-fallback">
                                        {getUserInitial(member)}
                                      </span>
                                    )}
                                    <span className="lidc-airframe-pilot-option-label">{label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  </div>
                </div>

                <section className="lidc-airframe-log-panel">
                  <header>
                    <h4>{t('lidc.airframes.logsTitle')}</h4>
                    <span>{t('lidc.airframes.logsMockBadge')}</span>
                  </header>
                  <div className="lidc-airframe-log-list">
                    {(selectedAirframeRow.logs || []).map((log) => (
                      <article
                        key={log.id}
                        className={`lidc-airframe-log-line is-${String(log.type || 'unknown').toLowerCase()}`}
                      >
                        <p className="lidc-airframe-log-line-text">
                          [{formatLogTime(log.at)}] {log.detail}
                        </p>
                      </article>
                    ))}
                  </div>
                </section>
              </>
            ) : (
              <div className="lidc-muted-box">{t('lidc.airframes.empty')}</div>
            )}

            {(airframeEditorError || airframeUpdateError) && (
              <div className="lidc-inline-error">{airframeEditorError || airframeUpdateError}</div>
            )}

            <div className="lidc-modal-actions">
              <button type="button" className="lidc-btn lidc-btn-outline" onClick={closeAirframeEditor}>
                {t('lidc.general.cancel')}
              </button>
              <button
                type="button"
                className="lidc-btn lidc-btn-primary"
                onClick={saveAirframeEditorDraft}
                disabled={airframeEditorSaving || !selectedAirframeRow}
              >
                {airframeEditorSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                {t('lidc.airframes.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingSquadronAction && (
        <div className="lidc-modal-root lidc-confirm-modal-root">
          <button
            type="button"
            className="lidc-modal-backdrop lidc-confirm-modal-backdrop"
            onClick={closeSquadronActionConfirm}
          />
          <div className="lidc-modal-card lidc-confirm-modal-card" role="dialog" aria-modal="true">
            <div className="lidc-modal-head">
              <h3>{t('lidc.center.confirmTitle')}</h3>
              <p>{t('lidc.center.confirmQuestion', { action: getPendingSquadronActionText() })}</p>
            </div>

            <div className="lidc-modal-actions lidc-confirm-modal-actions">
              <button
                type="button"
                className="lidc-btn lidc-btn-outline"
                onClick={closeSquadronActionConfirm}
                disabled={isSquadronActionBusy}
              >
                {t('lidc.general.cancel')}
              </button>
              <button
                type="button"
                className={`lidc-btn ${pendingSquadronAction === 'delete' ? 'lidc-btn-danger' : 'lidc-btn-primary'}`}
                onClick={confirmPendingSquadronAction}
                disabled={isSquadronActionBusy}
              >
                {isSquadronActionBusy ? (
                  <Loader2 size={14} className="spin" />
                ) : (
                  pendingSquadronAction === 'delete' ? <Trash2 size={14} /> : <X size={14} />
                )}
                {t('lidc.general.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {isTemplateEditorOpen && (
        <div className="lidc-modal-root">
          <button type="button" className="lidc-modal-backdrop" onClick={() => setIsTemplateEditorOpen(false)} />
          <div className="lidc-modal-card">
            <div className="lidc-modal-head">
              <h3>{t('lidc.admin.title')}</h3>
              <p>{t('lidc.admin.subtitle')}</p>
            </div>

            <textarea
              className="lidc-json-editor"
              value={templateEditorRaw}
              onChange={(event) => setTemplateEditorRaw(event.target.value)}
              spellCheck={false}
            />

            {templateEditorError && <div className="lidc-inline-error">{templateEditorError}</div>}

            <div className="lidc-modal-actions">
              <button type="button" className="lidc-btn lidc-btn-outline" onClick={() => setIsTemplateEditorOpen(false)}>
                {t('lidc.general.cancel')}
              </button>
              <button type="button" className="lidc-btn lidc-btn-primary" onClick={saveTemplateEditor} disabled={templateEditorSaving}>
                {templateEditorSaving ? <Loader2 size={14} className="spin" /> : <Save size={14} />}
                {t('lidc.admin.save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
