import { useMemo, useState, useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Globe2, Layers, Map, MapPin, Plane, Radio, RefreshCw, Target, PanelRightClose, PanelRightOpen } from 'lucide-react';
import frontlineZones from '../config/frontlineZones.json';
import airports from '../config/airports';
import MissionDispatchPanel from './MissionDispatchPanel';
import socketService from '../services/socket';
import { getFrontlineZones } from '../services/api';

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

function FlatMapView({ zones, airportsData, selectedZoneId, onZoneSelect, focusCoordinates, onZoomChange }) {
  const center = focusCoordinates || { lat: 35.5, lon: 37.5 };

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

        {zones.map((zone) => {
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
              eventHandlers={{ click: () => onZoneSelect(zone.id) }}
            >
              <Tooltip direction="top" offset={[0, -4]} opacity={0.95}>
                {zone.name || zone.zone_name || zone.id}
              </Tooltip>
            </CircleMarker>
          );
        })}

        {airportsData.map((airport) => (
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
  const [zones, setZones] = useState(frontlineZones);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mapMode, setMapMode] = useState(false);
  const [forcedGlobeScale, setForcedGlobeScale] = useState(null);
  const mapModeRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    getFrontlineZones()
      .then((data) => {
        const nextZones = data?.zones || data;
        if (isMounted && Array.isArray(nextZones)) {
          setZones(nextZones);
        }
      })
      .catch((error) => {
        console.error('Failed to load frontline zones:', error);
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
    return () => unsubscribe && unsubscribe();
  }, []);

  const validZones = useMemo(
    () => zones.filter((zone) => zone.coordinates && Number.isFinite(zone.coordinates.lat) && Number.isFinite(zone.coordinates.lon)),
    [zones]
  );

  const validAirports = useMemo(() => {
    const airportsList = Array.isArray(airportsData) ? airportsData : airports;
    return airportsList.filter((airport) => airport.coordinates && airport.isActive !== false);
  }, [airportsData]);

  const zoneStats = useMemo(() => {
    const stats = {
      NEUTRAL: 0,
      BLUE: 0,
      RED: 0,
      UNDER_ATTACK: 0,
      total: validZones.length,
      active: 0,
    };

    validZones.forEach((zone) => {
      if (stats[zone.status] !== undefined) stats[zone.status] += 1;
      if (zone.isActive) stats.active += 1;
    });
    return stats;
  }, [validZones]);

  const selectedZone = useMemo(
    () => validZones.find((zone) => zone.id === selectedZoneId) || null,
    [selectedZoneId, validZones]
  );

  const globePoints = useMemo(() => {
    const zonePoints = validZones.map((zone) => ({
      lat: zone.coordinates.lat,
      lon: zone.coordinates.lon,
      size: zone.id === selectedZoneId ? 0.14 : zone.isActive ? 0.1 : 0.07,
    }));
    const airportPoints = validAirports.map((airport) => ({
      lat: airport.coordinates.lat,
      lon: airport.coordinates.lon,
      size: airport.isMainBase ? 0.11 : 0.08,
    }));
    return [...zonePoints, ...airportPoints];
  }, [validZones, validAirports, selectedZoneId]);

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

  const focusCoordinates = selectedZone?.coordinates || theaterCenter || null;

  const handleMissionClick = (zoneId) => {
    setSelectedZoneId(zoneId);
  };

  const handleResetView = () => {
    setSelectedZoneId(null);
    setMapMode(false);
    mapModeRef.current = false;
    setForcedGlobeScale(1.15);
  };

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

  return (
    <div className="h-full overflow-hidden bg-yt-bg-primary p-3">
      <div className="flex h-full flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-yt-border bg-yt-bg-secondary/80 p-3 backdrop-blur md:grid-cols-[1.8fr_1fr_auto]">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-red-500/40 bg-red-500/15 p-2">
              <Target className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-yt-text-primary">Frontline Ops</h1>
              <p className="text-xs text-yt-text-secondary">Globo 3D, feed missioni e monitor zona in tempo reale</p>
            </div>
            <div className="ml-2 inline-flex items-center gap-2 rounded-full border border-green-500/40 bg-green-500/15 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-green-300">
              <Radio className="h-3.5 w-3.5" />
              Live
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-lg border border-yt-border bg-yt-bg-tertiary/80 px-2 py-2">
              <div className="text-yt-text-secondary">Zone</div>
              <div className="text-sm font-semibold text-yt-text-primary">{zoneStats.total}</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-2 py-2">
              <div className="text-red-300">Rosse</div>
              <div className="text-sm font-semibold text-red-200">{zoneStats.RED}</div>
            </div>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-2">
              <div className="text-blue-300">Blu</div>
              <div className="text-sm font-semibold text-blue-200">{zoneStats.BLUE}</div>
            </div>
            <div className="rounded-lg border border-slate-400/30 bg-slate-400/10 px-2 py-2">
              <div className="text-slate-300">Neutrali</div>
              <div className="text-sm font-semibold text-slate-100">{zoneStats.NEUTRAL}</div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleResetView}
              className="inline-flex items-center gap-2 rounded-lg border border-yt-border bg-yt-bg-tertiary px-3 py-2 text-xs font-semibold text-yt-text-secondary transition-colors hover:text-yt-text-primary"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen((current) => !current)}
              className="inline-flex items-center gap-2 rounded-lg border border-yt-border bg-yt-bg-tertiary px-3 py-2 text-xs font-semibold text-yt-text-secondary transition-colors hover:text-yt-text-primary"
            >
              {sidebarOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              Feed
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[1fr_30rem]">
          <section className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-2xl border border-yt-border bg-yt-bg-secondary/75 backdrop-blur">
            <div className="flex flex-wrap items-center gap-2 border-b border-yt-border px-3 py-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-border bg-yt-bg-tertiary/80 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-yt-text-secondary">
                {mapMode ? <Map className="h-3.5 w-3.5 text-yt-accent" /> : <Globe2 className="h-3.5 w-3.5 text-yt-accent" />}
                {mapMode ? 'Tactical Map' : 'Global Theater'}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-border bg-yt-bg-tertiary/80 px-3 py-1 text-[11px] text-yt-text-secondary">
                <Layers className="h-3.5 w-3.5 text-orange-400" />
                Attacco: {zoneStats.UNDER_ATTACK}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-yt-border bg-yt-bg-tertiary/80 px-3 py-1 text-[11px] text-yt-text-secondary">
                <Plane className="h-3.5 w-3.5 text-yt-accent" />
                Aeroporti: {validAirports.length}
              </div>
            </div>

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
                    zones={validZones}
                    airportsData={validAirports}
                    selectedZoneId={selectedZoneId}
                    onZoneSelect={setSelectedZoneId}
                    focusCoordinates={focusCoordinates}
                    onZoomChange={handleFlatMapZoomChange}
                  />
                </div>
              )}
              {mapMode && (
                <div className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full border border-yt-border/80 bg-yt-bg-secondary/90 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-yt-text-secondary">
                  Tactical 2D Map (zoom threshold reached)
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 border-t border-yt-border p-3 md:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-[0.16em] text-yt-text-secondary">Zone Focus</h3>
                <div className="max-h-28 space-y-1.5 overflow-y-auto pr-1">
                  {validZones.slice(0, 12).map((zone) => (
                    <button
                      type="button"
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className={`flex w-full items-center justify-between rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors ${
                        zone.id === selectedZoneId
                          ? 'border-yt-accent bg-yt-accent/15 text-yt-text-primary'
                          : 'border-yt-border bg-yt-bg-tertiary/70 text-yt-text-secondary hover:text-yt-text-primary'
                      }`}
                    >
                      <span className="truncate">{zone.name || zone.zone_name || zone.id}</span>
                      <span className={`h-2.5 w-2.5 rounded-full border ${getZoneColor(zone.status)}`} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-xs uppercase tracking-[0.16em] text-yt-text-secondary">Zona Selezionata</h3>
                {!selectedZone ? (
                  <div className="rounded-lg border border-dashed border-yt-border px-3 py-4 text-xs text-yt-text-secondary">
                    Seleziona una zona dal feed o dalla lista per puntare il globo.
                  </div>
                ) : (
                  <div className="rounded-lg border border-yt-border bg-yt-bg-tertiary/75 p-3 text-xs text-yt-text-secondary">
                    <div className="mb-2 text-sm font-semibold text-yt-text-primary">
                      {selectedZone.name || selectedZone.zone_name || selectedZone.id}
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-3.5 w-3.5 text-yt-accent" />
                      {selectedZone.coordinates.lat.toFixed(3)}, {selectedZone.coordinates.lon.toFixed(3)}
                    </div>
                    <div className="mt-2">
                      Stato: <span className="text-yt-text-primary">{getStatusLabel(selectedZone.status)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className={`${sidebarOpen ? 'flex' : 'hidden'} min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-yt-border bg-yt-bg-secondary/75 backdrop-blur xl:flex`}>
            <div className="border-b border-yt-border px-3 py-2">
              <div className="text-xs uppercase tracking-[0.16em] text-yt-text-secondary">Sidebar Feed</div>
              <div className="text-sm font-semibold text-yt-text-primary">Missioni e aggiornamenti</div>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <MissionDispatchPanel selectedZoneId={selectedZoneId} onMissionClick={handleMissionClick} />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
