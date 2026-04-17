import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import {
  Activity,
  Anchor,
  ClipboardList,
  Eye,
  Gamepad2,
  Helicopter,
  Layers3,
  Loader2,
  MapPin,
  Maximize2,
  Megaphone,
  Minimize2,
  Package,
  PenSquare,
  Plane,
  Plus,
  Radar,
  Radio,
  Save,
  ShieldCheck,
  Target,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import avengerImg from '../../img/wiki/veh/AVENGER.png';
import firtinaImg from '../../img/wiki/veh/FIRTINA.png';
import fmtvImg from '../../img/wiki/veh/FMTV.png';
import gepardImg from '../../img/wiki/veh/GEPARD.png';
import gmlrsAtacmsImg from '../../img/wiki/veh/GMLRS-ATACMS.png';
import hemttImg from '../../img/wiki/veh/HEMTT.png';
import hmmwvImg from '../../img/wiki/veh/HMMWV.png';
import l118Img from '../../img/wiki/veh/L118.png';
import lavImg from '../../img/wiki/veh/LAV.png';
import mbtImg from '../../img/wiki/veh/MBT.png';
import rolandImg from '../../img/wiki/veh/ROLAND.png';
import scimitarImg from '../../img/wiki/veh/SCIMITAR.png';
import scorpionImg from '../../img/wiki/veh/SCORPION.png';
import towImg from '../../img/wiki/veh/TOW.png';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';

const GAMEPLAY_FEATURES = [
  {
    id: 'territory',
    iconKey: 'radar',
    title: { en: 'Dynamic Frontline', it: 'Frontline Dinamico' },
    description: {
      en: 'Zones change status in real time. Every capture shifts the frontline balance.',
      it: 'Le zone cambiano stato in tempo reale. Ogni conquista modifica il bilanciamento del fronte.',
    },
    Icon: Radar,
  },
  {
    id: 'logistics',
    iconKey: 'truck',
    title: { en: 'Strategic Logistics', it: 'Logistica Strategica' },
    description: {
      en: 'Manage supplies, routes, and mission priorities to keep airbases operational.',
      it: 'Gestione di rifornimenti, rotte e priorita missioni per mantenere operative le basi.',
    },
    Icon: Truck,
  },
  {
    id: 'combined',
    iconKey: 'layers3',
    title: { en: 'Combined Arms Operations', it: 'Operazioni Combined Arms' },
    description: {
      en: 'Ground vehicles and support units work in sync with pilots to secure objectives.',
      it: 'Veicoli e unita di supporto lavorano in sinergia con i piloti per gli obiettivi a terra.',
    },
    Icon: Layers3,
  },
  {
    id: 'defense',
    iconKey: 'shieldcheck',
    title: { en: 'Active Defense', it: 'Difesa Attiva' },
    description: {
      en: 'Air-defense assets and mobile columns protect airfields, convoys, and key points.',
      it: 'Assetti antiaerei e colonne mobili proteggono aeroporti, convogli e punti critici.',
    },
    Icon: ShieldCheck,
  },
];

function normalizeGameplayIconKey(iconKey) {
  return String(iconKey || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function formatLucideLabel(iconName) {
  return String(iconName || '')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}

const LUCIDE_ICON_EXCLUDED_EXPORTS = new Set([
  'Icon',
  'icons',
  'createLucideIcon',
  'default',
]);

const GAMEPLAY_ICON_LIBRARY = Object.entries(LucideIcons)
  .filter(([name, value]) => {
    if (LUCIDE_ICON_EXCLUDED_EXPORTS.has(name)) return false;
    if (!/^[A-Z]/.test(name)) return false;
    if (name.startsWith('Lucide')) return false;
    if (name.endsWith('Icon')) return false;
    return typeof value === 'function';
  })
  .map(([name, Icon]) => ({
    key: normalizeGameplayIconKey(name),
    label: formatLucideLabel(name),
    Icon,
  }))
  .filter((item, index, arr) => arr.findIndex((candidate) => candidate.key === item.key) === index)
  .sort((a, b) => a.label.localeCompare(b.label, 'it'));

const GAMEPLAY_ICON_MAP = GAMEPLAY_ICON_LIBRARY.reduce((acc, iconDef) => {
  acc[iconDef.key] = iconDef.Icon;
  return acc;
}, {});

const GAMEPLAY_ICON_LABEL_MAP = GAMEPLAY_ICON_LIBRARY.reduce((acc, iconDef) => {
  acc[iconDef.key] = iconDef.label;
  return acc;
}, {});

const VEHICLES = [
  {
    id: 'avenger',
    category: { en: 'Air Defense', it: 'Difesa Aerea' },
    name: 'Avenger',
    description: {
      en: 'Mobile SHORAD system designed to counter helicopters and low-altitude threats.',
      it: 'Sistema SHORAD mobile per contrastare elicotteri e minacce a bassa quota.',
    },
    image: avengerImg,
  },
  {
    id: 'firtina',
    category: { en: 'Artillery', it: 'Artiglieria' },
    name: 'Firtina',
    description: {
      en: 'Self-propelled howitzer for long-range indirect fire on tactical targets.',
      it: 'Obice semovente per fuoco indiretto a lunga distanza su obiettivi tattici.',
    },
    image: firtinaImg,
  },
  {
    id: 'fmtv',
    category: { en: 'Logistics', it: 'Logistica' },
    name: 'FMTV',
    description: {
      en: 'Multi-role tactical truck for transporting supplies, ammunition, and field support cargo.',
      it: 'Camion tattico multiruolo per trasporto rifornimenti, munizioni e supporto operativo.',
    },
    image: fmtvImg,
  },
  {
    id: 'gepard',
    category: { en: 'Air Defense', it: 'Difesa Aerea' },
    name: 'Gepard',
    description: {
      en: 'Gun-based anti-air platform for close protection of ground units.',
      it: 'Piattaforma antiaerea a cannoni per protezione ravvicinata delle unita a terra.',
    },
    image: gepardImg,
  },
  {
    id: 'gmlrs',
    category: { en: 'Missile Artillery', it: 'Artiglieria Missilistica' },
    name: 'GMLRS',
    description: {
      en: 'Long-range guided rockets for precision strikes on strategic targets.',
      it: 'Razzi guidati a lungo raggio per ingaggi di precisione su target strategici.',
    },
    image: gmlrsAtacmsImg,
  },
  {
    id: 'atacms',
    category: { en: 'Missile Artillery', it: 'Artiglieria Missilistica' },
    name: 'ATACMS',
    description: {
      en: 'Tactical very-long-range missile to strike critical deep targets.',
      it: 'Missile tattico a lunghissimo raggio per colpire nodi critici in profondita.',
    },
    image: gmlrsAtacmsImg,
  },
  {
    id: 'hemtt',
    category: { en: 'Logistics', it: 'Logistica' },
    name: 'HEMTT',
    description: {
      en: 'Heavy logistics platform for transporting fuel, containers, and frontline materiel.',
      it: 'Piattaforma pesante per trasporto carburante, container e materiali di prima linea.',
    },
    image: hemttImg,
  },
  {
    id: 'hmmwv',
    category: { en: 'Reconnaissance', it: 'Ricognizione' },
    name: 'HMMWV',
    description: {
      en: 'Fast light vehicle for patrol, scouting, and mobile support tasks.',
      it: 'Veicolo leggero rapido per pattugliamento, scouting e supporto mobile.',
    },
    image: hmmwvImg,
  },
  {
    id: 'l118',
    category: { en: 'Artillery', it: 'Artiglieria' },
    name: 'L118',
    description: {
      en: '105mm towed howitzer for rapid and flexible fire support.',
      it: 'Obice trainato da 105mm per supporto di fuoco rapido e flessibile.',
    },
    image: l118Img,
  },
  {
    id: 'lav',
    category: { en: 'Light Armored', it: 'Corazzato Leggero' },
    name: 'LAV',
    description: {
      en: 'Fast armored vehicle for armed reconnaissance and convoy protection.',
      it: 'Veicolo blindato veloce per ricognizione armata e protezione convogli.',
    },
    image: lavImg,
  },
  {
    id: 'mbt',
    category: { en: 'Armor', it: 'Corazzato' },
    name: 'MBT',
    description: {
      en: 'Main battle tank for breakthrough operations and ground superiority.',
      it: 'Main Battle Tank per sfondamento e superiorita sul terreno.',
    },
    image: mbtImg,
  },
  {
    id: 'roland',
    category: { en: 'Air Defense', it: 'Difesa Aerea' },
    name: 'Roland',
    description: {
      en: 'Mobile short/medium-range SAM system for frontline air cover.',
      it: 'Sistema SAM mobile a corto-medio raggio per copertura antiaerea del fronte.',
    },
    image: rolandImg,
  },
  {
    id: 'scimitar',
    category: { en: 'Reconnaissance', it: 'Ricognizione' },
    name: 'Scimitar',
    description: {
      en: 'Light tracked vehicle for armed scouting and target acquisition.',
      it: 'Veicolo cingolato leggero da esplorazione armata e acquisizione bersagli.',
    },
    image: scimitarImg,
  },
  {
    id: 'scorpion',
    category: { en: 'Air Defense', it: 'Difesa Aerea' },
    name: 'Scorpion',
    description: {
      en: 'Close-in defense platform against drones and short-range threats.',
      it: 'Piattaforma di difesa ravvicinata per contrasto droni e minacce a corto raggio.',
    },
    image: scorpionImg,
  },
  {
    id: 'tow',
    category: { en: 'Anti-Tank', it: 'Controcarro' },
    name: 'TOW',
    description: {
      en: 'Anti-tank missile system to neutralize high-priority armored targets.',
      it: 'Sistema missilistico anticarro per neutralizzare veicoli blindati ad alta priorita.',
    },
    image: towImg,
  },
];

const SLOT_ITEM_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
const SLOT_STEP_DEFAULT = 186;
const SLOT_STEP_FULLSCREEN = 278;
const WHEEL_THRESHOLD = 40;
const FULLSCREEN_TRANSITION_MS = 280;
const SHOWROOM_BLUE_GLOW = 'rgba(78, 197, 255, 0.16)';
const WIKI_EDITOR_IDS = new Set(['675706661570347041']);
const DEFAULT_LANGUAGE = 'en';
const UI_COPY = {
  en: {
    language: 'Language',
    gameplay: 'Gameplay',
    gameplaySubtitle: 'Core campaign gameplay features.',
    vehicles: 'Vehicles',
    showroomListAria: 'Vehicle showroom list',
    showroomHint: 'Click to open the showroom in fullscreen',
    category: 'Category',
    close: 'Close',
    fullscreen: 'Fullscreen',
    openFullscreen: 'Open fullscreen',
    closeFullscreen: 'Close fullscreen',
    editArticle: 'Edit Article',
    closeEditor: 'Close Editor',
    closeArticle: 'Close article',
    editorPreview: 'Wiki Editor + Preview',
    loadingDraft: 'Loading draft...',
    loadingArticles: 'Loading wiki articles...',
    loadingFailed: 'Unable to load wiki pages',
    noDraftSaved: 'No saved draft',
    draftLoaded: 'Draft loaded',
    savingDraft: 'Saving draft...',
    draftSaved: 'Draft saved',
    draftSaveError: 'Draft save failed',
    draftLoadError: 'Draft load failed',
    publishing: 'Publishing...',
    published: 'Article published',
    publishError: 'Publish failed',
    mediaInserted: 'Media inserted into markdown',
    mediaError: 'Media upload failed',
    uploadMedia: 'Media',
    publish: 'Publish',
    preview: 'Preview',
    titlePlaceholder: 'Article title',
    summaryPlaceholder: 'Short description',
    contentPlaceholder: 'Markdown content...',
    titleFallback: 'Title',
    summaryFallback: 'Short description',
    emptyContentFallback: '*No content*',
    noIcon: 'None',
    chooseIcon: 'Choose Icon',
    hideIcons: 'Hide Icons',
    searchIcon: 'Search icon...',
    newTopic: 'New Topic',
    closeNewTopic: 'Close New Topic',
    createNewTopic: 'Create New Topic',
    createTopic: 'Create Topic',
    creatingTopic: 'Creating topic...',
    topicCreated: 'Article created',
    topicCreateError: 'Topic creation failed',
    fillRequiredFields: 'Fill title, summary, and content.',
    cancel: 'Cancel',
    topicTitlePlaceholder: 'Topic title',
    topicSummaryPlaceholder: 'Short description',
    topicContentPlaceholder: 'Initial markdown content',
    icon: 'Icon',
    customWikiArticle: 'Custom wiki article',
    lastUpdated: 'Last updated',
    notAuthenticated: 'Not authenticated',
    articleTitle: 'New Topic',
  },
  it: {
    language: 'Lingua',
    gameplay: 'Gameplay',
    gameplaySubtitle: 'Feature di gioco principali della campagna.',
    vehicles: 'Veicoli',
    showroomListAria: 'Lista showroom veicoli',
    showroomHint: 'Clicca per aprire lo showroom in fullscreen',
    category: 'Categoria',
    close: 'Chiudi',
    fullscreen: 'Schermo Intero',
    openFullscreen: 'Apri fullscreen',
    closeFullscreen: 'Chiudi fullscreen',
    editArticle: 'Modifica Articolo',
    closeEditor: 'Chiudi Editor',
    closeArticle: 'Chiudi articolo',
    editorPreview: 'Editor Wiki + Preview',
    loadingDraft: 'Caricamento bozza...',
    loadingArticles: 'Caricamento articoli wiki...',
    loadingFailed: 'Impossibile caricare le pagine wiki',
    noDraftSaved: 'Nessuna bozza salvata',
    draftLoaded: 'Bozza caricata',
    savingDraft: 'Salvataggio bozza...',
    draftSaved: 'Bozza salvata',
    draftSaveError: 'Errore salvataggio bozza',
    draftLoadError: 'Errore caricamento bozza',
    publishing: 'Pubblicazione...',
    published: 'Articolo pubblicato',
    publishError: 'Errore pubblicazione',
    mediaInserted: 'Media inserito nel markdown',
    mediaError: 'Errore upload media',
    uploadMedia: 'Media',
    publish: 'Pubblica',
    preview: 'Preview',
    titlePlaceholder: 'Titolo articolo',
    summaryPlaceholder: 'Descrizione breve',
    contentPlaceholder: 'Contenuto markdown...',
    titleFallback: 'Titolo',
    summaryFallback: 'Descrizione breve',
    emptyContentFallback: '*Nessun contenuto*',
    noIcon: 'Nessuna',
    chooseIcon: 'Scegli Icona',
    hideIcons: 'Nascondi Icone',
    searchIcon: 'Cerca icona...',
    newTopic: 'Nuovo Argomento',
    closeNewTopic: 'Chiudi Nuovo Argomento',
    createNewTopic: 'Crea Nuovo Argomento',
    createTopic: 'Crea Argomento',
    creatingTopic: 'Creazione argomento...',
    topicCreated: 'Articolo creato',
    topicCreateError: 'Errore creazione argomento',
    fillRequiredFields: 'Compila titolo, descrizione e contenuto.',
    cancel: 'Annulla',
    topicTitlePlaceholder: 'Titolo argomento',
    topicSummaryPlaceholder: 'Descrizione breve',
    topicContentPlaceholder: 'Contenuto markdown iniziale',
    icon: 'Icona',
    customWikiArticle: 'Articolo wiki personalizzato',
    lastUpdated: 'Ultimo aggiornamento',
    notAuthenticated: 'Non autenticato',
    articleTitle: 'Nuovo Argomento',
  },
};
function buildEmptyNewTopicDraft(language = DEFAULT_LANGUAGE) {
  const heading = language === 'it' ? 'Nuovo Argomento' : 'New Topic';
  const description = language === 'it'
    ? "Scrivi qui il contenuto dell'articolo."
    : 'Write the article content here.';
  return {
    iconKey: 'layers3',
    title: '',
    summary: '',
    content: `## ${heading}\n\n${description}`,
  };
}

function localizeText(value, language) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[language] || value.en || value.it || '';
  }
  return String(value || '');
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const [, base64] = result.split(',');
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function wrapIndex(value, length) {
  return ((value % length) + length) % length;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolveGameplayIcon(iconKey, fallback = Layers3) {
  const normalizedKey = normalizeGameplayIconKey(iconKey);
  return GAMEPLAY_ICON_MAP[normalizedKey] || fallback;
}

function getVisualFromPosition(positionPx, slotStep = SLOT_STEP_DEFAULT, fullscreen = false) {
  const normalized = Math.abs(positionPx) / slotStep;

  let opacity;
  let blur;
  let sizePx;
  const centerSize = fullscreen ? 246 : 156;
  const midSize = fullscreen ? 132 : 80;
  const outerSize = fullscreen ? 118 : 72;
  const minSize = fullscreen ? 84 : 62;
  const maxBlur = fullscreen ? 2.2 : 2.6;
  const centerOpacityDrop = fullscreen ? 0.42 : 0.5;

  if (normalized <= 1) {
    opacity = 1 - (centerOpacityDrop * normalized);
    blur = 0.2 * normalized;
    sizePx = centerSize - ((centerSize - midSize) * normalized);
  } else if (normalized <= 2) {
    const local = normalized - 1;
    opacity = (1 - centerOpacityDrop) - (0.32 * local);
    blur = 0.2 + (1.6 * local);
    sizePx = midSize - ((midSize - outerSize) * local);
  } else {
    const local = normalized - 2;
    opacity = 0.18 - (0.13 * local);
    blur = 1.8 + (0.8 * local);
    sizePx = outerSize - ((outerSize - minSize) * local);
  }

  return {
    opacity: clamp(opacity, 0.05, 1),
    blur: clamp(blur, 0, maxBlur),
    sizePx: clamp(sizePx, minSize, centerSize),
  };
}

export default function WikiPage({ language = DEFAULT_LANGUAGE }) {
  const { user } = useUser();
  const [selectedVehicleIndex, setSelectedVehicleIndex] = useState(0);
  const [isShowroomFullscreen, setIsShowroomFullscreen] = useState(false);
  const [isShowroomFullscreenActive, setIsShowroomFullscreenActive] = useState(false);
  const [slotAnimating, setSlotAnimating] = useState(false);
  const [slotTranslate, setSlotTranslate] = useState(0);
  const [wikiPagesById, setWikiPagesById] = useState({});
  const [wikiLoading, setWikiLoading] = useState(true);
  const [wikiError, setWikiError] = useState('');
  const [selectedGameplayId, setSelectedGameplayId] = useState('');
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicDraft, setNewTopicDraft] = useState(() => buildEmptyNewTopicDraft(DEFAULT_LANGUAGE));
  const [newTopicStatus, setNewTopicStatus] = useState('');
  const [newTopicIconPickerOpen, setNewTopicIconPickerOpen] = useState(false);
  const [newTopicIconSearch, setNewTopicIconSearch] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [isGameplayArticleFullscreen, setIsGameplayArticleFullscreen] = useState(false);
  const [isGameplayArticleFullscreenActive, setIsGameplayArticleFullscreenActive] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [wikiDraftIconPickerOpen, setWikiDraftIconPickerOpen] = useState(false);
  const [wikiDraftIconSearch, setWikiDraftIconSearch] = useState('');
  const [wikiDraft, setWikiDraft] = useState({ iconKey: 'layers3', title: '', summary: '', content: '' });
  const [draftStatus, setDraftStatus] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const wheelAccumulatorRef = useRef(0);
  const closeTimeoutRef = useRef(null);
  const openRafRef = useRef(null);
  const gameplayCloseTimeoutRef = useRef(null);
  const gameplayOpenRafRef = useRef(null);
  const slotRafRef = useRef(null);
  const slotPendingDirectionRef = useRef(0);
  const wikiSaveTimerRef = useRef(null);
  const lastSavedDraftSerializedRef = useRef('');
  const wikiMediaInputRef = useRef(null);

  const canEditWiki = Boolean(user?.id && WIKI_EDITOR_IDS.has(String(user.id)));
  const ui = UI_COPY[language] || UI_COPY.en;
  const dateLocale = language === 'it' ? 'it-IT' : 'en-US';
  const activeSlotStep = isShowroomFullscreen ? SLOT_STEP_FULLSCREEN : SLOT_STEP_DEFAULT;

  const filteredNewTopicIcons = useMemo(() => {
    const query = String(newTopicIconSearch || '').trim().toLowerCase();
    if (!query) return GAMEPLAY_ICON_LIBRARY;
    return GAMEPLAY_ICON_LIBRARY.filter((iconDef) => iconDef.label.toLowerCase().includes(query));
  }, [newTopicIconSearch]);

  const filteredDraftIcons = useMemo(() => {
    const query = String(wikiDraftIconSearch || '').trim().toLowerCase();
    if (!query) return GAMEPLAY_ICON_LIBRARY;
    return GAMEPLAY_ICON_LIBRARY.filter((iconDef) => iconDef.label.toLowerCase().includes(query));
  }, [wikiDraftIconSearch]);

  const priorityOffset = useMemo(() => {
    let bestOffset = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    SLOT_ITEM_OFFSETS.forEach((offset) => {
      const position = (offset * activeSlotStep) + slotTranslate;
      const distance = Math.abs(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = offset;
      }
    });

    return bestOffset;
  }, [slotTranslate, activeSlotStep]);

  const selectedVehicle = useMemo(() => {
    const visualIndex = wrapIndex(selectedVehicleIndex + priorityOffset, VEHICLES.length);
    return VEHICLES[visualIndex];
  }, [selectedVehicleIndex, priorityOffset]);

  const gameplayItems = useMemo(() => {
    const featureById = new Map(GAMEPLAY_FEATURES.map((feature) => [feature.id, feature]));

    const baseItems = GAMEPLAY_FEATURES.map((feature) => {
      const page = wikiPagesById[feature.id];
      const Icon = resolveGameplayIcon(page?.iconKey, feature.Icon);
      return {
        ...feature,
        iconKey: normalizeGameplayIconKey(page?.iconKey || feature.iconKey || ''),
        Icon,
        title: page?.title || localizeText(feature.title, language),
        description: page?.summary || localizeText(feature.description, language),
      };
    });

    const customItems = Object.values(wikiPagesById)
      .filter((page) => page?.id && !featureById.has(page.id))
      .sort((a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0))
      .map((page) => ({
        id: page.id,
        iconKey: normalizeGameplayIconKey(page.iconKey || 'layers3'),
        title: page.title || page.id,
        description: page.summary || ui.customWikiArticle,
        Icon: resolveGameplayIcon(page.iconKey, Layers3),
      }));

    return [...baseItems, ...customItems];
  }, [wikiPagesById, language, ui.customWikiArticle]);

  const selectedGameplayFeature = useMemo(() => {
    if (!gameplayItems.length) return null;
    const fallback = gameplayItems[0];
    if (!selectedGameplayId) return fallback;
    return gameplayItems.find((item) => item.id === selectedGameplayId) || fallback;
  }, [gameplayItems, selectedGameplayId]);

  const selectedGameplayPage = useMemo(() => {
    if (!selectedGameplayFeature) return null;
    const page = wikiPagesById[selectedGameplayFeature.id];
    if (page) {
      return {
        ...page,
        iconKey: normalizeGameplayIconKey(page.iconKey || selectedGameplayFeature.iconKey || 'layers3'),
      };
    }
    return {
      id: selectedGameplayFeature.id,
      iconKey: normalizeGameplayIconKey(selectedGameplayFeature.iconKey || 'layers3'),
      title: selectedGameplayFeature.title,
      summary: selectedGameplayFeature.description,
      content: `## ${selectedGameplayFeature.title}\n\n${selectedGameplayFeature.description}`,
      updatedAt: null,
      updatedBy: null,
    };
  }, [selectedGameplayFeature, wikiPagesById]);

  const NewTopicSelectedIcon = useMemo(
    () => resolveGameplayIcon(newTopicDraft.iconKey, Layers3),
    [newTopicDraft.iconKey],
  );

  const markdownComponents = useMemo(() => ({
    h1: ({ node, ...props }) => <h1 className="mb-2 mt-4 text-2xl font-black uppercase tracking-[0.04em] text-yt-text-primary" {...props} />,
    h2: ({ node, ...props }) => <h2 className="mb-2 mt-4 text-xl font-extrabold uppercase tracking-[0.04em] text-yt-text-primary" {...props} />,
    h3: ({ node, ...props }) => <h3 className="mb-2 mt-3 text-lg font-bold text-yt-text-primary" {...props} />,
    p: ({ node, ...props }) => <p className="mb-3 leading-relaxed text-yt-text-secondary" {...props} />,
    ul: ({ node, ...props }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-yt-text-secondary" {...props} />,
    ol: ({ node, ...props }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-yt-text-secondary" {...props} />,
    li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
    table: ({ node, ...props }) => (
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm text-yt-text-secondary" {...props} />
      </div>
    ),
    thead: ({ node, ...props }) => <thead className="bg-[#0f1a2a]" {...props} />,
    th: ({ node, ...props }) => <th className="border border-yt-border/80 px-3 py-2 text-left font-bold text-yt-text-primary" {...props} />,
    td: ({ node, ...props }) => <td className="border border-yt-border/70 px-3 py-2 align-top" {...props} />,
    blockquote: ({ node, ...props }) => <blockquote className="mb-3 border-l-2 border-yt-accent/60 pl-3 text-yt-text-secondary/95" {...props} />,
    a: ({ node, ...props }) => <a className="text-yt-accent underline" target="_blank" rel="noreferrer" {...props} />,
    img: ({ node, ...props }) => <img className="my-3 max-h-[420px] w-auto max-w-full rounded border border-yt-border/80 bg-[#0b121d] p-1" loading="lazy" {...props} />,
    code: ({ inline, className, children, ...props }) => (
      inline
        ? <code className="rounded bg-[#0e1827] px-1.5 py-0.5 text-[0.95em] text-yt-accent" {...props}>{children}</code>
        : <code className="block overflow-x-auto rounded-xl border border-yt-border/80 bg-[#0b121d] p-3 text-sm text-yt-text-primary" {...props}>{children}</code>
    ),
  }), []);

  const shiftVehicle = (direction) => {
    if (!direction || slotAnimating) {
      return;
    }

    const normalizedDirection = direction > 0 ? 1 : -1;
    slotPendingDirectionRef.current = normalizedDirection;
    setSlotAnimating(true);
    setSlotTranslate(0);

    if (slotRafRef.current) {
      cancelAnimationFrame(slotRafRef.current);
    }

    slotRafRef.current = requestAnimationFrame(() => {
      setSlotTranslate(-normalizedDirection * activeSlotStep);
    });
  };

  const closeShowroomFullscreen = () => {
    setIsShowroomFullscreenActive(false);
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsShowroomFullscreen(false);
    }, FULLSCREEN_TRANSITION_MS);
  };

  const closeGameplayArticleFullscreen = () => {
    setIsGameplayArticleFullscreenActive(false);
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
    }
    gameplayCloseTimeoutRef.current = setTimeout(() => {
      setIsGameplayArticleFullscreen(false);
    }, FULLSCREEN_TRANSITION_MS);
  };

  const openGameplayArticleFullscreen = () => {
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
      gameplayCloseTimeoutRef.current = null;
    }
    setIsGameplayArticleFullscreen(true);
    gameplayOpenRafRef.current = requestAnimationFrame(() => {
      setIsGameplayArticleFullscreenActive(true);
    });
  };

  useEffect(() => {
    if (!isShowroomFullscreen && !isGameplayArticleFullscreen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      if (isGameplayArticleFullscreen) {
        closeGameplayArticleFullscreen();
        return;
      }
      if (isShowroomFullscreen) {
        closeShowroomFullscreen();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isShowroomFullscreen, isGameplayArticleFullscreen]);

  useEffect(() => {
    document.body.classList.toggle('wiki-showroom-open', isShowroomFullscreen);
    return () => {
      document.body.classList.remove('wiki-showroom-open');
    };
  }, [isShowroomFullscreen]);

  useEffect(() => () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    if (openRafRef.current) {
      cancelAnimationFrame(openRafRef.current);
    }
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
    }
    if (gameplayOpenRafRef.current) {
      cancelAnimationFrame(gameplayOpenRafRef.current);
    }
    if (slotRafRef.current) {
      cancelAnimationFrame(slotRafRef.current);
    }
    if (wikiSaveTimerRef.current) {
      clearTimeout(wikiSaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    const loadWikiPages = async () => {
      try {
        setWikiLoading(true);
        setWikiError('');
        const response = await api.getWikiPages();
        const pages = Array.isArray(response?.pages) ? response.pages : [];
        const byId = {};
        pages.forEach((page) => {
          if (page?.id) {
            byId[page.id] = page;
          }
        });
        setWikiPagesById(byId);
      } catch (error) {
        setWikiError(error.message || ui.loadingFailed);
      } finally {
        setWikiLoading(false);
      }
    };

    loadWikiPages();
  }, [ui.loadingFailed]);

  useEffect(() => {
    if (!gameplayItems.length) return;
    if (selectedGameplayId) return;
    setSelectedGameplayId(gameplayItems[0].id);
  }, [gameplayItems, selectedGameplayId]);

  useEffect(() => {
    if (!canEditWiki || !editorOpen || !selectedGameplayFeature?.id) {
      return;
    }

    let cancelled = false;

    const loadDraft = async () => {
      try {
        setDraftLoading(true);
        setDraftStatus(ui.loadingDraft);
        const response = await api.getWikiDraft(selectedGameplayFeature.id);
        if (cancelled) return;
        const incomingDraft = response?.draft;
        const basePage = selectedGameplayPage || {};
        const nextDraft = incomingDraft
          ? {
            iconKey: normalizeGameplayIconKey(incomingDraft.iconKey || basePage.iconKey || 'layers3'),
            title: incomingDraft.title || basePage.title || '',
            summary: incomingDraft.summary || basePage.summary || '',
            content: incomingDraft.content || basePage.content || '',
          }
          : {
            iconKey: normalizeGameplayIconKey(basePage.iconKey || 'layers3'),
            title: basePage.title || '',
            summary: basePage.summary || '',
            content: basePage.content || '',
        };
        setWikiDraft(nextDraft);
        lastSavedDraftSerializedRef.current = JSON.stringify(nextDraft);
        setDraftStatus(incomingDraft ? ui.draftLoaded : ui.noDraftSaved);
      } catch (error) {
        if (cancelled) return;
        const basePage = selectedGameplayPage || {};
        const fallback = {
          iconKey: normalizeGameplayIconKey(basePage.iconKey || 'layers3'),
          title: basePage.title || '',
          summary: basePage.summary || '',
          content: basePage.content || '',
        };
        setWikiDraft(fallback);
        lastSavedDraftSerializedRef.current = JSON.stringify(fallback);
        if (String(error?.message || '').includes('404')) {
          setDraftStatus(ui.noDraftSaved);
        } else {
          setDraftStatus(error.message || ui.draftLoadError);
        }
      } finally {
        if (!cancelled) {
          setDraftLoading(false);
        }
      }
    };

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [canEditWiki, editorOpen, selectedGameplayFeature?.id, selectedGameplayPage, ui.loadingDraft, ui.draftLoaded, ui.noDraftSaved, ui.draftLoadError]);

  useEffect(() => {
    if (!canEditWiki || !editorOpen || draftLoading || !selectedGameplayFeature?.id) {
      return;
    }

    const serialized = JSON.stringify(wikiDraft);
    if (serialized === lastSavedDraftSerializedRef.current) {
      return;
    }

    if (wikiSaveTimerRef.current) {
      clearTimeout(wikiSaveTimerRef.current);
    }

    wikiSaveTimerRef.current = setTimeout(async () => {
      try {
        setDraftStatus(ui.savingDraft);
        await api.saveWikiDraft(selectedGameplayFeature.id, wikiDraft);
        lastSavedDraftSerializedRef.current = serialized;
        setDraftStatus(ui.draftSaved);
      } catch (error) {
        setDraftStatus(error.message || ui.draftSaveError);
      } finally {
        wikiSaveTimerRef.current = null;
      }
    }, 900);
  }, [canEditWiki, draftLoading, editorOpen, selectedGameplayFeature?.id, wikiDraft, ui.savingDraft, ui.draftSaved, ui.draftSaveError]);

  const openShowroomFullscreen = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsShowroomFullscreen(true);
    openRafRef.current = requestAnimationFrame(() => {
      setIsShowroomFullscreenActive(true);
    });
  };

  const toggleShowroomFullscreen = () => {
    if (isShowroomFullscreen) {
      closeShowroomFullscreen();
      return;
    }
    openShowroomFullscreen();
  };

  const handleWheel = (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (slotAnimating) {
      return;
    }

    const primaryDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    wheelAccumulatorRef.current += primaryDelta;

    if (Math.abs(wheelAccumulatorRef.current) < WHEEL_THRESHOLD) {
      return;
    }

    const direction = wheelAccumulatorRef.current > 0 ? 1 : -1;
    wheelAccumulatorRef.current = 0;
    shiftVehicle(direction);
  };

  const handleKeyDown = (event) => {
    if (slotAnimating) {
      return;
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      shiftVehicle(1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      shiftVehicle(-1);
    }
  };

  const handleShowroomClick = (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const clickedInteractive = target.closest('button, a, input, textarea, select, [role="listbox"]');
    if (clickedInteractive) {
      return;
    }

    openShowroomFullscreen();
  };

  const handleSelectGameplayItem = (itemId) => {
    setSelectedGameplayId(itemId);
    setEditorOpen(false);
    setWikiDraftIconPickerOpen(false);
    setWikiDraftIconSearch('');
    setDraftStatus('');
    setNewTopicOpen(false);
    setNewTopicIconPickerOpen(false);
    setNewTopicIconSearch('');
    setNewTopicStatus('');
    openGameplayArticleFullscreen();
  };

  const handleCreateGameplayTopic = async () => {
    if (!canEditWiki) return;

    const iconKey = normalizeGameplayIconKey(newTopicDraft.iconKey || 'layers3');
    const title = String(newTopicDraft.title || '').trim();
    const summary = String(newTopicDraft.summary || '').trim();
    const content = String(newTopicDraft.content || '').trim();

    if (!title || !summary || !content) {
      setNewTopicStatus(ui.fillRequiredFields);
      return;
    }

    try {
      setCreatingTopic(true);
      setNewTopicStatus(ui.creatingTopic);
      const response = await api.createWikiPage({ iconKey, title, summary, content });
      const createdPage = response?.page;
      if (!createdPage?.id) {
        throw new Error(ui.topicCreateError);
      }

      setWikiPagesById((prev) => ({
        ...prev,
        [createdPage.id]: createdPage,
      }));
      setSelectedGameplayId(createdPage.id);
      setEditorOpen(true);

      const createdDraft = {
        iconKey: normalizeGameplayIconKey(createdPage.iconKey || iconKey || 'layers3'),
        title: createdPage.title || title,
        summary: createdPage.summary || summary,
        content: createdPage.content || content,
      };
      setWikiDraft(createdDraft);
      lastSavedDraftSerializedRef.current = JSON.stringify(createdDraft);
      setDraftStatus(ui.topicCreated);

      setNewTopicOpen(false);
      setNewTopicIconPickerOpen(false);
      setNewTopicIconSearch('');
      setNewTopicStatus('');
      setNewTopicDraft(buildEmptyNewTopicDraft(language));
      openGameplayArticleFullscreen();
    } catch (error) {
      setNewTopicStatus(error.message || ui.topicCreateError);
    } finally {
      setCreatingTopic(false);
    }
  };

  const handlePublishGameplayArticle = async () => {
    if (!canEditWiki || !selectedGameplayFeature?.id) return;
    try {
      setDraftStatus(ui.publishing);
      const response = await api.updateWikiPage(selectedGameplayFeature.id, wikiDraft);
      const updatedPage = response?.page;
      if (updatedPage?.id) {
        setWikiPagesById((prev) => ({
          ...prev,
          [updatedPage.id]: updatedPage,
        }));
      }
      lastSavedDraftSerializedRef.current = JSON.stringify(wikiDraft);
      setDraftStatus(ui.published);
      setEditorOpen(false);
    } catch (error) {
      setDraftStatus(error.message || ui.publishError);
    }
  };

  const handleUploadWikiMedia = async (files) => {
    if (!canEditWiki || !selectedGameplayFeature?.id || !files?.length) return;

    try {
      setUploadingMedia(true);
      for (const file of files) {
        const mimeType = String(file.type || '').toLowerCase();
        if (!mimeType.startsWith('image/') && !mimeType.startsWith('video/')) continue;
        const base64Data = await fileToBase64(file);
        const response = await api.uploadWikiMedia({
          fileName: file.name,
          mimeType: file.type,
          base64Data,
        });
        const media = response?.media;
        if (!media?.url) continue;
        const snippet = media.type === 'image'
          ? `\n\n![${media.fileName || media.id}](${media.url})\n`
          : `\n\n[${media.fileName || media.id}](${media.url})\n`;
        setWikiDraft((prev) => ({
          ...prev,
          content: `${prev.content || ''}${snippet}`,
        }));
      }
      setDraftStatus(ui.mediaInserted);
    } catch (error) {
      setDraftStatus(error.message || ui.mediaError);
    } finally {
      setUploadingMedia(false);
      if (wikiMediaInputRef.current) {
        wikiMediaInputRef.current.value = '';
      }
    }
  };

  const handleSlotTrackTransitionEnd = (event) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform' || !slotAnimating) {
      return;
    }

    const direction = slotPendingDirectionRef.current || 0;
    if (!direction) {
      return;
    }

    setSelectedVehicleIndex((prev) => wrapIndex(prev + direction, VEHICLES.length));
    setSlotTranslate(0);
    setSlotAnimating(false);
    slotPendingDirectionRef.current = 0;
  };

  const renderGameplayArticleContent = () => {
    if (!selectedGameplayPage) {
      return null;
    }
    const SelectedArticleIcon = resolveGameplayIcon(selectedGameplayPage.iconKey, Layers3);
    const DraftIcon = resolveGameplayIcon(wikiDraft.iconKey, Layers3);

    return (
      <article className="h-full rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="inline-flex items-center gap-2 text-xl font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">
              <SelectedArticleIcon className="h-5 w-5 text-yt-accent" />
              {selectedGameplayPage.title}
            </h3>
            <p className="mt-1 text-sm text-yt-text-secondary">{selectedGameplayPage.summary}</p>
            {selectedGameplayPage.updatedAt && (
              <p className="mt-1 text-xs text-yt-text-secondary/80">
                {ui.lastUpdated}: {new Date(selectedGameplayPage.updatedAt).toLocaleString(dateLocale)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {canEditWiki && (
              <button
                type="button"
                onClick={() => setEditorOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
              >
                <PenSquare className="h-3.5 w-3.5" />
                {editorOpen ? ui.closeEditor : ui.editArticle}
              </button>
            )}
            <button
              type="button"
              onClick={closeGameplayArticleFullscreen}
              className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
              aria-label={ui.closeArticle}
            >
              <X className="h-3.5 w-3.5" />
              {ui.close}
            </button>
          </div>
        </div>

        <div className="max-h-[40vh] overflow-auto rounded-xl border border-yt-border/75 bg-[#0c1320] px-4 py-3 sm:max-h-[46vh]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {selectedGameplayPage.content}
          </ReactMarkdown>
        </div>

        {canEditWiki && editorOpen && (
          <div className="mt-4 rounded-xl border border-yt-border/80 bg-[#0b121d] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.1em] text-yt-text-secondary">
                <Eye className="h-3.5 w-3.5" />
                {ui.editorPreview}
              </div>
              <div className="text-xs text-yt-text-secondary">{draftStatus}</div>
            </div>

            {draftLoading ? (
              <div className="flex items-center gap-2 text-sm text-yt-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                {ui.loadingDraft}
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.icon}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setWikiDraftIconPickerOpen((prev) => !prev)}
                        className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent"
                      >
                        <DraftIcon className="h-3.5 w-3.5 text-yt-accent" />
                        {wikiDraftIconPickerOpen ? ui.hideIcons : ui.chooseIcon}
                      </button>
                      <span className="text-xs text-yt-text-secondary">
                        {GAMEPLAY_ICON_LABEL_MAP[normalizeGameplayIconKey(wikiDraft.iconKey)] || ui.noIcon}
                      </span>
                    </div>
                    {wikiDraftIconPickerOpen && (
                      <div className="mt-2 space-y-2 rounded border border-yt-border/70 bg-[#0f1725] p-2.5">
                        <input
                          type="text"
                          value={wikiDraftIconSearch}
                          onChange={(event) => setWikiDraftIconSearch(event.target.value)}
                          placeholder={ui.searchIcon}
                          className="w-full rounded border border-yt-border/80 bg-[#111a28] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none focus:border-yt-accent"
                        />
                        <div className="max-h-56 overflow-y-auto pr-1">
                          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                            {filteredDraftIcons.map(({ key, label, Icon }) => {
                              const selected = normalizeGameplayIconKey(wikiDraft.iconKey) === key;
                              return (
                                <button
                                  key={key}
                                  type="button"
                                  title={label}
                                  onClick={() => {
                                    setWikiDraft((prev) => ({ ...prev, iconKey: key }));
                                    setWikiDraftIconPickerOpen(false);
                                    setWikiDraftIconSearch('');
                                  }}
                                  className={`inline-flex h-9 items-center justify-center rounded border transition-colors ${
                                    selected
                                      ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                                      : 'border-yt-border/80 bg-[#101827] text-yt-text-secondary hover:border-yt-accent/70 hover:text-yt-accent'
                                  }`}
                                >
                                  <Icon className="h-4 w-4" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <input
                    type="text"
                    value={wikiDraft.title}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder={ui.titlePlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={3}
                    value={wikiDraft.summary}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, summary: event.target.value }))}
                    placeholder={ui.summaryPlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={14}
                    value={wikiDraft.content}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, content: event.target.value }))}
                    placeholder={ui.contentPlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePublishGameplayArticle}
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300"
                    >
                      <Save className="h-3.5 w-3.5" />
                      {ui.publish}
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent">
                      {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {ui.uploadMedia}
                      <input
                        ref={wikiMediaInputRef}
                        type="file"
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(event) => handleUploadWikiMedia(Array.from(event.target.files || []))}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary"
                    >
                      <X className="h-3.5 w-3.5" />
                      {ui.close}
                    </button>
                  </div>
                </div>

                <div className="rounded border border-yt-border/80 bg-[#111a28] p-3">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-yt-accent">{ui.preview}</h4>
                  <h3 className="inline-flex items-center gap-2 text-lg font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">
                    <DraftIcon className="h-4 w-4 text-yt-accent" />
                    {wikiDraft.title || ui.titleFallback}
                  </h3>
                  <p className="mb-3 mt-1 text-sm text-yt-text-secondary">{wikiDraft.summary || ui.summaryFallback}</p>
                  <div className="max-h-[420px] overflow-auto rounded border border-yt-border/70 bg-[#0c1320] px-3 py-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {wikiDraft.content || ui.emptyContentFallback}
                    </ReactMarkdown>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    );
  };

  const renderShowroomContent = ({ fullscreen = false } = {}) => (
    (() => {
      const showroomSlotStep = fullscreen ? SLOT_STEP_FULLSCREEN : SLOT_STEP_DEFAULT;
      return (
    <>
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">{ui.vehicles}</h2>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleShowroomFullscreen();
            }}
            className="inline-flex items-center gap-1 rounded-full border border-yt-border/80 bg-[#101827] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
            title={fullscreen ? ui.closeFullscreen : ui.openFullscreen}
            aria-label={fullscreen ? ui.closeFullscreen : ui.openFullscreen}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? ui.close : ui.fullscreen}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <article className="relative flex items-start justify-center">
          <div className={`w-full space-y-3 pt-1 text-center ${fullscreen ? 'max-w-5xl' : 'max-w-3xl'}`}>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <h3 className={`font-black uppercase leading-tight tracking-[0.05em] text-yt-text-primary ${fullscreen ? 'text-4xl' : 'text-3xl'}`}>
                {selectedVehicle.name}
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-accent/40 bg-yt-accent/12 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-yt-accent shadow-[0_0_10px_rgba(78,197,255,0.7)]" />
                <span className="text-xs font-black uppercase tracking-[0.14em] text-yt-accent">
                  {ui.category}: {localizeText(selectedVehicle.category, language)}
                </span>
              </div>
            </div>
            <p className={`mx-auto leading-relaxed text-yt-text-secondary ${fullscreen ? 'max-w-3xl text-lg' : 'max-w-2xl text-sm'}`}>
              {localizeText(selectedVehicle.description, language)}
            </p>
          </div>
        </article>

        <div className="relative">
          <div
            className={`pointer-events-none absolute opacity-42 ${fullscreen ? '-inset-x-64 -top-56 -bottom-20' : '-inset-x-40 -top-44 -bottom-12'}`}
            style={{
              background: `radial-gradient(ellipse at 50% 60%, ${SHOWROOM_BLUE_GLOW} 0%, rgba(78,197,255,0.10) 32%, rgba(78,197,255,0.05) 56%, transparent 88%)`,
            }}
          />

          <div
            className={`relative mx-auto overflow-hidden outline-none focus:outline-none ${fullscreen ? 'h-[560px] max-w-[min(96vw,1560px)]' : 'h-[300px] max-w-[min(92vw,1040px)]'}`}
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.14) 8%, black 20%, black 80%, rgba(0,0,0,0.14) 92%, transparent 100%)',
              maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.14) 8%, black 20%, black 80%, rgba(0,0,0,0.14) 92%, transparent 100%)',
              overscrollBehavior: 'contain',
            }}
            onWheelCapture={handleWheel}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="listbox"
            aria-label={ui.showroomListAria}
          >
            <div
              className={`absolute inset-0 ${slotAnimating ? 'transition-transform duration-[420ms] ease-[cubic-bezier(0.22,0.61,0.36,1)]' : ''}`}
              style={{
                transform: `translateX(${slotTranslate}px)`,
              }}
              onTransitionEnd={handleSlotTrackTransitionEnd}
            >
              {SLOT_ITEM_OFFSETS.map((offset) => {
                const itemIndex = wrapIndex(selectedVehicleIndex + offset, VEHICLES.length);
                const vehicle = VEHICLES[itemIndex];
                const position = (offset * showroomSlotStep) + slotTranslate;
                const visual = getVisualFromPosition(position, showroomSlotStep, fullscreen);
                const isPriority = offset === priorityOffset;

                return (
                  <button
                    key={`${vehicle.id}_${offset}`}
                    type="button"
                    onClick={() => {
                      if (offset === 0) {
                        return;
                      }
                      shiftVehicle(offset > 0 ? 1 : -1);
                    }}
                    className="absolute top-1/2 left-1/2 p-0 transition-all duration-250"
                    style={{
                      transform: `translate(calc(-50% + ${offset * showroomSlotStep}px), -50%)`,
                      opacity: visual.opacity,
                      filter: `blur(${visual.blur}px)`,
                    }}
                    role="option"
                    aria-selected={isPriority}
                  >
                    <img
                      src={vehicle.image}
                      alt={vehicle.name}
                      className={`mx-auto object-contain transition-[filter] duration-200 ${
                        isPriority
                          ? (fullscreen
                            ? 'drop-shadow-[0_0_26px_rgba(78,197,255,0.36)]'
                            : 'drop-shadow-[0_0_14px_rgba(78,197,255,0.26)]')
                          : ''
                      }`}
                      style={{
                        width: `${visual.sizePx}px`,
                        height: `${visual.sizePx}px`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
      );
    })()
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-6">
      <section className="rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/85 p-5 shadow-[0_16px_34px_rgba(0,0,0,0.32)] backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-yt-accent/35 bg-yt-accent/12 p-2">
              <Gamepad2 className="h-5 w-5 text-yt-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">{ui.gameplay}</h2>
              <p className="text-sm text-yt-text-secondary">{ui.gameplaySubtitle}</p>
            </div>
          </div>
          {canEditWiki && (
            <button
              type="button"
              onClick={() => {
                if (newTopicOpen) {
                  setNewTopicOpen(false);
                  setNewTopicIconPickerOpen(false);
                  setNewTopicIconSearch('');
                  setNewTopicStatus('');
                  return;
                }
                setNewTopicDraft(buildEmptyNewTopicDraft(language));
                setNewTopicIconPickerOpen(false);
                setNewTopicIconSearch('');
                setNewTopicStatus('');
                setNewTopicOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              {newTopicOpen ? ui.closeNewTopic : ui.newTopic}
            </button>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          {gameplayItems.map(({ id, title, description, Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => handleSelectGameplayItem(id)}
              className={`rounded-2xl border bg-[#101926] p-4 text-left shadow-[0_8px_18px_rgba(0,0,0,0.26)] transition-all ${
                selectedGameplayFeature?.id === id
                  ? 'border-yt-accent/60 ring-1 ring-yt-accent/35'
                  : 'border-yt-border/80 hover:border-yt-accent/45'
              }`}
            >
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-yt-border/80 bg-[#0b121d] px-2.5 py-1">
                <Icon className="h-4 w-4 text-yt-accent" />
                <h3 className="text-xs font-bold uppercase tracking-[0.09em] text-yt-accent">{title}</h3>
              </div>
              <p className="text-sm leading-relaxed text-yt-text-secondary">{description}</p>
            </button>
          ))}
        </div>

        {canEditWiki && newTopicOpen && (
          <div className="mt-4 rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-yt-accent">{ui.createNewTopic}</h3>
              {newTopicStatus && (
                <span className="text-xs text-yt-text-secondary">{newTopicStatus}</span>
              )}
            </div>
            <div className="space-y-2">
              <div>
                <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.icon}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTopicIconPickerOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent"
                  >
                    <NewTopicSelectedIcon className="h-3.5 w-3.5 text-yt-accent" />
                    {newTopicIconPickerOpen ? ui.hideIcons : ui.chooseIcon}
                  </button>
                  <span className="text-xs text-yt-text-secondary">
                    {GAMEPLAY_ICON_LABEL_MAP[normalizeGameplayIconKey(newTopicDraft.iconKey)] || ui.noIcon}
                  </span>
                </div>
                {newTopicIconPickerOpen && (
                  <div className="mt-2 space-y-2 rounded border border-yt-border/70 bg-[#0f1725] p-2.5">
                    <input
                      type="text"
                      value={newTopicIconSearch}
                      onChange={(event) => setNewTopicIconSearch(event.target.value)}
                      placeholder={ui.searchIcon}
                      className="w-full rounded border border-yt-border/80 bg-[#111a28] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none focus:border-yt-accent"
                    />
                    <div className="max-h-56 overflow-y-auto pr-1">
                      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-8">
                        {filteredNewTopicIcons.map(({ key, label, Icon }) => {
                          const selected = normalizeGameplayIconKey(newTopicDraft.iconKey) === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              title={label}
                              onClick={() => {
                                setNewTopicDraft((prev) => ({ ...prev, iconKey: key }));
                                setNewTopicIconPickerOpen(false);
                                setNewTopicIconSearch('');
                              }}
                              className={`inline-flex h-9 items-center justify-center rounded border transition-colors ${
                                selected
                                  ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                                  : 'border-yt-border/80 bg-[#101827] text-yt-text-secondary hover:border-yt-accent/70 hover:text-yt-accent'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <input
                type="text"
                value={newTopicDraft.title}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder={ui.topicTitlePlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={3}
                value={newTopicDraft.summary}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder={ui.topicSummaryPlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={10}
                value={newTopicDraft.content}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, content: event.target.value }))}
                placeholder={ui.topicContentPlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleCreateGameplayTopic}
                  disabled={creatingTopic}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300 disabled:cursor-not-allowed disabled:opacity-65"
                >
                  {creatingTopic ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  {ui.createTopic}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewTopicOpen(false);
                    setNewTopicIconPickerOpen(false);
                    setNewTopicIconSearch('');
                    setNewTopicStatus('');
                    setNewTopicDraft(buildEmptyNewTopicDraft(language));
                  }}
                  className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                  {ui.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {wikiLoading && (
          <div className="mt-4 rounded-xl border border-yt-border/80 bg-[#0e1520] px-3 py-2 text-sm text-yt-text-secondary">
            {ui.loadingArticles}
          </div>
        )}
        {wikiError && (
          <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {wikiError}
          </div>
        )}
      </section>

      {isGameplayArticleFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[275] flex items-center justify-center bg-[#03070fe0] p-3 transition-opacity duration-300 sm:p-5 ${
            isGameplayArticleFullscreenActive ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeGameplayArticleFullscreen}
        >
          <section
            className={`relative h-[min(92vh,1080px)] w-[min(1200px,96vw)] overflow-auto rounded-3xl border border-yt-border/85 bg-yt-bg-secondary/95 p-4 shadow-[0_26px_60px_rgba(0,0,0,0.62)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
              isGameplayArticleFullscreenActive ? 'scale-100 opacity-100' : 'scale-[0.975] opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            {renderGameplayArticleContent()}
          </section>
        </div>,
        document.body,
      )}

      <section
        className="relative cursor-zoom-in overflow-hidden rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/90 p-5 shadow-[0_20px_46px_rgba(0,0,0,0.38)]"
        onClick={handleShowroomClick}
        title={ui.showroomHint}
      >
        <div className="relative">
          {renderShowroomContent()}
        </div>
      </section>

      {isShowroomFullscreen && typeof document !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[260] flex items-center justify-center bg-[#03070eb8] p-3 backdrop-blur-sm transition-opacity duration-300 sm:p-5 ${
            isShowroomFullscreenActive ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={closeShowroomFullscreen}
        >
          <section
            className={`relative h-[min(90vh,1040px)] w-[min(1420px,96vw)] overflow-hidden rounded-3xl border border-yt-border/80 bg-yt-bg-secondary/95 p-5 shadow-[0_24px_56px_rgba(0,0,0,0.56)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-6 ${
              isShowroomFullscreenActive ? 'scale-100 opacity-100' : 'scale-[0.975] opacity-0'
            }`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative h-full">
              {renderShowroomContent({ fullscreen: true })}
            </div>
          </section>
        </div>,
        document.body,
      )}
    </div>
  );
}
