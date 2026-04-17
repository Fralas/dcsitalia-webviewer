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
    iconKey: 'radar',
    title: {
      en: 'Dynamic Frontline',
      it: 'Frontline Dinamico',
    },
    summary: {
      en: 'Zones change in real time, and every capture shifts the frontline balance.',
      it: 'Le zone cambiano stato in tempo reale. Ogni conquista modifica il bilanciamento del fronte.',
    },
    content: {
      en: `## Overview
The **frontline** evolves based on pilot actions and ground operations.

## Zone States
| State | Description |
|---|---|
| RED | Area under hostile control |
| BLUE | Area under allied control |
| UNDER_ATTACK | Active engagement |

## Operational Notes
- Maintain air superiority over contested zones.
- Coordinate with logistics to sustain the advance.
`,
      it: `## Panoramica
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
  },
  {
    id: 'logistics',
    iconKey: 'truck',
    title: {
      en: 'Strategic Logistics',
      it: 'Logistica Strategica',
    },
    summary: {
      en: 'Manage supplies, routes, and mission priorities to keep airbases operational.',
      it: 'Gestione di rifornimenti, rotte e priorita missioni per mantenere operative le basi.',
    },
    content: {
      en: `## Overview
Logistics keeps forward bases alive and enables sustained operations.

## Key Elements
- Supply convoys
- Order priorities
- Source-to-destination airbase chain

## Example
\`\`\`text
Source Base -> Frontline Base -> Local distribution
\`\`\`
`,
      it: `## Panoramica
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
  },
  {
    id: 'combined',
    iconKey: 'layers3',
    title: {
      en: 'Combined Arms Operations',
      it: 'Operazioni Combined Arms',
    },
    summary: {
      en: 'Ground vehicles and support units work in sync with pilots to secure objectives.',
      it: 'Veicoli e unita di supporto lavorano in sinergia con i piloti per gli obiettivi a terra.',
    },
    content: {
      en: `## Overview
Combined arms operations merge CAS, SEAD, transport, and tactical vehicles.

## Roles
- **Strike**: neutralize high-priority targets.
- **Escort**: protect convoys and critical assets.
- **Recon**: identify threats and engagement windows.
`,
      it: `## Panoramica
Le operazioni combined arms uniscono CAS, SEAD, trasporto e veicoli tattici.

## Ruoli
- **Strike**: neutralizza obiettivi prioritari.
- **Escort**: protegge convogli e asset critici.
- **Recon**: identifica minacce e finestre di ingaggio.
`,
    },
  },
  {
    id: 'defense',
    iconKey: 'shield_check',
    title: {
      en: 'Active Defense',
      it: 'Difesa Attiva',
    },
    summary: {
      en: 'Air-defense assets and mobile columns protect airfields, convoys, and key points.',
      it: 'Assetti antiaerei e colonne mobili proteggono aeroporti, convogli e punti critici.',
    },
    content: {
      en: `## Overview
Active defense reduces enemy pressure on airfields and strategic routes.

## Doctrine
- Layered defenses (short/medium range)
- Redundancy on critical points
- Rapid relocation of mobile units
`,
      it: `## Panoramica
La difesa attiva riduce la pressione nemica su aeroporti e rotte strategiche.

## Dottrina
- Difese stratificate (corto/medio raggio)
- Ridondanza sui punti critici
- Rilocazione rapida delle unita mobili
`,
    },
  },
];
const DEFAULT_PAGES_BY_ID = DEFAULT_PAGES.reduce((acc, page) => {
  acc[page.id] = page;
  return acc;
}, {});

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

function normalizeLocalizedValue({
  value,
  valueEn,
  valueIt,
  fallbackEn = '',
  fallbackIt = '',
  maxLen = 10000,
  isMarkdown = false,
}) {
  const sanitizer = isMarkdown ? sanitizeMarkdown : sanitizeText;
  const safeFallbackEn = sanitizer(fallbackEn, maxLen);
  const safeFallbackIt = sanitizer(fallbackIt, maxLen);

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return {
      en: sanitizer(value.en ?? valueEn ?? safeFallbackEn, maxLen),
      it: sanitizer(value.it ?? valueIt ?? '', maxLen),
    };
  }

  const legacyString = sanitizer(value, maxLen);
  if (legacyString && safeFallbackEn && safeFallbackIt && legacyString === safeFallbackIt) {
    return {
      en: safeFallbackEn,
      it: safeFallbackIt,
    };
  }

  let en = sanitizer(valueEn, maxLen) || legacyString || safeFallbackEn;
  let it = sanitizer(valueIt, maxLen);

  if (!legacyString && !valueEn && !valueIt && safeFallbackIt) {
    it = safeFallbackIt;
  }

  if (!en) {
    en = safeFallbackEn;
  }

  return { en, it };
}

function normalizePageId(pageId) {
  const normalized = String(pageId || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
  return normalized.slice(0, 80);
}

function normalizeIconKey(iconKey) {
  const normalized = String(iconKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  return normalized.slice(0, 80);
}

function normalizePage(rawPage) {
  const id = normalizePageId(rawPage?.id);
  const defaults = DEFAULT_PAGES_BY_ID[id] || null;
  const createdAt = Number.isFinite(rawPage?.createdAt) ? rawPage.createdAt : Date.now();
  const updatedAt = Number.isFinite(rawPage?.updatedAt) ? rawPage.updatedAt : createdAt;
  return {
    id,
    iconKey: normalizeIconKey(rawPage?.iconKey || ''),
    title: normalizeLocalizedValue({
      value: rawPage?.title,
      valueEn: rawPage?.titleEn,
      valueIt: rawPage?.titleIt,
      fallbackEn: defaults?.title?.en || '',
      fallbackIt: defaults?.title?.it || '',
      maxLen: 200,
    }),
    summary: normalizeLocalizedValue({
      value: rawPage?.summary,
      valueEn: rawPage?.summaryEn,
      valueIt: rawPage?.summaryIt,
      fallbackEn: defaults?.summary?.en || '',
      fallbackIt: defaults?.summary?.it || '',
      maxLen: 500,
    }),
    content: normalizeLocalizedValue({
      value: rawPage?.content,
      valueEn: rawPage?.contentEn,
      valueIt: rawPage?.contentIt,
      fallbackEn: defaults?.content?.en || '',
      fallbackIt: defaults?.content?.it || '',
      maxLen: 120000,
      isMarkdown: true,
    }),
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
    iconKey: normalizeIconKey(rawDraft?.iconKey || ''),
    title: normalizeLocalizedValue({
      value: rawDraft?.title,
      valueEn: rawDraft?.titleEn,
      valueIt: rawDraft?.titleIt,
      maxLen: 200,
    }),
    summary: normalizeLocalizedValue({
      value: rawDraft?.summary,
      valueEn: rawDraft?.summaryEn,
      valueIt: rawDraft?.summaryIt,
      maxLen: 500,
    }),
    content: normalizeLocalizedValue({
      value: rawDraft?.content,
      valueEn: rawDraft?.contentEn,
      valueIt: rawDraft?.contentIt,
      maxLen: 120000,
      isMarkdown: true,
    }),
    updatedAt: Number.isFinite(rawDraft?.updatedAt) ? rawDraft.updatedAt : Date.now(),
  };
}

function pageSlugFromTitle(title) {
  const sourceTitle = title && typeof title === 'object'
    ? (title.en || title.it || '')
    : title;
  const slug = String(sourceTitle || '')
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
  return readPages().sort((a, b) => {
    const aTitle = String(a?.title?.en || a?.title?.it || '');
    const bTitle = String(b?.title?.en || b?.title?.it || '');
    return Number(aTitle.localeCompare(bTitle)) || 0;
  });
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
  if (!payload.title.en) throw new Error('English title is required');
  if (!payload.summary.en) throw new Error('English summary is required');
  if (!payload.content.en) throw new Error('English content is required');

  const current = pages[index];
  const updated = normalizePage({
    ...current,
    iconKey: payload.iconKey || current.iconKey || '',
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
  if (!payload.title.en) throw new Error('English title is required');
  if (!payload.summary.en) throw new Error('English summary is required');
  if (!payload.content.en) throw new Error('English content is required');

  const resolvedPageId = resolveNewPageId(pages, pageId, payload.title);
  const now = Date.now();
  const created = normalizePage({
    id: resolvedPageId,
    iconKey: payload.iconKey || '',
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
