import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { t } from '../../utils/locale';
import './ZoneMissionCard.css';

const STATUS_FILTERS = ['all', 'BLUE', 'RED', 'NEUTRAL', 'UNDER_ATTACK'];

function formatShortRelativeTime(timestamp) {
  if (!timestamp) return '—';
  const deltaMs = Math.max(0, Date.now() - timestamp);
  const totalMinutes = Math.floor(deltaMs / 60000);
  if (totalMinutes < 1) return t('map.rightPanel.timeAgo.justNow');
  if (totalMinutes < 60) return t('map.rightPanel.timeAgo.minutes', { count: totalMinutes });
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return t('map.rightPanel.timeAgo.hours', { count: hours });
  return t('map.rightPanel.timeAgo.days', { count: Math.floor(hours / 24) });
}

function statusTone(status) {
  const value = String(status || 'NEUTRAL').toUpperCase();
  if (value === 'BLUE') return 'blue';
  if (value === 'RED') return 'red';
  if (value === 'UNDER_ATTACK') return 'attack';
  return 'neutral';
}

function formatStatusLabel(status) {
  const tone = statusTone(status);
  return t(`map.rightPanel.zoneCard.status.${tone}`);
}

function formatCardDms(dms) {
  if (!dms || dms === '-') return dms || '—';
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
  return (
    <span
      className={`zone-mission-card__dot zone-mission-card__dot--${statusTone(filterId)}`}
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
  const [openMenu, setOpenMenu] = useState(null);
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
  const ownerTone = statusTone(zone.status);

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
      className={`zone-mission-card${anyMenuOpen ? ' is-menu-open' : ''}`}
      aria-label={t('map.rightPanel.ops.zone', { number: zoneNumber })}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="zone-mission-card__head" ref={headerControlsRef}>
        <div className="zone-mission-card__identity">
          <span className={`zone-mission-card__type zone-mission-card__type--${ownerTone}`}>
            {formatStatusLabel(zone.status)}
          </span>
          <div className="zone-mission-card__zone-select">
            <button
              type="button"
              className={`zone-mission-card__zone-trigger${zoneOpen ? ' is-open' : ''}`}
              aria-label={t('map.rightPanel.zoneCard.selectZone')}
              aria-haspopup="listbox"
              aria-expanded={zoneOpen}
              onClick={() => toggleMenu('zone')}
            >
              <span className="zone-mission-card__name">
                {t('map.rightPanel.ops.zone', { number: zoneNumber })}
              </span>
              <ChevronDown size={14} strokeWidth={2.4} aria-hidden="true" />
            </button>

            {zoneOpen && (
              <ul className="zone-mission-card__menu zone-mission-card__menu--zone" role="listbox" aria-label={t('map.rightPanel.zoneCard.selectZone')}>
                {selectZones.map((entry) => {
                  const selected = entry.id === zone.id;
                  return (
                    <li key={entry.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={`zone-mission-card__menu-option${selected ? ' is-selected' : ''}`}
                        onClick={() => handleSelectZone(entry.id)}
                      >
                        <span className={`zone-mission-card__dot zone-mission-card__dot--${statusTone(entry.status)}`} aria-hidden="true" />
                        <span>{t('map.rightPanel.ops.zone', { number: entry.zoneNumber })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="zone-mission-card__tools">
          <div className="zone-mission-card__filter">
            <button
              type="button"
              className={`zone-mission-card__icon-btn${filterOpen ? ' is-open' : ''}`}
              aria-label={t('map.rightPanel.zoneCard.filterAria')}
              aria-haspopup="listbox"
              aria-expanded={filterOpen}
              onClick={() => toggleMenu('filter')}
            >
              <StatusFilterSwatch filterId={statusFilter} />
            </button>

            {filterOpen && (
              <ul className="zone-mission-card__menu zone-mission-card__menu--filter" role="listbox" aria-label={t('map.rightPanel.zoneCard.filterAria')}>
                {STATUS_FILTERS.map((option) => {
                  const selected = statusFilter === option;
                  return (
                    <li key={option} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        className={`zone-mission-card__menu-option${selected ? ' is-selected' : ''}`}
                        onClick={() => handleStatusFilterSelect(option)}
                      >
                        <StatusFilterSwatch filterId={option} />
                        <span>{t(`map.rightPanel.zoneCard.filter.${option}`)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            className="zone-mission-card__icon-btn"
            aria-label={t('map.rightPanel.closeSidebar')}
            onClick={onClose}
          >
            <X size={16} strokeWidth={2.2} />
          </button>
        </div>
      </header>

      <div className="zone-mission-card__body">
        <dl className="zone-mission-card__meta">
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.owner')}</dt>
            <dd className={`zone-mission-card__meta-value zone-mission-card__meta-value--${ownerTone}`}>
              {formatStatusLabel(zone.status)}
            </dd>
          </div>
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.lastChange')}</dt>
            <dd>{formatShortRelativeTime(changedAt)}</dd>
          </div>
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.dms')}</dt>
            <dd className="zone-mission-card__meta-coords">{formatCardDms(coordinatesDms)}</dd>
          </div>
          <div className="zone-mission-card__meta-row">
            <dt>{t('map.rightPanel.zoneCard.mgrs')}</dt>
            <dd className="zone-mission-card__meta-coords">{coordinatesMgrs || '—'}</dd>
          </div>
        </dl>

        <div className="zone-mission-card__section">
          <p className="zone-mission-card__section-title">{t('map.rightPanel.zoneCard.task')}</p>
          <div className="zone-mission-card__tags">
            {tasks.length > 0 ? tasks.map((task) => (
              <span key={task} className="zone-mission-card__tag">{task}</span>
            )) : (
              <span className="zone-mission-card__tag is-empty">{t('map.rightPanel.zoneCard.noTasks')}</span>
            )}
          </div>
        </div>

        <div className="zone-mission-card__section">
          <p className="zone-mission-card__section-title">{t('map.rightPanel.zoneCard.surrounded')}</p>
          <div className="zone-mission-card__tags">
            {neighborZones.length > 0 ? neighborZones.map((neighbor) => (
              <span key={neighbor.id} className="zone-mission-card__tag">
                {t('map.rightPanel.ops.zone', { number: neighbor.zoneNumber })}
              </span>
            )) : (
              <span className="zone-mission-card__tag is-empty">—</span>
            )}
          </div>
        </div>

        <div className="zone-mission-card__footer">
          {acceptedByCurrentUser ? (
            <button
              type="button"
              className="zone-mission-card__action zone-mission-card__action--decline"
              disabled={declining || accepting}
              onClick={() => onDecline?.(zone)}
            >
              {declining ? t('map.rightPanel.zoneCard.declining') : t('map.rightPanel.zoneCard.decline')}
            </button>
          ) : (
            <button
              type="button"
              className="zone-mission-card__action zone-mission-card__action--accept"
              disabled={acceptDisabled}
              onClick={() => onAccept?.(zone)}
            >
              {accepting ? t('map.rightPanel.zoneCard.accepting') : t('map.rightPanel.zoneCard.accept')}
            </button>
          )}

          {!hasTasks && (
            <p className="zone-mission-card__hint">{t('map.rightPanel.zoneCard.hintNoTasks')}</p>
          )}
          {hasTasks && acceptedByOther && (
            <p className="zone-mission-card__hint">{t('map.rightPanel.zoneCard.hintAssigned')}</p>
          )}
          {hasTasks && !acceptedByCurrentUser && !canAcceptMore && (
            <p className="zone-mission-card__hint">{t('map.rightPanel.zoneCard.hintLimit')}</p>
          )}
        </div>
      </div>
    </section>
  );
}
