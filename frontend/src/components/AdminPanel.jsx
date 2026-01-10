import { useState, useEffect } from 'react';
import { Lock, Settings, MapPin, Trash2, RefreshCw, Eye, EyeOff, Shield, Target } from 'lucide-react';
import { login, logout, isAuthenticated, apiRequest } from '../utils/api';
import * as api from '../services/api';

/**
 * Admin Panel Component
 */
export default function AdminPanel() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);

  // Config states
  const [rulesConfig, setRulesConfig] = useState(null);
  const [airportsConfig, setAirportsConfig] = useState(null);
  const [activeTab, setActiveTab] = useState('debug'); // debug, rules, airports

  // Check if already authenticated on mount
  useEffect(() => {
    if (isAuthenticated()) {
      setAuthenticated(true);
      loadConfigs();
    }
  }, []);

  const loadConfigs = async () => {
    try {
      const [rulesData, airportsData] = await Promise.all([
        apiRequest('/admin/config/rules'),
        apiRequest('/admin/config/airports')
      ]);

      setRulesConfig(rulesData);
      setAirportsConfig(airportsData);
    } catch (error) {
      console.error('Failed to load configs:', error);
      if (error.message.includes('Session expired')) {
        setAuthenticated(false);
        setLoginError('Sessione scaduta. Effettua nuovamente il login.');
      }
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setLoginError('');

    try {
      await login(password);
      setAuthenticated(true);
      await loadConfigs();
    } catch (error) {
      setLoginError(error.message || 'Password non valida');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    setAuthenticated(false);
    setPassword('');
    setRulesConfig(null);
    setAirportsConfig(null);
  };

  const handleGenerateOrders = async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/debug/generate-orders', { method: 'POST' });
      alert(`✅ Generati ${data.totalGenerated} ordini`);
    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
      if (error.message.includes('Session expired')) {
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearOrders = async () => {
    if (!confirm('Sei sicuro di voler cancellare tutti gli ordini?')) return;

    setLoading(true);
    try {
      const data = await apiRequest('/debug/clear-orders', { method: 'POST' });
      alert(`✅ Cancellati ${data.clearedCount} ordini`);
    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
      if (error.message.includes('Session expired')) {
        setAuthenticated(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCombatMissions = async () => {
    setLoading(true);
    try {
      const data = await api.refreshCombatMissions();
      alert(`✅ Generate ${data.count} missioni di combattimento`);
    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClearCombatMissions = async () => {
    if (!confirm('Sei sicuro di voler cancellare tutte le missioni di combattimento?')) return;

    setLoading(true);
    try {
      const data = await api.clearCombatMissions();
      alert(`✅ Cancellate ${data.clearedCount} missioni di combattimento`);
    } catch (error) {
      alert(`❌ Errore: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Login Screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800 rounded-lg p-8 max-w-md w-full border-2 border-gray-700 shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="p-4 bg-red-500/20 rounded-full">
              <Shield className="w-12 h-12 text-red-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">Admin Panel</h1>
          <p className="text-gray-400 text-center mb-6">Accesso riservato agli amministratori</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900 text-white border border-gray-600 rounded px-4 py-3 pr-12 focus:outline-none focus:border-red-500"
                  placeholder="Inserisci password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="bg-red-500/20 border border-red-500 text-red-400 px-4 py-2 rounded text-sm">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-3 px-4 rounded transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  Verifica...
                </>
              ) : (
                <>
                  <Lock className="w-5 h-5" />
                  Accedi
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-slate-800 rounded-lg p-6 border border-gray-700 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 rounded-lg">
                <Shield className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
                <p className="text-gray-400">Gestione configurazioni e debug</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-bold transition-colors"
            >
              Logout
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setActiveTab('debug')}
              className={`px-4 py-2 rounded font-bold transition-colors ${
                activeTab === 'debug'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              Debug Panel
            </button>
            <button
              onClick={() => setActiveTab('rules')}
              className={`px-4 py-2 rounded font-bold transition-colors ${
                activeTab === 'rules'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-2" />
              Regole
            </button>
            <button
              onClick={() => setActiveTab('airports')}
              className={`px-4 py-2 rounded font-bold transition-colors ${
                activeTab === 'airports'
                  ? 'bg-red-600 text-white'
                  : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
              }`}
            >
              <MapPin className="w-4 h-4 inline mr-2" />
              Aeroporti
            </button>
          </div>
        </div>

        {/* Debug Panel Tab */}
        {activeTab === 'debug' && (
          <div className="bg-slate-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Debug Panel</h2>
            <p className="text-gray-400 mb-6">
              Strumenti per testare e gestire le missioni del sistema
            </p>

            {/* Supply Orders Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-400" />
                Ordini Logistici
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleGenerateOrders}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Genera Ordini per Tutti gli Aeroporti
                </button>

                <button
                  onClick={handleClearOrders}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Cancella Tutti gli Ordini
                </button>
              </div>
            </div>

            {/* Combat Missions Section */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-red-400" />
                Missioni di Combattimento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={handleGenerateCombatMissions}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                  Genera Missioni di Combattimento
                </button>

                <button
                  onClick={handleClearCombatMissions}
                  disabled={loading}
                  className="bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-4 px-6 rounded transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Cancella Tutte le Missioni di Combattimento
                </button>
              </div>
            </div>

            <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-400 px-4 py-3 rounded">
              <p className="font-bold">⚠️ Attenzione</p>
              <p className="text-sm mt-1">
                Queste azioni influenzano tutti gli aeroporti e tutte le missioni attive. Usare con cautela.
              </p>
            </div>
          </div>
        )}

        {/* Rules Config Tab */}
        {activeTab === 'rules' && rulesConfig && (
          <div className="bg-slate-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Configurazione Regole</h2>
            <div className="space-y-4">
              <div className="bg-slate-900 p-4 rounded">
                <pre className="text-xs text-gray-300 overflow-x-auto">
                  {JSON.stringify(rulesConfig, null, 2)}
                </pre>
              </div>
              <div className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded text-sm">
                💡 Per modificare la configurazione, edita il file <code className="bg-blue-900/50 px-2 py-1 rounded">backend/src/config/rules.config.js</code> e riavvia il server.
              </div>
            </div>
          </div>
        )}

        {/* Airports Config Tab */}
        {activeTab === 'airports' && airportsConfig && (
          <div className="bg-slate-800 rounded-lg p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Configurazione Aeroporti</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {airportsConfig.map((airport) => (
                  <div key={airport.id} className="bg-slate-900 p-4 rounded border border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-white">{airport.displayName}</h3>
                      {airport.isMainBase && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded">
                          MAIN BASE
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 space-y-1">
                      <div>ID: <span className="text-white">{airport.id}</span></div>
                      <div>CSV: <span className="text-white">{airport.csvPrefix}</span></div>
                      {airport.coordinates && (
                        <div>
                          Coordinate: <span className="text-cyan-400">{airport.coordinates.lat.toFixed(6)}°N, {airport.coordinates.lon.toFixed(6)}°E</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-blue-500/20 border border-blue-500 text-blue-400 px-4 py-3 rounded text-sm">
                💡 Per modificare gli aeroporti, edita il file <code className="bg-blue-900/50 px-2 py-1 rounded">backend/src/config/airports.config.js</code> e riavvia il server.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
