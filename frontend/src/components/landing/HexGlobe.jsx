import { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import CampaignPointers from './CampaignPointers';
import { buildGlobeRegionFeatures } from '../../utils/buildGlobeRegionFeatures';

const GEOJSON_URL = '/geo/ne_110m_admin_0_countries.geojson';
const BASE_HEX_COLOR = 'rgba(150, 165, 185, 0.35)';
const GLOBE_COLOR = '#0a0d12';

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

export default function HexGlobe({ selectedCampaignId, onSelectCampaign }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const featuresRef = useRef([]);
  const getOwnerRef = useRef(() => null);
  const centroidByCampaignRef = useRef(new Map());
  const selectedRef = useRef(selectedCampaignId);
  const [pointersReady, setPointersReady] = useState(false);

  selectedRef.current = selectedCampaignId;

  const colorAccessor = (feature) => {
    const owner = getOwnerRef.current(feature);
    if (!owner) return BASE_HEX_COLOR;
    if (owner.id === selectedRef.current) return owner.highlightColor;
    return hexToRgba(owner.highlightColor, 0.45);
  };

  const altitudeAccessor = (feature) => (
    feature?.properties?._partialRegion ? 0.018 : 0.01
  );

  const focusSelectedCampaign = (animateMs = 900) => {
    const world = globeRef.current;
    if (!world) return;
    const centroid = centroidByCampaignRef.current.get(selectedRef.current);
    if (centroid) {
      world.pointOfView({ lat: centroid.lat, lng: centroid.lng, altitude: 2.1 }, animateMs);
    }
  };

  const handleSelectCampaign = (campaignId) => {
    const controls = globeRef.current?._orbitControls || globeRef.current?.controls?.();
    if (controls) {
      controls.autoRotate = false;
    }
    onSelectCampaign?.(campaignId);
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
      .hexPolygonAltitude(altitudeAccessor)
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
    controls.enableRotate = true;

    world._orbitControls = controls;

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
        const regionData = buildGlobeRegionFeatures(features);

        featuresRef.current = regionData.features;
        getOwnerRef.current = regionData.getOwner;
        centroidByCampaignRef.current = regionData.centroidByCampaign;

        world
          .hexPolygonsData(regionData.features)
          .hexPolygonAltitude(altitudeAccessor)
          .hexPolygonColor(colorAccessor);
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
    world.hexPolygonAltitude(altitudeAccessor);
    focusSelectedCampaign(1200);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaignId]);

  return (
    <div className="landing-globe-wrap">
      <div ref={containerRef} className="landing-globe__canvas" />
      {pointersReady && globeRef.current && (
        <CampaignPointers
          globe={globeRef.current}
          selectedCampaignId={selectedCampaignId}
          onSelect={handleSelectCampaign}
        />
      )}
    </div>
  );
}
