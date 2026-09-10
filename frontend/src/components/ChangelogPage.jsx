import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarSync, ImagePlus, Languages, Loader2, Pencil, Plus, Save, Trash2, Upload, Video, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';
import InlineError from './InlineError';
import './ChangelogPage.css';

const ALLOWED_AUTHOR_IDS = new Set([
  '153370631772045313',
  '371212324054237206',
  '453594416863641600',
  '675706661570347041',
  '714087060343881778',
  '812070579888848988',
  '1026508512152518708',
  '1385701793345962035',
]);

const CONTRIBUTORS = [
  { id: '153370631772045313', label: 'Kira' },
  { id: '371212324054237206', label: '371212324054237206' },
  { id: '453594416863641600', label: '453594416863641600' },
  { id: '675706661570347041', label: 'Fralas' },
  { id: '714087060343881778', label: 'DJOGO' },
  { id: '812070579888848988', label: '812070579888848988' },
  { id: '1026508512152518708', label: '1026508512152518708' },
  { id: '1385701793345962035', label: '1385701793345962035' },
];

const TAGS = {
  NEW: { label: 'New', tone: 'new' },
  UPD: { label: 'Upd', tone: 'upd' },
  FIX: { label: 'Fix', tone: 'fix' },
  WIP: { label: 'WIP', tone: 'wip' },
};

const UI_COPY = {
  en: {
    kicker: 'Release notes',
    title: 'Changelog',
    lede: 'Campaign updates, fixes, and work in progress.',
    composer: 'Composer',
    composerNew: 'New changelog entry.',
    composerEdit: 'Editing a published entry.',
    openEditor: 'New entry',
    closeEditor: 'Close editor',
    draftReady: 'Draft ready',
    titleIt: 'Italian title',
    titleEn: 'English title',
    titlePlaceholder: 'Changelog title',
    titleEnPlaceholder: 'English title',
    rowIt: 'Italian',
    rowEn: 'English',
    rowPlaceholder: 'Italian row (markdown)',
    rowEnPlaceholder: 'English row (markdown)',
    addRow: 'Add row',
    removeRow: 'Remove',
    contributors: 'Contributors',
    media: 'Inline media',
    mediaHint: 'Place the cursor in an IT/EN row. Each upload is inserted at that point.',
    uploadMedia: 'Upload media',
    insert: 'Insert',
    remove: 'Remove',
    translateEn: 'Translate EN',
    publish: 'Publish',
    update: 'Update',
    cancelEdit: 'Cancel edit',
    deleteDraft: 'Delete draft',
    readonly: 'This account is read-only for changelogs.',
    loading: 'Loading changelog...',
    empty: 'No changelog published yet.',
    feed: 'Published',
    feedSubtitle: 'All published campaign notes.',
    by: 'by',
    edit: 'Edit',
    delete: 'Delete',
    close: 'Close',
    confirmDelete: 'Delete this changelog?',
  },
  it: {
    kicker: 'Note di rilascio',
    title: 'Changelog',
    lede: 'Aggiornamenti di campagna, correzioni e lavori in corso.',
    composer: 'Composizione',
    composerNew: 'Nuova voce changelog.',
    composerEdit: 'Modifica di una voce pubblicata.',
    openEditor: 'Nuova voce',
    closeEditor: 'Chiudi editor',
    draftReady: 'Bozza pronta',
    titleIt: 'Titolo italiano',
    titleEn: 'Titolo inglese',
    titlePlaceholder: 'Titolo changelog',
    titleEnPlaceholder: 'English title',
    rowIt: 'Italiano',
    rowEn: 'Inglese',
    rowPlaceholder: 'Riga IT (markdown)',
    rowEnPlaceholder: 'English row (markdown)',
    addRow: 'Aggiungi riga',
    removeRow: 'Rimuovi',
    contributors: 'Contributor',
    media: 'Media nel testo',
    mediaHint: 'Posiziona il cursore in una riga IT/EN: ogni upload viene inserito nel punto scelto.',
    uploadMedia: 'Carica media',
    insert: 'Inserisci',
    remove: 'Rimuovi',
    translateEn: 'Traduci EN',
    publish: 'Pubblica',
    update: 'Aggiorna',
    cancelEdit: 'Annulla modifica',
    deleteDraft: 'Elimina bozza',
    readonly: 'Account in sola lettura per i changelog.',
    loading: 'Caricamento changelog...',
    empty: 'Nessun changelog pubblicato.',
    feed: 'Pubblicati',
    feedSubtitle: 'Tutte le note di campagna pubblicate.',
    by: 'di',
    edit: 'Modifica',
    delete: 'Elimina',
    close: 'Chiudi',
    confirmDelete: 'Confermi eliminazione di questo changelog?',
  },
};

const EMPTY_DRAFT = {
  title: '',
  titleEn: '',
  rows: [{ id: `row_${Date.now()}`, tag: 'UPD', text: '', textEn: '' }],
  attachments: [],
  contributorIds: [],
};

function getLocalDraftKey(userId) {
  return `changelog_draft_${String(userId || 'guest')}`;
}

function readLocalDraft(userId) {
  try {
    const raw = localStorage.getItem(getLocalDraftKey(userId));
    return raw ? normalizeDraft(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function formatEntryStamp(timestamp, locale) {
  try {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      return { day: '-', time: '' };
    }
    return {
      day: date.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      time: date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    };
  } catch {
    return { day: '-', time: '' };
  }
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

function inferMediaMimeType(file) {
  const fromFile = String(file?.type || '').trim().toLowerCase();
  if (fromFile.startsWith('image/') || fromFile.startsWith('video/')) {
    return fromFile;
  }

  const lowerName = String(file?.name || '').trim().toLowerCase();
  if (!lowerName) return '';

  const extensionMap = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',
    '.ogv': 'video/ogg',
    '.mov': 'video/quicktime',
    '.m4v': 'video/x-m4v',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
  };

  const entry = Object.entries(extensionMap).find(([extension]) => lowerName.endsWith(extension));
  return entry?.[1] || '';
}

function escapeHtml(text) {
  return String(text || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isSafeMediaUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return false;
  if (raw.startsWith('/api/changelogs/media/')) return true;
  return /^https?:\/\/[^\s]+$/i.test(raw);
}

function mediaToMarkdownSnippet(media) {
  if (!media?.url || !media?.type) return '';
  const safeLabel = String(media.fileName || media.id || 'media')
    .replaceAll('[', '')
    .replaceAll(']', '');
  return media.type === 'video'
    ? `!video[${safeLabel}](${media.url})`
    : `![${safeLabel}](${media.url})`;
}

function renderInlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/!video\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, _alt, rawUrl) => {
    if (!isSafeMediaUrl(rawUrl)) return '[invalid-video-url]';
    return `<video src="${rawUrl}" controls></video>`;
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, altText, rawUrl) => {
    if (!isSafeMediaUrl(rawUrl)) return '[invalid-image-url]';
    return `<img src="${rawUrl}" alt="${altText || 'image'}" loading="lazy" />`;
  });
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  return out;
}

function renderMarkdownBlock(markdown) {
  const lines = String(markdown || '').split('\n');
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) {
      html.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      html.push('</ol>');
      inOl = false;
    }
  };

  lines.forEach((lineRaw) => {
    const line = lineRaw.trimEnd();
    if (!line.trim()) {
      closeLists();
      return;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      closeLists();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul>');
        inUl = true;
      }
      html.push(`<li>${renderInlineMarkdown(ul[1])}</li>`);
      return;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inUl) {
        html.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        html.push('<ol>');
        inOl = true;
      }
      html.push(`<li>${renderInlineMarkdown(ol[1])}</li>`);
      return;
    }

    closeLists();
    html.push(`<p>${renderInlineMarkdown(line)}</p>`);
  });

  closeLists();
  return html.join('');
}

function normalizeDraft(rawDraft) {
  if (!rawDraft || typeof rawDraft !== 'object') return { ...EMPTY_DRAFT };
  const rows = Array.isArray(rawDraft.rows) && rawDraft.rows.length
    ? rawDraft.rows.map((row, index) => ({
      id: String(row?.id || `row_${index + 1}`),
      tag: TAGS[row?.tag] ? row.tag : 'UPD',
      text: String(row?.text || ''),
      textEn: String(row?.textEn || ''),
    }))
    : [{ id: `row_${Date.now()}`, tag: 'UPD', text: '', textEn: '' }];

  return {
    title: String(rawDraft.title || ''),
    titleEn: String(rawDraft.titleEn || ''),
    rows,
    attachments: Array.isArray(rawDraft.attachments) ? rawDraft.attachments : [],
    contributorIds: Array.isArray(rawDraft.contributorIds) ? rawDraft.contributorIds : [],
  };
}

export default function ChangelogPage({ language = 'en' }) {
  const { user } = useUser();
  const canEdit = Boolean(user?.id && ALLOWED_AUTHOR_IDS.has(String(user.id)));
  const [posts, setPosts] = useState([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [draftReady, setDraftReady] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [busyUpload, setBusyUpload] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editingPostId, setEditingPostId] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null);
  const [error, setError] = useState('');
  const lastSavedSerializedRef = useRef('');
  const textareaRefs = useRef(new Map());
  const activeEditorRef = useRef(null);
  const pendingCaretRef = useRef(null);
  const viewLanguage = language === 'it' ? 'it' : 'en';
  const ui = UI_COPY[viewLanguage] || UI_COPY.en;
  const dateLocale = viewLanguage === 'it' ? 'it-IT' : 'en-US';

  const contributorsById = useMemo(() => {
    const map = new Map();
    CONTRIBUTORS.forEach((entry) => map.set(entry.id, entry.label));
    return map;
  }, []);

  const loadPosts = async () => {
    try {
      setLoadingPosts(true);
      const response = await api.getChangelogs();
      setPosts(Array.isArray(response?.posts) ? response.posts : []);
    } catch (err) {
      setError(err.message || 'Impossibile caricare i changelog');
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setFullscreenMedia(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const loadDraft = async () => {
      if (!canEdit) {
        setDraft(EMPTY_DRAFT);
        setDraftReady(false);
        lastSavedSerializedRef.current = JSON.stringify(EMPTY_DRAFT);
        return;
      }
      try {
        const response = await api.getChangelogDraft();
        const serverDraft = normalizeDraft(response?.draft);
        const localDraft = readLocalDraft(user.id);
        const normalized = (response?.draft ? serverDraft : (localDraft || serverDraft));
        setDraft(normalized);
        lastSavedSerializedRef.current = JSON.stringify(normalized);
      } catch (err) {
        if (String(err?.message || '').includes('HTTP 404')) {
          const localDraft = readLocalDraft(user.id);
          const normalized = localDraft || normalizeDraft(null);
          setDraft(normalized);
          lastSavedSerializedRef.current = JSON.stringify(normalized);
        } else {
          setError(err.message || 'Impossibile caricare la bozza changelog');
        }
      } finally {
        setDraftReady(true);
      }
    };

    loadDraft();
  }, [canEdit, user?.id]);

  useEffect(() => {
    if (!canEdit || !user?.id) return;
    try {
      localStorage.setItem(getLocalDraftKey(user.id), JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }, [draft, canEdit, user?.id]);

  useEffect(() => {
    if (!canEdit || !draftReady) return;
    const serialized = JSON.stringify(draft);
    if (serialized === lastSavedSerializedRef.current) return;

    const timer = setTimeout(async () => {
      try {
        setSaveStatus('Salvataggio bozza...');
        await api.saveChangelogDraft(draft);
        lastSavedSerializedRef.current = serialized;
        setSaveStatus('Bozza salvata');
      } catch (err) {
        setSaveStatus(err.message || 'Errore salvataggio bozza');
      }
    }, 900);

    return () => clearTimeout(timer);
  }, [draft, canEdit, draftReady]);

  const updateRow = (rowId, patch) => {
    setDraft((prev) => ({
      ...prev,
      rows: prev.rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)),
    }));
  };

  const getEditorKey = (rowId, field) => `${rowId}:${field}`;

  const bindEditorRef = (rowId, field) => (element) => {
    const key = getEditorKey(rowId, field);
    if (element) {
      textareaRefs.current.set(key, element);
    } else {
      textareaRefs.current.delete(key);
    }
  };

  const syncActiveEditorSelection = (rowId, field) => {
    const element = textareaRefs.current.get(getEditorKey(rowId, field));
    if (!element) return;
    activeEditorRef.current = {
      rowId,
      field,
      selectionStart: Number.isFinite(element.selectionStart) ? element.selectionStart : 0,
      selectionEnd: Number.isFinite(element.selectionEnd) ? element.selectionEnd : 0,
    };
  };

  const insertMediaInEditor = (media, options = {}) => {
    const snippet = mediaToMarkdownSnippet(media);
    if (!snippet) return;

    const addToLibrary = options.addToLibrary === true;
    let nextCaret = null;

    setDraft((prev) => {
      if (!Array.isArray(prev.rows) || prev.rows.length === 0) return prev;

      const active = activeEditorRef.current;
      const rowExists = active?.rowId && prev.rows.some((row) => row.id === active.rowId);
      const rowId = rowExists ? active.rowId : prev.rows[0].id;
      const field = active?.field === 'textEn' ? 'textEn' : 'text';

      const rows = prev.rows.map((row) => {
        if (row.id !== rowId) return row;

        const currentValue = String(row?.[field] || '');
        const rawStart = Number(active?.selectionStart);
        const rawEnd = Number(active?.selectionEnd);
        const start = Math.max(0, Math.min(currentValue.length, Number.isFinite(rawStart) ? rawStart : currentValue.length));
        const end = Math.max(start, Math.min(currentValue.length, Number.isFinite(rawEnd) ? rawEnd : start));
        const prefix = start > 0 && !currentValue.slice(0, start).endsWith('\n') ? '\n' : '';
        const suffix = end < currentValue.length && !currentValue.slice(end).startsWith('\n') ? '\n' : '';
        const insertion = `${prefix}${snippet}${suffix}`;
        const nextValue = `${currentValue.slice(0, start)}${insertion}${currentValue.slice(end)}`;
        const caretPosition = start + insertion.length;

        nextCaret = {
          rowId,
          field,
          position: caretPosition,
        };

        return { ...row, [field]: nextValue };
      });

      return {
        ...prev,
        rows,
        attachments: addToLibrary ? [...prev.attachments, media] : prev.attachments,
      };
    });

    pendingCaretRef.current = nextCaret;
    requestAnimationFrame(() => {
      const pending = pendingCaretRef.current;
      if (!pending) return;
      const element = textareaRefs.current.get(getEditorKey(pending.rowId, pending.field));
      if (!element) {
        pendingCaretRef.current = null;
        return;
      }
      element.focus();
      element.setSelectionRange(pending.position, pending.position);
      activeEditorRef.current = {
        rowId: pending.rowId,
        field: pending.field,
        selectionStart: pending.position,
        selectionEnd: pending.position,
      };
      pendingCaretRef.current = null;
    });
  };

  const addRow = () => {
    setDraft((prev) => ({
      ...prev,
      rows: [...prev.rows, { id: `row_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`, tag: 'UPD', text: '', textEn: '' }],
    }));
  };

  const removeRow = (rowId) => {
    if (activeEditorRef.current?.rowId === rowId) {
      activeEditorRef.current = null;
    }
    setDraft((prev) => {
      const nextRows = prev.rows.filter((row) => row.id !== rowId);
      return {
        ...prev,
        rows: nextRows.length ? nextRows : [{ id: `row_${Date.now()}`, tag: 'UPD', text: '', textEn: '' }],
      };
    });
  };

  const toggleContributor = (contributorId) => {
    setDraft((prev) => {
      const current = new Set(prev.contributorIds);
      if (current.has(contributorId)) {
        current.delete(contributorId);
      } else {
        current.add(contributorId);
      }
      return {
        ...prev,
        contributorIds: Array.from(current),
      };
    });
  };

  const uploadFiles = async (files) => {
    if (!canEdit || !files?.length) return;
    setError('');
    try {
      setBusyUpload(true);
      const skipped = [];
      const failed = [];
      let uploaded = 0;

      for (const file of files) {
        const mimeType = inferMediaMimeType(file);
        if (!mimeType) {
          skipped.push(file?.name || 'file');
          continue;
        }

        try {
          const base64Data = await fileToBase64(file);
          const response = await api.uploadChangelogMedia({
            fileName: file.name,
            mimeType,
            base64Data,
          });
          if (response?.media) {
            insertMediaInEditor(response.media, { addToLibrary: true });
            uploaded += 1;
          } else {
            failed.push(`${file.name}: risposta upload non valida`);
          }
        } catch (err) {
          failed.push(`${file.name}: ${err.message || 'upload fallito'}`);
        }
      }

      if (uploaded > 0) {
        setSaveStatus(`Caricati ${uploaded} media e inseriti nel testo`);
      }
      if (skipped.length || failed.length) {
        const details = [];
        if (skipped.length > 0) {
          details.push(`File non supportati: ${skipped.join(', ')}`);
        }
        if (failed.length > 0) {
          details.push(`Errori upload: ${failed.join(' | ')}`);
        }
        setError(details.join(' — '));
      }
    } catch (err) {
      setError(err.message || 'Upload media fallito');
    } finally {
      setBusyUpload(false);
    }
  };

  const clearDraft = async () => {
    if (!canEdit) return;
    try {
      await api.deleteChangelogDraft();
      const next = { ...EMPTY_DRAFT, rows: [{ id: `row_${Date.now()}`, tag: 'UPD', text: '', textEn: '' }] };
      setDraft(next);
      setEditingPostId('');
      activeEditorRef.current = null;
      lastSavedSerializedRef.current = JSON.stringify(next);
      if (user?.id) {
        localStorage.removeItem(getLocalDraftKey(user.id));
      }
      setSaveStatus('Bozza eliminata');
    } catch (err) {
      setError(err.message || 'Impossibile eliminare la bozza');
    }
  };

  const publishPost = async () => {
    if (!canEdit || publishing) return;
    try {
      setPublishing(true);
      setError('');
      let draftToSend = draft;
      const missingTitleEn = String(draft.title || '').trim() && !String(draft.titleEn || '').trim();
      const missingRowsEn = (Array.isArray(draft.rows) ? draft.rows : [])
        .some((row) => String(row?.text || '').trim() && !String(row?.textEn || '').trim());
      if (missingTitleEn || missingRowsEn) {
        setTranslating(true);
        const translatedResponse = await api.translateChangelogDraft(draft, 'it', 'en', false);
        draftToSend = normalizeDraft(translatedResponse?.draft || draft);
        setDraft(draftToSend);
        setSaveStatus('Traduzione EN automatica completata');
      }
      const response = editingPostId
        ? await api.updateChangelog(editingPostId, draftToSend)
        : await api.publishChangelog(draftToSend);
      const post = response?.post;
      if (post) {
        setPosts((prev) => (
          editingPostId
            ? prev.map((item) => (item.id === post.id ? post : item))
            : [post, ...prev]
        ));
      } else {
        await loadPosts();
      }
      const next = { ...EMPTY_DRAFT, rows: [{ id: `row_${Date.now()}`, tag: 'UPD', text: '', textEn: '' }] };
      setDraft(next);
      setEditingPostId('');
      lastSavedSerializedRef.current = JSON.stringify(next);
      if (user?.id) {
        localStorage.removeItem(getLocalDraftKey(user.id));
      }
      setSaveStatus(editingPostId ? 'Changelog aggiornato' : 'Pubblicato');
    } catch (err) {
      setError(err.message || (editingPostId ? 'Aggiornamento fallito' : 'Pubblicazione fallita'));
    } finally {
      setTranslating(false);
      setPublishing(false);
    }
  };

  const startEditingPost = (post) => {
    if (!canEdit || !post?.id) return;
    const normalized = normalizeDraft({
      title: post.title,
      titleEn: post.titleEn,
      rows: post.rows,
      attachments: post.attachments,
      contributorIds: post.contributorIds,
    });
    setDraft(normalized);
    setEditingPostId(post.id);
    setEditorOpen(true);
    setSaveStatus('Modalita modifica');
    setError('');
  };

  const cancelEditing = () => {
    const next = { ...EMPTY_DRAFT, rows: [{ id: `row_${Date.now()}`, tag: 'UPD', text: '', textEn: '' }] };
    setDraft(next);
    setEditingPostId('');
    activeEditorRef.current = null;
    setSaveStatus('Modifica annullata');
  };

  const deletePost = async (postId) => {
    if (!canEdit || !postId) return;
    if (!window.confirm(ui.confirmDelete)) return;
    try {
      await api.deleteChangelog(postId);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      if (editingPostId === postId) {
        cancelEditing();
      }
      setSaveStatus('Changelog eliminato');
    } catch (err) {
      setError(err.message || 'Eliminazione fallita');
    }
  };

  const openFullscreenMedia = (attachment) => {
    if (!attachment?.url || !attachment?.type) return;
    setFullscreenMedia({
      url: attachment.url,
      type: attachment.type,
      fileName: attachment.fileName || attachment.id || 'media',
    });
  };

  return (
    <div className="changelog">
      <header className="changelog__masthead">
        <div>
          <p className="changelog__kicker">{ui.kicker}</p>
          <h1 className="changelog__title">{ui.title}</h1>
          <p className="changelog__lede">{ui.lede}</p>
        </div>
        {canEdit && (
          <span className="changelog__status">
            <Save />
            {saveStatus || ui.draftReady}
          </span>
        )}
      </header>

      {canEdit && (
        <section className="changelog__section">
          <div className="changelog__section-head">
            <div>
              <h2 className="changelog__section-title">{ui.composer}</h2>
              <p className="changelog__section-subtitle">
                {editingPostId ? ui.composerEdit : ui.composerNew}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setEditorOpen((prev) => !prev)}
              className="changelog-btn"
              title={editorOpen ? ui.closeEditor : ui.openEditor}
              aria-label={editorOpen ? ui.closeEditor : ui.openEditor}
            >
              {editorOpen ? <X /> : <Plus />}
              {editorOpen ? ui.closeEditor : ui.openEditor}
            </button>
          </div>

          {editorOpen && (
            <div className="changelog-editor">
              <div className="changelog-titles">
                <label>
                  <p className="changelog-label changelog-label--accent">{ui.titleIt}</p>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                    placeholder={ui.titlePlaceholder}
                    className="changelog-input"
                  />
                </label>
                <label>
                  <p className="changelog-label">{ui.titleEn}</p>
                  <input
                    type="text"
                    value={draft.titleEn}
                    onChange={(event) => setDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                    placeholder={ui.titleEnPlaceholder}
                    className="changelog-input"
                  />
                </label>
              </div>

              <div className="changelog-rows">
                {draft.rows.map((row) => {
                  const style = TAGS[row.tag] || TAGS.UPD;
                  return (
                    <div key={row.id} className="changelog-row">
                      <div className="changelog-row__meta">
                        <select
                          value={row.tag}
                          onChange={(event) => updateRow(row.id, { tag: event.target.value })}
                          className={`changelog-select changelog-select--${style.tone}`}
                        >
                          {Object.entries(TAGS).map(([value, tag]) => (
                            <option key={value} value={value}>{tag.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          className="changelog-btn changelog-btn--danger"
                        >
                          <Trash2 />
                          {ui.removeRow}
                        </button>
                      </div>
                      <label>
                        <p className="changelog-label">{ui.rowIt}</p>
                        <textarea
                          rows={3}
                          value={row.text}
                          onChange={(event) => updateRow(row.id, { text: event.target.value })}
                          ref={bindEditorRef(row.id, 'text')}
                          onFocus={() => syncActiveEditorSelection(row.id, 'text')}
                          onClick={() => syncActiveEditorSelection(row.id, 'text')}
                          onSelect={() => syncActiveEditorSelection(row.id, 'text')}
                          onKeyUp={() => syncActiveEditorSelection(row.id, 'text')}
                          placeholder={ui.rowPlaceholder}
                          className="changelog-textarea"
                        />
                      </label>
                      <label>
                        <p className="changelog-label">{ui.rowEn}</p>
                        <textarea
                          rows={3}
                          value={row.textEn || ''}
                          onChange={(event) => updateRow(row.id, { textEn: event.target.value })}
                          ref={bindEditorRef(row.id, 'textEn')}
                          onFocus={() => syncActiveEditorSelection(row.id, 'textEn')}
                          onClick={() => syncActiveEditorSelection(row.id, 'textEn')}
                          onSelect={() => syncActiveEditorSelection(row.id, 'textEn')}
                          onKeyUp={() => syncActiveEditorSelection(row.id, 'textEn')}
                          placeholder={ui.rowEnPlaceholder}
                          className="changelog-textarea"
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div>
                <button type="button" onClick={addRow} className="changelog-btn">
                  <Plus />
                  {ui.addRow}
                </button>
              </div>

              <div>
                <p className="changelog-label">{ui.contributors}</p>
                <div className="changelog-chips">
                  {CONTRIBUTORS.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`changelog-chip${draft.contributorIds.includes(entry.id) ? ' is-on' : ''}`}
                      onClick={() => toggleContributor(entry.id)}
                      aria-pressed={draft.contributorIds.includes(entry.id)}
                    >
                      @{entry.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="changelog-label">{ui.media}</p>
                <p className="changelog-hint">{ui.mediaHint}</p>
                <label className="changelog-btn">
                  {busyUpload ? <Loader2 className="animate-spin" /> : <ImagePlus />}
                  {ui.uploadMedia}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
                  />
                </label>
                {draft.attachments.length > 0 && (
                  <div className="changelog-media">
                    {draft.attachments.map((attachment) => (
                      <div key={attachment.id} className="changelog-media__item">
                        {attachment.type === 'image' ? (
                          <img
                            src={attachment.url}
                            alt={attachment.fileName || attachment.id}
                            onClick={() => openFullscreenMedia(attachment)}
                          />
                        ) : (
                          <video
                            src={attachment.url}
                            controls
                            onClick={() => openFullscreenMedia(attachment)}
                          />
                        )}
                        <div className="changelog-media__bar">
                          <span className="changelog-media__name">
                            {attachment.type === 'video' ? <Video /> : <Upload />}
                            {attachment.fileName || attachment.id}
                          </span>
                          <div className="changelog-entry__tools">
                            <button
                              type="button"
                              onClick={() => {
                                insertMediaInEditor(attachment);
                                setSaveStatus('Media inserito nel testo');
                              }}
                              className="changelog-btn"
                            >
                              {ui.insert}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft((prev) => ({
                                  ...prev,
                                  attachments: prev.attachments.filter((item) => item.id !== attachment.id),
                                }));
                              }}
                              className="changelog-btn changelog-btn--danger"
                            >
                              {ui.remove}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="changelog-actions">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      setTranslating(true);
                      const response = await api.translateChangelogDraft(draft, 'it', 'en', false);
                      const translated = normalizeDraft(response?.draft || draft);
                      setDraft(translated);
                      setSaveStatus('Traduzione EN completata');
                    } catch (err) {
                      setError(err.message || 'Traduzione automatica fallita');
                    } finally {
                      setTranslating(false);
                    }
                  }}
                  disabled={translating}
                  className="changelog-btn"
                >
                  {translating ? <Loader2 className="animate-spin" /> : <Languages />}
                  {ui.translateEn}
                </button>
                <button
                  type="button"
                  onClick={publishPost}
                  disabled={publishing || translating}
                  className="changelog-btn changelog-btn--primary"
                >
                  {publishing ? <Loader2 className="animate-spin" /> : <CalendarSync />}
                  {editingPostId ? ui.update : ui.publish}
                </button>
                {editingPostId && (
                  <button type="button" onClick={cancelEditing} className="changelog-btn changelog-btn--ghost">
                    <X />
                    {ui.cancelEdit}
                  </button>
                )}
                <button type="button" onClick={clearDraft} className="changelog-btn changelog-btn--danger">
                  <Trash2 />
                  {ui.deleteDraft}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {!canEdit && user && (
        <p className="changelog-notice">{ui.readonly}</p>
      )}

      <InlineError message={error} align="start" />

      <section className="changelog__section changelog__section--feed">
        <div className="changelog__section-head">
          <div>
            <h2 className="changelog__section-title">{ui.feed}</h2>
            <p className="changelog__section-subtitle">{ui.feedSubtitle}</p>
          </div>
        </div>

        {loadingPosts && (
          <p className="changelog-empty">{ui.loading}</p>
        )}

        {!loadingPosts && posts.length === 0 && (
          <p className="changelog-empty">{ui.empty}</p>
        )}

        <div className="changelog-feed">
          {posts.map((post) => {
              const stamp = formatEntryStamp(post.createdAt, dateLocale);
              return (
                <article key={post.id} className="changelog-entry">
                  <div className="changelog-entry__stamp">
                    <span className="changelog-entry__day">{stamp.day}</span>
                    <span className="changelog-entry__time">{stamp.time}</span>
                  </div>
                  <div>
                    <div className="changelog-entry__head">
                      <h3 className="changelog-entry__title">
                        {viewLanguage === 'en' ? (post.titleEn || post.title) : post.title}
                      </h3>
                      {canEdit && (
                        <div className="changelog-entry__tools">
                          <button type="button" onClick={() => startEditingPost(post)} className="changelog-btn">
                            <Pencil />
                            {ui.edit}
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePost(post.id)}
                            className="changelog-btn changelog-btn--danger"
                          >
                            <Trash2 />
                            {ui.delete}
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="changelog-entry__by">
                      {ui.by} {post.author?.name || post.author?.id || 'Unknown'}
                    </p>

                    <div className="changelog-entry__rows">
                      {(Array.isArray(post.rows) ? post.rows : []).map((row) => {
                        const style = TAGS[row.tag] || TAGS.UPD;
                        return (
                          <div key={`${post.id}_${row.id}`} className="changelog-change">
                            <span className={`changelog-tag changelog-tag--${style.tone}`}>
                              {style.label}
                            </span>
                            <div
                              className="changelog-md"
                              dangerouslySetInnerHTML={{ __html: renderMarkdownBlock(viewLanguage === 'en' ? (row.textEn || row.text) : row.text) }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {Array.isArray(post.contributorIds) && post.contributorIds.length > 0 && (
                      <p className="changelog-entry__people">
                        <strong>{ui.contributors}</strong>
                        {post.contributorIds.map((id) => `@${contributorsById.get(id) || id}`).join('  ')}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
        </div>
      </section>

      {fullscreenMedia && (
        <div className="changelog-overlay" onClick={() => setFullscreenMedia(null)}>
          <button
            type="button"
            onClick={() => setFullscreenMedia(null)}
            className="changelog-btn changelog-overlay__close"
          >
            <X />
            {ui.close}
          </button>
          <div className="changelog-overlay__media" onClick={(event) => event.stopPropagation()}>
            {fullscreenMedia.type === 'video' ? (
              <video src={fullscreenMedia.url} controls autoPlay />
            ) : (
              <img src={fullscreenMedia.url} alt={fullscreenMedia.fileName} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
