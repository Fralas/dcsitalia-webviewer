import { useEffect, useMemo, useRef, useState } from 'react';
import { HIDC_REGION_BORDERS } from '../../config/hidcRegionBorders';
import { computeFrontLine } from '../../utils/hidcFrontLine';
import { normalizeZoneId } from '../../config/zoneConfini';
import './HidcRegionBorders.css';

const SOURCE_ID = 'hidc-region-borders';
const FILL_LAYER_ID = 'hidc-region-borders-fill';
const LINE_LAYER_ID = 'hidc-region-borders-line';
const VOTE_LAYER_ID = 'hidc-region-borders-vote';
const FRONT_SOURCE_ID = 'hidc-front-line';
const FRONT_GLOW_LAYER_ID = 'hidc-front-line-glow';
const FRONT_CORE_LAYER_ID = 'hidc-front-line-core';
const FRONT_DASH_LAYER_ID = 'hidc-front-line-dash';
const OWN_LAYER_IDS = [FILL_LAYER_ID, LINE_LAYER_ID, VOTE_LAYER_ID, FRONT_GLOW_LAYER_ID, FRONT_CORE_LAYER_ID, FRONT_DASH_LAYER_ID];
// Below every operational layer, right above the basemap.
const BEFORE_LAYER_ID = 'grid-layer';
const ALL_LABELS_MIN_ZOOM = 7.6;
const EMPTY_FC = { type: 'FeatureCollection', features: [] };

const COLORS = {
  red: '#ef4444',
  blue: '#4aa3ff',
  active: '#ef4444',
  vote: '#ffbb00',
  // Front: orange core + dark red glow, distinct from the red outline of the active region.
  front: '#ff8c00',
  frontGlow: '#b91c1c',
  frontDash: '#fff3e0',
};

// Marching dashes ("front in movimento"): standard MapLibre dash animation sequence.
const DASH_SEQUENCE = [
  [0, 4, 3], [0.5, 4, 2.5], [1, 4, 2], [1.5, 4, 1.5], [2, 4, 1], [2.5, 4, 0.5], [3, 4, 0],
  [0, 0.5, 3, 3.5], [0, 1, 3, 3], [0, 1.5, 3, 2.5], [0, 2, 3, 2], [0, 2.5, 3, 1.5], [0, 3, 3, 1], [0, 3.5, 3, 0.5],
];
const DASH_STEP_MS = 90;

function roleFor(regionId, campaign) {
  const focus = campaign?.focus;
  if (focus?.target === regionId) return 'active';
  if (focus?.from === regionId) return 'from';
  return 'none';
}

function buildData(campaign) {
  const status = campaign?.regionStatus || {};
  const vote = campaign?.vote;
  const voteOpen = vote && (vote.status === 'open' || vote.status === 'passed');
  return {
    type: 'FeatureCollection',
    features: HIDC_REGION_BORDERS.features.map((feature) => {
      const id = feature.properties.id;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          status: status[id] === 'blue' ? 'blue' : 'red',
          role: roleFor(id, campaign),
          vote: voteOpen && vote.target === id ? 1 : 0,
        },
      };
    }),
  };
}

function ensureLayers(map, data, frontData) {
  if (!map.getSource(SOURCE_ID)) {
    map.addSource(SOURCE_ID, { type: 'geojson', data });
  }
  if (!map.getSource(FRONT_SOURCE_ID)) {
    map.addSource(FRONT_SOURCE_ID, { type: 'geojson', data: frontData });
  }
  const beforeId = map.getLayer(BEFORE_LAYER_ID) ? BEFORE_LAYER_ID : undefined;
  if (!map.getLayer(FILL_LAYER_ID)) {
    map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': ['match', ['get', 'role'], 'active', COLORS.active, 'from', COLORS.blue,
          ['case', ['==', ['get', 'status'], 'blue'], COLORS.blue, COLORS.red]],
        'fill-opacity': ['match', ['get', 'role'], 'active', 0.14, 'from', 0.1, 0.035],
      },
    }, beforeId);
  }
  if (!map.getLayer(LINE_LAYER_ID)) {
    map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['match', ['get', 'role'], 'active', COLORS.active,
          ['case', ['==', ['get', 'status'], 'blue'], COLORS.blue, COLORS.red]],
        'line-width': ['match', ['get', 'role'], 'active', 2.4, 'from', 1.8, 1],
        'line-opacity': ['match', ['get', 'role'], 'none', 0.45, 0.95],
      },
    }, beforeId);
  }
  if (!map.getLayer(VOTE_LAYER_ID)) {
    map.addLayer({
      id: VOTE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: ['==', ['get', 'vote'], 1],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.vote,
        'line-width': 2,
        'line-dasharray': [2, 2],
      },
    }, beforeId);
  }
  if (!map.getLayer(FRONT_GLOW_LAYER_ID)) {
    map.addLayer({
      id: FRONT_GLOW_LAYER_ID,
      type: 'line',
      source: FRONT_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.frontGlow,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 8, 9, 16],
        'line-blur': ['interpolate', ['linear'], ['zoom'], 5, 5, 9, 10],
        'line-opacity': 0.45,
      },
    }, beforeId);
  }
  if (!map.getLayer(FRONT_CORE_LAYER_ID)) {
    map.addLayer({
      id: FRONT_CORE_LAYER_ID,
      type: 'line',
      source: FRONT_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': COLORS.front,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 2.2, 9, 3.6],
        'line-opacity': 0.95,
      },
    }, beforeId);
  }
  if (!map.getLayer(FRONT_DASH_LAYER_ID)) {
    map.addLayer({
      id: FRONT_DASH_LAYER_ID,
      type: 'line',
      source: FRONT_SOURCE_ID,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: {
        'line-color': COLORS.frontDash,
        'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 1.6],
        'line-opacity': 0.75,
        'line-dasharray': DASH_SEQUENCE[0],
      },
    }, beforeId);
  }
}

// FrontlineMap adds its layers asynchronously after 'load': keep ours under them, in our order.
function keepBelowOperationalLayers(map) {
  if (!map.getLayer(BEFORE_LAYER_ID) || !map.getLayer(FILL_LAYER_ID)) return;
  const order = (map.getStyle()?.layers || []).map((layer) => layer.id);
  const gridIndex = order.indexOf(BEFORE_LAYER_ID);
  if (OWN_LAYER_IDS.every((id) => !map.getLayer(id) || order.indexOf(id) < gridIndex)) return;
  OWN_LAYER_IDS.forEach((id) => {
    if (map.getLayer(id)) map.moveLayer(id, BEFORE_LAYER_ID);
  });
}

function removeLayers(map) {
  [...OWN_LAYER_IDS].reverse().forEach((id) => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  [SOURCE_ID, FRONT_SOURCE_ID].forEach((id) => {
    if (map.getSource(id)) map.removeSource(id);
  });
}

function buildLabels(map, campaign) {
  const canvas = map.getCanvas?.();
  const width = canvas?.clientWidth || 0;
  const height = canvas?.clientHeight || 0;
  if (!width || !height) return [];
  const showAll = map.getZoom() >= ALL_LABELS_MIN_ZOOM;
  const vote = campaign?.vote;
  const voteTarget = vote && (vote.status === 'open' || vote.status === 'passed') ? vote.target : null;

  return HIDC_REGION_BORDERS.features.flatMap((feature) => {
    const { id, label, center } = feature.properties;
    const role = roleFor(id, campaign);
    const isVote = voteTarget === id;
    if (!showAll && role === 'none' && !isVote) return [];
    const point = map.project(center);
    if (!Number.isFinite(point?.x) || point.x < -80 || point.y < -40 || point.x > width + 80 || point.y > height + 40) return [];
    const tag = isVote && role === 'none' ? 'In votazione' : '';
    return [{ id, label, tag, tone: role !== 'none' ? role : (isVote ? 'vote' : 'none'), x: point.x, y: point.y }];
  });
}

/**
 * @param {object} props
 * @param {object} props.map           MapLibre map
 * @param {object} props.campaign      /api/hidc/campaign (focus, regionStatus, vote)
 * @param {Array}  props.zones         map zones ({ id, status }) for the front line
 * @param {object} [props.zoneStatusOverrides]  zoneId -> status (debug tool)
 * @param {(stats: object) => void} [props.onFrontStats]
 */
export default function HidcRegionBorders({ map, campaign, zones = [], zoneStatusOverrides = null, onFrontStats, visible = true }) {
  const data = useMemo(() => buildData(campaign), [campaign]);

  const zoneStatus = useMemo(() => {
    const out = {};
    (Array.isArray(zones) ? zones : []).forEach((zone) => {
      if (zone?.id) out[normalizeZoneId(zone.id)] = zone.status;
    });
    if (zoneStatusOverrides) Object.assign(out, zoneStatusOverrides);
    return out;
  }, [zones, zoneStatusOverrides]);

  const front = useMemo(() => {
    const target = campaign?.focus?.target;
    const from = campaign?.focus?.from;
    if (!target || !from) return { ...EMPTY_FC, stats: { lines: 0, lengthKm: 0, ms: 0 } };
    return computeFrontLine({ targetId: target, fromId: from, statusOf: (zoneId) => zoneStatus[zoneId] });
  }, [campaign?.focus?.target, campaign?.focus?.from, zoneStatus]);

  const frontData = useMemo(() => ({ type: 'FeatureCollection', features: front.features }), [front]);
  const latestRef = useRef({ data, frontData });
  latestRef.current = { data, frontData };
  const [labels, setLabels] = useState([]);

  useEffect(() => {
    onFrontStats?.(front.stats);
  }, [front, onFrontStats]);

  // Debug tool "Centra": window event { detail: [regionId, ...] } -> fit the camera on those regions.
  useEffect(() => {
    if (!map) return undefined;
    const onFit = (event) => {
      const ids = Array.isArray(event?.detail) ? event.detail : [];
      let minLon = Infinity; let minLat = Infinity; let maxLon = -Infinity; let maxLat = -Infinity;
      HIDC_REGION_BORDERS.features.forEach((feature) => {
        if (!ids.includes(feature.properties.id)) return;
        feature.geometry.coordinates[0].forEach(([lon, lat]) => {
          minLon = Math.min(minLon, lon); minLat = Math.min(minLat, lat);
          maxLon = Math.max(maxLon, lon); maxLat = Math.max(maxLat, lat);
        });
      });
      if (!Number.isFinite(minLon)) return;
      map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 80, pitch: 0, bearing: 0, duration: 800 });
    };
    window.addEventListener('hidc:fit-regions', onFit);
    return () => window.removeEventListener('hidc:fit-regions', onFit);
  }, [map]);

  useEffect(() => {
    if (!map) return undefined;
    let added = false;
    // isStyleLoaded() can stay false after 'load' while tiles stream in: try now, retry on load/idle.
    const sync = () => {
      if (!added) {
        try {
          ensureLayers(map, latestRef.current.data, latestRef.current.frontData);
          added = true;
        } catch {
          return;
        }
      }
      keepBelowOperationalLayers(map);
    };
    sync();
    map.on('load', sync);
    map.on('idle', sync);
    return () => {
      map.off('load', sync);
      map.off('idle', sync);
      if (added && map.getStyle()) removeLayers(map);
    };
  }, [map]);

  useEffect(() => {
    const source = map?.getSource?.(SOURCE_ID);
    if (source) source.setData(data);
  }, [map, data]);

  useEffect(() => {
    const source = map?.getSource?.(FRONT_SOURCE_ID);
    if (source) source.setData(frontData);
  }, [map, frontData]);

  useEffect(() => {
    if (!map) return;
    OWN_LAYER_IDS.forEach((id) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
    });
  }, [map, visible, data, frontData]);

  // Marching dashes on the front line, only while a front exists.
  useEffect(() => {
    if (!map || !visible || frontData.features.length === 0) return undefined;
    let step = 0;
    const timer = window.setInterval(() => {
      if (!map.getLayer(FRONT_DASH_LAYER_ID)) return;
      step = (step + 1) % DASH_SEQUENCE.length;
      map.setPaintProperty(FRONT_DASH_LAYER_ID, 'line-dasharray', DASH_SEQUENCE[step]);
    }, DASH_STEP_MS);
    return () => window.clearInterval(timer);
  }, [map, visible, frontData]);

  useEffect(() => {
    if (!map || !visible) {
      setLabels([]);
      return undefined;
    }
    const sync = () => setLabels(buildLabels(map, campaign));
    sync();
    const events = ['move', 'zoom', 'resize', 'pitch', 'rotate'];
    events.forEach((name) => map.on(name, sync));
    return () => events.forEach((name) => map.off(name, sync));
  }, [map, campaign, visible]);

  if (!visible || labels.length === 0) return null;

  return (
    <div className="hidc-region-labels" aria-hidden="true">
      {labels.map((entry) => (
        <div
          key={entry.id}
          className={`hidc-region-labels__label hidc-region-labels__label--${entry.tone}`}
          style={{ left: `${entry.x}px`, top: `${entry.y}px` }}
        >
          <span className="hidc-region-labels__name">{entry.label}</span>
          {entry.tag && <span className="hidc-region-labels__tag">{entry.tag}</span>}
        </div>
      ))}
    </div>
  );
}
