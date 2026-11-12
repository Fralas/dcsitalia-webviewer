import { HIDC_REGION_BORDERS, HIDC_ZONE_CENTERS, HIDC_ZONE_LINKS } from '../config/hidcRegionBorders.js';

/**
 * HIDC front line between the active RED region and the BLUE staging region.
 *
 * Inside each of the two regions every grid point takes the side of the nearest zone of that
 * region (BLUE = +1, contested = 0, RED/NEUTRAL = -1, smoothed over FIELD_SCALE_KM): the
 * zero contour is the BLUE/RED split of that region. Across the shared border the field jumps
 * between the two regions, so before any conquest the front follows the drawn region border and
 * it advances into the active region as its zones turn BLUE. Narrow gaps between the two
 * polygons (they are traced separately in the .miz) are bridged by assigning the point to the
 * nearer polygon. Regions linked only by zone connections (e.g. across the sea, REGION_32 ->
 * REGION_21, 145-180 km) get a corridor around each base->target link that counts as BLUE
 * ground: the front sits on the active region's coast where the attack lands and moves inland
 * as zones are conquered. Links come from HIDC_ZONE_LINKS (DMAP_Config.confini).
 * Contour = marching squares + Chaikin smoothing.
 */

const GRID_STEP_KM = 1.2;
const FIELD_SCALE_KM = 4;
const GAP_MARGIN_KM = 4;
const CORRIDOR_HALF_WIDTH_KM = 9;
const SMOOTH_ITERATIONS = 2;
const MIN_LINE_KM = 2;

const regionsById = new Map(HIDC_REGION_BORDERS.features.map((feature) => [feature.properties.id, feature]));

export function getRegionFeature(regionId) {
  return regionsById.get(regionId) || null;
}

export function sideOfStatus(status) {
  const value = String(status || '').toUpperCase();
  if (value === 'BLUE') return 1;
  if (value === 'UNDER_ATTACK') return 0;
  return -1;
}

function makeProjection(rings) {
  let lat0 = 0;
  let lon0 = 0;
  let count = 0;
  rings.forEach((ring) => ring.forEach(([lon, lat]) => { lon0 += lon; lat0 += lat; count += 1; }));
  lon0 /= count;
  lat0 /= count;
  const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
  const ky = 110.574;
  return {
    toXY: ([lon, lat]) => [(lon - lon0) * kx, (lat - lat0) * ky],
    toLonLat: ([x, y]) => [lon0 + x / kx, lat0 + y / ky],
  };
}

function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function distToRing(x, y, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
    const px = ax + t * dx - x;
    const py = ay + t * dy - y;
    best = Math.min(best, px * px + py * py);
  }
  return Math.sqrt(best);
}

// Side field of one region at (x, y): +1 BLUE ... -1 RED, from that region's own zones only.
function regionField(x, y, zones) {
  let dBlue = Infinity;
  let dRed = Infinity;
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i];
    const d = Math.hypot(zone.x - x, zone.y - y);
    if (zone.side >= 0 && d < dBlue) dBlue = d;
    if (zone.side <= 0 && d < dRed) dRed = d;
  }
  if (dBlue === Infinity && dRed === Infinity) return null;
  if (dBlue === Infinity) return -1;
  if (dRed === Infinity) return 1;
  return Math.max(-1, Math.min(1, (dRed - dBlue) / FIELD_SCALE_KM));
}

function chaikin(points, closed) {
  if (points.length < 3) return points;
  const out = closed ? [] : [points[0]];
  const n = points.length;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i += 1) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    out.push([0.75 * ax + 0.25 * bx, 0.75 * ay + 0.25 * by]);
    out.push([0.25 * ax + 0.75 * bx, 0.25 * ay + 0.75 * by]);
  }
  if (!closed) out.push(points[n - 1]);
  return out;
}

function lineLengthKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

// Join marching-squares segments into polylines through shared endpoints.
function joinSegments(segments) {
  const key = ([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`;
  const byPoint = new Map();
  segments.forEach((segment, index) => {
    segment.forEach((point) => {
      const k = key(point);
      if (!byPoint.has(k)) byPoint.set(k, []);
      byPoint.get(k).push(index);
    });
  });
  const used = new Array(segments.length).fill(false);
  const lines = [];

  const extend = (line) => {
    for (;;) {
      const tail = line[line.length - 1];
      const next = (byPoint.get(key(tail)) || []).find((index) => !used[index]);
      if (next === undefined) return;
      used[next] = true;
      const [a, b] = segments[next];
      line.push(key(a) === key(tail) ? b : a);
    }
  };

  segments.forEach((segment, index) => {
    if (used[index]) return;
    used[index] = true;
    const line = [segment[0], segment[1]];
    extend(line);
    line.reverse();
    extend(line);
    lines.push(line);
  });
  return lines;
}

/**
 * @param {object} params
 * @param {string} params.targetId   active RED region (REGION_xx)
 * @param {string} params.fromId     BLUE staging region (REGION_xx)
 * @param {(zoneId: string) => string|undefined} params.statusOf  zone status (BLUE/RED/NEUTRAL/UNDER_ATTACK)
 * @returns {{ type: 'FeatureCollection', features: object[], stats: object }}
 */
export function computeFrontLine({ targetId, fromId, statusOf }) {
  const neighborsOf = (zoneId) => HIDC_ZONE_LINKS[zoneId] || [];
  const empty = { type: 'FeatureCollection', features: [], stats: { lines: 0, lengthKm: 0, ms: 0 } };
  const target = getRegionFeature(targetId);
  const from = getRegionFeature(fromId);
  if (!target || !from || targetId === fromId) return empty;

  const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const proj = makeProjection([target.geometry.coordinates[0], from.geometry.coordinates[0]]);
  const regions = [target, from].map((feature) => ({
    ring: feature.geometry.coordinates[0].map(proj.toXY),
    zones: (feature.properties.zones || [])
      .filter((zoneId) => HIDC_ZONE_CENTERS[zoneId])
      .map((zoneId) => {
        const [x, y] = proj.toXY(HIDC_ZONE_CENTERS[zoneId]);
        return { x, y, side: sideOfStatus(statusOf(zoneId)) };
      }),
  }));

  // Corridors along base -> target zone links (bridge regions that do not touch).
  const targetZoneSet = new Set(target.properties.zones || []);
  const corridors = [];
  (from.properties.zones || []).forEach((zoneId) => {
    if (!HIDC_ZONE_CENTERS[zoneId]) return;
    (neighborsOf(zoneId) || []).forEach((neighborId) => {
      if (!targetZoneSet.has(neighborId) || !HIDC_ZONE_CENTERS[neighborId]) return;
      const a = proj.toXY(HIDC_ZONE_CENTERS[zoneId]);
      const b = proj.toXY(HIDC_ZONE_CENTERS[neighborId]);
      corridors.push([a, b, b]);
    });
  });
  const inCorridor = (x, y) => corridors.some((segment) => distToRing(x, y, segment) < CORRIDOR_HALF_WIDTH_KM);

  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  regions.forEach(({ ring }) => ring.forEach(([x, y]) => {
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }));
  minX -= GRID_STEP_KM; minY -= GRID_STEP_KM; maxX += GRID_STEP_KM; maxY += GRID_STEP_KM;
  const cols = Math.ceil((maxX - minX) / GRID_STEP_KM) + 1;
  const rows = Math.ceil((maxY - minY) / GRID_STEP_KM) + 1;

  // Field at grid corners (null = outside both regions).
  const field = new Array(rows * cols);
  for (let r = 0; r < rows; r += 1) {
    const y = minY + r * GRID_STEP_KM;
    for (let c = 0; c < cols; c += 1) {
      const x = minX + c * GRID_STEP_KM;
      let value = null;
      if (pointInRing(x, y, regions[0].ring)) value = regionField(x, y, regions[0].zones);
      else if (pointInRing(x, y, regions[1].ring)) value = regionField(x, y, regions[1].zones);
      else {
        const d0 = distToRing(x, y, regions[0].ring);
        const d1 = distToRing(x, y, regions[1].ring);
        if (d0 < GAP_MARGIN_KM && d1 < GAP_MARGIN_KM) {
          value = regionField(x, y, d0 <= d1 ? regions[0].zones : regions[1].zones);
        } else if (corridors.length > 0 && inCorridor(x, y)) {
          value = 1;
        }
      }
      field[r * cols + c] = value;
    }
  }

  // Marching squares on the zero level (cells with an undefined corner are skipped).
  const segments = [];
  const interp = (ax, ay, av, bx, by, bv) => {
    const t = av / (av - bv);
    return [ax + t * (bx - ax), ay + t * (by - ay)];
  };
  for (let r = 0; r < rows - 1; r += 1) {
    for (let c = 0; c < cols - 1; c += 1) {
      const v0 = field[r * cols + c];
      const v1 = field[r * cols + c + 1];
      const v2 = field[(r + 1) * cols + c + 1];
      const v3 = field[(r + 1) * cols + c];
      if (v0 === null || v1 === null || v2 === null || v3 === null) continue;
      const x0 = minX + c * GRID_STEP_KM;
      const y0 = minY + r * GRID_STEP_KM;
      const x1 = x0 + GRID_STEP_KM;
      const y1 = y0 + GRID_STEP_KM;
      // Zero sits on the BLUE side so exact 0 (contested) counts as BLUE and still yields a line.
      const corners = [[x0, y0, v0], [x1, y0, v1], [x1, y1, v2], [x0, y1, v3]].map(([x, y, v]) => [x, y, v === 0 ? 1e-6 : v]);
      const crossings = [];
      for (let e = 0; e < 4; e += 1) {
        const [ax, ay, av] = corners[e];
        const [bx, by, bv] = corners[(e + 1) % 4];
        if ((av > 0) !== (bv > 0)) crossings.push(interp(ax, ay, av, bx, by, bv));
      }
      if (crossings.length === 2) {
        segments.push([crossings[0], crossings[1]]);
      } else if (crossings.length === 4) {
        const center = (v0 + v1 + v2 + v3) / 4;
        if ((center > 0) === (corners[0][2] > 0)) {
          segments.push([crossings[0], crossings[3]], [crossings[1], crossings[2]]);
        } else {
          segments.push([crossings[0], crossings[1]], [crossings[2], crossings[3]]);
        }
      }
    }
  }

  const lines = joinSegments(segments)
    .map((line) => {
      const first = line[0];
      const last = line[line.length - 1];
      const closed = line.length > 3 && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1e-6;
      let points = closed ? line.slice(0, -1) : line;
      for (let i = 0; i < SMOOTH_ITERATIONS; i += 1) points = chaikin(points, closed);
      if (closed) points = [...points, points[0]];
      return points;
    })
    .filter((points) => lineLengthKm(points) >= MIN_LINE_KM);

  const lengthKm = lines.reduce((sum, points) => sum + lineLengthKm(points), 0);
  const ended = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    type: 'FeatureCollection',
    features: lines.length > 0
      ? [{
        type: 'Feature',
        properties: { targetId, fromId },
        geometry: {
          type: 'MultiLineString',
          coordinates: lines.map((points) => points.map((point) => {
            const [lon, lat] = proj.toLonLat(point);
            return [Math.round(lon * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5];
          })),
        },
      }]
      : [],
    stats: { lines: lines.length, lengthKm: Math.round(lengthKm), ms: Math.round(ended - started), grid: `${cols}x${rows}` },
  };
}
