import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Forklift,
  Helicopter,
  Plane,
  Plus,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { t } from '../utils/locale';
import { getLidcUnitImageUrl } from '../utils/lidcUnitImages';
import './LidcDeckBuilder.css';

export const DECK_CATEGORY_META = Object.freeze([
  { key: 'aircrafts', labelKey: 'lidc.deck.categories.aircrafts', Icon: Plane },
  { key: 'helicopters', labelKey: 'lidc.deck.categories.helicopters', Icon: Helicopter },
  { key: 'logistics', labelKey: 'lidc.deck.categories.logistics', Icon: Forklift },
  { key: 'groundAssets', labelKey: 'lidc.deck.categories.groundAssets', Icon: Shield },
]);

const MIN_SLOTS_PER_CATEGORY = 4;

export function createEmptyDeckCategoryMap() {
  return {
    aircrafts: 0,
    helicopters: 0,
    logistics: 0,
    groundAssets: 0,
  };
}

export function computeDeckSpentByCategory(quantities, units) {
  const spent = createEmptyDeckCategoryMap();

  (Array.isArray(units) ? units : []).forEach((unit) => {
    const quantity = Number(quantities?.[unit.id] || 0);
    if (quantity <= 0) return;
    if (spent[unit.category] === undefined) return;
    spent[unit.category] += Number(unit.cost || 0) * quantity;
  });

  return spent;
}

export function buildDeckPayloadFromQuantities(quantities, units) {
  const deck = {
    aircrafts: [],
    helicopters: [],
    logistics: [],
    groundAssets: [],
  };

  (Array.isArray(units) ? units : []).forEach((unit) => {
    const quantity = Math.floor(Number(quantities?.[unit.id] || 0));
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    if (!deck[unit.category]) return;
    deck[unit.category].push({ unitId: unit.id, quantity });
  });

  return deck;
}

export function buildQuantitiesFromDeck(deck) {
  const quantities = {};

  DECK_CATEGORY_META.forEach(({ key }) => {
    const entries = Array.isArray(deck?.[key]) ? deck[key] : [];
    entries.forEach((entry) => {
      const unitId = String(entry?.unitId || '');
      const quantity = Math.floor(Number(entry?.quantity || 0));
      if (!unitId || quantity <= 0) return;
      quantities[unitId] = (quantities[unitId] || 0) + quantity;
    });
  });

  return quantities;
}

function CategoryDeckSlots({
  categoryKey,
  selectedUnits,
  ghostCount,
  cap,
  isExpanded,
  readOnly,
  onTogglePicker,
  renderCategoryCard,
  renderCategoryPicker,
}) {
  const slotsRef = useRef(null);
  const [slotLayout, setSlotLayout] = useState({
    useCompactAdd: false,
    compactLeft: 0,
    compactTop: 6,
  });

  const remeasureSlots = useCallback(() => {
    const container = slotsRef.current;
    if (!container) return;

    const styles = getComputedStyle(container);
    const slotWidth = parseFloat(styles.getPropertyValue('--deck-slot-width')) || 190;
    const slotHeight = parseFloat(styles.getPropertyValue('--deck-slot-height')) || 128;
    const gap = parseFloat(styles.gap) || 10;
    const compactButtonSize = 26;
    const compactGap = 4;
    const width = container.clientWidth;
    const perRow = Math.max(1, Math.floor((width + gap) / (slotWidth + gap)));

    const visibleSlots = selectedUnits.length + ghostCount;
    const totalWithAdd = visibleSlots + (readOnly ? 0 : 1);
    const useCompactAdd = !readOnly && cap > 0 && totalWithAdd > perRow;

    let compactLeft = 0;
    let compactTop = 0;

    if (useCompactAdd) {
      const firstRowVisible = Math.max(1, Math.min(visibleSlots, perRow));
      const anchorIndex = firstRowVisible - 1;
      compactLeft = anchorIndex * (slotWidth + gap) + slotWidth + compactGap;
      compactTop = (slotHeight - compactButtonSize) / 2;
    }

    setSlotLayout({ useCompactAdd, compactLeft, compactTop });
  }, [selectedUnits.length, ghostCount, readOnly, cap]);

  useEffect(() => {
    remeasureSlots();

    const container = slotsRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(remeasureSlots);
    observer.observe(container);
    window.addEventListener('resize', remeasureSlots);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', remeasureSlots);
    };
  }, [remeasureSlots]);

  const { useCompactAdd, compactLeft, compactTop } = slotLayout;

  return (
    <>
      <div className="lidc-deck-slots" ref={slotsRef}>
        {selectedUnits.map((unit) => renderCategoryCard(unit, categoryKey))}

        {!readOnly && !useCompactAdd && (
          <button
            type="button"
            className={`lidc-deck-slot-add ${isExpanded ? 'is-active' : ''}`}
            onClick={onTogglePicker}
            disabled={cap <= 0}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronDown size={18} /> : <Plus size={18} />}
            <span>{isExpanded ? t('lidc.builder.closeUnitList') : t('lidc.builder.addUnit')}</span>
          </button>
        )}

        {Array.from({ length: ghostCount }).map((_, index) => (
          <span key={`ghost-${categoryKey}-${index}`} className="lidc-deck-slot-ghost" aria-hidden="true" />
        ))}

        {!readOnly && useCompactAdd && !isExpanded && (
          <button
            type="button"
            className="lidc-deck-slot-add-compact"
            style={{ left: `${compactLeft}px`, top: `${compactTop}px` }}
            onClick={onTogglePicker}
            disabled={cap <= 0}
            aria-expanded={isExpanded}
            aria-label={t('lidc.builder.addUnit')}
          >
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {!readOnly && (
        <div className={`lidc-deck-picker-wrap ${isExpanded ? 'is-open' : ''}`}>
          <div className="lidc-deck-picker-inner">
            {isExpanded && renderCategoryPicker(categoryKey, useCompactAdd)}
          </div>
        </div>
      )}
    </>
  );
}

export default function LidcDeckBuilder({
  units = [],
  quantities = {},
  caps = null,
  onChange = null,
  readOnly = false,
}) {
  const [expandedCategory, setExpandedCategory] = useState('');

  const unitsByCategory = useMemo(() => {
    const map = {};
    DECK_CATEGORY_META.forEach(({ key }) => {
      map[key] = [];
    });

    units.forEach((unit) => {
      if (!Array.isArray(map[unit.category])) return;
      map[unit.category].push(unit);
    });

    Object.keys(map).forEach((category) => {
      map[category].sort((a, b) => String(a.label).localeCompare(String(b.label), 'en', { numeric: true }));
    });

    return map;
  }, [units]);

  const spentByCategory = useMemo(
    () => computeDeckSpentByCategory(quantities, units),
    [quantities, units],
  );

  const capsByCategory = useMemo(() => {
    const resolved = createEmptyDeckCategoryMap();
    DECK_CATEGORY_META.forEach(({ key }) => {
      resolved[key] = Math.max(0, Number(caps?.[key] || 0));
    });
    return resolved;
  }, [caps]);

  const totals = useMemo(() => {
    let spent = 0;
    let cap = 0;
    DECK_CATEGORY_META.forEach(({ key }) => {
      spent += spentByCategory[key] || 0;
      cap += capsByCategory[key] || 0;
    });

    const unitCount = Object.values(quantities).reduce((sum, value) => {
      const quantity = Math.floor(Number(value || 0));
      return sum + (Number.isFinite(quantity) && quantity > 0 ? quantity : 0);
    }, 0);

    return { spent, cap, unitCount };
  }, [spentByCategory, capsByCategory, quantities]);

  useEffect(() => {
    if (!expandedCategory) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setExpandedCategory('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedCategory]);

  function setUnitQuantity(unit, nextQuantity) {
    if (readOnly || !onChange || !unit) return;

    const quantity = Math.max(0, Math.floor(Number(nextQuantity || 0)));
    const currentQuantity = Number(quantities[unit.id] || 0);
    if (quantity === currentQuantity) return;

    const delta = quantity - currentQuantity;
    if (delta > 0) {
      const projected = (spentByCategory[unit.category] || 0) + (delta * Number(unit.cost || 0));
      if (projected > (capsByCategory[unit.category] || 0)) return;
    }

    const next = { ...quantities };
    if (quantity <= 0) {
      delete next[unit.id];
    } else {
      next[unit.id] = quantity;
    }

    onChange(next);
  }

  function toggleCategoryPicker(categoryKey) {
    if (readOnly) return;
    setExpandedCategory((prev) => (prev === categoryKey ? '' : categoryKey));
  }

  function renderCategoryCard(unit, categoryKey) {
    const quantity = Number(quantities[unit.id] || 0);
    const remaining = (capsByCategory[categoryKey] || 0) - (spentByCategory[categoryKey] || 0);
    const canIncrease = !readOnly && remaining >= Number(unit.cost || 0);
    const categoryMeta = DECK_CATEGORY_META.find(({ key }) => key === categoryKey);
    const CategoryIcon = categoryMeta?.Icon || Plane;
    const totalCost = Number(unit.cost || 0) * quantity;
    const unitImageUrl = getLidcUnitImageUrl(unit.id);

    return (
      <article key={unit.id} className="lidc-deck-card" title={unit.label}>
        <div className="lidc-deck-card-head">
          <span className="lidc-deck-card-qty">x{quantity}</span>
          <span className="lidc-deck-card-name">{unit.label}</span>
        </div>

        {!readOnly && (
          <button
            type="button"
            className="lidc-deck-card-remove"
            onClick={() => setUnitQuantity(unit, 0)}
            aria-label={t('lidc.builder.removeUnit', { unit: unit.label })}
          >
            <Trash2 size={13} />
          </button>
        )}

        <div className="lidc-deck-card-body">
          {!readOnly && (
            <button
              type="button"
              className="lidc-deck-step-btn lidc-deck-step-btn--minus"
              onClick={() => setUnitQuantity(unit, quantity - 1)}
              disabled={quantity <= 0}
              aria-label={t('lidc.builder.decrease')}
            >
              -
            </button>
          )}

          <div className="lidc-deck-card-media" aria-hidden="true">
            {unitImageUrl ? (
              <img src={unitImageUrl} alt="" className="lidc-deck-card-image" />
            ) : (
              <CategoryIcon size={28} strokeWidth={1.4} />
            )}
          </div>

          {!readOnly && (
            <button
              type="button"
              className="lidc-deck-step-btn lidc-deck-step-btn--plus"
              onClick={() => setUnitQuantity(unit, quantity + 1)}
              disabled={!canIncrease}
              aria-label={t('lidc.builder.increase')}
            >
              +
            </button>
          )}
        </div>

        <div className="lidc-deck-card-cost">
          <Coins size={12} />
          <strong>{totalCost}</strong>
        </div>
      </article>
    );
  }

  function renderCategoryPicker(categoryKey, compactToolbar = false) {
    const remaining = (capsByCategory[categoryKey] || 0) - (spentByCategory[categoryKey] || 0);
    const candidates = unitsByCategory[categoryKey] || [];

    return (
      <div className="lidc-deck-picker">
        <div className={`lidc-deck-picker-toolbar ${compactToolbar ? 'is-compact' : ''}`}>
          <span className="lidc-deck-picker-budget">
            {t('lidc.deck.remaining')}: <strong>{Math.max(0, remaining)}</strong>
          </span>
          <button
            type="button"
            className="lidc-deck-picker-close"
            onClick={() => setExpandedCategory('')}
            aria-label={t('lidc.builder.closePicker')}
          >
            <X size={14} />
          </button>
        </div>

        <div className="lidc-deck-picker-list">
          {candidates.length === 0 && (
            <p className="lidc-deck-picker-empty">{t('lidc.builder.noUnitsFound')}</p>
          )}

          {candidates.map((unit) => {
            const quantity = Number(quantities[unit.id] || 0);
            const cost = Number(unit.cost || 0);
            const affordable = remaining >= cost;

            return (
              <button
                type="button"
                key={unit.id}
                className={`lidc-deck-picker-row ${affordable ? '' : 'is-blocked'}`}
                onClick={() => setUnitQuantity(unit, quantity + 1)}
                disabled={!affordable}
                title={affordable ? undefined : t('lidc.builder.notEnoughBudget')}
              >
                <span className="lidc-deck-picker-row-name">{unit.label}</span>
                <span className="lidc-deck-picker-row-cost">
                  <Coins size={12} />
                  <strong>{cost}</strong>
                  <Plus size={13} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const hasBudget = totals.cap > 0;

  return (
    <div className={`lidc-deck-builder ${readOnly ? 'is-readonly' : ''}`}>
      <header className="lidc-deck-builder-summary">
        <div className="lidc-deck-builder-summary-main">
          <span className="lidc-deck-builder-summary-label">{t('lidc.builder.totalBudget')}</span>
          <span className={`lidc-deck-builder-summary-value ${totals.spent > totals.cap ? 'is-over' : ''}`}>
            <strong>{totals.spent}</strong>
            <span>/ {totals.cap}</span>
          </span>
        </div>
        <div className="lidc-deck-builder-summary-units">
          {t('lidc.deck.totalUnits')}: <strong>{totals.unitCount}</strong>
        </div>
      </header>

      {!hasBudget && (
        <p className="lidc-deck-builder-hint">{t('lidc.builder.noBudgetHint')}</p>
      )}

      <div className="lidc-deck-builder-categories">
        {DECK_CATEGORY_META.map(({ key, labelKey, Icon }) => {
          const cap = capsByCategory[key] || 0;
          const spent = spentByCategory[key] || 0;
          const remaining = cap - spent;
          const fillRatio = cap > 0 ? Math.min(1, spent / cap) : 0;
          const selectedUnits = (unitsByCategory[key] || []).filter(
            (unit) => Number(quantities[unit.id] || 0) > 0,
          );
          const ghostCount = Math.max(
            0,
            MIN_SLOTS_PER_CATEGORY - selectedUnits.length - (readOnly ? 0 : 1),
          );
          const isExpanded = expandedCategory === key;

          return (
            <section key={key} className={`lidc-deck-cat ${isExpanded ? 'is-expanded' : ''}`}>
              <header className="lidc-deck-cat-head">
                <div className="lidc-deck-cat-title">
                  <Icon size={15} />
                  <h3>{t(labelKey)}</h3>
                </div>
                <div className={`lidc-deck-cat-budget ${spent > cap ? 'is-over' : ''}`}>
                  <strong>{spent}</strong>
                  <span>/ {cap}</span>
                </div>
              </header>

              <div className={`lidc-deck-cat-bar ${spent > cap ? 'is-over' : ''}`}>
                <span style={{ width: `${fillRatio * 100}%` }} />
              </div>

              <CategoryDeckSlots
                categoryKey={key}
                selectedUnits={selectedUnits}
                ghostCount={ghostCount}
                cap={cap}
                isExpanded={isExpanded}
                readOnly={readOnly}
                onTogglePicker={() => toggleCategoryPicker(key)}
                renderCategoryCard={renderCategoryCard}
                renderCategoryPicker={renderCategoryPicker}
              />

              {!readOnly && cap > 0 && (
                <p className="lidc-deck-cat-foot">
                  {t('lidc.deck.remaining')}: <strong>{Math.max(0, remaining)}</strong>
                </p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
