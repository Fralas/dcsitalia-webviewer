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
  List,
  Loader2,
  LogIn,
  PanelLeftClose,
  PanelLeftOpen,
  Plane,
  Save,
  Settings,
  Upload,
  Users,
  UserPlus,
  X,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import airports from '../config/airports';
import * as api from '../services/api';
import { t } from '../utils/locale';
import './LidcPage.css';

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

export default function LidcPage() {
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
  const [userLidcState, setUserLidcState] = useState({
    hasSquadron: false,
    squadron: null,
    invites: [],
  });
  const [hideInSquadronNotice, setHideInSquadronNotice] = useState(false);

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
  const previewBase = useMemo(
    () => airports.find((entry) => entry.id === baseId) || null,
    [baseId],
  );

  const previewIdentity = useMemo(() => {
    const baseSquadron = createdSquadron || userLidcState.squadron || null;
    return {
      name: name || baseSquadron?.name || t('lidc.preview.fallbackName'),
      description: description || t('lidc.preview.fallbackDescription'),
      baseLabel: previewBase?.displayName || previewBase?.name || baseSquadron?.baseId || '-',
      templateName: selectedTemplate?.name || baseSquadron?.templateName || '-',
    };
  }, [createdSquadron, userLidcState.squadron, name, description, previewBase, selectedTemplate]);

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

  const selectedInvitesPreview = useMemo(() => {
    return selectedInviteIds.map((id) => inviteCandidates.find((entry) => entry.id === id)).filter(Boolean);
  }, [selectedInviteIds, inviteCandidates]);

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

  function renderOverviewView() {
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
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="Squadron logo" className="lidc-preview-logo" />
          ) : (
            <div className="lidc-preview-logo lidc-preview-logo-empty">{t('lidc.preview.logoPlaceholder')}</div>
          )}
        </article>
      </div>
    );
  }

  function renderCapsView() {
    return (
      <div className="lidc-visual-card">
        <h3>{t('lidc.preview.templateCaps')}</h3>
        <div className="lidc-visual-list">
          {CATEGORY_META.map(({ key, labelKey }) => (
            <div key={key} className="lidc-visual-row">
              <span>{t(labelKey)}</span>
              <strong>{spentByCategory[key] || 0} / {capsByCategory[key] || 0}</strong>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderDeckView() {
    return (
      <div className="lidc-visual-card">
        <h3>{t('lidc.preview.deckSummary')}</h3>
        <div className="lidc-visual-list">
          {CATEGORY_META.map(({ key, labelKey }) => {
            const entries = deckPayload[key] || [];
            return (
              <div key={key} className="lidc-visual-row lidc-visual-row-top">
                <div>
                  <span>{t(labelKey)}</span>
                  <div className="lidc-mini-list">
                    {entries.length === 0 && <div>{t('lidc.preview.emptyCategory')}</div>}
                    {entries.map((entry) => {
                      const unit = units.find((candidate) => candidate.id === entry.unitId);
                      return <div key={`${key}-${entry.unitId}`}>{unit?.label || entry.unitId} x{entry.quantity}</div>;
                    })}
                  </div>
                </div>
                <strong>{spentByCategory[key] || 0}</strong>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderInvitesView() {
    return (
      <div className="lidc-visual-card">
        <h3>{t('lidc.preview.invites')}</h3>
        {selectedInvitesPreview.length === 0 ? (
          <div className="lidc-muted-box">{t('lidc.preview.noInvites')}</div>
        ) : (
          <div className="lidc-preview-chip-list">
            {selectedInvitesPreview.map((entry) => {
              const label = entry.globalName || entry.username || entry.id;
              return (
                <span key={entry.id} className="lidc-chip">
                  <UserPlus size={12} />
                  {label}
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderVisualization() {
    if (activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS) return renderInvitesView();
    if (activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS) return renderDeckView();

    return (
      <div className="lidc-squadron-view-stack">
        {renderOverviewView()}
        {renderCapsView()}
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
          {adminEditorButton}
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

  const wizardPortalTarget = typeof document !== 'undefined' ? document.body : null;
  const showInlineCenterStage = !isWizardOpen
    && !isEntryWizardVisible
    && !(userHasSquadron && hideInSquadronNotice);
  const isSidebarExpanded = isNarrowLayout || isSidebarPinned || isSidebarHovered;

  return (
    <div className="lidc-page">
      <div className={`lidc-layout ${isSidebarExpanded ? 'is-sidebar-expanded' : 'is-sidebar-collapsed'}`}>
        <aside
          className={`lidc-sidebar ${isSidebarExpanded ? 'is-expanded' : 'is-collapsed'}`}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          onFocusCapture={() => setIsSidebarHovered(true)}
          onBlurCapture={(event) => {
            const nextTarget = event.relatedTarget;
            if (!event.currentTarget.contains(nextTarget)) {
              handleSidebarMouseLeave();
            }
          }}
        >
          <button
            type="button"
            className="lidc-sidebar-pin"
            onClick={() => setIsSidebarPinned((prev) => !prev)}
            aria-label={isSidebarPinned ? 'Collapse sidebar' : 'Pin sidebar'}
            title={isSidebarPinned ? 'Collapse sidebar' : 'Pin sidebar'}
          >
            {isSidebarPinned ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
          </button>

          <div className="lidc-sidebar-header">
            <div className="lidc-eyebrow">LIDC</div>
            <h1>{t('lidc.title')}</h1>
            <p>{t('lidc.subtitle')}</p>
          </div>

          <nav className="lidc-side-nav" aria-label="LIDC sidebar navigation">
            <div className="lidc-eyebrow">{t('lidc.sidebar.navigation')}</div>

            <div className="lidc-side-nav-list">
              <button
                type="button"
                className={`lidc-side-nav-item ${
                  activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_LIST ? 'is-active' : ''
                }`}
                onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_LIST)}
                title={t('lidc.sidebar.squadronList')}
                aria-label={t('lidc.sidebar.squadronList')}
              >
                <List size={14} />
                <span className="lidc-side-nav-label">{t('lidc.sidebar.squadronList')}</span>
              </button>

              <div className="lidc-side-nav-group">
                {isSidebarExpanded ? (
                  <button
                    type="button"
                    className="lidc-side-nav-group-trigger"
                    onClick={() => setIsSquadronManagementOpen((prev) => !prev)}
                    aria-expanded={isSquadronManagementOpen}
                    title={t('lidc.sidebar.squadronManagement')}
                    aria-label={t('lidc.sidebar.squadronManagement')}
                  >
                    <span className="lidc-side-nav-group-title">
                      <Settings size={14} />
                      <span className="lidc-side-nav-label">{t('lidc.sidebar.squadronManagement')}</span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={`lidc-side-nav-group-caret ${isSquadronManagementOpen ? 'is-open' : ''}`}
                    />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="lidc-side-nav-group-trigger lidc-side-nav-group-trigger-icon-only"
                    onClick={() => setIsSquadronManagementOpen((prev) => !prev)}
                    aria-expanded={false}
                    title={t('lidc.sidebar.squadronManagement')}
                    aria-label={t('lidc.sidebar.squadronManagement')}
                  >
                    <Settings size={14} />
                  </button>
                )}

                <div
                  className={`lidc-side-nav-children ${
                    isSidebarExpanded && isSquadronManagementOpen ? 'is-open' : 'is-closed'
                  }`}
                  aria-hidden={!(isSidebarExpanded && isSquadronManagementOpen)}
                >
                    <button
                      type="button"
                      className={`lidc-side-nav-item is-child ${
                        activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_MEMBERS)}
                      title={t('lidc.sidebar.memberManagement')}
                      aria-label={t('lidc.sidebar.memberManagement')}
                    >
                      <Users size={14} />
                      <span className="lidc-side-nav-label">{t('lidc.sidebar.memberManagement')}</span>
                    </button>
                    <button
                      type="button"
                      className={`lidc-side-nav-item is-child ${
                        activeView === LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS ? 'is-active' : ''
                      }`}
                      onClick={() => setActiveView(LIDC_SIDEBAR_VIEWS.SQUADRON_AIRCRAFTS)}
                      title={t('lidc.sidebar.aircraftManagement')}
                      aria-label={t('lidc.sidebar.aircraftManagement')}
                    >
                      <Plane size={14} />
                      <span className="lidc-side-nav-label">{t('lidc.sidebar.aircraftManagement')}</span>
                    </button>
                </div>
              </div>
            </div>
          </nav>

          <div className="lidc-sidebar-summary">
            <div className="lidc-summary-row">
              <span>{t('lidc.info.base')}</span>
              <strong>{previewIdentity.baseLabel}</strong>
            </div>
            <div className="lidc-summary-row">
              <span>{t('lidc.template.title')}</span>
              <strong>{previewIdentity.templateName}</strong>
            </div>
            <div className="lidc-summary-row">
              <span>{t('lidc.deck.totalUnits')}</span>
              <strong>{totalDeckUnits}</strong>
            </div>
          </div>
        </aside>

        <section className="lidc-main">
          <div className="lidc-main-shell">
            <header className="lidc-main-head">
              <div className="lidc-main-status">
                {loadingCatalog ? (
                  <div className="lidc-loading">
                    <Loader2 size={14} className="spin" />
                    <span>{t('lidc.general.loading')}</span>
                  </div>
                ) : (
                  <span>{t('lidc.preview.eyebrow')}</span>
                )}
              </div>
            </header>

            <div className="lidc-visual-panel">
              {catalogError && <div className="lidc-inline-error">{catalogError}</div>}
              {renderVisualization()}
            </div>

            {showInlineCenterStage && (
              <div className="lidc-center-stage">
                {renderCenterStage()}
              </div>
            )}
          </div>
        </section>
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
