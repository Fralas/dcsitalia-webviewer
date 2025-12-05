import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Package, Droplet, Plane, Helicopter, Plus, X, TrendingUp, ArrowRight, FileDown, Weight, Clock, User, XCircle } from 'lucide-react';
import * as api from '../services/api';
import WeaponChart from './WeaponChart';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';
import { generateChartsPDF, checkChartsAvailable } from '../utils/pdfGenerator';
import { isImportantWeapon } from '../config/weapons';
import { formatWeight } from '../utils/weightFormatter';

/**
 * Get weapon display name (remove prefix)
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

/**
 * Get time ago string
 */
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s fa`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  const days = Math.floor(hours / 24);
  return `${days}g fa`;
}

/**
 * Get time remaining string
 */
function getTimeRemaining(timestamp) {
  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds < 0) return 'SCADUTA';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}g`;
}

/**
 * Get status for weapon quantity
 */
function getWeaponStatus(quantity, isImportant) {
  if (!isImportant) return 'normal';
  if (quantity <= 5) return 'critical';
  if (quantity <= 20) return 'high';
  if (quantity <= 40) return 'medium';
  return 'ok';
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const styles = {
    critical: 'bg-red-400/20 text-red-400 border-red-400/50',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    medium: 'bg-yellow-400/20 text-yellow-400 border-yellow-400/50',
    ok: 'bg-green-400/20 text-green-400 border-green-400/50',
    normal: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  };

  const icons = {
    critical: AlertTriangle,
    high: AlertCircle,
    medium: AlertCircle,
    ok: CheckCircle,
    normal: Package,
  };

  const Icon = icons[status];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs border ${styles[status]}`}>
      <Icon className="w-3 h-3" />
      {status.toUpperCase()}
    </span>
  );
}

/**
 * Airport Card Component
 */
export default function AirportCard({ airport, missions = [], onMissionsUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // all, critical, important
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(100);
  const [chartWeapon, setChartWeapon] = useState(''); // For the historical chart
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [chartsAvailable, setChartsAvailable] = useState(null); // null = not checked, true/false = has charts

  // Mission management states
  const [missionStates, setMissionStates] = useState({}); // { missionId: { userName, showAccept, loading } }

  if (!airport || !airport.data) {
    return null;
  }

  // Check if charts are available when card is expanded
  useEffect(() => {
    if (expanded && chartsAvailable === null) {
      checkChartsAvailable(airport.id).then(setChartsAvailable);
    }
  }, [expanded, airport.id, chartsAvailable]);

  const { weapons = [], liquids = [] } = airport.data;

  // Get suggested quantity based on priority
  const getSuggestedQuantity = (weaponId) => {
    const weapon = weapons.find(w => w.item === weaponId);
    if (!weapon) return 100;

    const quantity = weapon.quantity;
    if (quantity <= 5) return 150;  // CRITICAL
    if (quantity <= 20) return 100; // HIGH
    if (quantity <= 40) return 50;  // MEDIUM
    return 100; // Default
  };

  // Handle weapon selection
  const handleWeaponSelect = (weaponId) => {
    setSelectedWeapon(weaponId);
    if (weaponId) {
      const suggestedQty = getSuggestedQuantity(weaponId);
      setOrderQuantity(suggestedQty);
    }
  };

  // Handle order creation
  const handleCreateOrder = async () => {
    if (!selectedWeapon || orderQuantity <= 0) {
      alert('Seleziona un\'arma e inserisci una quantità valida');
      return;
    }

    try {
      await api.createOrder(airport.id, selectedWeapon, orderQuantity);
      setShowOrderModal(false);
      setSelectedWeapon('');
      setOrderQuantity(100);
      alert('Ordine creato con successo!');
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert('Errore nella creazione dell\'ordine: ' + error.message);
    }
  };

  // Handle mission accept
  const handleAcceptMission = async (missionId) => {
    const state = missionStates[missionId] || {};
    if (!state.userName?.trim()) {
      alert('Inserisci il tuo nome');
      return;
    }

    setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: true } }));
    try {
      await api.acceptMission(missionId, state.userName);
      setMissionStates(prev => ({ ...prev, [missionId]: { userName: '', showAccept: false, loading: false } }));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(`Errore nell'accettare la missione: ${error.message}`);
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
    }
  };

  // Handle mission complete
  const handleCompleteMission = async (missionId) => {
    if (!confirm('Segnare questa missione come completata?')) return;

    const state = missionStates[missionId] || {};
    setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: true } }));
    try {
      await api.completeMission(missionId);
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(`Errore nel completare la missione: ${error.message}`);
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
    }
  };

  // Handle mission cancel
  const handleCancelMission = async (missionId) => {
    if (!confirm('Annullare questa missione?')) return;

    const state = missionStates[missionId] || {};
    setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: true } }));
    try {
      await api.cancelMission(missionId);
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(`Errore nell'annullare la missione: ${error.message}`);
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
    }
  };

  // Handle PDF generation
  const handleGeneratePDF = async () => {
    setGeneratingPDF(true);
    try {
      await generateChartsPDF(airport.id, airport.displayName || airport.name);
    } catch (error) {
      console.error('PDF generation error:', error);
    } finally {
      setGeneratingPDF(false);
    }
  };

  // Check if this airport is a heliport
  const isHeliport = airport.isHeliport || false;

  // Calculate stats
  const stats = {
    critical: 0,
    high: 0,
    medium: 0,
    ok: 0,
  };

  weapons.forEach(weapon => {
    const isImportant = isImportantWeapon(weapon.item, isHeliport);
    const status = getWeaponStatus(weapon.quantity, isImportant);
    if (status === 'critical') stats.critical++;
    else if (status === 'high') stats.high++;
    else if (status === 'medium') stats.medium++;
    else if (isImportant) stats.ok++;
  });

  // Filter weapons
  let filteredWeapons = weapons;
  if (filter === 'critical') {
    filteredWeapons = weapons.filter(w => {
      const isImportant = isImportantWeapon(w.item, isHeliport);
      const status = getWeaponStatus(w.quantity, isImportant);
      return status === 'critical';
    });
  } else if (filter === 'important') {
    filteredWeapons = weapons.filter(w => isImportantWeapon(w.item, isHeliport));
  }

  // Sort by status (critical first)
  filteredWeapons = [...filteredWeapons].sort((a, b) => {
    const isImportantA = isImportantWeapon(a.item, isHeliport);
    const isImportantB = isImportantWeapon(b.item, isHeliport);
    const statusA = getWeaponStatus(a.quantity, isImportantA);
    const statusB = getWeaponStatus(b.quantity, isImportantB);

    const priority = { critical: 0, high: 1, medium: 2, ok: 3, normal: 4 };
    return priority[statusA] - priority[statusB];
  });

  const airportMissions = missions.filter(m => m.airport_id === airport.id);
  const cardBorderClass = stats.critical > 0 ? 'border-red-400 pulse-border-critical' : stats.high > 0 ? 'border-orange-500' : stats.medium > 0 ? 'border-yellow-400' : 'border-yt-border';

  return (
    <div className={`bg-yt-bg-secondary rounded-lg border-2 ${cardBorderClass} overflow-hidden hover:shadow-xl transition-all`}>
      {/* Header */}
      <div
        className="p-3 cursor-pointer hover:bg-yt-bg-tertiary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isHeliport ? (
              <Helicopter className="w-5 h-5 text-cyan-400" />
            ) : (
              <Plane className={`w-5 h-5 ${airport.isMainBase ? 'text-fuchsia-400' : 'text-yt-accent'}`} />
            )}
            <div>
              <h3 className="text-base font-bold text-yt-text-primary">{airport.displayName || airport.name}</h3>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {stats.critical > 0 && (
              <div className="flex items-center gap-1 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-bold">{stats.critical}</span>
              </div>
            )}
            {stats.high > 0 && (
              <div className="flex items-center gap-1 text-orange-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold">{stats.high}</span>
              </div>
            )}
            {stats.medium > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold">{stats.medium}</span>
              </div>
            )}
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-yt-border">
          {/* Filters - compatti stile YouTube */}
          <div className="p-3 bg-yt-bg-primary flex gap-2 justify-between items-center flex-wrap">
            <div className="flex gap-1.5">
              <button
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${filter === 'all' ? 'bg-yt-accent text-white' : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border hover:text-yt-text-primary'}`}
              >
                Tutte ({weapons.length})
              </button>
              <button
                onClick={() => setFilter('important')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${filter === 'important' ? 'bg-yt-accent text-white' : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border hover:text-yt-text-primary'}`}
              >
                Importanti ({weapons.filter(w => isImportantWeapon(w.item, isHeliport)).length})
              </button>
              <button
                onClick={() => setFilter('critical')}
                className={`px-2.5 py-1.5 rounded text-xs font-medium transition-all ${filter === 'critical' ? 'bg-yt-accent text-white' : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border hover:text-yt-text-primary'}`}
              >
                Critiche ({stats.critical})
              </button>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={handleGeneratePDF}
                disabled={generatingPDF || chartsAvailable === false}
                className={`px-2.5 py-1.5 rounded text-xs font-medium flex items-center gap-1 transition-all ${
                  generatingPDF
                    ? 'bg-yt-accent/80 text-white cursor-wait'
                    : chartsAvailable === false
                    ? 'bg-yt-bg-tertiary text-yt-text-secondary cursor-not-allowed'
                    : 'bg-yt-accent text-white hover:bg-yt-accent/80'
                }`}
                title={chartsAvailable === false ? 'Nessuna chart disponibile per questo aeroporto' : ''}
              >
                <FileDown className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{generatingPDF ? 'PDF...' : chartsAvailable === null ? 'Verifica...' : 'PDF'}</span>
              </button>
              {!airport.isMainBase && (
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="px-2.5 py-1.5 rounded text-xs font-medium bg-green-400 text-white hover:bg-green-400/80 flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rifornimento</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Orders Section - Expanded with full mission management */}
          {!airport.isMainBase && airportMissions.length > 0 && (
            <div className="p-3 bg-fuchsia-500/10 border-t-2 border-fuchsia-500/40">
              <h4 className="text-sm font-bold text-fuchsia-300 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4" />
                ORDINI ATTIVI ({airportMissions.length})
              </h4>
              <div className={`grid gap-3 ${airportMissions.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {airportMissions.map(mission => {
                  const sourceName = mission.source_airport_id ? getAirportName(mission.source_airport_id) : 'Main Base';
                  const sourceAirport = mission.source_airport_id ? airports.find(a => a.id === mission.source_airport_id) : null;
                  const distance = mission.distance_nm ? `${mission.distance_nm}nm` : '-';
                  const timeAgo = getTimeAgo(mission.created_at);
                  const expiresIn = getTimeRemaining(mission.expires_at);
                  const state = missionStates[mission.id] || { userName: '', showAccept: false, loading: false };

                  return (
                    <div key={mission.id} className="bg-yt-bg-secondary p-3 rounded-lg border-2 border-fuchsia-500/30">
                      {/* Header with weapon and status */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-sm text-yt-text-primary font-bold mb-1 truncate">{getWeaponDisplayName(mission.weapon_id)}</div>
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="w-3 h-3 text-yt-text-secondary" />
                            <span className="text-yt-text-secondary">{timeAgo}</span>
                            <span className="text-yt-border">•</span>
                            <span className="text-yellow-400 font-medium">⏰ {expiresIn}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide ${
                          mission.status === 'pending'
                            ? mission.current_quantity <= 5
                              ? 'bg-red-400/20 text-red-400 border border-red-400/50'
                              : mission.current_quantity <= 20
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                              : 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/50'
                            : mission.status === 'accepted'
                            ? 'bg-yt-accent/20 text-yt-accent'
                            : 'bg-yt-bg-primary/50 text-yt-text-secondary'
                        }`}>
                          {mission.status === 'pending'
                            ? mission.current_quantity <= 5
                              ? 'CRITICA'
                              : mission.current_quantity <= 20
                              ? 'ALTA'
                              : 'MEDIA'
                            : mission.status === 'accepted'
                            ? 'ACCETTATA'
                            : mission.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Quantities and weight */}
                      <div className="bg-yt-bg-tertiary rounded p-2 mb-2">
                        <div className="flex gap-2 mb-2">
                          <div className="flex-1 bg-yt-bg-primary rounded p-1.5 text-center">
                            <div className="text-[10px] text-yt-text-secondary mb-0.5">Scorte</div>
                            <div className="text-base font-bold text-red-400">{mission.current_quantity}</div>
                          </div>
                          <div className="flex-1 bg-yt-bg-primary rounded p-1.5 text-center">
                            <div className="text-[10px] text-yt-text-secondary mb-0.5">Richieste</div>
                            <div className="text-base font-bold text-green-400">{mission.quantity_needed}</div>
                          </div>
                        </div>
                        {mission.total_weight_lbs && mission.total_weight_lbs > 0 && (
                          <div className="flex items-center gap-1.5 justify-center text-xs text-yt-text-primary">
                            <Weight className="w-3.5 h-3.5" />
                            <span className="font-mono font-medium">{formatWeight(mission.total_weight_lbs)}</span>
                          </div>
                        )}
                      </div>

                      {/* Route Information */}
                      <div className="flex items-center gap-1 text-xs bg-yt-bg-tertiary px-2 py-1.5 rounded mb-2 flex-wrap">
                        {!sourceAirport ? (
                          <span className="text-fuchsia-400 font-medium truncate">{sourceName}</span>
                        ) : sourceAirport.isMainBase ? (
                          <span className="text-fuchsia-400 font-medium truncate">{sourceName}</span>
                        ) : sourceAirport.isHeliport ? (
                          <>
                            <Helicopter className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                            <span className="text-cyan-400 font-medium truncate">{sourceName}</span>
                          </>
                        ) : (
                          <>
                            <Plane className="w-3.5 h-3.5 text-yt-accent flex-shrink-0" />
                            <span className="text-yt-accent font-medium truncate">{sourceName}</span>
                          </>
                        )}
                        <ArrowRight className="w-3.5 h-3.5 text-yt-text-secondary flex-shrink-0" />
                        {isHeliport ? (
                          <>
                            <Helicopter className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                            <span className="text-cyan-400 font-medium truncate">{airport.displayName || airport.name}</span>
                          </>
                        ) : (
                          <>
                            <Plane className="w-3.5 h-3.5 text-yt-accent flex-shrink-0" />
                            <span className="text-yt-accent font-medium truncate">{airport.displayName || airport.name}</span>
                          </>
                        )}
                        <span className="text-yt-border flex-shrink-0">•</span>
                        <span className="text-yt-text-primary font-mono flex-shrink-0">{distance}</span>
                      </div>

                      {/* Pilot info for accepted missions */}
                      {mission.status === 'accepted' && mission.accepted_by && (
                        <div className="flex items-center gap-1.5 text-xs bg-yt-bg-tertiary px-2 py-1.5 rounded mb-2">
                          <User className="w-3.5 h-3.5 text-yt-text-secondary" />
                          <span className="text-yt-text-secondary">Pilota:</span>
                          <span className="text-yt-text-primary font-bold">{mission.accepted_by}</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {mission.status === 'pending' && !state.showAccept && (
                          <button
                            onClick={() => setMissionStates(prev => ({ ...prev, [mission.id]: { ...state, showAccept: true } }))}
                            disabled={state.loading}
                            className="flex-1 px-3 py-1.5 bg-green-400/20 text-green-400 border border-green-400/50 hover:bg-green-400/30 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary disabled:border-yt-border rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Accetta
                          </button>
                        )}

                        {mission.status === 'pending' && state.showAccept && (
                          <div className="flex-1 flex gap-2">
                            <input
                              type="text"
                              placeholder="Nome pilota..."
                              value={state.userName}
                              onChange={(e) => setMissionStates(prev => ({ ...prev, [mission.id]: { ...state, userName: e.target.value } }))}
                              className="flex-1 px-2 py-1.5 bg-yt-bg-primary border border-yt-border rounded text-yt-text-primary text-xs focus:border-yt-accent focus:outline-none"
                              disabled={state.loading}
                            />
                            <button
                              onClick={() => handleAcceptMission(mission.id)}
                              disabled={state.loading}
                              className="px-3 py-1.5 bg-green-400/20 text-green-400 border border-green-400/50 hover:bg-green-400/30 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary disabled:border-yt-border rounded text-xs font-bold transition-all"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setMissionStates(prev => ({ ...prev, [mission.id]: { ...state, showAccept: false } }))}
                              disabled={state.loading}
                              className="px-3 py-1.5 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded text-xs transition-all"
                            >
                              ✕
                            </button>
                          </div>
                        )}

                        {mission.status === 'accepted' && (
                          <button
                            onClick={() => handleCompleteMission(mission.id)}
                            disabled={state.loading}
                            className="flex-1 px-3 py-1.5 bg-yt-accent hover:bg-yt-accent/80 disabled:bg-yt-bg-tertiary text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Completa
                          </button>
                        )}

                        <button
                          onClick={() => handleCancelMission(mission.id)}
                          disabled={state.loading}
                          className="px-3 py-1.5 bg-red-400/20 text-red-400 border border-red-400/50 hover:bg-red-400/30 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary disabled:border-yt-border rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Annulla</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weapons & Liquids Section - Split Layout */}
          <div className="p-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left Column: Weapons in single scrollbar */}
              <div>
                <h4 className="text-xs font-bold text-yt-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <Package className="w-3.5 h-3.5" />
                  Weapons & Munitions
                </h4>
                <div className="max-h-96 overflow-y-auto border border-yt-border rounded">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-yt-bg-secondary border-b border-yt-border z-10">
                      <tr className="text-left text-yt-text-secondary">
                        <th className="p-2">Weapon</th>
                        <th className="p-2 text-right">Qty</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWeapons.map((weapon, idx) => {
                        const isImportant = isImportantWeapon(weapon.item, isHeliport);
                        const status = getWeaponStatus(weapon.quantity, isImportant);

                        return (
                          <tr key={idx} className="border-b border-yt-border hover:bg-yt-bg-tertiary/50 transition-colors">
                            <td className="p-2 font-mono text-yt-text-primary">{getWeaponDisplayName(weapon.item)}</td>
                            <td className="p-2 text-right font-bold text-yt-text-primary">{weapon.quantity}</td>
                            <td className="p-2">
                              <StatusBadge status={status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right Column: Liquids in 2x2 block */}
              <div>
                <h4 className="text-xs font-bold text-yt-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                  <Droplet className="w-3.5 h-3.5" />
                  Liquids
                </h4>
                <div className="grid grid-cols-2 gap-3 h-96">
                  {liquids.map((liquid, idx) => (
                    <div key={idx} className="bg-yt-bg-tertiary p-4 rounded border border-yt-border flex flex-col justify-center items-center">
                      <div className="text-sm text-yt-text-secondary mb-2">Type {liquid.item}</div>
                      <div className="text-2xl font-bold text-yt-text-primary">{liquid.quantity.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Historical Chart Section */}
          <div className="p-3 bg-yt-bg-primary/50 border-t border-yt-border">
            <div className="mb-3">
              <h4 className="text-xs font-bold text-yt-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wide">
                <TrendingUp className="w-3.5 h-3.5" />
                Andamento Storico (7 giorni)
              </h4>
              <select
                value={chartWeapon}
                onChange={(e) => setChartWeapon(e.target.value)}
                className="w-full bg-yt-bg-tertiary text-yt-text-primary border border-yt-border rounded px-2.5 py-2 text-xs focus:outline-none focus:border-yt-accent transition-all"
              >
                <option value="">-- Seleziona un'arma per vedere il grafico --</option>
                {weapons
                  .filter(w => isImportantWeapon(w.item, isHeliport))
                  .map((weapon, idx) => (
                    <option key={idx} value={weapon.item}>
                      {getWeaponDisplayName(weapon.item)} (Attuale: {weapon.quantity})
                    </option>
                  ))}
              </select>
            </div>

            {chartWeapon && (
              <WeaponChart
                airportId={airport.id}
                weaponId={chartWeapon}
                days={7}
              />
            )}

            {!chartWeapon && (
              <div className="bg-yt-bg-tertiary rounded-lg p-6 text-center">
                <TrendingUp className="w-10 h-10 text-yt-text-secondary mx-auto mb-2 opacity-50" />
                <p className="text-yt-text-primary text-xs">
                  Seleziona un'arma dal menu per visualizzare il grafico
                </p>
                <p className="text-[10px] text-yt-text-secondary mt-1.5">
                  📊 Dati salvati ogni 4 ore
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Creation Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowOrderModal(false)}>
          <div className="bg-yt-bg-secondary rounded-lg p-5 max-w-md w-full mx-4 border-2 border-green-400 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-yt-text-primary flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-400" />
                Richiedi Rifornimento
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-yt-text-secondary hover:text-yt-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Airport Info */}
              <div className="bg-yt-bg-primary p-3 rounded">
                <div className="text-xs text-yt-text-secondary">Aeroporto</div>
                <div className="text-yt-text-primary font-bold">{airport.displayName || airport.name}</div>
              </div>

              {/* Weapon Selection */}
              <div>
                <label className="block text-xs text-yt-text-secondary mb-1.5 font-medium">Seleziona Arma</label>
                <select
                  value={selectedWeapon}
                  onChange={(e) => handleWeaponSelect(e.target.value)}
                  className="w-full bg-yt-bg-primary text-yt-text-primary border border-yt-border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400 transition-all"
                >
                  <option value="">-- Seleziona --</option>
                  {weapons.map((weapon, idx) => {
                    const status = getWeaponStatus(weapon.quantity, isImportantWeapon(weapon.item, isHeliport));
                    const priorityLabel = status === 'critical' ? '🔴 CRITICAL' : status === 'high' ? '🟠 HIGH' : status === 'medium' ? '🟡 MEDIUM' : '';
                    return (
                      <option key={idx} value={weapon.item}>
                        {getWeaponDisplayName(weapon.item)} (Attuale: {weapon.quantity}) {priorityLabel}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs text-yt-text-secondary mb-1.5 font-medium">
                  Quantità da Ordinare
                  {selectedWeapon && (
                    <span className="text-xs text-yt-text-secondary/60 ml-2">
                      (Suggerito: {getSuggestedQuantity(selectedWeapon)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-yt-bg-primary text-yt-text-primary border border-yt-border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400 transition-all"
                  placeholder="100"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-green-400 hover:bg-green-400/80 text-white font-bold py-2 px-4 rounded text-sm transition-all"
                >
                  Crea Ordine
                </button>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary font-bold py-2 px-4 rounded text-sm transition-all"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
