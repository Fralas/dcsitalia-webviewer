/** Feature flags come from GET /api/auth/user (backend allowlists / Discord roles). */

export function canAccessLidc(user) {
  return Boolean(user?.canAccessLidc);
}

export function canAccessAtc(user) {
  return Boolean(user?.canAccessAtc);
}

export function canManageNoe(user) {
  return Boolean(user?.canManageNoe);
}
