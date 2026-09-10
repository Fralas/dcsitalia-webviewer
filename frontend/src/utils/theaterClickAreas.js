import { gridDisk, latLngToCell } from 'h3-js';

const HEX_RESOLUTION = 3;

function normalizeAreas(areas) {
  return (areas || [])
    .map((area) => ({
      campaignId: area.campaignId,
      cells: area.cells instanceof Set ? area.cells : new Set(area.cells || []),
    }))
    .filter((area) => area.campaignId && area.cells.size > 0);
}

export function resolveCampaignAtLatLng(lat, lng, areas, resolution = HEX_RESOLUTION) {
  const normalized = normalizeAreas(areas);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !normalized.length) return null;

  let cellId;
  try {
    cellId = latLngToCell(lat, lng, resolution);
  } catch {
    return null;
  }

  const candidates = [cellId, ...gridDisk(cellId, 1)];

  for (const area of normalized) {
    if (candidates.some((candidate) => area.cells.has(candidate))) {
      return area.campaignId;
    }
  }

  return null;
}

function pickGlobeCoords(world, clientX, clientY) {
  return world?.toGlobeCoords?.(clientX, clientY) || null;
}

function isCampaignLabelTarget(target) {
  return Boolean(target?.closest?.('.campaign-pointers__label'));
}

export function attachTheaterAreaInteraction(world, areas, container, onSelect) {
  const normalized = normalizeAreas(areas);
  if (!world || !container || !normalized.length || typeof onSelect !== 'function') {
    return () => {};
  }

  const selectAtPointer = (event) => {
    if (isCampaignLabelTarget(event.target)) return;

    const coords = pickGlobeCoords(world, event.clientX, event.clientY);
    if (!coords) return;

    const campaignId = resolveCampaignAtLatLng(coords.lat, coords.lng, normalized);
    if (!campaignId) return;

    onSelect(campaignId);
  };

  const updateCursor = (event) => {
    const coords = pickGlobeCoords(world, event.clientX, event.clientY);
    const clickable = Boolean(coords && resolveCampaignAtLatLng(coords.lat, coords.lng, normalized));
    container.classList.toggle('is-theater-clickable', clickable);
  };

  world
    .pointerEventsFilter((obj) => {
      const type = obj?.__globeObjType || obj?.parent?.__globeObjType;
      return type !== 'hexPolygon';
    })
    .showPointerCursor(() => false);

  container.addEventListener('click', selectAtPointer);
  container.addEventListener('mousemove', updateCursor);

  return () => {
    container.removeEventListener('click', selectAtPointer);
    container.removeEventListener('mousemove', updateCursor);
    container.classList.remove('is-theater-clickable');
  };
}
