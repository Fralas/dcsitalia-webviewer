import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  computeWarehouseDeltaDiff,
  exportPendingWarehouseOps,
  getUnitDcsType,
  isWarehouseSpawnableCategory,
  LIDC_EXPORT_FILES,
  processDeferredWarehouseOps,
  queueWarehouseDeltaOps,
  queueWarehouseOpsForSquadronDeck,
  resolveBaseIdFromDcsAirbaseName,
  resolveDcsAirbaseName,
  writeJsonAtomic,
} from './lidcDcsBridge.js';

const DATA_DIR = path.resolve(process.cwd(), 'data/lidc');
// Filename kept from the pre-specialization schema so existing deployments keep their catalog.
const CATALOG_FILE = path.join(DATA_DIR, 'templates.json');
const SQUADRONS_FILE = path.join(DATA_DIR, 'squadrons.json');
const DISCORD_USERS_FILE = path.join(DATA_DIR, 'discord-users.json');
const UCID_LINKS_FILE = path.join(DATA_DIR, 'ucid-links.json');
const LINK_CODES_FILE = path.join(DATA_DIR, 'link-codes.json');
const LINK_CODE_TTL_MS = 10 * 60 * 1000;
const LINK_CODE_PATTERN = /^LIDC-[A-Z0-9]{6}$/;
const MAX_LOGO_DATA_URL_LENGTH = 12_000_000;
const BOARD_NUMBER_PATTERN = /^\d{3}[A-Z]{2}$/;
const BOARD_NUMBER_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const BOARD_NUMBER_MAX_ATTEMPTS = 20_000;
const INVITE_CODE_PATTERN = /^[A-Z0-9]{8}$/;
const INVITE_CODE_MAX_ATTEMPTS = 200;

export const DECK_CATEGORIES = Object.freeze([
  'aircrafts',
  'helicopters',
  'logistics',
  'groundAssets',
]);

export const LIDC_MEMBER_ROLES = Object.freeze([
  'owner',
  'admin',
  'leader',
  'member',
]);

const LIDC_ROLE_PRIORITY = Object.freeze({
  owner: 0,
  admin: 1,
  leader: 2,
  member: 3,
});

export const SPECIALIZATION_SLOTS = 2;

const DEFAULT_CATALOG_SEED = Object.freeze({
  specializations: [
    {
      id: 'air-superiority',
      name: 'Superiorita Aerea',
      description: 'Caccia da intercettazione e controllo dello spazio aereo.',
      caps: {
        aircrafts: 340,
        helicopters: 60,
        logistics: 60,
        groundAssets: 40,
      },
    },
    {
      id: 'strike-package',
      name: 'Strike Package',
      description: 'Attacco al suolo e interdizione a lungo raggio.',
      caps: {
        aircrafts: 290,
        helicopters: 80,
        logistics: 70,
        groundAssets: 60,
      },
    },
    {
      id: 'rotary-wing',
      name: 'Ala Rotante',
      description: 'Elicotteri da attacco e ricognizione armata.',
      caps: {
        aircrafts: 50,
        helicopters: 300,
        logistics: 90,
        groundAssets: 60,
      },
    },
    {
      id: 'air-assault',
      name: 'Air Assault',
      description: 'Trasporto tattico e inserimento rapido di truppe.',
      caps: {
        aircrafts: 60,
        helicopters: 200,
        logistics: 150,
        groundAssets: 90,
      },
    },
    {
      id: 'sustainment',
      name: 'Sustainment',
      description: 'Rifornimento, trasporto strategico e supporto logistico.',
      caps: {
        aircrafts: 50,
        helicopters: 90,
        logistics: 260,
        groundAssets: 100,
      },
    },
    {
      id: 'ground-defense',
      name: 'Difesa Terrestre',
      description: 'Difesa aerea integrata e assetti corazzati.',
      caps: {
        aircrafts: 60,
        helicopters: 70,
        logistics: 90,
        groundAssets: 280,
      },
    },
  ],
  units: [
    { id: 'f16c', label: 'F-16C', category: 'aircrafts', cost: 95, dcsType: 'F-16C_50' },
    { id: 'fa18c', label: 'F/A-18C Hornet', category: 'aircrafts', cost: 100, dcsType: 'F/A-18C_hornet' },
    { id: 'f15e', label: 'F-15E Strike Eagle', category: 'aircrafts', cost: 120, dcsType: 'F-15ESE' },
    { id: 'a10c2', label: 'A-10C II', category: 'aircrafts', cost: 85, dcsType: 'A-10C_2' },
    { id: 'm2000c', label: 'Mirage 2000C', category: 'aircrafts', cost: 80, dcsType: 'M-2000C' },

    { id: 'ah64d', label: 'AH-64D Apache', category: 'helicopters', cost: 110, dcsType: 'AH-64D_BLK_II' },
    { id: 'oh58d', label: 'OH-58D Kiowa', category: 'helicopters', cost: 65, dcsType: 'OH58D' },
    { id: 'ka50', label: 'Ka-50', category: 'helicopters', cost: 95, dcsType: 'Ka-50' },
    { id: 'mi24p', label: 'Mi-24P Hind', category: 'helicopters', cost: 100, dcsType: 'Mi-24P' },
    { id: 'sa342', label: 'SA-342 Gazelle', category: 'helicopters', cost: 55, dcsType: 'SA342M' },

    { id: 'c130j', label: 'C-130J Super Hercules', category: 'logistics', cost: 130, dcsType: 'C-130J-30' },
    { id: 'ch47f', label: 'CH-47F Chinook', category: 'logistics', cost: 115, dcsType: 'CH-47Fbl1' },
    { id: 'mi8mt', label: 'Mi-8MT', category: 'logistics', cost: 90, dcsType: 'Mi-8MT' },
    { id: 'uh1h', label: 'UH-1H Huey', category: 'logistics', cost: 70, dcsType: 'UH-1H' },

    { id: 'm1a2', label: 'M1A2 Abrams', category: 'groundAssets', cost: 85 },
    { id: 'bradley', label: 'M2A2 Bradley IFV', category: 'groundAssets', cost: 60 },
    { id: 'nasams', label: 'NASAMS Battery', category: 'groundAssets', cost: 105 },
    { id: 'patriot', label: 'Patriot SAM Site', category: 'groundAssets', cost: 140 },
    { id: 'farp-team', label: 'FARP Support Team', category: 'groundAssets', cost: 45 },
  ],
});

function ensureStorage() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(CATALOG_FILE)) {
    writeJsonAtomic(CATALOG_FILE, {
      specializations: DEFAULT_CATALOG_SEED.specializations,
      units: DEFAULT_CATALOG_SEED.units,
      updatedAt: Date.now(),
    });
  }

  if (!fs.existsSync(SQUADRONS_FILE)) {
    writeJsonAtomic(SQUADRONS_FILE, []);
  }

  if (!fs.existsSync(DISCORD_USERS_FILE)) {
    writeJsonAtomic(DISCORD_USERS_FILE, []);
  }

  if (!fs.existsSync(UCID_LINKS_FILE)) {
    writeJsonAtomic(UCID_LINKS_FILE, {});
  }

  if (!fs.existsSync(LINK_CODES_FILE)) {
    writeJsonAtomic(LINK_CODES_FILE, {});
  }

  ensureSquadronInviteCodes();
}

function readJson(filePath, fallback) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error(`LIDC read error (${filePath}):`, error.message);
    return fallback;
  }
}

function sanitizeText(value, maxLen = 500) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function sanitizeUserId(value, maxLen = 80) {
  if (value == null || value === '') return '';
  const source = typeof value === 'string' ? value : String(value);
  return source.trim().slice(0, maxLen);
}

function normalizeCategory(value) {
  const key = sanitizeText(value, 40);
  return DECK_CATEGORIES.includes(key) ? key : null;
}

function normalizeCap(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function normalizeQuantity(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.floor(num);
}

function normalizeMemberRole(value, fallback = 'member') {
  const normalized = sanitizeText(value, 40).toLowerCase();
  if (LIDC_MEMBER_ROLES.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function getRolePermissions(roleRaw) {
  const role = normalizeMemberRole(roleRaw);
  return {
    role,
    canManageRoles: role === 'owner',
    canPurchaseAirframes: role === 'admin',
    canManageAssignedAirframes: role === 'owner' || role === 'admin' || role === 'leader',
  };
}

function normalizeCapsMap(rawCaps) {
  const caps = {};
  DECK_CATEGORIES.forEach((category) => {
    caps[category] = normalizeCap(rawCaps?.[category]);
  });
  return caps;
}

function normalizeSpecialization(rawSpecialization, index = 0) {
  const id = sanitizeText(rawSpecialization?.id, 80) || `specialization_${Date.now()}_${index}`;
  const name = sanitizeText(rawSpecialization?.name, 120) || `Specialization ${index + 1}`;
  const description = sanitizeText(rawSpecialization?.description, 500);
  return {
    id,
    name,
    description,
    caps: normalizeCapsMap(rawSpecialization?.caps),
  };
}

function sumSpecializationCaps(specializations) {
  const caps = {};
  DECK_CATEGORIES.forEach((category) => {
    caps[category] = (Array.isArray(specializations) ? specializations : []).reduce(
      (sum, specialization) => sum + normalizeCap(specialization?.caps?.[category]),
      0,
    );
  });
  return caps;
}

function normalizeUnit(rawUnit, index = 0) {
  const category = normalizeCategory(rawUnit?.category);
  if (!category) return null;

  const id = sanitizeText(rawUnit?.id, 80) || `unit_${Date.now()}_${index}`;
  const label = sanitizeText(rawUnit?.label, 120) || id;
  const cost = normalizeCap(rawUnit?.cost);
  const dcsType = sanitizeText(rawUnit?.dcsType, 80) || null;

  if (!id || !label || cost <= 0) {
    return null;
  }

  const unit = {
    id,
    label,
    category,
    cost,
  };

  if (dcsType) {
    unit.dcsType = dcsType;
  }

  return unit;
}

/**
 * Legacy catalogs stored one `templates` entry per squadron. Squadrons now combine
 * SPECIALIZATION_SLOTS entries, so caps are divided to keep the total budget comparable.
 */
function migrateLegacyTemplatesToSpecializations(rawTemplates) {
  return rawTemplates.map((entry, index) => {
    const specialization = normalizeSpecialization(entry, index);
    DECK_CATEGORIES.forEach((category) => {
      specialization.caps[category] = Math.floor(specialization.caps[category] / SPECIALIZATION_SLOTS);
    });
    return specialization;
  });
}

function readCatalogState() {
  const raw = readJson(CATALOG_FILE, {
    specializations: DEFAULT_CATALOG_SEED.specializations,
    units: DEFAULT_CATALOG_SEED.units,
    updatedAt: Date.now(),
  });

  const units = Array.isArray(raw?.units)
    ? raw.units.map((entry, index) => normalizeUnit(entry, index)).filter(Boolean)
    : [];

  if (Array.isArray(raw?.specializations)) {
    return {
      specializations: raw.specializations
        .map((entry, index) => normalizeSpecialization(entry, index))
        .filter(Boolean),
      units,
      updatedAt: Number.isFinite(raw?.updatedAt) ? raw.updatedAt : Date.now(),
    };
  }

  const specializations = Array.isArray(raw?.templates)
    ? migrateLegacyTemplatesToSpecializations(raw.templates)
    : DEFAULT_CATALOG_SEED.specializations.map((entry, index) => normalizeSpecialization(entry, index));

  const migrated = {
    specializations,
    units: units.length > 0
      ? units
      : DEFAULT_CATALOG_SEED.units.map((entry, index) => normalizeUnit(entry, index)).filter(Boolean),
    updatedAt: Date.now(),
  };

  writeJsonAtomic(CATALOG_FILE, migrated);
  return migrated;
}

function writeCatalogState(state) {
  const rawSpecializations = Array.isArray(state?.specializations)
    ? state.specializations
    : (Array.isArray(state?.templates) ? state.templates : []);

  const specializations = rawSpecializations
    .map((entry, index) => normalizeSpecialization(entry, index))
    .filter(Boolean);

  const units = Array.isArray(state?.units)
    ? state.units.map((entry, index) => normalizeUnit(entry, index)).filter(Boolean)
    : [];

  if (specializations.length < SPECIALIZATION_SLOTS) {
    throw new Error(`At least ${SPECIALIZATION_SLOTS} specializations are required`);
  }
  if (units.length === 0) {
    throw new Error('At least one unit is required');
  }

  const dedupeSpecializationIds = new Set();
  specializations.forEach((specialization) => {
    if (dedupeSpecializationIds.has(specialization.id)) {
      throw new Error(`Duplicate specialization id: ${specialization.id}`);
    }
    dedupeSpecializationIds.add(specialization.id);
  });

  const dedupeUnitIds = new Set();
  units.forEach((unit) => {
    if (dedupeUnitIds.has(unit.id)) {
      throw new Error(`Duplicate unit id: ${unit.id}`);
    }
    dedupeUnitIds.add(unit.id);
  });

  const payload = {
    specializations,
    units,
    updatedAt: Date.now(),
  };

  writeJsonAtomic(CATALOG_FILE, payload);
  return payload;
}

function readSquadrons() {
  const raw = readJson(SQUADRONS_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function writeSquadrons(squadrons) {
  writeJsonAtomic(SQUADRONS_FILE, Array.isArray(squadrons) ? squadrons : []);
}

function readDiscordUsers() {
  const raw = readJson(DISCORD_USERS_FILE, []);
  return Array.isArray(raw) ? raw : [];
}

function writeDiscordUsers(users) {
  writeJsonAtomic(DISCORD_USERS_FILE, Array.isArray(users) ? users : []);
}

function buildAvatarUrl(userId, avatar) {
  if (!userId || !avatar) return '';
  return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png`;
}

function normalizeDiscordUser(rawUser) {
  const id = sanitizeText(rawUser?.id, 80);
  if (!id) return null;

  const globalName = sanitizeText(
    rawUser?.globalName || rawUser?.global_name || rawUser?.displayName || rawUser?.username,
    140,
  );
  const username = sanitizeText(rawUser?.username, 140);
  const avatar = sanitizeText(rawUser?.avatar, 200);
  const lastSeenAt = Number.isFinite(rawUser?.lastSeenAt) ? rawUser.lastSeenAt : Date.now();

  return {
    id,
    globalName,
    username,
    avatar,
    avatarUrl: buildAvatarUrl(id, avatar),
    lastSeenAt,
  };
}

function normalizeDeckInput(rawDeck) {
  const normalizedDeck = {};

  DECK_CATEGORIES.forEach((category) => {
    const list = Array.isArray(rawDeck?.[category]) ? rawDeck[category] : [];
    const aggregated = new Map();

    list.forEach((entry) => {
      const unitId = sanitizeText(entry?.unitId || entry?.id, 80);
      const quantity = normalizeQuantity(entry?.quantity ?? entry?.qty);
      if (!unitId || quantity <= 0) return;
      aggregated.set(unitId, (aggregated.get(unitId) || 0) + quantity);
    });

    normalizedDeck[category] = Array.from(aggregated.entries()).map(([unitId, quantity]) => ({
      unitId,
      quantity,
    }));
  });

  return normalizedDeck;
}

function calculateCostSummary({ deck, caps: rawCaps, unitsById }) {
  const spent = {};
  const caps = {};
  const remaining = {};

  let totalSpent = 0;
  let totalUnits = 0;

  DECK_CATEGORIES.forEach((category) => {
    const entries = Array.isArray(deck?.[category]) ? deck[category] : [];
    const cap = normalizeCap(rawCaps?.[category]);

    let categorySpent = 0;
    entries.forEach((entry) => {
      const unit = unitsById.get(entry.unitId);
      if (!unit) {
        throw new Error(`Unknown unit: ${entry.unitId}`);
      }
      if (unit.category !== category) {
        throw new Error(`Unit ${entry.unitId} does not belong to category ${category}`);
      }

      categorySpent += unit.cost * normalizeQuantity(entry.quantity);
      totalUnits += normalizeQuantity(entry.quantity);
    });

    if (categorySpent > cap) {
      throw new Error(`Category cap exceeded for ${category}`);
    }

    spent[category] = categorySpent;
    caps[category] = cap;
    remaining[category] = Math.max(0, cap - categorySpent);
    totalSpent += categorySpent;
  });

  return {
    caps,
    spent,
    remaining,
    totalSpent,
    totalUnits,
  };
}

function normalizeSpecializationIdsInput(rawIds, specializationsById) {
  const list = Array.isArray(rawIds) ? rawIds : [];
  const selected = [];

  list.forEach((value) => {
    const id = sanitizeText(value, 80);
    if (!id || selected.includes(id)) return;
    if (!specializationsById.has(id)) {
      throw new Error(`Unknown specialization: ${id}`);
    }
    selected.push(id);
  });

  if (selected.length !== SPECIALIZATION_SLOTS) {
    throw new Error(`Exactly ${SPECIALIZATION_SLOTS} distinct specializations are required`);
  }

  return selected;
}

function resolveSquadronSpecializations(squadron, specializationsById) {
  const storedIds = Array.isArray(squadron?.specializationIds)
    ? squadron.specializationIds
    : [squadron?.templateId];

  return storedIds
    .map((id) => specializationsById.get(sanitizeText(id, 80)))
    .filter(Boolean);
}

/**
 * Squadrons created before specializations existed were budgeted against a single template.
 * Their persisted caps are reused so an existing deck never becomes retroactively invalid.
 */
function resolveSquadronCaps(squadron, specializationsById) {
  if (!Array.isArray(squadron?.specializationIds)) {
    const storedCaps = squadron?.costSummary?.caps;
    const hasStoredCaps = storedCaps
      && DECK_CATEGORIES.some((category) => normalizeCap(storedCaps[category]) > 0);
    if (hasStoredCaps) {
      return normalizeCapsMap(storedCaps);
    }
  }

  return sumSpecializationCaps(resolveSquadronSpecializations(squadron, specializationsById));
}

function readSquadronSpecializationNames(squadron) {
  const stored = Array.isArray(squadron?.specializationNames) ? squadron.specializationNames : [];
  const names = stored.map((value) => sanitizeText(value, 120)).filter(Boolean);
  if (names.length > 0) return names;

  const legacyName = sanitizeText(squadron?.templateName, 120);
  return legacyName ? [legacyName] : [];
}

function normalizeInviteCode(value) {
  const cleaned = sanitizeText(value, 16).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return INVITE_CODE_PATTERN.test(cleaned) ? cleaned : '';
}

function generateUniqueInviteCode(takenCodes) {
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    if (!takenCodes.has(code)) {
      takenCodes.add(code);
      return code;
    }
  }

  throw new Error('Unable to generate invite code');
}

function ensureSquadronInviteCodes() {
  const squadrons = readSquadrons();
  const taken = new Set();
  let changed = false;

  squadrons.forEach((squadron) => {
    const existing = normalizeInviteCode(squadron?.inviteCode);
    if (existing && !taken.has(existing)) {
      if (squadron.inviteCode !== existing) {
        squadron.inviteCode = existing;
        changed = true;
      }
      taken.add(existing);
    }
  });

  squadrons.forEach((squadron) => {
    if (!normalizeInviteCode(squadron?.inviteCode)) {
      squadron.inviteCode = generateUniqueInviteCode(taken);
      changed = true;
    }
  });

  if (changed) {
    writeSquadrons(squadrons);
  }
}

function normalizeBoardNumber(value) {
  const normalized = sanitizeText(value, 32).toUpperCase().replace(/[^0-9A-Z]/g, '');
  return BOARD_NUMBER_PATTERN.test(normalized) ? normalized : '';
}

function generateBoardNumber(taken) {
  for (let attempt = 0; attempt < BOARD_NUMBER_MAX_ATTEMPTS; attempt += 1) {
    const digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    const firstLetter = BOARD_NUMBER_LETTERS[Math.floor(Math.random() * BOARD_NUMBER_LETTERS.length)];
    const secondLetter = BOARD_NUMBER_LETTERS[Math.floor(Math.random() * BOARD_NUMBER_LETTERS.length)];
    const boardNumber = `${digits}${firstLetter}${secondLetter}`;

    if (!taken.has(boardNumber)) {
      taken.add(boardNumber);
      return boardNumber;
    }
  }

  throw new Error('Unable to generate unique board number');
}

function buildSquadronMemberUserIdSet(squadron) {
  const memberIds = new Set();

  const createdById = sanitizeUserId(squadron?.createdBy?.id, 80);
  if (createdById) {
    memberIds.add(createdById);
  }

  const members = Array.isArray(squadron?.members) ? squadron.members : [];
  members.forEach((entry) => {
    const userId = sanitizeUserId(entry?.userId, 80);
    if (userId) {
      memberIds.add(userId);
    }
  });

  return memberIds;
}

function getMemberRoleInSquadron(squadron, userIdRaw) {
  const userId = sanitizeText(userIdRaw, 80);
  if (!userId || !squadron) return '';

  const ownerId = sanitizeText(squadron?.createdBy?.id, 80);
  if (ownerId && ownerId === userId) {
    return 'owner';
  }

  const members = Array.isArray(squadron?.members) ? squadron.members : [];
  const match = members.find((entry) => sanitizeText(entry?.userId, 80) === userId);
  if (!match) return '';

  return normalizeMemberRole(match.role, 'member');
}

function toAirframeSortKey(unit) {
  return `${sanitizeText(unit?.category, 40)}::${sanitizeText(unit?.label, 120)}::${sanitizeText(unit?.id, 80)}`;
}

function sanitizeAirframeAssignmentUserId(rawUserId, memberUserIds) {
  const userId = sanitizeUserId(rawUserId, 80);
  if (!userId) return null;
  return memberUserIds.has(userId) ? userId : null;
}

function createAirframe(unit, memberUserIds, takenBoardNumbers, deckIndex = 0) {
  return {
    id: `airframe_${unit.id}_${deckIndex + 1}_${crypto.randomBytes(3).toString('hex')}`,
    unitId: unit.id,
    unitLabel: unit.label,
    category: unit.category,
    cost: normalizeCap(unit.cost),
    boardNumber: generateBoardNumber(takenBoardNumbers),
    assignedPilotUserId: sanitizeAirframeAssignmentUserId(null, memberUserIds),
    createdAt: Date.now(),
  };
}

function normalizeAirframeRecord(rawAirframe, unit, memberUserIds, takenBoardNumbers, deckIndex = 0) {
  const id = sanitizeText(rawAirframe?.id, 160) || `airframe_${unit.id}_${deckIndex + 1}_${crypto.randomBytes(3).toString('hex')}`;

  let boardNumber = normalizeBoardNumber(rawAirframe?.boardNumber);
  if (!boardNumber || takenBoardNumbers.has(boardNumber)) {
    boardNumber = generateBoardNumber(takenBoardNumbers);
  } else {
    takenBoardNumbers.add(boardNumber);
  }

  return {
    id,
    unitId: unit.id,
    unitLabel: sanitizeText(rawAirframe?.unitLabel, 120) || unit.label,
    category: unit.category,
    cost: normalizeCap(rawAirframe?.cost) || normalizeCap(unit.cost),
    boardNumber,
    assignedPilotUserId: sanitizeAirframeAssignmentUserId(rawAirframe?.assignedPilotUserId, memberUserIds),
    createdAt: Number.isFinite(rawAirframe?.createdAt) ? rawAirframe.createdAt : Date.now(),
  };
}

function buildDeckEntriesExpanded(deck, unitsById) {
  const expanded = [];

  DECK_CATEGORIES.forEach((category) => {
    const entries = Array.isArray(deck?.[category]) ? deck[category] : [];
    entries.forEach((entry) => {
      const unitId = sanitizeText(entry?.unitId, 80);
      const quantity = normalizeQuantity(entry?.quantity);
      const unit = unitsById.get(unitId);
      if (!unit || quantity <= 0) return;

      for (let index = 0; index < quantity; index += 1) {
        expanded.push({ unit, deckIndex: index });
      }
    });
  });

  expanded.sort((a, b) => toAirframeSortKey(a.unit).localeCompare(toAirframeSortKey(b.unit), 'en', { numeric: true }));
  return expanded;
}

function syncSquadronAirframesInMemory(squadron, unitsById) {
  const memberUserIds = buildSquadronMemberUserIdSet(squadron);
  const expandedEntries = buildDeckEntriesExpanded(squadron?.deck, unitsById);
  const currentAirframes = Array.isArray(squadron?.airframes) ? squadron.airframes : [];

  const bucketsByUnitId = new Map();
  currentAirframes.forEach((airframe) => {
    const unitId = sanitizeText(airframe?.unitId, 80);
    if (!unitId) return;
    if (!bucketsByUnitId.has(unitId)) {
      bucketsByUnitId.set(unitId, []);
    }
    bucketsByUnitId.get(unitId).push(airframe);
  });

  const takenBoardNumbers = new Set();
  const nextAirframes = expandedEntries.map(({ unit, deckIndex }) => {
    const bucket = bucketsByUnitId.get(unit.id) || [];
    const reusable = bucket.shift();
    if (!reusable) {
      return createAirframe(unit, memberUserIds, takenBoardNumbers, deckIndex);
    }

    return normalizeAirframeRecord(reusable, unit, memberUserIds, takenBoardNumbers, deckIndex);
  });

  const hadAirframes = Array.isArray(squadron?.airframes);
  const changed = !hadAirframes
    || nextAirframes.length !== currentAirframes.length
    || nextAirframes.some((airframe, index) => {
      const previous = currentAirframes[index];
      if (!previous) return true;
      return (
        sanitizeText(previous?.id, 160) !== sanitizeText(airframe.id, 160)
        || sanitizeText(previous?.unitId, 80) !== sanitizeText(airframe.unitId, 80)
        || sanitizeText(previous?.unitLabel, 120) !== sanitizeText(airframe.unitLabel, 120)
        || sanitizeText(previous?.category, 40) !== sanitizeText(airframe.category, 40)
        || normalizeCap(previous?.cost) !== normalizeCap(airframe.cost)
        || sanitizeText(previous?.boardNumber, 16).toUpperCase() !== airframe.boardNumber
        || sanitizeText(previous?.assignedPilotUserId, 80) !== sanitizeText(airframe.assignedPilotUserId, 80)
      );
    });

  squadron.airframes = nextAirframes;
  return changed;
}

function ensureSquadronAirframesPersistedById(squadronId) {
  const targetId = sanitizeText(squadronId, 120);
  if (!targetId) return null;

  const squadrons = readSquadrons();
  const index = squadrons.findIndex((entry) => sanitizeText(entry?.id, 120) === targetId);
  if (index < 0) return null;

  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));

  const squadron = { ...squadrons[index] };
  const changed = syncSquadronAirframesInMemory(squadron, unitsById);

  if (changed) {
    squadrons[index] = squadron;
    writeSquadrons(squadrons);
  }

  return squadron;
}

function listSquadronMembersForDisplay(squadron) {
  const users = getDiscordUsers();
  const usersById = new Map(users.map((entry) => [sanitizeText(entry?.id, 80), entry]));
  const memberIds = buildSquadronMemberUserIdSet(squadron);
  const ownerId = sanitizeText(squadron?.createdBy?.id, 80);
  const members = Array.isArray(squadron?.members) ? squadron.members : [];
  const roleByUserId = new Map();

  members.forEach((member) => {
    const userId = sanitizeText(member?.userId, 80);
    if (!userId) return;
    const role = normalizeMemberRole(member?.role, userId === ownerId ? 'owner' : 'member');
    roleByUserId.set(userId, role);
  });

  if (ownerId && !roleByUserId.has(ownerId)) {
    roleByUserId.set(ownerId, 'owner');
  }

  return Array.from(memberIds.values())
    .map((userId) => {
      const fromHistory = usersById.get(userId) || null;
      const isOwner = userId === ownerId;
      const createdBy = sanitizeText(squadron?.createdBy?.id, 80) === userId ? squadron.createdBy : null;

      const globalName = sanitizeText(
        fromHistory?.globalName
        || createdBy?.globalName
        || fromHistory?.username
        || createdBy?.username
        || userId,
        140,
      );
      const username = sanitizeText(fromHistory?.username || createdBy?.username, 140);
      const avatar = sanitizeText(fromHistory?.avatar || createdBy?.avatar, 200);
      const lastSeenAt = Number.isFinite(fromHistory?.lastSeenAt) ? fromHistory.lastSeenAt : null;
      const role = roleByUserId.get(userId) || (isOwner ? 'owner' : 'member');
      const permissions = getRolePermissions(role);

      return {
        userId,
        role: permissions.role,
        permissions,
        globalName,
        username,
        avatar,
        avatarUrl: buildAvatarUrl(userId, avatar),
        lastSeenAt,
      };
    })
    .sort((a, b) => {
      const priorityA = Number.isFinite(LIDC_ROLE_PRIORITY[a.role]) ? LIDC_ROLE_PRIORITY[a.role] : 999;
      const priorityB = Number.isFinite(LIDC_ROLE_PRIORITY[b.role]) ? LIDC_ROLE_PRIORITY[b.role] : 999;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return String(a.globalName || a.username || a.userId).localeCompare(
        String(b.globalName || b.username || b.userId),
        'en',
        { sensitivity: 'base', numeric: true },
      );
    });
}

export function getSpecializationsCatalog() {
  ensureStorage();
  return readCatalogState();
}

export function updateSpecializationsCatalog(payload) {
  ensureStorage();
  return writeCatalogState(payload);
}

export function upsertDiscordUser(rawUser) {
  ensureStorage();
  const normalized = normalizeDiscordUser(rawUser);
  if (!normalized) return null;

  const users = readDiscordUsers();
  const index = users.findIndex((entry) => sanitizeText(entry?.id, 80) === normalized.id);

  if (index >= 0) {
    const current = normalizeDiscordUser(users[index]) || {};
    const merged = {
      ...current,
      ...normalized,
      globalName: normalized.globalName || current.globalName || current.username || '',
      username: normalized.username || current.username || '',
      avatar: normalized.avatar || current.avatar || '',
      lastSeenAt: Date.now(),
    };
    merged.avatarUrl = buildAvatarUrl(merged.id, merged.avatar);
    users[index] = merged;
    writeDiscordUsers(users);
    return merged;
  }

  const nextUser = {
    ...normalized,
    lastSeenAt: Date.now(),
    avatarUrl: buildAvatarUrl(normalized.id, normalized.avatar),
  };
  users.push(nextUser);
  writeDiscordUsers(users);
  return nextUser;
}

export function getDiscordUsers() {
  ensureStorage();
  return readDiscordUsers()
    .map((entry) => normalizeDiscordUser(entry))
    .filter(Boolean)
    .sort((a, b) => (Number(b.lastSeenAt) || 0) - (Number(a.lastSeenAt) || 0));
}

export function createSquadron(payload, sessionUser) {
  ensureStorage();

  const userId = sanitizeText(sessionUser?.id, 80);
  if (!userId) {
    throw new Error('Authentication required');
  }

  const existingSquadron = getUserPrimarySquadron(userId);
  if (existingSquadron) {
    const existingName = sanitizeText(existingSquadron?.name, 120) || '-';
    throw new Error(`Already in squadron: ${existingName}`);
  }

  const name = sanitizeText(payload?.name, 120);
  if (!name) {
    throw new Error('Squadron name is required');
  }

  const description = sanitizeText(payload?.description, 1200);
  const baseId = sanitizeText(payload?.baseId, 120);
  if (!baseId) {
    throw new Error('Base is required');
  }

  const logoDataUrl = sanitizeText(payload?.logoDataUrl, MAX_LOGO_DATA_URL_LENGTH);
  if (logoDataUrl.length > MAX_LOGO_DATA_URL_LENGTH) {
    throw new Error('Logo is too large');
  }

  const catalogState = readCatalogState();
  const specializationsById = new Map(catalogState.specializations.map((entry) => [entry.id, entry]));
  const specializationIds = normalizeSpecializationIdsInput(
    payload?.specializationIds,
    specializationsById,
  );
  const specializations = specializationIds.map((id) => specializationsById.get(id));

  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  const deck = normalizeDeckInput(payload?.deck || {});
  const costSummary = calculateCostSummary({
    deck,
    caps: sumSpecializationCaps(specializations),
    unitsById,
  });

  if (costSummary.totalUnits <= 0) {
    throw new Error('Deck must include at least one unit');
  }

  const squadrons = readSquadrons();
  const takenCodes = new Set(
    squadrons
      .map((entry) => normalizeInviteCode(entry?.inviteCode))
      .filter(Boolean),
  );
  const inviteCode = generateUniqueInviteCode(takenCodes);
  const createdAt = Date.now();

  const squadron = {
    id: `lidc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    name,
    description,
    logoDataUrl,
    baseId,
    specializationIds,
    specializationNames: specializations.map((entry) => entry.name),
    deck,
    inviteCode,
    members: [
      {
        userId,
        role: 'owner',
        joinedAt: createdAt,
      },
    ],
    costSummary,
    createdAt,
    createdBy: {
      id: userId,
      globalName: sanitizeText(sessionUser?.globalName, 140),
      username: sanitizeText(sessionUser?.username, 140),
      avatar: sanitizeText(sessionUser?.avatar, 200),
      avatarUrl: buildAvatarUrl(userId, sanitizeText(sessionUser?.avatar, 200)),
    },
  };
  syncSquadronAirframesInMemory(squadron, unitsById);

  squadrons.push(squadron);
  writeSquadrons(squadrons);

  queueWarehouseOpsForSquadronDeck({
    squadronId: squadron.id,
    baseId: squadron.baseId,
    deck: squadron.deck,
    unitsById,
    squadron,
  });
  exportPendingWarehouseOps();
  exportLidcAirframeRegistry();

  return squadron;
}

export function updateSquadronDeck({ squadronId, deck, actorUserId }) {
  ensureStorage();

  const normalizedSquadronId = sanitizeText(squadronId, 120);
  const normalizedActorUserId = sanitizeText(actorUserId, 80);
  if (!normalizedSquadronId) {
    throw new Error('squadronId is required');
  }
  if (!normalizedActorUserId) {
    throw new Error('Authentication required');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex(
    (entry) => sanitizeText(entry?.id, 120) === normalizedSquadronId,
  );
  if (squadronIndex < 0) {
    throw new Error('Squadron not found');
  }

  const squadron = { ...squadrons[squadronIndex] };
  if (!isUserMemberOfSquadron(squadron, normalizedActorUserId)) {
    throw new Error('Only squadron members can edit the deck');
  }

  const actorRole = getMemberRoleInSquadron(squadron, normalizedActorUserId);
  const actorPermissions = getRolePermissions(actorRole);
  if (!actorPermissions.canManageRoles) {
    throw new Error('Only the squadron owner can edit the deck');
  }

  const catalogState = readCatalogState();
  const specializationsById = new Map(catalogState.specializations.map((entry) => [entry.id, entry]));
  const caps = resolveSquadronCaps(squadron, specializationsById);

  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  const previousDeck = squadron.deck;
  const nextDeck = normalizeDeckInput(deck || {});
  const costSummary = calculateCostSummary({
    deck: nextDeck,
    caps,
    unitsById,
  });

  if (costSummary.totalUnits <= 0) {
    throw new Error('Deck must include at least one unit');
  }

  const warehouseDeltas = computeWarehouseDeltaDiff(previousDeck, nextDeck, unitsById);

  squadron.deck = nextDeck;
  squadron.costSummary = costSummary;
  squadron.updatedAt = Date.now();
  syncSquadronAirframesInMemory(squadron, unitsById);

  squadrons[squadronIndex] = squadron;
  writeSquadrons(squadrons);

  if (warehouseDeltas.length > 0) {
    queueWarehouseDeltaOps({
      squadronId: squadron.id,
      baseId: squadron.baseId,
      deltas: warehouseDeltas,
      unitsById,
      squadron,
    });
    exportPendingWarehouseOps();
  }

  exportLidcAirframeRegistry();

  return {
    squadron: {
      ...squadron,
      memberProfiles: listSquadronMembersForDisplay(squadron),
    },
    warehouseDeltas,
  };
}

export function listSquadrons() {
  ensureStorage();

  return readSquadrons()
    .map((squadron) => ({
      id: sanitizeText(squadron?.id, 120),
      name: sanitizeText(squadron?.name, 120),
      logoDataUrl: sanitizeText(squadron?.logoDataUrl, MAX_LOGO_DATA_URL_LENGTH) || '',
      specializationNames: readSquadronSpecializationNames(squadron),
      baseId: sanitizeText(squadron?.baseId, 120),
      memberCount: Array.isArray(squadron?.members) ? squadron.members.length : 0,
      createdAt: Number.isFinite(squadron?.createdAt) ? squadron.createdAt : null,
    }))
    .filter((entry) => entry.id && entry.name)
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

export function getSquadronById(squadronId, actorUserId = '') {
  ensureStorage();
  const targetId = sanitizeText(squadronId, 120);
  if (!targetId) return null;

  const squadron = ensureSquadronAirframesPersistedById(targetId);
  if (!squadron) return null;

  const actorId = sanitizeText(actorUserId, 80);
  const isMember = actorId && isUserMemberOfSquadron(squadron, actorId);
  const result = {
    ...squadron,
    specializationNames: readSquadronSpecializationNames(squadron),
    memberProfiles: listSquadronMembersForDisplay(squadron),
  };

  if (!isMember) {
    delete result.inviteCode;
  }

  return result;
}

export function joinSquadronByInviteCode({ inviteCode, sessionUser }) {
  ensureStorage();

  const userId = sanitizeText(sessionUser?.id, 80);
  if (!userId) {
    throw new Error('Authentication required');
  }

  const existingSquadron = getUserPrimarySquadron(userId);
  if (existingSquadron) {
    const existingName = sanitizeText(existingSquadron?.name, 120) || '-';
    throw new Error(`Already in squadron: ${existingName}`);
  }

  const normalizedCode = normalizeInviteCode(inviteCode);
  if (!normalizedCode) {
    throw new Error('Invalid invite code');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex(
    (entry) => normalizeInviteCode(entry?.inviteCode) === normalizedCode,
  );
  if (squadronIndex < 0) {
    throw new Error('Invite code not found');
  }

  const squadron = { ...squadrons[squadronIndex] };
  if (isUserMemberOfSquadron(squadron, userId)) {
    throw new Error('Already in squadron');
  }

  const joinedAt = Date.now();
  const currentMembers = Array.isArray(squadron.members) ? squadron.members : [];
  squadron.members = [
    ...currentMembers,
    {
      userId,
      role: 'member',
      joinedAt,
    },
  ];

  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  syncSquadronAirframesInMemory(squadron, unitsById);

  squadrons[squadronIndex] = squadron;
  writeSquadrons(squadrons);

  return {
    ...squadron,
    memberProfiles: listSquadronMembersForDisplay(squadron),
  };
}

export function updateAirframeAssignment({ squadronId, airframeId, pilotUserId, actorUserId }) {
  ensureStorage();

  const normalizedSquadronId = sanitizeText(squadronId, 120);
  const normalizedAirframeId = sanitizeText(airframeId, 160);
  const normalizedActorUserId = sanitizeUserId(actorUserId, 80);
  const normalizedPilotUserId = sanitizeUserId(pilotUserId, 80);

  if (!normalizedSquadronId || !normalizedAirframeId) {
    throw new Error('squadronId and airframeId are required');
  }
  if (!normalizedActorUserId) {
    throw new Error('Authentication required');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex((entry) => sanitizeText(entry?.id, 120) === normalizedSquadronId);
  if (squadronIndex < 0) {
    throw new Error('Squadron not found');
  }

  const squadron = { ...squadrons[squadronIndex] };
  if (!isUserMemberOfSquadron(squadron, normalizedActorUserId)) {
    throw new Error('Only squadron members can manage airframe assignments');
  }

  const actorRole = getMemberRoleInSquadron(squadron, normalizedActorUserId);
  const actorPermissions = getRolePermissions(actorRole);
  if (!actorPermissions.canManageAssignedAirframes) {
    throw new Error('Only leaders can manage airframe assignments');
  }

  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  syncSquadronAirframesInMemory(squadron, unitsById);

  const airframes = Array.isArray(squadron.airframes) ? squadron.airframes : [];
  const airframeIndex = airframes.findIndex((entry) => sanitizeText(entry?.id, 160) === normalizedAirframeId);
  if (airframeIndex < 0) {
    throw new Error('Airframe not found');
  }

  const memberUserIds = buildSquadronMemberUserIdSet(squadron);
  let nextPilotUserId = null;

  if (normalizedPilotUserId) {
    if (!memberUserIds.has(normalizedPilotUserId)) {
      throw new Error('Pilot must be a squadron member');
    }
    nextPilotUserId = normalizedPilotUserId;
  }

  airframes[airframeIndex] = {
    ...airframes[airframeIndex],
    assignedPilotUserId: nextPilotUserId,
    updatedAt: Date.now(),
  };
  squadron.airframes = airframes;

  squadrons[squadronIndex] = squadron;
  writeSquadrons(squadrons);
  exportLidcAirframeRegistry();

  return {
    squadron: {
      ...squadron,
      memberProfiles: listSquadronMembersForDisplay(squadron),
    },
    airframe: squadron.airframes[airframeIndex],
  };
}

export function updateSquadronMemberRole({
  squadronId,
  targetUserId,
  role,
  actorUserId,
}) {
  ensureStorage();

  const normalizedSquadronId = sanitizeText(squadronId, 120);
  const normalizedTargetUserId = sanitizeText(targetUserId, 80);
  const normalizedActorUserId = sanitizeText(actorUserId, 80);
  const normalizedNextRole = normalizeMemberRole(role, '');

  if (!normalizedSquadronId || !normalizedTargetUserId) {
    throw new Error('squadronId and targetUserId are required');
  }
  if (!normalizedActorUserId) {
    throw new Error('Authentication required');
  }
  if (!normalizedNextRole || normalizedNextRole === 'owner') {
    throw new Error('Role must be one of: admin, leader, member');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex((entry) => sanitizeText(entry?.id, 120) === normalizedSquadronId);
  if (squadronIndex < 0) {
    throw new Error('Squadron not found');
  }

  const squadron = { ...squadrons[squadronIndex] };
  if (!isUserMemberOfSquadron(squadron, normalizedActorUserId)) {
    throw new Error('Only squadron members can manage roles');
  }

  const actorPermissions = getRolePermissions(getMemberRoleInSquadron(squadron, normalizedActorUserId));
  if (!actorPermissions.canManageRoles) {
    throw new Error('Only owners can manage roles');
  }

  const ownerId = sanitizeText(squadron?.createdBy?.id, 80);
  if (normalizedTargetUserId === ownerId) {
    throw new Error('Cannot change owner role');
  }
  if (normalizedTargetUserId === normalizedActorUserId) {
    throw new Error('Owner cannot change own role');
  }

  if (!isUserMemberOfSquadron(squadron, normalizedTargetUserId)) {
    throw new Error('Target user must be a squadron member');
  }

  const currentMembers = Array.isArray(squadron.members) ? squadron.members : [];
  const memberIndex = currentMembers.findIndex((entry) => sanitizeText(entry?.userId, 80) === normalizedTargetUserId);

  if (memberIndex < 0) {
    throw new Error('Target user must be a squadron member');
  }

  const nextMembers = [...currentMembers];
  nextMembers[memberIndex] = {
    ...nextMembers[memberIndex],
    role: normalizedNextRole,
    updatedAt: Date.now(),
  };
  squadron.members = nextMembers;

  squadrons[squadronIndex] = squadron;
  writeSquadrons(squadrons);

  return {
    squadron: {
      ...squadron,
      memberProfiles: listSquadronMembersForDisplay(squadron),
    },
    targetUserId: normalizedTargetUserId,
    role: normalizedNextRole,
    permissions: getRolePermissions(normalizedNextRole),
    purchaseAirframesFeature: {
      enabled: false,
      note: 'Placeholder: purchase flow not implemented yet',
    },
  };
}

export function removeSquadronMember({
  squadronId,
  targetUserId,
  actorUserId,
}) {
  ensureStorage();

  const normalizedSquadronId = sanitizeText(squadronId, 120);
  const normalizedTargetUserId = sanitizeText(targetUserId, 80);
  const normalizedActorUserId = sanitizeText(actorUserId, 80);

  if (!normalizedSquadronId || !normalizedTargetUserId) {
    throw new Error('squadronId and targetUserId are required');
  }
  if (!normalizedActorUserId) {
    throw new Error('Authentication required');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex((entry) => sanitizeText(entry?.id, 120) === normalizedSquadronId);
  if (squadronIndex < 0) {
    throw new Error('Squadron not found');
  }

  const squadron = { ...squadrons[squadronIndex] };
  if (!isUserMemberOfSquadron(squadron, normalizedActorUserId)) {
    throw new Error('Only squadron members can manage members');
  }

  const actorPermissions = getRolePermissions(getMemberRoleInSquadron(squadron, normalizedActorUserId));
  if (!actorPermissions.canManageRoles) {
    throw new Error('Only owners can manage members');
  }

  const ownerId = sanitizeText(squadron?.createdBy?.id, 80);
  if (normalizedTargetUserId === ownerId) {
    throw new Error('Cannot remove squadron owner');
  }
  if (normalizedTargetUserId === normalizedActorUserId) {
    throw new Error('Owner cannot remove themselves');
  }

  if (!isUserMemberOfSquadron(squadron, normalizedTargetUserId)) {
    throw new Error('Target user must be a squadron member');
  }

  const currentMembers = Array.isArray(squadron.members) ? squadron.members : [];
  const nextMembers = currentMembers.filter(
    (entry) => sanitizeText(entry?.userId, 80) !== normalizedTargetUserId,
  );

  if (nextMembers.length === currentMembers.length) {
    throw new Error('Target user must be a squadron member');
  }

  squadron.members = nextMembers;

  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  syncSquadronAirframesInMemory(squadron, unitsById);

  squadrons[squadronIndex] = squadron;
  writeSquadrons(squadrons);

  return {
    squadron: {
      ...squadron,
      memberProfiles: listSquadronMembersForDisplay(squadron),
    },
    removedUserId: normalizedTargetUserId,
  };
}

export function leaveSquadron({
  squadronId,
  actorUserId,
}) {
  ensureStorage();

  const normalizedSquadronId = sanitizeText(squadronId, 120);
  const normalizedActorUserId = sanitizeText(actorUserId, 80);

  if (!normalizedSquadronId) {
    throw new Error('squadronId is required');
  }
  if (!normalizedActorUserId) {
    throw new Error('Authentication required');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex((entry) => sanitizeText(entry?.id, 120) === normalizedSquadronId);
  if (squadronIndex < 0) {
    throw new Error('Squadron not found');
  }

  const squadron = { ...squadrons[squadronIndex] };
  if (!isUserMemberOfSquadron(squadron, normalizedActorUserId)) {
    throw new Error('Only squadron members can leave squadron');
  }

  const ownerId = sanitizeText(squadron?.createdBy?.id, 80);
  if (normalizedActorUserId === ownerId) {
    throw new Error('Owner cannot leave squadron');
  }

  const currentMembers = Array.isArray(squadron.members) ? squadron.members : [];
  const nextMembers = currentMembers.filter(
    (entry) => sanitizeText(entry?.userId, 80) !== normalizedActorUserId,
  );

  if (nextMembers.length === currentMembers.length) {
    throw new Error('Target user must be a squadron member');
  }

  squadron.members = nextMembers;

  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  syncSquadronAirframesInMemory(squadron, unitsById);

  squadrons[squadronIndex] = squadron;
  writeSquadrons(squadrons);

  return {
    squadron: {
      ...squadron,
      memberProfiles: listSquadronMembersForDisplay(squadron),
    },
    leftUserId: normalizedActorUserId,
  };
}

export function deleteSquadron({
  squadronId,
  actorUserId,
}) {
  ensureStorage();

  const normalizedSquadronId = sanitizeText(squadronId, 120);
  const normalizedActorUserId = sanitizeText(actorUserId, 80);

  if (!normalizedSquadronId) {
    throw new Error('squadronId is required');
  }
  if (!normalizedActorUserId) {
    throw new Error('Authentication required');
  }

  const squadrons = readSquadrons();
  const squadronIndex = squadrons.findIndex((entry) => sanitizeText(entry?.id, 120) === normalizedSquadronId);
  if (squadronIndex < 0) {
    throw new Error('Squadron not found');
  }

  const squadron = squadrons[squadronIndex];
  if (!isUserMemberOfSquadron(squadron, normalizedActorUserId)) {
    throw new Error('Only squadron members can delete squadron');
  }

  const ownerId = sanitizeText(squadron?.createdBy?.id, 80);
  if (!ownerId || normalizedActorUserId !== ownerId) {
    throw new Error('Only owner can delete squadron');
  }

  const removed = squadrons.splice(squadronIndex, 1)[0];
  writeSquadrons(squadrons);

  return {
    deleted: true,
    squadronId: normalizedSquadronId,
    squadronName: sanitizeText(removed?.name, 120),
  };
}

function isUserMemberOfSquadron(squadron, userId) {
  if (!squadron || !userId) return false;

  if (sanitizeText(squadron?.createdBy?.id, 80) === userId) {
    return true;
  }

  const members = Array.isArray(squadron?.members) ? squadron.members : [];
  return members.some((entry) => sanitizeText(entry?.userId, 80) === userId);
}

export function getUserPrimarySquadron(userIdRaw) {
  ensureStorage();
  const userId = sanitizeText(userIdRaw, 80);
  if (!userId) return null;

  const squadrons = readSquadrons();
  const mine = squadrons
    .filter((entry) => isUserMemberOfSquadron(entry, userId))
    .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));

  return mine[0] || null;
}

export function getUserLidcState(userIdRaw) {
  ensureStorage();
  const userId = sanitizeText(userIdRaw, 80);
  if (!userId) {
    return {
      hasSquadron: false,
      squadron: null,
    };
  }

  const squadron = getUserPrimarySquadron(userId);

  return {
    hasSquadron: Boolean(squadron),
    squadron: squadron
      ? {
          id: sanitizeText(squadron?.id, 120),
          name: sanitizeText(squadron?.name, 120),
          specializationNames: readSquadronSpecializationNames(squadron),
          baseId: sanitizeText(squadron?.baseId, 120),
          createdAt: Number.isFinite(squadron?.createdAt) ? squadron.createdAt : null,
        }
      : null,
  };
}

function readUcidLinks() {
  const raw = readJson(UCID_LINKS_FILE, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function writeUcidLinks(links) {
  writeJsonAtomic(UCID_LINKS_FILE, links);
}

function readLinkCodes() {
  const raw = readJson(LINK_CODES_FILE, {});
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function writeLinkCodes(codes) {
  writeJsonAtomic(LINK_CODES_FILE, codes);
}

function pruneExpiredLinkCodes(codes = readLinkCodes()) {
  const now = Date.now();
  let changed = false;
  const next = { ...codes };

  Object.entries(next).forEach(([code, entry]) => {
    const expiresAt = Number(entry?.expiresAt) || 0;
    if (expiresAt <= now) {
      delete next[code];
      changed = true;
    }
  });

  if (changed) {
    writeLinkCodes(next);
  }

  return next;
}

function generateLinkCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i += 1) {
    suffix += alphabet[crypto.randomInt(0, alphabet.length)];
  }
  return `LIDC-${suffix}`;
}

export function startUcidLink(userId) {
  ensureStorage();

  const normalizedUserId = sanitizeText(userId, 80);
  if (!normalizedUserId) {
    throw new Error('Authentication required');
  }

  const links = readUcidLinks();
  if (links[normalizedUserId]?.ucid) {
    return {
      linked: true,
      link: links[normalizedUserId],
    };
  }

  const codes = pruneExpiredLinkCodes();
  const existingPending = Object.entries(codes).find(([, entry]) => (
    sanitizeText(entry?.discordId, 80) === normalizedUserId
  ));
  if (existingPending) {
    const [existingCode, existingEntry] = existingPending;
    return {
      linked: false,
      code: existingCode,
      expiresAt: existingEntry.expiresAt,
      instructions: 'Type this code in DCS chat while connected to the server.',
    };
  }

  let code = '';
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = generateLinkCode();
    if (!codes[candidate]) {
      code = candidate;
      break;
    }
  }

  if (!code) {
    throw new Error('Unable to generate link code');
  }

  const expiresAt = Date.now() + LINK_CODE_TTL_MS;
  codes[code] = {
    discordId: normalizedUserId,
    expiresAt,
    createdAt: Date.now(),
  };
  writeLinkCodes(codes);

  return {
    linked: false,
    code,
    expiresAt,
    instructions: 'Type this code in DCS chat while connected to the server.',
  };
}

export function getUcidLinkStatus(userId) {
  ensureStorage();

  const normalizedUserId = sanitizeText(userId, 80);
  if (!normalizedUserId) {
    throw new Error('Authentication required');
  }

  const links = readUcidLinks();
  const link = links[normalizedUserId] || null;
  if (link?.ucid) {
    return {
      linked: true,
      link: {
        ucid: link.ucid,
        name: link.name || null,
        linkedAt: link.linkedAt || null,
      },
    };
  }

  const codes = pruneExpiredLinkCodes();
  const pending = Object.entries(codes).find(([, entry]) => (
    sanitizeText(entry?.discordId, 80) === normalizedUserId
  ));

  if (!pending) {
    return { linked: false, pending: null };
  }

  const [code, entry] = pending;
  return {
    linked: false,
    pending: {
      code,
      expiresAt: entry.expiresAt,
    },
  };
}

export function processUcidLinkRequests(requests = []) {
  ensureStorage();

  if (!Array.isArray(requests) || requests.length === 0) {
    return { linked: [], skipped: 0 };
  }

  const codes = pruneExpiredLinkCodes();
  const links = readUcidLinks();
  const linked = [];
  let skipped = 0;

  requests.forEach((request) => {
    const code = sanitizeText(request?.code, 16).toUpperCase();
    const ucid = sanitizeText(request?.ucid, 120);
    const name = sanitizeText(request?.name, 120);

    if (!code || !LINK_CODE_PATTERN.test(code) || !ucid) {
      skipped += 1;
      return;
    }

    const pending = codes[code];
    if (!pending) {
      skipped += 1;
      return;
    }

    const discordId = sanitizeText(pending.discordId, 80);
    if (!discordId) {
      skipped += 1;
      return;
    }

    links[discordId] = {
      ucid,
      name: name || null,
      linkedAt: Date.now(),
    };

    delete codes[code];
    linked.push({
      discordId,
      ucid,
      name: name || null,
      code,
    });
  });

  if (linked.length > 0) {
    writeUcidLinks(links);
    writeLinkCodes(codes);
    exportLidcAirframeRegistry();
  }

  return { linked, skipped };
}

export function getUcidLinksMap() {
  ensureStorage();
  return readUcidLinks();
}

function buildAirframeRegistryPayload() {
  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  const links = readUcidLinks();
  const squadrons = readSquadrons();
  const nameToUcid = {};

  Object.entries(links).forEach(([discordId, link]) => {
    const ucid = sanitizeText(link?.ucid, 120);
    const name = sanitizeText(link?.name, 120);
    if (name && ucid) {
      nameToUcid[name.toLowerCase()] = ucid;
    }
    if (ucid) {
      nameToUcid[discordId] = ucid;
    }
  });

  const airframes = [];
  squadrons.forEach((squadron) => {
    const homeAirbase = resolveDcsAirbaseName(squadron?.baseId);
    const squadronAirframes = Array.isArray(squadron?.airframes) ? squadron.airframes : [];
    squadronAirframes.forEach((airframe) => {
      const unit = unitsById.get(airframe?.unitId);
      if (!unit || !isWarehouseSpawnableCategory(unit.category)) return;

      const dcsType = getUnitDcsType(unit);
      if (!dcsType) return;

      const pilotUserId = sanitizeText(airframe?.assignedPilotUserId, 80);
      const link = pilotUserId ? links[pilotUserId] : null;
      const ucid = sanitizeText(link?.ucid, 120) || null;

      airframes.push({
        id: sanitizeText(airframe?.id, 160),
        squadronId: sanitizeText(squadron?.id, 120),
        ucid,
        pilotName: sanitizeText(link?.name, 120) || null,
        dcsType,
        homeAirbase: homeAirbase || null,
        currentAirbase: sanitizeText(airframe?.currentAirbase, 120) || homeAirbase || null,
        state: sanitizeText(airframe?.dcsState, 40) || 'in_hangar',
      });
    });
  });

  return {
    links,
    nameToUcid,
    airframes,
    updatedAt: Date.now(),
  };
}

export function exportLidcAirframeRegistry() {
  ensureStorage();
  const payload = buildAirframeRegistryPayload();
  writeJsonAtomic(LIDC_EXPORT_FILES.airframeRegistry, payload);
  exportLidcPolicy();
  return payload;
}

function managedKey(type, airbase) {
  return `${type}::${airbase}`;
}

function buildLidcPolicyPayload() {
  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  const ucidLinks = readUcidLinks();
  const squadrons = readSquadrons();

  const links = {};
  Object.entries(ucidLinks).forEach(([discordId, link]) => {
    const ucid = sanitizeText(link?.ucid, 120);
    if (ucid) {
      links[ucid] = discordId;
    }
  });

  const managedMap = new Map();
  const allow = {};

  const addAllowEntry = (ucid, type, airbase) => {
    if (!ucid || !type || !airbase) return;
    if (!allow[ucid]) allow[ucid] = [];
    const exists = allow[ucid].some(
      (entry) => entry.type === type && entry.airbase === airbase,
    );
    if (!exists) {
      allow[ucid].push({ type, airbase });
    }
  };

  squadrons.forEach((squadron) => {
    const homeAirbase = resolveDcsAirbaseName(squadron?.baseId);
    const squadronAirframes = Array.isArray(squadron?.airframes) ? squadron.airframes : [];

    squadronAirframes.forEach((airframe) => {
      const unit = unitsById.get(airframe?.unitId);
      if (!unit || !isWarehouseSpawnableCategory(unit.category)) return;

      const dcsType = getUnitDcsType(unit);
      if (!dcsType || !homeAirbase) return;

      managedMap.set(managedKey(dcsType, homeAirbase), { type: dcsType, airbase: homeAirbase });

      const pilotUserId = sanitizeText(airframe?.assignedPilotUserId, 80);
      const link = pilotUserId ? ucidLinks[pilotUserId] : null;
      const ucid = sanitizeText(link?.ucid, 120);
      if (!ucid) return;

      const state = sanitizeText(airframe?.dcsState, 40) || 'in_hangar';
      if (state === 'destroyed') return;

      const airbase = sanitizeText(airframe?.currentAirbase, 120) || homeAirbase;
      addAllowEntry(ucid, dcsType, airbase);
    });
  });

  return {
    links,
    allow,
    managed: Array.from(managedMap.values()),
    updatedAt: Date.now(),
  };
}

export function exportLidcPolicy() {
  ensureStorage();
  const payload = buildLidcPolicyPayload();
  writeJsonAtomic(LIDC_EXPORT_FILES.policy, payload);
  return payload;
}

const DCS_STATE_TO_UI = Object.freeze({
  in_hangar: 'grounded',
  in_use: 'airborne',
  destroyed: 'destroyed',
});

export function applyAirframeStateFromDcs(incomingAirframes = []) {
  ensureStorage();
  if (!Array.isArray(incomingAirframes) || incomingAirframes.length === 0) {
    return { updated: 0, squadrons: readSquadrons() };
  }

  const stateById = new Map();
  incomingAirframes.forEach((entry) => {
    const id = sanitizeText(entry?.id, 160);
    if (!id) return;
    stateById.set(id, {
      dcsState: sanitizeText(entry?.state, 40) || 'in_hangar',
      currentAirbase: sanitizeText(entry?.airbase, 120) || null,
      dcsStateUpdatedAt: Number(entry?.at) || Date.now(),
      lat: Number(entry?.lat) || null,
      lon: Number(entry?.lon) || null,
    });
  });

  if (stateById.size === 0) {
    return { updated: 0, squadrons: readSquadrons() };
  }

  const squadrons = readSquadrons();
  let updated = 0;

  const nextSquadrons = squadrons.map((squadron) => {
    const airframes = Array.isArray(squadron?.airframes) ? squadron.airframes : [];
    let squadronChanged = false;

    const nextAirframes = airframes.map((airframe) => {
      const patch = stateById.get(airframe?.id);
      if (!patch) return airframe;

      const currentBaseId = patch.currentAirbase
        ? resolveBaseIdFromDcsAirbaseName(patch.currentAirbase)
        : null;

      const nextRecord = {
        ...airframe,
        dcsState: patch.dcsState,
        dcsStateUpdatedAt: patch.dcsStateUpdatedAt,
        currentAirbase: patch.currentAirbase,
        currentBaseId: currentBaseId || airframe?.currentBaseId || null,
        lastKnownLat: patch.lat,
        lastKnownLon: patch.lon,
      };

      if (
        airframe.dcsState !== nextRecord.dcsState
        || airframe.currentAirbase !== nextRecord.currentAirbase
        || airframe.currentBaseId !== nextRecord.currentBaseId
      ) {
        squadronChanged = true;
        updated += 1;
      }

      return nextRecord;
    });

    if (!squadronChanged) return squadron;
    return { ...squadron, airframes: nextAirframes };
  });

  if (updated > 0) {
    writeSquadrons(nextSquadrons);
    exportLidcAirframeRegistry();
  } else {
    exportLidcPolicy();
  }

  const catalogState = readCatalogState();
  const unitsById = new Map(catalogState.units.map((entry) => [entry.id, entry]));
  processDeferredWarehouseOps(nextSquadrons, unitsById);

  return { updated, squadrons: nextSquadrons, uiStates: DCS_STATE_TO_UI };
}

ensureStorage();

export default {
  DECK_CATEGORIES,
  LIDC_MEMBER_ROLES,
  SPECIALIZATION_SLOTS,
  getSpecializationsCatalog,
  updateSpecializationsCatalog,
  upsertDiscordUser,
  getDiscordUsers,
  createSquadron,
  updateSquadronDeck,
  listSquadrons,
  getSquadronById,
  joinSquadronByInviteCode,
  updateAirframeAssignment,
  updateSquadronMemberRole,
  removeSquadronMember,
  leaveSquadron,
  deleteSquadron,
  getUserPrimarySquadron,
  getUserLidcState,
  startUcidLink,
  getUcidLinkStatus,
  processUcidLinkRequests,
  getUcidLinksMap,
  exportLidcAirframeRegistry,
  exportLidcPolicy,
  applyAirframeStateFromDcs,
};
