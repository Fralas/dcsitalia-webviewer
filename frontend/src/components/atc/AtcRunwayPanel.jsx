import { useEffect, useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import AtcSortableStrip from './AtcSortableStrip';
import { OWNER_ROLE, STRIP_CATEGORY } from './atcStripModel';
import { t } from '../../utils/locale';

function categoryDropId(categoryId) {
  return `cat_${categoryId}`;
}

function MetField({ label, value, onCommit, disabled }) {
  const [draft, setDraft] = useState(value || '');

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  return (
    <label className="atc-runway__met-field">
      <span className="atc-runway__met-label">{label}</span>
      <input
        type="text"
        className="atc-runway__met-input"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onCommit?.(draft)}
        disabled={disabled}
      />
    </label>
  );
}

function RunwayEndNumber({ value, active, side, onSelect, onCommit, canEditEnd, canEditActive }) {
  const [draft, setDraft] = useState(value || '');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  return (
    <div className={`atc-runway__number atc-runway__number--${side} ${active ? 'atc-runway__number--active' : ''}`}>
      <input
        type="text"
        className="atc-runway__number-input"
        value={draft}
        readOnly={!editing}
        maxLength={3}
        title={canEditEnd ? `${t('atc.runway.selectEnd')}. ${t('atc.runway.editEnd')}` : canEditActive ? t('atc.runway.selectEnd') : undefined}
        onClick={() => {
          if (!editing && canEditActive) onSelect?.();
        }}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (canEditEnd) setEditing(true);
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (editing) {
            setEditing(false);
            onCommit?.(draft);
          }
        }}
      />
    </div>
  );
}

export default function AtcRunwayPanel({
  config = {},
  runwayStrips = [],
  selectedId,
  nextActions = {},
  onSelect,
  onEdit,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  onConfigChange,
  readOnly = false,
  runwayDropDisabled = false,
}) {
  const activeEnd = config.activeEnd === '2' ? '2' : '1';
  const canEditMet = !readOnly && Boolean(operatorRole);
  const canEditActiveEnd = canEditMet && operatorRole === OWNER_ROLE.TOWER;

  const { setNodeRef, isOver } = useDroppable({
    id: categoryDropId(STRIP_CATEGORY.RUNWAY),
    data: { categoryId: STRIP_CATEGORY.RUNWAY },
    disabled: runwayDropDisabled,
  });

  return (
    <div className="atc-runway-panel">
      <div className="atc-runway-panel__tower-label">{t('atc.roles.tower')}</div>

      <div className="atc-runway__met">
        <MetField
          label={t('atc.runway.qnh')}
          value={config.qnh}
          onCommit={(qnh) => onConfigChange?.({ qnh })}
          disabled={!canEditMet}
        />
        <MetField
          label={t('atc.runway.wind')}
          value={config.wind}
          onCommit={(wind) => onConfigChange?.({ wind })}
          disabled={!canEditMet}
        />
        <MetField
          label={t('atc.runway.qfu')}
          value={config.qfu}
          onCommit={(qfu) => onConfigChange?.({ qfu })}
          disabled={!canEditMet}
        />
        <MetField
          label={t('atc.runway.cloud')}
          value={config.cloud}
          onCommit={(cloud) => onConfigChange?.({ cloud })}
          disabled={!canEditMet}
        />
      </div>

      <div
        ref={setNodeRef}
        className={`atc-runway__surface ${isOver && !runwayDropDisabled ? 'atc-runway__surface--over' : ''}`}
      >
        <div className="atc-runway__centerline" />

        <RunwayEndNumber
          value={config.end1}
          active={activeEnd === '1'}
          side="left"
          onSelect={() => onConfigChange?.({ activeEnd: '1' })}
          onCommit={(end1) => onConfigChange?.({ end1 })}
          canEditEnd={canEditMet}
          canEditActive={canEditActiveEnd}
        />

        <RunwayEndNumber
          value={config.end2}
          active={activeEnd === '2'}
          side="right"
          onSelect={() => onConfigChange?.({ activeEnd: '2' })}
          onCommit={(end2) => onConfigChange?.({ end2 })}
          canEditEnd={canEditMet}
          canEditActive={canEditActiveEnd}
        />

        <SortableContext items={runwayStrips.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
          <div className="atc-runway__occupancy">
            {runwayStrips.map((strip) => (
              <AtcSortableStrip
                key={strip.id}
                strip={strip}
                selected={selectedId === strip.id}
                nextAction={nextActions[strip.id]}
                onSelect={onSelect}
                onEdit={onEdit}
                onAction={onAction}
                onCoordinate={onCoordinate}
                onCancelHandoff={onCancelHandoff}
                operatorRole={operatorRole}
                readOnly={readOnly}
                sectorReadOnly={runwayDropDisabled}
              />
            ))}
          </div>
        </SortableContext>
      </div>

      <div className="atc-runway-panel__ground-label">{t('atc.roles.ground')}</div>
    </div>
  );
}
