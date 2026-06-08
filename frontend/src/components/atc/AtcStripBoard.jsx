import { useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AtcStripCard from './AtcStripCard';
import {
  ATC_BAYS,
  BAY_META,
  GROUND_BAYS,
  TOWER_BAYS,
  COORDINATION_STATUS,
  getBaysForRole,
  groupStripsForRole,
  canEditStrip,
} from './atcStripModel';
import { t } from '../../utils/locale';

function SortableStrip({
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
}) {
  const editable = !readOnly && canEditStrip(strip, operatorRole);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: strip.id,
    data: { strip, bayId: strip.bayId },
    disabled: !editable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...(editable ? { ...attributes, ...listeners } : {})}>
      <AtcStripCard
        strip={strip}
        selected={selected}
        nextAction={nextAction}
        onSelect={onSelect}
        onEdit={onEdit}
        onAction={onAction}
        onCoordinate={onCoordinate}
        onCancelHandoff={onCancelHandoff}
        operatorRole={operatorRole}
        readOnly={!editable}
      />
    </div>
  );
}

function DroppableBay({ bayId, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: bayId, data: { bayId } });
  return (
    <div ref={setNodeRef} className={`atc-bay-drop ${isOver ? 'atc-bay-drop--over' : ''}`} data-bay-drop={bayId}>
      {children}
    </div>
  );
}

function BayColumn({
  bayId,
  strips,
  selectedId,
  nextActions,
  onSelect,
  onEdit,
  onAction,
  onCoordinate,
  onCancelHandoff,
  operatorRole,
  readOnly,
}) {
  const meta = BAY_META[bayId];
  const pendingCount = strips.filter((s) => s.coordinationStatus === COORDINATION_STATUS.PENDING_TOC).length;

  return (
    <div className={`atc-bay ${pendingCount ? 'atc-bay--alert' : ''}`} data-bay={bayId}>
      <div className="atc-bay__header">
        <span>{t(meta?.labelKey || bayId)}</span>
        <span className="atc-bay__count">{strips.length}</span>
        {pendingCount > 0 && <span className="atc-bay__pending">{pendingCount}</span>}
      </div>
      <SortableContext items={strips.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <div className="atc-bay__strips">
          {strips.map((strip) => (
            <SortableStrip
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
            />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export default function AtcStripBoard({
  strips = [],
  operatorRole,
  selectedId,
  nextActions = {},
  onSelect,
  onEdit,
  onAction,
  onCoordinate,
  onCancelHandoff,
  onMoveStrip,
  activeDragId,
  setActiveDragId,
  readOnly = false,
}) {
  const grouped = useMemo(
    () => (operatorRole ? groupStripsForRole(strips, operatorRole) : {}),
    [strips, operatorRole],
  );
  const bays = useMemo(() => getBaysForRole(operatorRole), [operatorRole]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeStrip = strips.find((s) => s.id === activeDragId);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId?.(null);
    if (!over) return;

    const strip = strips.find((s) => s.id === active.id);
    if (!strip) return;

    const overBay = over.data?.current?.bayId || over.id;
    const isBay = typeof overBay === 'string' && (
      overBay.startsWith('g_') || overBay.startsWith('t_') || overBay === ATC_BAYS.ARCHIVE
    );
    if (!isBay) return;

    if (strip.handoffActive && overBay.startsWith('g_') && overBay !== ATC_BAYS.G_HANDOFF) {
      onCancelHandoff?.(strip, overBay);
      return;
    }

    const displayBay = strip.handoffActive ? ATC_BAYS.G_HANDOFF : strip.bayId;
    if (overBay !== displayBay) {
      onMoveStrip?.(strip, overBay);
    }
  };

  if (!operatorRole) return null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => {
        if (!readOnly) setActiveDragId?.(e.active.id);
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="atc-board">
        <section className="atc-board-section">
          <h3 className="atc-board-section__title">
            {operatorRole === 'GROUND' ? t('atc.roles.ground') : t('atc.roles.tower')}
          </h3>
          <div className="atc-board-section__columns">
            {bays.map((bayId) => (
              <DroppableBay key={bayId} bayId={bayId}>
                <BayColumn
                  bayId={bayId}
                  strips={grouped[bayId] || []}
                  selectedId={selectedId}
                  nextActions={nextActions}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  onAction={onAction}
                  onCoordinate={onCoordinate}
                  onCancelHandoff={onCancelHandoff}
                  operatorRole={operatorRole}
                  readOnly={readOnly}
                />
              </DroppableBay>
            ))}
          </div>
        </section>
      </div>
      <DragOverlay>
        {activeStrip ? (
          <AtcStripCard strip={activeStrip} selected={false} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
