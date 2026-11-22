/**
 * HIDC missions: one mission per zone of the active region, accepted from the site and completed in DCS.
 *
 * Generation (zone tasks from DCORE DMAP Export_Dzone_ActiveTask.json, zone status from Export_Dzone_Status.json):
 *   - zone with SEAD                  -> SEAD
 *   - zone with DEAD (with or without CAS) -> DEAD
 *   - zone with CAS only              -> CAS
 *   - empty zone (status NEUTRAL, white) -> LOGISTICS
 * When SEAD is cleared on a "SEAD, DEAD, CAS" zone the DEAD mission appears, and so on.
 *
 * A pilot accepts a mission and has HIDC_MISSION_DURATION_MIN (default 120) to complete it.
 * The mission is complete when its task is no longer active on the zone (LOGISTICS: the zone turned BLUE)
 * and the pilot flew in DCS after accepting (DCSServerBot sorties, or DBRIDGE last_seen).
 * A completed mission adds XP to the pilot's level (stored here, per Discord account).
 */
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

export const MISSION_TYPES = Object.freeze(['SEAD', 'DEAD', 'CAS', 'LOGISTICS']);

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envIntOrZero(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export const MISSION_RULES = Object.freeze({
  durationMs: envInt('HIDC_MISSION_DURATION_MIN', 120) * 60 * 1000,
  maxActive: envInt('HIDC_MISSION_MAX_ACTIVE', 2),
  // The task must stay cleared this long before the mission counts as done (export glitches, mission restarts).
  confirmMs: envIntOrZero('HIDC_MISSION_CONFIRM_SEC', 90) * 1000,
  // XP is given only if the pilot flew in DCS after accepting.
  requireFlight: String(process.env.HIDC_MISSION_REQUIRE_FLIGHT || 'true').toLowerCase() !== 'false',
  xp: Object.freeze({
    SEAD: envIntOrZero('HIDC_MISSION_XP_SEAD', 60),
    DEAD: envIntOrZero('HIDC_MISSION_XP_DEAD', 50),
    CAS: envIntOrZero('HIDC_MISSION_XP_CAS', 40),
    LOGISTICS: envIntOrZero('HIDC_MISSION_XP_LOGISTICS', 40),
  }),
});

const HISTORY_LIMIT = 300;
const RECENT_LIMIT = 3;

function zoneTasks(zone) {
  return (Array.isArray(zone?.tasks) ? zone.tasks : []).map((task) => String(task).trim().toUpperCase());
}

function zoneStatus(zone) {
  return String(zone?.status || '').trim().toUpperCase();
}

/** Mission type a zone generates now, or null. */
export function missionTypeForZone(zone) {
  const tasks = zoneTasks(zone);
  if (tasks.includes('SEAD')) return 'SEAD';
  if (tasks.includes('DEAD')) return 'DEAD';
  if (tasks.includes('CAS')) return 'CAS';
  if (zoneStatus(zone) === 'NEUTRAL') return 'LOGISTICS';
  return null;
}

/** Is the mission's task still active on the zone? */
function taskActive(type, zone) {
  if (type === 'LOGISTICS') return zoneStatus(zone) === 'NEUTRAL';
  return zoneTasks(zone).includes(type);
}

/**
 * @param {object} deps
 * @param {() => Array} deps.getZones              frontline zones (id, status, tasks)
 * @param {() => object} deps.readFocus            active region (target, target_zones)
 * @param {(user: object) => object} deps.requirePilot  throws if the Discord user has no linked DCS pilot
 * @param {(discordId: string, sinceMs: number) => boolean|null} deps.flewSince  null = no flight data
 * @param {(event: string, payload: object) => void} deps.emit
 * @param {(event: object) => void} [deps.pushFeed]
 */
export function createHidcMissions(deps) {
  function readState() {
    const raw = loadJson(DOC.HIDC_MISSIONS, null) || {};
    return {
      board: raw.board && typeof raw.board === 'object' ? raw.board : {},
      active: Array.isArray(raw.active) ? raw.active : [],
      history: Array.isArray(raw.history) ? raw.history : [],
      xp: raw.xp && typeof raw.xp === 'object' ? raw.xp : {},
    };
  }

  function writeState(state) {
    saveJson(DOC.HIDC_MISSIONS, {
      board: state.board,
      active: state.active,
      history: state.history.slice(0, HISTORY_LIMIT),
      xp: state.xp,
    });
  }

  function zonesById() {
    const zones = deps.getZones() || [];
    return new Map(zones.filter((zone) => zone?.id).map((zone) => [String(zone.id), zone]));
  }

  /** Brings the board in line with the zones: new missions appear, cleared ones go. */
  function syncBoard(state, zones, now) {
    if (zones.size === 0) return false; // no zone data (file missing): leave the board alone
    const focus = deps.readFocus();
    let changed = false;
    const wanted = new Map();
    zones.forEach((zone, zoneId) => {
      const type = missionTypeForZone(zone);
      if (type) wanted.set(`${zoneId}|${type}`, { zoneId, type });
    });
    Object.values(state.board).forEach((mission) => {
      if (!wanted.has(`${mission.zoneId}|${mission.type}`)) {
        delete state.board[mission.id];
        changed = true;
      } else {
        wanted.delete(`${mission.zoneId}|${mission.type}`);
      }
    });
    wanted.forEach(({ zoneId, type }) => {
      const id = `${zoneId}:${type}:${now}`;
      state.board[id] = { id, zoneId, type, region: focus?.target || null, createdAt: now };
      changed = true;
    });
    return changed;
  }

  function closeAssignment(state, assignment, status, now, extra = {}) {
    state.active = state.active.filter((entry) => entry.id !== assignment.id);
    const closed = { ...assignment, ...extra, status, closedAt: now };
    state.history.unshift(closed);
    return closed;
  }

  function award(state, assignment) {
    const xp = MISSION_RULES.xp[assignment.type] || 0;
    const row = state.xp[assignment.discordId] || { total: 0, completed: 0, byType: {} };
    row.total += xp;
    row.completed += 1;
    row.byType[assignment.type] = (row.byType[assignment.type] || 0) + 1;
    state.xp[assignment.discordId] = row;
    return xp;
  }

  /** Checks every accepted mission: completed, waiting for a flight, expired or cancelled. */
  function evaluate(state, zones, now) {
    if (zones.size === 0) return [];
    const focus = deps.readFocus();
    const events = [];
    [...state.active].forEach((assignment) => {
      const zone = zones.get(assignment.zoneId);
      const status = zoneStatus(zone);
      const cleared = Boolean(zone) && !taskActive(assignment.type, zone);

      if (cleared) {
        // Region switched while the task was open: the zone left the active region, it was not done by the pilot.
        const capturedByBlue = status === 'BLUE';
        const outOfFocus = Boolean(focus?.target && assignment.region && focus.target !== assignment.region);
        const lostLogistics = assignment.type === 'LOGISTICS' && !capturedByBlue;
        if (!capturedByBlue && (outOfFocus || lostLogistics)) {
          events.push({ kind: 'cancelled', entry: closeAssignment(state, assignment, 'cancelled', now) });
          return;
        }
        if (!assignment.clearSeenAt) {
          if (now > assignment.expiresAt) {
            events.push({ kind: 'expired', entry: closeAssignment(state, assignment, 'expired', now) });
            return;
          }
          assignment.clearSeenAt = now;
        }
      } else if (assignment.clearSeenAt && !assignment.clearedAt) {
        assignment.clearSeenAt = null; // came back before confirmation (export glitch)
      }

      if (assignment.clearSeenAt && !assignment.clearedAt && now - assignment.clearSeenAt >= MISSION_RULES.confirmMs) {
        assignment.clearedAt = assignment.clearSeenAt;
      }

      if (assignment.clearedAt) {
        const flew = deps.flewSince(assignment.discordId, assignment.acceptedAt);
        if (flew === true || !MISSION_RULES.requireFlight) {
          const xp = award(state, assignment);
          events.push({ kind: 'completed', entry: closeAssignment(state, assignment, 'completed', now, { xp }) });
          return;
        }
        // Task done but no flight yet in DCS data (the bot snapshot lags a minute): keep waiting until expiry.
      }

      if (now > assignment.expiresAt) {
        events.push({
          kind: 'expired',
          entry: closeAssignment(state, assignment, 'expired', now, assignment.clearedAt ? { reason: 'no-flight' } : {}),
        });
      }
    });
    return events;
  }

  function announce(events) {
    events.forEach(({ kind, entry }) => {
      if (kind !== 'completed') return;
      deps.pushFeed?.({
        type: 'ato.mission.completed',
        title: 'Missione completata',
        message: `${entry.pilotName || 'Un pilota'} ha completato ${entry.type} su ${entry.zoneId} (+${entry.xp} XP)`,
        actor: entry.pilotName || null,
        zone_id: entry.zoneId,
        metadata: { zone_id: entry.zoneId, type: entry.type, xp: entry.xp },
      });
    });
  }

  function tick(now = Date.now()) {
    const state = readState();
    const zones = zonesById();
    const boardChanged = syncBoard(state, zones, now);
    const before = JSON.stringify(state.active);
    const events = evaluate(state, zones, now);
    if (boardChanged || events.length > 0 || JSON.stringify(state.active) !== before) {
      writeState(state);
      deps.emit('hidc:campaign-updated', { reason: 'missions' });
    }
    announce(events);
    return events;
  }

  function accept(user, missionId, now = Date.now()) {
    const pilot = deps.requirePilot(user, 0, 'accettare una missione');
    const state = readState();
    syncBoard(state, zonesById(), now);
    const mission = state.board[missionId];
    if (!mission) {
      const error = new Error('Missione non piu disponibile.');
      error.status = 404;
      throw error;
    }
    const mine = state.active.filter((entry) => entry.discordId === user.id);
    if (mine.some((entry) => entry.missionId === missionId)) {
      const error = new Error('Hai gia accettato questa missione.');
      error.status = 409;
      throw error;
    }
    if (mine.length >= MISSION_RULES.maxActive) {
      const error = new Error(MISSION_RULES.maxActive === 1
        ? 'Hai gia una missione in corso: completala o abbandonala prima.'
        : `Puoi avere al massimo ${MISSION_RULES.maxActive} missioni in corso.`);
      error.status = 409;
      throw error;
    }
    const assignment = {
      id: crypto.randomUUID(),
      missionId,
      zoneId: mission.zoneId,
      type: mission.type,
      region: mission.region || deps.readFocus()?.target || null,
      discordId: user.id,
      pilotName: pilot.stats?.name || pilot.link?.name || user.username || null,
      acceptedAt: now,
      expiresAt: now + MISSION_RULES.durationMs,
      clearSeenAt: null,
      clearedAt: null,
    };
    state.active.push(assignment);
    writeState(state);
    deps.emit('hidc:campaign-updated', { reason: 'mission-accepted' });
    deps.pushFeed?.({
      type: 'ato.mission.accepted',
      title: 'Missione accettata',
      message: `${assignment.pilotName || 'Un pilota'} ha accettato ${assignment.type} su ${assignment.zoneId}`,
      actor: assignment.pilotName,
      zone_id: assignment.zoneId,
      metadata: { zone_id: assignment.zoneId, type: assignment.type, expires_at: assignment.expiresAt },
    });
    return assignment;
  }

  function abandon(user, assignmentId, now = Date.now()) {
    const state = readState();
    const assignment = state.active.find((entry) => entry.id === assignmentId && entry.discordId === user.id);
    if (!assignment) {
      const error = new Error('Missione non trovata.');
      error.status = 404;
      throw error;
    }
    closeAssignment(state, assignment, 'abandoned', now);
    writeState(state);
    deps.emit('hidc:campaign-updated', { reason: 'mission-abandoned' });
  }

  /** Mission XP of a Discord account (added to the pilot level). */
  function xpFor(discordId) {
    const row = readState().xp[discordId];
    return row ? { total: Number(row.total) || 0, completed: Number(row.completed) || 0, byType: row.byType || {} } : { total: 0, completed: 0, byType: {} };
  }

  function allXp() {
    return readState().xp;
  }

  function publicAssignment(entry) {
    return {
      id: entry.id,
      missionId: entry.missionId,
      zoneId: entry.zoneId,
      type: entry.type,
      xp: entry.xp ?? (MISSION_RULES.xp[entry.type] || 0),
      acceptedAt: entry.acceptedAt,
      expiresAt: entry.expiresAt,
      // Task done in DCS, waiting for the pilot's flight to show up in the stats.
      awaitingFlight: Boolean(entry.clearedAt),
      status: entry.status || 'active',
      closedAt: entry.closedAt || null,
      reason: entry.reason || null,
    };
  }

  function getPublicState(user, now = Date.now()) {
    const state = readState();
    const discordId = user?.id || null;
    const pilotsByMission = new Map();
    state.active.forEach((entry) => {
      const list = pilotsByMission.get(entry.missionId) || [];
      list.push(entry.pilotName || '?');
      pilotsByMission.set(entry.missionId, list);
    });
    const mine = discordId ? state.active.filter((entry) => entry.discordId === discordId) : [];
    return {
      rules: {
        durationMin: Math.round(MISSION_RULES.durationMs / 60000),
        maxActive: MISSION_RULES.maxActive,
        requireFlight: MISSION_RULES.requireFlight,
        xp: MISSION_RULES.xp,
      },
      available: Object.values(state.board)
        .map((mission) => ({
          id: mission.id,
          zoneId: mission.zoneId,
          type: mission.type,
          xp: MISSION_RULES.xp[mission.type] || 0,
          createdAt: mission.createdAt,
          pilots: pilotsByMission.get(mission.id) || [],
          mine: mine.some((entry) => entry.missionId === mission.id),
        }))
        .sort((a, b) => MISSION_TYPES.indexOf(a.type) - MISSION_TYPES.indexOf(b.type)
          || a.zoneId.localeCompare(b.zoneId, undefined, { numeric: true })),
      mine: discordId
        ? {
          active: mine.map(publicAssignment),
          recent: state.history.filter((entry) => entry.discordId === discordId).slice(0, RECENT_LIMIT).map(publicAssignment),
          xp: xpFor(discordId),
          canAccept: mine.length < MISSION_RULES.maxActive,
        }
        : null,
      now,
    };
  }

  return { tick, accept, abandon, xpFor, allXp, getPublicState, _internals: { readState, syncBoard, evaluate } };
}

export default { createHidcMissions, missionTypeForZone, MISSION_RULES, MISSION_TYPES };
