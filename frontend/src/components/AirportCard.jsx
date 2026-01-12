import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Package, Droplet, Plane, Helicopter, Anchor, Plus, X, TrendingUp, ArrowRight, FileDown, Weight, Clock, User, XCircle, Search, LogIn } from 'lucide-react';
import * as api from '../services/api';
import WeaponChart from './WeaponChart';
import { getAirportName } from '../config/airports';
import airports from '../config/airports';
import { generateChartsPDF, checkChartsAvailable } from '../utils/pdfGenerator';
import { isImportantWeapon, importantWeaponsAirports, importantWeaponsHeliports, importantWeaponsCarriers } from '../config/weapons';
import { formatWeight } from '../utils/weightFormatter';
import { t, formatElapsedTime, formatRemainingTime, getStatusLabel } from '../utils/locale';
import { useUser } from '../contexts/UserContext';
import { buildIsoContainerPlan, formatIsoUnits } from '../utils/isoLoad';

/**
 * Get weapon display name (remove prefix)
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

function getMissionTitle(mission) {
  const orders = getMissionOrders(mission);
  if (orders.length === 0) return 'Missione';
  if (orders.length === 1) return getWeaponDisplayName(orders[0].weapon_id);
  return `${getWeaponDisplayName(orders[0].weapon_id)} +${orders.length - 1}`;
}

const PRIORITY_RANK = {
  critical: 0,
  high: 1,
  medium: 2,
  ok: 3,
};

function getMissionPriorityRank(mission) {
  return PRIORITY_RANK[getMissionPriority(mission)] ?? PRIORITY_RANK.ok;
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

/**
 * Get time ago string
 */
function getTimeAgo(timestamp) {
  return formatElapsedTime(timestamp, 'airportCard.elapsed');
}

function getTimeRemaining(timestamp) {
  return formatRemainingTime(timestamp, 'airportCard.remaining');
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
      {getStatusLabel(status)}
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
 * Airport Card Component
 */
export default function AirportCard({ airport, missions = [], onMissionsUpdate, shouldExpand, expandToken }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // all, critical, important
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(100);
  const [chartWeapon, setChartWeapon] = useState(''); // For the historical chart
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [chartsAvailable, setChartsAvailable] = useState(null); // null = not checked, true/false = has charts
  const [weaponSearchTerm, setWeaponSearchTerm] = useState(''); // For weapon search

  // Mission management states
  const [missionStates, setMissionStates] = useState({}); // { missionId: { loading, showLoginModal } }

  // Use shared user context
  const { user, incrementStats } = useUser();

  const cardRef = useRef(null);

  if (!airport || !airport.data) {
    return null;
  }

  // Check if charts are available when card is expanded
  useEffect(() => {
    if (expanded && chartsAvailable === null) {
      checkChartsAvailable(airport.id).then(setChartsAvailable);
    }
  }, [expanded, airport.id, chartsAvailable]);

  // Expand and scroll into view when a mission is selected from the map
  useEffect(() => {
    if (shouldExpand) {
      setExpanded(true);
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [shouldExpand, expandToken]);

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
      alert(t('airportCard.alerts.selectWeapon'));
      return;
    }

    try {
      await api.createOrder(airport.id, selectedWeapon, orderQuantity);
      setShowOrderModal(false);
      setSelectedWeapon('');
      setOrderQuantity(100);
      alert(t('airportCard.alerts.orderSuccess'));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(t('airportCard.alerts.orderError', { message: error.message }));
    }
  };

  // Handle mission accept
  const handleAcceptMission = async (missionId) => {
    // Controlla se l'utente è autenticato
    if (!user) {
      const state = missionStates[missionId] || {};
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, showLoginModal: true } }));
      return;
    }

    // Usa il nome Discord dell'utente
    const userName = user.globalName || user.username;

    const state = missionStates[missionId] || {};
    setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: true } }));
    try {
      await api.acceptMission(missionId, userName);
      setMissionStates(prev => ({ ...prev, [missionId]: { loading: false, showLoginModal: false } }));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(t('airportCard.alerts.acceptError', { message: error.message }));
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
    }
  };

  // Handle login redirect
  const handleLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  // Handle mission complete
  const handleCompleteMission = async (missionId) => {
    if (!confirm(t('general.prompts.confirmComplete'))) return;

    const state = missionStates[missionId] || {};
    setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: true } }));
    try {
      await api.completeMission(missionId);
      if (user) {
        const mission = missions.find(m => m.id === missionId);
        const ordersCount = getMissionOrders(mission || {}).length || 1;
        incrementStats({ ordersCompleted: ordersCount });
      }
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(t('airportCard.alerts.completeError', { message: error.message }));
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
    }
  };

  // Handle mission cancel
  const handleCancelMission = async (missionId) => {
    if (!confirm(t('general.prompts.confirmCancel'))) return;

    const state = missionStates[missionId] || {};
    setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: true } }));
    try {
      await api.cancelMission(missionId);
      setMissionStates(prev => ({ ...prev, [missionId]: { ...state, loading: false } }));
      if (onMissionsUpdate) onMissionsUpdate();
    } catch (error) {
      alert(t('airportCard.alerts.cancelError', { message: error.message }));
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

  // Check if this airport is a heliport or carrier
  const isHeliport = airport.isHeliport || false;
  const isCarrier = airport.isCarrier || false;

  // Get list of ALL important weapons for this base type (same logic as backend)
  const allImportantWeapons = isCarrier
    ? importantWeaponsCarriers
    : isHeliport
    ? importantWeaponsHeliports
    : [...importantWeaponsAirports, ...importantWeaponsHeliports];

  // Calculate stats including missing/zero quantity weapons
  const stats = {
    critical: 0,
    high: 0,
    medium: 0,
    ok: 0,
  };

  // Check each important weapon (including those missing or at 0)
  allImportantWeapons.forEach(weaponId => {
    // Find weapon in current inventory
    const weaponData = weapons.find(w => w.item === weaponId);
    const currentQuantity = weaponData ? weaponData.quantity : 0;

    // Calculate status
    const status = getWeaponStatus(currentQuantity, true); // true = isImportant

    if (status === 'critical') stats.critical++;
    else if (status === 'high') stats.high++;
    else if (status === 'medium') stats.medium++;
    else stats.ok++;
  });

  // Filter weapons
  let filteredWeapons = weapons;
  if (filter === 'critical') {
    filteredWeapons = weapons.filter(w => {
      const isImportant = isImportantWeapon(w.item, isHeliport, isCarrier);
      const status = getWeaponStatus(w.quantity, isImportant);
      return status === 'critical';
    });
  } else if (filter === 'important') {
    filteredWeapons = weapons.filter(w => isImportantWeapon(w.item, isHeliport, isCarrier));
  }

  // Apply weapon search filter
  if (weaponSearchTerm.trim()) {
    const searchLower = weaponSearchTerm.toLowerCase();
    filteredWeapons = filteredWeapons.filter(w => {
      const displayName = getWeaponDisplayName(w.item).toLowerCase();
      return displayName.includes(searchLower);
    });

    // Auto-select weapon in chart when filtered to single result
    if (filteredWeapons.length === 1) {
      const singleWeapon = filteredWeapons[0];
      if (isImportantWeapon(singleWeapon.item, isHeliport, isCarrier) && chartWeapon !== singleWeapon.item) {
        setChartWeapon(singleWeapon.item);
      }
    }
  }

  // Sort by status (critical first), then by quantity (lowest first)
  filteredWeapons = [...filteredWeapons].sort((a, b) => {
    const isImportantA = isImportantWeapon(a.item, isHeliport, isCarrier);
    const isImportantB = isImportantWeapon(b.item, isHeliport, isCarrier);
    const statusA = getWeaponStatus(a.quantity, isImportantA);
    const statusB = getWeaponStatus(b.quantity, isImportantB);

    const priority = { critical: 0, high: 1, medium: 2, ok: 3, normal: 4 };
    const priorityDiff = priority[statusA] - priority[statusB];

    // If same priority, sort by quantity (lowest first)
    if (priorityDiff === 0) {
      return a.quantity - b.quantity;
    }

    return priorityDiff;
  });

  const airportMissions = missions.filter(m => m.airport_id === airport.id);
  return (
    <div
      ref={cardRef}
      className="bg-yt-bg-secondary rounded-lg border-2 border-yt-border overflow-hidden hover:shadow-xl transition-all"
    >
      {/* Header */}
      <div
        className="p-3 cursor-pointer hover:bg-yt-bg-tertiary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {isCarrier ? (
              <Anchor className="w-5 h-5 text-green-500" />
            ) : isHeliport ? (
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
          {/* Active Orders Section - When there are missions */}
          {!airport.isMainBase && airportMissions.length > 0 && (
            <div className="p-3 bg-fuchsia-500/10 border-t-2 border-fuchsia-500/40">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-fuchsia-300 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  {t('airportCard.activeOrders')} ({airportMissions.length})
                </h4>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={handleGeneratePDF}
                    disabled={generatingPDF || chartsAvailable === false}
                    className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                      generatingPDF
                        ? 'bg-yt-accent/20 text-yt-accent border border-yt-accent/50 cursor-wait'
                        : chartsAvailable === false
                        ? 'bg-yt-bg-tertiary text-yt-text-secondary border border-yt-border cursor-not-allowed'
                        : 'bg-yt-accent/20 text-yt-accent border border-yt-accent/50 hover:bg-yt-accent/30'
                    }`}
                    title={chartsAvailable === false ? t('airportCard.pdfUnavailable') : ''}
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{generatingPDF ? 'PDF...' : chartsAvailable === null ? t('general.loading') : 'PDF'}</span>
                  </button>
                  <button
                    onClick={() => setShowOrderModal(true)}
                    className="px-3 py-1.5 bg-green-400/20 text-green-400 border border-green-400/50 hover:bg-green-400/30 rounded text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t('airportCard.refuel')}</span>
                  </button>
                </div>
              </div>

              <div className={`grid gap-3 ${airportMissions.length === 1 ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-2'}`}>
                {airportMissions.sort((a, b) => {
                  // Sort by priority: CRITICAL > HIGH > MEDIUM
                  return getMissionPriorityRank(a) - getMissionPriorityRank(b);
                }).map(mission => {
                  const sourceName = mission.source_airport_id ? getAirportName(mission.source_airport_id) : 'Main Base';
                  const sourceAirport = mission.source_airport_id ? airports.find(a => a.id === mission.source_airport_id) : null;
                  const distance = mission.distance_nm ? `${mission.distance_nm}nm` : '-';
                  const timeAgo = getTimeAgo(mission.created_at);
                  const expiresIn = getTimeRemaining(mission.expires_at);
                  const state = missionStates[mission.id] || { loading: false, showLoginModal: false };
                  const { orders, totalWeight } = getMissionTotals(mission);
                  const missionPriority = getMissionPriority(mission);
                  const title = getMissionTitle(mission);
                  const isoPlan = buildIsoContainerPlan(orders);

                  return (
                    <div key={mission.id} className="bg-yt-bg-secondary p-3 rounded-lg border-2 border-fuchsia-500/30">
                      {/* Header: weapon name, time, and priority */}
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-yt-text-primary font-mono truncate">{title}</h3>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Clock className="w-3.5 h-3.5 text-yt-text-secondary" />
                            <span className="text-xs text-yt-text-secondary">{timeAgo}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wide flex-shrink-0 ml-2 ${
                          mission.status === 'pending'
                            ? missionPriority === 'critical'
                              ? 'bg-red-400/20 text-red-400 border border-red-400/50'
                              : missionPriority === 'high'
                              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/50'
                              : 'bg-yellow-400/20 text-yellow-400 border border-yellow-400/50'
                            : mission.status === 'accepted'
                            ? 'bg-yt-accent/20 text-yt-accent'
                            : 'bg-yt-bg-primary/50 text-yt-text-secondary'
                        }`}>
                          {mission.status === 'pending'
                            ? missionPriority === 'critical'
                              ? getStatusLabel('critical')
                              : missionPriority === 'high'
                              ? getStatusLabel('high')
                              : getStatusLabel('medium')
                            : mission.status === 'accepted'
                            ? getStatusLabel('accepted')
                            : mission.status.toUpperCase()}
                        </span>
                      </div>

                      {/* Route Information */}
                      <div className="flex items-center gap-1 text-xs bg-yt-bg-tertiary px-2 py-1.5 rounded mb-2 flex-wrap">
                        {!sourceAirport ? (
                          <span className="text-fuchsia-400 font-medium truncate">{sourceName}</span>
                        ) : sourceAirport.isMainBase ? (
                          <span className="text-fuchsia-400 font-medium truncate">{sourceName}</span>
                        ) : sourceAirport.isCarrier ? (
                          <>
                            <Anchor className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-green-500 font-medium truncate">{sourceName}</span>
                          </>
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
                        {isCarrier ? (
                          <>
                            <Anchor className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                            <span className="text-green-500 font-medium truncate">{airport.displayName || airport.name}</span>
                          </>
                        ) : isHeliport ? (
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

                        {/* Recommended Aircraft inline */}
                          {mission.recommended_aircraft && (
                            <>
                              <span className="text-yt-border flex-shrink-0">•</span>
                              {mission.recommended_aircraft === 'helicopter' && (
                                <>
                                  <Helicopter className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                                  <span className="text-cyan-400 font-medium flex-shrink-0">{t('airportCard.recommended.helicopter')}</span>
                                </>
                              )}
                              {mission.recommended_aircraft === 'airplane' && (
                                <>
                                  <Plane className="w-3.5 h-3.5 text-yt-accent flex-shrink-0" />
                                  <span className="text-yt-accent font-medium flex-shrink-0">{t('airportCard.recommended.airplane')}</span>
                                </>
                              )}
                              {mission.recommended_aircraft === 'airdrop' && (
                                <>
                                  <Package className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                                  <span className="text-orange-400 font-medium flex-shrink-0">{t('airportCard.recommended.airdrop')}</span>
                                </>
                              )}
                            </>
                          )}
                      </div>

                      {/* Orders list */}
                      <div className="space-y-1 mb-2">
                        {orders.map(order => (
                          <div key={order.weapon_id} className="flex items-center justify-between bg-yt-bg-tertiary rounded px-2 py-1 text-xs">
                            <span className="text-yt-text-primary font-mono">{getWeaponDisplayName(order.weapon_id)}</span>
                            <span className="text-yt-text-secondary">
                              {t('airportCard.filters.stocks')}: <span className="text-red-400 font-bold">{order.current_quantity ?? '-'}</span>
                              {' '}| {t('airportCard.filters.requested')}: <span className="text-green-400 font-bold">{order.quantity_needed ?? '-'}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Cargo summary */}
                      <div className="flex gap-2 mb-2">
                        <div className="flex-1 bg-yt-bg-tertiary rounded p-1.5 text-center">
                          <div className="text-[10px] text-yt-text-secondary mb-0.5">Ordini</div>
                          <div className="text-base font-bold text-yt-text-primary">{orders.length}</div>
                        </div>
                        {totalWeight > 0 && (
                          <div className="flex-[2] bg-yt-bg-tertiary rounded p-1.5 flex items-center justify-center gap-1.5">
                            <Weight className="w-4 h-4 text-yt-text-primary" />
                            <span className="text-base font-bold text-yt-text-primary font-mono">{formatWeight(totalWeight)}</span>
                          </div>
                        )}
                      </div>

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
                                    {container.items.map((item, idx) => (
                                      <div key={`${item.weapon_id}-${idx}`} className="flex items-center justify-between text-[10px]">
                                        <span className="text-yt-text-primary font-mono">{getWeaponDisplayName(item.weapon_id)}</span>
                                        <span className="text-yt-text-secondary font-mono">{formatIsoUnits(item.units)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {isoPlan.overflow.length > 0 && (
                          <div className="mt-2 text-[10px] text-orange-400">
                            {t('missionDispatch.iso.overflow')} {isoPlan.overflow.map(item => `${getWeaponDisplayName(item.weapon_id)} (${formatIsoUnits(item.units)})`).join(', ')}
                          </div>
                        )}
                      </div>

                      {/* Pilot info for accepted missions */}
                      {mission.status === 'accepted' && mission.accepted_by && (
                        <div className="flex items-center gap-1.5 text-xs bg-yt-bg-tertiary px-2 py-1.5 rounded mb-2">
                          <User className="w-3.5 h-3.5 text-yt-text-secondary" />
                          <span className="text-yt-text-secondary">{t('airportCard.orders.pilot')}</span>
                          <span className="text-yt-text-primary font-bold">{mission.accepted_by}</span>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {mission.status === 'pending' && (
                          <button
                            onClick={() => handleAcceptMission(mission.id)}
                            disabled={state.loading}
                            className="flex-1 px-3 py-1.5 bg-green-400/20 text-green-400 border border-green-400/50 hover:bg-green-400/30 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary disabled:border-yt-border rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t('general.buttons.accept')}
                          </button>
                        )}

                        {mission.status === 'accepted' && (
                          <button
                            onClick={() => handleCompleteMission(mission.id)}
                            disabled={state.loading}
                            className="flex-1 px-3 py-1.5 bg-yt-accent hover:bg-yt-accent/80 disabled:bg-yt-bg-tertiary text-white rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {t('general.buttons.complete')}
                          </button>
                        )}

                        <button
                          onClick={() => handleCancelMission(mission.id)}
                          disabled={state.loading}
                          className="px-3 py-1.5 bg-red-400/20 text-red-400 border border-red-400/50 hover:bg-red-400/30 disabled:bg-yt-bg-tertiary disabled:text-yt-text-secondary disabled:border-yt-border rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">{t('general.buttons.cancel')}</span>
                        </button>
                      </div>

                      {/* Login Required Modal */}
                      {state.showLoginModal && (
                        <LoginRequiredModal
                          onClose={() => setMissionStates(prev => ({ ...prev, [mission.id]: { ...state, showLoginModal: false } }))}
                          onLogin={handleLogin}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons - When there are NO missions OR is main base */}
          {(airport.isMainBase || airportMissions.length === 0) && (
            <div className="p-3 border-t border-yt-border bg-yt-bg-tertiary/30">
              <div className="flex gap-2 justify-end">
                <button
                  onClick={handleGeneratePDF}
                  disabled={generatingPDF || chartsAvailable === false}
                  className={`px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-all ${
                    generatingPDF
                      ? 'bg-yt-accent/20 text-yt-accent border border-yt-accent/50 cursor-wait'
                      : chartsAvailable === false
                      ? 'bg-yt-bg-tertiary text-yt-text-secondary border border-yt-border cursor-not-allowed'
                      : 'bg-yt-accent/20 text-yt-accent border border-yt-accent/50 hover:bg-yt-accent/30'
                  }`}
                  title={chartsAvailable === false ? t('airportCard.pdfUnavailable') : ''}
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{generatingPDF ? 'PDF...' : chartsAvailable === null ? t('general.loading') : 'PDF'}</span>
                </button>
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="px-3 py-1.5 bg-green-400/20 text-green-400 border border-green-400/50 hover:bg-green-400/30 rounded text-xs font-bold flex items-center gap-1.5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t('airportCard.refuel')}</span>
                </button>
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
                  {t('airportCard.headers.weapons')}
                </h4>
                {/* Weapon Search Bar */}
                <div className="mb-2 relative">
                  <input
                    type="text"
                    placeholder="Cerca arma..."
                    value={weaponSearchTerm}
                    onChange={(e) => setWeaponSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 pl-9 bg-yt-bg-primary border border-yt-border rounded text-yt-text-primary placeholder-yt-text-secondary text-sm focus:outline-none focus:border-yt-accent transition-all"
                  />
                  <Search className="w-4 h-4 text-yt-text-secondary absolute left-2.5 top-1/2 -translate-y-1/2" />
                </div>
                <div className="max-h-96 overflow-y-auto border border-yt-border rounded">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-yt-bg-secondary border-b border-yt-border z-10">
                      <tr className="text-left text-yt-text-secondary">
                        <th className="p-2">{t('airportCard.headers.weapon')}</th>
                        <th className="p-2 text-right">{t('airportCard.headers.quantity')}</th>
                        <th className="p-2">{t('airportCard.headers.status')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredWeapons.map((weapon, idx) => {
                        const isImportant = isImportantWeapon(weapon.item, isHeliport, isCarrier);
                        const status = getWeaponStatus(weapon.quantity, isImportant);
                        const isSelected = chartWeapon === weapon.item;

                        return (
                          <tr
                            key={idx}
                            onClick={() => {
                              if (isImportant) {
                                setChartWeapon(weapon.item);
                              }
                            }}
                            className={`border-b border-yt-border transition-colors ${
                              isImportant
                                ? 'cursor-pointer hover:bg-yt-bg-tertiary/50'
                                : 'opacity-60'
                            } ${
                              isSelected ? 'bg-yt-accent/20' : ''
                            }`}
                          >
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
                  {t('airportCard.headers.liquids')}
                </h4>
                <div className="grid grid-cols-2 gap-3 h-96">
                  {liquids.map((liquid, idx) => (
                    <div key={idx} className="bg-yt-bg-tertiary p-4 rounded border border-yt-border flex flex-col justify-center items-center">
                      <div className="text-sm text-yt-text-secondary mb-2">{`${t('airportCard.headers.type')} ${liquid.item}`}</div>
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
                {t('airportCard.headers.historical')}
              </h4>
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
                <p className="text-yt-text-primary text-xs">{t('airportCard.headers.selectWeaponInfo')}</p>
                <p className="text-[10px] text-yt-text-secondary mt-1.5">{t('airportCard.headers.dataFrequency')}</p>
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
                {t('airportCard.modal.title')}
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-yt-text-secondary hover:text-yt-text-primary transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Airport Info */}
              <div className="bg-yt-bg-primary p-3 rounded">
                <div className="text-xs text-yt-text-secondary">{t('airportCard.modal.airport')}</div>
                <div className="text-yt-text-primary font-bold">{airport.displayName || airport.name}</div>
              </div>

              {/* Weapon Selection */}
              <div>
                <label className="block text-xs text-yt-text-secondary mb-1.5 font-medium">{t('airportCard.modal.selectWeapon')}</label>
                <select
                  value={selectedWeapon}
                  onChange={(e) => handleWeaponSelect(e.target.value)}
                  className="w-full bg-yt-bg-primary text-yt-text-primary border border-yt-border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-400 transition-all"
                >
                  <option value="">{t('airportCard.modal.selectWeapon')}</option>
                  {weapons.map((weapon, idx) => {
                    const status = getWeaponStatus(weapon.quantity, isImportantWeapon(weapon.item, isHeliport, isCarrier));
                    const priorityLabel = status === 'critical' ? '🔴 CRITICAL' : status === 'high' ? '🟠 HIGH' : status === 'medium' ? '🟡 MEDIUM' : '';
                    return (
                      <option key={idx} value={weapon.item}>
                        {getWeaponDisplayName(weapon.item)} ({t('airportCard.headers.quantity')}: {weapon.quantity}) {priorityLabel}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Quantity Input */}
              <div>
                <label className="block text-xs text-yt-text-secondary mb-1.5 font-medium">
                  {t('airportCard.modal.quantityLabel')}
                  {selectedWeapon && (
                    <span className="text-xs text-yt-text-secondary/60 ml-2">
                      ({t('airportCard.modal.suggested', { value: getSuggestedQuantity(selectedWeapon) })})
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
                  {t('airportCard.orderButton')}
                </button>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary font-bold py-2 px-4 rounded text-sm transition-all"
                >
                  {t('airportCard.cancelButton')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
