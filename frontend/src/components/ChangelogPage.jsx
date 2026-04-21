import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarSync, GitPullRequestCreateArrow, ImagePlus, Languages, Loader2, Pencil, Plus, Save, Trash2, Upload, Video, X } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';

const ALLOWED_AUTHOR_IDS = new Set([
  '714087060343881778',
  '675706661570347041',
  '153370631772045313',
]);

const CONTRIBUTORS = [
  { id: '714087060343881778', label: 'DJOGO' },
  { id: '675706661570347041', label: 'Fralas' },
  { id: '153370631772045313', label: 'Kira' },
];

const TAGS = {
  NEW: {
    label: 'New',
    editorClass: 'border-green-500/40 bg-green-500/15 text-green-300',
  },
  UPD: {
    label: 'Upd',
    editorClass: 'border-blue-500/40 bg-blue-500/15 text-blue-300',
  },
  FIX: {
    label: 'Fix',
    editorClass: 'border-orange-500/40 bg-orange-500/15 text-orange-300',
  },
  WIP: {
    label: 'WIP',
    editorClass: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300',
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

function formatDate(timestamp) {
  try {
    return new Date(timestamp).toLocaleString('it-IT');
  } catch {
    return '-';
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
    return `<video src="${rawUrl}" controls class="my-2 w-full max-h-80 rounded border border-yt-border/60 bg-black/40"></video>`;
  });
  out = out.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, altText, rawUrl) => {
    if (!isSafeMediaUrl(rawUrl)) return '[invalid-image-url]';
    return `<img src="${rawUrl}" alt="${altText || 'image'}" loading="lazy" class="my-2 w-full max-h-96 object-contain rounded border border-yt-border/60 bg-black/20" />`;
  });
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-black/35 px-1 py-0.5">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-yt-accent underline">$1</a>');
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
      html.push(`<h${level} class="font-bold mt-1 mb-1">${renderInlineMarkdown(heading[2])}</h${level}>`);
      return;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inOl) {
        html.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        html.push('<ul class="list-disc ml-5 space-y-1">');
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
        html.push('<ol class="list-decimal ml-5 space-y-1">');
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
    if (!window.confirm('Confermi eliminazione di questo changelog?')) return;
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
    <div className="max-w-6xl mx-auto w-full space-y-4">
      <div className="bg-yt-bg-secondary/85 rounded-2xl border border-yt-border/70 p-4 shadow-[0_14px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-yt-accent/20 ring-1 ring-yt-accent/30">
              <CalendarSync className="w-5 h-5 text-yt-accent" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-[0.05em] text-yt-text-primary">Changelogs</h2>
            </div>
          </div>
          {canEdit && (
            <div className="text-[11px] text-yt-text-secondary">
              <span className="inline-flex items-center gap-1 rounded border border-yt-border px-2 py-1">
                <Save className="w-3.5 h-3.5" />
                {saveStatus || 'Bozza pronta'}
              </span>
            </div>
          )}
        </div>
      </div>

      {canEdit && (
        <div className="bg-yt-bg-secondary/85 rounded-2xl border border-yt-border/70 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs uppercase tracking-[0.1em] text-yt-text-secondary">
              {editingPostId ? 'Modifica changelog' : 'Nuovo post changelog'}
            </div>
            <button
              type="button"
              onClick={() => setEditorOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded border border-yt-border px-2 py-1 text-xs text-yt-text-primary hover:border-yt-accent"
              title={editorOpen ? 'Chiudi editor changelog' : 'Apri editor changelog'}
              aria-label={editorOpen ? 'Chiudi editor changelog' : 'Apri editor changelog'}
            >
              <GitPullRequestCreateArrow className={`h-4 w-4 transition-transform ${editorOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {editorOpen && (
            <div className="mt-3 space-y-3">
              <input
                type="text"
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Titolo changelog"
                className="w-full rounded-lg border border-yt-border bg-[#121b27] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />
              <input
                type="text"
                value={draft.titleEn}
                onChange={(event) => setDraft((prev) => ({ ...prev, titleEn: event.target.value }))}
                placeholder="English title (translation)"
                className="w-full rounded-lg border border-yt-border bg-[#121b27] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
              />

              <div className="rounded-xl border border-yt-border/80 bg-[#111926] p-2">
                <div className="space-y-2">
                  {draft.rows.map((row) => {
                    const style = TAGS[row.tag] || TAGS.UPD;
                    return (
                      <div key={row.id} className="flex items-start gap-2 border-b border-yt-border/40 pb-2 last:border-b-0 last:pb-0">
                        <div className="flex w-[92px] shrink-0 flex-col gap-1">
                          <select
                            value={row.tag}
                            onChange={(event) => updateRow(row.id, { tag: event.target.value })}
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${style.editorClass}`}
                          >
                            {Object.entries(TAGS).map(([value, tag]) => (
                              <option key={value} value={value}>{tag.label}</option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="inline-flex items-center justify-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Rimuovi
                          </button>
                        </div>
                        <textarea
                          rows={3}
                          value={row.text}
                          onChange={(event) => updateRow(row.id, { text: event.target.value })}
                          ref={bindEditorRef(row.id, 'text')}
                          onFocus={() => syncActiveEditorSelection(row.id, 'text')}
                          onClick={() => syncActiveEditorSelection(row.id, 'text')}
                          onSelect={() => syncActiveEditorSelection(row.id, 'text')}
                          onKeyUp={() => syncActiveEditorSelection(row.id, 'text')}
                          placeholder="Testo riga IT (supporto markdown)"
                          className="w-full rounded border border-yt-border/80 bg-[#0e1520] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                        />
                        <textarea
                          rows={3}
                          value={row.textEn || ''}
                          onChange={(event) => updateRow(row.id, { textEn: event.target.value })}
                          ref={bindEditorRef(row.id, 'textEn')}
                          onFocus={() => syncActiveEditorSelection(row.id, 'textEn')}
                          onClick={() => syncActiveEditorSelection(row.id, 'textEn')}
                          onSelect={() => syncActiveEditorSelection(row.id, 'textEn')}
                          onKeyUp={() => syncActiveEditorSelection(row.id, 'textEn')}
                          placeholder="English row translation (markdown supported)"
                          className="w-full rounded border border-yt-border/80 bg-[#0e1520] px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                        />
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={addRow}
                  className="mt-2 inline-flex items-center gap-1 rounded border border-yt-border px-2 py-1 text-xs text-yt-text-primary hover:border-yt-accent"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Aggiungi Riga
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs uppercase tracking-[0.08em] text-yt-text-secondary">Tag contributor</div>
                <div className="flex flex-wrap gap-2">
                  {CONTRIBUTORS.map((entry) => (
                    <label key={entry.id} className="inline-flex items-center gap-2 rounded border border-yt-border bg-[#121b27] px-2 py-1 text-xs text-yt-text-primary">
                      <input
                        type="checkbox"
                        checked={draft.contributorIds.includes(entry.id)}
                        onChange={() => toggleContributor(entry.id)}
                      />
                      {entry.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs uppercase tracking-[0.08em] text-yt-text-secondary">
                  <Upload className="w-3.5 h-3.5" />
                  Media inline nel testo
                </div>
                <div className="text-xs text-yt-text-secondary">
                  Posiziona il cursore in una riga IT/EN: ogni upload viene inserito nel punto scelto dentro il testo.
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded border border-yt-border px-3 py-2 text-xs text-yt-text-primary hover:border-yt-accent">
                  {busyUpload ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                  Carica Media
                  <input
                    type="file"
                    className="hidden"
                    accept="image/*,video/*"
                    multiple
                    onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
                  />
                </label>
                {draft.attachments.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {draft.attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded border border-yt-border/70 bg-[#0d1520] p-2">
                        {attachment.type === 'image' ? (
                          <img
                            src={attachment.url}
                            alt={attachment.fileName || attachment.id}
                            className="w-full max-h-52 object-contain rounded cursor-zoom-in"
                            onClick={() => openFullscreenMedia(attachment)}
                          />
                        ) : (
                          <video
                            src={attachment.url}
                            controls
                            className="w-full max-h-52 rounded cursor-zoom-in"
                            onClick={() => openFullscreenMedia(attachment)}
                          />
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-xs text-yt-text-secondary truncate">
                            {attachment.type === 'video' ? <Video className="inline w-3.5 h-3.5 mr-1" /> : null}
                            {attachment.fileName || attachment.id}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                insertMediaInEditor(attachment);
                                setSaveStatus('Media inserito nel testo');
                              }}
                              className="rounded border border-yt-border px-2 py-1 text-xs text-yt-text-primary hover:border-yt-accent"
                            >
                              Inserisci
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDraft((prev) => ({
                                  ...prev,
                                  attachments: prev.attachments.filter((item) => item.id !== attachment.id),
                                }));
                              }}
                              className="rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300"
                            >
                              Rimuovi
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
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
                  className="inline-flex items-center gap-1 rounded border border-blue-500/35 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 disabled:opacity-60"
                >
                  {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                  Traduci EN
                </button>
                <button
                  type="button"
                  onClick={publishPost}
                  disabled={publishing || translating}
                  className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-sm text-emerald-300 disabled:opacity-60"
                >
                  {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarSync className="w-4 h-4" />}
                  {editingPostId ? 'Aggiorna Changelog' : 'Pubblica Changelog'}
                </button>
                {editingPostId && (
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="inline-flex items-center gap-1 rounded border border-yt-border px-3 py-2 text-sm text-yt-text-primary"
                  >
                    <X className="w-4 h-4" />
                    Annulla Modifica
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearDraft}
                  className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300"
                >
                  <Trash2 className="w-4 h-4" />
                  Elimina Bozza
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {!canEdit && user && (
        <div className="rounded-xl border border-yt-border/80 bg-yt-bg-secondary/80 p-3 text-sm text-yt-text-secondary">
          Account in sola lettura per i changelog.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="space-y-3 pb-4">
        {loadingPosts && (
          <div className="text-sm text-yt-text-secondary">Caricamento changelog...</div>
        )}

        {!loadingPosts && posts.length === 0 && (
          <div className="rounded-xl border border-yt-border/80 bg-yt-bg-secondary/70 p-4 text-sm text-yt-text-secondary">
            Nessun changelog pubblicato.
          </div>
        )}

        {posts.map((post) => (
          <article key={post.id} className="rounded-2xl border border-yt-border/70 bg-yt-bg-secondary/85 p-4 shadow-[0_10px_26px_rgba(0,0,0,0.3)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-yt-text-primary">
                {viewLanguage === 'en' ? (post.titleEn || post.title) : post.title}
              </h3>
              <div className="flex items-center gap-2">
                <div className="text-xs text-yt-text-secondary">{formatDate(post.createdAt)}</div>
                {canEdit && (
                  <>
                    <button
                      type="button"
                      onClick={() => startEditingPost(post)}
                      className="inline-flex items-center gap-1 rounded border border-yt-border px-2 py-1 text-xs text-yt-text-primary hover:border-yt-accent"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Modifica
                    </button>
                    <button
                      type="button"
                      onClick={() => deletePost(post.id)}
                      className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Elimina
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="text-xs text-yt-text-secondary mt-1">
              by {post.author?.name || post.author?.id || 'Unknown'}
            </div>

            <div className="mt-3 rounded-xl border border-yt-border/70 bg-[#0f1723] p-3 space-y-2">
              {(Array.isArray(post.rows) ? post.rows : []).map((row) => {
                const style = TAGS[row.tag] || TAGS.UPD;
                return (
                  <div key={`${post.id}_${row.id}`} className="flex items-start gap-3 border-b border-yt-border/40 pb-2 last:border-b-0 last:pb-0">
                    <div className={`mt-0.5 inline-flex w-[44px] shrink-0 justify-center rounded border px-1.5 py-0 text-[10px] font-bold uppercase tracking-[0.06em] ${style.editorClass}`}>
                      {style.label}
                    </div>
                    <div
                      className="text-sm text-yt-text-primary prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderMarkdownBlock(viewLanguage === 'en' ? (row.textEn || row.text) : row.text) }}
                    />
                  </div>
                );
              })}
            </div>

            {Array.isArray(post.contributorIds) && post.contributorIds.length > 0 && (
              <div className="mt-3 text-xs text-yt-text-secondary">
                Contributors: {post.contributorIds.map((id) => `@${contributorsById.get(id) || id}`).join(', ')}
              </div>
            )}
          </article>
        ))}
      </div>

      {fullscreenMedia && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/90 p-4" onClick={() => setFullscreenMedia(null)}>
          <button
            type="button"
            onClick={() => setFullscreenMedia(null)}
            className="absolute right-4 top-4 inline-flex items-center gap-1 rounded border border-white/30 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <X className="h-4 w-4" />
            Chiudi
          </button>
          <div className="max-h-[95vh] max-w-[95vw]" onClick={(event) => event.stopPropagation()}>
            {fullscreenMedia.type === 'video' ? (
              <video src={fullscreenMedia.url} controls autoPlay className="max-h-[95vh] max-w-[95vw] rounded" />
            ) : (
              <img src={fullscreenMedia.url} alt={fullscreenMedia.fileName} className="max-h-[95vh] max-w-[95vw] object-contain rounded" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
