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
import discordLogo from '../../img/discord_logo.png';

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


function formatDurationMinutes(totalMinutes) {
  if (!Number.isFinite(totalMinutes) || totalMinutes <= 0) return null;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}min`;
  if (hours > 0) return `${hours}h`;
  return `${minutes}min`;
}

function getEstimatedDurationMinutes(mission) {
  const direct = Number(mission.estimated_time_minutes ?? mission.estimated_minutes ?? mission.duration_minutes);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const distance = Number(mission.distance_nm);
  if (!Number.isFinite(distance) || distance <= 0) return null;
  const speed =
    mission.recommended_aircraft === 'helicopter' ? 120 :
    mission.recommended_aircraft === 'airdrop' ? 300 :
    360;
  return Math.round((distance / speed) * 60);
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
    color = 'bg-red-500/20 text-red-300 border-red-500/60';
    text = getStatusLabel('critical');
  } else if (priority === 'high') {
    color = 'bg-orange-500/20 text-orange-300 border-orange-500/60';
    text = getStatusLabel('high');
  } else {
    color = 'bg-yellow-400/20 text-yellow-300 border-yellow-400/60';
    text = getStatusLabel('medium');
  }

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border ${color}`}>
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
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>

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
              aria-label="Login con Discord"
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition-all flex items-center justify-center gap-2"
            >
              <img
                src={discordLogo}
                alt="Discord"
                className="h-9 w-auto object-contain"
              />
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
  const missionPriority = getMissionPriority(mission);
  const { orders, totalWeight } = getMissionTotals(mission);
  const isoPlan = buildIsoContainerPlan(orders);
  const sourceName = sourceAirport?.displayName || getAirportName(mission.source_airport_id) || t('airportCard.baseLabel');
  const destinationName = airport?.displayName || airport?.name || t('general.unknown');
  const sourceColor = getLocationColorClass(sourceAirport);
  const destinationColor = getLocationColorClass(airport);
  const weightLabel = totalWeight > 0 ? formatWeight(totalWeight) : '-';

  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
    }
  }, [isHighlighted]);

  const handleAccept = async () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }

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
      className={`bg-yt-bg-secondary/90 rounded-2xl border p-3 transition-all duration-300 shadow-[0_10px_26px_rgba(0,0,0,0.35)] ${
        mission.status === 'accepted' ? 'border-yt-accent/50' : 'border-yt-border/70'
      } ${
        isHighlighted ? 'ring-2 ring-fuchsia-400/80 shadow-fuchsia-400/30 scale-[1.01]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-extrabold text-yt-text-primary">
            <span className={sourceColor}>{sourceName}</span>
            <span className="text-yt-text-secondary"> → </span>
            <span className={destinationColor}>{destinationName}</span>
          </h3>
          <div className="text-[11px] text-yt-text-secondary mt-0.5">{timeAgo}</div>
          <div className="text-[11px] text-yt-text-secondary font-mono">{weightLabel}</div>
        </div>
        <PriorityBadge priority={missionPriority} />
      </div>

      <div className="bg-yt-bg-tertiary/70 border border-yt-border/60 rounded-lg px-3 py-2 mt-3 text-xs shadow-inner">
        <div className="flex items-center justify-between">
          <span className="text-yt-text-secondary">Container ISO</span>
          <span className="text-yt-text-primary font-semibold">{getIsoSummary(isoPlan, t)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
          {isoPlan.containers.filter(container => container.used > 0).map(container => {
            const fillPercent = container.capacity > 0 ? Math.min(100, (container.used / container.capacity) * 100) : 0;
            return (
              <div key={container.id} className="bg-yt-bg-secondary/80 rounded-lg border border-yt-border/70 p-2 shadow-inner">
                <div className="flex items-center justify-between text-[10px] text-yt-text-secondary mb-1">
                  <span>{container.small ? t('missionDispatch.iso.containerSmall') : t('missionDispatch.iso.container')}</span>
                  <span className="font-mono">{formatIsoUnits(container.used)} / {formatIsoUnits(container.capacity)}</span>
                </div>
                <div className="h-1.5 bg-yt-border/40 rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-fuchsia-500" style={{ width: `${fillPercent}%` }}></div>
                </div>
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

      {(mission.recommended_aircraft || (mission.status === 'accepted' && mission.accepted_by)) && (
        <div className="bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-lg px-3 py-2 mt-2 text-xs shadow-inner">
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

      <div className="flex gap-2 mt-3">
        {mission.status === 'pending' && (
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex-1 px-3 py-2.5 bg-green-500 hover:bg-green-500/80 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary text-white rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(34,197,94,0.35)]"
          >
            {t('missionDispatch.accept')}
          </button>
        )}

        {mission.status === 'accepted' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 px-3 py-2.5 bg-yt-accent hover:bg-yt-accent/80 disabled:bg-yt-bg-tertiary text-white rounded-xl text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-[0_6px_16px_rgba(56,189,248,0.35)]"
          >
            {t('missionDispatch.complete')}
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-3 py-2.5 bg-red-500 hover:bg-red-500/80 disabled:bg-yt-bg-tertiary text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center shadow-[0_6px_16px_rgba(239,68,68,0.35)]"
          aria-label={t('missionDispatch.cancel')}
        >
          <XCircle className="w-4 h-4" />
        </button>
      </div>

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
  const [sourceAirportFilter, setSourceAirportFilter] = useState('all');
  const [destinationAirportFilter, setDestinationAirportFilter] = useState('all');
  const [isMapOpen, setIsMapOpen] = useState(false);

  // Use shared user context
  const { user, incrementStats } = useUser();

  const filteredMissions = missions.filter(m => {
    if (filter === 'pending') return m.status === 'pending';
    if (filter === 'accepted') return m.status === 'accepted';
    return m.status === 'pending' || m.status === 'accepted';
  }).filter(m => {
    if (sourceAirportFilter !== 'all') {
      return (m.source_airport_id || 'main') === sourceAirportFilter;
    }
    return true;
  }).filter(m => {
    if (destinationAirportFilter === 'all') return true;
    return (m.airport_id || 'unknown') === destinationAirportFilter;
  });

  const stats = {
    pending: missions.filter(m => m.status === 'pending').length,
    accepted: missions.filter(m => m.status === 'accepted').length,
    critical: missions.filter(m => getMissionPriority(m) === 'critical').length,
  };

  return (
    <div className="space-y-3">
      <div className="bg-yt-bg-secondary/85 rounded-2xl p-4 border border-yt-border/70 shadow-[0_14px_30px_rgba(0,0,0,0.35)] backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-fuchsia-500/15 rounded-2xl ring-1 ring-fuchsia-500/35">
              <Package className="w-7 h-7 text-fuchsia-400" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold text-yt-text-primary tracking-[0.08em]">ORDINI ATTIVI</h2>
              <p className="text-xs text-yt-text-secondary">Gestione logistica dinamica</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="text-center bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-2xl px-4 py-2 min-w-[86px] shadow-inner">
              <div className="text-3xl font-extrabold text-fuchsia-400">{stats.pending}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">Attesa</div>
            </div>
            <div className="text-center bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-2xl px-4 py-2 min-w-[86px] shadow-inner">
              <div className="text-3xl font-extrabold text-yt-accent">{stats.accepted}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">Accettate</div>
            </div>
            <div className="text-center bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-2xl px-4 py-2 min-w-[86px] shadow-inner">
              <div className="text-3xl font-extrabold text-red-400">{stats.critical}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">Critiche</div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all border ${
              filter === 'all' ? 'bg-fuchsia-600 text-white border-fuchsia-500/50 shadow-[0_0_0_1px_rgba(217,70,239,0.2)]' : 'bg-yt-bg-tertiary/80 border-yt-border/60 text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            Tutte ({stats.pending + stats.accepted})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all border ${
              filter === 'pending' ? 'bg-fuchsia-600 text-white border-fuchsia-500/50 shadow-[0_0_0_1px_rgba(217,70,239,0.2)]' : 'bg-yt-bg-tertiary/80 border-yt-border/60 text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            Disponibili ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('accepted')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase transition-all border ${
              filter === 'accepted' ? 'bg-fuchsia-600 text-white border-fuchsia-500/50 shadow-[0_0_0_1px_rgba(217,70,239,0.2)]' : 'bg-yt-bg-tertiary/80 border-yt-border/60 text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            Accettate ({stats.accepted})
          </button>

          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-3 py-1.5 text-[11px] font-semibold uppercase bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-lg text-yt-text-primary"
            >
              <option value="all">STATUS</option>
              <option value="pending">Disponibili</option>
              <option value="accepted">Accettate</option>
            </select>
            <select
              value={sourceAirportFilter}
              onChange={(e) => setSourceAirportFilter(e.target.value)}
              className="px-3 py-1.5 text-[11px] font-semibold uppercase bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-lg text-yt-text-primary"
            >
              <option value="all">AEROPORTO PARTENZA</option>
              <option value="main">BASE PRINCIPALE</option>
              {airports.map(airport => (
                <option key={airport.id} value={airport.id}>
                  {airport.displayName || airport.name}
                </option>
              ))}
            </select>
            <select
              value={destinationAirportFilter}
              onChange={(e) => setDestinationAirportFilter(e.target.value)}
              className="px-3 py-1.5 text-[11px] font-semibold uppercase bg-yt-bg-tertiary/80 border border-yt-border/60 rounded-lg text-yt-text-primary"
            >
              <option value="all">AEROPORTO ARRIVO</option>
              <option value="unknown">SCONOSCIUTO</option>
              {airports.map(airport => (
                <option key={airport.id} value={airport.id}>
                  {airport.displayName || airport.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-yt-bg-secondary/85 rounded-2xl border border-yt-border/70 shadow-[0_10px_26px_rgba(0,0,0,0.3)]">
        <button
          type="button"
          onClick={() => setIsMapOpen((prev) => !prev)}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yt-accent/15 rounded-xl ring-1 ring-yt-accent/30">
              <Map className="w-5 h-5 text-yt-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-yt-text-primary">MAPPA DELLE ROTTE</h3>
              <p className="text-[11px] text-yt-text-secondary">Rotte di rifornimento attive</p>
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
                const [source, destination] = key.split('::');
                setSourceAirportFilter(source || 'all');
                setDestinationAirportFilter(destination || 'all');
              }}
              onAirportSelect={(airportId) => {
                setDestinationAirportFilter(airportId);
              }}
            />
          </div>
        </div>
      </div>

      {filteredMissions.length === 0 ? (
        <div className="bg-yt-bg-secondary rounded-2xl p-8 text-center border border-yt-border">
          <Package className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
          <p className="text-base text-yt-text-primary font-medium">{t('missionDispatch.emptyTitle')}</p>
          <p className="text-xs text-yt-text-secondary mt-1">{t('missionDispatch.emptySubtitle')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3">
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
