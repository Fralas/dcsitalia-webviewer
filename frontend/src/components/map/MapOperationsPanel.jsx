import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Factory, Forklift, Helicopter, MapPin, Plane, RotateCcw } from 'lucide-react';
import {
  distanceToRouteNm,
  getAirportLabel,
  getCoords,
  haversineNm,
} from '../../utils/mapGeo';
import { getStatusLabel, t } from '../../utils/locale';
import './MapOperationsPanel.css';

const MISSION_TASKS = ['CAS', 'DEAD', 'SEAD'];
const TABS = [
  { id: 'mission', labelKey: 'map.rightPanel.ops.tabs.mission', icon: MapPin },
  { id: 'logistic', labelKey: 'map.rightPanel.ops.tabs.logistic', icon: Forklift },
  { id: 'production', labelKey: 'map.rightPanel.ops.tabs.production', icon: Factory },
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

export default function MapOperationsPanel({
  language = 'en',
  collapsed = false,
  zones = [],
  combatMissionByZone,
  logisticsMissions = [],
  productionPoints = [],
  airports = [],
  onSelectZone,
  onSelectLogisticsMission,
  onSelectProductionPoint,
}) {
  void language;

  const [activeTab, setActiveTab] = useState('mission');
  const [aircraftMode, setAircraftMode] = useState('plane');
  const [taskFilter, setTaskFilter] = useState('all');
  const [radiusNm, setRadiusNm] = useState(100);
  const [missionAirportId, setMissionAirportId] = useState('');
  const [logisticAirportId, setLogisticAirportId] = useState('');
  const [departureAirportId, setDepartureAirportId] = useState('');
  const [arrivalAirportId, setArrivalAirportId] = useState('');

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

  useEffect(() => {
    if (missionAirportId && !airportOptions.some((entry) => entry.id === missionAirportId)) {
      setMissionAirportId('');
    }
    if (logisticAirportId && !airportOptions.some((entry) => entry.id === logisticAirportId)) {
      setLogisticAirportId('');
    }

    if (departureAirportId && !airportOptions.some((entry) => entry.id === departureAirportId)) {
      setDepartureAirportId('');
    }
    if (arrivalAirportId && !airportOptions.some((entry) => entry.id === arrivalAirportId)) {
      setArrivalAirportId('');
    }
  }, [airportOptions, missionAirportId, logisticAirportId, departureAirportId, arrivalAirportId]);

  const missionAirport = useMemo(
    () => airportOptions.find((entry) => entry.id === missionAirportId) || null,
    [airportOptions, missionAirportId],
  );

  const logisticAirport = useMemo(
    () => airportOptions.find((entry) => entry.id === logisticAirportId) || null,
    [airportOptions, logisticAirportId],
  );

  const missionRows = useMemo(() => {
    const airportCoords = getCoords(missionAirport);
    if (!airportCoords || !missionAirportId) return [];

    return zones
      .map((zone) => {
        const zoneCoords = getCoords(zone);
        if (!zoneCoords) return null;
        const tasks = getZoneTasks(zone, combatMissionByZone);
        if (tasks.length === 0) return null;
        const distanceNm = haversineNm(
          airportCoords.lat,
          airportCoords.lon,
          zoneCoords.lat,
          zoneCoords.lon,
        );
        if (distanceNm > radiusNm) return null;
        if (taskFilter !== 'all' && !tasks.includes(taskFilter)) return null;
        return { zone, tasks, distanceNm };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceNm - b.distanceNm);
  }, [zones, combatMissionByZone, missionAirport, missionAirportId, radiusNm, taskFilter]);

  const logisticRows = useMemo(() => {
    const arrivalCoords = getCoords(logisticAirport);
    if (!arrivalCoords || !logisticAirportId) return [];

    return logisticsMissions
      .map((mission) => {
        if (String(mission.airport_id) !== String(logisticAirportId)) return null;

        const source = airports.find((entry) => entry.id === mission.source_airport_id);
        const destination = logisticAirport;
        const sourceCoords = getCoords(source);
        if (!sourceCoords) return null;

        const distanceNm = haversineNm(
          sourceCoords.lat,
          sourceCoords.lon,
          arrivalCoords.lat,
          arrivalCoords.lon,
        );
        if (distanceNm > radiusNm) return null;

        return {
          mission,
          source,
          destination,
          distanceNm,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceNm - b.distanceNm);
  }, [logisticsMissions, airports, logisticAirport, logisticAirportId, radiusNm]);

  const productionRows = useMemo(() => {
    if (!departureAirportId || !arrivalAirportId) return [];

    const departure = airports.find((entry) => entry.id === departureAirportId);
    const arrival = airports.find((entry) => entry.id === arrivalAirportId);
    const depCoords = getCoords(departure);
    const arrCoords = getCoords(arrival);
    if (!depCoords || !arrCoords) return [];

    return productionPoints
      .map((pp) => {
        const ppCoords = getCoords(pp);
        if (!ppCoords) return null;
        const distanceNm = distanceToRouteNm(ppCoords, depCoords, arrCoords);
        if (distanceNm > radiusNm) return null;
        return { pp, distanceNm };
      })
      .filter(Boolean)
      .sort((a, b) => a.distanceNm - b.distanceNm);
  }, [productionPoints, airports, departureAirportId, arrivalAirportId, radiusNm]);

  const activeRows = activeTab === 'mission'
    ? missionRows
    : activeTab === 'logistic'
      ? logisticRows
      : productionRows;

  const handleReset = () => {
    setTaskFilter('all');
    setRadiusNm(100);
    setMissionAirportId('');
    setLogisticAirportId('');
    setDepartureAirportId('');
    setArrivalAirportId('');
  };

  const toggleTaskFilter = (task) => {
    setTaskFilter((current) => (current === task ? 'all' : task));
  };

  const getMissionStatusLabel = (status) => {
    const key = String(status || 'pending').toLowerCase();
    const label = getStatusLabel(key);
    return label === `general.statusLabels.${key}` ? key.toUpperCase() : label.toUpperCase();
  };

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
              className={`map-ops-section__tab${activeTab === tab.id ? ' is-active' : ''}${tab.id === 'production' ? ' map-ops-section__tab--wide' : ''}`}
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
        {activeTab !== 'production' && (
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

        {activeTab === 'mission' && (
          <div className="map-ops-section__task-filters">
            {MISSION_TASKS.map((task) => (
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

        {activeTab === 'production' ? (
          <div className="map-ops-section__route-selects">
            <div className="map-ops-section__select-wrap">
              <select
                className="map-ops-section__select"
                value={departureAirportId}
                onChange={(event) => setDepartureAirportId(event.target.value)}
                aria-label={t('map.rightPanel.ops.departure')}
              >
                <option value="">{t('map.rightPanel.ops.departure')}</option>
                {airportOptions.map((airport) => (
                  <option key={`dep-${airport.id}`} value={airport.id}>
                    {getAirportLabel(airport)}
                  </option>
                ))}
              </select>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>
            <div className="map-ops-section__select-wrap">
              <select
                className="map-ops-section__select"
                value={arrivalAirportId}
                onChange={(event) => setArrivalAirportId(event.target.value)}
                aria-label={t('map.rightPanel.ops.arrival')}
              >
                <option value="">{t('map.rightPanel.ops.arrival')}</option>
                {airportOptions.map((airport) => (
                  <option key={`arr-${airport.id}`} value={airport.id}>
                    {getAirportLabel(airport)}
                  </option>
                ))}
              </select>
              <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
            </div>
          </div>
        ) : (
          <div className="map-ops-section__select-wrap map-ops-section__select-wrap--airport">
            <select
              className="map-ops-section__select"
              value={activeTab === 'mission' ? missionAirportId : logisticAirportId}
              onChange={(event) => {
                if (activeTab === 'mission') {
                  setMissionAirportId(event.target.value);
                } else {
                  setLogisticAirportId(event.target.value);
                }
              }}
              aria-label={activeTab === 'mission'
                ? t('map.rightPanel.ops.departure')
                : t('map.rightPanel.ops.arrival')}
            >
              <option value="">
                {activeTab === 'mission'
                  ? t('map.rightPanel.ops.departure')
                  : t('map.rightPanel.ops.arrival')}
              </option>
              {filteredAirportOptions.map((airport) => (
                <option key={airport.id} value={airport.id}>
                  {getAirportLabel(airport)}
                </option>
              ))}
            </select>
            <ChevronDown className="map-ops-section__select-chevron" strokeWidth={2.5} />
          </div>
        )}

        <div className="map-ops-section__radius-wrap">
          <input
            type="number"
            min={1}
            max={999}
            step={1}
            className="map-ops-section__radius"
            value={radiusNm}
            onChange={(event) => setRadiusNm(Math.max(1, Number(event.target.value) || 1))}
            aria-label={t('map.rightPanel.ops.radius')}
          />
          <span className="map-ops-section__radius-suffix">NM</span>
        </div>

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
                    <span className="map-ops-section__row-meta">{formatNm(row.distanceNm)}</span>
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
                    <span className="map-ops-section__row-meta">{formatNm(row.distanceNm)}</span>
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
                  <span className="map-ops-section__row-title">{row.pp.zone_name || row.pp.id}</span>
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
