import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR = path.resolve(process.cwd(), 'data/changelogs');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const DRAFTS_FILE = path.join(DATA_DIR, 'drafts.json');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const ALLOWED_TAGS = new Set(['NEW', 'UPD', 'FIX', 'WIP']);

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(MEDIA_DIR)) {
    fs.mkdirSync(MEDIA_DIR, { recursive: true });
  }
  if (!fs.existsSync(POSTS_FILE)) {
    fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2), 'utf8');
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

function sanitizeText(value, maxLen = 5000) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function normalizeContributorIds(value) {
  if (!Array.isArray(value)) return [];
  const unique = new Set();
  value.forEach((entry) => {
    const id = String(entry || '').trim();
    if (id) unique.add(id);
  });
  return Array.from(unique);
}

function normalizeTag(tag) {
  const upper = String(tag || '').trim().toUpperCase();
  return ALLOWED_TAGS.has(upper) ? upper : 'UPD';
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => {
      const text = sanitizeText(row?.text || '', 4000);
      if (!text) return null;
      return {
        id: sanitizeText(row?.id || '', 60) || `line_${index + 1}`,
        tag: normalizeTag(row?.tag),
        text,
      };
    })
    .filter(Boolean)
    .slice(0, 200);
}

function normalizeAttachment(attachment) {
  if (!attachment || typeof attachment !== 'object') return null;
  const url = sanitizeText(attachment.url || '', 400);
  const type = sanitizeText(attachment.type || '', 20).toLowerCase();
  const mimeType = sanitizeText(attachment.mimeType || '', 120).toLowerCase();
  const fileName = sanitizeText(attachment.fileName || '', 160);
  const id = sanitizeText(attachment.id || '', 80);

  if (!url || !id) return null;
  if (type !== 'image' && type !== 'video') return null;

  return {
    id,
    url,
    type,
    mimeType,
    fileName,
  };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];
  return attachments.map(normalizeAttachment).filter(Boolean).slice(0, 20);
}

function normalizeDraft(draft, userId = '') {
  return {
    title: sanitizeText(draft?.title || '', 200),
    rows: normalizeRows(draft?.rows),
    attachments: normalizeAttachments(draft?.attachments),
    contributorIds: normalizeContributorIds(draft?.contributorIds),
    updatedAt: Number.isFinite(draft?.updatedAt) ? draft.updatedAt : Date.now(),
    userId: String(userId || '').trim(),
  };
}

function normalizePost(post) {
  const createdAt = Number.isFinite(post?.createdAt) ? post.createdAt : Date.now();
  return {
    id: sanitizeText(post?.id || '', 80) || `changelog_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
    title: sanitizeText(post?.title || '', 200),
    rows: normalizeRows(post?.rows),
    attachments: normalizeAttachments(post?.attachments),
    contributorIds: normalizeContributorIds(post?.contributorIds),
    author: {
      id: sanitizeText(post?.author?.id || '', 80),
      name: sanitizeText(post?.author?.name || '', 120),
    },
    createdAt,
    updatedAt: Number.isFinite(post?.updatedAt) ? post.updatedAt : createdAt,
  };
}

function readPosts() {
  const posts = readJson(POSTS_FILE, []);
  return Array.isArray(posts) ? posts.map(normalizePost) : [];
}

function writePosts(posts) {
  writeJsonAtomic(POSTS_FILE, posts.map(normalizePost));
}

function readDrafts() {
  const drafts = readJson(DRAFTS_FILE, {});
  return drafts && typeof drafts === 'object' ? drafts : {};
}

function writeDrafts(drafts) {
  writeJsonAtomic(DRAFTS_FILE, drafts);
}

ensureStorage();

export function getPosts() {
  return readPosts().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

export function getDraft(userId) {
  const userKey = String(userId || '').trim();
  if (!userKey) return null;
  const drafts = readDrafts();
  const draft = drafts[userKey];
  if (!draft) return null;
  return normalizeDraft(draft, userKey);
}

export function saveDraft(userId, draft) {
  const userKey = String(userId || '').trim();
  if (!userKey) return null;
  const drafts = readDrafts();
  const normalized = normalizeDraft(draft, userKey);
  drafts[userKey] = normalized;
  writeDrafts(drafts);
  return normalized;
}

export function deleteDraft(userId) {
  const userKey = String(userId || '').trim();
  if (!userKey) return false;
  const drafts = readDrafts();
  if (!drafts[userKey]) return false;
  delete drafts[userKey];
  writeDrafts(drafts);
  return true;
}

export function publishPost({ userId, authorName, draft }) {
  const normalizedDraft = normalizeDraft(draft, userId);
  if (!normalizedDraft.title) {
    throw new Error('Title is required');
  }
  if (!normalizedDraft.rows.length) {
    throw new Error('At least one changelog row is required');
  }

  const posts = readPosts();
  const createdAt = Date.now();
  const post = normalizePost({
    id: `changelog_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
    title: normalizedDraft.title,
    rows: normalizedDraft.rows,
    attachments: normalizedDraft.attachments,
    contributorIds: normalizedDraft.contributorIds,
    author: {
      id: String(userId || '').trim(),
      name: sanitizeText(authorName || '', 120),
    },
    createdAt,
    updatedAt: createdAt,
  });

  posts.push(post);
  writePosts(posts);
  deleteDraft(userId);
  return post;
}

export function updatePost({ postId, draft }) {
  const targetId = sanitizeText(postId || '', 80);
  if (!targetId) {
    throw new Error('postId is required');
  }

  const normalizedDraft = normalizeDraft(draft, '');
  if (!normalizedDraft.title) {
    throw new Error('Title is required');
  }
  if (!normalizedDraft.rows.length) {
    throw new Error('At least one changelog row is required');
  }

  const posts = readPosts();
  const index = posts.findIndex((post) => post.id === targetId);
  if (index < 0) {
    throw new Error('Changelog not found');
  }

  const current = posts[index];
  const updated = normalizePost({
    ...current,
    title: normalizedDraft.title,
    rows: normalizedDraft.rows,
    attachments: normalizedDraft.attachments,
    contributorIds: normalizedDraft.contributorIds,
    updatedAt: Date.now(),
  });

  posts[index] = updated;
  writePosts(posts);
  return updated;
}

export function removePost(postId) {
  const targetId = sanitizeText(postId || '', 80);
  if (!targetId) return false;

  const posts = readPosts();
  const next = posts.filter((post) => post.id !== targetId);
  if (next.length === posts.length) {
    return false;
  }
  writePosts(next);
  return true;
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
  const mediaId = `media_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  const savedFileName = `${mediaId}${ext}`;
  const targetPath = path.join(MEDIA_DIR, savedFileName);
  fs.writeFileSync(targetPath, buffer);

  return {
    id: mediaId,
    fileName: sanitizeFileName(fileName),
    type: contentType,
    mimeType: safeMime,
    url: `/api/changelogs/media/${savedFileName}`,
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
