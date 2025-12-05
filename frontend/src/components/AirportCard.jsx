import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, AlertCircle, Package, Droplet, Plane, Helicopter, Plus, X, TrendingUp, ArrowRight, FileDown } from 'lucide-react';
import { createOrder } from '../services/api';
import WeaponChart from './WeaponChart';
import { getAirportName } from '../config/airports';
import { generateChartsPDF, checkChartsAvailable } from '../utils/pdfGenerator';
import { isImportantWeapon } from '../config/weapons';

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
  const [chartWeapon, setChartWeapon] = useState(''); // For the historical chart
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [chartsAvailable, setChartsAvailable] = useState(null); // null = not checked, true/false = has charts

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
  const cardBorderClass = stats.critical > 0 ? 'border-red-500 pulse-border-critical' : stats.high > 0 ? 'border-orange-500' : stats.medium > 0 ? 'border-yellow-500' : 'border-yt-border';

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
              <Helicopter className="w-5 h-5 text-purple-400" />
            ) : (
              <Plane className="w-5 h-5 text-yt-accent" />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-yt-text-primary">{airport.displayName || airport.name}</h3>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                  isHeliport ? 'bg-purple-500/20 text-purple-400' : 'bg-yt-accent/20 text-yt-accent'
                }`}>
                  {isHeliport ? '🚁' : '✈️'}
                </span>
              </div>
              {airport.isMainBase && (
                <span className="text-xs text-yellow-400 font-semibold">⭐ Base</span>
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
                  className="px-2.5 py-1.5 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-700 flex items-center gap-1 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rifornimento</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Orders Section - Design precedente più visibile e compatto orizzontalmente */}
          {!airport.isMainBase && airportMissions.length > 0 && (
            <div className="p-3 bg-purple-500/10 border-t-2 border-purple-500/40">
              <h4 className="text-sm font-bold text-purple-300 mb-2 flex items-center gap-2">
                <Package className="w-4 h-4" />
                ORDINI ATTIVI ({airportMissions.length})
              </h4>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {airportMissions.map(mission => {
                  const sourceName = mission.source_airport_id ? getAirportName(mission.source_airport_id) : 'Main Base';
                  const distance = mission.distance_nm ? `${mission.distance_nm}nm` : '-';

                  return (
                    <div key={mission.id} className="bg-yt-bg-secondary p-2.5 rounded border border-purple-500/30">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs text-yt-text-primary font-bold mb-0.5 truncate">{getWeaponDisplayName(mission.weapon_id)}</div>
                          <div className="text-[10px] text-yt-text-secondary">
                            Qty: <span className="font-bold text-yt-text-primary">{mission.quantity_needed}</span> •
                            Att: <span className="font-bold text-orange-400">{mission.current_quantity}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 ml-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            mission.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                            mission.status === 'accepted' ? 'bg-yt-accent/20 text-yt-accent' :
                            'bg-yt-bg-primary/50 text-yt-text-secondary'
                          }`}>
                            {mission.status === 'pending' ? 'ATT' : mission.status === 'accepted' ? 'ACC' : mission.status.toUpperCase().substring(0, 3)}
                          </span>
                        </div>
                      </div>
                      {/* Route Information - compatta */}
                      <div className="flex items-center gap-1 text-[10px] bg-yt-bg-primary px-1.5 py-1 rounded">
                        <span className="text-yt-accent font-medium truncate">{sourceName}</span>
                        <ArrowRight className="w-3 h-3 text-yt-text-secondary flex-shrink-0" />
                        <span className="text-green-400 font-medium truncate">{airport.displayName || airport.name}</span>
                        <span className="text-yt-border flex-shrink-0">•</span>
                        <span className="text-cyan-400 font-mono flex-shrink-0">{distance}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Liquids Section - più colonne per sfruttare spazio */}
          <div className="p-3 bg-yt-bg-primary/50">
            <h4 className="text-xs font-bold text-yt-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Droplet className="w-3.5 h-3.5" />
              Liquids
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
              {liquids.map((liquid, idx) => (
                <div key={idx} className="bg-yt-bg-tertiary p-2 rounded">
                  <div className="text-xs text-yt-text-secondary">Type {liquid.item}</div>
                  <div className="text-base font-bold text-yt-text-primary">{liquid.quantity.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Weapons Section - layout a colonne per sfruttare spazio */}
          <div className="p-3">
            <h4 className="text-xs font-bold text-yt-text-secondary mb-2 flex items-center gap-1.5 uppercase tracking-wide">
              <Package className="w-3.5 h-3.5" />
              Weapons & Munitions
            </h4>

            {/* Layout a griglia su schermi grandi per ottimizzare spazio */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {/* Suddividi weapons in 2 colonne */}
              {[0, 1].map(colIndex => {
                const startIdx = Math.floor(filteredWeapons.length / 2) * colIndex;
                const endIdx = colIndex === 0 ? Math.floor(filteredWeapons.length / 2) : filteredWeapons.length;
                const columnWeapons = filteredWeapons.slice(startIdx, endIdx);

                return columnWeapons.length > 0 ? (
                  <div key={colIndex} className="max-h-96 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-yt-bg-secondary border-b border-yt-border z-10">
                        <tr className="text-left text-yt-text-secondary">
                          <th className="p-2">Weapon</th>
                          <th className="p-2 text-right">Qty</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {columnWeapons.map((weapon, idx) => {
                          const isImportant = isImportantWeapon(weapon.item, isHeliport);
                          const status = getWeaponStatus(weapon.quantity, isImportant);

                          return (
                            <tr key={startIdx + idx} className="border-b border-yt-border hover:bg-yt-bg-tertiary/50 transition-colors">
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
                ) : null;
              })}
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
          <div className="bg-yt-bg-secondary rounded-lg p-5 max-w-md w-full mx-4 border-2 border-green-500 shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                  className="w-full bg-yt-bg-primary text-yt-text-primary border border-yt-border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-all"
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
                  className="w-full bg-yt-bg-primary text-yt-text-primary border border-yt-border rounded px-3 py-2 text-sm focus:outline-none focus:border-green-500 transition-all"
                  placeholder="100"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreateOrder}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded text-sm transition-all"
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
