import zoneConfini from './zoneConfini.json';

const ZONE_ID_RE = /^zone_(\d+)$/i;

/**
 * Canonical DMAP zone id (zone_001).
 * Legacy webviewer ids (zone_00) are 0-based and map to zone_001.
 */
export function normalizeZoneId(zoneId) {
  const match = String(zoneId || '').match(ZONE_ID_RE);
  if (!match) return String(zoneId || '');

  const digits = match[1];
  const num = Number.parseInt(digits, 10);
  if (!Number.isFinite(num)) return String(zoneId || '');

  if (digits.length <= 2) {
    return `zone_${String(num + 1).padStart(3, '0')}`;
  }

  return `zone_${String(num).padStart(3, '0')}`;
}

/**
 * Neighbor zone ids from DMAP confini config.
 */
export function getNeighborZoneIds(zoneId) {
  const normalized = normalizeZoneId(zoneId);
  return zoneConfini[normalized] || [];
}

/**
 * Build unique undirected links between zones that exist in the provided map.
 */
export function buildZoneConnections(zones) {
  const zoneById = new Map();

  zones.forEach((zone) => {
    if (!zone?.id || !zone?.coordinates) return;
    zoneById.set(normalizeZoneId(zone.id), zone);
  });

  const links = [];
  const seen = new Set();

  zoneById.forEach((zone, zoneId) => {
    getNeighborZoneIds(zoneId).forEach((neighborId) => {
      const normalizedNeighbor = normalizeZoneId(neighborId);
      const target = zoneById.get(normalizedNeighbor);
      if (!target) return;

      const linkKey = [zoneId, normalizedNeighbor].sort().join('|');
      if (seen.has(linkKey)) return;
      seen.add(linkKey);

      links.push({
        id: `grid-${zoneId}-${normalizedNeighbor}`,
        positions: [
          [zone.coordinates.lat, zone.coordinates.lon],
          [target.coordinates.lat, target.coordinates.lon],
        ],
      });
    });
  });

  return links;
}

export default zoneConfini;
