import { useEffect, useMemo, useState } from 'react';
import { getLidcPoiColor } from '../config/lidcPointsOfInterest';
import { LIDC_REGION_LABELS } from '../config/lidcRegionBorders';
import {
  LIDC_MACRO_AREAS,
  getMacroCenter,
  getPoiRegionId,
  getRegionCenter,
} from '../config/lidcPoiRegions';

export const LIDC_POI_LEVEL_REGION_ZOOM = 6;
export const LIDC_POI_LEVEL_DETAIL_ZOOM = 7.5;

const BASE_OUTWARD_PX = 26;
const BASE_LABEL_GAP_PX = 2;
const BASE_DOT_RADIUS = 3.4;
const BASE_TYPE_FONT_PX = 8.5;
const BASE_NAME_FONT_PX = 10.5;
const EDGE_MARGIN = 30;
const POINTER_REFERENCE_ZOOM = 6;
const CARD_WIDTH_PX = 250;
const CARD_GAP_PX = 10;
const DETAIL_CLUSTER_RADIUS_PX = 48;
const REGION_MERGE_RADIUS_PX = 60;
const MACRO_MERGE_RADIUS_PX = 90;
const BADGE_EDGE_MARGIN = 40;
const CLUSTER_ZOOM_STEP = 2;
const CARD_MISSION_ROWS = 12;
const CARD_REGION_ROWS = 10;

function getPointerScale(zoom) {
  const scaled = 2 ** ((zoom - POINTER_REFERENCE_ZOOM) / 3);
  return Math.max(0.62, Math.min(1.25, scaled));
}

function underlineWidthForLabel(text, scale) {
  const base = Math.min(132, Math.max(46, String(text || '').length * 6.4));
  return base * scale;
}

function buildPointerPath(side, anchor, elbow, underlineStart, underlineEnd) {
  if (side === 'left') {
    return `M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineEnd.x} ${underlineEnd.y} L ${underlineStart.x} ${underlineStart.y}`;
  }
  return `M ${anchor.x} ${anchor.y} L ${elbow.x} ${elbow.y} L ${underlineStart.x} ${underlineStart.y} L ${underlineEnd.x} ${underlineEnd.y}`;
}

function buildPoiFrame(anchor, width, poi, scale, regionId) {
  const side = anchor.x >= width / 2 ? 'right' : 'left';
  const leanX = Math.max(-0.4, Math.min(0.4, (anchor.x - width / 2) / 260));
  const stemLen = Math.hypot(leanX, 1) || 1;
  const outwardPx = BASE_OUTWARD_PX * scale;
  const labelGapPx = BASE_LABEL_GAP_PX * scale;

  const elbow = {
    x: anchor.x + (leanX / stemLen) * outwardPx,
    y: anchor.y - (1 / stemLen) * outwardPx,
  };

  const labelText = `${poi.number} · ${poi.name}`;
  const underlineWidth = underlineWidthForLabel(labelText, scale);
  let underlineStart;
  let underlineEnd;

  if (side === 'left') {
    underlineEnd = { x: elbow.x - labelGapPx, y: elbow.y };
    underlineStart = { x: underlineEnd.x - underlineWidth, y: elbow.y };
  } else {
    underlineStart = { x: elbow.x + labelGapPx, y: elbow.y };
    underlineEnd = { x: underlineStart.x + underlineWidth, y: elbow.y };
  }

  return {
    poi,
    regionId,
    anchor,
    elbow,
    underlineStart,
    underlineEnd,
    label: { ...underlineStart },
    labelText,
    labelWidth: underlineWidth,
    side,
    scale,
    containerWidth: width,
    dotRadius: BASE_DOT_RADIUS * scale,
    strokeWidth: Math.max(1.1, 1.8 * scale),
    typeFontSize: BASE_TYPE_FONT_PX * scale,
    nameFontSize: BASE_NAME_FONT_PX * scale,
    pathD: buildPointerPath(side, anchor, elbow, underlineStart, underlineEnd),
  };
}

function projectLonLat(map, lon, lat) {
  const point = map.project([lon, lat]);
  if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return null;
  return point;
}

function buildView(map, pois) {
  const canvas = map.getCanvas();
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (!width || !height) return null;

  const zoom = map.getZoom();
  const level = zoom < LIDC_POI_LEVEL_REGION_ZOOM ? 'macro' : (zoom < LIDC_POI_LEVEL_DETAIL_ZOOM ? 'regions' : 'detail');
  const scale = getPointerScale(zoom);
  const center = map.unproject([width / 2, height / 2]);

  // Project every POI once (region attached); keep in-view ones.
  const frames = [];
  for (const poi of pois) {
    const anchor = projectLonLat(map, poi.lon, poi.lat);
    if (!anchor) continue;
    if (anchor.x < -EDGE_MARGIN || anchor.y < -EDGE_MARGIN || anchor.x > width + EDGE_MARGIN || anchor.y > height + EDGE_MARGIN) continue;
    frames.push(buildPoiFrame(anchor, width, poi, scale, getPoiRegionId(poi)));
  }

  const byRegion = new Map();
  for (const frame of frames) {
    if (!byRegion.has(frame.regionId)) byRegion.set(frame.regionId, []);
    byRegion.get(frame.regionId).push(frame);
  }

  if (level === 'macro') {
    const badges = [];
    for (const macro of LIDC_MACRO_AREAS) {
      const centerPt = getMacroCenter(macro);
      if (!centerPt) continue;
      const point = projectLonLat(map, centerPt.lon, centerPt.lat);
      if (!point) continue;
      if (point.x < -BADGE_EDGE_MARGIN || point.y < -BADGE_EDGE_MARGIN || point.x > width + BADGE_EDGE_MARGIN || point.y > height + BADGE_EDGE_MARGIN) continue;
      const regionCounts = macro.regions
        .map((id) => ({ id, count: (byRegion.get(id) || []).length }))
        .filter((entry) => entry.count > 0);
      const count = regionCounts.reduce((sum, entry) => sum + entry.count, 0);
      if (count === 0) continue;
      badges.push({
        key: `macro-${macro.id}`,
        x: point.x,
        y: point.y,
        lon: centerPt.lon,
        lat: centerPt.lat,
        kind: 'macro',
        title: macro.name,
        count,
        regionIds: regionCounts.map((entry) => entry.id),
        regionCounts,
        areaIds: [macro.id],
        areaNames: [macro.name],
        missions: regionCounts.flatMap((entry) => byRegion.get(entry.id) || []),
      });
    }
    return { level, zoom, width, badges: mergeBadges(badges, MACRO_MERGE_RADIUS_PX), pins: [], faint: [], focus: [], center };
  }

  if (level === 'regions') {
    const badges = [];
    for (const [regionId, regionFrames] of byRegion) {
      const centerPt = getRegionCenter(regionId);
      if (!centerPt) continue;
      const point = projectLonLat(map, centerPt.lon, centerPt.lat);
      if (!point) continue;
      if (point.x < -BADGE_EDGE_MARGIN || point.y < -BADGE_EDGE_MARGIN || point.x > width + BADGE_EDGE_MARGIN || point.y > height + BADGE_EDGE_MARGIN) continue;
      badges.push({
        key: `region-${regionId}`,
        x: point.x,
        y: point.y,
        lon: centerPt.lon,
        lat: centerPt.lat,
        kind: 'region',
        title: regionId,
        count: regionFrames.length,
        regionIds: [regionId],
        regionCounts: [{ id: regionId, count: regionFrames.length }],
        areaIds: [],
        areaNames: [],
        missions: regionFrames,
      });
    }
    return { level, zoom, width, badges: mergeBadges(badges, REGION_MERGE_RADIUS_PX), pins: [], faint: [], focus: [], center };
  }

  // Detail: at most two provinces in focus, priority to screen center.
  // Rank regions with POIs in view by center distance; fall back to the
  // two overall nearest regions when the viewport shows no POI.
  const cosLat = Math.cos(center.lat * Math.PI / 180) || 1;
  const centerDistance = (lon, lat) => {
    const dx = (lon - center.lng) * cosLat;
    const dy = lat - center.lat;
    return dx * dx + dy * dy;
  };
  const rankedVisible = [...byRegion.keys()]
    .map((regionId) => {
      const centerPt = getRegionCenter(regionId);
      if (!centerPt) return null;
      return { regionId, d: centerDistance(centerPt.lon, centerPt.lat) };
    })
    .filter(Boolean)
    .sort((a, b) => a.d - b.d);
  let focus = rankedVisible.slice(0, 2).map((entry) => entry.regionId);
  if (focus.length === 0) {
    focus = LIDC_REGION_LABELS
      .map((label) => ({ regionId: label.label, d: centerDistance(label.lon, label.lat) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((entry) => entry.regionId);
  }
  const focusSet = new Set(focus);
  const pins = frames.filter((frame) => focusSet.has(frame.regionId));
  const faint = frames.filter((frame) => !focusSet.has(frame.regionId));
  const { singles, clusters } = clusterPinFrames(pins);

  return { level, zoom, width, badges: clusters, pins: singles, faint, focus, center };
}

/** Greedy screen-space merge of badges that are too close / overlapping. */
function mergeBadges(badges, radiusPx) {
  const assigned = new Array(badges.length).fill(false);
  const merged = [];
  badges.forEach((badge, index) => {
    if (assigned[index]) return;
    assigned[index] = true;
    const members = [badge];
    let cx = badge.x;
    let cy = badge.y;
    for (let j = index + 1; j < badges.length; j += 1) {
      if (assigned[j]) continue;
      if (Math.hypot(badges[j].x - cx, badges[j].y - cy) <= radiusPx) {
        assigned[j] = true;
        members.push(badges[j]);
        cx = members.reduce((sum, m) => sum + m.x, 0) / members.length;
        cy = members.reduce((sum, m) => sum + m.y, 0) / members.length;
      }
    }
    if (members.length === 1) {
      merged.push(badge);
      return;
    }
    const count = members.reduce((sum, m) => sum + m.count, 0);
    const regionMap = new Map();
    const areaMap = new Map();
    let missions = [];
    let lonSum = 0;
    let latSum = 0;
    let lonLatCount = 0;
    for (const m of members) {
      for (const rc of m.regionCounts || []) regionMap.set(rc.id, (regionMap.get(rc.id) || 0) + rc.count);
      (m.areaIds || []).forEach((id, i) => areaMap.set(id, m.areaNames?.[i] || id));
      missions = missions.concat(m.missions || []);
      if (Number.isFinite(m.lon) && Number.isFinite(m.lat)) {
        lonSum += m.lon;
        latSum += m.lat;
        lonLatCount += 1;
      }
    }
    const regionCounts = [...regionMap.entries()]
      .map(([id, c]) => ({ id, count: c }))
      .sort((a, b) => b.count - a.count);
    merged.push({
      key: members.map((m) => m.key).sort().join('+'),
      x: cx,
      y: cy,
      lon: lonLatCount ? lonSum / lonLatCount : undefined,
      lat: lonLatCount ? latSum / lonLatCount : undefined,
      kind: `merged-${members[0].kind}`,
      title: '',
      count,
      regionIds: regionCounts.map((entry) => entry.id),
      regionCounts,
      areaIds: [...areaMap.keys()],
      areaNames: [...areaMap.values()],
      missions,
    });
  });
  return merged;
}

/** Overlap clustering for detail pins (same radius idea as before). */
function clusterPinFrames(frames) {
  const assigned = new Array(frames.length).fill(false);
  const singles = [];
  const clusters = [];
  frames.forEach((frame, index) => {
    if (assigned[index]) return;
    assigned[index] = true;
    const members = [frame];
    let cx = frame.anchor.x;
    let cy = frame.anchor.y;
    for (let j = index + 1; j < frames.length; j += 1) {
      if (assigned[j]) continue;
      const dx = frames[j].anchor.x - cx;
      const dy = frames[j].anchor.y - cy;
      if (Math.hypot(dx, dy) <= DETAIL_CLUSTER_RADIUS_PX) {
        assigned[j] = true;
        members.push(frames[j]);
        cx = members.reduce((sum, m) => sum + m.anchor.x, 0) / members.length;
        cy = members.reduce((sum, m) => sum + m.anchor.y, 0) / members.length;
      }
    }
    if (members.length === 1) {
      singles.push(frame);
      return;
    }
    const regionMap = new Map();
    for (const m of members) regionMap.set(m.regionId, (regionMap.get(m.regionId) || 0) + 1);
    clusters.push({
      key: members.map((m) => m.poi.id).sort().join('|'),
      x: cx,
      y: cy,
      lon: undefined,
      lat: undefined,
      anchorMembers: members,
      kind: 'detail',
      title: '',
      count: members.length,
      regionIds: [...regionMap.keys()],
      regionCounts: [...regionMap.entries()].map(([id, count]) => ({ id, count })),
      areaIds: [],
      areaNames: [],
      missions: members,
    });
  });
  return { singles, clusters };
}

function badgeDisplayName(badge) {
  if (badge.kind === 'macro') return badge.title;
  if (badge.kind === 'region') return `R${badge.title}`;
  if (badge.kind === 'merged-macro') {
    const names = (badge.areaNames || []).slice(0, 2).join(' + ');
    const extra = (badge.areaNames || []).length > 2 ? ` +${(badge.areaNames || []).length - 2}` : '';
    return `${names}${extra}`;
  }
  const ids = (badge.regionIds || []).slice(0, 2).map((id) => `R${id}`).join(' + ');
  const extra = (badge.regionIds || []).length > 2 ? ` +${(badge.regionIds || []).length - 2}` : '';
  return `${ids}${extra}`;
}

export default function LidcMapPoiPointers({ map, pois = [] }) {
  const [view, setView] = useState(null);
  const [hoveredBadgeKey, setHoveredBadgeKey] = useState('');
  const [hoveredId, setHoveredId] = useState('');
  const [pinnedId, setPinnedId] = useState('');

  useEffect(() => {
    if (!map) return undefined;

    const syncView = () => {
      setView(buildView(map, pois));
      setHoveredBadgeKey('');
    };

    syncView();
    map.on('move', syncView);
    map.on('zoom', syncView);
    map.on('resize', syncView);
    map.on('load', syncView);

    return () => {
      map.off('move', syncView);
      map.off('zoom', syncView);
      map.off('resize', syncView);
      map.off('load', syncView);
    };
  }, [map, pois]);

  useEffect(() => {
    if (!map || !pinnedId) return undefined;
    const handleMapClick = () => setPinnedId('');
    map.on('click', handleMapClick);
    return () => {
      map.off('click', handleMapClick);
    };
  }, [map, pinnedId]);

  const badges = useMemo(() => view?.badges || [], [view]);
  const pins = useMemo(() => view?.pins || [], [view]);
  const faint = useMemo(() => view?.faint || [], [view]);
  const focus = useMemo(() => view?.focus || [], [view]);
  const level = view?.level || 'macro';

  const activeId = pinnedId || hoveredId;
  const activePin = useMemo(
    () => pins.find((frame) => frame.poi.id === activeId) || null,
    [pins, activeId],
  );
  const hoveredBadge = useMemo(
    () => badges.find((badge) => badge.key === hoveredBadgeKey) || null,
    [badges, hoveredBadgeKey],
  );

  function zoomTo(lon, lat, badge) {
    if (!map) return;
    const targetZoom = Math.min(map.getMaxZoom(), map.getZoom() + CLUSTER_ZOOM_STEP);
    const center = (Number.isFinite(lon) && Number.isFinite(lat))
      ? [lon, lat]
      : map.unproject([badge.x, badge.y]).toArray();
    map.easeTo({ center, zoom: targetZoom, duration: 450 });
    setPinnedId('');
  }

  function zoomOutToRegions() {
    if (!map) return;
    map.easeTo({ zoom: Math.min(map.getZoom(), LIDC_POI_LEVEL_DETAIL_ZOOM - 0.5), duration: 450 });
    setPinnedId('');
  }

  const cardStyleFor = (x, y, containerWidth) => {
    const half = CARD_WIDTH_PX / 2;
    const rawLeft = x - half;
    const maxLeft = Math.max(8, containerWidth - CARD_WIDTH_PX - 8);
    return {
      left: `${Math.max(8, Math.min(maxLeft, rawLeft))}px`,
      top: `${y - CARD_GAP_PX}px`,
      width: `${CARD_WIDTH_PX}px`,
      transform: 'translate(0, -100%)',
    };
  };

  const pinCardStyle = useMemo(() => {
    if (!activePin) return null;
    return {
      ...cardStyleFor(activePin.elbow.x, activePin.elbow.y, activePin.containerWidth),
      '--poi-accent': getLidcPoiColor(activePin.poi),
    };
  }, [activePin]);

  const badgeCardStyle = useMemo(() => {
    if (!hoveredBadge || activePin) return null;
    return cardStyleFor(hoveredBadge.x, hoveredBadge.y, view?.width || 800);
  }, [hoveredBadge, activePin, view]);

  const focusCount = useMemo(
    () => pins.length + badges.filter((b) => b.kind === 'detail').reduce((sum, b) => sum + b.count, 0),
    [pins, badges],
  );

  return (
    <div className="lidc-map-poi" aria-hidden={(badges.length === 0 && pins.length === 0)}>
      <svg className="lidc-map-poi__svg">
        {faint.map((frame) => (
          <circle
            key={`faint-${frame.poi.id}`}
            className="lidc-map-poi__faint"
            cx={frame.anchor.x}
            cy={frame.anchor.y}
            r={Math.max(1.6, frame.dotRadius * 0.8)}
          />
        ))}
        {pins.map((frame) => {
          const color = getLidcPoiColor(frame.poi);
          const isActive = frame.poi.id === activeId;
          const isDimmed = frame.poi.mapStatus !== 'Dentro la mappa';
          return (
            <g
              key={frame.poi.id}
              className={`lidc-map-poi__group${isActive ? ' is-active' : ''}${isDimmed ? ' is-dimmed' : ''}`}
              style={{ '--poi-accent': color }}
            >
              <path
                className="lidc-map-poi__line"
                d={frame.pathD}
                strokeWidth={frame.strokeWidth}
              />
              <circle
                className="lidc-map-poi__hit"
                cx={frame.anchor.x}
                cy={frame.anchor.y}
                r={Math.max(14, frame.dotRadius * 3.4)}
                onMouseEnter={() => setHoveredId(frame.poi.id)}
                onMouseLeave={() => setHoveredId('')}
                onClick={(event) => {
                  event.stopPropagation();
                  setPinnedId((prev) => (prev === frame.poi.id ? '' : frame.poi.id));
                }}
              />
              <circle
                className="lidc-map-poi__dot"
                cx={frame.anchor.x}
                cy={frame.anchor.y}
                r={frame.dotRadius}
                strokeWidth={Math.max(1, frame.strokeWidth * 0.6)}
              />
            </g>
          );
        })}
      </svg>
      {level === 'detail' && pins.map((frame) => {
        const color = getLidcPoiColor(frame.poi);
        const isActive = frame.poi.id === activeId;
        return (
          <div
            key={`${frame.poi.id}-label`}
            className={`lidc-map-poi__label${isActive ? ' is-active' : ''}`}
            style={{
              left: `${frame.label.x}px`,
              top: `${frame.label.y}px`,
              width: `${frame.labelWidth}px`,
              transform: 'translate(0, -100%)',
              '--poi-accent': color,
            }}
            onMouseEnter={() => setHoveredId(frame.poi.id)}
            onMouseLeave={() => setHoveredId('')}
            onClick={(event) => {
              event.stopPropagation();
              setPinnedId((prev) => (prev === frame.poi.id ? '' : frame.poi.id));
            }}
          >
            <span
              className="lidc-map-poi__label-type"
              style={{ fontSize: `${frame.typeFontSize}px` }}
            >
              {`N° ${frame.poi.number} · ${frame.poi.category}`}
            </span>
            <span
              className="lidc-map-poi__label-name"
              style={{ fontSize: `${frame.nameFontSize}px` }}
            >
              {frame.poi.name}
            </span>
          </div>
        );
      })}
      {badges.map((badge) => (
        <button
          key={badge.key}
          type="button"
          className={`lidc-poi-badge lidc-poi-badge--${badge.kind === 'detail' ? 'cluster' : badge.kind.startsWith('merged') ? 'merged' : badge.kind}`}
          style={{ left: `${badge.x}px`, top: `${badge.y}px` }}
          onMouseEnter={() => setHoveredBadgeKey(badge.key)}
          onMouseLeave={() => setHoveredBadgeKey('')}
          onFocus={() => setHoveredBadgeKey(badge.key)}
          onBlur={() => setHoveredBadgeKey('')}
          onClick={(event) => {
            event.stopPropagation();
            zoomTo(badge.lon, badge.lat, badge);
          }}
          aria-label={badge.kind === 'detail'
            ? `${badge.count} missioni in questa zona, clicca per zoomare`
            : badge.kind === 'macro' || badge.kind === 'merged-macro'
              ? `Area ${badgeDisplayName(badge)}: ${badge.count} missioni, clicca per zoomare`
              : `Regione ${badgeDisplayName(badge)}: ${badge.count} missioni, clicca per zoomare`}
        >
          <span className="lidc-poi-badge__name">{badgeDisplayName(badge)}</span>
          <span className="lidc-poi-badge__count">{badge.count}</span>
        </button>
      ))}
      {activePin && (
        <div
          className="lidc-map-poi__card"
          style={pinCardStyle}
          onMouseEnter={() => setHoveredId(activePin.poi.id)}
          onMouseLeave={() => setHoveredId('')}
        >
          <div className="lidc-map-poi__card-kicker">
            {`N° ${activePin.poi.number} · ${activePin.poi.category}`}
          </div>
          <div className="lidc-map-poi__card-title">{activePin.poi.name}</div>
          <div className="lidc-map-poi__card-meta">
            {activePin.poi.province}
            {activePin.poi.mapStatus !== 'Dentro la mappa' ? ` · ${activePin.poi.mapStatus}` : ''}
            {` · R${activePin.regionId}`}
          </div>
          <div className="lidc-map-poi__card-desc">{activePin.poi.description}</div>
          {activePin.poi.source && (
            <a
              className="lidc-map-poi__card-source"
              href={activePin.poi.source}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              Fonte ↗
            </a>
          )}
        </div>
      )}
      {hoveredBadge && !activePin && (
        <BadgeCard badge={hoveredBadge} style={badgeCardStyle} onHover={setHoveredBadgeKey} />
      )}
      {level === 'detail' && focus.length > 0 && (
        <button
          type="button"
          className="lidc-poi-focus"
          onClick={(event) => {
            event.stopPropagation();
            zoomOutToRegions();
          }}
          title="Torna ai cluster di regione"
        >
          {`FOCUS · ${focus.map((id) => `R${id}`).join(' · ')} · ${focusCount}`}
        </button>
      )}
    </div>
  );
}

function BadgeCard({ badge, style, onHover }) {
  const isMacro = badge.kind === 'macro' || badge.kind === 'merged-macro';
  const shownRegions = (badge.regionCounts || []).slice(0, CARD_REGION_ROWS);
  const extraRegions = (badge.regionCounts || []).length - shownRegions.length;
  const shownMissions = (badge.missions || []).slice(0, CARD_MISSION_ROWS);
  const extraMissions = (badge.missions || []).length - shownMissions.length;

  return (
    <div
      className="lidc-map-poi__card"
      style={style}
      onMouseEnter={() => onHover(badge.key)}
      onMouseLeave={() => onHover('')}
    >
      <div className="lidc-map-poi__card-kicker">
        {isMacro
          ? `${badge.count} MISSIONI · ${(badge.areaNames || []).join(' + ') || 'AREA'}`
          : `${badge.count} MISSIONI${(badge.regionIds || []).length > 1 ? ` · ${(badge.regionIds || []).map((id) => `R${id}`).join(' + ')}` : ` · R${badge.regionIds?.[0] || ''}`}`}
      </div>
      {isMacro ? (
        <div className="lidc-map-poi__cluster-list">
          {shownRegions.map((entry) => (
            <div key={entry.id} className="lidc-map-poi__cluster-row">
              <span className="lidc-map-poi__cluster-row-text">
                {`R${entry.id} · ${entry.count} missioni`}
              </span>
            </div>
          ))}
          {extraRegions > 0 && (
            <div className="lidc-map-poi__cluster-row">
              <span className="lidc-map-poi__cluster-row-text">{`+${extraRegions} altre regioni`}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="lidc-map-poi__cluster-list">
          {shownMissions.map((frame) => (
            <div key={frame.poi.id} className="lidc-map-poi__cluster-row">
              <span
                className="lidc-map-poi__cluster-row-dot"
                style={{ backgroundColor: getLidcPoiColor(frame.poi) }}
                aria-hidden="true"
              />
              <span className="lidc-map-poi__cluster-row-text">
                {`N° ${frame.poi.number} · ${frame.poi.name}`}
              </span>
            </div>
          ))}
          {extraMissions > 0 && (
            <div className="lidc-map-poi__cluster-row">
              <span className="lidc-map-poi__cluster-row-text">{`+${extraMissions} altre missioni`}</span>
            </div>
          )}
        </div>
      )}
      <div className="lidc-map-poi__card-hint">Clicca per zoomare</div>
    </div>
  );
}
