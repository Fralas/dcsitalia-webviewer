import * as THREE from 'three';
import { mergeEasterEggTransforms } from '../config/lidcStorylineEasterEggs';
import fileDefaults from '../config/lidcStorylineRoomTransform.json';

export const LIDC_STORYLINE_TRANSFORM_STORAGE_KEY = 'lidc-storyline-room-transform';

export const DEBUG_TARGETS = Object.freeze({
  ROOM: 'room',
  WHITEBOARD: 'whiteboard',
  ZONE: 'zone',
  EASTER_EGG: 'easterEgg',
});

export function cloneTransform(value) {
  return JSON.parse(JSON.stringify(value));
}

export function getDefaultTransform() {
  const defaults = cloneTransform(fileDefaults);
  defaults.easterEggs = mergeEasterEggTransforms(defaults.easterEggs);
  return defaults;
}

export function loadSavedTransform() {
  const defaults = getDefaultTransform();

  try {
    const raw = localStorage.getItem(LIDC_STORYLINE_TRANSFORM_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    return {
      room: { ...defaults.room, ...parsed.room },
      whiteboard: { ...defaults.whiteboard, ...parsed.whiteboard },
      player: { ...defaults.player, ...parsed.player },
      zones: Array.isArray(parsed.zones) ? parsed.zones : defaults.zones,
      easterEggs: mergeEasterEggTransforms(parsed.easterEggs),
    };
  } catch {
    return defaults;
  }
}

export function saveTransformToStorage(transform) {
  localStorage.setItem(
    LIDC_STORYLINE_TRANSFORM_STORAGE_KEY,
    JSON.stringify(transform, null, 2),
  );
}

export function downloadTransformJson(transform) {
  const blob = new Blob([JSON.stringify(transform, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'lidcStorylineRoomTransform.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function applyLinkedScaleChange(values, axisIndex, nextValue) {
  const current = values[axisIndex];
  if (!Number.isFinite(nextValue)) return [...values];

  if (current === 0) {
    return [nextValue, nextValue, nextValue].map((value) => +value.toFixed(4));
  }

  const ratio = nextValue / current;
  return values.map((value) => +(value * ratio).toFixed(4));
}

export function enforceUniformScaleFromDrag(object, scaleAtDragStart) {
  if (!object || !scaleAtDragStart) return;

  const ratios = [
    scaleAtDragStart.x !== 0 ? object.scale.x / scaleAtDragStart.x : 1,
    scaleAtDragStart.y !== 0 ? object.scale.y / scaleAtDragStart.y : 1,
    scaleAtDragStart.z !== 0 ? object.scale.z / scaleAtDragStart.z : 1,
  ];
  const dominantAxis = ratios.reduce(
    (bestIndex, ratio, index, allRatios) => (
      Math.abs(ratio - 1) > Math.abs(allRatios[bestIndex] - 1) ? index : bestIndex
    ),
    0,
  );
  const ratio = ratios[dominantAxis];

  object.scale.set(
    scaleAtDragStart.x * ratio,
    scaleAtDragStart.y * ratio,
    scaleAtDragStart.z * ratio,
  );
}

export function applyObjectTransform(group, objectTransform) {
  if (!group || !objectTransform) return;

  group.position.set(
    objectTransform.position[0],
    objectTransform.position[1],
    objectTransform.position[2],
  );
  group.rotation.set(
    THREE.MathUtils.degToRad(objectTransform.rotation[0]),
    THREE.MathUtils.degToRad(objectTransform.rotation[1]),
    THREE.MathUtils.degToRad(objectTransform.rotation[2]),
  );
  group.scale.set(
    objectTransform.scale[0],
    objectTransform.scale[1],
    objectTransform.scale[2],
  );
  group.updateMatrixWorld(true);
}

export function readObjectTransform(group) {
  return {
    position: group.position.toArray().map((value) => +value.toFixed(4)),
    rotation: [
      +THREE.MathUtils.radToDeg(group.rotation.x).toFixed(2),
      +THREE.MathUtils.radToDeg(group.rotation.y).toFixed(2),
      +THREE.MathUtils.radToDeg(group.rotation.z).toFixed(2),
    ],
    scale: group.scale.toArray().map((value) => +value.toFixed(4)),
  };
}

export function readSceneTransform(
  roomContentGroup,
  whiteboardGroup,
  playerSettings,
  zones = [],
  easterEggs = [],
) {
  return {
    room: readObjectTransform(roomContentGroup),
    whiteboard: readObjectTransform(whiteboardGroup),
    player: { ...playerSettings },
    zones: zones.map((zone) => ({ ...zone })),
    easterEggs: easterEggs.map((egg) => ({ ...egg })),
  };
}

/** @deprecated use applyObjectTransform with config.room */
export function applyTransformToGroup(group, config) {
  applyObjectTransform(group, config.room);
}

/** @deprecated use readSceneTransform */
export function readTransformFromGroup(group, playerSettings = getDefaultTransform().player) {
  return {
    room: readObjectTransform(group),
    whiteboard: getDefaultTransform().whiteboard,
    player: { ...playerSettings },
  };
}
