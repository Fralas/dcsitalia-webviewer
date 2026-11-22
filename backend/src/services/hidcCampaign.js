/**
 * HIDC campaign service: DCS pilot link, personal XP, active-region votes.
 *
 * DCORE files (same machine, see DCORE src/DBRIDGE and src/DMAP):
 *   - Export_Pilot_LinkRequests.json  hook DPILOT_LinkHook.lua appends "code|ucid|name|ts" lines (we truncate after use)
 *   - Export_Pilot_Stats.json         DBRIDGE_Pilots.lua: flight time / sorties / XP / level per UCID (read-only)
 *   - Export_Pilot_Cargo.json         DBRIDGE_Cargo.lua: sling-load deliveries / kg / km per UCID (read-only)
 *   - Export_DCampaign_Focus.json     DMAP_Focus.lua: active region, BLUE attack region, candidates (read-only)
 *   - Export_DRegion_Status.json      DMAP_Region.lua: region -> "blue" | "red" (read-only)
 * Missions (services/hidcMissions.js): SEAD / DEAD / CAS / LOGISTICS per zone, accepted on the site,
 * completed in DCS within 2 hours; their XP is added to the pilot level.
 * Region votes open by themselves after each conquest, or are started by a pilot of level >= 5:
 * pilots pick the region to attack and the BLUE region to attack from; the winner is applied
 * through the DBRIDGE command queue (type "focus_vote").
 *
 * When DCSServerBot is configured (deps.serverBot, DCSSB_DATABASE_URL) it replaces the first two:
 * the Discord link comes from the bot's /linkme (players.discord_id) and XP is computed here from
 * its statistics table (slot time + landed sorties), with the same level curve as DBRIDGE_Pilots.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';
import { optionalPath } from '../config/envPaths.js';
import * as discordAuth from './discordAuth.js';
import { createHidcMissions } from './hidcMissions.js';
import { createHidcAirLift } from './hidcAirLift.js';

const LINK_CODE_PATTERN = /^HIDC-[A-Z0-9]{6}$/;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const REGION_PATTERN = /^REGION_\d{2}$/;

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envIntOrZero(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

// Region votes: open by themselves after each conquest, or started by a pilot (see tickVotes / startVote).
export const VOTE_RULES = Object.freeze({
  minStartLevel: envIntOrZero('HIDC_VOTE_MIN_LEVEL', 5),
  minVoterLevel: envIntOrZero('HIDC_VOTE_MIN_VOTER_LEVEL', 0),
  // After a pilot-started round, wait this long before another one can be started.
  cooldownMs: envIntOrZero('HIDC_VOTE_COOLDOWN_MIN', 60) * 60 * 1000,
  // Ballots needed for a round to be valid. Below it an automatic round is extended,
  // a pilot-started round closes and the active region stays.
  minVotes: envInt('HIDC_VOTE_MIN_VOTES', 3),
  durationMs: envInt('HIDC_VOTE_DURATION_MIN', 120) * 60 * 1000,
  retryMs: envInt('HIDC_VOTE_RETRY_MIN', 10) * 60 * 1000,
  applyTimeoutMs: envInt('HIDC_VOTE_APPLY_TIMEOUT_MIN', 7 * 24 * 60) * 60 * 1000,
  // Discord ids allowed to start and vote below the min levels (comma separated), e.g. staff or testers.
  levelBypassIds: String(process.env.HIDC_VOTE_LEVEL_BYPASS_IDS || '').split(',').map((id) => id.trim()).filter(Boolean),
});

const HISTORY_LIMIT = 20;

// Test only: force a pilot level per Discord id, "id:level,id:level" (e.g. to try the C-130 at level 25).
// Ignored in production.
const LEVEL_OVERRIDES = process.env.NODE_ENV === 'production'
  ? new Map()
  : new Map(String(process.env.HIDC_LEVEL_OVERRIDES || '').split(',')
    .map((entry) => entry.split(':').map((part) => part.trim()))
    .filter(([id, level]) => id && Number.isFinite(Number.parseInt(level, 10)))
    .map(([id, level]) => [id, Number.parseInt(level, 10)]));

function sanitizeText(value, maxLen = 120) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  return String(value).trim().slice(0, maxLen);
}

function regionLabel(regionId) {
  const match = String(regionId || '').match(/^REGION_(\d+)$/);
  return match ? `Region ${match[1]}` : String(regionId || '?');
}

function readJsonFile(targetPath, fallback = null) {
  try {
    if (!targetPath || !fs.existsSync(targetPath)) return fallback;
    const raw = fs.readFileSync(targetPath, 'utf8');
    if (!raw || raw.trim() === '') return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`HIDC read error (${targetPath}):`, error.message);
    return fallback;
  }
}

/**
 * @param {object} deps
 * @param {string|null} deps.dbridgeDir      DCORE src/DBRIDGE directory (inferred by server.js)
 * @param {(cmd: object) => object} deps.enqueueWebCommand
 * @param {(id: string) => boolean} deps.hasWebCommand
 * @param {(id: string) => object|null} deps.getWebCommandResult
 * @param {(event: string, payload: object) => void} deps.emit
 * @param {object} [deps.serverBot]  createDcsServerBot() instance (optional)
 * @param {() => Array} [deps.getZones]  frontline zones (id, status, tasks) for the missions
 * @param {(event: object) => void} [deps.pushFeed]  site activity feed
 * @param {() => Array} [deps.getActiveAirports]  BLUE airports (AI logistics missions)
 * @param {(airportId: string) => Array} [deps.getAirportStock]  warehouse rows of an airport
 * @param {() => number|null} [deps.readBluePoints]
 */
export function createHidcCampaign(deps) {
  const dbridgeDir = deps.dbridgeDir || null;
  const dcoreSrcDir = dbridgeDir ? path.dirname(dbridgeDir) : null;
  const files = {
    linkRequests: optionalPath('HIDC_PILOT_LINK_REQUESTS_FILE')
      || (dbridgeDir ? path.join(dbridgeDir, 'Export_Pilot_LinkRequests.json') : null),
    stats: optionalPath('HIDC_PILOT_STATS_FILE')
      || (dbridgeDir ? path.join(dbridgeDir, 'Export_Pilot_Stats.json') : null),
    cargo: optionalPath('HIDC_PILOT_CARGO_FILE')
      || (dbridgeDir ? path.join(dbridgeDir, 'Export_Pilot_Cargo.json') : null),
    focus: optionalPath('HIDC_FOCUS_FILE')
      || (dcoreSrcDir ? path.join(dcoreSrcDir, 'DMAP', 'Export_DCampaign_Focus.json') : null),
    regionStatus: optionalPath('HIDC_REGION_STATUS_FILE')
      || (dcoreSrcDir ? path.join(dcoreSrcDir, 'DMAP', 'Export_DRegion_Status.json') : null),
    airlift: optionalPath('HIDC_AIRLIFT_STATE_FILE')
      || (dbridgeDir ? path.join(dbridgeDir, 'Export_AirLift.json') : null),
  };
  const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
  const voteChannelId = String(process.env.HIDC_VOTE_CHANNEL_ID || '').trim();
  const siteUrl = String(process.env.FRONTEND_URL || '').trim();
  let linkRequestsSignature = '';
  const serverBot = deps.serverBot?.enabled ? deps.serverBot : null;

  // XP rules used with DCSServerBot (DCORE exports its own rules in Export_Pilot_Stats.json).
  const botRules = {
    xp_per_flight_minute: envIntOrZero('HIDC_XP_PER_MINUTE', 1),
    xp_per_sortie: envIntOrZero('HIDC_XP_PER_SORTIE', 10),
    level_max: envInt('HIDC_LEVEL_MAX', 100),
    level_xp_base: envInt('HIDC_LEVEL_XP_BASE', 60),
    level_xp_exp: Number.parseFloat(process.env.HIDC_LEVEL_XP_EXP) > 0 ? Number.parseFloat(process.env.HIDC_LEVEL_XP_EXP) : 1,
    source: 'dcsserverbot',
  };
  // Same curve as DBRIDGE_Pilots.lua: floor(base * L^exp), L = 0..max.
  const botThresholds = Array.from({ length: botRules.level_max + 1 }, (_, level) => (
    Math.floor(botRules.level_xp_base * level ** botRules.level_xp_exp)
  ));

  function botXp(entry) {
    const totals = entry?.totals;
    if (!totals) return { xp: 0, flightXp: 0, sortieXp: 0, sorties: 0 };
    const sorties = Math.min(totals.takeoffs, totals.landings);
    const flightXp = Math.floor(totals.playtimeSec / 60) * botRules.xp_per_flight_minute;
    const sortieXp = sorties * botRules.xp_per_sortie;
    return { xp: flightXp + sortieXp, flightXp, sortieXp, sorties };
  }

  function linkDisabledError() {
    const error = new Error('Il collegamento DCS si fa con /linkme di DCSServerBot sul Discord.');
    error.status = 409;
    return error;
  }

  // ---------------------------------------------------------------- storage

  function readLinks() {
    const raw = loadJson(DOC.HIDC_PILOT_LINKS, {});
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  }

  function readCodes() {
    const raw = loadJson(DOC.HIDC_PILOT_LINK_CODES, {});
    const codes = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const now = Date.now();
    let changed = false;
    Object.entries(codes).forEach(([code, entry]) => {
      if ((Number(entry?.expiresAt) || 0) <= now) {
        delete codes[code];
        changed = true;
      }
    });
    if (changed) saveJson(DOC.HIDC_PILOT_LINK_CODES, codes);
    return codes;
  }

  function readVotes() {
    const raw = loadJson(DOC.HIDC_REGION_VOTES, { current: null, history: [] });
    return {
      current: raw?.current && typeof raw.current === 'object' ? raw.current : null,
      history: Array.isArray(raw?.history) ? raw.history : [],
      lastFocusTarget: REGION_PATTERN.test(String(raw?.lastFocusTarget || '')) ? raw.lastFocusTarget : null,
    };
  }

  function writeVotes(state) {
    saveJson(DOC.HIDC_REGION_VOTES, {
      current: state.current || null,
      history: (state.history || []).slice(0, HISTORY_LIMIT),
      lastFocusTarget: state.lastFocusTarget || null,
    });
  }

  // ---------------------------------------------------------------- DCORE exports

  function readStats() {
    if (serverBot) {
      const snap = serverBot.getSnapshot();
      return {
        pilots: {},
        thresholds: botThresholds,
        rules: botRules,
        updatedAt: snap.updatedAt,
        available: Boolean(snap.ok),
        source: 'dcsserverbot',
      };
    }
    const parsed = readJsonFile(files.stats, null);
    const thresholds = Array.isArray(parsed?.level_thresholds) && parsed.level_thresholds.length > 0
      ? parsed.level_thresholds.map((value) => Number(value) || 0)
      : [0];
    return {
      pilots: parsed?.pilots && typeof parsed.pilots === 'object' ? parsed.pilots : {},
      thresholds,
      rules: parsed?.rules || null,
      updatedAt: Number(parsed?.updated_at) || null,
      available: Boolean(parsed),
    };
  }

  // Logistica per pilota (DCORE DBRIDGE_Cargo): somma sugli UCID collegati allo stesso account.
  function cargoForUcids(ucids) {
    if (serverBot?.getCargo) return serverBot.getCargo(ucids);
    const parsed = readJsonFile(files.cargo, null);
    const pilots = parsed?.pilots && typeof parsed.pilots === 'object' ? parsed.pilots : null;
    if (!pilots) return null;
    let found = false;
    const out = { deliveries: 0, kg: 0, km: 0, tkm: 0, last: null, bestKm: 0, bestKg: 0, bestAt: null };
    (ucids || []).forEach((ucid) => {
      const row = pilots[ucid];
      if (!row) return;
      found = true;
      out.deliveries += Number(row.deliveries) || 0;
      out.kg += Number(row.kg) || 0;
      out.km += Number(row.km) || 0;
      out.tkm += Number(row.tkm) || 0;
      // Longest single delivery (DBRIDGE_Cargo best_km / best_kg / best_at).
      if ((Number(row.best_km) || 0) > out.bestKm) {
        out.bestKm = Number(row.best_km) || 0;
        out.bestKg = Number(row.best_kg) || 0;
        out.bestAt = Number(row.best_at) || null;
      }
      const last = Number(row.last) || 0;
      if (last && (!out.last || last > out.last)) out.last = last;
    });
    return found ? out : { deliveries: 0, kg: 0, km: 0, tkm: 0, last: null, bestKm: 0, bestKg: 0, bestAt: null };
  }

  // ---------------------------------------------------------------- test levels (never in production)
  // Accounts allowed to force their own level from the map test menu: HIDC_LEVEL_OVERRIDES ids and
  // HIDC_VOTE_LEVEL_BYPASS_IDS (staff / testers). The level picked in the menu wins over the .env one.

  function canUseTestLevel(discordId) {
    if (process.env.NODE_ENV === 'production' || !discordId) return false;
    const id = String(discordId);
    return LEVEL_OVERRIDES.has(id) || VOTE_RULES.levelBypassIds.includes(id);
  }

  function readTestLevels() {
    const raw = loadJson(DOC.HIDC_DEV_LEVELS, {});
    return raw && typeof raw === 'object' ? raw : {};
  }

  /** Forced level of an account, or null (menu choice first, then HIDC_LEVEL_OVERRIDES). */
  function forcedLevel(discordId) {
    if (!canUseTestLevel(discordId)) return null;
    const id = String(discordId);
    const picked = readTestLevels()[id];
    if (picked === 'real') return null;
    if (Number.isFinite(Number(picked))) return Number(picked);
    return LEVEL_OVERRIDES.has(id) ? LEVEL_OVERRIDES.get(id) : null;
  }

  function setTestLevel(user, level) {
    if (!canUseTestLevel(user?.id)) {
      const error = new Error('Livello di test non disponibile per questo account.');
      error.status = 403;
      throw error;
    }
    const levels = readTestLevels();
    if (level == null) {
      levels[String(user.id)] = 'real';
    } else {
      const value = Math.floor(Number(level));
      if (!Number.isFinite(value) || value < 0 || value > botRules.level_max) {
        const error = new Error(`Livello non valido (0-${botRules.level_max}).`);
        error.status = 400;
        throw error;
      }
      levels[String(user.id)] = value;
    }
    saveJson(DOC.HIDC_DEV_LEVELS, levels);
    deps.emit('hidc:campaign-updated', { reason: 'test-level' });
    deps.emit('hidc:airlift-updated', { reason: 'test-level' });
  }

  /** XP set exactly to the threshold of a forced test level, so higher and lower levels can both be tried. */
  function withLevelOverride(discordId, xp, thresholds) {
    const forced = forcedLevel(discordId);
    if (forced == null) return xp;
    const level = Math.max(0, Math.min(forced, thresholds.length - 1));
    return thresholds[level] || 0;
  }

  // Livelli 0-based: thresholds[i] = XP minima del livello i (0 = recluta), come DBRIDGE_Pilots.lua.
  function levelInfo(xp, thresholds) {
    let level = 0;
    thresholds.forEach((minXp, index) => {
      if (xp >= minXp) level = index;
    });
    const currentMin = thresholds[level] || 0;
    const nextMin = level + 1 < thresholds.length ? thresholds[level + 1] : null;
    return {
      level,
      xp,
      levelXp: currentMin,
      nextLevelXp: nextMin,
      maxLevel: thresholds.length - 1,
    };
  }

  function botPilot(discordId, stats) {
    const entry = serverBot.getPilot(discordId);
    if (!entry) return { link: null, stats: null, level: null, combat: null };
    const xp = botXp(entry);
    const missionXp = missionXpFor(discordId);
    return {
      link: { ucid: entry.ucids[0], ucids: entry.ucids, name: entry.name, linkedAt: null, source: 'dcsserverbot' },
      stats: {
        name: entry.name,
        flightSec: entry.totals.playtimeSec,
        sorties: xp.sorties,
        lastSeen: entry.lastFlight ? Math.floor(entry.lastFlight / 1000) : (entry.lastSeen ? Math.floor(entry.lastSeen / 1000) : null),
        flightXp: xp.flightXp,
        sortieXp: xp.sortieXp,
        missionXp: missionXp.total,
        missionsCompleted: missionXp.completed,
      },
      level: levelInfo(withLevelOverride(discordId, xp.xp + missionXp.total, stats.thresholds), stats.thresholds),
      combat: {
        takeoffs: entry.totals.takeoffs,
        landings: entry.totals.landings,
        kills: entry.totals.kills,
        pvp: entry.totals.pvp,
        deaths: entry.totals.deaths,
        ejections: entry.totals.ejections,
        crashes: entry.totals.crashes,
        teamkills: entry.totals.teamkills,
        killsBy: {
          planes: entry.totals.killsPlanes,
          helicopters: entry.totals.killsHelicopters,
          sams: entry.totals.killsSams,
          ground: entry.totals.killsGround,
          ships: entry.totals.killsShips,
        },
        deathsBy: {
          planes: entry.totals.deathsPlanes,
          helicopters: entry.totals.deathsHelicopters,
          sams: entry.totals.deathsSams,
          ground: entry.totals.deathsGround,
          ships: entry.totals.deathsShips,
          pvp: entry.totals.deathsPvp,
        },
        targets: entry.targets || [],
        nemeses: entry.nemeses || [],
        refueling: entry.refueling || null,
        aircraft: entry.aircraft.slice(0, 8),
        weapons: entry.weapons.slice(0, 8),
        traps: entry.traps,
        sorties: entry.sorties || [],
        activity: entry.activity || {},
        records: entry.records || {},
      },
    };
  }

  function pilotForUser(discordId, stats = readStats()) {
    if (serverBot) return botPilot(discordId, stats);
    const link = readLinks()[discordId] || null;
    if (!link?.ucid) return { link: null, stats: null, level: null };
    const row = stats.pilots[link.ucid] || null;
    const missionXp = missionXpFor(discordId);
    const xp = (Number(row?.xp) || 0) + missionXp.total;
    return {
      link,
      stats: row
        ? {
          name: row.name || link.name || null,
          flightSec: Number(row.flight_sec) || 0,
          sorties: Number(row.sorties) || 0,
          lastSeen: Number(row.last_seen) || null,
          missionXp: missionXp.total,
          missionsCompleted: missionXp.completed,
        }
        : { name: link.name || null, flightSec: 0, sorties: 0, lastSeen: null, missionXp: missionXp.total, missionsCompleted: missionXp.completed },
      level: levelInfo(withLevelOverride(discordId, xp, stats.thresholds), stats.thresholds),
    };
  }

  function readFocus() {
    const parsed = readJsonFile(files.focus, null);
    const candidates = Array.isArray(parsed?.candidates)
      ? parsed.candidates
        .filter((entry) => REGION_PATTERN.test(String(entry?.target || '')))
        .map((entry) => ({
          target: String(entry.target),
          froms: (Array.isArray(entry.froms) ? entry.froms : []).map(String).filter((id) => REGION_PATTERN.test(id)),
        }))
        .filter((entry) => entry.froms.length > 0)
      : [];
    return {
      available: Boolean(parsed),
      target: REGION_PATTERN.test(String(parsed?.target || '')) ? String(parsed.target) : null,
      from: REGION_PATTERN.test(String(parsed?.from || '')) ? String(parsed.from) : null,
      since: Number(parsed?.since) || null,
      allowSwitchWhileActive: parsed?.allow_switch_while_active === true,
      candidates,
    };
  }

  function readRegionStatus() {
    const parsed = readJsonFile(files.regionStatus, {});
    const out = {};
    Object.entries(parsed || {}).forEach(([regionId, status]) => {
      if (REGION_PATTERN.test(regionId)) out[regionId] = String(status) === 'blue' ? 'blue' : 'red';
    });
    return out;
  }

  // ---------------------------------------------------------------- Discord

  async function sendDirectMessage(userId, content) {
    if (!botToken || !userId) return false;
    try {
      const channelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
        method: 'POST',
        headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_id: String(userId) }),
      });
      if (!channelResponse.ok) return false;
      const channel = await channelResponse.json();
      return postChannelMessage(channel?.id, content);
    } catch (error) {
      console.error('HIDC Discord DM failed:', error.message);
      return false;
    }
  }

  async function postChannelMessage(channelId, content) {
    if (!botToken || !channelId) return false;
    try {
      const response = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: String(content).slice(0, 1900), allowed_mentions: { parse: [] } }),
      });
      return response.ok;
    } catch (error) {
      console.error('HIDC Discord channel message failed:', error.message);
      return false;
    }
  }

  function announce(content) {
    if (!voteChannelId) return;
    postChannelMessage(voteChannelId, content).catch(() => {});
  }

  // ---------------------------------------------------------------- link

  function generateCode(codes) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let attempt = 0; attempt < 50; attempt += 1) {
      let suffix = '';
      for (let i = 0; i < 6; i += 1) suffix += alphabet[crypto.randomInt(0, alphabet.length)];
      const code = `HIDC-${suffix}`;
      if (!codes[code]) return code;
    }
    throw new Error('Unable to generate link code');
  }

  function getLinkState(discordId) {
    if (serverBot) {
      const entry = serverBot.getPilot(discordId);
      return entry
        ? { linked: true, link: { name: entry.name || null, linkedAt: null } }
        : { linked: false, pending: null };
    }
    const link = readLinks()[discordId] || null;
    if (link?.ucid) return { linked: true, link: { name: link.name || null, linkedAt: link.linkedAt || null } };
    const pending = Object.entries(readCodes()).find(([, entry]) => entry?.discordId === discordId);
    return {
      linked: false,
      pending: pending ? { code: pending[0], expiresAt: pending[1].expiresAt } : null,
    };
  }

  function startLink(discordId) {
    if (serverBot) throw linkDisabledError();
    const state = getLinkState(discordId);
    if (state.linked) return state;
    if (state.pending) return state;
    const codes = readCodes();
    const code = generateCode(codes);
    const expiresAt = Date.now() + LINK_CODE_TTL_MS;
    codes[code] = { discordId, expiresAt, createdAt: Date.now() };
    saveJson(DOC.HIDC_PILOT_LINK_CODES, codes);
    return { linked: false, pending: { code, expiresAt } };
  }

  async function sendLinkCodeByDiscord(discordId) {
    if (serverBot) throw linkDisabledError();
    const state = startLink(discordId);
    if (state.linked) return { sent: false, linked: true };
    if (!botToken) {
      const error = new Error('Bot Discord non configurato (DISCORD_BOT_TOKEN).');
      error.status = 503;
      throw error;
    }
    const minutes = Math.max(1, Math.round((state.pending.expiresAt - Date.now()) / 60000));
    const sent = await sendDirectMessage(discordId, [
      '**Collegamento account DCS - DCS Italia**',
      `Entra sul server HIDC e scrivi in chat: \`${state.pending.code}\``,
      'In alternativa, da uno slot, piazza sulla mappa F10 un marker con il codice come testo.',
      `Il codice scade tra ${minutes} minuti. Non sara' visibile agli altri player.`,
    ].join('\n'));
    if (!sent) {
      const error = new Error('Impossibile inviare il DM: controlla di accettare messaggi diretti dai membri del server.');
      error.status = 502;
      throw error;
    }
    return { sent: true, ...state };
  }

  function unlink(discordId) {
    if (serverBot) throw linkDisabledError();
    const links = readLinks();
    if (!links[discordId]) return false;
    delete links[discordId];
    saveJson(DOC.HIDC_PILOT_LINKS, links);
    return true;
  }

  function parseLinkRequests(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return [];
    return trimmed.split(/\r?\n/).map((line) => {
      const parts = line.split('|');
      if (parts.length < 2) return null;
      return { code: parts[0], ucid: parts[1], name: parts[2] || '' };
    }).filter(Boolean);
  }

  function syncLinkRequests() {
    try {
      if (!files.linkRequests || !fs.existsSync(files.linkRequests)) return;
      const raw = fs.readFileSync(files.linkRequests, 'utf8');
      if (!raw || raw.trim() === '' || raw === linkRequestsSignature) return;
      linkRequestsSignature = raw;

      const codes = readCodes();
      const links = readLinks();
      const linked = [];
      parseLinkRequests(raw).forEach((request) => {
        const code = sanitizeText(request.code, 16).toUpperCase();
        const ucid = sanitizeText(request.ucid, 120);
        if (!LINK_CODE_PATTERN.test(code) || !ucid || !codes[code]) return;
        const discordId = sanitizeText(codes[code].discordId, 80);
        if (!discordId) return;
        // Un UCID appartiene a un solo account Discord.
        Object.keys(links).forEach((otherId) => {
          if (otherId !== discordId && links[otherId]?.ucid === ucid) delete links[otherId];
        });
        links[discordId] = { ucid, name: sanitizeText(request.name, 120) || null, linkedAt: Date.now() };
        delete codes[code];
        linked.push({ discordId, name: links[discordId].name });
      });

      // Codici scaduti/ignoti restano esclusi: il file viene comunque svuotato per non rileggerlo.
      fs.writeFileSync(files.linkRequests, '', 'utf8');
      linkRequestsSignature = '';

      if (linked.length > 0) {
        saveJson(DOC.HIDC_PILOT_LINKS, links);
        saveJson(DOC.HIDC_PILOT_LINK_CODES, codes);
        linked.forEach((entry) => {
          deps.emit('hidc:pilot-linked', { discordId: entry.discordId });
          sendDirectMessage(entry.discordId, `Account DCS **${entry.name || 'pilota'}** collegato al tuo profilo DCS Italia.`).catch(() => {});
        });
      }
    } catch (error) {
      console.error('HIDC link requests sync failed:', error.message);
    }
  }

  // ---------------------------------------------------------------- votes
  //
  // A round asks every pilot ONE ballot with two choices: the RED region to attack and the BLUE
  // region to attack from (one of the regions bordering that target). Ballots can be changed until
  // the round closes. A round starts:
  //   - by itself when no region is active (a region was just conquered, or the campaign started);
  //   - when a pilot of level >= minStartLevel starts it from the map (change of active region).
  // Result: the target with most ballots wins; the base is the most voted base among the ballots
  // for the winning target. Ties go to the option that reached that count first. With no ballots
  // at all the round is extended. The winner goes to DCS through the DBRIDGE queue (focus_vote).

  function hasLevelBypass(discordId) {
    // A level picked in the test menu is tested as is: no bypass on top of it.
    if (Number.isFinite(Number(readTestLevels()[String(discordId || '')]))) return false;
    return VOTE_RULES.levelBypassIds.includes(String(discordId || ''));
  }

  function candidateOptions(focus) {
    return focus.candidates.map((entry) => ({ target: entry.target, froms: [...entry.froms] }));
  }

  /** Counts per target and per base, with the time each option reached its count (tie-break). */
  function tally(vote) {
    const targets = {};
    const froms = {};
    const ballots = Object.values(vote?.ballots || {})
      .filter((ballot) => ballot?.target && ballot?.from)
      .sort((a, b) => (a.at || 0) - (b.at || 0));
    ballots.forEach((ballot) => {
      const t = targets[ballot.target] || { votes: 0, reachedAt: 0 };
      t.votes += 1;
      t.reachedAt = ballot.at || 0;
      targets[ballot.target] = t;
      const key = `${ballot.target}|${ballot.from}`;
      const f = froms[key] || { votes: 0, reachedAt: 0 };
      f.votes += 1;
      f.reachedAt = ballot.at || 0;
      froms[key] = f;
    });
    return { targets, froms, total: ballots.length };
  }

  function best(entries) {
    return entries
      .filter(([, value]) => value.votes > 0)
      .sort((a, b) => b[1].votes - a[1].votes || a[1].reachedAt - b[1].reachedAt)[0] || null;
  }

  function voteWinner(vote) {
    const counts = tally(vote);
    const target = best(Object.entries(counts.targets));
    if (!target) return { ...counts, target: null, from: null };
    const from = best(Object.entries(counts.froms).filter(([key]) => key.startsWith(`${target[0]}|`)));
    return { ...counts, target: target[0], from: from ? from[0].split('|')[1] : null };
  }

  function publicVote(vote, discordId) {
    if (!vote) return null;
    const counts = tally(vote);
    const mine = discordId ? vote.ballots?.[discordId] || null : null;
    return {
      id: vote.id,
      kind: vote.kind || 'auto',
      status: vote.status,
      conquered: vote.conquered || null,
      startedBy: vote.startedBy ? { name: vote.startedBy.name } : null,
      activeTarget: vote.activeTarget || null,
      activeFrom: vote.activeFrom || null,
      createdAt: vote.createdAt,
      endsAt: vote.endsAt,
      closedAt: vote.closedAt || null,
      extensions: vote.extensions || 0,
      resultMessage: vote.resultMessage || null,
      target: vote.target || null,
      from: vote.from || null,
      total: counts.total,
      options: (vote.options || []).map((option) => ({
        target: option.target,
        votes: counts.targets[option.target]?.votes || 0,
        froms: option.froms.map((id) => ({ id, votes: counts.froms[`${option.target}|${id}`]?.votes || 0 })),
      })),
      myBallot: mine ? { target: mine.target, from: mine.from } : null,
    };
  }

  function requirePilot(user, minLevel, action) {
    const pilot = pilotForUser(user.id);
    if (!pilot.link) {
      const error = new Error('Collega prima il tuo account DCS dal profilo.');
      error.status = 403;
      throw error;
    }
    if ((pilot.level?.level ?? 0) < minLevel && !hasLevelBypass(user.id)) {
      const error = new Error(`Serve almeno il livello ${minLevel} per ${action} (attuale ${pilot.level?.level ?? 0}).`);
      error.status = 403;
      throw error;
    }
    return pilot;
  }

  /** Last round started by a pilot, for the start cooldown. */
  function lastManualRound(state) {
    return [state.current, ...state.history].find((vote) => vote?.kind === 'manual') || null;
  }

  function startCooldownUntil(state) {
    const last = lastManualRound(state);
    if (!last) return 0;
    const from = last.closedAt || last.createdAt || 0;
    return from + VOTE_RULES.cooldownMs;
  }

  function openRound(state, focus, { conquered = null, startedBy = null } = {}) {
    if (state.current) state.history.unshift(state.current);
    const now = Date.now();
    const vote = {
      id: `vote_${now}_${crypto.randomBytes(3).toString('hex')}`,
      kind: startedBy ? 'manual' : 'auto',
      status: 'open',
      conquered: conquered || null,
      startedBy: startedBy || null,
      // Region active when the round opened: if it changes in DCS meanwhile, the round is moot.
      activeTarget: focus.target || null,
      activeFrom: focus.from || null,
      options: candidateOptions(focus),
      createdAt: now,
      endsAt: now + VOTE_RULES.durationMs,
      extensions: 0,
      ballots: {},
    };
    state.current = vote;
    writeVotes(state);
    deps.emit('hidc:campaign-updated', { reason: 'vote-open' });
    let headline = '**Votazione prossima regione aperta.**';
    if (conquered) headline = `**${regionLabel(conquered)} conquistata!** Si vota la prossima regione.`;
    else if (startedBy) headline = `**${startedBy.name}** ha avviato una votazione per cambiare la regione attiva${focus.target ? ` (ora ${regionLabel(focus.target)})` : ''}.`;
    announce([
      headline,
      `Scegli la regione da attaccare e la regione BLUE da cui partire (${vote.options.length} regioni attaccabili).`,
      `Chiude il <t:${Math.floor(vote.endsAt / 1000)}:f>.`,
      siteUrl ? `Vota sulla mappa: ${siteUrl}` : '',
    ].filter(Boolean).join('\n'));
    return vote;
  }

  function startVote(user) {
    requirePilot(user, VOTE_RULES.minStartLevel, 'avviare una votazione');
    const state = readVotes();
    if (state.current && (state.current.status === 'open' || state.current.status === 'passed')) {
      const error = new Error('C\'e\' gia\' una votazione in corso.');
      error.status = 409;
      throw error;
    }
    const until = startCooldownUntil(state);
    if (Date.now() < until) {
      const error = new Error(`Una nuova votazione si puo' avviare tra ${Math.ceil((until - Date.now()) / 60000)} minuti.`);
      error.status = 429;
      throw error;
    }
    const focus = readFocus();
    if (!focus.available) {
      const error = new Error('Stato campagna non disponibile.');
      error.status = 503;
      throw error;
    }
    if (focus.candidates.length === 0) {
      const error = new Error('Nessuna regione attaccabile al momento.');
      error.status = 409;
      throw error;
    }
    return openRound(state, focus, { startedBy: { id: user.id, name: user.globalName || user.username || user.id } });
  }

  function castBallot(user, voteId, target, from) {
    requirePilot(user, VOTE_RULES.minVoterLevel, 'votare');
    const state = readVotes();
    const vote = state.current;
    if (!vote || vote.id !== voteId || vote.status !== 'open') {
      const error = new Error('Votazione non aperta.');
      error.status = 409;
      throw error;
    }
    const option = (vote.options || []).find((entry) => entry.target === target);
    if (!option) {
      const error = new Error(`${regionLabel(target)} non e' tra le regioni attaccabili.`);
      error.status = 400;
      throw error;
    }
    if (!option.froms.includes(from)) {
      const error = new Error(`${regionLabel(target)} non e' attaccabile da ${regionLabel(from)}.`);
      error.status = 400;
      throw error;
    }
    vote.ballots = vote.ballots || {};
    vote.ballots[user.id] = { target, from, at: Date.now(), name: user.globalName || user.username || user.id };
    writeVotes(state);
    deps.emit('hidc:campaign-updated', { reason: 'ballot' });
    return vote;
  }

  function closeVote(state, status, message) {
    const vote = state.current;
    vote.status = status;
    vote.closedAt = Date.now();
    vote.resultMessage = message || null;
    state.history.unshift(vote);
    state.current = null;
  }

  function enqueueFocusCommand(vote) {
    vote.commandId = vote.commandId || `focus_vote_${vote.id}`;
    if (!deps.hasWebCommand(vote.commandId)) {
      deps.enqueueWebCommand({
        id: vote.commandId,
        type: 'focus_vote',
        target: vote.target,
        from: vote.from,
        vote_id: vote.id,
        requested_by: vote.startedBy?.name ? `Votazione avviata da ${vote.startedBy.name}` : 'Votazione sito',
        requested_by_id: vote.startedBy?.id || '',
        ts: Date.now(),
      });
    }
  }

  function tickVotes() {
    try {
      const state = readVotes();
      const focus = readFocus();
      const now = Date.now();

      // Remember the active region, to name it when it gets conquered.
      if (focus.available && focus.target && state.lastFocusTarget !== focus.target) {
        state.lastFocusTarget = focus.target;
        writeVotes(state);
      }

      const vote = state.current;

      // ---- open round
      if (vote?.status === 'open') {
        if (focus.available && (focus.target || null) !== (vote.activeTarget || null)) {
          // The active region changed in DCS meanwhile (conquered, or picked by an admin): the
          // options are stale. A conquest opens a fresh automatic round on the next tick.
          const reason = focus.target
            ? `Annullata: in DCS e' ora attiva ${regionLabel(focus.target)}.`
            : `Annullata: ${regionLabel(vote.activeTarget)} non e' piu' attiva.`;
          closeVote(state, 'cancelled', reason);
          writeVotes(state);
          deps.emit('hidc:campaign-updated', { reason: 'vote-cancelled' });
          return;
        }
        if (now < vote.endsAt) return;
        const result = voteWinner(vote);
        // A round is valid only with at least minVotes ballots.
        if (!result.target || !result.from || result.total < VOTE_RULES.minVotes) {
          const short = `${result.total}/${VOTE_RULES.minVotes} voti minimi`;
          if (vote.kind === 'manual') {
            // Not enough pilots wanted the change: keep the current region.
            closeVote(state, 'rejected', `Non valida (${short}): la regione attiva resta invariata.`);
            writeVotes(state);
            announce(`**Votazione non valida** (${short}): la regione attiva resta invariata.`);
            deps.emit('hidc:campaign-updated', { reason: 'vote-closed' });
            return;
          }
          // After a conquest the campaign needs a region: keep the round open until it is valid.
          vote.endsAt = now + VOTE_RULES.durationMs;
          vote.extensions = (vote.extensions || 0) + 1;
          writeVotes(state);
          if (vote.extensions === 1) announce(`**Votazione prossima regione prorogata**: ${short}.`);
          deps.emit('hidc:campaign-updated', { reason: 'vote-extended' });
          return;
        }
        const targetVotes = result.targets[result.target].votes;
        vote.target = result.target;
        vote.from = result.from;
        if (result.target === vote.activeTarget && result.from === vote.activeFrom) {
          closeVote(state, 'applied', `Confermata ${regionLabel(result.target)} da ${regionLabel(result.from)} (${targetVotes}/${result.total} voti).`);
          writeVotes(state);
          announce(`**Votazione chiusa**: resta attiva **${regionLabel(result.target)}** da **${regionLabel(result.from)}** (${targetVotes} voti su ${result.total}).`);
          deps.emit('hidc:campaign-updated', { reason: 'vote-closed' });
          return;
        }
        vote.status = 'passed';
        vote.passedAt = now;
        vote.resultMessage = `${regionLabel(result.target)} da ${regionLabel(result.from)} (${targetVotes}/${result.total} voti): in attesa di DCS.`;
        enqueueFocusCommand(vote);
        writeVotes(state);
        announce(`**Votazione chiusa**: si attacca **${regionLabel(result.target)}** partendo da **${regionLabel(result.from)}** (${targetVotes} voti su ${result.total}).`);
        deps.emit('hidc:campaign-updated', { reason: 'vote-closed' });
        return;
      }

      // ---- passed round, waiting for DCS
      if (vote?.status === 'passed') {
        const result = vote.commandId ? deps.getWebCommandResult(vote.commandId) : null;
        if (result) {
          closeVote(state, result.ok ? 'applied' : 'failed', result.ok
            ? (result.message || 'Applicata in DCS.')
            : `DCS ha rifiutato: ${result.message || 'errore'}`);
          writeVotes(state);
          deps.emit('hidc:campaign-updated', { reason: 'vote-applied' });
          return;
        }
        if (now - (vote.passedAt || now) > VOTE_RULES.applyTimeoutMs) {
          closeVote(state, 'failed', 'Server DCS non raggiungibile: esito scaduto.');
          writeVotes(state);
          deps.emit('hidc:campaign-updated', { reason: 'vote-expired' });
          return;
        }
        // The command queue has a TTL: re-enqueue until DCS answers (DBRIDGE is idempotent per id).
        enqueueFocusCommand(vote);
        writeVotes(state);
        return;
      }

      // ---- no round: open one by itself when DCS has no active region and offers candidates
      if (!focus.available || focus.target || focus.candidates.length === 0) return;
      const last = state.history[0];
      if (last?.status === 'failed' && now - (last.closedAt || 0) < VOTE_RULES.retryMs) return;
      const conquered = state.lastFocusTarget && readRegionStatus()[state.lastFocusTarget] === 'blue'
        ? state.lastFocusTarget
        : null;
      state.lastFocusTarget = null;
      openRound(state, focus, { conquered });
    } catch (error) {
      console.error('HIDC vote tick failed:', error.message);
    }
  }

  // ---------------------------------------------------------------- missions

  function missionXpFor(discordId) {
    return discordId ? missions.xpFor(discordId) : { total: 0, completed: 0, byType: {} };
  }

  /** Did the pilot fly in DCS after sinceMs? null when there is no flight data for them. */
  function flewSince(discordId, sinceMs) {
    if (serverBot) {
      const entry = serverBot.getPilot(discordId);
      if (!entry) return null;
      if ((Number(entry.lastFlight) || 0) >= sinceMs) return true;
      return (entry.sorties || []).some((sortie) => (
        sortie.outcome === 'open' || (Number(sortie.at) || 0) + (Number(sortie.sec) || 0) * 1000 >= sinceMs
      ));
    }
    const link = readLinks()[discordId];
    const row = link?.ucid ? readStats().pilots[link.ucid] : null;
    if (!row) return null;
    return (Number(row.last_seen) || 0) * 1000 >= sinceMs;
  }

  const missions = createHidcMissions({
    getZones: () => (typeof deps.getZones === 'function' ? deps.getZones() : []),
    readFocus: () => readJsonFile(files.focus, null),
    requirePilot: (user, minLevel, action) => requirePilot(user, minLevel, action),
    flewSince,
    emit: deps.emit,
    pushFeed: deps.pushFeed,
  });

  // AI logistics missions (tab Logistica): CH-47 / C-130 flown by DCORE DBRIDGE_AirLift.lua.
  const airlift = createHidcAirLift({
    stateFile: files.airlift,
    getActiveAirports: () => (typeof deps.getActiveAirports === 'function' ? deps.getActiveAirports() : []),
    getAirportStock: (airportId) => (typeof deps.getAirportStock === 'function' ? deps.getAirportStock(airportId) : []),
    readBluePoints: () => (typeof deps.readBluePoints === 'function' ? deps.readBluePoints() : null),
    requirePilot: (user, minLevel, action) => requirePilot(user, minLevel, action),
    levelOf: (user) => {
      const pilot = pilotForUser(user.id);
      return pilot?.link ? (pilot.level?.level ?? 0) : null;
    },
    enqueueWebCommand: deps.enqueueWebCommand,
    hasWebCommand: deps.hasWebCommand,
    getWebCommandResult: deps.getWebCommandResult,
    emit: deps.emit,
    pushFeed: deps.pushFeed,
  });

  // ---------------------------------------------------------------- state for UI

  function getCampaignState(user) {
    const focus = readFocus();
    const votes = readVotes();
    const pilot = user?.id ? pilotForUser(user.id) : null;
    const level = pilot?.level?.level || 0;
    const linked = Boolean(pilot?.link);
    const bypass = hasLevelBypass(user?.id);
    const startLevelOk = level >= VOTE_RULES.minStartLevel || bypass;
    const voteLevelOk = level >= VOTE_RULES.minVoterLevel || bypass;
    const roundActive = votes.current?.status === 'open' || votes.current?.status === 'passed';
    const cooldownUntil = startCooldownUntil(votes);
    return {
      focus,
      regionStatus: readRegionStatus(),
      vote: publicVote(votes.current, user?.id),
      lastVote: publicVote(votes.history[0], user?.id),
      rules: {
        minStartLevel: VOTE_RULES.minStartLevel,
        minVoterLevel: VOTE_RULES.minVoterLevel,
        durationMin: Math.round(VOTE_RULES.durationMs / 60000),
        cooldownMin: Math.round(VOTE_RULES.cooldownMs / 60000),
        minVotes: VOTE_RULES.minVotes,
      },
      missions: missions.getPublicState(user),
      me: user?.id
        ? {
          linked,
          level,
          startLevelOk,
          voteLevelOk,
          startCooldownUntil: cooldownUntil > Date.now() ? cooldownUntil : null,
          canStart: linked && startLevelOk && !roundActive && focus.available
            && focus.candidates.length > 0 && Date.now() >= cooldownUntil,
          canVote: linked && voteLevelOk && votes.current?.status === 'open',
          // Test level menu on the map (dev only): null when this account cannot use it.
          testLevel: canUseTestLevel(user.id)
            ? { forced: forcedLevel(user.id), max: botRules.level_max }
            : null,
        }
        : null,
    };
  }

  function getPilotProfile(user) {
    const stats = readStats();
    const pilot = pilotForUser(user.id, stats);
    const ucids = pilot.link?.ucids || (pilot.link?.ucid ? [pilot.link.ucid] : []);
    return {
      ...getLinkState(user.id),
      linkSource: serverBot ? 'dcsserverbot' : 'hidc',
      statsAvailable: stats.available,
      stats: pilot.stats,
      level: pilot.level || levelInfo(0, stats.thresholds),
      rules: stats.rules,
      combat: pilot.combat || null,
      cargo: pilot.link ? cargoForUcids(ucids) : null,
      botAvailable: Boolean(botToken) && !serverBot,
      minStartLevel: VOTE_RULES.minStartLevel,
    };
  }

  function getLeaderboard(limit = 10) {
    const stats = readStats();
    const missionXpAll = missions.allXp();
    if (serverBot) {
      return serverBot.listPilots()
        .map((entry) => {
          const xp = botXp(entry).xp + (missionXpAll[entry.discordId]?.total || 0);
          return {
            discordId: entry.discordId,
            name: entry.name || entry.discordId,
            xp,
            level: levelInfo(xp, stats.thresholds).level,
            flightSec: entry.totals.playtimeSec,
          };
        })
        .filter((row) => row.xp > 0)
        .sort((a, b) => b.xp - a.xp)
        .slice(0, limit);
    }
    const links = readLinks();
    return Object.entries(links)
      .map(([discordId, link]) => {
        const row = stats.pilots[link.ucid];
        if (!row) return null;
        const xp = (Number(row.xp) || 0) + (missionXpAll[discordId]?.total || 0);
        return {
          discordId,
          name: row.name || link.name || discordId,
          xp,
          level: levelInfo(xp, stats.thresholds).level,
          flightSec: Number(row.flight_sec) || 0,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.xp - a.xp)
      .slice(0, limit);
  }

  // ---------------------------------------------------------------- routes

  function requireUser(req, res) {
    const user = req.session?.user;
    if (!user?.id) {
      res.status(401).json({ error: 'Not authenticated' });
      return null;
    }
    return user;
  }

  function sendError(res, error) {
    res.status(Number(error.status) || 400).json({ error: error.message || 'Errore' });
  }

  function registerRoutes(app) {
    app.get('/api/hidc/pilot/me', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      res.json(getPilotProfile(user));
    });

    app.post('/api/hidc/pilot/link/start', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        res.json(startLink(user.id));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post('/api/hidc/pilot/link/discord', async (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        res.json(await sendLinkCodeByDiscord(user.id));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.delete('/api/hidc/pilot/link', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        res.json({ unlinked: unlink(user.id) });
      } catch (error) {
        sendError(res, error);
      }
    });

    app.get('/api/hidc/pilots/leaderboard', (req, res) => {
      res.json({ pilots: getLeaderboard(10) });
    });

    app.get('/api/hidc/campaign', (req, res) => {
      res.json(getCampaignState(req.session?.user || null));
    });

    // Test only: force the caller's level (body { level: number } or { level: null } for the real one).
    app.post('/api/hidc/dev/level', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        setTestLevel(user, req.body?.level ?? null);
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });

    // A pilot of level >= minStartLevel starts a round (change of active region).
    app.post('/api/hidc/campaign/votes', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        startVote(user);
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.get('/api/hidc/airlift', (req, res) => {
      res.json(airlift.getPublicState(req.session?.user || null));
    });

    app.post('/api/hidc/airlift', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        airlift.order(user, req.body || {});
        res.json(airlift.getPublicState(user));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post('/api/hidc/missions/:missionId/accept', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        missions.accept(user, sanitizeText(req.params.missionId, 120));
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.delete('/api/hidc/missions/assignments/:assignmentId', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        missions.abandon(user, sanitizeText(req.params.assignmentId, 80));
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post('/api/hidc/campaign/votes/:voteId/ballot', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        const target = sanitizeText(req.body?.target, 16);
        const from = sanitizeText(req.body?.from, 16);
        if (!REGION_PATTERN.test(target) || !REGION_PATTERN.test(from)) {
          res.status(400).json({ error: 'Regione non valida.' });
          return;
        }
        castBallot(user, sanitizeText(req.params.voteId, 80), target, from);
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });
  }

  function tick() {
    if (serverBot) serverBot.tick();
    else syncLinkRequests();
    tickVotes();
    missions.tick();
    airlift.tick();
  }

  return {
    files,
    registerRoutes,
    tick,
    // test hooks
    missions,
    airlift,
    _internals: { botThresholds, botXp, startVote, castBallot, tickVotes, voteWinner, syncLinkRequests, startLink, getCampaignState, getPilotProfile, levelInfo },
  };
}

export default { createHidcCampaign, VOTE_RULES };
