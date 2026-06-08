import { closestCenter, pointerWithin, rectIntersection } from '@dnd-kit/core';

const CATEGORY_PREFIX = 'cat_';

function categoryContainers(containers) {
  return containers.filter((container) => String(container.id).startsWith(CATEGORY_PREFIX));
}

/** Prioritizes category row drop zones so vertical moves hit the row under the pointer, not only the rightmost strip. */
export function atcBoardCollisionDetection(args) {
  const categories = categoryContainers(args.droppableContainers);

  if (categories.length > 0 && args.pointerCoordinates) {
    const pointerHits = pointerWithin({ ...args, droppableContainers: categories });
    if (pointerHits.length > 0) return pointerHits;

    const rectHits = rectIntersection({ ...args, droppableContainers: categories });
    if (rectHits.length > 0) return rectHits;
  }

  return closestCenter(args);
}
