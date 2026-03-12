import { useMemo, useState, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import createGlobe from 'cobe';
import * as mgrs from 'mgrs';
import { MapContainer, TileLayer, CircleMarker, Marker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronLeft, ChevronRight, Clock3, MapPin, PersonStanding } from 'lucide-react';
import frontlineZones from '../config/frontlineZones.json';
import airports from '../config/airports';
import tankIcon from '../assets/tank-icon.svg';
import socketService from '../services/socket';
import { acceptDcsarTask, acceptMission, cancelDcsarTask, cancelMission, completeDcsarTask, completeMission, getCombatMissions, getConvoys, getDcsar, getFeed, getFrontlineZones, getMissions, getServerTime } from '../services/api';
import { buildIsoContainerPlan, formatIsoUnits } from '../utils/isoLoad';
import { useUser } from '../contexts/UserContext';

function getZoneColor(status) {
  switch (status) {
    case 'NEUTRAL':
      return 'bg-white/90 border-slate-300';
    case 'BLUE':
      return 'bg-blue-500 border-blue-400';
    case 'RED':
      return 'bg-red-500 border-red-400';
    case 'UNDER_ATTACK':
      return 'bg-orange-500 border-orange-400';
    default:
      return 'bg-slate-400 border-slate-300';
  }
}

function getStatusLabel(status) {
  switch (status) {
    case 'NEUTRAL':
      return 'Neutrale';
    case 'BLUE':
      return 'Blu';
    case 'RED':
      return 'Rosso';
    case 'UNDER_ATTACK':
      return 'Sotto attacco';
    default:
      return 'Sconosciuto';
  }
}

function getZonePriority(zone, mission) {
  if (mission?.priority) return mission.priority;
  if (zone.status === 'NEUTRAL') return 1;
  if (zone.status === 'UNDER_ATTACK') return 2;
  const tasks = Array.isArray(zone.tasks) ? zone.tasks.length : 0;
  if (tasks === 1) return 3;
  if (tasks === 2) return 4;
  if (tasks >= 3) return 5;
  return null;
}

function getPriorityLabel(priority) {
  switch (priority) {
    case 1:
      return 'P1 Massima';
    case 2:
      return 'P2 Elevata';
    case 3:
      return 'P3 Alta';
    case 4:
      return 'P4 Media';
    case 5:
      return 'P5 Bassa';
    default:
      return 'No Priority';
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return 'just now';
  const deltaMs = Date.now() - timestamp;
  const sec = Math.max(1, Math.floor(deltaMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `about ${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `about ${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `about ${days} day${days > 1 ? 's' : ''} ago`;
}

// March 13, 2026 17:00 Europe/Rome (CET, UTC+1 => 16:00 UTC)
const LAUNCH_TARGET_UTC_MS = Date.UTC(2026, 2, 13, 16, 0, 0);
// March 12, 2026 19:00 Europe/Rome (CET, UTC+1 => 18:00 UTC)
const COUNTDOWN_REVEAL_UTC_MS = Date.UTC(2026, 2, 12, 18, 0, 0);

function getCountdownParts(remainingMs) {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function formatCountdownValue(value) {
  return String(value).padStart(2, '0');
}

function getEncryptedCountdownValue(seed = 0) {
  const chars = ['X', '#', '?', '*', '@', '%', '&', '$'];
  const first = chars[Math.abs(seed) % chars.length];
  const second = chars[Math.abs(seed + 3) % chars.length];
  return `${first}${second}`;
}

function getZoneNumber(zone) {
  const source = String(zone?.id || zone?.name || '');
  const match = source.match(/\d+/);
  return match ? match[0] : source || 'Unknown';
}

function getZoneGridIndex(zone) {
  const source = String(zone?.id || zone?.name || '');
  const match = source.match(/(\d{2})(?!\d)/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value < 0 || value > 99) return null;
  return value;
}

function formatDms(value, positiveLabel, negativeLabel) {
  if (!Number.isFinite(value)) return '-';
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutesFloat = (abs - degrees) * 60;
  let minutes = Math.floor(minutesFloat);
  let seconds = Math.round((minutesFloat - minutes) * 60);

  if (seconds === 60) {
    seconds = 0;
    minutes += 1;
  }
  if (minutes === 60) {
    minutes = 0;
    degrees += 1;
  }

  const hemisphere = value >= 0 ? positiveLabel : negativeLabel;
  return `${degrees} ${minutes}'${seconds}" ${hemisphere}`;
}

function formatZoneCoordinates(coordinates, format) {
  const lat = Number(coordinates?.lat);
  const lon = Number(coordinates?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '-';

  if (format === 'mgrs') {
    try {
      return mgrs.forward([lon, lat]);
    } catch (error) {
      return 'MGRS unavailable';
    }
  }

  return `${formatDms(lat, 'N', 'S')}, ${formatDms(lon, 'E', 'W')}`;
}

function toGlobeAngles(coordinates) {
  if (!coordinates) {
    return { phi: 0, theta: 0 };
  }
  const lon = Number(coordinates.lon || 0);
  const lat = Number(coordinates.lat || 0);
  return {
    // cobe uses phi as globe rotation around vertical axis; negative lon centers the area.
    phi: (-lon * Math.PI) / 180,
    theta: (lat * Math.PI) / 180,
  };
}

function getControlText(status) {
  if (status === 'RED') return 'red control';
  if (status === 'BLUE') return 'blue control';
  if (status === 'UNDER_ATTACK') return 'contested control';
  return 'no control';
}

function getFeedTypeStyle(type) {
  if (type === 'zone.status_changed') return 'border-red-500/40 bg-red-500/10 text-red-200';
  if (type?.startsWith('logistics.')) return 'border-sky-500/40 bg-sky-500/10 text-sky-200';
  if (type?.startsWith('ato.')) return 'border-orange-500/40 bg-orange-500/10 text-orange-200';
  if (type?.startsWith('convoy.')) return 'border-yellow-500/40 bg-yellow-500/10 text-yellow-200';
  if (type?.startsWith('dcsar.')) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200';
  if (type?.startsWith('user.')) return 'border-green-500/40 bg-green-500/10 text-green-200';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
}

function getFeedTypeLabel(type) {
  if (type === 'zone.status_changed') return 'Zone';
  if (type?.startsWith('logistics.')) return 'Logistics';
  if (type?.startsWith('ato.')) return 'ATO';
  if (type?.startsWith('convoy.')) return 'Convoy';
  if (type?.startsWith('dcsar.')) return 'CSAR';
  if (type?.startsWith('user.')) return 'User';
  return 'System';
}

function getConvoyStyle(status) {
  if (status === 'arrived') {
    return {
      color: '#22c55e',
      weight: 3,
      opacity: 0.85,
      dashArray: undefined,
      markerColor: '#22c55e',
      markerRadius: 5,
      markerOpacity: 0.95,
    };
  }
  if (status === 'destroyed') {
    return {
      color: '#ef4444',
      weight: 2,
      opacity: 0.7,
      dashArray: '6,6',
      markerColor: '#ef4444',
      markerRadius: 5,
      markerOpacity: 0.9,
    };
  }
  return {
    color: '#ef4444',
    weight: 3,
    opacity: 0.9,
    dashArray: '8,5',
    markerColor: '#ef4444',
    markerRadius: 5,
    markerOpacity: 0.95,
  };
}

function getWeaponDisplayName(weaponId = '') {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

function getMissionOrders(mission) {
  if (Array.isArray(mission?.orders) && mission.orders.length > 0) {
    return mission.orders;
  }
  if (mission?.weapon_id) {
    return [{
      weapon_id: mission.weapon_id,
      quantity_needed: mission.quantity_needed,
      total_weight_lbs: mission.total_weight_lbs,
      iso_units: mission.total_iso_units,
      priority: mission.priority,
    }];
  }
  return [];
}

function getPriorityText(priority) {
  if (!priority) return 'medium';
  const val = String(priority).toLowerCase();
  if (val.includes('critical')) return 'critical';
  if (val.includes('high')) return 'high';
  if (val.includes('medium')) return 'medium';
  return val;
}

function getOrderContainers(order) {
  const isoUnits = Number(order?.iso_units || 0);
  if (Number.isFinite(isoUnits) && isoUnits > 0) {
    return Math.max(1, Math.ceil(isoUnits));
  }
  return 1;
}

function toLatLngPoint(position) {
  if (!position || typeof position !== 'object') return null;
  const lat = Number(position.lat);
  const lon = Number(position.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

function haversineNm(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const rKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = rKm * c;
  return km / 1.852;
}

function interpolateLatLon(start, end, progress) {
  if (!start || !end) return null;
  const clamped = Math.max(0, Math.min(1, progress));
  return [
    start[0] + (end[0] - start[0]) * clamped,
    start[1] + (end[1] - start[1]) * clamped,
  ];
}

function applyLateralOffset(start, end, point, offsetNm = 0.35) {
  if (!start || !end || !point) return point;
  const lat = Number(point[0]);
  const lon = Number(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return point;

  const dLat = end[0] - start[0];
  const dLon = end[1] - start[1];
  const norm = Math.hypot(dLat, dLon);
  if (norm <= 1e-9) return point;

  // Perpendicular unit vector in lat/lon degrees.
  const nLat = -dLon / norm;
  const nLon = dLat / norm;

  // Convert NM to approx degree deltas at current latitude.
  const latScale = offsetNm / 60;
  const lonScale = offsetNm / (60 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));

  return [
    lat + nLat * latScale,
    lon + nLon * lonScale,
  ];
}

function hashString(text = '') {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function computeBearingDeg(start, end) {
  if (!start || !end) return 0;
  // Great-circle initial bearing: 0=north, 90=east.
  const toRad = (deg) => (deg * Math.PI) / 180;
  const toDeg = (rad) => (rad * 180) / Math.PI;
  const lat1 = toRad(start[0]);
  const lat2 = toRad(end[0]);
  const dLon = toRad(end[1] - start[1]);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function createConvoyMovingIcon(bearingDeg) {
  // Tank SVG baseline points roughly to the right (east); flipped 180deg on request.
  const iconHeadingDeg = bearingDeg + 90;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: '30px',
        height: '30px',
        transform: `rotate(${iconHeadingDeg}deg)`,
        transformOrigin: '50% 50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <img
        src={tankIcon}
        alt="Convoy"
        style={{
          width: '28px',
          height: '28px',
          filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.75))',
        }}
      />
    </div>
  );

  return divIcon({
    html,
    className: 'convoy-moving-icon',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function createDcsarIcon(color = '#f8fafc') {
  const html = renderToStaticMarkup(
    <div
      style={{
        width: '20px',
        height: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.7))',
      }}
    >
      <PersonStanding size={18} color={color} strokeWidth={2.4} />
    </div>
  );

  return divIcon({
    html,
    className: 'dcsar-person-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function getItemQuantity(item) {
  const orderQty = Number(item.order_quantity_needed || 0);
  const orderIsoUnits = Number(item.order_iso_units || 0);
  const usedUnits = Number(item.units || 0);
  if (!Number.isFinite(orderQty) || orderQty <= 0 || !Number.isFinite(usedUnits) || usedUnits <= 0) {
    return null;
  }
  if (Number.isFinite(orderIsoUnits) && orderIsoUnits > 1) {
    return Math.floor((usedUnits / orderIsoUnits) * orderQty);
  }
  if (Number.isFinite(orderIsoUnits) && orderIsoUnits > 0 && usedUnits >= orderIsoUnits) {
    return Math.floor(orderQty);
  }
  return Math.floor(usedUnits * orderQty);
}

function GlobeCanvas({ points, focusCoordinates, onScaleChange, mapMode, forcedScale, autoSpin = false }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const phiRef = useRef(0);
  const thetaRef = useRef(0);
  const targetPhiRef = useRef(0);
  const targetThetaRef = useRef(0);
  const scaleRef = useRef(1.15);
  const targetScaleRef = useRef(1.15);
  const pointerDownRef = useRef(false);
  const pointerPosRef = useRef({ x: 0, y: 0 });
  const initializedFocusRef = useRef(false);

  useEffect(() => {
    if (!focusCoordinates) return;
    const { phi: nextPhi, theta: nextTheta } = toGlobeAngles(focusCoordinates);

    targetPhiRef.current = nextPhi;
    targetThetaRef.current = nextTheta;

    // Ensure first render starts already centered on the active theater.
    if (!initializedFocusRef.current) {
      phiRef.current = nextPhi;
      thetaRef.current = nextTheta;
      initializedFocusRef.current = true;
    }
  }, [focusCoordinates]);

  useEffect(() => {
    if (typeof forcedScale !== 'number') return;
    scaleRef.current = forcedScale;
    targetScaleRef.current = forcedScale;
  }, [forcedScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !focusCoordinates) return undefined;

    const { phi: initialPhi, theta: initialTheta } = toGlobeAngles(focusCoordinates);
    if (!initializedFocusRef.current) {
      phiRef.current = initialPhi;
      thetaRef.current = initialTheta;
      targetPhiRef.current = initialPhi;
      targetThetaRef.current = initialTheta;
      initializedFocusRef.current = true;
    }

    const onPointerDown = (event) => {
      pointerDownRef.current = true;
      pointerPosRef.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerMove = (event) => {
      if (!pointerDownRef.current) return;
      const deltaX = event.clientX - pointerPosRef.current.x;
      const deltaY = event.clientY - pointerPosRef.current.y;
      pointerPosRef.current = { x: event.clientX, y: event.clientY };
      targetPhiRef.current += deltaX * 0.006;
      targetThetaRef.current = Math.max(-0.75, Math.min(0.75, targetThetaRef.current + deltaY * 0.006));
    };

    const onPointerUp = () => {
      pointerDownRef.current = false;
    };

    const onWheel = (event) => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.06 : 0.06;
      targetScaleRef.current = Math.max(0.7, Math.min(3.2, targetScaleRef.current + delta));
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('wheel', onWheel, { passive: false });

    let width = Math.max(320, container.offsetWidth);
    let height = Math.max(320, container.offsetHeight);
    setCanvasDimensions({ width, height });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: width * dpr,
      height: height * dpr,
      phi: phiRef.current,
      theta: thetaRef.current,
      scale: scaleRef.current,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 2.5,
      baseColor: [0.12, 0.15, 0.18],
      markerColor: [0.85, 0.23, 0.23],
      glowColor: [0.16, 0.22, 0.28],
      markers: points.map((point) => ({
        location: [point.lat, point.lon],
        size: point.size,
      })),
      onRender: (state) => {
        if (autoSpin && !pointerDownRef.current) {
          targetPhiRef.current += 0.0016;
        }
        phiRef.current += (targetPhiRef.current - phiRef.current) * 0.08;
        thetaRef.current += (targetThetaRef.current - thetaRef.current) * 0.08;
        scaleRef.current += (targetScaleRef.current - scaleRef.current) * 0.18;
        if (!mapMode && onScaleChange) onScaleChange(scaleRef.current);
        state.phi = phiRef.current;
        state.theta = thetaRef.current;
        state.scale = scaleRef.current;
        state.width = Math.max(320, width) * dpr;
        state.height = Math.max(320, height) * dpr;
      },
    });

    const updateSize = () => {
      width = Math.max(320, container.offsetWidth);
      height = Math.max(320, container.offsetHeight);
      setCanvasDimensions({ width, height });
    };

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });
    resizeObserver.observe(container);
    window.addEventListener('resize', updateSize);

    // Handle the globe remount case after 2D->3D transition.
    const rafId = window.requestAnimationFrame(updateSize);

    return () => {
      globe.destroy();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(rafId);
    };
  }, [points, onScaleChange, mapMode, focusCoordinates, autoSpin]);

  const zoomIn = () => {
    targetScaleRef.current = Math.min(3.2, targetScaleRef.current + 0.16);
  };

  const zoomOut = () => {
    targetScaleRef.current = Math.max(0.7, targetScaleRef.current - 0.16);
  };

  const resetZoom = () => {
    targetScaleRef.current = 1.15;
  };

  return (
    <div ref={containerRef} className="relative flex h-full w-full items-center justify-center overflow-hidden">
      <canvas
        ref={canvasRef}
        className="cursor-grab active:cursor-grabbing"
        style={{
          width: `${canvasDimensions.width}px`,
          height: `${canvasDimensions.height}px`,
          display: 'block',
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-yt-border/80 bg-yt-bg-secondary/80 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">
        3D Strategic Globe
      </div>
      <div className="absolute right-3 top-3 flex gap-1.5">
        <button
          type="button"
          onClick={zoomOut}
          className="h-8 w-8 rounded-md border border-yt-border bg-yt-bg-secondary/90 text-sm font-semibold text-yt-text-primary transition-colors hover:border-yt-accent"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={zoomIn}
          className="h-8 w-8 rounded-md border border-yt-border bg-yt-bg-secondary/90 text-sm font-semibold text-yt-text-primary transition-colors hover:border-yt-accent"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="rounded-md border border-yt-border bg-yt-bg-secondary/90 px-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-yt-text-secondary transition-colors hover:border-yt-accent hover:text-yt-text-primary"
          aria-label="Reset zoom"
        >
          RST
        </button>
      </div>
    </div>
  );
}

function FlatMapFocus({ center }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    map.setView([center.lat, center.lon], Math.max(map.getZoom(), 8), {
      animate: true,
      duration: 0.7,
    });
  }, [center, map]);

  return null;
}

function FlatMapZoomWatcher({ onZoomChange }) {
  const map = useMapEvents({
    zoomend: () => {
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);

  return null;
}

function FlatMapView({
  zones,
  airportsData,
  logisticsMissions,
  gridConnections,
  convoys,
  dcsarPoints,
  selectedZoneId,
  onZoneSelect,
  focusCoordinates,
  onZoomChange,
  onZoneHover,
  onAirportClick,
  showAto,
  showAirports,
  showLogistics,
  showConvoys,
  showDcsar,
  onDcsarHover,
  onDcsarSelect,
  animationTick,
}) {
  const center = focusCoordinates || { lat: 35.5, lon: 37.5 };
  const airportsById = useMemo(() => {
    const map = new Map();
    airportsData.forEach((airport) => map.set(airport.id, airport));
    return map;
  }, [airportsData]);

  return (
    <div className="h-full w-full">
      <MapContainer
        center={[center.lat, center.lon]}
        zoom={7}
        minZoom={4}
        maxZoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <FlatMapZoomWatcher onZoomChange={onZoomChange} />
        <FlatMapFocus center={focusCoordinates} />

        {showAto && gridConnections.map((connection) => (
          <Polyline
            key={connection.id}
            positions={connection.positions}
            pathOptions={{
              color: '#9aaec4',
              weight: 1,
              opacity: 0.22,
              dashArray: '3,7',
              interactive: false,
            }}
          />
        ))}

        {showLogistics && logisticsMissions.map((mission) => {
          const sourceAirport = airportsById.get(mission.source_airport_id);
          const destinationAirport = airportsById.get(mission.airport_id);
          if (!sourceAirport || !destinationAirport) return null;

          return (
            <Polyline
              key={`route-${mission.id}`}
              positions={[
                [sourceAirport.coordinates.lat, sourceAirport.coordinates.lon],
                [destinationAirport.coordinates.lat, destinationAirport.coordinates.lon],
              ]}
              pathOptions={{
                color: mission.status === 'accepted' ? '#f97316' : '#4ec5ff',
                weight: mission.status === 'accepted' ? 3 : 2,
                opacity: 0.85,
                dashArray: mission.status === 'pending' ? '8,6' : undefined,
              }}
            >
              <Tooltip direction="center" opacity={0.9}>
                {(sourceAirport.displayName || sourceAirport.name)} {' -> '} {(destinationAirport.displayName || destinationAirport.name)}
              </Tooltip>
            </Polyline>
          );
        })}

        {showConvoys && convoys.map((convoy) => {
          const style = getConvoyStyle(convoy.status);
          const layers = [];
          if (Array.isArray(convoy.routeLine) && convoy.routeLine.length >= 2) {
            layers.push(
              <Polyline
                key={`convoy-route-${convoy.convoy_id}`}
                positions={convoy.routeLine}
                pathOptions={{
                  color: style.color,
                  weight: style.weight,
                  opacity: style.opacity,
                  dashArray: style.dashArray,
                  interactive: false,
                }}
              />
            );
          }

          const markerPosition = convoy.movingPosition || convoy.lastPosition || null;
          if (markerPosition) {
            layers.push(
              <Marker
                key={`convoy-marker-${convoy.convoy_id}`}
                position={markerPosition}
                icon={createConvoyMovingIcon(convoy.bearing || 0)}
                interactive={false}
              >
                <Tooltip direction="top" offset={[0, -3]} opacity={0.95}>
                  Convoy {convoy.convoy_id} ({convoy.status})
                </Tooltip>
              </Marker>
            );
          }

          return layers;
        })}

        {showDcsar && dcsarPoints.flatMap((point) => {
          const isAccepted = point.status === 'accepted' || point.accepted === true;
          const pulseCycleMs = 1800;
          const offset = hashString(point.id || 'dcsar') % pulseCycleMs;
          const phase = ((animationTick + offset) % pulseCycleMs) / pulseCycleMs;
          const pulseRadius = 9 + phase * 8;
          const pulseOpacity = (1 - phase) * (isAccepted ? 0.35 : 0.45);
          const iconColor = isAccepted ? '#22c55e' : '#f8fafc';
          const nearestAirport = point.nearest_airbase;
          const lineLayers = [];

          if (nearestAirport?.coordinates) {
            lineLayers.push(
              <Polyline
                key={`dcsar-link-${point.id}`}
                positions={[
                  [point.lat, point.lon],
                  [nearestAirport.coordinates.lat, nearestAirport.coordinates.lon],
                ]}
                pathOptions={{
                  color: isAccepted ? '#22c55e' : '#ffffff',
                  weight: isAccepted ? 2.8 : 2.2,
                  opacity: 0.9,
                  dashArray: isAccepted ? undefined : '7,7',
                }}
                interactive={false}
              />
            );
          }

          return [
            ...lineLayers,
            <CircleMarker
              key={`dcsar-pulse-${point.id}`}
              center={[point.lat, point.lon]}
              radius={pulseRadius}
              pathOptions={{
                color: isAccepted ? '#22c55e' : '#ffffff',
                fillColor: isAccepted ? '#22c55e' : '#ffffff',
                fillOpacity: pulseOpacity * 0.35,
                opacity: pulseOpacity,
                weight: 1.8,
              }}
              interactive={false}
            />,
            <Marker
              key={`dcsar-${point.id}`}
              position={[point.lat, point.lon]}
              icon={createDcsarIcon(iconColor)}
              eventHandlers={{
                mouseover: () => onDcsarHover && onDcsarHover(point.id),
                mouseout: () => onDcsarHover && onDcsarHover(null),
                click: () => onDcsarSelect && onDcsarSelect(point),
              }}
            >
              <Tooltip direction="top" offset={[0, -3]} opacity={0.95}>
                {nearestAirport?.name
                  ? `CSAR ${point.id} -> ${nearestAirport.name}`
                  : `CSAR ${point.id}`}
              </Tooltip>
            </Marker>,
          ];
        })}

        {showAto && zones.map((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const color =
            zone.status === 'RED'
              ? '#ef4444'
              : zone.status === 'BLUE'
                ? '#3b82f6'
                : zone.status === 'UNDER_ATTACK'
                  ? '#f97316'
                  : '#e2e8f0';

          return (
            <CircleMarker
              key={zone.id}
              center={[zone.coordinates.lat, zone.coordinates.lon]}
              radius={isSelected ? 9 : 6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isSelected ? 0.9 : 0.65,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onZoneSelect(zone.id),
                mouseover: () => onZoneHover(zone.id),
                mouseout: () => onZoneHover(null),
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                {zone.name || zone.zone_name || zone.id}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {showAirports && airportsData.map((airport) => (
          <CircleMarker
            key={airport.id}
            center={[airport.coordinates.lat, airport.coordinates.lon]}
            radius={airport.isMainBase ? 6 : 4}
            pathOptions={{
              color: airport.isMainBase ? '#4ec5ff' : '#6ea3c8',
              fillColor: airport.isMainBase ? '#4ec5ff' : '#6ea3c8',
              fillOpacity: 0.85,
              weight: 2,
            }}
            eventHandlers={{
              click: () => onAirportClick && onAirportClick(airport.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              {airport.displayName}
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
}

export default function FrontlineMap({ airportsData }) {
  const { user } = useUser();
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [hoveredDcsarId, setHoveredDcsarId] = useState(null);
  const [selectedDcsarId, setSelectedDcsarId] = useState(null);
  const [zoneCoordinatesFormat, setZoneCoordinatesFormat] = useState('dms');
  const [dcsarCoordinatesFormat, setDcsarCoordinatesFormat] = useState('dms');
  const [selectedAirportId, setSelectedAirportId] = useState(null);
  const [selectedLogisticsMission, setSelectedLogisticsMission] = useState(null);
  const [acceptingMissionId, setAcceptingMissionId] = useState(null);
  const [acceptingDcsarId, setAcceptingDcsarId] = useState(null);
  const [updatingDcsarId, setUpdatingDcsarId] = useState(null);
  const [updatingMissionId, setUpdatingMissionId] = useState(null);
  const [animationTick, setAnimationTick] = useState(Date.now());
  const [zones, setZones] = useState(frontlineZones);
  const [combatMissions, setCombatMissions] = useState([]);
  const [logisticsMissions, setLogisticsMissions] = useState([]);
  const [convoys, setConvoys] = useState([]);
  const [dcsarPoints, setDcsarPoints] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [zoneStatusMeta, setZoneStatusMeta] = useState({});
  const [mapMode, setMapMode] = useState(false);
  const [forcedGlobeScale, setForcedGlobeScale] = useState(null);
  const [launchTargetUtcMs, setLaunchTargetUtcMs] = useState(LAUNCH_TARGET_UTC_MS);
  const [serverClockBase, setServerClockBase] = useState(null);
  const [countdownTick, setCountdownTick] = useState(0);
  const [scrambleTick, setScrambleTick] = useState(0);
  const [filters, setFilters] = useState({
    control: 'all',
    atoMissionStatus: 'all',
    logisticsStatus: 'all',
    priority: 'all',
    task: 'all',
    activity: 'all',
    showAto: true,
    showLogistics: true,
    showAirports: true,
    showConvoys: true,
    showDcsar: true,
  });
  const mapModeRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getFrontlineZones(), getCombatMissions(), getMissions(), getFeed(200), getConvoys(), getDcsar()])
      .then(([zonesResult, combatResult, logisticsResult, feedResult, convoysResult, dcsarResult]) => {
        if (!isMounted) return;

        if (zonesResult.status === 'fulfilled') {
          const nextZones = zonesResult.value?.zones || zonesResult.value;
          if (Array.isArray(nextZones)) {
            setZones(nextZones);
          }
        } else {
          console.error('Failed to load frontline zones:', zonesResult.reason);
        }

        if (combatResult.status === 'fulfilled') {
          if (Array.isArray(combatResult.value)) {
            setCombatMissions(combatResult.value);
          }
        } else {
          console.error('Failed to load combat missions:', combatResult.reason);
        }

        if (logisticsResult.status === 'fulfilled') {
          if (Array.isArray(logisticsResult.value)) {
            setLogisticsMissions(logisticsResult.value);
          }
        } else {
          console.error('Failed to load logistics missions:', logisticsResult.reason);
        }

        if (feedResult.status === 'fulfilled') {
          const nextFeed = feedResult.value?.events || feedResult.value;
          if (Array.isArray(nextFeed)) {
            setFeedEvents(nextFeed);
          }
        } else {
          console.error('Failed to load feed events:', feedResult.reason);
        }

        if (convoysResult.status === 'fulfilled') {
          const nextConvoys = convoysResult.value?.convoys || convoysResult.value;
          if (Array.isArray(nextConvoys)) {
            setConvoys(nextConvoys);
          }
        } else {
          console.error('Failed to load convoys:', convoysResult.reason);
        }

        if (dcsarResult.status === 'fulfilled') {
          const nextPoints = dcsarResult.value?.points || dcsarResult.value;
          if (Array.isArray(nextPoints)) {
            setDcsarPoints(nextPoints);
          }
        } else {
          console.error('Failed to load DCSAR points:', dcsarResult.reason);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const unsubscribe = socketService.on('frontline:updated', (data) => {
      const nextZones = data?.zones || data;
      if (Array.isArray(nextZones)) {
        setZones(nextZones);
      }
    });

    const unsubscribeMissions = socketService.on('combat-missions:updated', (data) => {
      if (data?.missions && Array.isArray(data.missions)) {
        setCombatMissions(data.missions);
      }
    });

    const unsubscribeLogistics = socketService.on('missions:updated', (data) => {
      if (data?.missions && Array.isArray(data.missions)) {
        setLogisticsMissions(data.missions);
      }
    });

    const unsubscribeFeed = socketService.on('feed:updated', (data) => {
      const nextFeed = data?.events || data;
      if (Array.isArray(nextFeed)) {
        setFeedEvents(nextFeed);
      }
    });

    const unsubscribeConvoys = socketService.on('convoys:updated', (data) => {
      const nextConvoys = data?.convoys || data;
      if (Array.isArray(nextConvoys)) {
        setConvoys(nextConvoys);
      }
    });

    const unsubscribeDcsar = socketService.on('dcsar:updated', (data) => {
      const nextPoints = data?.points || data;
      if (Array.isArray(nextPoints)) {
        setDcsarPoints(nextPoints);
      }
    });

    return () => {
      unsubscribe && unsubscribe();
      unsubscribeMissions && unsubscribeMissions();
      unsubscribeLogistics && unsubscribeLogistics();
      unsubscribeFeed && unsubscribeFeed();
      unsubscribeConvoys && unsubscribeConvoys();
      unsubscribeDcsar && unsubscribeDcsar();
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latest = await getMissions();
        if (Array.isArray(latest)) {
          setLogisticsMissions(latest);
        }
      } catch (error) {
        console.error('Failed to refresh logistics missions:', error);
      }
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latestFeed = await getFeed(200);
        const nextFeed = latestFeed?.events || latestFeed;
        if (Array.isArray(nextFeed)) {
          setFeedEvents(nextFeed);
        }
      } catch (error) {
        console.error('Failed to refresh feed events:', error);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latestConvoys = await getConvoys();
        const nextConvoys = latestConvoys?.convoys || latestConvoys;
        if (Array.isArray(nextConvoys)) {
          setConvoys(nextConvoys);
        }
      } catch (error) {
        console.error('Failed to refresh convoys:', error);
      }
    }, 20000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const latestPoints = await getDcsar();
        const nextPoints = latestPoints?.points || latestPoints;
        if (Array.isArray(nextPoints)) {
          setDcsarPoints(nextPoints);
        }
      } catch (error) {
        console.error('Failed to refresh DCSAR points:', error);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationTick(Date.now());
    }, 120);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const syncServerClock = async () => {
      try {
        const payload = await getServerTime();
        if (!isMounted) return;

        const serverNowMs = Number(payload?.serverNowMs);
        const serverLaunchTarget = Number(payload?.launchTargetUtcMs);
        if (Number.isFinite(serverLaunchTarget)) {
          setLaunchTargetUtcMs(serverLaunchTarget);
        }
        if (Number.isFinite(serverNowMs)) {
          setServerClockBase({
            serverNowMs,
            perfNowMs: performance.now(),
          });
        }
      } catch (error) {
        console.error('Failed to sync server time for countdown:', error);
      }
    };

    syncServerClock();
    const interval = setInterval(syncServerClock, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownTick((value) => value + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setScrambleTick((value) => value + 1);
    }, 90);

    return () => clearInterval(interval);
  }, []);

  const effectiveServerNowMs = useMemo(() => {
    if (!serverClockBase) return Date.now();
    return serverClockBase.serverNowMs + (performance.now() - serverClockBase.perfNowMs);
  }, [serverClockBase, countdownTick]);

  const countdownRemainingMs = Math.max(0, launchTargetUtcMs - effectiveServerNowMs);
  const isPreLaunchCountdownActive = countdownRemainingMs > 0;
  const isCountdownEncrypted = effectiveServerNowMs < COUNTDOWN_REVEAL_UTC_MS;
  const countdownParts = useMemo(() => getCountdownParts(countdownRemainingMs), [countdownRemainingMs]);
  const countdownDisplay = useMemo(() => {
    if (!isCountdownEncrypted) {
      return {
        hours: formatCountdownValue(countdownParts.hours),
        minutes: formatCountdownValue(countdownParts.minutes),
        seconds: formatCountdownValue(countdownParts.seconds),
      };
    }

    return {
      hours: getEncryptedCountdownValue(scrambleTick + 7),
      minutes: getEncryptedCountdownValue(scrambleTick + 13),
      seconds: getEncryptedCountdownValue(scrambleTick + 19),
    };
  }, [isCountdownEncrypted, countdownParts, countdownTick, scrambleTick]);

  useEffect(() => {
    if (!isPreLaunchCountdownActive) return;
    if (mapModeRef.current || mapMode) {
      mapModeRef.current = false;
      setMapMode(false);
    }
  }, [isPreLaunchCountdownActive, mapMode]);

  const validZones = useMemo(
    () => zones.filter((zone) => zone.coordinates && Number.isFinite(zone.coordinates.lat) && Number.isFinite(zone.coordinates.lon)),
    [zones]
  );

  const validAirports = useMemo(() => {
    const airportsList = Array.isArray(airportsData) ? airportsData : airports;
    return airportsList.filter((airport) => airport.coordinates && airport.isActive !== false);
  }, [airportsData]);

  const combatMissionByZone = useMemo(() => {
    const map = new Map();
    combatMissions.forEach((mission) => {
      if (mission?.zone_id) {
        map.set(mission.zone_id, mission);
      }
    });
    return map;
  }, [combatMissions]);

  const gridConnections = useMemo(() => {
    const zoneByIndex = new Map();

    validZones.forEach((zone) => {
      const index = getZoneGridIndex(zone);
      if (index === null || !zone?.coordinates) return;
      zoneByIndex.set(index, zone);
    });

    const links = [];
    zoneByIndex.forEach((zone, index) => {
      const row = Math.floor(index / 10);
      const col = index % 10;
      const rightIndex = col < 9 ? index + 1 : null;
      const downIndex = row < 9 ? index + 10 : null;

      if (rightIndex !== null && zoneByIndex.has(rightIndex)) {
        const target = zoneByIndex.get(rightIndex);
        links.push({
          id: `grid-${index}-${rightIndex}`,
          positions: [
            [zone.coordinates.lat, zone.coordinates.lon],
            [target.coordinates.lat, target.coordinates.lon],
          ],
        });
      }

      if (downIndex !== null && zoneByIndex.has(downIndex)) {
        const target = zoneByIndex.get(downIndex);
        links.push({
          id: `grid-${index}-${downIndex}`,
          positions: [
            [zone.coordinates.lat, zone.coordinates.lon],
            [target.coordinates.lat, target.coordinates.lon],
          ],
        });
      }
    });

    return links;
  }, [validZones]);

  const zoneCoordinatesById = useMemo(() => {
    const map = new Map();
    validZones.forEach((zone) => {
      if (zone?.id && zone?.coordinates) {
        map.set(zone.id, zone.coordinates);
      }
    });
    return map;
  }, [validZones]);

  const convoyRenderData = useMemo(() => {
    return convoys
      .filter((convoy) => (convoy?.status || 'active') === 'active')
      .map((convoy) => {
      const originPosition = zoneCoordinatesById.get(convoy.origin_zone) || convoy.origin_position || null;
      const destinationPosition = zoneCoordinatesById.get(convoy.destination_zone) || convoy.destination_position || null;
      const originPoint = toLatLngPoint(originPosition);
      const destinationPoint = toLatLngPoint(destinationPosition);
      const routeLine = originPoint && destinationPoint ? [originPoint, destinationPoint] : [];
      const bearing = routeLine.length >= 2 ? computeBearingDeg(routeLine[0], routeLine[1]) : 0;
      const lastPosition = toLatLngPoint(convoy.last_position) || destinationPoint || originPoint || null;

      let movingPosition = null;
      if ((convoy.status || 'active') === 'active' && routeLine.length >= 2) {
        const cycleMs = 18000;
        const offset = hashString(convoy.convoy_id || 'convoy') % cycleMs;
        const progress = ((animationTick + offset) % cycleMs) / cycleMs;
        const interpolated = interpolateLatLon(routeLine[0], routeLine[1], progress);
        movingPosition = applyLateralOffset(routeLine[0], routeLine[1], interpolated, 0.5);
      } else if (convoy.status === 'arrived' && destinationPoint) {
        movingPosition = routeLine.length >= 2
          ? applyLateralOffset(routeLine[0], routeLine[1], destinationPoint, 0.5)
          : destinationPoint;
      } else if (convoy.status === 'destroyed') {
        const destroyedPos = toLatLngPoint(convoy.last_position) || originPoint;
        movingPosition = routeLine.length >= 2
          ? applyLateralOffset(routeLine[0], routeLine[1], destroyedPos, 0.5)
          : destroyedPos;
      }

      return {
        convoy_id: convoy.convoy_id,
        status: convoy.status || 'active',
        routeLine,
        bearing,
        movingPosition,
        lastPosition,
      };
    }).filter((convoy) => convoy.routeLine.length >= 2 || convoy.movingPosition || convoy.lastPosition);
  }, [convoys, zoneCoordinatesById, animationTick]);

  useEffect(() => {
    if (validZones.length === 0) return;
    setZoneStatusMeta((previous) => {
      const now = Date.now();
      const next = { ...previous };

      validZones.forEach((zone) => {
        const current = previous[zone.id];
        if (!current) {
          next[zone.id] = {
            status: zone.status,
            changedAt: now,
          };
          return;
        }

        if (current.status !== zone.status) {
          next[zone.id] = {
            status: zone.status,
            changedAt: now,
          };
        }
      });

      return next;
    });
  }, [validZones]);

  const filteredZones = useMemo(() => {
    return validZones.filter((zone) => {
      const mission = combatMissionByZone.get(zone.id);
      const priority = getZonePriority(zone, mission);
      const taskSet = new Set([...(zone.tasks || []), ...(mission?.tasks || [])]);

      if (filters.control !== 'all' && zone.status !== filters.control) return false;
      if (filters.atoMissionStatus !== 'all' && mission?.mission_status !== filters.atoMissionStatus) return false;
      if (filters.priority !== 'all' && Number(filters.priority) !== Number(priority)) return false;
      if (filters.task !== 'all' && !taskSet.has(filters.task)) return false;
      if (filters.activity === 'active' && !zone.isActive) return false;
      if (filters.activity === 'inactive' && zone.isActive) return false;

      return true;
    });
  }, [validZones, combatMissionByZone, filters]);

  const filteredLogisticsMissions = useMemo(() => {
    return logisticsMissions.filter((mission) => {
      if (!mission?.airport_id || !mission?.source_airport_id) return false;
      if (mission.status !== 'pending' && mission.status !== 'accepted') return false;
      if (filters.logisticsStatus !== 'all' && mission.status !== filters.logisticsStatus) return false;
      return true;
    });
  }, [logisticsMissions, filters.logisticsStatus]);

  const focusedZone = useMemo(
    () => (selectedZoneId ? filteredZones.find((zone) => zone.id === selectedZoneId) || validZones.find((zone) => zone.id === selectedZoneId) || null : null),
    [selectedZoneId, filteredZones, validZones]
  );

  const selectedZone = useMemo(() => {
    const id = hoveredZoneId || selectedZoneId;
    return id ? filteredZones.find((zone) => zone.id === id) || validZones.find((zone) => zone.id === id) || null : null;
  }, [hoveredZoneId, selectedZoneId, filteredZones, validZones]);

  const airportsById = useMemo(() => {
    const map = new Map();
    validAirports.forEach((airport) => map.set(airport.id, airport));
    return map;
  }, [validAirports]);

  const overlayTagOptions = useMemo(
    () => [
      { label: 'All', value: 'all' },
      { label: 'Red', value: 'RED' },
      { label: 'Blue', value: 'BLUE' },
      { label: 'Neutral', value: 'NEUTRAL' },
      { label: 'Under Attack', value: 'UNDER_ATTACK' },
    ],
    []
  );

  const missionStatusOptions = useMemo(
    () => [
      { label: 'ATO Any', value: 'all' },
      { label: 'Available', value: 'available' },
      { label: 'Assigned', value: 'assigned' },
    ],
    []
  );

  const logisticsStatusOptions = useMemo(
    () => [
      { label: 'LOG Any', value: 'all' },
      { label: 'Pending', value: 'pending' },
      { label: 'Accepted', value: 'accepted' },
    ],
    []
  );

  const priorityOptions = useMemo(
    () => [
      { label: 'Any Priority', value: 'all' },
      { label: 'P1', value: '1' },
      { label: 'P2', value: '2' },
      { label: 'P3', value: '3' },
      { label: 'P4', value: '4' },
      { label: 'P5', value: '5' },
    ],
    []
  );

  const globePoints = useMemo(() => {
    const zonePoints = filters.showAto ? filteredZones.map((zone) => ({
      lat: zone.coordinates.lat,
      lon: zone.coordinates.lon,
      size: zone.id === selectedZoneId ? 0.14 : zone.isActive ? 0.1 : 0.07,
    })) : [];
    const airportPoints = filters.showAirports ? validAirports.map((airport) => ({
      lat: airport.coordinates.lat,
      lon: airport.coordinates.lon,
      size: airport.isMainBase ? 0.11 : 0.08,
    })) : [];
    return [...zonePoints, ...airportPoints];
  }, [filteredZones, validAirports, selectedZoneId, filters.showAto, filters.showAirports]);

  const zoneTheaterCenter = useMemo(() => {
    if (validZones.length === 0) return null;
    const sum = validZones.reduce(
      (acc, item) => ({
        lat: acc.lat + item.coordinates.lat,
        lon: acc.lon + item.coordinates.lon,
      }),
      { lat: 0, lon: 0 }
    );
    return { lat: sum.lat / validZones.length, lon: sum.lon / validZones.length };
  }, [validZones]);

  const fallbackCenter = useMemo(() => {
    if (validAirports.length === 0) return null;
    const sum = validAirports.reduce(
      (acc, item) => ({
        lat: acc.lat + item.coordinates.lat,
        lon: acc.lon + item.coordinates.lon,
      }),
      { lat: 0, lon: 0 }
    );
    return { lat: sum.lat / validAirports.length, lon: sum.lon / validAirports.length };
  }, [validAirports, validZones]);

  const selectedDcsarFocus = useMemo(() => {
    if (!selectedDcsarId) return null;
    const point = dcsarPoints.find((entry) => String(entry?.id || '') === String(selectedDcsarId));
    if (!point) return null;
    const lat = Number(point?.lat);
    const lon = Number(point?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }, [selectedDcsarId, dcsarPoints]);

  const focusCoordinates = selectedDcsarFocus || focusedZone?.coordinates || zoneTheaterCenter || fallbackCenter || null;

  const handleScaleChange = (scale) => {
    if (scale >= 2.1 && !mapModeRef.current) {
      mapModeRef.current = true;
      setMapMode(true);
      return;
    }

    if (scale <= 1.85 && mapModeRef.current) {
      mapModeRef.current = false;
      setMapMode(false);
    }
  };

  const handleFlatMapZoomChange = (zoom) => {
    if (zoom <= 5 && mapModeRef.current) {
      mapModeRef.current = false;
      setMapMode(false);
      setForcedGlobeScale(1.6);
      setTimeout(() => setForcedGlobeScale(null), 250);
    }
  };

  const selectedMission = selectedZone ? combatMissionByZone.get(selectedZone.id) : null;
  const selectedPriority = selectedZone ? getZonePriority(selectedZone, selectedMission) : null;
  const selectedChangedAt = selectedZone ? zoneStatusMeta[selectedZone.id]?.changedAt : null;
  const selectedTags = selectedZone
    ? [
        getStatusLabel(selectedZone.status),
        selectedMission?.mission_status ? `Mission ${selectedMission.mission_status}` : 'No Mission',
        selectedPriority ? getPriorityLabel(selectedPriority) : null,
        selectedZone.isActive ? 'Active' : 'Inactive',
        ...new Set([...(selectedZone.tasks || []), ...(selectedMission?.tasks || [])]),
      ].filter(Boolean)
    : [];
  const selectedZoneCoordinates = selectedZone
    ? formatZoneCoordinates(selectedZone.coordinates, zoneCoordinatesFormat)
    : '-';

  const airportLogistics = useMemo(() => {
    if (!selectedAirportId) return [];
    return filteredLogisticsMissions.filter((mission) => mission.airport_id === selectedAirportId);
  }, [selectedAirportId, filteredLogisticsMissions]);

  const selectedAirport = selectedAirportId ? airportsById.get(selectedAirportId) : null;
  const dcsarPointsWithNearest = useMemo(() => {
    return dcsarPoints
      .map((point, index) => {
        const lat = Number(point?.lat);
        const lon = Number(point?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

        let nearestAirport = null;
        let nearestDistanceNm = Number.POSITIVE_INFINITY;

        validAirports.forEach((airport) => {
          const airportLat = Number(airport?.coordinates?.lat);
          const airportLon = Number(airport?.coordinates?.lon);
          if (!Number.isFinite(airportLat) || !Number.isFinite(airportLon)) return;
          const distanceNm = haversineNm(lat, lon, airportLat, airportLon);
          if (distanceNm < nearestDistanceNm) {
            nearestDistanceNm = distanceNm;
            nearestAirport = {
              id: airport.id,
              name: airport.displayName || airport.name || airport.id,
              coordinates: {
                lat: airportLat,
                lon: airportLon,
              },
            };
          }
        });

        const statusRaw = String(point?.status || '').toLowerCase();
        const accepted = point?.accepted === true || statusRaw === 'accepted' || Boolean(point?.accepted_by);

        return {
          ...point,
          id: point?.id || `dcsar_${index + 1}`,
          lat,
          lon,
          status: accepted ? 'accepted' : 'pending',
          accepted,
          nearest_airbase: nearestAirport,
          nearest_distance_nm: Number.isFinite(nearestDistanceNm) ? nearestDistanceNm : null,
        };
      })
      .filter(Boolean);
  }, [dcsarPoints, validAirports]);
  const hoveredDcsarPoint = useMemo(() => {
    if (!hoveredDcsarId) return null;
    return dcsarPointsWithNearest.find((point) => point.id === hoveredDcsarId) || null;
  }, [hoveredDcsarId, dcsarPointsWithNearest]);
  const selectedDcsarTask = useMemo(() => {
    if (!selectedDcsarId) return null;
    return dcsarPointsWithNearest.find((point) => point.id === selectedDcsarId) || null;
  }, [selectedDcsarId, dcsarPointsWithNearest]);
  const logisticsDetailOrders = selectedLogisticsMission ? getMissionOrders(selectedLogisticsMission) : [];
  const logisticsDetailIsoPlan = useMemo(
    () => (selectedLogisticsMission ? buildIsoContainerPlan(logisticsDetailOrders) : null),
    [selectedLogisticsMission, logisticsDetailOrders]
  );

  useEffect(() => {
    if (!filters.showLogistics) {
      setSelectedAirportId(null);
      setSelectedLogisticsMission(null);
    }
  }, [filters.showLogistics]);

  useEffect(() => {
    if (!filters.showAto) {
      setHoveredZoneId(null);
    }
  }, [filters.showAto]);

  useEffect(() => {
    if (!filters.showDcsar) {
      setHoveredDcsarId(null);
      setSelectedDcsarId(null);
    }
  }, [filters.showDcsar]);

  useEffect(() => {
    setZoneCoordinatesFormat('dms');
  }, [selectedZone?.id]);

  useEffect(() => {
    setDcsarCoordinatesFormat('dms');
  }, [hoveredDcsarPoint?.id]);

  useEffect(() => {
    if (!selectedLogisticsMission?.id) return;
    const next = logisticsMissions.find((mission) => mission.id === selectedLogisticsMission.id) || null;
    setSelectedLogisticsMission(next);
  }, [logisticsMissions, selectedLogisticsMission?.id]);

  const handleAcceptLogisticsMission = async (mission) => {
    if (!mission || mission.status !== 'pending') return;
    if (!user) {
      window.location.href = '/api/auth/discord';
      return;
    }

    const userName = user.globalName || user.username || user.id;
    setAcceptingMissionId(mission.id);
    try {
      await acceptMission(mission.id, userName);
      const latest = await getMissions();
      if (Array.isArray(latest)) {
        setLogisticsMissions(latest);
        const refreshed = latest.find((entry) => entry.id === mission.id) || null;
        setSelectedLogisticsMission(refreshed);
      }
    } catch (error) {
      console.error('Failed to accept logistics mission:', error);
      alert(`Failed to accept mission: ${error.message}`);
    } finally {
      setAcceptingMissionId(null);
    }
  };

  const handleCompleteLogisticsMission = async (mission) => {
    if (!mission || mission.status !== 'accepted') return;
    const userName = user?.globalName || user?.username || user?.id;
    if (!userName || mission.accepted_by !== userName) return;

    setUpdatingMissionId(mission.id);
    try {
      await completeMission(mission.id);
      const latest = await getMissions();
      if (Array.isArray(latest)) {
        setLogisticsMissions(latest);
        setSelectedLogisticsMission(latest.find((entry) => entry.id === mission.id) || null);
      }
    } catch (error) {
      console.error('Failed to complete logistics mission:', error);
      alert(`Failed to complete mission: ${error.message}`);
    } finally {
      setUpdatingMissionId(null);
    }
  };

  const handleCancelLogisticsMission = async (mission) => {
    if (!mission || mission.status !== 'accepted') return;
    const userName = user?.globalName || user?.username || user?.id;
    if (!userName || mission.accepted_by !== userName) return;

    setUpdatingMissionId(mission.id);
    try {
      await cancelMission(mission.id);
      const latest = await getMissions();
      if (Array.isArray(latest)) {
        setLogisticsMissions(latest);
        setSelectedLogisticsMission(latest.find((entry) => entry.id === mission.id) || null);
      }
    } catch (error) {
      console.error('Failed to cancel logistics mission:', error);
      alert(`Failed to cancel mission: ${error.message}`);
    } finally {
      setUpdatingMissionId(null);
    }
  };

  const handleSelectDcsarTask = (point) => {
    if (!point || !Number.isFinite(Number(point.lat)) || !Number.isFinite(Number(point.lon))) return;
    setSelectedDcsarId(point.id);
    setHoveredDcsarId(point.id);
    setSelectedLogisticsMission(null);
  };

  const handleAcceptDcsarTask = async (task) => {
    if (!task || task.status === 'accepted') return;
    if (!user) {
      window.location.href = '/api/auth/discord';
      return;
    }

    const userName = user.globalName || user.username || user.id;
    setAcceptingDcsarId(task.id);
    try {
      await acceptDcsarTask(task.id, userName);
      const latestPoints = await getDcsar();
      const nextPoints = latestPoints?.points || latestPoints;
      if (Array.isArray(nextPoints)) setDcsarPoints(nextPoints);
    } catch (error) {
      console.error('Failed to accept DCSAR task:', error);
      alert(`Failed to accept DCSAR task: ${error.message}`);
    } finally {
      setAcceptingDcsarId(null);
    }
  };

  const handleCompleteDcsarTask = async (task) => {
    if (!task || task.status !== 'accepted') return;
    const userName = user?.globalName || user?.username || user?.id;
    if (!userName || task.accepted_by !== userName) return;

    setUpdatingDcsarId(task.id);
    try {
      await completeDcsarTask(task.id, userName);
      const latestPoints = await getDcsar();
      const nextPoints = latestPoints?.points || latestPoints;
      if (Array.isArray(nextPoints)) setDcsarPoints(nextPoints);
      setSelectedDcsarId(null);
      setHoveredDcsarId(null);
    } catch (error) {
      console.error('Failed to complete DCSAR task:', error);
      alert(`Failed to complete DCSAR task: ${error.message}`);
    } finally {
      setUpdatingDcsarId(null);
    }
  };

  const handleCancelDcsarTask = async (task) => {
    if (!task || task.status !== 'accepted') return;
    const userName = user?.globalName || user?.username || user?.id;
    if (!userName || task.accepted_by !== userName) return;

    setUpdatingDcsarId(task.id);
    try {
      await cancelDcsarTask(task.id, userName);
      const latestPoints = await getDcsar();
      const nextPoints = latestPoints?.points || latestPoints;
      if (Array.isArray(nextPoints)) setDcsarPoints(nextPoints);
    } catch (error) {
      console.error('Failed to cancel DCSAR task:', error);
      alert(`Failed to cancel DCSAR task: ${error.message}`);
    } finally {
      setUpdatingDcsarId(null);
    }
  };

  return (
    <div className="h-full overflow-hidden bg-yt-bg-primary p-3">
      <div className="h-full">
        <div className="min-h-0 h-full">
          <section className="relative flex h-full min-h-[320px] min-w-0 flex-col overflow-hidden rounded-2xl border border-yt-border bg-yt-bg-secondary/75 backdrop-blur">
            <div
              className={`relative min-h-0 flex-1 transition-[filter] duration-300 ${
                isPreLaunchCountdownActive ? 'pointer-events-none select-none blur-[8px]' : ''
              }`}
            >
              <div className={`${mapMode ? 'pointer-events-none absolute inset-0 opacity-0' : 'relative h-full w-full opacity-100'} transition-opacity duration-300`}>
                <GlobeCanvas
                  points={globePoints}
                  focusCoordinates={focusCoordinates}
                  onScaleChange={handleScaleChange}
                  mapMode={mapMode}
                  forcedScale={forcedGlobeScale}
                  autoSpin={isPreLaunchCountdownActive}
                />
              </div>
              {mapMode && (
                <div className="absolute inset-0">
                  <FlatMapView
                    zones={filteredZones}
                    airportsData={validAirports}
                    logisticsMissions={filteredLogisticsMissions}
                    gridConnections={gridConnections}
                    convoys={convoyRenderData}
                    dcsarPoints={dcsarPointsWithNearest}
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={setSelectedZoneId}
                    focusCoordinates={focusCoordinates}
                    onZoomChange={handleFlatMapZoomChange}
                    onZoneHover={setHoveredZoneId}
                    onDcsarHover={setHoveredDcsarId}
                    onDcsarSelect={handleSelectDcsarTask}
                    onAirportClick={setSelectedAirportId}
                    showAto={filters.showAto}
                    showAirports={filters.showAirports}
                    showLogistics={filters.showLogistics}
                    showConvoys={filters.showConvoys}
                    showDcsar={filters.showDcsar}
                    animationTick={animationTick}
                  />
                </div>
              )}
              {mapMode && (
                <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-yt-border/80 bg-yt-bg-secondary/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">
                  Tactical 2D Map (zoom threshold reached)
                </div>
              )}

              <div
                className={`absolute left-3 top-3 z-[1000] rounded-xl border border-yt-border bg-[#151925f2] shadow-2xl backdrop-blur transition-all duration-200 ${
                  overlayCollapsed ? 'w-[46px] p-1.5' : 'w-[320px] p-3'
                }`}
              >
                <div className={`flex items-center ${overlayCollapsed ? 'justify-center' : 'mb-2 justify-between'}`}>
                  {!overlayCollapsed && (
                    <>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">Overlays</div>
                      <button
                        type="button"
                        className={`rounded px-2 py-1 text-[10px] font-semibold ${filters.showAirports ? 'bg-yt-accent/25 text-yt-text-primary' : 'bg-yt-bg-tertiary text-yt-text-secondary'}`}
                        onClick={() => setFilters((current) => ({ ...current, showAirports: !current.showAirports }))}
                      >
                        Airports
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setOverlayCollapsed((value) => !value)}
                    className="rounded border border-yt-border bg-yt-bg-tertiary/60 p-1 text-yt-text-secondary transition-colors hover:text-yt-text-primary"
                    aria-label={overlayCollapsed ? 'Open overlays' : 'Close overlays'}
                    title={overlayCollapsed ? 'Open overlays' : 'Close overlays'}
                  >
                    {overlayCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </button>
                </div>

                {!overlayCollapsed && (
                  <>
                    <div className="mb-3 grid grid-cols-4 gap-3">
                      <button
                        type="button"
                        onClick={() => setFilters((current) => ({ ...current, showAto: !current.showAto }))}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                          filters.showAto
                            ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                            : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                        }`}
                      >
                        ATO
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilters((current) => ({ ...current, showLogistics: !current.showLogistics }))}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                          filters.showLogistics
                            ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                            : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                        }`}
                      >
                        Logistics
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilters((current) => ({ ...current, showConvoys: !current.showConvoys }))}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                          filters.showConvoys
                            ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                            : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                        }`}
                      >
                        Convoys
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilters((current) => ({ ...current, showDcsar: !current.showDcsar }))}
                        className={`rounded border px-2 py-1 text-[11px] font-semibold ${
                          filters.showDcsar
                            ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                            : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                        }`}
                      >
                        DCSAR
                      </button>
                    </div>

                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {overlayTagOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFilters((current) => ({ ...current, control: option.value }))}
                          className={`rounded border px-2 py-1 text-[11px] ${
                            filters.control === option.value
                              ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                              : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                          }`}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <select
                        value={filters.atoMissionStatus}
                        onChange={(event) => setFilters((current) => ({ ...current, atoMissionStatus: event.target.value }))}
                        className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                      >
                        {missionStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        value={filters.logisticsStatus}
                        onChange={(event) => setFilters((current) => ({ ...current, logisticsStatus: event.target.value }))}
                        className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                      >
                        {logisticsStatusOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-3">
                      <select
                        value={filters.priority}
                        onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
                        className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                      >
                        {priorityOptions.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                      <select
                        value={filters.task}
                        onChange={(event) => setFilters((current) => ({ ...current, task: event.target.value }))}
                        className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                      >
                        <option value="all">Any Task</option>
                        <option value="LOGISTICS">LOGISTICS</option>
                        <option value="SEAD">SEAD</option>
                        <option value="DEAD">DEAD</option>
                        <option value="CAS">CAS</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <select
                        value={filters.activity}
                        onChange={(event) => setFilters((current) => ({ ...current, activity: event.target.value }))}
                        className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                      >
                        <option value="all">All Activity</option>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </>
                )}
              </div>

              <div
                className={`absolute right-3 top-3 z-[1000] rounded-xl border border-yt-border bg-[#151925f2] shadow-2xl backdrop-blur transition-all duration-200 ${
                  feedCollapsed ? 'w-[46px] p-1.5' : 'w-[360px] p-3'
                }`}
              >
                <div className={`flex items-center ${feedCollapsed ? 'justify-center' : 'mb-2 justify-between'}`}>
                  {!feedCollapsed && (
                    <>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">Feed</div>
                      <div className="flex items-center gap-2">
                        <div className="rounded bg-yt-bg-tertiary px-2 py-0.5 text-[10px] font-semibold text-yt-text-secondary">
                          {feedEvents.length}
                        </div>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setFeedCollapsed((value) => !value)}
                    className="rounded border border-yt-border bg-yt-bg-tertiary/60 p-1 text-yt-text-secondary transition-colors hover:text-yt-text-primary"
                    aria-label={feedCollapsed ? 'Open feed' : 'Close feed'}
                    title={feedCollapsed ? 'Open feed' : 'Close feed'}
                  >
                    {feedCollapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                {!feedCollapsed && (
                  <div className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
                    {feedEvents.length === 0 && (
                      <div className="rounded border border-dashed border-yt-border px-3 py-3 text-xs text-yt-text-secondary">
                        No events yet.
                      </div>
                    )}
                    {feedEvents.map((event) => (
                      <div key={event.id || `${event.type}-${event.timestamp}`} className="rounded-lg border border-yt-border bg-yt-bg-tertiary/40 p-2">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${getFeedTypeStyle(event.type)}`}>
                            {getFeedTypeLabel(event.type)}
                          </span>
                          <span className="text-[10px] text-yt-text-secondary">{formatRelativeTime(event.timestamp)}</span>
                        </div>
                        <div className="text-xs font-semibold text-yt-text-primary">
                          {event.title || 'Activity update'}
                        </div>
                        {event.message && (
                          <div className="mt-0.5 text-[11px] text-yt-text-secondary">
                            {event.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {filters.showAto && selectedZone && (
                <div className="absolute bottom-4 left-4 z-[1000] w-[330px] rounded-xl border border-yt-border bg-[#1b1d2af0] p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {selectedTags.slice(0, 8).map((tag) => (
                      <span key={tag} className="rounded bg-[#2f3a24] px-2 py-0.5 text-[11px] font-semibold text-[#d8f08c]">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-xl font-semibold leading-6 text-yt-text-primary">
                    {`Zone: '${getZoneNumber(selectedZone)}' under ${getControlText(selectedZone.status)}`}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm text-yt-text-secondary">
                    <Clock3 className="h-4 w-4" />
                    <span>{formatRelativeTime(selectedChangedAt)}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setZoneCoordinatesFormat((current) => (current === 'dms' ? 'mgrs' : 'dms'))}
                    className="mt-2 flex w-full items-center gap-2 text-left text-sm text-yt-text-secondary transition-colors hover:text-yt-text-primary"
                    title={zoneCoordinatesFormat === 'dms' ? 'Click to switch to MGRS' : 'Click to switch to DMS'}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="font-mono">{selectedZoneCoordinates}</span>
                    <span className="ml-auto rounded border border-yt-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                      {zoneCoordinatesFormat}
                    </span>
                  </button>

                  <div className="mt-3 border-t border-yt-border pt-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-[#4ca3ff] transition-colors hover:text-[#7cbcff]"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              {mapMode && filters.showDcsar && hoveredDcsarPoint && (
                <div className={`absolute bottom-4 z-[1000] w-[360px] rounded-xl border border-yt-border bg-[#1b1d2af0] p-3 shadow-2xl backdrop-blur ${filters.showAto && selectedZone ? 'left-[348px]' : 'left-4'}`}>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${hoveredDcsarPoint.accepted ? 'bg-green-500/20 text-green-200' : 'bg-slate-200/20 text-slate-100'}`}>
                      {hoveredDcsarPoint.accepted ? 'Accepted' : 'Awaiting Rescue'}
                    </span>
                    {hoveredDcsarPoint.accepted_by && (
                      <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[11px] font-semibold text-blue-200">
                        {hoveredDcsarPoint.accepted_by}
                      </span>
                    )}
                    {hoveredDcsarPoint.nearest_airbase?.name && (
                      <span className="rounded bg-[#2f3a24] px-2 py-0.5 text-[11px] font-semibold text-[#d8f08c]">
                        {hoveredDcsarPoint.nearest_airbase.name}
                      </span>
                    )}
                  </div>

                  <div className="text-xl font-semibold leading-6 text-yt-text-primary">
                    {`CSAR: '${hoveredDcsarPoint.id}'`}
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-sm text-yt-text-secondary">
                    <Clock3 className="h-4 w-4" />
                    <span>
                      {hoveredDcsarPoint.nearest_distance_nm
                        ? `Nearest airbase at ${hoveredDcsarPoint.nearest_distance_nm.toFixed(1)} nm`
                        : 'Nearest airbase unavailable'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDcsarCoordinatesFormat((current) => (current === 'dms' ? 'mgrs' : 'dms'))}
                    className="mt-2 flex w-full items-center gap-2 text-left text-sm text-yt-text-secondary transition-colors hover:text-yt-text-primary"
                    title={dcsarCoordinatesFormat === 'dms' ? 'Click to switch to MGRS' : 'Click to switch to DMS'}
                  >
                    <MapPin className="h-4 w-4" />
                    <span className="font-mono">
                      {formatZoneCoordinates({ lat: hoveredDcsarPoint.lat, lon: hoveredDcsarPoint.lon }, dcsarCoordinatesFormat)}
                    </span>
                    <span className="ml-auto rounded border border-yt-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                      {dcsarCoordinatesFormat}
                    </span>
                  </button>
                </div>
              )}

              {filters.showLogistics && selectedAirport && (
                <div className="absolute right-4 bottom-4 z-[1000] w-[430px] max-h-[62vh] overflow-y-auto rounded-xl border border-yt-border bg-[#101827f2] p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-yt-text-primary">
                      {selectedAirport.displayName || selectedAirport.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedAirportId(null)}
                      className="text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                    >
                      Close
                    </button>
                  </div>

                  {airportLogistics.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-yt-border px-3 py-3 text-xs text-yt-text-secondary">
                      No logistics tasks for this airport.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {airportLogistics.map((mission) => {
                        const sourceAirport = airportsById.get(mission.source_airport_id);
                        const orders = getMissionOrders(mission);
                        return (
                          <div key={mission.id} className="rounded-lg border border-yt-border bg-yt-bg-tertiary/60 p-2">
                            <div className="mb-1 text-xs font-semibold text-yt-text-primary">
                              From: {sourceAirport?.displayName || sourceAirport?.name || mission.source_airport_id}
                            </div>
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div className="text-[11px] text-yt-text-secondary">
                                Mission {mission.id}
                              </div>
                              <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                mission.status === 'accepted'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-yellow-500/20 text-yellow-300'
                              }`}>
                                {mission.status}
                              </span>
                            </div>
                            {mission.status === 'accepted' && mission.accepted_by && (
                              <div className="mb-2 text-[10px] text-blue-200">
                                Accepted by {mission.accepted_by}
                              </div>
                            )}
                            {mission.status === 'pending' && (
                              <div className="mb-2 text-[10px] text-yellow-200">
                                Available for assignment
                              </div>
                            )}
                            <div className="space-y-1.5">
                              {orders.map((order, index) => {
                                const containerCount = getOrderContainers(order);
                                const totalWeight = Number(order.total_weight_lbs || 0);
                                const weightPerContainer = containerCount > 0 ? (totalWeight / containerCount) : totalWeight;
                                const priority = getPriorityText(order.priority || mission.priority);
                                return (
                                  <div key={`${mission.id}-${order.weapon_id || index}`} className="rounded border border-yt-border/70 bg-[#0c1320] px-2 py-1.5">
                                    <div className="text-[11px] font-semibold text-yt-text-primary">
                                      {containerCount} container{containerCount > 1 ? 's' : ''} - {getWeaponDisplayName(order.weapon_id || 'cargo')}
                                    </div>
                                    <div className="text-[10px] text-yt-text-secondary">
                                      Content: Qty {Number(order.quantity_needed || 0)}
                                    </div>
                                    <div className="text-[10px] text-yt-text-secondary">
                                      Weight/container: {weightPerContainer > 0 ? `${weightPerContainer.toFixed(1)} lbs` : '-'}
                                    </div>
                                    <div className="text-[10px] text-yt-text-secondary">
                                      Priority: {priority}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-2 border-t border-yt-border/70 pt-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedLogisticsMission(mission)}
                                className="inline-flex items-center gap-2 text-xs font-semibold text-[#4ca3ff] transition-colors hover:text-[#7cbcff]"
                              >
                                View Details
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {selectedLogisticsMission && logisticsDetailIsoPlan && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/70"
                    onClick={() => setSelectedLogisticsMission(null)}
                    aria-label="Close logistics details"
                  />
                  <div className="relative w-[min(880px,92vw)] max-h-[84vh] overflow-y-auto rounded-2xl border border-yt-border bg-[#0f1727] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-yt-text-primary">
                          Logistics Mission {selectedLogisticsMission.id}
                        </div>
                        <div className="text-xs text-yt-text-secondary">
                          {(airportsById.get(selectedLogisticsMission.source_airport_id)?.displayName || selectedLogisticsMission.source_airport_id)}
                          {' -> '}
                          {(airportsById.get(selectedLogisticsMission.airport_id)?.displayName || selectedLogisticsMission.airport_id)}
                          {' - '}
                          {selectedLogisticsMission.status}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedLogisticsMission.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptLogisticsMission(selectedLogisticsMission)}
                            disabled={acceptingMissionId === selectedLogisticsMission.id}
                            className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {acceptingMissionId === selectedLogisticsMission.id ? 'Accepting...' : 'Accept Mission'}
                          </button>
                        )}
                        {selectedLogisticsMission.status === 'accepted' && (
                          <span className="rounded border border-blue-500/50 bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                            Accepted
                          </span>
                        )}
                        {selectedLogisticsMission.status === 'accepted' && selectedLogisticsMission.accepted_by && (
                          <span className="text-[10px] text-blue-200">
                            {selectedLogisticsMission.accepted_by}
                          </span>
                        )}
                        {!user && selectedLogisticsMission.status === 'pending' && (
                          <span className="text-[10px] text-yt-text-secondary">Discord login required</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedLogisticsMission(null)}
                          className="rounded border border-yt-border px-2 py-1 text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {selectedLogisticsMission.status === 'accepted' && user && (
                      <div className="mb-3 flex items-center gap-2">
                        {(selectedLogisticsMission.accepted_by === (user.globalName || user.username || user.id)) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCompleteLogisticsMission(selectedLogisticsMission)}
                              disabled={updatingMissionId === selectedLogisticsMission.id}
                              className="rounded border border-green-500/50 bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updatingMissionId === selectedLogisticsMission.id ? 'Completing...' : 'Complete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelLogisticsMission(selectedLogisticsMission)}
                              disabled={updatingMissionId === selectedLogisticsMission.id}
                              className="rounded border border-red-500/50 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updatingMissionId === selectedLogisticsMission.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </>
                        ) : (
                          <div className="text-[11px] text-yt-text-secondary">
                            Only the assigned pilot can complete or cancel this mission.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-yt-border/70 bg-yt-bg-tertiary/60 px-3 py-2 text-xs shadow-inner">
                      <div className="flex items-center justify-between">
                        <span className="text-yt-text-secondary">Container ISO</span>
                        <span className="text-yt-text-primary font-semibold">
                          Used {formatIsoUnits(logisticsDetailIsoPlan.totalUsed)}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-3">
                        {logisticsDetailIsoPlan.containers.filter((container) => container.used > 0).map((container) => {
                          const fillPercent = container.capacity > 0 ? Math.min(100, (container.used / container.capacity) * 100) : 0;
                          return (
                            <div key={container.id} className="rounded-lg border border-yt-border/70 bg-[#0c1320] p-2 shadow-inner">
                              <div className="mb-1 flex items-center justify-between text-[10px] text-yt-text-secondary">
                                <span>{container.small ? 'ISO Small' : 'ISO Container'}</span>
                                <span className="font-mono">{formatIsoUnits(container.used)} / {formatIsoUnits(container.capacity)}</span>
                              </div>
                              <div className="mb-1.5 h-1.5 overflow-hidden rounded-full bg-yt-border/40">
                                <div className="h-full bg-fuchsia-500" style={{ width: `${fillPercent}%` }} />
                              </div>
                              <div className="space-y-1">
                                {container.items.map((item, idx) => {
                                  const qty = getItemQuantity(item);
                                  return (
                                    <div key={`${container.id}-${idx}`} className="flex items-center justify-between text-[10px]">
                                      <span className="font-mono text-yt-text-primary">{getWeaponDisplayName(item.weapon_id)}</span>
                                      <span className="font-mono text-yt-text-secondary">{qty !== null ? `x${qty}` : '-'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-3 space-y-2">
                      {logisticsDetailOrders.map((order, index) => {
                        const containerCount = getOrderContainers(order);
                        const totalWeight = Number(order.total_weight_lbs || 0);
                        const weightPerContainer = containerCount > 0 ? (totalWeight / containerCount) : totalWeight;
                        return (
                          <div key={`detail-order-${index}`} className="rounded-lg border border-yt-border bg-yt-bg-tertiary/60 p-2">
                            <div className="text-xs font-semibold text-yt-text-primary">
                              {getWeaponDisplayName(order.weapon_id || 'cargo')}
                            </div>
                            <div className="text-[11px] text-yt-text-secondary">
                              Containers: {containerCount} | Qty: {Number(order.quantity_needed || 0)} | Weight/container: {weightPerContainer > 0 ? `${weightPerContainer.toFixed(1)} lbs` : '-'} | Priority: {getPriorityText(order.priority || selectedLogisticsMission.priority)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {selectedDcsarTask && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/70"
                    onClick={() => setSelectedDcsarId(null)}
                    aria-label="Close CSAR task details"
                  />
                  <div className="relative w-[min(760px,92vw)] max-h-[84vh] overflow-y-auto rounded-2xl border border-yt-border bg-[#0f1727] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-yt-text-primary">
                          CSAR Task {selectedDcsarTask.id}
                        </div>
                        <div className="text-xs text-yt-text-secondary">
                          {selectedDcsarTask.nearest_airbase?.name
                            ? `Nearest Airbase: ${selectedDcsarTask.nearest_airbase.name}`
                            : 'Nearest Airbase: n/a'}
                          {selectedDcsarTask.nearest_distance_nm ? ` - ${selectedDcsarTask.nearest_distance_nm.toFixed(1)} nm` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedDcsarTask.status === 'pending' && (
                          <button
                            type="button"
                            onClick={() => handleAcceptDcsarTask(selectedDcsarTask)}
                            disabled={acceptingDcsarId === selectedDcsarTask.id}
                            className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {acceptingDcsarId === selectedDcsarTask.id ? 'Accepting...' : 'Accept Task'}
                          </button>
                        )}
                        {selectedDcsarTask.status === 'accepted' && (
                          <span className="rounded border border-blue-500/50 bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                            Accepted
                          </span>
                        )}
                        {selectedDcsarTask.status === 'accepted' && selectedDcsarTask.accepted_by && (
                          <span className="text-[10px] text-blue-200">
                            {selectedDcsarTask.accepted_by}
                          </span>
                        )}
                        {!user && selectedDcsarTask.status === 'pending' && (
                          <span className="text-[10px] text-yt-text-secondary">Discord login required</span>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedDcsarId(null)}
                          className="rounded border border-yt-border px-2 py-1 text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    {selectedDcsarTask.status === 'accepted' && user && (
                      <div className="mb-3 flex items-center gap-2">
                        {(selectedDcsarTask.accepted_by === (user.globalName || user.username || user.id)) ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCompleteDcsarTask(selectedDcsarTask)}
                              disabled={updatingDcsarId === selectedDcsarTask.id}
                              className="rounded border border-green-500/50 bg-green-500/15 px-3 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updatingDcsarId === selectedDcsarTask.id ? 'Completing...' : 'Complete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelDcsarTask(selectedDcsarTask)}
                              disabled={updatingDcsarId === selectedDcsarTask.id}
                              className="rounded border border-red-500/50 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updatingDcsarId === selectedDcsarTask.id ? 'Cancelling...' : 'Cancel'}
                            </button>
                          </>
                        ) : (
                          <div className="text-[11px] text-yt-text-secondary">
                            Only the assigned pilot can complete or cancel this task.
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-lg border border-yt-border/70 bg-yt-bg-tertiary/60 p-3">
                      <div className="mb-2 text-xs font-semibold text-yt-text-primary">Task Details</div>
                      <div className="grid grid-cols-1 gap-2 text-[11px] text-yt-text-secondary md:grid-cols-2">
                        <div>
                          Status: <span className="font-semibold text-yt-text-primary">{selectedDcsarTask.status}</span>
                        </div>
                        <div>
                          Accepted by: <span className="font-semibold text-yt-text-primary">{selectedDcsarTask.accepted_by || '-'}</span>
                        </div>
                        <div className="md:col-span-2">
                          Coordinates: <span className="font-mono text-yt-text-primary">{formatZoneCoordinates({ lat: selectedDcsarTask.lat, lon: selectedDcsarTask.lon }, 'dms')}</span>
                        </div>
                        <div className="md:col-span-2">
                          MGRS: <span className="font-mono text-yt-text-primary">{formatZoneCoordinates({ lat: selectedDcsarTask.lat, lon: selectedDcsarTask.lon }, 'mgrs')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            {isPreLaunchCountdownActive && (
              <div className="pointer-events-none absolute inset-0 z-[1400] flex items-center justify-center bg-[#02050dbd] backdrop-blur-md">
                <div className="mx-4 w-[min(720px,92vw)] rounded-2xl border border-cyan-400/35 bg-[#0a1324de] p-6 text-center shadow-[0_25px_60px_rgba(0,0,0,0.65)]">
                  <div className="mb-2 text-xs uppercase tracking-[0.24em] text-cyan-200/80">Release</div>
                  <h2 className="mb-6 text-2xl font-semibold text-white sm:text-3xl">Loading Mission Data</h2>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-yt-border/70 bg-[#121c31d9] p-3">
                      <div className="font-mono text-3xl font-bold text-white sm:text-4xl">{countdownDisplay.hours}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">Hours</div>
                    </div>
                    <div className="rounded-xl border border-yt-border/70 bg-[#121c31d9] p-3">
                      <div className="font-mono text-3xl font-bold text-white sm:text-4xl">{countdownDisplay.minutes}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">Minutes</div>
                    </div>
                    <div className="rounded-xl border border-yt-border/70 bg-[#121c31d9] p-3">
                      <div className="font-mono text-3xl font-bold text-white sm:text-4xl">{countdownDisplay.seconds}</div>
                      <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-slate-300">Seconds</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
