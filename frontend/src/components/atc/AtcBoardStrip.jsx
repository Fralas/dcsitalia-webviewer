import AtcStripCard from './AtcStripCard';
import { canEditStrip } from './atcStripModel';

export default function AtcBoardStrip({
  strip,
  selected,
  moveSelected,
  nextAction,
  onSelect,
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

  return (
    <div
      className={[
        'atc-board-strip',
        selected ? 'atc-board-strip--selected' : '',
        moveSelected ? 'atc-board-strip--move-source' : '',
      ].filter(Boolean).join(' ')}
      style={{ flexShrink: 0 }}
    >
      <AtcStripCard
        strip={strip}
        selected={selected}
        nextAction={nextAction}
        onSelect={onSelect}
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
