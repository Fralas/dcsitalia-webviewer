import { useState } from 'react';
import { Plane, Clock, User, CheckCircle, XCircle, AlertTriangle, Package } from 'lucide-react';
import * as api from '../services/api';

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
    color = 'bg-red-500/20 text-red-400 border-red-500';
    text = 'CRITICAL';
  } else if (currentQuantity <= 20) {
    color = 'bg-orange-500/20 text-orange-400 border-orange-500';
    text = 'HIGH';
  } else {
    color = 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    text = 'MEDIUM';
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
function MissionCard({ mission, airports, onUpdate }) {
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [showAccept, setShowAccept] = useState(false);

  const airport = airports.find(a => a.id === mission.airport_id);
  const timeAgo = getTimeAgo(mission.created_at);
  const expiresIn = getTimeRemaining(mission.expires_at);

  const handleAccept = async () => {
    if (!userName.trim()) {
      alert('Please enter your name');
      return;
    }

    setLoading(true);
    try {
      await api.acceptMission(mission.id, userName);
      onUpdate();
      setShowAccept(false);
    } catch (error) {
      alert(`Failed to accept mission: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!confirm('Mark this mission as completed?')) return;

    setLoading(true);
    try {
      await api.completeMission(mission.id);
      onUpdate();
    } catch (error) {
      alert(`Failed to complete mission: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this mission?')) return;

    setLoading(true);
    try {
      await api.cancelMission(mission.id);
      onUpdate();
    } catch (error) {
      alert(`Failed to cancel mission: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`bg-slate-800 rounded-lg border-2 ${mission.status === 'accepted' ? 'border-blue-500' : 'border-gray-700'} p-4`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/20 rounded">
            <Plane className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{airport?.displayName || airport?.name || 'Unknown Airport'}</h3>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Clock className="w-4 h-4" />
              <span>Created {timeAgo}</span>
              <span className="text-gray-600">•</span>
              <span className="text-yellow-400">Expires in {expiresIn}</span>
            </div>
          </div>
        </div>
        <PriorityBadge currentQuantity={mission.current_quantity} />
      </div>

      <div className="bg-slate-900/50 rounded p-3 mb-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-gray-400 mb-1">Weapon</div>
            <div className="font-mono text-white font-bold">{getWeaponDisplayName(mission.weapon_id)}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Current Stock</div>
            <div className="text-2xl font-bold text-red-400">{mission.current_quantity}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Quantity Needed</div>
            <div className="text-2xl font-bold text-green-400">{mission.quantity_needed}</div>
          </div>
          <div>
            <div className="text-gray-400 mb-1">Status</div>
            <div className="flex items-center gap-1">
              {mission.status === 'pending' && (
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold">PENDING</span>
              )}
              {mission.status === 'accepted' && (
                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs font-bold">ACCEPTED</span>
              )}
            </div>
          </div>
        </div>

        {mission.status === 'accepted' && mission.accepted_by && (
          <div className="mt-3 pt-3 border-t border-gray-700 flex items-center gap-2 text-sm">
            <User className="w-4 h-4 text-gray-400" />
            <span className="text-gray-400">Accepted by:</span>
            <span className="text-white font-bold">{mission.accepted_by}</span>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {mission.status === 'pending' && !showAccept && (
          <button
            onClick={() => setShowAccept(true)}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-bold transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Accept Mission
          </button>
        )}

        {mission.status === 'pending' && showAccept && (
          <div className="flex-1 flex gap-2">
            <input
              type="text"
              placeholder="Your name..."
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="flex-1 px-3 py-2 bg-slate-900 border border-gray-700 rounded text-white"
              disabled={loading}
            />
            <button
              onClick={handleAccept}
              disabled={loading}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded font-bold transition-colors"
            >
              Confirm
            </button>
            <button
              onClick={() => setShowAccept(false)}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {mission.status === 'accepted' && (
          <button
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded font-bold transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Complete Mission
          </button>
        )}

        <button
          onClick={handleCancel}
          disabled={loading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white rounded font-bold transition-colors flex items-center justify-center gap-2"
        >
          <XCircle className="w-4 h-4" />
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * Mission Dispatch Component
 */
export default function MissionDispatch({ missions, airports, onUpdate }) {
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
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-slate-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <Package className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Mission Dispatch</h2>
              <p className="text-gray-400">Manage supply missions</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-yellow-400">{stats.pending}</div>
              <div className="text-xs text-gray-400">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{stats.accepted}</div>
              <div className="text-xs text-gray-400">Accepted</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-400">{stats.critical}</div>
              <div className="text-xs text-gray-400">Critical</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded font-bold ${filter === 'all' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
          >
            All ({stats.pending + stats.accepted})
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded font-bold ${filter === 'pending' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
          >
            Pending ({stats.pending})
          </button>
          <button
            onClick={() => setFilter('accepted')}
            className={`px-4 py-2 rounded font-bold ${filter === 'accepted' ? 'bg-purple-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
          >
            Accepted ({stats.accepted})
          </button>
        </div>
      </div>

      {/* Missions List */}
      {filteredMissions.length === 0 ? (
        <div className="bg-slate-800 rounded-lg p-12 text-center border border-gray-700">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-xl text-gray-400">No missions available</p>
          <p className="text-sm text-gray-500 mt-2">Missions will appear here when supplies are low</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMissions.map(mission => (
            <MissionCard
              key={mission.id}
              mission={mission}
              airports={airports}
              onUpdate={onUpdate}
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
