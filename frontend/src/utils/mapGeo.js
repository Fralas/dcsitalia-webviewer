const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineNm(lat1, lon1, lat2, lon2) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return (EARTH_RADIUS_KM * c) / 1.852;
}

export function getCoords(entry) {
  const lat = Number(entry?.coordinates?.lat ?? entry?.lat);
  const lon = Number(entry?.coordinates?.lon ?? entry?.lon ?? entry?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

/**
 * Shortest distance from a point to a great-circle route segment, in NM.
 */
export function distanceToRouteNm(point, routeStart, routeEnd) {
  const p = getCoords(point);
  const a = getCoords(routeStart);
  const b = getCoords(routeEnd);
  if (!p || !a || !b) return Number.POSITIVE_INFINITY;

  const directRouteNm = haversineNm(a.lat, a.lon, b.lat, b.lon);
  if (directRouteNm < 0.01) {
    return haversineNm(p.lat, p.lon, a.lat, a.lon);
  }

  const φ1 = toRad(a.lat);
  const λ1 = toRad(a.lon);
  const φ2 = toRad(b.lat);
  const λ2 = toRad(b.lon);
  const φ3 = toRad(p.lat);
  const λ3 = toRad(p.lon);

  const δ13 = Math.acos(
    Math.min(1, Math.max(-1,
      Math.sin(φ1) * Math.sin(φ3) + Math.cos(φ1) * Math.cos(φ3) * Math.cos(λ3 - λ1)
    ))
  );
  const θ13 = Math.atan2(
    Math.sin(λ3 - λ1) * Math.cos(φ3),
    Math.cos(φ1) * Math.sin(φ3) - Math.sin(φ1) * Math.cos(φ3) * Math.cos(λ3 - λ1)
  );
  const θ12 = Math.atan2(
    Math.sin(λ2 - λ1) * Math.cos(φ2),
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  );

  const δxt = Math.asin(Math.min(1, Math.max(-1, Math.sin(δ13) * Math.sin(θ13 - θ12))));
  const crossTrackNm = Math.abs((δxt * EARTH_RADIUS_KM) / 1.852);

  const alongTrackNm = Math.acos(
    Math.min(1, Math.max(-1,
      Math.cos(δ13) / Math.cos(δxt || 0)
    ))
  ) * EARTH_RADIUS_KM / 1.852;

  if (alongTrackNm < 0) {
    return haversineNm(p.lat, p.lon, a.lat, a.lon);
  }
  if (alongTrackNm > directRouteNm) {
    return haversineNm(p.lat, p.lon, b.lat, b.lon);
  }
  return crossTrackNm;
}

export function getAirportLabel(airport) {
  return airport?.displayName || airport?.name || airport?.id || 'Unknown';
}
