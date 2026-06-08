import { useMemo, useCallback } from 'react';
import AtcBoardStrip from './AtcBoardStrip';
import AtcRunwayPanel from './AtcRunwayPanel';
import {
  OWNER_ROLE,
  STRIP_CATEGORY,
  TOWER_SINGLE_CATEGORY_ORDER,
  TOWER_PAIRED_CATEGORY_ROWS,
  GROUND_CATEGORY_ORDER,
  groupStripsByCategory,
  canEditStrip,
  isCategoryDropAllowed,
  getTargetBayForCategory,
  getOperationalStateForCategory,
  isHandoffToGround,
  isHandoffToTower,
  isPendingGroundCoordination,
  isPendingTowerCoordination,
  computeInsertPosition,
  canShowMoveSlots,
} from './atcStripModel';
import { t } from '../../utils/locale';

const TOWER_DROP_CATEGORIES = [
  ...TOWER_SINGLE_CATEGORY_ORDER,
  ...TOWER_PAIRED_CATEGORY_ROWS.flatMap((r) => [r.left, r.right]),
  STRIP_CATEGORY.RUNWAY,
];
const GROUND_DROP_CATEGORIES = [...GROUND_CATEGORY_ORDER, STRIP_CATEGORY.INACTIVE];

function StripInsertSlot({ active, onClick, title }) {
  return (
    <button
      type="button"
      className={`atc-insert-slot ${active ? 'atc-insert-slot--active' : ''}`}
      title={title}
      onClick={onClick}
      aria-label={title}
    />
  );
}

function CategoryLane({
  categoryId,
  strips,
  selectedId,
  moveSourceId,
  nextActions,
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
  onCategoryClick,
  onInsertBefore,
  operatorRole,
  readOnly,
  sectorReadOnly,
  dropHighlight,
}) {
  const pendingCount = strips.filter(
    (s) => isPendingTowerCoordination(s) || isPendingGroundCoordination(s),
  ).length;
  const canDrop = dropHighlight && moveSourceId && !sectorReadOnly && !readOnly;
  const showSlots = Boolean(
    moveSourceId && !readOnly && canShowMoveSlots(categoryId, operatorRole),
  );

  return (
    <div
      className={[
        'atc-category-lane',
        pendingCount ? 'atc-category-lane--alert' : '',
        sectorReadOnly ? 'atc-category-lane--readonly' : '',
        canDrop ? 'atc-category-lane--drop-target' : '',
      ].filter(Boolean).join(' ')}
      onClick={() => {
        if (canDrop) onCategoryClick?.(categoryId);
      }}
      role="presentation"
    >
      <div className="atc-category-row__strips">
        {strips.map((strip) => (
          <div key={strip.id} className="atc-strip-with-slot">
            {showSlots && strip.id !== moveSourceId && (
              <StripInsertSlot
                active
                title={t('atc.move.insertBefore', { callsign: strip.callsign || t('atc.move.insertStart') })}
                onClick={(e) => {
                  e.stopPropagation();
                  onInsertBefore?.(categoryId, strip.id);
                }}
              />
            )}
            <AtcBoardStrip
              strip={strip}
              selected={selectedId === strip.id}
              moveSelected={moveSourceId === strip.id}
              nextAction={nextActions[strip.id]}
              onSelect={onSelect}
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
              sectorReadOnly={sectorReadOnly}
            />
          </div>
        ))}
        {showSlots && (
          <StripInsertSlot
            active
            title={t('atc.move.insertEnd')}
            onClick={(e) => {
              e.stopPropagation();
              onInsertBefore?.(categoryId, null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function CategoryRow({
  categoryId,
  label,
  strips,
  selectedId,
  moveSourceId,
  nextActions,
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
  onCategoryClick,
  onInsertBefore,
  operatorRole,
  readOnly,
  sectorReadOnly,
}) {
  const dropHighlight = Boolean(
    moveSourceId
    && canShowMoveSlots(categoryId, operatorRole),
  );

  return (
    <div className={`atc-category-row ${sectorReadOnly ? 'atc-category-row--readonly' : ''}`}>
      <div className="atc-category-row__label">
        <span>{label || t(`atc.categories.${categoryId}`)}</span>
        <span className="atc-category-row__count">{strips.length}</span>
      </div>
      <CategoryLane
        categoryId={categoryId}
        strips={strips}
        selectedId={selectedId}
        moveSourceId={moveSourceId}
        nextActions={nextActions}
        onSelect={onSelect}
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
        onCategoryClick={onCategoryClick}
        onInsertBefore={onInsertBefore}
        operatorRole={operatorRole}
        readOnly={readOnly}
        sectorReadOnly={sectorReadOnly}
        dropHighlight={dropHighlight}
      />
    </div>
  );
}

function PairedCategoryRow({
  rowKey,
  leftCategory,
  rightCategory,
  grouped,
  operatorRole,
  ...rest
}) {
  const leftStrips = grouped[leftCategory] || [];
  const rightStrips = grouped[rightCategory] || [];
  const sectorReadOnly = operatorRole !== OWNER_ROLE.TOWER;
  const dropLeft = Boolean(rest.moveSourceId && canShowMoveSlots(leftCategory, operatorRole));
  const dropRight = Boolean(rest.moveSourceId && canShowMoveSlots(rightCategory, operatorRole));

  return (
    <div className="atc-paired-row">
      <div className="atc-paired-row__label">
        <span>{t(`atc.categories.${rowKey}`)}</span>
        <span className="atc-category-row__count">{leftStrips.length + rightStrips.length}</span>
      </div>
      <div className="atc-paired-row__columns">
        <div className="atc-paired-row__side atc-paired-row__side--left">
          <div className="atc-paired-row__side-label">{t(`atc.categories.${leftCategory}`)}</div>
          <CategoryLane
            categoryId={leftCategory}
            strips={leftStrips}
            sectorReadOnly={sectorReadOnly}
            dropHighlight={dropLeft}
            operatorRole={operatorRole}
            {...rest}
          />
        </div>
        <div className="atc-paired-row__divider" aria-hidden />
        <div className="atc-paired-row__side atc-paired-row__side--right">
          <div className="atc-paired-row__side-label">{t(`atc.categories.${rightCategory}`)}</div>
          <CategoryLane
            categoryId={rightCategory}
            strips={rightStrips}
            sectorReadOnly={sectorReadOnly}
            dropHighlight={dropRight}
            operatorRole={operatorRole}
            {...rest}
          />
        </div>
      </div>
    </div>
  );
}

export default function AtcStripBoard({
  strips = [],
  operatorRole,
  selectedId,
  moveSourceId,
  nextActions = {},
  runwayConfig = {},
  entryMode = 'keyboard',
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
  onMoveToCategory,
  onReorderInCategory,
  onRunwayConfigChange,
  readOnly = false,
}) {
  const grouped = useMemo(() => groupStripsByCategory(strips), [strips]);
  const moveSource = strips.find((s) => s.id === moveSourceId);

  const handleCategoryClick = useCallback((categoryId) => {
    if (!moveSource || readOnly || !canEditStrip(moveSource, operatorRole)) return;
    if (!isCategoryDropAllowed(categoryId, operatorRole)) return;

    const targetBay = getTargetBayForCategory(moveSource, categoryId);

    if (isHandoffToTower(moveSource)) {
      if (operatorRole === OWNER_ROLE.GROUND) {
        if (GROUND_DROP_CATEGORIES.includes(categoryId) && categoryId !== STRIP_CATEGORY.HP) {
          onCancelHandoff?.(moveSource, targetBay);
        }
        return;
      }
      if (operatorRole === OWNER_ROLE.TOWER && !TOWER_DROP_CATEGORIES.includes(categoryId)) {
        return;
      }
    }

    if (isHandoffToGround(moveSource)) {
      if (operatorRole === OWNER_ROLE.TOWER) {
        if (TOWER_DROP_CATEGORIES.includes(categoryId)) {
          onCancelHandoff?.(moveSource, targetBay);
        }
        return;
      }
      if (operatorRole === OWNER_ROLE.GROUND && !GROUND_DROP_CATEGORIES.includes(categoryId) && categoryId !== STRIP_CATEGORY.HP) {
        return;
      }
    }

    const operationalState = getOperationalStateForCategory(categoryId);
    const sameBay = targetBay === moveSource.bayId;
    const sameState = !operationalState || operationalState === moveSource.operationalState;

    if (sameBay && sameState) return;

    onMoveToCategory?.(moveSource, categoryId, { targetBay, operationalState });
  }, [moveSource, readOnly, operatorRole, onCancelHandoff, onMoveToCategory]);

  const handleInsertBefore = useCallback((categoryId, beforeStripId) => {
    if (!moveSource || readOnly) return;
    const lane = grouped[categoryId] || [];
    const without = lane.filter((s) => s.id !== moveSource.id);
    const position = computeInsertPosition(without, beforeStripId);
    onReorderInCategory?.(moveSource, categoryId, { position, targetBay: getTargetBayForCategory(moveSource, categoryId), operationalState: getOperationalStateForCategory(categoryId) || moveSource.operationalState });
  }, [moveSource, readOnly, grouped, onReorderInCategory]);

  if (!operatorRole) return null;

  const rowProps = {
    selectedId,
    moveSourceId,
    nextActions,
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
    onCategoryClick: handleCategoryClick,
    onInsertBefore: handleInsertBefore,
    operatorRole,
    readOnly,
  };

  const renderCategory = (categoryId, sectorRole) => (
    <CategoryRow
      key={categoryId}
      categoryId={categoryId}
      strips={grouped[categoryId] || []}
      sectorReadOnly={sectorRole !== operatorRole}
      {...rowProps}
    />
  );

  const runwayLocked = readOnly || operatorRole !== OWNER_ROLE.TOWER;

  return (
    <div className="atc-board atc-board--runway">
      {moveSourceId && (
        <div className="atc-move-hint" role="status">
          {t('atc.move.hint')}
        </div>
      )}

      <section className="atc-board-section atc-board-section--tower">
        {renderCategory(STRIP_CATEGORY.ATZ, OWNER_ROLE.TOWER)}
        {TOWER_PAIRED_CATEGORY_ROWS.map((row) => (
          <PairedCategoryRow
            key={row.rowKey}
            rowKey={row.rowKey}
            leftCategory={row.left}
            rightCategory={row.right}
            grouped={grouped}
            {...rowProps}
          />
        ))}
        {renderCategory(STRIP_CATEGORY.FINAL, OWNER_ROLE.TOWER)}
      </section>

      <AtcRunwayPanel
        config={runwayConfig}
        runwayStrips={grouped[STRIP_CATEGORY.RUNWAY] || []}
        selectedId={selectedId}
        moveSourceId={moveSourceId}
        nextActions={nextActions}
        entryMode={entryMode}
        onSelect={onSelect}
        onFieldChange={onFieldChange}
        onFieldCommit={onFieldCommit}
        onInlineEditFocus={onInlineEditFocus}
        onInlineEditBlur={onInlineEditBlur}
        inlineEditStripId={inlineEditStripId}
        onExpand={onExpand}
        onAction={onAction}
        onCoordinate={onCoordinate}
        onCancelHandoff={onCancelHandoff}
        onCategoryClick={handleCategoryClick}
        onInsertBefore={handleInsertBefore}
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
  );
}
