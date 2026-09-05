/**
 * Browser requests use same-origin /api so session cookies match auth checks
 * (Vite dev proxy or reverse proxy). Server-side fallbacks use VITE_API_URL.
 */
export function resolveApiBase() {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }
  return import.meta.env.VITE_API_URL || '/api';
}

const API_BASE = resolveApiBase();

/**
 * Fetch wrapper with error handling
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      const apiError = new Error(error.error || `HTTP ${response.status}`);
      apiError.status = response.status;
      apiError.endpoint = endpoint;

      if (response.status === 401 && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { endpoint } }));
      }

      throw apiError;
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error (${endpoint}):`, error);
    throw error;
  }
}

/**
 * Get all airports with current data
 */
export async function getAirports() {
  return fetchAPI('/airports');
}

/**
 * Get coalition status for all airbases
 */
export async function getAirbaseStatus() {
  return fetchAPI('/airbases/status');
}

/**
 * Get static airport catalog from backend config
 */
export async function getAirportCatalog() {
  return fetchAPI('/config/airports');
}

/**
 * Get authoritative server time and launch status
 */
export async function getServerTime() {
  return fetchAPI('/time');
}

/**
 * Get specific airport data
 */
export async function getAirport(airportId) {
  return fetchAPI(`/airports/${airportId}`);
}

/**
 * Get historical data for airport
 */
export async function getAirportHistory(airportId, hours = 24) {
  return fetchAPI(`/airports/${airportId}/history?hours=${hours}`);
}

/**
 * Get historical data for a specific weapon
 */
export async function getWeaponHistory(airportId, weaponId, days = 7) {
  const encodedWeaponId = encodeURIComponent(weaponId);
  return fetchAPI(`/airports/${airportId}/weapons/${encodedWeaponId}/history?days=${days}`);
}

/**
 * Get all active missions
 */
export async function getMissions() {
  return fetchAPI('/missions');
}

/**
 * Get missions for specific airport
 */
export async function getAirportMissions(airportId) {
  return fetchAPI(`/missions/airport/${airportId}`);
}

/**
 * Accept a mission
 */
export async function acceptMission(missionId, userId) {
  return fetchAPI(`/missions/${missionId}/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Complete a mission
 */
export async function completeMission(missionId) {
  return fetchAPI(`/missions/${missionId}/complete`, {
    method: 'POST',
  });
}

/**
 * Cancel a mission
 */
export async function cancelMission(missionId) {
  return fetchAPI(`/missions/${missionId}/cancel`, {
    method: 'POST',
  });
}

/**
 * Compose a logistics mission from selected pending container missions.
 */
export async function composeAirportLogisticsMission(airportId, containers = []) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/compose-mission`, {
    method: 'POST',
    body: JSON.stringify({ containers }),
  });
}

/**
 * Create a manual supply order
 */
export async function createOrder(airportId, weaponId, quantity) {
  return fetchAPI(`/airports/${airportId}/create-order`, {
    method: 'POST',
    body: JSON.stringify({ weaponId, quantity }),
  });
}

/**
 * Get global logistics 3D route visibility settings.
 */
export async function getLogisticsRouteVisibility() {
  return fetchAPI('/logistics-route-visibility', {
    credentials: 'include',
  });
}

/**
 * Set airport logistics route priority.
 */
export async function setAirportLogisticsRoutePriority(airportId, isPriority) {
  return fetchAPI(`/logistics-route-visibility/${encodeURIComponent(airportId)}`, {
    method: 'POST',
    body: JSON.stringify({ isPriority }),
    credentials: 'include',
  });
}

/**
 * Get overall statistics
 */
export async function getStats() {
  return fetchAPI('/stats');
}

/**
 * DEBUG: Force generate orders for all airports
 */
export async function debugGenerateOrders() {
  return fetchAPI('/debug/generate-orders', {
    method: 'POST',
  });
}

/**
 * DEBUG: Clear all existing orders
 */
export async function debugClearOrders() {
  return fetchAPI('/debug/clear-orders', {
    method: 'POST',
  });
}

/**
 * Get all combat missions
 */
export async function getCombatMissions(status = null) {
  const queryParam = status ? `?status=${status}` : '';
  return fetchAPI(`/combat-missions${queryParam}`);
}

/**
 * Get available combat missions (not assigned)
 */
export async function getAvailableCombatMissions() {
  return fetchAPI('/combat-missions/available');
}

/**
 * Assign a combat mission to a pilot
 */
export async function assignCombatMission(missionId, pilotName, aircraft) {
  return fetchAPI(`/combat-missions/${missionId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ pilotName, aircraft }),
  });
}

/**
 * Complete a combat mission
 */
export async function completeCombatMission(missionId) {
  return fetchAPI(`/combat-missions/${missionId}/complete`, {
    method: 'POST',
  });
}

/**
 * Abort a combat mission
 */
export async function abortCombatMission(missionId) {
  return fetchAPI(`/combat-missions/${missionId}/abort`, {
    method: 'POST',
  });
}

/**
 * Refresh combat missions from zones
 */
export async function refreshCombatMissions() {
  return fetchAPI('/combat-missions/refresh', {
    method: 'POST',
  });
}

/**
 * Clear all combat missions
 */
export async function clearCombatMissions() {
  return fetchAPI('/combat-missions/clear', {
    method: 'POST',
  });
}

/**
 * Get missions for a specific pilot
 */
export async function getPilotCombatMissions(pilotName) {
  return fetchAPI(`/combat-missions/pilot/${encodeURIComponent(pilotName)}`);
}

/**
 * Get frontline zones
 */
export async function getFrontlineZones() {
  return fetchAPI('/frontline-zones');
}

/**
 * Accept a frontline zone operation
 */
export async function acceptFrontlineZone(zoneId, userId) {
  return fetchAPI(`/frontline-zones/${encodeURIComponent(zoneId)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Decline / release a frontline zone operation
 */
export async function declineFrontlineZone(zoneId, userId) {
  return fetchAPI(`/frontline-zones/${encodeURIComponent(zoneId)}/decline`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Get shared activity feed
 */
export async function getFeed(limit = 200) {
  return fetchAPI(`/feed?limit=${limit}`);
}

/**
 * Get convoys state
 */
export async function getConvoys(status = null) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return fetchAPI(`/convoys${query}`);
}

/**
 * Get DCSAR exported points
 */
export async function getDcsar() {
  return fetchAPI('/dcsar');
}

/**
 * Get tracked airlift players (C-130 / CH-47 / Mi-8 / UH-1)
 */
export async function getAirliftPlayers() {
  return fetchAPI('/airlift-players');
}

/**
 * Accept a DCSAR rescue task
 */
export async function acceptDcsarTask(taskId, userId) {
  return fetchAPI(`/dcsar/${encodeURIComponent(taskId)}/accept`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Complete a DCSAR rescue task
 */
export async function completeDcsarTask(taskId, userId) {
  return fetchAPI(`/dcsar/${encodeURIComponent(taskId)}/complete`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Cancel a DCSAR rescue task
 */
export async function cancelDcsarTask(taskId, userId) {
  return fetchAPI(`/dcsar/${encodeURIComponent(taskId)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/**
 * Post convoy event (external integration/testing)
 */
export async function postConvoyEvent(eventPayload, convoyToken = null) {
  const headers = convoyToken ? { 'x-convoy-token': convoyToken } : undefined;
  return fetchAPI('/convoys/events', {
    method: 'POST',
    headers,
    body: JSON.stringify(eventPayload),
  });
}

/**
 * Add user to an assigned combat mission
 */
export async function addUserToCombatMission(missionId, pilotName, aircraft) {
  return fetchAPI(`/combat-missions/${missionId}/add-user`, {
    method: 'POST',
    body: JSON.stringify({ pilotName, aircraft })
  });
}

/**
 * Get mock users for testing
 */
export async function getMockUsers() {
  return fetchAPI('/mock-users');
}

/**
 * Get logged-in users (real users from Discord OAuth)
 */
export async function getLoggedInUsers() {
  return fetchAPI('/logged-in-users', {
    credentials: 'include',
  });
}

/**
 * Get current user's profile
 */
export async function getUserProfile() {
  return fetchAPI('/profile', {
    credentials: 'include',
  });
}

/**
 * Save current user's profile
 */
export async function saveUserProfile(profile) {
  return fetchAPI('/profile', {
    method: 'PUT',
    body: JSON.stringify(profile),
    credentials: 'include',
  });
}

/**
 * Get achievements catalog
 */
export async function getAchievementsCatalog() {
  return fetchAPI('/achievements/catalog');
}

/**
 * Create a new achievement (wiki editor only)
 */
export async function createAchievement(payload) {
  return fetchAPI('/achievements/catalog', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

/**
 * Update an existing achievement (wiki editor only)
 */
export async function updateAchievement(achievementId, payload) {
  return fetchAPI(`/achievements/catalog/${encodeURIComponent(achievementId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

/**
 * Delete an existing achievement (wiki editor only)
 */
export async function deleteAchievement(achievementId) {
  return fetchAPI(`/achievements/catalog/${encodeURIComponent(achievementId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

/**
 * Get assigned achievements for a user
 */
export async function getUserAchievements(userId) {
  return fetchAPI(`/achievements/users/${encodeURIComponent(userId)}`, {
    credentials: 'include',
  });
}

/**
 * Assign achievement to a user (wiki editor only)
 */
export async function assignAchievement(payload) {
  return fetchAPI('/achievements/assign', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

/**
 * Discord guild members (wiki editor only)
 */
export async function getDiscordGuildMembers() {
  return fetchAPI('/discord/guild-members', {
    credentials: 'include',
  });
}

/**
 * Get achievements leaderboard
 */
export async function getAchievementsLeaderboard(limit = 50) {
  return fetchAPI(`/achievements/leaderboard?limit=${encodeURIComponent(limit)}`);
}

/**
 * Get changelog posts
 */
export async function getChangelogs() {
  return fetchAPI('/changelogs');
}

/**
 * Get current user's changelog draft
 */
export async function getChangelogDraft() {
  return fetchAPI('/changelogs/draft', {
    credentials: 'include',
  });
}

/**
 * Save current user's changelog draft
 */
export async function saveChangelogDraft(draft) {
  return fetchAPI('/changelogs/draft', {
    method: 'PUT',
    body: JSON.stringify(draft),
    credentials: 'include',
  });
}

/**
 * Delete current user's changelog draft
 */
export async function deleteChangelogDraft() {
  return fetchAPI('/changelogs/draft', {
    method: 'DELETE',
    credentials: 'include',
  });
}

/**
 * Upload changelog media
 */
export async function uploadChangelogMedia(payload) {
  return fetchAPI('/changelogs/media', {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

/**
 * Publish a changelog post
 */
export async function publishChangelog(draft) {
  return fetchAPI('/changelogs', {
    method: 'POST',
    body: JSON.stringify(draft),
    credentials: 'include',
  });
}

/**
 * Auto translate changelog draft
 */
export async function translateChangelogDraft(draft, sourceLang = 'it', targetLang = 'en', overwrite = false) {
  return fetchAPI('/changelogs/translate', {
    method: 'POST',
    body: JSON.stringify({ draft, sourceLang, targetLang, overwrite }),
    credentials: 'include',
  });
}

/**
 * Update a changelog post
 */
export async function updateChangelog(postId, draft) {
  return fetchAPI(`/changelogs/${encodeURIComponent(postId)}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
    credentials: 'include',
  });
}

/**
 * Delete a changelog post
 */
export async function deleteChangelog(postId) {
  return fetchAPI(`/changelogs/${encodeURIComponent(postId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

/**
 * Get all wiki pages
 */
export async function getWikiPages() {
  return fetchAPI('/wiki/pages');
}

/**
 * Get a specific wiki page
 */
export async function getWikiPage(pageId) {
  return fetchAPI(`/wiki/pages/${encodeURIComponent(pageId)}`);
}

/**
 * Create a new wiki page
 */
export async function createWikiPage(draft) {
  return fetchAPI('/wiki/pages', {
    method: 'POST',
    body: JSON.stringify(draft),
    credentials: 'include',
  });
}

/**
 * Get current user's wiki draft for a page
 */
export async function getWikiDraft(pageId) {
  return fetchAPI(`/wiki/drafts/${encodeURIComponent(pageId)}`, {
    credentials: 'include',
  });
}

/**
 * Save current user's wiki draft for a page
 */
export async function saveWikiDraft(pageId, draft) {
  return fetchAPI(`/wiki/drafts/${encodeURIComponent(pageId)}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
    credentials: 'include',
  });
}

/**
 * Delete current user's wiki draft for a page
 */
export async function deleteWikiDraft(pageId) {
  return fetchAPI(`/wiki/drafts/${encodeURIComponent(pageId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

/**
 * Update/publish wiki page
 */
export async function updateWikiPage(pageId, draft) {
  return fetchAPI(`/wiki/pages/${encodeURIComponent(pageId)}`, {
    method: 'PUT',
    body: JSON.stringify(draft),
    credentials: 'include',
  });
}

/**
 * Upload wiki media
 */
export async function uploadWikiMedia(payload) {
  return fetchAPI('/wiki/media', {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

/**
 * Start DCS account link flow (one-time code)
 */
export async function startLidcUcidLink() {
  return fetchAPI('/lidc/link/start', {
    method: 'POST',
    credentials: 'include',
  });
}

/**
 * Get DCS account link status for current user
 */
export async function getLidcUcidLinkStatus() {
  return fetchAPI('/lidc/link/status', {
    credentials: 'include',
  });
}

/**
 * Get LIDC specializations and units catalog
 */
export async function getLidcSpecializations() {
  return fetchAPI('/lidc/specializations');
}

/**
 * Get historical Discord users for LIDC invites
 */
export async function getLidcUsers() {
  return fetchAPI('/lidc/users', {
    credentials: 'include',
  });
}

/**
 * Get current user LIDC state (squadron membership)
 */
export async function getLidcMe() {
  return fetchAPI('/lidc/me', {
    credentials: 'include',
  });
}

/**
 * Get all LIDC squadrons (summary list)
 */
export async function getLidcSquadrons() {
  return fetchAPI('/lidc/squadrons', {
    credentials: 'include',
  });
}

/**
 * Squadrons and airframes currently present at a LIDC Afghanistan airbase
 */
export async function getAirportOccupancy(airportId) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/occupancy`, {
    credentials: 'include',
  });
}

export async function purchaseAirportLogistics(airportId, payload) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/logistics/purchase`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

export async function updateAirportOrder(airportId, orderId, payload) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/logistics/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

export async function getLidcAirportOccupancy(baseId) {
  return fetchAPI(`/lidc/airports/${encodeURIComponent(baseId)}/occupancy`, {
    credentials: 'include',
  });
}

export async function getLidcLogisticsAlerts() {
  return fetchAPI('/lidc/logistics-alerts', {
    credentials: 'include',
  });
}

/**
 * Purchase ammunition containers or crates with squadron credits
 */
export async function purchaseLidcAirportLogistics(baseId, payload) {
  return fetchAPI(`/lidc/airports/${encodeURIComponent(baseId)}/logistics/purchase`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

export async function updateLidcAirportOrder(baseId, orderId, payload) {
  return fetchAPI(`/lidc/airports/${encodeURIComponent(baseId)}/logistics/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

/**
 * Create a new LIDC squadron
 */
export async function createLidcSquadron(payload) {
  return fetchAPI('/lidc/squadrons', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

/**
 * Join a LIDC squadron using invite code
 */
export async function joinLidcSquadronByInviteCode(inviteCode) {
  return fetchAPI('/lidc/squadrons/join', {
    method: 'POST',
    body: JSON.stringify({ inviteCode }),
    credentials: 'include',
  });
}

/**
 * Get a single LIDC squadron by id
 */
export async function getLidcSquadron(squadronId) {
  return fetchAPI(`/lidc/squadrons/${encodeURIComponent(squadronId)}`, {
    credentials: 'include',
  });
}

/**
 * Replace the deck of a squadron (owner only)
 */
export async function updateLidcSquadronDeck(squadronId, deck) {
  return fetchAPI(`/lidc/squadrons/${encodeURIComponent(squadronId)}/deck`, {
    method: 'PUT',
    body: JSON.stringify({ deck: deck || {} }),
    credentials: 'include',
  });
}

/**
 * Assign (or clear) pilot for one squadron airframe
 */
export async function assignLidcAirframePilot(squadronId, airframeId, pilotUserId = null) {
  return fetchAPI(
    `/lidc/squadrons/${encodeURIComponent(squadronId)}/airframes/${encodeURIComponent(airframeId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({ pilotUserId }),
      credentials: 'include',
    },
  );
}

/**
 * Promote/demote squadron member role
 */
export async function updateLidcMemberRole(squadronId, memberUserId, role) {
  return fetchAPI(
    `/lidc/squadrons/${encodeURIComponent(squadronId)}/members/${encodeURIComponent(memberUserId)}/role`,
    {
      method: 'PUT',
      body: JSON.stringify({ role }),
      credentials: 'include',
    },
  );
}

/**
 * Remove a LIDC squadron member (owner only)
 */
export async function removeLidcMember(squadronId, memberUserId) {
  return fetchAPI(
    `/lidc/squadrons/${encodeURIComponent(squadronId)}/members/${encodeURIComponent(memberUserId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
    },
  );
}

/**
 * Leave a LIDC squadron as the current user
 */
export async function leaveLidcSquadron(squadronId) {
  return fetchAPI(`/lidc/squadrons/${encodeURIComponent(squadronId)}/leave`, {
    method: 'POST',
    credentials: 'include',
  });
}

/**
 * Delete a LIDC squadron as the current user (owner only)
 */
export async function deleteLidcSquadron(squadronId) {
  return fetchAPI(`/lidc/squadrons/${encodeURIComponent(squadronId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

/**
 * Update LIDC specializations catalog (wiki editor only)
 */
export async function updateLidcSpecializations(payload) {
  return fetchAPI('/lidc/specializations', {
    method: 'PUT',
    body: JSON.stringify(payload || {}),
    credentials: 'include',
  });
}

// ==================== DCORE bridge (web -> game) ====================

/**
 * Get current Production Points state exported by DCORE.
 */
export async function getProductionPoints() {
  return fetchAPI('/production-points');
}

/**
 * Get live tracked crate positions exported by DMAS (until moved/activated in-game).
 */
export async function getWebSpawnMarkers() {
  return fetchAPI('/web-spawn-markers');
}

/**
 * Get the catalog of web-initiated spawns (infantry + crate keywords/costs).
 */
export async function getSpawnOptions() {
  return fetchAPI('/spawn-options');
}

export async function getTankerOptions() {
  return fetchAPI('/tanker/options');
}

export async function getTankerRoutes() {
  return fetchAPI('/tanker/routes');
}

export async function spawnTanker(keyword, wp1Lat, wp1Lon, wp2Lat, wp2Lon) {
  return fetchAPI('/tanker/spawn', {
    method: 'POST',
    body: JSON.stringify({
      keyword,
      wp1_lat: wp1Lat,
      wp1_lon: wp1Lon,
      wp2_lat: wp2Lat,
      wp2_lon: wp2Lon,
    }),
    credentials: 'include',
  });
}

/**
 * Request a Production Point upgrade in-game.
 */
export async function requestProductionPointUpgrade(productionPointId) {
  return fetchAPI(`/production-points/${encodeURIComponent(productionPointId)}/upgrade`, {
    method: 'POST',
    credentials: 'include',
  });
}

/**
 * Retrieve production crates (RETRIEVE) at a clicked point within 500 m of the PP center.
 */
export async function retrieveProductionPointCrates(productionPointId, lat, lon, quantity = 1) {
  return fetchAPI(`/production-points/${encodeURIComponent(productionPointId)}/retrieve`, {
    method: 'POST',
    body: JSON.stringify({ lat, lon, quantity }),
    credentials: 'include',
  });
}

/**
 * Spawn infantry (INF MANPAD / INF SCOUT) at a clicked point inside a BLUE airport.
 */
export async function spawnAirportInfantry(airportId, keyword, lat, lon, quantity = 1) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/spawn-infantry`, {
    method: 'POST',
    body: JSON.stringify({ keyword, lat, lon, quantity }),
    credentials: 'include',
  });
}

/**
 * Spawn a crate (CRATE BUILD/AMMO/FUEL, slingload HMMWV/L118/...) at a clicked point inside a BLUE airport.
 */
export async function spawnAirportCrate(airportId, keyword, lat, lon, quantity = 1) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/spawn-crate`, {
    method: 'POST',
    body: JSON.stringify({ keyword, lat, lon, quantity }),
    credentials: 'include',
  });
}

/**
 * Spawn a map right-click asset (CAS, MBT, BOMB, HELISUPPLY, etc.) at the clicked coordinates.
 */
export async function spawnMapAction(type, keyword, lat, lon) {
  return fetchAPI('/map/actions/spawn', {
    method: 'POST',
    body: JSON.stringify({ type, keyword, lat, lon }),
    credentials: 'include',
  });
}

export async function getDbuildCatalog() {
  return fetchAPI('/dbuild/catalog');
}

export async function getDbuildPlacements() {
  return fetchAPI('/dbuild/placements');
}

export async function createDbuildPlacement(buildType, lat, lon) {
  return fetchAPI('/dbuild/placements', {
    method: 'POST',
    body: JSON.stringify({ build_type: buildType, lat, lon }),
    credentials: 'include',
  });
}

export async function confirmDbuildPlacement(placementId) {
  return fetchAPI(`/dbuild/placements/${encodeURIComponent(placementId)}/confirm`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function cancelDbuildPlacement(placementId) {
  return fetchAPI(`/dbuild/placements/${encodeURIComponent(placementId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export async function getAirportCharts(airportId) {
  return fetchAPI(`/airports/${encodeURIComponent(airportId)}/charts`);
}

export async function getAtcBoard(airportId = 'aleppo') {
  return fetchAPI(`/atc/board?airportId=${encodeURIComponent(airportId)}`);
}

export async function getAtcHistory({ airportId, stripId, limit } = {}) {
  const params = new URLSearchParams();
  if (airportId) params.set('airportId', airportId);
  if (stripId) params.set('stripId', stripId);
  if (limit) params.set('limit', String(limit));
  const qs = params.toString();
  return fetchAPI(`/atc/history${qs ? `?${qs}` : ''}`);
}

export async function setAtcBoardSettings(airportId, manualSort) {
  return fetchAPI('/atc/board/settings', {
    method: 'POST',
    body: JSON.stringify({ airportId, manualSort }),
    credentials: 'include',
  });
}

export async function setAtcRunwayConfig(airportId, config) {
  return fetchAPI('/atc/board/runway', {
    method: 'POST',
    body: JSON.stringify({ airportId, ...config }),
    credentials: 'include',
  });
}

export async function createAtcStrip(payload) {
  return fetchAPI('/atc/strips', {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

export async function patchAtcStrip(stripId, payload) {
  return fetchAPI(`/atc/strips/${encodeURIComponent(stripId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

export async function moveAtcStrip(stripId, payload) {
  return fetchAPI(`/atc/strips/${encodeURIComponent(stripId)}/move`, {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

export async function coordinateAtcStrip(stripId, payload) {
  return fetchAPI(`/atc/strips/${encodeURIComponent(stripId)}/coordination`, {
    method: 'POST',
    body: JSON.stringify(payload),
    credentials: 'include',
  });
}

export async function deleteAtcStrip(stripId, airportId, role) {
  return fetchAPI(`/atc/strips/${encodeURIComponent(stripId)}?airportId=${encodeURIComponent(airportId)}`, {
    method: 'DELETE',
    body: JSON.stringify({ airportId, role }),
    credentials: 'include',
  });
}

export async function claimAtcRole(airportId, role) {
  return fetchAPI('/atc/role/claim', {
    method: 'POST',
    body: JSON.stringify({ airportId, role }),
    credentials: 'include',
  });
}

export async function releaseAtcRole(airportId, role) {
  return fetchAPI('/atc/role/release', {
    method: 'POST',
    body: JSON.stringify({ airportId, role }),
    credentials: 'include',
  });
}

export async function cancelAtcHandoff(stripId, { airportId, role, targetBay }) {
  return fetchAPI(`/atc/strips/${encodeURIComponent(stripId)}/cancel-handoff`, {
    method: 'POST',
    body: JSON.stringify({ airportId, role, targetBay }),
    credentials: 'include',
  });
}

/**
 * Get NOE events (public).
 */
export async function getNoeEvents() {
  return fetchAPI('/noe/events');
}

/**
 * Create a NOE event (admin only).
 */
export async function createNoeEvent(event) {
  return fetchAPI('/noe/events', {
    method: 'POST',
    body: JSON.stringify(event),
    credentials: 'include',
  });
}

/**
 * Update a NOE event (admin only).
 */
export async function updateNoeEvent(eventId, event) {
  return fetchAPI(`/noe/events/${encodeURIComponent(eventId)}`, {
    method: 'PUT',
    body: JSON.stringify(event),
    credentials: 'include',
  });
}

/**
 * Delete a NOE event (admin only).
 */
export async function deleteNoeEvent(eventId) {
  return fetchAPI(`/noe/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
}

export default {
  getServerTime,
  getAirports,
  getAirbaseStatus,
  getAirportCatalog,
  getAirport,
  getAirportHistory,
  getWeaponHistory,
  getMissions,
  getAirportMissions,
  acceptMission,
  completeMission,
  cancelMission,
  createOrder,
  getLogisticsRouteVisibility,
  setAirportLogisticsRoutePriority,
  getStats,
  debugGenerateOrders,
  debugClearOrders,
  getCombatMissions,
  getAvailableCombatMissions,
  assignCombatMission,
  completeCombatMission,
  abortCombatMission,
  refreshCombatMissions,
  clearCombatMissions,
  getPilotCombatMissions,
  getFrontlineZones,
  acceptFrontlineZone,
  getFeed,
  getNoeEvents,
  createNoeEvent,
  updateNoeEvent,
  deleteNoeEvent,
  getConvoys,
  getDcsar,
  getAirliftPlayers,
  acceptDcsarTask,
  completeDcsarTask,
  cancelDcsarTask,
  postConvoyEvent,
  getUserProfile,
  saveUserProfile,
  getAchievementsCatalog,
  createAchievement,
  updateAchievement,
  deleteAchievement,
  getUserAchievements,
  assignAchievement,
  getDiscordGuildMembers,
  getAchievementsLeaderboard,
  getChangelogs,
  getChangelogDraft,
  saveChangelogDraft,
  deleteChangelogDraft,
  uploadChangelogMedia,
  publishChangelog,
  translateChangelogDraft,
  updateChangelog,
  deleteChangelog,
  getWikiPages,
  getWikiPage,
  createWikiPage,
  getWikiDraft,
  saveWikiDraft,
  deleteWikiDraft,
  updateWikiPage,
  uploadWikiMedia,
  getLidcSpecializations,
  getLidcMe,
  getLidcUsers,
  getLidcSquadrons,
  createLidcSquadron,
  joinLidcSquadronByInviteCode,
  getLidcSquadron,
  updateLidcSquadronDeck,
  assignLidcAirframePilot,
  updateLidcMemberRole,
  removeLidcMember,
  leaveLidcSquadron,
  deleteLidcSquadron,
  updateLidcSpecializations,
  startLidcUcidLink,
  getLidcUcidLinkStatus,
  getProductionPoints,
  getWebSpawnMarkers,
  getSpawnOptions,
  getTankerOptions,
  getTankerRoutes,
  requestProductionPointUpgrade,
  spawnAirportInfantry,
  spawnAirportCrate,
  spawnMapAction,
  spawnTanker,
  getDbuildCatalog,
  getDbuildPlacements,
  createDbuildPlacement,
  confirmDbuildPlacement,
  cancelDbuildPlacement,
  getAirportCharts,
  getAtcBoard,
  getAtcHistory,
  setAtcBoardSettings,
  setAtcRunwayConfig,
  createAtcStrip,
  patchAtcStrip,
  moveAtcStrip,
  coordinateAtcStrip,
  deleteAtcStrip,
  claimAtcRole,
  releaseAtcRole,
  cancelAtcHandoff,
};
