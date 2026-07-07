import './ProductionPointPanel.css';

function pad2(value) {
  return String(Math.max(0, Math.floor(Number(value)) || 0)).padStart(2, '0');
}

function clampQuantity(quantity, maxStock) {
  const max = Math.max(1, Math.floor(Number(maxStock)) || 1);
  return Math.max(1, Math.min(max, Math.floor(Number(quantity)) || 1));
}

export default function ProductionPointRetrieveBanner({
  quantity = 1,
  maxQuantity = 1,
  radiusM = 500,
  submitting = false,
  onQuantityChange,
  onCancel,
}) {
  const safeMax = Math.max(1, Math.floor(Number(maxQuantity)) || 1);
  const safeValue = clampQuantity(quantity, safeMax);

  return (
    <div className="pp-retrieve-banner">
      <p className="pp-retrieve-banner__title">
        Place {safeValue}x production crate{safeValue > 1 ? 's' : ''} within {radiusM} m of the production point
      </p>

      <div className="pp-retrieve-banner__qty">
        <p className="pp-panel__qty-label">Qty.</p>
        <div className="pp-panel__qty-track-wrap">
          <input
            type="range"
            className="pp-panel__qty-track"
            min={1}
            max={safeMax}
            step={1}
            value={safeValue}
            onChange={(event) => onQuantityChange?.(Number(event.target.value))}
            aria-label="Retrieve quantity"
          />
        </div>
        <div className="pp-panel__qty-value">
          {pad2(safeValue)} / {pad2(safeMax)}
        </div>
      </div>

      <p className="pp-retrieve-banner__hint">
        {submitting ? 'Sending...' : 'Click the highlighted area on the map'}
      </p>

      <button type="button" className="pp-retrieve-banner__cancel" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
