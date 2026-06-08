import { useRef } from 'react';
import AtcStripCard from './AtcStripCard';
import { canEditStrip } from './atcStripModel';

const LONG_PRESS_MS = 550;

export default function AtcBoardStrip({
  strip,
  selected,
  moveSelected,
  moveArmed,
  nextAction,
  onSelect,
  onMoveArm,
  onFieldChange,
  onFieldCommit,
  onInlineEditFocus,
  onInlineEditBlur,
  inlineEditStripId,
  entryMode,
  onExpand,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly,
  sectorReadOnly,
}) {
  const editable = !readOnly && !sectorReadOnly && canEditStrip(strip, operatorRole);
  const inkMode = editable && entryMode === 'ink';
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handlePointerDown = (event) => {
    if (!inkMode || event.button === 2) return;
    longPressTriggeredRef.current = false;
    clearLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      onMoveArm?.(strip);
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
    }, LONG_PRESS_MS);
  };

  const handlePointerUp = () => {
    clearLongPress();
  };

  return (
    <div
      className={[
        'atc-board-strip',
        selected ? 'atc-board-strip--selected' : '',
        moveSelected ? 'atc-board-strip--move-source' : '',
        moveArmed ? 'atc-board-strip--move-armed' : '',
      ].filter(Boolean).join(' ')}
      style={{ flexShrink: 0 }}
      onPointerDown={inkMode ? handlePointerDown : undefined}
      onPointerUp={inkMode ? handlePointerUp : undefined}
      onPointerCancel={inkMode ? handlePointerUp : undefined}
      onPointerLeave={inkMode ? handlePointerUp : undefined}
    >
      <AtcStripCard
        strip={strip}
        selected={selected}
        moveArmed={moveArmed}
        nextAction={nextAction}
        onSelect={onSelect}
        onMoveArm={onMoveArm}
        onFieldChange={onFieldChange}
        onFieldCommit={onFieldCommit}
        onFieldFocus={() => onInlineEditFocus?.(strip.id)}
        onFieldBlur={onInlineEditBlur}
        entryMode={entryMode}
        onExpand={onExpand}
        onAction={onAction}
        onCoordinate={onCoordinate}
        onCancelHandoff={onCancelHandoff}
        operatorRole={operatorRole}
        readOnly={!editable}
        editable={editable}
      />
    </div>
  );
}
