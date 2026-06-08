import { useEffect, useState } from 'react';
import AtcBoardStrip from './AtcBoardStrip';
import { OWNER_ROLE, STRIP_CATEGORY, canShowMoveSlots } from './atcStripModel';
import { t } from '../../utils/locale';

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
  moveSourceId,
  moveArmedId,
  onMoveArm,
  nextActions = {},
  entryMode,
  onSelect,
  onFieldChange,
  onFieldCommit,
  onInlineEditFocus,
  onInlineEditBlur,
  inlineEditStripId,
  onExpand,
  onAction,
  onCoordinate,
  onCancelHandoff,
  onCategoryClick,
  onInsertBefore,
  operatorRole,
  onConfigChange,
  readOnly = false,
  runwayDropDisabled = false,
}) {
  const activeEnd = config.activeEnd === '2' ? '2' : '1';
  const canEditMet = !readOnly && Boolean(operatorRole);
  const canEditActiveEnd = canEditMet && operatorRole === OWNER_ROLE.TOWER;
  const canDrop = Boolean(
    moveSourceId
    && !runwayDropDisabled
    && canShowMoveSlots(STRIP_CATEGORY.RUNWAY, operatorRole),
  );
  const showSlots = canDrop;

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
          label={t('atc.runway.cloud')}
          value={config.cloud}
          onCommit={(cloud) => onConfigChange?.({ cloud })}
          disabled={!canEditMet}
        />
        <MetField
          label={t('atc.runway.notes')}
          value={config.notes}
          onCommit={(notes) => onConfigChange?.({ notes })}
          disabled={!canEditMet}
        />
      </div>

      <div
        className={`atc-runway__surface ${canDrop ? 'atc-runway__surface--drop-target' : ''}`}
        onClick={() => {
          if (canDrop) onCategoryClick?.(STRIP_CATEGORY.RUNWAY);
        }}
        role="presentation"
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

        <div className="atc-runway__occupancy">
          {runwayStrips.map((strip) => (
            <div key={strip.id} className="atc-strip-with-slot">
              {showSlots && strip.id !== moveSourceId && (
                <button
                  type="button"
                  className="atc-insert-slot atc-insert-slot--active"
                  title={t('atc.move.insertBefore', { callsign: strip.callsign })}
                  onClick={(e) => {
                    e.stopPropagation();
                    onInsertBefore?.(STRIP_CATEGORY.RUNWAY, strip.id);
                  }}
                />
              )}
              <AtcBoardStrip
                strip={strip}
                selected={selectedId === strip.id}
                moveSelected={moveSourceId === strip.id}
                moveArmed={moveArmedId === strip.id}
                nextAction={nextActions[strip.id]}
                onSelect={onSelect}
                onMoveArm={onMoveArm}
                onFieldChange={onFieldChange}
                onFieldCommit={onFieldCommit}
                onInlineEditFocus={onInlineEditFocus}
                onInlineEditBlur={onInlineEditBlur}
                inlineEditStripId={inlineEditStripId}
                entryMode={entryMode}
                onExpand={onExpand}
                onAction={onAction}
                onCoordinate={onCoordinate}
                onCancelHandoff={onCancelHandoff}
                operatorRole={operatorRole}
                readOnly={readOnly}
                sectorReadOnly={runwayDropDisabled}
              />
            </div>
          ))}
          {showSlots && (
            <button
              type="button"
              className="atc-insert-slot atc-insert-slot--active"
              title={t('atc.move.insertEnd')}
              onClick={(e) => {
                e.stopPropagation();
                onInsertBefore?.(STRIP_CATEGORY.RUNWAY, null);
              }}
            />
          )}
        </div>
      </div>

      <div className="atc-runway-panel__ground-label">{t('atc.roles.ground')}</div>
    </div>
  );
}
