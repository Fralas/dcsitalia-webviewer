import { useMemo } from 'react';
import { Check } from 'lucide-react';
import { t } from '../utils/locale';
import { DECK_CATEGORY_META } from './LidcDeckBuilder';
import './LidcSpecializationPicker.css';

export function sumSpecializationCaps(specializations) {
  const caps = {};
  DECK_CATEGORY_META.forEach(({ key }) => {
    caps[key] = (Array.isArray(specializations) ? specializations : []).reduce(
      (sum, entry) => sum + Number(entry?.caps?.[key] || 0),
      0,
    );
  });
  return caps;
}

function getDominantCategoryKey(specialization) {
  let dominantKey = '';
  let dominantValue = -1;

  DECK_CATEGORY_META.forEach(({ key }) => {
    const value = Number(specialization?.caps?.[key] || 0);
    if (value > dominantValue) {
      dominantValue = value;
      dominantKey = key;
    }
  });

  return dominantKey;
}

export default function LidcSpecializationPicker({
  specializations = [],
  selectedIds = [],
  slots = 2,
  onChange = null,
}) {
  const selected = useMemo(
    () => selectedIds
      .map((id) => specializations.find((entry) => entry.id === id))
      .filter(Boolean),
    [specializations, selectedIds],
  );

  const combinedCaps = useMemo(() => sumSpecializationCaps(selected), [selected]);
  const combinedTotal = useMemo(
    () => DECK_CATEGORY_META.reduce((sum, { key }) => sum + (combinedCaps[key] || 0), 0),
    [combinedCaps],
  );

  function toggleSpecialization(specializationId) {
    if (!onChange) return;

    if (selectedIds.includes(specializationId)) {
      onChange(selectedIds.filter((id) => id !== specializationId));
      return;
    }

    if (selectedIds.length >= slots) {
      // Oldest pick rotates out so a full selection stays directly clickable.
      onChange([...selectedIds.slice(1), specializationId]);
      return;
    }

    onChange([...selectedIds, specializationId]);
  }

  return (
    <div className="lidc-spec-picker">
      <div className="lidc-spec-slots">
        {Array.from({ length: slots }).map((_, index) => {
          const entry = selected[index] || null;
          return (
            <div key={`slot-${index}`} className={`lidc-spec-slot ${entry ? 'is-filled' : ''}`}>
              <span className="lidc-spec-slot-index">{index + 1}</span>
              <span className="lidc-spec-slot-name">
                {entry ? entry.name : t('lidc.specializations.emptySlot')}
              </span>
              {entry && (
                <button
                  type="button"
                  className="lidc-spec-slot-clear"
                  onClick={() => toggleSpecialization(entry.id)}
                  aria-label={t('lidc.specializations.clearSlot')}
                >
                  &times;
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="lidc-spec-combined">
        <div className="lidc-spec-combined-head">
          <span>{t('lidc.specializations.combinedCaps')}</span>
          <strong>{combinedTotal}</strong>
        </div>
        <ul className="lidc-spec-combined-list">
          {DECK_CATEGORY_META.map(({ key, labelKey, Icon }) => (
            <li key={key}>
              <Icon size={13} />
              <span>{t(labelKey)}</span>
              <strong>{combinedCaps[key] || 0}</strong>
            </li>
          ))}
        </ul>
      </div>

      <div className="lidc-spec-grid">
        {specializations.map((entry) => {
          const isSelected = selectedIds.includes(entry.id);
          const dominantKey = getDominantCategoryKey(entry);
          const dominantMeta = DECK_CATEGORY_META.find(({ key }) => key === dominantKey);
          const total = DECK_CATEGORY_META.reduce(
            (sum, { key }) => sum + Number(entry?.caps?.[key] || 0),
            0,
          );

          return (
            <button
              type="button"
              key={entry.id}
              className={`lidc-spec-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => toggleSpecialization(entry.id)}
              aria-pressed={isSelected}
            >
              <header className="lidc-spec-card-head">
                <div className="lidc-spec-card-title">
                  {dominantMeta && <dominantMeta.Icon size={15} />}
                  <h4>{entry.name}</h4>
                </div>
                <span className={`lidc-spec-card-check ${isSelected ? 'is-selected' : ''}`}>
                  {isSelected && <Check size={12} />}
                </span>
              </header>

              <p className="lidc-spec-card-desc">
                {entry.description || t('lidc.specializations.noDescription')}
              </p>

              <ul className="lidc-spec-card-caps">
                {DECK_CATEGORY_META.map(({ key, labelKey }) => (
                  <li key={key} className={key === dominantKey ? 'is-dominant' : ''}>
                    <span>{t(labelKey)}</span>
                    <strong>{Number(entry?.caps?.[key] || 0)}</strong>
                  </li>
                ))}
              </ul>

              <footer className="lidc-spec-card-foot">
                <span>{t('lidc.specializations.cardTotal')}</span>
                <strong>{total}</strong>
              </footer>
            </button>
          );
        })}
      </div>
    </div>
  );
}
