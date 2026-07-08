import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Factory, Forklift, Helicopter, MapPin, Plane, RotateCcw } from 'lucide-react';
import {
  getAirportLabel,
  getCoords,
  haversineNm,
} from '../../utils/mapGeo';
import { getStatusLabel, t } from '../../utils/locale';
import './MapOperationsPanel.css';

const PLANE_MISSION_TASKS = ['CAS', 'DEAD', 'SEAD', 'STRIKE', 'CAP'];
const HELI_MISSION_TASKS = ['CAS', 'DEAD', 'SEAD', 'STRIKE', 'CSAR'];
const LOGISTIC_AIRCRAFT = ['CH-47F', 'UH-1H', 'Mi-8', 'C-130J'];
const TABS = [
  { id: 'mission', labelKey: 'map.rightPanel.ops.tabs.mission', icon: MapPin },
  { id: 'logistic', labelKey: 'map.rightPanel.ops.tabs.logistic', icon: Forklift },
  { id: 'production', labelKey: 'map.rightPanel.ops.tabs.production', icon: Factory },
];

const TAKEOFF_ICON_PATHS = [
  'M2 22h20',
  'M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z',
];

const LANDING_ICON_PATHS = [
  'M2 22h20',
  'M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.5l.72 5.4a2 2 0 0 0 1.09 1.52l4.42 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z',
];

function getZoneNumber(zone) {
  const source = String(zone?.id || zone?.name || '');
  const match = source.match(/\d+/);
  return match ? match[0] : source || '?';
}

function getZoneTasks(zone, combatMissionByZone) {
  const mission = combatMissionByZone?.get?.(zone?.id);
  return [...new Set([...(zone?.tasks || []), ...(mission?.tasks || [])].filter(Boolean))];
}

function formatNm(value) {
  return t('map.rightPanel.ops.nm', { value: Number(value).toFixed(1) });
}

function formatRowDistance(distanceNm) {
  if (distanceNm == null || !Number.isFinite(distanceNm)) return '';
  return formatNm(distanceNm);
}

function sortByDistance(rows, getDistance = (row) => row.distanceNm) {
  return [...rows].sort((a, b) => {
    const aDistance = getDistance(a);
    const bDistance = getDistance(b);
    if (aDistance != null && bDistance != null) return aDistance - bDistance;
    if (aDistance != null) return -1;
    if (bDistance != null) return 1;
    return 0;
  });
}

function TakeoffIcon() {
  return (
    <svg
      className="map-ops-section__select-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TAKEOFF_ICON_PATHS.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function LandingIcon() {
  return (
    <svg
      className="map-ops-section__select-icon"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {LANDING_ICON_PATHS.map((path) => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function parseRadiusDigits(rawValue) {
  const digits = String(rawValue).replace(/\D/g, '').slice(0, 4);
  if (digits === '') return 1;
  return Math.min(9999, Math.max(1, Number(digits)));
}

function parseWeightDigits(rawValue) {
  const digits = String(rawValue).replace(/\D/g, '').slice(0, 6);
  if (digits === '') return '';
  return Math.min(999999, Math.max(0, Number(digits)));
}

function parseStockDigits(rawValue) {
  const digits = String(rawValue).replace(/\D/g, '').slice(0, 2);
  if (digits === '') return '';
  return String(Math.min(99, Math.max(0, Number(digits))));
}

function formatProductionPointCode(pp) {
  const raw = String(pp?.zone_name || pp?.id || '').trim();
  const match = raw.match(/^PP[_\s-]*0*(\d+)$/i);
  if (match) return `PP_${match[1].padStart(2, '0')}`;
  return raw;
}

function getProductionPointSortKey(pp) {
  const raw = String(pp?.zone_name || pp?.id || '').trim();
  const match = raw.match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function findZoneForProductionPoint(pp, zoneList) {
  const ppKeys = [pp?.id, pp?.zone_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return zoneList.find((zone) => {
    const zoneKeys = [zone?.id, zone?.name, zone?.zone_name]
      .map((value) => String(value || '').trim())
      .filter(Boolean);
    return ppKeys.some((key) => zoneKeys.includes(key));
  }) || null;
}

function productionPointMatchesZone(pp, zone) {
  if (!zone) return false;
  const ppKeys = [pp?.id, pp?.zone_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const zoneKeys = [zone?.id, zone?.name, zone?.zone_name]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return ppKeys.some((key) => zoneKeys.includes(key));
}

function resolveProductionPointCoords(pp, zoneList) {
  const coords = getCoords(pp);
  if (coords) return { ...pp, coordinates: coords };
  const linkedZone = findZoneForProductionPoint(pp, zoneList);
  const zoneCoords = getCoords(linkedZone);
  if (zoneCoords) return { ...pp, coordinates: zoneCoords };
  return pp;
}

export default function MapOperationsPanel({
  language = 'en',
  collapsed = false,
  zones = [],
  combatMissionByZone,
  logisticsMissions = [],
  productionPoints = [],
  dcsarPoints = [],
  airports = [],
  onSelectZone,
  onSelectLogisticsMission,
  onSelectProductionPoint,
  onSelectDcsar,
}) {
  void language;

  const [activeTab, setActiveTab] = useState('mission');
  const [aircraftMode, setAircraftMode] = useState('plane');
  const [taskFilter, setTaskFilter] = useState('all');
  const [radiusNm, setRadiusNm] = useState(100);
  const [missionAirportId, setMissionAirportId] = useState('');

  const [logisticDepartureAirportId, setLogisticDepartureAirportId] = useState('');
  const [logisticArrivalAirportId, setLogisticArrivalAirportId] = useState('');
  const [logisticRangeNm, setLogisticRangeNm] = useState(100);
  const [logisticDistanceMode, setLogisticDistanceMode] = useState('range');
  const [logisticAircraft, setLogisticAircraft] = useState(LOGISTIC_AIRCRAFT[0]);
  const [logisticWeight, setLogisticWeight] = useState('');

  const [productionDepartureAirportId, setProductionDepartureAirportId] = useState('');
  const [productionArrivalZoneId, setProductionArrivalZoneId] = useState('');
  const [productionRangeNm, setProductionRangeNm] = useState(100);
  const [productionDistanceMode, setProductionDistanceMode] = useState('range');
  const [productionPointId, setProductionPointId] = useState('');
  const [productionMinStock, setProductionMinStock] = useState('');

  const missionTasks = aircraftMode === 'heli' ? HELI_MISSION_TASKS : PLANE_MISSION_TASKS;

  useEffect(() => {
    if (aircraftMode === 'heli' && taskFilter === 'CAP') {
      setTaskFilter('all');
    }
    if (aircraftMode === 'plane' && taskFilter === 'CSAR') {
      setTaskFilter('all');
    }
  }, [aircraftMode, taskFilter]);

  const airportOptions = useMemo(() => {
    return [...airports]
      .filter((airport) => getCoords(airport))
      .sort((a, b) => getAirportLabel(a).localeCompare(getAirportLabel(b)));
  }, [airports]);

  const filteredAirportOptions = useMemo(() => {
    const filtered = airportOptions.filter((airport) => (
      aircraftMode === 'heli'
        ? airport.isHeliport === true
        : airport.isHeliport !== true
    ));
    return filtered.length > 0 ? filtered : airportOptions;
  }, [airportOptions, aircraftMode]);

  const missionAirport = useMemo(
    () => airportOptions.find((entry) => entry.id === missionAirportId) || null,
    [airportOptions, missionAirportId],
  );

  const logisticDepartureAirport = useMemo(
    () => airportOptions.find((entry) => entry.id === logisticDepartureAirportId) || null,
    [airportOptions, logisticDepartureAirportId],
  );

  const productionDepartureAirport = useMemo(
    () => airportOptions.find((entry) => entry.id === productionDepartureAirportId) || null,
    [airportOptions, productionDepartureAirportId],
  );

  const productionArrivalZone = useMemo(
    () => zones.find((entry) => entry.id === productionArrivalZoneId) || null,
    [zones, productionArrivalZoneId],
  );

  const resolvedProductionPoints = useMemo(() => (
    productionPoints.map((pp) => resolveProductionPointCoords(pp, zones))
  ), [productionPoints, zones]);

  const productionPointOptions = useMemo(() => (
    [...resolvedProductionPoints]
      .filter((pp) => getCoords(pp))
      .sort((a, b) => getProductionPointSortKey(a) - getProductionPointSortKey(b))
  ), [resolvedProductionPoints]);

  const productionDeliveryZones = useMemo(() => {
    const linkedZoneIds = new Set(
      productionPointOptions
        .map((pp) => findZoneForProductionPoint(pp, zones)?.id)
        .filter(Boolean),
    );

    return [...zones]
      .filter((zone) => getCoords(zone) && (linkedZoneIds.size === 0 || linkedZoneIds.has(zone.id)))
      .sort((a, b) => getZoneNumber(a).localeCompare(getZoneNumber(b), undefined, { numeric: true }));
  }, [zones, productionPointOptions]);

  const selectedProductionPoint = useMemo(
    () => productionPointOptions.find((entry) => entry.id === productionPointId) || null,
    [productionPointOptions, productionPointId],
  );

  useEffect(() => {
    if (missionAirportId && !airportOptions.some((entry) => entry.id === missionAirportId)) {
      setMissionAirportId('');
    }
    if (logisticDepartureAirportId && !airportOptions.some((entry) => entry.id === logisticDepartureAirportId)) {
      setLogisticDepartureAirportId('');
    }
    if (logisticArrivalAirportId && !airportOptions.some((entry) => entry.id === logisticArrivalAirportId)) {
      setLogisticArrivalAirportId('');
    }
    if (productionDepartureAirportId && !airportOptions.some((entry) => entry.id === productionDepartureAirportId)) {
      setProductionDepartureAirportId('');
    }
    if (productionArrivalZoneId && !productionDeliveryZones.some((entry) => entry.id === productionArrivalZoneId)) {
      setProductionArrivalZoneId('');
    }
    if (productionPointId && !productionPointOptions.some((entry) => entry.id === productionPointId)) {
      setProductionPointId('');
    }
  }, [
    airportOptions,
    missionAirportId,
    logisticDepartureAirportId,
    logisticArrivalAirportId,
    productionDepartureAirportId,
    productionArrivalZoneId,
    productionDeliveryZones,
    productionPointId,
    productionPointOptions,
  ]);

  const missionRows = useMemo(() => {
    const airportCoords = getCoords(missionAirport);
    const hasDeparture = Boolean(airportCoords && missionAirportId);
    const includeZoneRows = taskFilter !== 'CSAR';
    const includeCsarRows = aircraftMode === 'heli' && (taskFilter === 'all' || taskFilter === 'CSAR');

    const zoneRows = includeZoneRows
      ? zones
        .map((zone) => {
          const zoneCoords = getCoords(zone);
          if (!zoneCoords) return null;
          const tasks = getZoneTasks(zone, combatMissionByZone).filter((task) => task !== 'LOGISTICS');
          if (tasks.length === 0) return null;
          if (taskFilter !== 'all' && !tasks.includes(taskFilter)) return null;

          let distanceNm = null;
          if (hasDeparture) {
            distanceNm = haversineNm(
              airportCoords.lat,
              airportCoords.lon,
              zoneCoords.lat,
              zoneCoords.lon,
            );
            if (distanceNm > radiusNm) return null;
          }

          return { kind: 'zone', zone, tasks, distanceNm };
        })
        .filter(Boolean)
      : [];

    const csarRows = includeCsarRows
      ? dcsarPoints
        .map((point) => {
          const pointCoords = getCoords(point);
          if (!pointCoords) return null;

          let distanceNm = null;
          if (hasDeparture) {
            distanceNm = haversineNm(
              airportCoords.lat,
              airportCoords.lon,
              pointCoords.lat,
              pointCoords.lon,
            );
            if (distanceNm > radiusNm) return null;
          }

          return { kind: 'csar', point, distanceNm };
        })
        .filter(Boolean)
      : [];

    return [...zoneRows, ...csarRows].sort((a, b) => {
      if (a.distanceNm != null && b.distanceNm != null) return a.distanceNm - b.distanceNm;
      if (a.distanceNm != null) return -1;
      if (b.distanceNm != null) return 1;
      if (a.kind === 'zone' && b.kind === 'zone') {
        return getZoneNumber(a.zone).localeCompare(getZoneNumber(b.zone), undefined, { numeric: true });
      }
      if (a.kind === 'csar' && b.kind === 'csar') {
        return String(a.point.id).localeCompare(String(b.point.id), undefined, { numeric: true });
      }
      return a.kind === 'csar' ? 1 : -1;
    });
  }, [
    zones,
    combatMissionByZone,
    dcsarPoints,
    aircraftMode,
    missionAirport,
    missionAirportId,
    radiusNm,
    taskFilter,
  ]);

  const logisticRows = useMemo(() => {
    const departureCoords = getCoords(logisticDepartureAirport);
    const hasDeparture = Boolean(departureCoords && logisticDepartureAirportId);

    const airportRows = logisticsMissions
      .map((mission) => {
        const destination = airports.find((entry) => entry.id === mission.airport_id);
        const destinationCoords = getCoords(destination);
        if (!destinationCoords) return null;

        const source = airports.find((entry) => entry.id === mission.source_airport_id);
        const sourceCoords = getCoords(source);
        if (!sourceCoords) return null;

        if (logisticDistanceMode === 'arrival') {
          if (logisticArrivalAirportId && String(mission.airport_id) !== String(logisticArrivalAirportId)) {
            return null;
          }
        } else if (hasDeparture) {
          const distanceFromDeparture = haversineNm(
            departureCoords.lat,
            departureCoords.lon,
            destinationCoords.lat,
            destinationCoords.lon,
          );
          if (distanceFromDeparture > logisticRangeNm) return null;
        }

        const distanceNm = haversineNm(
          sourceCoords.lat,
          sourceCoords.lon,
          destinationCoords.lat,
          destinationCoords.lon,
        );

        return {
          kind: 'airport',
          mission,
          source,
          destination,
          distanceNm,
        };
      })
      .filter(Boolean);

    const airdropRows = logisticDistanceMode === 'range'
      ? zones
        .filter((zone) => String(zone?.status || '').toUpperCase() === 'NEUTRAL')
        .map((zone) => {
          const tasks = getZoneTasks(zone, combatMissionByZone);
          if (!tasks.includes('LOGISTICS')) return null;

          const zoneCoords = getCoords(zone);
          if (!zoneCoords) return null;

          let distanceNm = null;
          if (hasDeparture) {
            distanceNm = haversineNm(
              departureCoords.lat,
              departureCoords.lon,
              zoneCoords.lat,
              zoneCoords.lon,
            );
            if (distanceNm > logisticRangeNm) return null;
          }

          return {
            kind: 'airdrop',
            zone,
            mission: combatMissionByZone?.get?.(zone.id) || null,
            distanceNm,
          };
        })
        .filter(Boolean)
      : [];

    return sortByDistance([...airportRows, ...airdropRows]);
  }, [
    logisticsMissions,
    airports,
    zones,
    combatMissionByZone,
    logisticDepartureAirport,
    logisticDepartureAirportId,
    logisticArrivalAirportId,
    logisticRangeNm,
    logisticDistanceMode,
  ]);

  const productionRows = useMemo(() => {
    const depCoords = getCoords(productionDepartureAirport);
    const hasDeparture = Boolean(depCoords && productionDepartureAirportId);

    const rows = productionPointOptions
      .map((pp) => {
        if (productionPointId && pp.id !== productionPointId) return null;
        if (productionMinStock !== '' && Number(pp?.stock || 0) < Number(productionMinStock)) return null;

        const ppCoords = getCoords(pp);
        if (!ppCoords) return null;

        if (productionDistanceMode === 'arrival' && productionArrivalZoneId) {
          if (!productionPointMatchesZone(pp, productionArrivalZone)) return null;
        }

        let distanceNm = null;
        if (hasDeparture) {
          distanceNm = haversineNm(depCoords.lat, depCoords.lon, ppCoords.lat, ppCoords.lon);
          if (productionDistanceMode === 'range' && distanceNm > productionRangeNm) return null;
        }

        return { pp, distanceNm };
      })
      .filter(Boolean);

    return [...rows].sort((a, b) => {
      if (a.distanceNm != null && b.distanceNm != null) return a.distanceNm - b.distanceNm;
      if (a.distanceNm != null) return -1;
      if (b.distanceNm != null) return 1;
      return getProductionPointSortKey(a.pp) - getProductionPointSortKey(b.pp);
    });
  }, [
    productionPointOptions,
    productionDepartureAirport,
    productionDepartureAirportId,
    productionArrivalZone,
    productionArrivalZoneId,
    productionDistanceMode,
    productionRangeNm,
    productionPointId,
    productionMinStock,
  ]);

  const activeRows = activeTab === 'mission'
    ? missionRows
    : activeTab === 'logistic'
      ? logisticRows
      : productionRows;

  const logisticArrivalMuted = logisticDistanceMode === 'range';
  const logisticRangeMuted = logisticDistanceMode === 'arrival';
  const productionArrivalMuted = productionDistanceMode === 'range';
  const productionRangeMuted = productionDistanceMode === 'arrival';

  const handleReset = () => {
    if (activeTab === 'mission') {
      setAircraftMode('plane');
      setTaskFilter('all');
      setRadiusNm(100);
      setMissionAirportId('');
      return;
    }

    if (activeTab === 'logistic') {
      setLogisticDepartureAirportId('');
      setLogisticArrivalAirportId('');
      setLogisticRangeNm(100);
      setLogisticDistanceMode('range');
      setLogisticAircraft(LOGISTIC_AIRCRAFT[0]);
      setLogisticWeight('');
      return;
    }

    setProductionDepartureAirportId('');
    setProductionArrivalZoneId('');
    setProductionRangeNm(100);
    setProductionDistanceMode('range');
    setProductionPointId('');
    setProductionMinStock('');
  };

  const toggleTaskFilter = (task) => {
    setTaskFilter((current) => (current === task ? 'all' : task));
  };

  const getMissionStatusLabel = (status) => {
    const key = String(status || 'pending').toLowerCase();
    const label = getStatusLabel(key);
    return label === `general.statusLabels.${key}` ? key.toUpperCase() : label.toUpperCase();
  };

  const renderRadiusField = ({
    value,
    onChange,
    muted = false,
    onActivate,
    ariaLabel,
  }) => (
    <div
      className={`map-ops-section__radius-wrap${muted ? ' is-muted' : ''}`}
      onClick={() => {
        if (muted) onActivate?.();
      }}
    >
      <input
        type="number"
        min={1}
        max={9999}
        step={1}
        className="map-ops-section__radius"
        value={value}
        readOnly={muted}
        tabIndex={muted ? -1 : 0}
        onFocus={() => onActivate?.()}
        onChange={(event) => {
          onActivate?.();
          onChange(parseRadiusDigits(event.target.value));
        }}
        aria-label={ariaLabel}
      />
      <span className="map-ops-section__radius-suffix">NM</span>
    </div>
  );

  return (
    <section
      className="map-ops-section"
      aria-label={t('map.rightPanel.ops.ariaLabel')}
      aria-hidden={collapsed}
    >
      <div className="map-ops-section__tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={`map-ops-section__tab map-ops-section__tab--${tab.id}${activeTab === tab.id ? ' is-active' : ''}${tab.id === 'production' ? ' map-ops-section__tab--wide' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="map-ops-section__tab-icon">
                <Icon strokeWidth={2} />
              </span>
              <span className="map-ops-section__tab-label">{t(tab.labelKey)}</span>
            </button>
          );
        })}
      </div>

      <div className="map-ops-section__toolbar">
        {activeTab === 'mission' && (
          <div className="map-ops-section__aircraft">
            <button
              type="button"
              className={`map-ops-section__aircraft-btn${aircraftMode === 'plane' ? ' is-active' : ''}`}
              onClick={() => setAircraftMode('plane')}
              aria-label={t('map.rightPanel.ops.fixedWing')}
            >
              <Plane strokeWidth={2} />
            </button>
            <button
              type="button"
              className={`map-ops-section__aircraft-btn${aircraftMode === 'heli' ? ' is-active' : ''}`}
              onClick={() => setAircraftMode('heli')}
              aria-label={t('map.rightPanel.ops.rotaryWing')}
            >
              <Helicopter strokeWidth={2} />
            </button>
          </div>
        )}

        {activeTab === 'logistic' && (
          <>
            <div className="map-ops-section__select-wrap map-ops-section__select-wrap--brandina">
              <select
                className="map-ops-section__select map-ops-section__select--brandina"
                value={logisticAircraft}
                onChange={(event) => setLogisticAircraft(event.target.value)}
                aria-label={t('map.rightPanel.ops.aircraft')}
              >
                {LOGISTIC_AIRCRAFT.map((aircraft) => (
                  <option key={aircraft} value={aircraft}>
                    {aircraft}
                  </option>
                ))}
              </select>
              <span className="map-ops-section__brandina-value" aria-hidden="true">
                {logisticAircraft}
              </span>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>

            <div className="map-ops-section__weight-wrap">
              <input
                type="number"
                min={0}
                max={999999}
                step={1}
                className="map-ops-section__weight"
                value={logisticWeight}
                onChange={(event) => setLogisticWeight(parseWeightDigits(event.target.value))}
                aria-label={t('map.rightPanel.ops.weight')}
              />
              <span className="map-ops-section__weight-suffix">KG</span>
            </div>
          </>
        )}

        {activeTab === 'mission' && (
          <div className="map-ops-section__task-filters">
            {missionTasks.map((task) => (
              <button
                key={task}
                type="button"
                className={`map-ops-section__pill${taskFilter === task ? ' is-active' : ''}`}
                onClick={() => toggleTaskFilter(task)}
              >
                {task}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'production' && (
          <div className="map-ops-section__stock-wrap">
            <input
              type="number"
              min={0}
              max={99}
              step={1}
              className="map-ops-section__stock"
              value={productionMinStock}
              onChange={(event) => setProductionMinStock(parseStockDigits(event.target.value))}
              aria-label={t('map.rightPanel.ops.minStock')}
            />
            <span className="map-ops-section__stock-suffix">{t('map.rightPanel.ops.stockLabel')}</span>
          </div>
        )}

        {activeTab === 'logistic' ? (
          <div className="map-ops-section__logistic-route map-ops-section__logistic-route--logistic">
            <div className="map-ops-section__select-wrap map-ops-section__select-wrap--departure">
              <TakeoffIcon />
              <select
                className="map-ops-section__select"
                value={logisticDepartureAirportId}
                onChange={(event) => setLogisticDepartureAirportId(event.target.value)}
                aria-label={t('map.rightPanel.ops.departure')}
              >
                <option value="">{t('map.rightPanel.ops.departure')}</option>
                {airportOptions.map((airport) => (
                  <option key={`log-dep-${airport.id}`} value={airport.id}>
                    {getAirportLabel(airport)}
                  </option>
                ))}
              </select>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>

            {renderRadiusField({
              value: logisticRangeNm,
              onChange: setLogisticRangeNm,
              muted: logisticRangeMuted,
              onActivate: () => setLogisticDistanceMode('range'),
              ariaLabel: t('map.rightPanel.ops.radius'),
            })}

            <div
              className={`map-ops-section__select-wrap map-ops-section__select-wrap--arrival${logisticArrivalMuted ? ' is-muted' : ''}`}
              onClick={() => {
                if (logisticArrivalMuted) setLogisticDistanceMode('arrival');
              }}
            >
              <LandingIcon />
              <select
                className="map-ops-section__select"
                value={logisticArrivalAirportId}
                tabIndex={logisticArrivalMuted ? -1 : 0}
                onChange={(event) => {
                  setLogisticDistanceMode('arrival');
                  setLogisticArrivalAirportId(event.target.value);
                }}
                aria-label={t('map.rightPanel.ops.arrival')}
              >
                <option value="">{t('map.rightPanel.ops.arrival')}</option>
                {airportOptions.map((airport) => (
                  <option key={`log-arr-${airport.id}`} value={airport.id}>
                    {getAirportLabel(airport)}
                  </option>
                ))}
              </select>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>
          </div>
        ) : activeTab === 'production' ? (
          <div className="map-ops-section__logistic-route map-ops-section__logistic-route--production">
            <div className="map-ops-section__select-wrap map-ops-section__select-wrap--departure">
              <TakeoffIcon />
              <select
                className="map-ops-section__select"
                value={productionDepartureAirportId}
                onChange={(event) => setProductionDepartureAirportId(event.target.value)}
                aria-label={t('map.rightPanel.ops.departure')}
              >
                <option value="">{t('map.rightPanel.ops.departure')}</option>
                {airportOptions.map((airport) => (
                  <option key={`pp-dep-${airport.id}`} value={airport.id}>
                    {getAirportLabel(airport)}
                  </option>
                ))}
              </select>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>

            {renderRadiusField({
              value: productionRangeNm,
              onChange: setProductionRangeNm,
              muted: productionRangeMuted,
              onActivate: () => setProductionDistanceMode('range'),
              ariaLabel: t('map.rightPanel.ops.radius'),
            })}

            <div className="map-ops-section__select-wrap map-ops-section__select-wrap--brandina map-ops-section__select-wrap--production-point">
              <select
                className="map-ops-section__select map-ops-section__select--brandina"
                value={productionPointId}
                onChange={(event) => setProductionPointId(event.target.value)}
                aria-label={t('map.rightPanel.ops.productionPoint')}
              >
                <option value="">{t('map.rightPanel.ops.productionPoint')}</option>
                {productionPointOptions.map((pp) => (
                  <option key={`pp-filter-${pp.id}`} value={pp.id}>
                    {formatProductionPointCode(pp)}
                  </option>
                ))}
              </select>
              <span className="map-ops-section__brandina-value" aria-hidden="true">
                {selectedProductionPoint
                  ? formatProductionPointCode(selectedProductionPoint)
                  : t('map.rightPanel.ops.productionPoint')}
              </span>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>

            <div
              className={`map-ops-section__select-wrap map-ops-section__select-wrap--arrival map-ops-section__select-wrap--zone${productionArrivalMuted ? ' is-muted' : ''}`}
              onClick={() => {
                if (productionArrivalMuted) setProductionDistanceMode('arrival');
              }}
            >
              <LandingIcon />
              <select
                className="map-ops-section__select map-ops-section__select--zone"
                value={productionArrivalZoneId}
                tabIndex={productionArrivalMuted ? -1 : 0}
                onChange={(event) => {
                  setProductionDistanceMode('arrival');
                  setProductionArrivalZoneId(event.target.value);
                }}
                aria-label={t('map.rightPanel.ops.dropZone')}
              >
                <option value="">{t('map.rightPanel.ops.arrival')}</option>
                {productionDeliveryZones.map((zone) => (
                  <option key={`pp-arr-zone-${zone.id}`} value={zone.id}>
                    {t('map.rightPanel.ops.zone', { number: getZoneNumber(zone) })}
                  </option>
                ))}
              </select>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>
          </div>
        ) : (
          <div className="map-ops-section__select-wrap map-ops-section__select-wrap--airport">
            <TakeoffIcon />
            <select
              className="map-ops-section__select"
              value={missionAirportId}
              onChange={(event) => setMissionAirportId(event.target.value)}
              aria-label={t('map.rightPanel.ops.departure')}
            >
              <option value="">{t('map.rightPanel.ops.departure')}</option>
              {filteredAirportOptions.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {getAirportLabel(airport)}
                </option>
              ))}
            </select>
            <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
          </div>
        )}

        {activeTab === 'mission' && renderRadiusField({
          value: radiusNm,
          onChange: setRadiusNm,
          ariaLabel: t('map.rightPanel.ops.radius'),
        })}

        <button
          type="button"
          className="map-ops-section__reset"
          onClick={handleReset}
          aria-label={t('map.rightPanel.ops.reset')}
        >
          <RotateCcw strokeWidth={2} />
        </button>
      </div>

      <div className="map-ops-section__list">
        {activeRows.length === 0 ? (
          <div className="map-ops-section__row map-ops-section__row--empty">
            <span>{t('map.rightPanel.ops.noResults')}</span>
          </div>
        ) : (
          activeRows.map((row) => {
            if (activeTab === 'mission') {
              if (row.kind === 'csar') {
                return (
                  <button
                    key={`csar-${row.point.id}`}
                    type="button"
                    className="map-ops-section__row"
                    onClick={() => onSelectDcsar?.(row.point)}
                  >
                    <div className="map-ops-section__row-top">
                      <span className="map-ops-section__row-title">
                        {t('map.rightPanel.feedTypes.dcsar')} {row.point.id}
                      </span>
                      <span className="map-ops-section__row-meta">{formatRowDistance(row.distanceNm)}</span>
                    </div>
                    <div className="map-ops-section__row-tags">
                      <span className="map-ops-section__tag">{t('map.rightPanel.feedTypes.dcsar')}</span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={row.zone.id}
                  type="button"
                  className="map-ops-section__row"
                  onClick={() => onSelectZone?.(row.zone.id)}
                >
                  <div className="map-ops-section__row-top">
                    <span className="map-ops-section__row-title">
                      {t('map.rightPanel.ops.zone', { number: getZoneNumber(row.zone) })}
                    </span>
                    <span className="map-ops-section__row-meta">{formatRowDistance(row.distanceNm)}</span>
                  </div>
                  <div className="map-ops-section__row-tags">
                    {row.tasks.map((task) => (
                      <span key={`${row.zone.id}-${task}`} className="map-ops-section__tag">{task}</span>
                    ))}
                  </div>
                </button>
              );
            }

            if (activeTab === 'logistic') {
              if (row.kind === 'airdrop') {
                return (
                  <button
                    key={`airdrop-${row.zone.id}`}
                    type="button"
                    className="map-ops-section__row"
                    onClick={() => onSelectZone?.(row.zone.id)}
                  >
                    <div className="map-ops-section__row-top">
                      <span className="map-ops-section__row-title">
                        {t('map.rightPanel.ops.zone', { number: getZoneNumber(row.zone) })}
                      </span>
                      <span className="map-ops-section__row-meta">{formatRowDistance(row.distanceNm)}</span>
                    </div>
                    <div className="map-ops-section__row-tags">
                      <span className="map-ops-section__tag">{t('map.rightPanel.ops.airdropUnit')}</span>
                    </div>
                  </button>
                );
              }

              return (
                <button
                  key={row.mission.id}
                  type="button"
                  className="map-ops-section__row"
                  onClick={() => onSelectLogisticsMission?.(row.mission)}
                >
                  <div className="map-ops-section__row-top">
                    <span className="map-ops-section__row-title">
                      {getAirportLabel(row.source)} → {getAirportLabel(row.destination)}
                    </span>
                    <span className="map-ops-section__row-meta">{formatRowDistance(row.distanceNm)}</span>
                  </div>
                  <div className="map-ops-section__row-sub">
                    {getMissionStatusLabel(row.mission.status)}
                    {row.mission.weapon_id ? ` • ${row.mission.weapon_id.split('.').pop()}` : ''}
                  </div>
                </button>
              );
            }

            return (
              <button
                key={row.pp.id}
                type="button"
                className="map-ops-section__row"
                onClick={() => onSelectProductionPoint?.(row.pp.id)}
              >
                <div className="map-ops-section__row-top">
                  <span className="map-ops-section__row-title">{formatProductionPointCode(row.pp)}</span>
                  <span className="map-ops-section__row-meta">{formatNm(row.distanceNm)}</span>
                </div>
                <div className="map-ops-section__row-sub">
                  {row.pp.owner || t('map.rightPanel.ops.neutral')} • {t('map.rightPanel.ops.stock', { count: Number(row.pp.stock || 0) })}
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
