import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Coins,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Disc3,
  Forklift,
  Helicopter,
  Home,
  List,
  Loader2,
  LogIn,
  Plane,
  Save,
  Settings,
  Trash2,
  Upload,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import airports from '../config/airports';
import * as api from '../services/api';
import { t } from '../utils/locale';
import { getCampaignById } from '../config/campaigns';
import './LidcPage.css';

const LIDC_CAMPAIGN = getCampaignById('lidc-afghanistan');

const WIZARD_STEPS = ['info', 'template', 'deck', 'invites', 'review'];

const CATEGORY_META = [
  { key: 'aircrafts', labelKey: 'lidc.deck.categories.aircrafts' },
  { key: 'helicopters', labelKey: 'lidc.deck.categories.helicopters' },
  { key: 'logistics', labelKey: 'lidc.deck.categories.logistics' },
  { key: 'groundAssets', labelKey: 'lidc.deck.categories.groundAssets' },
];

const LIDC_SIDEBAR_VIEWS = Object.freeze({
  SQUADRON_LIST: 'squadronList',
  SQUADRON_MEMBERS: 'squadronMembers',
  SQUADRON_AIRCRAFTS: 'squadronAircrafts',
});

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

export default function LidcPage({ onNavigateHome }) {
  const { user } = useUser();

  const [templates, setTemplates] = useState([]);
  const [units, setUnits] = useState([]);
  const [inviteCandidates, setInviteCandidates] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [catalogError, setCatalogError] = useState('');

  const [activeView, setActiveView] = useState(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST);
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
  const [selectedInviteIds, setSelectedInviteIds] = useState([]);
  const [inviteSearchQuery, setInviteSearchQuery] = useState('');

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
    invites: [],
  });
  const [hideInSquadronNotice, setHideInSquadronNotice] = useState(false);
  const [activeSquadron, setActiveSquadron] = useState(null);
  const [loadingSquadronDetails, setLoadingSquadronDetails] = useState(false);
  const [squadronDetailsError, setSquadronDetailsError] = useState('');
  const [updatingAirframeId, setUpdatingAirframeId] = useState('');
  const [airframeUpdateError, setAirframeUpdateError] = useState('');
  const [selectedAirframeDraft, setSelectedAirframeDraft] = useState(null);
  const [airframeEditorError, setAirframeEditorError] = useState('');
  const [airframeEditorSaving, setAirframeEditorSaving] = useState(false);
  const [isPilotMenuOpen, setIsPilotMenuOpen] = useState(false);
  const pilotMenuRef = useRef(null);
  const [memberActionMenuForId, setMemberActionMenuForId] = useState('');
  const memberActionMenuRef = useRef(null);

  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);
  const [templateEditorRaw, setTemplateEditorRaw] = useState('');
  const [templateEditorError, setTemplateEditorError] = useState('');
  const [templateEditorSaving, setTemplateEditorSaving] = useState(false);

  function applyUserLidcState(response) {
    const nextState = {
      hasSquadron: Boolean(response?.hasSquadron),
      squadron: response?.squadron || null,
      invites: Array.isArray(response?.invites) ? response.invites : [],
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
        setCatalogError(error.message || t('lidc.errors.catalogLoadFailed'));
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    }

    loadCatalog();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadInviteCandidates() {
      if (!user) {
        setInviteCandidates([]);
        return;
      }

      setLoadingUsers(true);
      try {
        const response = await api.getLidcUsers();
        if (!mounted) return;
        setInviteCandidates(Array.isArray(response?.users) ? response.users : []);
      } catch (error) {
        if (!mounted) return;
        setInviteCandidates([]);
      } finally {
        if (mounted) setLoadingUsers(false);
      }
    }

    loadInviteCandidates();

    return () => {
      mounted = false;
    };
  }, [user]);

  const isEntryWizardVisible = !isWizardOpen
    && !loadingUserState
    && Boolean(user?.id)
    && !Boolean(userLidcState.hasSquadron)
    && (panelMode === 'home' || panelMode === 'invites');
  const shouldBlurBehindOverlay = isWizardOpen || (isEntryWizardVisible && panelMode === 'home');

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
    let mounted = true;

    async function loadUserState() {
      if (!user) {
        if (!mounted) return;
        setLoadingUserState(false);
        setUserStateError('');
        setUserLidcState({
          hasSquadron: false,
          squadron: null,
          invites: [],
        });
        setHideInSquadronNotice(false);
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
        setUserStateError(error.message || t('lidc.errors.userStateFailed'));
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
    setHideInSquadronNotice(false);
  }, [user?.id, userLidcState?.squadron?.id]);

  useEffect(() => {
    setSelectedAirframeDraft(null);
    setAirframeEditorError('');
    setAirframeEditorSaving(false);
  }, [activeSquadron?.id]);

  useEffect(() => {
    let mounted = true;

    async function loadSquadronDetails() {
      const squadronId = userLidcState?.squadron?.id;
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
  }, [user?.id, userLidcState?.squadron?.id]);

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
  const isManagementFocusView = activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS
    || activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS;
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
    setSelectedInviteIds([]);
    setInviteSearchQuery('');
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

  function toggleInvite(userId) {
    if (!userId) return;

    setSelectedInviteIds((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((entry) => entry !== userId);
      }
      return [...prev, userId];
    });
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
        invites: selectedInviteIds.map((entry) => ({ userId: entry })),
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
      }

      closeWizard();
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST);
    } catch (error) {
      if (Number(error?.status) === 409) {
        try {
          const stateResponse = await api.getLidcMe();
          const nextState = applyUserLidcState(stateResponse);
          if (nextState.hasSquadron) {
            setHideInSquadronNotice(false);
            setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST);
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
      setHideInSquadronNotice(false);
      setPanelMode('home');
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST);
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
      setHideInSquadronNotice(false);
      setPanelMode('home');
      setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST);
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

  const filteredInviteCandidates = useMemo(() => {
    const query = inviteSearchQuery.trim().toLowerCase();
    if (!query) return inviteCandidates;

    return inviteCandidates.filter((entry) => {
      const globalName = String(entry?.globalName || '').toLowerCase();
      const username = String(entry?.username || '').toLowerCase();
      const id = String(entry?.id || '').toLowerCase();
      return globalName.includes(query) || username.includes(query) || id.includes(query);
    });
  }, [inviteCandidates, inviteSearchQuery]);

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
        : (role === 'admin' ? 'Admin' : t('lidc.members.member'));
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

  function renderOverviewView() {
    const previewLogo = logoDataUrl || activeSquadron?.logoDataUrl || '';

    return (
      <div className="lidc-visual-grid">
        <article className="lidc-visual-card">
          <div className="lidc-eyebrow">{t('lidc.preview.eyebrow')}</div>
          <h2>{previewIdentity.name}</h2>
          <p>{previewIdentity.description}</p>
          <div className="lidc-preview-meta">
            <span>{t('lidc.info.base')}: {previewIdentity.baseLabel}</span>
            <span>{t('lidc.template.title')}: {previewIdentity.templateName}</span>
          </div>
        </article>

        <article className="lidc-visual-card lidc-visual-logo-card">
          {previewLogo ? (
            <img src={previewLogo} alt="Squadron logo" className="lidc-preview-logo" />
          ) : (
            <div className="lidc-preview-logo lidc-preview-logo-empty">{t('lidc.preview.logoPlaceholder')}</div>
          )}
        </article>
      </div>
    );
  }

  function renderCapsView() {
    const capsSource = activeSquadron?.costSummary?.caps || capsByCategory;
    const spentSource = activeSquadron?.costSummary?.spent || spentByCategory;

    return (
      <div className="lidc-visual-card">
        <h3>{t('lidc.preview.templateCaps')}</h3>
        <div className="lidc-visual-list">
          {CATEGORY_META.map(({ key, labelKey }) => (
            <div key={key} className="lidc-visual-row">
              <span>{t(labelKey)}</span>
              <strong>{Number(spentSource[key] || 0)} / {Number(capsSource[key] || 0)}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function getPendingSquadronActionText() {
    if (pendingSquadronAction === 'leave') return t('lidc.center.confirmActionLeave');
    if (pendingSquadronAction === 'delete') return t('lidc.center.confirmActionDelete');
    return '';
  }

  function renderSquadronManagementActions() {
    if (!userHasSquadron) return null;

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

  function renderMemberManagementView() {
    return (
      <div className="lidc-visual-card lidc-visual-card-members">
        {renderSquadronManagementActions()}

        {loadingSquadronDetails && (
          <div className="lidc-loading">
            <Loader2 size={14} className="spin" />
            <span>{t('lidc.general.loading')}</span>
          </div>
        )}

        {squadronDetailsError && <div className="lidc-inline-error">{squadronDetailsError}</div>}

        {!loadingSquadronDetails && !squadronDetailsError && squadronMembers.length === 0 && (
          <div className="lidc-muted-box">{t('lidc.members.empty')}</div>
        )}

        {!loadingSquadronDetails && !squadronDetailsError && memberRows.length > 0 && (
          <div className="lidc-airframe-table-wrap">
            <table className="lidc-airframe-table lidc-member-table">
              <thead>
                <tr>
                  <th>Utente</th>
                  <th title="Aircrafts assegnati">
                    <span className="lidc-member-count-head">
                      <Plane size={14} />
                    </span>
                  </th>
                  <th title="Helicopters assegnati">
                    <span className="lidc-member-count-head">
                      <Helicopter size={14} />
                    </span>
                  </th>
                  <th title="Logistics assegnati">
                    <span className="lidc-member-count-head">
                      <Forklift size={14} />
                    </span>
                  </th>
                  <th>Ruolo</th>
                  <th>Azioni</th>
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
                      <span className="lidc-member-assigned-count">
                        <strong>{member.assignedAircraftCountA}</strong>
                      </span>
                    </td>
                    <td className="lidc-member-count-cell">
                      <span className="lidc-member-assigned-count">
                        <strong>{member.assignedAircraftCountH}</strong>
                      </span>
                    </td>
                    <td className="lidc-member-count-cell">
                      <span className="lidc-member-assigned-count">
                        <strong>{member.assignedAircraftCountL}</strong>
                      </span>
                    </td>
                    <td>
                      <span className="lidc-member-role-text">
                        {member.roleLabel}
                      </span>
                    </td>
                    <td>
                      <div className="lidc-member-actions" ref={memberActionMenuForId === member.memberId ? memberActionMenuRef : null}>
                        <button
                          type="button"
                          className={`lidc-member-action-trigger ${memberActionMenuForId === member.memberId ? 'is-open' : ''}`}
                          onClick={() => setMemberActionMenuForId((prev) => (prev === member.memberId ? '' : member.memberId))}
                        >
                          Azioni
                          <ChevronDown size={12} />
                        </button>

                        {memberActionMenuForId === member.memberId && (
                          <div className="lidc-member-action-menu" role="menu">
                            <button
                              type="button"
                              className="lidc-member-action-menu-item"
                              disabled={member.role === 'owner' || member.role === 'admin'}
                            >
                              Promuovi
                            </button>
                            <button
                              type="button"
                              className="lidc-member-action-menu-item"
                              disabled={member.role === 'owner' || member.role !== 'admin'}
                            >
                              Degrada
                            </button>
                            <button
                              type="button"
                              className="lidc-member-action-menu-item is-danger"
                              disabled={member.role === 'owner'}
                            >
                              Rimuovi
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function renderAircraftManagementView() {
    return (
      <div className="lidc-visual-card lidc-visual-card-aircrafts">
        {renderSquadronManagementActions()}

        {loadingSquadronDetails && (
          <div className="lidc-loading">
            <Loader2 size={14} className="spin" />
            <span>{t('lidc.general.loading')}</span>
          </div>
        )}

        {squadronDetailsError && <div className="lidc-inline-error">{squadronDetailsError}</div>}
        {airframeUpdateError && <div className="lidc-inline-error">{airframeUpdateError}</div>}

        {!loadingSquadronDetails && !squadronDetailsError && airframeRows.length === 0 && (
          <div className="lidc-muted-box">{t('lidc.airframes.empty')}</div>
        )}

        {!loadingSquadronDetails && !squadronDetailsError && airframeRows.length > 0 && (
          <div className="lidc-airframe-table-wrap">
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
                      className={isUpdating ? 'is-updating' : ''}
                      onClick={() => openAirframeEditor(airframe)}
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
          </div>
        )}
      </div>
    );
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

    if (!isLogged) {
      return (
        <div className="lidc-center-card">
          <div className="lidc-center-head">
            <h2>{t('lidc.center.loginTitle')}</h2>
            <p>{t('lidc.center.loginHint')}</p>
          </div>
          <div className="lidc-auth-warning">
            <div className="lidc-auth-warning-text">
              <AlertTriangle size={16} />
              <span>{t('lidc.auth.loginToCreate')}</span>
            </div>
            <button
              type="button"
              className="lidc-btn lidc-btn-primary lidc-btn-block"
              onClick={() => { window.location.href = '/api/auth/discord'; }}
            >
              <LogIn size={14} />
              {t('lidc.auth.loginButton')}
            </button>
          </div>
        </div>
      );
    }

    if (userHasSquadron) {
      const squadronName = createdSquadron?.name || userLidcState?.squadron?.name || '-';
      return (
        <div className="lidc-center-card">
          <button
            type="button"
            className="lidc-center-dismiss-btn"
            onClick={() => setHideInSquadronNotice(true)}
            aria-label={t('lidc.wizard.close')}
            title={t('lidc.wizard.close')}
          >
            <X size={14} />
          </button>
          <div className="lidc-center-head">
            <h2>{t('lidc.center.inSquadronTitle')}</h2>
            <p>{t('lidc.center.inSquadronHint', { name: squadronName })}</p>
          </div>
          {createdSquadron && (
            <div className="lidc-success">
              <Check size={16} />
              <div>
                <div className="lidc-success-title">{t('lidc.review.created')}</div>
                <div className="lidc-success-meta">ID: {createdSquadron.id}</div>
              </div>
            </div>
          )}
          {userStateError && <div className="lidc-inline-error">{userStateError}</div>}
          <div className="lidc-center-actions">
            <button
              type="button"
              className="lidc-btn lidc-btn-outline"
              onClick={() => openSquadronActionConfirm('leave')}
              disabled={isSquadronActionBusy}
            >
              {leavingSquadron ? <Loader2 size={14} className="spin" /> : <X size={14} />}
              {t('lidc.center.leaveSquadron')}
            </button>
            {adminEditorButton}
          </div>
        </div>
      );
    }

    if (panelMode === 'invites') {
      return (
        <div className="lidc-center-card">
          <div className="lidc-center-head">
            <h2>{t('lidc.center.inviteListTitle')}</h2>
            <p>{t('lidc.center.inviteListHint')}</p>
          </div>

          {userStateError && <div className="lidc-inline-error">{userStateError}</div>}

          {userLidcState.invites.length === 0 ? (
            <div className="lidc-muted-box">{t('lidc.invites.receivedEmpty')}</div>
          ) : (
            <div className="lidc-received-list">
              {userLidcState.invites.map((invite) => {
                const invitedBy = invite?.invitedBy || {};
                const invitedByName = invitedBy.globalName || invitedBy.username || invitedBy.id || '-';
                const squadronName = invite?.squadronName || '-';
                const avatarUrl = invitedBy.avatarUrl || '';

                return (
                  <article key={`${invite.squadronId}-${invite.invitedAt}`} className="lidc-received-item">
                    <div className="lidc-received-head">
                      <span>{squadronName}</span>
                      <span className="lidc-user-tag">{t('lidc.invites.pending')}</span>
                    </div>
                    <div className="lidc-received-meta">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt={invitedByName} className="lidc-user-avatar" />
                      ) : (
                        <div className="lidc-user-avatar lidc-user-avatar-fallback">{invitedByName.slice(0, 1).toUpperCase()}</div>
                      )}
                      <div>
                        <div className="lidc-user-name">{invitedByName}</div>
                        <div className="lidc-user-sub">{formatTimestamp(invite?.invitedAt)}</div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="lidc-center-actions">
            <button type="button" className="lidc-btn lidc-btn-outline" onClick={() => setPanelMode('home')}>
              <ChevronLeft size={14} />
              {t('lidc.center.backHome')}
            </button>
            <button type="button" className="lidc-btn lidc-btn-primary" onClick={openCreateWizard}>
              <Disc3 size={14} />
              {t('lidc.home.createSquadron')}
            </button>
          </div>
          {adminEditorButton}
        </div>
      );
    }

    return (
      <div className="lidc-center-card">
        <div className="lidc-center-head">
          <h2>{t('lidc.center.notInSquadronTitle')}</h2>
          <p>{t('lidc.center.notInSquadronHint')}</p>
        </div>

        {userStateError && <div className="lidc-inline-error">{userStateError}</div>}

        <div className="lidc-home-actions">
          <button type="button" className="lidc-home-btn" onClick={openCreateWizard}>
            <Disc3 size={18} />
            <span>{t('lidc.home.createSquadron')}</span>
          </button>
          <button type="button" className="lidc-home-btn" onClick={() => setPanelMode('invites')}>
            <UserPlus size={18} />
            <span>{t('lidc.home.invitesList')}</span>
          </button>
        </div>
        {adminEditorButton}
      </div>
    );
  }

  function renderSquadronListPanel() {
    return (
      <section className="lidc-panel lidc-panel-list">
        <h2 className="lidc-panel-title">{t('lidc.sidebar.squadronList')}</h2>
        <div className="lidc-panel-rows">
          <button
            type="button"
            className={`lidc-panel-row ${activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_LIST ? 'is-active' : ''}`}
            onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST)}
          >
            <List size={18} />
            <span>{t('lidc.sidebar.squadronList')}</span>
          </button>
          <button
            type="button"
            className={`lidc-panel-row ${activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS ? 'is-active' : ''}`}
            onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS)}
          >
            <Users size={18} />
            <span>{t('lidc.sidebar.memberManagement')}</span>
          </button>
          <button
            type="button"
            className={`lidc-panel-row ${activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS ? 'is-active' : ''}`}
            onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS)}
          >
            <Plane size={18} />
            <span>{t('lidc.sidebar.aircraftManagement')}</span>
          </button>
          {!userHasSquadron && (
            <>
              <button type="button" className="lidc-panel-row" onClick={openCreateWizard}>
                <Disc3 size={18} />
                <span>{t('lidc.home.createSquadron')}</span>
              </button>
              <button type="button" className="lidc-panel-row" onClick={() => setPanelMode('invites')}>
                <UserPlus size={18} />
                <span>{t('lidc.home.invitesList')}</span>
              </button>
            </>
          )}
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
      return (
        <div className="lidc-panel-row lidc-panel-row--static">
          <LogIn size={18} />
          <span>{t('lidc.center.loginTitle')}</span>
        </div>
      );
    }

    if (activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS) {
      return memberRows.slice(0, 6).map((member) => (
        <div key={member.memberId} className="lidc-panel-row lidc-panel-row--static">
          <strong>{member.displayName}</strong>
          <span>{member.roleLabel}</span>
        </div>
      ));
    }

    if (activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS) {
      return airframeRows.slice(0, 6).map((airframe) => (
        <div key={airframe.id} className="lidc-panel-row lidc-panel-row--static">
          <strong>{airframe.model}</strong>
          <span>{airframe.boardNumber}</span>
        </div>
      ));
    }

    const rows = [
      { label: t('lidc.info.name'), value: previewIdentity.name },
      { label: t('lidc.info.base'), value: previewIdentity.baseLabel },
      { label: t('lidc.template.title'), value: previewIdentity.templateName },
      { label: t('lidc.deck.totalUnits'), value: String(effectiveTotalDeckUnits) },
    ];

    if (previewIdentity.description) {
      rows.push({ label: t('lidc.info.description'), value: previewIdentity.description });
    }

    return rows.slice(0, 6).map((row) => (
      <div key={row.label} className="lidc-panel-row lidc-panel-row--static">
        <span>{row.label}</span>
        <strong>{row.value}</strong>
      </div>
    ));
  }

  function renderMySquadronPanel() {
    const showLockedOverlay = !userHasSquadron && !loadingUserState;
    const showDiscordCta = showLockedOverlay && !isLogged;
    const squadronTitle = userHasSquadron
      ? `${t('lidc.preview.eyebrow')} - ${previewIdentity.name}`
      : 'MY SQUADRON - DCS ITALIA';

    return (
      <section className="lidc-panel lidc-panel-squadron">
        <h2 className="lidc-panel-title">{squadronTitle}</h2>
        <div className={`lidc-panel-rows ${activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_LIST ? '' : 'lidc-panel-rows--compact'}`}>
          {renderMySquadronRows()}
        </div>

        {catalogError && <div className="lidc-inline-error lidc-panel-inline-error">{catalogError}</div>}

        {showLockedOverlay && <div className="lidc-panel-overlay" aria-hidden="true" />}
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

  function renderSquadronDeckPanel() {
    const showLockedOverlay = !userHasSquadron && !loadingUserState;

    return (
      <section className={`lidc-panel lidc-panel-deck ${isManagementFocusView ? 'is-management-focus' : ''}`}>
        <h2 className="lidc-panel-title">SQUADRON DECK</h2>
        <div className="lidc-panel-deck-body">
          {activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS && renderMemberManagementView()}
          {activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS && renderAircraftManagementView()}
          {activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_LIST && (
            userHasSquadron ? (
              <div className="lidc-squadron-view-stack">
                {renderOverviewView()}
                {renderCapsView()}
              </div>
            ) : (
              <div className="lidc-panel-rows">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={`deck-placeholder-${index}`} className="lidc-panel-row lidc-panel-row--placeholder" />
                ))}
              </div>
            )
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
  const showInlineCenterStage = !isWizardOpen
    && !isEntryWizardVisible
    && !(userHasSquadron && hideInSquadronNotice);

  return (
    <div className="lidc-page">
      <div className="lidc-shell">
        <div className="lidc-campaign-bar">
          <button
            type="button"
            className="lidc-campaign-back"
            onClick={() => {
              if (typeof onNavigateHome === 'function') {
                onNavigateHome();
                return;
              }
              window.location.href = '/';
            }}
            aria-label={t('lidc.center.backHome')}
            title={t('lidc.center.backHome')}
          >
            <Home size={28} strokeWidth={2.5} />
          </button>
          <div className="lidc-campaign-title">
            {LIDC_CAMPAIGN?.label || 'LIDC - AFGHANISTAN'}
          </div>
        </div>

        <div className="lidc-board">
          {renderSquadronListPanel()}
          {renderMySquadronPanel()}
          {renderMapPanel()}
          {renderSquadronDeckPanel()}
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
          <div className="lidc-wizard-backdrop" />

          <section className="lidc-wizard-card" role="dialog" aria-modal="true">
            <header className="lidc-wizard-head">
              <div>
                <h2>{t('lidc.wizard.title')}</h2>
                <p>{t('lidc.wizard.subtitle')}</p>
              </div>
              <button type="button" className="lidc-btn lidc-btn-outline" onClick={closeWizard}>
                {t('lidc.wizard.close')}
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

            <div className="lidc-wizard-body">
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

              {currentStepKey === 'invites' && (
                <section className="lidc-step-section">
                  <header className="lidc-step-section-head">
                    <h3>{t('lidc.wizard.sections.invitesTitle')}</h3>
                    <p>{t('lidc.wizard.sections.invitesHint')}</p>
                  </header>

                  <div className="lidc-invite-panel">
                    <label className="lidc-field">
                      <span>{t('lidc.invites.searchLabel')}</span>
                      <input
                        value={inviteSearchQuery}
                        onChange={(event) => setInviteSearchQuery(event.target.value)}
                        placeholder={t('lidc.invites.searchPlaceholder')}
                        maxLength={80}
                      />
                    </label>

                    {loadingUsers && (
                      <div className="lidc-loading">
                        <Loader2 size={14} className="spin" />
                        <span>{t('lidc.general.loadingUsers')}</span>
                      </div>
                    )}

                    {!loadingUsers && inviteCandidates.length === 0 && (
                      <div className="lidc-muted-box">{t('lidc.invites.empty')}</div>
                    )}

                    {!loadingUsers && inviteCandidates.length > 0 && (
                      <div className="lidc-user-list">
                        {filteredInviteCandidates.map((entry) => {
                          const isSelected = selectedInviteIds.includes(entry.id);
                          const displayName = entry.globalName || entry.username || entry.id;
                          const avatarUrl = entry.avatarUrl || '';
                          const isSelf = user?.id && user.id === entry.id;

                          return (
                            <button
                              type="button"
                              key={entry.id}
                              className={`lidc-user-item ${isSelected ? 'is-selected' : ''}`}
                              onClick={() => !isSelf && toggleInvite(entry.id)}
                              disabled={isSelf}
                            >
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={displayName} className="lidc-user-avatar" />
                              ) : (
                                <div className="lidc-user-avatar lidc-user-avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</div>
                              )}
                              <div className="lidc-user-meta">
                                <div className="lidc-user-name">{displayName}</div>
                                <div className="lidc-user-sub">{formatTimestamp(entry.lastSeenAt)}</div>
                              </div>
                              {isSelf ? (
                                <span className="lidc-user-tag">{t('lidc.invites.you')}</span>
                              ) : (
                                <span className="lidc-user-tag">{isSelected ? t('lidc.invites.pending') : t('lidc.invites.add')}</span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {!loadingUsers && inviteCandidates.length > 0 && filteredInviteCandidates.length === 0 && (
                      <div className="lidc-muted-box">{t('lidc.invites.searchEmpty')}</div>
                    )}
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
                    <div className="lidc-review-line"><span>{t('lidc.invites.title')}</span><strong>{selectedInviteIds.length}</strong></div>
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
