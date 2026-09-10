function parseIdSet(envName) {
  return new Set(
    String(process.env[envName] || '')
      .split(/[,\s]+/)
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

/** Dev-only fallbacks so local .env can omit allowlists. Production must set env. */
const DEV_LIDC_IDS = ['675706661570347041'];
const DEV_ATC_IDS = ['675706661570347041', '371212324054237206', '666017553704943647'];
const DEV_EDITOR_IDS = [
  '153370631772045313',
  '371212324054237206',
  '453594416863641600',
  '675706661570347041',
  '714087060343881778',
  '812070579888848988',
  '1026508512152518708',
  '1385701793345962035',
];

function idsFromEnvOrDev(envName, devIds) {
  const fromEnv = parseIdSet(envName);
  if (fromEnv.size > 0) return fromEnv;
  if (isProduction()) return new Set();
  return new Set(devIds);
}

export const LIDC_DISCORD_IDS = idsFromEnvOrDev('DISCORD_LIDC_IDS', DEV_LIDC_IDS);
export const ATC_DISCORD_IDS = idsFromEnvOrDev('DISCORD_ATC_IDS', DEV_ATC_IDS);
export const CHANGELOG_AUTHOR_IDS = idsFromEnvOrDev('CHANGELOG_AUTHOR_IDS', DEV_EDITOR_IDS);
export const NOE_AUTHOR_IDS = idsFromEnvOrDev('NOE_AUTHOR_IDS', DEV_EDITOR_IDS);
export const WIKI_EDITOR_IDS = idsFromEnvOrDev('WIKI_EDITOR_IDS', DEV_EDITOR_IDS);

export function normalizeDiscordId(userId) {
  if (userId === null || userId === undefined) return '';
  return String(userId).trim();
}

function hasRole(roleIds, envName) {
  const roleId = String(process.env[envName] || '').trim();
  if (!roleId) return false;
  return Array.isArray(roleIds) && roleIds.map(String).includes(roleId);
}

export function canAccessLidc(userId, _roleIds = []) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && LIDC_DISCORD_IDS.has(id);
}

export function canAccessAtc(userId, roleIds = []) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && (ATC_DISCORD_IDS.has(id) || hasRole(roleIds, 'DISCORD_ATC_ROLE_ID'));
}

export function canManageNoe(userId, roleIds = []) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && (NOE_AUTHOR_IDS.has(id) || hasRole(roleIds, 'DISCORD_NOE_EDITOR_ROLE_ID'));
}

export function canEditWiki(userId, roleIds = []) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && (WIKI_EDITOR_IDS.has(id) || hasRole(roleIds, 'DISCORD_WIKI_EDITOR_ROLE_ID'));
}

export function canEditChangelog(userId, roleIds = []) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && (CHANGELOG_AUTHOR_IDS.has(id) || hasRole(roleIds, 'DISCORD_CHANGELOG_AUTHOR_ROLE_ID'));
}

export function requireFeatureFlag(flagName) {
  return (req, res, next) => {
    if (!req.session?.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!req.session.user[flagName]) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}

/** @deprecated Prefer requireFeatureFlag after session permissions are resolved. */
export function requireFeatureAccess(allowedIds) {
  return (req, res, next) => {
    const userId = normalizeDiscordId(req.session?.user?.id);
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const roleIds = req.session?.user?.discordRoleIds || [];
    if (allowedIds === LIDC_DISCORD_IDS && canAccessLidc(userId, roleIds)) {
      return next();
    }
    if (allowedIds === ATC_DISCORD_IDS && canAccessAtc(userId, roleIds)) {
      return next();
    }
    if (!allowedIds.has(userId)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return next();
  };
}
