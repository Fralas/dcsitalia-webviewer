import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data/wiki');
const PAGES_FILE = path.join(DATA_DIR, 'pages.json');
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');
const MEDIA_DIR = path.join(DATA_DIR, 'media');

const DEFAULT_PAGES = [
  {
    id: 'territory',
    title: 'Frontline Dinamico',
    summary: 'Le zone cambiano stato in tempo reale. Ogni conquista modifica il bilanciamento del fronte.',
    content: `## Panoramica
Il **frontline** evolve in base alle azioni dei piloti e alle operazioni a terra.

## Stato Zone
| Stato | Descrizione |
|---|---|
| RED | Area sotto controllo ostile |
| BLUE | Area sotto controllo alleato |
| UNDER_ATTACK | Scontro attivo |

## Note Operative
- Mantieni la superiorita aerea sopra le zone contestate.
- Coordinati con la logistica per sostenere l'avanzata.
`,
  },
  {
    id: 'logistics',
    title: 'Logistica Strategica',
    summary: 'Gestione di rifornimenti, rotte e priorita missioni per mantenere operative le basi.',
    content: `## Panoramica
La logistica mantiene vive le basi avanzate e abilita missioni continuative.

## Elementi Chiave
- Convogli di rifornimento
- Priorita ordini
- Catena aeroporti sorgente/destinazione

## Esempio
\`\`\`text
Base Sorgente -> Base Frontline -> Distribuzione locale
\`\`\`
`,
  },
  {
    id: 'combined',
    title: 'Operazioni Combined Arms',
    summary: 'Veicoli e unita di supporto lavorano in sinergia con i piloti per gli obiettivi a terra.',
    content: `## Panoramica
Le operazioni combined arms uniscono CAS, SEAD, trasporto e veicoli tattici.

## Ruoli
- **Strike**: neutralizza obiettivi prioritari.
- **Escort**: protegge convogli e asset critici.
- **Recon**: identifica minacce e finestre di ingaggio.
`,
  },
  {
    id: 'defense',
    title: 'Difesa Attiva',
    summary: 'Assetti antiaerei e colonne mobili proteggono aeroporti, convogli e punti critici.',
    content: `## Panoramica
La difesa attiva riduce la pressione nemica su aeroporti e rotte strategiche.

## Dottrina
- Difese stratificate (corto/medio raggio)
- Ridondanza sui punti critici
- Rilocazione rapida delle unita mobili
`,
  },
];

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });
  if (!fs.existsSync(PAGES_FILE)) {
    const now = Date.now();
    const seeded = DEFAULT_PAGES.map((page) => ({
      ...page,
      createdAt: now,
      updatedAt: now,
      updatedBy: { id: 'system', name: 'System' },
    }));
    fs.writeFileSync(PAGES_FILE, JSON.stringify(seeded, null, 2), 'utf8');
  }
  if (!fs.existsSync(DRAFTS_FILE)) {
    fs.writeFileSync(DRAFTS_FILE, JSON.stringify({}, null, 2), 'utf8');
  }
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJsonAtomic(filePath, payload) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function sanitizeText(value, maxLen = 10000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function sanitizeMarkdown(value, maxLen = 120000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').slice(0, maxLen);
}

function normalizePageId(pageId) {
  const normalized = String(pageId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized.slice(0, 80);
}

function normalizePage(rawPage) {
  const id = normalizePageId(rawPage?.id);
  const createdAt = Number.isFinite(rawPage?.createdAt) ? rawPage.createdAt : Date.now();
  const updatedAt = Number.isFinite(rawPage?.updatedAt) ? rawPage.updatedAt : createdAt;
  return {
    id,
    title: sanitizeText(rawPage?.title || '', 200),
    summary: sanitizeText(rawPage?.summary || '', 500),
    content: sanitizeMarkdown(rawPage?.content || '', 120000),
    createdAt,
    updatedAt,
    updatedBy: {
      id: sanitizeText(rawPage?.updatedBy?.id || '', 80),
      name: sanitizeText(rawPage?.updatedBy?.name || '', 120),
    },
  };
}

function normalizeDraft(rawDraft, userId = '', pageId = '') {
  return {
    pageId: normalizePageId(rawDraft?.pageId || pageId),
    userId: sanitizeText(String(userId || ''), 80),
    title: sanitizeText(rawDraft?.title || '', 200),
    summary: sanitizeText(rawDraft?.summary || '', 500),
    content: sanitizeMarkdown(rawDraft?.content || '', 120000),
    updatedAt: Number.isFinite(rawDraft?.updatedAt) ? rawDraft.updatedAt : Date.now(),
  };
}

function pageSlugFromTitle(title) {
  const slug = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalizePageId(slug);
}

function resolveNewPageId(pages, requestedId, title) {
  const normalizedRequestedId = normalizePageId(requestedId);
  const baseId = normalizedRequestedId || pageSlugFromTitle(title);
  if (!baseId) {
    throw new Error('Invalid page id');
  }

  if (!pages.some((page) => page.id === baseId)) {
    return baseId;
  }

  if (normalizedRequestedId) {
    throw new Error('Wiki page id already exists');
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = normalizePageId(`${baseId}-${suffix}`);
    if (candidate && !pages.some((page) => page.id === candidate)) {
      return candidate;
    }
    suffix += 1;
  }

  throw new Error('Unable to generate unique page id');
}

function readPages() {
  const pagesRaw = readJson(PAGES_FILE, []);
  const pages = Array.isArray(pagesRaw) ? pagesRaw.map(normalizePage).filter((page) => page.id) : [];

  if (pages.length === 0) {
    const now = Date.now();
    const seeded = DEFAULT_PAGES.map((page) => ({
      ...page,
      createdAt: now,
      updatedAt: now,
      updatedBy: { id: 'system', name: 'System' },
    }));
    writeJsonAtomic(PAGES_FILE, seeded);
    return seeded;
  }

  return pages;
}

function writePages(pages) {
  writeJsonAtomic(PAGES_FILE, pages.map(normalizePage).filter((page) => page.id));
}

function readDrafts() {
  const drafts = readJson(DRAFTS_FILE, {});
  return drafts && typeof drafts === 'object' ? drafts : {};
}

function writeDrafts(drafts) {
  writeJsonAtomic(DRAFTS_FILE, drafts);
}

function draftKey(userId, pageId) {
  return `${sanitizeText(String(userId || ''), 80)}:${normalizePageId(pageId)}`;
}

ensureStorage();

export function getPages() {
  return readPages().sort((a, b) => (Number(a.title?.localeCompare?.(b.title || '')) || 0));
}

export function getPage(pageId) {
  const targetId = normalizePageId(pageId);
  if (!targetId) return null;
  return readPages().find((page) => page.id === targetId) || null;
}

export function getDraft(userId, pageId) {
  const key = draftKey(userId, pageId);
  if (!key.endsWith(':')) {
    const drafts = readDrafts();
    const draft = drafts[key];
    if (!draft) return null;
    return normalizeDraft(draft, userId, pageId);
  }
  return null;
}

export function saveDraft(userId, pageId, draft) {
  const normalizedPageId = normalizePageId(pageId);
  if (!normalizedPageId) return null;
  const key = draftKey(userId, normalizedPageId);
  const drafts = readDrafts();
  const normalized = normalizeDraft(draft, userId, normalizedPageId);
  drafts[key] = normalized;
  writeDrafts(drafts);
  return normalized;
}

export function deleteDraft(userId, pageId) {
  const normalizedPageId = normalizePageId(pageId);
  if (!normalizedPageId) return false;
  const key = draftKey(userId, normalizedPageId);
  const drafts = readDrafts();
  if (!drafts[key]) return false;
  delete drafts[key];
  writeDrafts(drafts);
  return true;
}

export function updatePage({ pageId, userId, authorName, draft }) {
  const normalizedPageId = normalizePageId(pageId);
  if (!normalizedPageId) throw new Error('Invalid page id');

  const pages = readPages();
  const index = pages.findIndex((page) => page.id === normalizedPageId);
  if (index < 0) throw new Error('Wiki page not found');

  const payload = normalizeDraft(draft, userId, normalizedPageId);
  if (!payload.title) throw new Error('Title is required');
  if (!payload.summary) throw new Error('Summary is required');
  if (!payload.content) throw new Error('Content is required');

  const current = pages[index];
  const updated = normalizePage({
    ...current,
    title: payload.title,
    summary: payload.summary,
    content: payload.content,
    updatedAt: Date.now(),
    updatedBy: {
      id: sanitizeText(String(userId || ''), 80),
      name: sanitizeText(authorName || '', 120),
    },
  });

  pages[index] = updated;
  writePages(pages);
  deleteDraft(userId, normalizedPageId);
  return updated;
}

export function createPage({ pageId, userId, authorName, draft }) {
  const pages = readPages();
  const payload = normalizeDraft(draft, userId, pageId);
  if (!payload.title) throw new Error('Title is required');
  if (!payload.summary) throw new Error('Summary is required');
  if (!payload.content) throw new Error('Content is required');

  const resolvedPageId = resolveNewPageId(pages, pageId, payload.title);
  const now = Date.now();
  const created = normalizePage({
    id: resolvedPageId,
    title: payload.title,
    summary: payload.summary,
    content: payload.content,
    createdAt: now,
    updatedAt: now,
    updatedBy: {
      id: sanitizeText(String(userId || ''), 80),
      name: sanitizeText(authorName || '', 120),
    },
  });

  pages.push(created);
  writePages(pages);
  return created;
}

function sanitizeFileName(fileName) {
  const base = String(fileName || 'upload').trim().toLowerCase();
  return base.replace(/[^a-z0-9._-]/g, '_').slice(0, 90) || 'upload';
}

function extensionFromMime(mimeType) {
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/jpeg') return '.jpg';
  if (mimeType === 'image/webp') return '.webp';
  if (mimeType === 'image/gif') return '.gif';
  if (mimeType === 'video/mp4') return '.mp4';
  if (mimeType === 'video/webm') return '.webm';
  if (mimeType === 'video/ogg') return '.ogv';
  return '';
}

export function saveMedia({ fileName, mimeType, base64Data }) {
  const safeMime = sanitizeText(mimeType || '', 120).toLowerCase();
  if (!safeMime.startsWith('image/') && !safeMime.startsWith('video/')) {
    throw new Error('Only image and video files are supported');
  }

  const buffer = Buffer.from(String(base64Data || ''), 'base64');
  if (!buffer.length) {
    throw new Error('Invalid media payload');
  }

  const contentType = safeMime.startsWith('image/') ? 'image' : 'video';
  const ext = extensionFromMime(safeMime) || path.extname(sanitizeFileName(fileName)) || '';
  const mediaId = `wiki_media_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  const savedFileName = `${mediaId}${ext}`;
  const targetPath = path.join(MEDIA_DIR, savedFileName);
  fs.writeFileSync(targetPath, buffer);

  return {
    id: mediaId,
    fileName: sanitizeFileName(fileName),
    type: contentType,
    mimeType: safeMime,
    url: `/api/wiki/media/${savedFileName}`,
  };
}

export function getMediaAbsolutePath(fileName) {
  const clean = path.basename(String(fileName || '').trim());
  if (!clean) return null;
  const absolutePath = path.join(MEDIA_DIR, clean);
  if (!absolutePath.startsWith(MEDIA_DIR)) return null;
  if (!fs.existsSync(absolutePath)) return null;
  return absolutePath;
}
