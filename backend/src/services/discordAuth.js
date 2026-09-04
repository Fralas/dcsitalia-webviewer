/**
 * Discord OAuth2 Authentication Service
 */

const DISCORD_API_ENDPOINT = 'https://discord.com/api/v10';

/**
 * Generate Discord OAuth2 URL
 */
export function getDiscordAuthURL(clientId, redirectUri, state) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify',
    state: state
  });

  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

/**
 * Exchange code for access token
 */
export async function exchangeCode(code, clientId, clientSecret, redirectUri) {
  const response = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Discord token exchange failed: ${error}`);
  }

  return await response.json();
}

/**
 * Get Discord user info
 */
export async function getDiscordUser(accessToken) {
  const response = await fetch(`${DISCORD_API_ENDPOINT}/users/@me`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Discord user: ${error}`);
  }

  return await response.json();
}

/**
 * Get Discord guild member (requires Bot token with guild member read permissions)
 */
export async function getGuildMember(guildId, userId, botToken) {
  const response = await fetch(`${DISCORD_API_ENDPOINT}/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(userId)}`, {
    headers: {
      Authorization: `Bot ${botToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Discord guild member: ${error}`);
  }

  return await response.json();
}

const GUILD_MEMBERS_CACHE_MS = 3 * 60 * 1000;
const GUILD_MEMBERS_PAGE_LIMIT = 1000;
const GUILD_MEMBERS_MAX_PAGES = 20;
let guildMembersCache = { key: '', expiresAt: 0, members: [] };

function mapGuildMember(entry) {
  const user = entry?.user;
  if (!user?.id || user.bot) return null;
  const id = String(user.id);
  const name = String(entry?.nick || user.global_name || user.username || id).trim() || id;
  return {
    id,
    name,
    username: String(user.username || '').trim(),
  };
}

/**
 * List all non-bot members of a guild (requires Server Members Intent).
 */
function normalizeBotToken(botToken) {
  return String(botToken || '').trim().replace(/^["']|["']$/g, '').replace(/^Bot\s+/i, '');
}

function botTokenLooksInvalid(token) {
  return !token || /^\d{16,22}$/.test(token) || !token.includes('.');
}

export async function listGuildMembers(guildId, botToken) {
  const safeGuildId = String(guildId || '').trim();
  const safeToken = normalizeBotToken(botToken);
  if (!safeGuildId || !safeToken) {
    const error = new Error('Discord guild is not configured');
    error.status = 503;
    throw error;
  }
  if (botTokenLooksInvalid(safeToken)) {
    const error = new Error(
      'DISCORD_BOT_TOKEN non è un token bot valido. Nel Developer Portal apri Bot → Reset Token e copia il token (non l’Application ID).',
    );
    error.status = 503;
    throw error;
  }

  const cacheKey = safeGuildId;
  if (guildMembersCache.key === cacheKey && Date.now() < guildMembersCache.expiresAt) {
    return guildMembersCache.members;
  }

  const rawMembers = [];
  let after = '';
  for (let page = 0; page < GUILD_MEMBERS_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({ limit: String(GUILD_MEMBERS_PAGE_LIMIT) });
    if (after) params.set('after', after);
    const response = await fetch(
      `${DISCORD_API_ENDPOINT}/guilds/${encodeURIComponent(safeGuildId)}/members?${params.toString()}`,
      { headers: { Authorization: `Bot ${safeToken}` } },
    );

    if (!response.ok) {
      const detail = await response.text();
      const error = new Error(`Failed to list Discord guild members: ${detail}`);
      error.status = response.status;
      throw error;
    }

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    rawMembers.push(...batch);
    if (batch.length < GUILD_MEMBERS_PAGE_LIMIT) break;
    after = String(batch[batch.length - 1]?.user?.id || '').trim();
    if (!after) break;
  }

  const seen = new Set();
  const members = rawMembers
    .map(mapGuildMember)
    .filter((entry) => {
      if (!entry || seen.has(entry.id)) return false;
      seen.add(entry.id);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'it', { sensitivity: 'base' }));

  guildMembersCache = {
    key: cacheKey,
    expiresAt: Date.now() + GUILD_MEMBERS_CACHE_MS,
    members,
  };
  return members;
}

/**
 * Revoke Discord token
 */
export async function revokeToken(token, clientId, clientSecret) {
  try {
    const response = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token/revoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        token: token,
      }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to revoke Discord token:', error);
    return false;
  }
}
