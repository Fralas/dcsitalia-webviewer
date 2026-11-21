/**
 * Read-only bridge to the DCSServerBot PostgreSQL database (same machine as the DCS server).
 *
 * Replaces the DCORE pilot tracker (DBRIDGE_Pilots + DPILOT_LinkHook) for the website:
 *   - Discord <-> DCS link:  players.discord_id (set by the bot's /linkme), -1 = not linked
 *   - flight figures:        statistics (userstats plugin): slot time, takeoffs, landings, kills, deaths...
 *   - weapons (optional):    missionstats (missionstats plugin): S_EVENT_SHOT / S_EVENT_HIT per weapon
 *   - kills (optional):      missionstats S_EVENT_KILL -> favourite targets and nemesis
 *   - air refueling:         refuelingstats (missionstats plugin): pounds taken, contact time, tanker type
 *   - carrier (optional):    traps (greenieboard plugin)
 *   - history:               last sorties, daily flight time (12 weeks), personal records
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
    deathsPvp: 0,
    deathsPlanes: 0,
    deathsHelicopters: 0,
    deathsShips: 0,
    deathsSams: 0,
    deathsGround: 0,
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
  deathsPvp: 'deaths_pvp',
  deathsPlanes: 'deaths_planes',
  deathsHelicopters: 'deaths_helicopters',
  deathsShips: 'deaths_ships',
  deathsSams: 'deaths_sams',
  deathsGround: 'deaths_ground',
};

const TOP_N = 5;
const RECENT_SORTIES = 4;
const ACTIVITY_DAYS = 84; // 12 weeks of activity calendar
const EMPTY_HISTORY = { sorties: [], days: [], longest: [], bestMission: [], streak: [], bestRefuel: [] };

function topList(map, limit = TOP_N) {
  return Object.values(map).sort((a, b) => b.count - a.count).slice(0, limit);
}

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
  const optional = { missionstats: true, refueling: true, traps: true };

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

  // S_EVENT_KILL rows: init_* = killer, target_* = victim; *_id is the player ucid or NULL for AI.
  async function loadKills(q, ucids) {
    if (!optional.missionstats) return { targets: [], killers: [] };
    try {
      const [targets, killers] = await Promise.all([
        q(
          `SELECT ms.init_id AS ucid, ms.target_type, ms.target_cat, COUNT(*)::int AS n
             FROM missionstats ms
             JOIN missions m ON m.id = ms.mission_id
            WHERE ms.event = 'S_EVENT_KILL' AND ms.init_id = ANY($1::text[])
              AND ms.target_type IS NOT NULL
              AND (ms.target_id IS NULL OR ms.target_id <> ms.init_id) ${serverFilter}
            GROUP BY ms.init_id, ms.target_type, ms.target_cat`,
          baseParams(ucids),
        ),
        q(
          `SELECT ms.target_id AS ucid, ms.init_type, ms.init_cat, ms.init_id AS killer_ucid,
                  p.name AS killer_name, COUNT(*)::int AS n
             FROM missionstats ms
             JOIN missions m ON m.id = ms.mission_id
             LEFT JOIN players p ON p.ucid = ms.init_id
            WHERE ms.event = 'S_EVENT_KILL' AND ms.target_id = ANY($1::text[])
              AND ms.init_type IS NOT NULL
              AND (ms.init_id IS NULL OR ms.init_id <> ms.target_id) ${serverFilter}
            GROUP BY ms.target_id, ms.init_type, ms.init_cat, ms.init_id, p.name`,
          baseParams(ucids),
        ),
      ]);
      return { targets: targets.rows, killers: killers.rows };
    } catch (error) {
      if (error?.code === '42P01') optional.missionstats = false;
      else console.error('DCSServerBot kills query failed:', error.message);
      return { targets: [], killers: [] };
    }
  }

  // refuelingstats: fuel_taken in pounds, transfer_time in mission seconds, tanker = DCS type name.
  async function loadRefueling(q, ucids) {
    if (!optional.refueling) return [];
    try {
      const { rows } = await q(
        `SELECT r.init_id AS ucid, r.tanker,
                COUNT(*)::int AS contacts,
                COUNT(*) FILTER (WHERE r.fuel_taken > 0)::int AS refuels,
                COALESCE(SUM(r.fuel_taken), 0)::bigint AS lbs,
                COALESCE(SUM(r.transfer_time) FILTER (WHERE r.fuel_taken > 0), 0)::float AS secs,
                COUNT(*) FILTER (WHERE r.transfer_complete)::int AS full_tanks
           FROM refuelingstats r
           JOIN missions m ON m.id = r.mission_id
          WHERE r.init_id = ANY($1::text[]) ${serverFilter}
          GROUP BY r.init_id, r.tanker`,
        baseParams(ucids),
      );
      return rows;
    } catch (error) {
      if (error?.code === '42P01') optional.refueling = false;
      else console.error('DCSServerBot refueling query failed:', error.message);
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

  // Seconds of one slot session, capped (an unclosed row counts up to now, at most maxSessionSec).
  const sessionSec = `LEAST(${maxSessionSec}, GREATEST(0, EXTRACT(EPOCH FROM (COALESCE(s.hop_off, NOW() AT TIME ZONE 'utc') - s.hop_on))))`;
  // Open = no hop_off yet and recent enough to be real (old unclosed rows are leftovers of a crash).
  const isOpen = `(s.hop_off IS NULL AND s.hop_on > (NOW() AT TIME ZONE 'utc') - INTERVAL '${maxSessionSec} seconds')`;
  // A sortie = a slot session that took off (or is open right now); ramp sitting is not a sortie.
  const isSortie = `(s.takeoffs > 0 OR ${isOpen})`;

  /**
   * Profile history: last sorties, daily flight time (activity calendar) and personal records.
   * Days are UTC calendar days.
   */
  async function loadHistory(q, ucids) {
    const params = baseParams(ucids);
    const [sorties, days, longest, bestMission, streak, bestRefuel] = await Promise.all([
      q(
        `SELECT * FROM (
           SELECT s.player_ucid AS ucid, s.slot, m.mission_theatre AS theatre, m.mission_name,
                  EXTRACT(EPOCH FROM s.hop_on)::bigint AS start_epoch,
                  ${sessionSec}::bigint AS sec,
                  ${isOpen} AS open,
                  s.kills, s.deaths, s.crashes, s.ejections, s.takeoffs, s.landings,
                  ROW_NUMBER() OVER (PARTITION BY s.player_ucid ORDER BY s.hop_on DESC) AS rn
             FROM statistics s
             JOIN missions m ON m.id = s.mission_id
            WHERE s.player_ucid = ANY($1::text[]) AND ${isSortie} ${serverFilter}
         ) x WHERE x.rn <= ${RECENT_SORTIES}`,
        params,
      ),
      q(
        `SELECT s.player_ucid AS ucid, to_char(s.hop_on, 'YYYY-MM-DD') AS day, SUM(${sessionSec})::bigint AS sec,
                COUNT(*) FILTER (WHERE ${isSortie})::int AS sorties
           FROM statistics s
           JOIN missions m ON m.id = s.mission_id
          WHERE s.player_ucid = ANY($1::text[])
            AND s.hop_on >= (NOW() AT TIME ZONE 'utc') - INTERVAL '${ACTIVITY_DAYS} days' ${serverFilter}
          GROUP BY s.player_ucid, day`,
        params,
      ),
      q(
        `SELECT DISTINCT ON (s.player_ucid) s.player_ucid AS ucid, s.slot, m.mission_theatre AS theatre,
                EXTRACT(EPOCH FROM s.hop_on)::bigint AS at_epoch, ${sessionSec}::bigint AS sec
           FROM statistics s
           JOIN missions m ON m.id = s.mission_id
          WHERE s.player_ucid = ANY($1::text[]) AND s.takeoffs > 0 ${serverFilter}
          ORDER BY s.player_ucid, ${sessionSec} DESC`,
        params,
      ),
      q(
        `SELECT DISTINCT ON (x.ucid) x.* FROM (
           SELECT s.player_ucid AS ucid, s.mission_id, m.mission_theatre AS theatre,
                  EXTRACT(EPOCH FROM MIN(s.hop_on))::bigint AS at_epoch, SUM(s.kills)::int AS kills
             FROM statistics s
             JOIN missions m ON m.id = s.mission_id
            WHERE s.player_ucid = ANY($1::text[]) ${serverFilter}
            GROUP BY s.player_ucid, s.mission_id, m.mission_theatre
         ) x WHERE x.kills > 0
         ORDER BY x.ucid, x.kills DESC, x.at_epoch DESC`,
        params,
      ),
      // Longest run of sorties in a row without dying, crashing or ejecting (gaps and islands).
      q(
        `WITH runs AS (
           SELECT s.player_ucid AS ucid, s.hop_on,
                  (s.deaths > 0 OR s.crashes > 0 OR s.ejections > 0) AS lost,
                  SUM(CASE WHEN s.deaths > 0 OR s.crashes > 0 OR s.ejections > 0 THEN 1 ELSE 0 END)
                    OVER (PARTITION BY s.player_ucid ORDER BY s.hop_on ROWS UNBOUNDED PRECEDING) AS grp
             FROM statistics s
             JOIN missions m ON m.id = s.mission_id
            WHERE s.player_ucid = ANY($1::text[]) AND s.takeoffs > 0 ${serverFilter}
         )
         SELECT ucid, MAX(n)::int AS best, (ARRAY_AGG(n ORDER BY last_at DESC))[1]::int AS current
           FROM (SELECT ucid, grp, COUNT(*) FILTER (WHERE NOT lost) AS n, MAX(hop_on) AS last_at FROM runs GROUP BY ucid, grp) g
          GROUP BY ucid`,
        params,
      ),
      optional.refueling
        ? q(
          `SELECT DISTINCT ON (r.init_id) r.init_id AS ucid, r.tanker, r.fuel_taken::bigint AS lbs,
                  EXTRACT(EPOCH FROM r.time)::bigint AS at_epoch
             FROM refuelingstats r
             JOIN missions m ON m.id = r.mission_id
            WHERE r.init_id = ANY($1::text[]) AND r.fuel_taken > 0 ${serverFilter}
            ORDER BY r.init_id, r.fuel_taken DESC`,
          params,
        ).catch((error) => {
          if (error?.code === '42P01') optional.refueling = false;
          else console.error('DCSServerBot refuel record query failed:', error.message);
          return { rows: [] };
        })
        : { rows: [] },
    ]);
    return {
      sorties: sorties.rows,
      days: days.rows,
      longest: longest.rows,
      bestMission: bestMission.rows,
      streak: streak.rows,
      bestRefuel: bestRefuel.rows,
    };
  }

  function buildSnapshot(players, statRows, weaponRows, trapRows, kills = { targets: [], killers: [] }, refuelRows = [], history = EMPTY_HISTORY) {
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
        targets: {},
        nemeses: {},
        refueling: null,
        traps: null,
        sorties: [],
        activity: {},
        records: {},
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

    kills.targets.forEach((row) => {
      const entry = byDiscord[ucidToDiscord[row.ucid]];
      if (!entry) return;
      const key = row.target_type;
      const item = entry.targets[key] || { type: row.target_type, category: row.target_cat || null, count: 0 };
      item.count += num(row.n);
      entry.targets[key] = item;
    });

    kills.killers.forEach((row) => {
      const entry = byDiscord[ucidToDiscord[row.ucid]];
      if (!entry) return;
      // A human killer is one nemesis whatever he flies; AI killers are grouped by unit type.
      const key = row.killer_ucid ? `player:${row.killer_ucid}` : `type:${row.init_type}`;
      const item = entry.nemeses[key] || {
        type: row.init_type,
        category: row.init_cat || null,
        player: row.killer_ucid ? (row.killer_name || 'Pilota') : null,
        count: 0,
      };
      item.count += num(row.n);
      entry.nemeses[key] = item;
    });

    refuelRows.forEach((row) => {
      const entry = byDiscord[ucidToDiscord[row.ucid]];
      if (!entry) return;
      const r = entry.refueling || { contacts: 0, refuels: 0, lbs: 0, secs: 0, fullTanks: 0, tankers: {} };
      r.contacts += num(row.contacts);
      r.refuels += num(row.refuels);
      r.lbs += num(row.lbs);
      r.secs += num(row.secs);
      r.fullTanks += num(row.full_tanks);
      const key = row.tanker || '?';
      const t = r.tankers[key] || { tanker: row.tanker || null, contacts: 0, refuels: 0, lbs: 0, secs: 0, fullTanks: 0 };
      t.contacts += num(row.contacts);
      t.refuels += num(row.refuels);
      t.lbs += num(row.lbs);
      t.secs += num(row.secs);
      t.fullTanks += num(row.full_tanks);
      r.tankers[key] = t;
      entry.refueling = r;
    });

    // --- history: last sorties, activity calendar, personal records ---
    const entryOf = (row) => byDiscord[ucidToDiscord[row.ucid]];
    history.sorties.forEach((row) => {
      const entry = entryOf(row);
      if (!entry) return;
      const lost = num(row.deaths) > 0 || num(row.crashes) > 0;
      let outcome = 'unknown'; // left the slot airborne / disconnected
      if (row.open) outcome = 'open';
      else if (lost) outcome = 'lost';
      else if (num(row.ejections) > 0) outcome = 'ejected';
      else if (num(row.landings) > 0) outcome = 'landed';
      entry.sorties.push({
        at: num(row.start_epoch) * 1000,
        type: cleanSlot(row.slot),
        theatre: row.theatre || null,
        mission: row.mission_name || null,
        sec: num(row.sec),
        kills: num(row.kills),
        deaths: num(row.deaths),
        outcome,
      });
    });
    history.days.forEach((row) => {
      const entry = entryOf(row);
      if (!entry || !row.day) return;
      const day = entry.activity[row.day] || { sec: 0, sorties: 0 };
      day.sec += num(row.sec);
      day.sorties += num(row.sorties);
      entry.activity[row.day] = day;
    });
    const better = (entry, key, record, value) => {
      if (!entry.records[key] || value > entry.records[key].value) entry.records[key] = { ...record, value };
    };
    history.longest.forEach((row) => {
      const entry = entryOf(row);
      if (entry && num(row.sec) > 0) better(entry, 'longestSortie', { at: num(row.at_epoch) * 1000, type: cleanSlot(row.slot), theatre: row.theatre }, num(row.sec));
    });
    history.bestMission.forEach((row) => {
      const entry = entryOf(row);
      if (entry) better(entry, 'mostKills', { at: num(row.at_epoch) * 1000, theatre: row.theatre }, num(row.kills));
    });
    history.streak.forEach((row) => {
      const entry = entryOf(row);
      if (entry) better(entry, 'cleanStreak', { current: num(row.current) }, num(row.best));
    });
    history.bestRefuel.forEach((row) => {
      const entry = entryOf(row);
      if (entry) better(entry, 'biggestRefuel', { at: num(row.at_epoch) * 1000, tanker: row.tanker }, num(row.lbs));
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
      entry.targets = topList(entry.targets);
      entry.nemeses = topList(entry.nemeses, 3);
      entry.sorties = entry.sorties.sort((a, b) => b.at - a.at).slice(0, RECENT_SORTIES);
      if (entry.refueling) {
        const r = entry.refueling;
        // Per-tanker breakdown, most used first (the profile lets the pilot filter by tanker).
        const byTanker = Object.values(r.tankers)
          .map((t) => ({
            tanker: t.tanker,
            contacts: t.contacts,
            refuels: t.refuels,
            lbs: t.lbs,
            avgSec: t.refuels ? t.secs / t.refuels : null,
            fullTanks: t.fullTanks,
          }))
          .sort((a, b) => b.refuels - a.refuels || b.contacts - a.contacts);
        const topTanker = byTanker.find((t) => t.tanker);
        entry.refueling = {
          contacts: r.contacts,
          refuels: r.refuels,
          lbs: r.lbs,
          avgSec: r.refuels ? r.secs / r.refuels : null,
          fullTanks: r.fullTanks,
          topTanker: topTanker ? topTanker.tanker : null,
          byTanker,
        };
      }
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
        const [statRows, weaponRows, trapRows, kills, refuelRows, history] = ucids.length > 0
          ? await Promise.all([
            loadStatistics(q, ucids),
            loadWeapons(q, ucids),
            loadTraps(q, ucids),
            loadKills(q, ucids),
            loadRefueling(q, ucids),
            loadHistory(q, ucids),
          ])
          : [[], [], [], { targets: [], killers: [] }, [], EMPTY_HISTORY];
        snapshot = {
          ok: true,
          updatedAt: Date.now(),
          error: null,
          byDiscord: buildSnapshot(players, statRows, weaponRows, trapRows, kills, refuelRows, history),
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
