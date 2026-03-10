import fs from 'fs';
import path from 'path';

const DATA_DIR = path.resolve(process.cwd(), 'data/historical');
const FEED_FILE = path.join(DATA_DIR, 'feed.json');
const WRITE_DELAY_MS = 300;
const MAX_EVENTS = Number.parseInt(process.env.FEED_MAX_EVENTS || '1000', 10);

let feedCache = [];
let writeTimer = null;
let dirty = false;

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(FEED_FILE)) {
    fs.writeFileSync(FEED_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readFeed() {
  try {
    const raw = fs.readFileSync(FEED_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading feed file:', error.message);
    return [];
  }
}

async function writeFeedAtomic(events) {
  const tempPath = `${FEED_FILE}.tmp`;
  await fs.promises.writeFile(tempPath, JSON.stringify(events, null, 2), 'utf-8');
  await fs.promises.rename(tempPath, FEED_FILE);
}

function scheduleWrite() {
  dirty = true;
  if (writeTimer) return;

  writeTimer = setTimeout(async () => {
    writeTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      await writeFeedAtomic(feedCache);
    } catch (error) {
      console.error('Error writing feed file:', error.message);
    }
  }, WRITE_DELAY_MS);
}

function sanitizeText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

ensureStorage();
feedCache = readFeed();

export function getFeedEvents(limit = 200) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(Number(limit), MAX_EVENTS)) : 200;
  return feedCache.slice(-safeLimit).reverse();
}

export function appendFeedEvent(event) {
  const now = Date.now();
  const entry = {
    id: event?.id || `feed_${now}_${Math.random().toString(36).slice(2, 9)}`,
    type: sanitizeText(event?.type, 'system'),
    title: sanitizeText(event?.title, 'System event'),
    message: sanitizeText(event?.message, ''),
    timestamp: Number.isFinite(event?.timestamp) ? event.timestamp : now,
    actor: sanitizeText(event?.actor, ''),
    zone_id: sanitizeText(event?.zone_id, ''),
    mission_id: sanitizeText(event?.mission_id, ''),
    metadata: event?.metadata && typeof event.metadata === 'object' ? event.metadata : {},
  };

  feedCache.push(entry);
  if (feedCache.length > MAX_EVENTS) {
    feedCache = feedCache.slice(feedCache.length - MAX_EVENTS);
  }
  scheduleWrite();

  return entry;
}

export default {
  getFeedEvents,
  appendFeedEvent,
};
