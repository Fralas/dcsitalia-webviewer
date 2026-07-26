import { useEffect, useRef, useState } from 'react';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const selectRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!selectRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleSelect = (ppId) => {
    setMenuOpen(false);
    if (ppId !== pp?.id) onSelectPp?.(ppId);
  };

  return (
    <div className={`pp-panel__header${menuOpen ? ' is-menu-open' : ''}`}>
      <div className="pp-panel__title-select" ref={selectRef}>
        <button
          type="button"
          className={`pp-panel__select-trigger${menuOpen ? ' is-open' : ''}`}
          aria-label="Select production point"
          aria-haspopup="listbox"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className={`pp-panel__dot ${getDotClass(pp?.owner, pp?.built)}`} aria-hidden="true" />
          <span className="pp-panel__select-trigger-label">{formatProductionPointLabel(pp)}</span>
          <ChevronDown strokeWidth={3} className="pp-panel__select-chevron" aria-hidden="true" />
        </button>

        {menuOpen && (
          <ul className="pp-panel__menu" role="listbox" aria-label="Select production point">
            {(productionPoints || []).map((entry) => {
              const selected = entry.id === pp?.id;
              return (
                <li key={entry.id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    className={`pp-panel__menu-option${selected ? ' is-selected' : ''}`}
                    onClick={() => handleSelect(entry.id)}
                  >
                    <span className={`pp-panel__dot ${getDotClass(entry?.owner, entry?.built)}`} aria-hidden="true" />
                    <span className="pp-panel__menu-option-label">{formatProductionPointLabel(entry)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
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

function RequestedCrateSection({ pp }) {
  const categories = Object.entries(pp?.required_categories || {});
  if (categories.length === 0) return null;

  return (
    <div className="pp-panel__requested-body">
      <div className="pp-panel__divider" />
      <div className="pp-panel__requested-head">
        <div className="pp-panel__requested-row">
          <div className="pp-panel__requested-label-block">
            <p className="pp-panel__section-title">REQUESTED CRATE</p>
            <span className="pp-panel__requested-status">{getStatusLabel(pp, 'requested')}</span>
          </div>
          {categories.map(([category, need]) => {
            const have = Number(pp?.build_counts?.[category] || 0);
            const required = Number(need) || 0;
            const done = have >= required;
            return (
              <div key={category} className="pp-panel__requested-item">
                <span className="pp-panel__requested-divider" aria-hidden="true" />
                <span className={`pp-panel__crate-pill${done ? ' pp-panel__crate-pill--done' : ''}`}>
                  {category} CRATE {have}/{required}
                </span>
              </div>
            );
          })}
        </div>
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
  const showRequestedCrates = hasRequestedCrates && !isBuilt;

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

        {showRequestedCrates && <RequestedCrateSection pp={pp} />}

        {!isAuthenticated && (
          <p className="pp-panel__footer-note">Login to interact</p>
        )}
      </section>
    </div>
  );
}
