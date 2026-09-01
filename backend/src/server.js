import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { randomUUID } from 'crypto';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import airports, { getAirportById } from './config/airports.config.js';
import {
  WEB_MAP_ACTION_OPTIONS,
  WEB_MAP_ACTION_TYPES,
  normalizeMapActionCommandType,
  resolveMapActionOption,
} from './config/webMapActions.config.js';
import { isImportantWeapon, getWeaponPriority, getOrderQuantityForWeapon, getWeaponThresholds, getIsoFillForWeapon } from './config/rules.config.js';
import * as dataBuffer from './services/dataBuffer.js';
import * as historicalData from './services/historicalData.js';
import * as missionGenerator from './services/missionGenerator.js';
import { findBestSourceAirport, determineRecommendedAircraft } from './services/missionGenerator.js';
import { generateToken } from './utils/jwt.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import { getSqlitePath } from './db/client.js';
import { DOC, loadJson, saveJson } from './db/jsonStore.js';
import { SqliteSessionStore } from './db/sessionStore.js';
import * as airbaseStatusParser from './services/airbaseStatusParser.js';
import * as airbaseStatusManager from './services/airbaseStatusManager.js';
import * as discordAuth from './services/discordAuth.js';
import { canAccessAtc, canAccessLidc, canEditChangelog, canEditWiki, canManageNoe, requireFeatureFlag } from './config/featureAccess.js';
import { authBypassMiddleware, isAuthBypassEnabled } from './config/authBypass.js';
import { assertRuntimeSecrets, createHelmetMiddleware, createJsonBodyParser, resolveAdminPasswordHash } from './config/security.js';
import { optionalPath } from './config/envPaths.js';
import * as combatMissionDispatch from './services/combatMissionDispatch.js';
import * as luaZoneSync from './services/luaZoneSync.js';
import * as activeUsers from './services/activeUsers.js';
import * as userProfiles from './services/userProfiles.js';
import * as feedService from './services/feed.js';
import * as dbuildPlacementsService from './services/dbuildPlacements.js';
import * as convoysService from './services/convoys.js';
import * as changelogsService from './services/changelogs.js';
import * as noeEventsService from './services/noeEvents.js';
import * as changelogTranslator from './services/changelogTranslator.js';
import * as wikiService from './services/wiki.js';
import * as achievementsService from './services/achievements.js';
import * as lidcService from './services/lidcService.js';
import {
  LIDC_EXPORT_FILES,
  exportPendingWarehouseOps,
  processWarehouseOpsAck,
} from './services/lidcDcsBridge.js';
import * as atcStripsService from './services/atcStripsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
assertRuntimeSecrets();

const app = express();
const httpServer = createServer(app);

// CORS configuration
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const FRONTEND_ORIGINS = Array.from(new Set([
  FRONTEND_URL,
  ...(String(process.env.FRONTEND_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]));

function isAllowedCorsOrigin(origin) {
  if (!origin) return true;
  return FRONTEND_ORIGINS.includes(origin);
}

const corsOriginHandler = (origin, callback) => {
  if (isAllowedCorsOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
};

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const CONVOY_API_TOKEN = process.env.CONVOY_API_TOKEN || '';
const DISCORD_GUILD_ID = String(process.env.DISCORD_GUILD_ID || '').trim();
const DISCORD_BOT_TOKEN = String(process.env.DISCORD_BOT_TOKEN || '').trim();
const DISCORD_LOGISTICS_ROUTE_ROLE_ID = String(process.env.DISCORD_LOGISTICS_ROUTE_ROLE_ID || '').trim();
const DISCORD_ROLE_CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CARRIER_SOURCE_DISTANCE_KM = 50;
const KM_PER_NM = 1.852;
const MAX_CARRIER_SOURCE_DISTANCE_NM = MAX_CARRIER_SOURCE_DISTANCE_KM / KM_PER_NM;
// March 13, 2026 17:00 Europe/Rome (CET => 16:00 UTC)
const LAUNCH_TARGET_UTC_MS = Date.UTC(2026, 2, 13, 16, 0, 0);
const CONVOY_SYNC_FILE = optionalPath('CONVOY_SYNC_FILE');
const DCSAR_SYNC_FILE = optionalPath('DCSAR_SYNC_FILE');
const AIRLIFT_PLAYERS_SYNC_FILE = optionalPath('AIRLIFT_PLAYERS_SYNC_FILE');

// Production Points state exported by DCORE (DSCORE_Rigs.lua) for the map.
const PRODUCTION_POINTS_FILE = optionalPath('PRODUCTION_POINTS_FILE');

// Web -> DCORE command bridge (DBRIDGE). The webviewer OWNS the command queue file
// (append + prune); DCORE owns the result file (read-only here).
const WEB_COMMANDS_FILE = optionalPath('WEB_COMMANDS_FILE');

const WEB_COMMANDS_RESULT_FILE = optionalPath('WEB_COMMANDS_RESULT_FILE');

// Tracked crate positions exported by DMAS (live until moved/activated in-game).
const WEB_SPAWN_MARKERS_FILE = optionalPath('WEB_SPAWN_MARKERS_FILE');

const DBUILD_SITES_FILE = optionalPath('DBUILD_SITES_FILE');

const TANKER_ROUTES_FILE = optionalPath('TANKER_ROUTES_FILE');

// Max placement distance from airport center (matches DMAS blue_airbase_radius_m).
const AIRPORT_SPAWN_RADIUS_M = Number.parseInt(process.env.AIRPORT_SPAWN_RADIUS_M, 10) || 2500;
const PP_RETRIEVE_RADIUS_M = Number.parseInt(process.env.PP_RETRIEVE_RADIUS_M, 10) || 500;
const SPAWN_QUANTITY_MAX = 5;
const SPAWN_OFFSET_METERS = 2;
const SPAWN_OFFSET_BEARING_DEG = 90;

// How long a queued web command lives before being pruned (also drives result grace).
const WEB_COMMAND_TTL_MS = Number.parseInt(process.env.WEB_COMMAND_TTL_MS, 10) || 10 * 60 * 1000;
const WEB_COMMAND_RESULT_GRACE_MS = Number.parseInt(process.env.WEB_COMMAND_RESULT_GRACE_MS, 10) || 60 * 1000;

// Web-initiated spawn catalog (mirrors DMAS_Config: spawn_cost + crate_build.catalog).
// Costs are informational for the UI; DCORE remains authoritative on validation/economy.
const WEB_INFANTRY_OPTIONS = [
  { keyword: 'MANPAD', label: 'MANPAD', cost: 30 },
  { keyword: 'SCOUT', label: 'SCOUT', cost: 20 },
];
const WEB_CRATE_OPTIONS = [
  { keyword: 'AMMO', label: 'AMMO', cost: 5, group: 'build' },
  { keyword: 'FUEL', label: 'FUEL', cost: 5, group: 'build' },
  { keyword: 'BUILD', label: 'BUILD', cost: 5, group: 'build' },
  { keyword: 'PPBUILD', label: 'PPBUILD', cost: 20, group: 'build' },
  { keyword: 'HMMWV', label: 'HMMWV', cost: 40, group: 'deployables' },
  { keyword: 'TOW', label: 'TOW', cost: 45, group: 'deployables' },
  { keyword: 'L118', label: 'L118', cost: 30, group: 'deployables' },
  { keyword: 'TACAN', label: 'TACAN', cost: 50, group: 'deployables' },
];
const WEB_INFANTRY_KEYWORDS = new Set(WEB_INFANTRY_OPTIONS.map((o) => o.keyword));
const WEB_CRATE_KEYWORDS = new Set(WEB_CRATE_OPTIONS.map((o) => o.keyword));

const TANKER_MIN_DIST_NM = 45;
const WEB_TANKER_OPTIONS = [
  {
    keyword: 'BOOM',
    label: 'BOOM',
    min_dist_nm: TANKER_MIN_DIST_NM,
    altitude_ft: 23000,
    speed_kt: 420,
    platform: 'KC-135 Shell',
    tacan: '16Y',
    freq_mhz: 315,
  },
  {
    keyword: 'BASKET',
    label: 'BASKET',
    min_dist_nm: TANKER_MIN_DIST_NM,
    altitude_ft: 21000,
    speed_kt: 380,
    platform: 'KC-135Mprs Texaco',
    tacan: '18Y',
    freq_mhz: 310,
  },
];
const WEB_TANKER_KEYWORDS = new Set(WEB_TANKER_OPTIONS.map((o) => o.keyword));

const DBUILD_CRATE_FP_COST = 5;
const DBUILD_MATCH_RADIUS_M = 150;

const DBUILD_CATALOG = [
  {
    id: 'mortar',
    label: 'Mortar',
    keyword: 'MORTAR',
    section: 'defence',
    required_categories: { AMMO: 2 },
    category_order: ['AMMO'],
    dismantle_supported: true,
    build_radius_m: 80,
  },
  {
    id: 'ewr',
    label: 'EWR',
    keyword: 'EWR',
    section: 'defence',
    required_categories: { AMMO: 3, FUEL: 2, BUILD: 5 },
    category_order: ['AMMO', 'FUEL', 'BUILD'],
    dismantle_supported: false,
    build_radius_m: 80,
  },
  {
    id: 'nasams',
    label: 'NASAMS',
    keyword: 'NASAMS',
    section: 'defence',
    required_categories: { AMMO: 3, BUILD: 3, FUEL: 2 },
    category_order: ['AMMO', 'BUILD', 'FUEL'],
    dismantle_supported: true,
    build_radius_m: 80,
  },
  {
    id: 'rapier',
    label: 'Rapier',
    keyword: 'RAPIER',
    section: 'defence',
    required_categories: { AMMO: 2, BUILD: 1 },
    category_order: ['AMMO', 'BUILD'],
    dismantle_supported: true,
    build_radius_m: 80,
  },
  {
    id: 'farp',
    label: 'FARP',
    keyword: 'FARP',
    section: 'logistics',
    required_categories: { AMMO: 3, FUEL: 2, BUILD: 3 },
    category_order: ['AMMO', 'FUEL', 'BUILD'],
    dismantle_supported: true,
    build_radius_m: 80,
    placement_notes: 'Min 250 m from other FARPs and 5 NM from airbases.',
  },
];

const DBUILD_TYPE_IDS = new Set(DBUILD_CATALOG.map((entry) => entry.id));

// CSV Directory - configurable via environment variable
const CSV_DIR = process.env.CSV_DIR
  ? path.resolve(process.env.CSV_DIR)
  : path.resolve(__dirname, '../../');

logger.info(`📁 CSV Directory: ${CSV_DIR}`);

// Airbase status - loaded from airbases_status.lua
const AIRBASE_STATUS_FILE = optionalPath('AIRBASE_STATUS_FILE');
let airbaseStatus = {};

if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

app.use(createHelmetMiddleware());

// CORS
app.use(cors({
  origin: corsOriginHandler,
  credentials: true
}));

// Rate limiting (production only — map polling in dev exceeds typical limits)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // limit each IP to 500 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use(limiter);
}
app.use(createJsonBodyParser());
app.use(cookieParser());

// Session configuration
app.use(session({
  store: new SqliteSessionStore(),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

// Temporary local Discord bypass (AUTH_BYPASS_LOCAL + development only)
app.use(authBypassMiddleware);

// Store current data in memory
let currentData = {};
let dataRefreshInProgress = false;
let refreshQueued = false;
let refreshPromise = Promise.resolve(currentData);
let refreshTimer = null;
let pendingRefreshReason = null;

// Buffer file location (optional override via environment variable)
const BUFFER_FILE_PATH = process.env.BUFFER_FILE_PATH
  ? path.resolve(process.env.BUFFER_FILE_PATH)
  : path.resolve(process.cwd(), 'data-buffer.json');

const LOGISTICS_ROUTE_VISIBILITY_FILE_PATH = process.env.LOGISTICS_ROUTE_VISIBILITY_FILE
  ? path.resolve(process.env.LOGISTICS_ROUTE_VISIBILITY_FILE)
  : path.resolve(process.cwd(), 'logistics-route-visibility.json');

// Lua zone buffer location and refresh interval
const LUA_ZONE_BUFFER_PATH = process.env.LUA_ZONE_BUFFER_PATH
  ? path.resolve(process.env.LUA_ZONE_BUFFER_PATH)
  : path.resolve(process.cwd(), 'lua-zones-buffer.json');

const LUA_ZONE_BUFFER_INTERVAL_MS = Number.parseInt(process.env.LUA_ZONE_BUFFER_INTERVAL_MS, 10) || 5 * 60 * 1000;
const REFRESH_DEBOUNCE_MS = Number.parseInt(process.env.REFRESH_DEBOUNCE_MS, 10) || 500;

const FRONTLINE_ZONES_FILE = process.env.DYZONE_OUTPUT_JSON
  ? path.resolve(process.env.DYZONE_OUTPUT_JSON)
  : path.resolve(__dirname, '../../frontend/src/config/frontlineZones.json');

let lastZoneStatusById = new Map();
let convoySyncSignature = '';
let convoyEventById = new Map();
let dcsarSyncSignature = '';
let dcsarPoints = [];
let airliftPlayersSyncSignature = '';
let airliftPlayers = [];
let productionPointsSyncSignature = '';
let productionPoints = [];
// Web command bridge state
let webCommands = []; // queued commands not yet pruned: { id, type, keyword, lat, lon, requested_by, requested_by_id, ts }
let webCommandResultsById = new Map(); // id -> { ...result, _localTs }
let webCommandResultSignature = '';
let webCommandFeedEmittedIds = new Set(); // command id -> feed already written
let webSpawnMarkersSyncSignature = '';
let webSpawnMarkers = [];
let tankerRoutesSyncSignature = '';
let tankerRoutes = [];
let dbuildSitesSyncSignature = '';
let dbuildSites = [];
let zoneOperationsById = new Map();
let hiddenLogisticsRouteAirportIds = new Set();
const ZONE_OPERATION_TTL_MS = 45 * 60 * 1000;
const ZONE_OPERATION_MAX_PER_USER = 2;

async function resolveDiscordLogisticsRoutePermission(userId) {
  if (!userId || !DISCORD_GUILD_ID || !DISCORD_BOT_TOKEN || !DISCORD_LOGISTICS_ROUTE_ROLE_ID) {
    return { roleIds: [], canManageLogisticsRouteVisibility: false };
  }

  try {
    const member = await discordAuth.getGuildMember(DISCORD_GUILD_ID, userId, DISCORD_BOT_TOKEN);
    const roleIds = Array.isArray(member?.roles) ? member.roles.map((roleId) => String(roleId)) : [];
    return {
      roleIds,
      canManageLogisticsRouteVisibility: roleIds.includes(DISCORD_LOGISTICS_ROUTE_ROLE_ID),
    };
  } catch (error) {
    console.warn(`Failed to resolve Discord roles for user ${userId}:`, error.message);
    return { roleIds: [], canManageLogisticsRouteVisibility: false };
  }
}

async function ensureSessionUserPermissions(req, options = {}) {
  const forceRefresh = options.forceRefresh === true;
  const sessionUser = req?.session?.user;
  if (!sessionUser?.id) return null;

  // Local auth bypass: keep injected permissions, skip Discord role lookup.
  if (sessionUser.isLocalBypass === true) {
    return sessionUser;
  }

  const lastResolvedAt = Number(req.session.userPermissionsResolvedAt || 0);
  const cacheValid = !forceRefresh
    && Number.isFinite(lastResolvedAt)
    && (Date.now() - lastResolvedAt) < DISCORD_ROLE_CACHE_TTL_MS
    && typeof sessionUser.canManageLogisticsRouteVisibility === 'boolean'
    && typeof sessionUser.canEditWiki === 'boolean'
    && typeof sessionUser.canAccessLidc === 'boolean'
    && typeof sessionUser.canAccessAtc === 'boolean';

  if (cacheValid) {
    return sessionUser;
  }

  const permissions = await resolveDiscordLogisticsRoutePermission(sessionUser.id);
  const roleIds = permissions.roleIds;
  req.session.user = {
    ...sessionUser,
    discordRoleIds: roleIds,
    canManageLogisticsRouteVisibility: permissions.canManageLogisticsRouteVisibility,
    canEditWiki: canEditWiki(sessionUser.id, roleIds),
    canAccessLidc: canAccessLidc(sessionUser.id, roleIds),
    canAccessAtc: canAccessAtc(sessionUser.id, roleIds),
    canManageNoe: canManageNoe(sessionUser.id, roleIds),
    canEditChangelog: canEditChangelog(sessionUser.id, roleIds),
  };
  req.session.userPermissionsResolvedAt = Date.now();
  return req.session.user;
}

function loadFrontlineZonesFromFile() {
  if (!fs.existsSync(FRONTLINE_ZONES_FILE)) {
    return [];
  }

  try {
    const data = fs.readFileSync(FRONTLINE_ZONES_FILE, 'utf8');
    const zones = JSON.parse(data);
    return Array.isArray(zones) ? zones : [];
  } catch (error) {
    console.error('Error loading frontline zones from file:', error.message);
    return [];
  }
}

function getKnownAirportIds() {
  return new Set((Array.isArray(airports) ? airports : []).map((airport) => String(airport?.id || '').trim()).filter(Boolean));
}

function normalizeHiddenLogisticsRouteAirportIds(rawValue) {
  const knownAirportIds = getKnownAirportIds();
  if (!Array.isArray(rawValue)) return [];
  return rawValue
    .map((value) => String(value || '').trim())
    .filter((airportId) => airportId !== '' && knownAirportIds.has(airportId));
}

function persistHiddenLogisticsRouteAirportIds() {
  saveJson(DOC.LOGISTICS_ROUTE_VISIBILITY, {
    hiddenAirportIds: Array.from(hiddenLogisticsRouteAirportIds).sort(),
    updatedAt: new Date().toISOString(),
  });
}

function loadHiddenLogisticsRouteAirportIds() {
  try {
    const parsed = loadJson(DOC.LOGISTICS_ROUTE_VISIBILITY, { hiddenAirportIds: [] }, LOGISTICS_ROUTE_VISIBILITY_FILE_PATH);
    hiddenLogisticsRouteAirportIds = new Set(normalizeHiddenLogisticsRouteAirportIds(parsed?.hiddenAirportIds));
    persistHiddenLogisticsRouteAirportIds();
  } catch (error) {
    console.error('Error loading logistics route visibility:', error.message);
    hiddenLogisticsRouteAirportIds = new Set();
    persistHiddenLogisticsRouteAirportIds();
  }
}

function getHiddenLogisticsRouteAirportIdsPayload() {
  return Array.from(hiddenLogisticsRouteAirportIds).sort();
}

function cleanupExpiredZoneOperations(now = Date.now()) {
  let changed = false;
  for (const [zoneId, operation] of zoneOperationsById.entries()) {
    if (!operation) {
      zoneOperationsById.delete(zoneId);
      changed = true;
      continue;
    }

    if (!Number.isFinite(operation.expires_at) || operation.expires_at <= now) {
      zoneOperationsById.delete(zoneId);
      changed = true;
    }
  }
  return changed;
}

function pruneZoneOperationsForMissingZones(zones) {
  const validZoneIds = new Set((Array.isArray(zones) ? zones : []).map((zone) => zone?.id).filter(Boolean));
  let changed = false;
  for (const zoneId of zoneOperationsById.keys()) {
    if (!validZoneIds.has(zoneId)) {
      zoneOperationsById.delete(zoneId);
      changed = true;
    }
  }
  return changed;
}

function getActiveOperationsForUser(userId, now = Date.now()) {
  if (!userId) return [];
  const normalizedUser = String(userId).trim();
  if (!normalizedUser) return [];

  const result = [];
  for (const operation of zoneOperationsById.values()) {
    if (!operation) continue;
    if (operation.user_id !== normalizedUser) continue;
    if (!Number.isFinite(operation.expires_at) || operation.expires_at <= now) continue;
    result.push(operation);
  }
  return result;
}

function buildFrontlineZonesPayload(zones, now = Date.now()) {
  cleanupExpiredZoneOperations(now);
  pruneZoneOperationsForMissingZones(zones);

  return (Array.isArray(zones) ? zones : []).map((zone) => {
    const operation = zoneOperationsById.get(zone.id);
    const activeOperation = operation && Number.isFinite(operation.expires_at) && operation.expires_at > now
      ? operation
      : null;

    return {
      ...zone,
      operation_assigned: Boolean(activeOperation),
      operation_assigned_to: activeOperation?.user_id || null,
      operation_accepted_at: activeOperation?.accepted_at || null,
      operation_expires_at: activeOperation?.expires_at || null,
      operation_remaining_ms: activeOperation ? Math.max(0, activeOperation.expires_at - now) : 0,
    };
  });
}

function emitFrontlineUpdate(zonesFromSource = null) {
  const sourceZones = Array.isArray(zonesFromSource) ? zonesFromSource : loadFrontlineZonesFromFile();
  const zones = buildFrontlineZonesPayload(sourceZones);
  io.emit('frontline:updated', { zones });
  return zones;
}

function pushFeedEvent(event) {
  const created = feedService.appendFeedEvent(event);
  io.emit('feed:updated', {
    events: feedService.getFeedEvents(250),
    latest: created,
  });
  return created;
}

function getAirportDisplayName(airportId) {
  const airport = getAirportById(airportId);
  return airport?.displayName || airport?.name || airportId || 'Unknown';
}

const SPAWN_FEED_LABELS = {
  MANPAD: 'MANPAD',
  SCOUT: 'Scout',
  AMMO: 'Ammo',
  FUEL: 'Fuel',
  BUILD: 'Build',
  HMMWV: 'HMMWV',
  TOW: 'TOW',
  L118: 'L118',
  TACAN: 'TACAN',
};

function formatSpawnKeywordLabel(keyword) {
  const value = String(keyword || '').trim().toUpperCase();
  if (!value) return 'item';
  return SPAWN_FEED_LABELS[value] || (value.charAt(0) + value.slice(1).toLowerCase());
}

function formatProductionPointNumber(rawId) {
  const id = String(rawId || '').trim();
  const match = id.match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? match[1].padStart(2, '0') : null;
}

function getProductionPointDisplayName(ppId) {
  const pp = productionPoints.find((entry) => entry.id === ppId);
  const raw = pp?.zone_name || pp?.id || ppId;
  const num = formatProductionPointNumber(raw);
  if (num) return `Production Point ${num}`;
  return raw || 'Production Point';
}

function getDbuildCatalogEntry(buildType) {
  return DBUILD_CATALOG.find((entry) => entry.id === buildType) || null;
}

function estimateDbuildFpCost(requiredCategories) {
  if (!requiredCategories || typeof requiredCategories !== 'object') return 0;
  return Object.values(requiredCategories).reduce((sum, count) => {
    const qty = Number(count) || 0;
    return sum + (qty * DBUILD_CRATE_FP_COST);
  }, 0);
}

function findNearestDbuildSite(lat, lon, buildType, maxDistanceM = DBUILD_MATCH_RADIUS_M) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null;
  let bestDistance = maxDistanceM;
  dbuildSites.forEach((site) => {
    if (buildType && site.type !== buildType) return;
    const siteLat = Number(site.lat);
    const siteLon = Number(site.lon);
    if (!Number.isFinite(siteLat) || !Number.isFinite(siteLon)) return;
    const distanceM = haversineMeters(lat, lon, siteLat, siteLon);
    if (distanceM <= bestDistance) {
      bestDistance = distanceM;
      best = site;
    }
  });
  return best;
}

function enrichDbuildPlacements(placements) {
  return placements.map((placement) => {
    const catalog = getDbuildCatalogEntry(placement.build_type);
    const required = catalog?.required_categories || {};
    const categoryOrder = catalog?.category_order || Object.keys(required);
    const estimatedFpCost = estimateDbuildFpCost(required);

    if (placement.status === 'draft' || placement.status === 'cancelled' || placement.status === 'failed') {
      return {
        ...placement,
        catalog,
        estimated_fp_cost: estimatedFpCost,
        category_order: categoryOrder,
        live: null,
      };
    }

    const live = findNearestDbuildSite(placement.lat, placement.lon, placement.build_type);
    let status = placement.status;
    if (live) {
      status = live.built ? 'built' : 'active';
    } else if (status === 'confirmed') {
      status = 'confirmed';
    }

    return {
      ...placement,
      catalog,
      estimated_fp_cost: estimatedFpCost,
      category_order: categoryOrder,
      live,
      status,
      game_site_id: live?.site_id || placement.game_site_id || null,
    };
  });
}

function bootstrapWebCommandFeedDedup() {
  feedService.getFeedEvents(1000).forEach((event) => {
    const commandId = event?.metadata?.command_id;
    if (commandId) {
      webCommandFeedEmittedIds.add(String(commandId));
    }
    if (typeof event?.id === 'string' && event.id.startsWith('webcmd_')) {
      webCommandFeedEmittedIds.add(event.id.slice('webcmd_'.length));
    }
  });
}

function formatWebCommandResultMessage(command, stored) {
  const cmdType = stored?.type || command?.type;
  const raw = String(stored?.message || '').trim();
  if (cmdType === 'pp_retrieve' && stored?.ok === true) {
    if (/^retrieved \d+/i.test(raw)) return raw;
    const legacy = raw.match(/^retrieved_(\d+)_remaining_\d+$/i);
    if (legacy) {
      const count = Number(legacy[1]);
      return count === 1 ? 'Retrieved 1 crate' : `Retrieved ${count} crates`;
    }
    const pp = productionPoints.find((entry) => entry.id === command?.production_point_id);
    const qty = clampRetrieveQuantity(command?.quantity, pp?.stock);
    if (qty > 0) {
      return qty === 1 ? 'Retrieved 1 crate' : `Retrieved ${qty} crates`;
    }
  }
  return raw;
}

function buildWebCommandFeedEvent(command, stored) {
  if (!command || !stored) return null;

  const actor = command.requested_by || command.requested_by_id || 'Unknown user';
  const cmdType = stored.type || command.type;

  if (cmdType === 'pp_upgrade') {
    const ppName = getProductionPointDisplayName(command.production_point_id);
    const pp = productionPoints.find((entry) => entry.id === command.production_point_id);
    const level = pp ? Number(pp.level) || 0 : null;
    const nextLevel = level !== null ? level + 1 : null;
    const levelHint = nextLevel !== null ? ` (Lv${level} -> Lv${nextLevel})` : '';

    if (stored.ok) {
      return {
        type: 'dcore.pp_upgrade.started',
        title: 'Production Point upgrade',
        message: `${actor} started upgrade at ${ppName}${levelHint}`,
        actor: command.requested_by_id || '',
        metadata: {
          command_id: stored.id,
          production_point_id: command.production_point_id,
          airport_id: null,
          keyword: null,
          quantity: null,
          spawn_type: null,
          ok: true,
        },
      };
    }

    return {
      type: 'dcore.pp_upgrade.failed',
      title: 'Production Point upgrade failed',
      message: `${actor} could not upgrade ${ppName}: ${stored.message || 'unknown error'}`,
      actor: command.requested_by_id || '',
      metadata: {
        command_id: stored.id,
        production_point_id: command.production_point_id,
        airport_id: null,
        keyword: null,
        quantity: null,
        spawn_type: null,
        ok: false,
      },
    };
  }

  if (cmdType === 'pp_retrieve') {
    const ppName = getProductionPointDisplayName(command.production_point_id);
    const pp = productionPoints.find((entry) => entry.id === command.production_point_id);
    const qty = clampRetrieveQuantity(command.quantity, pp?.stock);
    const qtyLabel = qty > 1 ? `${qty}x ` : '';

    if (stored.ok) {
      return {
        type: 'dcore.pp_retrieve.completed',
        title: 'Production Point retrieve',
        message: `${actor} retrieved ${qtyLabel}crates from ${ppName}`,
        actor: command.requested_by_id || '',
        metadata: {
          command_id: stored.id,
          production_point_id: command.production_point_id,
          airport_id: null,
          keyword: null,
          quantity: qty,
          spawn_type: null,
          ok: true,
        },
      };
    }

    return {
      type: 'dcore.pp_retrieve.failed',
      title: 'Production Point retrieve failed',
      message: `${actor} could not retrieve crates from ${ppName}: ${stored.message || 'unknown error'}`,
      actor: command.requested_by_id || '',
      metadata: {
        command_id: stored.id,
        production_point_id: command.production_point_id,
        airport_id: null,
        keyword: null,
        quantity: qty,
        spawn_type: null,
        ok: false,
      },
    };
  }

  if (cmdType === 'dbuild_confirm') {
    const buildType = command.build_type || command.keyword;
    const catalog = getDbuildCatalogEntry(buildType);
    const label = catalog?.label || buildType || 'build';

    if (stored.ok) {
      return {
        type: 'dcore.dbuild.confirmed',
        title: 'DBUILD placement confirmed',
        message: `${actor} confirmed ${label} construction on the map`,
        actor: command.requested_by_id || '',
        metadata: {
          command_id: stored.id,
          build_type: buildType,
          placement_id: command.placement_id || null,
          ok: true,
        },
      };
    }

    return {
      type: 'dcore.dbuild.failed',
      title: 'DBUILD placement failed',
      message: `${actor} could not confirm ${label}: ${stored.message || 'unknown error'}`,
      actor: command.requested_by_id || '',
      metadata: {
        command_id: stored.id,
        build_type: buildType,
        placement_id: command.placement_id || null,
        ok: false,
      },
    };
  }

  if (cmdType === 'tanker_spawn') {
    const keyword = formatSpawnKeywordLabel(command.keyword);
    if (stored.ok) {
      return {
        type: 'dcore.tanker.completed',
        title: 'Tanker spawned',
        message: `${actor} spawned ${keyword} tanker on the map`,
        actor: command.requested_by_id || '',
        metadata: {
          command_id: stored.id,
          keyword: command.keyword,
          ok: true,
        },
      };
    }

    return {
      type: 'dcore.tanker.failed',
      title: 'Tanker spawn failed',
      message: `${actor} failed to spawn ${keyword} tanker: ${stored.message || 'unknown error'}`,
      actor: command.requested_by_id || '',
      metadata: {
        command_id: stored.id,
        keyword: command.keyword,
        ok: false,
      },
    };
  }

  if (WEB_MAP_ACTION_TYPES.includes(cmdType)) {
    const keyword = formatSpawnKeywordLabel(command.keyword);
    if (stored.ok) {
      return {
        type: 'dcore.map_action.completed',
        title: 'Map action completed',
        message: `${actor} placed ${keyword} on the map`,
        actor: command.requested_by_id || '',
        metadata: {
          command_id: stored.id,
          keyword: command.keyword,
          spawn_type: cmdType,
          ok: true,
        },
      };
    }

    return {
      type: 'dcore.map_action.failed',
      title: 'Map action failed',
      message: `${actor} failed to place ${keyword}: ${stored.message || 'unknown error'}`,
      actor: command.requested_by_id || '',
      metadata: {
        command_id: stored.id,
        keyword: command.keyword,
        spawn_type: cmdType,
        ok: false,
      },
    };
  }

  if (cmdType === 'inf_spawn' || cmdType === 'crate_spawn') {
    const airportName = getAirportDisplayName(command.airport_id);
    const keyword = formatSpawnKeywordLabel(command.keyword);
    const qty = clampSpawnQuantity(command.quantity);
    const qtyLabel = qty > 1 ? `${qty}x ` : '';

    if (stored.ok) {
      return {
        type: 'dcore.spawn.completed',
        title: 'Spawn completed',
        message: `${actor} placed ${qtyLabel}${keyword} at ${airportName}`,
        actor: command.requested_by_id || '',
        metadata: {
          command_id: stored.id,
          production_point_id: null,
          airport_id: command.airport_id,
          keyword: command.keyword,
          quantity: qty,
          spawn_type: cmdType,
          ok: true,
        },
      };
    }

    return {
      type: 'dcore.spawn.failed',
      title: 'Spawn failed',
      message: `${actor} failed to place ${qtyLabel}${keyword} at ${airportName}: ${stored.message || 'unknown error'}`,
      actor: command.requested_by_id || '',
      metadata: {
        command_id: stored.id,
        production_point_id: null,
        airport_id: command.airport_id,
        keyword: command.keyword,
        quantity: qty,
        spawn_type: cmdType,
        ok: false,
      },
    };
  }

  return null;
}

function maybePushWebCommandFeedEvent(command, stored) {
  if (!command || !stored?.id) return;
  const cmdType = stored.type || command.type;
  if (!['pp_upgrade', 'pp_retrieve', 'inf_spawn', 'crate_spawn', 'dbuild_confirm', 'tanker_spawn', ...WEB_MAP_ACTION_TYPES].includes(cmdType)) return;
  if (webCommandFeedEmittedIds.has(stored.id)) return;

  const event = buildWebCommandFeedEvent(command, stored);
  if (!event) return;

  pushFeedEvent({
    id: `webcmd_${stored.id}`,
    ...event,
  });
  webCommandFeedEmittedIds.add(stored.id);
}

function buildMissionSummary(mission) {
  if (!mission) {
    return {
      sourceName: 'Unknown',
      destinationName: 'Unknown',
      orderCount: 0,
    };
  }

  return {
    sourceName: getAirportDisplayName(mission.source_airport_id),
    destinationName: getAirportDisplayName(mission.airport_id),
    orderCount: Array.isArray(mission.orders) ? mission.orders.length : 0,
  };
}

function normalizeConvoyEntry(entry) {
  const normalizeEpochMs = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
  };

  const toPosition = (latValue, lonValue) => {
    const lat = Number(latValue);
    const lon = Number(lonValue);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  };
  const parsePosition = (rawPos, latField, lonField) => {
    const objPos = (rawPos && typeof rawPos === 'object')
      ? toPosition(rawPos.lat, rawPos.lon)
      : null;
    if (objPos) return objPos;
    return toPosition(latField, lonField);
  };

  const lastEvent = String(entry?.last_event || '').trim().toLowerCase();
  let status = String(entry?.status || 'active').trim().toLowerCase();
  if (lastEvent === 'arrived') status = 'arrived';
  if (lastEvent === 'destroyed') status = 'destroyed';

  const eventAt = normalizeEpochMs(entry?.event_at) ?? Date.now();
  const positionAt = normalizeEpochMs(entry?.position_at);
  const lastPosition = toPosition(entry?.position_lat, entry?.position_lon);
  const originPosition = parsePosition(
    entry?.origin_position,
    entry?.origin_position_lat ?? entry?.origin_lat,
    entry?.origin_position_lon ?? entry?.origin_lon
  );
  const destinationPosition = parsePosition(
    entry?.destination_position,
    entry?.destination_position_lat ?? entry?.destination_lat,
    entry?.destination_position_lon ?? entry?.destination_lon
  );
  const lastUpdate = positionAt ?? eventAt;

  return {
    convoy_id: String(entry?.convoy_id || '').trim(),
    origin_zone: String(entry?.origin_zone || '').trim() || null,
    destination_zone: String(entry?.destination_zone || '').trim() || null,
    status,
    last_event: lastEvent,
    event_at: eventAt,
    feed_message: String(entry?.feed_message || '').trim(),
    origin_position: originPosition,
    destination_position: destinationPosition,
    last_position: lastPosition,
    position_at: positionAt,
    last_update: lastUpdate,
  };
}

function syncConvoysFromFile() {
  try {
    if (!CONVOY_SYNC_FILE || !fs.existsSync(CONVOY_SYNC_FILE)) {
      return;
    }

    const raw = fs.readFileSync(CONVOY_SYNC_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === convoySyncSignature) return;

    convoySyncSignature = raw;
    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.convoys) ? parsed.convoys : [];
    const normalized = incoming.map(normalizeConvoyEntry).filter((entry) => entry.convoy_id !== '');

    convoysService.replaceConvoys(normalized);

    const nextEventMap = new Map();
    normalized.forEach((convoy) => {
      const prev = convoyEventById.get(convoy.convoy_id);
      const nextKey = `${convoy.last_event}:${convoy.event_at}`;
      nextEventMap.set(convoy.convoy_id, nextKey);

      const shouldEmitFeed = !prev || prev !== nextKey;
      if (!shouldEmitFeed) return;

      if (convoy.last_event === 'arrived') {
        pushFeedEvent({
          type: 'convoy.arrived',
          title: 'Convoy event',
          message: convoy.feed_message || `Enemy convoy reached zone: ${convoy.destination_zone || 'unknown'}`,
          metadata: {
            convoy_id: convoy.convoy_id,
            origin_zone: convoy.origin_zone,
            destination_zone: convoy.destination_zone,
          },
        });
      } else if (convoy.last_event === 'destroyed') {
        pushFeedEvent({
          type: 'convoy.destroyed',
          title: 'Convoy event',
          message: convoy.feed_message || 'Enemy convoy destroyed',
          metadata: {
            convoy_id: convoy.convoy_id,
            origin_zone: convoy.origin_zone,
            destination_zone: convoy.destination_zone,
          },
        });
      }
    });
    convoyEventById = nextEventMap;

    io.emit('convoys:updated', {
      convoys: convoysService.getConvoys(),
    });
  } catch (error) {
    console.error('Failed convoy sync from file:', error.message);
  }
}

function parseDcsarLine(line, index) {
  const cleaned = String(line || '').trim();
  if (!cleaned || cleaned.startsWith('#') || cleaned.startsWith('//')) return null;

  const nums = cleaned.match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length < 2) return null;
  const lat = Number(nums[0]);
  const lon = Number(nums[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const acceptedByMatch = cleaned.match(/accepted_by\s*=\s*([^\s|,;]+)/i);
  const statusMatch = cleaned.match(/status\s*=\s*([^\s|,;]+)/i);
  const idMatch = cleaned.match(/id\s*=\s*([^\s|,;]+)/i);
  const acceptedBy = acceptedByMatch ? String(acceptedByMatch[1] || '').trim() : '';
  const status = statusMatch ? String(statusMatch[1] || '').trim().toLowerCase() : '';
  const accepted = status === 'accepted' || acceptedBy !== '';

  return {
    id: idMatch ? String(idMatch[1] || '').trim() : `dcsar_${index + 1}`,
    lat,
    lon,
    status: status || (accepted ? 'accepted' : 'pending'),
    accepted_by: acceptedBy || null,
    accepted,
    raw: cleaned,
  };
}

function syncDcsarFromFile() {
  try {
    if (!DCSAR_SYNC_FILE || !fs.existsSync(DCSAR_SYNC_FILE)) return;

    const raw = fs.readFileSync(DCSAR_SYNC_FILE, 'utf8');
    if (raw === dcsarSyncSignature) return;
    dcsarSyncSignature = raw;

    const lines = String(raw || '').split(/\r?\n/);
    const parsed = [];
    lines.forEach((line, idx) => {
      const point = parseDcsarLine(line, idx);
      if (point) parsed.push(point);
    });
    const previousById = new Map(
      (Array.isArray(dcsarPoints) ? dcsarPoints : [])
        .filter((point) => point && point.id)
        .map((point) => [String(point.id), point])
    );

    dcsarPoints = parsed.map((incomingPoint) => {
      const pointId = String(incomingPoint?.id || '');
      const previousPoint = pointId ? previousById.get(pointId) : null;
      const previousAccepted = String(previousPoint?.status || '').toLowerCase() === 'accepted' || Boolean(previousPoint?.accepted);
      const incomingAccepted = String(incomingPoint?.status || '').toLowerCase() === 'accepted' || Boolean(incomingPoint?.accepted);

      // Keep accepted assignment sticky to avoid accidental de-assignment when
      // external file updates omit metadata or downgrade status.
      if (previousAccepted && !incomingAccepted) {
        return {
          ...incomingPoint,
          status: 'accepted',
          accepted: true,
          accepted_by: previousPoint?.accepted_by || incomingPoint?.accepted_by || null,
        };
      }

      return incomingPoint;
    });

    io.emit('dcsar:updated', {
      points: dcsarPoints,
    });
  } catch (error) {
    console.error('Failed DCSAR sync from file:', error.message);
  }
}

function normalizeAirliftPlayerEntry(entry) {
  const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const lat = toNum(entry?.lat);
  const lon = toNum(entry?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return {
    id: String(entry?.id || '').trim() || null,
    name: String(entry?.name || '').trim() || 'Unknown',
    unit_name: String(entry?.unit_name || '').trim() || null,
    group_name: String(entry?.group_name || '').trim() || null,
    coalition: String(entry?.coalition || '').trim().toLowerCase() || null,
    type_name: String(entry?.type_name || '').trim() || null,
    airframe: String(entry?.airframe || '').trim() || null,
    lat,
    lon,
    alt_m: toNum(entry?.alt_m),
    heading_deg: toNum(entry?.heading_deg),
  };
}

function syncAirliftPlayersFromFile() {
  try {
    if (!AIRLIFT_PLAYERS_SYNC_FILE || !fs.existsSync(AIRLIFT_PLAYERS_SYNC_FILE)) return;

    const raw = fs.readFileSync(AIRLIFT_PLAYERS_SYNC_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === airliftPlayersSyncSignature) return;
    airliftPlayersSyncSignature = raw;

    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.players) ? parsed.players : [];
    const normalized = incoming
      .map(normalizeAirliftPlayerEntry)
      .filter(Boolean);

    airliftPlayers = normalized;

    io.emit('airlift-players:updated', {
      players: airliftPlayers,
    });
  } catch (error) {
    console.error('Failed airlift players sync from file:', error.message);
  }
}

// ==================== PRODUCTION POINTS (DCORE -> web) ====================

function normalizeProductionPointEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const zoneName = String(entry.zone_name || '').trim();
  if (!zoneName) return null;
  const lat = toNum(entry.lat);
  const lon = toNum(entry.lon);

  return {
    id: zoneName,
    zone_name: zoneName,
    coordinates: (lat !== null && lon !== null) ? { lat, lon } : null,
    radius_m: toNum(entry.radius_m),
    owner: String(entry.owner || 'NEUTRAL').trim().toUpperCase(),
    built: entry.built === true,
    level: Math.max(0, Math.floor(toNum(entry.level) || 0)),
    max_level: Math.max(1, Math.floor(toNum(entry.max_level) || 1)),
    upgrading: entry.upgrading === true,
    blue_units: Math.max(0, Math.floor(toNum(entry.blue_units) || 0)),
    red_units: Math.max(0, Math.floor(toNum(entry.red_units) || 0)),
    build_counts: (entry.build_counts && typeof entry.build_counts === 'object') ? entry.build_counts : {},
    required_categories: (entry.required_categories && typeof entry.required_categories === 'object') ? entry.required_categories : {},
    stock: Math.max(0, Math.floor(toNum(entry.stock) || 0)),
    max_stock: Math.max(0, Math.floor(toNum(entry.max_stock) || 0)),
  };
}

function syncProductionPointsFromFile() {
  try {
    if (!PRODUCTION_POINTS_FILE || !fs.existsSync(PRODUCTION_POINTS_FILE)) return;

    const raw = fs.readFileSync(PRODUCTION_POINTS_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === productionPointsSyncSignature) return;
    productionPointsSyncSignature = raw;

    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.production_points) ? parsed.production_points : []);
    productionPoints = incoming.map(normalizeProductionPointEntry).filter(Boolean);

    io.emit('production-points:updated', {
      productionPoints,
    });
  } catch (error) {
    console.error('Failed production points sync from file:', error.message);
  }
}

// ==================== WEB COMMAND BRIDGE (web -> DCORE) ====================

function writeJsonAtomic(targetPath, obj) {
  const tempPath = `${targetPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tempPath, targetPath);
}

function persistWebCommands() {
  if (!WEB_COMMANDS_FILE) return;
  try {
    writeJsonAtomic(WEB_COMMANDS_FILE, {
      commands: webCommands,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to persist web commands queue:', error.message);
    throw error;
  }
}

function loadWebCommandsQueue() {
  try {
    if (!WEB_COMMANDS_FILE) {
      webCommands = [];
      return;
    }
    if (!fs.existsSync(WEB_COMMANDS_FILE)) {
      webCommands = [];
      persistWebCommands();
      return;
    }
    const raw = fs.readFileSync(WEB_COMMANDS_FILE, 'utf8');
    const parsed = raw && raw.trim() !== '' ? JSON.parse(raw) : {};
    const list = Array.isArray(parsed?.commands) ? parsed.commands : (Array.isArray(parsed) ? parsed : []);
    webCommands = list.filter((cmd) => cmd && typeof cmd === 'object' && cmd.id);
  } catch (error) {
    console.error('Error loading web commands queue:', error.message);
    webCommands = [];
  }
}

function pruneWebCommands(now = Date.now()) {
  const before = webCommands.length;
  webCommands = webCommands.filter((cmd) => {
    const ts = Number(cmd?.ts) || 0;
    if (now - ts > WEB_COMMAND_TTL_MS) return false;
    const result = webCommandResultsById.get(cmd.id);
    if (result && now - (Number(result._localTs) || now) > WEB_COMMAND_RESULT_GRACE_MS) return false;
    return true;
  });
  return webCommands.length !== before;
}

function enqueueWebCommand(command) {
  pruneWebCommands();
  webCommands.push(command);
  persistWebCommands();
  return command;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const earthRadiusM = 6371008.8;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusM * c;
}

function haversineNm(lat1, lon1, lat2, lon2) {
  return haversineMeters(lat1, lon1, lat2, lon2) / 1852;
}

function validateTankerWaypointDistance(wp1Lat, wp1Lon, wp2Lat, wp2Lon, minDistNm = TANKER_MIN_DIST_NM) {
  const distanceNm = haversineNm(wp1Lat, wp1Lon, wp2Lat, wp2Lon);
  if (distanceNm < minDistNm) {
    return {
      ok: false,
      error: `WP2 too close: minimum distance is ${minDistNm} NM (current ${distanceNm.toFixed(1)} NM)`,
      distanceNm,
    };
  }
  return { ok: true, distanceNm };
}

function clampSpawnQuantity(raw) {
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(SPAWN_QUANTITY_MAX, parsed);
}

function clampRetrieveQuantity(raw, maxStock) {
  const max = Math.max(1, Math.floor(Number(maxStock)) || 1);
  const parsed = Math.floor(Number(raw));
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(max, parsed);
}

function offsetLatLon(lat, lon, distanceM, bearingDeg) {
  const earthRadiusM = 6371008.8;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const angularDistance = distanceM / earthRadiusM;
  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance)
    + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const lon2 = lonRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
  );
  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
  };
}

function buildSpawnPlacementPositions(lat, lon, quantity) {
  const qty = clampSpawnQuantity(quantity);
  const positions = [];
  for (let index = 0; index < qty; index += 1) {
    positions.push(
      index === 0
        ? { lat, lon }
        : offsetLatLon(lat, lon, SPAWN_OFFSET_METERS * index, SPAWN_OFFSET_BEARING_DEG)
    );
  }
  return positions;
}

function validateAirportSpawnDistance(airport, lat, lon) {
  const airportLat = Number(airport?.coordinates?.lat);
  const airportLon = Number(airport?.coordinates?.lon);
  if (!Number.isFinite(airportLat) || !Number.isFinite(airportLon)) {
    return { ok: false, error: 'Airport coordinates missing' };
  }
  const distanceM = haversineMeters(airportLat, airportLon, lat, lon);
  if (distanceM > AIRPORT_SPAWN_RADIUS_M) {
    return {
      ok: false,
      error: `Placement must be within ${AIRPORT_SPAWN_RADIUS_M / 1000} km of the airport center (${Math.round(distanceM)} m away).`,
    };
  }
  return { ok: true, distanceM };
}

function validateProductionPointRetrieveDistance(pp, lat, lon) {
  const ppLat = Number(pp?.coordinates?.lat);
  const ppLon = Number(pp?.coordinates?.lon);
  if (!Number.isFinite(ppLat) || !Number.isFinite(ppLon)) {
    return { ok: false, error: 'Production point coordinates missing' };
  }
  const distanceM = haversineMeters(ppLat, ppLon, lat, lon);
  if (distanceM > PP_RETRIEVE_RADIUS_M) {
    return {
      ok: false,
      error: `Placement must be within ${PP_RETRIEVE_RADIUS_M} m of the production point center (${Math.round(distanceM)} m away).`,
    };
  }
  return { ok: true, distanceM };
}

function syncDbuildSitesFromFile() {
  try {
    if (!DBUILD_SITES_FILE || !fs.existsSync(DBUILD_SITES_FILE)) return;

    const raw = fs.readFileSync(DBUILD_SITES_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === dbuildSitesSyncSignature) return;
    dbuildSitesSyncSignature = raw;

    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.sites) ? parsed.sites : [];
    dbuildSites = incoming
      .map((entry) => {
        const lat = Number(entry?.lat);
        const lon = Number(entry?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          type: String(entry?.type || '').trim().toLowerCase() || null,
          site_id: String(entry?.site_id || '').trim() || null,
          lat,
          lon,
          built: entry?.built === true,
          category_counts: entry?.category_counts && typeof entry.category_counts === 'object' ? entry.category_counts : {},
          required_categories: entry?.required_categories && typeof entry.required_categories === 'object' ? entry.required_categories : {},
          crate_count: Number(entry?.crate_count) || 0,
          required_crates: Number(entry?.required_crates) || 0,
          structure_name: entry?.structure_name ? String(entry.structure_name) : null,
        };
      })
      .filter((entry) => entry && entry.type);

    io.emit('dbuild-sites:updated', {
      sites: dbuildSites,
      placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
    });
  } catch (error) {
    console.error('Failed DBUILD sites sync from file:', error.message);
  }
}

function syncWebSpawnMarkersFromFile() {
  try {
    if (!WEB_SPAWN_MARKERS_FILE || !fs.existsSync(WEB_SPAWN_MARKERS_FILE)) return;

    const raw = fs.readFileSync(WEB_SPAWN_MARKERS_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === webSpawnMarkersSyncSignature) return;
    webSpawnMarkersSyncSignature = raw;

    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.markers) ? parsed.markers : [];
    webSpawnMarkers = incoming
      .map((entry) => {
        const lat = Number(entry?.lat);
        const lon = Number(entry?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          id: String(entry?.id || '').trim() || null,
          keyword: String(entry?.keyword || '').trim().toUpperCase() || null,
          label: String(entry?.label || '').trim() || null,
          lat,
          lon,
        };
      })
      .filter((entry) => entry && entry.id);

    io.emit('web-spawn-markers:updated', {
      markers: webSpawnMarkers,
    });
  } catch (error) {
    console.error('Failed web spawn markers sync from file:', error.message);
  }
}

function syncTankerRoutesFromFile() {
  try {
    if (!TANKER_ROUTES_FILE || !fs.existsSync(TANKER_ROUTES_FILE)) return;

    const raw = fs.readFileSync(TANKER_ROUTES_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;

    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.routes) ? parsed.routes : [];
    const nextRoutes = incoming
      .map((entry) => {
        const wp1Lat = Number(entry?.wp1?.lat ?? entry?.wp1_lat);
        const wp1Lon = Number(entry?.wp1?.lon ?? entry?.wp1_lon);
        const wp2Lat = Number(entry?.wp2?.lat ?? entry?.wp2_lat);
        const wp2Lon = Number(entry?.wp2?.lon ?? entry?.wp2_lon);
        if (![wp1Lat, wp1Lon, wp2Lat, wp2Lon].every(Number.isFinite)) return null;
        return {
          id: String(entry?.id || entry?.keyword || '').trim() || null,
          keyword: String(entry?.keyword || '').trim().toUpperCase() || null,
          label: String(entry?.label || '').trim() || null,
          platform: String(entry?.platform || '').trim() || null,
          tacan: String(entry?.tacan || '').trim() || null,
          freq_mhz: Number.isFinite(Number(entry?.freq_mhz)) ? Number(entry.freq_mhz) : null,
          altitude_ft: Number.isFinite(Number(entry?.altitude_ft)) ? Number(entry.altitude_ft) : null,
          speed_kt: Number.isFinite(Number(entry?.speed_kt)) ? Number(entry.speed_kt) : null,
          distance_nm: Number.isFinite(Number(entry?.distance_nm)) ? Number(entry.distance_nm) : null,
          heading_deg: Number.isFinite(Number(entry?.heading_deg)) ? Number(entry.heading_deg) : null,
          wp1: { lat: wp1Lat, lon: wp1Lon },
          wp2: { lat: wp2Lat, lon: wp2Lon },
        };
      })
      .filter((entry) => entry && entry.id);

    const serialized = JSON.stringify(nextRoutes);
    const prevSerialized = JSON.stringify(tankerRoutes);
    if (raw === tankerRoutesSyncSignature && serialized === prevSerialized) return;

    tankerRoutesSyncSignature = raw;
    tankerRoutes = nextRoutes;

    io.emit('tanker-routes:updated', {
      routes: tankerRoutes,
    });
  } catch (error) {
    console.error('Failed tanker routes sync from file:', error.message);
  }
}

let lidcLinkRequestsSignature = '';

let lidcWarehouseOpsAckSignature = '';

let lidcAirframeStateSignature = '';

function syncLidcAirframeStateFromFile() {
  try {
    const stateFile = LIDC_EXPORT_FILES.airframeState;
    if (!stateFile || !fs.existsSync(stateFile)) return;

    const raw = fs.readFileSync(stateFile, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === lidcAirframeStateSignature) return;
    lidcAirframeStateSignature = raw;

    const parsed = JSON.parse(raw);
    const incoming = Array.isArray(parsed?.airframes) ? parsed.airframes : [];
    const result = lidcService.applyAirframeStateFromDcs(incoming);
    if (result.updated > 0) {
      io.emit('lidc:updated', {
        updatedAirframes: result.updated,
      });
    }
  } catch (error) {
    console.error('Failed LIDC airframe state sync from file:', error.message);
  }
}

function syncLidcWarehouseOpsAckFromFile() {
  try {
    const ackFile = LIDC_EXPORT_FILES.warehouseOpsAck;
    if (!ackFile || !fs.existsSync(ackFile)) return;

    const raw = fs.readFileSync(ackFile, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === lidcWarehouseOpsAckSignature) return;
    lidcWarehouseOpsAckSignature = raw;

    const parsed = JSON.parse(raw);
    const appliedOpIds = Array.isArray(parsed?.appliedOpIds) ? parsed.appliedOpIds : [];
    const result = processWarehouseOpsAck(appliedOpIds);
    if (result.applied > 0) {
      io.emit('lidc:warehouse-ops-updated', { applied: result.applied });
    }
  } catch (error) {
    console.error('Failed LIDC warehouse ops ack sync from file:', error.message);
  }
}

function syncLidcLinkRequestsFromFile() {
  try {
    const linkRequestsFile = LIDC_EXPORT_FILES.linkRequests;
    if (!linkRequestsFile || !fs.existsSync(linkRequestsFile)) return;

    const raw = fs.readFileSync(linkRequestsFile, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === lidcLinkRequestsSignature) return;
    lidcLinkRequestsSignature = raw;

    let requests = [];
    const trimmed = raw.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        requests = parsed;
      } else if (Array.isArray(parsed?.requests)) {
        requests = parsed.requests;
      }
    } else {
      requests = trimmed.split(/\r?\n/).map((line) => {
        const parts = line.split('|');
        if (parts.length < 2) return null;
        return {
          code: parts[0],
          ucid: parts[1],
          name: parts[2] || '',
          at: Number(parts[3]) || Date.now(),
        };
      }).filter(Boolean);
    }

    if (requests.length === 0) return;

    const result = lidcService.processUcidLinkRequests(requests);
    if (result.linked.length > 0) {
      result.linked.forEach((entry) => {
        io.emit('lidc:linked', entry);
      });
      fs.writeFileSync(linkRequestsFile, '', 'utf8');
      lidcLinkRequestsSignature = '';
    }
  } catch (error) {
    console.error('Failed LIDC link requests sync from file:', error.message);
  }
}

function syncWebCommandResultsFromFile() {
  try {
    if (!WEB_COMMANDS_RESULT_FILE || !fs.existsSync(WEB_COMMANDS_RESULT_FILE)) return;

    const raw = fs.readFileSync(WEB_COMMANDS_RESULT_FILE, 'utf8');
    if (!raw || raw.trim() === '') return;
    if (raw === webCommandResultSignature) {
      // Still prune in case TTL elapsed without new results
      if (pruneWebCommands()) {
        try { persistWebCommands(); } catch (_) { /* ignore */ }
      }
      return;
    }
    webCommandResultSignature = raw;

    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed?.results) ? parsed.results : (Array.isArray(parsed) ? parsed : []);
    const now = Date.now();

    list.forEach((result) => {
      const id = result && result.id ? String(result.id) : null;
      if (!id) return;
      const previous = webCommandResultsById.get(id);
      const signature = `${result.ok}:${result.message}:${result.balance}:${result.ts}`;
      const prevSignature = previous ? `${previous.ok}:${previous.message}:${previous.balance}:${previous.ts}` : null;
      if (signature === prevSignature) return;

      const stored = {
        id,
        type: String(result.type || ''),
        ok: result.ok === true,
        message: String(result.message || ''),
        balance: Number(result.balance) || 0,
        ts: Number(result.ts) || 0,
        _localTs: now,
      };
      webCommandResultsById.set(id, stored);

      const command = webCommands.find((cmd) => cmd.id === id) || null;
      const emitType = stored.type || (command ? command.type : '');
      io.emit('web-command:result', {
        id,
        type: emitType,
        ok: stored.ok,
        message: formatWebCommandResultMessage(command, { ...stored, type: emitType }),
        balance: (emitType === 'pp_retrieve' || emitType === 'pp_upgrade') ? null : stored.balance,
        keyword: command ? command.keyword : null,
        quantity: command && emitType === 'pp_retrieve' ? command.quantity : null,
        requested_by_id: command ? command.requested_by_id : null,
        production_point_id: command && (command.type === 'pp_upgrade' || command.type === 'pp_retrieve')
          ? command.production_point_id
          : null,
        airport_id: command ? command.airport_id : null,
      });

      if (command) {
        maybePushWebCommandFeedEvent(command, stored);
        if (command.type === 'dbuild_confirm' && command.placement_id) {
          if (!stored.ok) {
            dbuildPlacementsService.updatePlacement(command.placement_id, {
              status: 'failed',
              error: stored.message || 'Confirmation failed in-game',
            });
          }
          io.emit('dbuild-placements:updated', {
            placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
            sites: dbuildSites,
          });
        }
      }
    });

    // Drop stored results whose command is gone (avoid unbounded growth)
    const liveIds = new Set(webCommands.map((cmd) => cmd.id));
    for (const id of webCommandResultsById.keys()) {
      const stored = webCommandResultsById.get(id);
      if (!liveIds.has(id) && now - (Number(stored?._localTs) || now) > WEB_COMMAND_RESULT_GRACE_MS) {
        webCommandResultsById.delete(id);
      }
    }

    if (pruneWebCommands(now)) {
      try { persistWebCommands(); } catch (_) { /* ignore */ }
    }
  } catch (error) {
    console.error('Failed web command results sync from file:', error.message);
  }
}

function persistDcsarToFile(points) {
  const lines = (Array.isArray(points) ? points : [])
    .map((point, index) => {
      const lat = Number(point?.lat);
      const lon = Number(point?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
      const id = String(point?.id || `dcsar_${index + 1}`).trim();
      const status = String(point?.status || 'pending').trim().toLowerCase() === 'accepted' ? 'accepted' : 'pending';
      const acceptedBy = point?.accepted_by ? String(point.accepted_by).trim() : '';
      const meta = [
        `id=${id}`,
        `status=${status}`,
        acceptedBy ? `accepted_by=${acceptedBy.replace(/\s+/g, '_')}` : null,
      ].filter(Boolean).join(' ');
      return `${lat.toFixed(6)},${lon.toFixed(6)} ${meta}`.trim();
    })
    .filter(Boolean);

  if (!DCSAR_SYNC_FILE) return;
  fs.writeFileSync(DCSAR_SYNC_FILE, `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`, 'utf8');
  dcsarSyncSignature = fs.readFileSync(DCSAR_SYNC_FILE, 'utf8');
}

/**
 * Load airbase status from airbase_status.lua file
 */
function loadAirbaseStatus() {
  try {
    if (!AIRBASE_STATUS_FILE) {
      airbaseStatus = {};
      airbaseStatusManager.updateAirbaseStatus({});
      return;
    }
    airbaseStatus = airbaseStatusParser.parseAirbaseStatus(AIRBASE_STATUS_FILE);
    console.log(`🏠 Airbase status loaded: ${Object.keys(airbaseStatus).length} airbases`);

    // Update the airbase status manager (used by missionGenerator)
    airbaseStatusManager.updateAirbaseStatus(airbaseStatus);

    // Broadcast updated status to all connected clients
    io.emit('airbase:status', airbaseStatus);

    if (currentData && Object.keys(currentData).length > 0) {
      processData(currentData);
      io.emit('data:updated', currentData);
    }
  } catch (error) {
    console.error('❌ Error loading airbase status:', error.message);
    airbaseStatus = {}; // Reset to empty if error
    airbaseStatusManager.updateAirbaseStatus({});
  }
}

/**
 * Load all airport data
 */
function processData(data) {
  const airportDataMap = data?.data || data;

  if (!airportDataMap) {
    console.warn('⚠️  No data available to process.');
    return currentData;
  }

  // Include coalition-active airports from config even when CSV/buffer data is missing.
  airbaseStatusManager.getActiveAirports().forEach((airportConfig) => {
    if (airportDataMap[airportConfig.id]) return;

    airportDataMap[airportConfig.id] = {
      ...airportConfig,
      data: {
        weapons: [],
        liquids: [],
        timestamp: Date.now(),
      },
    };
  });

  // Add isActive field to each airport based on airbase status
  Object.entries(airportDataMap).forEach(([airportId, airportData]) => {
    // Keep static airport metadata aligned with config,
    // even when data is loaded from an old buffer snapshot.
    const airportConfig = getAirportById(airportId);
    if (airportConfig) {
      airportData.name = airportConfig.name;
      airportData.displayName = airportConfig.displayName;
      airportData.icao = airportConfig.icao;
      airportData.isMainBase = Boolean(airportConfig.isMainBase);
      airportData.isHeliport = Boolean(airportConfig.isHeliport);
      airportData.isCarrier = Boolean(airportConfig.isCarrier);
      airportData.isAlwaysActive = Boolean(airportConfig.isAlwaysActive);
      airportData.herculesBase = Boolean(airportConfig.herculesBase);
      airportData.csvPrefix = airportConfig.csvPrefix || '';
      if (airportConfig.coordinates) {
        airportData.coordinates = airportConfig.coordinates;
      }
    }

    airportData.isActive = airbaseStatusManager.isAirportActive(airportData);

    if (airportData.data && airportData.data.weapons) {
      historicalData.saveSnapshot(airportId, airportData.data);

      // Check and generate missions (with donor selection)
      const newMissions = missionGenerator.checkAndGenerateMissions(
        airportId,
        airportData.data.weapons,
        airportDataMap // Pass all airports data for donor selection
      );

      if (newMissions.length > 0) {
        console.log(`🚨 Generated ${newMissions.length} new missions for ${airportData.name}`);
        // Broadcast new missions to all clients
        io.emit('missions:updated', {
          missions: historicalData.getActiveMissions()
        });
      }
    }
  });

  currentData = airportDataMap;
  return currentData;
}

async function loadFromBuffer() {
  const bufferedData = dataBuffer.readBuffer(BUFFER_FILE_PATH);

  if (bufferedData) {
    const bufferedEntries = Object.keys(bufferedData || {}).length;
    if (bufferedEntries > 0) {
    console.log(`📂 Loaded airport data from SQLite CSV buffer (${bufferedEntries} airports).`);
      return processData(bufferedData);
    }

    console.warn('⚠️  CSV buffer is empty. Loading directly from CSV.');
    return refreshDataFromCsv('buffer-empty');
  }

  console.warn('⚠️  CSV buffer missing. Loading directly from CSV.');
  return refreshDataFromCsv('buffer-missing');
}

async function executeRefresh(reason = 'manual') {
  dataRefreshInProgress = true;
  try {
    console.log(`📊 Loading airport data from CSV (${reason})...`);
    // Get only active airports for data loading
    const activeAirports = airbaseStatusManager.getActiveAirports();
    console.log(`   Loading data for ${activeAirports.length} active airports`);

    const data = await dataBuffer.syncFromCsv(activeAirports, CSV_DIR, BUFFER_FILE_PATH);
    processData(data);
    io.emit('data:updated', currentData);
    return currentData;
  } catch (error) {
    console.error('Error refreshing data from CSV:', error.message);
    return currentData;
  } finally {
    dataRefreshInProgress = false;
    if (refreshQueued) {
      refreshQueued = false;
      return refreshDataFromCsv('queued');
    }
  }
}

function refreshDataFromCsv(reason = 'manual') {
  if (dataRefreshInProgress) {
    if (!refreshQueued) {
      refreshQueued = true;
      console.log('🔁 Refresh in progress, queueing another run.');
    } else {
      console.log('⏭️  Refresh already queued; ignoring additional trigger.');
    }
    return refreshPromise;
  }

  refreshPromise = executeRefresh(reason);
  return refreshPromise;
}

function scheduleRefresh(reason = 'scheduled') {
  pendingRefreshReason = reason;
  if (refreshTimer) {
    return;
  }

  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    const reasonToUse = pendingRefreshReason || reason;
    pendingRefreshReason = null;
    refreshDataFromCsv(reasonToUse).catch((error) => {
      logger.error('Scheduled refresh failed:', error);
    });
  }, REFRESH_DEBOUNCE_MS);
}

// ==================== API ROUTES ====================

// ==================== DISCORD OAUTH ROUTES ====================

/**
 * GET /api/auth/discord - Initiate Discord OAuth flow
 */
app.get('/api/auth/discord', (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/discord/callback`;

  if (!clientId) {
    return res.status(500).json({ error: 'Discord OAuth not configured' });
  }

  // Generate random state for CSRF protection
  const state = Math.random().toString(36).substring(7);
  req.session.oauthState = state;

  const authUrl = discordAuth.getDiscordAuthURL(clientId, redirectUri, state);
  res.redirect(authUrl);
});

/**
 * GET /api/auth/discord/callback - Discord OAuth callback
 */
app.get('/api/auth/discord/callback', async (req, res) => {
  const { code, state } = req.query;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI || `${process.env.BACKEND_URL || 'http://localhost:3001'}/api/auth/discord/callback`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  // Verify state to prevent CSRF
  if (!state || state !== req.session.oauthState) {
    return res.redirect(`${frontendUrl}?error=invalid_state`);
  }

  if (!code) {
    return res.redirect(`${frontendUrl}?error=no_code`);
  }

  if (!clientId || !clientSecret) {
    return res.redirect(`${frontendUrl}?error=oauth_not_configured`);
  }

  try {
    // Exchange code for access token
    const tokenData = await discordAuth.exchangeCode(code, clientId, clientSecret, redirectUri);

    // Get user info
    const discordUser = await discordAuth.getDiscordUser(tokenData.access_token);

    // Store user in session
    req.session.user = {
      id: discordUser.id,
      username: discordUser.username,
      discriminator: discordUser.discriminator,
      avatar: discordUser.avatar,
      globalName: discordUser.global_name || discordUser.username,
      discordRoleIds: [],
      canManageLogisticsRouteVisibility: false,
      canEditWiki: canEditWiki(discordUser.id),
      canAccessLidc: canAccessLidc(discordUser.id),
      canAccessAtc: canAccessAtc(discordUser.id),
      canManageNoe: canManageNoe(discordUser.id),
      canEditChangelog: canEditChangelog(discordUser.id),
    };

    await ensureSessionUserPermissions(req, { forceRefresh: true });
    achievementsService.rememberUser({
      userId: discordUser.id,
      name: discordUser.global_name || discordUser.username || discordUser.id,
    });
    lidcService.upsertDiscordUser({
      id: discordUser.id,
      globalName: discordUser.global_name || discordUser.username,
      username: discordUser.username,
      avatar: discordUser.avatar,
      lastSeenAt: Date.now(),
    });

    // Register user as active
    activeUsers.addActiveUser(discordUser);
    pushFeedEvent({
      type: 'user.login',
      title: 'User online',
      message: `${discordUser.global_name || discordUser.username} logged into the site`,
      actor: discordUser.global_name || discordUser.username || discordUser.id,
      metadata: {
        user_id: discordUser.id,
      },
    });

    // Store tokens for potential future use
    req.session.discordTokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000)
    };

    // Clear OAuth state
    delete req.session.oauthState;

    // Redirect to frontend
    res.redirect(`${frontendUrl}?login=success`);
  } catch (error) {
    console.error('Discord OAuth error:', error);
    res.redirect(`${frontendUrl}?error=oauth_failed`);
  }
});

/**
 * GET /api/auth/user - Get current authenticated user
 */
app.get('/api/auth/user', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await ensureSessionUserPermissions(req);
  achievementsService.rememberUser({
    userId: user?.id || req.session.user?.id,
    name: user?.globalName || user?.username || req.session.user?.id,
  });
  lidcService.upsertDiscordUser({
    id: user?.id || req.session.user?.id,
    globalName: user?.globalName || req.session.user?.globalName || req.session.user?.username,
    username: user?.username || req.session.user?.username,
    avatar: user?.avatar || req.session.user?.avatar,
    lastSeenAt: Date.now(),
  });
  res.json(user || req.session.user);
});

/**
 * POST /api/auth/logout - Logout current user
 */
app.post('/api/auth/logout', async (req, res) => {
  const logoutUser = req.session?.user;
  const tokens = req.session.discordTokens;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;

  // Revoke Discord token if available
  if (tokens && tokens.accessToken && clientId && clientSecret) {
    await discordAuth.revokeToken(tokens.accessToken, clientId, clientSecret);
  }

  // Destroy session
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to logout' });
    }
    if (logoutUser) {
      pushFeedEvent({
        type: 'user.logout',
        title: 'User offline',
        message: `${logoutUser.globalName || logoutUser.username || logoutUser.id} logged out`,
        actor: logoutUser.globalName || logoutUser.username || logoutUser.id,
        metadata: {
          user_id: logoutUser.id,
        },
      });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

/**
 * GET /api/profile - Get current user's profile
 */
app.get('/api/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  achievementsService.rememberUser({
    userId: req.session.user.id,
    name: req.session.user.globalName || req.session.user.username || req.session.user.id,
  });
  const profile = userProfiles.getProfile(req.session.user.id);
  res.json(profile);
});

/**
 * PUT /api/profile - Save current user's profile
 */
app.put('/api/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const savedProfile = userProfiles.saveProfile(req.session.user.id, req.body);
  res.json(savedProfile);
});

/**
 * GET /api/lidc/logistics-alerts
 * Open order counts per Afghanistan airbase, for theater-map attention markers.
 */
app.get('/api/lidc/logistics-alerts', (req, res) => {
  res.json(lidcService.listAirportOrderAlerts());
});

/**
 * GET /api/lidc/airports/:baseId/occupancy
 * Public theater occupancy: squadrons and airframes present at an Afghanistan airbase.
 */
app.get('/api/lidc/airports/:baseId/occupancy', (req, res) => {
  const occupancy = lidcService.getAirportOccupancy(req.params.baseId, req.session.user?.id);
  if (!occupancy) {
    return res.status(404).json({ error: 'Airport not found' });
  }

  res.json(occupancy);
});

/**
 * POST /api/lidc/airports/:baseId/logistics/purchase
 * Buy ammunition containers or crates with squadron credits.
 */
app.post('/api/lidc/airports/:baseId/logistics/purchase', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.purchaseAirportLogistics({
      baseId: req.params.baseId,
      itemId: req.body?.itemId,
      quantity: req.body?.quantity,
      items: req.body?.items,
      userId: req.session.user.id,
    });
    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to purchase logistics');
    const status = message.toLowerCase().includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

/**
 * PATCH /api/lidc/airports/:baseId/logistics/orders/:orderId
 * Accept, unaccept, complete, or edit a logistics order.
 */
app.patch('/api/lidc/airports/:baseId/logistics/orders/:orderId', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const action = req.body?.action;
    const result = action
      ? lidcService.updateAirportOrderStatus({
          baseId: req.params.baseId,
          orderId: req.params.orderId,
          action,
          userId: req.session.user.id,
        })
      : lidcService.updateAirportOrder({
          baseId: req.params.baseId,
          orderId: req.params.orderId,
          items: req.body?.items,
          userId: req.session.user.id,
        });
    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to update order');
    const status = message.toLowerCase().includes('not found')
      ? 404
      : message.toLowerCase().includes('not allowed')
        ? 403
        : 400;
    return res.status(status).json({ error: message });
  }
});

async function attachSessionPermissions(req, res, next) {
  try {
    if (req.session?.user?.id) {
      await ensureSessionUserPermissions(req);
    }
    next();
  } catch (error) {
    next(error);
  }
}

app.use('/api/lidc', attachSessionPermissions, requireFeatureFlag('canAccessLidc'));
app.use('/api/atc', attachSessionPermissions, requireFeatureFlag('canAccessAtc'));

/**
 * POST /api/lidc/link/start - Generate one-time DCS account link code
 */
app.post('/api/lidc/link/start', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.startUcidLink(req.session.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to start link flow' });
  }
});

/**
 * GET /api/lidc/link/status - Get DCS account link status for current user
 */
app.get('/api/lidc/link/status', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.getUcidLinkStatus(req.session.user.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to read link status' });
  }
});

/**
 * GET /api/lidc/specializations - Get LIDC specializations and unit catalog
 */
app.get('/api/lidc/specializations', (req, res) => {
  const catalog = lidcService.getSpecializationsCatalog();
  res.json(catalog);
});

/**
 * GET /api/lidc/users - Get historical Discord users for squadron invites
 */
app.get('/api/lidc/users', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const users = lidcService.getDiscordUsers();
  res.json({ users });
});

/**
 * GET /api/lidc/me - Get LIDC state for current user
 */
app.get('/api/lidc/me', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const state = lidcService.getUserLidcState(req.session.user.id);
  res.json(state);
});

/**
 * GET /api/lidc/squadrons - List existing LIDC squadrons
 */
app.get('/api/lidc/squadrons', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const squadrons = lidcService.listSquadrons();
  res.json({ squadrons });
});

/**
 * POST /api/lidc/squadrons - Create new LIDC squadron (authenticated users only)
 */
app.post('/api/lidc/squadrons', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const squadron = lidcService.createSquadron(req.body || {}, req.session.user);
    return res.status(201).json({ squadron });
  } catch (error) {
    const message = String(error?.message || 'Failed to create squadron');
    const lowered = message.toLowerCase();
    let status = 400;
    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('already in squadron')) {
      status = 409;
    }
    return res.status(status).json({ error: message });
  }
});

/**
 * POST /api/lidc/squadrons/join - Join squadron using invite code
 */
app.post('/api/lidc/squadrons/join', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const squadron = lidcService.joinSquadronByInviteCode({
      inviteCode: req.body?.inviteCode,
      sessionUser: req.session.user,
    });
    return res.status(200).json({ squadron });
  } catch (error) {
    const message = String(error?.message || 'Failed to join squadron');
    const lowered = message.toLowerCase();
    let status = 400;
    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('already in squadron')) {
      status = 409;
    } else if (lowered.includes('not found') || lowered.includes('invalid invite code')) {
      status = 404;
    }
    return res.status(status).json({ error: message });
  }
});

/**
 * GET /api/lidc/squadrons/:id - Get a single LIDC squadron by id
 */
app.get('/api/lidc/squadrons/:id', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const squadron = lidcService.getSquadronById(req.params.id, req.session.user.id);
  if (!squadron) {
    return res.status(404).json({ error: 'Squadron not found' });
  }

  res.json({ squadron });
});

/**
 * PUT /api/lidc/squadrons/:id/deck - Update squadron deck (owner only)
 */
app.put('/api/lidc/squadrons/:id/deck', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.updateSquadronDeck({
      squadronId: req.params.id,
      deck: req.body?.deck || {},
      actorUserId: req.session.user.id,
    });

    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to update squadron deck');
    const lowered = message.toLowerCase();
    let status = 400;

    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('not found')) {
      status = 404;
    } else if (lowered.includes('only squadron members') || lowered.includes('only the squadron owner')) {
      status = 403;
    }

    return res.status(status).json({ error: message });
  }
});

/**
 * PUT /api/lidc/squadrons/:id/airframes/:airframeId - Assign or unassign pilot from airframe
 */
app.put('/api/lidc/squadrons/:id/airframes/:airframeId', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.updateAirframeAssignment({
      squadronId: req.params.id,
      airframeId: req.params.airframeId,
      pilotUserId: req.body?.pilotUserId ?? null,
      actorUserId: req.session.user.id,
    });

    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to update airframe assignment');
    const lowered = message.toLowerCase();
    let status = 400;

    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('not found')) {
      status = 404;
    } else if (lowered.includes('only squadron members')) {
      status = 403;
    } else if (lowered.includes('only leaders')) {
      status = 403;
    }

    return res.status(status).json({ error: message });
  }
});

/**
 * PUT /api/lidc/squadrons/:id/members/:memberId/role - Promote/demote squadron member role
 */
app.put('/api/lidc/squadrons/:id/members/:memberId/role', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.updateSquadronMemberRole({
      squadronId: req.params.id,
      targetUserId: req.params.memberId,
      role: req.body?.role,
      actorUserId: req.session.user.id,
    });

    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to update squadron member role');
    const lowered = message.toLowerCase();
    let status = 400;

    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('not found')) {
      status = 404;
    } else if (
      lowered.includes('only owners')
      || lowered.includes('only squadron members')
      || lowered.includes('cannot change owner role')
      || lowered.includes('owner cannot change own role')
    ) {
      status = 403;
    }

    return res.status(status).json({ error: message });
  }
});

/**
 * DELETE /api/lidc/squadrons/:id/members/:memberId - Remove a squadron member (owner only)
 */
app.delete('/api/lidc/squadrons/:id/members/:memberId', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.removeSquadronMember({
      squadronId: req.params.id,
      targetUserId: req.params.memberId,
      actorUserId: req.session.user.id,
    });

    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to remove squadron member');
    const lowered = message.toLowerCase();
    let status = 400;

    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('not found')) {
      status = 404;
    } else if (
      lowered.includes('only owners')
      || lowered.includes('only squadron members')
      || lowered.includes('cannot remove squadron owner')
      || lowered.includes('cannot remove themselves')
    ) {
      status = 403;
    }

    return res.status(status).json({ error: message });
  }
});

/**
 * POST /api/lidc/squadrons/:id/leave - Leave squadron as current user
 */
app.post('/api/lidc/squadrons/:id/leave', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.leaveSquadron({
      squadronId: req.params.id,
      actorUserId: req.session.user.id,
    });

    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to leave squadron');
    const lowered = message.toLowerCase();
    let status = 400;

    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('not found')) {
      status = 404;
    } else if (
      lowered.includes('only squadron members')
      || lowered.includes('owner cannot leave')
    ) {
      status = 403;
    }

    return res.status(status).json({ error: message });
  }
});

/**
 * DELETE /api/lidc/squadrons/:id - Delete squadron as current user (owner only)
 */
app.delete('/api/lidc/squadrons/:id', (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const result = lidcService.deleteSquadron({
      squadronId: req.params.id,
      actorUserId: req.session.user.id,
    });

    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to delete squadron');
    const lowered = message.toLowerCase();
    let status = 400;

    if (lowered.includes('authentication required')) {
      status = 401;
    } else if (lowered.includes('not found')) {
      status = 404;
    } else if (
      lowered.includes('only squadron members')
      || lowered.includes('only owner')
    ) {
      status = 403;
    }

    return res.status(status).json({ error: message });
  }
});

/**
 * PUT /api/lidc/specializations - Update LIDC specializations and units (wiki editors only)
 */
app.put('/api/lidc/specializations', async (req, res) => {
  if (!req.session.user?.id) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const sessionUser = await ensureSessionUserPermissions(req);
  if (!sessionUser?.canEditWiki) {
    return res.status(403).json({ error: 'Only allowed contributors can edit LIDC specializations' });
  }

  try {
    const updated = lidcService.updateSpecializationsCatalog(req.body || {});
    return res.json(updated);
  } catch (error) {
    return res.status(400).json({ error: String(error?.message || 'Failed to update specializations') });
  }
});

/**
 * GET /api/achievements/catalog - Public list of all available achievements
 */
app.get('/api/achievements/catalog', (req, res) => {
  const achievements = achievementsService.getCatalog();
  res.json({ achievements });
});

/**
 * POST /api/achievements/catalog - Create new achievement (wiki editor only)
 */
app.post('/api/achievements/catalog', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can manage achievements' });
  }

  try {
    const achievement = achievementsService.createAchievement({
      name: req.body?.name,
      description: req.body?.description,
      imageUrl: req.body?.imageUrl,
      createdById: userId,
      createdByName: sessionUser.globalName || sessionUser.username || String(userId),
    });
    return res.status(201).json({ achievement });
  } catch (error) {
    const message = String(error?.message || 'Failed to create achievement');
    const lowered = message.toLowerCase();
    const status = lowered.includes('already exists') ? 409 : 400;
    return res.status(status).json({ error: message });
  }
});

/**
 * PUT /api/achievements/catalog/:achievementId - Update achievement (wiki editor only)
 */
app.put('/api/achievements/catalog/:achievementId', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can manage achievements' });
  }

  try {
    const achievement = achievementsService.updateAchievement({
      achievementId: req.params?.achievementId,
      name: req.body?.name,
      description: req.body?.description,
      imageUrl: req.body?.imageUrl,
    });
    return res.json({ achievement });
  } catch (error) {
    const message = String(error?.message || 'Failed to update achievement');
    const lowered = message.toLowerCase();
    const status = lowered.includes('not found') ? 404 : lowered.includes('already exists') ? 409 : 400;
    return res.status(status).json({ error: message });
  }
});

/**
 * DELETE /api/achievements/catalog/:achievementId - Delete achievement (wiki editor only)
 */
app.delete('/api/achievements/catalog/:achievementId', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can manage achievements' });
  }

  try {
    const result = achievementsService.deleteAchievement(req.params?.achievementId);
    return res.json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to delete achievement');
    const lowered = message.toLowerCase();
    const status = lowered.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

/**
 * GET /api/achievements/users/:userId - Get assigned achievements for a user
 */
app.get('/api/achievements/users/:userId', (req, res) => {
  const sessionUser = req.session?.user;
  const requesterId = String(sessionUser?.id || '').trim();
  const targetUserId = String(req.params.userId || '').trim();

  if (!requesterId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!targetUserId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  if (requesterId !== targetUserId && !canEditWiki(requesterId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can inspect other users achievements' });
  }

  const achievements = achievementsService.getUserAchievements(targetUserId);
  const displayName = achievementsService.getUserDisplayName(targetUserId)
    || (requesterId === targetUserId ? (sessionUser.globalName || sessionUser.username || requesterId) : '');

  return res.json({
    userId: targetUserId,
    displayName,
    recognitionsCount: achievements.length,
    achievements,
  });
});

/**
 * POST /api/achievements/assign - Assign achievement to a user (wiki editor only)
 */
app.post('/api/achievements/assign', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can assign achievements' });
  }

  try {
    const result = achievementsService.assignAchievement({
      userId: req.body?.userId,
      userName: req.body?.userName,
      achievementId: req.body?.achievementId,
      awardedById: userId,
      awardedByName: sessionUser.globalName || sessionUser.username || String(userId),
    });
    return res.status(201).json(result);
  } catch (error) {
    const message = String(error?.message || 'Failed to assign achievement');
    const lowered = message.toLowerCase();
    const status = lowered.includes('already assigned') ? 409 : lowered.includes('not found') ? 404 : 400;
    return res.status(status).json({ error: message });
  }
});

/**
 * GET /api/achievements/leaderboard - Public leaderboard by achievement count
 */
app.get('/api/achievements/leaderboard', (req, res) => {
  const rawLimit = Number.parseInt(String(req.query?.limit || ''), 10);
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50;
  const leaderboard = achievementsService.getLeaderboard(limit);
  res.json({ leaderboard });
});

/**
 * GET /api/wiki/pages - Public list of wiki pages
 */
app.get('/api/wiki/pages', (req, res) => {
  const pages = wikiService.getPages();
  res.json({ pages });
});

/**
 * GET /api/wiki/pages/:pageId - Public wiki page by id
 */
app.get('/api/wiki/pages/:pageId', (req, res) => {
  const page = wikiService.getPage(req.params.pageId);
  if (!page) {
    return res.status(404).json({ error: 'Wiki page not found' });
  }
  return res.json({ page });
});

/**
 * GET /api/wiki/drafts/:pageId - Get current user's wiki draft (editor only)
 */
app.get('/api/wiki/drafts/:pageId', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit wiki pages' });
  }
  const draft = wikiService.getDraft(userId, req.params.pageId);
  return res.json({ draft });
});

/**
 * PUT /api/wiki/drafts/:pageId - Save current user's wiki draft (editor only)
 */
app.put('/api/wiki/drafts/:pageId', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit wiki pages' });
  }
  const draft = wikiService.saveDraft(userId, req.params.pageId, req.body || {});
  return res.json({ draft });
});

/**
 * DELETE /api/wiki/drafts/:pageId - Delete current user's wiki draft (editor only)
 */
app.delete('/api/wiki/drafts/:pageId', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit wiki pages' });
  }
  wikiService.deleteDraft(userId, req.params.pageId);
  return res.json({ success: true });
});

/**
 * POST /api/wiki/pages - Create new wiki page (editor only)
 */
app.post('/api/wiki/pages', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit wiki pages' });
  }

  try {
    const page = wikiService.createPage({
      pageId: req.body?.pageId,
      userId,
      authorName: sessionUser.globalName || sessionUser.username || String(userId),
      draft: req.body || {},
    });
    return res.status(201).json({ page });
  } catch (error) {
    const errorMessage = String(error?.message || '');
    const lowered = errorMessage.toLowerCase();
    const status = lowered.includes('already exists') ? 409 : 400;
    return res.status(status).json({ error: errorMessage || 'Failed to create wiki page' });
  }
});

/**
 * PUT /api/wiki/pages/:pageId - Publish/update wiki page from editor payload (editor only)
 */
app.put('/api/wiki/pages/:pageId', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit wiki pages' });
  }

  try {
    const page = wikiService.updatePage({
      pageId: req.params.pageId,
      userId,
      authorName: sessionUser.globalName || sessionUser.username || String(userId),
      draft: req.body || {},
    });
    return res.json({ page });
  } catch (error) {
    const status = String(error?.message || '').toLowerCase().includes('not found') ? 404 : 400;
    return res.status(status).json({ error: error.message || 'Failed to update wiki page' });
  }
});

/**
 * POST /api/wiki/media - Upload image/video to wiki storage (editor only)
 */
app.post('/api/wiki/media', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditWiki(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit wiki pages' });
  }

  try {
    const { fileName, mimeType, base64Data } = req.body || {};
    const media = wikiService.saveMedia({ fileName, mimeType, base64Data });
    return res.json({ media });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Media upload failed' });
  }
});

/**
 * GET /api/wiki/media/:fileName - Serve uploaded wiki media
 */
app.get('/api/wiki/media/:fileName', (req, res) => {
  const absolutePath = wikiService.getMediaAbsolutePath(req.params.fileName);
  if (!absolutePath) {
    return res.status(404).json({ error: 'Media not found' });
  }
  return res.sendFile(absolutePath);
});

/**
 * GET /api/changelogs - Public list of changelog posts
 */
app.get('/api/changelogs', (req, res) => {
  const posts = changelogsService.getPosts();
  res.json({ posts });
});

/**
 * GET /api/changelogs/draft - Get current user's draft (author only)
 */
app.get('/api/changelogs/draft', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }
  const draft = changelogsService.getDraft(userId);
  res.json({ draft });
});

/**
 * PUT /api/changelogs/draft - Save current user's draft (author only)
 */
app.put('/api/changelogs/draft', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }
  const draft = changelogsService.saveDraft(userId, req.body || {});
  res.json({ draft });
});

/**
 * DELETE /api/changelogs/draft - Delete current user's draft (author only)
 */
app.delete('/api/changelogs/draft', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }
  changelogsService.deleteDraft(userId);
  res.json({ success: true });
});

/**
 * POST /api/changelogs/media - Upload image/video to changelog storage (author only)
 */
app.post('/api/changelogs/media', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }

  try {
    const { fileName, mimeType, base64Data } = req.body || {};
    const media = changelogsService.saveMedia({ fileName, mimeType, base64Data });
    return res.json({ media });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Media upload failed' });
  }
});

/**
 * POST /api/changelogs - Publish changelog post (author only)
 */
app.post('/api/changelogs', (req, res) => {
  const sessionUser = req.session?.user;
  const userId = sessionUser?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }

  try {
    const post = changelogsService.publishPost({
      userId,
      authorName: sessionUser.globalName || sessionUser.username || String(userId),
      draft: req.body || {},
    });
    return res.json({ post });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to publish changelog' });
  }
});

/**
 * POST /api/changelogs/translate - Auto translate draft (author only)
 */
app.post('/api/changelogs/translate', async (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }

  try {
    const draft = req.body?.draft || {};
    const sourceLang = req.body?.sourceLang || 'it';
    const targetLang = req.body?.targetLang || 'en';
    const overwrite = req.body?.overwrite === true;
    const translatedDraft = await changelogTranslator.translateDraft(draft, {
      sourceLang,
      targetLang,
      overwrite,
    });
    return res.json({ draft: translatedDraft });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Translation failed' });
  }
});

/**
 * PUT /api/changelogs/:postId - Update changelog post (author only)
 */
app.put('/api/changelogs/:postId', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }

  try {
    const post = changelogsService.updatePost({
      postId: req.params.postId,
      draft: req.body || {},
    });
    return res.json({ post });
  } catch (error) {
    const status = String(error?.message || '').toLowerCase().includes('not found') ? 404 : 400;
    return res.status(status).json({ error: error.message || 'Failed to update changelog' });
  }
});

/**
 * DELETE /api/changelogs/:postId - Delete changelog post (author only)
 */
app.delete('/api/changelogs/:postId', (req, res) => {
  const userId = req.session?.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (!canEditChangelog(userId, req.session?.user?.discordRoleIds)) {
    return res.status(403).json({ error: 'Only allowed contributors can edit changelogs' });
  }

  const removed = changelogsService.removePost(req.params.postId);
  if (!removed) {
    return res.status(404).json({ error: 'Changelog not found' });
  }
  return res.json({ success: true });
});

/**
 * GET /api/changelogs/media/:fileName - Serve uploaded changelog media
 */
app.get('/api/changelogs/media/:fileName', (req, res) => {
  const absolutePath = changelogsService.getMediaAbsolutePath(req.params.fileName);
  if (!absolutePath) {
    return res.status(404).json({ error: 'Media not found' });
  }
  return res.sendFile(absolutePath);
});

// ==================== NOE EVENTS ====================

function requireNoeAdmin(req, res) {
  const userId = req.session?.user?.id;
  if (!userId) {
    res.status(401).json({ error: 'Not authenticated' });
    return null;
  }
  if (!canManageNoe(userId, req.session?.user?.discordRoleIds)) {
    res.status(403).json({ error: 'Only allowed admins can manage NOE events' });
    return null;
  }
  return String(userId);
}

/**
 * GET /api/noe/events - List NOE events (public).
 */
app.get('/api/noe/events', (req, res) => {
  const events = noeEventsService.getEvents();
  res.json({ events });
});

/**
 * POST /api/noe/events - Create a NOE event (admin only)
 */
app.post('/api/noe/events', (req, res) => {
  if (!requireNoeAdmin(req, res)) return undefined;
  try {
    const event = noeEventsService.createEvent(req.body || {});
    return res.json({ event });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to create event' });
  }
});

/**
 * PUT /api/noe/events/:id - Update a NOE event (admin only)
 */
app.put('/api/noe/events/:id', (req, res) => {
  if (!requireNoeAdmin(req, res)) return undefined;
  try {
    const event = noeEventsService.updateEvent(req.params.id, req.body || {});
    return res.json({ event });
  } catch (error) {
    const status = String(error?.message || '').toLowerCase().includes('not found') ? 404 : 400;
    return res.status(status).json({ error: error.message || 'Failed to update event' });
  }
});

/**
 * DELETE /api/noe/events/:id - Delete a NOE event (admin only)
 */
app.delete('/api/noe/events/:id', (req, res) => {
  if (!requireNoeAdmin(req, res)) return undefined;
  const removed = noeEventsService.removeEvent(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'Event not found' });
  }
  return res.json({ success: true });
});

/**
 * GET /api/logistics-route-visibility - Get airports with hidden logistics 3D routes
 */
app.get('/api/logistics-route-visibility', (req, res) => {
  res.json({
    hiddenAirportIds: getHiddenLogisticsRouteAirportIdsPayload(),
  });
});

/**
 * POST /api/logistics-route-visibility/:airportId - Set airport logistics route priority
 * Body: { isPriority: boolean }
 */
app.post('/api/logistics-route-visibility/:airportId', async (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await ensureSessionUserPermissions(req);
  if (!user?.canManageLogisticsRouteVisibility) {
    return res.status(403).json({
      error: `Access denied. Discord role ${DISCORD_LOGISTICS_ROUTE_ROLE_ID} required.`,
    });
  }

  const airportId = String(req.params.airportId || '').trim();
  if (!airportId) {
    return res.status(400).json({ error: 'airportId is required' });
  }

  const knownAirportIds = getKnownAirportIds();
  if (!knownAirportIds.has(airportId)) {
    return res.status(404).json({ error: 'Airport not found' });
  }

  const isPriority = req.body?.isPriority;
  if (typeof isPriority !== 'boolean') {
    return res.status(400).json({ error: 'isPriority must be a boolean' });
  }

  if (isPriority) {
    hiddenLogisticsRouteAirportIds.delete(airportId);
  } else {
    hiddenLogisticsRouteAirportIds.add(airportId);
  }

  try {
    persistHiddenLogisticsRouteAirportIds();
  } catch (error) {
    console.error('Failed to persist logistics route visibility:', error.message);
    return res.status(500).json({ error: 'Failed to persist logistics route visibility' });
  }

  const hiddenAirportIds = getHiddenLogisticsRouteAirportIdsPayload();
  io.emit('logistics-route-visibility:updated', {
    hiddenAirportIds,
  });

  res.json({
    success: true,
    airportId,
    isPriority,
    hiddenAirportIds,
  });
});

// ==================== DCORE BRIDGE ROUTES (web -> game) ====================

/**
 * GET /api/spawn-options - Catalog of web-initiated spawns (keywords + costs).
 */
app.get('/api/spawn-options', (req, res) => {
  res.json({
    infantry: WEB_INFANTRY_OPTIONS,
    crate: WEB_CRATE_OPTIONS,
  });
});

/**
 * GET /api/tanker/options - Tanker types spawnable via web (BOOM / BASKET).
 */
app.get('/api/tanker/options', (req, res) => {
  res.json({ tankers: WEB_TANKER_OPTIONS });
});

/**
 * GET /api/map/actions/options - Map right-click spawn catalog (CAS, MBT, BOMB, etc.).
 */
app.get('/api/map/actions/options', (req, res) => {
  res.json({ actions: WEB_MAP_ACTION_OPTIONS });
});

/**
 * GET /api/tanker/routes - Active tanker racetracks exported by DMAS.
 */
app.get('/api/tanker/routes', (req, res) => {
  res.json({ routes: tankerRoutes });
});

/**
 * GET /api/production-points - Current Production Points state exported by DCORE.
 */
app.get('/api/production-points', (req, res) => {
  res.json({ productionPoints });
});

/**
 * GET /api/web-spawn-markers - Live tracked crate positions (airport spawns + production retrieves).
 */
app.get('/api/web-spawn-markers', (req, res) => {
  res.json({ markers: webSpawnMarkers });
});

function getSessionActor(req) {
  const user = req.session?.user;
  if (!user) return null;
  return {
    id: String(user.id || '').trim() || 'unknown',
    name: String(user.globalName || user.username || user.id || 'unknown').trim(),
  };
}

function respondQueued(res, command) {
  res.json({
    success: true,
    commandId: command.id,
    command: {
      id: command.id,
      type: command.type,
      keyword: command.keyword || null,
    },
  });
}

/**
 * POST /api/production-points/:id/upgrade - Request a Production Point upgrade in-game.
 */
app.post('/api/production-points/:id/upgrade', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const ppId = String(req.params.id || '').trim();
  const pp = productionPoints.find((entry) => entry.id === ppId);
  if (!pp) {
    return res.status(404).json({ error: 'Production point not found' });
  }
  if (!pp.coordinates || !Number.isFinite(pp.coordinates.lat) || !Number.isFinite(pp.coordinates.lon)) {
    return res.status(400).json({ error: 'Production point has no known position' });
  }
  if (!pp.built) {
    return res.status(400).json({ error: 'Production point is not built yet' });
  }
  if (pp.upgrading) {
    return res.status(409).json({ error: 'Production point is already upgrading' });
  }
  if (pp.level >= pp.max_level) {
    return res.status(400).json({ error: 'Production point is already at max level' });
  }

  const command = enqueueWebCommand({
    id: randomUUID(),
    type: 'pp_upgrade',
    production_point_id: ppId,
    airport_id: null,
    keyword: null,
    lat: pp.coordinates.lat,
    lon: pp.coordinates.lon,
    requested_by: actor.name,
    requested_by_id: actor.id,
    ts: Date.now(),
  });

  respondQueued(res, command);
});

/**
 * POST /api/production-points/:id/retrieve - Retrieve production crates in-game (RETRIEVE).
 */
app.post('/api/production-points/:id/retrieve', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const ppId = String(req.params.id || '').trim();
  const pp = productionPoints.find((entry) => entry.id === ppId);
  if (!pp) {
    return res.status(404).json({ error: 'Production point not found' });
  }
  if (!pp.coordinates || !Number.isFinite(pp.coordinates.lat) || !Number.isFinite(pp.coordinates.lon)) {
    return res.status(400).json({ error: 'Production point has no known position' });
  }
  if (!pp.built) {
    return res.status(400).json({ error: 'Production point is not built yet' });
  }
  if (String(pp.owner || '').toUpperCase() !== 'BLUE') {
    return res.status(403).json({ error: 'Production point is not BLUE-controlled' });
  }

  const stock = Math.max(0, Math.floor(Number(pp.stock) || 0));
  if (stock <= 0) {
    return res.status(400).json({ error: 'Production point stock is empty' });
  }

  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  const distanceCheck = validateProductionPointRetrieveDistance(pp, lat, lon);
  if (!distanceCheck.ok) {
    return res.status(400).json({ error: distanceCheck.error });
  }

  const quantity = clampRetrieveQuantity(req.body?.quantity, stock);

  const command = enqueueWebCommand({
    id: randomUUID(),
    type: 'pp_retrieve',
    production_point_id: ppId,
    airport_id: null,
    keyword: null,
    lat,
    lon,
    quantity,
    requested_by: actor.name,
    requested_by_id: actor.id,
    ts: Date.now(),
  });

  respondQueued(res, command);
});

function handleSpawnRequest(req, res, kind) {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const airportId = String(req.params.id || '').trim();
  const airport = getAirportById(airportId);
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found' });
  }

  const keyword = String(req.body?.keyword || '').trim().toUpperCase();
  const allowed = kind === 'inf_spawn' ? WEB_INFANTRY_KEYWORDS : WEB_CRATE_KEYWORDS;
  if (!keyword || !allowed.has(keyword)) {
    return res.status(400).json({ error: `Invalid keyword for ${kind}` });
  }

  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Valid lat/lon are required' });
  }

  const quantity = clampSpawnQuantity(req.body?.quantity);
  const placementPositions = buildSpawnPlacementPositions(lat, lon, quantity);
  for (const position of placementPositions) {
    const distanceCheck = validateAirportSpawnDistance(airport, position.lat, position.lon);
    if (!distanceCheck.ok) {
      return res.status(400).json({ error: distanceCheck.error });
    }
  }

  const command = enqueueWebCommand({
    id: randomUUID(),
    type: kind,
    production_point_id: null,
    airport_id: airportId,
    keyword,
    lat,
    lon,
    quantity,
    requested_by: actor.name,
    requested_by_id: actor.id,
    ts: Date.now(),
  });

  respondQueued(res, command);
}

/**
 * POST /api/airports/:id/spawn-infantry - Body { keyword: MANPAD|SCOUT, lat, lon }
 */
app.post('/api/airports/:id/spawn-infantry', (req, res) => {
  handleSpawnRequest(req, res, 'inf_spawn');
});

/**
 * POST /api/airports/:id/spawn-crate - Body { keyword: BUILD|AMMO|FUEL|HMMWV|L118|..., lat, lon }
 */
app.post('/api/airports/:id/spawn-crate', (req, res) => {
  handleSpawnRequest(req, res, 'crate_spawn');
});

/**
 * POST /api/tanker/spawn - Body { keyword: BOOM|BASKET, wp1_lat, wp1_lon, wp2_lat, wp2_lon }
 */
app.post('/api/tanker/spawn', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const keyword = String(req.body?.keyword || '').trim().toUpperCase();
  if (!WEB_TANKER_KEYWORDS.has(keyword)) {
    return res.status(400).json({ error: 'Invalid tanker keyword (BOOM or BASKET)' });
  }

  const wp1Lat = Number(req.body?.wp1_lat ?? req.body?.lat);
  const wp1Lon = Number(req.body?.wp1_lon ?? req.body?.lon);
  const wp2Lat = Number(req.body?.wp2_lat ?? req.body?.lat2);
  const wp2Lon = Number(req.body?.wp2_lon ?? req.body?.lon2);
  if (![wp1Lat, wp1Lon, wp2Lat, wp2Lon].every(Number.isFinite)) {
    return res.status(400).json({ error: 'Valid wp1_lat, wp1_lon, wp2_lat, wp2_lon are required' });
  }

  const distanceCheck = validateTankerWaypointDistance(wp1Lat, wp1Lon, wp2Lat, wp2Lon);
  if (!distanceCheck.ok) {
    return res.status(400).json({ error: distanceCheck.error });
  }

  const command = enqueueWebCommand({
    id: randomUUID(),
    type: 'tanker_spawn',
    production_point_id: null,
    airport_id: null,
    keyword,
    lat: wp1Lat,
    lon: wp1Lon,
    lat2: wp2Lat,
    lon2: wp2Lon,
    requested_by: actor.name,
    requested_by_id: actor.id,
    ts: Date.now(),
  });

  respondQueued(res, command);
});

/**
 * POST /api/map/actions/spawn - Body { type: air-asset|ground-asset|..., keyword, lat, lon }
 */
app.post('/api/map/actions/spawn', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const commandType = normalizeMapActionCommandType(req.body?.type);
  const keyword = String(req.body?.keyword || '').trim().toUpperCase();
  const option = resolveMapActionOption(commandType, keyword);
  if (!option) {
    return res.status(400).json({ error: 'Invalid map action type or keyword' });
  }

  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Valid lat/lon are required' });
  }

  const command = enqueueWebCommand({
    id: randomUUID(),
    type: commandType,
    production_point_id: null,
    airport_id: null,
    keyword,
    lat,
    lon,
    requested_by: actor.name,
    requested_by_id: actor.id,
    ts: Date.now(),
  });

  respondQueued(res, command);
});

/**
 * GET /api/dbuild/catalog - DBUILD construction types and crate requirements.
 */
app.get('/api/dbuild/catalog', (req, res) => {
  res.json({
    types: DBUILD_CATALOG.map((entry) => ({
      ...entry,
      estimated_fp_cost: estimateDbuildFpCost(entry.required_categories),
    })),
  });
});

/**
 * GET /api/dbuild/placements - Web draft/confirmed build placements.
 */
app.get('/api/dbuild/placements', (req, res) => {
  res.json({
    placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
    sites: dbuildSites,
  });
});

/**
 * GET /api/dbuild/sites - Live in-game DBUILD sites from DCORE export.
 */
app.get('/api/dbuild/sites', (req, res) => {
  res.json({ sites: dbuildSites });
});

/**
 * POST /api/dbuild/placements - Create a draft placement (right-click on map).
 */
app.post('/api/dbuild/placements', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const buildType = String(req.body?.build_type || '').trim().toLowerCase();
  const lat = Number(req.body?.lat);
  const lon = Number(req.body?.lon);
  if (!DBUILD_TYPE_IDS.has(buildType)) {
    return res.status(400).json({ error: 'Invalid build type' });
  }
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: 'Valid lat/lon are required' });
  }

  const placement = dbuildPlacementsService.createPlacement({
    id: randomUUID(),
    build_type: buildType,
    lat,
    lon,
    status: 'draft',
    requested_by: actor.name,
    requested_by_id: actor.id,
    command_id: null,
    game_site_id: null,
    error: null,
    created_at: Date.now(),
    confirmed_at: null,
  });

  const payload = enrichDbuildPlacements([placement])[0];
  io.emit('dbuild-placements:updated', {
    placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
    sites: dbuildSites,
    latest: payload,
  });

  pushFeedEvent({
    type: 'dcore.dbuild.draft',
    title: 'DBUILD draft placed',
    message: `${actor.name} drafted ${payload.catalog?.label || buildType} on the map`,
    actor: actor.id,
    metadata: {
      placement_id: placement.id,
      build_type: buildType,
    },
  });

  res.json({ success: true, placement: payload });
});

/**
 * POST /api/dbuild/placements/:id/confirm - Confirm draft and enable in-game construction.
 */
app.post('/api/dbuild/placements/:id/confirm', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const placementId = String(req.params.id || '').trim();
  const placement = dbuildPlacementsService.getPlacementById(placementId);
  if (!placement) {
    return res.status(404).json({ error: 'Placement not found' });
  }
  if (placement.status !== 'draft') {
    return res.status(400).json({ error: 'Only draft placements can be confirmed' });
  }

  const command = enqueueWebCommand({
    id: randomUUID(),
    type: 'dbuild_confirm',
    production_point_id: null,
    airport_id: null,
    keyword: null,
    build_type: placement.build_type,
    placement_id: placement.id,
    lat: placement.lat,
    lon: placement.lon,
    requested_by: actor.name,
    requested_by_id: actor.id,
    ts: Date.now(),
  });

  const updated = dbuildPlacementsService.updatePlacement(placementId, {
    status: 'confirmed',
    command_id: command.id,
    confirmed_at: Date.now(),
    error: null,
  });

  io.emit('dbuild-placements:updated', {
    placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
    sites: dbuildSites,
    latest: enrichDbuildPlacements([updated])[0],
  });

  respondQueued(res, {
    ...command,
    placement: enrichDbuildPlacements([updated])[0],
  });
});

/**
 * DELETE /api/dbuild/placements/:id - Cancel a draft placement.
 */
app.delete('/api/dbuild/placements/:id', (req, res) => {
  const actor = getSessionActor(req);
  if (!actor) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const placementId = String(req.params.id || '').trim();
  const placement = dbuildPlacementsService.getPlacementById(placementId);
  if (!placement) {
    return res.status(404).json({ error: 'Placement not found' });
  }
  if (placement.status !== 'draft') {
    return res.status(400).json({ error: 'Only draft placements can be cancelled' });
  }

  dbuildPlacementsService.deletePlacement(placementId);
  io.emit('dbuild-placements:updated', {
    placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
    sites: dbuildSites,
  });

  res.json({ success: true });
});

// ==================== DATA ROUTES ====================

/**
 * GET /api/time - Server authoritative time and launch state
 */
app.get('/api/time', (req, res) => {
  const serverNowMs = Date.now();
  const launchRemainingMs = Math.max(0, LAUNCH_TARGET_UTC_MS - serverNowMs);
  res.json({
    serverNowMs,
    serverNowIso: new Date(serverNowMs).toISOString(),
    launchTargetUtcMs: LAUNCH_TARGET_UTC_MS,
    launchTargetIso: new Date(LAUNCH_TARGET_UTC_MS).toISOString(),
    preLaunchActive: launchRemainingMs > 0,
    launchRemainingMs,
  });
});

/**
 * GET /api/config/airports - Public airport catalog (coordinates + DCS keys)
 */
app.get('/api/config/airports', (req, res) => {
  res.json(airports);
});

/**
 * GET /api/airports - Get all airports with current data
 */
app.get('/api/airports', (req, res) => {
  res.json(currentData);
});

/**
 * GET /api/airbases/status - Get coalition status map for airbases
 */
app.get('/api/airbases/status', (req, res) => {
  res.json(airbaseStatusManager.getAirbaseStatus());
});

/**
 * GET /api/airports/:id - Get specific airport data
 */
app.get('/api/airports/:id', (req, res) => {
  const airport = currentData[req.params.id];
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found' });
  }
  res.json(airport);
});

/**
 * GET /api/airports/:id/history - Get historical data for airport
 */
app.get('/api/airports/:id/history', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const history = historicalData.getHistory(req.params.id, hours);
  res.json(history);
});

/**
 * GET /api/airports/:id/weapons/:weaponId/history - Get historical data for a specific weapon
 */
app.get('/api/airports/:id/weapons/:weaponId/history', (req, res) => {
  const airportId = req.params.id;
  const weaponId = decodeURIComponent(req.params.weaponId);
  const days = parseInt(req.query.days) || 7;

  const history = historicalData.getWeaponHistory(airportId, weaponId, days);

  res.json({
    airportId,
    weaponId,
    days,
    dataPoints: history.length,
    history
  });
});

/**
 * GET /api/missions - Get all active missions
 */
app.get('/api/missions', (req, res) => {
  const missions = historicalData.getActiveMissions();
  res.json(missions);
});

/**
 * GET /api/missions/airport/:airportId - Get missions for specific airport
 */
app.get('/api/missions/airport/:airportId', (req, res) => {
  const missions = historicalData.getAirportMissions(req.params.airportId);
  res.json(missions);
});

/**
 * POST /api/missions/:id/accept - Accept a mission
 */
app.post('/api/missions/:id/accept', (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const activeMissions = historicalData.getActiveMissions();
  const missionBeforeUpdate = activeMissions.find((mission) => mission.id === req.params.id) || null;
  const success = historicalData.acceptMission(req.params.id, userId);

  if (!success) {
    return res.status(400).json({ error: 'Mission already accepted or not found' });
  }

  // Broadcast mission update to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  const summary = buildMissionSummary(missionBeforeUpdate);
  pushFeedEvent({
    type: 'logistics.accepted',
    title: 'Logistics mission accepted',
    message: `${userId} accepted mission from ${summary.sourceName} to ${summary.destinationName}`,
    actor: userId,
    mission_id: req.params.id,
    metadata: {
      source_airport_id: missionBeforeUpdate?.source_airport_id || null,
      airport_id: missionBeforeUpdate?.airport_id || null,
      order_count: summary.orderCount,
    },
  });

  res.json({ success: true, message: 'Mission accepted' });
});

/**
 * POST /api/missions/:id/complete - Complete a mission
 */
app.post('/api/missions/:id/complete', (req, res) => {
  const activeMissions = historicalData.getActiveMissions();
  const missionBeforeUpdate = activeMissions.find((mission) => mission.id === req.params.id) || null;
  const success = historicalData.completeMission(req.params.id);

  if (!success) {
    return res.status(400).json({ error: 'Mission not found or not accepted' });
  }

  // Broadcast mission update to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  const summary = buildMissionSummary(missionBeforeUpdate);
  pushFeedEvent({
    type: 'logistics.completed',
    title: 'Logistics mission completed',
    message: `${missionBeforeUpdate?.accepted_by || 'A pilot'} completed route ${summary.sourceName} -> ${summary.destinationName}`,
    actor: missionBeforeUpdate?.accepted_by || '',
    mission_id: req.params.id,
    metadata: {
      source_airport_id: missionBeforeUpdate?.source_airport_id || null,
      airport_id: missionBeforeUpdate?.airport_id || null,
      order_count: summary.orderCount,
    },
  });

  res.json({ success: true, message: 'Mission completed' });
});

/**
 * POST /api/missions/:id/cancel - Cancel a mission
 */
app.post('/api/missions/:id/cancel', (req, res) => {
  const activeMissions = historicalData.getActiveMissions();
  const missionBeforeUpdate = activeMissions.find((mission) => mission.id === req.params.id) || null;
  const success = historicalData.cancelMission(req.params.id);

  if (!success) {
    return res.status(400).json({ error: 'Mission not found' });
  }

  // Broadcast mission update to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  const summary = buildMissionSummary(missionBeforeUpdate);
  pushFeedEvent({
    type: 'logistics.cancelled',
    title: 'Logistics mission cancelled',
    message: `${missionBeforeUpdate?.accepted_by || 'A pilot'} cancelled route ${summary.sourceName} -> ${summary.destinationName}`,
    actor: missionBeforeUpdate?.accepted_by || '',
    mission_id: req.params.id,
    metadata: {
      source_airport_id: missionBeforeUpdate?.source_airport_id || null,
      airport_id: missionBeforeUpdate?.airport_id || null,
      order_count: summary.orderCount,
    },
  });

  res.json({ success: true, message: 'Mission cancelled' });
});

/**
 * ============================
 * COMBAT MISSION ENDPOINTS
 * ============================
 */

/**
 * GET /api/combat-missions - Get all combat missions
 */
app.get('/api/combat-missions', (req, res) => {
  const { status } = req.query;
  const missions = combatMissionDispatch.getAllCombatMissions(status);
  res.json(missions);
});

/**
 * GET /api/combat-missions/available - Get available combat missions (not assigned)
 */
app.get('/api/combat-missions/available', (req, res) => {
  const missions = combatMissionDispatch.getAvailableCombatMissions();
  res.json(missions);
});

/**
 * POST /api/combat-missions/:id/assign - Assign a combat mission to a pilot
 */
app.post('/api/combat-missions/:id/assign', (req, res) => {
  const { pilotName, aircraft } = req.body;

  if (!pilotName || !aircraft) {
    return res.status(400).json({ error: 'pilotName and aircraft are required' });
  }

  const mission = combatMissionDispatch.assignCombatMission(req.params.id, pilotName, aircraft);

  if (!mission) {
    return res.status(400).json({ error: 'Mission not found or not available' });
  }

  // Broadcast combat mission update to all clients
  io.emit('combat-missions:updated', {
    missions: combatMissionDispatch.getAllCombatMissions()
  });

  pushFeedEvent({
    type: 'ato.assigned',
    title: 'ATO mission assigned',
    message: `${pilotName} assigned to ${mission.zone_name || mission.zone_id} (${(mission.tasks || []).join(', ')})`,
    actor: pilotName,
    zone_id: mission.zone_id || '',
    mission_id: mission.id,
    metadata: {
      aircraft,
      tasks: mission.tasks || [],
    },
  });

  res.json({ success: true, mission });
});

/**
 * POST /api/combat-missions/:id/add-user - Add additional user to an assigned mission
 */
app.post('/api/combat-missions/:id/add-user', (req, res) => {
  const { pilotName, aircraft } = req.body;

  if (!pilotName || !aircraft) {
    return res.status(400).json({ error: 'pilotName and aircraft are required' });
  }

  const mission = combatMissionDispatch.addUserToMission(req.params.id, pilotName, aircraft);

  if (!mission) {
    return res.status(400).json({ error: 'Mission not found, not assigned, or user already added' });
  }

  // Broadcast combat mission update to all clients
  io.emit('combat-missions:updated', {
    missions: combatMissionDispatch.getAllCombatMissions()
  });

  pushFeedEvent({
    type: 'ato.joined',
    title: 'Pilot joined ATO mission',
    message: `${pilotName} joined mission in ${mission.zone_name || mission.zone_id}`,
    actor: pilotName,
    zone_id: mission.zone_id || '',
    mission_id: mission.id,
    metadata: {
      aircraft,
      tasks: mission.tasks || [],
    },
  });

  res.json({ success: true, mission });
});

/**
 * POST /api/combat-missions/:id/complete - Complete a combat mission
 */
app.post('/api/combat-missions/:id/complete', (req, res) => {
  const mission = combatMissionDispatch.completeCombatMission(req.params.id);

  if (!mission) {
    return res.status(400).json({ error: 'Mission not found or not assigned' });
  }

  // Broadcast combat mission update to all clients
  io.emit('combat-missions:updated', {
    missions: combatMissionDispatch.getAllCombatMissions()
  });

  pushFeedEvent({
    type: 'ato.completed',
    title: 'ATO mission completed',
    message: `${mission.assigned_to || 'Pilot'} completed mission in ${mission.zone_name || mission.zone_id}`,
    actor: mission.assigned_to || '',
    zone_id: mission.zone_id || '',
    mission_id: mission.id,
    metadata: {
      tasks: mission.tasks || [],
    },
  });

  res.json({ success: true, mission });
});

/**
 * POST /api/combat-missions/:id/abort - Abort a combat mission
 */
app.post('/api/combat-missions/:id/abort', (req, res) => {
  const mission = combatMissionDispatch.abortCombatMission(req.params.id);

  if (!mission) {
    return res.status(400).json({ error: 'Mission not found' });
  }

  // Broadcast combat mission update to all clients
  io.emit('combat-missions:updated', {
    missions: combatMissionDispatch.getAllCombatMissions()
  });

  pushFeedEvent({
    type: 'ato.aborted',
    title: 'ATO mission aborted',
    message: `${mission.assigned_to || 'Pilot'} aborted mission in ${mission.zone_name || mission.zone_id}`,
    actor: mission.assigned_to || '',
    zone_id: mission.zone_id || '',
    mission_id: mission.id,
    metadata: {
      tasks: mission.tasks || [],
    },
  });

  res.json({ success: true, mission });
});

/**
 * POST /api/combat-missions/refresh - Refresh combat missions from zones
 */
app.post('/api/combat-missions/refresh', (req, res) => {
  const missions = combatMissionDispatch.refreshCombatMissions();

  // Broadcast combat mission update to all clients
  io.emit('combat-missions:updated', {
    missions: missions
  });

  res.json({ success: true, count: missions.length, missions });
});

/**
 * POST /api/combat-missions/clear - Clear all combat missions
 */
app.post('/api/combat-missions/clear', (req, res) => {
  const count = combatMissionDispatch.clearAllCombatMissions();

  // Broadcast combat mission update to all clients
  io.emit('combat-missions:updated', {
    missions: []
  });

  res.json({ success: true, clearedCount: count });
});

/**
 * GET /api/combat-missions/pilot/:pilotName - Get missions for a specific pilot
 */
app.get('/api/combat-missions/pilot/:pilotName', (req, res) => {
  const missions = combatMissionDispatch.getMissionsByPilot(req.params.pilotName);
  res.json(missions);
});

/**
 * GET /api/frontline-zones - Get latest frontline zones
 */
app.get('/api/frontline-zones', (req, res) => {
  try {
    const zonesFromFile = loadFrontlineZonesFromFile();
    const zones = buildFrontlineZonesPayload(zonesFromFile);
    res.json({ zones });
  } catch (error) {
    console.error('Error loading frontline zones:', error.message);
    res.status(500).json({ error: 'Failed to load frontline zones' });
  }

  // Enforce policy: carriers can never be logistics destinations
  const expiredCarrierMissions = historicalData.expireCarrierDestinationMissions();
  if (expiredCarrierMissions > 0) {
    console.log(`🚫 Expired ${expiredCarrierMissions} missions targeting carrier destinations`);
  }
});

/**
 * POST /api/frontline-zones/:id/accept - Accept a frontline zone operation
 */
app.post('/api/frontline-zones/:id/accept', (req, res) => {
  const zoneId = String(req.params.id || '').trim();
  const userId = String(req.body?.userId || '').trim();

  if (!zoneId) {
    return res.status(400).json({ error: 'zone id is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const zonesFromFile = loadFrontlineZonesFromFile();
  const zone = zonesFromFile.find((entry) => String(entry?.id || '') === zoneId);
  if (!zone) {
    return res.status(404).json({ error: 'Zone not found' });
  }

  const zoneTasks = Array.isArray(zone.tasks) ? zone.tasks.filter(Boolean) : [];
  if (zoneTasks.length === 0) {
    return res.status(400).json({ error: 'Zone must have at least one task to be accepted' });
  }

  const now = Date.now();
  cleanupExpiredZoneOperations(now);
  pruneZoneOperationsForMissingZones(zonesFromFile);

  const current = zoneOperationsById.get(zoneId);
  if (current && current.user_id === userId && Number.isFinite(current.expires_at) && current.expires_at > now) {
    return res.status(409).json({ error: 'Zone already accepted by you' });
  }
  if (current && current.user_id !== userId && Number.isFinite(current.expires_at) && current.expires_at > now) {
    return res.status(409).json({ error: `Zone already accepted by ${current.user_id}` });
  }

  const userOperations = getActiveOperationsForUser(userId, now)
    .filter((operation) => operation.zone_id !== zoneId);
  if (userOperations.length >= ZONE_OPERATION_MAX_PER_USER) {
    return res.status(400).json({ error: `A user can accept at most ${ZONE_OPERATION_MAX_PER_USER} zones` });
  }

  const acceptedAt = now;
  const expiresAt = now + ZONE_OPERATION_TTL_MS;
  zoneOperationsById.set(zoneId, {
    zone_id: zoneId,
    user_id: userId,
    accepted_at: acceptedAt,
    expires_at: expiresAt,
  });

  const zones = emitFrontlineUpdate(zonesFromFile);
  const updatedZone = zones.find((entry) => entry.id === zoneId) || null;

  pushFeedEvent({
    type: 'zone.operation.accepted',
    title: 'Zone operation accepted',
    message: `${userId} is operating on ${zone.name || zone.id}`,
    actor: userId,
    zone_id: zone.id || zoneId,
    metadata: {
      zone_id: zone.id || zoneId,
      accepted_by: userId,
      expires_at: expiresAt,
      ttl_minutes: Math.round(ZONE_OPERATION_TTL_MS / 60000),
      tasks: zoneTasks,
    },
  });

  res.json({
    success: true,
    zone: updatedZone,
    zones,
  });
});

/**
 * POST /api/frontline-zones/:id/decline - Release a frontline zone operation
 */
app.post('/api/frontline-zones/:id/decline', (req, res) => {
  const zoneId = String(req.params.id || '').trim();
  const userId = String(req.body?.userId || '').trim();

  if (!zoneId) {
    return res.status(400).json({ error: 'zone id is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const zonesFromFile = loadFrontlineZonesFromFile();
  const zone = zonesFromFile.find((entry) => String(entry?.id || '') === zoneId);
  if (!zone) {
    return res.status(404).json({ error: 'Zone not found' });
  }

  const now = Date.now();
  cleanupExpiredZoneOperations(now);
  pruneZoneOperationsForMissingZones(zonesFromFile);

  const current = zoneOperationsById.get(zoneId);
  if (!current || current.user_id !== userId) {
    return res.status(400).json({ error: 'Zone is not assigned to this user' });
  }

  zoneOperationsById.delete(zoneId);

  const zones = emitFrontlineUpdate(zonesFromFile);
  const updatedZone = zones.find((entry) => entry.id === zoneId) || null;

  pushFeedEvent({
    type: 'zone.operation.declined',
    title: 'Zone operation declined',
    message: `${userId} released ${zone.name || zone.id}`,
    actor: userId,
    zone_id: zone.id || zoneId,
    metadata: {
      zone_id: zone.id || zoneId,
      declined_by: userId,
    },
  });

  res.json({
    success: true,
    zone: updatedZone,
    zones,
  });
});

/**
 * GET /api/feed - Get shared activity feed
 */
app.get('/api/feed', (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10) || 200;
  const events = feedService.getFeedEvents(limit);
  res.json({ events });
});

/**
 * GET /api/dcsar - Get current DCSAR positions exported from mission script
 */
app.get('/api/dcsar', (req, res) => {
  res.json({ points: dcsarPoints });
});

/**
 * GET /api/airlift-players - Get tracked player positions for transport airframes
 */
app.get('/api/airlift-players', (req, res) => {
  res.json({ players: airliftPlayers });
});

/**
 * POST /api/dcsar/:id/accept - Accept a DCSAR rescue task
 */
app.post('/api/dcsar/:id/accept', (req, res) => {
  const dcsarId = String(req.params.id || '').trim();
  const userId = String(req.body?.userId || '').trim();

  if (!dcsarId) {
    return res.status(400).json({ error: 'DCSAR id is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const index = dcsarPoints.findIndex((point) => String(point?.id || '') === dcsarId);
  if (index < 0) {
    return res.status(404).json({ error: 'DCSAR task not found' });
  }

  const current = dcsarPoints[index];
  const alreadyAccepted = String(current?.status || '').toLowerCase() === 'accepted' || Boolean(current?.accepted);
  if (alreadyAccepted && current?.accepted_by && current.accepted_by !== userId) {
    return res.status(409).json({ error: `Task already accepted by ${current.accepted_by}` });
  }

  const updated = {
    ...current,
    status: 'accepted',
    accepted: true,
    accepted_by: userId,
  };

  dcsarPoints = [
    ...dcsarPoints.slice(0, index),
    updated,
    ...dcsarPoints.slice(index + 1),
  ];

  try {
    persistDcsarToFile(dcsarPoints);
  } catch (error) {
    console.error('Failed to persist DCSAR task:', error.message);
    return res.status(500).json({ error: 'Failed to persist DCSAR task' });
  }

  io.emit('dcsar:updated', {
    points: dcsarPoints,
  });

  pushFeedEvent({
    type: 'dcsar.accepted',
    title: 'CSAR task accepted',
    message: `${userId} accepted CSAR task ${dcsarId}`,
    metadata: {
      dcsar_id: dcsarId,
      accepted_by: userId,
    },
  });

  res.json({ success: true, task: updated });
});

/**
 * POST /api/dcsar/:id/complete - Complete a DCSAR rescue task
 */
app.post('/api/dcsar/:id/complete', (req, res) => {
  const dcsarId = String(req.params.id || '').trim();
  const userId = String(req.body?.userId || '').trim();

  if (!dcsarId) {
    return res.status(400).json({ error: 'DCSAR id is required' });
  }
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const index = dcsarPoints.findIndex((point) => String(point?.id || '') === dcsarId);
  if (index < 0) {
    return res.status(404).json({ error: 'DCSAR task not found' });
  }

  const current = dcsarPoints[index];
  if (String(current?.status || '').toLowerCase() !== 'accepted') {
    return res.status(400).json({ error: 'Task must be accepted before completion' });
  }
  if (current?.accepted_by && current.accepted_by !== userId) {
    return res.status(403).json({ error: 'Only the assigned user can complete this task' });
  }

  const removed = current;
  dcsarPoints = dcsarPoints.filter((point) => String(point?.id || '') !== dcsarId);

  try {
    persistDcsarToFile(dcsarPoints);
  } catch (error) {
    console.error('Failed to persist DCSAR completion:', error.message);
    return res.status(500).json({ error: 'Failed to persist DCSAR completion' });
  }

  io.emit('dcsar:updated', {
    points: dcsarPoints,
  });

  pushFeedEvent({
    type: 'dcsar.completed',
    title: 'CSAR task completed',
    message: `${userId} completed CSAR task ${dcsarId}`,
    metadata: {
      dcsar_id: dcsarId,
      completed_by: userId,
      previous: removed,
    },
  });

  res.json({ success: true });
});

/**
 * POST /api/dcsar/:id/cancel - Cancel a DCSAR rescue task
 */
app.post('/api/dcsar/:id/cancel', (req, res) => {
  res.status(403).json({
    error: 'CSAR task cancellation is disabled. Complete the task instead.'
  });
});

/**
 * GET /api/convoys - Get convoy states
 */
app.get('/api/convoys', (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : null;
  const convoys = status ? convoysService.getConvoys(status) : convoysService.getConvoys();
  res.json({ convoys });
});

/**
 * POST /api/convoys/events - Upsert convoy event from external scripts (Lua/DCS)
 */
app.post('/api/convoys/events', (req, res) => {
  const token = req.headers['x-convoy-token'];
  if (CONVOY_API_TOKEN && token !== CONVOY_API_TOKEN) {
    return res.status(401).json({ error: 'Invalid convoy token' });
  }

  const eventType = String(req.body?.event || '').toLowerCase();
  if (!convoysService.CONVOY_EVENT_TYPES.has(eventType)) {
    return res.status(400).json({
      error: `Invalid event type. Allowed: ${Array.from(convoysService.CONVOY_EVENT_TYPES).join(', ')}`
    });
  }

  try {
    const convoy = convoysService.recordConvoyEvent(req.body || {});
    const customFeedMessage = typeof req.body?.feed_message === 'string' ? req.body.feed_message.trim() : '';
    const customFeedTitle = typeof req.body?.feed_title === 'string' ? req.body.feed_title.trim() : '';

    io.emit('convoys:updated', {
      convoys: convoysService.getConvoys()
    });

    if (eventType === 'spawned' || eventType === 'arrived' || eventType === 'destroyed') {
      const action = eventType === 'spawned'
        ? 'spawned'
        : eventType === 'arrived'
          ? 'arrived'
          : 'destroyed';
      pushFeedEvent({
        type: `convoy.${eventType}`,
        title: customFeedTitle !== '' ? customFeedTitle : 'Convoy event',
        message: customFeedMessage !== ''
          ? customFeedMessage
          : `Convoy ${convoy.convoy_id} ${action} (${convoy.origin_zone || '?'} -> ${convoy.destination_zone || '?'})`,
        metadata: {
          convoy_id: convoy.convoy_id,
          status: convoy.status,
          origin_zone: convoy.origin_zone,
          destination_zone: convoy.destination_zone,
        },
      });
    }

    res.json({ success: true, convoy });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to process convoy event' });
  }
});

/**
 * GET /api/mock-users - Get mock users for testing (development only)
 */
app.get('/api/mock-users', (req, res) => {
  const mockUsers = [
    { id: 'mock_1', globalName: 'Alpha Leader', username: 'alpha_leader', aircraft: 'F-16C' },
    { id: 'mock_2', globalName: 'Bravo Two', username: 'bravo_two', aircraft: 'F/A-18C' },
    { id: 'mock_3', globalName: 'Charlie Three', username: 'charlie_three', aircraft: 'A-10C' },
    { id: 'mock_4', globalName: 'Delta Four', username: 'delta_four', aircraft: 'F-15E' },
    { id: 'mock_5', globalName: 'Echo Five', username: 'echo_five', aircraft: 'AV-8B' },
  ];
  res.json(mockUsers);
});

/**
 * GET /api/logged-in-users - Get currently logged in users (via Discord OAuth)
 */
app.get('/api/logged-in-users', (req, res) => {
  // Update requesting user's activity if logged in
  if (req.session?.user?.id) {
    activeUsers.updateUserActivity(req.session.user.id);
  }

  const users = activeUsers.getActiveUsers();

  // Format users for consumption (remove sensitive data, add aircraft placeholder)
  const formattedUsers = users.map(user => ({
    id: user.id,
    globalName: user.globalName,
    username: user.username,
    avatar: user.avatar,
    // Aircraft will be specified when adding to mission
    aircraft: null
  }));

  res.json(formattedUsers);
});

/**
 * GET /api/stats - Get overall statistics
 */
app.get('/api/stats', (req, res) => {
  const missions = historicalData.getActiveMissions();
  const activeAirports = airbaseStatusManager.getActiveAirports();
  const stats = {
    totalAirports: activeAirports.length,
    activeMissions: missions.filter(m => m.status === 'pending').length,
    acceptedMissions: missions.filter(m => m.status === 'accepted').length,
    criticalAirports: 0,
  };

  // Count airports with critical weapons (per-weapon thresholds)
  Object.values(currentData).forEach(airport => {
    if (airport.data && airport.data.weapons) {
      // Get airport config to check if it's a heliport or carrier
      const airportConfig = getAirportById(airport.id);
      const isHeliport = airportConfig?.isHeliport || false;
      const isCarrier = airportConfig?.isCarrier || false;

      const hasCritical = airport.data.weapons.some(w => {
        if (!isImportantWeapon(w.item, isHeliport, isCarrier)) return false;
        const thresholds = getWeaponThresholds(w.item);
        return w.quantity <= thresholds.critical;
      });
      if (hasCritical) stats.criticalAirports++;
    }
  });

  res.json(stats);
});

/**
 * Map airport ID to chart directory name
 * Some airports have different IDs than their chart directory names
 */
function getChartDirectoryName(airportId) {
  const mapping = {
    'adana-sakirpasa': 'adana',
    'abu-al-duhur': 'abualduhur',
  };

  return mapping[airportId] || airportId;
}

/**
 * GET /api/airports/:id/charts - Get list of chart files for an airport
 */
app.get('/api/airports/:id/charts', (req, res) => {
  const airportId = req.params.id;
  const chartDirName = getChartDirectoryName(airportId);
  const chartsDir = path.resolve(__dirname, '../../charts', chartDirName);

  // Check if charts directory exists
  if (!fs.existsSync(chartsDir)) {
    return res.json({
      available: false,
      message: 'Chart non disponibili',
      charts: []
    });
  }

  try {
    const files = fs.readdirSync(chartsDir);

    // Check if it's just a "no charts" placeholder
    const noChartsFile = files.find(f => f.includes('NOCHARTS'));
    if (noChartsFile) {
      return res.json({
        available: false,
        message: 'Chart non disponibili',
        charts: []
      });
    }

    // Filter for image files only
    const chartFiles = files.filter(f =>
      /\.(png|jpg|jpeg|gif|webp)$/i.test(f)
    );

    if (chartFiles.length === 0) {
      return res.json({
        available: false,
        message: 'Chart non disponibili',
        charts: []
      });
    }

    res.json({
      available: true,
      charts: chartFiles.map(filename => ({
        filename,
        url: `/charts/${chartDirName}/${filename}`
      }))
    });
  } catch (error) {
    logger.error('Error reading charts directory:', error);
    res.status(500).json({
      available: false,
      message: 'Errore nel caricamento delle chart',
      charts: []
    });
  }
});

// Serve static chart files
app.use('/charts', express.static(path.resolve(__dirname, '../../charts')));

// Serve ATC / UI sound effects
app.use('/sfx', express.static(path.resolve(__dirname, '../../sfx')));

// ==================== TEST ENDPOINTS ====================

/**
 * POST /api/test/generate-mission - Generate a test mission (for testing only)
 * Body: { airportId, weaponId, currentQuantity, sourceAirportId? }
 */
app.post('/api/test/generate-mission', (req, res) => {
  const { airportId, weaponId, currentQuantity = 5, sourceAirportId = null } = req.body;

  if (!airportId || !weaponId) {
    return res.status(400).json({ error: 'airportId and weaponId are required' });
  }

  // Check if airport exists and is active
  const airport = airbaseStatusManager.getActiveAirportById(airportId);
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found or not active' });
  }
  if (airport.isCarrier) {
    return res.status(400).json({ error: 'Cannot create missions to carrier destinations' });
  }

  if (sourceAirportId) {
    const sourceAirport = airbaseStatusManager.getActiveAirportById(sourceAirportId);
    if (!sourceAirport) {
      return res.status(404).json({ error: 'Source airport not found or not active' });
    }
  }

  // Check if mission already exists
  if (historicalData.missionExistsForWeapon(airportId, weaponId)) {
    return res.status(400).json({ error: 'Mission already exists for this weapon' });
  }

  // Create mission
  const missionId = historicalData.createMission({
    airportId,
    sourceAirportId,
    orders: [{
      weapon_id: weaponId,
      quantity_needed: 100,
      current_quantity: currentQuantity,
      iso_units: getIsoFillForWeapon(weaponId),
    }],
    priority: getWeaponPriority(weaponId, currentQuantity),
    expiryHours: 24,
  });
  if (!missionId) {
    return res.status(400).json({ error: 'Carrier source routes are limited to 50 km' });
  }

  console.log(`🧪 TEST: Generated mission ${missionId} for ${weaponId} at ${airportId}`);

  // Broadcast to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({
    success: true,
    missionId,
    message: 'Test mission created'
  });
});

/**
 * POST /api/test/generate-random-missions - Generate random test missions
 * Body: { count, airportId?, sourceAirportId? }
 */
app.post('/api/test/generate-random-missions', (req, res) => {
  const { count = 5, airportId, sourceAirportId = null } = req.body;

  const testWeapons = [
    'weapons.missiles.AIM_120C',
    'weapons.missiles.AIM_9X',
    'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_88',
    'weapons.missiles.AGM_154A',
    'weapons.nurs.HYDRA_70_M151',
    'weapons.bombs.GBU_16',
    'weapons.missiles.RB75',
    'weapons.missiles.X_58',
    'weapons.nurs.C_13',
  ];

  let targetAirport = airportId;
  if (!targetAirport) {
    // Pick random airport eligible as logistics recipient (exclude main base and carriers)
    const activeAirports = airbaseStatusManager.getActiveAirports();
    const eligibleRecipients = activeAirports.filter(a => !a.isMainBase && !a.isCarrier);
    if (eligibleRecipients.length === 0) {
      return res.status(400).json({ error: 'No eligible recipient airports available' });
    }
    targetAirport = eligibleRecipients[Math.floor(Math.random() * eligibleRecipients.length)].id;
  } else {
    const targetAirportConfig = airbaseStatusManager.getActiveAirportById(targetAirport);
    if (!targetAirportConfig) {
      return res.status(404).json({ error: 'Target airport not found or not active' });
    }
    if (targetAirportConfig.isCarrier) {
      return res.status(400).json({ error: 'Cannot create missions to carrier destinations' });
    }
  }

  const generatedMissions = [];

  if (sourceAirportId) {
    const sourceAirport = airbaseStatusManager.getActiveAirportById(sourceAirportId);
    if (!sourceAirport) {
      return res.status(404).json({ error: 'Source airport not found or not active' });
    }
  }

  for (let i = 0; i < count; i++) {
    const randomWeapon = testWeapons[Math.floor(Math.random() * testWeapons.length)];
    const randomQuantity = Math.floor(Math.random() * 15); // 0-14

    // Skip if mission already exists
    if (historicalData.missionExistsForWeapon(targetAirport, randomWeapon)) {
      continue;
    }

    const missionId = historicalData.createMission({
      airportId: targetAirport,
      sourceAirportId,
      orders: [{
        weapon_id: randomWeapon,
        quantity_needed: 100,
        current_quantity: randomQuantity,
        iso_units: getIsoFillForWeapon(randomWeapon),
      }],
      priority: getWeaponPriority(randomWeapon, randomQuantity),
      expiryHours: 24,
    });
    if (!missionId) {
      continue;
    }

    generatedMissions.push({
      missionId,
      weapon: randomWeapon,
      quantity: randomQuantity
    });

    console.log(`🧪 TEST: Generated random mission ${missionId} for ${randomWeapon} (qty: ${randomQuantity})`);
  }

  // Broadcast to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({
    success: true,
    count: generatedMissions.length,
    missions: generatedMissions,
    airportId: targetAirport
  });
});

/**
 * POST /api/airports/:id/create-order - Create a manual supply order
 * Body: { weaponId, quantity }
 */
app.post('/api/airports/:id/create-order', (req, res) => {
  let { weaponId, quantity } = req.body;
  const airportId = req.params.id;

  if (!weaponId) {
    return res.status(400).json({ error: 'weaponId is required' });
  }

  // Check if airport exists and is active
  const airport = airbaseStatusManager.getActiveAirportById(airportId);
  if (!airport) {
    return res.status(404).json({ error: 'Airport not found or not active' });
  }
  if (airport.isCarrier) {
    return res.status(400).json({ error: 'Cannot create orders for carrier destinations' });
  }

  // Check if it's the main base
  if (airport.isMainBase) {
    return res.status(400).json({ error: 'Cannot create orders for main base' });
  }

  // Check if order already exists
  if (historicalData.missionExistsForWeapon(airportId, weaponId)) {
    return res.status(400).json({ error: 'Order already exists for this weapon' });
  }

  // Get current quantity from CSV data
  let currentQuantity = 0;
  if (currentData[airportId] && currentData[airportId].data && currentData[airportId].data.weapons) {
    const weaponData = currentData[airportId].data.weapons.find(w => w.item === weaponId);
    if (weaponData) {
      currentQuantity = weaponData.quantity;
    }
  }

  // If quantity not specified or is 0, calculate based on per-weapon rule
  if (!quantity || quantity <= 0) {
    quantity = getOrderQuantityForWeapon(weaponId);
    console.log(`?Y"S Auto-calculated quantity for ${weaponId}: ${quantity} (current: ${currentQuantity})`);
  }

  // Auto pick ISO container size from desired quantity.
  // <= 50% of default request => ISO small (0.5), otherwise ISO large (1.0).
  const defaultOrderQuantity = Math.max(1, Number(getOrderQuantityForWeapon(weaponId)) || 1);
  const requestedQuantity = Math.max(1, Number(quantity) || defaultOrderQuantity);
  const autoIsoUnits = requestedQuantity <= (defaultOrderQuantity / 2) ? 0.5 : 1.0;

  // Find best source airport using donor selection algorithm
  const thresholds = getWeaponThresholds(weaponId);
  const bestSource = findBestSourceAirport({
    recipientAirport: airport,
    weaponId,
    quantityNeeded: quantity,
    allAirportsData: currentData,
    donorThreshold: thresholds.donor,
  });

  // Get source airport and calculate priority for aircraft recommendation
  const sourceAirport = getAirportById(bestSource.airportId);
  const priority = getWeaponPriority(weaponId, currentQuantity);

  // Determine recommended aircraft
  const recommendedAircraft = determineRecommendedAircraft(
    sourceAirport,
    airport,
    bestSource.distance,
    priority
  );

  // Create order with source routing and recommended aircraft
  const orderId = historicalData.createMission({
    airportId,
    sourceAirportId: bestSource.airportId,
    distance: bestSource.distance,
    recommendedAircraft,
    orders: [{
      weapon_id: weaponId,
      quantity_needed: quantity,
      current_quantity: currentQuantity,
      iso_units: autoIsoUnits,
      priority,
    }],
    priority,
    expiryHours: 24,
  });
  if (!orderId) {
    return res.status(400).json({ error: 'Carrier source routes are limited to 50 km' });
  }

  console.log(`📦 Manual order created: ${orderId} for ${weaponId} at ${airport.displayName} (qty: ${quantity})`);
  console.log(`   Route: ${bestSource.airportName} → ${airport.displayName} (${bestSource.distance}nm)`);
  console.log(`   Recommended: ${recommendedAircraft.toUpperCase()}`);

  // Broadcast to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  res.json({
    success: true,
    orderId,
    message: 'Order created successfully',
    container: {
      type: autoIsoUnits >= 1 ? 'large' : 'small',
      iso_units: autoIsoUnits,
    },
    route: {
      from: bestSource.airportName,
      to: airport.displayName,
      distance: bestSource.distance,
      isDonor: bestSource.isDonor
    }
  });
});

/**
 * POST /api/airports/:id/compose-mission - Compose a new logistics mission from pending container missions
 * Body: { containers: [{ missionId, orderIndex, units }] }
 */
app.post('/api/airports/:id/compose-mission', (req, res) => {
  const airportId = req.params.id;
  const containers = Array.isArray(req.body?.containers) ? req.body.containers : [];
  if (containers.length === 0) {
    return res.status(400).json({ error: 'containers is required' });
  }

  const activeMissions = historicalData.getActiveMissions();
  const activeById = new Map(activeMissions.map((mission) => [mission.id, mission]));
  const selectedContainers = [];

  const normalizeUnits = (value) => {
    const units = Math.round((Number(value) || 0) * 2) / 2;
    return units;
  };

  for (const container of containers) {
    const missionId = String(container?.missionId || '').trim();
    const orderIndex = Number.parseInt(container?.orderIndex, 10);
    const units = normalizeUnits(container?.units);
    if (!missionId || !Number.isInteger(orderIndex) || orderIndex < 0 || !(units === 1 || units === 0.5)) {
      return res.status(400).json({ error: 'Invalid container payload' });
    }

    const mission = activeById.get(missionId);
    if (!mission) return res.status(404).json({ error: `Mission not found: ${missionId}` });
    if (mission.status !== 'pending') return res.status(400).json({ error: `Mission is not pending: ${missionId}` });
    if (mission.airport_id !== airportId) return res.status(400).json({ error: `Mission does not belong to airport ${airportId}: ${missionId}` });
    if (!Array.isArray(mission.orders) || !mission.orders[orderIndex]) {
      return res.status(400).json({ error: `Order not found in mission ${missionId}` });
    }

    const order = mission.orders[orderIndex];
    const orderIso = Math.round((Number(order?.iso_units || 0) || 0) * 2) / 2;
    if (orderIso <= 0) return res.status(400).json({ error: `Invalid order iso_units in mission ${missionId}` });

    selectedContainers.push({
      mission,
      missionId,
      orderIndex,
      units,
      order,
    });
  }

  const consumeByOrderKey = new Map();
  selectedContainers.forEach((entry) => {
    const key = `${entry.missionId}:${entry.orderIndex}`;
    consumeByOrderKey.set(key, (consumeByOrderKey.get(key) || 0) + entry.units);
  });
  for (const [key, consumedUnits] of consumeByOrderKey.entries()) {
    const [missionId, orderIndexRaw] = key.split(':');
    const orderIndex = Number.parseInt(orderIndexRaw, 10);
    const mission = activeById.get(missionId);
    const orderIso = Math.round((Number(mission?.orders?.[orderIndex]?.iso_units || 0) || 0) * 2) / 2;
    if (consumedUnits > orderIso + 1e-6) {
      return res.status(400).json({ error: `Selected containers exceed available units for ${missionId}#${orderIndex}` });
    }
  }

  const sourceAirportId = selectedContainers[0]?.mission?.source_airport_id || null;
  if (!sourceAirportId) {
    return res.status(400).json({ error: 'Selected containers do not have a valid source airport' });
  }

  const mixedSource = selectedContainers.some((entry) => entry.mission.source_airport_id !== sourceAirportId);
  if (mixedSource) {
    return res.status(400).json({ error: 'All selected missions must have the same source airport' });
  }

  const totalIsoUnits = selectedContainers.reduce((sum, entry) => sum + entry.units, 0);
  const totalLargeContainers = selectedContainers.reduce((sum, entry) => sum + (entry.units >= 1 ? 1 : 0), 0);

  if (totalIsoUnits > 2.5 + 1e-6) {
    return res.status(400).json({ error: 'Invalid selection: total ISO units cannot exceed 2.5' });
  }
  if (totalLargeContainers > 2) {
    return res.status(400).json({ error: 'Invalid selection: cannot exceed 2 large containers' });
  }

  const allOrders = selectedContainers.map((entry) => {
    const orderIso = Math.round((Number(entry.order?.iso_units || 0) || 0) * 2) / 2;
    const ratio = orderIso > 0 ? entry.units / orderIso : 0;
    const qty = Math.floor((Number(entry.order?.quantity_needed || 0) || 0) * ratio);
    const totalWeight = (Number(entry.order?.total_weight_lbs || 0) || 0) * ratio;
    return {
      weapon_id: entry.order?.weapon_id,
      quantity_needed: qty,
      current_quantity: Number(entry.order?.current_quantity || 0) || 0,
      iso_units: entry.units,
      total_weight_lbs: totalWeight,
      priority: entry.order?.priority || entry.mission?.priority || 'medium',
    };
  });
  if (allOrders.length === 0) {
    return res.status(400).json({ error: 'Selected missions do not contain valid orders' });
  }

  const priorityRank = { critical: 0, high: 1, medium: 2, ok: 3 };
  const rankOf = (priority) => priorityRank[String(priority || '').toLowerCase()] ?? priorityRank.ok;
  const bestPriority = allOrders.reduce((best, order) => {
    const candidate = String(order?.priority || '').toLowerCase() || 'ok';
    return rankOf(candidate) < rankOf(best) ? candidate : best;
  }, 'ok');

  const totalWeightLbs = allOrders.reduce((sum, order) => sum + (Number(order.total_weight_lbs) || 0), 0);

  const missionIdsTouched = [...new Set(selectedContainers.map((entry) => entry.missionId))];
  const remainderByMission = new Map();
  missionIdsTouched.forEach((id) => {
    const mission = activeById.get(id);
    if (mission) {
      remainderByMission.set(id, mission.orders.map((order) => ({ ...order })));
    }
  });

  selectedContainers.forEach((entry) => {
    const orders = remainderByMission.get(entry.missionId);
    if (!orders || !orders[entry.orderIndex]) return;
    const sourceOrder = orders[entry.orderIndex];
    const orderIso = Math.round((Number(sourceOrder?.iso_units || 0) || 0) * 2) / 2;
    const remainingIso = Math.round((orderIso - entry.units) * 2) / 2;
    if (remainingIso <= 0) {
      orders[entry.orderIndex] = null;
      return;
    }
    const ratio = orderIso > 0 ? remainingIso / orderIso : 0;
    orders[entry.orderIndex] = {
      ...sourceOrder,
      iso_units: remainingIso,
      quantity_needed: Math.floor((Number(sourceOrder.quantity_needed || 0) || 0) * ratio),
      total_weight_lbs: (Number(sourceOrder.total_weight_lbs || 0) || 0) * ratio,
    };
  });

  const firstMission = selectedContainers[0]?.mission;
  const distanceNm = Number(firstMission?.distance_nm) || null;
  const recommendedAircraft = firstMission?.recommended_aircraft || 'airplane';
  const sourceAirport = getAirportById(sourceAirportId);
  if (sourceAirport?.isCarrier && Number.isFinite(distanceNm) && distanceNm > MAX_CARRIER_SOURCE_DISTANCE_NM) {
    return res.status(400).json({ error: 'Carrier source routes are limited to 50 km' });
  }

  const missionMetaById = new Map(missionIdsTouched.map((id) => [id, activeById.get(id)]));
  missionIdsTouched.forEach((id) => historicalData.cancelMission(id));
  remainderByMission.forEach((ordersRaw, id) => {
    const baseMission = missionMetaById.get(id);
    if (!baseMission) return;
    const orders = ordersRaw.filter(Boolean).filter((order) => (Number(order?.iso_units || 0) || 0) > 0);
    if (orders.length === 0) return;
    const remainderIso = orders.reduce((sum, order) => sum + (Number(order.iso_units) || 0), 0);
    const remainderWeight = orders.reduce((sum, order) => sum + (Number(order.total_weight_lbs) || 0), 0);
    historicalData.createMission({
      airportId: baseMission.airport_id,
      sourceAirportId: baseMission.source_airport_id,
      distance: baseMission.distance_nm,
      recommendedAircraft: baseMission.recommended_aircraft || 'airplane',
      orders,
      totalWeightLbs: remainderWeight,
      totalIsoUnits: remainderIso,
      priority: baseMission.priority || 'medium',
      expiryHours: 24,
    });
  });

  const missionId = historicalData.createMission({
    airportId,
    sourceAirportId,
    distance: distanceNm,
    recommendedAircraft,
    orders: allOrders,
    totalWeightLbs,
    totalIsoUnits,
    priority: bestPriority,
    expiryHours: 24,
  });
  if (!missionId) {
    return res.status(400).json({ error: 'Carrier source routes are limited to 50 km' });
  }

  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions(),
  });

  const destinationName = getAirportDisplayName(airportId);
  const sourceName = getAirportDisplayName(sourceAirportId);
  pushFeedEvent({
    type: 'logistics.composed',
    title: 'Logistics mission composed',
    message: `Composed route ${sourceName} -> ${destinationName} (${totalIsoUnits.toFixed(1)} ISO)`,
    actor: '',
    mission_id: missionId,
    metadata: {
      source_airport_id: sourceAirportId,
      airport_id: airportId,
      composed_from: missionIdsTouched,
      total_iso_units: totalIsoUnits,
      order_count: allOrders.length,
    },
  });

  return res.json({
    success: true,
    missionId,
    composedFrom: missionIdsTouched,
    totalIsoUnits,
    orderCount: allOrders.length,
  });
});

// ==================== DEBUG ENDPOINTS ====================

/**
 * POST /api/debug/generate-orders - Force generation of orders for all airports (requires authentication)
 */
app.post('/api/debug/generate-orders', authenticateToken, requireAdmin, (req, res) => {
  console.log('🔧 DEBUG: Force generating orders for all airports...');

  const results = [];
  const activeAirports = airbaseStatusManager.getActiveAirports();

  // Loop through all active airports
  activeAirports.forEach(airport => {
    if (airport.isMainBase || airport.isCarrier) {
      results.push({
        airportId: airport.id,
        airportName: airport.displayName,
        skipped: true,
        reason: airport.isMainBase ? 'Main base - no orders generated' : 'Carrier destination - no orders generated'
      });
      return;
    }

    // Get weapons data for this airport
    const airportData = currentData[airport.id];
    if (!airportData || !airportData.data || !airportData.data.weapons) {
      results.push({
        airportId: airport.id,
        airportName: airport.displayName,
        skipped: true,
        reason: 'No weapons data available'
      });
      return;
    }

    // Generate missions for this airport (with donor selection)
    const generatedMissions = missionGenerator.checkAndGenerateMissions(
      airport.id,
      airportData.data.weapons,
      currentData // Pass all airports data for donor selection
    );

    results.push({
      airportId: airport.id,
      airportName: airport.displayName,
      missionsGenerated: generatedMissions.length,
      missionIds: generatedMissions
    });
  });

  // Broadcast updated missions to all clients
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });

  const totalGenerated = results.reduce((sum, r) => sum + (r.missionsGenerated || 0), 0);

  console.log(`🔧 DEBUG: Generated ${totalGenerated} total orders`);

  res.json({
    success: true,
    totalGenerated,
    results
  });
});

/**
 * POST /api/debug/clear-orders - Clear all existing orders (requires authentication)
 */
app.post('/api/debug/clear-orders', authenticateToken, requireAdmin, (req, res) => {
  console.log('🔧 DEBUG: Clearing all orders...');

  const beforeCount = historicalData.getActiveMissions().length;

  // Clear all missions
  historicalData.clearAllMissions();

  // Broadcast updated missions to all clients
  io.emit('missions:updated', {
    missions: []
  });

  console.log(`🔧 DEBUG: Cleared ${beforeCount} orders`);

  res.json({
    success: true,
    clearedCount: beforeCount,
    message: `Cleared ${beforeCount} orders`
  });
});

// ==================== ATC STRIP SIMULATION ====================

function emitAtcUpdated(airportId, payload, lastAction) {
  io.emit('atc:updated', {
    airportId,
    strips: payload.strips,
    manualSort: payload.manualSort,
    runwayConfig: payload.runwayConfig,
    recentHistory: payload.recentHistory,
    nextActions: payload.nextActions,
    roleSlots: payload.roleSlots,
    tocQueue: payload.tocQueue,
    lastAction,
  });
}

function requireAtcSession(req, res) {
  if (!req.session?.user?.id) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

app.get('/api/atc/board', (req, res) => {
  const airportId = String(req.query.airportId || 'aleppo');
  res.json(atcStripsService.getBoardPayload(airportId));
});

app.post('/api/atc/role/claim', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const role = String(req.body?.role || '').toUpperCase();
  const result = atcStripsService.claimRole(airportId, role, req.session.user);
  if (result.error) {
    return res.status(result.status || 400).json({
      error: result.error,
      occupiedBy: result.occupiedBy || null,
    });
  }
  emitAtcUpdated(airportId, result.payload, 'CLAIM_ROLE');
  res.json(result.payload);
});

app.post('/api/atc/role/release', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const role = String(req.body?.role || '').toUpperCase();
  const result = atcStripsService.releaseRole(airportId, role, req.session.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  emitAtcUpdated(airportId, result.payload, 'RELEASE_ROLE');
  res.json(result.payload);
});

app.post('/api/atc/strips/:id/cancel-handoff', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const result = atcStripsService.cancelHandoffStrip(airportId, req.params.id, req.body || {}, req.session.user);
  if (result.error) return res.status(result.status || 400).json({ error: result.error });
  emitAtcUpdated(airportId, result.payload, result.lastAction);
  res.json({ strip: result.strip, ...result.payload });
});

app.get('/api/atc/history', (req, res) => {
  const airportId = req.query.airportId ? String(req.query.airportId) : undefined;
  const stripId = req.query.stripId ? String(req.query.stripId) : undefined;
  const limit = Number(req.query.limit || 200);
  res.json({ entries: atcStripsService.getHistory({ airportId, stripId, limit }) });
});

app.post('/api/atc/board/settings', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const payload = atcStripsService.setManualSort(airportId, req.body?.manualSort);
  emitAtcUpdated(airportId, payload, 'SETTINGS');
  res.json(payload);
});

app.post('/api/atc/board/runway', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const { role, ...config } = req.body || {};
  const result = atcStripsService.setRunwayConfig(airportId, config, req.session.user, role);
  if (result.error) return res.status(result.status).json({ error: result.error });
  emitAtcUpdated(airportId, result, 'RUNWAY_CONFIG');
  res.json(result);
});

app.post('/api/atc/strips', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const result = atcStripsService.createStrip(airportId, req.body || {}, req.session.user);
  emitAtcUpdated(airportId, result.payload, result.lastAction);
  res.status(201).json({ strip: result.strip, ...result.payload });
});

app.patch('/api/atc/strips/:id', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || req.query.airportId || 'aleppo');
  const result = atcStripsService.updateStrip(airportId, req.params.id, req.body || {}, req.session.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  emitAtcUpdated(airportId, result.payload, result.lastAction);
  res.json({ strip: result.strip, ...result.payload });
});

app.post('/api/atc/strips/:id/move', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const result = atcStripsService.moveStrip(airportId, req.params.id, req.body || {}, req.session.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  emitAtcUpdated(airportId, result.payload, result.lastAction);
  res.json({ strip: result.strip, ...result.payload });
});

app.post('/api/atc/strips/:id/coordination', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.body?.airportId || 'aleppo');
  const result = atcStripsService.coordinateStrip(airportId, req.params.id, req.body || {}, req.session.user);
  if (result.error) return res.status(result.status).json({ error: result.error });
  emitAtcUpdated(airportId, result.payload, result.lastAction);
  res.json({ strip: result.strip, ...result.payload });
});

app.delete('/api/atc/strips/:id', (req, res) => {
  if (!requireAtcSession(req, res)) return;
  const airportId = String(req.query.airportId || req.body?.airportId || 'aleppo');
  const result = atcStripsService.deleteStrip(airportId, req.params.id, req.session.user, req.body?.role);
  if (result.error) return res.status(result.status).json({ error: result.error });
  emitAtcUpdated(airportId, result.payload, result.lastAction);
  res.json(result.payload);
});

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Send current data on connection
  socket.emit('data:initial', currentData);
  socket.emit('airbase:status', airbaseStatusManager.getAirbaseStatus());
  socket.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });
  socket.emit('feed:updated', {
    events: feedService.getFeedEvents(250),
  });
  socket.emit('convoys:updated', {
    convoys: convoysService.getConvoys(),
  });
  socket.emit('dcsar:updated', {
    points: dcsarPoints,
  });
  socket.emit('airlift-players:updated', {
    players: airliftPlayers,
  });
  socket.emit('frontline:updated', {
    zones: buildFrontlineZonesPayload(loadFrontlineZonesFromFile()),
  });
  socket.emit('logistics-route-visibility:updated', {
    hiddenAirportIds: getHiddenLogisticsRouteAirportIdsPayload(),
  });
  socket.emit('production-points:updated', {
    productionPoints,
  });
  socket.emit('web-spawn-markers:updated', {
    markers: webSpawnMarkers,
  });
  socket.emit('tanker-routes:updated', {
    routes: tankerRoutes,
  });
  socket.emit('dbuild-placements:updated', {
    placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
    sites: dbuildSites,
  });
  socket.emit('dbuild-sites:updated', {
    sites: dbuildSites,
    placements: enrichDbuildPlacements(dbuildPlacementsService.getPlacements()),
  });
  socket.emit('atc:updated', {
    airportId: 'aleppo',
    ...atcStripsService.getBoardPayload('aleppo'),
    lastAction: 'INITIAL',
  });

  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);
  });
});

// ==================== FILE WATCHER ====================

// Watch CSV files for changes
const watcher = chokidar.watch('*.csv', {
  cwd: CSV_DIR,
  persistent: true,
  ignoreInitial: true,
  depth: 0,
  ignored: [
    '**/node_modules/**',
    '**/.git/**',
    '**/frontend/**',
    '**/dist/**',
  ],
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 100
  }
});

watcher.on('change', (filename) => {
  console.log(`📝 CSV file changed: ${filename}`);

  scheduleRefresh('file-change');
});

watcher.on('error', (error) => {
  console.error('File watcher error:', error);
});

let airbaseStatusWatcher = null;
if (AIRBASE_STATUS_FILE) {
  airbaseStatusWatcher = chokidar.watch(AIRBASE_STATUS_FILE, {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1000,
      pollInterval: 100
    }
  });

  airbaseStatusWatcher.on('change', () => {
    console.log('🏠 Airbase status file changed, reloading...');
    loadAirbaseStatus();
    scheduleRefresh('airbase-status-change');
  });

  airbaseStatusWatcher.on('error', (error) => {
    console.error('Airbase status file watcher error:', error);
  });
}

// Buffered Lua zone sync (refreshes every 5 minutes by default)
const luaZoneWatcher = luaZoneSync.initialize((result) => {
  if (result.success) {
    console.log(`🎯 Lua zones synced (${result.count} zones) - regenerating combat missions...`);

    const nextStatusMap = new Map();
    (Array.isArray(result.zones) ? result.zones : []).forEach((zone) => {
      if (!zone?.id) return;
      const status = zone.status || 'UNKNOWN';
      nextStatusMap.set(zone.id, status);

      const previousStatus = lastZoneStatusById.get(zone.id);
      if (previousStatus && previousStatus !== status) {
        pushFeedEvent({
          type: 'zone.status_changed',
          title: 'Zone control changed',
          message: `${zone.name || zone.id} changed from ${previousStatus} to ${status}`,
          zone_id: zone.id,
          metadata: {
            previous_status: previousStatus,
            next_status: status,
          },
        });
      }
    });
    lastZoneStatusById = nextStatusMap;

    // Regenerate combat missions from updated zones
    const missions = combatMissionDispatch.refreshCombatMissions();

    // Broadcast updated missions to all clients
    io.emit('combat-missions:updated', {
      missions: combatMissionDispatch.getAllCombatMissions()
    });

    emitFrontlineUpdate(result.zones);

    console.log(`✅ Regenerated ${missions.length} combat missions`);
  }
}, {
  bufferFilePath: LUA_ZONE_BUFFER_PATH,
  intervalMs: LUA_ZONE_BUFFER_INTERVAL_MS
});

// ==================== SCHEDULED TASKS ====================

// Clean up expired missions every 5 minutes
setInterval(() => {
  const expired = historicalData.cleanupExpiredMissions();
  if (expired > 0) {
    console.log(`🧹 Cleaned up ${expired} expired missions`);
    io.emit('missions:updated', {
      missions: historicalData.getActiveMissions()
    });
  }
}, 5 * 60 * 1000);

// Keep policy enforced even if old data is loaded from storage
setInterval(() => {
  const expiredCarrierMissions = historicalData.expireCarrierDestinationMissions();
  if (expiredCarrierMissions > 0) {
    io.emit('missions:updated', {
      missions: historicalData.getActiveMissions()
    });
  }

  const expiredCarrierSourceDistanceMissions = historicalData.expireCarrierSourceMissionsBeyondDistance();
  if (expiredCarrierSourceDistanceMissions > 0) {
    io.emit('missions:updated', {
      missions: historicalData.getActiveMissions()
    });
  }
}, 60 * 1000);

// Regenerate unaccepted logistics missions every 10 minutes
setInterval(() => {
  const expiredPending = historicalData.expirePendingMissionsOlderThan(10 * 60 * 1000);
  if (expiredPending > 0) {
    console.log(`🔁 Expired ${expiredPending} stale pending missions (10-minute policy)`);
    io.emit('missions:updated', {
      missions: historicalData.getActiveMissions()
    });
  }

  scheduleRefresh('pending-regeneration-10m');
}, 10 * 60 * 1000);

// Expire accepted zone operations after TTL and broadcast updates
setInterval(() => {
  const changed = cleanupExpiredZoneOperations();
  if (changed) {
    emitFrontlineUpdate();
  }
}, 10 * 1000);

// Check for new orders every 5 minutes (automatic polling)
setInterval(() => {
  console.log('⏰ 5-minute check: Scanning for critical weapons...');
  scheduleRefresh('scheduled');
}, 5 * 60 * 1000); // Every 5 minutes

// Poll local DCS convoy export (file-based integration, no external API calls from mission)
setInterval(() => {
  syncConvoysFromFile();
}, 2000);

// Poll DCSAR exported positions (line-based file of coordinates)
setInterval(() => {
  syncDcsarFromFile();
}, 2000);

// Poll tracked airlift players exported by mission script
setInterval(() => {
  syncAirliftPlayersFromFile();
}, 2000);

// Poll Production Points state exported by DCORE (DSCORE_Rigs.lua)
setInterval(() => {
  syncProductionPointsFromFile();
}, 2000);

// Poll web command results written by DCORE (DBRIDGE) and prune the queue
setInterval(() => {
  syncWebCommandResultsFromFile();
}, 2000);

// Poll tracked crate positions exported by DMAS
setInterval(() => {
  syncWebSpawnMarkersFromFile();
}, 2000);

// Poll active tanker racetracks exported by DMAS
setInterval(() => {
  syncTankerRoutesFromFile();
}, 2000);

// Poll DBUILD sites exported by DCORE-LIDC
setInterval(() => {
  syncDbuildSitesFromFile();
}, 2000);

// Poll LIDC UCID link requests written by DCS hook
setInterval(() => {
  syncLidcLinkRequestsFromFile();
}, 2000);

// Poll LIDC warehouse ops acknowledgments from DLIDC mission module
setInterval(() => {
  syncLidcWarehouseOpsAckFromFile();
}, 2000);

// Poll LIDC airframe state exported by DLIDC mission module
setInterval(() => {
  syncLidcAirframeStateFromFile();
}, 2000);

// Refresh LIDC access policy for DCS enforcement
setInterval(() => {
  lidcService.exportLidcPolicy();
}, 30000);

// ==================== START SERVER ====================

// Load airbase status first
loadAirbaseStatus();
loadHiddenLogisticsRouteAirportIds();

// Load initial data
await loadFromBuffer();

// Enforce logistics mission policies on startup
const expiredCarrierDestinationAtBoot = historicalData.expireCarrierDestinationMissions();
const expiredCarrierSourceDistanceAtBoot = historicalData.expireCarrierSourceMissionsBeyondDistance();
if (expiredCarrierDestinationAtBoot > 0 || expiredCarrierSourceDistanceAtBoot > 0) {
  io.emit('missions:updated', {
    missions: historicalData.getActiveMissions()
  });
}

// Reset convoy state at each backend restart
convoysService.clearAllConvoys();
io.emit('convoys:updated', {
  convoys: convoysService.getConvoys(),
});

// Initial convoy sync from local JSON exported by DCS scripts
syncConvoysFromFile();
syncDcsarFromFile();
syncAirliftPlayersFromFile();

// Initialize DCORE bridge state
bootstrapWebCommandFeedDedup();
loadWebCommandsQueue();
syncProductionPointsFromFile();
syncWebCommandResultsFromFile();
syncWebSpawnMarkersFromFile();
syncTankerRoutesFromFile();
syncDbuildSitesFromFile();
exportPendingWarehouseOps();
syncLidcLinkRequestsFromFile();
syncLidcWarehouseOpsAckFromFile();
lidcService.exportLidcAirframeRegistry();
lidcService.exportLidcPolicy();
syncLidcAirframeStateFromFile();
atcStripsService.initAtcStripsService();

httpServer.listen(PORT, '127.0.0.1', () => {
  const activeAirports = airbaseStatusManager.getActiveAirports();
  logger.info(`
╔═══════════════════════════════════════════════════════╗
║   🎮 DCS Warehouse Viewer Server                     ║
║                                                       ║
║   Server running on: http://localhost:${PORT}         ║
║   Environment: ${process.env.NODE_ENV || 'development'}                    ║
║   CSV Directory: ${CSV_DIR.substring(0, 35)}...      ║
║   Airports: ${activeAirports.length}/${airports.length} active                    ║
║                                                       ║
║   API: http://localhost:${PORT}/api/airports         ║
║   Missions: http://localhost:${PORT}/api/missions    ║
╚═══════════════════════════════════════════════════════╝
  `);
  if (isAuthBypassEnabled()) {
    logger.warn('AUTH BYPASS LOCAL enabled — Discord login not required in development');
  }
  logger.info(`SQLite store: ${getSqlitePath()}`);
});

// ==================== ADMIN ENDPOINTS ====================

const ADMIN_PASSWORD_HASH = resolveAdminPasswordHash();

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many admin login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/admin/login - Verify admin password and return JWT
 */
app.post('/api/admin/login', adminLoginLimiter, async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    if (!ADMIN_PASSWORD_HASH) {
      return res.status(503).json({
        success: false,
        message: 'Admin login is not configured'
      });
    }

    const valid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (valid) {
      const token = generateToken({
        role: 'admin',
        timestamp: Date.now()
      });

      logger.security('Admin login successful', {
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Login successful',
        token
      });
    } else {
      logger.security('Admin login failed - invalid password', {
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString()
      });

      res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

/**
 * GET /api/admin/config/rules - Get rules configuration (requires authentication)
 */
app.get('/api/admin/config/rules', authenticateToken, requireAdmin, (req, res) => {
  try {
    // Import the config dynamically to get the latest version
    import('./config/rules.config.js').then(module => {
      res.json(module.missionRules);
    }).catch(err => {
      console.error('Error loading rules config:', err);
      res.status(500).json({ error: 'Failed to load config' });
    });
  } catch (error) {
    console.error('Error in /api/admin/config/rules:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/admin/config/airports - Get airports configuration with status (requires authentication)
 */
app.get('/api/admin/config/airports', authenticateToken, requireAdmin, (req, res) => {
  try {
    const airbaseStatusData = airbaseStatusManager.getAirbaseStatus();
    const airportsWithStatus = airports.map(airport => ({
      ...airport,
      isActive: airbaseStatusManager.isAirportActive(airport)
    }));

    res.json({
      airports: airportsWithStatus,
      statusFile: airbaseStatusData,
      summary: {
        total: airports.length,
        active: airportsWithStatus.filter(a => a.isActive).length,
        inactive: airportsWithStatus.filter(a => !a.isActive).length
      }
    });
  } catch (error) {
    console.error('Error in /api/admin/config/airports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ==================== FRONTEND SERVING ====================

// Serve static files from frontend build
app.use(express.static(path.resolve(__dirname, '../../frontend/dist')));

// SPA fallback - serve index.html for all non-API routes
app.get('*', (req, res, next) => {
  // Skip API routes - let them hit 404 handler
  if (req.path.startsWith('/api/') || req.path.startsWith('/charts/') || req.path.startsWith('/sfx/')) {
    return next();
  }

  // Serve index.html for all other routes (SPA routing)
  res.sendFile(path.resolve(__dirname, '../../frontend/dist/index.html'));
});

// ==================== ERROR HANDLERS ====================

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// ==================== GRACEFUL SHUTDOWN ====================
function shutdown() {
  console.log('👋 Shutting down gracefully...');
  watcher.close();
  airbaseStatusWatcher?.close();
  if (luaZoneWatcher && typeof luaZoneWatcher.stop === 'function') {
    luaZoneWatcher.stop();
  }
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

