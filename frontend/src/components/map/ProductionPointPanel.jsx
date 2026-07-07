import { ChevronDown, X } from 'lucide-react';
import './ProductionPointPanel.css';

function pad2(value) {
  return String(Math.max(0, Math.floor(Number(value)) || 0)).padStart(2, '0');
}

function formatProductionPointNumber(rawId) {
  const id = String(rawId || '').trim();
  const match = id.match(/^PP[_\s-]*0*(\d+)$/i);
  return match ? match[1].padStart(2, '0') : null;
}

function formatProductionPointLabel(pp) {
  const raw = pp?.zone_name || pp?.id;
  const num = formatProductionPointNumber(raw);
  if (num) return `Production Point ${num}`;
  return String(raw || 'Production Point');
}

function getOwnerClass(owner) {
  const normalized = String(owner || 'NEUTRAL').toUpperCase();
  if (normalized === 'BLUE') return 'pp-panel__meta-value--blue';
  if (normalized === 'RED') return 'pp-panel__meta-value--red';
  if (normalized === 'CONTESTED') return 'pp-panel__meta-value--attack';
  return '';
}

function getDotClass(owner, built) {
  const normalized = String(owner || 'NEUTRAL').toUpperCase();
  if (normalized === 'RED' || normalized === 'CONTESTED') return 'pp-panel__dot--attack';
  if (built && normalized === 'BLUE') return 'pp-panel__dot--blue';
  return 'pp-panel__dot--neutral';
}

function getStatusLabel(pp, variant = 'main') {
  if (pp?.upgrading) return 'Upgrading';
  if (!pp?.built) return variant === 'requested' ? 'TO BUILD' : 'BUILD';
  return 'BUILD';
}

function clampQuantity(quantity, maxStock) {
  const max = Math.max(1, Math.floor(Number(maxStock)) || 1);
  return Math.max(1, Math.min(max, Math.floor(Number(quantity)) || 1));
}

function PanelHeader({ pp, productionPoints, onSelectPp, onClose }) {
  return (
    <div className="pp-panel__header">
      <div className="pp-panel__title-select">
        <span className={`pp-panel__dot ${getDotClass(pp?.owner, pp?.built)}`} aria-hidden="true" />
        <select
          className="pp-panel__select"
          value={pp?.id}
          onChange={(event) => onSelectPp?.(event.target.value)}
          aria-label="Select production point"
        >
          {(productionPoints || []).map((entry) => (
            <option key={entry.id} value={entry.id}>
              {formatProductionPointLabel(entry)}
            </option>
          ))}
        </select>
        <ChevronDown strokeWidth={3} className="pp-panel__select-chevron" aria-hidden="true" />
      </div>

      <button type="button" className="pp-panel__close" onClick={onClose} aria-label="Close production point panel">
        <X strokeWidth={2.2} />
      </button>
    </div>
  );
}

function PanelMeta({ pp, variant = 'main' }) {
  return (
    <div className="pp-panel__meta">
      <p className="pp-panel__meta-line">
        Owner:{' '}
        <span className={getOwnerClass(pp?.owner)}>{pp?.owner || '-'}</span>
      </p>
      <p className="pp-panel__meta-line">
        Level:{' '}
        <span>LIV {pad2(pp?.level)} / {pad2(pp?.max_level)}</span>
      </p>
      <p className="pp-panel__meta-line">
        Status:{' '}
        <span>{getStatusLabel(pp, variant)}</span>
      </p>
      <p className="pp-panel__meta-line">
        Stock:{' '}
        <span>{pad2(pp?.stock)} / {pad2(pp?.max_stock)}</span>
      </p>
    </div>
  );
}

function RequestedCrateSection({ pp, standalone = false }) {
  const categories = Object.entries(pp?.required_categories || {});
  if (categories.length === 0) return null;

  return (
    <div className={`pp-panel__requested-body${standalone ? ' pp-panel__requested-body--standalone' : ''}`}>
      {!standalone && <div className="pp-panel__divider" />}
      <div className="pp-panel__requested-head">
        <p className="pp-panel__section-title">REQUESTED CRATE</p>
        <span className="pp-panel__requested-status">{getStatusLabel(pp, 'requested')}</span>
      </div>
      <div className="pp-panel__crate-grid">
        {categories.map(([category, need]) => {
          const have = Number(pp?.build_counts?.[category] || 0);
          const required = Number(need) || 0;
          const done = have >= required;
          return (
            <div
              key={category}
              className={`pp-panel__crate-pill${done ? ' pp-panel__crate-pill--done' : ''}`}
            >
              {category} CRATE {have}/{required}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QtyRow({ value, max, disabled, onChange }) {
  const safeMax = Math.max(1, Math.floor(Number(max)) || 1);
  const safeValue = clampQuantity(value, safeMax);

  return (
    <div className="pp-panel__qty-row">
      <p className="pp-panel__qty-label">Qty.</p>
      <div className="pp-panel__qty-track-wrap">
        <input
          type="range"
          className="pp-panel__qty-track"
          min={1}
          max={safeMax}
          step={1}
          value={safeValue}
          disabled={disabled}
          onChange={(event) => onChange?.(Number(event.target.value))}
          aria-label="Retrieve quantity"
        />
      </div>
      <div className="pp-panel__qty-value">
        {pad2(safeValue)} / {pad2(safeMax)}
      </div>
    </div>
  );
}

export default function ProductionPointPanel({
  pp,
  productionPoints = [],
  onSelectPp,
  onClose,
  onUpgrade,
  onGetStock,
  retrieveQuantity = 1,
  maxRetrieveQuantity = 1,
  onRetrieveQuantityChange,
  canUpgrade = false,
  canRetrieve = false,
  upgradingSending = false,
  retrieveModeActive = false,
  isAuthenticated = false,
}) {
  if (!pp) return null;

  const isUpgrading = Boolean(pp.upgrading);
  const isBuilt = Boolean(pp.built);
  const hasRequestedCrates = Object.keys(pp.required_categories || {}).length > 0;
  const showActions = !isUpgrading;
  const showQty = showActions && (canRetrieve || Number(pp?.stock) > 0);
  const showBottomRequestedPanel = hasRequestedCrates && !isBuilt && !isUpgrading;

  const upgradeLabel = isUpgrading
    ? 'UPGRADING...'
    : upgradingSending
      ? 'SENDING...'
      : 'UPGRADE';

  const stockLabel = retrieveModeActive ? 'CLICK MAP...' : 'GET STOCK';

  if (isUpgrading) {
    return (
      <div className="pp-panel-root">
        <section className="pp-panel pp-panel--upgrading" aria-label="Production point upgrading">
          <PanelHeader pp={pp} productionPoints={productionPoints} onSelectPp={onSelectPp} onClose={onClose} />
          <div className="pp-panel__divider" />
          <PanelMeta pp={pp} />

          <div className="pp-panel__actions">
            <button type="button" className="pp-panel__btn pp-panel__btn--upgrade" disabled>
              {upgradeLabel}
            </button>
            <button
              type="button"
              className="pp-panel__btn pp-panel__btn--stock"
              disabled={!isAuthenticated || !canRetrieve}
              onClick={onGetStock}
            >
              {stockLabel}
            </button>
          </div>

          {showQty && (
            <QtyRow
              value={retrieveQuantity}
              max={maxRetrieveQuantity}
              disabled={!isAuthenticated}
              onChange={onRetrieveQuantityChange}
            />
          )}

          <RequestedCrateSection pp={pp} />

          {!isAuthenticated && (
            <p className="pp-panel__footer-note">Login to interact</p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="pp-panel-root">
      <section className="pp-panel pp-panel--main" aria-label="Production point details">
        <PanelHeader pp={pp} productionPoints={productionPoints} onSelectPp={onSelectPp} onClose={onClose} />
        <div className="pp-panel__divider" />
        <PanelMeta pp={pp} />

        {showActions && (
          <>
            <div className="pp-panel__actions">
              <button
                type="button"
                className="pp-panel__btn pp-panel__btn--upgrade"
                disabled={!isAuthenticated || !canUpgrade || upgradingSending}
                onClick={onUpgrade}
              >
                {upgradeLabel}
              </button>
              <button
                type="button"
                className="pp-panel__btn pp-panel__btn--stock"
                disabled={!isAuthenticated || !canRetrieve || retrieveModeActive}
                onClick={onGetStock}
              >
                {stockLabel}
              </button>
            </div>

            {showQty && (
              <QtyRow
                value={retrieveQuantity}
                max={maxRetrieveQuantity}
                disabled={!isAuthenticated}
                onChange={onRetrieveQuantityChange}
              />
            )}
          </>
        )}

        {!isAuthenticated && (
          <p className="pp-panel__footer-note">Login to interact</p>
        )}
      </section>

      {showBottomRequestedPanel && (
        <section className="pp-panel pp-panel--requested" aria-label="Production point requested crate">
          <RequestedCrateSection pp={pp} standalone />
        </section>
      )}
    </div>
  );
}
