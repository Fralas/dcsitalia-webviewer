import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AtcStripCard from './AtcStripCard';
import { canEditStrip, getStripCategory } from './atcStripModel';

export default function AtcSortableStrip({
  strip,
  selected,
  nextAction,
  onSelect,
  onFieldChange,
  onFieldCommit,
  onInlineEditFocus,
  onInlineEditBlur,
  inlineEditStripId,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly,
  sectorReadOnly,
}) {
  const editable = !readOnly && !sectorReadOnly && canEditStrip(strip, operatorRole);
  const dragDisabled = !editable || inlineEditStripId === strip.id;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: strip.id,
    data: { strip, categoryId: getStripCategory(strip) },
    disabled: dragDisabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    flexShrink: 0,
  };

  return (
    <div ref={setNodeRef} style={style} {...(editable && inlineEditStripId !== strip.id ? { ...attributes, ...listeners } : {})}>
      <AtcStripCard
        strip={strip}
        selected={selected}
        nextAction={nextAction}
        onSelect={onSelect}
        onFieldChange={onFieldChange}
        onFieldCommit={onFieldCommit}
        onFieldFocus={() => onInlineEditFocus?.(strip.id)}
        onFieldBlur={onInlineEditBlur}
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
