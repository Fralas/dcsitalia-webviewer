/**
 * HIDC campaign service: DCS pilot link, personal XP, active-region votes.
 *
 * DCORE files (same machine, see DCORE src/DBRIDGE and src/DMAP):
 *   - Export_Pilot_LinkRequests.json  hook DPILOT_LinkHook.lua appends "code|ucid|name|ts" lines (we truncate after use)
 *   - Export_Pilot_Stats.json         DBRIDGE_Pilots.lua: flight time / sorties / XP / level per UCID (read-only)
 *   - Export_DCampaign_Focus.json     DMAP_Focus.lua: active region, BLUE attack region, candidates (read-only)
 *   - Export_DRegion_Status.json      DMAP_Region.lua: region -> "blue" | "red" (read-only)
 * A passed vote is applied through the DBRIDGE command queue (type "focus_vote").
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';
import { optionalPath } from '../config/envPaths.js';
import * as discordAuth from './discordAuth.js';

const LINK_CODE_PATTERN = /^HIDC-[A-Z0-9]{6}$/;
const LINK_CODE_TTL_MS = 15 * 60 * 1000;
const REGION_PATTERN = /^REGION_\d{2}$/;

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export const VOTE_RULES = Object.freeze({
  minProposerLevel: envInt('HIDC_VOTE_MIN_LEVEL', 5),
  minVoterLevel: envInt('HIDC_VOTE_MIN_VOTER_LEVEL', 1),
  durationMs: envInt('HIDC_VOTE_DURATION_MIN', 720) * 60 * 1000,
  minVotes: envInt('HIDC_VOTE_MIN_VOTES', 3),
  cooldownMs: envInt('HIDC_VOTE_COOLDOWN_MIN', 60) * 60 * 1000,
  applyTimeoutMs: envInt('HIDC_VOTE_APPLY_TIMEOUT_MIN', 7 * 24 * 60) * 60 * 1000,
});

const HISTORY_LIMIT = 20;

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
 */
export function createHidcCampaign(deps) {
  const dbridgeDir = deps.dbridgeDir || null;
  const dcoreSrcDir = dbridgeDir ? path.dirname(dbridgeDir) : null;
  const files = {
    linkRequests: optionalPath('HIDC_PILOT_LINK_REQUESTS_FILE')
      || (dbridgeDir ? path.join(dbridgeDir, 'Export_Pilot_LinkRequests.json') : null),
    stats: optionalPath('HIDC_PILOT_STATS_FILE')
      || (dbridgeDir ? path.join(dbridgeDir, 'Export_Pilot_Stats.json') : null),
    focus: optionalPath('HIDC_FOCUS_FILE')
      || (dcoreSrcDir ? path.join(dcoreSrcDir, 'DMAP', 'Export_DCampaign_Focus.json') : null),
    regionStatus: optionalPath('HIDC_REGION_STATUS_FILE')
      || (dcoreSrcDir ? path.join(dcoreSrcDir, 'DMAP', 'Export_DRegion_Status.json') : null),
  };
  const botToken = String(process.env.DISCORD_BOT_TOKEN || '').trim();
  const voteChannelId = String(process.env.HIDC_VOTE_CHANNEL_ID || '').trim();
  const siteUrl = String(process.env.FRONTEND_URL || '').trim();
  let linkRequestsSignature = '';

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
    };
  }

  function writeVotes(state) {
    saveJson(DOC.HIDC_REGION_VOTES, {
      current: state.current || null,
      history: (state.history || []).slice(0, HISTORY_LIMIT),
    });
  }

  // ---------------------------------------------------------------- DCORE exports

  function readStats() {
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

  function levelInfo(xp, thresholds) {
    let level = 1;
    thresholds.forEach((minXp, index) => {
      if (xp >= minXp) level = index + 1;
    });
    const currentMin = thresholds[level - 1] || 0;
    const nextMin = level < thresholds.length ? thresholds[level] : null;
    return {
      level,
      xp,
      levelXp: currentMin,
      nextLevelXp: nextMin,
      maxLevel: thresholds.length,
    };
  }

  function pilotForUser(discordId, stats = readStats()) {
    const link = readLinks()[discordId] || null;
    if (!link?.ucid) return { link: null, stats: null, level: null };
    const row = stats.pilots[link.ucid] || null;
    const xp = Number(row?.xp) || 0;
    return {
      link,
      stats: row
        ? {
          name: row.name || link.name || null,
          flightSec: Number(row.flight_sec) || 0,
          sorties: Number(row.sorties) || 0,
          lastSeen: Number(row.last_seen) || null,
        }
        : { name: link.name || null, flightSec: 0, sorties: 0, lastSeen: null },
      level: levelInfo(xp, stats.thresholds),
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
    const link = readLinks()[discordId] || null;
    if (link?.ucid) return { linked: true, link: { name: link.name || null, linkedAt: link.linkedAt || null } };
    const pending = Object.entries(readCodes()).find(([, entry]) => entry?.discordId === discordId);
    return {
      linked: false,
      pending: pending ? { code: pending[0], expiresAt: pending[1].expiresAt } : null,
    };
  }

  function startLink(discordId) {
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

  function tally(vote) {
    let yes = 0;
    let no = 0;
    Object.values(vote?.ballots || {}).forEach((ballot) => {
      if (ballot?.choice === 'yes') yes += 1;
      else if (ballot?.choice === 'no') no += 1;
    });
    return { yes, no, total: yes + no };
  }

  function voteOutcome(vote) {
    const counts = tally(vote);
    const passed = counts.total >= VOTE_RULES.minVotes && counts.yes > counts.no;
    return { ...counts, passed };
  }

  function publicVote(vote, discordId) {
    if (!vote) return null;
    const counts = tally(vote);
    return {
      id: vote.id,
      target: vote.target,
      from: vote.from,
      status: vote.status,
      proposedBy: vote.proposedBy,
      createdAt: vote.createdAt,
      endsAt: vote.endsAt,
      closedAt: vote.closedAt || null,
      resultMessage: vote.resultMessage || null,
      yes: counts.yes,
      no: counts.no,
      total: counts.total,
      myChoice: discordId ? vote.ballots?.[discordId]?.choice || null : null,
    };
  }

  function requirePilot(user, minLevel) {
    const pilot = pilotForUser(user.id);
    if (!pilot.link) {
      const error = new Error('Collega prima il tuo account DCS dal profilo.');
      error.status = 403;
      throw error;
    }
    if ((pilot.level?.level || 1) < minLevel) {
      const error = new Error(`Serve almeno il livello ${minLevel} (attuale ${pilot.level?.level || 1}).`);
      error.status = 403;
      throw error;
    }
    return pilot;
  }

  function proposeVote(user, target, from) {
    requirePilot(user, VOTE_RULES.minProposerLevel);
    const state = readVotes();
    if (state.current && (state.current.status === 'open' || state.current.status === 'passed')) {
      const error = new Error('C\'e\' gia\' una votazione in corso.');
      error.status = 409;
      throw error;
    }
    const lastClosed = state.history[0];
    if (lastClosed && lastClosed.status === 'rejected' && Date.now() - (lastClosed.closedAt || 0) < VOTE_RULES.cooldownMs) {
      const error = new Error('Attendi prima di proporre una nuova votazione.');
      error.status = 429;
      throw error;
    }

    const focus = readFocus();
    if (!focus.available) {
      const error = new Error('Stato campagna non disponibile.');
      error.status = 503;
      throw error;
    }
    if (focus.target === target && focus.from === from) {
      const error = new Error('Questa e\' gia\' la regione attiva.');
      error.status = 400;
      throw error;
    }
    const candidate = focus.candidates.find((entry) => entry.target === target);
    if (!candidate || !candidate.froms.includes(from)) {
      const error = new Error(`${regionLabel(target)} non e' attaccabile da ${regionLabel(from)}.`);
      error.status = 400;
      throw error;
    }

    if (state.current) state.history.unshift(state.current);
    const now = Date.now();
    const vote = {
      id: `vote_${now}_${crypto.randomBytes(3).toString('hex')}`,
      target,
      from,
      status: 'open',
      proposedBy: { id: user.id, name: user.globalName || user.username || user.id },
      createdAt: now,
      endsAt: now + VOTE_RULES.durationMs,
      ballots: { [user.id]: { choice: 'yes', at: now } },
    };
    state.current = vote;
    writeVotes(state);
    deps.emit('hidc:campaign-updated', { reason: 'vote-open' });
    announce([
      `**Votazione regione attiva** proposta da ${vote.proposedBy.name}`,
      `Attaccare **${regionLabel(target)}** partendo da **${regionLabel(from)}**.`,
      `Chiude il <t:${Math.floor(vote.endsAt / 1000)}:f>. Servono almeno ${VOTE_RULES.minVotes} voti.`,
      siteUrl ? `Vota sul sito: ${siteUrl}` : '',
    ].filter(Boolean).join('\n'));
    return vote;
  }

  function castBallot(user, voteId, choice) {
    if (choice !== 'yes' && choice !== 'no') {
      const error = new Error('Voto non valido.');
      error.status = 400;
      throw error;
    }
    requirePilot(user, VOTE_RULES.minVoterLevel);
    const state = readVotes();
    const vote = state.current;
    if (!vote || vote.id !== voteId || vote.status !== 'open') {
      const error = new Error('Votazione non aperta.');
      error.status = 409;
      throw error;
    }
    vote.ballots = vote.ballots || {};
    vote.ballots[user.id] = { choice, at: Date.now() };
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
        requested_by: vote.proposedBy?.name || '',
        requested_by_id: vote.proposedBy?.id || '',
        ts: Date.now(),
      });
    }
  }

  function tickVotes() {
    try {
      const state = readVotes();
      const vote = state.current;
      if (!vote) return;
      const now = Date.now();

      if (vote.status === 'open' && now >= vote.endsAt) {
        const outcome = voteOutcome(vote);
        if (outcome.passed) {
          vote.status = 'passed';
          vote.passedAt = now;
          vote.resultMessage = `Approvata ${outcome.yes}-${outcome.no}: in attesa di DCS.`;
          enqueueFocusCommand(vote);
          writeVotes(state);
          announce(`**Votazione approvata** (${outcome.yes} si / ${outcome.no} no): ${regionLabel(vote.target)} da ${regionLabel(vote.from)}. Verra' applicata al server.`);
        } else {
          const reason = outcome.total < VOTE_RULES.minVotes
            ? `Respinta: ${outcome.total}/${VOTE_RULES.minVotes} voti minimi.`
            : `Respinta ${outcome.yes}-${outcome.no}.`;
          closeVote(state, 'rejected', reason);
          writeVotes(state);
          announce(`**Votazione respinta**: ${regionLabel(vote.target)}. ${reason}`);
        }
        deps.emit('hidc:campaign-updated', { reason: 'vote-closed' });
        return;
      }

      if (vote.status === 'passed') {
        const result = vote.commandId ? deps.getWebCommandResult(vote.commandId) : null;
        if (result) {
          if (result.ok) {
            closeVote(state, 'applied', result.message || 'Applicata in DCS.');
          } else {
            closeVote(state, 'failed', `DCS ha rifiutato: ${result.message || 'errore'}`);
          }
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
        // La coda comandi ha un TTL: ri-accoda finche' DCS non risponde (DBRIDGE e' idempotente per id).
        enqueueFocusCommand(vote);
        writeVotes(state);
      }
    } catch (error) {
      console.error('HIDC vote tick failed:', error.message);
    }
  }

  // ---------------------------------------------------------------- state for UI

  function getCampaignState(user) {
    const focus = readFocus();
    const votes = readVotes();
    const pilot = user?.id ? pilotForUser(user.id) : null;
    const level = pilot?.level?.level || 0;
    const voteOpen = votes.current?.status === 'open' || votes.current?.status === 'passed';
    return {
      focus,
      regionStatus: readRegionStatus(),
      vote: publicVote(votes.current, user?.id),
      lastVote: publicVote(votes.history[0], user?.id),
      rules: {
        minProposerLevel: VOTE_RULES.minProposerLevel,
        minVoterLevel: VOTE_RULES.minVoterLevel,
        minVotes: VOTE_RULES.minVotes,
        durationMin: Math.round(VOTE_RULES.durationMs / 60000),
      },
      me: user?.id
        ? {
          linked: Boolean(pilot?.link),
          level,
          canPropose: Boolean(pilot?.link) && level >= VOTE_RULES.minProposerLevel && !voteOpen && focus.available,
          canVote: Boolean(pilot?.link) && level >= VOTE_RULES.minVoterLevel && votes.current?.status === 'open',
        }
        : null,
    };
  }

  function getPilotProfile(user) {
    const stats = readStats();
    const pilot = pilotForUser(user.id, stats);
    return {
      ...getLinkState(user.id),
      statsAvailable: stats.available,
      stats: pilot.stats,
      level: pilot.level || levelInfo(0, stats.thresholds),
      rules: stats.rules,
      botAvailable: Boolean(botToken),
      minProposerLevel: VOTE_RULES.minProposerLevel,
    };
  }

  function getLeaderboard(limit = 10) {
    const stats = readStats();
    const links = readLinks();
    return Object.entries(links)
      .map(([discordId, link]) => {
        const row = stats.pilots[link.ucid];
        if (!row) return null;
        const xp = Number(row.xp) || 0;
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
      res.json({ unlinked: unlink(user.id) });
    });

    app.get('/api/hidc/pilots/leaderboard', (req, res) => {
      res.json({ pilots: getLeaderboard(10) });
    });

    app.get('/api/hidc/campaign', (req, res) => {
      res.json(getCampaignState(req.session?.user || null));
    });

    app.post('/api/hidc/campaign/votes', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      const target = sanitizeText(req.body?.target, 16);
      const from = sanitizeText(req.body?.from, 16);
      if (!REGION_PATTERN.test(target) || !REGION_PATTERN.test(from)) {
        res.status(400).json({ error: 'Regione non valida.' });
        return;
      }
      try {
        proposeVote(user, target, from);
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });

    app.post('/api/hidc/campaign/votes/:voteId/ballot', (req, res) => {
      const user = requireUser(req, res);
      if (!user) return;
      try {
        castBallot(user, sanitizeText(req.params.voteId, 80), sanitizeText(req.body?.choice, 8));
        res.json(getCampaignState(user));
      } catch (error) {
        sendError(res, error);
      }
    });
  }

  function tick() {
    syncLinkRequests();
    tickVotes();
  }

  return {
    files,
    registerRoutes,
    tick,
    // test hooks
    _internals: { proposeVote, castBallot, tickVotes, syncLinkRequests, startLink, getCampaignState, getPilotProfile, levelInfo },
  };
}

export default { createHidcCampaign, VOTE_RULES };
