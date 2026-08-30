import fs from 'fs';
import path from 'path';
import db from './client.js';

export const DOC = Object.freeze({
  WIKI_PAGES: 'wiki.pages',
  WIKI_DRAFTS: 'wiki.drafts',
  CHANGELOG_POSTS: 'changelog.posts',
  CHANGELOG_DRAFTS: 'changelog.drafts',
  NOE_EVENTS: 'noe.events',
  ACHIEVEMENTS_CATALOG: 'achievements.catalog',
  ACHIEVEMENTS_AWARDS: 'achievements.awards',
  ACHIEVEMENTS_USERS: 'achievements.users',
  LIDC_CATALOG: 'lidc.catalog',
  LIDC_SQUADRONS: 'lidc.squadrons',
  LIDC_DISCORD_USERS: 'lidc.discord-users',
  LIDC_UCID_LINKS: 'lidc.ucid-links',
  LIDC_LINK_CODES: 'lidc.link-codes',
  LIDC_BASE_LOGISTICS: 'lidc.base-logistics',
  LIDC_WAREHOUSE_OPS: 'lidc.warehouse-ops',
  ATC_BOARD: 'atc.board',
  ATC_HISTORY: 'atc.history',
  HISTORICAL_SNAPSHOTS: 'historical.snapshots',
  HISTORICAL_MISSIONS: 'historical.missions',
  HISTORICAL_FEED: 'historical.feed',
  HISTORICAL_CONVOYS: 'historical.convoys',
  DBUILD_PLACEMENTS: 'dbuild.placements',
  USER_PROFILES: 'user.profiles',
  LOGISTICS_ROUTE_VISIBILITY: 'logistics.route-visibility',
  COMBAT_MISSIONS: 'combat.missions',
  CSV_BUFFER: 'csv.buffer',
  LUA_ZONE_BUFFER: 'lua.zones-buffer',
});

const LEGACY_DIR = path.resolve(process.cwd(), 'data/legacy-json');

const selectStmt = db.prepare('SELECT payload FROM json_blobs WHERE id = ?');
const upsertStmt = db.prepare(`
  INSERT INTO json_blobs (id, payload, updated_at)
  VALUES (?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);

function cloneFallback(fallback) {
  if (fallback === undefined) return fallback;
  return JSON.parse(JSON.stringify(fallback));
}

function isSafeAppSeedPath(filePath) {
  if (!filePath) return false;
  const resolved = path.resolve(filePath);
  const cwd = process.cwd();
  const relative = path.relative(cwd, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return false;
  }
  if (relative.split(path.sep).includes('legacy-json')) {
    return false;
  }
  const base = path.basename(resolved);
  if (base.startsWith('Export_')) return false;
  return true;
}

/**
 * Move a retired app JSON file under data/legacy-json/. DCS export paths are never moved.
 */
export function archiveSeedFile(filePath) {
  if (!isSafeAppSeedPath(filePath) || !fs.existsSync(filePath)) {
    return null;
  }

  const resolved = path.resolve(filePath);
  const relative = path.relative(process.cwd(), resolved);
  let dest = path.join(LEGACY_DIR, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    dest = `${dest}.${stamp}`;
  }

  try {
    fs.renameSync(resolved, dest);
    return dest;
  } catch (error) {
    try {
      fs.copyFileSync(resolved, dest);
      fs.unlinkSync(resolved);
      return dest;
    } catch (copyError) {
      console.error(`Legacy JSON archive failed (${resolved}):`, copyError.message);
      return null;
    }
  }
}

function parseRow(row, fallback) {
  try {
    return JSON.parse(row.payload);
  } catch (error) {
    console.error('SQLite blob parse error:', error.message);
    return cloneFallback(fallback);
  }
}

/**
 * Load a blob if present, without writing a fallback.
 * Used for caches that may simply be missing.
 */
export function loadJsonIfPresent(id, seedFile) {
  const row = selectStmt.get(id);
  if (row) {
    archiveSeedFile(seedFile);
    return parseRow(row, undefined);
  }

  if (seedFile && fs.existsSync(seedFile)) {
    try {
      const raw = fs.readFileSync(seedFile, 'utf8');
      const parsed = raw && raw.trim() !== '' ? JSON.parse(raw) : undefined;
      if (parsed === undefined) return undefined;
      saveJson(id, parsed);
      archiveSeedFile(seedFile);
      return parsed;
    } catch (error) {
      console.error(`SQLite import failed (${id} from ${seedFile}):`, error.message);
    }
  }

  return undefined;
}

/**
 * Load app JSON from SQLite. If the blob is missing, import seedFile once
 * (legacy JSON) or persist fallback so later reads hit SQLite only.
 */
export function loadJson(id, fallback, seedFile) {
  const row = selectStmt.get(id);
  if (row) {
    archiveSeedFile(seedFile);
    return parseRow(row, fallback);
  }

  if (seedFile && fs.existsSync(seedFile)) {
    try {
      const raw = fs.readFileSync(seedFile, 'utf8');
      const parsed = raw && raw.trim() !== '' ? JSON.parse(raw) : cloneFallback(fallback);
      saveJson(id, parsed);
      archiveSeedFile(seedFile);
      return parsed;
    } catch (error) {
      console.error(`SQLite import failed (${id} from ${seedFile}):`, error.message);
    }
  }

  const seeded = cloneFallback(fallback);
  if (seeded !== undefined) {
    saveJson(id, seeded);
  }
  return seeded;
}

export function saveJson(id, payload) {
  upsertStmt.run(id, JSON.stringify(payload), Date.now());
}
