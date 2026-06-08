import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AtcStripCard from './AtcStripCard';
import { canEditStrip, getStripCategory } from './atcStripModel';

export default function AtcSortableStrip({
  strip,
  selected,
  nextAction,
  onSelect,
  onEdit,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly,
  sectorReadOnly,
}) {
  const editable = !readOnly && canEditStrip(strip, operatorRole);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: strip.id,
    data: { strip, categoryId: getStripCategory(strip) },
    disabled: !editable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    flexShrink: 0,
  };

  return (
    <div ref={setNodeRef} style={style} {...(editable ? { ...attributes, ...listeners } : {})}>
      <AtcStripCard
        strip={strip}
        selected={selected}
        nextAction={nextAction}
        onSelect={onSelect}
        onEdit={editable ? onEdit : undefined}
        onAction={onAction}
        onCoordinate={onCoordinate}
        onCancelHandoff={onCancelHandoff}
        operatorRole={operatorRole}
        readOnly={!editable}
      />
    </div>
  );
}
