import frontlineZonesSyria from './frontlineZones.json';

/**
 * Tactical map configuration per HIDC campaign.
 *
 * - `slug` is used in the URL path: /map/:slug
 * - `enabled: false` keeps "APRI MAPPA" disabled until the theater is ready
 * - `startInTacticalMode: true` skips the 3D globe and opens the flat map directly
 */
export const TACTICAL_MAPS = {
  'hidc-modern-syria': {
    campaignId: 'hidc-modern-syria',
    slug: 'syria',
    path: '/map/syria',
    label: 'Modern Syria',
    enabled: true,
    startInTacticalMode: true,
    focusCoordinates: { lat: 35.0, lon: 38.5 },
    defaultZones: frontlineZonesSyria,
  },
  'hidc-cw84-germany': {
    campaignId: 'hidc-cw84-germany',
    slug: 'germany',
    path: '/map/germany',
    label: 'CW84 Germany',
    enabled: false,
    startInTacticalMode: true,
    focusCoordinates: { lat: 51.2, lon: 10.5 },
    defaultZones: [],
  },
  'hidc-2000-balkans': {
    campaignId: 'hidc-2000-balkans',
    slug: 'balkans',
    path: '/map/balkans',
    label: '2000 Balkans',
    enabled: false,
    startInTacticalMode: true,
    focusCoordinates: { lat: 44.0, lon: 20.5 },
    defaultZones: [],
  },
};

export const DEFAULT_TACTICAL_MAP_ID = 'hidc-modern-syria';

export function getTacticalMapByCampaignId(campaignId) {
  return TACTICAL_MAPS[campaignId] || null;
}

export function getTacticalMapBySlug(slug) {
  const normalized = String(slug || '').trim().toLowerCase();
  return Object.values(TACTICAL_MAPS).find((entry) => entry.slug === normalized) || null;
}

export function resolveTacticalMapFromPath(pathname = '/') {
  const cleaned = String(pathname || '/').replace(/\/+$/, '') || '/';
  if (cleaned === '/map') {
    return getTacticalMapByCampaignId(DEFAULT_TACTICAL_MAP_ID);
  }
  const match = cleaned.match(/^\/map\/([^/]+)$/);
  if (!match) return null;
  return getTacticalMapBySlug(match[1]);
}

export function getDefaultTacticalMap() {
  return getTacticalMapByCampaignId(DEFAULT_TACTICAL_MAP_ID);
}
