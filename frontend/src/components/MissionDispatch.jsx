import { useState, useEffect, useRef } from 'react';
import { Plane, Helicopter, Clock, User, CheckCircle, XCircle, Package, LogIn, ChevronDown, ChevronUp, Map } from 'lucide-react';
import * as api from '../services/api';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';
import { formatWeight } from '../utils/weightFormatter';
import { t, formatElapsedTime, formatRemainingTime, getStatusLabel } from '../utils/locale';
import { useUser } from '../contexts/UserContext';
import { buildIsoContainerPlan, formatIsoUnits } from '../utils/isoLoad';
import MapView from './MapView';

/**
 * Get weapon display name
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

function getMissionOrders(mission) {
  if (Array.isArray(mission.orders) && mission.orders.length > 0) {
    return mission.orders;
  }

  if (mission.weapon_id) {
    return [{
      weapon_id: mission.weapon_id,
      quantity_needed: mission.quantity_needed,
      current_quantity: mission.current_quantity,
      total_weight_lbs: mission.total_weight_lbs,
      priority: mission.priority,
    }];
  }

  return [];
}

function getMissionPriority(mission) {
  if (mission.priority) return mission.priority;
  const orders = getMissionOrders(mission);
  const priorities = orders.map(order => order.priority).filter(Boolean);
  if (priorities.length === 0) return 'medium';
  if (priorities.includes('critical')) return 'critical';
  if (priorities.includes('high')) return 'high';
  if (priorities.includes('medium')) return 'medium';
  return 'ok';
}

function getMissionTotals(mission) {
  const orders = getMissionOrders(mission);
  const totalWeight = Number.isFinite(mission.total_weight_lbs)
    ? mission.total_weight_lbs
    : orders.reduce((sum, order) => sum + (order.total_weight_lbs || 0), 0);
  const totalIsoUnits = Number.isFinite(mission.total_iso_units)
    ? mission.total_iso_units
    : orders.reduce((sum, order) => sum + (order.iso_units || 0), 0);

  return { orders, totalWeight, totalIsoUnits };
}

function getMissionTitle(orders) {
  if (orders.length === 0) return 'Missione';
  if (orders.length === 1) return getWeaponDisplayName(orders[0].weapon_id);
  return `${getWeaponDisplayName(orders[0].weapon_id)} +${orders.length - 1}`;
}

function getIsoSummary(isoPlan, translate) {
  const isoCount = isoPlan.containers.filter(container => !container.small && container.used > 0).length;
  const smallCount = isoPlan.containers.filter(container => container.small && container.used > 0).length;

  if (isoCount === 0 && smallCount === 0) {
    return translate('missionDispatch.iso.emptySummary');
  }

  const parts = [];
  if (isoCount > 0) {
    parts.push(`${isoCount} ${translate('missionDispatch.iso.containerShort')}`);
  }
  if (smallCount > 0) {
    parts.push(`${smallCount} ${translate('missionDispatch.iso.containerSmallShort')}`);
  }

  return parts.join(' + ');
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

function getLocationColorClass(airport) {
  if (!airport) return 'text-yt-text-primary';
  if (airport.isMainBase) return 'text-fuchsia-400';
  if (airport.isHeliport) return 'text-cyan-400';
  return 'text-yt-accent';
}

/**
 * Get priority badge
 */
function PriorityBadge({ priority }) {
  let color, text;
  if (priority === 'critical') {
    color = 'bg-red-400/20 text-red-400 border-red-400';
    text = getStatusLabel('critical');
  } else if (priority === 'high') {
    color = 'bg-orange-500/20 text-orange-400 border-orange-500';
    text = getStatusLabel('high');
  } else {
    color = 'bg-yellow-400/20 text-yellow-400 border-yellow-400';
    text = getStatusLabel('medium');
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold border ${color}`}>
      {text}
    </span>
  );
}

/**
 * Login Required Modal
 */
function LoginRequiredModal({ onClose, onLogin }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="relative bg-yt-bg-secondary border-2 border-yt-accent rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-blue-400" />
          </div>

          <h3 className="text-xl font-bold text-yt-text-primary mb-2">
            Autenticazione Richiesta
          </h3>

          <p className="text-yt-text-secondary mb-6">
            Per accettare una missione devi essere autenticato con il tuo account Discord.
          </p>

          <div className="flex gap-3">
            <button
              onClick={onLogin}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              Login con Discord
            </button>

            <button
              onClick={onClose}
              className="px-4 py-3 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded font-medium transition-all"
            >
              Annulla
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Mission Card Component
 */
function MissionCard({ mission, airports, onUpdate, isHighlighted, user, onStatsUpdate }) {
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const cardRef = useRef(null);

  const airport = airports.find(a => a.id === mission.airport_id);
  const sourceAirport = mission.source_airport_id ? airports.find(a => a.id === mission.source_airport_id) : null;
  const timeAgo = getTimeAgo(mission.created_at);
  const expiresIn = getTimeRemaining(mission.expires_at);
  const isHeliport = airport?.isHeliport || false;
  const missionPriority = getMissionPriority(mission);
  const { orders, totalWeight } = getMissionTotals(mission);
  const isoPlan = buildIsoContainerPlan(orders);
  const sourceName = sourceAirport?.displayName || getAirportName(mission.source_airport_id) || t('airportCard.baseLabel');
  const destinationName = airport?.displayName || airport?.name || t('general.unknown');
  const sourceColor = getLocationColorClass(sourceAirport);
  const destinationColor = getLocationColorClass(airport);
  const weightLabel = totalWeight > 0 ? formatWeight(totalWeight) : '-';

  // Scroll to and highlight this card when isHighlighted is true
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      // Small delay to ensure the element is rendered
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [isHighlighted]);

  const handleAccept = async () => {
    // Controlla se l'utente è autenticato
    if (!user) {
      setShowLoginModal(true);
      return;
    }

    // Usa il nome Discord dell'utente
    const userName = user.globalName || user.username;

    setLoading(true);
    try {
      await api.acceptMission(mission.id, userName);
      onUpdate();
    } catch (error) {
      alert(t('airportCard.alerts.acceptError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  const handleComplete = async () => {
    if (!confirm(t('general.prompts.confirmComplete'))) return;

    setLoading(true);
    try {
      await api.completeMission(mission.id);
      onUpdate();
      if (user) {
        onStatsUpdate({ ordersCompleted: orders.length || 1 });
      }
    } catch (error) {
      alert(t('airportCard.alerts.completeError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm(t('general.prompts.confirmCancel'))) return;

    setLoading(true);
    try {
      await api.cancelMission(mission.id);
      onUpdate();
    } catch (error) {
      alert(t('airportCard.alerts.cancelError', { message: error.message }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={cardRef}
      className={`bg-yt-bg-secondary rounded-lg border-2 p-2 transition-all duration-300 hover:border-yt-border ${
        mission.status === 'accepted' ? 'border-yt-accent/50' : 'border-yt-border'
      } ${
        isHighlighted ? 'ring-4 ring-fuchsia-400 shadow-lg shadow-fuchsia-400/50 scale-[1.02]' : ''
      }`}
    >
      {/* Route title */}
      <div className="bg-yt-bg-tertiary rounded p-2 mb-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-yt-text-primary">
            <span className={sourceColor}>{sourceName}</span>
            <span className="text-yt-text-secondary"> → </span>
            <span className={destinationColor}>{destinationName}</span>
          </h3>
          <PriorityBadge priority={missionPriority} />
        </div>
        <div className="text-[11px] text-yt-text-secondary font-mono mt-1">{weightLabel}</div>
        <div className="flex items-center gap-2 text-xs text-yt-text-secondary mt-1">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeAgo}</span>
        </div>
      </div>

      {/* Cargo summary removed */}

      {/* ISO container plan */}
      <div className="bg-yt-bg-tertiary rounded p-2 mb-2 text-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-yt-text-secondary">{t('missionDispatch.iso.title')}</span>
          <span className="text-yt-text-primary font-medium">{getIsoSummary(isoPlan, t)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {isoPlan.containers.map(container => {
            const fillPercent = container.capacity > 0 ? Math.min(100, (container.used / container.capacity) * 100) : 0;
            return (
              <div key={container.id} className="bg-yt-bg-secondary rounded border border-yt-border p-2">
                <div className="flex items-center justify-between text-[10px] text-yt-text-secondary mb-1">
                  <span>{container.small ? t('missionDispatch.iso.containerSmall') : t('missionDispatch.iso.container')}</span>
                  <span className="font-mono">{formatIsoUnits(container.used)} / {formatIsoUnits(container.capacity)}</span>
                </div>
                <div className="h-1.5 bg-yt-border/40 rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-yt-accent" style={{ width: `${fillPercent}%` }}></div>
                </div>
                {container.items.length === 0 ? (
                  <div className="text-[10px] text-yt-text-secondary">{t('missionDispatch.iso.empty')}</div>
                ) : (
                  <div className="space-y-1">
                    {container.items.map((item, idx) => {
                      const qty = getItemQuantity(item);
                      return (
                        <div key={`${item.weapon_id}-${idx}`} className="flex items-center justify-between text-[10px]">
                          <span className="text-yt-text-primary font-mono">{getWeaponDisplayName(item.weapon_id)}</span>
                          <span className="text-yt-text-secondary font-mono">{qty !== null ? `x${qty}` : '-'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {isoPlan.overflow.length > 0 && (() => {
          const overflowLabels = isoPlan.overflow.map(item => {
            const qty = getItemQuantity(item);
            if (!qty) return null;
            return `${getWeaponDisplayName(item.weapon_id)} (x${qty})`;
          }).filter(Boolean);

          if (overflowLabels.length === 0) return null;

          return (
            <div className="mt-2 text-[10px] text-orange-400">
              {t('missionDispatch.iso.overflow')} {overflowLabels.join(', ')}
            </div>
          );
        })()}
      </div>

      {/* Recommended Aircraft + pilot */}
      {(mission.recommended_aircraft || (mission.status === 'accepted' && mission.accepted_by)) && (
        <div className="bg-yt-bg-tertiary rounded p-2 mb-2 text-xs">
          {mission.recommended_aircraft && (
            <div className="flex items-center gap-1.5">
              {mission.recommended_aircraft === 'helicopter' && (
                <>
                  <Helicopter className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-yt-text-secondary">{t('missionDispatch.recommended.label')}</span>
                  <span className="text-cyan-400 font-medium">{t('missionDispatch.recommended.helicopter')}</span>
                </>
              )}
              {mission.recommended_aircraft === 'airplane' && (
                <>
                  <Plane className="w-3.5 h-3.5 text-yt-accent" />
                  <span className="text-yt-text-secondary">{t('missionDispatch.recommended.label')}</span>
                  <span className="text-yt-accent font-medium">{t('missionDispatch.recommended.airplane')}</span>
                </>
              )}
              {mission.recommended_aircraft === 'airdrop' && (
                <>
                  <Package className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-yt-text-secondary">{t('missionDispatch.recommended.label')}</span>
                  <span className="text-orange-400 font-medium">{t('missionDispatch.recommended.airdrop')}</span>
                </>
              )}
            </div>
          )}
          {mission.status === 'accepted' && mission.accepted_by && (
            <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-yt-border">
              <User className="w-3.5 h-3.5 text-yt-text-secondary" />
              <span className="text-yt-text-secondary">{t('missionDispatch.pilot')}</span>
              <span className="text-yt-text-primary font-bold">{mission.accepted_by}</span>
            </div>
          )}
        </div>
      )}

      {/* Azioni - compatte */}
      <div className="flex gap-2">
        {mission.status === 'pending' && (
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-green-400 hover:bg-green-400/80 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary text-white rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            {t('missionDispatch.accept')}
          </button>
        )}

        {mission.status === 'accepted' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-yt-accent hover:bg-yt-accent/80 disabled:bg-yt-bg-tertiary text-white rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            {t('missionDispatch.complete')}
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-3 py-1.5 bg-red-400 hover:bg-red-400/80 disabled:bg-yt-bg-tertiary text-white rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <XCircle className="w-4 h-4" />
          <span className="hidden sm:inline">{t('missionDispatch.cancel')}</span>
        </button>
      </div>

      {/* Login Required Modal */}
      {showLoginModal && (
        <LoginRequiredModal
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
        />
      )}
    </div>
  );
}

/**
 * Mission Dispatch Component
 */
export default function MissionDispatch({ missions, airports, onUpdate, highlightedMissionId }) {
  const [filter, setFilter] = useState('all'); // all, pending, accepted
  const [filterMode, setFilterMode] = useState('route'); // route, priority
  const [routeFilter, setRouteFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [airportFilter, setAirportFilter] = useState('all');
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Use shared user context
  const { user, incrementStats } = useUser();

  const routes = missions.reduce((acc, mission) => {
    const source = mission.source_airport_id || 'main';
    const destination = mission.airport_id || 'unknown';
    const key = `${source}::${destination}`;
    if (acc.some(r => r.key === key)) return acc;
    acc.push({
      key,
      source,
      destination,
      label: `${getAirportName(source) || t('airportCard.baseLabel')} → ${getAirportName(destination) || t('general.unknown')}`,
    });
    return acc;
  }, []).sort((a, b) => a.label.localeCompare(b.label));

  const filteredMissions = missions.filter(m => {
    if (filter === 'pending') return m.status === 'pending';
    if (filter === 'accepted') return m.status === 'accepted';
    return m.status === 'pending' || m.status === 'accepted';
  }).filter(m => {
    if (filterMode === 'route' && routeFilter !== 'all') {
      const key = `${m.source_airport_id || 'main'}::${m.airport_id || 'unknown'}`;
      return key === routeFilter;
    }
    if (filterMode === 'priority' && priorityFilter !== 'all') {
      return getMissionPriority(m) === priorityFilter;
    }
    return true;
  }).filter(m => {
    if (airportFilter === 'all') return true;
    return m.source_airport_id === airportFilter || m.airport_id === airportFilter;
  });

  const stats = {
    pending: missions.filter(m => m.status === 'pending').length,
    accepted: missions.filter(m => m.status === 'accepted').length,
    critical: missions.filter(m => getMissionPriority(m) === 'critical').length,
  };

  return (
    <div className="space-y-3">
      {/* Header compatto stile YouTube */}
      <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-fuchsia-500/20 rounded">
              <Package className="w-6 h-6 text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-yt-text-primary">{t('missionDispatch.title')}</h2>
              <p className="text-xs text-yt-text-secondary">{t('missionDispatch.subtitle')}</p>
            </div>
          </div>
          {/* Stats compatte */}
          <div className="flex gap-3">
            <div className="text-center bg-yt-bg-tertiary rounded px-3 py-1.5">
              <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">{t('missionDispatch.stats.pending')}</div>
            </div>
            <div className="text-center bg-yt-bg-tertiary rounded px-3 py-1.5">
              <div className="text-2xl font-bold text-yt-accent">{stats.accepted}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">{t('missionDispatch.stats.accepted')}</div>
            </div>
            <div className="text-center bg-yt-bg-tertiary rounded px-3 py-1.5">
              <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">{t('missionDispatch.stats.critical')}</div>
            </div>
          </div>
        </div>

        {/* Filters - compatti stile YouTube tabs */}
        <div className="flex gap-1 border-b border-yt-border -mb-4 pb-0">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === 'all'
                ? 'text-yt-text-primary border-b-2 border-yt-accent'
                : 'text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            {t('missionDispatch.filters.all')} ({stats.pending + stats.accepted})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === 'pending'
                ? 'text-yt-text-primary border-b-2 border-yt-accent'
                : 'text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            {t('missionDispatch.filters.pending')} ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('accepted')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === 'accepted'
                ? 'text-yt-text-primary border-b-2 border-yt-accent'
                : 'text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            {t('missionDispatch.filters.accepted')} ({stats.accepted})
          </button>
        </div>

        {/* Route/Priority filter */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="flex items-center gap-1 bg-yt-bg-tertiary rounded p-1">
            <button
              onClick={() => setFilterMode('route')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filterMode === 'route' ? 'bg-yt-accent text-white' : 'text-yt-text-secondary hover:text-yt-text-primary'
              }`}
            >
              {t('missionDispatch.filters.route')}
            </button>
            <button
              onClick={() => setFilterMode('priority')}
              className={`px-3 py-1 text-xs font-medium rounded ${
                filterMode === 'priority' ? 'bg-yt-accent text-white' : 'text-yt-text-secondary hover:text-yt-text-primary'
              }`}
            >
              {t('missionDispatch.filters.priority')}
            </button>
          </div>

          {filterMode === 'route' ? (
            <select
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-yt-bg-tertiary border border-yt-border rounded text-yt-text-primary"
            >
              <option value="all">{t('missionDispatch.filters.allRoutes')}</option>
              {routes.map(route => (
                <option key={route.key} value={route.key}>{route.label}</option>
              ))}
            </select>
          ) : (
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2 py-1 text-xs bg-yt-bg-tertiary border border-yt-border rounded text-yt-text-primary"
            >
              <option value="all">{t('missionDispatch.filters.allPriorities')}</option>
              <option value="critical">{getStatusLabel('critical')}</option>
              <option value="high">{getStatusLabel('high')}</option>
              <option value="medium">{getStatusLabel('medium')}</option>
            </select>
          )}
          {airportFilter !== 'all' && (
            <div className="flex items-center gap-2 text-xs bg-yt-bg-tertiary border border-yt-border rounded px-2 py-1">
              <span className="text-yt-text-secondary">
                {t('missionDispatch.filters.airport')}:
              </span>
              <span className="text-yt-text-primary font-medium">
                {getAirportName(airportFilter) || t('general.unknown')}
              </span>
              <button
                type="button"
                onClick={() => setAirportFilter('all')}
                className="text-yt-text-secondary hover:text-yt-text-primary"
              >
                {t('general.clear')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Map section */}
      <div className="bg-yt-bg-secondary rounded-lg border border-yt-border">
        <button
          type="button"
          onClick={() => setIsMapOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yt-accent/20 rounded">
              <Map className="w-5 h-5 text-yt-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-yt-text-primary">{t('mapView.title')}</h3>
              <p className="text-[11px] text-yt-text-secondary">{t('mapView.subtitle')}</p>
            </div>
          </div>
          {isMapOpen ? (
            <ChevronUp className="w-5 h-5 text-yt-text-secondary" />
          ) : (
            <ChevronDown className="w-5 h-5 text-yt-text-secondary" />
          )}
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ${
            isMapOpen ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <div className="p-3 pt-0">
            <MapView
              missions={filteredMissions}
              airportsData={airports}
              embedded
              onRouteSelect={(key) => {
                setFilterMode('route');
                setRouteFilter(key);
                setAirportFilter('all');
              }}
              onAirportSelect={(airportId) => {
                setAirportFilter(airportId);
                setRouteFilter('all');
              }}
            />
          </div>
        </div>
      </div>

      {/* Missions List - compatta */}
      {filteredMissions.length === 0 ? (
        <div className="bg-yt-bg-secondary rounded-lg p-8 text-center border border-yt-border">
          <Package className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
          <p className="text-base text-yt-text-primary font-medium">{t('missionDispatch.emptyTitle')}</p>
          <p className="text-xs text-yt-text-secondary mt-1">{t('missionDispatch.emptySubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMissions.map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              airports={airports}
              onUpdate={onUpdate}
              isHighlighted={mission.id === highlightedMissionId}
              user={user}
              onStatsUpdate={incrementStats}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Utility: Get time ago string
 */
function getTimeAgo(timestamp) {
  return formatElapsedTime(timestamp, 'missionDispatch.timeAgo');
}

/**
 * Utility: Get time remaining string
 */
function getTimeRemaining(timestamp) {
  return formatRemainingTime(timestamp, 'missionDispatch.timeRemaining');
}
