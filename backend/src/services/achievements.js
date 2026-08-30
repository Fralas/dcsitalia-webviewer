import path from 'path';
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

const CATALOG_FILE = path.resolve(process.cwd(), 'data/achievements/catalog.json');
const AWARDS_FILE = path.resolve(process.cwd(), 'data/achievements/awards.json');
const USERS_FILE = path.resolve(process.cwd(), 'data/achievements/users.json');
const MAX_IMAGE_URL_LENGTH = 12_000_000;

function sanitizeText(value, maxLen = 300) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function sanitizeImageUrl(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeUserRecord(record) {
  const name = sanitizeText(record?.name || '', 140);
  return {
    name,
    updatedAt: Number.isFinite(record?.updatedAt) ? record.updatedAt : Date.now(),
  };
}

function normalizeCatalogEntry(entry, index = 0) {
  const createdAt = Number.isFinite(entry?.createdAt) ? entry.createdAt : Date.now();
  const id = sanitizeText(entry?.id || '', 80) || `achievement_${createdAt}_${index}`;
  return {
    id,
    name: sanitizeText(entry?.name || '', 120),
    description: sanitizeText(entry?.description || '', 1200),
    imageUrl: sanitizeImageUrl(entry?.imageUrl || ''),
    createdAt,
    createdBy: {
      id: sanitizeText(entry?.createdBy?.id || '', 80),
      name: sanitizeText(entry?.createdBy?.name || '', 140),
    },
  };
}

function normalizeAwardEntry(entry, index = 0) {
  const awardedAt = Number.isFinite(entry?.awardedAt) ? entry.awardedAt : Date.now();
  const id = sanitizeText(entry?.id || '', 80) || `award_${awardedAt}_${index}`;
  return {
    id,
    achievementId: sanitizeText(entry?.achievementId || '', 80),
    awardedAt,
    awardedBy: {
      id: sanitizeText(entry?.awardedBy?.id || '', 80),
      name: sanitizeText(entry?.awardedBy?.name || '', 140),
    },
  };
}

function readCatalog() {
  const list = loadJson(DOC.ACHIEVEMENTS_CATALOG, [], CATALOG_FILE);
  if (!Array.isArray(list)) return [];
  return list.map((entry, index) => normalizeCatalogEntry(entry, index)).filter((entry) => entry.id && entry.name);
}

function writeCatalog(catalog) {
  saveJson(DOC.ACHIEVEMENTS_CATALOG, (Array.isArray(catalog) ? catalog : []).map((entry, index) => normalizeCatalogEntry(entry, index)));
}

function readAwardsMap() {
  const map = loadJson(DOC.ACHIEVEMENTS_AWARDS, {}, AWARDS_FILE);
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return {};
  }

  const normalized = {};
  Object.entries(map).forEach(([userId, awards]) => {
    const safeUserId = sanitizeText(userId || '', 80);
    if (!safeUserId || !Array.isArray(awards)) return;
    normalized[safeUserId] = awards
      .map((entry, index) => normalizeAwardEntry(entry, index))
      .filter((entry) => entry.achievementId);
  });
  return normalized;
}

function writeAwardsMap(awardsMap) {
  saveJson(DOC.ACHIEVEMENTS_AWARDS, awardsMap);
}

function readUsersMap() {
  const map = loadJson(DOC.ACHIEVEMENTS_USERS, {}, USERS_FILE);
  if (!map || typeof map !== 'object' || Array.isArray(map)) {
    return {};
  }

  const normalized = {};
  Object.entries(map).forEach(([userId, userRecord]) => {
    const safeUserId = sanitizeText(userId || '', 80);
    if (!safeUserId) return;
    normalized[safeUserId] = normalizeUserRecord(userRecord);
  });
  return normalized;
}

function writeUsersMap(usersMap) {
  saveJson(DOC.ACHIEVEMENTS_USERS, usersMap);
}

function sanitizeUserId(userId) {
  return sanitizeText(String(userId || ''), 80);
}

export function getCatalog() {
  return readCatalog().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0));
}

export function createAchievement({ name, description, imageUrl, createdById, createdByName }) {
  const safeName = sanitizeText(name || '', 120);
  const safeDescription = sanitizeText(description || '', 1200);
  const safeImageUrl = sanitizeImageUrl(imageUrl || '');

  if (!safeName) {
    throw new Error('Achievement name is required');
  }
  if (!safeDescription) {
    throw new Error('Achievement description is required');
  }
  if (!safeImageUrl) {
    throw new Error('Achievement image is required');
  }
  if (safeImageUrl.length > MAX_IMAGE_URL_LENGTH) {
    throw new Error(`Achievement image is too large (max ${MAX_IMAGE_URL_LENGTH} chars)`);
  }

  const catalog = readCatalog();
  const duplicate = catalog.find((entry) => entry.name.toLowerCase() === safeName.toLowerCase());
  if (duplicate) {
    throw new Error('An achievement with this name already exists');
  }

  const createdAt = Date.now();
  const newEntry = normalizeCatalogEntry({
    id: `achievement_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
    name: safeName,
    description: safeDescription,
    imageUrl: safeImageUrl,
    createdAt,
    createdBy: {
      id: sanitizeText(createdById || '', 80),
      name: sanitizeText(createdByName || '', 140),
    },
  });

  catalog.push(newEntry);
  writeCatalog(catalog);
  return newEntry;
}

export function updateAchievement({ achievementId, name, description, imageUrl }) {
  const safeAchievementId = sanitizeText(achievementId || '', 80);
  if (!safeAchievementId) {
    throw new Error('achievementId is required');
  }

  const catalog = readCatalog();
  const index = catalog.findIndex((entry) => entry.id === safeAchievementId);
  if (index < 0) {
    throw new Error('Achievement not found');
  }

  const current = catalog[index];
  const nextName = sanitizeText(name ?? current.name, 120);
  const nextDescription = sanitizeText(description ?? current.description, 1200);
  const nextImageUrl = sanitizeImageUrl(imageUrl ?? current.imageUrl);

  if (!nextName) {
    throw new Error('Achievement name is required');
  }
  if (!nextDescription) {
    throw new Error('Achievement description is required');
  }
  if (!nextImageUrl) {
    throw new Error('Achievement image is required');
  }
  if (nextImageUrl.length > MAX_IMAGE_URL_LENGTH) {
    throw new Error(`Achievement image is too large (max ${MAX_IMAGE_URL_LENGTH} chars)`);
  }

  const duplicate = catalog.find((entry) => (
    entry.id !== safeAchievementId && entry.name.toLowerCase() === nextName.toLowerCase()
  ));
  if (duplicate) {
    throw new Error('An achievement with this name already exists');
  }

  const updatedEntry = normalizeCatalogEntry({
    ...current,
    name: nextName,
    description: nextDescription,
    imageUrl: nextImageUrl,
  }, index);
  catalog[index] = updatedEntry;
  writeCatalog(catalog);
  return updatedEntry;
}

export function deleteAchievement(achievementId) {
  const safeAchievementId = sanitizeText(achievementId || '', 80);
  if (!safeAchievementId) {
    throw new Error('achievementId is required');
  }

  const catalog = readCatalog();
  const target = catalog.find((entry) => entry.id === safeAchievementId);
  if (!target) {
    throw new Error('Achievement not found');
  }

  const nextCatalog = catalog.filter((entry) => entry.id !== safeAchievementId);
  writeCatalog(nextCatalog);

  const awardsMap = readAwardsMap();
  let removedAwards = 0;
  Object.keys(awardsMap).forEach((userId) => {
    const list = Array.isArray(awardsMap[userId]) ? awardsMap[userId] : [];
    const filtered = list.filter((entry) => entry.achievementId !== safeAchievementId);
    removedAwards += Math.max(0, list.length - filtered.length);
    awardsMap[userId] = filtered;
  });
  writeAwardsMap(awardsMap);

  return {
    achievement: target,
    removedAwards,
  };
}

export function rememberUser({ userId, name }) {
  const safeUserId = sanitizeUserId(userId);
  const safeName = sanitizeText(name || '', 140);
  if (!safeUserId || !safeName) return;

  const usersMap = readUsersMap();
  usersMap[safeUserId] = normalizeUserRecord({
    ...(usersMap[safeUserId] || {}),
    name: safeName,
    updatedAt: Date.now(),
  });
  writeUsersMap(usersMap);
}

export function getUserDisplayName(userId) {
  const safeUserId = sanitizeUserId(userId);
  if (!safeUserId) return '';
  const usersMap = readUsersMap();
  return sanitizeText(usersMap[safeUserId]?.name || '', 140);
}

export function assignAchievement({ userId, userName, achievementId, awardedById, awardedByName }) {
  const safeUserId = sanitizeUserId(userId);
  const safeAchievementId = sanitizeText(achievementId || '', 80);
  if (!safeUserId) {
    throw new Error('userId is required');
  }
  if (!safeAchievementId) {
    throw new Error('achievementId is required');
  }

  const catalog = readCatalog();
  const targetAchievement = catalog.find((entry) => entry.id === safeAchievementId);
  if (!targetAchievement) {
    throw new Error('Achievement not found');
  }

  const awardsMap = readAwardsMap();
  const userAwards = Array.isArray(awardsMap[safeUserId]) ? awardsMap[safeUserId] : [];
  if (userAwards.some((entry) => entry.achievementId === safeAchievementId)) {
    throw new Error('Achievement already assigned to this user');
  }

  const awardedAt = Date.now();
  const newAward = normalizeAwardEntry({
    id: `award_${awardedAt}_${crypto.randomBytes(4).toString('hex')}`,
    achievementId: safeAchievementId,
    awardedAt,
    awardedBy: {
      id: sanitizeText(awardedById || '', 80),
      name: sanitizeText(awardedByName || '', 140),
    },
  });

  awardsMap[safeUserId] = [...userAwards, newAward]
    .sort((a, b) => (Number(b.awardedAt) || 0) - (Number(a.awardedAt) || 0));
  writeAwardsMap(awardsMap);

  rememberUser({ userId: safeUserId, name: userName });

  return {
    userId: safeUserId,
    award: newAward,
    achievement: targetAchievement,
  };
}

export function getUserAchievements(userId) {
  const safeUserId = sanitizeUserId(userId);
  if (!safeUserId) return [];

  const catalog = readCatalog();
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));
  const awardsMap = readAwardsMap();
  const awards = Array.isArray(awardsMap[safeUserId]) ? awardsMap[safeUserId] : [];

  return awards
    .map((entry) => {
      const achievement = catalogById.get(entry.achievementId);
      if (!achievement) return null;
      return {
        awardId: entry.id,
        achievementId: achievement.id,
        name: achievement.name,
        description: achievement.description,
        imageUrl: achievement.imageUrl,
        createdAt: achievement.createdAt,
        awardedAt: entry.awardedAt,
        awardedBy: entry.awardedBy,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (Number(b.awardedAt) || 0) - (Number(a.awardedAt) || 0));
}

export function getLeaderboard(limit = 50) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(200, Math.floor(limit))) : 50;
  const awardsMap = readAwardsMap();
  const usersMap = readUsersMap();

  const rows = Object.entries(awardsMap)
    .map(([userId, awards]) => {
      const safeUserId = sanitizeUserId(userId);
      const safeAwards = Array.isArray(awards) ? awards.map((entry, index) => normalizeAwardEntry(entry, index)) : [];
      return {
        userId: safeUserId,
        displayName: sanitizeText(usersMap[safeUserId]?.name || '', 140),
        achievementCount: safeAwards.length,
        latestAwardedAt: safeAwards.reduce((max, entry) => Math.max(max, Number(entry.awardedAt) || 0), 0),
      };
    })
    .filter((entry) => entry.userId && entry.achievementCount > 0)
    .sort((a, b) => {
      if (b.achievementCount !== a.achievementCount) return b.achievementCount - a.achievementCount;
      return (Number(b.latestAwardedAt) || 0) - (Number(a.latestAwardedAt) || 0);
    })
    .slice(0, safeLimit)
    .map((entry, index) => ({
      position: index + 1,
      userId: entry.userId,
      displayName: entry.displayName,
      achievementCount: entry.achievementCount,
      latestAwardedAt: entry.latestAwardedAt,
    }));

  return rows;
}

export default {
  getCatalog,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  rememberUser,
  getUserDisplayName,
  assignAchievement,
  getUserAchievements,
  getLeaderboard,
};
