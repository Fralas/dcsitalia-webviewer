import { useCallback, useEffect, useRef, useState } from 'react';
import { Map, X } from 'lucide-react';
import * as api from '../../services/api';
import { t } from '../../utils/locale';
import InlineError from '../InlineError';

const CHART_BASE = import.meta.env.VITE_SOCKET_URL
  || (typeof window !== 'undefined' ? window.location.origin : '');

const MIN_WIDTH = 280;
const MAX_WIDTH_RATIO = 0.75;

function resolveChartUrl(url) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `${CHART_BASE}${url}`;
}

export default function AtcChartsPanel({ airportId, width, onWidthChange, onClose }) {
  const [charts, setCharts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedFilename, setSelectedFilename] = useState('');
  const resizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(width);

  useEffect(() => {
    let cancelled = false;

    async function loadCharts() {
      setLoading(true);
      setError('');
      setCharts([]);
      setSelectedFilename('');

      try {
        const data = await api.getAirportCharts(airportId);
        if (cancelled) return;

        const list = Array.isArray(data?.charts) ? data.charts : [];
        if (!data?.available || list.length === 0) {
          setError(data?.message || t('atc.charts.empty'));
          return;
        }

        setCharts(list);
        setSelectedFilename(list[0].filename);
      } catch (err) {
        if (!cancelled) setError(err.message || t('atc.charts.error'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    if (airportId) loadCharts();
    return () => { cancelled = true; };
  }, [airportId]);

  const handleResizeMove = useCallback((event) => {
    if (!resizingRef.current) return;
    const delta = startXRef.current - event.clientX;
    const maxWidth = Math.floor(window.innerWidth * MAX_WIDTH_RATIO);
    const next = Math.min(Math.max(startWidthRef.current + delta, MIN_WIDTH), maxWidth);
    onWidthChange?.(next);
  }, [onWidthChange]);

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = false;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeEnd);
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  const startResize = (event) => {
    event.preventDefault();
    resizingRef.current = true;
    startXRef.current = event.clientX;
    startWidthRef.current = width;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const selectedChart = charts.find((c) => c.filename === selectedFilename) || charts[0];

  return (
    <aside className="atc-charts-panel" style={{ width }} aria-label={t('atc.charts.title')}>
      <div
        className="atc-charts-panel__resizer"
        onMouseDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label={t('atc.charts.resize')}
      />

      <div className="atc-charts-panel__header">
        <div className="atc-charts-panel__title">
          <Map className="w-4 h-4" />
          <span>{t('atc.charts.title')}</span>
        </div>
        <button type="button" className="atc-charts-panel__close" onClick={onClose} aria-label={t('atc.charts.close')}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="atc-charts-panel__controls">
        <label className="atc-charts-panel__select-wrap">
          <span>{t('atc.charts.select')}</span>
          <select
            value={selectedFilename}
            onChange={(e) => setSelectedFilename(e.target.value)}
            disabled={loading || charts.length === 0}
          >
            {charts.length === 0 && (
              <option value="">{loading ? t('atc.charts.loading') : t('atc.charts.empty')}</option>
            )}
            {charts.map((chart) => (
              <option key={chart.filename} value={chart.filename}>
                {chart.filename}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="atc-charts-panel__viewport">
        {loading && <div className="atc-charts-panel__message">{t('atc.charts.loading')}</div>}
        {!loading && <InlineError message={error} />}
        {!loading && !error && selectedChart && (
          <img
            className="atc-charts-panel__image"
            src={resolveChartUrl(selectedChart.url)}
            alt={selectedChart.filename}
            draggable={false}
          />
        )}
      </div>
    </aside>
  );
}
