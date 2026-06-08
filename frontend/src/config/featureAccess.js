/** Discord user IDs allowed per feature (string match). */
export const LIDC_DISCORD_IDS = new Set([
  '675706661570347041', // Fralas
]);

export const ATC_DISCORD_IDS = new Set([
  '675706661570347041', // Fralas
  '371212324054237206', // DJ
  '666017553704943647', // Nic
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
