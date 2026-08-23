import { useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  Coins,
  Forklift,
  Helicopter,
  Plane,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { t } from '../utils/locale';
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

export default function LidcDeckBuilder({
  units = [],
  quantities = {},
  caps = null,
  onChange = null,
  readOnly = false,
}) {
  const [expandedCategory, setExpandedCategory] = useState('');
  const [pickerQuery, setPickerQuery] = useState('');

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
    setPickerQuery('');
    setExpandedCategory((prev) => (prev === categoryKey ? '' : categoryKey));
  }

  function renderCategoryCard(unit, categoryKey) {
    const quantity = Number(quantities[unit.id] || 0);
    const remaining = (capsByCategory[categoryKey] || 0) - (spentByCategory[categoryKey] || 0);
    const canIncrease = !readOnly && remaining >= Number(unit.cost || 0);

    return (
      <article key={unit.id} className="lidc-deck-card">
        <header className="lidc-deck-card-head">
          <span className="lidc-deck-card-name" title={unit.label}>{unit.label}</span>
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
        </header>

        <div className="lidc-deck-card-cost">
          <Coins size={12} />
          <strong>{Number(unit.cost || 0) * quantity}</strong>
          <span>{t('lidc.builder.unitCostEach', { cost: unit.cost })}</span>
        </div>

        <footer className="lidc-deck-card-foot">
          <div className="lidc-deck-card-stepper">
            <button
              type="button"
              className="lidc-deck-step-btn"
              onClick={() => setUnitQuantity(unit, quantity - 1)}
              disabled={readOnly || quantity <= 0}
              aria-label={t('lidc.builder.decrease')}
            >
              -
            </button>
            <span className="lidc-deck-card-qty">x{quantity}</span>
            <button
              type="button"
              className="lidc-deck-step-btn"
              onClick={() => setUnitQuantity(unit, quantity + 1)}
              disabled={!canIncrease}
              aria-label={t('lidc.builder.increase')}
            >
              +
            </button>
          </div>
        </footer>
      </article>
    );
  }

  function renderPicker() {
    const meta = DECK_CATEGORY_META.find(({ key }) => key === pickerCategory);
    if (!meta) return null;

    const remaining = (capsByCategory[meta.key] || 0) - (spentByCategory[meta.key] || 0);
    const query = pickerQuery.trim().toLowerCase();
    const candidates = (unitsByCategory[meta.key] || []).filter((unit) => {
      if (!query) return true;
      return String(unit.label).toLowerCase().includes(query);
    });

    return (
      <div className="lidc-deck-picker" role="dialog" aria-modal="true" aria-label={t(meta.labelKey)}>
        <header className="lidc-deck-picker-head">
          <div className="lidc-deck-picker-title">
            <meta.Icon size={15} />
            <h4>{t('lidc.builder.pickerTitle', { category: t(meta.labelKey) })}</h4>
          </div>
          <button
            type="button"
            className="lidc-deck-picker-close"
            onClick={() => setPickerCategory('')}
            aria-label={t('lidc.builder.closePicker')}
          >
            <X size={15} />
          </button>
        </header>

        <div className="lidc-deck-picker-toolbar">
          <label className="lidc-deck-picker-search">
            <Search size={14} />
            <input
              value={pickerQuery}
              onChange={(event) => setPickerQuery(event.target.value)}
              placeholder={t('lidc.builder.searchPlaceholder')}
              autoFocus
            />
          </label>
          <span className="lidc-deck-picker-budget">
            {t('lidc.deck.remaining')}: <strong>{Math.max(0, remaining)}</strong>
          </span>
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
                <span className="lidc-deck-picker-row-main">
                  <span className="lidc-deck-picker-row-name">{unit.label}</span>
                  {quantity > 0 && (
                    <span className="lidc-deck-picker-row-badge">{t('lidc.builder.inDeck', { count: quantity })}</span>
                  )}
                </span>
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

          return (
            <section key={key} className="lidc-deck-cat">
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

              <div className="lidc-deck-slots">
                {selectedUnits.map((unit) => renderCategoryCard(unit, key))}

                {!readOnly && (
                  <button
                    type="button"
                    className="lidc-deck-slot-add"
                    onClick={() => openPicker(key)}
                    disabled={cap <= 0}
                  >
                    <Plus size={18} />
                    <span>{t('lidc.builder.addUnit')}</span>
                  </button>
                )}

                {Array.from({ length: ghostCount }).map((_, index) => (
                  <span key={`ghost-${key}-${index}`} className="lidc-deck-slot-ghost" aria-hidden="true" />
                ))}
              </div>

              {!readOnly && cap > 0 && (
                <p className="lidc-deck-cat-foot">
                  {t('lidc.deck.remaining')}: <strong>{Math.max(0, remaining)}</strong>
                </p>
              )}
            </section>
          );
        })}
      </div>

      {pickerCategory && (
        <>
          <button
            type="button"
            className="lidc-deck-picker-backdrop"
            onClick={() => setPickerCategory('')}
            aria-label={t('lidc.builder.closePicker')}
          />
          {renderPicker()}
        </>
      )}
    </div>
  );
}
