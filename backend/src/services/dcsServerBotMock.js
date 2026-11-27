/**
 * DEV ONLY: fake DCSServerBot data to work on the profile UI without the bot database.
 * Enabled by DCSSB_MOCK=true (ignored when NODE_ENV=production). Same interface as createDcsServerBot().
 *
 * Every Discord account that opens its profile is "linked" and gets a stable, plausible set of stats
 * (seeded by the Discord id), plus a few fake pilots for the leaderboard. Also fakes the DCORE
 * cargo logistics (getCargo: crates and troops), so every profile block has data.
 */

function seededRandom(seedText) {
  let seed = 0;
  for (const ch of String(seedText)) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

const AIRCRAFT = ['F-16C_50', 'FA-18C_hornet', 'AH-64D_BLK_II', 'UH-1H', 'A-10C_2', 'CH-47Fbl1', 'F-15ESE'];
const TARGETS = [
  ['T-72B', 'Ground Units'], ['BMP-2', 'Ground Units'], ['ZSU-23-4 Shilka', 'Ground Units'],
  ['SA-11 Buk LN 9A310M1', 'Ground Units'], ['MiG-29S', 'Airplanes'], ['Mi-24P', 'Helicopters'],
  ['Ural-375', 'Ground Units'], ['Tor 9A331', 'Ground Units'],
];
const KILLERS = [
  ['SA-11 Buk LN 9A310M1', 'Ground Units', null], ['ZSU-23-4 Shilka', 'Ground Units', null],
  ['MiG-29S', 'Airplanes', null], ['F-16C_50', 'Airplanes', 'Viper'], ['Tor 9A331', 'Ground Units', null],
];
const WEAPONS = ['AIM_120C', 'AIM_9X', 'GBU_12', 'AGM_65D', 'Mk_82', 'M151 HE'];
const THEATRES = ['Caucasus', 'Syria', 'PersianGulf', 'Kola'];
const TANKER_TYPES =['KC135MPRS', 'KC130', 'S3BTanker', 'KC-135'];
const FAKE_PILOTS = [
  ['mock-1', 'Viper'], ['mock-2', 'Ghost'], ['mock-3', 'Maverick'], ['mock-4', 'Iceman'], ['mock-5', 'Lupo'],
];

function int(rand, min, max) {
  return Math.floor(min + rand() * (max - min + 1));
}

function mockEntry(discordId, name) {
  const rand = seededRandom(discordId);
  const aircraft = AIRCRAFT.slice(0, int(rand, 3, 6)).map((type, i) => ({
    type,
    sec: Math.round((40 - i * 6) * 3600 * (0.4 + rand())),
    takeoffs: int(rand, 5, 60),
    kills: int(rand, 0, 40),
  })).map((a) => ({
    ...a,
    landings: Math.round(a.takeoffs * (0.7 + rand() * 0.25)),
    deaths: int(rand, 0, Math.max(1, Math.round(a.takeoffs / 6))),
  })).sort((a, b) => b.sec - a.sec);
  const playtimeSec = aircraft.reduce((s, a) => s + a.sec, 0);
  const takeoffs = aircraft.reduce((s, a) => s + a.takeoffs, 0);
  const killsBy = {
    killsPlanes: int(rand, 2, 25),
    killsHelicopters: int(rand, 0, 12),
    killsSams: int(rand, 3, 30),
    killsGround: int(rand, 20, 160),
    killsShips: int(rand, 0, 4),
  };
  const kills = Object.values(killsBy).reduce((s, n) => s + n, 0);
  const deathsBy = {
    deathsPlanes: int(rand, 1, 8),
    deathsHelicopters: int(rand, 0, 3),
    deathsSams: int(rand, 3, 14),
    deathsGround: int(rand, 2, 10),
    deathsShips: int(rand, 0, 2),
  };
  const deathsKnown = Object.values(deathsBy).reduce((s, n) => s + n, 0);
  const crashes = int(rand, 1, 6);
  const targets = TARGETS.map(([type, category]) => ({ type, category, count: int(rand, 1, 45) }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
  const nemeses = KILLERS.map(([type, category, player]) => ({ type, category, player, count: int(rand, 1, 9) }))
    .sort((a, b) => b.count - a.count).slice(0, 3);
  const weapons = WEAPONS.map((weapon) => {
    const shots = int(rand, 4, 90);
    const hits = Math.round(shots * (0.25 + rand() * 0.6));
    return { weapon, shots, hits, kills: Math.round(hits * (0.3 + rand() * 0.5)) };
  }).sort((a, b) => b.shots - a.shots);
  const byTanker = TANKER_TYPES.slice(0, int(rand, 2, TANKER_TYPES.length)).map((tanker) => {
    const n = int(rand, 2, 18);
    return {
      tanker,
      contacts: n + int(rand, 0, 3),
      refuels: n,
      lbs: n * int(rand, 2500, 6000),
      avgSec: 90 + rand() * 180,
      fullTanks: Math.round(n * (0.4 + rand() * 0.4)),
    };
  }).sort((a, b) => b.refuels - a.refuels);
  const refuels = byTanker.reduce((s, t) => s + t.refuels, 0);

  // Last sorties, newest first.
  const OUTCOMES = ['landed', 'landed', 'landed', 'landed', 'lost', 'ejected', 'unknown'];
  let cursor = Date.now() - int(rand, 1, 20) * 3600 * 1000;
  const sorties = Array.from({ length: 8 }, (_, i) => {
    const a = aircraft[int(rand, 0, aircraft.length - 1)];
    const sec = int(rand, 18, 150) * 60;
    const outcome = i === 0 && rand() > 0.6 ? 'open' : OUTCOMES[int(rand, 0, OUTCOMES.length - 1)];
    const sortie = {
      at: cursor,
      type: a.type,
      theatre: THEATRES[int(rand, 0, THEATRES.length - 1)],
      mission: 'HIDC Campaign',
      sec,
      kills: rand() > 0.35 ? int(rand, 1, 7) : 0,
      deaths: outcome === 'lost' ? 1 : 0,
      outcome,
    };
    cursor -= int(rand, 5, 60) * 3600 * 1000;
    return sortie;
  });

  // Activity calendar: 12 weeks of UTC days, a few evenings a week.
  const activity = {};
  const today = new Date();
  for (let d = 0; d < 84; d += 1) {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - d));
    const weekend = day.getUTCDay() === 0 || day.getUTCDay() === 6;
    if (rand() < (weekend ? 0.65 : 0.3)) {
      activity[day.toISOString().slice(0, 10)] = { sec: int(rand, 20, weekend ? 300 : 150) * 60, sorties: int(rand, 1, 5) };
    }
  }

  const records = {
    longestSortie: { value: int(rand, 140, 320) * 60, type: aircraft[0].type, theatre: THEATRES[0], at: Date.now() - int(rand, 3, 60) * 86400000 },
    mostKills: { value: int(rand, 6, 22), theatre: THEATRES[1], at: Date.now() - int(rand, 3, 60) * 86400000 },
    cleanStreak: { value: int(rand, 9, 34), current: int(rand, 0, 9) },
    biggestRefuel: { value: int(rand, 9000, 16000), tanker: byTanker[0].tanker, at: Date.now() - int(rand, 3, 60) * 86400000 },
  };
  const bestKm = int(rand, 18, 75);
  const troops = int(rand, 10, 240);

  // Last 12 months, oldest first ('YYYY-MM' UTC).
  const monthly = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - i), 1));
    const sortiesN = int(rand, 2, 30);
    return {
      month: d.toISOString().slice(0, 7),
      sec: sortiesN * int(rand, 35, 80) * 60,
      sorties: sortiesN,
      kills: int(rand, 0, sortiesN * 2),
      deaths: int(rand, 0, Math.ceil(sortiesN / 4)),
    };
  });

  // Flight time by weekday (0 = Monday) x UTC hour: evenings and weekend afternoons.
  const hours = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => {
    const evening = hour >= 18 && hour <= 23;
    const weekendDay = day >= 5 && hour >= 13 && hour <= 23;
    const p = evening ? 0.75 : weekendDay ? 0.6 : hour >= 9 && hour <= 17 ? 0.1 : 0.02;
    return rand() < p ? int(rand, 10, 180) * 60 : 0;
  }));

  const theatres = THEATRES.map((theatre) => ({ theatre, sec: int(rand, 2, 60) * 3600 }))
    .sort((a, b) => b.sec - a.sec);
  const sides = { blue: Math.round(playtimeSec * (0.7 + rand() * 0.25)) };
  sides.red = playtimeSec - sides.blue;

  const trapsN = int(rand, 8, 60);
  const trapGrades = { '_OK_': int(rand, 0, 4), OK: int(rand, 3, 18), '(OK)': int(rand, 3, 14), '--': int(rand, 1, 8), B: int(rand, 0, 5), WO: int(rand, 0, 6), C: int(rand, 0, 2) };
  const traps = rand() > 0.15 ? {
    traps: trapsN,
    avgPoints: 2.5 + rand() * 1.5,
    wire3: int(rand, 2, Math.round(trapsN / 2)),
    grades: trapGrades,
    wires: { 1: int(rand, 0, 8), 2: int(rand, 2, 14), 3: int(rand, 4, 22), 4: int(rand, 0, 6) },
    cases: { 1: int(rand, 6, 30), 2: int(rand, 0, 6), 3: int(rand, 0, 10) },
    night: int(rand, 0, 9),
  } : null;

  return {
    sorties,
    activity,
    records,
    discordId: String(discordId),
    ucids: [`MOCK-${discordId}`],
    name: name || 'Pilota di prova',
    lastSeen: Date.now() - int(rand, 1, 48) * 3600 * 1000,
    lastFlight: Date.now() - int(rand, 1, 30) * 3600 * 1000,
    totals: {
      playtimeSec,
      takeoffs,
      landings: Math.round(takeoffs * (0.75 + rand() * 0.2)),
      kills,
      pvp: int(rand, 0, 6),
      deaths: deathsKnown + crashes,
      ejections: int(rand, 1, 8),
      crashes,
      teamkills: int(rand, 0, 2),
      ...killsBy,
      deathsPvp: int(rand, 0, 3),
      ...deathsBy,
    },
    aircraft,
    weapons,
    targets,
    nemeses,
    refueling: {
      contacts: byTanker.reduce((s, t) => s + t.contacts, 0),
      refuels,
      lbs: byTanker.reduce((s, t) => s + t.lbs, 0),
      avgSec: byTanker.reduce((s, t) => s + t.avgSec * t.refuels, 0) / refuels,
      fullTanks: byTanker.reduce((s, t) => s + t.fullTanks, 0),
      topTanker: byTanker[0].tanker,
      byTanker,
    },
    traps,
    monthly,
    hours,
    theatres,
    sides,
    credits: { points: int(rand, 200, 4800), campaign: 'HIDC' },
    cargo: {
      deliveries: int(rand, 4, 80),
      kg: int(rand, 8, 140) * 1000,
      km: int(rand, 40, 900),
      tkm: int(rand, 60, 2500),
      last: Math.floor(Date.now() / 1000) - 7200,
      bestKm,
      bestKg: int(rand, 1, 5) * 1000,
      bestAt: Math.floor(Date.now() / 1000) - int(rand, 3, 40) * 86400,
      troops,
      troopsKg: troops * 100,
      troopsKm: int(rand, 20, 400),
      troopsTkm: Math.round(troops * 0.1 * int(rand, 3, 20)),
    },
  };
}

export function createDcsServerBotMock() {
  const entries = new Map();
  FAKE_PILOTS.forEach(([id, name]) => entries.set(id, mockEntry(id, name)));

  function getPilot(discordId) {
    const id = String(discordId || '');
    if (!id) return null;
    if (!entries.has(id)) entries.set(id, mockEntry(id, null));
    return entries.get(id);
  }

  const snapshot = () => ({ ok: true, updatedAt: Date.now(), error: null, byDiscord: Object.fromEntries(entries) });

  return {
    enabled: true,
    mock: true,
    refresh: async () => snapshot(),
    tick: () => {},
    close: async () => {},
    getSnapshot: snapshot,
    getPilot,
    // Every Discord account counts as linked in the mock.
    findLinkedPlayers: async (discordId) => {
      const entry = getPilot(discordId);
      return entry ? [{ ucid: entry.ucids[0], name: entry.name }] : [];
    },
    listPilots: () => [...entries.values()],
    // Fake DCORE logistics for the same pilots.
    getCargo: (ucids) => {
      const entry = [...entries.values()].find((e) => (ucids || []).includes(e.ucids[0]));
      return entry ? entry.cargo : null;
    },
  };
}

export default { createDcsServerBotMock };
