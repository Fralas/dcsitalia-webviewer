/**
 * Discord notifications for important campaign events.
 *
 * DCORE (DBRIDGE_Notify.lua) writes the latest events to Export_Notifications.json:
 *   { version, session, updated_at, events: [{ id, seq, type, title, message, at, meta }] }
 * This service polls the file and posts every new event, once, to DISCORD_NOTIFY_CHANNEL_ID
 * with the bot token (DISCORD_BOT_TOKEN). Ids already posted are kept in SQLite, so a site
 * restart never posts them again; the first run only records what is already in the file.
 *
 * Event types: convoy_departed, convoy_arrived, convoy_destroyed, zone_captured, zone_lost,
 * region_conquered, region_lost, region_active, airbase_captured, airbase_lost.
 */
import fs from 'fs';
import { DOC, loadJsonIfPresent, saveJson } from '../db/jsonStore.js';

// Three standard tones: BLUE gains (blue), RED threats and losses (red), campaign info (gold).
const TONE = {
  blue: { tone: 'blue', color: 0x3b82f6 },
  red: { tone: 'red', color: 0xef4444 },
  info: { tone: 'info', color: 0xf5b301 },
};
const STYLE = {
  convoy_departed: TONE.red,
  convoy_arrived: TONE.red,
  convoy_destroyed: TONE.blue,
  zone_captured: TONE.blue,
  zone_lost: TONE.red,
  region_conquered: TONE.blue,
  region_lost: TONE.red,
  region_active: TONE.info,
  airbase_captured: TONE.blue,
  airbase_lost: TONE.red,
};
const DEFAULT_STYLE = TONE.info;
const MAX_POSTED_IDS = 1000;
const MAX_ATTEMPTS = 3;

function envNumber(name, fallback) {
  const value = Number.parseFloat(process.env[name]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function clip(value, max) {
  const text = String(value ?? '').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// ---------------------------------------------------------------- Discord markdown

/**
 * Escapes Discord markdown in text that comes from the game (zone_010 would otherwise turn
 * "_010 verso zone_" into italics). Also neutralises headings / lists / quotes at line start
 * and masked links.
 */
export function escapeMarkdown(value) {
  return String(value ?? '')
    .replace(/([\\*_~`|[\]<>])/g, '\\$1')
    .replace(/^(\s*)([#>-])/gm, '$1\\$2')
    .replace(/^(\s*\d+)\./gm, '$1\\.')
    .replace(/@(everyone|here)/g, '@​$1');
}

/**
 * DCORE writes ASCII Italian (no accents in Lua sources): e' -> è, gia' -> già, ...
 * Only word endings followed by a space / punctuation, so quotes like d'attacco stay as they are.
 */
const ACCENTS = { e: 'è', E: 'È', a: 'à', i: 'ì', o: 'ò', u: 'ù' };
export function prettifyItalian(value) {
  return String(value ?? '').replace(/\b([A-Za-z]*)([aeiouE])'(?=[\s.,;:!?)]|$)/g, (all, stem, vowel) => {
    if (!stem && vowel !== 'e' && vowel !== 'E') return all;
    return stem + (ACCENTS[vowel] || vowel);
  });
}

// ---------------------------------------------------------------- readable names

/** zone_011 -> "Zona 11", REGION_3 -> "Regione 3"; other ids: underscores become spaces. */
export function zoneLabel(zoneId) {
  const text = String(zoneId ?? '').trim();
  const match = text.match(/^zone_0*(\d+)$/i);
  if (match) return `Zona ${match[1]}`;
  return text.replace(/_+/g, ' ');
}

export function regionLabel(regionId) {
  const text = String(regionId ?? '').trim();
  const match = text.match(/^REGION_0*(\d+)$/i);
  if (match) return `Regione ${match[1]}`;
  return text.replace(/_+/g, ' ');
}

/** Same rewrite inside free text (DCORE messages, custom tests): no ids or underscores on Discord. */
export function humanizeText(value) {
  return String(value ?? '')
    .replace(/\b(?:(la)\s+)?zona\s+(zone_\d+)/gi, (all, article, id) => `${article ? `${article} ` : ''}${zoneLabel(id)}`)
    .replace(/\bzone_0*(\d+)\b/gi, 'Zona $1')
    .replace(/\bREGION_0*(\d+)\b/g, 'Regione $1')
    .replace(/\bRegion (\d+)\b/g, 'Regione $1')
    .replace(/([A-Za-z])_+(?=[A-Za-z])/g, '$1 ');
}

const CONVOY_KIND = {
  attack: "convoglio RED d'attacco",
  recapture: 'convoglio RED di riconquista',
  sam_repair: 'convoglio RED di riparazione SAM',
};

const ACTIVE_REASON = {
  vote: 'votazione dei piloti',
  menu: 'menu F10',
};

const b = (value) => `**${escapeMarkdown(value)}**`;
const item = (label, value) => (value ? `- ${label}: ${b(value)}` : '');

/**
 * Discord markdown layout shared by every notification (no emoji, the header carries the look):
 *   ### Title          sub-header
 *   Lead sentence      one line under it
 *   **Section**        bold label
 *   - detail           list, bold on the names that matter
 */
export function layout(title, lead, sections = []) {
  const parts = [`### ${escapeMarkdown(title)}`];
  if (lead) parts.push(lead);
  for (const section of sections) {
    const items = (section.items || []).filter(Boolean);
    if (items.length === 0) continue;
    parts.push(`\n**${escapeMarkdown(section.heading)}**\n${items.join('\n')}`);
  }
  return parts.join('\n');
}

/**
 * Title + lead + sections built from the event meta (DBRIDGE_Notify.lua). Returns null when the
 * meta is missing (custom tests, unknown types): the caller falls back to the DCORE text.
 */
function describe(type, meta) {
  const m = meta && typeof meta === 'object' ? meta : {};
  const kind = CONVOY_KIND[m.kind] || 'convoglio RED';
  const from = m.origin_zone ? zoneLabel(m.origin_zone) : '';
  const to = m.destination_zone ? zoneLabel(m.destination_zone) : '';
  const zone = m.zone ? zoneLabel(m.zone) : '';
  const region = m.region ? regionLabel(m.region) : '';
  const zones = Array.isArray(m.zones) ? m.zones.map(zoneLabel) : [];
  const route = { heading: 'Percorso', items: [item('Partenza', from), item('Destinazione', to)] };

  switch (type) {
    case 'convoy_departed':
      if (!from && !to) return null;
      return { title: 'Convoglio nemico in partenza', lead: `Un ${kind} si è messo in marcia.`, sections: [route] };
    case 'convoy_arrived':
      if (!to) return null;
      return { title: 'Convoglio nemico arrivato', lead: `Un ${kind} ha raggiunto la ${b(to)}.`, sections: [route] };
    case 'convoy_destroyed':
      if (!from && !to) return null;
      return { title: 'Convoglio nemico distrutto', lead: `Un ${kind} è stato distrutto prima di arrivare.`, sections: [route] };
    case 'zone_captured':
    case 'zone_lost': {
      const captured = type === 'zone_captured';
      if (zones.length > 0) {
        return {
          title: captured ? `${zones.length} zone conquistate` : `${zones.length} zone perse`,
          lead: captured ? 'Le forze BLUE hanno conquistato più zone insieme.' : 'Le forze RED hanno riconquistato più zone insieme.',
          sections: [{ heading: 'Zone', items: zones.map((z) => `- ${b(z)}`) }],
        };
      }
      if (!zone) return null;
      return {
        title: captured ? 'Zona conquistata' : 'Zona persa',
        lead: captured ? `Le forze BLUE hanno conquistato la ${b(zone)}.` : `Le forze RED hanno riconquistato la ${b(zone)}.`,
        sections: [{ heading: 'Dettagli', items: [item('Regione', region)] }],
      };
    }
    case 'region_conquered':
      if (!region) return null;
      return { title: `${region} conquistata`, lead: `Tutte le zone della ${b(region)} sono ora sotto controllo BLUE.` };
    case 'region_lost':
      if (!region) return null;
      return { title: `${region} persa`, lead: `Le forze RED hanno riconquistato zone della ${b(region)}.` };
    case 'region_active':
      if (!m.target) return null;
      return {
        title: 'Nuova regione attiva',
        lead: `Il prossimo obiettivo BLUE è la ${b(regionLabel(m.target))}.`,
        sections: [{
          heading: 'Dettagli',
          items: [
            item('Attacco da', m.from ? regionLabel(m.from) : ''),
            m.reason ? `- Scelta con: ${escapeMarkdown(ACTIVE_REASON[m.reason] || m.reason)}` : '',
          ],
        }],
      };
    case 'airbase_captured':
    case 'airbase_lost': {
      const name = m.airbase ? humanizeText(m.airbase) : '';
      if (!name) return null;
      return type === 'airbase_captured'
        ? { title: 'Aeroporto conquistato', lead: `L'aeroporto di ${b(name)} è ora sotto controllo BLUE.` }
        : { title: 'Aeroporto perso', lead: `L'aeroporto di ${b(name)} è passato sotto controllo RED.` };
    }
    default:
      return null;
  }
}

/**
 * @param {object} opts
 * @param {string|null} opts.file  path of DCORE Export_Notifications.json
 * @param {string} [opts.channelId]
 * @param {string} [opts.botToken]
 * @param {object} [opts.logger]
 */
export function createDiscordNotifications(opts = {}) {
  const file = opts.file || null;
  const channelId = String(opts.channelId ?? process.env.DISCORD_NOTIFY_CHANNEL_ID ?? '').trim();
  const botToken = String(opts.botToken ?? process.env.DISCORD_BOT_TOKEN ?? '').trim();
  const log = opts.logger || console;
  const pollMs = Math.max(2, envNumber('DISCORD_NOTIFY_POLL_SEC', 10)) * 1000;
  // Events older than this (site down, backlog) are skipped instead of being posted late.
  const maxAgeSec = envNumber('DISCORD_NOTIFY_MAX_AGE_MIN', 30) * 60;
  const disabledTypes = new Set(String(process.env.DISCORD_NOTIFY_DISABLED_TYPES || '')
    .split(',').map((s) => s.trim()).filter(Boolean));
  const footer = String(process.env.DISCORD_NOTIFY_FOOTER || 'DCS Italia').trim();
  const enabled = Boolean(file && channelId && botToken);

  const stored = loadJsonIfPresent(DOC.DISCORD_NOTIFICATIONS);
  const state = {
    initialized: Boolean(stored?.initialized),
    posted: Array.isArray(stored?.posted) ? stored.posted.slice(-MAX_POSTED_IDS) : [],
  };
  const postedSet = new Set(state.posted);
  const attempts = new Map();
  let lastMtimeMs = 0;
  let running = false;
  let timer = null;

  function persist() {
    state.posted = state.posted.slice(-MAX_POSTED_IDS);
    try {
      saveJson(DOC.DISCORD_NOTIFICATIONS, state);
    } catch (error) {
      log.error?.(`Discord notifications: state save failed: ${error.message}`);
    }
  }

  function markPosted(id) {
    if (postedSet.has(id)) return;
    postedSet.add(id);
    state.posted.push(id);
    if (state.posted.length > MAX_POSTED_IDS) {
      const removed = state.posted.splice(0, state.posted.length - MAX_POSTED_IDS);
      removed.forEach((old) => postedSet.delete(old));
    }
  }

  function readEvents() {
    if (!file || !fs.existsSync(file)) return null;
    const stat = fs.statSync(file);
    if (stat.mtimeMs === lastMtimeMs) return null;
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null; // file being written: retry on the next poll
    }
    lastMtimeMs = stat.mtimeMs;
    const events = Array.isArray(parsed?.events) ? parsed.events : [];
    return events.filter((ev) => ev && typeof ev.id === 'string' && ev.id);
  }

  // Last delivery attempt, shown by the debug panel.
  let lastDelivery = null;

  /** POST to the channel; result 'ok' | 'retry' | 'fail' with HTTP status and Discord error text. Waits on 429. */
  async function postDetailed(body, source) {
    const done = (result, status, detail) => {
      lastDelivery = { at: Date.now(), source, result, status, detail };
      return { result, status, detail };
    };
    for (let i = 0; i < 3; i += 1) {
      let response;
      try {
        response = await fetch(`https://discord.com/api/v10/channels/${encodeURIComponent(channelId)}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bot ${botToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, allowed_mentions: { parse: [] } }),
        });
      } catch (error) {
        log.warn?.(`Discord notifications: network error: ${error.message}`);
        return done('retry', 0, error.message);
      }
      if (response.ok) return done('ok', response.status, '');
      if (response.status === 429) {
        const data = await response.json().catch(() => ({}));
        await sleep(Math.min(30, Number(data?.retry_after) || 2) * 1000 + 250);
        continue;
      }
      const text = clip(await response.text().catch(() => ''), 300);
      log.warn?.(`Discord notifications: HTTP ${response.status} ${text}`);
      return done(response.status >= 500 ? 'retry' : 'fail', response.status, text);
    }
    return done('retry', 429, 'rate limited');
  }

  async function post(body) {
    return (await postDetailed(body, 'dcore')).result;
  }

  /**
   * Embed for an event: text built from the meta (describe), otherwise the DCORE title/message
   * made readable (accents, "Zona 11" instead of zone_011, no underscores) and escaped.
   * opts.title / opts.message replace the text (custom tests), opts.footer the footer.
   */
  function embedFor(ev, opts = {}) {
    const style = STYLE[ev.type] || DEFAULT_STYLE;
    const at = Number(ev.at);
    const built = describe(String(ev.type || ''), ev.meta);
    const plain = (text) => humanizeText(prettifyItalian(text));
    const title = opts.title ? plain(opts.title) : (built?.title || plain(ev.title || ev.type));
    let description;
    if (opts.message) description = layout(title, escapeMarkdown(plain(opts.message)));
    else if (built) description = layout(title, built.lead, built.sections);
    else description = layout(title, escapeMarkdown(plain(ev.message)));
    // No embed title: the "### " header in the description carries the title.
    const embed = {
      color: style.color,
      description: clip(description, 4000),
      footer: { text: clip(opts.footer || footer, 200) },
    };
    if (Number.isFinite(at) && at > 0) embed.timestamp = new Date(at * 1000).toISOString();
    return embed;
  }

  async function tick() {
    if (!enabled || running) return;
    running = true;
    try {
      if (!state.initialized && file && !fs.existsSync(file)) {
        // No file yet: nothing to skip, every future event gets posted.
        state.initialized = true;
        persist();
        return;
      }
      const events = readEvents();
      if (!events) return;

      if (!state.initialized) {
        events.forEach((ev) => markPosted(ev.id));
        state.initialized = true;
        persist();
        log.info?.(`Discord notifications: baseline of ${events.length} existing events (not posted)`);
        return;
      }

      const nowSec = Date.now() / 1000;
      let changed = false;
      let retryLater = false;
      for (const ev of events) {
        if (postedSet.has(ev.id)) continue;
        const at = Number(ev.at);
        const stale = maxAgeSec > 0 && Number.isFinite(at) && at > 0 && nowSec - at > maxAgeSec;
        if (stale || disabledTypes.has(ev.type)) {
          markPosted(ev.id);
          changed = true;
          continue;
        }
        const result = await post({ embeds: [embedFor(ev)] });
        if (result === 'ok' || result === 'fail') {
          if (result === 'fail') {
            const n = (attempts.get(ev.id) || 0) + 1;
            attempts.set(ev.id, n);
            if (n < MAX_ATTEMPTS) { retryLater = true; continue; }
          }
          attempts.delete(ev.id);
          markPosted(ev.id);
          changed = true;
          await sleep(1100); // stay well under the channel rate limit
        } else {
          retryLater = true;
          break;
        }
      }
      if (changed) persist();
      if (retryLater) lastMtimeMs = 0; // re-read the file on the next poll
    } catch (error) {
      log.error?.(`Discord notifications: tick failed: ${error.message}`);
    } finally {
      running = false;
    }
  }

  // ---------------------------------------------------------------- debug panel

  /** Sample events per type: same wording and meta that DCORE (DBRIDGE_Notify.lua) writes. */
  const convoyMeta = { kind: 'attack', origin_zone: 'zone_010', destination_zone: 'zone_011' };
  const SAMPLES = {
    convoy_departed: { title: 'Convoglio nemico in partenza', message: "Convoglio RED d'attacco da zone_010 verso zone_011.", meta: convoyMeta },
    convoy_arrived: { title: 'Convoglio nemico arrivato', message: "Convoglio RED d'attacco arrivato in zone_011.", meta: convoyMeta },
    convoy_destroyed: { title: 'Convoglio nemico distrutto', message: "Convoglio RED di riparazione SAM distrutto (da zone_020 verso zone_024).", meta: { kind: 'sam_repair', origin_zone: 'zone_020', destination_zone: 'zone_024' } },
    zone_captured: { title: 'Zona conquistata', message: "La zona zone_011 (Region 3) e' stata conquistata dalle forze BLUE.", meta: { zone: 'zone_011', region: 'REGION_3' } },
    zone_lost: { title: 'Zona persa', message: "La zona zone_011 (Region 3) e' stata riconquistata dalle forze RED.", meta: { zone: 'zone_011', region: 'REGION_3' } },
    region_conquered: { title: 'Region 3 conquistata!', message: 'Tutte le zone di Region 3 sono BLUE.', meta: { region: 'REGION_3' } },
    region_lost: { title: 'Region 3 persa', message: 'Le forze RED hanno riconquistato zone di Region 3.', meta: { region: 'REGION_3' } },
    region_active: { title: 'Nuova regione attiva: Region 4', message: 'Attacco BLUE su Region 4 partendo da Region 3 (esito votazione).', meta: { target: 'REGION_4', from: 'REGION_3', reason: 'vote' } },
    airbase_captured: { title: 'Aeroporto conquistato', message: "Aleppo e' ora sotto controllo BLUE.", meta: { airbase: 'Aleppo' } },
    airbase_lost: { title: 'Aeroporto perso', message: "Aleppo e' passato sotto controllo RED.", meta: { airbase: 'Aleppo' } },
  };
  // Extra case sent by "send all": several zones in one check (DMAP_Region summary).
  const BURST_SAMPLE = {
    type: 'zone_captured',
    title: '5 zone conquistate',
    message: 'zone_030, zone_031, zone_032, zone_033, zone_034',
    meta: { zones: ['zone_030', 'zone_031', 'zone_032', 'zone_033', 'zone_034'], count: 5 },
  };

  function readFileEvents() {
    if (!file || !fs.existsSync(file)) return { exists: false, events: [], updatedAt: null, session: null };
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      const events = Array.isArray(parsed?.events) ? parsed.events : [];
      return {
        exists: true,
        events,
        updatedAt: Number(parsed?.updated_at) || null,
        session: parsed?.session ?? null,
      };
    } catch (error) {
      return { exists: true, events: [], updatedAt: null, session: null, error: error.message };
    }
  }

  function getStatus(limit = 15) {
    const info = readFileEvents();
    return {
      enabled,
      channelId: channelId || null,
      hasBotToken: Boolean(botToken),
      file,
      fileExists: info.exists,
      fileError: info.error || null,
      fileUpdatedAt: info.updatedAt,
      session: info.session,
      initialized: state.initialized,
      postedCount: state.posted.length,
      pollSec: pollMs / 1000,
      maxAgeMin: maxAgeSec / 60,
      disabledTypes: [...disabledTypes],
      lastDelivery,
      types: Object.keys(STYLE).map((type) => ({
        type,
        tone: STYLE[type].tone,
        title: describe(type, SAMPLES[type]?.meta)?.title || SAMPLES[type]?.title || type,
        message: humanizeText(prettifyItalian(SAMPLES[type]?.message || '')),
      })),
      recent: info.events.slice(-limit).reverse().map((ev) => ({
        id: ev.id,
        type: ev.type,
        title: ev.title,
        message: ev.message,
        at: ev.at,
        posted: postedSet.has(ev.id),
      })),
    };
  }

  // Tests look exactly like the real messages; only the footer says it is a test.
  function testEmbed(ev, by, custom = {}) {
    return embedFor({ ...ev, at: Math.floor(Date.now() / 1000) }, {
      ...custom,
      footer: `${footer} · TEST${by ? ` di ${by}` : ''}`,
    });
  }

  const missingConfig = () => (!channelId || !botToken
    ? { ok: false, status: 0, detail: 'DISCORD_NOTIFY_CHANNEL_ID o DISCORD_BOT_TOKEN mancanti' }
    : null);

  /**
   * Posts a test message straight to the channel (does not go through the DCORE file).
   * Empty title / message use the sample text of that type; the color always follows the type.
   */
  async function sendTest({ type, title, message, by } = {}) {
    const missing = missingConfig();
    if (missing) return missing;
    const kind = STYLE[type] ? type : 'convoy_departed';
    const ev = { type: kind, ...SAMPLES[kind] };
    const custom = { title: clip(title, 200), message: clip(message, 3500) };
    const res = await postDetailed({ embeds: [testEmbed(ev, by, custom)] }, 'test');
    return { ok: res.result === 'ok', status: res.status, detail: res.detail };
  }

  /** Posts one test message per type (plus the multi-zone summary), one after the other. */
  async function sendAllTests({ by } = {}) {
    const missing = missingConfig();
    if (missing) return { ok: false, sent: 0, total: 0, results: [], ...missing };
    const list = [
      ...Object.keys(SAMPLES).map((type) => ({ type, ...SAMPLES[type] })),
      BURST_SAMPLE,
    ];
    const results = [];
    for (const ev of list) {
      const res = await postDetailed({ embeds: [testEmbed(ev, by)] }, 'test');
      results.push({ type: ev.type, title: ev.title, ok: res.result === 'ok', status: res.status, detail: res.detail });
      if (res.result !== 'ok' && res.status !== 0 && res.status < 500) break; // e.g. 403: the rest would fail too
      await sleep(1200);
    }
    const sent = results.filter((r) => r.ok).length;
    const failed = results.find((r) => !r.ok) || null;
    return { ok: sent === list.length, sent, total: list.length, results, status: failed?.status || 200, detail: failed?.detail || '' };
  }

  /** Reads the DCORE file now instead of waiting for the next poll. */
  async function pollNow() {
    lastMtimeMs = 0;
    await tick();
    return getStatus();
  }

  function start() {
    if (!enabled) {
      const missing = [!file && 'Export_Notifications.json path', !channelId && 'DISCORD_NOTIFY_CHANNEL_ID', !botToken && 'DISCORD_BOT_TOKEN']
        .filter(Boolean).join(', ');
      log.warn?.(`Discord notifications DISABLED (missing: ${missing})`);
      return false;
    }
    if (timer) return true;
    timer = setInterval(() => { tick(); }, pollMs);
    tick();
    log.info?.(`Discord notifications: ${file} -> channel ${channelId} (every ${pollMs / 1000}s)`);
    return true;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return { enabled, file, channelId, start, stop, tick, getStatus, sendTest, sendAllTests, pollNow };
}

export default createDiscordNotifications;
