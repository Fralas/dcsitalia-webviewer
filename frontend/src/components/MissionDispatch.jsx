import { useState, useEffect, useRef } from 'react';
import { Plane, Helicopter, Clock, User, CheckCircle, XCircle, AlertTriangle, Package, ArrowRight, Weight, LogIn } from 'lucide-react';
import * as api from '../services/api';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';
import { formatWeight } from '../utils/weightFormatter';
import { t, formatElapsedTime, formatRemainingTime, getStatusLabel } from '../utils/locale';
import { useUser } from '../contexts/UserContext';

/**
 * Get weapon display name
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

/**
 * Get priority badge
 */
function PriorityBadge({ currentQuantity }) {
  let color, text;
  if (currentQuantity <= 5) {
    color = 'bg-red-400/20 text-red-400 border-red-400';
    text = getStatusLabel('critical');
  } else if (currentQuantity <= 20) {
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
        onStatsUpdate({ ordersCompleted: 1 });
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
      className={`bg-yt-bg-secondary rounded-lg border-2 p-3 transition-all duration-300 hover:border-yt-border ${
        mission.status === 'accepted' ? 'border-yt-accent/50' : 'border-yt-border'
      } ${
        isHighlighted ? 'ring-4 ring-fuchsia-400 shadow-lg shadow-fuchsia-400/50 scale-[1.02]' : ''
      }`}
    >
      {/* Header compatto con info principali */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1">
          <Clock className="w-4 h-4 text-yt-text-secondary" />
          <span className="text-sm text-yt-text-secondary">{timeAgo}</span>
        </div>
        <PriorityBadge currentQuantity={mission.current_quantity} />
      </div>

      {/* Weapon name - title style */}
      <h3 className="text-lg font-bold text-yt-text-primary mb-2 font-mono">{getWeaponDisplayName(mission.weapon_id)}</h3>

      {/* Quantities and weight - compact layout */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1 bg-yt-bg-tertiary rounded p-1.5 text-center">
          <div className="text-[10px] text-yt-text-secondary mb-0.5">{t('missionDispatch.quantities.stock')}</div>
          <div className="text-base font-bold text-red-400">{mission.current_quantity}</div>
        </div>
        <div className="flex-1 bg-yt-bg-tertiary rounded p-1.5 text-center">
          <div className="text-[10px] text-yt-text-secondary mb-0.5">{t('missionDispatch.quantities.requested')}</div>
          <div className="text-base font-bold text-green-400">{mission.quantity_needed}</div>
        </div>
        {mission.total_weight_lbs && mission.total_weight_lbs > 0 && (
          <div className="flex-[2] bg-yt-bg-tertiary rounded p-1.5 flex items-center justify-center gap-1.5">
            <Weight className="w-4 h-4 text-yt-text-primary" />
            <span className="text-base font-bold text-yt-text-primary font-mono">{formatWeight(mission.total_weight_lbs)}</span>
          </div>
        )}
      </div>

      {/* Route e info missione - compatto */}
      <div className="bg-yt-bg-tertiary rounded p-2 mb-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {sourceAirport?.isMainBase ? (
            <span className="text-fuchsia-400 font-medium">{mission.source_airport_id ? getAirportName(mission.source_airport_id) : t('airportCard.baseLabel')}</span>
          ) : sourceAirport?.isHeliport ? (
            <>
              <Helicopter className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-medium">{getAirportName(mission.source_airport_id)}</span>
            </>
          ) : (
            <>
              <Plane className="w-3.5 h-3.5 text-yt-accent" />
              <span className="text-yt-accent font-medium">{getAirportName(mission.source_airport_id)}</span>
            </>
          )}
          <ArrowRight className="w-3.5 h-3.5 text-yt-text-secondary" />
          {isHeliport ? (
            <>
              <Helicopter className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-cyan-400 font-medium">{airport?.displayName || airport?.name || t('general.unknown')}</span>
            </>
          ) : (
            <>
              <Plane className="w-3.5 h-3.5 text-yt-accent" />
              <span className="text-yt-accent font-medium">{airport?.displayName || airport?.name || t('general.unknown')}</span>
            </>
          )}
          {mission.distance_nm && (
            <>
              <span className="text-yt-border">•</span>
              <span className="text-yt-text-primary font-mono font-medium">{mission.distance_nm}nm</span>
            </>
          )}
        </div>

        {/* Recommended Aircraft */}
        {mission.recommended_aircraft && (
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-yt-border">
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

  // Use shared user context
  const { user, incrementStats } = useUser();

  const filteredMissions = missions.filter(m => {
    if (filter === 'pending') return m.status === 'pending';
    if (filter === 'accepted') return m.status === 'accepted';
    return m.status === 'pending' || m.status === 'accepted';
  });

  const stats = {
    pending: missions.filter(m => m.status === 'pending').length,
    accepted: missions.filter(m => m.status === 'accepted').length,
    critical: missions.filter(m => m.current_quantity <= 5).length,
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
