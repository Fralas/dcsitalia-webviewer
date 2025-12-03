import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Package, Droplet, Plane, Plus, X } from 'lucide-react';
import { createOrder } from '../services/api';

/**
 * Get weapon display name (remove prefix)
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

/**
 * Get status for weapon quantity
 */
function getWeaponStatus(quantity, isImportant) {
  if (!isImportant) return 'normal';
  if (quantity <= 5) return 'critical';
  if (quantity <= 20) return 'high';
  if (quantity <= 50) return 'medium';
  return 'ok';
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const styles = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    high: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    ok: 'bg-green-500/20 text-green-400 border-green-500/50',
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
export default function AirportCard({ airport, missions = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [filter, setFilter] = useState('all'); // all, critical, important
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedWeapon, setSelectedWeapon] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(100);

  if (!airport || !airport.data) {
    return null;
  }

  const { weapons = [], liquids = [] } = airport.data;

  // Get suggested quantity based on priority
  const getSuggestedQuantity = (weaponId) => {
    const weapon = weapons.find(w => w.item === weaponId);
    if (!weapon) return 100;

    const quantity = weapon.quantity;
    if (quantity <= 5) return 150;  // CRITICAL
    if (quantity <= 20) return 100; // HIGH
    if (quantity <= 50) return 50;  // MEDIUM
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
      await createOrder(airport.id, selectedWeapon, orderQuantity);
      setShowOrderModal(false);
      setSelectedWeapon('');
      setOrderQuantity(100);
      alert('Ordine creato con successo!');
    } catch (error) {
      alert('Errore nella creazione dell\'ordine: ' + error.message);
    }
  };

  // Important weapons (from config)
  const importantWeaponIds = [
    'weapons.missiles.AIM_120C', 'weapons.missiles.AIM_9X', 'weapons.missiles.AGM_65F',
    'weapons.missiles.AGM_88', 'weapons.missiles.AGM_154A', 'weapons.missiles.AGM_122',
    'weapons.missiles.AGM_65G', 'weapons.missiles.AGM_65H', 'weapons.missiles.AGM_65D',
    'weapons.missiles.RB75', 'weapons.missiles.X_58', 'weapons.missiles.X_29T',
    'weapons.missiles.AGM_65A', 'weapons.missiles.S_25L', 'weapons.missiles.LD_10',
    'weapons.missiles.Kh25MP_PRGS1VP', 'weapons.nurs.C_13', 'weapons.nurs.C_8OFP2',
    'weapons.nurs.HYDRA_70_M151', 'weapons.nurs.FFAR Mk5 HEAT', 'weapons.nurs.AGR_20_M282',
    'weapons.nurs.AGR_20A', 'weapons.missiles.BRM-1_90MM', 'weapons.containers.AN_ASQ_228',
    'weapons.droptanks.FPU_8A', 'weapons.bombs.GBU_16',
  ];

  // Calculate stats
  const stats = {
    critical: 0,
    high: 0,
    medium: 0,
    ok: 0,
  };

  weapons.forEach(weapon => {
    const isImportant = importantWeaponIds.includes(weapon.item);
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
      const isImportant = importantWeaponIds.includes(w.item);
      const status = getWeaponStatus(w.quantity, isImportant);
      return status === 'critical';
    });
  } else if (filter === 'important') {
    filteredWeapons = weapons.filter(w => importantWeaponIds.includes(w.item));
  }

  // Sort by status (critical first)
  filteredWeapons = [...filteredWeapons].sort((a, b) => {
    const isImportantA = importantWeaponIds.includes(a.item);
    const isImportantB = importantWeaponIds.includes(b.item);
    const statusA = getWeaponStatus(a.quantity, isImportantA);
    const statusB = getWeaponStatus(b.quantity, isImportantB);

    const priority = { critical: 0, high: 1, medium: 2, ok: 3, normal: 4 };
    return priority[statusA] - priority[statusB];
  });

  const airportMissions = missions.filter(m => m.airport_id === airport.id);
  const cardBorderClass = stats.critical > 0 ? 'border-red-500 pulse-border-critical' : stats.high > 0 ? 'border-orange-500' : stats.medium > 0 ? 'border-yellow-500' : 'border-gray-700';

  return (
    <div className={`bg-slate-800 rounded-lg border-2 ${cardBorderClass} overflow-hidden hover:shadow-xl transition-shadow`}>
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Plane className="w-6 h-6 text-blue-400" />
            <div>
              <h3 className="text-lg font-bold text-white">{airport.displayName || airport.name}</h3>
              {airport.isMainBase && (
                <span className="text-xs text-blue-400 font-semibold">MAIN BASE</span>
              )}
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
            {airportMissions.length > 0 && (
              <div className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm font-bold">
                {airportMissions.length} ordini
              </div>
            )}
            {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-700">
          {/* Filters */}
          <div className="p-4 bg-slate-900/50 flex gap-2 justify-between items-center">
            <div className="flex gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded text-sm ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
              >
                All ({weapons.length})
              </button>
              <button
                onClick={() => setFilter('important')}
                className={`px-3 py-1 rounded text-sm ${filter === 'important' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
              >
                Important ({importantWeaponIds.filter(id => weapons.find(w => w.item === id)).length})
              </button>
              <button
                onClick={() => setFilter('critical')}
                className={`px-3 py-1 rounded text-sm ${filter === 'critical' ? 'bg-blue-600 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}`}
              >
                Critical ({stats.critical})
              </button>
            </div>
            {!airport.isMainBase && (
              <button
                onClick={() => setShowOrderModal(true)}
                className="px-3 py-1 rounded text-sm bg-green-600 text-white hover:bg-green-700 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Richiedi Rifornimento
              </button>
            )}
          </div>

          {/* Active Orders Section */}
          {!airport.isMainBase && airportMissions.length > 0 && (
            <div className="p-4 bg-purple-900/20 border-t border-purple-500/30">
              <h4 className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" />
                ORDINI ATTIVI ({airportMissions.length})
              </h4>
              <div className="space-y-2">
                {airportMissions.map(mission => (
                  <div key={mission.id} className="bg-slate-800 p-3 rounded flex justify-between items-center">
                    <div>
                      <div className="font-mono text-sm text-white">{getWeaponDisplayName(mission.weapon_id)}</div>
                      <div className="text-xs text-gray-400">
                        Quantità richiesta: <span className="font-bold text-white">{mission.quantity_needed}</span> |
                        Attuale: <span className="font-bold text-orange-400">{mission.current_quantity}</span>
                      </div>
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded text-xs ${
                        mission.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                        mission.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {mission.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Liquids Section */}
          <div className="p-4 bg-slate-900/30">
            <h4 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
              <Droplet className="w-4 h-4" />
              LIQUIDS
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {liquids.map((liquid, idx) => (
                <div key={idx} className="bg-slate-800 p-2 rounded">
                  <div className="text-xs text-gray-400">Type {liquid.item}</div>
                  <div className="text-lg font-bold text-white">{liquid.quantity.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weapons Section */}
          <div className="p-4">
            <h4 className="text-sm font-bold text-gray-400 mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              WEAPONS & MUNITIONS
            </h4>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-800 border-b border-gray-700">
                  <tr className="text-left text-gray-400">
                    <th className="p-2">Weapon</th>
                    <th className="p-2 text-right">Quantity</th>
                    <th className="p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredWeapons.map((weapon, idx) => {
                    const isImportant = importantWeaponIds.includes(weapon.item);
                    const status = getWeaponStatus(weapon.quantity, isImportant);

                    return (
                      <tr key={idx} className="border-b border-gray-800 hover:bg-slate-700/50">
                        <td className="p-2 font-mono text-xs">{getWeaponDisplayName(weapon.item)}</td>
                        <td className="p-2 text-right font-bold">{weapon.quantity}</td>
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
        </div>
      )}

      {/* Order Creation Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setShowOrderModal(false)}>
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border-2 border-green-500" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-green-400" />
                Richiedi Rifornimento
              </h3>
              <button onClick={() => setShowOrderModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Airport Info */}
              <div className="bg-slate-900 p-3 rounded">
                <div className="text-xs text-gray-400">Aeroporto</div>
                <div className="text-white font-bold">{airport.displayName || airport.name}</div>
              </div>

              {/* Weapon Selection */}
              <div>
                <label className="block text-sm text-gray-300 mb-2">Seleziona Arma</label>
                <select
                  value={selectedWeapon}
                  onChange={(e) => handleWeaponSelect(e.target.value)}
                  className="w-full bg-slate-900 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
                >
                  <option value="">-- Seleziona --</option>
                  {weapons.map((weapon, idx) => {
                    const status = getWeaponStatus(weapon.quantity, importantWeaponIds.includes(weapon.item));
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
                <label className="block text-sm text-gray-300 mb-2">
                  Quantità da Ordinare
                  {selectedWeapon && (
                    <span className="text-xs text-gray-500 ml-2">
                      (Suggerito: {getSuggestedQuantity(selectedWeapon)})
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 0)}
                  min="1"
                  className="w-full bg-slate-900 text-white border border-gray-600 rounded px-3 py-2 focus:outline-none focus:border-green-500"
                  placeholder="100"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  Crea Ordine
                </button>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
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
