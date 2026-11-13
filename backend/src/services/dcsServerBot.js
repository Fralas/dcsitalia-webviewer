/**
 * Read-only bridge to the DCSServerBot PostgreSQL database (same machine as the DCS server).
 *
 * Replaces the DCORE pilot tracker (DBRIDGE_Pilots + DPILOT_LinkHook) for the website:
 *   - Discord <-> DCS link:  players.discord_id (set by the bot's /linkme), -1 = not linked
 *   - flight figures:        statistics (userstats plugin): slot time, takeoffs, landings, kills, deaths...
 *   - weapons (optional):    missionstats (missionstats plugin): S_EVENT_SHOT / S_EVENT_HIT per weapon
 *   - carrier (optional):    traps (greenieboard plugin)
 *
 * A snapshot of every linked pilot is refreshed in the background (DCSSB_REFRESH_SEC), so the
 * HTTP routes stay synchronous and the database sees one batch of queries per interval.
 * Use a database role with SELECT only (see scripts/dcsserverbot-readonly.sql).
 *
 * Env:
 *   DCSSB_DATABASE_URL     postgres://user:pass@127.0.0.1:5432/dcsserverbot   (empty = disabled)
 *   DCSSB_SERVER_NAMES     optional comma list of missions.server_name to count (e.g. the HIDC server)
 *   DCSSB_REFRESH_SEC      snapshot refresh (default 60)
 *   DCSSB_MAX_SESSION_H    cap for a single slot session, protects against unclosed rows (default 12)
 */

const UNLINKED = -1;

function envInt(name, fallback) {
  const value = Number.parseInt(process.env[name], 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function emptyTotals() {
  return {
    playtimeSec: 0,
    takeoffs: 0,
    landings: 0,
    kills: 0,
    pvp: 0,
    deaths: 0,
    ejections: 0,
    crashes: 0,
    teamkills: 0,
    killsPlanes: 0,
    killsHelicopters: 0,
    killsShips: 0,
    killsSams: 0,
    killsGround: 0,
  };
}

const STAT_COLUMNS = {
  takeoffs: 'takeoffs',
  landings: 'landings',
  kills: 'kills',
  pvp: 'pvp',
  deaths: 'deaths',
  ejections: 'ejections',
  crashes: 'crashes',
  teamkills: 'teamkills',
  killsPlanes: 'kills_planes',
  killsHelicopters: 'kills_helicopters',
  killsShips: 'kills_ships',
  killsSams: 'kills_sams',
  killsGround: 'kills_ground',
};

/** "F-16C_50 (Crew)" -> "F-16C_50", keeps the crew flag apart. */
function cleanSlot(slot) {
  const text = String(slot || '').trim();
  return text.replace(/\s*\(Crew\)$/i, '') || '?';
}

/**
 * @param {object} [options]
 * @param {(sql: string, params?: any[]) => Promise<{rows: any[]}>} [options.query]  injected for tests
 */
export function createDcsServerBot(options = {}) {
  const url = String(process.env.DCSSB_DATABASE_URL || '').trim();
  const serverNames = String(process.env.DCSSB_SERVER_NAMES || '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  const refreshMs = envInt('DCSSB_REFRESH_SEC', 60) * 1000;
  const maxSessionSec = envInt('DCSSB_MAX_SESSION_H', 12) * 3600;

  let query = options.query || null;
  let pool = null;
  const enabled = Boolean(query || url);

  let snapshot = { ok: false, updatedAt: null, error: null, byDiscord: {} };
  let refreshing = null;
  let lastRefreshAt = 0;
  const optional = { missionstats: true, traps: true };

  async function getQuery() {
    if (query) return query;
    const { default: pg } = await import('pg');
    pool = new pg.Pool({ connectionString: url, max: 2, idleTimeoutMillis: 30000 });
    pool.on('error', (error) => console.error('DCSServerBot pool error:', error.message));
    query = (sql, params) => pool.query(sql, params);
    return query;
  }

  // Missions filter shared by every statistics query ($2 = server names, when configured).
  const serverFilter = serverNames.length > 0 ? 'AND m.server_name = ANY($2::text[])' : '';
  const baseParams = (ucids) => (serverNames.length > 0 ? [ucids, serverNames] : [ucids]);

  async function loadPlayers(q) {
    const { rows } = await q(
      `SELECT ucid, discord_id::text AS discord_id, name, manual,
              EXTRACT(EPOCH FROM last_seen)::bigint AS last_seen_epoch
         FROM players
        WHERE discord_id <> $1`,
      [UNLINKED],
    );
    return rows;
  }

  async function loadStatistics(q, ucids) {
    const sums = Object.values(STAT_COLUMNS).map((col) => `SUM(s.${col})::bigint AS ${col}`).join(',\n             ');
    const { rows } = await q(
      `SELECT s.player_ucid AS ucid,
             s.slot,
             SUM(LEAST(${maxSessionSec},
                 GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(s.hop_off, NOW() AT TIME ZONE 'utc') - s.hop_on)))))::bigint AS sec,
             ${sums},
             EXTRACT(EPOCH FROM MAX(COALESCE(s.hop_off, NOW() AT TIME ZONE 'utc')))::bigint AS last_flight_epoch
        FROM statistics s
        JOIN missions m ON m.id = s.mission_id
       WHERE s.player_ucid = ANY($1::text[]) ${serverFilter}
       GROUP BY s.player_ucid, s.slot`,
      baseParams(ucids),
    );
    return rows;
  }

  async function loadWeapons(q, ucids) {
    if (!optional.missionstats) return [];
    try {
      const { rows } = await q(
        `SELECT ms.init_id AS ucid,
               ms.weapon,
               COUNT(*) FILTER (WHERE ms.event = 'S_EVENT_SHOT')::int AS shots,
               COUNT(*) FILTER (WHERE ms.event = 'S_EVENT_HIT')::int AS hits
          FROM missionstats ms
          JOIN missions m ON m.id = ms.mission_id
         WHERE ms.init_id = ANY($1::text[]) AND ms.weapon IS NOT NULL ${serverFilter}
         GROUP BY ms.init_id, ms.weapon`,
        baseParams(ucids),
      );
      return rows;
    } catch (error) {
      if (error?.code === '42P01') optional.missionstats = false; // plugin not installed
      else console.error('DCSServerBot missionstats query failed:', error.message);
      return [];
    }
  }

  async function loadTraps(q, ucids) {
    if (!optional.traps) return [];
    try {
      const { rows } = await q(
        `SELECT t.player_ucid AS ucid,
               COUNT(*)::int AS traps,
               AVG(t.points)::float AS avg_points,
               COUNT(*) FILTER (WHERE t.wire = 3)::int AS wire3
          FROM traps t
          JOIN missions m ON m.id = t.mission_id
         WHERE t.player_ucid = ANY($1::text[]) ${serverFilter}
         GROUP BY t.player_ucid`,
        baseParams(ucids),
      );
      return rows;
    } catch (error) {
      if (error?.code === '42P01') optional.traps = false; // greenieboard not installed
      else console.error('DCSServerBot traps query failed:', error.message);
      return [];
    }
  }

  function buildSnapshot(players, statRows, weaponRows, trapRows) {
    const ucidToDiscord = {};
    const byDiscord = {};

    players.forEach((player) => {
      const discordId = String(player.discord_id || '');
      if (!discordId || discordId === String(UNLINKED)) return;
      ucidToDiscord[player.ucid] = discordId;
      const entry = byDiscord[discordId] || {
        discordId,
        ucids: [],
        name: null,
        manualName: null,
        lastSeen: null,
        lastFlight: null,
        totals: emptyTotals(),
        aircraft: {},
        weapons: {},
        traps: null,
      };
      entry.ucids.push(player.ucid);
      // Timestamps are UTC without zone: read them as epoch seconds to avoid local-time parsing.
      const seen = player.last_seen_epoch != null ? num(player.last_seen_epoch) * 1000 : null;
      // Display name: the manually linked UCID wins, then the most recently seen one.
      if (player.manual && player.name) entry.manualName = player.name;
      if (seen && (!entry.lastSeen || seen > entry.lastSeen)) {
        entry.lastSeen = seen;
        entry.name = player.name || entry.name;
      }
      if (!entry.name) entry.name = player.name || null;
      byDiscord[discordId] = entry;
    });

    statRows.forEach((row) => {
      const entry = byDiscord[ucidToDiscord[row.ucid]];
      if (!entry) return;
      const sec = num(row.sec);
      entry.totals.playtimeSec += sec;
      Object.entries(STAT_COLUMNS).forEach(([key, col]) => {
        entry.totals[key] += num(row[col]);
      });
      const type = cleanSlot(row.slot);
      const aircraft = entry.aircraft[type] || { type, sec: 0, takeoffs: 0, kills: 0 };
      aircraft.sec += sec;
      aircraft.takeoffs += num(row.takeoffs);
      aircraft.kills += num(row.kills);
      entry.aircraft[type] = aircraft;
      const flight = row.last_flight_epoch != null ? num(row.last_flight_epoch) * 1000 : null;
      if (flight && (!entry.lastFlight || flight > entry.lastFlight)) entry.lastFlight = flight;
    });

    weaponRows.forEach((row) => {
      const entry = byDiscord[ucidToDiscord[row.ucid]];
      if (!entry || !row.weapon) return;
      const weapon = entry.weapons[row.weapon] || { weapon: row.weapon, shots: 0, hits: 0 };
      weapon.shots += num(row.shots);
      weapon.hits += num(row.hits);
      entry.weapons[row.weapon] = weapon;
    });

    trapRows.forEach((row) => {
      const entry = byDiscord[ucidToDiscord[row.ucid]];
      if (!entry) return;
      const prev = entry.traps || { traps: 0, pointsSum: 0, wire3: 0 };
      prev.traps += num(row.traps);
      prev.pointsSum += num(row.avg_points) * num(row.traps);
      prev.wire3 += num(row.wire3);
      entry.traps = prev;
    });

    Object.values(byDiscord).forEach((entry) => {
      entry.name = entry.manualName || entry.name;
      delete entry.manualName;
      entry.aircraft = Object.values(entry.aircraft).sort((a, b) => b.sec - a.sec);
      entry.weapons = Object.values(entry.weapons)
        .filter((w) => w.shots > 0)
        .sort((a, b) => b.shots - a.shots);
      if (entry.traps) {
        entry.traps = {
          traps: entry.traps.traps,
          avgPoints: entry.traps.traps ? entry.traps.pointsSum / entry.traps.traps : null,
          wire3: entry.traps.wire3,
        };
      }
    });

    return byDiscord;
  }

  async function refresh() {
    if (!enabled) return snapshot;
    if (refreshing) return refreshing;
    refreshing = (async () => {
      try {
        const q = await getQuery();
        const players = await loadPlayers(q);
        const ucids = players.map((p) => p.ucid);
        const [statRows, weaponRows, trapRows] = ucids.length > 0
          ? await Promise.all([loadStatistics(q, ucids), loadWeapons(q, ucids), loadTraps(q, ucids)])
          : [[], [], []];
        snapshot = {
          ok: true,
          updatedAt: Date.now(),
          error: null,
          byDiscord: buildSnapshot(players, statRows, weaponRows, trapRows),
        };
      } catch (error) {
        console.error('DCSServerBot refresh failed:', error.message);
        // Keep the last good data, flag the error.
        snapshot = { ...snapshot, error: error.message };
      } finally {
        lastRefreshAt = Date.now();
        refreshing = null;
      }
      return snapshot;
    })();
    return refreshing;
  }

  function tick() {
    if (enabled && Date.now() - lastRefreshAt >= refreshMs) refresh();
  }

  async function close() {
    if (pool) await pool.end().catch(() => {});
    pool = null;
  }

  return {
    enabled,
    refresh,
    tick,
    close,
    getSnapshot: () => snapshot,
    getPilot: (discordId) => snapshot.byDiscord[String(discordId)] || null,
    listPilots: () => Object.values(snapshot.byDiscord),
    _internals: { buildSnapshot, cleanSlot },
  };
}

export default { createDcsServerBot };
