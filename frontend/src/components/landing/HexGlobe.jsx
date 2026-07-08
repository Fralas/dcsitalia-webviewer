import { useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import CampaignPointers from './CampaignPointers';
import { resolveGlobeHexColor, resolveTheaterCampaignId } from '../../utils/globeTheaterColor';
import { prepareGlobeCountryFeatures } from '../../utils/prepareGlobeFeatures';
import { buildExtraHexFeatures, collectCountryHexCells } from '../../utils/buildExtraHexFeatures';
import { expandHidcTheaterHitboxes } from '../../utils/expandHidcTheaterHitboxes';
import { industrialDark } from '../../config/industrialDarkTokens';
import { GLOBE_EXTRA_DOTS } from '../../config/globeMarkers';

const GEOJSON_URL = '/geo/ne_110m_admin_0_countries.geojson';
const CDN = 'https://cdn.jsdelivr.net/npm/three-globe/example/img';
const GLOBE_POV_ALTITUDE = 2.4 / 1.3 / 1.2;
const AUTO_ROTATE_RESUME_MS = 30_000;
const HEX_POLYGON_MARGIN = 0.3;
const HEX_POLYGON_ALTITUDE = 0.001;
const HIDC_HITBOX_RADIUS_MULTIPLIER = 2;

function applyUnlitMaterials(world) {
  world.scene().traverse((obj) => {
    const type = obj.__globeObjType;
    if (!obj.material || type !== 'hexPolygon') return;

    if (!obj.material.isMeshBasicMaterial) {
      const prev = obj.material;
      obj.material = new THREE.MeshBasicMaterial({
        color: prev.color.clone(),
        transparent: prev.transparent,
        opacity: prev.opacity,
      });
      prev.dispose();
    }

    obj.material.side = THREE.FrontSide;
  });
}

export default function HexGlobe({ selectedCampaignId, onCampaignSelect }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const onCampaignSelectRef = useRef(onCampaignSelect);
  const [pointersReady, setPointersReady] = useState(false);

  const handleSelectCampaign = (campaignId) => {
    const controls = globeRef.current?.controls?.();
    if (controls) controls.autoRotate = false;
    onCampaignSelectRef.current?.(campaignId);
  };

  useEffect(() => {
    onCampaignSelectRef.current = onCampaignSelect;
  }, [onCampaignSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;

    const world = Globe()(container)
      .backgroundColor(industrialDark.bgDeep)
      .globeImageUrl(`${CDN}/earth-dark.jpg`)
      .showAtmosphere(false)
      .hexPolygonResolution(3)
      .hexPolygonMargin(HEX_POLYGON_MARGIN)
      .hexPolygonAltitude(HEX_POLYGON_ALTITUDE)
      .hexPolygonUseDots(true)
      .hexPolygonColor(resolveGlobeHexColor)
      .onHexPolygonClick((feature, event) => {
        event?.stopPropagation?.();
        const campaignId = resolveTheaterCampaignId(feature);
        if (campaignId) onCampaignSelectRef.current?.(campaignId);
      })
      .showPointerCursor((objType, objData) => (
        Boolean(resolveTheaterCampaignId(objData))
      ));

    world.lights([new THREE.AmbientLight(0xffffff, Math.PI)]);

    const controls = world.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.1925;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = true;

    let resumeTimer = null;

    const stopAutoRotate = () => {
      controls.autoRotate = false;
    };

    const scheduleAutoRotateResume = () => {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        controls.autoRotate = true;
        resumeTimer = null;
      }, AUTO_ROTATE_RESUME_MS);
    };

    controls.addEventListener('start', stopAutoRotate);
    controls.addEventListener('end', scheduleAutoRotateResume);

    world.pointOfView({ lat: 30, lng: 40, altitude: GLOBE_POV_ALTITUDE });
    globeRef.current = world;

    const readyFrame = requestAnimationFrame(() => {
      if (!cancelled) setPointersReady(true);
    });

    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((geo) => {
        if (cancelled) return;
        const rawFeatures = Array.isArray(geo?.features) ? geo.features : [];
        const features = prepareGlobeCountryFeatures(rawFeatures);
        const occupiedCells = collectCountryHexCells(rawFeatures);
        const italyMarkers = GLOBE_EXTRA_DOTS.filter(
          (marker) => !String(marker.ISO_A3).startsWith('CY-'),
        );
        const extraFeatures = buildExtraHexFeatures(italyMarkers, occupiedCells);
        world.hexPolygonsData([...features, ...extraFeatures]);
        requestAnimationFrame(() => {
          if (cancelled) return;
          applyUnlitMaterials(world);
          expandHidcTheaterHitboxes(world, {
            margin: HEX_POLYGON_MARGIN,
            altitude: HEX_POLYGON_ALTITUDE,
            multiplier: HIDC_HITBOX_RADIUS_MULTIPLIER,
          });
        });
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
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(readyFrame);
      setPointersReady(false);
      if (resumeTimer) clearTimeout(resumeTimer);
      controls.removeEventListener('start', stopAutoRotate);
      controls.removeEventListener('end', scheduleAutoRotateResume);
      resizeObserver.disconnect();
      try {
        world._destructor?.();
      } catch (_) {
        // ignore teardown errors
      }
      globeRef.current = null;
    };
  }, []);

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
