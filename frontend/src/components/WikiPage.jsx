import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
    title: 'Frontline Dinamico',
    description: 'Le zone cambiano stato in tempo reale. Ogni conquista modifica il bilanciamento del fronte.',
    Icon: Radar,
  },
  {
    id: 'logistics',
    iconKey: 'truck',
    title: 'Logistica Strategica',
    description: 'Gestione di rifornimenti, rotte e priorita missioni per mantenere operative le basi.',
    Icon: Truck,
  },
  {
    id: 'combined',
    iconKey: 'layers3',
    title: 'Operazioni Combined Arms',
    description: 'Veicoli e unita di supporto lavorano in sinergia con i piloti per gli obiettivi a terra.',
    Icon: Layers3,
  },
  {
    id: 'defense',
    iconKey: 'shield_check',
    title: 'Difesa Attiva',
    description: 'Assetti antiaerei e colonne mobili proteggono aeroporti, convogli e punti critici.',
    Icon: ShieldCheck,
  },
];

const GAMEPLAY_ICON_LIBRARY = [
  { key: 'radar', label: 'Radar', Icon: Radar },
  { key: 'truck', label: 'Truck', Icon: Truck },
  { key: 'shield_check', label: 'Shield', Icon: ShieldCheck },
  { key: 'layers3', label: 'Layers', Icon: Layers3 },
  { key: 'target', label: 'Target', Icon: Target },
  { key: 'activity', label: 'Activity', Icon: Activity },
  { key: 'radio', label: 'Radio', Icon: Radio },
  { key: 'package', label: 'Package', Icon: Package },
  { key: 'megaphone', label: 'Megaphone', Icon: Megaphone },
  { key: 'map_pin', label: 'Map Pin', Icon: MapPin },
  { key: 'plane', label: 'Plane', Icon: Plane },
  { key: 'helicopter', label: 'Helicopter', Icon: Helicopter },
  { key: 'anchor', label: 'Anchor', Icon: Anchor },
  { key: 'clipboard_list', label: 'Checklist', Icon: ClipboardList },
  { key: 'gamepad2', label: 'Gameplay', Icon: Gamepad2 },
];

const GAMEPLAY_ICON_MAP = GAMEPLAY_ICON_LIBRARY.reduce((acc, iconDef) => {
  acc[iconDef.key] = iconDef.Icon;
  return acc;
}, {});

const VEHICLES = [
  {
    id: 'avenger',
    category: 'Difesa Aerea',
    name: 'Avenger',
    description: 'Sistema SHORAD mobile per contrastare elicotteri e minacce a bassa quota.',
    image: avengerImg,
  },
  {
    id: 'firtina',
    category: 'Artiglieria',
    name: 'Firtina',
    description: 'Obice semovente per fuoco indiretto a lunga distanza su obiettivi tattici.',
    image: firtinaImg,
  },
  {
    id: 'fmtv',
    category: 'Logistica',
    name: 'FMTV',
    description: 'Camion tattico multiruolo per trasporto rifornimenti, munizioni e supporto operativo.',
    image: fmtvImg,
  },
  {
    id: 'gepard',
    category: 'Difesa Aerea',
    name: 'Gepard',
    description: 'Piattaforma antiaerea a cannoni per protezione ravvicinata delle unita a terra.',
    image: gepardImg,
  },
  {
    id: 'gmlrs',
    category: 'Artiglieria Missilistica',
    name: 'GMLRS',
    description: 'Razzi guidati a lungo raggio per ingaggi di precisione su target strategici.',
    image: gmlrsAtacmsImg,
  },
  {
    id: 'atacms',
    category: 'Artiglieria Missilistica',
    name: 'ATACMS',
    description: 'Missile tattico a lunghissimo raggio per colpire nodi critici in profondita.',
    image: gmlrsAtacmsImg,
  },
  {
    id: 'hemtt',
    category: 'Logistica',
    name: 'HEMTT',
    description: 'Piattaforma pesante per trasporto carburante, container e materiali di prima linea.',
    image: hemttImg,
  },
  {
    id: 'hmmwv',
    category: 'Ricognizione',
    name: 'HMMWV',
    description: 'Veicolo leggero rapido per pattugliamento, scouting e supporto mobile.',
    image: hmmwvImg,
  },
  {
    id: 'l118',
    category: 'Artiglieria',
    name: 'L118',
    description: 'Obice trainato da 105mm per supporto di fuoco rapido e flessibile.',
    image: l118Img,
  },
  {
    id: 'lav',
    category: 'Corazzato Leggero',
    name: 'LAV',
    description: 'Veicolo blindato veloce per ricognizione armata e protezione convogli.',
    image: lavImg,
  },
  {
    id: 'mbt',
    category: 'Corazzato',
    name: 'MBT',
    description: 'Main Battle Tank per sfondamento e superiorita sul terreno.',
    image: mbtImg,
  },
  {
    id: 'roland',
    category: 'Difesa Aerea',
    name: 'Roland',
    description: 'Sistema SAM mobile a corto-medio raggio per copertura antiaerea del fronte.',
    image: rolandImg,
  },
  {
    id: 'scimitar',
    category: 'Ricognizione',
    name: 'Scimitar',
    description: 'Veicolo cingolato leggero da esplorazione armata e acquisizione bersagli.',
    image: scimitarImg,
  },
  {
    id: 'scorpion',
    category: 'Difesa Aerea',
    name: 'Scorpion',
    description: 'Piattaforma di difesa ravvicinata per contrasto droni e minacce a corto raggio.',
    image: scorpionImg,
  },
  {
    id: 'tow',
    category: 'Controcarro',
    name: 'TOW',
    description: 'Sistema missilistico anticarro per neutralizzare veicoli blindati ad alta priorita.',
    image: towImg,
  },
];

const SLOT_ITEM_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];
const SLOT_STEP = 186;
const WHEEL_THRESHOLD = 40;
const FULLSCREEN_TRANSITION_MS = 280;
const SHOWROOM_BLUE_GLOW = 'rgba(78, 197, 255, 0.16)';
const WIKI_EDITOR_IDS = new Set(['675706661570347041']);
const EMPTY_NEW_TOPIC_DRAFT = {
  iconKey: 'layers3',
  title: '',
  summary: '',
  content: '## Nuovo Argomento\n\nScrivi qui il contenuto dell\'articolo.',
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

function wrapIndex(value, length) {
  return ((value % length) + length) % length;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function normalizeGameplayIconKey(iconKey) {
  return String(iconKey || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

function resolveGameplayIcon(iconKey, fallback = Layers3) {
  const normalizedKey = normalizeGameplayIconKey(iconKey);
  return GAMEPLAY_ICON_MAP[normalizedKey] || fallback;
}

function getVisualFromPosition(positionPx) {
  const normalized = Math.abs(positionPx) / SLOT_STEP;

  let opacity;
  let blur;
  let sizePx;

  if (normalized <= 1) {
    opacity = 1 - (0.5 * normalized);
    blur = 0.2 * normalized;
    sizePx = 156 - (76 * normalized);
  } else if (normalized <= 2) {
    const local = normalized - 1;
    opacity = 0.5 - (0.32 * local);
    blur = 0.2 + (1.6 * local);
    sizePx = 80 - (8 * local);
  } else {
    const local = normalized - 2;
    opacity = 0.18 - (0.13 * local);
    blur = 1.8 + (0.8 * local);
    sizePx = 72 - (10 * local);
  }

  return {
    opacity: clamp(opacity, 0.05, 1),
    blur: clamp(blur, 0, 2.6),
    sizePx: clamp(sizePx, 62, 156),
  };
}

export default function WikiPage() {
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
  const [newTopicDraft, setNewTopicDraft] = useState(EMPTY_NEW_TOPIC_DRAFT);
  const [newTopicStatus, setNewTopicStatus] = useState('');
  const [creatingTopic, setCreatingTopic] = useState(false);
  const [isGameplayArticleFullscreen, setIsGameplayArticleFullscreen] = useState(false);
  const [isGameplayArticleFullscreenActive, setIsGameplayArticleFullscreenActive] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [wikiDraft, setWikiDraft] = useState({ title: '', summary: '', content: '' });
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

  const priorityOffset = useMemo(() => {
    let bestOffset = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    SLOT_ITEM_OFFSETS.forEach((offset) => {
      const position = (offset * SLOT_STEP) + slotTranslate;
      const distance = Math.abs(position);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestOffset = offset;
      }
    });

    return bestOffset;
  }, [slotTranslate]);

  const selectedVehicle = useMemo(() => {
    const visualIndex = wrapIndex(selectedVehicleIndex + priorityOffset, VEHICLES.length);
    return VEHICLES[visualIndex];
  }, [selectedVehicleIndex, priorityOffset]);

  const gameplayItems = useMemo(() => {
    const featureById = new Map(GAMEPLAY_FEATURES.map((feature) => [feature.id, feature]));

    const baseItems = GAMEPLAY_FEATURES.map((feature) => {
      const page = wikiPagesById[feature.id];
      return {
        ...feature,
        title: page?.title || feature.title,
        description: page?.summary || feature.description,
      };
    });

    const customItems = Object.values(wikiPagesById)
      .filter((page) => page?.id && !featureById.has(page.id))
      .sort((a, b) => (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0))
      .map((page) => ({
        id: page.id,
        title: page.title || page.id,
        description: page.summary || 'Articolo wiki personalizzato',
        Icon: Layers3,
      }));

    return [...baseItems, ...customItems];
  }, [wikiPagesById]);

  const selectedGameplayFeature = useMemo(() => {
    if (!gameplayItems.length) return null;
    const fallback = gameplayItems[0];
    if (!selectedGameplayId) return fallback;
    return gameplayItems.find((item) => item.id === selectedGameplayId) || fallback;
  }, [gameplayItems, selectedGameplayId]);

  const selectedGameplayPage = useMemo(() => {
    if (!selectedGameplayFeature) return null;
    const page = wikiPagesById[selectedGameplayFeature.id];
    if (page) return page;
    return {
      id: selectedGameplayFeature.id,
      title: selectedGameplayFeature.title,
      summary: selectedGameplayFeature.description,
      content: `## ${selectedGameplayFeature.title}\n\n${selectedGameplayFeature.description}`,
      updatedAt: null,
      updatedBy: null,
    };
  }, [selectedGameplayFeature, wikiPagesById]);

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
      setSlotTranslate(-normalizedDirection * SLOT_STEP);
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
        setWikiError(error.message || 'Impossibile caricare le pagine wiki');
      } finally {
        setWikiLoading(false);
      }
    };

    loadWikiPages();
  }, []);

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
        setDraftStatus('Caricamento bozza...');
        const response = await api.getWikiDraft(selectedGameplayFeature.id);
        if (cancelled) return;
        const incomingDraft = response?.draft;
        const basePage = selectedGameplayPage || {};
        const nextDraft = incomingDraft
          ? {
            title: incomingDraft.title || basePage.title || '',
            summary: incomingDraft.summary || basePage.summary || '',
            content: incomingDraft.content || basePage.content || '',
          }
          : {
            title: basePage.title || '',
            summary: basePage.summary || '',
            content: basePage.content || '',
          };
        setWikiDraft(nextDraft);
        lastSavedDraftSerializedRef.current = JSON.stringify(nextDraft);
        setDraftStatus(incomingDraft ? 'Bozza caricata' : 'Nessuna bozza salvata');
      } catch (error) {
        if (cancelled) return;
        const basePage = selectedGameplayPage || {};
        const fallback = {
          title: basePage.title || '',
          summary: basePage.summary || '',
          content: basePage.content || '',
        };
        setWikiDraft(fallback);
        lastSavedDraftSerializedRef.current = JSON.stringify(fallback);
        if (String(error?.message || '').includes('404')) {
          setDraftStatus('Nessuna bozza salvata');
        } else {
          setDraftStatus(error.message || 'Errore caricamento bozza');
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
  }, [canEditWiki, editorOpen, selectedGameplayFeature?.id, selectedGameplayPage]);

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
        setDraftStatus('Salvataggio bozza...');
        await api.saveWikiDraft(selectedGameplayFeature.id, wikiDraft);
        lastSavedDraftSerializedRef.current = serialized;
        setDraftStatus('Bozza salvata');
      } catch (error) {
        setDraftStatus(error.message || 'Errore salvataggio bozza');
      } finally {
        wikiSaveTimerRef.current = null;
      }
    }, 900);
  }, [canEditWiki, draftLoading, editorOpen, selectedGameplayFeature?.id, wikiDraft]);

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
    setDraftStatus('');
    setNewTopicOpen(false);
    setNewTopicStatus('');
    openGameplayArticleFullscreen();
  };

  const handleCreateGameplayTopic = async () => {
    if (!canEditWiki) return;

    const title = String(newTopicDraft.title || '').trim();
    const summary = String(newTopicDraft.summary || '').trim();
    const content = String(newTopicDraft.content || '').trim();

    if (!title || !summary || !content) {
      setNewTopicStatus('Compila titolo, descrizione e contenuto.');
      return;
    }

    try {
      setCreatingTopic(true);
      setNewTopicStatus('Creazione argomento...');
      const response = await api.createWikiPage({ title, summary, content });
      const createdPage = response?.page;
      if (!createdPage?.id) {
        throw new Error('Creazione pagina non riuscita');
      }

      setWikiPagesById((prev) => ({
        ...prev,
        [createdPage.id]: createdPage,
      }));
      setSelectedGameplayId(createdPage.id);
      setEditorOpen(true);

      const createdDraft = {
        title: createdPage.title || title,
        summary: createdPage.summary || summary,
        content: createdPage.content || content,
      };
      setWikiDraft(createdDraft);
      lastSavedDraftSerializedRef.current = JSON.stringify(createdDraft);
      setDraftStatus('Articolo creato');

      setNewTopicOpen(false);
      setNewTopicStatus('');
      setNewTopicDraft({ ...EMPTY_NEW_TOPIC_DRAFT });
      openGameplayArticleFullscreen();
    } catch (error) {
      setNewTopicStatus(error.message || 'Errore creazione argomento');
    } finally {
      setCreatingTopic(false);
    }
  };

  const handlePublishGameplayArticle = async () => {
    if (!canEditWiki || !selectedGameplayFeature?.id) return;
    try {
      setDraftStatus('Pubblicazione...');
      const response = await api.updateWikiPage(selectedGameplayFeature.id, wikiDraft);
      const updatedPage = response?.page;
      if (updatedPage?.id) {
        setWikiPagesById((prev) => ({
          ...prev,
          [updatedPage.id]: updatedPage,
        }));
      }
      lastSavedDraftSerializedRef.current = JSON.stringify(wikiDraft);
      setDraftStatus('Articolo pubblicato');
      setEditorOpen(false);
    } catch (error) {
      setDraftStatus(error.message || 'Errore pubblicazione');
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
      setDraftStatus('Media inserito nel markdown');
    } catch (error) {
      setDraftStatus(error.message || 'Errore upload media');
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

    return (
      <article className="h-full rounded-2xl border border-yt-border/80 bg-[#0f1723] p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">
              {selectedGameplayPage.title}
            </h3>
            <p className="mt-1 text-sm text-yt-text-secondary">{selectedGameplayPage.summary}</p>
            {selectedGameplayPage.updatedAt && (
              <p className="mt-1 text-xs text-yt-text-secondary/80">
                Ultimo aggiornamento: {new Date(selectedGameplayPage.updatedAt).toLocaleString('it-IT')}
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
                {editorOpen ? 'Chiudi Editor' : 'Modifica Articolo'}
              </button>
            )}
            <button
              type="button"
              onClick={closeGameplayArticleFullscreen}
              className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
              aria-label="Chiudi articolo"
            >
              <X className="h-3.5 w-3.5" />
              Chiudi
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
                Editor Wiki + Preview
              </div>
              <div className="text-xs text-yt-text-secondary">{draftStatus}</div>
            </div>

            {draftLoading ? (
              <div className="flex items-center gap-2 text-sm text-yt-text-secondary">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento bozza...
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="space-y-2">
                  <input
                    type="text"
                    value={wikiDraft.title}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder="Titolo articolo"
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={3}
                    value={wikiDraft.summary}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, summary: event.target.value }))}
                    placeholder="Descrizione breve"
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <textarea
                    rows={14}
                    value={wikiDraft.content}
                    onChange={(event) => setWikiDraft((prev) => ({ ...prev, content: event.target.value }))}
                    placeholder="Contenuto markdown..."
                    className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 font-mono text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePublishGameplayArticle}
                      className="inline-flex items-center gap-1 rounded border border-emerald-500/45 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Pubblica
                    </button>
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent">
                      {uploadingMedia ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      Media
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
                      Chiudi
                    </button>
                  </div>
                </div>

                <div className="rounded border border-yt-border/80 bg-[#111a28] p-3">
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-[0.1em] text-yt-accent">Preview</h4>
                  <h3 className="text-lg font-extrabold uppercase tracking-[0.05em] text-yt-text-primary">{wikiDraft.title || 'Titolo'}</h3>
                  <p className="mb-3 mt-1 text-sm text-yt-text-secondary">{wikiDraft.summary || 'Descrizione breve'}</p>
                  <div className="max-h-[420px] overflow-auto rounded border border-yt-border/70 bg-[#0c1320] px-3 py-2">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                      {wikiDraft.content || '*Nessun contenuto*'}
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
    <>
      <div className="relative mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">Veicoli</h2>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleShowroomFullscreen();
            }}
            className="inline-flex items-center gap-1 rounded-full border border-yt-border/80 bg-[#101827] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
            title={fullscreen ? 'Chiudi fullscreen' : 'Apri fullscreen'}
            aria-label={fullscreen ? 'Chiudi fullscreen' : 'Apri fullscreen'}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {fullscreen ? 'Chiudi' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div className="space-y-5">
        <article className="relative flex items-start justify-center">
          <div className="w-full max-w-3xl space-y-3 pt-1 text-center">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <h3 className={`font-black uppercase leading-tight tracking-[0.05em] text-yt-text-primary ${fullscreen ? 'text-4xl' : 'text-3xl'}`}>
                {selectedVehicle.name}
              </h3>
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-accent/40 bg-yt-accent/12 px-3 py-1">
                <span className="h-2 w-2 rounded-full bg-yt-accent shadow-[0_0_10px_rgba(78,197,255,0.7)]" />
                <span className="text-xs font-black uppercase tracking-[0.14em] text-yt-accent">
                  Categoria: {selectedVehicle.category}
                </span>
              </div>
            </div>
            <p className={`mx-auto max-w-2xl leading-relaxed text-yt-text-secondary ${fullscreen ? 'text-base' : 'text-sm'}`}>
              {selectedVehicle.description}
            </p>
          </div>
        </article>

        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-x-40 -top-44 -bottom-12 opacity-42"
            style={{
              background: `radial-gradient(circle at 50% 62%, ${SHOWROOM_BLUE_GLOW}, transparent 78%)`,
              WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 100%)',
              maskImage: 'linear-gradient(to bottom, transparent 0%, black 30%, black 100%)',
            }}
          />

          <div
            className={`relative mx-auto overflow-hidden outline-none focus:outline-none ${fullscreen ? 'h-[360px] max-w-[min(92vw,1280px)]' : 'h-[300px] max-w-[min(92vw,1040px)]'}`}
            style={{
              WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
              maskImage: 'linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%)',
              overscrollBehavior: 'contain',
            }}
            onWheelCapture={handleWheel}
            onWheel={handleWheel}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="listbox"
            aria-label="Lista veicoli showroom"
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
                const position = (offset * SLOT_STEP) + slotTranslate;
                const visual = getVisualFromPosition(position);
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
                      transform: `translate(calc(-50% + ${offset * SLOT_STEP}px), -50%)`,
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
                        isPriority ? 'drop-shadow-[0_0_14px_rgba(78,197,255,0.26)]' : ''
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

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-6">
      <section className="rounded-3xl border border-yt-border/70 bg-yt-bg-secondary/85 p-5 shadow-[0_16px_34px_rgba(0,0,0,0.32)] backdrop-blur-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-yt-accent/35 bg-yt-accent/12 p-2">
              <Gamepad2 className="h-5 w-5 text-yt-accent" />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase tracking-[0.08em] text-yt-text-primary">Gameplay</h2>
              <p className="text-sm text-yt-text-secondary">Feature di gioco principali della campagna.</p>
            </div>
          </div>
          {canEditWiki && (
            <button
              type="button"
              onClick={() => {
                if (newTopicOpen) {
                  setNewTopicOpen(false);
                  setNewTopicStatus('');
                  return;
                }
                setNewTopicDraft({ ...EMPTY_NEW_TOPIC_DRAFT });
                setNewTopicStatus('');
                setNewTopicOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary transition-colors hover:border-yt-accent hover:text-yt-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              {newTopicOpen ? 'Chiudi Nuovo Argomento' : 'Nuovo Argomento'}
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
              <h3 className="text-sm font-bold uppercase tracking-[0.1em] text-yt-accent">Crea Nuovo Argomento</h3>
              {newTopicStatus && (
                <span className="text-xs text-yt-text-secondary">{newTopicStatus}</span>
              )}
            </div>
            <div className="space-y-2">
              <input
                type="text"
                value={newTopicDraft.title}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Titolo argomento"
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={3}
                value={newTopicDraft.summary}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, summary: event.target.value }))}
                placeholder="Descrizione breve"
                className="w-full rounded border border-yt-border/80 bg-[#111a28] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <textarea
                rows={10}
                value={newTopicDraft.content}
                onChange={(event) => setNewTopicDraft((prev) => ({ ...prev, content: event.target.value }))}
                placeholder="Contenuto markdown iniziale"
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
                  Crea Argomento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewTopicOpen(false);
                    setNewTopicStatus('');
                    setNewTopicDraft({ ...EMPTY_NEW_TOPIC_DRAFT });
                  }}
                  className="inline-flex items-center gap-1 rounded border border-yt-border/80 bg-[#101827] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                  Annulla
                </button>
              </div>
            </div>
          </div>
        )}

        {wikiLoading && (
          <div className="mt-4 rounded-xl border border-yt-border/80 bg-[#0e1520] px-3 py-2 text-sm text-yt-text-secondary">
            Caricamento articoli wiki...
          </div>
        )}
        {wikiError && (
          <div className="mt-4 rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {wikiError}
          </div>
        )}

        <p className="mt-4 text-xs uppercase tracking-[0.08em] text-yt-text-secondary/85">
          Clicca una feature per aprire l&apos;articolo in fullscreen.
        </p>
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
        title="Clicca per aprire lo showroom in fullscreen"
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
