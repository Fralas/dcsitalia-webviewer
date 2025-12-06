import { useState, useEffect, useRef } from 'react';
import { Plane, Helicopter, Clock, User, CheckCircle, XCircle, AlertTriangle, Package, ArrowRight, Weight } from 'lucide-react';
import * as api from '../services/api';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';
import { formatWeight } from '../utils/weightFormatter';

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
    text = 'CRITICA';
  } else if (currentQuantity <= 20) {
    color = 'bg-orange-500/20 text-orange-400 border-orange-500';
    text = 'ALTA';
  } else {
    color = 'bg-yellow-400/20 text-yellow-400 border-yellow-400';
    text = 'MEDIA';
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold border ${color}`}>
      {text}
    </span>
  );
}

/**
 * Mission Card Component
 */
function MissionCard({ mission, airports, onUpdate, isHighlighted }) {
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [showAccept, setShowAccept] = useState(false);
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
    if (!userName.trim()) {
      alert('Inserisci il tuo nome');
      return;
    }

    setLoading(true);
    try {
      await api.acceptMission(mission.id, userName);
      onUpdate();
      setShowAccept(false);
    } catch (error) {
      alert(`Errore nell'accettare la missione: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Segnare questa missione come completata?')) return;

    setLoading(true);
    try {
      await api.completeMission(mission.id);
      onUpdate();
    } catch (error) {
      alert(`Errore nel completare la missione: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Annullare questa missione?')) return;

    setLoading(true);
    try {
      await api.cancelMission(mission.id);
      onUpdate();
    } catch (error) {
      alert(`Errore nell'annullare la missione: ${error.message}`);
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
          <div className="text-[10px] text-yt-text-secondary mb-0.5">Scorte</div>
          <div className="text-base font-bold text-red-400">{mission.current_quantity}</div>
        </div>
        <div className="flex-1 bg-yt-bg-tertiary rounded p-1.5 text-center">
          <div className="text-[10px] text-yt-text-secondary mb-0.5">Richieste</div>
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
            <span className="text-fuchsia-400 font-medium">{mission.source_airport_id ? getAirportName(mission.source_airport_id) : 'Base Principale'}</span>
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
              <span className="text-cyan-400 font-medium">{airport?.displayName || airport?.name || 'Sconosciuto'}</span>
            </>
          ) : (
            <>
              <Plane className="w-3.5 h-3.5 text-yt-accent" />
              <span className="text-yt-accent font-medium">{airport?.displayName || airport?.name || 'Sconosciuto'}</span>
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
                <span className="text-yt-text-secondary">Consigliato:</span>
                <span className="text-cyan-400 font-medium">Elicottero</span>
              </>
            )}
            {mission.recommended_aircraft === 'airplane' && (
              <>
                <Plane className="w-3.5 h-3.5 text-yt-accent" />
                <span className="text-yt-text-secondary">Consigliato:</span>
                <span className="text-yt-accent font-medium">C-130</span>
              </>
            )}
            {mission.recommended_aircraft === 'airdrop' && (
              <>
                <Package className="w-3.5 h-3.5 text-orange-400" />
                <span className="text-yt-text-secondary">Consigliato:</span>
                <span className="text-orange-400 font-medium">Airdrop</span>
              </>
            )}
          </div>
        )}

        {mission.status === 'accepted' && mission.accepted_by && (
          <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-yt-border">
            <User className="w-3.5 h-3.5 text-yt-text-secondary" />
            <span className="text-yt-text-secondary">Pilota:</span>
            <span className="text-yt-text-primary font-bold">{mission.accepted_by}</span>
          </div>
        )}
      </div>

      {/* Azioni - compatte */}
      <div className="flex gap-2">
        {mission.status === 'pending' && !showAccept && (
          <button
            onClick={() => setShowAccept(true)}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-green-400 hover:bg-green-400/80 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary text-white rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            Accetta
          </button>
        )}

        {mission.status === 'pending' && showAccept && (
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Il tuo nome..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="flex-1 px-2 py-1.5 bg-yt-bg-primary border border-yt-border rounded text-yt-text-primary text-sm focus:border-yt-accent focus:outline-none"
              disabled={loading}
            />
            <button
              onClick={handleAccept}
              disabled={loading}
              className="px-3 py-1.5 bg-green-400 hover:bg-green-400/80 disabled:bg-yt-bg-tertiary text-white rounded text-sm font-bold transition-all"
            >
              OK
            </button>
            <button
              onClick={() => setShowAccept(false)}
              disabled={loading}
              className="px-3 py-1.5 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded text-sm transition-all"
            >
              ✕
            </button>
          </div>
        )}

        {mission.status === 'accepted' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 px-3 py-1.5 bg-yt-accent hover:bg-yt-accent/80 disabled:bg-yt-bg-tertiary text-white rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle className="w-4 h-4" />
            Completa
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-3 py-1.5 bg-red-400 hover:bg-red-400/80 disabled:bg-yt-bg-tertiary text-white rounded text-sm font-bold transition-all flex items-center justify-center gap-1.5"
        >
          <XCircle className="w-4 h-4" />
          <span className="hidden sm:inline">Annulla</span>
        </button>
      </div>
    </div>
  );
}

/**
 * Mission Dispatch Component
 */
export default function MissionDispatch({ missions, airports, onUpdate, highlightedMissionId }) {
  const [filter, setFilter] = useState('all'); // all, pending, accepted

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
              <h2 className="text-xl font-bold text-yt-text-primary">Gestione Missioni</h2>
              <p className="text-xs text-yt-text-secondary">Missioni di rifornimento attive</p>
            </div>
          </div>
          {/* Stats compatte */}
          <div className="flex gap-3">
            <div className="text-center bg-yt-bg-tertiary rounded px-3 py-1.5">
              <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">Attesa</div>
            </div>
            <div className="text-center bg-yt-bg-tertiary rounded px-3 py-1.5">
              <div className="text-2xl font-bold text-yt-accent">{stats.accepted}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">Accettate</div>
            </div>
            <div className="text-center bg-yt-bg-tertiary rounded px-3 py-1.5">
              <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
              <div className="text-[10px] text-yt-text-secondary uppercase tracking-wide">Critiche</div>
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
            Tutte ({stats.pending + stats.accepted})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === 'pending'
                ? 'text-yt-text-primary border-b-2 border-yt-accent'
                : 'text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            In Attesa ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('accepted')}
            className={`px-4 py-2 text-sm font-medium transition-all ${
              filter === 'accepted'
                ? 'text-yt-text-primary border-b-2 border-yt-accent'
                : 'text-yt-text-secondary hover:text-yt-text-primary'
            }`}
          >
            Accettate ({stats.accepted})
          </button>
        </div>
      </div>

      {/* Missions List - compatta */}
      {filteredMissions.length === 0 ? (
        <div className="bg-yt-bg-secondary rounded-lg p-8 text-center border border-yt-border">
          <Package className="w-12 h-12 text-yt-text-secondary mx-auto mb-3 opacity-50" />
          <p className="text-base text-yt-text-primary font-medium">Nessuna missione disponibile</p>
          <p className="text-xs text-yt-text-secondary mt-1">Le missioni appariranno qui quando le scorte saranno basse</p>
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
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Utility: Get time remaining string
 */
function getTimeRemaining(timestamp) {
  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds < 0) return 'EXPIRED';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
