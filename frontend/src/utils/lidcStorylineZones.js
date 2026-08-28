import * as THREE from 'three';
import { applyObjectTransform, readObjectTransform } from './lidcStorylineTransform';

export const ZONE_TYPES = Object.freeze({
  TRIGGER: 'trigger',
  COLLISION: 'collision',
  WHITEBOARD_SURFACE: 'whiteboardSurface',
});

export const WHITEBOARD_ZONE_EVENT_ID = 'whiteboard';

const ZONE_COLORS = {
  [ZONE_TYPES.TRIGGER]: 0x3ecf8e,
  [ZONE_TYPES.COLLISION]: 0xff6b4a,
  [ZONE_TYPES.WHITEBOARD_SURFACE]: 0x6ea8ff,
};

export function createDefaultZone(type, position = [0, 1, 0]) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  return {
    id,
    type,
    label: type === ZONE_TYPES.TRIGGER
      ? 'Trigger'
      : type === ZONE_TYPES.WHITEBOARD_SURFACE
        ? 'Whiteboard surface'
        : 'Collision',
    eventId: type === ZONE_TYPES.TRIGGER ? WHITEBOARD_ZONE_EVENT_ID : '',
    position: position.map((value) => +Number(value).toFixed(4)),
    rotation: [0, 0, 0],
    scale: type === ZONE_TYPES.WHITEBOARD_SURFACE
      ? [1.6, 1.05, 0.02]
      : [2, 2, 2],
  };
}

export function cloneZone(zone) {
  return JSON.parse(JSON.stringify(zone));
}

export function createZoneGroup(zone) {
  const group = new THREE.Group();
  group.name = `zone-${zone.id}`;
  group.userData.zoneId = zone.id;
  group.userData.zoneType = zone.type;

  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const color = ZONE_COLORS[zone.type] ?? 0xffffff;

  const fill = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
  );

  const wireframe = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 }),
  );

  group.add(fill, wireframe);
  applyZoneTransform(group, zone);
  return group;
}

export function applyZoneTransform(group, zone) {
  applyObjectTransform(group, zone);
}

export function readZoneFromGroup(group, zoneMeta) {
  const transform = readObjectTransform(group);
  return {
    ...zoneMeta,
    position: transform.position,
    rotation: transform.rotation,
    scale: transform.scale,
  };
}

export function isPointInZone(point, zoneGroup) {
  if (!zoneGroup) return false;

  zoneGroup.updateMatrixWorld(true);
  const localPoint = zoneGroup.worldToLocal(point.clone());
  return (
    Math.abs(localPoint.x) <= 0.5
    && Math.abs(localPoint.y) <= 0.5
    && Math.abs(localPoint.z) <= 0.5
  );
}

export function pushPointOutOfZone(point, zoneGroup, radius = 0) {
  if (!zoneGroup) return point;

  zoneGroup.updateMatrixWorld(true);
  const localPoint = zoneGroup.worldToLocal(point.clone());
  const halfExtents = new THREE.Vector3(0.5, 0.5, 0.5);
  const expanded = halfExtents.clone().addScalar(radius);

  const inside = (
    Math.abs(localPoint.x) < expanded.x
    && Math.abs(localPoint.y) < expanded.y
    && Math.abs(localPoint.z) < expanded.z
  );

  if (!inside) return point;

  const penetration = [
    expanded.x - Math.abs(localPoint.x),
    expanded.y - Math.abs(localPoint.y),
    expanded.z - Math.abs(localPoint.z),
  ];
  const axis = penetration.indexOf(Math.min(...penetration));
  const axisSign = Math.sign(localPoint.getComponent(axis)) || 1;
  localPoint.setComponent(axis, axisSign * expanded.getComponent(axis));

  return zoneGroup.localToWorld(localPoint);
}

export function isPointInsideAnyCollisionZone(point, zones, zoneGroups, radius = 0) {
  return zones.some((zone) => {
    if (zone.type !== ZONE_TYPES.COLLISION) return false;
    const group = zoneGroups.get(zone.id);
    if (!group) return false;

    group.updateMatrixWorld(true);
    const localPoint = group.worldToLocal(point.clone());
    const expanded = 0.5 + radius;

    return (
      Math.abs(localPoint.x) < expanded
      && Math.abs(localPoint.y) < expanded
      && Math.abs(localPoint.z) < expanded
    );
  });
}

export function findSpawnOutsideCollisionZones(
  preferred,
  zones,
  zoneGroups,
  roomBounds,
  wallMargin = 0.8,
  radius = 0,
) {
  if (!isPointInsideAnyCollisionZone(preferred, zones, zoneGroups, radius)) {
    return preferred.clone();
  }

  const offsets = [
    [2, 0], [-2, 0], [0, 2], [0, -2],
    [3, 0], [-3, 0], [0, 3], [0, -3],
    [2, 2], [-2, 2], [2, -2], [-2, -2],
    [4, 0], [-4, 0], [0, 4], [0, -4],
  ];

  for (const [offsetX, offsetZ] of offsets) {
    const candidate = preferred.clone();
    candidate.x += offsetX;
    candidate.z += offsetZ;

    if (roomBounds && !roomBounds.isEmpty()) {
      candidate.x = THREE.MathUtils.clamp(
        candidate.x,
        roomBounds.min.x + wallMargin,
        roomBounds.max.x - wallMargin,
      );
      candidate.z = THREE.MathUtils.clamp(
        candidate.z,
        roomBounds.min.z + wallMargin,
        roomBounds.max.z - wallMargin,
      );
    }

    if (!isPointInsideAnyCollisionZone(candidate, zones, zoneGroups, radius)) {
      return candidate;
    }
  }

  return resolveCollisionZones(preferred, zones, zoneGroups, radius);
}

export function resolveCollisionZones(point, zones, zoneGroups, radius = 0) {
  const resolved = point.clone();

  zones.forEach((zone) => {
    if (zone.type !== ZONE_TYPES.COLLISION) return;
    const group = zoneGroups.get(zone.id);
    if (!group) return;
    resolved.copy(pushPointOutOfZone(resolved, group, radius));
  });

  return resolved;
}

export function updateZoneTriggers(point, zones, zoneGroups, activeTriggerIds, callbacks) {
  zones.forEach((zone) => {
    if (zone.type !== ZONE_TYPES.TRIGGER) return;

    const group = zoneGroups.get(zone.id);
    if (!group) return;

    const inside = isPointInZone(point, group);
    const wasInside = activeTriggerIds.has(zone.id);

    if (inside && !wasInside) {
      activeTriggerIds.add(zone.id);
      callbacks.onEnter?.(zone);
    } else if (!inside && wasInside) {
      activeTriggerIds.delete(zone.id);
      callbacks.onExit?.(zone);
    }
  });
}

export function getActiveWhiteboardTrigger(zones, activeTriggerIds) {
  return zones.find(
    (zone) => zone.type === ZONE_TYPES.TRIGGER
      && zone.eventId === WHITEBOARD_ZONE_EVENT_ID
      && activeTriggerIds.has(zone.id),
  ) ?? null;
}

export function disposeZoneGroup(group) {
  group.traverse((child) => {
    if (child.isMesh || child.isLineSegments) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });
}
