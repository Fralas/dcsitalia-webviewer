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
