import { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { CAMPAIGNS } from '../../config/campaigns';
import CampaignPointers from './CampaignPointers';

const GEOJSON_URL = '/geo/ne_110m_admin_0_countries.geojson';
const BASE_HEX_COLOR = 'rgba(150, 165, 185, 0.35)';
const GLOBE_COLOR = '#0a0d12';

function featureCodes(feature) {
  const props = feature?.properties || {};
  return [props.ISO_A2, props.ISO_A2_EH, props.ISO_A3, props.ADM0_A3]
    .filter(Boolean)
    .map((code) => String(code).toUpperCase());
}

function findOwnerCampaign(feature) {
  const codes = new Set(featureCodes(feature));
  return (
    CAMPAIGNS.find((campaign) =>
      (campaign.globeRegions || []).some((region) => codes.has(String(region).toUpperCase())),
    ) || null
  );
}

function hexToRgba(hex, alpha) {
  const clean = String(hex || '').replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map((c) => c + c).join('')
    : clean.padEnd(6, '0').slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Rough centroid of a GeoJSON feature (average of the first outer ring),
 * good enough to orient the globe toward a theater.
 */
function featureCentroid(feature) {
  const geometry = feature?.geometry;
  if (!geometry) return null;
  const rings = geometry.type === 'Polygon'
    ? geometry.coordinates
    : geometry.type === 'MultiPolygon'
      ? geometry.coordinates.map((poly) => poly[0])
      : null;
  if (!rings || !rings.length) return null;

  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  rings.forEach((ring) => {
    (ring || []).forEach(([lng, lat]) => {
      sumLng += lng;
      sumLat += lat;
      count += 1;
    });
  });
  if (!count) return null;
  return { lat: sumLat / count, lng: sumLng / count };
}

export default function HexGlobe({ selectedCampaignId, onSelectCampaign }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const featuresRef = useRef([]);
  const ownerByFeatureRef = useRef(new WeakMap());
  const centroidByCampaignRef = useRef(new Map());
  const selectedRef = useRef(selectedCampaignId);
  const [pointersReady, setPointersReady] = useState(false);

  selectedRef.current = selectedCampaignId;

  const colorAccessor = (feature) => {
    const owner = ownerByFeatureRef.current.get(feature) || null;
    if (!owner) return BASE_HEX_COLOR;
    if (owner.id === selectedRef.current) return owner.highlightColor;
    return hexToRgba(owner.highlightColor, 0.45);
  };

  const focusSelectedCampaign = () => {
    const world = globeRef.current;
    if (!world) return;
    const centroid = centroidByCampaignRef.current.get(selectedRef.current);
    if (centroid) {
      world.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 2.1 }, 900);
    }
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const world = Globe()(container)
      .backgroundColor('rgba(0,0,0,0)')
      .showAtmosphere(true)
      .atmosphereColor('#2a3346')
      .atmosphereAltitude(0.18)
      .hexPolygonResolution(3)
      .hexPolygonMargin(0.3)
      .hexPolygonUseDots(true)
      .hexPolygonAltitude(0.01)
      .hexPolygonColor(colorAccessor);

    const globeMaterial = world.globeMaterial();
    globeMaterial.color = new THREE.Color(GLOBE_COLOR);
    globeMaterial.emissive = new THREE.Color(GLOBE_COLOR);
    globeMaterial.emissiveIntensity = 0.35;
    globeMaterial.shininess = 2;

    const controls = world.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.enableZoom = false;
    controls.enablePan = false;

    world.pointOfView({ lat: 30, lng: 40, altitude: 2.4 });

    globeRef.current = world;

    let cancelled = false;
    const readyFrame = requestAnimationFrame(() => {
      if (!cancelled) setPointersReady(true);
    });

    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((geo) => {
        if (cancelled) return;
        const features = Array.isArray(geo?.features) ? geo.features : [];
        featuresRef.current = features;

        const ownerMap = new WeakMap();
        const centroidMap = new Map();
        features.forEach((feature) => {
          const owner = findOwnerCampaign(feature);
          if (owner) {
            ownerMap.set(feature, owner);
            if (!centroidMap.has(owner.id)) {
              const centroid = featureCentroid(feature);
              if (centroid) centroidMap.set(owner.id, centroid);
            }
          }
        });
        ownerByFeatureRef.current = ownerMap;
        centroidByCampaignRef.current = centroidMap;

        world.hexPolygonsData(features).hexPolygonColor(colorAccessor);
        focusSelectedCampaign();
      })
      .catch((error) => {
        console.error('Failed to load globe GeoJSON:', error);
      });

    const handleResize = () => {
      if (!containerRef.current || !globeRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      globeRef.current.width(clientWidth).height(clientHeight);
    };
    handleResize();

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelled = true;
      cancelAnimationFrame(readyFrame);
      setPointersReady(false);
      resizeObserver.disconnect();
      try {
        world._destructor?.();
      } catch (_) {
        // ignore teardown errors
      }
      globeRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const world = globeRef.current;
    if (!world) return;
    world.hexPolygonColor(colorAccessor);
    focusSelectedCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId]);

  return (
    <div className="landing-globe-wrap">
      <div ref={containerRef} className="landing-globe__canvas" />
      {pointersReady && globeRef.current && (
        <CampaignPointers
          globe={globeRef.current}
          selectedCampaignId={selectedCampaignId}
          onSelect={onSelectCampaign}
        />
      )}
    </div>
  );
}
