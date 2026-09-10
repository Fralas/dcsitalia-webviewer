import { useCallback, useEffect, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import CampaignPointers from './CampaignPointers';
import { getCampaignById } from '../../config/campaigns';
import { resolveGlobeHexColor } from '../../utils/globeTheaterColor';
import { prepareGlobeCountryFeatures, buildTheaterClickAreasFromRawFeatures } from '../../utils/prepareGlobeFeatures';
import { buildExtraHexFeatures, collectCountryHexCells } from '../../utils/buildExtraHexFeatures';
import { attachTheaterAreaInteraction } from '../../utils/theaterClickAreas';
import { GLOBE_EXTRA_DOTS } from '../../config/globeMarkers';

const GEOJSON_URL = '/geo/ne_110m_admin_0_countries.geojson';
const CDN = 'https://cdn.jsdelivr.net/npm/three-globe/example/img';
const GLOBE_POV_ALTITUDE = 2.4 / 1.3 / 1.2;
const AUTO_ROTATE_RESUME_MS = 30_000;
const FOCUS_ALTITUDE_FACTOR = 0.68;
const FOCUS_TRANSITION_MS = 900;
const RESET_TRANSITION_MS = 1200;
const HEX_POLYGON_MARGIN = 0.3;
const HEX_POLYGON_ALTITUDE = 0.001;

const DEFAULT_POV = Object.freeze({
  lat: 30,
  lng: 40,
  altitude: GLOBE_POV_ALTITUDE,
});

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
  const wrapRef = useRef(null);
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const onCampaignSelectRef = useRef(onCampaignSelect);
  const idleTimerRef = useRef(null);
  const altitudeAnimRef = useRef(null);
  const isCampaignFocusedRef = useRef(false);
  const scheduleIdleRecoveryRef = useRef(() => {});
  const resetZoomToDefaultRef = useRef(() => {});
  const handleSelectCampaignRef = useRef(() => {});
  const lastFocusedCampaignRef = useRef(null);
  const [pointersReady, setPointersReady] = useState(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  }, []);

  const cancelAltitudeAnim = useCallback(() => {
    if (altitudeAnimRef.current) {
      cancelAnimationFrame(altitudeAnimRef.current);
      altitudeAnimRef.current = null;
    }
  }, []);

  const easeCubicInOut = (t) => (
    t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2
  );

  const resetToDefaultView = useCallback((transitionMs = RESET_TRANSITION_MS) => {
    const world = globeRef.current;
    if (!world) return;

    cancelAltitudeAnim();
    world.pointOfView(DEFAULT_POV, transitionMs);
    isCampaignFocusedRef.current = false;
    lastFocusedCampaignRef.current = null;
  }, [cancelAltitudeAnim]);

  const resetZoomToDefault = useCallback((transitionMs = RESET_TRANSITION_MS) => {
    const world = globeRef.current;
    if (!world) return;

    const pov = world.pointOfView();
    const startAlt = pov?.altitude ?? GLOBE_POV_ALTITUDE;
    const isZoomedIn = isCampaignFocusedRef.current
      || Math.abs(startAlt - GLOBE_POV_ALTITUDE) > 0.03;

    if (!isZoomedIn) return;

    cancelAltitudeAnim();
    isCampaignFocusedRef.current = false;

    const startTime = performance.now();
    const targetAlt = GLOBE_POV_ALTITUDE;

    const step = (now) => {
      const activeWorld = globeRef.current;
      if (!activeWorld) {
        altitudeAnimRef.current = null;
        return;
      }

      const progress = Math.min(1, (now - startTime) / transitionMs);
      const altitude = startAlt + (targetAlt - startAlt) * easeCubicInOut(progress);
      const current = activeWorld.pointOfView();

      activeWorld.pointOfView(
        { lat: current.lat, lng: current.lng, altitude },
        0,
      );

      if (progress < 1) {
        altitudeAnimRef.current = requestAnimationFrame(step);
      } else {
        altitudeAnimRef.current = null;
      }
    };

    altitudeAnimRef.current = requestAnimationFrame(step);
  }, [cancelAltitudeAnim]);

  const scheduleIdleRecovery = useCallback(() => {
    clearIdleTimer();
    idleTimerRef.current = window.setTimeout(() => {
      const world = globeRef.current;
      if (!world) return;

      resetToDefaultView();
      const controls = world.controls?.();
      if (controls) controls.autoRotate = true;
      idleTimerRef.current = null;
    }, AUTO_ROTATE_RESUME_MS);
  }, [clearIdleTimer, resetToDefaultView]);

  const focusOnCampaign = useCallback((campaignId) => {
    const world = globeRef.current;
    const campaign = getCampaignById(campaignId);
    if (!world || !campaign?.pointerAnchor) return;

    clearIdleTimer();

    cancelAltitudeAnim();

    const controls = world.controls?.();
    if (controls) controls.autoRotate = false;

    const { lat, lng } = campaign.pointerAnchor;
    world.pointOfView(
      {
        lat,
        lng,
        altitude: GLOBE_POV_ALTITUDE * FOCUS_ALTITUDE_FACTOR,
      },
      FOCUS_TRANSITION_MS,
    );

    isCampaignFocusedRef.current = true;
    lastFocusedCampaignRef.current = campaignId;
    scheduleIdleRecovery();
  }, [clearIdleTimer, cancelAltitudeAnim, scheduleIdleRecovery]);

  const handleSelectCampaign = useCallback((campaignId) => {
    focusOnCampaign(campaignId);
    onCampaignSelectRef.current?.(campaignId);
  }, [focusOnCampaign]);

  useEffect(() => {
    scheduleIdleRecoveryRef.current = scheduleIdleRecovery;
    resetZoomToDefaultRef.current = resetZoomToDefault;
    handleSelectCampaignRef.current = handleSelectCampaign;
  }, [scheduleIdleRecovery, resetZoomToDefault, handleSelectCampaign]);

  useEffect(() => {
    onCampaignSelectRef.current = onCampaignSelect;
  }, [onCampaignSelect]);

  useEffect(() => {
    if (!selectedCampaignId || !globeRef.current) return;
    if (selectedCampaignId === lastFocusedCampaignRef.current) return;
    focusOnCampaign(selectedCampaignId);
  }, [selectedCampaignId, focusOnCampaign]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let cancelled = false;
    let detachTheaterInteraction = () => {};

    const world = Globe()(container)
      .backgroundColor('rgba(0,0,0,0)')
      .globeImageUrl(`${CDN}/earth-dark.jpg`)
      .showAtmosphere(true)
      .atmosphereColor('#2a3346')
      .atmosphereAltitude(0.18)
      .hexPolygonResolution(3)
      .hexPolygonMargin(HEX_POLYGON_MARGIN)
      .hexPolygonAltitude(HEX_POLYGON_ALTITUDE)
      .hexPolygonUseDots(true)
      .hexPolygonColor(resolveGlobeHexColor);

    world.lights([new THREE.AmbientLight(0xffffff, Math.PI)]);

    const controls = world.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.1925;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.enableRotate = true;

    const stopAutoRotate = () => {
      controls.autoRotate = false;
      clearIdleTimer();
      resetZoomToDefaultRef.current();
    };

    const handleControlEnd = () => {
      scheduleIdleRecoveryRef.current();
    };

    controls.addEventListener('start', stopAutoRotate);
    controls.addEventListener('end', handleControlEnd);

    world.pointOfView(DEFAULT_POV);
    globeRef.current = world;

    const readyFrame = requestAnimationFrame(() => {
      if (!cancelled) setPointersReady(true);
    });

    fetch(GEOJSON_URL)
      .then((res) => res.json())
      .then((geo) => {
        if (cancelled) return;
        const rawFeatures = Array.isArray(geo?.features) ? geo.features : [];
        const theaterAreas = buildTheaterClickAreasFromRawFeatures(rawFeatures);
        const features = prepareGlobeCountryFeatures(rawFeatures);
        const occupiedCells = collectCountryHexCells(rawFeatures);
        const italyMarkers = GLOBE_EXTRA_DOTS.filter(
          (marker) => !String(marker.ISO_A3).startsWith('CY-'),
        );
        const extraFeatures = buildExtraHexFeatures(italyMarkers, occupiedCells);
        const globeFeatures = [...features, ...extraFeatures];
        world.hexPolygonsData(globeFeatures);
        requestAnimationFrame(() => {
          if (cancelled) return;
          applyUnlitMaterials(world);
          if (wrapRef.current) {
            detachTheaterInteraction = attachTheaterAreaInteraction(
              world,
              theaterAreas,
              wrapRef.current,
              (campaignId) => handleSelectCampaignRef.current?.(campaignId),
            );
          }
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

    const wrap = wrapRef.current;
    const blockWheel = (event) => {
      event.preventDefault();
    };

    wrap?.addEventListener('wheel', blockWheel, { passive: false });

    return () => {
      cancelled = true;
      wrap?.removeEventListener('wheel', blockWheel);
      detachTheaterInteraction();
      cancelAnimationFrame(readyFrame);
      setPointersReady(false);
      clearIdleTimer();
      cancelAltitudeAnim();
      controls.removeEventListener('start', stopAutoRotate);
      controls.removeEventListener('end', handleControlEnd);
      resizeObserver.disconnect();
      try {
        world._destructor?.();
      } catch (_) {
        // ignore teardown errors
      }
      globeRef.current = null;
      isCampaignFocusedRef.current = false;
      lastFocusedCampaignRef.current = null;
    };
  }, [clearIdleTimer, cancelAltitudeAnim]);

  return (
    <div ref={wrapRef} className="landing-globe-wrap">
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
