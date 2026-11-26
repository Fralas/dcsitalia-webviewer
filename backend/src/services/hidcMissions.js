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
 *
 * CAP (DCORE DBRIDGE_Cap.lua, Export_CAP_Status.json): area = active RED region (focus target) + BLUE region the
 * attack starts from (focus from). Offered while at least one RED airplane or helicopter is airborne in the area.
 * It never completes early (RED aircraft shot down, area empty): it closes HIDC_CAP_DURATION_MIN (60) after
 * acceptance, completed with XP if the pilot flew at least HIDC_CAP_MIN_AREA_MIN (30) inside the area,
 * failed otherwise. Time in area = growth of the pilot's cumulative cap_sec (per UCID) since acceptance.
 */
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

export const MISSION_TYPES = Object.freeze(['CAP', 'SEAD', 'DEAD', 'CAS', 'LOGISTICS']);

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
  cap: Object.freeze({
    durationMs: envInt('HIDC_CAP_DURATION_MIN', 60) * 60 * 1000,
    minAreaMs: envInt('HIDC_CAP_MIN_AREA_MIN', 30) * 60 * 1000,
    // Export_CAP_Status.json older than this (DCS down): no new CAP offered, time not counted.
    staleMs: envInt('HIDC_CAP_STALE_SEC', 180) * 1000,
  }),
  xp: Object.freeze({
    CAP: envIntOrZero('HIDC_MISSION_XP_CAP', 50),
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

function durationMsFor(type) {
  return type === 'CAP' ? MISSION_RULES.cap.durationMs : MISSION_RULES.durationMs;
}

/** Fresh CAP status from DCORE, or null (file missing or older than staleMs). */
function freshCapStatus(raw, now) {
  if (!raw || typeof raw !== 'object') return null;
  const updatedMs = (Number(raw.updated_at) || 0) * 1000;
  if (!updatedMs || now - updatedMs > MISSION_RULES.cap.staleMs) return null;
  return raw;
}

/** CAP area { target, from, regions } when at least one RED airplane/helicopter is airborne in it, else null. */
function capOffer(status) {
  if (!status?.target) return null;
  const regions = [status.target, status.from].filter((region, index, list) => region && list.indexOf(region) === index);
  const redAir = status.red_air && typeof status.red_air === 'object' ? status.red_air : {};
  const present = regions.some((region) => (
    (Number(redAir[region]?.airplane) || 0) + (Number(redAir[region]?.helicopter) || 0) > 0
  ));
  return present ? { target: status.target, from: status.from || null, regions } : null;
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
 * @param {() => object|null} [deps.readCapStatus]  DCORE Export_CAP_Status.json
 * @param {(discordId: string) => string[]} [deps.ucidsFor]  DCS UCIDs linked to the Discord account
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

  function readCap(now) {
    return freshCapStatus(typeof deps.readCapStatus === 'function' ? deps.readCapStatus() : null, now);
  }

  /** Cumulative seconds in the CAP area of the pilot's UCIDs; 0 if never seen there, null without CAP data. */
  function capSecFor(capStatus, discordId) {
    if (!capStatus) return null;
    const pilots = capStatus.pilots && typeof capStatus.pilots === 'object' ? capStatus.pilots : {};
    const ucids = typeof deps.ucidsFor === 'function' ? deps.ucidsFor(discordId) || [] : [];
    return ucids.reduce((sum, ucid) => sum + (Number(pilots[ucid]?.cap_sec) || 0), 0);
  }

  /** Brings the board in line with the zones and the CAP area: new missions appear, cleared ones go. */
  function syncBoard(state, zones, now, capStatus = readCap(now)) {
    const haveZones = zones.size > 0; // no zone data (file missing): leave the zone missions alone
    const focus = deps.readFocus();
    let changed = false;
    const wanted = new Map();
    if (haveZones) {
      zones.forEach((zone, zoneId) => {
        const type = missionTypeForZone(zone);
        if (type) wanted.set(`${zoneId}|${type}`, { zoneId, type });
      });
    }
    const offer = capOffer(capStatus);
    if (offer) wanted.set(`${offer.target}|CAP`, { zoneId: offer.target, type: 'CAP', regions: offer.regions });
    Object.values(state.board).forEach((mission) => {
      const key = `${mission.zoneId}|${mission.type}`;
      if (!haveZones && mission.type !== 'CAP') return;
      if (!wanted.has(key)) {
        delete state.board[mission.id];
        changed = true;
      } else {
        wanted.delete(key);
      }
    });
    wanted.forEach(({ zoneId, type, regions }) => {
      const id = `${zoneId}:${type}:${now}`;
      state.board[id] = { id, zoneId, type, region: focus?.target || null, createdAt: now, ...(regions ? { regions } : {}) };
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

  /**
   * CAP: adds the growth of the pilot's cap_sec to the assignment, closes it only at expiry.
   * Counter reset in DCORE (value below the last one): the new value is all time since the reset.
   */
  function evaluateCap(state, assignment, capStatus, now) {
    const value = capSecFor(capStatus, assignment.discordId);
    if (value != null) {
      const last = assignment.capLast;
      if (last == null) assignment.capLast = value;
      else if (value !== last) {
        assignment.capSec = (Number(assignment.capSec) || 0) + (value > last ? value - last : value);
        assignment.capLast = value;
      }
    }
    if (now < assignment.expiresAt) return null;
    const capSec = Number(assignment.capSec) || 0;
    if (capSec * 1000 >= MISSION_RULES.cap.minAreaMs) {
      const xp = award(state, assignment);
      return { kind: 'completed', entry: closeAssignment(state, assignment, 'completed', now, { xp }) };
    }
    return { kind: 'failed', entry: closeAssignment(state, assignment, 'failed', now, { reason: 'cap-time' }) };
  }

  /** Checks every accepted mission: completed, waiting for a flight, expired or cancelled. */
  function evaluate(state, zones, now, capStatus = readCap(now)) {
    const focus = deps.readFocus();
    const events = [];
    [...state.active].forEach((assignment) => {
      if (assignment.type === 'CAP') {
        const event = evaluateCap(state, assignment, capStatus, now);
        if (event) events.push(event);
        return;
      }
      if (zones.size === 0) return;
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
    const capStatus = readCap(now);
    const boardChanged = syncBoard(state, zones, now, capStatus);
    const before = JSON.stringify(state.active);
    const events = evaluate(state, zones, now, capStatus);
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
    const capStatus = readCap(now);
    syncBoard(state, zonesById(), now, capStatus);
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
      expiresAt: now + durationMsFor(mission.type),
      clearSeenAt: null,
      clearedAt: null,
    };
    if (mission.type === 'CAP') {
      assignment.regions = Array.isArray(mission.regions) ? mission.regions : [mission.zoneId];
      assignment.capSec = 0;
      // Baseline of the cumulative counter; null without CAP data now (set on the first fresh export).
      assignment.capLast = capSecFor(capStatus, user.id);
    }
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
      ...(entry.type === 'CAP'
        ? {
          regions: entry.regions || [entry.zoneId],
          capMinutes: Math.floor((Number(entry.capSec) || 0) / 60),
          capRequiredMin: Math.round(MISSION_RULES.cap.minAreaMs / 60000),
        }
        : {}),
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
        cap: {
          durationMin: Math.round(MISSION_RULES.cap.durationMs / 60000),
          minAreaMin: Math.round(MISSION_RULES.cap.minAreaMs / 60000),
        },
      },
      available: Object.values(state.board)
        .map((mission) => ({
          id: mission.id,
          zoneId: mission.zoneId,
          type: mission.type,
          ...(mission.regions ? { regions: mission.regions } : {}),
          durationMin: Math.round(durationMsFor(mission.type) / 60000),
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
