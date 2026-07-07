/** Discord user IDs allowed per feature (string match). */
export const LIDC_DISCORD_IDS = new Set([
  '675706661570347041', // Fralas
]);

export const ATC_DISCORD_IDS = new Set([
  '675706661570347041', // Fralas
  '371212324054237206', // DJ
  '666017553704943647', // Nic
]);

/** Discord user IDs allowed to create/edit NOE events on the landing page. */
export const NOE_ADMIN_IDS = new Set([
  '153370631772045313',
  '371212324054237206',
  '453594416863641600',
  '675706661570347041',
  '714087060343881778',
  '812070579888848988',
  '1026508512152518708',
  '1385701793345962035',
]);

export function normalizeDiscordId(userId) {
  if (userId === null || userId === undefined) return '';
  return String(userId).trim();
}

export function canAccessLidc(userId) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && LIDC_DISCORD_IDS.has(id);
}

export function canAccessAtc(userId) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && ATC_DISCORD_IDS.has(id);
}

export function canManageNoe(userId) {
  const id = normalizeDiscordId(userId);
  return Boolean(id) && NOE_ADMIN_IDS.has(id);
}
