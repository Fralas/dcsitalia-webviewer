function normalizeAirbaseName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectAirportStatusAliases(airport) {
  const aliases = new Set();
  const add = (value) => {
    if (!value) return;
    const raw = String(value).trim();
    if (!raw) return;
    aliases.add(raw);
    aliases.add(normalizeAirbaseName(raw));
  };

  add(airport?.name);
  add(airport?.displayName);
  add(airport?.csvPrefix);
  add(airport?.id);
  add(airport?.id?.replace(/-/g, '_'));

  return aliases;
}

function lookupAirbaseStatusValue(airport, airbaseStatus = {}) {
  if (!airport || !airbaseStatus || typeof airbaseStatus !== 'object') {
    return undefined;
  }

  const normalizedStatus = {};
  Object.entries(airbaseStatus).forEach(([key, value]) => {
    normalizedStatus[normalizeAirbaseName(key)] = value;
  });

  for (const alias of collectAirportStatusAliases(airport)) {
    if (Object.prototype.hasOwnProperty.call(airbaseStatus, alias)) {
      return airbaseStatus[alias];
    }
    const normalizedAlias = normalizeAirbaseName(alias);
    if (Object.prototype.hasOwnProperty.call(normalizedStatus, normalizedAlias)) {
      return normalizedStatus[normalizedAlias];
    }
  }

  return undefined;
}

/**
 * Resolve whether an airport should appear as coalition-active on the map.
 */
export function isAirportActiveOnMap(airport, airbaseStatus = null) {
  if (!airport?.coordinates) return false;
  if (airport.isMainBase || airport.isCarrier) return true;
  if (airport.isAlwaysActive) return true;
  if (airport.isActive === false) return false;

  const hasStatusFile = airbaseStatus && Object.keys(airbaseStatus).length > 0;
  if (hasStatusFile) {
    const statusValue = lookupAirbaseStatusValue(airport, airbaseStatus);
    if (statusValue !== undefined) {
      return statusValue !== false;
    }
  }

  return airport.isActive !== false;
}
