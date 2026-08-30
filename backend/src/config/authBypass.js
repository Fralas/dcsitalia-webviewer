/**
 * Temporary local Discord auth bypass for development only.
 * Enabled when AUTH_BYPASS_LOCAL=true AND NODE_ENV=development.
 */

/** Allowlisted Fralas ID — unlocks LIDC / ATC / Wiki / NOE in local feature gates. */
export const LOCAL_DEV_USER = Object.freeze({
  id: '675706661570347041',
  username: 'localdev',
  globalName: 'Local Dev',
  discriminator: '0',
  avatar: null,
  discordRoleIds: [],
  canEditWiki: true,
  canAccessLidc: true,
  canAccessAtc: true,
  canManageNoe: true,
  canEditChangelog: true,
  canManageLogisticsRouteVisibility: true,
  isLocalBypass: true,
});

export function isAuthBypassEnabled() {
  return (
    String(process.env.AUTH_BYPASS_LOCAL || '').toLowerCase() === 'true'
    && String(process.env.NODE_ENV || 'development').toLowerCase() === 'development'
  );
}

/**
 * Express middleware: inject LOCAL_DEV_USER when bypass is on and no session user exists.
 * Does not overwrite a real Discord session.
 */
export function authBypassMiddleware(req, _res, next) {
  if (!isAuthBypassEnabled()) {
    next();
    return;
  }

  if (!req.session) {
    next();
    return;
  }

  // Inject or refresh bypass user; never clobber a real Discord session.
  if (!req.session.user?.id || req.session.user.isLocalBypass === true) {
    req.session.user = { ...LOCAL_DEV_USER };
  }

  next();
}
