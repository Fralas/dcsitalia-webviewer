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
  Megaphone,
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
    category: { en: 'Air Defense', it: 'Air Defense' },
    name: 'Avenger',
    description: {
      en: 'Mobile SHORAD system designed to counter helicopters and low-altitude threats.',
      it: 'Sistema SHORAD mobile per contrastare elicotteri e minacce a bassa quota.',
    },
    image: avengerImg,
  },
  {
    id: 'firtina',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'Firtina',
    description: {
      en: 'Self-propelled howitzer for long-range indirect fire on tactical targets.',
      it: 'Obice semovente per fuoco indiretto a lunga distanza su obiettivi tattici.',
    },
    image: firtinaImg,
  },
  {
    id: 'fmtv',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'FMTV',
    description: {
      en: 'Multi-role tactical truck for transporting supplies, ammunition, and field support cargo.',
      it: 'Camion tattico multiruolo per trasporto rifornimenti, munizioni e supporto operativo.',
    },
    image: fmtvImg,
  },
  {
    id: 'gepard',
    category: { en: 'Air Defense', it: 'Air Defense' },
    name: 'Gepard',
    description: {
      en: 'Gun-based anti-air platform for close protection of ground units.',
      it: 'Piattaforma antiaerea a cannoni per protezione ravvicinata delle unita a terra.',
    },
    image: gepardImg,
  },
  {
    id: 'gmlrs',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'GMLRS',
    description: {
      en: 'Long-range guided rockets for precision strikes on strategic targets.',
      it: 'Razzi guidati a lungo raggio per ingaggi di precisione su target strategici.',
    },
    image: gmlrsAtacmsImg,
  },
  {
    id: 'atacms',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'ATACMS',
    description: {
      en: 'Tactical very-long-range missile to strike critical deep targets.',
      it: 'Missile tattico a lunghissimo raggio per colpire nodi critici in profondita.',
    },
    image: gmlrsAtacmsImg,
  },
  {
    id: 'hemtt',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'HEMTT',
    description: {
      en: 'Heavy logistics platform for transporting fuel, containers, and frontline materiel.',
      it: 'Piattaforma pesante per trasporto carburante, container e materiali di prima linea.',
    },
    image: hemttImg,
  },
  {
    id: 'hmmwv',
    category: { en: 'RECON', it: 'RECON' },
    name: 'HMMWV',
    description: {
      en: 'Fast light vehicle for patrol, scouting, and mobile support tasks.',
      it: 'Veicolo leggero rapido per pattugliamento, scouting e supporto mobile.',
    },
    image: hmmwvImg,
  },
  {
    id: 'l118',
    category: { en: 'SUPPORT', it: 'SUPPORT' },
    name: 'L118',
    description: {
      en: '105mm towed howitzer for rapid and flexible fire support.',
      it: 'Obice trainato da 105mm per supporto di fuoco rapido e flessibile.',
    },
    image: l118Img,
  },
  {
    id: 'lav',
    category: { en: 'COMBAT', it: 'COMBAT' },
    name: 'LAV',
    description: {
      en: 'Fast armored vehicle for armed reconnaissance and convoy protection.',
      it: 'Veicolo blindato veloce per ricognizione armata e protezione convogli.',
    },
    image: lavImg,
  },
  {
    id: 'mbt',
    category: { en: 'COMBAT', it: 'COMBAT' },
    name: 'MBT',
    description: {
      en: 'Main battle tank for breakthrough operations and ground superiority.',
      it: 'Main Battle Tank per sfondamento e superiorita sul terreno.',
    },
    image: mbtImg,
  },
  {
    id: 'roland',
    category: { en: 'Air Defense', it: 'Air Defense' },
    name: 'Roland',
    description: {
      en: 'Mobile short/medium-range SAM system for frontline air cover.',
      it: 'Sistema SAM mobile a corto-medio raggio per copertura antiaerea del fronte.',
    },
    image: rolandImg,
  },
  {
    id: 'scimitar',
    category: { en: 'RECON', it: 'RECON' },
    name: 'Scimitar',
    description: {
      en: 'Light tracked vehicle for armed scouting and target acquisition.',
      it: 'Veicolo cingolato leggero da esplorazione armata e acquisizione bersagli.',
    },
    image: scimitarImg,
  },
  {
    id: 'scorpion',
    category: { en: 'Air Defense', it: 'Air Defense' },
    name: 'Scorpion',
    description: {
      en: 'Close-in defense platform against drones and short-range threats.',
      it: 'Piattaforma di difesa ravvicinata per contrasto droni e minacce a corto raggio.',
    },
    image: scorpionImg,
  },
  {
    id: 'tow',
    category: { en: 'COMBAT', it: 'COMBAT' },
    name: 'TOW',
    description: {
      en: 'Anti-tank missile system to neutralize high-priority armored targets.',
      it: 'Sistema missilistico anticarro per neutralizzare veicoli blindati ad alta priorita.',
    },
    image: towImg,
  },
];

const FULLSCREEN_TRANSITION_MS = 280;
const VEHICLE_FILTER_TRANSITION_MS = 170;
const WIKI_EDITOR_IDS = new Set(['675706661570347041']);
const WIKI_SHORT_DESCRIPTION_MAX_LENGTH = 82;
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
    vehicleName: 'Vehicle',
    vehicleImage: 'Image',
    vehicleDescription: 'Description',
    noVehicles: 'No vehicle available.',
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
    titlePlaceholderIt: 'Article title (Italian translation)',
    summaryPlaceholderIt: 'Short description (Italian translation)',
    contentPlaceholderIt: 'Markdown content (Italian translation)...',
    englishBase: 'English Base (Required)',
    italianTranslation: 'Italian Translation (Optional)',
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
    fillRequiredFieldsEn: 'Fill English title, summary, and content.',
    cancel: 'Cancel',
    topicTitlePlaceholder: 'Topic title',
    topicSummaryPlaceholder: 'Short description',
    topicContentPlaceholder: 'Initial markdown content',
    topicTitlePlaceholderIt: 'Topic title (Italian translation)',
    topicSummaryPlaceholderIt: 'Short description (Italian translation)',
    topicContentPlaceholderIt: 'Initial markdown content (Italian translation)',
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
    vehicleName: 'Veicolo',
    vehicleImage: 'Immagine',
    vehicleDescription: 'Descrizione',
    noVehicles: 'Nessun veicolo disponibile.',
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
    titlePlaceholderIt: 'Titolo articolo (traduzione italiana)',
    summaryPlaceholderIt: 'Descrizione breve (traduzione italiana)',
    contentPlaceholderIt: 'Contenuto markdown (traduzione italiana)...',
    englishBase: 'Base Inglese (Obbligatoria)',
    italianTranslation: 'Traduzione Italiana (Opzionale)',
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
    fillRequiredFieldsEn: 'Compila titolo, descrizione e contenuto in inglese.',
    cancel: 'Annulla',
    topicTitlePlaceholder: 'Titolo argomento',
    topicSummaryPlaceholder: 'Descrizione breve',
    topicContentPlaceholder: 'Contenuto markdown iniziale',
    topicTitlePlaceholderIt: 'Titolo argomento (traduzione italiana)',
    topicSummaryPlaceholderIt: 'Descrizione breve (traduzione italiana)',
    topicContentPlaceholderIt: 'Contenuto markdown iniziale (traduzione italiana)',
    icon: 'Icona',
    customWikiArticle: 'Articolo wiki personalizzato',
    lastUpdated: 'Ultimo aggiornamento',
    notAuthenticated: 'Non autenticato',
    articleTitle: 'Nuovo Argomento',
  },
};
function buildEmptyNewTopicDraft() {
  const heading = 'New Topic';
  const description = 'Write the article content here.';
  return {
    iconKey: 'layers3',
    titleEn: '',
    summaryEn: '',
    contentEn: `## ${heading}\n\n${description}`,
    titleIt: '',
    summaryIt: '',
    contentIt: '',
  };
}

function toLocalizedDraftValue(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      en: String(value.en || ''),
      it: String(value.it || ''),
    };
  }
  return {
    en: String(value || ''),
    it: '',
  };
}

function createWikiDraftFromSource(source = {}) {
  const title = toLocalizedDraftValue(source.title);
  const summary = toLocalizedDraftValue(source.summary);
  const content = toLocalizedDraftValue(source.content);
  return {
    iconKey: normalizeGameplayIconKey(source.iconKey || 'layers3'),
    titleEn: title.en,
    summaryEn: summary.en,
    contentEn: content.en,
    titleIt: title.it,
    summaryIt: summary.it,
    contentIt: content.it,
  };
}

function createWikiPayloadFromDraft(draft = {}) {
  return {
    iconKey: normalizeGameplayIconKey(draft.iconKey || 'layers3'),
    title: {
      en: String(draft.titleEn || '').trim(),
      it: String(draft.titleIt || '').trim(),
    },
    summary: {
      en: String(draft.summaryEn || '').trim(),
      it: String(draft.summaryIt || '').trim(),
    },
    content: {
      en: String(draft.contentEn || '').trim(),
      it: String(draft.contentIt || '').trim(),
    },
  };
}

function getDraftLocalizedField(draft = {}, field = 'title', language = DEFAULT_LANGUAGE) {
  const en = String(draft?.[`${field}En`] || '');
  const it = String(draft?.[`${field}It`] || '');
  if (language === 'it' && it) {
    return it;
  }
  return en || it;
}

function localizeText(value, language) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value[language] || value.en || value.it || '';
  }
  return String(value || '');
}

function getVehicleCategoryKey(category) {
  if (category && typeof category === 'object' && !Array.isArray(category)) {
    return String(category.en || category.it || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
  }
  return String(category || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-');
}

const VEHICLE_CATEGORY_KEYS = {
  support: getVehicleCategoryKey('SUPPORT'),
  airDefense: getVehicleCategoryKey('Air Defense'),
  recon: getVehicleCategoryKey('RECON'),
  combat: getVehicleCategoryKey('COMBAT'),
};

const DEFAULT_VEHICLE_CATEGORY_KEY = VEHICLE_CATEGORY_KEYS.support;

const VEHICLE_CATEGORY_ICON_BY_KEY = {
  [VEHICLE_CATEGORY_KEYS.support]: Truck,
  [VEHICLE_CATEGORY_KEYS.airDefense]: ShieldCheck,
  [VEHICLE_CATEGORY_KEYS.recon]: Eye,
  [VEHICLE_CATEGORY_KEYS.combat]: Target,
};

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

function resolveGameplayIcon(iconKey, fallback = Layers3) {
  const normalizedKey = normalizeGameplayIconKey(iconKey);
  return GAMEPLAY_ICON_MAP[normalizedKey] || fallback;
}

export default function WikiPage({ language = DEFAULT_LANGUAGE }) {
  const { user } = useUser();
  const [selectedVehicleCategoryKey, setSelectedVehicleCategoryKey] = useState(DEFAULT_VEHICLE_CATEGORY_KEY);
  const [isVehicleCategoryContentVisible, setIsVehicleCategoryContentVisible] = useState(true);
  const [wikiPagesById, setWikiPagesById] = useState({});
  const [wikiLoading, setWikiLoading] = useState(true);
  const [wikiError, setWikiError] = useState('');
  const [selectedGameplayId, setSelectedGameplayId] = useState('');
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const [newTopicDraft, setNewTopicDraft] = useState(() => buildEmptyNewTopicDraft());
  const [newTopicStatus, setNewTopicStatus] = useState('');
  const [newTopicIconPickerOpen, setNewTopicIconPickerOpen] = useState(false);
  const [newTopicIconSearch, setNewTopicIconSearch] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [isGameplayArticleFullscreen, setIsGameplayArticleFullscreen] = useState(false);
  const [isGameplayArticleFullscreenActive, setIsGameplayArticleFullscreenActive] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [wikiDraftIconPickerOpen, setWikiDraftIconPickerOpen] = useState(false);
  const [wikiDraftIconSearch, setWikiDraftIconSearch] = useState('');
  const [wikiDraft, setWikiDraft] = useState(() => createWikiDraftFromSource({ iconKey: 'layers3' }));
  const [draftStatus, setDraftStatus] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const vehicleCategorySwitchTimeoutRef = useRef(null);
  const vehicleCategoryShowRafRef = useRef(null);
  const gameplayCloseTimeoutRef = useRef(null);
  const gameplayOpenRafRef = useRef(null);
  const wikiSaveTimerRef = useRef(null);
  const lastSavedDraftSerializedRef = useRef('');
  const wikiMediaInputRef = useRef(null);

  const canEditWiki = Boolean(user?.id && WIKI_EDITOR_IDS.has(String(user.id)));
  const ui = UI_COPY[language] || UI_COPY.en;
  const dateLocale = language === 'it' ? 'it-IT' : 'en-US';

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

  const vehicleGroups = useMemo(() => {
    const groupsByKey = new Map();
    VEHICLES.forEach((vehicle) => {
      const categoryKey = getVehicleCategoryKey(vehicle.category);
      if (!groupsByKey.has(categoryKey)) {
        groupsByKey.set(categoryKey, {
          key: categoryKey,
          category: vehicle.category,
          vehicles: [],
        });
      }
      groupsByKey.get(categoryKey).vehicles.push(vehicle);
    });
    return Array.from(groupsByKey.values());
  }, []);

  const selectedVehicleGroup = useMemo(
    () => vehicleGroups.find((group) => group.key === selectedVehicleCategoryKey) || vehicleGroups[0] || null,
    [vehicleGroups, selectedVehicleCategoryKey],
  );

  useEffect(() => {
    if (!vehicleGroups.length) return;
    if (vehicleGroups.some((group) => group.key === selectedVehicleCategoryKey)) {
      return;
    }
    const supportGroup = vehicleGroups.find((group) => group.key === DEFAULT_VEHICLE_CATEGORY_KEY);
    setSelectedVehicleCategoryKey(supportGroup ? supportGroup.key : vehicleGroups[0].key);
  }, [vehicleGroups, selectedVehicleCategoryKey]);

  const gameplayItems = useMemo(() => {
    const featureById = new Map(GAMEPLAY_FEATURES.map((feature) => [feature.id, feature]));

    const baseItems = GAMEPLAY_FEATURES.map((feature) => {
      const page = wikiPagesById[feature.id];
      const Icon = resolveGameplayIcon(page?.iconKey, feature.Icon);
      return {
        ...feature,
        iconKey: normalizeGameplayIconKey(page?.iconKey || feature.iconKey || ''),
        Icon,
        title: localizeText(page?.title, language) || localizeText(feature.title, language),
        description: localizeText(page?.summary, language) || localizeText(feature.description, language),
      };
    });

    const customItems = Object.values(wikiPagesById)
      .filter((page) => page?.id && !featureById.has(page.id))
      .sort((a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0))
      .map((page) => ({
        id: page.id,
        iconKey: normalizeGameplayIconKey(page.iconKey || 'layers3'),
        title: localizeText(page.title, language) || page.id,
        description: localizeText(page.summary, language) || ui.customWikiArticle,
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

  const selectedGameplayPageTitle = useMemo(
    () => localizeText(selectedGameplayPage?.title, language) || ui.titleFallback,
    [selectedGameplayPage?.title, language, ui.titleFallback],
  );
  const selectedGameplayPageSummary = useMemo(
    () => localizeText(selectedGameplayPage?.summary, language) || ui.summaryFallback,
    [selectedGameplayPage?.summary, language, ui.summaryFallback],
  );
  const selectedGameplayPageContent = useMemo(
    () => localizeText(selectedGameplayPage?.content, language) || ui.emptyContentFallback,
    [selectedGameplayPage?.content, language, ui.emptyContentFallback],
  );

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
    if (!isGameplayArticleFullscreen) {
      return undefined;
    }

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      closeGameplayArticleFullscreen();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isGameplayArticleFullscreen]);

  useEffect(() => () => {
    if (vehicleCategorySwitchTimeoutRef.current) {
      clearTimeout(vehicleCategorySwitchTimeoutRef.current);
    }
    if (vehicleCategoryShowRafRef.current) {
      cancelAnimationFrame(vehicleCategoryShowRafRef.current);
    }
    if (gameplayCloseTimeoutRef.current) {
      clearTimeout(gameplayCloseTimeoutRef.current);
    }
    if (gameplayOpenRafRef.current) {
      cancelAnimationFrame(gameplayOpenRafRef.current);
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
          ? createWikiDraftFromSource({
            iconKey: incomingDraft.iconKey || basePage.iconKey || 'layers3',
            title: incomingDraft.title || basePage.title || '',
            summary: incomingDraft.summary || basePage.summary || '',
            content: incomingDraft.content || basePage.content || '',
          })
          : createWikiDraftFromSource({
            iconKey: basePage.iconKey || 'layers3',
            title: basePage.title || '',
            summary: basePage.summary || '',
            content: basePage.content || '',
          });
        setWikiDraft(nextDraft);
        lastSavedDraftSerializedRef.current = JSON.stringify(nextDraft);
        setDraftStatus(incomingDraft ? ui.draftLoaded : ui.noDraftSaved);
      } catch (error) {
        if (cancelled) return;
        const basePage = selectedGameplayPage || {};
        const fallback = createWikiDraftFromSource({
          iconKey: basePage.iconKey || 'layers3',
          title: basePage.title || '',
          summary: basePage.summary || '',
          content: basePage.content || '',
        });
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
        await api.saveWikiDraft(selectedGameplayFeature.id, createWikiPayloadFromDraft(wikiDraft));
        lastSavedDraftSerializedRef.current = serialized;
        setDraftStatus(ui.draftSaved);
      } catch (error) {
        setDraftStatus(error.message || ui.draftSaveError);
      } finally {
        wikiSaveTimerRef.current = null;
      }
    }, 900);
  }, [canEditWiki, draftLoading, editorOpen, selectedGameplayFeature?.id, wikiDraft, ui.savingDraft, ui.draftSaved, ui.draftSaveError]);

  const handleVehicleCategoryFilterChange = (nextCategoryKey) => {
    if (!nextCategoryKey || nextCategoryKey === selectedVehicleCategoryKey) {
      return;
    }

    if (vehicleCategorySwitchTimeoutRef.current) {
      clearTimeout(vehicleCategorySwitchTimeoutRef.current);
    }
    if (vehicleCategoryShowRafRef.current) {
      cancelAnimationFrame(vehicleCategoryShowRafRef.current);
      vehicleCategoryShowRafRef.current = null;
    }

    setIsVehicleCategoryContentVisible(false);

    vehicleCategorySwitchTimeoutRef.current = setTimeout(() => {
      setSelectedVehicleCategoryKey(nextCategoryKey);
      vehicleCategoryShowRafRef.current = requestAnimationFrame(() => {
        setIsVehicleCategoryContentVisible(true);
      });
      vehicleCategorySwitchTimeoutRef.current = null;
    }, VEHICLE_FILTER_TRANSITION_MS);
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
    const titleEn = String(newTopicDraft.titleEn || '').trim();
    const summaryEn = String(newTopicDraft.summaryEn || '').trim();
    const contentEn = String(newTopicDraft.contentEn || '').trim();
    const titleIt = String(newTopicDraft.titleIt || '').trim();
    const summaryIt = String(newTopicDraft.summaryIt || '').trim();
    const contentIt = String(newTopicDraft.contentIt || '').trim();

    if (!titleEn || !summaryEn || !contentEn) {
      setNewTopicStatus(ui.fillRequiredFieldsEn);
      return;
    }

    try {
      setCreatingTopic(true);
      setNewTopicStatus(ui.creatingTopic);
      const response = await api.createWikiPage({
        iconKey,
        title: { en: titleEn, it: titleIt },
        summary: { en: summaryEn, it: summaryIt },
        content: { en: contentEn, it: contentIt },
      });
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

      const createdDraft = createWikiDraftFromSource({
        iconKey: createdPage.iconKey || iconKey || 'layers3',
        title: createdPage.title || { en: titleEn, it: titleIt },
        summary: createdPage.summary || { en: summaryEn, it: summaryIt },
        content: createdPage.content || { en: contentEn, it: contentIt },
      });
      setWikiDraft(createdDraft);
      lastSavedDraftSerializedRef.current = JSON.stringify(createdDraft);
      setDraftStatus(ui.topicCreated);

      setNewTopicOpen(false);
      setNewTopicIconPickerOpen(false);
      setNewTopicIconSearch('');
      setNewTopicStatus('');
      setNewTopicDraft(buildEmptyNewTopicDraft());
      openGameplayArticleFullscreen();
    } catch (error) {
      setNewTopicStatus(error.message || ui.topicCreateError);
    } finally {
      setCreatingTopic(false);
    }
  };

  const handlePublishGameplayArticle = async () => {
    if (!canEditWiki || !selectedGameplayFeature?.id) return;
    const payload = createWikiPayloadFromDraft(wikiDraft);
    if (!payload.title.en || !payload.summary.en || !payload.content.en) {
      setDraftStatus(ui.fillRequiredFieldsEn);
      return;
    }
    try {
      setDraftStatus(ui.publishing);
      const response = await api.updateWikiPage(selectedGameplayFeature.id, payload);
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
          contentEn: `${prev.contentEn || ''}${snippet}`,
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
              {selectedGameplayPageTitle}
            </h3>
            <p className="mt-1 text-sm text-yt-text-secondary">{selectedGameplayPageSummary}</p>
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
            {selectedGameplayPageContent}
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
                  <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-yt-accent">{ui.englishBase}</p>
                  <input
                    type="text"
                    value={wikiDraft.titleEn}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                    placeholder={ui.titlePlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={3}
                    value={wikiDraft.summaryEn}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, summaryEn: event.target.value }))}
                    placeholder={ui.summaryPlaceholder}
                    maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={10}
                    value={wikiDraft.contentEn}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, contentEn: event.target.value }))}
                    placeholder={ui.contentPlaceholder}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />

                  <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.italianTranslation}</p>
                  <input
                    type="text"
                    value={wikiDraft.titleIt}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, titleIt: event.target.value }))}
                    placeholder={ui.titlePlaceholderIt}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={3}
                    value={wikiDraft.summaryIt}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, summaryIt: event.target.value }))}
                    placeholder={ui.summaryPlaceholderIt}
                    maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={8}
                    value={wikiDraft.contentIt}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, contentIt: event.target.value }))}
                    placeholder={ui.contentPlaceholderIt}
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
                    {getDraftLocalizedField(wikiDraft, 'title', language) || ui.titleFallback}
                  </h3>
                  <p className="mb-3 mt-1 text-sm text-yt-text-secondary">
                    {getDraftLocalizedField(wikiDraft, 'summary', language) || ui.summaryFallback}
                  </p>
                  <div className="max-h-[420px] overflow-auto rounded border border-yt-border/70 bg-[#0c1320] px-3 py-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {getDraftLocalizedField(wikiDraft, 'content', language) || ui.emptyContentFallback}
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

  const renderShowroomContent = () => (
    <div className="space-y-5">
      <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">{ui.vehicles}</h2>
      <div className="grid items-start gap-4 lg:grid-cols-[64px,minmax(0,1fr)]">
        <aside className="h-fit self-start rounded-2xl border border-yt-border/80 bg-[#0f1723] p-1.5">
          <div className="flex items-center justify-center gap-2 lg:flex-col">
            {vehicleGroups.map((group) => {
              const categoryLabel = localizeText(group.category, language);
              const active = selectedVehicleGroup?.key === group.key;
              const CategoryIcon = VEHICLE_CATEGORY_ICON_BY_KEY[group.key] || Package;

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => handleVehicleCategoryFilterChange(group.key)}
                  title={categoryLabel}
                  aria-label={categoryLabel}
                  aria-pressed={active}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-all ${
                    active
                      ? 'border-yt-accent/70 bg-yt-accent/15 text-yt-accent shadow-[0_0_0_1px_rgba(78,197,255,0.24)]'
                      : 'border-yt-border/80 bg-[#111a28] text-yt-text-secondary hover:border-yt-accent/45 hover:text-yt-accent'
                  }`}
                >
                  <CategoryIcon className="h-4 w-4" />
                </button>
              );
            })}
          </div>
        </aside>

        {!selectedVehicleGroup ? (
          <p className="flex h-[min(72vh,620px)] items-center rounded-xl border border-yt-border/75 bg-[#0f1723] px-4 py-3 text-sm text-yt-text-secondary">
            {ui.noVehicles}
          </p>
        ) : (
          <article
            key={selectedVehicleGroup.key}
            className={`flex h-[min(72vh,620px)] flex-col rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4 transition-all duration-200 ease-out ${
              isVehicleCategoryContentVisible ? 'translate-x-0 opacity-100' : 'translate-x-2 opacity-0'
            }`}
          >
            <h3 className="mb-3 text-sm font-extrabold uppercase tracking-[0.1em] text-yt-accent">
              {localizeText(selectedVehicleGroup.category, language)}
            </h3>
            <div className="flex-1 overflow-auto rounded-xl border border-yt-border/70">
              <table className="min-w-full border-collapse text-sm">
                <thead className="bg-[#111b2a]">
                  <tr>
                    <th className="border border-yt-border/70 px-3 py-2 text-left font-bold uppercase tracking-[0.08em] text-yt-text-primary">
                      {ui.vehicleName}
                    </th>
                    <th className="border border-yt-border/70 px-3 py-2 text-left font-bold uppercase tracking-[0.08em] text-yt-text-primary">
                      {ui.vehicleImage}
                    </th>
                    <th className="border border-yt-border/70 px-3 py-2 text-left font-bold uppercase tracking-[0.08em] text-yt-text-primary">
                      {ui.vehicleDescription}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selectedVehicleGroup.vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="bg-[#0f1723] align-top">
                      <td className="border border-yt-border/70 px-3 py-2 font-semibold text-yt-text-primary">
                        {vehicle.name}
                      </td>
                      <td className="border border-yt-border/70 px-3 py-2">
                        <img
                          src={vehicle.image}
                          alt={vehicle.name}
                          className="h-12 w-20 object-contain sm:h-14 sm:w-24"
                          loading="lazy"
                        />
                      </td>
                      <td className="border border-yt-border/70 px-3 py-2 leading-relaxed text-yt-text-secondary">
                        {localizeText(vehicle.description, language)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        )}
      </div>
    </div>
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
                setNewTopicDraft(buildEmptyNewTopicDraft());
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
              <p className="text-[11px] font-bold uppercase tracking-[0.09em] text-yt-accent">{ui.englishBase}</p>
              <input
                type="text"
                value={newTopicDraft.titleEn}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                placeholder={ui.topicTitlePlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={3}
                value={newTopicDraft.summaryEn}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, summaryEn: event.target.value }))}
                placeholder={ui.topicSummaryPlaceholder}
                maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={8}
                value={newTopicDraft.contentEn}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, contentEn: event.target.value }))}
                placeholder={ui.topicContentPlaceholder}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />

              <p className="pt-1 text-[11px] font-bold uppercase tracking-[0.09em] text-yt-text-secondary">{ui.italianTranslation}</p>
              <input
                type="text"
                value={newTopicDraft.titleIt}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, titleIt: event.target.value }))}
                placeholder={ui.topicTitlePlaceholderIt}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={3}
                value={newTopicDraft.summaryIt}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, summaryIt: event.target.value }))}
                placeholder={ui.topicSummaryPlaceholderIt}
                maxLength={WIKI_SHORT_DESCRIPTION_MAX_LENGTH}
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={6}
                value={newTopicDraft.contentIt}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, contentIt: event.target.value }))}
                placeholder={ui.topicContentPlaceholderIt}
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
                    setNewTopicDraft(buildEmptyNewTopicDraft());
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

      <section className="relative overflow-hidden rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/90 p-5 shadow-[0_20px_46px_rgba(0,0,0,0.38)]">
        <div className="relative">
          {renderShowroomContent()}
        </div>
      </section>
    </div>
  );
}
