import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import chokidar from 'chokidar';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import session from 'express-session';
import cookieParser from 'cookie-parser';

import airports, { getAirportById } from './config/airports.config.js';
import { isImportantWeapon, getWeaponPriority, getOrderQuantityForWeapon, getWeaponThresholds, getIsoFillForWeapon } from './config/rules.config.js';
import * as dataBuffer from './services/dataBuffer.js';
import * as historicalData from './services/historicalData.js';
import * as missionGenerator from './services/missionGenerator.js';
import { findBestSourceAirport, determineRecommendedAircraft } from './services/missionGenerator.js';
import { generateToken } from './utils/jwt.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import logger from './utils/logger.js';
import * as airbaseStatusParser from './services/airbaseStatusParser.js';
import * as airbaseStatusManager from './services/airbaseStatusManager.js';
import * as discordAuth from './services/discordAuth.js';
import * as combatMissionDispatch from './services/combatMissionDispatch.js';
import * as luaZoneSync from './services/luaZoneSync.js';
import * as activeUsers from './services/activeUsers.js';
import * as userProfiles from './services/userProfiles.js';
import * as feedService from './services/feed.js';
import * as convoysService from './services/convoys.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from backend/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const httpServer = createServer(app);

// CORS configuration based on environment
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production' ? FRONTEND_URL : '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const PORT = process.env.PORT || 3001;
const CONVOY_API_TOKEN = process.env.CONVOY_API_TOKEN || '';
// March 13, 2026 17:00 Europe/Rome (CET => 16:00 UTC)
const LAUNCH_TARGET_UTC_MS = Date.UTC(2026, 2, 13, 16, 0, 0);
const CONVOY_SYNC_FILE = process.env.CONVOY_SYNC_FILE
  ? path.resolve(process.env.CONVOY_SYNC_FILE)
  : 'C:\\DCS SERVER\\MISSION SCRIPTS\\DCORE\\src\\DMAP\\Export_Ground_Convoys.json';
const DCSAR_SYNC_FILE = process.env.DCSAR_SYNC_FILE
  ? path.resolve(process.env.DCSAR_SYNC_FILE)
  : 'C:\\DCS SERVER\\MISSION SCRIPTS\\DCORE\\src\\DMAP\\Export_DCSAR_Positions.json';

// CSV Directory - configurable via environment variable
const CSV_DIR = process.env.CSV_DIR
  ? path.resolve(process.env.CSV_DIR)
  : path.resolve(__dirname, '../../');

logger.info(`📁 CSV Directory: ${CSV_DIR}`);

// Airbase status - loaded from airbases_status.lua
const AIRBASE_STATUS_FILE = process.env.AIRBASE_STATUS_FILE
  ? path.resolve(process.env.AIRBASE_STATUS_FILE)
  : 'C:\\Users\\DCS ITALIA\\Saved Games\\DCS.server1\\Score_save\\Warehouse\\airbases_status.lua';
let airbaseStatus = {};

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? FRONTEND_URL : '*',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500, // limit each IP to 500 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json());
app.use(cookieParser());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dcs-italia-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

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
let zoneOperationsById = new Map();
const ZONE_OPERATION_TTL_MS = 45 * 60 * 1000;
const ZONE_OPERATION_MAX_PER_USER = 2;

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
  const lastEvent = String(entry?.last_event || '').trim().toLowerCase();
  let status = String(entry?.status || 'active').trim().toLowerCase();
  if (lastEvent === 'arrived') status = 'arrived';
  if (lastEvent === 'destroyed') status = 'destroyed';

  return {
    convoy_id: String(entry?.convoy_id || '').trim(),
    origin_zone: String(entry?.origin_zone || '').trim() || null,
    destination_zone: String(entry?.destination_zone || '').trim() || null,
    status,
    last_event: lastEvent,
    event_at: Number.isFinite(Number(entry?.event_at)) ? Number(entry.event_at) : Date.now(),
    feed_message: String(entry?.feed_message || '').trim(),
    last_update: Number.isFinite(Number(entry?.event_at)) ? Number(entry.event_at) : Date.now(),
  };
}

function syncConvoysFromFile() {
  try {
    if (!fs.existsSync(CONVOY_SYNC_FILE)) {
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
    if (!fs.existsSync(DCSAR_SYNC_FILE)) return;

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

  fs.writeFileSync(DCSAR_SYNC_FILE, `${lines.join('\n')}${lines.length > 0 ? '\n' : ''}`, 'utf8');
  dcsarSyncSignature = fs.readFileSync(DCSAR_SYNC_FILE, 'utf8');
}

/**
 * Load airbase status from airbase_status.lua file
 */
function loadAirbaseStatus() {
  try {
    airbaseStatus = airbaseStatusParser.parseAirbaseStatus(AIRBASE_STATUS_FILE);
    console.log(`🏠 Airbase status loaded: ${Object.keys(airbaseStatus).length} airbases`);

    // Update the airbase status manager (used by missionGenerator)
    airbaseStatusManager.updateAirbaseStatus(airbaseStatus);

    // Broadcast updated status to all connected clients
    io.emit('airbase:status', airbaseStatus);
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

  // Add isActive field to each airport based on airbase status
  Object.entries(airportDataMap).forEach(([airportId, airportData]) => {
    // Keep static airport metadata (including coordinates) aligned with config,
    // even when data is loaded from an old buffer snapshot.
    const airportConfig = getAirportById(airportId);
    if (airportConfig?.coordinates) {
      airportData.coordinates = airportConfig.coordinates;
    }

    // Add isActive field (carriers are always active)
    airportData.isActive = airportData.isMainBase ||
                           airportData.isCarrier ||
                           airbaseStatusManager.isAirbaseActive(airportData.name);

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
    console.log('📂 Loaded data from buffer file.');
    return processData(bufferedData);
  }

  console.warn('⚠️  Buffer file missing or unreadable. Loading directly from CSV.');
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
      globalName: discordUser.global_name || discordUser.username
    };

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
app.get('/api/auth/user', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json(req.session.user);
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
 * GET /api/airports - Get all airports with current data
 */
app.get('/api/airports', (req, res) => {
  res.json(currentData);
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

  const firstMission = selectedContainers[0]?.mission;
  const distanceNm = Number(firstMission?.distance_nm) || null;
  const recommendedAircraft = firstMission?.recommended_aircraft || 'airplane';

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

// ==================== WEBSOCKET ====================

io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // Send current data on connection
  socket.emit('data:initial', currentData);
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
  socket.emit('frontline:updated', {
    zones: buildFrontlineZonesPayload(loadFrontlineZonesFromFile()),
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

// Watch airbase_status.lua file for changes
const airbaseStatusWatcher = chokidar.watch(AIRBASE_STATUS_FILE, {
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 100
  }
});

airbaseStatusWatcher.on('change', () => {
  console.log('🏠 Airbase status file changed, reloading...');

  // Reload airbase status
  loadAirbaseStatus();

  // Refresh airport data with new active airports list
  scheduleRefresh('airbase-status-change');
});

airbaseStatusWatcher.on('error', (error) => {
  console.error('Airbase status file watcher error:', error);
});

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

// ==================== START SERVER ====================

// Load airbase status first
loadAirbaseStatus();

// Load initial data
await loadFromBuffer();

// Reset convoy state at each backend restart
convoysService.clearAllConvoys();
io.emit('convoys:updated', {
  convoys: convoysService.getConvoys(),
});

// Initial convoy sync from local JSON exported by DCS scripts
syncConvoysFromFile();
syncDcsarFromFile();

httpServer.listen(PORT, () => {
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
});

// ==================== ADMIN ENDPOINTS ====================

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  logger.error('⚠️  ADMIN_PASSWORD is not set in environment variables');
}

/**
 * POST /api/admin/login - Verify admin password and return JWT
 */
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    // Simple password comparison (in production, use hashed passwords)
    if (password === ADMIN_PASSWORD) {
      // Generate JWT token
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
      isActive: airport.isMainBase || airport.isCarrier || airbaseStatusManager.isAirbaseActive(airport.name)
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
  if (req.path.startsWith('/api/') || req.path.startsWith('/charts/')) {
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
process.on('SIGTERM', () => {
  console.log('👋 Shutting down gracefully...');
  watcher.close();
  airbaseStatusWatcher.close();
  if (luaZoneWatcher && typeof luaZoneWatcher.stop === 'function') {
    luaZoneWatcher.stop();
  }
  httpServer.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

