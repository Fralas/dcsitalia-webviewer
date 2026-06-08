import { useRef } from 'react';
import AtcStripCard from './AtcStripCard';
import { canEditStrip } from './atcStripModel';
import { isCoarsePointer, TAP_SLOP_PX, useDoubleTapHandler } from './atcPointerGestures';

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
  const { registerTap } = useDoubleTapHandler(() => onExpand?.(strip));
  const tapRef = useRef(null);

  const handlePointerDown = (event) => {
    if (inkMode || !onExpand || !isCoarsePointer(event)) return;
    tapRef.current = { x: event.clientX, y: event.clientY, moved: false };
  };

  const handlePointerMove = (event) => {
    if (!tapRef.current || inkMode) return;
    const dx = event.clientX - tapRef.current.x;
    const dy = event.clientY - tapRef.current.y;
    if (Math.hypot(dx, dy) > TAP_SLOP_PX) tapRef.current.moved = true;
  };

  const handlePointerUp = (event) => {
    if (inkMode || !onExpand || !tapRef.current || tapRef.current.moved) {
      tapRef.current = null;
      return;
    }
    if (!isCoarsePointer(event)) {
      tapRef.current = null;
      return;
    }
    registerTap(tapRef.current.x, tapRef.current.y);
    tapRef.current = null;
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
      onPointerDown={onExpand ? handlePointerDown : undefined}
      onPointerMove={onExpand ? handlePointerMove : undefined}
      onPointerUp={onExpand ? handlePointerUp : undefined}
      onPointerCancel={onExpand ? handlePointerUp : undefined}
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
