import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import createGlobe from 'cobe';
import * as mgrs from 'mgrs';
import { MapContainer, TileLayer, Circle, CircleMarker, Marker, Polyline, Popup, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { divIcon } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import c130ModelUrl from '../assets/3D/yc-130prototype_of_c-130.glb';
import ch47ModelUrl from '../assets/3D/ch47.glb';
import t72ModelUrl from '../assets/3D/t90.glb';
import { Ambulance, Anchor, Blend, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock3, Factory, Forklift, MapPin, PersonStanding, Satellite, TowerControl } from 'lucide-react';
import frontlineZones from '../config/frontlineZones.json';
import airports from '../config/airports';
import { importantWeaponsAirports, importantWeaponsCarriers, importantWeaponsHeliports } from '../config/weapons';
import tankIcon from '../assets/tank-icon.svg';
import socketService from '../services/socket';
import { acceptDcsarTask, acceptFrontlineZone, acceptMission, cancelMission, completeDcsarTask, completeMission, composeAirportLogisticsMission, createOrder, getAirliftPlayers, getCombatMissions, getConvoys, getDcsar, getFeed, getFrontlineZones, getLogisticsRouteVisibility, getMissions, getServerTime, setAirportLogisticsRoutePriority, getProductionPoints, getSpawnOptions, getWebSpawnMarkers, requestProductionPointUpgrade, spawnAirportInfantry, spawnAirportCrate } from '../services/api';
import { buildIsoContainerPlan, formatIsoUnits } from '../utils/isoLoad';
import { useUser } from '../contexts/UserContext';

const MAP_ENGINE = String(import.meta.env.VITE_MAP_ENGINE || 'leaflet').trim().toLowerCase();
const LOGISTICS_ROUTE_TOGGLE_ROLE_ID = '1447684923518484500';
const BASEMAP_MODE_DARK = 'dark';
const BASEMAP_MODE_SATELLITE = 'satellite';
const MAPLIBRE_NAV_CONTROL_POSITION = 'bottom-right';
const MAPLIBRE_FOCUS_Y_OFFSET_PX = 132;
const MAPLIBRE_DCSAR_ICON_PENDING_IMAGE_ID = 'dcsar-person-icon-pending';
const MAPLIBRE_DCSAR_ICON_ACCEPTED_IMAGE_ID = 'dcsar-person-icon-accepted';
const MAPLIBRE_DCSAR_ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 5, 1.15, 8, 1.55, 10, 1.9];
const MAPLIBRE_AIRPORT_ICON_TOWER_BLUE_IMAGE_ID = 'airport-tower-icon-blue';
const MAPLIBRE_AIRPORT_ICON_TOWER_GREEN_IMAGE_ID = 'airport-tower-icon-green';
const MAPLIBRE_AIRPORT_ICON_ANCHOR_IMAGE_ID = 'airport-anchor-icon';
const MAPLIBRE_AIRPORT_ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 5, 0.78, 8, 0.95, 10, 1.12];

function isDesktopGlobeDevice() {
  if (typeof window === 'undefined') return true;
  const ua = String(window.navigator?.userAgent || '');
  const isTabletOrPhoneUa = /(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet)/i.test(ua);
  if (isTabletOrPhoneUa) return false;
  return window.matchMedia('(min-width: 1025px)').matches;
}

const BASEMAP_CONFIG = {
  [BASEMAP_MODE_DARK]: {
    leafletUrl: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    leafletAttribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    maplibreLayerId: 'carto-darkmatter-raster',
  },
  [BASEMAP_MODE_SATELLITE]: {
    leafletUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    leafletAttribution: 'Tiles &copy; Esri',
    maplibreLayerId: 'esri-satellite-raster',
  },
};

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

function formatDurationMmSs(durationMs) {
  const totalSeconds = Math.max(0, Math.floor((Number(durationMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
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

function isCyprusZone(zone) {
  const source = String(zone?.id || zone?.name || '').toUpperCase();
  return /(^|_)C\d{2}(?!\d)/.test(source);
}

function buildZoneGridKey(prefix, index) {
  return `${prefix}${String(index).padStart(2, '0')}`;
}

function getZoneGridKey(zone) {
  const index = getZoneGridIndex(zone);
  if (index === null) return null;
  const prefix = isCyprusZone(zone) ? 'C' : 'N';
  return buildZoneGridKey(prefix, index);
}

function parseZoneGridKey(key) {
  const match = String(key || '').match(/^([A-Z])(\d{2})$/);
  if (!match) return null;
  const index = Number.parseInt(match[2], 10);
  if (!Number.isFinite(index) || index < 0 || index > 99) return null;
  return { prefix: match[1], index };
}

function getNeighborZoneGridKeys(key) {
  const parsed = parseZoneGridKey(key);
  if (!parsed) return [];

  const { prefix, index } = parsed;
  const row = Math.floor(index / 10);
  const col = index % 10;
  const result = [];
  if (row > 0) result.push(buildZoneGridKey(prefix, index - 10));
  if (row < 9) result.push(buildZoneGridKey(prefix, index + 10));
  if (col > 0) result.push(buildZoneGridKey(prefix, index - 1));
  if (col < 9) result.push(buildZoneGridKey(prefix, index + 1));
  return result;
}

function getRightZoneGridKey(key) {
  const parsed = parseZoneGridKey(key);
  if (!parsed) return null;
  const { prefix, index } = parsed;
  const col = index % 10;
  if (col >= 9) return null;
  return buildZoneGridKey(prefix, index + 1);
}

function getDownZoneGridKey(key) {
  const parsed = parseZoneGridKey(key);
  if (!parsed) return null;
  const { prefix, index } = parsed;
  const row = Math.floor(index / 10);
  if (row >= 9) return null;
  return buildZoneGridKey(prefix, index + 10);
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
  if (type?.startsWith('dcore.pp_upgrade')) return 'border-blue-500/40 bg-blue-500/10 text-blue-200';
  if (type?.startsWith('dcore.spawn')) return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  return 'border-slate-500/40 bg-slate-500/10 text-slate-200';
}

function getFeedTypeLabel(type) {
  if (type === 'zone.status_changed') return 'Zone';
  if (type?.startsWith('logistics.')) return 'Logistics';
  if (type?.startsWith('ato.')) return 'ATO';
  if (type?.startsWith('convoy.')) return 'Convoy';
  if (type?.startsWith('dcsar.')) return 'CSAR';
  if (type?.startsWith('user.')) return 'User';
  if (type?.startsWith('dcore.pp_upgrade')) return 'Production';
  if (type?.startsWith('dcore.spawn')) return 'Spawn';
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

function getAirliftPlayerColor(airframe) {
  const id = String(airframe || '').toUpperCase();
  if (id.includes('C-130')) return '#f59e0b';
  if (id.includes('CH-47')) return '#8b5cf6';
  if (id.includes('MI-8')) return '#22c55e';
  if (id.includes('UH-1')) return '#38bdf8';
  return '#f8fafc';
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

function getMissionIsoUnits(mission) {
  const directIso = Number(mission?.total_iso_units);
  if (Number.isFinite(directIso) && directIso > 0) {
    return Math.round(directIso * 2) / 2;
  }
  const orders = getMissionOrders(mission);
  const sum = orders.reduce((acc, order) => acc + (Number(order?.iso_units) || 0), 0);
  return Math.round(sum * 2) / 2;
}

function getLargeContainerCountFromIso(isoUnits) {
  if (!Number.isFinite(isoUnits) || isoUnits <= 0) return 0;
  const normalized = Math.round(isoUnits * 2) / 2;
  return Math.floor(normalized + 1e-6);
}

function getIsoContainerTypeLabel(isoUnits) {
  if (isoUnits >= 1) return 'ISO Large';
  if (isoUnits > 0) return 'ISO Small';
  return 'ISO Container';
}

function splitIsoUnitsToContainers(isoUnits) {
  const chunks = [];
  let remaining = Math.max(0, Math.round((Number(isoUnits) || 0) * 2) / 2);
  while (remaining >= 1 - 1e-6) {
    chunks.push(1.0);
    remaining -= 1.0;
  }
  if (remaining >= 0.5 - 1e-6) {
    chunks.push(0.5);
  }
  return chunks;
}

function buildPendingContainerItems(missions = [], airportsById = new Map()) {
  const items = [];
  missions.forEach((mission) => {
    const sourceAirport = airportsById.get(mission.source_airport_id);
    const orders = getMissionOrders(mission);
    orders.forEach((order, orderIndex) => {
      const orderIsoUnits = Math.max(0, Math.round((Number(order?.iso_units || 0) || 0) * 2) / 2);
      if (orderIsoUnits <= 0) return;
      const chunks = splitIsoUnitsToContainers(orderIsoUnits);
      chunks.forEach((chunkUnits, chunkIndex) => {
        const ratio = orderIsoUnits > 0 ? (chunkUnits / orderIsoUnits) : 0;
        const qty = Math.floor((Number(order?.quantity_needed || 0) || 0) * ratio);
        const totalWeight = Number(order?.total_weight_lbs || 0) || 0;
        const weight = totalWeight * ratio;
        const itemId = `${mission.id}:${orderIndex}:${chunkIndex}:${chunkUnits}`;
        items.push({
          id: itemId,
          missionId: mission.id,
          orderIndex,
          chunkIndex,
          units: chunkUnits,
          airportId: mission.airport_id,
          sourceAirportId: mission.source_airport_id,
          sourceAirportName: sourceAirport?.displayName || sourceAirport?.name || mission.source_airport_id,
          weaponId: order.weapon_id || 'cargo',
          quantityNeeded: qty,
          totalWeightLbs: weight,
          priority: getPriorityText(order.priority || mission.priority),
        });
      });
    });
  });
  return items;
}

function toLatLngPoint(position) {
  if (!position || typeof position !== 'object') return null;
  const lat = Number(position.lat);
  const lon = Number(position.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return [lat, lon];
}

const AIRPORT_SPAWN_RADIUS_M = 2500;
const SPAWN_QUANTITY_MAX = 5;
const SPAWN_OFFSET_METERS = 2;
const SPAWN_OFFSET_BEARING_DEG = 90;
const MAP_ZOOM_DEFAULT_MAX = 14;
const MAP_ZOOM_SPAWN_MAX = 18;

const SPAWN_BANNER_DISPLAY_NAMES = {
  MANPAD: 'MANPAD',
  SCOUT: 'Scout',
  AMMO: 'Ammo',
  FUEL: 'Fuel',
  BUILD: 'Build',
  HMMWV: 'HMMWV',
  TOW: 'TOW',
  L118: 'L118',
  TACAN: 'TACAN',
};

function formatSpawnBannerName(keyword) {
  const value = String(keyword || '').trim().toUpperCase();
  if (!value) return 'item';
  return SPAWN_BANNER_DISPLAY_NAMES[value] || (value.charAt(0) + value.slice(1).toLowerCase());
}

const SPAWN_MENU_SECTIONS = [
  {
    id: 'infantry',
    title: 'INFANTRY',
    spawnType: 'inf_spawn',
    keywords: ['MANPAD', 'SCOUT'],
  },
  {
    id: 'build',
    title: 'BUILD',
    spawnType: 'crate_spawn',
    keywords: ['AMMO', 'FUEL', 'BUILD'],
  },
  {
    id: 'deployables',
    title: 'DEPLOYABLES',
    spawnType: 'crate_spawn',
    keywords: ['HMMWV', 'TOW', 'L118', 'TACAN'],
  },
];

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

function haversineMeters(lat1, lon1, lat2, lon2) {
  return haversineNm(lat1, lon1, lat2, lon2) * 1852;
}

function offsetLatLon(lat, lon, distanceM, bearingDeg) {
  const earthRadiusM = 6371008.8;
  const bearingRad = (bearingDeg * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const lonRad = (lon * Math.PI) / 180;
  const angularDistance = distanceM / earthRadiusM;
  const lat2 = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance)
    + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );
  const lon2 = lonRad + Math.atan2(
    Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
    Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(lat2)
  );
  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (lon2 * 180) / Math.PI,
  };
}

function buildSpawnPlacementPositions(lat, lon, quantity) {
  const qty = Math.max(1, Math.min(SPAWN_QUANTITY_MAX, Math.floor(Number(quantity)) || 1));
  return Array.from({ length: qty }, (_, index) => (
    index === 0
      ? { lat, lon }
      : offsetLatLon(lat, lon, SPAWN_OFFSET_METERS * index, SPAWN_OFFSET_BEARING_DEG)
  ));
}

function circlePolygon(lat, lon, radiusMeters, points = 64) {
  const coords = [];
  const earthRadius = 6371000;
  const latRad = (lat * Math.PI) / 180;
  for (let i = 0; i <= points; i += 1) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = radiusMeters * Math.cos(angle);
    const dy = radiusMeters * Math.sin(angle);
    const newLat = lat + (dy / earthRadius) * (180 / Math.PI);
    const newLon = lon + (dx / (earthRadius * Math.cos(latRad))) * (180 / Math.PI);
    coords.push([newLon, newLat]);
  }
  return {
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [coords] },
    properties: {},
  };
}

function interpolateLatLon(start, end, progress) {
  if (!start || !end) return null;
  const clamped = Math.max(0, Math.min(1, progress));
  return [
    start[0] + (end[0] - start[0]) * clamped,
    start[1] + (end[1] - start[1]) * clamped,
  ];
}

function destinationPoint(lat, lon, bearingDeg, distanceMeters) {
  const earthRadius = 6371008.8;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const angularDistance = distanceMeters / earthRadius;

  const sinLat1 = Math.sin(lat1);
  const cosLat1 = Math.cos(lat1);
  const sinAngular = Math.sin(angularDistance);
  const cosAngular = Math.cos(angularDistance);

  const lat2 = Math.asin((sinLat1 * cosAngular) + (cosLat1 * sinAngular * Math.cos(brng)));
  const lon2 = lon1 + Math.atan2(
    Math.sin(brng) * sinAngular * cosLat1,
    cosAngular - (sinLat1 * Math.sin(lat2))
  );

  return [((lon2 * 180) / Math.PI + 540) % 360 - 180, (lat2 * 180) / Math.PI];
}

function createCircleRing(lat, lon, radiusMeters, segments = 40) {
  const coords = [];
  for (let i = 0; i < segments; i += 1) {
    const bearing = (i / segments) * 360;
    coords.push(destinationPoint(lat, lon, bearing, radiusMeters));
  }
  if (coords.length > 0) {
    coords.push(coords[0]);
  }
  return coords;
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

function createAirportMarkerIcon(isMainBase = false, isCarrier = false) {
  const frameSize = isMainBase ? 30 : 27;
  const iconSize = isMainBase ? 19 : 17;
  const color = isMainBase ? '#22c55e' : '#3b82f6';
  const IconComponent = isCarrier ? Anchor : TowerControl;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: `${frameSize}px`,
        height: `${frameSize}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        borderRadius: '999px',
        background: 'rgba(15, 23, 42, 0.78)',
        border: '1px solid rgba(148, 163, 184, 0.7)',
        boxShadow: `0 0 0 1px rgba(30, 41, 59, 0.9), 0 0 8px ${isMainBase ? 'rgba(34, 197, 94, 0.4)' : 'rgba(59, 130, 246, 0.35)'}`,
      }}
    >
      <IconComponent size={iconSize} color={color} strokeWidth={2.25} />
    </div>
  );

  return divIcon({
    html,
    className: 'airport-marker-icon',
    iconSize: [frameSize, frameSize],
    iconAnchor: [frameSize / 2, frameSize / 2],
  });
}

function buildDcsarPersonSvgMarkup(color = '#f8fafc') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <g fill="none" stroke="${color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="14" cy="5.5" r="2.2" />
      <path d="M14 8.8v7.2" />
      <path d="M9.8 13.5l4.2-2.1 4.2 2.1" />
      <path d="M11.3 26l2.1-7.3" />
      <path d="M16.7 26l-2.1-7.3" />
    </g>
  </svg>`;
}

function loadSvgAsImage(svgMarkup) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load SVG icon image'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
  });
}

async function ensureMapLibreDcsarIconImages(map) {
  const defs = [
    { id: MAPLIBRE_DCSAR_ICON_PENDING_IMAGE_ID, color: '#f8fafc' },
    { id: MAPLIBRE_DCSAR_ICON_ACCEPTED_IMAGE_ID, color: '#22c55e' },
  ];

  for (const def of defs) {
    if (map.hasImage(def.id)) continue;
    const svg = buildDcsarPersonSvgMarkup(def.color);
    const image = await loadSvgAsImage(svg);
    map.addImage(def.id, image, { pixelRatio: 2 });
  }
}

function buildAirportSvgMarkup(icon = 'tower', color = '#3b82f6') {
  const IconComponent = icon === 'anchor' ? Anchor : TowerControl;
  return renderToStaticMarkup(
    <IconComponent
      size={30}
      color={color}
      strokeWidth={2.3}
      style={{
        filter: 'drop-shadow(0 0 2px rgba(15,23,42,0.9))',
      }}
    />
  );
}

async function ensureMapLibreAirportIconImages(map) {
  const defs = [
    { id: MAPLIBRE_AIRPORT_ICON_TOWER_BLUE_IMAGE_ID, icon: 'tower', color: '#3b82f6' },
    { id: MAPLIBRE_AIRPORT_ICON_TOWER_GREEN_IMAGE_ID, icon: 'tower', color: '#22c55e' },
    { id: MAPLIBRE_AIRPORT_ICON_ANCHOR_IMAGE_ID, icon: 'anchor', color: '#3b82f6' },
  ];

  for (const def of defs) {
    if (map.hasImage(def.id)) continue;
    const svg = buildAirportSvgMarkup(def.icon, def.color);
    const image = await loadSvgAsImage(svg);
    map.addImage(def.id, image, { pixelRatio: 2 });
  }
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

function FlatMapFocus({ center, targetZoom }) {
  const map = useMap();

  useEffect(() => {
    if (!center) return;
    const zoom = Math.max(map.getZoom(), targetZoom || 8);
    map.setView([center.lat, center.lon], zoom, {
      animate: true,
      duration: 0.7,
    });
  }, [center, map, targetZoom]);

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

// Captures map clicks while a web spawn is being placed (click-to-place flow).
function FlatMapSpawnClickHandler({ active, onPlace }) {
  useMapEvents({
    click: (event) => {
      if (!active) return;
      const { lat, lng } = event.latlng || {};
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        onPlace({ lat, lon: lng });
      }
    },
  });
  return null;
}

const PRODUCTION_POINT_COLORS = {
  BLUE: '#3b82f6',
  RED: '#ef4444',
  CONTESTED: '#f97316',
  NEUTRAL: '#e2e8f0',
};

function getProductionPointColor(owner) {
  return PRODUCTION_POINT_COLORS[String(owner || 'NEUTRAL').toUpperCase()] || PRODUCTION_POINT_COLORS.NEUTRAL;
}

function FlatMapView({
  zones,
  airportsData,
  logisticsMissions,
  gridConnections,
  convoys,
  airliftPlayers,
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
  showAirliftPlayers,
  showDcsar,
  onDcsarHover,
  onDcsarSelect,
  animationTick,
  basemapMode,
  focusTargetKey,
  productionPoints,
  showProductionPoints,
  selectedProductionPointId,
  onProductionPointSelect,
  spawnPlacementActive,
  onSpawnPlace,
  spawnAirportCenter,
  webSpawnMarkers,
  mapMaxZoom,
}) {
  const center = focusCoordinates || { lat: 35.5, lon: 37.5 };
  const activeBasemap = BASEMAP_CONFIG[basemapMode] || BASEMAP_CONFIG[BASEMAP_MODE_DARK];
  const effectiveMaxZoom = mapMaxZoom || MAP_ZOOM_DEFAULT_MAX;
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
        maxZoom={effectiveMaxZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom
      >
        <TileLayer
          attribution={activeBasemap.leafletAttribution}
          url={activeBasemap.leafletUrl}
        />
        <FlatMapZoomWatcher onZoomChange={onZoomChange} />
        <FlatMapFocus
          center={focusTargetKey ? focusCoordinates : null}
          targetZoom={spawnPlacementActive ? 15 : undefined}
        />

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
                interactive: false,
              }}
            />
          );
        })}

        {showConvoys && convoys.map((convoy) => {
          const style = getConvoyStyle(convoy.status);
          const markerPosition = convoy.movingPosition || convoy.lastPosition || null;
          const hasRoute = Array.isArray(convoy.routeLine) && convoy.routeLine.length >= 2;
          if (!markerPosition && !hasRoute) return null;
          const lastUpdateText = convoy.lastUpdateTs ? formatRelativeTime(convoy.lastUpdateTs) : 'unknown';

          const layers = [];
          if (hasRoute) {
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

          if (markerPosition) {
            layers.push(
              <Marker
                key={`convoy-marker-${convoy.convoy_id}`}
                position={markerPosition}
                icon={createConvoyMovingIcon(convoy.bearing || 0)}
                interactive
              >
                <Tooltip direction="top" offset={[0, -3]} opacity={0.95}>
                  Convoy {convoy.convoy_id} ({convoy.status})
                </Tooltip>
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">Convoy {convoy.convoy_id}</div>
                    <div>Status: {convoy.status}</div>
                    <div>Ultimo aggiornamento: {lastUpdateText}</div>
                  </div>
                </Popup>
              </Marker>
            );
          }

          return layers;
        })}

        {showAirliftPlayers && airliftPlayers.map((player) => {
          const lat = Number(player?.lat);
          const lon = Number(player?.lon);
          if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
          const color = getAirliftPlayerColor(player.airframe);
          const name = String(player.name || 'Unknown');
          const airframe = String(player.airframe || player.type_name || 'Airlift');

          return (
            <CircleMarker
              key={`airlift-player-${player.id || `${name}-${airframe}`}`}
              center={[lat, lon]}
              radius={5}
              pathOptions={{
                color: '#f8fafc',
                fillColor: color,
                fillOpacity: 0.92,
                weight: 1.6,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                {`${name} (${airframe})`}
              </Tooltip>
            </CircleMarker>
          );
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

        {showAto && zones.flatMap((zone) => {
          const isSelected = zone.id === selectedZoneId;
          const color =
            zone.status === 'RED'
              ? '#ef4444'
              : zone.status === 'BLUE'
                ? '#3b82f6'
                : zone.status === 'UNDER_ATTACK'
                  ? '#f97316'
                  : '#e2e8f0';
          const isAccepted = zone.operation_assigned === true && Number(zone.operation_remaining_ms || 0) > 0;
          const layers = [];

          if (isAccepted) {
            const pulseCycleMs = 1800;
            const offset = hashString(zone.id || 'zone') % pulseCycleMs;
            const phase = ((animationTick + offset) % pulseCycleMs) / pulseCycleMs;
            const pulseRadius = (isSelected ? 10 : 7) + phase * 8;
            const pulseOpacity = (1 - phase) * 0.42;

            layers.push(
              <CircleMarker
                key={`zone-pulse-${zone.id}`}
                center={[zone.coordinates.lat, zone.coordinates.lon]}
                radius={pulseRadius}
                pathOptions={{
                  color: '#22c55e',
                  fillColor: '#22c55e',
                  fillOpacity: pulseOpacity * 0.35,
                  opacity: pulseOpacity,
                  weight: 1.8,
                }}
                interactive={false}
              />
            );
          }

          layers.push(
            <CircleMarker
              key={zone.id}
              center={[zone.coordinates.lat, zone.coordinates.lon]}
              radius={isSelected ? 9 : 6}
              pathOptions={{
                color: isAccepted ? '#22c55e' : color,
                fillColor: isAccepted ? '#22c55e' : color,
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

          return layers;
        })}

        {showAirports && airportsData.map((airport) => (
          <Marker
            key={`airport-marker-${airport.id}`}
            position={[airport.coordinates.lat, airport.coordinates.lon]}
            icon={createAirportMarkerIcon(Boolean(airport.isMainBase), Boolean(airport.isCarrier))}
            eventHandlers={{
              click: () => onAirportClick && onAirportClick(airport.id),
            }}
          >
            <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
              {airport.displayName || airport.name || airport.id}
            </Tooltip>
          </Marker>
        ))}

        {showProductionPoints && (productionPoints || []).map((pp) => {
          if (!pp.coordinates || !Number.isFinite(pp.coordinates.lat) || !Number.isFinite(pp.coordinates.lon)) {
            return null;
          }
          const isSelected = pp.id === selectedProductionPointId;
          const color = getProductionPointColor(pp.owner);
          return (
            <CircleMarker
              key={`pp-${pp.id}`}
              center={[pp.coordinates.lat, pp.coordinates.lon]}
              radius={isSelected ? 11 : 8}
              pathOptions={{
                color: pp.upgrading ? '#facc15' : color,
                fillColor: color,
                fillOpacity: isSelected ? 0.92 : 0.7,
                weight: pp.upgrading ? 3.5 : (isSelected ? 3 : 2),
                dashArray: pp.upgrading ? '4,3' : undefined,
              }}
              eventHandlers={{
                click: () => onProductionPointSelect && onProductionPointSelect(pp.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                {`${pp.zone_name} • LV${pp.level}${pp.upgrading ? ' • UPGRADING' : ''}`}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {spawnPlacementActive && spawnAirportCenter && Number.isFinite(spawnAirportCenter.lat) && Number.isFinite(spawnAirportCenter.lon) && (
          <Circle
            center={[spawnAirportCenter.lat, spawnAirportCenter.lon]}
            radius={AIRPORT_SPAWN_RADIUS_M}
            pathOptions={{
              color: '#facc15',
              fillColor: '#facc15',
              fillOpacity: 0.06,
              weight: 2,
              dashArray: '6,6',
            }}
          />
        )}

        {(webSpawnMarkers || []).map((marker) => {
          if (!Number.isFinite(marker?.lat) || !Number.isFinite(marker?.lon)) return null;
          return (
            <CircleMarker
              key={`web-spawn-${marker.id}`}
              center={[marker.lat, marker.lon]}
              radius={7}
              pathOptions={{
                color: '#f59e0b',
                fillColor: '#f59e0b',
                fillOpacity: 0.85,
                weight: 2,
              }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                {marker.label || marker.keyword || marker.id}
              </Tooltip>
            </CircleMarker>
          );
        })}

        <FlatMapSpawnClickHandler active={spawnPlacementActive} onPlace={onSpawnPlace} />
      </MapContainer>
    </div>
  );
}

function MapLibreFlatMapView({
  zones,
  airportsData,
  logisticsMissions,
  logisticsFrontlineAirportIds,
  gridConnections,
  convoys,
  airliftPlayers,
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
  showAirliftPlayers,
  showDcsar,
  onDcsarHover,
  onDcsarSelect,
  basemapMode,
  focusTargetKey,
  productionPoints,
  showProductionPoints,
  selectedProductionPointId,
  onProductionPointSelect,
  spawnPlacementActive,
  onSpawnPlace,
  spawnAirportCenter,
  webSpawnMarkers,
}) {
  const MIN_PITCH = 0;
  const MAX_PITCH = 85;
  const ZONE_DOME_RADIUS_METERS = 3000;
  const LOGISTICS_ROUTE_RADIUS_METERS = 120;
  const LOGISTICS_C130_MODEL_SIZE_METERS = 110;
  const LOGISTICS_CH47_MODEL_SIZE_METERS = 92;
  const LOGISTICS_CONVOY_MODEL_SIZE_METERS = 120;
  const AIRLIFT_C130_MODEL_SIZE_METERS = 92;
  const AIRLIFT_CH47_MODEL_SIZE_METERS = 78;
  const AIRLIFT_MIN_CLEARANCE_METERS = 30;
  const LOGISTICS_CH47_DISTANCE_THRESHOLD_METERS = 70000;
  const LOGISTICS_CH47_YAW_OFFSET_RAD = THREE.MathUtils.degToRad(70) + Math.PI;
  const LOGISTICS_CONVOY_YAW_OFFSET_RAD = 0;
  const MIN_SAFE_ZOOM = 5;
  const effectiveMaxZoom = spawnPlacementActive ? MAP_ZOOM_SPAWN_MAX : 11.8;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const dcsarByIdRef = useRef(new Map());
  const domes3dRef = useRef({
    scene: null,
    camera: null,
    renderer: null,
    group: null,
    geometry: null,
    domes: [],
    routes: [],
    c130Template: null,
    ch47Template: null,
    convoyTemplate: null,
    planeLoaderPromise: null,
  });
  const popupRef = useRef(null);
  const middleDragRef = useRef(null);
  const lastAutoFocusRef = useRef(null);
  const userCameraLockUntilRef = useRef(0);
  const zoomGuardRef = useRef(false);
  const lastUserInputAtRef = useRef(0);
  const prevCameraRef = useRef(null);
  const lastStableCameraRef = useRef(null);
  const center = focusCoordinates || { lat: 35.5, lon: 37.5 };
  const mapDebugEnabled = typeof window !== 'undefined' && window.localStorage.getItem('map-debug') === '1';

  const logMapDebug = useCallback((event, payload = {}) => {
    if (!mapDebugEnabled) return;
    const ts = new Date().toISOString();
    // eslint-disable-next-line no-console
    console.log(`[map-debug] ${ts} ${event}`, payload);
  }, [mapDebugEnabled]);

  const style = useMemo(() => ({
    version: 8,
    sources: {
      cartoDarkMatter: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
      },
      esriSatellite: {
        type: 'raster',
        tiles: [
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri',
      },
      terrainDem: {
        type: 'raster-dem',
        tiles: [
          'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        maxzoom: 14,
        encoding: 'terrarium',
        attribution: 'Elevation tiles by AWS Terrain Tiles',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#0b1220',
        },
      },
      {
        id: 'carto-darkmatter-raster',
        type: 'raster',
        source: 'cartoDarkMatter',
        layout: {
          visibility: 'visible',
        },
      },
      {
        id: 'esri-satellite-raster',
        type: 'raster',
        source: 'esriSatellite',
        layout: {
          visibility: 'none',
        },
      },
    ],
  }), []);

  const fcGrid = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showAto ? [] : (gridConnections || []).map((connection) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: (connection.positions || []).map((point) => [point[1], point[0]]),
      },
      properties: {
        id: connection.id || '',
      },
    })),
  }), [gridConnections, showAto]);

  const airportsById = useMemo(() => {
    const map = new Map();
    (airportsData || []).forEach((airport) => map.set(airport.id, airport));
    return map;
  }, [airportsData]);

  const fcLogistics = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showLogistics ? [] : (logisticsMissions || []).flatMap((mission) => {
      const sourceAirport = airportsById.get(mission.source_airport_id);
      const destinationAirport = airportsById.get(mission.airport_id);
      if (!sourceAirport?.coordinates || !destinationAirport?.coordinates) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [sourceAirport.coordinates.lon, sourceAirport.coordinates.lat],
            [destinationAirport.coordinates.lon, destinationAirport.coordinates.lat],
          ],
        },
        properties: {
          id: mission.id || '',
          status: mission.status || 'pending',
          source_name: sourceAirport.displayName || sourceAirport.name || mission.source_airport_id || '-',
          destination_name: destinationAirport.displayName || destinationAirport.name || mission.airport_id || '-',
        },
      }];
    }),
  }), [logisticsMissions, showLogistics, airportsById]);

  const fcConvoyLines = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showConvoys ? [] : (convoys || []).flatMap((convoy) => {
      if (!Array.isArray(convoy.routeLine) || convoy.routeLine.length < 2) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: convoy.routeLine.map((point) => [point[1], point[0]]),
        },
        properties: {
          id: convoy.convoy_id || '',
          status: convoy.status || 'active',
          bearing: Number.isFinite(convoy.bearing) ? convoy.bearing : 0,
        },
      }];
    }),
  }), [convoys, showConvoys]);

  const fcConvoyPoints = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showConvoys ? [] : (convoys || []).flatMap((convoy) => {
      const marker = convoy.movingPosition || convoy.lastPosition;
      if (!Array.isArray(marker) || marker.length < 2) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker[1], marker[0]],
        },
        properties: {
          id: convoy.convoy_id || '',
          status: convoy.status || 'active',
          last_update: Number.isFinite(Number(convoy.lastUpdateTs)) ? Number(convoy.lastUpdateTs) : null,
        },
      }];
    }),
  }), [convoys, showConvoys]);

  const fcAirliftPlayers = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showAirliftPlayers ? [] : (airliftPlayers || []).flatMap((player) => {
      const lat = Number(player?.lat);
      const lon = Number(player?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat],
        },
        properties: {
          id: String(player?.id || '').trim() || `${player?.name || 'player'}-${player?.airframe || player?.type_name || ''}`,
          name: String(player?.name || 'Unknown'),
          airframe: String(player?.airframe || player?.type_name || 'Airlift'),
          coalition: String(player?.coalition || ''),
          alt_m: Number.isFinite(Number(player?.alt_m)) ? Number(player.alt_m) : null,
        },
      }];
    }),
  }), [airliftPlayers, showAirliftPlayers]);

  const fcDcsarLinks = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showDcsar ? [] : (dcsarPoints || []).flatMap((point) => {
      const nearest = point?.nearest_airbase?.coordinates;
      if (!nearest || !Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [point.lon, point.lat],
            [nearest.lon, nearest.lat],
          ],
        },
        properties: {
          id: point.id || '',
          accepted: point.accepted ? 1 : 0,
        },
      }];
    }),
  }), [dcsarPoints, showDcsar]);

  const fcDcsarPoints = useMemo(() => {
    dcsarByIdRef.current = new Map();
    return {
      type: 'FeatureCollection',
      features: !showDcsar ? [] : (dcsarPoints || []).flatMap((point) => {
        if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return [];
        const id = String(point.id || '').trim();
        if (!id) return [];
        const accepted = point.accepted ? 1 : 0;

        dcsarByIdRef.current.set(id, point);

        return [{
          id,
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [point.lon, point.lat],
          },
          properties: {
            id,
            accepted,
          },
        }];
      }),
    };
  }, [dcsarPoints, showDcsar]);

  const fcZones = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showAto ? [] : (zones || []).flatMap((zone) => {
      if (!Number.isFinite(zone?.coordinates?.lat) || !Number.isFinite(zone?.coordinates?.lon)) return [];
      const isAccepted = zone.operation_assigned === true && Number(zone.operation_remaining_ms || 0) > 0;

      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [zone.coordinates.lon, zone.coordinates.lat],
        },
        properties: {
          id: zone.id || '',
          name: zone.name || zone.id || '',
          status: zone.status || 'UNKNOWN',
          selected: zone.id === selectedZoneId ? 1 : 0,
          accepted: isAccepted ? 1 : 0,
        },
      }];
    }),
  }), [zones, showAto, selectedZoneId]);

  const fcAirports = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showAirports ? [] : (airportsData || []).flatMap((airport) => {
      if (!Number.isFinite(airport?.coordinates?.lat) || !Number.isFinite(airport?.coordinates?.lon)) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [airport.coordinates.lon, airport.coordinates.lat],
        },
        properties: {
          id: airport.id || '',
          name: airport.displayName || airport.name || airport.id || '',
          main: airport.isMainBase ? 1 : 0,
          carrier: airport.isCarrier ? 1 : 0,
        },
      }];
    }),
  }), [airportsData, showAirports]);

  const fcProductionPoints = useMemo(() => ({
    type: 'FeatureCollection',
    features: !showProductionPoints ? [] : (productionPoints || []).flatMap((pp) => {
      if (!Number.isFinite(pp?.coordinates?.lat) || !Number.isFinite(pp?.coordinates?.lon)) return [];
      const owner = String(pp.owner || 'NEUTRAL').toUpperCase();
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pp.coordinates.lon, pp.coordinates.lat],
        },
        properties: {
          id: pp.id || pp.zone_name || '',
          name: pp.zone_name || pp.id || 'PP',
          owner,
          level: Number(pp.level) || 0,
          upgrading: pp.upgrading ? 1 : 0,
          selected: pp.id === selectedProductionPointId ? 1 : 0,
        },
      }];
    }),
  }), [productionPoints, showProductionPoints, selectedProductionPointId]);

  const fcWebSpawnMarkers = useMemo(() => ({
    type: 'FeatureCollection',
    features: (webSpawnMarkers || []).flatMap((marker) => {
      if (!Number.isFinite(marker?.lat) || !Number.isFinite(marker?.lon)) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lon, marker.lat],
        },
        properties: {
          id: marker.id || '',
          label: marker.label || marker.keyword || marker.id || 'Crate',
        },
      }];
    }),
  }), [webSpawnMarkers]);

  const fcSpawnRadius = useMemo(() => {
    if (!spawnPlacementActive || !spawnAirportCenter) {
      return { type: 'FeatureCollection', features: [] };
    }
    const lat = Number(spawnAirportCenter.lat);
    const lon = Number(spawnAirportCenter.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [circlePolygon(lat, lon, AIRPORT_SPAWN_RADIUS_M)],
    };
  }, [spawnPlacementActive, spawnAirportCenter]);

  const disposeThreeNode = useCallback((node) => {
    if (!node) return;
    node.traverse?.((entry) => {
      if (!entry?.isMesh) return;
      if (entry.userData?.disposeGeometry && entry.geometry?.dispose) {
        entry.geometry.dispose();
      }
      if (Array.isArray(entry.material)) {
        entry.material.forEach((material) => material?.dispose && material.dispose());
      } else if (entry.material?.dispose) {
        entry.material.dispose();
      }
    });
  }, []);

  const rebuildThreeDomes = useCallback(() => {
    const map = mapRef.current;
    const group = domes3dRef.current.group;
    if (!map || !group) return;

    while (group.children.length > 0) {
      const child = group.children.pop();
      disposeThreeNode(child);
    }
    domes3dRef.current.domes = [];
    domes3dRef.current.routes = [];

    if (!showAto && !showLogistics && !showConvoys && !showAirliftPlayers) {
      map.triggerRepaint();
      return;
    }

    if (showAto && !domes3dRef.current.geometry) {
      const domeGeometry = new THREE.SphereGeometry(1, 64, 48, 0, Math.PI * 2, 0, Math.PI / 2);
      domeGeometry.rotateX(Math.PI / 2);
      domes3dRef.current.geometry = domeGeometry;
    }

    if (showAto) (zones || []).forEach((zone) => {
      const lat = Number(zone?.coordinates?.lat);
      const lon = Number(zone?.coordinates?.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const isAccepted = zone.operation_assigned === true && Number(zone.operation_remaining_ms || 0) > 0;
      const isSelected = zone.id === selectedZoneId;

      let color = '#e2e8f0';
      if (isAccepted) color = '#22c55e';
      else if (zone.status === 'RED') color = '#ef4444';
      else if (zone.status === 'BLUE') color = '#3b82f6';
      else if (zone.status === 'UNDER_ATTACK') color = '#f97316';

      const terrainElevation = map.queryTerrainElevation([lon, lat]);
      const altitudeMeters = (Number.isFinite(terrainElevation) ? terrainElevation : 0) + 20;
      const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altitudeMeters);
      const scale = merc.meterInMercatorCoordinateUnits() * ZONE_DOME_RADIUS_METERS;

      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: isSelected ? 0.55 : 0.42,
        depthTest: true,
        depthWrite: true,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.08,
      });
      const mesh = new THREE.Mesh(domes3dRef.current.geometry, material);
      mesh.position.set(merc.x, merc.y, merc.z);
      mesh.scale.set(scale, scale, scale);
      mesh.renderOrder = 10;
      group.add(mesh);

      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isSelected ? 0.28 : 0.2,
        blending: THREE.AdditiveBlending,
        depthTest: true,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const glowMesh = new THREE.Mesh(domes3dRef.current.geometry, glowMaterial);
      glowMesh.position.set(merc.x, merc.y, merc.z);
      glowMesh.scale.set(scale * 1.045, scale * 1.045, scale * 1.045);
      glowMesh.renderOrder = 11;
      group.add(glowMesh);

      domes3dRef.current.domes.push({
        lon,
        lat,
        isSelected,
        main: mesh,
        glow: glowMesh,
        mainBaseOpacity: isSelected ? 0.55 : 0.42,
        glowBaseOpacity: isSelected ? 0.28 : 0.2,
      });
    });

    if (showLogistics) {
      const routesByKey = new Map();
      (logisticsMissions || []).forEach((mission) => {
        const srcId = String(mission?.source_airport_id || '');
        const dstId = String(mission?.airport_id || '');
        if (!srcId || !dstId) return;
        if (!(logisticsFrontlineAirportIds instanceof Set) || !logisticsFrontlineAirportIds.has(dstId)) return;
        const routeKey = `${srcId}->${dstId}`;
        const current = routesByKey.get(routeKey);
        if (!current) {
          routesByKey.set(routeKey, mission);
          return;
        }
        if (current.status !== 'accepted' && mission.status === 'accepted') {
          routesByKey.set(routeKey, mission);
        }
      });

      Array.from(routesByKey.values()).forEach((mission) => {
        const sourceAirport = airportsById.get(mission.source_airport_id);
        const destinationAirport = airportsById.get(mission.airport_id);
        const srcLat = Number(sourceAirport?.coordinates?.lat);
        const srcLon = Number(sourceAirport?.coordinates?.lon);
        const dstLat = Number(destinationAirport?.coordinates?.lat);
        const dstLon = Number(destinationAirport?.coordinates?.lon);
        if (!Number.isFinite(srcLat) || !Number.isFinite(srcLon) || !Number.isFinite(dstLat) || !Number.isFinite(dstLon)) {
          return;
        }

        const distMeters = haversineNm(srcLat, srcLon, dstLat, dstLon) * 1852;
        const routeUsesCh47 = sourceAirport?.isCarrier === true || distMeters < LOGISTICS_CH47_DISTANCE_THRESHOLD_METERS;
        const arcPeakMeters = routeUsesCh47
          ? Math.max(220, Math.min(1800, distMeters * 0.07))
          : Math.max(1600, Math.min(9000, distMeters * 0.24));
        const segments = 24;
        const points = [];

        for (let i = 0; i <= segments; i += 1) {
          const t = i / segments;
          const lat = srcLat + ((dstLat - srcLat) * t);
          const lon = srcLon + ((dstLon - srcLon) * t);
          const terrain = map.queryTerrainElevation([lon, lat]);
          const lift = Math.sin(Math.PI * t) ** 1.25 * arcPeakMeters;
          const alt = (Number.isFinite(terrain) ? terrain : 0) + lift;
          const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], alt);
          points.push(new THREE.Vector3(merc.x, merc.y, merc.z));
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const midMerc = maplibregl.MercatorCoordinate.fromLngLat(
          [(srcLon + dstLon) / 2, (srcLat + dstLat) / 2],
          0
        );
        const tubeRadius = midMerc.meterInMercatorCoordinateUnits() * LOGISTICS_ROUTE_RADIUS_METERS;
        const tubeGeometry = new THREE.TubeGeometry(curve, 64, tubeRadius, 10, false);
        const routeColor = mission.status === 'accepted' ? '#f97316' : '#4ec5ff';
        const routeMaterial = new THREE.MeshPhongMaterial({
          color: routeColor,
          emissive: new THREE.Color(routeColor),
          emissiveIntensity: 0.14,
          transparent: true,
          opacity: 0.78,
          depthTest: true,
          depthWrite: true,
        });

        const routeMesh = new THREE.Mesh(tubeGeometry, routeMaterial);
        routeMesh.userData.disposeGeometry = true;
        routeMesh.renderOrder = 9;
        group.add(routeMesh);

        const useCh47 = routeUsesCh47;
        const selectedTemplate = useCh47
          ? (domes3dRef.current.ch47Template || domes3dRef.current.c130Template)
          : (domes3dRef.current.c130Template || domes3dRef.current.ch47Template);

        if (selectedTemplate) {
          const planeRoot = selectedTemplate.clone(true);
          const seed = hashString(String(`${mission.source_airport_id}-${mission.airport_id}`));
          const t = 0.2 + ((seed % 61) / 100); // 0.20..0.80
          const pos = curve.getPointAt(t);
          const routeBearingDeg = computeBearingDeg([srcLat, srcLon], [dstLat, dstLon]);
          const headingYaw = THREE.MathUtils.degToRad(routeBearingDeg) + Math.PI + (useCh47 ? LOGISTICS_CH47_YAW_OFFSET_RAD : 0);
          const midMerc = maplibregl.MercatorCoordinate.fromLngLat(
            [(srcLon + dstLon) / 2, (srcLat + dstLat) / 2],
            0
          );
          const modelSizeMeters = useCh47 ? LOGISTICS_CH47_MODEL_SIZE_METERS : LOGISTICS_C130_MODEL_SIZE_METERS;
          const modelScale = midMerc.meterInMercatorCoordinateUnits() * modelSizeMeters;
          const routeOpacity = 0.78;
          const routeColorThree = new THREE.Color(routeColor);

          planeRoot.position.copy(pos);
          planeRoot.scale.set(modelScale, modelScale, modelScale);
          // Base correction for GLB orientation + yaw from route bearing.
          const headingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), headingYaw);
          const levelQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ'));
          planeRoot.quaternion.copy(headingQuat).multiply(levelQuat);
          planeRoot.renderOrder = 12;

          planeRoot.traverse((child) => {
            if (child?.isMesh) {
              child.frustumCulled = false;
              if (Array.isArray(child.material)) {
                child.material = child.material.map((mat) => {
                  if (!mat) return mat;
                  const material = typeof mat.clone === 'function' ? mat.clone() : mat;
                  material.depthTest = true;
                  material.depthWrite = true;
                  material.toneMapped = false;
                  if (material.color) {
                    material.color = routeColorThree.clone();
                  }
                  if (material.emissive) {
                    material.emissive = routeColorThree.clone();
                    material.emissiveIntensity = 0.14;
                  }
                  material.transparent = true;
                  material.opacity = routeOpacity;
                  material.needsUpdate = true;
                  return material;
                });
              } else if (child.material) {
                if (typeof child.material.clone === 'function') {
                  const material = child.material.clone();
                  material.depthTest = true;
                  material.depthWrite = true;
                  material.toneMapped = false;
                  if (material.color) {
                    material.color = routeColorThree.clone();
                  }
                  if (material.emissive) {
                    material.emissive = routeColorThree.clone();
                    material.emissiveIntensity = 0.14;
                  }
                  material.transparent = true;
                  material.opacity = routeOpacity;
                  material.needsUpdate = true;
                  child.material = material;
                } else {
                  child.material.depthTest = true;
                  child.material.depthWrite = true;
                  child.material.toneMapped = false;
                  child.material.transparent = true;
                  child.material.opacity = routeOpacity;
                }
              }
            }
          });

          group.add(planeRoot);
        }
      });
    }

    if (showConvoys && (domes3dRef.current.convoyTemplate || domes3dRef.current.ch47Template || domes3dRef.current.c130Template)) {
      (convoys || []).forEach((convoy) => {
        const marker = convoy?.movingPosition || convoy?.lastPosition;
        if (!Array.isArray(marker) || marker.length < 2) return;
        const lat = Number(marker[0]);
        const lon = Number(marker[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const convoyTemplate = domes3dRef.current.convoyTemplate || domes3dRef.current.ch47Template || domes3dRef.current.c130Template;
        if (!convoyTemplate) return;
        const usingAircraftTemplate = convoyTemplate === domes3dRef.current.ch47Template || convoyTemplate === domes3dRef.current.c130Template;
        const terrain = map.queryTerrainElevation([lon, lat]);
        const altitudeOffsetMeters = usingAircraftTemplate ? 220 : 220;
        const altitudeMeters = (Number.isFinite(terrain) ? terrain : 0) + altitudeOffsetMeters;
        const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altitudeMeters);
        const tankRoot = convoyTemplate.clone(true);
        tankRoot.updateMatrixWorld(true);
        const tankBox = new THREE.Box3().setFromObject(tankRoot);
        const tankCenter = new THREE.Vector3();
        if (!tankBox.isEmpty()) {
          tankBox.getCenter(tankCenter);
          tankRoot.position.sub(tankCenter);
        }
        const convoyBearingDeg = Number.isFinite(convoy?.bearing) ? convoy.bearing : 0;
        const headingYaw = THREE.MathUtils.degToRad(convoyBearingDeg) + LOGISTICS_CONVOY_YAW_OFFSET_RAD;
        const modelSizeMeters = usingAircraftTemplate ? 95 : LOGISTICS_CONVOY_MODEL_SIZE_METERS;
        const modelScale = merc.meterInMercatorCoordinateUnits() * modelSizeMeters;

        const tankWrapper = new THREE.Group();
        tankWrapper.position.set(merc.x, merc.y, merc.z);
        tankWrapper.scale.set(modelScale, modelScale, modelScale);
        // Apply base axis correction + route heading.
        const headingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), headingYaw);
        const baseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ'));
        tankWrapper.quaternion.copy(headingQuat).multiply(baseQuat);
        tankWrapper.renderOrder = 12;

        const convoyColorHex = convoy?.status === 'arrived' ? '#22c55e' : '#ef4444';
        tankRoot.traverse((child) => {
          if (!child?.isMesh) return;
          child.frustumCulled = false;
          // Force a simple visible material; avoids incompatibilities with unsupported GLTF material extensions.
          child.material = new THREE.MeshPhongMaterial({
            color: convoyColorHex,
            emissive: convoyColorHex,
            emissiveIntensity: 0.1,
            depthTest: true,
            depthWrite: true,
            transparent: false,
            opacity: 1,
            side: THREE.DoubleSide,
          });
        });

        tankWrapper.add(tankRoot);
        group.add(tankWrapper);
      });
    }

    if (showAirliftPlayers && (domes3dRef.current.c130Template || domes3dRef.current.ch47Template)) {
      (airliftPlayers || []).forEach((player) => {
        const lat = Number(player?.lat);
        const lon = Number(player?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

        const airframe = String(player?.airframe || player?.type_name || '').toUpperCase();
        const useCh47Template = airframe.includes('CH-47') || airframe.includes('CH47') || airframe.includes('MI-8') || airframe.includes('MI8') || airframe.includes('UH-1') || airframe.includes('UH1');
        const template = useCh47Template
          ? (domes3dRef.current.ch47Template || domes3dRef.current.c130Template)
          : (domes3dRef.current.c130Template || domes3dRef.current.ch47Template);
        if (!template) return;

        const terrain = map.queryTerrainElevation([lon, lat]);
        const terrainAltitude = Number.isFinite(terrain) ? terrain : 0;
        const reportedAltitude = Number(player?.alt_m);
        const altitudeMeters = Number.isFinite(reportedAltitude)
          ? Math.max(reportedAltitude, terrainAltitude + AIRLIFT_MIN_CLEARANCE_METERS)
          : terrainAltitude + 260;
        const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altitudeMeters);
        const modelRoot = template.clone(true);
        const modelSizeMeters = useCh47Template ? AIRLIFT_CH47_MODEL_SIZE_METERS : AIRLIFT_C130_MODEL_SIZE_METERS;
        const modelScale = merc.meterInMercatorCoordinateUnits() * modelSizeMeters;
        const headingDeg = Number.isFinite(Number(player?.heading_deg)) ? Number(player.heading_deg) : 0;
        const headingYaw = THREE.MathUtils.degToRad(headingDeg) + Math.PI + (useCh47Template ? LOGISTICS_CH47_YAW_OFFSET_RAD : 0);
        const airliftColor = new THREE.Color('#22c55e');
        const airliftOpacity = 0.52;

        modelRoot.position.set(merc.x, merc.y, merc.z);
        modelRoot.scale.set(modelScale, modelScale, modelScale);
        const headingQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), headingYaw);
        const baseQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0, 'XYZ'));
        modelRoot.quaternion.copy(headingQuat).multiply(baseQuat);
        modelRoot.renderOrder = 13;

        modelRoot.traverse((child) => {
          if (!child?.isMesh) return;
          child.frustumCulled = false;
          if (Array.isArray(child.material)) {
            child.material = child.material.map((material) => {
              if (!material) return material;
              const nextMaterial = typeof material.clone === 'function' ? material.clone() : material;
              nextMaterial.depthTest = true;
              nextMaterial.depthWrite = true;
              if (nextMaterial.color) {
                nextMaterial.color = airliftColor.clone();
              }
              if (nextMaterial.emissive) {
                nextMaterial.emissive = airliftColor.clone();
                nextMaterial.emissiveIntensity = 0.16;
              }
              nextMaterial.transparent = true;
              nextMaterial.opacity = airliftOpacity;
              nextMaterial.needsUpdate = true;
              return nextMaterial;
            });
          } else if (child.material && typeof child.material.clone === 'function') {
            const nextMaterial = child.material.clone();
            nextMaterial.depthTest = true;
            nextMaterial.depthWrite = true;
            if (nextMaterial.color) {
              nextMaterial.color = airliftColor.clone();
            }
            if (nextMaterial.emissive) {
              nextMaterial.emissive = airliftColor.clone();
              nextMaterial.emissiveIntensity = 0.16;
            }
            nextMaterial.transparent = true;
            nextMaterial.opacity = airliftOpacity;
            nextMaterial.needsUpdate = true;
            child.material = nextMaterial;
          }
        });

        group.add(modelRoot);
      });
    }

    map.triggerRepaint();
  }, [zones, showAto, selectedZoneId, showLogistics, logisticsMissions, logisticsFrontlineAirportIds, airportsById, showConvoys, convoys, showAirliftPlayers, airliftPlayers, disposeThreeNode]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCamera = lastStableCameraRef.current;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style,
      antialias: true,
      center: initialCamera ? [initialCamera.lng, initialCamera.lat] : [center.lon, center.lat],
      zoom: initialCamera ? initialCamera.zoom : 7,
      minZoom: MIN_SAFE_ZOOM,
      maxZoom: effectiveMaxZoom,
      pitch: initialCamera ? initialCamera.pitch : 0,
      bearing: initialCamera ? initialCamera.bearing : 0,
      minPitch: MIN_PITCH,
      maxPitch: MAX_PITCH,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), MAPLIBRE_NAV_CONTROL_POSITION);
    // Reduce zoom aggressiveness from fast wheel input to avoid unstable camera states.
    map.scrollZoom.setWheelZoomRate(1 / 1500);
    map.scrollZoom.setZoomRate(1 / 220);
    const markUserCameraInteraction = () => {
      userCameraLockUntilRef.current = Date.now() + 2500;
      lastUserInputAtRef.current = Date.now();
    };
    logMapDebug('map-mounted', { center: [center.lon, center.lat] });
    map.on('error', (event) => {
      console.error('MapLibre runtime error:', event?.error || event);
      logMapDebug('map-error', { error: String(event?.error || event) });
    });
    map.on('dragstart', (event) => {
      if (event?.originalEvent) markUserCameraInteraction();
    });
    map.on('zoomstart', (event) => {
      if (event?.originalEvent) markUserCameraInteraction();
    });
    map.on('rotatestart', (event) => {
      if (event?.originalEvent) markUserCameraInteraction();
    });
    map.on('pitchstart', (event) => {
      if (event?.originalEvent) markUserCameraInteraction();
    });

    map.on('load', async () => {
      popupRef.current = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 10,
        className: 'frontline-hover-popup',
        maxWidth: '180px',
      });
      // Enable real 3D terrain after style load; keep it resilient if terrain is unavailable.
      try {
        map.setTerrain({ source: 'terrainDem', exaggeration: 1.0 });
      } catch (error) {
        console.warn('Terrain could not be enabled, continuing without 3D terrain:', error);
      }

      const showHoverPopup = (lngLat, html) => {
        if (!popupRef.current || !html) return;
        popupRef.current.setLngLat(lngLat).setHTML(html).addTo(map);
      };
      const hideHoverPopup = () => {
        if (popupRef.current) {
          popupRef.current.remove();
        }
      };

      const addGeoSource = (id, data) => {
        map.addSource(id, { type: 'geojson', data });
      };

      try {
        await ensureMapLibreDcsarIconImages(map);
      } catch (error) {
        console.error('Failed to initialize DCSAR icon images:', error);
      }
      try {
        await ensureMapLibreAirportIconImages(map);
      } catch (error) {
        console.error('Failed to initialize airport icon image:', error);
      }

      addGeoSource('grid-src', fcGrid);
      addGeoSource('logistics-src', fcLogistics);
      addGeoSource('convoy-lines-src', fcConvoyLines);
      addGeoSource('convoy-points-src', fcConvoyPoints);
      addGeoSource('airlift-players-src', fcAirliftPlayers);
      addGeoSource('dcsar-links-src', fcDcsarLinks);
      addGeoSource('dcsar-points-src', fcDcsarPoints);
      addGeoSource('zones-src', fcZones);
      addGeoSource('airports-src', fcAirports);
      addGeoSource('production-points-src', fcProductionPoints);

      const domeLayer = {
        id: 'zone-domes-3d-layer',
        type: 'custom',
        renderingMode: '3d',
        onAdd: (_map, gl) => {
          const scene = new THREE.Scene();
          const camera = new THREE.Camera();
          const renderer = new THREE.WebGLRenderer({
            canvas: _map.getCanvas(),
            context: gl,
            antialias: true,
          });
          renderer.autoClear = false;

          const group = new THREE.Group();
          scene.add(group);

          scene.add(new THREE.AmbientLight('#ffffff', 1.0));
          const dirLight = new THREE.DirectionalLight('#ffffff', 1.25);
          dirLight.position.set(0, -70, 120);
          scene.add(dirLight);

          domes3dRef.current.scene = scene;
          domes3dRef.current.camera = camera;
          domes3dRef.current.renderer = renderer;
          domes3dRef.current.group = group;

          if (!domes3dRef.current.planeLoaderPromise) {
            const loader = new GLTFLoader();
            const prepareTemplate = (gltfScene) => {
              const template = gltfScene?.scene;
              if (!template) return null;
              template.traverse((child) => {
                if (child?.isMesh) {
                  child.frustumCulled = false;
                }
              });
              return template;
            };

            domes3dRef.current.planeLoaderPromise = Promise.allSettled([
              loader.loadAsync(c130ModelUrl),
              loader.loadAsync(ch47ModelUrl),
              loader.loadAsync(t72ModelUrl),
            ])
              .then((results) => {
                const c130Result = results[0];
                const ch47Result = results[1];
                const t72Result = results[2];
                if (c130Result.status === 'fulfilled') {
                  domes3dRef.current.c130Template = prepareTemplate(c130Result.value);
                } else {
                  console.error('Failed to load C130 model:', c130Result.reason);
                }
                if (ch47Result.status === 'fulfilled') {
                  domes3dRef.current.ch47Template = prepareTemplate(ch47Result.value);
                } else {
                  console.error('Failed to load CH47 model:', ch47Result.reason);
                }
                if (t72Result.status === 'fulfilled') {
                  domes3dRef.current.convoyTemplate = prepareTemplate(t72Result.value);
                } else {
                  console.error('Failed to load T72 model:', t72Result.reason);
                }
                rebuildThreeDomes();
                map.triggerRepaint();
              })
              .catch((error) => {
                console.error('Failed to load aircraft models:', error);
              });
          } else if (
            domes3dRef.current.c130Template
            || domes3dRef.current.ch47Template
            || domes3dRef.current.convoyTemplate
          ) {
            rebuildThreeDomes();
            map.triggerRepaint();
          }
        },
        render: (_gl, matrix, args) => {
          const { renderer, scene, camera, domes } = domes3dRef.current;
          if (!renderer || !scene || !camera) return;
          const projectionMatrix = Array.isArray(matrix)
            ? matrix
            : (args?.modelViewProjectionMatrix || args?.projectionMatrix || matrix);
          camera.projectionMatrix = new THREE.Matrix4().fromArray(projectionMatrix);

          domes.forEach((dome) => {
            dome.main.material.opacity = dome.mainBaseOpacity;
            dome.glow.material.opacity = dome.glowBaseOpacity;
          });

          renderer.resetState();
          renderer.render(scene, camera);
        },
      };
      map.addLayer(domeLayer);
      rebuildThreeDomes();

      map.addLayer({
        id: 'grid-layer',
        type: 'line',
        source: 'grid-src',
        paint: {
          'line-color': '#9aaec4',
          'line-width': 1,
          'line-opacity': 0.22,
          'line-dasharray': [3, 7],
        },
      });

      map.addLayer({
        id: 'logistics-hit-pending',
        type: 'line',
        source: 'logistics-src',
        filter: ['==', ['get', 'status'], 'pending'],
        paint: {
          'line-color': '#4ec5ff',
          'line-width': 14,
          'line-opacity': 0.001,
        },
      });
      map.addLayer({
        id: 'logistics-hit-accepted',
        type: 'line',
        source: 'logistics-src',
        filter: ['==', ['get', 'status'], 'accepted'],
        paint: {
          'line-color': '#f97316',
          'line-width': 14,
          'line-opacity': 0.001,
        },
      });

      map.addLayer({
        id: 'convoy-lines-layer',
        type: 'line',
        source: 'convoy-lines-src',
        paint: {
          'line-color': ['case', ['==', ['get', 'status'], 'arrived'], '#22c55e', '#ef4444'],
          'line-width': ['case', ['==', ['get', 'status'], 'arrived'], 3, 2.5],
          'line-opacity': 0.8,
        },
      });
      map.addLayer({
        id: 'convoy-points-hit-layer',
        type: 'circle',
        source: 'convoy-points-src',
        paint: {
          'circle-radius': 18,
          'circle-color': '#000000',
          'circle-opacity': 0.001,
        },
      });
      map.addLayer({
        id: 'airlift-players-hit-layer',
        type: 'circle',
        source: 'airlift-players-src',
        paint: {
          'circle-radius': 14,
          'circle-color': '#000000',
          'circle-opacity': 0.001,
        },
      });

      map.addLayer({
        id: 'dcsar-links-accepted-layer',
        type: 'line',
        source: 'dcsar-links-src',
        filter: ['==', ['get', 'accepted'], 1],
        paint: {
          'line-color': '#22c55e',
          'line-width': 2.8,
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'dcsar-links-pending-layer',
        type: 'line',
        source: 'dcsar-links-src',
        filter: ['!=', ['get', 'accepted'], 1],
        paint: {
          'line-color': '#ffffff',
          'line-width': 2.2,
          'line-opacity': 0.9,
          'line-dasharray': [2, 2],
        },
      });

      map.addLayer({
        id: 'dcsar-icons-pending-layer',
        type: 'symbol',
        source: 'dcsar-points-src',
        filter: ['!=', ['get', 'accepted'], 1],
        layout: {
          'icon-image': MAPLIBRE_DCSAR_ICON_PENDING_IMAGE_ID,
          'icon-size': MAPLIBRE_DCSAR_ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map',
        },
      });
      map.addLayer({
        id: 'dcsar-icons-accepted-layer',
        type: 'symbol',
        source: 'dcsar-points-src',
        filter: ['==', ['get', 'accepted'], 1],
        layout: {
          'icon-image': MAPLIBRE_DCSAR_ICON_ACCEPTED_IMAGE_ID,
          'icon-size': MAPLIBRE_DCSAR_ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map',
        },
      });
      map.addLayer({
        id: 'dcsar-points-hit-layer',
        type: 'circle',
        source: 'dcsar-points-src',
        paint: {
          'circle-radius': 14,
          'circle-color': '#000000',
          'circle-opacity': 0.001,
        },
      });



      map.addLayer({
        id: 'zones-hit-layer',
        type: 'circle',
        source: 'zones-src',
        paint: {
          'circle-radius': 18,
          'circle-color': '#000000',
          'circle-opacity': 0.001,
        },
      });

      map.addLayer({
        id: 'airports-glow-layer',
        type: 'circle',
        source: 'airports-src',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'main'], 1], 11, 9],
          'circle-color': ['case', ['==', ['get', 'main'], 1], '#22c55e', '#60a5fa'],
          'circle-opacity': 0.16,
        },
      });

      map.addLayer({
        id: 'airports-core-layer',
        type: 'symbol',
        source: 'airports-src',
        layout: {
          'icon-image': [
            'case',
            ['==', ['get', 'carrier'], 1], MAPLIBRE_AIRPORT_ICON_ANCHOR_IMAGE_ID,
            ['==', ['get', 'main'], 1], MAPLIBRE_AIRPORT_ICON_TOWER_GREEN_IMAGE_ID,
            MAPLIBRE_AIRPORT_ICON_TOWER_BLUE_IMAGE_ID,
          ],
          'icon-size': MAPLIBRE_AIRPORT_ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          'icon-pitch-alignment': 'map',
          'icon-rotation-alignment': 'map',
        },
      });

      map.addLayer({
        id: 'production-points-layer',
        type: 'circle',
        source: 'production-points-src',
        paint: {
          'circle-radius': ['case', ['==', ['get', 'selected'], 1], 11, 8],
          'circle-color': [
            'match',
            ['get', 'owner'],
            'BLUE', '#3b82f6',
            'RED', '#ef4444',
            'CONTESTED', '#f97316',
            '#e2e8f0',
          ],
          'circle-opacity': 0.78,
          'circle-stroke-color': ['case', ['==', ['get', 'upgrading'], 1], '#facc15', '#ffffff'],
          'circle-stroke-width': ['case', ['==', ['get', 'upgrading'], 1], 3, ['case', ['==', ['get', 'selected'], 1], 2.5, 1.5]],
        },
      });

      map.addLayer({
        id: 'production-points-hit-layer',
        type: 'circle',
        source: 'production-points-src',
        paint: {
          'circle-radius': 16,
          'circle-color': '#000000',
          'circle-opacity': 0.001,
        },
      });

      map.on('click', 'production-points-hit-layer', (event) => {
        const feature = event?.features?.[0];
        const ppId = feature?.properties?.id;
        if (ppId && onProductionPointSelect) onProductionPointSelect(ppId);
      });

      map.on('mousemove', 'production-points-hit-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const name = feature?.properties?.name || feature?.properties?.id || 'PP';
        const level = feature?.properties?.level ?? 0;
        const upgrading = Number(feature?.properties?.upgrading) === 1;
        showHoverPopup(
          event.lngLat,
          `<div style="font-size:11px;font-weight:600;">${name} • LV${level}${upgrading ? ' • UPGRADING' : ''}</div>`
        );
      });
      map.on('mouseleave', 'production-points-hit-layer', () => {
        map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      addGeoSource('web-spawn-markers-src', fcWebSpawnMarkers);
      addGeoSource('spawn-radius-src', fcSpawnRadius);

      map.addLayer({
        id: 'spawn-radius-fill-layer',
        type: 'fill',
        source: 'spawn-radius-src',
        paint: {
          'fill-color': '#facc15',
          'fill-opacity': 0.06,
        },
      });

      map.addLayer({
        id: 'spawn-radius-line-layer',
        type: 'line',
        source: 'spawn-radius-src',
        paint: {
          'line-color': '#facc15',
          'line-width': 2,
          'line-dasharray': [2, 2],
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'web-spawn-markers-layer',
        type: 'circle',
        source: 'web-spawn-markers-src',
        paint: {
          'circle-radius': 7,
          'circle-color': '#f59e0b',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      });

      map.on('mousemove', 'web-spawn-markers-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const label = feature?.properties?.label || 'Crate';
        showHoverPopup(event.lngLat, `<div style="font-size:11px;font-weight:600;">${label}</div>`);
      });
      map.on('mouseleave', 'web-spawn-markers-layer', () => {
        if (!spawnPlacementActive) map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      map.on('click', 'zones-hit-layer', (event) => {
        const feature = event?.features?.[0];
        const zoneId = feature?.properties?.id;
        if (zoneId && onZoneSelect) onZoneSelect(zoneId);
      });

      map.on('mousemove', 'zones-hit-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const zoneId = feature?.properties?.id;
        if (onZoneHover) onZoneHover(zoneId || null);
        const name = feature?.properties?.name || zoneId || 'Zone';
        showHoverPopup(event.lngLat, `<div style="font-size:11px;font-weight:600;">${name}</div>`);
      });
      map.on('mouseleave', 'zones-hit-layer', () => {
        map.getCanvas().style.cursor = '';
        if (onZoneHover) onZoneHover(null);
        hideHoverPopup();
      });

      map.on('click', 'airports-core-layer', (event) => {
        const feature = event?.features?.[0];
        const airportId = feature?.properties?.id;
        if (airportId && onAirportClick) onAirportClick(airportId);
      });
      map.on('mousemove', 'airports-core-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const airportName = feature?.properties?.name || feature?.properties?.id || 'Airport';
        showHoverPopup(event.lngLat, `<div style="font-size:11px;font-weight:600;">${airportName}</div>`);
      });
      map.on('mouseleave', 'airports-core-layer', () => {
        map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      map.on('click', 'convoy-points-hit-layer', (event) => {
        const feature = event?.features?.[0];
        const convoyId = String(feature?.properties?.id || '').trim() || 'unknown';
        const status = String(feature?.properties?.status || 'active');
        const lastUpdateRaw = Number(feature?.properties?.last_update);
        const lastUpdateText = Number.isFinite(lastUpdateRaw)
          ? formatRelativeTime(lastUpdateRaw)
          : 'unknown';
        showHoverPopup(
          event.lngLat,
          `<div style="font-size:11px;font-weight:600;">Convoy ${convoyId}</div><div style="font-size:10px;opacity:0.9;">Status: ${status}</div><div style="font-size:10px;opacity:0.9;">Ultimo aggiornamento: ${lastUpdateText}</div>`
        );
      });
      map.on('mousemove', 'convoy-points-hit-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'convoy-points-hit-layer', () => {
        map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      map.on('mousemove', 'airlift-players-hit-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const name = String(feature?.properties?.name || 'Unknown');
        const airframe = String(feature?.properties?.airframe || 'Airlift');
        const alt = Number(feature?.properties?.alt_m);
        const altText = Number.isFinite(alt) ? `${Math.round(alt)} m` : 'n/a';
        showHoverPopup(
          event.lngLat,
          `<div style="font-size:11px;font-weight:600;">${name}</div><div style="font-size:10px;opacity:0.9;">${airframe}</div><div style="font-size:10px;opacity:0.9;">Alt: ${altText}</div>`
        );
      });
      map.on('mouseleave', 'airlift-players-hit-layer', () => {
        map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      map.on('click', 'dcsar-points-hit-layer', (event) => {
        const feature = event?.features?.[0];
        const dcsarId = String(feature?.properties?.id || '').trim();
        if (!dcsarId || !onDcsarSelect) return;
        const point = dcsarByIdRef.current.get(dcsarId);
        if (point) onDcsarSelect(point);
      });
      map.on('mousemove', 'dcsar-points-hit-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const dcsarId = String(feature?.properties?.id || '').trim();
        const accepted = Number(feature?.properties?.accepted) === 1;
        if (onDcsarHover) onDcsarHover(dcsarId || null);
        const label = dcsarId ? `CSAR ${dcsarId}` : 'CSAR';
        const status = accepted ? 'Accepted' : 'Pending';
        showHoverPopup(
          event.lngLat,
          `<div style="font-size:11px;font-weight:600;">${label}</div><div style="font-size:10px;opacity:0.9;">${status}</div>`
        );
      });
      map.on('mouseleave', 'dcsar-points-hit-layer', () => {
        map.getCanvas().style.cursor = '';
        if (onDcsarHover) onDcsarHover(null);
        hideHoverPopup();
      });

      map.on('mousemove', 'logistics-hit-pending', () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mousemove', 'logistics-hit-accepted', () => {
        map.getCanvas().style.cursor = '';
      });

      map.on('zoomend', () => {
        if (onZoomChange) onZoomChange(map.getZoom());
      });
      map.on('moveend', () => {
        const c = map.getCenter();
        const cam = {
          lng: Number(c.lng.toFixed(6)),
          lat: Number(c.lat.toFixed(6)),
          zoom: Number(map.getZoom().toFixed(3)),
          pitch: Number(map.getPitch().toFixed(2)),
          bearing: Number(map.getBearing().toFixed(2)),
        };
        const prev = prevCameraRef.current;
        const delta = prev ? {
          dLng: Number((cam.lng - prev.lng).toFixed(6)),
          dLat: Number((cam.lat - prev.lat).toFixed(6)),
          dZoom: Number((cam.zoom - prev.zoom).toFixed(3)),
          dPitch: Number((cam.pitch - prev.pitch).toFixed(2)),
        } : null;
        prevCameraRef.current = cam;
        lastStableCameraRef.current = cam;
        logMapDebug('moveend', {
          cam,
          delta,
          msSinceUserInput: Date.now() - lastUserInputAtRef.current,
        });
      });
      map.on('zoom', () => {
        if (zoomGuardRef.current) return;
        const currentZoom = map.getZoom();
        const clampedZoom = Math.max(MIN_SAFE_ZOOM, Math.min(map.getMaxZoom(), currentZoom));
        if (Math.abs(clampedZoom - currentZoom) > 0.001) {
          zoomGuardRef.current = true;
          map.setZoom(clampedZoom);
          zoomGuardRef.current = false;
        }
      });
      map.on('move', () => {
        const currentPitch = map.getPitch();
        const clampedPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, currentPitch));
        if (Math.abs(clampedPitch - currentPitch) > 0.001) {
          map.setPitch(clampedPitch);
        }
      });
      if (onZoomChange) onZoomChange(map.getZoom());

      // Initial framing: ensure zones are visible at first render.
      if (!lastStableCameraRef.current && fcZones.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        fcZones.features.forEach((feature) => {
          const coords = feature?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2) {
            bounds.extend([coords[0], coords[1]]);
          }
        });
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 60, duration: 0 });
        }
      }

      window.requestAnimationFrame(() => {
        map.resize();
        window.requestAnimationFrame(() => {
          map.resize();
        });
      });
    });

    return () => {
      logMapDebug('map-unmount');
      if (domes3dRef.current.group) {
        while (domes3dRef.current.group.children.length > 0) {
          const child = domes3dRef.current.group.children.pop();
          disposeThreeNode(child);
        }
      }
      if (domes3dRef.current.geometry) {
        domes3dRef.current.geometry.dispose();
        domes3dRef.current.geometry = null;
      }
      if (domes3dRef.current.renderer) {
        domes3dRef.current.renderer.dispose();
      }
      map.remove();
      mapRef.current = null;
    };
  }, [style, logMapDebug, disposeThreeNode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('grid-src');
    if (source?.setData) source.setData(fcGrid);
  }, [fcGrid]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('logistics-src');
    if (source?.setData) source.setData(fcLogistics);
  }, [fcLogistics]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('convoy-lines-src');
    if (source?.setData) source.setData(fcConvoyLines);
  }, [fcConvoyLines]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('convoy-points-src');
    if (source?.setData) source.setData(fcConvoyPoints);
  }, [fcConvoyPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('airlift-players-src');
    if (source?.setData) source.setData(fcAirliftPlayers);
  }, [fcAirliftPlayers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('dcsar-links-src');
    if (source?.setData) source.setData(fcDcsarLinks);
  }, [fcDcsarLinks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('dcsar-points-src');
    if (source?.setData) source.setData(fcDcsarPoints);
  }, [fcDcsarPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('zones-src');
    if (source?.setData) source.setData(fcZones);
  }, [fcZones]);

  useEffect(() => {
    rebuildThreeDomes();
  }, [rebuildThreeDomes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('airports-src');
    if (source?.setData) source.setData(fcAirports);
  }, [fcAirports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('production-points-src');
    if (source?.setData) source.setData(fcProductionPoints);
  }, [fcProductionPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('web-spawn-markers-src');
    if (source?.setData) source.setData(fcWebSpawnMarkers);
  }, [fcWebSpawnMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('spawn-radius-src');
    if (source?.setData) source.setData(fcSpawnRadius);
  }, [fcSpawnRadius]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMaxZoom(effectiveMaxZoom);
  }, [effectiveMaxZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleSpawnClick = (event) => {
      if (!spawnPlacementActive || !onSpawnPlace) return;
      const { lat, lng } = event.lngLat || {};
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        onSpawnPlace({ lat, lon: lng });
      }
    };

    if (spawnPlacementActive) {
      map.on('click', handleSpawnClick);
      map.getCanvas().style.cursor = 'crosshair';
    }

    return () => {
      map.off('click', handleSpawnClick);
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
    };
  }, [spawnPlacementActive, onSpawnPlace]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyBasemapVisibility = () => {
      const darkVisible = basemapMode !== BASEMAP_MODE_SATELLITE;

      if (map.getLayer('carto-darkmatter-raster')) {
        map.setLayoutProperty('carto-darkmatter-raster', 'visibility', darkVisible ? 'visible' : 'none');
      }
      if (map.getLayer('esri-satellite-raster')) {
        map.setLayoutProperty('esri-satellite-raster', 'visibility', darkVisible ? 'none' : 'visible');
      }
    };

    if (map.isStyleLoaded()) {
      applyBasemapVisibility();
      return;
    }

    map.once('load', applyBasemapVisibility);
  }, [basemapMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusCoordinates || !focusTargetKey) return;
    if (Date.now() < userCameraLockUntilRef.current) return;
    if (map.isMoving()) return;

    const nextLat = Number(focusCoordinates.lat);
    const nextLon = Number(focusCoordinates.lon);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLon)) return;

    const previous = lastAutoFocusRef.current;
    if (
      previous &&
      Math.abs(previous.lat - nextLat) < 0.00001 &&
      Math.abs(previous.lon - nextLon) < 0.00001
    ) {
      return;
    }
    lastAutoFocusRef.current = { lat: nextLat, lon: nextLon };
    logMapDebug('autofocus-easeTo', {
      focusTargetKey,
      target: { lon: nextLon, lat: nextLat },
      currentZoom: Number(map.getZoom().toFixed(3)),
    });

    const focusZoom = String(focusTargetKey || '').startsWith('spawn:')
      ? Math.min(effectiveMaxZoom, 15)
      : Math.min(effectiveMaxZoom, map.getZoom() + 0.35);

    map.easeTo({
      center: [nextLon, nextLat],
      offset: [0, MAPLIBRE_FOCUS_Y_OFFSET_PX],
      zoom: focusZoom,
      duration: 950,
      easing: (t) => t * (2 - t),
    });
  }, [focusTargetKey, focusCoordinates, effectiveMaxZoom, logMapDebug]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const canvas = map.getCanvas();

    const onMouseDown = (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      userCameraLockUntilRef.current = Date.now() + 2500;
      middleDragRef.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseMove = (event) => {
      const state = middleDragRef.current;
      if (!state) return;
      event.preventDefault();

      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      const nextBearing = map.getBearing() + (dx * 0.25);
      const nextPitchRaw = map.getPitch() - (dy * 0.2);
      const nextPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, nextPitchRaw));

      map.setBearing(nextBearing);
      map.setPitch(nextPitch);

      middleDragRef.current = { x: event.clientX, y: event.clientY };
    };

    const onMouseUp = () => {
      middleDragRef.current = null;
    };

    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}

export default function FrontlineMap({ airportsData }) {
  const { user } = useUser();
  const canManageLogisticsRouteVisibility = user?.canManageLogisticsRouteVisibility === true;
  const isMapLibreEngine = MAP_ENGINE === 'maplibre';
  const [isDesktopDevice, setIsDesktopDevice] = useState(() => isDesktopGlobeDevice());
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [selectedZoneDetailsId, setSelectedZoneDetailsId] = useState(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [hoveredDcsarId, setHoveredDcsarId] = useState(null);
  const [selectedDcsarId, setSelectedDcsarId] = useState(null);
  const [zoneCoordinatesFormat, setZoneCoordinatesFormat] = useState('dms');
  const [dcsarCoordinatesFormat, setDcsarCoordinatesFormat] = useState('dms');
  const [selectedAirportId, setSelectedAirportId] = useState(null);
  const [selectedLogisticsMission, setSelectedLogisticsMission] = useState(null);
  const [selectedContainerIds, setSelectedContainerIds] = useState([]);
  const [composingMission, setComposingMission] = useState(false);
  const [showLogisticsComposeWindow, setShowLogisticsComposeWindow] = useState(false);
  const [logisticsWeaponSearch, setLogisticsWeaponSearch] = useState('');
  const [showLogisticsRequestWindow, setShowLogisticsRequestWindow] = useState(false);
  const [requestWeaponSearch, setRequestWeaponSearch] = useState('');
  const [requestWeaponId, setRequestWeaponId] = useState('');
  const [requestQuantity, setRequestQuantity] = useState(0);
  const [requestingOrder, setRequestingOrder] = useState(false);
  const [hiddenLogisticsRouteAirportIds, setHiddenLogisticsRouteAirportIds] = useState(new Set());
  const [updatingRoutePriorityAirportId, setUpdatingRoutePriorityAirportId] = useState(null);
  const [acceptingZoneOperationId, setAcceptingZoneOperationId] = useState(null);
  const [acceptingMissionId, setAcceptingMissionId] = useState(null);
  const [acceptingDcsarId, setAcceptingDcsarId] = useState(null);
  const [updatingDcsarId, setUpdatingDcsarId] = useState(null);
  const [updatingMissionId, setUpdatingMissionId] = useState(null);
  const [animationTick, setAnimationTick] = useState(Date.now());
  const [zones, setZones] = useState(frontlineZones);
  const [combatMissions, setCombatMissions] = useState([]);
  const [logisticsMissions, setLogisticsMissions] = useState([]);
  const [convoys, setConvoys] = useState([]);
  const [airliftPlayers, setAirliftPlayers] = useState([]);
  const [dcsarPoints, setDcsarPoints] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [overlayCollapsed, setOverlayCollapsed] = useState(false);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [zoneStatusMeta, setZoneStatusMeta] = useState({});
  const [mapMode, setMapMode] = useState(false);
  const [basemapMode, setBasemapMode] = useState(BASEMAP_MODE_DARK);
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
    showConvoys: false,
    showAirliftPlayers: false,
    showDcsar: true,
    showProductionPoints: true,
  });
  const mapModeRef = useRef(false);

  // DCORE bridge state (Production Points + web-initiated spawns)
  const [productionPoints, setProductionPoints] = useState([]);
  const [selectedProductionPointId, setSelectedProductionPointId] = useState(null);
  const [spawnOptions, setSpawnOptions] = useState({ infantry: [], crate: [] });
  // spawnMode: { airportId, type: 'inf_spawn'|'crate_spawn', keyword, label } | null
  const [spawnMode, setSpawnMode] = useState(null);
  const [webSpawnMarkers, setWebSpawnMarkers] = useState([]);
  const [submittingCommand, setSubmittingCommand] = useState(false);
  const [upgradingPpId, setUpgradingPpId] = useState(null);
  const [commandToast, setCommandToast] = useState(null);
  const pendingCommandIdsRef = useRef(new Set());
  const commandToastTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const loadRouteVisibility = async () => {
      try {
        const payload = await getLogisticsRouteVisibility();
        if (cancelled) return;
        const ids = Array.isArray(payload?.hiddenAirportIds) ? payload.hiddenAirportIds : [];
        setHiddenLogisticsRouteAirportIds(new Set(ids.map((entry) => String(entry))));
      } catch (error) {
        console.error('Failed to load logistics route visibility settings:', error);
      }
    };

    loadRouteVisibility();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const updateDeviceMode = () => {
      setIsDesktopDevice(isDesktopGlobeDevice());
    };
    updateDeviceMode();
    window.addEventListener('resize', updateDeviceMode);
    return () => {
      window.removeEventListener('resize', updateDeviceMode);
    };
  }, []);

  useEffect(() => {
    if (isMapLibreEngine) {
      setFilters((current) => ({
        ...current,
        showAto: true,
        showLogistics: true,
        showAirports: true,
        showConvoys: false,
        showAirliftPlayers: false,
        showDcsar: true,
      }));
    }
  }, [isMapLibreEngine]);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getFrontlineZones(), getCombatMissions(), getMissions(), getFeed(200), getConvoys(), getAirliftPlayers(), getDcsar()])
      .then(([zonesResult, combatResult, logisticsResult, feedResult, convoysResult, airliftPlayersResult, dcsarResult]) => {
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

        if (airliftPlayersResult.status === 'fulfilled') {
          const nextPlayers = airliftPlayersResult.value?.players || airliftPlayersResult.value;
          if (Array.isArray(nextPlayers)) {
            setAirliftPlayers(nextPlayers);
          }
        } else {
          console.error('Failed to load airlift players:', airliftPlayersResult.reason);
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

    const unsubscribeAirliftPlayers = socketService.on('airlift-players:updated', (data) => {
      const nextPlayers = data?.players || data;
      if (Array.isArray(nextPlayers)) {
        setAirliftPlayers(nextPlayers);
      }
    });

    const unsubscribeDcsar = socketService.on('dcsar:updated', (data) => {
      const nextPoints = data?.points || data;
      if (Array.isArray(nextPoints)) {
        setDcsarPoints(nextPoints);
      }
    });

    const unsubscribeRouteVisibility = socketService.on('logistics-route-visibility:updated', (data) => {
      const ids = Array.isArray(data?.hiddenAirportIds) ? data.hiddenAirportIds : [];
      setHiddenLogisticsRouteAirportIds(new Set(ids.map((entry) => String(entry))));
    });

    return () => {
      unsubscribe && unsubscribe();
      unsubscribeMissions && unsubscribeMissions();
      unsubscribeLogistics && unsubscribeLogistics();
      unsubscribeFeed && unsubscribeFeed();
      unsubscribeConvoys && unsubscribeConvoys();
      unsubscribeAirliftPlayers && unsubscribeAirliftPlayers();
      unsubscribeDcsar && unsubscribeDcsar();
      unsubscribeRouteVisibility && unsubscribeRouteVisibility();
    };
  }, []);

  // Initial load of Production Points + spawn catalog (DCORE bridge)
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getProductionPoints(), getSpawnOptions(), getWebSpawnMarkers()]).then(([ppResult, optionsResult, markersResult]) => {
      if (cancelled) return;
      if (ppResult.status === 'fulfilled') {
        const list = ppResult.value?.productionPoints || ppResult.value;
        if (Array.isArray(list)) setProductionPoints(list);
      }
      if (optionsResult.status === 'fulfilled' && optionsResult.value) {
        setSpawnOptions({
          infantry: Array.isArray(optionsResult.value.infantry) ? optionsResult.value.infantry : [],
          crate: Array.isArray(optionsResult.value.crate) ? optionsResult.value.crate : [],
        });
      }
      if (markersResult.status === 'fulfilled' && markersResult.value) {
        const list = markersResult.value?.markers || markersResult.value;
        if (Array.isArray(list)) setWebSpawnMarkers(list);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Socket subscriptions for Production Points + web command results
  useEffect(() => {
    const unsubscribePp = socketService.on('production-points:updated', (data) => {
      const list = data?.productionPoints || data;
      if (Array.isArray(list)) setProductionPoints(list);
    });

    const unsubscribeMarkers = socketService.on('web-spawn-markers:updated', (data) => {
      const list = data?.markers || data;
      if (Array.isArray(list)) setWebSpawnMarkers(list);
    });

    const unsubscribeResult = socketService.on('web-command:result', (data) => {
      if (!data || !data.id) return;
      if (!pendingCommandIdsRef.current.has(data.id)) return;
      pendingCommandIdsRef.current.delete(data.id);

      const isSpawn = data.type === 'inf_spawn' || data.type === 'crate_spawn';
      if (isSpawn && data.ok === true) return;

      if (commandToastTimerRef.current) {
        clearTimeout(commandToastTimerRef.current);
      }
      setCommandToast({
        ok: data.ok === true,
        message: data.message || (data.ok ? 'Command executed.' : 'Command failed.'),
        balance: Number.isFinite(Number(data.balance)) ? Number(data.balance) : null,
        ts: Date.now(),
      });
      commandToastTimerRef.current = setTimeout(() => setCommandToast(null), 8000);
    });

    return () => {
      unsubscribePp && unsubscribePp();
      unsubscribeMarkers && unsubscribeMarkers();
      unsubscribeResult && unsubscribeResult();
      if (commandToastTimerRef.current) {
        clearTimeout(commandToastTimerRef.current);
      }
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
        const latestPlayers = await getAirliftPlayers();
        const nextPlayers = latestPlayers?.players || latestPlayers;
        if (Array.isArray(nextPlayers)) {
          setAirliftPlayers(nextPlayers);
        }
      } catch (error) {
        console.error('Failed to refresh airlift players:', error);
      }
    }, 3000);

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
    if (isMapLibreEngine) return undefined;
    const interval = setInterval(() => {
      setAnimationTick(Date.now());
    }, 280);

    return () => clearInterval(interval);
  }, [isMapLibreEngine]);

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
    }, 320);

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
    const hasDynamicAirports = Array.isArray(airportsData) && airportsData.length > 0;
    const airportsList = hasDynamicAirports ? airportsData : airports;
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

  const zoneByGridKey = useMemo(() => {
    const map = new Map();
    validZones.forEach((zone) => {
      const key = getZoneGridKey(zone);
      if (!key) return;
      map.set(key, zone);
    });
    return map;
  }, [validZones]);

  const logisticsFrontlineAirportIds = useMemo(() => {
    const zoneByKey = new Map();
    validZones.forEach((zone) => {
      const key = getZoneGridKey(zone);
      if (!key) return;
      zoneByKey.set(key, zone);
    });

    const firstLineBlueZoneKeys = new Set();
    zoneByKey.forEach((zone, key) => {
      if (zone?.status !== 'BLUE') return;
      const hasRedNeighbor = getNeighborZoneGridKeys(key).some((neighborKey) => zoneByKey.get(neighborKey)?.status === 'RED');
      if (hasRedNeighbor) {
        firstLineBlueZoneKeys.add(key);
      }
    });

    const secondLineBlueZoneKeys = new Set();
    zoneByKey.forEach((zone, key) => {
      if (zone?.status !== 'BLUE') return;
      if (firstLineBlueZoneKeys.has(key)) return;
      const linkedToFirstLine = getNeighborZoneGridKeys(key).some((neighborKey) => firstLineBlueZoneKeys.has(neighborKey));
      if (linkedToFirstLine) {
        secondLineBlueZoneKeys.add(key);
      }
    });

    const eligibleBlueZoneKeys = new Set([
      ...Array.from(firstLineBlueZoneKeys),
      ...Array.from(secondLineBlueZoneKeys),
    ]);

    const keyedZones = Array.from(zoneByKey.entries()).filter(([, zone]) => (
      Number.isFinite(Number(zone?.coordinates?.lat)) && Number.isFinite(Number(zone?.coordinates?.lon))
    ));
    const eligibleAirportIds = new Set();

    validAirports.forEach((airport) => {
      const airportLat = Number(airport?.coordinates?.lat);
      const airportLon = Number(airport?.coordinates?.lon);
      if (!Number.isFinite(airportLat) || !Number.isFinite(airportLon)) return;

      let nearestZoneKey = null;
      let nearestDistanceNm = Number.POSITIVE_INFINITY;

      keyedZones.forEach(([zoneKey, zone]) => {
        const zoneLat = Number(zone.coordinates.lat);
        const zoneLon = Number(zone.coordinates.lon);
        const distanceNm = haversineNm(airportLat, airportLon, zoneLat, zoneLon);
        if (distanceNm < nearestDistanceNm) {
          nearestDistanceNm = distanceNm;
          nearestZoneKey = zoneKey;
        }
      });

      if (nearestZoneKey !== null && eligibleBlueZoneKeys.has(nearestZoneKey)) {
        eligibleAirportIds.add(String(airport.id));
      }
    });

    return eligibleAirportIds;
  }, [validZones, validAirports]);

  const gridConnections = useMemo(() => {
    const zoneByKey = new Map();

    validZones.forEach((zone) => {
      const key = getZoneGridKey(zone);
      if (!key || !zone?.coordinates) return;
      zoneByKey.set(key, zone);
    });

    const links = [];
    zoneByKey.forEach((zone, key) => {
      const rightKey = getRightZoneGridKey(key);
      const downKey = getDownZoneGridKey(key);

      if (rightKey !== null && zoneByKey.has(rightKey)) {
        const target = zoneByKey.get(rightKey);
        links.push({
          id: `grid-${key}-${rightKey}`,
          positions: [
            [zone.coordinates.lat, zone.coordinates.lon],
            [target.coordinates.lat, target.coordinates.lon],
          ],
        });
      }

      if (downKey !== null && zoneByKey.has(downKey)) {
        const target = zoneByKey.get(downKey);
        links.push({
          id: `grid-${key}-${downKey}`,
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
      const realPoint = toLatLngPoint(convoy.last_position);
      const lastPosition = realPoint || destinationPoint || originPoint || null;
      const movingPosition = lastPosition;
      const bearing = (movingPosition && destinationPoint)
        ? computeBearingDeg(movingPosition, destinationPoint)
        : ((originPoint && destinationPoint) ? computeBearingDeg(originPoint, destinationPoint) : 0);
      const lastUpdateTs = Number.isFinite(Number(convoy?.position_at))
        ? Number(convoy.position_at)
        : (Number.isFinite(Number(convoy?.last_update)) ? Number(convoy.last_update) : null);

      return {
        convoy_id: convoy.convoy_id,
        status: convoy.status || 'active',
        routeLine,
        bearing,
        movingPosition,
        lastPosition,
        lastUpdateTs,
      };
    }).filter((convoy) => convoy.routeLine.length >= 2 || convoy.movingPosition || convoy.lastPosition);
  }, [convoys, zoneCoordinatesById]);

  const airliftPlayerRenderData = useMemo(() => {
    return (airliftPlayers || [])
      .map((player, index) => {
        const lat = Number(player?.lat);
        const lon = Number(player?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          id: String(player?.id || `airlift_${index}`),
          name: String(player?.name || 'Unknown'),
          unit_name: String(player?.unit_name || ''),
          group_name: String(player?.group_name || ''),
          coalition: String(player?.coalition || '').toLowerCase(),
          airframe: String(player?.airframe || player?.type_name || 'Airlift'),
          type_name: String(player?.type_name || ''),
          alt_m: Number.isFinite(Number(player?.alt_m)) ? Number(player.alt_m) : null,
          heading_deg: Number.isFinite(Number(player?.heading_deg)) ? Number(player.heading_deg) : 0,
          lat,
          lon,
        };
      })
      .filter(Boolean);
  }, [airliftPlayers]);

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

  const routeVisibleLogisticsMissions = useMemo(() => {
    if (hiddenLogisticsRouteAirportIds.size === 0) {
      return filteredLogisticsMissions;
    }
    return filteredLogisticsMissions.filter((mission) => !hiddenLogisticsRouteAirportIds.has(String(mission.airport_id)));
  }, [filteredLogisticsMissions, hiddenLogisticsRouteAirportIds]);

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
  const spawnAirportCenter = useMemo(() => {
    if (!spawnMode) return null;
    const airport = airportsById.get(spawnMode.airportId);
    return airport?.coordinates || null;
  }, [spawnMode, airportsById]);

  const mapMaxZoom = spawnMode ? MAP_ZOOM_SPAWN_MAX : MAP_ZOOM_DEFAULT_MAX;

  const tacticalFocusCoordinates = spawnAirportCenter || selectedDcsarFocus || focusedZone?.coordinates || null;
  const tacticalFocusTargetKey = spawnMode
    ? `spawn:${spawnMode.airportId}`
    : (selectedDcsarId || selectedZoneId || null);

  const handleScaleChange = (scale) => {
    if (!isDesktopDevice) return;
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
    if (!isDesktopDevice) return;
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
  const currentUserName = user?.globalName || user?.username || user?.id || '';
  const activeAcceptedZonesByCurrentUser = useMemo(() => {
    if (!currentUserName) return [];
    return validZones.filter((zone) =>
      zone.operation_assigned === true &&
      zone.operation_assigned_to === currentUserName &&
      Number(zone.operation_remaining_ms || 0) > 0
    );
  }, [validZones, currentUserName]);
  const selectedZoneDetails = useMemo(() => {
    if (!selectedZoneDetailsId) return null;
    return validZones.find((zone) => zone.id === selectedZoneDetailsId) || null;
  }, [selectedZoneDetailsId, validZones]);
  const selectedZoneDetailsMission = selectedZoneDetails ? combatMissionByZone.get(selectedZoneDetails.id) : null;
  const selectedZoneDetailsPriority = selectedZoneDetails
    ? getZonePriority(selectedZoneDetails, selectedZoneDetailsMission)
    : null;
  const selectedZoneDetailsChangedAt = selectedZoneDetails
    ? zoneStatusMeta[selectedZoneDetails.id]?.changedAt
    : null;
  const selectedZoneDetailsTags = selectedZoneDetails
    ? [
        getStatusLabel(selectedZoneDetails.status),
        selectedZoneDetailsMission?.mission_status ? `Mission ${selectedZoneDetailsMission.mission_status}` : 'No Mission',
        selectedZoneDetailsPriority ? getPriorityLabel(selectedZoneDetailsPriority) : null,
        selectedZoneDetails.isActive ? 'Active' : 'Inactive',
        ...new Set([...(selectedZoneDetails.tasks || []), ...(selectedZoneDetailsMission?.tasks || [])]),
      ].filter(Boolean)
    : [];
  const selectedZoneDetailsRedNeighbors = useMemo(() => {
    if (!selectedZoneDetails) return [];
    const gridKey = getZoneGridKey(selectedZoneDetails);
    if (!gridKey) return [];

    return getNeighborZoneGridKeys(gridKey)
      .map((key) => zoneByGridKey.get(key))
      .filter((zone) => zone && zone.status === 'RED');
  }, [selectedZoneDetails, zoneByGridKey]);
  const selectedZoneDetailsHasTasks = Array.isArray(selectedZoneDetails?.tasks) && selectedZoneDetails.tasks.length > 0;
  const selectedZoneDetailsAcceptedByOther = Boolean(
    selectedZoneDetails?.operation_assigned &&
    selectedZoneDetails?.operation_assigned_to &&
    selectedZoneDetails.operation_assigned_to !== currentUserName &&
    Number(selectedZoneDetails?.operation_remaining_ms || 0) > 0
  );
  const selectedZoneDetailsAcceptedByCurrentUser = Boolean(
    selectedZoneDetails?.operation_assigned &&
    selectedZoneDetails?.operation_assigned_to === currentUserName &&
    Number(selectedZoneDetails?.operation_remaining_ms || 0) > 0
  );
  const canCurrentUserAcceptMoreZones = activeAcceptedZonesByCurrentUser.length < 2;

  const airportLogistics = useMemo(() => {
    if (!selectedAirportId) return [];
    return filteredLogisticsMissions.filter((mission) => mission.airport_id === selectedAirportId);
  }, [selectedAirportId, filteredLogisticsMissions]);
  const airportPendingContainers = useMemo(
    () => airportLogistics.filter((mission) => mission.status === 'pending'),
    [airportLogistics]
  );
  const airportAssignedLogistics = useMemo(
    () => airportLogistics.filter((mission) => mission.status === 'accepted'),
    [airportLogistics]
  );
  const airportContainerItems = useMemo(
    () => buildPendingContainerItems(airportPendingContainers, airportsById),
    [airportPendingContainers, airportsById]
  );
  const filteredAirportContainerItems = useMemo(() => {
    const query = logisticsWeaponSearch.trim().toLowerCase();
    if (!query) return airportContainerItems;
    return airportContainerItems.filter((item) => {
      const weaponName = getWeaponDisplayName(item.weaponId || '').toLowerCase();
      return weaponName.includes(query);
    });
  }, [airportContainerItems, logisticsWeaponSearch]);
  const containerById = useMemo(
    () => new Map(airportContainerItems.map((item) => [item.id, item])),
    [airportContainerItems]
  );
  const selectedContainers = useMemo(
    () => selectedContainerIds.map((id) => containerById.get(id)).filter(Boolean),
    [selectedContainerIds, containerById]
  );
  const selectedContainersIsoTotal = useMemo(
    () => selectedContainers.reduce((sum, item) => sum + (Number(item.units) || 0), 0),
    [selectedContainers]
  );
  const selectedLargeContainerCount = useMemo(
    () => selectedContainers.reduce((sum, item) => sum + (Number(item.units) >= 1 ? 1 : 0), 0),
    [selectedContainers]
  );
  const selectedSourceAirportId = selectedContainers[0]?.sourceAirportId || null;
  const canComposeSelectedMission = selectedContainerIds.length > 0
    && selectedContainersIsoTotal <= 2.5 + 1e-6
    && selectedLargeContainerCount <= 2;

  const selectedAirport = selectedAirportId ? airportsById.get(selectedAirportId) : null;

  const spawnOptionByKeyword = useMemo(() => {
    const map = new Map();
    (spawnOptions.infantry || []).forEach((option) => {
      if (option?.keyword) map.set(option.keyword, option);
    });
    (spawnOptions.crate || []).forEach((option) => {
      if (option?.keyword) map.set(option.keyword, option);
    });
    return map;
  }, [spawnOptions]);
  const selectedAirportRoutesHidden = selectedAirportId ? hiddenLogisticsRouteAirportIds.has(String(selectedAirportId)) : false;
  const selectedAirportRequestedWeaponIds = useMemo(() => {
    const set = new Set();
    airportLogistics.forEach((mission) => {
      getMissionOrders(mission).forEach((order) => {
        if (order?.weapon_id) set.add(order.weapon_id);
      });
    });
    return set;
  }, [airportLogistics]);
  const selectedAirportRequestableWeapons = useMemo(() => {
    if (!selectedAirport) return [];
    const isCarrier = selectedAirport.isCarrier === true;
    const isHeliport = selectedAirport.isHeliport === true;
    const baseWeapons = isCarrier
      ? importantWeaponsCarriers
      : (isHeliport ? importantWeaponsHeliports : [...importantWeaponsAirports, ...importantWeaponsHeliports]);
    const unique = [...new Set(baseWeapons)];
    return unique
      .map((weaponId) => {
        const inventoryWeapon = (selectedAirport?.data?.weapons || []).find((entry) => entry?.item === weaponId);
        return {
          weaponId,
          displayName: getWeaponDisplayName(weaponId),
          currentQty: Number(inventoryWeapon?.quantity || 0) || 0,
          disabled: selectedAirportRequestedWeaponIds.has(weaponId),
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [selectedAirport, selectedAirportRequestedWeaponIds]);
  const selectedRequestWeapon = useMemo(
    () => selectedAirportRequestableWeapons.find((entry) => entry.weaponId === requestWeaponId) || null,
    [selectedAirportRequestableWeapons, requestWeaponId]
  );
  const requestWeaponSuggestions = useMemo(() => {
    const query = requestWeaponSearch.trim().toLowerCase();
    return selectedAirportRequestableWeapons
      .filter((entry) => !entry.disabled)
      .filter((entry) => (
        !query
        || entry.displayName.toLowerCase().includes(query)
        || entry.weaponId.toLowerCase().includes(query)
      ))
      .slice(0, 8);
  }, [requestWeaponSearch, selectedAirportRequestableWeapons]);
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
      setSelectedContainerIds([]);
      setShowLogisticsComposeWindow(false);
      setShowLogisticsRequestWindow(false);
    }
  }, [filters.showLogistics]);

  useEffect(() => {
    setSelectedContainerIds([]);
    setShowLogisticsComposeWindow(false);
    setLogisticsWeaponSearch('');
    setShowLogisticsRequestWindow(false);
    setRequestWeaponSearch('');
    setRequestWeaponId('');
    setRequestQuantity(0);
  }, [selectedAirportId]);

  useEffect(() => {
    if (!filters.showAto) {
      setHoveredZoneId(null);
      setSelectedZoneDetailsId(null);
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

  useEffect(() => {
    if (selectedContainerIds.length === 0) return;
    const valid = selectedContainerIds.filter((id) => containerById.has(id));
    if (valid.length !== selectedContainerIds.length) {
      setSelectedContainerIds(valid);
    }
  }, [selectedContainerIds, containerById]);

  const evaluateContainerSelection = useCallback((containerItem) => {
    const containerId = containerItem?.id;
    if (!containerId) {
      return { selected: false, disabled: true, reason: 'Invalid mission' };
    }

    const selected = selectedContainerIds.includes(containerId);
    if (selected) {
      return { selected: true, disabled: false, reason: '' };
    }

    if (selectedSourceAirportId && containerItem.sourceAirportId !== selectedSourceAirportId) {
      return { selected: false, disabled: true, reason: 'Source airport locked by first selection' };
    }

    const isoUnits = Number(containerItem.units) || 0;
    const nextIso = selectedContainersIsoTotal + isoUnits;
    if (nextIso > 2.5 + 1e-6) {
      return { selected: false, disabled: true, reason: 'ISO total would exceed 2.5' };
    }

    const nextLargeCount = selectedLargeContainerCount + (isoUnits >= 1 ? 1 : 0);
    if (nextLargeCount > 2) {
      return { selected: false, disabled: true, reason: 'Cannot exceed 2 large containers' };
    }

    return { selected: false, disabled: false, reason: '' };
  }, [selectedContainerIds, selectedContainersIsoTotal, selectedLargeContainerCount, selectedSourceAirportId]);

  const handleToggleContainerMission = useCallback((containerItem) => {
    const containerId = containerItem?.id;
    if (!containerId) return;

    setSelectedContainerIds((current) => {
      if (current.includes(containerId)) {
        return current.filter((id) => id !== containerId);
      }

      const state = evaluateContainerSelection(containerItem);
      if (state.disabled) return current;
      return [...current, containerId];
    });
  }, [evaluateContainerSelection]);

  const handleComposeLogisticsMission = useCallback(async () => {
    if (!selectedAirportId || selectedContainerIds.length === 0) return;
    if (!canComposeSelectedMission) return;

    if (!user) {
      window.location.href = '/api/auth/discord';
      return;
    }

    setComposingMission(true);
    try {
      const composePayload = selectedContainers.map((container) => ({
        missionId: container.missionId,
        orderIndex: container.orderIndex,
        units: container.units,
      }));
      const payload = await composeAirportLogisticsMission(selectedAirportId, composePayload);
      const latest = await getMissions();
      if (Array.isArray(latest)) {
        setLogisticsMissions(latest);
        if (payload?.missionId) {
          const composedMission = latest.find((mission) => mission.id === payload.missionId) || null;
          setSelectedLogisticsMission(composedMission);
        }
      }
      setSelectedContainerIds([]);
      setShowLogisticsComposeWindow(false);
    } catch (error) {
      console.error('Failed to compose logistics mission:', error);
      alert(`Failed to compose logistics mission: ${error.message}`);
    } finally {
      setComposingMission(false);
    }
  }, [canComposeSelectedMission, selectedAirportId, selectedContainerIds, selectedContainers, user]);

  useEffect(() => {
    if (!showLogisticsRequestWindow) return;
    // Keep request field empty by default; user explicitly chooses from suggestions.
    setRequestWeaponId('');
    setRequestWeaponSearch('');
    if (!Number.isFinite(Number(requestQuantity)) || Number(requestQuantity) <= 0) {
      setRequestQuantity(50);
    }
  }, [showLogisticsRequestWindow, requestQuantity]);

  const handleCreateManualRequest = useCallback(async () => {
    if (!selectedAirportId) return;
    const quantityValue = Math.floor(Number(requestQuantity) || 0);
    if (!requestWeaponId) {
      alert('Select a weapon first.');
      return;
    }
    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      alert('Quantity must be greater than 0.');
      return;
    }

    const alreadyExists = selectedAirportRequestedWeaponIds.has(requestWeaponId);
    if (alreadyExists) {
      alert('An order for this weapon already exists for this airport.');
      return;
    }

    setRequestingOrder(true);
    try {
      await createOrder(selectedAirportId, requestWeaponId, quantityValue);
      const latest = await getMissions();
      if (Array.isArray(latest)) {
        setLogisticsMissions(latest);
      }
      setShowLogisticsRequestWindow(false);
      setRequestWeaponSearch('');
      setRequestWeaponId('');
      setRequestQuantity(0);
    } catch (error) {
      console.error('Failed to create manual request:', error);
      alert(`Failed to create request: ${error.message}`);
    } finally {
      setRequestingOrder(false);
    }
  }, [requestQuantity, requestWeaponId, selectedAirportId, selectedAirportRequestedWeaponIds]);

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

  const handleAcceptZoneOperation = async (zone) => {
    if (!zone?.id) return;
    if (!user) {
      window.location.href = '/api/auth/discord';
      return;
    }

    if (!currentUserName) return;

    setAcceptingZoneOperationId(zone.id);
    try {
      const payload = await acceptFrontlineZone(zone.id, currentUserName);
      if (Array.isArray(payload?.zones)) {
        setZones(payload.zones);
      } else {
        const refreshed = await getFrontlineZones();
        const fetchedZones = refreshed?.zones || refreshed;
        if (Array.isArray(fetchedZones)) {
          setZones(fetchedZones);
        }
      }
    } catch (error) {
      console.error('Failed to accept zone operation:', error);
      alert(`Failed to accept zone: ${error.message}`);
    } finally {
      setAcceptingZoneOperationId(null);
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

  const handleAirportClick = useCallback((airportId) => {
    if (!airportId) return;
    const normalizedAirportId = String(airportId);
    setSelectedAirportId(normalizedAirportId);
    setSelectedZoneId(null);
    setSelectedZoneDetailsId(null);
    setSelectedProductionPointId(null);
  }, []);

  const handleToggleAirportRoutePriority = useCallback(async (airportId) => {
    const normalizedAirportId = String(airportId || '').trim();
    if (!normalizedAirportId) return;
    if (!canManageLogisticsRouteVisibility) return;

    const isCurrentlyHidden = hiddenLogisticsRouteAirportIds.has(normalizedAirportId);
    const nextIsPriority = isCurrentlyHidden;

    setUpdatingRoutePriorityAirportId(normalizedAirportId);
    try {
      const payload = await setAirportLogisticsRoutePriority(normalizedAirportId, nextIsPriority);
      const ids = Array.isArray(payload?.hiddenAirportIds) ? payload.hiddenAirportIds : [];
      setHiddenLogisticsRouteAirportIds(new Set(ids.map((entry) => String(entry))));
    } catch (error) {
      console.error('Failed to update airport route priority:', error);
      alert(`Failed to update airport priority: ${error.message}`);
    } finally {
      setUpdatingRoutePriorityAirportId(null);
    }
  }, [canManageLogisticsRouteVisibility, hiddenLogisticsRouteAirportIds]);

  // ===== DCORE bridge: Production Points + web spawns =====
  const isAuthenticated = Boolean(user?.id);

  const selectedProductionPoint = useMemo(
    () => (selectedProductionPointId ? productionPoints.find((pp) => pp.id === selectedProductionPointId) || null : null),
    [selectedProductionPointId, productionPoints]
  );

  const handleProductionPointSelect = useCallback((ppId) => {
    setSelectedProductionPointId(ppId);
    setSelectedAirportId(null);
    setSelectedZoneId(null);
    setSelectedZoneDetailsId(null);
    setSpawnMode(null);
  }, []);

  // Keep zone / production-point / airport selection mutually exclusive (panels share the bottom-left slot).
  useEffect(() => {
    if (selectedZoneId) {
      setSelectedProductionPointId(null);
      setSelectedAirportId(null);
    }
  }, [selectedZoneId]);

  const handleRequestUpgrade = useCallback(async (ppId) => {
    if (!ppId) return;
    setUpgradingPpId(ppId);
    try {
      const response = await requestProductionPointUpgrade(ppId);
      if (response?.commandId) {
        pendingCommandIdsRef.current.add(response.commandId);
      }
    } catch (error) {
      console.error('Failed to request PP upgrade:', error);
      setCommandToast({ ok: false, message: error.message || 'Failed to request upgrade.', balance: null, ts: Date.now() });
    } finally {
      setUpgradingPpId(null);
    }
  }, []);

  const handleEnterSpawnMode = useCallback((airportId, type, option) => {
    setSpawnMode({
      airportId: String(airportId),
      type,
      keyword: option.keyword,
      label: option.keyword || option.label,
      cost: option.cost,
      quantity: 1,
    });
    setSelectedProductionPointId(null);
  }, []);

  const handleSetSpawnQuantity = useCallback((quantity) => {
    const nextQty = Math.max(1, Math.min(SPAWN_QUANTITY_MAX, Math.floor(Number(quantity)) || 1));
    setSpawnMode((current) => (current ? { ...current, quantity: nextQty } : current));
  }, []);

  const handleCancelSpawnMode = useCallback(() => {
    setSpawnMode(null);
  }, []);

  const handleSpawnPlace = useCallback(async ({ lat, lon }) => {
    if (!spawnMode) return;
    const { airportId, type, keyword } = spawnMode;
    const quantity = Math.max(1, Math.min(SPAWN_QUANTITY_MAX, Math.floor(Number(spawnMode.quantity)) || 1));
    const airport = airportsById.get(airportId);
    const airportCoords = airport?.coordinates;
    const placementPositions = buildSpawnPlacementPositions(lat, lon, quantity);
    if (airportCoords && Number.isFinite(airportCoords.lat) && Number.isFinite(airportCoords.lon)) {
      for (const position of placementPositions) {
        const distanceM = haversineMeters(airportCoords.lat, airportCoords.lon, position.lat, position.lon);
        if (distanceM > AIRPORT_SPAWN_RADIUS_M) {
          setCommandToast({
            ok: false,
            message: `Placement out of range (${Math.round(distanceM)} m). Max ${AIRPORT_SPAWN_RADIUS_M / 1000} km from airport center.`,
            balance: null,
            ts: Date.now(),
          });
          return;
        }
      }
    }

    setSubmittingCommand(true);
    try {
      const submit = type === 'inf_spawn' ? spawnAirportInfantry : spawnAirportCrate;
      const response = await submit(airportId, keyword, lat, lon, quantity);
      if (response?.commandId) {
        pendingCommandIdsRef.current.add(response.commandId);
      }
      setSpawnMode(null);
    } catch (error) {
      console.error('Failed to submit spawn command:', error);
      setCommandToast({ ok: false, message: error.message || 'Failed to send spawn order.', balance: null, ts: Date.now() });
    } finally {
      setSubmittingCommand(false);
    }
  }, [spawnMode, airportsById]);

  const canUpgradeSelectedPp = Boolean(
    selectedProductionPoint &&
    selectedProductionPoint.built &&
    !selectedProductionPoint.upgrading &&
    selectedProductionPoint.owner === 'BLUE' &&
    Number(selectedProductionPoint.red_units || 0) === 0 &&
    Number(selectedProductionPoint.level || 0) < Number(selectedProductionPoint.max_level || 1)
  );

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
              {isDesktopDevice && !mapMode && (
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
              )}
              {(mapMode || !isDesktopDevice) && (
                <div className="absolute inset-0">
                  {isMapLibreEngine ? (
                    <MapLibreFlatMapView
                      zones={filteredZones}
                      airportsData={validAirports}
                      logisticsMissions={routeVisibleLogisticsMissions}
                      logisticsFrontlineAirportIds={logisticsFrontlineAirportIds}
                      gridConnections={gridConnections}
                      convoys={convoyRenderData}
                      airliftPlayers={airliftPlayerRenderData}
                      dcsarPoints={dcsarPointsWithNearest}
                      selectedZoneId={selectedZoneId}
                      onZoneSelect={setSelectedZoneId}
                      focusCoordinates={tacticalFocusCoordinates}
                      onZoomChange={handleFlatMapZoomChange}
                      onZoneHover={setHoveredZoneId}
                      onDcsarHover={setHoveredDcsarId}
                      onDcsarSelect={handleSelectDcsarTask}
                      onAirportClick={handleAirportClick}
                      showAto={filters.showAto}
                      showAirports={filters.showAirports}
                      showLogistics={filters.showLogistics}
                      showConvoys={filters.showConvoys}
                      showAirliftPlayers={filters.showAirliftPlayers}
                      showDcsar={filters.showDcsar}
                      basemapMode={basemapMode}
                      focusTargetKey={tacticalFocusTargetKey}
                      productionPoints={productionPoints}
                      showProductionPoints={filters.showProductionPoints}
                      selectedProductionPointId={selectedProductionPointId}
                      onProductionPointSelect={handleProductionPointSelect}
                      spawnPlacementActive={Boolean(spawnMode)}
                      onSpawnPlace={handleSpawnPlace}
                      spawnAirportCenter={spawnAirportCenter}
                      webSpawnMarkers={webSpawnMarkers}
                    />
                  ) : (
                    <FlatMapView
                      zones={filteredZones}
                      airportsData={validAirports}
                      logisticsMissions={routeVisibleLogisticsMissions}
                      gridConnections={gridConnections}
                      convoys={convoyRenderData}
                      airliftPlayers={airliftPlayerRenderData}
                      dcsarPoints={dcsarPointsWithNearest}
                      selectedZoneId={selectedZoneId}
                      onZoneSelect={setSelectedZoneId}
                      focusCoordinates={tacticalFocusCoordinates}
                      onZoomChange={handleFlatMapZoomChange}
                      onZoneHover={setHoveredZoneId}
                      onDcsarHover={setHoveredDcsarId}
                      onDcsarSelect={handleSelectDcsarTask}
                      onAirportClick={handleAirportClick}
                      showAto={filters.showAto}
                      showAirports={filters.showAirports}
                      showLogistics={filters.showLogistics}
                      showConvoys={filters.showConvoys}
                      showAirliftPlayers={filters.showAirliftPlayers}
                      showDcsar={filters.showDcsar}
                      animationTick={animationTick}
                      basemapMode={basemapMode}
                      focusTargetKey={tacticalFocusTargetKey}
                      productionPoints={productionPoints}
                      showProductionPoints={filters.showProductionPoints}
                      selectedProductionPointId={selectedProductionPointId}
                      onProductionPointSelect={handleProductionPointSelect}
                      spawnPlacementActive={Boolean(spawnMode)}
                      onSpawnPlace={handleSpawnPlace}
                      spawnAirportCenter={spawnAirportCenter}
                      webSpawnMarkers={webSpawnMarkers}
                      mapMaxZoom={mapMaxZoom}
                    />
                  )}
                </div>
              )}
              <div
                className={`absolute left-3 top-3 z-[1000] rounded-xl border border-yt-border bg-[#151925f2] shadow-2xl backdrop-blur transition-all duration-[360ms] ease-in-out ${
                  overlayCollapsed ? 'w-[46px] p-1.5' : 'w-[52px] p-1.5'
                }`}
              >
                <div className="flex flex-col items-center">
                  <div
                    className={`flex flex-col gap-2 overflow-hidden transition-[max-height,opacity,transform,margin-bottom] duration-[360ms] ease-in-out ${
                      overlayCollapsed
                        ? 'mb-0 max-h-0 -translate-y-1 opacity-0 pointer-events-none'
                        : 'mb-2 max-h-56 translate-y-0 opacity-100'
                    }`}
                    aria-hidden={overlayCollapsed}
                  >
                    <button
                      type="button"
                      aria-label="Toggle ATO overlays"
                      title="ATO"
                      onClick={() => setFilters((current) => ({ ...current, showAto: !current.showAto }))}
                      className={`rounded-md border p-2 transition-colors ${
                        filters.showAto
                          ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                          : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                      }`}
                    >
                      <Blend className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Toggle Logistics overlays"
                      title="Logistics"
                      onClick={() => setFilters((current) => ({ ...current, showLogistics: !current.showLogistics }))}
                      className={`rounded-md border p-2 transition-colors ${
                        filters.showLogistics
                          ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                          : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                      }`}
                    >
                      <Forklift className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Toggle CSAR overlays"
                      title="CSAR"
                      onClick={() => setFilters((current) => ({ ...current, showDcsar: !current.showDcsar }))}
                      className={`rounded-md border p-2 transition-colors ${
                        filters.showDcsar
                          ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                          : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                      }`}
                    >
                      <Ambulance className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Toggle Production Points"
                      title="Production Points"
                      onClick={() => setFilters((current) => ({ ...current, showProductionPoints: !current.showProductionPoints }))}
                      className={`rounded-md border p-2 transition-colors ${
                        filters.showProductionPoints
                          ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                          : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                      }`}
                    >
                      <Factory className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Toggle satellite basemap"
                      title="Satellite"
                      className={`rounded-md border p-2 transition-colors ${
                        basemapMode === BASEMAP_MODE_SATELLITE
                          ? 'border-yt-accent bg-yt-accent/25 text-yt-text-primary'
                          : 'border-yt-border bg-yt-bg-tertiary text-yt-text-secondary'
                      }`}
                      onClick={() => setBasemapMode((current) => (
                        current === BASEMAP_MODE_SATELLITE ? BASEMAP_MODE_DARK : BASEMAP_MODE_SATELLITE
                      ))}
                    >
                      <Satellite className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOverlayCollapsed((value) => !value)}
                    className="rounded-md border border-yt-border bg-yt-bg-tertiary/60 p-2 text-yt-text-secondary transition-colors hover:text-yt-text-primary"
                    aria-label={overlayCollapsed ? 'Open overlays' : 'Close overlays'}
                    title={overlayCollapsed ? 'Open overlays' : 'Close overlays'}
                  >
                    {overlayCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                  </button>
                </div>
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
                      onClick={() => setSelectedZoneDetailsId(selectedZone.id)}
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

              {spawnMode && (
                <div className="absolute left-1/2 top-4 z-[1100] -translate-x-1/2 rounded-lg border border-amber-400/60 bg-[#1a1505f2] px-4 py-2 text-center shadow-2xl backdrop-blur">
                  <div className="text-sm font-semibold text-amber-200">
                    Place {spawnMode.quantity || 1}x {formatSpawnBannerName(spawnMode.label)} inside of the designated range
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-100/70">Qty</span>
                    {Array.from({ length: SPAWN_QUANTITY_MAX }, (_, index) => {
                      const value = index + 1;
                      const selected = (spawnMode.quantity || 1) === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => handleSetSpawnQuantity(value)}
                          className={`min-w-[28px] rounded border px-2 py-0.5 text-[11px] font-semibold ${
                            selected
                              ? 'border-amber-300 bg-amber-300/20 text-amber-100'
                              : 'border-amber-400/40 text-amber-100/80 hover:bg-amber-400/10'
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[11px] text-amber-100/80">
                    Total {(spawnMode.cost || 0) * (spawnMode.quantity || 1)} fp
                    {' • '}
                    {SPAWN_OFFSET_METERS} m spacing
                    {' • '}
                    {submittingCommand ? 'Sending...' : 'Click the highlighted area on the map'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelSpawnMode}
                    className="mt-1 rounded border border-amber-400/60 px-2 py-0.5 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/15"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {commandToast && (
                <div
                  className={`absolute left-1/2 bottom-4 z-[1100] -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-2xl backdrop-blur ${
                    commandToast.ok
                      ? 'border-green-500/50 bg-[#0c1f14f2] text-green-200'
                      : 'border-red-500/50 bg-[#1f0c0cf2] text-red-200'
                  }`}
                >
                  {commandToast.message}
                  {Number.isFinite(commandToast.balance) && (
                    <span className="ml-2 text-yt-text-secondary">(BLUE: {commandToast.balance} fp)</span>
                  )}
                </div>
              )}

              {selectedProductionPoint && (
                <div className="absolute left-4 bottom-4 z-[1000] w-[320px] rounded-xl border border-yt-border bg-[#101827f2] p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-yt-text-primary">
                      {selectedProductionPoint.zone_name}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedProductionPointId(null)}
                      className="text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                    >
                      Close
                    </button>
                  </div>
                  <div className="space-y-1 text-[12px] text-yt-text-secondary">
                    <div className="flex items-center justify-between">
                      <span>Owner</span>
                      <span className="font-semibold" style={{ color: getProductionPointColor(selectedProductionPoint.owner) }}>
                        {selectedProductionPoint.owner}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Level</span>
                      <span className="font-semibold text-yt-text-primary">
                        LV{selectedProductionPoint.level} / {selectedProductionPoint.max_level}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Status</span>
                      <span className="font-semibold text-yt-text-primary">
                        {selectedProductionPoint.built ? (selectedProductionPoint.upgrading ? 'Upgrading' : 'Built') : 'Building'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Stock</span>
                      <span className="font-semibold text-yt-text-primary">
                        {selectedProductionPoint.stock} / {selectedProductionPoint.max_stock}
                      </span>
                    </div>
                    {Object.keys(selectedProductionPoint.required_categories || {}).length > 0 && (
                      <div className="border-t border-yt-border/60 pt-1">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                          {selectedProductionPoint.upgrading ? 'Upgrade crates' : 'Build crates'}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(selectedProductionPoint.required_categories).map(([cat, need]) => {
                            const have = Number(selectedProductionPoint.build_counts?.[cat] || 0);
                            const ok = have >= Number(need);
                            return (
                              <span
                                key={cat}
                                className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  ok ? 'border-green-500/50 text-green-300' : 'border-yt-border text-yt-text-secondary'
                                }`}
                              >
                                {cat} {have}/{need}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRequestUpgrade(selectedProductionPoint.id)}
                    disabled={!isAuthenticated || !canUpgradeSelectedPp || upgradingPpId === selectedProductionPoint.id}
                    className="mt-3 w-full rounded border border-blue-500/50 bg-blue-500/15 px-2.5 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                    title={!isAuthenticated ? 'Login required' : (!canUpgradeSelectedPp ? 'Upgrade not available' : 'Start upgrade')}
                  >
                    {selectedProductionPoint.upgrading
                      ? 'Upgrade in progress...'
                      : upgradingPpId === selectedProductionPoint.id
                        ? 'Sending...'
                        : 'Start Upgrade'}
                  </button>
                  {!isAuthenticated && (
                    <div className="mt-1 text-center text-[10px] text-yt-text-secondary">Login to interact</div>
                  )}
                </div>
              )}

              {selectedAirport && (
                <div className="absolute left-4 bottom-4 z-[1000] w-[320px] rounded-xl border border-yt-border bg-[#101827f2] p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-yt-text-primary">
                      Spawn @ {selectedAirport.displayName || selectedAirport.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedAirportId(null); setSpawnMode(null); }}
                      className="text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                    >
                      Close
                    </button>
                  </div>
                  {!isAuthenticated ? (
                    <div className="rounded border border-dashed border-yt-border px-2 py-2 text-[11px] text-yt-text-secondary">
                      Login to spawn units and crates.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {SPAWN_MENU_SECTIONS.map((section) => {
                        const sectionOptions = section.keywords
                          .map((keyword) => {
                            const option = spawnOptionByKeyword.get(keyword);
                            return option ? { keyword, option } : null;
                          })
                          .filter(Boolean);
                        if (sectionOptions.length === 0) return null;

                        return (
                          <div key={section.id}>
                            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-yt-text-secondary">
                              {section.title}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {sectionOptions.map(({ keyword, option }) => {
                                const selected = spawnMode?.keyword === keyword && spawnMode?.type === section.spawnType;
                                return (
                                  <button
                                    key={`${section.id}-${keyword}`}
                                    type="button"
                                    onClick={() => handleEnterSpawnMode(selectedAirport.id, section.spawnType, option)}
                                    className={`rounded border px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] ${
                                      selected
                                        ? 'border-amber-400/70 bg-amber-400/15 text-amber-200'
                                        : 'border-yt-border text-yt-text-primary hover:bg-yt-bg-tertiary/50'
                                    }`}
                                  >
                                    {keyword}
                                    <span className="ml-1 text-yt-text-secondary">({option.cost})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      {spawnMode && (
                        <div className="rounded border border-amber-400/30 bg-amber-400/5 px-2 py-2">
                          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200/90">
                            Quantity (max {SPAWN_QUANTITY_MAX})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: SPAWN_QUANTITY_MAX }, (_, index) => {
                              const value = index + 1;
                              const selected = (spawnMode.quantity || 1) === value;
                              return (
                                <button
                                  key={value}
                                  type="button"
                                  onClick={() => handleSetSpawnQuantity(value)}
                                  className={`min-w-[30px] rounded border px-2 py-1 text-[11px] font-semibold ${
                                    selected
                                      ? 'border-amber-400/70 bg-amber-400/15 text-amber-200'
                                      : 'border-yt-border text-yt-text-primary hover:bg-yt-bg-tertiary/50'
                                  }`}
                                >
                                  {value}
                                </button>
                              );
                            })}
                          </div>
                          <div className="mt-1.5 text-[10px] text-yt-text-secondary">
                            {spawnMode.quantity || 1}× {spawnMode.label} • total {(spawnMode.cost || 0) * (spawnMode.quantity || 1)} fp • {SPAWN_OFFSET_METERS} m between items
                          </div>
                        </div>
                      )}
                      <div className="text-[10px] text-yt-text-secondary">
                        Select an item, choose quantity, then click inside the airport on the map.
                      </div>
                    </div>
                  )}
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
                  {canManageLogisticsRouteVisibility && (
                    <div className="mb-2 flex items-center justify-between rounded border border-yt-border/70 bg-[#0c1320] px-2.5 py-1.5 text-[11px] text-yt-text-secondary">
                      <div>
                        Airport priority: <span className={`font-semibold ${selectedAirportRoutesHidden ? 'text-amber-300' : 'text-green-300'}`}>{selectedAirportRoutesHidden ? 'Not priority' : 'Priority'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleToggleAirportRoutePriority(selectedAirport.id)}
                        disabled={updatingRoutePriorityAirportId === String(selectedAirport.id)}
                        className="rounded border border-yt-border px-2 py-0.5 font-semibold text-yt-text-primary hover:bg-yt-bg-tertiary/50"
                        title={`Discord role ${LOGISTICS_ROUTE_TOGGLE_ROLE_ID}`}
                      >
                        {updatingRoutePriorityAirportId === String(selectedAirport.id)
                          ? 'Saving...'
                          : (selectedAirportRoutesHidden ? 'Set Priority' : 'Set Not Priority')}
                      </button>
                    </div>
                  )}

                  {airportLogistics.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-yt-border px-3 py-3 text-xs text-yt-text-secondary">
                      No logistics tasks for this airport.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg border border-yt-border bg-[#0c1320] p-2.5">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                          Requested Containers
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                            Selected: <span className="font-semibold text-yt-text-primary">{selectedContainerIds.length}</span>
                          </span>
                          <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                            ISO: <span className="font-semibold text-yt-text-primary">{formatIsoUnits(selectedContainersIsoTotal)}</span>/2.5
                          </span>
                          <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                            Large: <span className="font-semibold text-yt-text-primary">{selectedLargeContainerCount}</span>/2
                          </span>
                        </div>

                        <div className="rounded border border-yt-border/70 bg-[#101b2c] px-2 py-2 text-[11px] text-yt-text-secondary">
                          Pending containers: <span className="font-semibold text-yt-text-primary">{airportContainerItems.length}</span>
                        </div>

                        <div className="mt-2 flex items-center gap-2 border-t border-yt-border/70 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowLogisticsComposeWindow(true)}
                            disabled={airportContainerItems.length === 0}
                            className="rounded border border-yt-border px-2.5 py-1.5 text-xs font-semibold text-yt-text-primary hover:bg-yt-bg-tertiary/50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Open Container Window
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowLogisticsRequestWindow(true)}
                            className="rounded border border-yt-border px-2.5 py-1.5 text-xs font-semibold text-yt-text-primary hover:bg-yt-bg-tertiary/50"
                          >
                            Request
                          </button>
                          <button
                            type="button"
                            onClick={handleComposeLogisticsMission}
                            disabled={!canComposeSelectedMission || composingMission}
                            className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {composingMission ? 'Creating...' : 'Create Mission'}
                          </button>
                        </div>
                      </div>

                      {airportAssignedLogistics.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                            Assigned Missions
                          </div>
                          {airportAssignedLogistics.map((mission) => {
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
                                  <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-300">
                                    {mission.status}
                                  </span>
                                </div>
                                {mission.accepted_by && (
                                  <div className="mb-2 text-[10px] text-blue-200">
                                    Accepted by {mission.accepted_by}
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
                </div>
              )}

              {filters.showLogistics && selectedAirport && showLogisticsComposeWindow && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/70"
                    onClick={() => setShowLogisticsComposeWindow(false)}
                    aria-label="Close logistics compose window"
                  />
                  <div className="relative flex h-[86vh] w-[min(980px,94vw)] flex-col rounded-2xl border border-yt-border bg-[#0f1727] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-yt-text-primary">
                          Container Selection
                        </div>
                        <div className="text-xs text-yt-text-secondary">
                          {selectedAirport.displayName || selectedAirport.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleComposeLogisticsMission}
                          disabled={!canComposeSelectedMission || composingMission}
                          className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {composingMission ? 'Creating...' : 'Create Mission'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowLogisticsComposeWindow(false)}
                          className="rounded border border-yt-border px-2 py-1 text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                        Selected: <span className="font-semibold text-yt-text-primary">{selectedContainerIds.length}</span>
                      </span>
                      <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                        ISO: <span className="font-semibold text-yt-text-primary">{formatIsoUnits(selectedContainersIsoTotal)}</span>/2.5
                      </span>
                      <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                        Large: <span className="font-semibold text-yt-text-primary">{selectedLargeContainerCount}</span>/2
                      </span>
                      {selectedSourceAirportId && (
                        <span className="rounded border border-yt-border/80 bg-[#121c2d] px-2 py-0.5 text-yt-text-secondary">
                          Source lock: <span className="font-semibold text-yt-text-primary">{airportsById.get(selectedSourceAirportId)?.displayName || selectedSourceAirportId}</span>
                        </span>
                      )}
                    </div>
                    <div className="mb-3">
                      <input
                        type="text"
                        value={logisticsWeaponSearch}
                        onChange={(event) => setLogisticsWeaponSearch(event.target.value)}
                        placeholder="Search weapon..."
                        className="w-full rounded border border-yt-border bg-[#0c1320] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none placeholder:text-yt-text-secondary focus:border-yt-accent/60"
                      />
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      {filteredAirportContainerItems.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-yt-border px-3 py-3 text-xs text-yt-text-secondary">
                          {airportContainerItems.length === 0 ? 'No pending containers for this airport.' : 'No containers match this weapon search.'}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {filteredAirportContainerItems.map((containerItem) => {
                          const isoUnits = Number(containerItem.units) || 0;
                          const typeLabel = getIsoContainerTypeLabel(isoUnits);
                          const selectionState = evaluateContainerSelection(containerItem);
                          const dimmed = selectionState.disabled && !selectionState.selected;

                          return (
                            <button
                              key={`pending-container-${containerItem.id}`}
                              type="button"
                              onClick={() => handleToggleContainerMission(containerItem)}
                              disabled={selectionState.disabled && !selectionState.selected}
                              title={selectionState.reason || ''}
                              className={`rounded-lg border p-2 transition ${
                                selectionState.selected
                                  ? 'border-sky-400 bg-sky-500/12'
                                  : dimmed
                                    ? 'border-yt-border/40 bg-yt-bg-tertiary/25 opacity-45'
                                    : 'border-yt-border bg-yt-bg-tertiary/60'
                              } w-full text-left`}
                            >
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-xs font-semibold text-yt-text-primary">
                                    {typeLabel} - {formatIsoUnits(isoUnits)} ISO
                                  </div>
                                  <div className="text-[11px] text-yt-text-secondary">
                                    From: {containerItem.sourceAirportName}
                                  </div>
                                  <div className="text-[10px] text-yt-text-secondary">
                                    Mission: {containerItem.missionId}
                                  </div>
                                </div>
                                <span className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                                  selectionState.selected
                                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                                    : 'border-yt-border bg-[#101b2c] text-yt-text-secondary'
                                }`}>
                                  {selectionState.selected ? 'Selected' : 'Available'}
                                </span>
                              </div>

                              {selectionState.reason && !selectionState.selected && (
                                <div className="mb-2 text-[10px] text-amber-300">
                                  {selectionState.reason}
                                </div>
                              )}

                              <div className="rounded border border-yt-border/70 bg-[#0c1320] px-2 py-1.5">
                                <div className="text-[11px] font-semibold text-yt-text-primary">
                                  1 container - {getWeaponDisplayName(containerItem.weaponId || 'cargo')}
                                </div>
                                <div className="text-[10px] text-yt-text-secondary">
                                  Content: Qty {Number(containerItem.quantityNeeded || 0)}
                                </div>
                                <div className="text-[10px] text-yt-text-secondary">
                                  Weight/container: {containerItem.totalWeightLbs > 0 ? `${containerItem.totalWeightLbs.toFixed(1)} lbs` : '-'}
                                </div>
                                <div className="text-[10px] text-yt-text-secondary">
                                  Priority: {containerItem.priority}
                                </div>
                              </div>
                            </button>
                          );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {filters.showLogistics && selectedAirport && showLogisticsRequestWindow && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/70"
                    onClick={() => setShowLogisticsRequestWindow(false)}
                    aria-label="Close logistics request window"
                  />
                  <div className="relative w-[min(700px,92vw)] rounded-2xl border border-yt-border bg-[#0f1727] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-yt-text-primary">
                          Request Weapon Order
                        </div>
                        <div className="text-xs text-yt-text-secondary">
                          {selectedAirport.displayName || selectedAirport.name}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowLogisticsRequestWindow(false)}
                        className="rounded border border-yt-border px-2 py-1 text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                      >
                        Close
                      </button>
                    </div>

                    <div className="mb-2 text-[11px] text-yt-text-secondary">
                      If an order for this weapon already exists at this airport, request is blocked.
                    </div>

                    <div className="mb-3">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                        Weapon
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={requestWeaponSearch}
                          onChange={(event) => {
                            const value = event.target.value;
                            setRequestWeaponSearch(value);
                            const match = selectedAirportRequestableWeapons.find((entry) => (
                              !entry.disabled
                              && (
                                entry.displayName.toLowerCase() === value.trim().toLowerCase()
                                || entry.weaponId.toLowerCase() === value.trim().toLowerCase()
                              )
                            ));
                            setRequestWeaponId(match?.weaponId || '');
                          }}
                          placeholder="Type weapon name..."
                          className="w-full rounded border border-yt-border bg-[#0c1320] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none placeholder:text-yt-text-secondary focus:border-yt-accent/60"
                        />
                        {requestWeaponSearch.trim() !== '' && !requestWeaponId && requestWeaponSuggestions.length > 0 && (
                          <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded border border-yt-border bg-[#0c1320] p-1 shadow-xl">
                            {requestWeaponSuggestions.map((weapon) => (
                              <button
                                key={weapon.weaponId}
                                type="button"
                                onClick={() => {
                                  setRequestWeaponId(weapon.weaponId);
                                  setRequestWeaponSearch(weapon.displayName);
                                }}
                                className="w-full rounded px-2 py-1 text-left text-xs text-yt-text-primary hover:bg-yt-bg-tertiary/60"
                              >
                                {weapon.displayName} <span className="text-yt-text-secondary">({weapon.currentQty})</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {selectedRequestWeapon?.disabled && (
                        <div className="mt-1 text-[10px] text-amber-300">This weapon already has an active order for this airport.</div>
                      )}
                    </div>

                    <div className="mb-4">
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={requestQuantity}
                        onChange={(event) => setRequestQuantity(event.target.value)}
                        className="w-full rounded border border-yt-border bg-[#0c1320] px-2.5 py-1.5 text-xs text-yt-text-primary outline-none focus:border-yt-accent/60"
                      />
                      <div className="mt-1 text-[10px] text-yt-text-secondary">
                        ISO container size is chosen automatically (small/large) from requested quantity.
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setShowLogisticsRequestWindow(false)}
                        className="rounded border border-yt-border px-2.5 py-1.5 text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCreateManualRequest}
                        disabled={requestingOrder || !requestWeaponId}
                        className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1.5 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {requestingOrder ? 'Requesting...' : 'Request Order'}
                      </button>
                    </div>
                  </div>
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

              {selectedZoneDetails && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center">
                  <button
                    type="button"
                    className="absolute inset-0 bg-black/70"
                    onClick={() => setSelectedZoneDetailsId(null)}
                    aria-label="Close zone details"
                  />
                  <div className="relative w-[min(860px,92vw)] max-h-[84vh] overflow-y-auto rounded-2xl border border-yt-border bg-[#0f1727] p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold text-yt-text-primary">
                          Zone {getZoneNumber(selectedZoneDetails)} Details
                        </div>
                        <div className="text-xs text-yt-text-secondary">
                          {`Zone: '${getZoneNumber(selectedZoneDetails)}' under ${getControlText(selectedZoneDetails.status)}`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {selectedZoneDetailsAcceptedByCurrentUser && (
                          <span className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300">
                            Accepted • {formatDurationMmSs(selectedZoneDetails.operation_remaining_ms)}
                          </span>
                        )}
                        {!selectedZoneDetailsAcceptedByCurrentUser && selectedZoneDetails?.operation_assigned_to && (
                          <span className="rounded border border-blue-500/50 bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">
                            Accepted by {selectedZoneDetails.operation_assigned_to}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleAcceptZoneOperation(selectedZoneDetails)}
                          disabled={
                            acceptingZoneOperationId === selectedZoneDetails.id ||
                            !selectedZoneDetailsHasTasks ||
                            selectedZoneDetailsAcceptedByCurrentUser ||
                            selectedZoneDetailsAcceptedByOther ||
                            (!selectedZoneDetailsAcceptedByCurrentUser && !canCurrentUserAcceptMoreZones)
                          }
                          className="rounded border border-green-500/50 bg-green-500/15 px-2.5 py-1 text-xs font-semibold text-green-300 hover:bg-green-500/25 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {acceptingZoneOperationId === selectedZoneDetails.id ? 'Accepting...' : 'Accept'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedZoneDetailsId(null)}
                          className="rounded border border-yt-border px-2 py-1 text-xs font-semibold text-yt-text-secondary hover:text-yt-text-primary"
                        >
                          Close
                        </button>
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {selectedZoneDetailsTags.map((tag) => (
                        <span key={`zone-detail-tag-${tag}`} className="rounded bg-[#2f3a24] px-2 py-0.5 text-[11px] font-semibold text-[#d8f08c]">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="rounded-lg border border-yt-border/70 bg-yt-bg-tertiary/60 p-3">
                      <div className="mb-2 text-xs font-semibold text-yt-text-primary">Zone Data</div>
                      <div className="grid grid-cols-1 gap-2 text-[11px] text-yt-text-secondary md:grid-cols-2">
                        <div>
                          Status: <span className="font-semibold text-yt-text-primary">{selectedZoneDetails.status || '-'}</span>
                        </div>
                        <div>
                          Control: <span className="font-semibold text-yt-text-primary">{getControlText(selectedZoneDetails.status)}</span>
                        </div>
                        <div>
                          Priority: <span className="font-semibold text-yt-text-primary">{selectedZoneDetailsPriority ? getPriorityLabel(selectedZoneDetailsPriority) : '-'}</span>
                        </div>
                        <div>
                          Mission: <span className="font-semibold text-yt-text-primary">{selectedZoneDetailsMission?.mission_status || 'none'}</span>
                        </div>
                        <div>
                          Activity: <span className="font-semibold text-yt-text-primary">{selectedZoneDetails.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div>
                          Last Change: <span className="font-semibold text-yt-text-primary">{formatRelativeTime(selectedZoneDetailsChangedAt)}</span>
                        </div>
                        <div>
                          Zone Acceptance: <span className="font-semibold text-yt-text-primary">{selectedZoneDetails.operation_assigned ? 'Accepted' : 'Available'}</span>
                        </div>
                        <div>
                          Accepted by: <span className="font-semibold text-yt-text-primary">{selectedZoneDetails.operation_assigned_to || '-'}</span>
                        </div>
                        <div>
                          Acceptance Timer: <span className="font-semibold text-yt-text-primary">{selectedZoneDetails.operation_assigned ? formatDurationMmSs(selectedZoneDetails.operation_remaining_ms) : '-'}</span>
                        </div>
                        <div className="md:col-span-2">
                          Tasks: <span className="font-semibold text-yt-text-primary">{(selectedZoneDetails.tasks || []).length > 0 ? selectedZoneDetails.tasks.join(', ') : 'none'}</span>
                        </div>
                        <div className="md:col-span-2">
                          Coordinates DMS: <span className="font-mono text-yt-text-primary">{formatZoneCoordinates(selectedZoneDetails.coordinates, 'dms')}</span>
                        </div>
                        <div className="md:col-span-2">
                          Coordinates MGRS: <span className="font-mono text-yt-text-primary">{formatZoneCoordinates(selectedZoneDetails.coordinates, 'mgrs')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-lg border border-yt-border/70 bg-yt-bg-tertiary/60 p-3">
                      <div className="mb-2 text-xs font-semibold text-yt-text-primary">Surrounded By RED Zones</div>
                      {selectedZoneDetailsRedNeighbors.length === 0 ? (
                        <div className="text-[11px] text-yt-text-secondary">No adjacent RED zones.</div>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {selectedZoneDetailsRedNeighbors.map((zone) => (
                            <span key={`zone-red-neighbor-${zone.id}`} className="rounded border border-red-500/50 bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-200">
                              Zone {getZoneNumber(zone)} ({zone.id})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 rounded-lg border border-yt-border/70 bg-yt-bg-tertiary/60 p-3 text-[11px] text-yt-text-secondary">
                      {!selectedZoneDetailsHasTasks && (
                        <div>Zone is not acceptable: it has no tasks.</div>
                      )}
                      {!selectedZoneDetailsAcceptedByCurrentUser && !canCurrentUserAcceptMoreZones && selectedZoneDetailsHasTasks && (
                        <div>User limit reached: you can accept at most 2 zones.</div>
                      )}
                      {selectedZoneDetailsAcceptedByOther && (
                        <div>This zone is currently locked by another pilot.</div>
                      )}
                      {selectedZoneDetailsAcceptedByCurrentUser && (
                        <div>You are operating on this zone.</div>
                      )}
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
                          </>
                        ) : (
                          <div className="text-[11px] text-yt-text-secondary">
                            Only the assigned pilot can complete this task.
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
