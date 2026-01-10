import { useState, useEffect } from 'react';
import { Target, Plane, AlertTriangle, CheckCircle, XCircle, LogIn, ChevronDown, ChevronUp, Plus } from 'lucide-react';
import * as api from '../services/api';
import { useUser } from '../contexts/UserContext';
import socketService from '../services/socket';

/**
 * Get priority badge color and label
 */
function PriorityBadge({ priority, priorityLabel }) {
  let color;
  switch (priority) {
    case 1: // Massima
      color = 'bg-red-500/20 text-red-400 border-red-500';
      break;
    case 2: // Elevata
      color = 'bg-orange-500/20 text-orange-400 border-orange-500';
      break;
    case 3: // Alta
      color = 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
      break;
    case 4: // Media
      color = 'bg-blue-500/20 text-blue-400 border-blue-500';
      break;
    case 5: // Bassa
      color = 'bg-green-500/20 text-green-400 border-green-500';
      break;
    default:
      color = 'bg-gray-500/20 text-gray-400 border-gray-500';
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-bold border ${color}`}>
      {priorityLabel}
    </span>
  );
}

/**
 * Get task type badge
 */
function TaskBadge({ taskType }) {
  let color, label;
  switch (taskType) {
    case 'LOGISTICS':
      color = 'bg-green-500/20 text-green-300 border-green-500';
      label = 'LOGISTICS';
      break;
    case 'SEAD':
      color = 'bg-purple-500/20 text-purple-300 border-purple-500';
      label = 'SEAD';
      break;
    case 'DEAD':
      color = 'bg-red-500/20 text-red-300 border-red-500';
      label = 'DEAD';
      break;
    case 'CAS':
      color = 'bg-blue-500/20 text-blue-300 border-blue-500';
      label = 'CAS';
      break;
    default:
      color = 'bg-gray-500/20 text-gray-300 border-gray-500';
      label = taskType;
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold border ${color}`}>
      {label}
    </span>
  );
}

/**
 * Get status badge
 */
function StatusBadge({ status }) {
  let color, text, icon;
  switch (status) {
    case 'NEUTRAL':
      color = 'bg-white/20 text-white border-gray-400';
      text = 'Neutrale';
      icon = <AlertTriangle className="w-3 h-3" />;
      break;
    case 'UNDER_ATTACK':
      color = 'bg-orange-500/20 text-orange-400 border-orange-500';
      text = 'Attacco';
      icon = <AlertTriangle className="w-3 h-3" />;
      break;
    case 'RED':
      color = 'bg-red-500/20 text-red-400 border-red-500';
      text = 'Rosso';
      icon = <Target className="w-3 h-3" />;
      break;
    case 'BLUE':
      color = 'bg-blue-500/20 text-blue-400 border-blue-500';
      text = 'Blu';
      icon = <Target className="w-3 h-3" />;
      break;
    default:
      color = 'bg-gray-500/20 text-gray-400 border-gray-500';
      text = status;
      icon = <Target className="w-3 h-3" />;
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold border ${color} flex items-center gap-1`}>
      {icon}
      {text}
    </span>
  );
}

/**
 * Login Required Modal
 */
function LoginRequiredModal({ onClose, onLogin }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
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
 * Aircraft Selection Modal
 */
function AircraftSelectionModal({ mission, onClose, onConfirm, user }) {
  const [aircraft, setAircraft] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!aircraft.trim()) return;

    setLoading(true);
    try {
      const pilotName = user.globalName || user.username;
      await api.assignCombatMission(mission.id, pilotName, aircraft.trim());
      onConfirm();
      onClose();
    } catch (error) {
      alert('Errore nell\'assegnare la missione: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div className="relative bg-yt-bg-secondary border-2 border-yt-accent rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Plane className="w-6 h-6 text-yt-accent" />
            <h3 className="text-xl font-bold text-yt-text-primary">
              Seleziona Aereo
            </h3>
          </div>
          <p className="text-sm text-yt-text-secondary">
            Missione: {mission.zone_name}
          </p>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {mission.tasks && mission.tasks.map((task, idx) => (
              <TaskBadge key={idx} taskType={task} />
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-yt-text-primary mb-2">
              Che aereo stai usando?
            </label>
            <input
              type="text"
              value={aircraft}
              onChange={(e) => setAircraft(e.target.value)}
              placeholder="Es: F-16C, A-10C, F/A-18C..."
              className="w-full px-3 py-2 bg-yt-bg-tertiary border border-yt-border rounded text-yt-text-primary focus:border-yt-accent focus:outline-none"
              autoFocus
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !aircraft.trim()}
              className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-bold transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              {loading ? 'Assegnando...' : 'Accetta Missione'}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded font-medium transition-all"
            >
              Annulla
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Add User Modal - Select from mock users to add to mission
 */
function AddUserModal({ mission, onClose, onConfirm }) {
  const [mockUsers, setMockUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [aircraft, setAircraft] = useState('');
  const [isDevelopment, setIsDevelopment] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        // Use logged-in users in production, mock users in development
        const isDevEnv = import.meta.env.DEV || window.location.hostname === 'localhost';
        setIsDevelopment(isDevEnv);

        const users = isDevEnv
          ? await api.getMockUsers()
          : await api.getLoggedInUsers();

        // Filter out users already assigned to the mission
        const availableUsers = users.filter(
          u => !mission.assigned_users.some(au => au.name === u.globalName)
        );
        setMockUsers(availableUsers);
      } catch (error) {
        console.error('Error fetching users:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [mission]);

  const handleAddUser = async () => {
    if (!selectedUser) return;

    // In production, require aircraft input
    const userAircraft = isDevelopment ? selectedUser.aircraft : aircraft.trim();
    if (!userAircraft) {
      alert('Inserisci un aereo per il pilota');
      return;
    }

    setLoading(true);
    try {
      await api.addUserToCombatMission(mission.id, selectedUser.globalName, userAircraft);
      onConfirm();
      onClose();
    } catch (error) {
      alert('Errore nell\'aggiungere l\'utente: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      ></div>

      <div className="relative bg-yt-bg-secondary border-2 border-yt-accent rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Plus className="w-6 h-6 text-yt-accent" />
            <h3 className="text-xl font-bold text-yt-text-primary">
              Aggiungi Pilota
            </h3>
          </div>
          <p className="text-sm text-yt-text-secondary">
            Missione: {mission.zone_name}
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8 text-yt-text-secondary">
            Caricamento piloti...
          </div>
        ) : mockUsers.length === 0 ? (
          <div className="text-center py-8 text-yt-text-secondary">
            Nessun pilota disponibile
          </div>
        ) : (
          <>
            <div className="mb-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {mockUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full px-4 py-3 rounded border transition-all text-left ${
                      selectedUser?.id === user.id
                        ? 'bg-yt-accent border-yt-accent text-yt-bg-primary'
                        : 'bg-yt-bg-tertiary border-yt-border text-yt-text-primary hover:border-yt-accent'
                    }`}
                  >
                    <div className="font-semibold">{user.globalName}</div>
                    {user.aircraft && (
                      <div className="text-sm opacity-75">{user.aircraft}</div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Aircraft input - only in production */}
            {!isDevelopment && selectedUser && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-yt-text-primary mb-2">
                  Aereo di {selectedUser.globalName}
                </label>
                <input
                  type="text"
                  value={aircraft}
                  onChange={(e) => setAircraft(e.target.value)}
                  placeholder="Es: F-16C, A-10C, F/A-18C..."
                  className="w-full px-3 py-2 bg-yt-bg-tertiary border border-yt-border rounded text-yt-text-primary focus:border-yt-accent focus:outline-none"
                  autoFocus
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleAddUser}
                disabled={loading || !selectedUser || (!isDevelopment && !aircraft.trim())}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded font-bold transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                {loading ? 'Aggiungendo...' : 'Aggiungi Pilota'}
              </button>

              <button
                onClick={onClose}
                className="px-4 py-3 bg-yt-bg-tertiary hover:bg-yt-border text-yt-text-primary rounded font-medium transition-all"
              >
                Annulla
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Combat Mission Card Component
 */
function CombatMissionCard({ mission, onUpdate, onAccept, user }) {
  const [showAircraftModal, setShowAircraftModal] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAccept = () => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    setShowAircraftModal(true);
  };

  const handleLogin = () => {
    window.location.href = '/api/auth/discord';
  };

  const handleConfirmAssignment = () => {
    onUpdate();
    if (onAccept) {
      onAccept(); // Notify parent to change filter
    }
  };

  const handleComplete = async () => {
    if (!confirm('Sei sicuro di voler completare questa missione?')) return;

    setLoading(true);
    try {
      await api.completeCombatMission(mission.id);
      onUpdate();
    } catch (error) {
      alert('Errore nel completare la missione: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAbort = async () => {
    if (!confirm('Sei sicuro di voler abortire questa missione?')) return;

    setLoading(true);
    try {
      await api.abortCombatMission(mission.id);
      onUpdate();
    } catch (error) {
      alert('Errore nell\'abortire la missione: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isAvailable = mission.mission_status === 'available';
  const isAssigned = mission.mission_status === 'assigned';
  const isCompleted = mission.mission_status === 'completed';
  const isAborted = mission.mission_status === 'aborted';

  // Get priority colors for header
  let priorityHeaderColor;
  switch (mission.priority) {
    case 1: priorityHeaderColor = 'from-red-500/20 to-red-500/5 border-red-500/30'; break;
    case 2: priorityHeaderColor = 'from-orange-500/20 to-orange-500/5 border-orange-500/30'; break;
    case 3: priorityHeaderColor = 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30'; break;
    case 4: priorityHeaderColor = 'from-blue-500/20 to-blue-500/5 border-blue-500/30'; break;
    case 5: priorityHeaderColor = 'from-green-500/20 to-green-500/5 border-green-500/30'; break;
    default: priorityHeaderColor = 'from-gray-500/20 to-gray-500/5 border-gray-500/30';
  }

  return (
    <>
      <div className={`bg-yt-bg-tertiary rounded-lg overflow-hidden border shadow-lg transition-all ${
        isAvailable ? 'border-yt-border hover:border-yt-accent hover:shadow-xl' :
        isAssigned ? 'border-blue-500/50 shadow-blue-500/20' :
        isCompleted ? 'border-green-500/50 shadow-green-500/20' :
        'border-red-500/50 shadow-red-500/20'
      }`}>
        {/* Header con gradiente priorità */}
        <div className={`bg-gradient-to-r ${priorityHeaderColor} border-b px-3 py-2`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Target className="w-4 h-4 text-yt-accent flex-shrink-0" />
              <h3 className="text-sm font-bold text-yt-text-primary truncate">
                {mission.zone_name}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={mission.status} />
              <PriorityBadge priority={mission.priority} priorityLabel={mission.priority_label} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {/* Tasks */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {mission.tasks && mission.tasks.map((task, idx) => (
              <TaskBadge key={idx} taskType={task} />
            ))}
          </div>

          {/* Coordinates */}
          <div className="flex items-center gap-1.5 mb-3 text-xs text-yt-text-secondary">
            <Target className="w-3 h-3" />
            <span className="font-mono">{mission.coordinates.lat.toFixed(4)}°, {mission.coordinates.lon.toFixed(4)}°</span>
          </div>

          {/* Status piloti */}
          {isAssigned && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2 mb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Plane className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <div className="text-xs text-yt-text-primary flex-1 min-w-0">
                    {mission.assigned_users && mission.assigned_users.length > 0
                      ? mission.assigned_users.map((u, idx) => (
                          <div key={idx} className="truncate">
                            <span className="font-semibold">{u.name}</span>
                            <span className="text-yt-text-secondary ml-1">• {u.aircraft}</span>
                          </div>
                        ))
                      : (
                          <div className="truncate">
                            <span className="font-semibold">{mission.assigned_to}</span>
                            <span className="text-yt-text-secondary ml-1">• {mission.assigned_aircraft}</span>
                          </div>
                        )
                    }
                  </div>
                  {user && (user.globalName === mission.assigned_to || user.username === mission.assigned_to) && (
                    <button
                      onClick={() => setShowAddUserModal(true)}
                      className="flex-shrink-0 w-7 h-7 bg-blue-600 hover:bg-blue-700 rounded-lg flex items-center justify-center transition-all"
                      title="Aggiungi pilota"
                    >
                      <Plus className="w-4 h-4 text-white" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {isCompleted && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 mb-3 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-semibold">Completata</span>
            </div>
          )}

          {isAborted && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3 flex items-center justify-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400 font-semibold">Abortita</span>
            </div>
          )}

          {/* Action buttons */}
          {isAvailable && (
            <button
              onClick={handleAccept}
              disabled={loading}
              className="w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
            >
              <CheckCircle className="w-4 h-4" />
              Accetta Missione
            </button>
          )}

          {isAssigned && user && (user.globalName === mission.assigned_to || user.username === mission.assigned_to) && (
            <div className="flex gap-2">
              <button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                <CheckCircle className="w-4 h-4" />
                Completa
              </button>
              <button
                onClick={handleAbort}
                disabled={loading}
                className="px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded-lg font-bold transition-all flex items-center justify-center gap-2 shadow-md hover:shadow-lg"
              >
                <XCircle className="w-4 h-4" />
                Abortisci
              </button>
            </div>
          )}
        </div>
      </div>

      {showAircraftModal && (
        <AircraftSelectionModal
          mission={mission}
          onClose={() => setShowAircraftModal(false)}
          onConfirm={handleConfirmAssignment}
          user={user}
        />
      )}

      {showLoginModal && (
        <LoginRequiredModal
          onClose={() => setShowLoginModal(false)}
          onLogin={handleLogin}
        />
      )}

      {showAddUserModal && (
        <AddUserModal
          mission={mission}
          onClose={() => setShowAddUserModal(false)}
          onConfirm={onUpdate}
        />
      )}
    </>
  );
}

/**
 * Mission Dispatch Panel Component
 */
export default function MissionDispatchPanel() {
  const [missions, setMissions] = useState([]); // Filtered missions for display
  const [allMissions, setAllMissions] = useState([]); // All missions for counts
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('available'); // available | assigned | all
  const [expanded, setExpanded] = useState(true);
  const { user } = useUser();

  const fetchMissions = async () => {
    setLoading(true);
    try {
      // Fetch all missions for counts
      const allData = await api.getCombatMissions(null);
      setAllMissions(allData);

      // Apply filter for display
      const filteredData = filter === 'all'
        ? allData
        : allData.filter(m => m.mission_status === filter);
      setMissions(filteredData);
    } catch (error) {
      console.error('Error fetching combat missions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();

    // Poll for updates every 30 seconds (fallback)
    const interval = setInterval(fetchMissions, 30000);

    // Listen for real-time updates via WebSocket
    const unsubscribe = socketService.on('combat-missions:updated', (data) => {
      console.log('🎯 Combat missions updated via WebSocket');
      if (data && data.missions) {
        // Store all missions
        setAllMissions(data.missions);

        // Apply current filter to received missions for display
        const filteredMissions = filter === 'all'
          ? data.missions
          : data.missions.filter(m => m.mission_status === filter);
        setMissions(filteredMissions);
        setLoading(false);
      } else {
        // Fallback: fetch missions if data format is unexpected
        fetchMissions();
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [filter]);

  const availableCount = allMissions.filter(m => m.mission_status === 'available').length;
  const assignedCount = allMissions.filter(m => m.mission_status === 'assigned').length;

  // Handle mission acceptance - switch to assigned filter to show the accepted mission
  const handleMissionAccept = () => {
    setFilter('assigned');
  };

  return (
    <div className="bg-yt-bg-secondary rounded-lg border border-yt-border overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-yt-bg-tertiary/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-red-500/20 rounded">
              <Target className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-yt-text-primary">Missioni di Combattimento</h2>
              <p className="text-xs text-yt-text-secondary">
                Dispatch sistema - {availableCount} disponibili, {assignedCount} assegnate
              </p>
            </div>
          </div>
          {expanded ? <ChevronUp className="w-5 h-5 text-yt-text-secondary" /> : <ChevronDown className="w-5 h-5 text-yt-text-secondary" />}
        </div>
      </div>

      {expanded && (
        <>
          {/* Filters */}
          <div className="px-4 pb-3 border-b border-yt-border">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('available')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  filter === 'available'
                    ? 'bg-yt-accent text-yt-bg-primary'
                    : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border'
                }`}
              >
                Disponibili ({availableCount})
              </button>
              <button
                onClick={() => setFilter('assigned')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  filter === 'assigned'
                    ? 'bg-yt-accent text-yt-bg-primary'
                    : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border'
                }`}
              >
                Assegnate ({assignedCount})
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  filter === 'all'
                    ? 'bg-yt-accent text-yt-bg-primary'
                    : 'bg-yt-bg-tertiary text-yt-text-secondary hover:bg-yt-border'
                }`}
              >
                Tutte ({missions.length})
              </button>
            </div>
          </div>

          {/* Mission List */}
          <div className="p-4 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8 text-yt-text-secondary">
                Caricamento missioni...
              </div>
            ) : missions.length === 0 ? (
              <div className="text-center py-8 text-yt-text-secondary">
                Nessuna missione {filter === 'all' ? '' : filter === 'available' ? 'disponibile' : 'assegnata'}
              </div>
            ) : (
              <div className={`grid gap-3 ${missions.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                {missions.map(mission => (
                  <CombatMissionCard
                    key={mission.id}
                    mission={mission}
                    onUpdate={fetchMissions}
                    onAccept={handleMissionAccept}
                    user={user}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
