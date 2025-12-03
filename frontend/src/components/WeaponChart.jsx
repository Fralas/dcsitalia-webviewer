import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { getWeaponHistory } from '../services/api';

/**
 * Get weapon display name (remove prefix)
 */
function getWeaponDisplayName(weaponId) {
  return weaponId.replace(/^weapons\.(missiles|bombs|nurs|containers|droptanks|torpedoes|adapters)\./, '');
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}

/**
 * Custom tooltip for the chart
 */
function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-gray-600 rounded p-3 shadow-lg">
        <p className="text-xs text-gray-400 mb-1">{formatDate(data.timestamp)}</p>
        <p className="text-lg font-bold text-white">Quantità: {data.quantity}</p>
      </div>
    );
  }
  return null;
}

/**
 * Weapon Chart Component
 */
export default function WeaponChart({ airportId, weaponId, days = 7 }) {
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!airportId || !weaponId) {
      setLoading(false);
      return;
    }

    loadChartData();
  }, [airportId, weaponId, days]);

  const loadChartData = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getWeaponHistory(airportId, weaponId, days);

      if (!response.history || response.history.length === 0) {
        setError('Nessun dato disponibile per questa arma');
        setChartData([]);
        return;
      }

      // Transform data for recharts
      const formattedData = response.history.map(item => ({
        timestamp: item.timestamp,
        date: formatDate(item.timestamp),
        quantity: item.quantity,
      }));

      setChartData(formattedData);
    } catch (err) {
      console.error('Error loading weapon history:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900/50 rounded-lg p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-gray-400 text-sm">Caricamento dati...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/50 rounded-lg p-8 text-center">
        <p className="text-yellow-400">{error}</p>
        <p className="text-xs text-gray-500 mt-2">
          I dati vengono salvati ogni ora. Attendi il prossimo snapshot.
        </p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-slate-900/50 rounded-lg p-8 text-center">
        <p className="text-gray-400">Seleziona un'arma per vedere il grafico</p>
      </div>
    );
  }

  // Calculate statistics
  const quantities = chartData.map(d => d.quantity);
  const minQty = Math.min(...quantities);
  const maxQty = Math.max(...quantities);
  const avgQty = Math.round(quantities.reduce((a, b) => a + b, 0) / quantities.length);
  const currentQty = quantities[quantities.length - 1];
  const change = quantities.length > 1 ? currentQty - quantities[0] : 0;
  const changePercent = quantities[0] !== 0 ? ((change / quantities[0]) * 100).toFixed(1) : 0;

  return (
    <div className="bg-slate-900/50 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          <h4 className="text-lg font-bold text-white">
            {getWeaponDisplayName(weaponId)}
          </h4>
        </div>
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Calendar className="w-4 h-4" />
          <span>Ultimi {days} giorni</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-slate-800 rounded p-2">
          <div className="text-xs text-gray-400">Attuale</div>
          <div className="text-lg font-bold text-white">{currentQty}</div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <div className="text-xs text-gray-400">Media</div>
          <div className="text-lg font-bold text-blue-400">{avgQty}</div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <div className="text-xs text-gray-400">Min</div>
          <div className="text-lg font-bold text-red-400">{minQty}</div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <div className="text-xs text-gray-400">Max</div>
          <div className="text-lg font-bold text-green-400">{maxQty}</div>
        </div>
        <div className="bg-slate-800 rounded p-2">
          <div className="text-xs text-gray-400">Variazione</div>
          <div className={`text-lg font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change} ({changePercent}%)
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-slate-800 rounded-lg p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis
              dataKey="date"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="quantity"
              stroke="#3B82F6"
              strokeWidth={2}
              dot={{ fill: '#3B82F6', r: 4 }}
              activeDot={{ r: 6 }}
              name="Quantità"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        📊 Dati raccolti ogni ora • {chartData.length} punti dati
      </div>
    </div>
  );
}
