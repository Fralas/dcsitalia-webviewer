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
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import AtcStripCard from './AtcStripCard';
import AtcSortableStrip from './AtcSortableStrip';
import AtcRunwayPanel from './AtcRunwayPanel';
import {
  ATC_BAYS,
  OWNER_ROLE,
  STRIP_CATEGORY,
  TOWER_CATEGORY_ORDER,
  GROUND_CATEGORY_ORDER,
  groupStripsByCategory,
  canEditStrip,
  isCategoryOwnedByRole,
  getTargetBayForCategory,
  getOperationalStateForCategory,
  isHandoffToGround,
  isHandoffToTower,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
} from './atcStripModel';
import { t } from '../../utils/locale';

function categoryDropId(categoryId) {
  return `cat_${categoryId}`;
}

function parseCategoryDropId(id) {
  if (typeof id !== 'string' || !id.startsWith('cat_')) return null;
  return id.slice(4);
}

function isSharedCategory(categoryId) {
  return categoryId === STRIP_CATEGORY.HP;
}

function isCategoryDropAllowed(categoryId, role) {
  if (categoryId === STRIP_CATEGORY.HP && role === OWNER_ROLE.TOWER) return false;
  return isCategoryOwnedByRole(categoryId, role);
}

function DroppableCategory({ categoryId, disabled, children }) {
  const { setNodeRef, isOver } = useDroppable({
    id: categoryDropId(categoryId),
    data: { categoryId },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      className={`atc-category-drop ${isOver && !disabled ? 'atc-category-drop--over' : ''} ${disabled ? 'atc-category-drop--locked' : ''}`}
      data-category={categoryId}
    >
      {children}
    </div>
  );
}

function CategoryRow({
  categoryId,
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
  const pendingCount = strips.filter(
    (s) => isPendingTowerCoordination(s) || isPendingGroundCoordination(s),
  ).length;
  const labelKey = `atc.categories.${categoryId}`;

  return (
    <div className={`atc-category-row ${pendingCount ? 'atc-category-row--alert' : ''} ${sectorReadOnly ? 'atc-category-row--readonly' : ''}`}>
      <div className="atc-category-row__label">
        <span>{t(labelKey)}</span>
        <span className="atc-category-row__count">{strips.length}</span>
        {pendingCount > 0 && <span className="atc-category-row__pending">{pendingCount}</span>}
      </div>
      <SortableContext items={strips.map((s) => s.id)} strategy={horizontalListSortingStrategy}>
        <div className="atc-category-row__strips">
          {strips.map((strip) => (
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
              sectorReadOnly={sectorReadOnly}
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
  runwayConfig = {},
  onSelect,
  onEdit,
  onAction,
  onCoordinate,
  onCancelHandoff,
  onMoveStrip,
  onRunwayConfigChange,
  activeDragId,
  setActiveDragId,
  readOnly = false,
}) {
  const grouped = useMemo(() => groupStripsByCategory(strips), [strips]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeStrip = strips.find((s) => s.id === activeDragId);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveDragId?.(null);
    if (!over || readOnly) return;

    const strip = strips.find((s) => s.id === active.id);
    if (!strip || !canEditStrip(strip, operatorRole)) return;

    const categoryId = parseCategoryDropId(over.id) || over.data?.current?.categoryId;
    if (!categoryId) return;

    if (!isCategoryDropAllowed(categoryId, operatorRole)) return;

    const targetBay = getTargetBayForCategory(strip, categoryId);

    if (isHandoffToTower(strip) && categoryId !== STRIP_CATEGORY.ATZ) {
      if (categoryId === STRIP_CATEGORY.HP || categoryId === STRIP_CATEGORY.TAXI || categoryId === STRIP_CATEGORY.STAND) {
        onCancelHandoff?.(strip, targetBay);
      }
      return;
    }

    if (isHandoffToGround(strip) && categoryId !== STRIP_CATEGORY.HP) {
      if ([STRIP_CATEGORY.ATZ, STRIP_CATEGORY.DOWNWIND, STRIP_CATEGORY.BASE, STRIP_CATEGORY.FINAL, STRIP_CATEGORY.RUNWAY].includes(categoryId)) {
        onCancelHandoff?.(strip, targetBay);
      }
      return;
    }

    const operationalState = getOperationalStateForCategory(categoryId);
    const sameBay = targetBay === strip.bayId;
    const sameState = !operationalState || operationalState === strip.operationalState;

    if (sameBay && sameState) return;

    onMoveStrip?.(strip, targetBay, { operationalState });
  };

  if (!operatorRole) return null;

  const renderCategory = (categoryId, sectorRole) => {
    const shared = isSharedCategory(categoryId);
    const sectorReadOnly = shared ? false : sectorRole !== operatorRole;
    const categoryLocked = readOnly || (!shared && sectorReadOnly) || !isCategoryDropAllowed(categoryId, operatorRole);
    const categoryStrips = grouped[categoryId] || [];

    return (
      <DroppableCategory key={categoryId} categoryId={categoryId} disabled={categoryLocked}>
        <CategoryRow
          categoryId={categoryId}
          strips={categoryStrips}
          selectedId={selectedId}
          nextActions={nextActions}
          onSelect={onSelect}
          onEdit={onEdit}
          onAction={onAction}
          onCoordinate={onCoordinate}
          onCancelHandoff={onCancelHandoff}
          operatorRole={operatorRole}
          readOnly={readOnly}
          sectorReadOnly={categoryLocked}
        />
      </DroppableCategory>
    );
  };

  const runwayLocked = readOnly || operatorRole !== OWNER_ROLE.TOWER;

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
      <div className="atc-board atc-board--runway">
        <section className="atc-board-section atc-board-section--tower">
          {TOWER_CATEGORY_ORDER.map((cat) => renderCategory(cat, OWNER_ROLE.TOWER))}
        </section>

        <AtcRunwayPanel
          config={runwayConfig}
          runwayStrips={grouped[STRIP_CATEGORY.RUNWAY] || []}
          selectedId={selectedId}
          nextActions={nextActions}
          onSelect={onSelect}
          onEdit={onEdit}
          onAction={onAction}
          onCoordinate={onCoordinate}
          onCancelHandoff={onCancelHandoff}
          operatorRole={operatorRole}
          onConfigChange={onRunwayConfigChange}
          readOnly={readOnly}
          runwayDropDisabled={runwayLocked}
        />

        <section className="atc-board-section atc-board-section--ground">
          {GROUND_CATEGORY_ORDER.map((cat) => renderCategory(cat, OWNER_ROLE.GROUND))}
          {(grouped[STRIP_CATEGORY.INACTIVE]?.length > 0) && renderCategory(STRIP_CATEGORY.INACTIVE, OWNER_ROLE.GROUND)}
        </section>
      </div>

      <DragOverlay>
        {activeStrip ? (
          <AtcStripCard strip={activeStrip} selected={false} readOnly />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
