import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Package, Droplet, Plane } from 'lucide-react';

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
  if (quantity <= 20) return 'warning';
  if (quantity <= 50) return 'low';
  return 'ok';
}

/**
 * Status badge component
 */
function StatusBadge({ status }) {
  const styles = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/50',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
    low: 'bg-orange-500/20 text-orange-400 border-orange-500/50',
    ok: 'bg-green-500/20 text-green-400 border-green-500/50',
    normal: 'bg-gray-500/20 text-gray-400 border-gray-500/50',
  };

  const icons = {
    critical: AlertTriangle,
    warning: AlertCircle,
    low: AlertCircle,
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

  if (!airport || !airport.data) {
    return null;
  }

  const { weapons = [], liquids = [] } = airport.data;

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
    warning: 0,
    ok: 0,
  };

  weapons.forEach(weapon => {
    const isImportant = importantWeaponIds.includes(weapon.item);
    const status = getWeaponStatus(weapon.quantity, isImportant);
    if (status === 'critical') stats.critical++;
    else if (status === 'warning' || status === 'low') stats.warning++;
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

    const priority = { critical: 0, warning: 1, low: 2, ok: 3, normal: 4 };
    return priority[statusA] - priority[statusB];
  });

  const airportMissions = missions.filter(m => m.airport_id === airport.id);
  const cardBorderClass = stats.critical > 0 ? 'border-red-500 pulse-border-critical' : stats.warning > 0 ? 'border-yellow-500' : 'border-gray-700';

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
            {stats.warning > 0 && (
              <div className="flex items-center gap-1 text-yellow-400">
                <AlertCircle className="w-5 h-5" />
                <span className="font-bold">{stats.warning}</span>
              </div>
            )}
            {airportMissions.length > 0 && (
              <div className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm font-bold">
                {airportMissions.length} missions
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
          <div className="p-4 bg-slate-900/50 flex gap-2">
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
    </div>
  );
}
