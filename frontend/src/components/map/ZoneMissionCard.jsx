import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import './ZoneMissionCard.css';

const STATUS_FILTERS = [
  { id: 'all', label: 'All zones' },
  { id: 'BLUE', label: 'Blue zones' },
  { id: 'RED', label: 'Red zones' },
  { id: 'NEUTRAL', label: 'Neutral zones' },
  { id: 'UNDER_ATTACK', label: 'Under attack' },
];

function formatShortRelativeTime(timestamp) {
  if (!timestamp) return '-';
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const totalMinutes = Math.floor(deltaMs / 60000);
  if (totalMinutes < 1) return '<1min';
  if (totalMinutes < 60) return `${totalMinutes}min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function getOwnerClass(status) {
  if (status === 'BLUE') return 'zone-mission-card__meta-value--blue';
  if (status === 'RED') return 'zone-mission-card__meta-value--red';
  if (status === 'UNDER_ATTACK') return 'zone-mission-card__meta-value--attack';
  return '';
}

function getDotClass(status) {
  if (status === 'BLUE') return 'zone-mission-card__dot--blue';
  if (status === 'RED') return 'zone-mission-card__dot--red';
  if (status === 'UNDER_ATTACK') return 'zone-mission-card__dot--attack';
  return 'zone-mission-card__dot--neutral';
}

function formatCardDms(dms) {
  if (!dms || dms === '-') return dms;
  // Two non-breaking spaces so HTML does not collapse the gap.
  return String(dms).replace(', ', '\u00A0\u00A0');
}

function zoneMatchesStatusFilter(zone, statusFilter) {
  if (!statusFilter || statusFilter === 'all') return true;
  const status = String(zone?.status || 'NEUTRAL').toUpperCase();
  if (statusFilter === 'NEUTRAL') {
    return status === 'NEUTRAL' || (!['BLUE', 'RED', 'UNDER_ATTACK'].includes(status));
  }
  return status === statusFilter;
}

function StatusFilterSwatch({ filterId }) {
  if (filterId === 'all') {
    return <span className="zone-mission-card__chip-ring" aria-hidden="true" />;
  }
  if (filterId === 'NEUTRAL') {
    return <span className="zone-mission-card__dot zone-mission-card__dot--filter-neutral" aria-hidden="true" />;
  }
  return (
    <span
      className={`zone-mission-card__dot ${getDotClass(filterId)}`}
      aria-hidden="true"
    />
  );
}

export default function ZoneMissionCard({
  zone,
  zones = [],
  neighborZones = [],
  changedAt,
  zoneNumber,
  coordinatesDms,
  coordinatesMgrs,
  acceptedByCurrentUser = false,
  acceptedByOther = false,
  hasTasks = false,
  canAcceptMore = true,
  accepting = false,
  declining = false,
  activeZoneId = null,
  onSelectZone,
  onAccept,
  onDecline,
  onClose,
}) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [openMenu, setOpenMenu] = useState(null); // 'filter' | 'zone' | null
  const headerControlsRef = useRef(null);
  const lastDropdownZoneIdRef = useRef(null);
  const prevActiveZoneIdRef = useRef(activeZoneId);

  const filterOpen = openMenu === 'filter';
  const zoneOpen = openMenu === 'zone';
  const anyMenuOpen = openMenu != null;

  useEffect(() => {
    if (!anyMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!headerControlsRef.current?.contains(event.target)) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anyMenuOpen]);

  // Map click can select any zone; if the committed selection changes to a zone
  // outside the active filter, clear the filter. Ignore filter-driven selection.
  useEffect(() => {
    const prevId = prevActiveZoneIdRef.current;
    prevActiveZoneIdRef.current = activeZoneId;
    if (!activeZoneId || activeZoneId === prevId) return;
    if (lastDropdownZoneIdRef.current === activeZoneId) return;

    setStatusFilter((current) => {
      if (current === 'all') return current;
      const activeZone = zones.find((entry) => entry.id === activeZoneId);
      if (activeZone && !zoneMatchesStatusFilter(activeZone, current)) {
        setOpenMenu(null);
        return 'all';
      }
      return current;
    });
  }, [activeZoneId, zones]);

  const filteredZones = useMemo(
    () => zones.filter((entry) => zoneMatchesStatusFilter(entry, statusFilter)),
    [zones, statusFilter],
  );

  // Include current zone if parent has not switched yet after a filter change.
  const selectZones = useMemo(() => {
    if (!zone?.id) return filteredZones;
    if (filteredZones.some((entry) => entry.id === zone.id)) return filteredZones;
    return [zone, ...filteredZones];
  }, [filteredZones, zone]);

  if (!zone) return null;

  const tasks = Array.isArray(zone.tasks) ? zone.tasks.filter(Boolean) : [];
  const acceptDisabled = (
    accepting
    || declining
    || !hasTasks
    || acceptedByCurrentUser
    || acceptedByOther
    || !canAcceptMore
  );

  const handleSelectZone = (zoneId) => {
    lastDropdownZoneIdRef.current = zoneId;
    setOpenMenu(null);
    onSelectZone?.(zoneId);
  };

  const handleStatusFilterSelect = (nextFilter) => {
    setStatusFilter(nextFilter);
    setOpenMenu(null);

    const matches = zones.filter((entry) => zoneMatchesStatusFilter(entry, nextFilter));
    if (matches.length === 0) return;

    // Always jump to the first zone of the chosen status (sorted list).
    const nextZoneId = matches[0].id;
    lastDropdownZoneIdRef.current = nextZoneId;
    if (zone?.id !== nextZoneId) {
      onSelectZone?.(nextZoneId);
    }
  };

  const toggleMenu = (menu) => {
    setOpenMenu((current) => (current === menu ? null : menu));
  };

  return (
    <section
      className={`zone-mission-card${anyMenuOpen ? ' zone-mission-card--menu-open' : ''}`}
      aria-label={`Zone ${zoneNumber} mission card`}
    >
      <div className="zone-mission-card__header" ref={headerControlsRef}>
        <div className="zone-mission-card__filter">
          <button
            type="button"
            className={`zone-mission-card__header-chip${filterOpen ? ' is-open' : ''}`}
            aria-label="Filter zones by status"
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            onClick={() => toggleMenu('filter')}
          >
            <StatusFilterSwatch filterId={statusFilter} />
            <ChevronDown strokeWidth={3} className="zone-mission-card__chip-chevron" aria-hidden="true" />
          </button>

          {filterOpen && (
            <ul className="zone-mission-card__menu zone-mission-card__menu--filter" role="listbox" aria-label="Zone status filter">
              {STATUS_FILTERS.map((option) => {
                const selected = statusFilter === option.id;
                return (
                  <li key={option.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      className={`zone-mission-card__menu-option${selected ? ' is-selected' : ''}`}
                      onClick={() => handleStatusFilterSelect(option.id)}
                    >
                      <StatusFilterSwatch filterId={option.id} />
                      <span className="zone-mission-card__menu-option-label">{option.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="zone-mission-card__zone-select">
          <button
            type="button"
            className={`zone-mission-card__zone-trigger${zoneOpen ? ' is-open' : ''}`}
            aria-label="Select zone"
            aria-haspopup="listbox"
            aria-expanded={zoneOpen}
            onClick={() => toggleMenu('zone')}
          >
            <span className="zone-mission-card__zone-trigger-label">ZONE {zoneNumber}</span>
            <ChevronDown strokeWidth={3} className="zone-mission-card__chip-chevron" aria-hidden="true" />
          </button>

          {zoneOpen && (
            <ul className="zone-mission-card__menu zone-mission-card__menu--zone" role="listbox" aria-label="Select zone">
              {selectZones.map((entry) => {
                const selected = entry.id === zone.id;
                return (
                  <li key={entry.id} role="option" aria-selected={selected}>
                    <button
                      type="button"
                      className={`zone-mission-card__menu-option${selected ? ' is-selected' : ''}`}
                      onClick={() => handleSelectZone(entry.id)}
                    >
                      <span className="zone-mission-card__menu-option-label">ZONE {entry.zoneNumber}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <button
          type="button"
          className="zone-mission-card__close"
          aria-label="Close"
          title="Close"
          onClick={onClose}
        >
          <X strokeWidth={2.5} />
        </button>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__meta">
        <div className="zone-mission-card__meta-col">
          <p className="zone-mission-card__meta-line">
            Owner:{' '}
            <span className={`zone-mission-card__meta-value ${getOwnerClass(zone.status)}`}>
              {zone.status || '-'}
            </span>
          </p>
          <p className="zone-mission-card__meta-line">
            Last Change:{' '}
            <span className="zone-mission-card__meta-value">{formatShortRelativeTime(changedAt)}</span>
          </p>
        </div>
        <div className="zone-mission-card__meta-col zone-mission-card__meta-col--coords">
          <p className="zone-mission-card__meta-line">
            <span className="zone-mission-card__meta-label">Coordinate DMS:</span>{' '}
            <span className="zone-mission-card__meta-value">{formatCardDms(coordinatesDms)}</span>
          </p>
          <p className="zone-mission-card__meta-line">
            <span className="zone-mission-card__meta-label">Coordinate MGRS:</span>{' '}
            <span className="zone-mission-card__meta-value">{coordinatesMgrs}</span>
          </p>
        </div>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__section">
        <p className="zone-mission-card__section-title">Task</p>
        <div className="zone-mission-card__pills zone-mission-card__pills--task">
          {tasks.length > 0 ? tasks.map((task) => (
            <span key={task} className="zone-mission-card__pill">{task}</span>
          )) : (
            <span className="zone-mission-card__pill zone-mission-card__pill--empty">No tasks</span>
          )}
        </div>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__section">
        <p className="zone-mission-card__section-title">Surrounded</p>
        <div className="zone-mission-card__pills zone-mission-card__pills--neighbor">
          {neighborZones.length > 0 ? neighborZones.map((neighbor) => (
            <span key={neighbor.id} className="zone-mission-card__pill">
              ZONE {neighbor.zoneNumber}
            </span>
          )) : (
            <span className="zone-mission-card__pill zone-mission-card__pill--empty">-</span>
          )}
        </div>
      </div>

      <div className="zone-mission-card__divider" />

      <div className="zone-mission-card__footer">
        {acceptedByCurrentUser ? (
          <button
            type="button"
            className="zone-mission-card__action zone-mission-card__action--decline"
            disabled={declining || accepting}
            onClick={() => onDecline?.(zone)}
          >
            {declining ? 'Declining...' : 'Decline Mission'}
          </button>
        ) : (
          <button
            type="button"
            className="zone-mission-card__action zone-mission-card__action--accept"
            disabled={acceptDisabled}
            onClick={() => onAccept?.(zone)}
          >
            {accepting ? 'Accepting...' : 'Accept Mission'}
          </button>
        )}

        {!hasTasks && (
          <p className="zone-mission-card__hint">This zone has no available tasks.</p>
        )}
        {hasTasks && acceptedByOther && (
          <p className="zone-mission-card__hint">This zone is currently assigned to another pilot.</p>
        )}
        {hasTasks && !acceptedByCurrentUser && !canAcceptMore && (
          <p className="zone-mission-card__hint">You can accept at most 2 zones.</p>
        )}
      </div>
    </section>
  );
}
