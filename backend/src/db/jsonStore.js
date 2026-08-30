import fs from 'fs';
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
});

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

/**
 * Load app JSON from SQLite. If the blob is missing, import seedFile once
 * (legacy JSON) or persist fallback so later reads hit SQLite only.
 */
export function loadJson(id, fallback, seedFile) {
  const row = selectStmt.get(id);
  if (row) {
    try {
      return JSON.parse(row.payload);
    } catch (error) {
      console.error(`SQLite blob parse error (${id}):`, error.message);
      return cloneFallback(fallback);
    }
  }

  if (seedFile && fs.existsSync(seedFile)) {
    try {
      const raw = fs.readFileSync(seedFile, 'utf8');
      const parsed = raw && raw.trim() !== '' ? JSON.parse(raw) : cloneFallback(fallback);
      saveJson(id, parsed);
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
