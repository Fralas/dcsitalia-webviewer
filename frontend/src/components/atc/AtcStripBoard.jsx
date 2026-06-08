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
  OWNER_ROLE,
  groupStripsForFullBoard,
  canEditStrip,
  isBayOwnedByRole,
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

function DroppableBay({ bayId, disabled, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: bayId, data: { bayId }, disabled });
  return (
    <div
      ref={setNodeRef}
      className={`atc-bay-drop ${isOver && !disabled ? 'atc-bay-drop--over' : ''} ${disabled ? 'atc-bay-drop--locked' : ''}`}
      data-bay-drop={bayId}
    >
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
  sectorReadOnly,
}) {
  const meta = BAY_META[bayId];
  const pendingCount = strips.filter((s) => s.coordinationStatus === COORDINATION_STATUS.PENDING_TOC).length;
  const bayLocked = readOnly || sectorReadOnly;

  return (
    <div className={`atc-bay ${pendingCount ? 'atc-bay--alert' : ''} ${bayLocked ? 'atc-bay--readonly' : ''}`} data-bay={bayId}>
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

const BOARD_SECTIONS = [
  { role: OWNER_ROLE.GROUND, bays: GROUND_BAYS, titleKey: 'atc.roles.ground' },
  { role: OWNER_ROLE.TOWER, bays: TOWER_BAYS, titleKey: 'atc.roles.tower' },
];

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
  const grouped = useMemo(() => groupStripsForFullBoard(strips), [strips]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeStrip = strips.find((s) => s.id === activeDragId);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId?.(null);
    if (!over || readOnly) return;

    const strip = strips.find((s) => s.id === active.id);
    if (!strip || !canEditStrip(strip, operatorRole)) return;

    const overBay = over.data?.current?.bayId || over.id;
    const isBay = typeof overBay === 'string' && (
      overBay.startsWith('g_') || overBay.startsWith('t_') || overBay === ATC_BAYS.ARCHIVE
    );
    if (!isBay || !isBayOwnedByRole(overBay, operatorRole)) return;

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
        const strip = strips.find((s) => s.id === e.active.id);
        if (!readOnly && strip && canEditStrip(strip, operatorRole)) {
          setActiveDragId?.(e.active.id);
        }
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="atc-board">
        {BOARD_SECTIONS.map((section) => {
          const sectorReadOnly = section.role !== operatorRole;
          return (
            <section
              key={section.role}
              className={`atc-board-section ${sectorReadOnly ? 'atc-board-section--readonly' : ''}`}
            >
              <h3 className="atc-board-section__title">
                {t(section.titleKey)}
                {sectorReadOnly && (
                  <span className="atc-board-section__badge">{t('atc.otherSector')}</span>
                )}
              </h3>
              <div className="atc-board-section__columns">
                {section.bays.map((bayId) => {
                  const bayLocked = sectorReadOnly || !isBayOwnedByRole(bayId, operatorRole);
                  return (
                    <DroppableBay key={bayId} bayId={bayId} disabled={bayLocked || readOnly}>
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
                        sectorReadOnly={bayLocked}
                      />
                    </DroppableBay>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <DragOverlay>
        {activeStrip ? (
          <AtcStripCard strip={activeStrip} selected={false} readOnly />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
