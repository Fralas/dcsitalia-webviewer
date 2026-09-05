import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
import kc135ModelUrl from '../assets/3D/kc-135_dcs_world.glb';
import { Ambulance, Blend, Box, Boxes, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChessRook, Clock3, Factory, Forklift, Fuel, Hammer, MapPin, PersonStanding, Satellite, X } from 'lucide-react';
import InlineError from './InlineError';
import frontlineZones from '../config/frontlineZones.json';
import { getDefaultTacticalMap, getTacticalMapByCampaignId } from '../config/tacticalMaps';
import { buildZoneConnections, getNeighborZoneIds, normalizeZoneId } from '../config/zoneConfini';
import { getAirportCoalition, isAirportActiveOnMap } from '../utils/airportStatus';
import airports from '../config/airports';
import { importantWeaponsAirports, importantWeaponsCarriers, importantWeaponsHeliports } from '../config/weapons';
import tankIcon from '../assets/tank-icon.svg';
import socketService from '../services/socket';
import { acceptDcsarTask, acceptFrontlineZone, acceptMission, cancelDbuildPlacement, cancelMission, completeDcsarTask, completeMission, composeAirportLogisticsMission, confirmDbuildPlacement, createDbuildPlacement, createOrder, declineFrontlineZone, getAirliftPlayers, getAirportOccupancy, getCombatMissions, getConvoys, getDcsar, getDbuildCatalog, getDbuildPlacements, getFeed, getFrontlineZones, getLogisticsRouteVisibility, getMissions, getServerTime, getTankerOptions, getTankerRoutes, purchaseAirportLogistics, setAirportLogisticsRoutePriority, getProductionPoints, getSpawnOptions, getWebSpawnMarkers, requestProductionPointUpgrade, retrieveProductionPointCrates, spawnAirportInfantry, spawnAirportCrate, spawnMapAction, spawnTanker, updateAirportOrder } from '../services/api';
import ZoneMissionCard from './map/ZoneMissionCard';
import LiveFeedPanel from './map/LiveFeedPanel';
import MapFilterBar from './map/MapFilterBar';
import MapActionContextMenu from './map/MapActionContextMenu';
import ProductionPointPanel from './map/ProductionPointPanel';
import ProductionPointRetrieveBanner from './map/ProductionPointRetrieveBanner';
import HidcMapAirportHoverPointer from './map/HidcMapAirportHoverPointer';
import LidcAirportPresencePanel from './LidcAirportPresencePanel';
import LidcAirportWizard from './LidcAirportWizard';
import './map/AirportSpawnPanel.css';
import './map/HidcAirportLogistics.css';
import { buildIsoContainerPlan, formatIsoUnits } from '../utils/isoLoad';
import { useUser } from '../contexts/UserContext';
import { CARTO_DARK_NOLABELS_TILE_URL } from '../config/cartoBasemap';

const MAP_ENGINE = String(import.meta.env.VITE_MAP_ENGINE || 'maplibre').trim().toLowerCase();
const LOGISTICS_ROUTE_TOGGLE_ROLE_ID = '1447684923518484500';
const BASEMAP_MODE_DARK = 'dark';
const BASEMAP_MODE_SATELLITE = 'satellite';
const MAPLIBRE_FOCUS_Y_OFFSET_PX = 132;
const MAPLIBRE_DCSAR_ICON_PENDING_IMAGE_ID = 'dcsar-person-icon-pending';
const MAPLIBRE_DCSAR_ICON_ACCEPTED_IMAGE_ID = 'dcsar-person-icon-accepted';
const MAPLIBRE_DCSAR_ICON_SIZE = ['interpolate', ['linear'], ['zoom'], 5, 1.15, 8, 1.55, 10, 1.9];
const MAPLIBRE_AIRPORT_DOT_RADIUS = [
  'interpolate',
  ['linear'],
  ['zoom'],
  4, 3.2,
  6, 4.2,
  8, 5,
  10, 5.4,
];
const MAPLIBRE_DBUILD_HAMMER_WHITE_IMAGE_ID = 'dbuild-hammer-white';
const MAPLIBRE_DBUILD_HAMMER_GREEN_IMAGE_ID = 'dbuild-hammer-green';
const MAPLIBRE_DBUILD_ROOK_BLUE_IMAGE_ID = 'dbuild-rook-blue';
const MAPLIBRE_CRATE_BOX_IMAGE_ID = 'crate-box-icon';
const MAPLIBRE_CRATE_BOXES_IMAGE_ID = 'crate-boxes-icon';
const MAPLIBRE_PP_FACTORY_WHITE_IMAGE_ID = 'pp-factory-white';
const MAPLIBRE_PP_FACTORY_BLUE_IMAGE_ID = 'pp-factory-blue';
const MAPLIBRE_PP_FACTORY_RED_IMAGE_ID = 'pp-factory-red';
const CRATE_CLUSTER_RADIUS_M = 20;
const DBUILD_SITE_MATCH_RADIUS_M = 150;

function isDesktopGlobeDevice() {
  if (typeof window === 'undefined') return true;
  const ua = String(window.navigator?.userAgent || '');
  const isTabletOrPhoneUa = /(Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Tablet)/i.test(ua);
  if (isTabletOrPhoneUa) return false;
  return window.matchMedia('(min-width: 1025px)').matches;
}

const BASEMAP_CONFIG = {
  [BASEMAP_MODE_DARK]: {
    leafletUrl: CARTO_DARK_NOLABELS_TILE_URL,
    leafletAttribution: '&copy; OpenStreetMap contributors, &copy; CARTO',
    maplibreLayerId: 'carto-darkmatter-raster',
  },
  [BASEMAP_MODE_SATELLITE]: {
    leafletUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    leafletAttribution: 'Tiles &copy; Esri',
    maplibreLayerId: 'esri-satellite-raster',
  },
};

const MAP_VIEW_PREFS_STORAGE_KEY = 'dcsitalia.mapViewPrefs';

const DEFAULT_MAP_FILTERS = {
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
  showAirliftPlayers: true,
  showDcsar: true,
  showProductionPoints: true,
};

function readStoredMapViewPrefs() {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(MAP_VIEW_PREFS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function mergeMapFilters(storedFilters) {
  const next = { ...DEFAULT_MAP_FILTERS };
  if (!storedFilters || typeof storedFilters !== 'object') return next;
  Object.keys(DEFAULT_MAP_FILTERS).forEach((key) => {
    if (key.startsWith('show')) {
      if (typeof storedFilters[key] === 'boolean') next[key] = storedFilters[key];
      return;
    }
    if (typeof storedFilters[key] === 'string' && storedFilters[key]) {
      next[key] = storedFilters[key];
    }
  });
  return next;
}

function mergeBasemapMode(storedMode) {
  return storedMode === BASEMAP_MODE_DARK ? BASEMAP_MODE_DARK : BASEMAP_MODE_SATELLITE;
}

function getInitialMapViewPrefs() {
  const stored = readStoredMapViewPrefs();
  return {
    filters: mergeMapFilters(stored?.filters),
    basemapMode: mergeBasemapMode(stored?.basemapMode),
  };
}

function persistMapViewPrefs(filters, basemapMode) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(MAP_VIEW_PREFS_STORAGE_KEY, JSON.stringify({ filters, basemapMode }));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

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

const KM_PER_NM = 1.852;
const AIRPORT_ZONE_MEMBERSHIP_NM = 6 / KM_PER_NM;

function findNearestZoneForPoint(lat, lon, zones, maxNm = AIRPORT_ZONE_MEMBERSHIP_NM) {
  const pointLat = Number(lat);
  const pointLon = Number(lon);
  if (!Number.isFinite(pointLat) || !Number.isFinite(pointLon)) return null;

  let nearest = null;
  let nearestNm = maxNm;
  (zones || []).forEach((zone) => {
    const zoneLat = Number(zone?.coordinates?.lat);
    const zoneLon = Number(zone?.coordinates?.lon);
    if (!Number.isFinite(zoneLat) || !Number.isFinite(zoneLon)) return;
    const distanceNm = haversineNm(pointLat, pointLon, zoneLat, zoneLon);
    if (distanceNm <= nearestNm) {
      nearestNm = distanceNm;
      nearest = zone;
    }
  });
  return nearest;
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
  const lon = Number(coordinates.lon ?? coordinates.lng ?? 0);
  const lat = Number(coordinates.lat || 0);
  return {
    // cobe uses phi as globe rotation around vertical axis; negative lon centers the area.
    phi: (-lon * Math.PI) / 180,
    theta: (lat * Math.PI) / 180,
  };
}

function normalizeMapCoordinates(coordinates) {
  if (!coordinates) return null;
  const lat = Number(coordinates.lat);
  const lon = Number(coordinates.lon ?? coordinates.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function getControlText(status) {
  if (status === 'RED') return 'red control';
  if (status === 'BLUE') return 'blue control';
  if (status === 'UNDER_ATTACK') return 'contested control';
  return 'no control';
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
const PP_RETRIEVE_RADIUS_M = 500;
const SPAWN_QUANTITY_MAX = 5;
const SPAWN_OFFSET_METERS = 2;
const SPAWN_OFFSET_BEARING_DEG = 90;
const MAP_ZOOM_DEFAULT_MAX = 14;
const MAP_ZOOM_AIRPORT_MAX = 18;
const MAP_ZOOM_SPAWN_MAX = MAP_ZOOM_AIRPORT_MAX;
const MAP_ICON_PP_SIZE = 26;
const MAP_ICON_PP_FRAME = 36;
const MAP_ICON_CRATE_SIZE = 22;
const MAP_ICON_CRATE_FRAME = 28;
const MAPLIBRE_PP_ICON_SIZE = 1.2;
const MAPLIBRE_CRATE_ICON_SIZE = 1.02;

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

const TANKER_MIN_DIST_NM = 45;
const TANKER_EXCLUSION_RADIUS_M = TANKER_MIN_DIST_NM * 1852;
const TANKER_ROUTE_COLOR = '#22d3ee';
const TANKER_ROUTE_ALTITUDE_FT = 150000;
const TANKER_ROUTE_ALTITUDE_M = TANKER_ROUTE_ALTITUDE_FT * 0.3048;
const TANKER_ROUTE_TUBE_RADIUS_M = 85;
const TANKER_ROUTE_ENDPOINT_RADIUS_M = 180;
const TANKER_ROUTE_ENDPOINT_COLOR = '#0b5568';
const TANKER_KC135_ROUTE_CLEARANCE_M = TANKER_ROUTE_TUBE_RADIUS_M + 120;

function formatTankerRouteLabel(route) {
  if (!route) return 'Tanker';
  const parts = [route.label || route.keyword || 'Tanker'];
  if (route.platform) parts.push(route.platform);
  if (route.tacan) parts.push(`TCN ${route.tacan}`);
  if (Number.isFinite(route.altitude_ft)) parts.push(`${Math.round(route.altitude_ft)} ft`);
  if (Number.isFinite(route.speed_kt)) parts.push(`${Math.round(route.speed_kt)} kts`);
  if (Number.isFinite(route.distance_nm)) parts.push(`${route.distance_nm.toFixed(1)} NM`);
  parts.push(`FL${Math.round(TANKER_ROUTE_ALTITUDE_FT / 100)}`);
  return parts.join(' • ');
}

function normalizeTankerLatLon(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let nextLat = lat;
  let nextLon = lon;
  if (Math.abs(nextLat) <= Math.PI && Math.abs(nextLon) <= (2 * Math.PI)) {
    nextLat = (nextLat * 180) / Math.PI;
    nextLon = (nextLon * 180) / Math.PI;
  }
  return { lat: nextLat, lon: nextLon };
}

function addTankerRouteEndpointCircle(group, map, lon, lat, altMeters) {
  if (!group || !map) return null;
  const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altMeters);
  const scaleMerc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
  const radius = scaleMerc.meterInMercatorCoordinateUnits() * TANKER_ROUTE_ENDPOINT_RADIUS_M;
  const geometry = new THREE.SphereGeometry(1, 20, 16);
  const material = new THREE.MeshPhongMaterial({
    color: TANKER_ROUTE_ENDPOINT_COLOR,
    emissive: new THREE.Color(TANKER_ROUTE_ENDPOINT_COLOR),
    emissiveIntensity: 0.06,
    transparent: false,
    opacity: 1,
    depthTest: true,
    depthWrite: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(merc.x, merc.y, merc.z);
  mesh.scale.set(radius, radius, radius);
  mesh.renderOrder = 10;
  mesh.userData.disposeGeometry = true;
  group.add(mesh);
  return mesh;
}

function buildTankerRouteFeatures(routes) {
  const lineFeatures = [];

  (routes || []).forEach((route) => {
    const wp1Raw = route?.wp1;
    const wp2Raw = route?.wp2;
    if (!wp1Raw || !wp2Raw) return;
    const wp1 = normalizeTankerLatLon(Number(wp1Raw.lat), Number(wp1Raw.lon));
    const wp2 = normalizeTankerLatLon(Number(wp2Raw.lat), Number(wp2Raw.lon));
    if (!wp1 || !wp2) return;

    lineFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[wp1.lon, wp1.lat], [wp2.lon, wp2.lat]],
      },
      properties: {
        id: route.id || route.keyword || 'tanker',
        label: formatTankerRouteLabel(route),
        keyword: route.keyword || '',
      },
    });
  });

  return { lineFeatures };
}

const SPAWN_MENU_SECTIONS = [
  {
    id: 'infantry',
    title: 'INFANTRY TO EMBARK',
    spawnType: 'inf_spawn',
    keywords: ['MANPAD', 'SCOUT'],
  },
  {
    id: 'build',
    title: 'SPAWN CRATE FOR BUILD ASSET',
    spawnType: 'crate_spawn',
    keywords: ['AMMO', 'FUEL', 'BUILD', 'PPBUILD'],
  },
  {
    id: 'deployables',
    title: 'SPAWN CRATE TO DEPLOYABLES VEHICLE',
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

function createAirportMarkerIcon(coalition = 'neutral') {
  const hitSize = 18;
  const html = renderToStaticMarkup(
    <div className={`airport-marker-icon__inner airport-marker-icon__inner--${coalition}`} />
  );

  return divIcon({
    html,
    className: 'airport-marker-icon',
    iconSize: [hitSize, hitSize],
    iconAnchor: [hitSize / 2, hitSize / 2],
  });
}

const AIRPORT_HOVER_HIT_PX = 40;
const airportMarkerIconCache = new Map();

function getAirportMarkerIcon(coalition = 'neutral') {
  const key = coalition === 'blue' || coalition === 'red' ? coalition : 'neutral';
  if (!airportMarkerIconCache.has(key)) {
    airportMarkerIconCache.set(key, createAirportMarkerIcon(key));
  }
  return airportMarkerIconCache.get(key);
}

function getMapLibreCustomLayerMatrix(matrix, options) {
  if (matrix && typeof matrix.length === 'number' && matrix.length >= 16) {
    return matrix;
  }
  if (options?.modelViewProjectionMatrix && options.modelViewProjectionMatrix.length >= 16) {
    return options.modelViewProjectionMatrix;
  }
  if (matrix?.defaultProjectionData?.mainMatrix) {
    return matrix.defaultProjectionData.mainMatrix;
  }
  if (options?.defaultProjectionData?.mainMatrix) {
    return options.defaultProjectionData.mainMatrix;
  }
  return null;
}

function rememberHoveredAirport(current, nearest) {
  if (!nearest) return current ? null : current;
  if (
    current
    && current.lon === nearest.lon
    && current.lat === nearest.lat
    && current.name === nearest.name
    && current.coalition === nearest.coalition
    && current.zoneNumber === nearest.zoneNumber
  ) {
    return current;
  }
  return nearest;
}

function pickNearestAirportHover(projectPoint, airports, cursor, hitPx = AIRPORT_HOVER_HIT_PX) {
  if (!cursor || !Number.isFinite(cursor.x) || !Number.isFinite(cursor.y)) return null;
  let nearest = null;
  let nearestDist = hitPx;
  airports.forEach((airport) => {
    const lat = airport.coordinates?.lat;
    const lon = airport.coordinates?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    const point = projectPoint(lon, lat);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return;
    const dist = Math.hypot(cursor.x - point.x, cursor.y - point.y);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = {
        lon,
        lat,
        name: airport.displayName || airport.name || airport.id,
        coalition: airport.coalition === 'blue' || airport.coalition === 'red' ? airport.coalition : 'neutral',
        zoneNumber: airport.zoneNumber ? String(airport.zoneNumber) : '',
      };
    }
  });
  return nearest;
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

function buildDbuildSvgMarkup(kind) {
  const defs = {
    'hammer-white': { Icon: Hammer, color: '#ffffff' },
    'hammer-green': { Icon: Hammer, color: '#22c55e' },
    'rook-blue': { Icon: ChessRook, color: '#3b82f6' },
  };
  const def = defs[kind] || defs['hammer-white'];
  const IconComponent = def.Icon;
  return renderToStaticMarkup(
    <IconComponent
      size={24}
      color={def.color}
      strokeWidth={2.3}
      style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }}
    />
  );
}

function buildCrateSvgMarkup(kind) {
  const IconComponent = kind === 'boxes' ? Boxes : Box;
  return renderToStaticMarkup(
    <IconComponent
      size={24}
      color="#f59e0b"
      strokeWidth={2.3}
      style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }}
    />
  );
}

async function ensureMapLibreDbuildAndCrateIconImages(map) {
  const dbuildDefs = [
    { id: MAPLIBRE_DBUILD_HAMMER_WHITE_IMAGE_ID, kind: 'hammer-white' },
    { id: MAPLIBRE_DBUILD_HAMMER_GREEN_IMAGE_ID, kind: 'hammer-green' },
    { id: MAPLIBRE_DBUILD_ROOK_BLUE_IMAGE_ID, kind: 'rook-blue' },
  ];
  const crateDefs = [
    { id: MAPLIBRE_CRATE_BOX_IMAGE_ID, kind: 'box' },
    { id: MAPLIBRE_CRATE_BOXES_IMAGE_ID, kind: 'boxes' },
  ];

  for (const def of [...dbuildDefs, ...crateDefs]) {
    if (map.hasImage(def.id)) continue;
    const svg = def.kind === 'box' || def.kind === 'boxes'
      ? buildCrateSvgMarkup(def.kind)
      : buildDbuildSvgMarkup(def.kind);
    const image = await loadSvgAsImage(svg);
    map.addImage(def.id, image, { pixelRatio: 2 });
  }
}

function createDbuildMapIcon(kind, selected = false) {
  const defs = {
    'hammer-white': { Icon: Hammer, color: '#ffffff' },
    'hammer-green': { Icon: Hammer, color: '#22c55e' },
    'rook-blue': { Icon: ChessRook, color: '#3b82f6' },
  };
  const def = defs[kind] || defs['hammer-white'];
  const IconComponent = def.Icon;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '999px',
        border: selected ? '2px solid #facc15' : 'none',
        boxShadow: selected ? '0 0 0 2px rgba(250, 204, 21, 0.35)' : 'none',
      }}
    >
      <IconComponent size={22} color={def.color} strokeWidth={2.3} style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }} />
    </div>
  );

  return divIcon({
    html,
    className: 'dbuild-map-icon',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function createCrateClusterIcon(kind) {
  const IconComponent = kind === 'boxes' ? Boxes : Box;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: `${MAP_ICON_CRATE_FRAME}px`,
        height: `${MAP_ICON_CRATE_FRAME}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent size={MAP_ICON_CRATE_SIZE} color="#f59e0b" strokeWidth={2.3} style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }} />
    </div>
  );

  const anchor = MAP_ICON_CRATE_FRAME / 2;
  return divIcon({
    html,
    className: 'crate-cluster-icon',
    iconSize: [MAP_ICON_CRATE_FRAME, MAP_ICON_CRATE_FRAME],
    iconAnchor: [anchor, anchor],
  });
}

function buildProductionPointSvgMarkup(kind) {
  const color = kind === 'pp-blue' ? '#3b82f6' : (kind === 'pp-red' ? '#ef4444' : '#ffffff');
  return renderToStaticMarkup(
    <Factory
      size={28}
      color={color}
      strokeWidth={2.3}
      style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }}
    />
  );
}

async function ensureMapLibreProductionPointIconImages(map) {
  const defs = [
    { id: MAPLIBRE_PP_FACTORY_WHITE_IMAGE_ID, kind: 'pp-white' },
    { id: MAPLIBRE_PP_FACTORY_BLUE_IMAGE_ID, kind: 'pp-blue' },
    { id: MAPLIBRE_PP_FACTORY_RED_IMAGE_ID, kind: 'pp-red' },
  ];

  for (const def of defs) {
    if (map.hasImage(def.id)) continue;
    const svg = buildProductionPointSvgMarkup(def.kind);
    const image = await loadSvgAsImage(svg);
    map.addImage(def.id, image, { pixelRatio: 2 });
  }
}

function createProductionPointIcon(pp, selected = false) {
  const color = getProductionPointFactoryColor(pp);
  const upgrading = pp?.upgrading === true;
  const html = renderToStaticMarkup(
    <div
      style={{
        width: `${MAP_ICON_PP_FRAME}px`,
        height: `${MAP_ICON_PP_FRAME}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '999px',
        border: selected || upgrading ? '2px solid #facc15' : 'none',
        boxShadow: selected || upgrading ? '0 0 0 2px rgba(250, 204, 21, 0.35)' : 'none',
      }}
    >
      <Factory size={MAP_ICON_PP_SIZE} color={color} strokeWidth={2.3} style={{ filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.8))' }} />
    </div>
  );

  const anchor = MAP_ICON_PP_FRAME / 2;
  return divIcon({
    html,
    className: 'production-point-icon',
    iconSize: [MAP_ICON_PP_FRAME, MAP_ICON_PP_FRAME],
    iconAnchor: [anchor, anchor],
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

function airportIconScaleFromZoom(zoom) {
  const z = Number(zoom);
  if (!Number.isFinite(z) || z <= 4) return 0.28;
  if (z >= 10) return 1;
  if (z <= 6) return 0.28 + ((z - 4) * 0.16);
  return 0.6 + ((z - 6) * 0.1);
}

function applyMapLibreAirportIconSize(map) {
  if (!map?.getLayer?.('airports-core-layer')) return;
  const scale = Math.max(0.7, airportIconScaleFromZoom(map.getZoom()));
  map.setPaintProperty('airports-core-layer', 'circle-radius', Number((5 * scale).toFixed(2)));
}

function applyLeafletAirportIconScale(map) {
  const scale = Math.max(0.7, airportIconScaleFromZoom(map.getZoom()));
  const container = map.getContainer();
  container.style.setProperty('--hidc-airport-icon-scale', String(scale));
  container.querySelectorAll('.airport-marker-icon__inner').forEach((el) => {
    el.style.transform = `scale(${scale})`;
  });
}

function FlatMapZoomWatcher({ onZoomChange, airportCount, showAirports }) {
  const map = useMapEvents({
    zoom: () => {
      applyLeafletAirportIconScale(map);
    },
    zoomend: () => {
      applyLeafletAirportIconScale(map);
      onZoomChange(map.getZoom());
    },
  });

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => applyLeafletAirportIconScale(map));
    onZoomChange(map.getZoom());
    return () => window.cancelAnimationFrame(frame);
  }, [map, onZoomChange, airportCount, showAirports]);

  return null;
}

// Captures map clicks while a web spawn is being placed (click-to-place flow).
function FlatMapContextMenuHandler({ enabled, onContextMenu }) {
  useMapEvents({
    contextmenu(event) {
      if (!enabled || !onContextMenu) return;
      event.originalEvent.preventDefault();
      onContextMenu({
        lat: event.latlng.lat,
        lon: event.latlng.lng,
        clientX: event.originalEvent.clientX,
        clientY: event.originalEvent.clientY,
      });
    },
  });
  return null;
}

// Keeps the corona menu pinned to a map lat/lon while the camera moves/zooms.
function FlatMapContextMenuAnchorTracker({ anchor, onScreenUpdate }) {
  const map = useMap();

  useEffect(() => {
    if (!anchor || !onScreenUpdate) return undefined;
    if (!Number.isFinite(anchor.lat) || !Number.isFinite(anchor.lon)) return undefined;

    let rafId = 0;
    const update = () => {
      const point = map.latLngToContainerPoint([anchor.lat, anchor.lon]);
      const rect = map.getContainer().getBoundingClientRect();
      onScreenUpdate({
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      });
    };
    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };

    update();
    map.on('move', schedule);
    map.on('zoom', schedule);
    map.on('resize', schedule);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      map.off('move', schedule);
      map.off('zoom', schedule);
      map.off('resize', schedule);
    };
  }, [map, anchor?.lat, anchor?.lon, onScreenUpdate]);

  return null;
}

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

function getProductionPointFactoryColor(pp) {
  const owner = String(pp?.owner || 'NEUTRAL').toUpperCase();
  if (owner === 'RED' || owner === 'CONTESTED') {
    return '#ef4444';
  }
  if (pp?.built && owner === 'BLUE') {
    return '#3b82f6';
  }
  return '#ffffff';
}

function getProductionPointFactoryKind(pp) {
  const owner = String(pp?.owner || 'NEUTRAL').toUpperCase();
  if (owner === 'RED' || owner === 'CONTESTED') return 'pp-red';
  if (pp?.built && owner === 'BLUE') return 'pp-blue';
  return 'pp-white';
}

function formatProductionPointNumber(rawId) {
  const id = String(rawId || '').trim();
  const match = id.match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? match[1].padStart(2, '0') : null;
}

function formatProductionPointHoverLabel(pp) {
  const raw = typeof pp === 'string' ? pp : (pp?.zone_name || pp?.id);
  const num = formatProductionPointNumber(raw);
  if (num) return `Prod. Point ${num}`;
  return String(raw || 'PP');
}

function formatProductionPointPanelLabel(pp) {
  const raw = typeof pp === 'string' ? pp : (pp?.zone_name || pp?.id);
  const num = formatProductionPointNumber(raw);
  if (num) return `Production Point ${num}`;
  return String(raw || 'Production Point');
}

function clampRetrieveQuantity(quantity, maxStock) {
  const max = Math.max(1, Math.floor(Number(maxStock)) || 1);
  return Math.max(1, Math.min(max, Math.floor(Number(quantity)) || 1));
}

function PanelCloseButton({ onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Close"
      title="Close"
      className={`inline-flex shrink-0 items-center justify-center rounded border border-yt-border p-1.5 text-yt-text-secondary transition-colors hover:bg-yt-bg-tertiary/50 hover:text-yt-text-primary ${className}`}
    >
      <X className="h-4 w-4" strokeWidth={2.5} />
    </button>
  );
}

function isProductionPointZone(zone, productionPoints = []) {
  const id = String(zone?.id || '').trim();
  const name = String(zone?.name || zone?.zone_name || '').trim();
  const candidates = [id, name].filter(Boolean);
  const ppIds = new Set(
    (productionPoints || []).flatMap((pp) => [String(pp?.id || '').trim(), String(pp?.zone_name || '').trim()]).filter(Boolean)
  );
  if (candidates.some((value) => ppIds.has(value))) return true;
  return candidates.some((value) => /^PP[_\s-]/i.test(value));
}

function normalizeZoneCoordinates(zone, fallback = null) {
  const lat = Number(zone?.coordinates?.lat ?? zone?.lat ?? fallback?.lat);
  const lon = Number(zone?.coordinates?.lon ?? zone?.lon ?? zone?.lng ?? zone?.coordinates?.lng ?? fallback?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return { lat, lon };
}

function applyIncomingFrontlineZones(incoming, previous) {
  if (!Array.isArray(incoming) || incoming.length === 0) return previous;
  const previousById = new Map((Array.isArray(previous) ? previous : []).map((zone) => [zone?.id, zone]));
  return incoming.map((zone) => {
    const fallback = previousById.get(zone?.id)?.coordinates || null;
    const coordinates = normalizeZoneCoordinates(zone, fallback);
    return coordinates ? { ...zone, coordinates } : zone;
  });
}

function buildZoneCoordinatesByName(zones = []) {
  const map = new Map();
  zones.forEach((zone) => {
    const coords = zone?.coordinates;
    if (!coords || !Number.isFinite(coords.lat) || !Number.isFinite(coords.lon)) return;
    [zone?.id, zone?.name, zone?.zone_name].forEach((key) => {
      const normalized = String(key || '').trim();
      if (normalized) map.set(normalized, coords);
    });
  });
  return map;
}

function withResolvedProductionPointCoordinates(pp, zoneCoordsByName) {
  if (!pp || typeof pp !== 'object') return pp;
  if (Number.isFinite(pp?.coordinates?.lat) && Number.isFinite(pp?.coordinates?.lon)) {
    return pp;
  }
  const lat = Number(pp?.lat);
  const lon = Number(pp?.lon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return { ...pp, coordinates: { lat, lon } };
  }
  const keys = [pp?.id, pp?.zone_name].map((value) => String(value || '').trim()).filter(Boolean);
  for (const key of keys) {
    const coords = zoneCoordsByName.get(key);
    if (coords) {
      return { ...pp, coordinates: coords };
    }
  }
  return pp;
}

function getDbuildIconKind(status) {
  if (status === 'built') return 'rook-blue';
  if (status === 'draft') return 'hammer-white';
  return 'hammer-green';
}

function findNearestDbuildSite(sites, lat, lon, buildType, maxDistanceM = DBUILD_SITE_MATCH_RADIUS_M) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  let best = null;
  let bestDistance = maxDistanceM;
  (sites || []).forEach((site) => {
    if (buildType && site.type !== buildType) return;
    const siteLat = Number(site.lat);
    const siteLon = Number(site.lon);
    if (!Number.isFinite(siteLat) || !Number.isFinite(siteLon)) return;
    const distanceM = haversineMeters(lat, lon, siteLat, siteLon);
    if (distanceM <= bestDistance) {
      bestDistance = distanceM;
      best = site;
    }
  });
  return best;
}

function buildDbuildMapMarkers(placements, sites, catalog) {
  const markers = [];
  const matchedSiteKeys = new Set();
  const catalogById = new Map((catalog || []).map((entry) => [entry.id, entry]));

  (placements || []).forEach((placement) => {
    if (!Number.isFinite(placement?.lat) || !Number.isFinite(placement?.lon)) return;
    if (placement.status === 'cancelled' || placement.status === 'failed') return;

    const label = placement.catalog?.label || catalogById.get(placement.build_type)?.label || placement.build_type || 'Build';
    markers.push({
      id: `placement-${placement.id}`,
      lat: placement.lat,
      lon: placement.lon,
      kind: getDbuildIconKind(placement.status),
      label,
      status: placement.status || 'draft',
      placementId: placement.id,
      selectable: true,
    });

    const liveSite = placement.live || findNearestDbuildSite(sites, placement.lat, placement.lon, placement.build_type);
    if (liveSite?.type && liveSite?.site_id) {
      matchedSiteKeys.add(`${liveSite.type}:${liveSite.site_id}`);
    }
  });

  (sites || []).forEach((site) => {
    if (!Number.isFinite(site?.lat) || !Number.isFinite(site?.lon)) return;
    const key = `${site.type}:${site.site_id}`;
    if (matchedSiteKeys.has(key)) return;

    const catalogEntry = catalogById.get(site.type);
    const label = catalogEntry?.label || site.structure_name || site.type || 'Build';
    markers.push({
      id: `site-${key}`,
      lat: site.lat,
      lon: site.lon,
      kind: getDbuildIconKind(site.built ? 'built' : 'active'),
      label,
      status: site.built ? 'built' : 'active',
      placementId: null,
      selectable: false,
      structureName: site.structure_name || null,
    });
  });

  return markers;
}

function formatWebCommandToastMessage(data) {
  const raw = String(data?.message || '').trim();
  if (data?.type === 'pp_retrieve' && data?.ok === true) {
    if (/^retrieved \d+/i.test(raw)) return raw;
    const legacy = raw.match(/^retrieved_(\d+)_remaining_\d+$/i);
    if (legacy) {
      const count = Number(legacy[1]);
      return count === 1 ? 'Retrieved 1 crate' : `Retrieved ${count} crates`;
    }
    const qty = Number(data?.quantity);
    if (Number.isFinite(qty) && qty > 0) {
      return qty === 1 ? 'Retrieved 1 crate' : `Retrieved ${qty} crates`;
    }
  }
  return raw || (data?.ok ? 'Command executed.' : 'Command failed.');
}

function shouldShowCommandToastBalance(data) {
  if (data?.type === 'pp_retrieve' || data?.type === 'pp_upgrade') return false;
  return Number.isFinite(Number(data?.balance));
}

const COMMAND_TOAST_VISIBLE_MS = 3000;
const COMMAND_TOAST_FADE_MS = 300;

function clusterCratesWithinRadius(markers, radiusM = CRATE_CLUSTER_RADIUS_M) {
  const valid = (markers || []).filter((marker) => Number.isFinite(marker?.lat) && Number.isFinite(marker?.lon));
  const count = valid.length;
  if (count === 0) return [];

  const parent = Array.from({ length: count }, (_, index) => index);
  const find = (index) => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const union = (left, right) => {
    parent[find(left)] = find(right);
  };

  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const distanceM = haversineMeters(valid[i].lat, valid[i].lon, valid[j].lat, valid[j].lon);
      if (distanceM <= radiusM) union(i, j);
    }
  }

  const groups = new Map();
  valid.forEach((marker, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(marker);
  });

  return Array.from(groups.entries()).map(([root, group], index) => {
    const types = {};
    group.forEach((crate) => {
      const category = String(crate.keyword || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
      types[category] = (types[category] || 0) + 1;
    });
    const lat = group.reduce((sum, crate) => sum + crate.lat, 0) / group.length;
    const lon = group.reduce((sum, crate) => sum + crate.lon, 0) / group.length;
    return {
      id: `crate-cluster-${root}-${index}`,
      lat,
      lon,
      count: group.length,
      kind: group.length === 1 ? 'box' : 'boxes',
      types,
    };
  });
}

function formatCrateTypesText(types) {
  return Object.entries(types || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([typeName, qty]) => `${typeName}: ${qty}`)
    .join('\n');
}

function formatCrateTypesHtml(types) {
  return Object.entries(types || {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([typeName, qty]) => `<div>${typeName}: ${qty}</div>`)
    .join('');
}

function LeafletMapCapture({ onMap }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
    return () => onMap(null);
  }, [map, onMap]);
  return null;
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
  retrievePlacementActive,
  onRetrievePlace,
  retrievePpCenter,
  crateClusters,
  mapMaxZoom,
  dbuildMapMarkers,
  selectedDbuildPlacementId,
  onDbuildPlacementSelect,
  mapContextMenuEnabled,
  onMapContextMenu,
  mapContextMenuAnchor,
  onMapContextMenuScreenUpdate,
  tankerPlacementActive,
  onTankerPlace,
  tankerWp1,
  tankerRoutes,
}) {
  const center = normalizeMapCoordinates(focusCoordinates) || { lat: 35.5, lon: 37.5 };
  const activeBasemap = BASEMAP_CONFIG[basemapMode] || BASEMAP_CONFIG[BASEMAP_MODE_DARK];
  const effectiveMaxZoom = mapMaxZoom || MAP_ZOOM_DEFAULT_MAX;
  const placementActive = spawnPlacementActive || retrievePlacementActive || tankerPlacementActive;
  const placementCenter = spawnPlacementActive ? spawnAirportCenter : retrievePpCenter;
  const placementRadiusM = spawnPlacementActive ? AIRPORT_SPAWN_RADIUS_M : PP_RETRIEVE_RADIUS_M;
  const onPlacementPlace = tankerPlacementActive
    ? onTankerPlace
    : (spawnPlacementActive ? onSpawnPlace : onRetrievePlace);
  const airportsById = useMemo(() => {
    const map = new Map();
    airportsData.forEach((airport) => map.set(airport.id, airport));
    return map;
  }, [airportsData]);
  const [leafletMap, setLeafletMap] = useState(null);
  const [hoveredAirport, setHoveredAirport] = useState(null);

  useEffect(() => {
    if (!showAirports) setHoveredAirport(null);
  }, [showAirports]);

  useEffect(() => {
    if (!leafletMap) return undefined;
    const container = leafletMap.getContainer();

    const onMouseMove = (domEvent) => {
      if (!showAirports) {
        setHoveredAirport((current) => (current ? null : current));
        return;
      }
      const cursor = leafletMap.mouseEventToContainerPoint(domEvent);
      const nearest = pickNearestAirportHover(
        (lon, lat) => leafletMap.latLngToContainerPoint([lat, lon]),
        airportsData,
        cursor,
      );
      setHoveredAirport((current) => rememberHoveredAirport(current, nearest));
    };

    const onMouseLeave = (domEvent) => {
      if (domEvent.relatedTarget && container.contains(domEvent.relatedTarget)) return;
      setHoveredAirport((current) => (current ? null : current));
    };

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('mouseleave', onMouseLeave);
    return () => {
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('mouseleave', onMouseLeave);
    };
  }, [leafletMap, airportsData, showAirports]);

  return (
    <div className="relative h-full w-full">
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
        <LeafletMapCapture onMap={setLeafletMap} />
        <FlatMapZoomWatcher
          onZoomChange={onZoomChange}
          airportCount={airportsData.length}
          showAirports={showAirports}
        />
        <FlatMapFocus
          center={focusTargetKey ? focusCoordinates : null}
          targetZoom={
            placementActive
            || String(focusTargetKey || '').startsWith('airport:')
            || String(focusTargetKey || '').startsWith('spawn:')
            || String(focusTargetKey || '').startsWith('retrieve:')
              ? 15
              : undefined
          }
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
            icon={getAirportMarkerIcon(airport.coalition)}
            eventHandlers={{
              click: () => onAirportClick && onAirportClick(airport.id),
            }}
          />
        ))}

        {showProductionPoints && (productionPoints || []).map((pp) => {
          if (!pp.coordinates || !Number.isFinite(pp.coordinates.lat) || !Number.isFinite(pp.coordinates.lon)) {
            return null;
          }
          const isSelected = pp.id === selectedProductionPointId;
          return (
            <Marker
              key={`pp-${pp.id}`}
              position={[pp.coordinates.lat, pp.coordinates.lon]}
              icon={createProductionPointIcon(pp, isSelected)}
              eventHandlers={{
                click: () => onProductionPointSelect && onProductionPointSelect(pp.id),
              }}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                {`${formatProductionPointHoverLabel(pp)} • LV${pp.level}${pp.upgrading ? ' • UPGRADING' : ''}`}
              </Tooltip>
            </Marker>
          );
        })}

        {placementActive && placementCenter && Number.isFinite(placementCenter.lat) && Number.isFinite(placementCenter.lon) && (
          <Circle
            center={[placementCenter.lat, placementCenter.lon]}
            radius={placementRadiusM}
            pathOptions={{
              color: '#facc15',
              fillColor: '#facc15',
              fillOpacity: 0.06,
              weight: 2,
              dashArray: '6,6',
            }}
          />
        )}

        {tankerWp1 && Number.isFinite(tankerWp1.lat) && Number.isFinite(tankerWp1.lon) && (
          <>
            <Circle
              center={[tankerWp1.lat, tankerWp1.lon]}
              radius={TANKER_EXCLUSION_RADIUS_M}
              pathOptions={{
                color: '#ef4444',
                fillColor: '#ef4444',
                fillOpacity: 0.12,
                weight: 2,
                dashArray: '8,8',
              }}
            />
            <CircleMarker
              center={[tankerWp1.lat, tankerWp1.lon]}
              radius={10}
              pathOptions={{
                color: TANKER_ROUTE_COLOR,
                fillColor: TANKER_ROUTE_COLOR,
                fillOpacity: 0.95,
                weight: 3,
              }}
            />
          </>
        )}

        {(tankerRoutes || []).map((route) => {
          const wp1 = normalizeTankerLatLon(Number(route?.wp1?.lat), Number(route?.wp1?.lon));
          const wp2 = normalizeTankerLatLon(Number(route?.wp2?.lat), Number(route?.wp2?.lon));
          if (!wp1 || !wp2) return null;
          const routeKey = route.id || route.keyword || `${wp1.lat},${wp1.lon}`;
          return (
            <>
              <Polyline
                key={`tanker-route-line-${routeKey}`}
                positions={[[wp1.lat, wp1.lon], [wp2.lat, wp2.lon]]}
                pathOptions={{
                  color: TANKER_ROUTE_COLOR,
                  weight: 2,
                  opacity: 0.35,
                  dashArray: '10,8',
                }}
              >
                <Tooltip sticky opacity={0.95}>
                  {`${formatTankerRouteLabel(route)} (ground track)`}
                </Tooltip>
              </Polyline>
            </>
          );
        })}

        {(crateClusters || []).map((cluster) => {
          if (!Number.isFinite(cluster?.lat) || !Number.isFinite(cluster?.lon)) return null;
          return (
            <Marker
              key={`crate-cluster-${cluster.id}`}
              position={[cluster.lat, cluster.lon]}
              icon={createCrateClusterIcon(cluster.kind)}
            >
              <Popup>
                <div className="text-xs font-semibold whitespace-pre-line">
                  {formatCrateTypesText(cluster.types)}
                </div>
              </Popup>
              <Tooltip direction="top" offset={[0, -10]} opacity={0.95}>
                {cluster.count === 1 ? '1 crate' : `${cluster.count} crates`}
              </Tooltip>
            </Marker>
          );
        })}

        {(dbuildMapMarkers || []).map((marker) => {
          if (!Number.isFinite(marker?.lat) || !Number.isFinite(marker?.lon)) return null;
          const selected = marker.placementId && selectedDbuildPlacementId === marker.placementId;
          return (
            <Marker
              key={`dbuild-marker-${marker.id}`}
              position={[marker.lat, marker.lon]}
              icon={createDbuildMapIcon(marker.kind, selected)}
              eventHandlers={marker.selectable && marker.placementId ? {
                click: () => onDbuildPlacementSelect && onDbuildPlacementSelect(marker.placementId),
              } : undefined}
            >
              <Tooltip direction="top" offset={[0, -12]} opacity={0.95}>
                {marker.structureName ? `${marker.label} (${marker.structureName})` : `${marker.label} • ${marker.status}`}
              </Tooltip>
            </Marker>
          );
        })}

        <FlatMapContextMenuHandler enabled={mapContextMenuEnabled} onContextMenu={onMapContextMenu} />
        <FlatMapContextMenuAnchorTracker
          anchor={mapContextMenuAnchor}
          onScreenUpdate={onMapContextMenuScreenUpdate}
        />
        <FlatMapSpawnClickHandler active={placementActive} onPlace={onPlacementPlace} />
      </MapContainer>
      <HidcMapAirportHoverPointer map={leafletMap} airport={hoveredAirport} engine="leaflet" />
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
  retrievePlacementActive,
  onRetrievePlace,
  retrievePpCenter,
  crateClusters,
  dbuildMapMarkers,
  selectedDbuildPlacementId,
  onDbuildPlacementSelect,
  mapContextMenuEnabled,
  onMapContextMenu,
  mapContextMenuAnchor,
  onMapContextMenuScreenUpdate,
  tankerPlacementActive,
  onTankerPlace,
  tankerWp1,
  tankerRoutes,
  mapMaxZoom,
}) {
  const MIN_PITCH = 0;
  const MAX_PITCH = 85;
  const placementActive = spawnPlacementActive || retrievePlacementActive || tankerPlacementActive;
  const placementCenter = spawnPlacementActive ? spawnAirportCenter : retrievePpCenter;
  const placementRadiusM = spawnPlacementActive ? AIRPORT_SPAWN_RADIUS_M : PP_RETRIEVE_RADIUS_M;
  const onPlacementPlace = tankerPlacementActive
    ? onTankerPlace
    : (spawnPlacementActive ? onSpawnPlace : onRetrievePlace);
  const ZONE_DOME_RADIUS_METERS = 1000;
  const ZONE_DOME_HEIGHT_RATIO = 0.28;
  const LOGISTICS_ROUTE_RADIUS_METERS = 120;
  const LOGISTICS_C130_MODEL_SIZE_METERS = 110;
  const LOGISTICS_CH47_MODEL_SIZE_METERS = 92;
  const TANKER_KC135_MODEL_SIZE_METERS = 125;
  const LOGISTICS_CONVOY_MODEL_SIZE_METERS = 120;
  const AIRLIFT_C130_MODEL_SIZE_METERS = 92;
  const AIRLIFT_CH47_MODEL_SIZE_METERS = 78;
  const AIRLIFT_MIN_CLEARANCE_METERS = 30;
  const LOGISTICS_CH47_DISTANCE_THRESHOLD_METERS = 70000;
  const LOGISTICS_CH47_YAW_OFFSET_RAD = THREE.MathUtils.degToRad(70) + Math.PI;
  const LOGISTICS_CONVOY_YAW_OFFSET_RAD = 0;
  const MIN_SAFE_ZOOM = 5;
  const effectiveMaxZoom = mapMaxZoom || MAP_ZOOM_DEFAULT_MAX;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const domesOverlayRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [hoveredAirport, setHoveredAirport] = useState(null);
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
    kc135Template: null,
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
  const center = normalizeMapCoordinates(focusCoordinates) || { lat: 35.5, lon: 37.5 };
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
        tiles: [CARTO_DARK_NOLABELS_TILE_URL],
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
          'background-color': '#000000',
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
          coalition: airport.coalition || 'neutral',
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
          name: formatProductionPointHoverLabel(pp),
          owner,
          built: pp.built ? 1 : 0,
          factoryKind: getProductionPointFactoryKind(pp),
          level: Number(pp.level) || 0,
          upgrading: pp.upgrading ? 1 : 0,
          selected: pp.id === selectedProductionPointId ? 1 : 0,
        },
      }];
    }),
  }), [productionPoints, showProductionPoints, selectedProductionPointId]);

  const fcProductionPointsRef = useRef(fcProductionPoints);
  fcProductionPointsRef.current = fcProductionPoints;

  const applyProductionPointSourceData = useCallback((map) => {
    if (!map) return false;
    const source = map.getSource('production-points-src');
    if (!source?.setData) return false;
    source.setData(fcProductionPointsRef.current);
    return true;
  }, []);

  const fcCrateClusters = useMemo(() => ({
    type: 'FeatureCollection',
    features: (crateClusters || []).flatMap((cluster) => {
      if (!Number.isFinite(cluster?.lat) || !Number.isFinite(cluster?.lon)) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [cluster.lon, cluster.lat],
        },
        properties: {
          id: cluster.id || '',
          kind: cluster.kind || 'box',
          count: cluster.count || 1,
          typesHtml: formatCrateTypesHtml(cluster.types),
          typesText: formatCrateTypesText(cluster.types),
        },
      }];
    }),
  }), [crateClusters]);

  const fcSpawnRadius = useMemo(() => {
    if (!placementActive || !placementCenter) {
      return { type: 'FeatureCollection', features: [] };
    }
    const lat = Number(placementCenter.lat);
    const lon = Number(placementCenter.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [circlePolygon(lat, lon, placementRadiusM)],
    };
  }, [placementActive, placementCenter, placementRadiusM]);

  const fcDbuildMarkers = useMemo(() => ({
    type: 'FeatureCollection',
    features: (dbuildMapMarkers || []).flatMap((marker) => {
      if (!Number.isFinite(marker?.lat) || !Number.isFinite(marker?.lon)) return [];
      return [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [marker.lon, marker.lat],
        },
        properties: {
          id: marker.id || '',
          placementId: marker.placementId || '',
          label: marker.label || 'Build',
          status: marker.status || 'draft',
          kind: marker.kind || 'hammer-white',
          selectable: marker.selectable ? 1 : 0,
          selected: marker.placementId && marker.placementId === selectedDbuildPlacementId ? 1 : 0,
          structureName: marker.structureName || '',
        },
      }];
    }),
  }), [dbuildMapMarkers, selectedDbuildPlacementId]);

  const fcTankerWp1Point = useMemo(() => {
    if (!tankerWp1 || !Number.isFinite(tankerWp1.lat) || !Number.isFinite(tankerWp1.lon)) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [tankerWp1.lon, tankerWp1.lat],
        },
        properties: { id: 'tanker-wp1-point' },
      }],
    };
  }, [tankerWp1]);

  const fcTankerExclusionRing = useMemo(() => {
    if (!tankerWp1 || !Number.isFinite(tankerWp1.lat) || !Number.isFinite(tankerWp1.lon)) {
      return { type: 'FeatureCollection', features: [] };
    }
    return {
      type: 'FeatureCollection',
      features: [circlePolygon(tankerWp1.lat, tankerWp1.lon, TANKER_EXCLUSION_RADIUS_M)],
    };
  }, [tankerWp1]);

  const fcTankerRoutes = useMemo(() => {
    const { lineFeatures } = buildTankerRouteFeatures(tankerRoutes);
    return { type: 'FeatureCollection', features: lineFeatures };
  }, [tankerRoutes]);

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

  const applyZoneDomePose = useCallback((map, mesh, glowMesh, lon, lat) => {
    if (!map || !mesh || !glowMesh) return;
    const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], 0);
    const scale = merc.meterInMercatorCoordinateUnits() * ZONE_DOME_RADIUS_METERS;
    const heightScale = scale * ZONE_DOME_HEIGHT_RATIO;
    mesh.position.set(merc.x, merc.y, merc.z);
    mesh.scale.set(scale, scale, heightScale);
    mesh.frustumCulled = false;
    glowMesh.position.set(merc.x, merc.y, merc.z);
    glowMesh.scale.set(scale * 1.045, scale * 1.045, heightScale * 1.045);
    glowMesh.frustumCulled = false;
  }, []);

  const rebuildThreeDomes = useCallback(() => {
    const map = mapRef.current;
    const group = domes3dRef.current.group;
    if (!map || !group) return;

    const nextGroup = new THREE.Group();
    const nextDomes = [];
    const nextRoutes = [];
    const discardNext = () => {
      while (nextGroup.children.length > 0) {
        disposeThreeNode(nextGroup.children.pop());
      }
    };
    const commitNext = () => {
      while (group.children.length > 0) {
        disposeThreeNode(group.children.pop());
      }
      while (nextGroup.children.length > 0) {
        group.add(nextGroup.children[0]);
      }
      domes3dRef.current.domes = nextDomes;
      domes3dRef.current.routes = nextRoutes;
      map.triggerRepaint();
    };

    try {

    if (!showAto && !showLogistics && !showConvoys && !showAirliftPlayers && !(tankerRoutes || []).length) {
      commitNext();
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

      const material = new THREE.MeshPhongMaterial({
        color,
        transparent: true,
        opacity: isSelected ? 0.55 : 0.42,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        emissive: new THREE.Color(color),
        emissiveIntensity: 0.08,
      });
      const mesh = new THREE.Mesh(domes3dRef.current.geometry, material);
      mesh.renderOrder = 10;
      nextGroup.add(mesh);

      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: isSelected ? 0.28 : 0.2,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        side: THREE.BackSide,
      });
      const glowMesh = new THREE.Mesh(domes3dRef.current.geometry, glowMaterial);
      glowMesh.renderOrder = 11;
      nextGroup.add(glowMesh);
      applyZoneDomePose(map, mesh, glowMesh, lon, lat);

      nextDomes.push({
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
        nextGroup.add(routeMesh);

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

          nextGroup.add(planeRoot);
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
        nextGroup.add(tankWrapper);
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

        nextGroup.add(modelRoot);
      });
    }

    (tankerRoutes || []).forEach((route) => {
      const wp1Raw = route?.wp1;
      const wp2Raw = route?.wp2;
      if (!wp1Raw || !wp2Raw) return;
      const wp1 = normalizeTankerLatLon(Number(wp1Raw.lat), Number(wp1Raw.lon));
      const wp2 = normalizeTankerLatLon(Number(wp2Raw.lat), Number(wp2Raw.lon));
      if (!wp1 || !wp2) return;

      const altMeters = TANKER_ROUTE_ALTITUDE_M;
      const segments = 16;
      const points = [];
      for (let i = 0; i <= segments; i += 1) {
        const t = i / segments;
        const lat = wp1.lat + ((wp2.lat - wp1.lat) * t);
        const lon = wp1.lon + ((wp2.lon - wp1.lon) * t);
        const merc = maplibregl.MercatorCoordinate.fromLngLat([lon, lat], altMeters);
        points.push(new THREE.Vector3(merc.x, merc.y, merc.z));
      }

      const curve = new THREE.CatmullRomCurve3(points);
      const midMerc = maplibregl.MercatorCoordinate.fromLngLat(
        [(wp1.lon + wp2.lon) / 2, (wp1.lat + wp2.lat) / 2],
        0
      );
      const tubeRadius = midMerc.meterInMercatorCoordinateUnits() * TANKER_ROUTE_TUBE_RADIUS_M;
      const tubeGeometry = new THREE.TubeGeometry(curve, segments, tubeRadius, 8, false);
      const routeColor = TANKER_ROUTE_COLOR;
      const routeMaterial = new THREE.MeshPhongMaterial({
        color: routeColor,
        emissive: new THREE.Color(routeColor),
        emissiveIntensity: 0.22,
        transparent: true,
        opacity: 0.88,
        depthTest: true,
        depthWrite: true,
      });
      const routeMesh = new THREE.Mesh(tubeGeometry, routeMaterial);
      routeMesh.userData.disposeGeometry = true;
      routeMesh.renderOrder = 9;
      nextGroup.add(routeMesh);

      addTankerRouteEndpointCircle(nextGroup, map, wp1.lon, wp1.lat, altMeters);
      addTankerRouteEndpointCircle(nextGroup, map, wp2.lon, wp2.lat, altMeters);

      const kc135Template = domes3dRef.current.kc135Template || domes3dRef.current.c130Template;
      if (kc135Template) {
        const planeRoot = kc135Template.clone(true);
        const seed = hashString(String(route.id || route.keyword || `${wp1.lat},${wp1.lon}`));
        const t = 0.2 + ((seed % 61) / 100);
        const latAtT = wp1.lat + ((wp2.lat - wp1.lat) * t);
        const lonAtT = wp1.lon + ((wp2.lon - wp1.lon) * t);
        const planeAltMeters = altMeters + TANKER_KC135_ROUTE_CLEARANCE_M;
        const planeMerc = maplibregl.MercatorCoordinate.fromLngLat([lonAtT, latAtT], planeAltMeters);
        const routeBearingDeg = computeBearingDeg([wp1.lat, wp1.lon], [wp2.lat, wp2.lon]);
        const headingYaw = THREE.MathUtils.degToRad(routeBearingDeg) + Math.PI;
        const modelScale = midMerc.meterInMercatorCoordinateUnits() * TANKER_KC135_MODEL_SIZE_METERS;
        const routeOpacity = 0.88;
        const routeColorThree = new THREE.Color(routeColor);

        planeRoot.position.set(planeMerc.x, planeMerc.y, planeMerc.z);
        planeRoot.scale.set(modelScale, modelScale, modelScale);
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

        nextGroup.add(planeRoot);
      }
    });

    commitNext();
    } catch (error) {
      console.error('Failed to rebuild 3D map overlays:', error);
      discardNext();
    }
  }, [zones, showAto, selectedZoneId, showLogistics, logisticsMissions, logisticsFrontlineAirportIds, airportsById, showConvoys, convoys, showAirliftPlayers, airliftPlayers, tankerRoutes, disposeThreeNode, applyZoneDomePose]);

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
      pitch: initialCamera ? initialCamera.pitch : 48,
      bearing: initialCamera ? initialCamera.bearing : 0,
      minPitch: MIN_PITCH,
      maxPitch: MAX_PITCH,
      attributionControl: false,
      // Right mouse is reserved for the spawn corona menu — no pan/rotate/pitch.
      dragRotate: false,
      pitchWithRotate: false,
    });
    mapRef.current = map;
    setMapInstance(map);
    map.dragRotate.disable();
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
        await ensureMapLibreDbuildAndCrateIconImages(map);
      } catch (error) {
        console.error('Failed to initialize DBUILD/crate icon images:', error);
      }
      try {
        await ensureMapLibreProductionPointIconImages(map);
      } catch (error) {
        console.error('Failed to initialize production point icon images:', error);
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

      const initThreeOverlay = () => {
        const overlay = domesOverlayRef.current;
        if (!overlay || domes3dRef.current.renderer) return;

        const scene = new THREE.Scene();
        const camera = new THREE.Camera();
        const renderer = new THREE.WebGLRenderer({
          canvas: overlay,
          antialias: true,
          alpha: true,
        });
        renderer.setClearColor(0x000000, 0);
        renderer.autoClear = true;
        renderer.setPixelRatio(window.devicePixelRatio || 1);
        renderer.setSize(overlay.clientWidth || 1, overlay.clientHeight || 1, false);

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

        const paintThreeOverlay = () => {
          const overlayCanvas = domesOverlayRef.current;
          if (!overlayCanvas || !mapRef.current) return;
          const width = overlayCanvas.clientWidth;
          const height = overlayCanvas.clientHeight;
          if (!width || !height) return;
          if (overlayCanvas.width !== Math.round(width * (window.devicePixelRatio || 1))
            || overlayCanvas.height !== Math.round(height * (window.devicePixelRatio || 1))) {
            renderer.setPixelRatio(window.devicePixelRatio || 1);
            renderer.setSize(width, height, false);
          }

          let matrix = null;
          try {
            matrix = map.transform?.customLayerMatrix?.() || map.transform?.mercatorMatrix || null;
          } catch (_) {
            matrix = null;
          }
          if (!matrix || matrix.length < 16) return;
          camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
          const inverse = camera.projectionMatrixInverse.copy(camera.projectionMatrix);
          if (typeof inverse.invert === 'function') {
            inverse.invert();
          }

          (domes3dRef.current.domes || []).forEach((dome) => {
            applyZoneDomePose(map, dome.main, dome.glow, dome.lon, dome.lat);
            dome.main.material.opacity = dome.mainBaseOpacity;
            dome.glow.material.opacity = dome.glowBaseOpacity;
          });

          renderer.render(scene, camera);
        };

        map.on('render', paintThreeOverlay);
        domes3dRef.current.paintThreeOverlay = paintThreeOverlay;

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
            loader.loadAsync(kc135ModelUrl),
          ])
            .then((results) => {
              const c130Result = results[0];
              const ch47Result = results[1];
              const t72Result = results[2];
              const kc135Result = results[3];
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
              if (kc135Result.status === 'fulfilled') {
                domes3dRef.current.kc135Template = prepareTemplate(kc135Result.value);
              } else {
                console.error('Failed to load KC-135 model:', kc135Result.reason);
              }
              rebuildThreeDomes();
              map.triggerRepaint();
            })
            .catch((error) => {
              console.error('Failed to load aircraft models:', error);
            });
        }

        rebuildThreeDomes();
        map.triggerRepaint();
      };

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
        id: 'airports-hit-layer',
        type: 'circle',
        source: 'airports-src',
        paint: {
          'circle-radius': 14,
          'circle-color': '#000000',
          'circle-opacity': 0.001,
        },
      });

      map.addLayer({
        id: 'airports-core-layer',
        type: 'circle',
        source: 'airports-src',
        paint: {
          'circle-radius': MAPLIBRE_AIRPORT_DOT_RADIUS,
          'circle-color': [
            'match',
            ['get', 'coalition'],
            'blue', '#2563eb',
            'red', '#ef4444',
            'rgba(255, 255, 255, 0.95)',
          ],
          'circle-stroke-width': 1.2,
          'circle-stroke-color': [
            'match',
            ['get', 'coalition'],
            'blue', 'rgba(37, 99, 235, 0.55)',
            'red', 'rgba(239, 68, 68, 0.5)',
            'rgba(255, 255, 255, 0.4)',
          ],
          'circle-opacity': 1,
        },
      });
      applyMapLibreAirportIconSize(map);

      map.addLayer({
        id: 'production-points-layer',
        type: 'symbol',
        source: 'production-points-src',
        layout: {
          'icon-image': [
            'match',
            ['get', 'factoryKind'],
            'pp-blue', MAPLIBRE_PP_FACTORY_BLUE_IMAGE_ID,
            'pp-red', MAPLIBRE_PP_FACTORY_RED_IMAGE_ID,
            MAPLIBRE_PP_FACTORY_WHITE_IMAGE_ID,
          ],
          'icon-size': MAPLIBRE_PP_ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      map.addLayer({
        id: 'production-points-hit-layer',
        type: 'circle',
        source: 'production-points-src',
        paint: {
          'circle-radius': 20,
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

      applyProductionPointSourceData(map);

      addGeoSource('crate-clusters-src', fcCrateClusters);
      addGeoSource('spawn-radius-src', fcSpawnRadius);

      map.addLayer({
        id: 'spawn-radius-fill-layer',
        type: 'fill',
        source: 'spawn-radius-src',
        paint: {
          'fill-color': '#facc15',
          'fill-opacity': 0.08,
        },
      });

      map.addLayer({
        id: 'spawn-radius-line-layer',
        type: 'line',
        source: 'spawn-radius-src',
        paint: {
          'line-color': '#facc15',
          'line-width': 2.5,
          'line-dasharray': [2, 2],
          'line-opacity': 1,
        },
      });

      map.addLayer({
        id: 'crate-clusters-layer',
        type: 'symbol',
        source: 'crate-clusters-src',
        layout: {
          'icon-image': [
            'match',
            ['get', 'kind'],
            'boxes', MAPLIBRE_CRATE_BOXES_IMAGE_ID,
            MAPLIBRE_CRATE_BOX_IMAGE_ID,
          ],
          'icon-size': MAPLIBRE_CRATE_ICON_SIZE,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      map.on('click', 'crate-clusters-layer', (event) => {
        const feature = event?.features?.[0];
        const typesHtml = feature?.properties?.typesHtml || '';
        if (typesHtml) {
          showHoverPopup(event.lngLat, `<div style="font-size:11px;font-weight:600;white-space:pre-line;">${typesHtml}</div>`);
        }
      });
      map.on('mousemove', 'crate-clusters-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const count = Number(feature?.properties?.count) || 1;
        showHoverPopup(
          event.lngLat,
          `<div style="font-size:11px;font-weight:600;">${count === 1 ? '1 crate' : `${count} crates`}</div>`
        );
      });
      map.on('mouseleave', 'crate-clusters-layer', () => {
        if (!placementActive) map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      addGeoSource('tanker-exclusion-ring-src', fcTankerExclusionRing);
      addGeoSource('tanker-wp1-point-src', fcTankerWp1Point);
      addGeoSource('tanker-routes-src', fcTankerRoutes);
      addGeoSource('dbuild-markers-src', fcDbuildMarkers);

      map.addLayer({
        id: 'tanker-exclusion-ring-fill-layer',
        type: 'fill',
        source: 'tanker-exclusion-ring-src',
        paint: {
          'fill-color': '#ef4444',
          'fill-opacity': 0.12,
        },
      });
      map.addLayer({
        id: 'tanker-exclusion-ring-line-layer',
        type: 'line',
        source: 'tanker-exclusion-ring-src',
        paint: {
          'line-color': '#ef4444',
          'line-width': 2,
          'line-dasharray': [2, 2],
          'line-opacity': 0.9,
        },
      });
      map.addLayer({
        id: 'tanker-wp1-point-layer',
        type: 'circle',
        source: 'tanker-wp1-point-src',
        paint: {
          'circle-radius': 10,
          'circle-color': TANKER_ROUTE_COLOR,
          'circle-opacity': 0.95,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });

      map.addLayer({
        id: 'tanker-routes-line-layer',
        type: 'line',
        source: 'tanker-routes-src',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': TANKER_ROUTE_COLOR,
          'line-width': 14,
          'line-opacity': 0.001,
        },
      });

      map.on('mousemove', 'tanker-routes-line-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const label = feature?.properties?.label || 'Tanker route';
        showHoverPopup(event.lngLat, `<div style="font-size:11px;font-weight:600;">${label}</div>`);
      });
      map.on('mouseleave', 'tanker-routes-line-layer', () => {
        if (!placementActive) map.getCanvas().style.cursor = '';
        hideHoverPopup();
      });

      map.addLayer({
        id: 'dbuild-markers-layer',
        type: 'symbol',
        source: 'dbuild-markers-src',
        layout: {
          'icon-image': [
            'match',
            ['get', 'kind'],
            'rook-blue', MAPLIBRE_DBUILD_ROOK_BLUE_IMAGE_ID,
            'hammer-green', MAPLIBRE_DBUILD_HAMMER_GREEN_IMAGE_ID,
            MAPLIBRE_DBUILD_HAMMER_WHITE_IMAGE_ID,
          ],
          'icon-size': 0.95,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
        paint: {
          'icon-opacity': 1,
        },
      });

      map.on('click', 'dbuild-markers-layer', (event) => {
        const feature = event?.features?.[0];
        const placementId = feature?.properties?.placementId;
        const selectable = Number(feature?.properties?.selectable) === 1;
        if (selectable && placementId && onDbuildPlacementSelect) onDbuildPlacementSelect(placementId);
      });
      map.on('mousemove', 'dbuild-markers-layer', (event) => {
        map.getCanvas().style.cursor = 'pointer';
        const feature = event?.features?.[0];
        const label = feature?.properties?.label || 'Build';
        const status = feature?.properties?.status || 'draft';
        const structureName = feature?.properties?.structureName || '';
        const suffix = structureName ? ` (${structureName})` : ` • ${status}`;
        showHoverPopup(event.lngLat, `<div style="font-size:11px;font-weight:600;">${label}${suffix}</div>`);
      });
      map.on('mouseleave', 'dbuild-markers-layer', () => {
        if (!placementActive) map.getCanvas().style.cursor = '';
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

      map.on('click', 'airports-hit-layer', (event) => {
        const feature = event?.features?.[0];
        const airportId = feature?.properties?.id;
        if (airportId && onAirportClick) onAirportClick(airportId);
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
        applyMapLibreAirportIconSize(map);
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
        applyMapLibreAirportIconSize(map);
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
          map.fitBounds(bounds, {
            padding: 60,
            duration: 0,
            pitch: map.getPitch(),
            bearing: map.getBearing(),
          });
        }
      }

      initThreeOverlay();
      rebuildThreeDomes();

      map.once('idle', () => {
        try {
          if (!map.getTerrain()) {
            map.setTerrain({ source: 'terrainDem', exaggeration: 1.0 });
          }
        } catch (error) {
          console.warn('Terrain could not be enabled, continuing without 3D terrain:', error);
        }
        rebuildThreeDomes();
        map.triggerRepaint();
      });

      // Keep spawn/retrieve radius above all other map layers (including zone domes).
      if (map.getLayer('spawn-radius-fill-layer')) {
        map.moveLayer('spawn-radius-fill-layer');
      }
      if (map.getLayer('spawn-radius-line-layer')) {
        map.moveLayer('spawn-radius-line-layer');
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
      if (domes3dRef.current.paintThreeOverlay && mapRef.current) {
        mapRef.current.off('render', domes3dRef.current.paintThreeOverlay);
        domes3dRef.current.paintThreeOverlay = null;
      }
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
      setMapInstance(null);
      setHoveredAirport(null);
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
    if (!showAirports) setHoveredAirport(null);
  }, [showAirports]);

  useEffect(() => {
    if (!mapInstance) return undefined;

    const onMouseMove = (event) => {
      if (!showAirports) {
        setHoveredAirport((current) => (current ? null : current));
        return;
      }
      const nearest = pickNearestAirportHover(
        (lon, lat) => mapInstance.project([lon, lat]),
        airportsData,
        event.point,
      );
      if (nearest) {
        mapInstance.getCanvas().style.cursor = 'pointer';
      }
      setHoveredAirport((current) => rememberHoveredAirport(current, nearest));
    };

    const onMouseLeave = () => {
      setHoveredAirport((current) => (current ? null : current));
    };

    mapInstance.on('mousemove', onMouseMove);
    mapInstance.getCanvas().addEventListener('mouseleave', onMouseLeave);
    return () => {
      mapInstance.off('mousemove', onMouseMove);
      mapInstance.getCanvas().removeEventListener('mouseleave', onMouseLeave);
    };
  }, [mapInstance, airportsData, showAirports]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const applyVisibility = () => {
      const visibility = showProductionPoints ? 'visible' : 'none';
      if (map.getLayer('production-points-layer')) {
        map.setLayoutProperty('production-points-layer', 'visibility', visibility);
      }
      if (map.getLayer('production-points-hit-layer')) {
        map.setLayoutProperty('production-points-hit-layer', 'visibility', visibility);
      }
    };

    if (map.isStyleLoaded()) {
      applyVisibility();
      return undefined;
    }

    map.once('load', applyVisibility);
    return () => {
      map.off('load', applyVisibility);
    };
  }, [showProductionPoints]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const syncProductionPoints = () => {
      applyProductionPointSourceData(map);
    };

    if (map.isStyleLoaded()) {
      syncProductionPoints();
      return undefined;
    }

    map.once('load', syncProductionPoints);
    return () => {
      map.off('load', syncProductionPoints);
    };
  }, [fcProductionPoints, applyProductionPointSourceData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('crate-clusters-src');
    if (source?.setData) source.setData(fcCrateClusters);
  }, [fcCrateClusters]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('spawn-radius-src');
    if (source?.setData) source.setData(fcSpawnRadius);
  }, [fcSpawnRadius]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const source = map.getSource('dbuild-markers-src');
    if (source?.setData) source.setData(fcDbuildMarkers);
  }, [fcDbuildMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    const applyTankerRouteData = () => {
      const routesSource = map.getSource('tanker-routes-src');
      if (routesSource?.setData) routesSource.setData(fcTankerRoutes);
    };

    if (map.isStyleLoaded()) {
      applyTankerRouteData();
      return undefined;
    }

    map.once('load', applyTankerRouteData);
    return () => {
      map.off('load', applyTankerRouteData);
    };
  }, [fcTankerRoutes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;
    const tankerRingSource = map.getSource('tanker-exclusion-ring-src');
    if (tankerRingSource?.setData) tankerRingSource.setData(fcTankerExclusionRing);
    const tankerPointSource = map.getSource('tanker-wp1-point-src');
    if (tankerPointSource?.setData) tankerPointSource.setData(fcTankerWp1Point);
  }, [fcTankerExclusionRing, fcTankerWp1Point]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setMaxZoom(effectiveMaxZoom);
  }, [effectiveMaxZoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleContextMenu = (event) => {
      if (!mapContextMenuEnabled || !onMapContextMenu) return;
      event.preventDefault();
      const { lat, lng } = event.lngLat || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const rect = map.getContainer().getBoundingClientRect();
      onMapContextMenu({
        lat,
        lon: lng,
        clientX: rect.left + event.point.x,
        clientY: rect.top + event.point.y,
      });
    };

    if (mapContextMenuEnabled) {
      map.on('contextmenu', handleContextMenu);
    }

    return () => {
      map.off('contextmenu', handleContextMenu);
    };
  }, [mapContextMenuEnabled, onMapContextMenu]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapContextMenuAnchor || !onMapContextMenuScreenUpdate) return undefined;
    if (!Number.isFinite(mapContextMenuAnchor.lat) || !Number.isFinite(mapContextMenuAnchor.lon)) {
      return undefined;
    }

    let rafId = 0;
    const update = () => {
      const point = map.project([mapContextMenuAnchor.lon, mapContextMenuAnchor.lat]);
      const rect = map.getContainer().getBoundingClientRect();
      onMapContextMenuScreenUpdate({
        clientX: rect.left + point.x,
        clientY: rect.top + point.y,
      });
    };
    const schedule = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        update();
      });
    };

    update();
    map.on('move', schedule);
    map.on('zoom', schedule);
    map.on('rotate', schedule);
    map.on('pitch', schedule);
    map.on('resize', schedule);
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
      map.off('move', schedule);
      map.off('zoom', schedule);
      map.off('rotate', schedule);
      map.off('pitch', schedule);
      map.off('resize', schedule);
    };
  }, [mapContextMenuAnchor, onMapContextMenuScreenUpdate]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleSpawnClick = (event) => {
      if (!placementActive || !onPlacementPlace) return;
      const { lat, lng } = event.lngLat || {};
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        onPlacementPlace({ lat, lon: lng });
      }
    };

    if (placementActive) {
      map.on('click', handleSpawnClick);
      map.getCanvas().style.cursor = 'crosshair';
    }

    return () => {
      map.off('click', handleSpawnClick);
      if (map.getCanvas()) {
        map.getCanvas().style.cursor = '';
      }
    };
  }, [placementActive, onPlacementPlace]);

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
      previous.key === focusTargetKey &&
      Math.abs(previous.lat - nextLat) < 0.00001 &&
      Math.abs(previous.lon - nextLon) < 0.00001
    ) {
      return;
    }
    lastAutoFocusRef.current = { lat: nextLat, lon: nextLon, key: focusTargetKey };
    logMapDebug('autofocus-easeTo', {
      focusTargetKey,
      target: { lon: nextLon, lat: nextLat },
      currentZoom: Number(map.getZoom().toFixed(3)),
    });

    const focusKey = String(focusTargetKey || '');
    const airportLikeFocus = (
      focusKey.startsWith('spawn:')
      || focusKey.startsWith('airport:')
      || focusKey.startsWith('retrieve:')
    );
    const focusZoom = airportLikeFocus
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
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full" />
      <canvas
        ref={domesOverlayRef}
        className="pointer-events-none absolute inset-0 z-[6] h-full w-full"
      />
      <HidcMapAirportHoverPointer map={mapInstance} airport={hoveredAirport} />
    </div>
  );
}

export default function FrontlineMap({ language = 'en', tacticalMapId, airportsData, airportCatalog = [], airbaseStatus = {} }) {
  const tacticalMap = getTacticalMapByCampaignId(tacticalMapId) || getDefaultTacticalMap();
  const startInTacticalMode = tacticalMap?.startInTacticalMode === true;
  const theaterFocus = normalizeMapCoordinates(tacticalMap?.focusCoordinates);
  const initialZones = Array.isArray(tacticalMap?.defaultZones) && tacticalMap.defaultZones.length > 0
    ? tacticalMap.defaultZones
    : frontlineZones;

  const { user } = useUser();
  const canManageLogisticsRouteVisibility = user?.canManageLogisticsRouteVisibility === true;
  const isMapLibreEngine = MAP_ENGINE === 'maplibre';
  const [isDesktopDevice, setIsDesktopDevice] = useState(() => isDesktopGlobeDevice());
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [hoveredDcsarId, setHoveredDcsarId] = useState(null);
  const [selectedDcsarId, setSelectedDcsarId] = useState(null);
  const [dcsarCoordinatesFormat, setDcsarCoordinatesFormat] = useState('dms');
  const [selectedAirportId, setSelectedAirportId] = useState(null);
  const [airportOccupancy, setAirportOccupancy] = useState(null);
  const [airportOccupancyLoading, setAirportOccupancyLoading] = useState(false);
  const [airportOccupancyError, setAirportOccupancyError] = useState('');
  const [airportWizardTab, setAirportWizardTab] = useState('');
  const [blueFactionPointsTick, setBlueFactionPointsTick] = useState(0);
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
  const [decliningZoneOperationId, setDecliningZoneOperationId] = useState(null);
  const [acceptingMissionId, setAcceptingMissionId] = useState(null);
  const [acceptingDcsarId, setAcceptingDcsarId] = useState(null);
  const [updatingDcsarId, setUpdatingDcsarId] = useState(null);
  const [updatingMissionId, setUpdatingMissionId] = useState(null);
  const [animationTick, setAnimationTick] = useState(Date.now());
  const [zones, setZones] = useState(initialZones);
  const [combatMissions, setCombatMissions] = useState([]);
  const [logisticsMissions, setLogisticsMissions] = useState([]);
  const [convoys, setConvoys] = useState([]);
  const [airliftPlayers, setAirliftPlayers] = useState([]);
  const [dcsarPoints, setDcsarPoints] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [feedCollapsed, setFeedCollapsed] = useState(false);
  const [operationsCollapsed, setOperationsCollapsed] = useState(false);
  const [opsLogisticAirportFocus, setOpsLogisticAirportFocus] = useState(null);
  const [zoneStatusMeta, setZoneStatusMeta] = useState({});
  const [mapMode, setMapMode] = useState(startInTacticalMode);
  const [mapViewSeed] = useState(getInitialMapViewPrefs);
  const [basemapMode, setBasemapMode] = useState(mapViewSeed.basemapMode);
  const [forcedGlobeScale, setForcedGlobeScale] = useState(null);
  const [launchTargetUtcMs, setLaunchTargetUtcMs] = useState(LAUNCH_TARGET_UTC_MS);
  const [serverClockBase, setServerClockBase] = useState(null);
  const [countdownTick, setCountdownTick] = useState(0);
  const [scrambleTick, setScrambleTick] = useState(0);
  const [filters, setFilters] = useState(mapViewSeed.filters);
  const mapModeRef = useRef(startInTacticalMode);

  useEffect(() => {
    const map = getTacticalMapByCampaignId(tacticalMapId) || getDefaultTacticalMap();
    const nextStartInTactical = map?.startInTacticalMode === true;
    mapModeRef.current = nextStartInTactical;
    setMapMode(nextStartInTactical);
    setZones(Array.isArray(map?.defaultZones) && map.defaultZones.length > 0 ? map.defaultZones : frontlineZones);
  }, [tacticalMapId]);

  // DCORE bridge state (Production Points + web-initiated spawns)
  const [productionPoints, setProductionPoints] = useState([]);
  const [selectedProductionPointId, setSelectedProductionPointId] = useState(null);
  const [spawnOptions, setSpawnOptions] = useState({ infantry: [], crate: [] });
  // spawnMode: { airportId, type: 'inf_spawn'|'crate_spawn', keyword, label } | null
  const [spawnMode, setSpawnMode] = useState(null);
  // retrieveMode: { ppId, quantity } | null
  const [retrieveMode, setRetrieveMode] = useState(null);
  const [ppRetrieveDraftQty, setPpRetrieveDraftQty] = useState(1);
  const [webSpawnMarkers, setWebSpawnMarkers] = useState([]);
  const [dbuildCatalog, setDbuildCatalog] = useState([]);
  const [dbuildPlacements, setDbuildPlacements] = useState([]);
  const [dbuildSites, setDbuildSites] = useState([]);
  const [selectedDbuildPlacementId, setSelectedDbuildPlacementId] = useState(null);
  const [mapContextMenu, setMapContextMenu] = useState(null);
  const [tankerOptions, setTankerOptions] = useState([]);
  const [tankerRoutes, setTankerRoutes] = useState([]);
  const [tankerMode, setTankerMode] = useState(null);
  const [confirmingDbuildId, setConfirmingDbuildId] = useState(null);
  const mapSectionRef = useRef(null);
  const [submittingCommand, setSubmittingCommand] = useState(false);
  const [upgradingPpId, setUpgradingPpId] = useState(null);
  const [commandToast, setCommandToast] = useState(null);
  const [commandToastFading, setCommandToastFading] = useState(false);
  const pendingCommandIdsRef = useRef(new Set());
  const commandToastTimerRef = useRef(null);
  const commandToastFadeTimerRef = useRef(null);

  const showCommandToast = useCallback((toast) => {
    if (commandToastTimerRef.current) {
      clearTimeout(commandToastTimerRef.current);
    }
    if (commandToastFadeTimerRef.current) {
      clearTimeout(commandToastFadeTimerRef.current);
    }
    setCommandToastFading(false);
    setCommandToast({ ...toast, ts: Date.now() });
    commandToastFadeTimerRef.current = setTimeout(() => {
      setCommandToastFading(true);
    }, COMMAND_TOAST_VISIBLE_MS);
    commandToastTimerRef.current = setTimeout(() => {
      setCommandToast(null);
      setCommandToastFading(false);
    }, COMMAND_TOAST_VISIBLE_MS + COMMAND_TOAST_FADE_MS);
  }, []);

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
    persistMapViewPrefs(filters, basemapMode);
  }, [filters, basemapMode]);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([getFrontlineZones(), getCombatMissions(), getMissions(), getFeed(200), getConvoys(), getAirliftPlayers(), getDcsar()])
      .then(([zonesResult, combatResult, logisticsResult, feedResult, convoysResult, airliftPlayersResult, dcsarResult]) => {
        if (!isMounted) return;

        if (zonesResult.status === 'fulfilled') {
          const nextZones = zonesResult.value?.zones || zonesResult.value;
          if (Array.isArray(nextZones)) {
            setZones((previous) => applyIncomingFrontlineZones(nextZones, previous));
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
        setZones((previous) => applyIncomingFrontlineZones(nextZones, previous));
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
    Promise.allSettled([getProductionPoints(), getSpawnOptions(), getTankerOptions(), getTankerRoutes(), getWebSpawnMarkers(), getDbuildCatalog(), getDbuildPlacements()]).then(([ppResult, optionsResult, tankerOptionsResult, tankerRoutesResult, markersResult, dbuildCatalogResult, dbuildPlacementsResult]) => {
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
      if (tankerOptionsResult.status === 'fulfilled' && tankerOptionsResult.value) {
        const list = tankerOptionsResult.value?.tankers || tankerOptionsResult.value;
        if (Array.isArray(list)) setTankerOptions(list);
      }
      if (tankerRoutesResult.status === 'fulfilled' && tankerRoutesResult.value) {
        const list = tankerRoutesResult.value?.routes || tankerRoutesResult.value;
        if (Array.isArray(list)) setTankerRoutes(list);
      }
      if (markersResult.status === 'fulfilled' && markersResult.value) {
        const list = markersResult.value?.markers || markersResult.value;
        if (Array.isArray(list)) setWebSpawnMarkers(list);
      }
      if (dbuildCatalogResult.status === 'fulfilled' && dbuildCatalogResult.value) {
        const list = dbuildCatalogResult.value?.types || dbuildCatalogResult.value;
        if (Array.isArray(list)) setDbuildCatalog(list);
      }
      if (dbuildPlacementsResult.status === 'fulfilled' && dbuildPlacementsResult.value) {
        const list = dbuildPlacementsResult.value?.placements || dbuildPlacementsResult.value;
        if (Array.isArray(list)) setDbuildPlacements(list);
        const sites = dbuildPlacementsResult.value?.sites;
        if (Array.isArray(sites)) setDbuildSites(sites);
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

    const unsubscribeTankerRoutes = socketService.on('tanker-routes:updated', (data) => {
      const list = data?.routes || data;
      if (Array.isArray(list)) setTankerRoutes(list);
    });

    const unsubscribeDbuildPlacements = socketService.on('dbuild-placements:updated', (data) => {
      const list = data?.placements || data;
      if (Array.isArray(list)) setDbuildPlacements(list);
      if (Array.isArray(data?.sites)) setDbuildSites(data.sites);
    });

    const unsubscribeDbuildSites = socketService.on('dbuild-sites:updated', (data) => {
      if (Array.isArray(data?.sites)) setDbuildSites(data.sites);
      if (Array.isArray(data?.placements)) setDbuildPlacements(data.placements);
    });

    const unsubscribeResult = socketService.on('web-command:result', (data) => {
      if (Number.isFinite(Number(data?.balance))) {
        setBlueFactionPointsTick((value) => value + 1);
      }
      if (!data || !data.id) return;
      if (!pendingCommandIdsRef.current.has(data.id)) return;
      pendingCommandIdsRef.current.delete(data.id);

      const isSpawn = data.type === 'inf_spawn' || data.type === 'crate_spawn';
      const isDbuild = data.type === 'dbuild_confirm';
      if ((isSpawn || isDbuild) && data.ok === true) return;

      showCommandToast({
        ok: data.ok === true,
        message: formatWebCommandToastMessage(data),
        balance: shouldShowCommandToastBalance(data) ? Number(data.balance) : null,
      });
    });

    return () => {
      unsubscribePp && unsubscribePp();
      unsubscribeMarkers && unsubscribeMarkers();
      unsubscribeTankerRoutes && unsubscribeTankerRoutes();
      unsubscribeDbuildPlacements && unsubscribeDbuildPlacements();
      unsubscribeDbuildSites && unsubscribeDbuildSites();
      unsubscribeResult && unsubscribeResult();
      if (commandToastTimerRef.current) {
        clearTimeout(commandToastTimerRef.current);
      }
      if (commandToastFadeTimerRef.current) {
        clearTimeout(commandToastFadeTimerRef.current);
      }
    };
  }, [showCommandToast]);

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
    if (!isPreLaunchCountdownActive || startInTacticalMode) return;
    if (mapModeRef.current || mapMode) {
      mapModeRef.current = false;
      setMapMode(false);
    }
  }, [isPreLaunchCountdownActive, mapMode, startInTacticalMode]);

  const validZones = useMemo(
    () => zones.filter((zone) => zone.coordinates && Number.isFinite(zone.coordinates.lat) && Number.isFinite(zone.coordinates.lon)),
    [zones]
  );

  const zoneCoordinatesByName = useMemo(
    () => buildZoneCoordinatesByName(validZones),
    [validZones]
  );

  const productionPointsForMap = useMemo(
    () => (productionPoints || []).map((pp) => withResolvedProductionPointCoordinates(pp, zoneCoordinatesByName)),
    [productionPoints, zoneCoordinatesByName]
  );

  const allMapAirports = useMemo(() => {
    const runtimeById = new Map();
    if (Array.isArray(airportsData)) {
      airportsData.forEach((airport) => {
        if (airport?.id) runtimeById.set(airport.id, airport);
      });
    }

    const catalog = (Array.isArray(airportCatalog) && airportCatalog.length > 0)
      ? airportCatalog
      : airports;
    const catalogIds = new Set();

    const mergedAirports = catalog.map((configAirport) => {
      catalogIds.add(configAirport.id);
      const runtimeAirport = runtimeById.get(configAirport.id);
      if (!runtimeAirport) return configAirport;

      return {
        ...configAirport,
        ...runtimeAirport,
        coordinates: runtimeAirport.coordinates || configAirport.coordinates,
        csvPrefix: runtimeAirport.csvPrefix || configAirport.csvPrefix,
        isMainBase: runtimeAirport.isMainBase ?? configAirport.isMainBase,
        isCarrier: runtimeAirport.isCarrier ?? configAirport.isCarrier,
        isHeliport: runtimeAirport.isHeliport ?? configAirport.isHeliport,
        isAlwaysActive: runtimeAirport.isAlwaysActive ?? configAirport.isAlwaysActive,
        isActive: runtimeAirport.isActive ?? configAirport.isActive,
      };
    });

    const extraRuntimeAirports = Array.from(runtimeById.values()).filter(
      (airport) => airport?.id && !catalogIds.has(airport.id)
    );

    return [...mergedAirports, ...extraRuntimeAirports]
      .filter((airport) => Number.isFinite(airport?.coordinates?.lat) && Number.isFinite(airport?.coordinates?.lon))
      .map((airport) => ({
        ...airport,
        coalition: getAirportCoalition(airport, airbaseStatus),
      }));
  }, [airportsData, airportCatalog, airbaseStatus]);

  const airportsForMap = useMemo(() => (
    allMapAirports.map((airport) => {
      const overlayZone = findNearestZoneForPoint(
        airport.coordinates.lat,
        airport.coordinates.lon,
        validZones,
      );
      return {
        ...airport,
        coalition: overlayZone?.status === 'RED' ? 'red' : airport.coalition,
        zoneNumber: overlayZone ? getZoneNumber(overlayZone) : '',
      };
    })
  ), [allMapAirports, validZones]);

  const zoneIdsWithAssignedAirports = useMemo(() => {
    const ids = new Set();
    allMapAirports.forEach((airport) => {
      const assigned = findNearestZoneForPoint(
        airport.coordinates.lat,
        airport.coordinates.lon,
        validZones,
      );
      if (assigned?.id) ids.add(assigned.id);
    });
    return ids;
  }, [allMapAirports, validZones]);

  const validAirports = useMemo(
    () => allMapAirports.filter((airport) => isAirportActiveOnMap(airport, airbaseStatus)),
    [allMapAirports, airbaseStatus]
  );

  const combatMissionByZone = useMemo(() => {
    const map = new Map();
    combatMissions.forEach((mission) => {
      if (mission?.zone_id) {
        map.set(mission.zone_id, mission);
      }
    });
    return map;
  }, [combatMissions]);

  const zoneById = useMemo(() => {
    const map = new Map();
    validZones.forEach((zone) => {
      if (!zone?.id) return;
      map.set(normalizeZoneId(zone.id), zone);
    });
    return map;
  }, [validZones]);

  const logisticsFrontlineAirportIds = useMemo(() => {
    const firstLineBlueZoneIds = new Set();
    zoneById.forEach((zone, zoneId) => {
      if (zone?.status !== 'BLUE') return;
      const hasRedNeighbor = getNeighborZoneIds(zoneId).some(
        (neighborId) => zoneById.get(normalizeZoneId(neighborId))?.status === 'RED'
      );
      if (hasRedNeighbor) {
        firstLineBlueZoneIds.add(zoneId);
      }
    });

    const secondLineBlueZoneIds = new Set();
    zoneById.forEach((zone, zoneId) => {
      if (zone?.status !== 'BLUE') return;
      if (firstLineBlueZoneIds.has(zoneId)) return;
      const linkedToFirstLine = getNeighborZoneIds(zoneId).some(
        (neighborId) => firstLineBlueZoneIds.has(normalizeZoneId(neighborId))
      );
      if (linkedToFirstLine) {
        secondLineBlueZoneIds.add(zoneId);
      }
    });

    const eligibleBlueZoneIds = new Set([
      ...firstLineBlueZoneIds,
      ...secondLineBlueZoneIds,
    ]);

    const zonesWithCoords = Array.from(zoneById.entries()).filter(([, zone]) => (
      Number.isFinite(Number(zone?.coordinates?.lat)) && Number.isFinite(Number(zone?.coordinates?.lon))
    ));
    const eligibleAirportIds = new Set();

    validAirports.forEach((airport) => {
      const airportLat = Number(airport?.coordinates?.lat);
      const airportLon = Number(airport?.coordinates?.lon);
      if (!Number.isFinite(airportLat) || !Number.isFinite(airportLon)) return;

      let nearestZoneId = null;
      let nearestDistanceNm = Number.POSITIVE_INFINITY;

      zonesWithCoords.forEach(([zoneId, zone]) => {
        const zoneLat = Number(zone.coordinates.lat);
        const zoneLon = Number(zone.coordinates.lon);
        const distanceNm = haversineNm(airportLat, airportLon, zoneLat, zoneLon);
        if (distanceNm < nearestDistanceNm) {
          nearestDistanceNm = distanceNm;
          nearestZoneId = zoneId;
        }
      });

      if (nearestZoneId !== null && eligibleBlueZoneIds.has(nearestZoneId)) {
        eligibleAirportIds.add(String(airport.id));
      }
    });

    return eligibleAirportIds;
  }, [zoneById, validAirports]);

  const gridConnections = useMemo(() => buildZoneConnections(validZones), [validZones]);

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

  const zonesForMap = useMemo(() => {
    const withoutProductionOverlap = !filters.showProductionPoints
      ? filteredZones
      : filteredZones.filter((zone) => !isProductionPointZone(zone, productionPoints));
    return withoutProductionOverlap.filter((zone) => !zoneIdsWithAssignedAirports.has(zone.id));
  }, [filteredZones, filters.showProductionPoints, productionPoints, zoneIdsWithAssignedAirports]);

  const atoZonesForMap = useMemo(
    () => filteredZones.filter((zone) => !zoneIdsWithAssignedAirports.has(zone.id)),
    [filteredZones, zoneIdsWithAssignedAirports]
  );

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

  const airportsById = useMemo(() => {
    const map = new Map();
    validAirports.forEach((airport) => map.set(airport.id, airport));
    return map;
  }, [validAirports]);

  const globePoints = useMemo(() => {
    const zonePoints = filters.showAto ? zonesForMap.map((zone) => ({
      lat: zone.coordinates.lat,
      lon: zone.coordinates.lon,
      size: zone.id === selectedZoneId ? 0.14 : zone.isActive ? 0.1 : 0.07,
    })) : [];
    const airportPoints = filters.showAirports ? allMapAirports.map((airport) => ({
      lat: airport.coordinates.lat,
      lon: airport.coordinates.lon,
      size: airport.isMainBase ? 0.11 : 0.08,
    })) : [];
    const productionPointMarkers = filters.showProductionPoints
      ? productionPointsForMap.flatMap((pp) => {
        if (!Number.isFinite(pp?.coordinates?.lat) || !Number.isFinite(pp?.coordinates?.lon)) return [];
        return [{
          lat: pp.coordinates.lat,
          lon: pp.coordinates.lon,
          size: pp.id === selectedProductionPointId ? 0.12 : 0.09,
        }];
      })
      : [];
    return [...zonePoints, ...airportPoints, ...productionPointMarkers];
  }, [zonesForMap, allMapAirports, productionPointsForMap, selectedZoneId, selectedProductionPointId, filters.showAto, filters.showAirports, filters.showProductionPoints]);

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

  const focusCoordinates = selectedDcsarFocus || focusedZone?.coordinates || theaterFocus || zoneTheaterCenter || fallbackCenter || null;
  const spawnAirportCenter = useMemo(() => {
    if (!spawnMode) return null;
    const airport = airportsById.get(spawnMode.airportId);
    return airport?.coordinates || null;
  }, [spawnMode, airportsById]);

  const selectedAirportCenter = useMemo(() => {
    if (!selectedAirportId) return null;
    return airportsById.get(selectedAirportId)?.coordinates || null;
  }, [selectedAirportId, airportsById]);

  const retrievePpCenter = useMemo(() => {
    if (!retrieveMode) return null;
    const pp = productionPoints.find((entry) => entry.id === retrieveMode.ppId);
    return pp?.coordinates || null;
  }, [retrieveMode, productionPoints]);

  const mapMaxZoom = (spawnMode || retrieveMode || tankerMode || selectedAirportId) ? MAP_ZOOM_AIRPORT_MAX : MAP_ZOOM_DEFAULT_MAX;

  const tacticalFocusCoordinates = spawnAirportCenter || retrievePpCenter || selectedAirportCenter || selectedDcsarFocus || theaterFocus || focusedZone?.coordinates || null;
  const tacticalFocusTargetKey = spawnMode
    ? `spawn:${spawnMode.airportId}`
    : retrieveMode
      ? `retrieve:${retrieveMode.ppId}`
      : selectedAirportId
        ? `airport:${selectedAirportId}`
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

  const currentUserName = user?.globalName || user?.username || user?.id || '';
  const activeAcceptedZonesByCurrentUser = useMemo(() => {
    if (!currentUserName) return [];
    return validZones.filter((zone) =>
      zone.operation_assigned === true &&
      zone.operation_assigned_to === currentUserName &&
      Number(zone.operation_remaining_ms || 0) > 0
    );
  }, [validZones, currentUserName]);
  const canCurrentUserAcceptMoreZones = activeAcceptedZonesByCurrentUser.length < 2;
  const zoneOptionsForCard = useMemo(
    () => [...validZones]
      .map((entry) => ({ ...entry, zoneNumber: getZoneNumber(entry) }))
      .sort((a, b) => Number(a.zoneNumber) - Number(b.zoneNumber)),
    [validZones],
  );
  const selectedZoneNeighbors = useMemo(() => {
    if (!focusedZone?.id) return [];
    return getNeighborZoneIds(focusedZone.id)
      .map((neighborId) => zoneById.get(normalizeZoneId(neighborId)))
      .filter(Boolean)
      .map((entry) => ({ ...entry, zoneNumber: getZoneNumber(entry) }));
  }, [focusedZone, zoneById]);
  const selectedZoneHasTasks = Array.isArray(focusedZone?.tasks) && focusedZone.tasks.length > 0;
  const selectedZoneAcceptedByOther = Boolean(
    focusedZone?.operation_assigned &&
    focusedZone?.operation_assigned_to &&
    focusedZone.operation_assigned_to !== currentUserName &&
    Number(focusedZone?.operation_remaining_ms || 0) > 0
  );
  const selectedZoneAcceptedByCurrentUser = Boolean(
    focusedZone?.operation_assigned &&
    focusedZone?.operation_assigned_to === currentUserName &&
    Number(focusedZone?.operation_remaining_ms || 0) > 0
  );
  const selectedChangedAt = focusedZone ? zoneStatusMeta[focusedZone.id]?.changedAt : null;

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
  const occupancyAirport = useMemo(() => {
    if (!selectedAirport) return null;
    return {
      id: selectedAirport.id,
      name: selectedAirport.displayName || selectedAirport.name,
      subtitle: selectedAirport.isCarrier ? 'CARRIER' : (selectedAirport.isHeliport ? 'HELIPORT' : 'AIRPORT'),
      lat: selectedAirport.coordinates?.lat,
      lon: selectedAirport.coordinates?.lon,
      coordinates: selectedAirport.coordinates,
      icao: selectedAirport.icao,
    };
  }, [selectedAirport]);

  useEffect(() => {
    if (!selectedAirportId) {
      setAirportOccupancy(null);
      setAirportOccupancyError('');
      setAirportWizardTab('');
      return undefined;
    }

    let cancelled = false;
    setAirportOccupancyLoading(true);
    setAirportOccupancyError('');

    getAirportOccupancy(selectedAirportId)
      .then((occupancy) => {
        if (!cancelled) setAirportOccupancy(occupancy);
      })
      .catch((error) => {
        if (!cancelled) {
          setAirportOccupancy(null);
          setAirportOccupancyError(error.message || 'Failed to load airbase occupancy.');
        }
      })
      .finally(() => {
        if (!cancelled) setAirportOccupancyLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAirportId, user?.id, blueFactionPointsTick]);

  const handleAirportLogisticsUpdated = useCallback((result) => {
    setAirportOccupancy((prev) => ({
      ...(prev || {}),
      shop: result?.shop || prev?.shop,
      shopper: result?.shopper || prev?.shopper,
      orders: result?.orders || prev?.orders,
    }));
  }, []);

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
    }
  }, [filters.showAto]);

  useEffect(() => {
    if (!filters.showDcsar) {
      setHoveredDcsarId(null);
      setSelectedDcsarId(null);
    }
  }, [filters.showDcsar]);

  useEffect(() => {
    if (!filters.showProductionPoints) {
      setSelectedProductionPointId(null);
    }
  }, [filters.showProductionPoints]);

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

  const handleDeclineZoneOperation = async (zone) => {
    if (!zone?.id) return;
    if (!user) {
      window.location.href = '/api/auth/discord';
      return;
    }
    if (!currentUserName) return;

    setDecliningZoneOperationId(zone.id);
    try {
      const payload = await declineFrontlineZone(zone.id, currentUserName);
      if (Array.isArray(payload?.zones)) {
        setZones((previous) => applyIncomingFrontlineZones(payload.zones, previous));
      } else {
        const refreshed = await getFrontlineZones();
        const fetchedZones = refreshed?.zones || refreshed;
        if (Array.isArray(fetchedZones)) {
          setZones((previous) => applyIncomingFrontlineZones(fetchedZones, previous));
        }
      }
    } catch (error) {
      console.error('Failed to decline zone operation:', error);
      alert(`Failed to decline zone: ${error.message}`);
    } finally {
      setDecliningZoneOperationId(null);
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
        setZones((previous) => applyIncomingFrontlineZones(payload.zones, previous));
      } else {
        const refreshed = await getFrontlineZones();
        const fetchedZones = refreshed?.zones || refreshed;
        if (Array.isArray(fetchedZones)) {
          setZones((previous) => applyIncomingFrontlineZones(fetchedZones, previous));
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
    setSelectedProductionPointId(null);
    setRetrieveMode(null);
    setOperationsCollapsed(false);
    setOpsLogisticAirportFocus({ airportId: normalizedAirportId, at: Date.now() });
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
    setSpawnMode(null);
    setRetrieveMode(null);
  }, []);

  // Keep zone / production-point / airport selection mutually exclusive (panels share the bottom-left slot).
  useEffect(() => {
    if (selectedZoneId) {
      setSelectedProductionPointId(null);
      setSelectedAirportId(null);
    }
  }, [selectedZoneId]);

  useEffect(() => {
    if (retrieveMode) {
      const activePp = productionPoints.find((entry) => entry.id === retrieveMode.ppId);
      setPpRetrieveDraftQty(clampRetrieveQuantity(retrieveMode.quantity, activePp?.stock));
      return;
    }
    if (!selectedProductionPointId) {
      setPpRetrieveDraftQty(1);
      return;
    }
    const pp = productionPoints.find((entry) => entry.id === selectedProductionPointId);
    if (!pp) return;
    const max = Math.max(1, Math.floor(Number(pp.stock) || 0));
    setPpRetrieveDraftQty((current) => clampRetrieveQuantity(current, max));
  }, [retrieveMode, selectedProductionPointId, productionPoints]);

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
      showCommandToast({ ok: false, message: error.message || 'Failed to request upgrade.', balance: null });
    } finally {
      setUpgradingPpId(null);
    }
  }, [showCommandToast]);

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
    setRetrieveMode(null);
    setTankerMode(null);
  }, []);

  const handleSetSpawnQuantity = useCallback((quantity) => {
    const nextQty = Math.max(1, Math.min(SPAWN_QUANTITY_MAX, Math.floor(Number(quantity)) || 1));
    setSpawnMode((current) => (current ? { ...current, quantity: nextQty } : current));
  }, []);

  const handleCancelSpawnMode = useCallback(() => {
    setSpawnMode(null);
  }, []);

  const handleCancelTankerMode = useCallback(() => {
    setTankerMode(null);
  }, []);

  const handleStartTankerMode = useCallback((keyword, label) => {
    if (!keyword) return;
    setMapContextMenu(null);
    setTankerMode({
      keyword: String(keyword).toUpperCase(),
      label: label || keyword,
      step: 'wp1',
      wp1: null,
    });
    setSpawnMode(null);
    setRetrieveMode(null);
    setSelectedDbuildPlacementId(null);
  }, []);

  const handleTankerPlace = useCallback(async ({ lat, lon }) => {
    if (!tankerMode) return;

    if (tankerMode.step === 'wp1') {
      setTankerMode((current) => (current ? {
        ...current,
        step: 'wp2',
        wp1: { lat, lon },
      } : current));
      return;
    }

    if (!tankerMode.wp1) return;
    const distanceNm = haversineNm(tankerMode.wp1.lat, tankerMode.wp1.lon, lat, lon);
    const minDistNm = Number(tankerOptions.find((entry) => entry.keyword === tankerMode.keyword)?.min_dist_nm) || TANKER_MIN_DIST_NM;
    if (distanceNm < minDistNm) {
      showCommandToast({
        ok: false,
        message: `WP2 too close: minimum distance is ${minDistNm} NM (current ${distanceNm.toFixed(1)} NM). Place WP2 outside the red zone.`,
        balance: null,
      });
      return;
    }

    setSubmittingCommand(true);
    try {
      const response = await spawnTanker(
        tankerMode.keyword,
        tankerMode.wp1.lat,
        tankerMode.wp1.lon,
        lat,
        lon,
      );
      if (response?.commandId) {
        pendingCommandIdsRef.current.add(response.commandId);
      }
      setTankerMode(null);
    } catch (error) {
      console.error('Failed to submit tanker spawn command:', error);
      showCommandToast({ ok: false, message: error.message || 'Failed to send tanker spawn order.', balance: null });
    } finally {
      setSubmittingCommand(false);
    }
  }, [tankerMode, tankerOptions, showCommandToast]);

  const handleEnterRetrieveMode = useCallback((ppId, quantity = 1) => {
    const pp = productionPoints.find((entry) => entry.id === ppId);
    const nextQty = clampRetrieveQuantity(quantity, pp?.stock);
    setRetrieveMode({ ppId: String(ppId), quantity: nextQty });
    setPpRetrieveDraftQty(nextQty);
    setSelectedProductionPointId(String(ppId));
    setSpawnMode(null);
    setSelectedAirportId(null);
    setTankerMode(null);
  }, [productionPoints]);

  const handleSetRetrieveQuantity = useCallback((quantity) => {
    setRetrieveMode((current) => {
      if (!current) return current;
      const pp = productionPoints.find((entry) => entry.id === current.ppId);
      const nextQty = clampRetrieveQuantity(quantity, pp?.stock);
      return { ...current, quantity: nextQty };
    });
  }, [productionPoints]);

  const handleCancelRetrieveMode = useCallback(() => {
    setRetrieveMode(null);
  }, []);

  const handleRetrievePlace = useCallback(async ({ lat, lon }) => {
    if (!retrieveMode) return;
    const { ppId } = retrieveMode;
    const pp = productionPoints.find((entry) => entry.id === ppId);
    const quantity = clampRetrieveQuantity(retrieveMode.quantity, pp?.stock);
    const ppCoords = pp?.coordinates;
    if (ppCoords && Number.isFinite(ppCoords.lat) && Number.isFinite(ppCoords.lon)) {
      const distanceM = haversineMeters(ppCoords.lat, ppCoords.lon, lat, lon);
      if (distanceM > PP_RETRIEVE_RADIUS_M) {
        showCommandToast({
          ok: false,
          message: `Placement out of range (${Math.round(distanceM)} m). Max ${PP_RETRIEVE_RADIUS_M} m from production point center.`,
          balance: null,
        });
        return;
      }
    }

    setSubmittingCommand(true);
    try {
      const response = await retrieveProductionPointCrates(ppId, lat, lon, quantity);
      if (response?.commandId) {
        pendingCommandIdsRef.current.add(response.commandId);
      }
      setRetrieveMode(null);
    } catch (error) {
      console.error('Failed to submit retrieve command:', error);
      showCommandToast({ ok: false, message: error.message || 'Failed to send retrieve order.', balance: null });
    } finally {
      setSubmittingCommand(false);
    }
  }, [retrieveMode, productionPoints, showCommandToast]);

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
          showCommandToast({
            ok: false,
            message: `Placement out of range (${Math.round(distanceM)} m). Max ${AIRPORT_SPAWN_RADIUS_M / 1000} km from airport center.`,
            balance: null,
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
      showCommandToast({ ok: false, message: error.message || 'Failed to send spawn order.', balance: null });
    } finally {
      setSubmittingCommand(false);
    }
  }, [spawnMode, airportsById, showCommandToast]);

  const dbuildMapMarkers = useMemo(
    () => buildDbuildMapMarkers(dbuildPlacements, dbuildSites, dbuildCatalog),
    [dbuildPlacements, dbuildSites, dbuildCatalog]
  );

  const crateClusters = useMemo(
    () => clusterCratesWithinRadius(webSpawnMarkers, CRATE_CLUSTER_RADIUS_M),
    [webSpawnMarkers]
  );

  const selectedDbuildPlacement = useMemo(
    () => (selectedDbuildPlacementId ? dbuildPlacements.find((entry) => entry.id === selectedDbuildPlacementId) || null : null),
    [selectedDbuildPlacementId, dbuildPlacements]
  );

  const mapContextMenuEnabled = isAuthenticated && !spawnMode && !retrieveMode && !tankerMode;

  useEffect(() => {
    if (!mapContextMenu) return undefined;
    const closeMenu = () => setMapContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
    };
  }, [mapContextMenu]);

  const handleMapContextMenu = useCallback((payload) => {
    if (!mapContextMenuEnabled || !mapSectionRef.current) return;
    const rect = mapSectionRef.current.getBoundingClientRect();
    setMapContextMenu({
      lat: payload.lat,
      lon: payload.lon,
      x: payload.clientX - rect.left,
      y: payload.clientY - rect.top,
    });
    setSelectedDbuildPlacementId(null);
  }, [mapContextMenuEnabled]);

  const handleMapContextMenuScreenUpdate = useCallback((payload) => {
    if (!mapSectionRef.current) return;
    const rect = mapSectionRef.current.getBoundingClientRect();
    const nextX = payload.clientX - rect.left;
    const nextY = payload.clientY - rect.top;
    setMapContextMenu((prev) => {
      if (!prev) return null;
      if (Math.abs(prev.x - nextX) < 0.25 && Math.abs(prev.y - nextY) < 0.25) return prev;
      return { ...prev, x: nextX, y: nextY };
    });
  }, []);

  const mapContextMenuAnchor = useMemo(() => {
    if (!mapContextMenu) return null;
    if (!Number.isFinite(mapContextMenu.lat) || !Number.isFinite(mapContextMenu.lon)) return null;
    return { lat: mapContextMenu.lat, lon: mapContextMenu.lon };
  }, [mapContextMenu?.lat, mapContextMenu?.lon]);

  const tankerWp1 = tankerMode?.wp1 || null;

  const handleSelectMapAction = useCallback(async (action) => {
    setMapContextMenu(null);
    const { type, keyword, lat, lon } = action || {};
    if (!type || !keyword) return;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      showCommandToast({ ok: false, message: 'Invalid map coordinates.', balance: null });
      return;
    }

    setSubmittingCommand(true);
    try {
      const response = await spawnMapAction(type, keyword, lat, lon);
      if (response?.commandId) {
        pendingCommandIdsRef.current.add(response.commandId);
      }
    } catch (error) {
      console.error('Failed to submit map action:', error);
      showCommandToast({ ok: false, message: error.message || 'Failed to send map action.', balance: null });
    } finally {
      setSubmittingCommand(false);
    }
  }, [showCommandToast]);

  const handleCreateDbuildDraft = useCallback(async (buildType) => {
    if (!mapContextMenu || !buildType) return;
    setMapContextMenu(null);
    try {
      const response = await createDbuildPlacement(buildType, mapContextMenu.lat, mapContextMenu.lon);
      const placement = response?.placement;
      if (placement?.id) {
        setSelectedDbuildPlacementId(placement.id);
        setSpawnMode(null);
      }
    } catch (error) {
      console.error('Failed to create DBUILD draft:', error);
      showCommandToast({ ok: false, message: error.message || 'Failed to place build draft.', balance: null });
    }
  }, [mapContextMenu, showCommandToast]);

  const handleConfirmDbuildPlacement = useCallback(async (placementId) => {
    if (!placementId) return;
    setConfirmingDbuildId(placementId);
    try {
      const response = await confirmDbuildPlacement(placementId);
      if (response?.commandId) {
        pendingCommandIdsRef.current.add(response.commandId);
      }
    } catch (error) {
      console.error('Failed to confirm DBUILD placement:', error);
      showCommandToast({ ok: false, message: error.message || 'Failed to confirm build placement.', balance: null });
    } finally {
      setConfirmingDbuildId(null);
    }
  }, [showCommandToast]);

  const handleCancelDbuildDraft = useCallback(async (placementId) => {
    if (!placementId) return;
    try {
      await cancelDbuildPlacement(placementId);
      if (selectedDbuildPlacementId === placementId) {
        setSelectedDbuildPlacementId(null);
      }
    } catch (error) {
      console.error('Failed to cancel DBUILD draft:', error);
      showCommandToast({ ok: false, message: error.message || 'Failed to cancel build draft.', balance: null });
    }
  }, [selectedDbuildPlacementId, showCommandToast]);

  const handleDbuildPlacementSelect = useCallback((placementId) => {
    setSelectedDbuildPlacementId(placementId);
    setSelectedAirportId(null);
    setSelectedProductionPointId(null);
    setSpawnMode(null);
    setRetrieveMode(null);
    setTankerMode(null);
    setMapContextMenu(null);
  }, []);

  const canUpgradeSelectedPp = Boolean(
    selectedProductionPoint &&
    selectedProductionPoint.built &&
    !selectedProductionPoint.upgrading &&
    selectedProductionPoint.owner === 'BLUE' &&
    Number(selectedProductionPoint.red_units || 0) === 0 &&
    Number(selectedProductionPoint.level || 0) < Number(selectedProductionPoint.max_level || 1)
  );

  const canRetrieveSelectedPp = Boolean(
    selectedProductionPoint &&
    selectedProductionPoint.built &&
    selectedProductionPoint.owner === 'BLUE' &&
    Number(selectedProductionPoint.stock || 0) > 0
  );

  const maxRetrieveQuantity = Math.max(1, Math.floor(Number(selectedProductionPoint?.stock) || 0));

  const panelRetrieveQuantity = (
    retrieveMode &&
    selectedProductionPoint &&
    retrieveMode.ppId === selectedProductionPoint.id
  )
    ? (retrieveMode.quantity || 1)
    : ppRetrieveDraftQty;

  const retrieveBannerMaxQuantity = retrieveMode
    ? Math.max(
      1,
      Math.floor(Number(productionPoints.find((entry) => entry.id === retrieveMode.ppId)?.stock) || 0)
    )
    : 1;

  return (
    <section className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
            <div
              ref={mapSectionRef}
              className={`relative min-h-0 flex-1 transition-[filter] duration-300 ${
                isPreLaunchCountdownActive ? 'pointer-events-none select-none blur-[8px]' : ''
              }`}
            >
              {isDesktopDevice && !mapMode && !startInTacticalMode && (
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
                      zones={atoZonesForMap}
                      airportsData={airportsForMap}
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
                      productionPoints={productionPointsForMap}
                      showProductionPoints={filters.showProductionPoints}
                      selectedProductionPointId={selectedProductionPointId}
                      onProductionPointSelect={handleProductionPointSelect}
                      spawnPlacementActive={Boolean(spawnMode)}
                      onSpawnPlace={handleSpawnPlace}
                      spawnAirportCenter={spawnAirportCenter}
                      retrievePlacementActive={Boolean(retrieveMode)}
                      onRetrievePlace={handleRetrievePlace}
                      retrievePpCenter={retrievePpCenter}
                      crateClusters={crateClusters}
                      mapMaxZoom={mapMaxZoom}
                      dbuildMapMarkers={dbuildMapMarkers}
                      selectedDbuildPlacementId={selectedDbuildPlacementId}
                      onDbuildPlacementSelect={handleDbuildPlacementSelect}
                      mapContextMenuEnabled={mapContextMenuEnabled}
                      onMapContextMenu={handleMapContextMenu}
                      mapContextMenuAnchor={mapContextMenuAnchor}
                      onMapContextMenuScreenUpdate={handleMapContextMenuScreenUpdate}
                      tankerPlacementActive={Boolean(tankerMode)}
                      onTankerPlace={handleTankerPlace}
                      tankerWp1={tankerWp1}
                      tankerRoutes={tankerRoutes}
                    />
                  ) : (
                    <FlatMapView
                      zones={zonesForMap}
                      airportsData={airportsForMap}
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
                      productionPoints={productionPointsForMap}
                      showProductionPoints={filters.showProductionPoints}
                      selectedProductionPointId={selectedProductionPointId}
                      onProductionPointSelect={handleProductionPointSelect}
                      spawnPlacementActive={Boolean(spawnMode)}
                      onSpawnPlace={handleSpawnPlace}
                      spawnAirportCenter={spawnAirportCenter}
                      retrievePlacementActive={Boolean(retrieveMode)}
                      onRetrievePlace={handleRetrievePlace}
                      retrievePpCenter={retrievePpCenter}
                      crateClusters={crateClusters}
                      mapMaxZoom={mapMaxZoom}
                      dbuildMapMarkers={dbuildMapMarkers}
                      selectedDbuildPlacementId={selectedDbuildPlacementId}
                      onDbuildPlacementSelect={handleDbuildPlacementSelect}
                      mapContextMenuEnabled={mapContextMenuEnabled}
                      onMapContextMenu={handleMapContextMenu}
                      mapContextMenuAnchor={mapContextMenuAnchor}
                      onMapContextMenuScreenUpdate={handleMapContextMenuScreenUpdate}
                      tankerPlacementActive={Boolean(tankerMode)}
                      onTankerPlace={handleTankerPlace}
                      tankerWp1={tankerWp1}
                      tankerRoutes={tankerRoutes}
                    />
                  )}
                </div>
              )}
              <MapFilterBar
                filters={filters}
                basemapMode={basemapMode}
                basemapModeSatellite={BASEMAP_MODE_SATELLITE}
                onToggleFilter={(key) => setFilters((current) => ({ ...current, [key]: !current[key] }))}
                onToggleBasemap={() => setBasemapMode((current) => (
                  current === BASEMAP_MODE_SATELLITE ? BASEMAP_MODE_DARK : BASEMAP_MODE_SATELLITE
                ))}
              />

              <LiveFeedPanel
                language={language}
                feedEvents={feedEvents}
                feedCollapsed={feedCollapsed}
                onToggleFeedCollapsed={() => setFeedCollapsed((value) => !value)}
                operationsCollapsed={operationsCollapsed}
                onToggleOperationsCollapsed={() => setOperationsCollapsed((value) => !value)}
                zones={validZones}
                combatMissionByZone={combatMissionByZone}
                logisticsMissions={filteredLogisticsMissions}
                productionPoints={productionPointsForMap}
                dcsarPoints={dcsarPoints}
                airports={validAirports}
                logisticAirportFocus={opsLogisticAirportFocus}
                onSelectZone={setSelectedZoneId}
                onSelectLogisticsMission={(mission) => {
                  setSelectedLogisticsMission(mission);
                  if (mission?.airport_id) setSelectedAirportId(mission.airport_id);
                }}
                onSelectProductionPoint={setSelectedProductionPointId}
                onSelectDcsar={(point) => setSelectedDcsarId(point?.id || null)}
              />

              {filters.showAto && focusedZone && (
                <div className="absolute bottom-4 left-4 z-[1000]">
                  <ZoneMissionCard
                    zone={focusedZone}
                    zones={zoneOptionsForCard}
                    neighborZones={selectedZoneNeighbors}
                    changedAt={selectedChangedAt}
                    zoneNumber={getZoneNumber(focusedZone)}
                    coordinatesDms={formatZoneCoordinates(focusedZone.coordinates, 'dms')}
                    coordinatesMgrs={formatZoneCoordinates(focusedZone.coordinates, 'mgrs')}
                    acceptedByCurrentUser={selectedZoneAcceptedByCurrentUser}
                    acceptedByOther={selectedZoneAcceptedByOther}
                    hasTasks={selectedZoneHasTasks}
                    canAcceptMore={canCurrentUserAcceptMoreZones}
                    accepting={acceptingZoneOperationId === focusedZone.id}
                    declining={decliningZoneOperationId === focusedZone.id}
                    activeZoneId={selectedZoneId}
                    onSelectZone={setSelectedZoneId}
                    onAccept={handleAcceptZoneOperation}
                    onDecline={handleDeclineZoneOperation}
                    onClose={() => setSelectedZoneId(null)}
                  />
                </div>
              )}

              {mapMode && filters.showDcsar && hoveredDcsarPoint && (
                <div className={`absolute bottom-4 z-[1000] w-[360px] rounded-xl border border-yt-border bg-[#1b1d2af0] p-3 shadow-2xl backdrop-blur ${filters.showAto && focusedZone ? 'left-[474px]' : 'left-4'}`}>
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

              {retrieveMode && (
                <div className="absolute left-1/2 top-4 z-[1100] -translate-x-1/2">
                  <ProductionPointRetrieveBanner
                    quantity={retrieveMode.quantity || 1}
                    maxQuantity={retrieveBannerMaxQuantity}
                    radiusM={PP_RETRIEVE_RADIUS_M}
                    submitting={submittingCommand}
                    onQuantityChange={handleSetRetrieveQuantity}
                    onCancel={handleCancelRetrieveMode}
                  />
                </div>
              )}

              {tankerMode && (
                <div className="absolute left-1/2 top-4 z-[1100] -translate-x-1/2 rounded-lg border border-cyan-400/60 bg-[#05151af2] px-4 py-2 text-center shadow-2xl backdrop-blur">
                  <div className="text-sm font-semibold text-cyan-200">
                    {tankerMode.step === 'wp1'
                      ? `Place ${tankerMode.label} WP1 on the map`
                      : `Place ${tankerMode.label} WP2 outside the red zone (min ${TANKER_MIN_DIST_NM} NM from WP1)`}
                  </div>
                  <div className="mt-1 text-[11px] text-cyan-100/80">
                    {submittingCommand ? 'Sending...' : (tankerMode.step === 'wp1' ? 'Click to set racetrack start' : 'Click outside the exclusion area')}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelTankerMode}
                    className="mt-1 rounded border border-cyan-400/60 px-2 py-0.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-400/15"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {spawnMode && (
                <div className="absolute left-1/2 top-4 z-[1100] -translate-x-1/2 rounded-lg border border-[#4e4e4e] bg-[#0e0e0ef2] px-4 py-2 text-center shadow-2xl backdrop-blur">
                  <div className="text-sm font-semibold text-white">
                    Place {spawnMode.quantity || 1}x {formatSpawnBannerName(spawnMode.label)} inside of the designated range
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/70">Qty</span>
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
                              ? 'border-[#575757] bg-[#575757] text-white'
                              : 'border-[#4e4e4e] bg-[#0e0e0e] text-white/80 hover:border-[#757575] hover:bg-[#1b1b1b]'
                          }`}
                        >
                          {value}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-1 text-[11px] text-white/70">
                    Total {(spawnMode.cost || 0) * (spawnMode.quantity || 1)} fp
                    {' • '}
                    {SPAWN_OFFSET_METERS} m spacing
                    {' • '}
                    {submittingCommand ? 'Sending...' : 'Click the highlighted area on the map'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelSpawnMode}
                    className="mt-1 rounded border border-[#4e4e4e] bg-[#0e0e0e] px-2 py-0.5 text-[11px] font-semibold text-white hover:border-[#757575] hover:bg-[#1b1b1b]"
                  >
                    Cancel
                  </button>
                </div>
              )}

              <MapActionContextMenu
                menu={mapContextMenu}
                onClose={() => setMapContextMenu(null)}
                onSelectDbuild={handleCreateDbuildDraft}
                onSelectTanker={handleStartTankerMode}
                onSelectMapAction={handleSelectMapAction}
              />

              {selectedDbuildPlacement && (
                <div className="absolute right-4 top-20 z-[1000] w-[330px] rounded-xl border border-yt-border bg-[#151925f2] p-3 shadow-2xl backdrop-blur">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-sm font-semibold text-yt-text-primary">
                      {selectedDbuildPlacement.catalog?.label || selectedDbuildPlacement.build_type}
                    </div>
                    <PanelCloseButton onClick={() => setSelectedDbuildPlacementId(null)} />
                  </div>
                  <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-yt-text-secondary">
                    Status: {selectedDbuildPlacement.status || 'draft'}
                  </div>
                  <div className="space-y-1 rounded border border-yt-border bg-yt-bg-tertiary/40 p-2">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">
                      Crate requirements
                    </div>
                    {(selectedDbuildPlacement.category_order || Object.keys(selectedDbuildPlacement.catalog?.required_categories || {})).map((category) => {
                      const required = Number(selectedDbuildPlacement.catalog?.required_categories?.[category]) || 0;
                      const have = Number(selectedDbuildPlacement.live?.category_counts?.[category]) || 0;
                      return (
                        <div key={category} className="flex items-center justify-between text-[12px] text-yt-text-primary">
                          <span>{category}</span>
                          <span className={have >= required ? 'text-green-300' : 'text-yt-text-primary'}>
                            {have}/{required}
                          </span>
                        </div>
                      );
                    })}
                    <div className="mt-1 text-[10px] text-yt-text-secondary">
                      Estimated crate cost: {selectedDbuildPlacement.estimated_fp_cost || 0} fp
                    </div>
                    {selectedDbuildPlacement.catalog?.placement_notes && (
                      <div className="mt-1 text-[10px] text-amber-200/80">
                        {selectedDbuildPlacement.catalog.placement_notes}
                      </div>
                    )}
                    {selectedDbuildPlacement.catalog?.build_radius_m && (
                      <div className="text-[10px] text-yt-text-secondary">
                        Deliver crates within {selectedDbuildPlacement.catalog.build_radius_m} m after confirmation.
                      </div>
                    )}
                  </div>
                  {selectedDbuildPlacement.status === 'draft' && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleConfirmDbuildPlacement(selectedDbuildPlacement.id)}
                        disabled={!isAuthenticated || confirmingDbuildId === selectedDbuildPlacement.id}
                        className="flex-1 rounded border border-yt-accent/50 bg-yt-accent/15 px-2.5 py-1.5 text-xs font-semibold text-yt-text-primary hover:bg-yt-accent/25 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {confirmingDbuildId === selectedDbuildPlacement.id ? 'Confirming...' : 'Conferma'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelDbuildDraft(selectedDbuildPlacement.id)}
                        className="rounded border border-yt-border px-2.5 py-1.5 text-xs font-semibold text-yt-text-secondary hover:bg-yt-bg-tertiary/50"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                  {selectedDbuildPlacement.status !== 'draft' && selectedDbuildPlacement.live?.structure_name && (
                    <div className="mt-2 text-[11px] text-green-200">
                      Built: {selectedDbuildPlacement.live.structure_name}
                    </div>
                  )}
                  {selectedDbuildPlacement.error && (
                    <div className="mt-2">
                      <InlineError message={selectedDbuildPlacement.error} align="start" />
                    </div>
                  )}
                </div>
              )}

              {commandToast && (
                <div
                  className={`absolute left-1/2 bottom-4 z-[1100] -translate-x-1/2 rounded-lg border px-4 py-2 text-sm font-semibold shadow-2xl backdrop-blur transition-opacity duration-300 ${
                    commandToastFading ? 'opacity-0' : 'opacity-100'
                  } ${
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

              {filters.showProductionPoints && selectedProductionPoint && (
                <div className="absolute bottom-4 left-4 z-[1000]">
                  <ProductionPointPanel
                    pp={selectedProductionPoint}
                    productionPoints={productionPoints}
                    onSelectPp={handleProductionPointSelect}
                    onClose={() => {
                      setSelectedProductionPointId(null);
                      setRetrieveMode(null);
                    }}
                    onUpgrade={() => handleRequestUpgrade(selectedProductionPoint.id)}
                    onGetStock={() => handleEnterRetrieveMode(selectedProductionPoint.id, panelRetrieveQuantity)}
                    retrieveQuantity={panelRetrieveQuantity}
                    maxRetrieveQuantity={maxRetrieveQuantity}
                    onRetrieveQuantityChange={(quantity) => {
                      if (retrieveMode && retrieveMode.ppId === selectedProductionPoint.id) {
                        handleSetRetrieveQuantity(quantity);
                        return;
                      }
                      setPpRetrieveDraftQty(clampRetrieveQuantity(quantity, maxRetrieveQuantity));
                    }}
                    canUpgrade={canUpgradeSelectedPp}
                    canRetrieve={canRetrieveSelectedPp}
                    upgradingSending={upgradingPpId === selectedProductionPoint.id}
                    retrieveModeActive={Boolean(retrieveMode && retrieveMode.ppId === selectedProductionPoint.id)}
                    isAuthenticated={isAuthenticated}
                  />
                </div>
              )}

              {occupancyAirport && (
                <div className="hidc-airport-overlay">
                  <LidcAirportPresencePanel
                    airport={occupancyAirport}
                    occupancy={airportOccupancy}
                    loading={airportOccupancyLoading}
                    error={airportOccupancyError}
                    showSquadrons={false}
                    orderAlertCount={Array.isArray(airportOccupancy?.orders) ? airportOccupancy.orders.length : 0}
                    onClose={() => {
                      setSelectedAirportId(null);
                      setAirportWizardTab('');
                      setSpawnMode(null);
                      setRetrieveMode(null);
                      setTankerMode(null);
                    }}
                    onOpenWizard={(tab) => setAirportWizardTab(tab === 'logistics' ? 'logistics' : 'overview')}
                  />
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
                        <PanelCloseButton onClick={() => setSelectedLogisticsMission(null)} />
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
                        <PanelCloseButton onClick={() => setSelectedDcsarId(null)} />
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
    {airportWizardTab && occupancyAirport && typeof document !== 'undefined' && createPortal(
      <LidcAirportWizard
        airport={occupancyAirport}
        occupancy={{ ...(airportOccupancy || {}), economy: 'faction' }}
        activeTab={airportWizardTab}
        isLogged={isAuthenticated}
        variant="hidc"
        onPurchase={purchaseAirportLogistics}
        onUpdateOrder={updateAirportOrder}
        onChangeTab={setAirportWizardTab}
        onClose={() => setAirportWizardTab('')}
        onLogisticsUpdated={handleAirportLogisticsUpdated}
        overviewExtra={(
          <section className="lidc-airport-wizard-block">
            <div className="airport-spawn-panel">
              <div className="airport-spawn-panel__body">
                <div className="airport-spawn-panel__block">
                  <div className="airport-spawn-panel__block-title">
                    <Box className="airport-spawn-panel__block-icon" strokeWidth={2} aria-hidden="true" />
                    <span>SPAWN ASSET</span>
                  </div>
                  {!isAuthenticated ? (
                    <div className="airport-spawn-panel__empty">
                      Login to spawn units and crates.
                    </div>
                  ) : (
                    <>
                      {SPAWN_MENU_SECTIONS.map((section) => {
                        const sectionOptions = section.keywords
                          .map((keyword) => {
                            const option = spawnOptionByKeyword.get(keyword);
                            return option ? { keyword, option } : null;
                          })
                          .filter(Boolean);
                        if (sectionOptions.length === 0) return null;
                        return (
                          <div key={section.id} className="airport-spawn-panel__spawn-section">
                            <p className="airport-spawn-panel__section-title">{section.title}</p>
                            <div className="airport-spawn-panel__pills">
                              {sectionOptions.map(({ keyword, option }) => {
                                const selected = spawnMode?.keyword === keyword && spawnMode?.type === section.spawnType;
                                return (
                                  <button
                                    key={`${section.id}-${keyword}`}
                                    type="button"
                                    onClick={() => {
                                      handleEnterSpawnMode(selectedAirport.id, section.spawnType, option);
                                      setAirportWizardTab('');
                                    }}
                                    className={`airport-spawn-panel__pill${selected ? ' is-selected' : ''}`}
                                  >
                                    {keyword}
                                    <span className="airport-spawn-panel__pill-cost">({option.cost})</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <p className="airport-spawn-panel__hint">
                        Select an item, then click inside the airport on the map.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
      />,
      document.body,
    )}
    </section>
  );
}
