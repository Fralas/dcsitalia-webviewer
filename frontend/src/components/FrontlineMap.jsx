import { useMemo, useState, useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { MapContainer, TileLayer, CircleMarker, Polyline, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock3, MapPin } from 'lucide-react';
import frontlineZones from '../config/frontlineZones.json';
import airports from '../config/airports';
import socketService from '../services/socket';
import { getCombatMissions, getFrontlineZones, getMissions } from '../services/api';

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

function getZoneNumber(zone) {
  const source = String(zone?.id || zone?.name || '');
  const match = source.match(/\d+/);
  return match ? match[0] : source || 'Unknown';
}

function getControlText(status) {
  if (status === 'RED') return 'red control';
  if (status === 'BLUE') return 'blue control';
  if (status === 'UNDER_ATTACK') return 'contested control';
  return 'no control';
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

function GlobeCanvas({ points, focusCoordinates, onScaleChange, mapMode, forcedScale }) {
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

  useEffect(() => {
    if (!focusCoordinates) return;
    const lon = focusCoordinates.lon || 0;
    const lat = focusCoordinates.lat || 0;
    targetPhiRef.current = (lon * Math.PI) / 180;
    targetThetaRef.current = (lat * Math.PI) / 180;
  }, [focusCoordinates]);

  useEffect(() => {
    if (typeof forcedScale !== 'number') return;
    scaleRef.current = forcedScale;
    targetScaleRef.current = forcedScale;
  }, [forcedScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return undefined;

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
  }, [points, onScaleChange, mapMode]);

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
  selectedZoneId,
  onZoneSelect,
  focusCoordinates,
  onZoomChange,
  onZoneHover,
  onAirportClick,
  showAto,
  showAirports,
  showLogistics,
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
                {(sourceAirport.displayName || sourceAirport.name)} -> {(destinationAirport.displayName || destinationAirport.name)}
              </Tooltip>
            </Polyline>
          );
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
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [hoveredZoneId, setHoveredZoneId] = useState(null);
  const [selectedAirportId, setSelectedAirportId] = useState(null);
  const [zones, setZones] = useState(frontlineZones);
  const [combatMissions, setCombatMissions] = useState([]);
  const [logisticsMissions, setLogisticsMissions] = useState([]);
  const [zoneStatusMeta, setZoneStatusMeta] = useState({});
  const [mapMode, setMapMode] = useState(false);
  const [forcedGlobeScale, setForcedGlobeScale] = useState(null);
  const [filters, setFilters] = useState({
    control: 'all',
    missionStatus: 'all',
    priority: 'all',
    task: 'all',
    activity: 'all',
    showAto: true,
    showLogistics: true,
    showAirports: true,
  });
  const mapModeRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getFrontlineZones(), getCombatMissions(), getMissions()])
      .then(([zonesData, missionsData, logisticsData]) => {
        const nextZones = zonesData?.zones || zonesData;
        if (isMounted && Array.isArray(nextZones)) {
          setZones(nextZones);
        }
        if (isMounted && Array.isArray(missionsData)) {
          setCombatMissions(missionsData);
        }
        if (isMounted && Array.isArray(logisticsData)) {
          setLogisticsMissions(logisticsData);
        }
      })
      .catch((error) => {
        console.error('Failed to load frontline data:', error);
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

    return () => {
      unsubscribe && unsubscribe();
      unsubscribeMissions && unsubscribeMissions();
      unsubscribeLogistics && unsubscribeLogistics();
    };
  }, []);

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
      if (filters.missionStatus !== 'all' && mission?.mission_status !== filters.missionStatus) return false;
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
      if (filters.missionStatus !== 'all' && mission.status !== filters.missionStatus) return false;
      return true;
    });
  }, [logisticsMissions, filters.missionStatus]);

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
      { label: 'Any Mission', value: 'all' },
      { label: 'Available', value: 'available' },
      { label: 'Assigned', value: 'assigned' },
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

  const theaterCenter = useMemo(() => {
    const source = validAirports.length > 0 ? validAirports : validZones;
    if (source.length === 0) return null;
    const sum = source.reduce(
      (acc, item) => ({
        lat: acc.lat + item.coordinates.lat,
        lon: acc.lon + item.coordinates.lon,
      }),
      { lat: 0, lon: 0 }
    );
    return { lat: sum.lat / source.length, lon: sum.lon / source.length };
  }, [validAirports, validZones]);

  const focusCoordinates = focusedZone?.coordinates || (filteredZones[0] && filteredZones[0].coordinates) || theaterCenter || null;

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

  const airportLogistics = useMemo(() => {
    if (!selectedAirportId) return [];
    return filteredLogisticsMissions.filter((mission) => mission.airport_id === selectedAirportId);
  }, [selectedAirportId, filteredLogisticsMissions]);

  const selectedAirport = selectedAirportId ? airportsById.get(selectedAirportId) : null;

  return (
    <div className="h-full overflow-hidden bg-yt-bg-primary p-3">
      <div className="h-full">
        <div className="min-h-0 h-full">
          <section className="relative flex h-full min-h-[320px] min-w-0 flex-col overflow-hidden rounded-2xl border border-yt-border bg-yt-bg-secondary/75 backdrop-blur">
            <div className="relative min-h-0 flex-1">
              <div className={`${mapMode ? 'pointer-events-none absolute inset-0 opacity-0' : 'relative h-full w-full opacity-100'} transition-opacity duration-300`}>
                <GlobeCanvas
                  points={globePoints}
                  focusCoordinates={focusCoordinates}
                  onScaleChange={handleScaleChange}
                  mapMode={mapMode}
                  forcedScale={forcedGlobeScale}
                />
              </div>
              {mapMode && (
                <div className="absolute inset-0">
                  <FlatMapView
                    zones={filteredZones}
                    airportsData={validAirports}
                    logisticsMissions={filteredLogisticsMissions}
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={setSelectedZoneId}
                    focusCoordinates={focusCoordinates}
                    onZoomChange={handleFlatMapZoomChange}
                    onZoneHover={setHoveredZoneId}
                    onAirportClick={setSelectedAirportId}
                    showAto={filters.showAto}
                    showAirports={filters.showAirports}
                    showLogistics={filters.showLogistics}
                  />
                </div>
              )}
              {mapMode && (
                <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-yt-border/80 bg-yt-bg-secondary/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">
                  Tactical 2D Map (zoom threshold reached)
                </div>
              )}

              <div className="absolute left-3 top-3 z-[1000] w-[320px] rounded-xl border border-yt-border bg-[#151925f2] p-3 shadow-2xl backdrop-blur">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">Overlays</div>
                  <button
                    type="button"
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${filters.showAirports ? 'bg-yt-accent/25 text-yt-text-primary' : 'bg-yt-bg-tertiary text-yt-text-secondary'}`}
                    onClick={() => setFilters((current) => ({ ...current, showAirports: !current.showAirports }))}
                  >
                    Airports
                  </button>
                </div>

                <div className="mb-2 grid grid-cols-2 gap-2">
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
                    value={filters.missionStatus}
                    onChange={(event) => setFilters((current) => ({ ...current, missionStatus: event.target.value }))}
                    className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                  >
                    {missionStatusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                  <select
                    value={filters.priority}
                    onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value }))}
                    className="rounded border border-yt-border bg-yt-bg-tertiary px-2 py-1.5 text-xs text-yt-text-primary"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
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
              </div>

              {selectedZone && (
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

                  <div className="mt-2 flex items-center gap-2 text-sm text-yt-text-secondary">
                    <MapPin className="h-4 w-4" />
                    <span>{selectedZone.coordinates.lat.toFixed(5)}, {selectedZone.coordinates.lon.toFixed(5)}</span>
                  </div>

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
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
