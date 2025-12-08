import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, Calendar } from 'lucide-react';
import { getWeaponHistory } from '../services/api';
import { t } from '../utils/locale';

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
      <div className="bg-yt-bg-tertiary border border-yt-border rounded p-3 shadow-lg">
        <p className="text-xs text-yt-text-secondary mb-1">{formatDate(data.timestamp)}</p>
        <p className="text-lg font-bold text-yt-text-primary">{t('weaponChart.quantityLabel', { value: data.quantity })}</p>
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
        setError(t('weaponChart.noData'));
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
      setError(t('weaponChart.errorLoading'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-yt-bg-secondary rounded-lg p-8 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-yt-accent border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-yt-text-secondary text-sm">{t('weaponChart.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-yt-bg-secondary rounded-lg p-8 text-center">
        <p className="text-yellow-400">{error}</p>
        <p className="text-xs text-yt-text-secondary mt-2">{t('weaponChart.snapshotInfo')}</p>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-yt-bg-secondary rounded-lg p-8 text-center">
        <p className="text-yt-text-secondary">{t('weaponChart.selectWeapon')}</p>
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
    <div className="bg-yt-bg-secondary rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-yt-accent" />
          <h4 className="text-lg font-bold text-yt-text-primary">
            {getWeaponDisplayName(weaponId)}
          </h4>
        </div>
        <div className="flex items-center gap-2 text-yt-text-secondary text-sm">
          <Calendar className="w-4 h-4" />
          <span>{t('weaponChart.stats.lastDays', { days })}</span>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <div className="bg-yt-bg-tertiary rounded p-2">
          <div className="text-xs text-yt-text-secondary">{t('weaponChart.stats.current')}</div>
          <div className="text-lg font-bold text-yt-text-primary">{currentQty}</div>
        </div>
        <div className="bg-yt-bg-tertiary rounded p-2">
          <div className="text-xs text-yt-text-secondary">{t('weaponChart.stats.average')}</div>
          <div className="text-lg font-bold text-yt-accent">{avgQty}</div>
        </div>
        <div className="bg-yt-bg-tertiary rounded p-2">
          <div className="text-xs text-yt-text-secondary">{t('weaponChart.stats.min')}</div>
          <div className="text-lg font-bold text-red-400">{minQty}</div>
        </div>
        <div className="bg-yt-bg-tertiary rounded p-2">
          <div className="text-xs text-yt-text-secondary">{t('weaponChart.stats.max')}</div>
          <div className="text-lg font-bold text-green-400">{maxQty}</div>
        </div>
        <div className="bg-yt-bg-tertiary rounded p-2">
          <div className="text-xs text-yt-text-secondary">{t('weaponChart.stats.change')}</div>
          <div className={`text-lg font-bold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {change >= 0 ? '+' : ''}{change} ({changePercent}%)
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-yt-bg-tertiary rounded-lg p-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#3F3F3F" />
            <XAxis
              dataKey="date"
              stroke="#AAAAAA"
              tick={{ fill: '#AAAAAA', fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis
              stroke="#AAAAAA"
              tick={{ fill: '#AAAAAA', fontSize: 12 }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line
              type="monotone"
              dataKey="quantity"
              stroke="#3EA6FF"
              strokeWidth={2}
              dot={{ fill: '#3EA6FF', r: 4 }}
              activeDot={{ r: 6 }}
              name={t('airportCard.headers.quantity')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-xs text-yt-text-secondary text-center">
        {t('weaponChart.dataPoints', { count: chartData.length })}
      </div>
    </div>
  );
}
