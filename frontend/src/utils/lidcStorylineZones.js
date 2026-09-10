import * as THREE from 'three';
import { applyObjectTransform, readObjectTransform } from './lidcStorylineTransform';

const SURFACE_PLACEMENT_RAY = new THREE.Vector2(0, 0);
const SURFACE_NORMAL = new THREE.Vector3();
const SURFACE_POSITION = new THREE.Vector3();
const LOCAL_FORWARD = new THREE.Vector3(0, 0, 1);
const SURFACE_QUATERNION = new THREE.Quaternion();
const SURFACE_SCALE = new THREE.Vector3();
const SURFACE_WORLD_MATRIX = new THREE.Matrix4();
const SURFACE_LOCAL_MATRIX = new THREE.Matrix4();
const SURFACE_PARENT_INVERSE = new THREE.Matrix4();
const SURFACE_EULER = new THREE.Euler();

export const ZONE_TYPES = Object.freeze({
  TRIGGER: 'trigger',
  COLLISION: 'collision',
  WHITEBOARD_SURFACE: 'whiteboardSurface',
  TERMINAL_SURFACE: 'terminalSurface',
});

export const WHITEBOARD_ZONE_EVENT_ID = 'whiteboard';
export const TERMINAL_ZONE_EVENT_ID = 'terminal';
export const PHONE_ZONE_EVENT_ID = 'phone';

const TRIGGER_EVENT_ALIASES = {
  whiteboard: WHITEBOARD_ZONE_EVENT_ID,
  board: WHITEBOARD_ZONE_EVENT_ID,
  lavagna: WHITEBOARD_ZONE_EVENT_ID,
  terminal: TERMINAL_ZONE_EVENT_ID,
  ratos: TERMINAL_ZONE_EVENT_ID,
  computer: TERMINAL_ZONE_EVENT_ID,
  pc: TERMINAL_ZONE_EVENT_ID,
  phone: PHONE_ZONE_EVENT_ID,
  telefono: PHONE_ZONE_EVENT_ID,
};

const TRIGGER_EVENT_LABELS = {
  [WHITEBOARD_ZONE_EVENT_ID]: 'Whiteboard',
  [TERMINAL_ZONE_EVENT_ID]: 'Terminal',
  [PHONE_ZONE_EVENT_ID]: 'Phone',
};

export function normalizeZoneEventId(eventId) {
  const normalized = String(eventId ?? '').trim().toLowerCase();
  if (!normalized) return '';
  return TRIGGER_EVENT_ALIASES[normalized] ?? normalized;
}

const ZONE_COLORS = {
  [ZONE_TYPES.TRIGGER]: 0x3ecf8e,
  [ZONE_TYPES.COLLISION]: 0xff6b4a,
  [ZONE_TYPES.WHITEBOARD_SURFACE]: 0x6ea8ff,
  [ZONE_TYPES.TERMINAL_SURFACE]: 0xffb347,
};

export function createDefaultZone(type, position = [0, 1, 0], options = {}) {
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `zone-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  const defaultTriggerEventId = options.eventId ?? '';

  return {
    id,
    type,
    label: options.label ?? (
      type === ZONE_TYPES.TRIGGER
        ? (TRIGGER_EVENT_LABELS[defaultTriggerEventId] ?? 'Trigger')
        : type === ZONE_TYPES.WHITEBOARD_SURFACE
          ? 'Whiteboard surface'
          : type === ZONE_TYPES.TERMINAL_SURFACE
            ? 'Terminal screen'
            : 'Collision'
    ),
    eventId: type === ZONE_TYPES.TRIGGER ? defaultTriggerEventId : '',
    position: position.map((value) => +Number(value).toFixed(4)),
    rotation: [0, 0, 0],
    scale: type === ZONE_TYPES.WHITEBOARD_SURFACE
      ? [1.6, 1.05, 0.02]
      : type === ZONE_TYPES.TERMINAL_SURFACE
        ? [0.36, 0.28, 0.015]
        : [2, 2, 2],
  };
}

export function cloneZone(zone) {
  return JSON.parse(JSON.stringify(zone));
}

function getZoneDepthHalfExtent(scale = [1, 1, 1]) {
  return Math.min(...scale.map((value) => Math.abs(value))) * 0.5;
}

function rotationFromSurfaceNormal(normal) {
  SURFACE_NORMAL.copy(normal).normalize();
  if (SURFACE_NORMAL.lengthSq() < 0.0001) {
    SURFACE_QUATERNION.identity();
    return;
  }

  SURFACE_QUATERNION.setFromUnitVectors(LOCAL_FORWARD, SURFACE_NORMAL);
}

function worldZoneTransformToRoomLocal(position, quaternion, scale, roomContentGroup) {
  roomContentGroup.updateMatrixWorld(true);
  SURFACE_POSITION.copy(position);
  SURFACE_QUATERNION.copy(quaternion);
  SURFACE_SCALE.copy(scale);
  SURFACE_WORLD_MATRIX.compose(SURFACE_POSITION, SURFACE_QUATERNION, SURFACE_SCALE);
  SURFACE_PARENT_INVERSE.copy(roomContentGroup.matrixWorld).invert();
  SURFACE_LOCAL_MATRIX.multiplyMatrices(SURFACE_PARENT_INVERSE, SURFACE_WORLD_MATRIX);
  SURFACE_LOCAL_MATRIX.decompose(SURFACE_POSITION, SURFACE_QUATERNION, SURFACE_SCALE);
  SURFACE_EULER.setFromQuaternion(SURFACE_QUATERNION, 'XYZ');

  return {
    position: SURFACE_POSITION.toArray().map((value) => +value.toFixed(4)),
    rotation: [
      +THREE.MathUtils.radToDeg(SURFACE_EULER.x).toFixed(2),
      +THREE.MathUtils.radToDeg(SURFACE_EULER.y).toFixed(2),
      +THREE.MathUtils.radToDeg(SURFACE_EULER.z).toFixed(2),
    ],
    scale: SURFACE_SCALE.toArray().map((value) => +value.toFixed(4)),
  };
}

function resolveHitNormal(hit) {
  if (hit.normal) {
    SURFACE_NORMAL.copy(hit.normal);
    return SURFACE_NORMAL;
  }

  if (hit.face?.normal) {
    SURFACE_NORMAL.copy(hit.face.normal);
    hit.object.localToWorldDirection(SURFACE_NORMAL);
    return SURFACE_NORMAL;
  }

  return null;
}

export function createZoneAtView({
  type,
  camera,
  raycaster,
  placementMeshes = [],
  roomContentGroup,
  options = {},
}) {
  const defaultZone = createDefaultZone(type, [0, 1, 0], options);
  const isSurfaceZone = type === ZONE_TYPES.TERMINAL_SURFACE || type === ZONE_TYPES.WHITEBOARD_SURFACE;

  if (isSurfaceZone && camera && raycaster && placementMeshes.length > 0) {
    raycaster.setFromCamera(SURFACE_PLACEMENT_RAY, camera);
    const hits = raycaster.intersectObjects(placementMeshes, true);
    if (hits.length > 0) {
      const hit = hits[0];
      const normal = resolveHitNormal(hit);
      if (normal) {
        const depthHalf = getZoneDepthHalfExtent(defaultZone.scale);
        SURFACE_POSITION.copy(hit.point).addScaledVector(normal, depthHalf);
        rotationFromSurfaceNormal(normal);
        SURFACE_SCALE.fromArray(defaultZone.scale);

        const localTransform = worldZoneTransformToRoomLocal(
          SURFACE_POSITION,
          SURFACE_QUATERNION,
          SURFACE_SCALE,
          roomContentGroup,
        );

        return {
          ...defaultZone,
          position: localTransform.position,
          rotation: localTransform.rotation,
          scale: localTransform.scale,
        };
      }
    }
  }

  if (camera && roomContentGroup) {
    SURFACE_POSITION.copy(camera.position);
    roomContentGroup.updateMatrixWorld(true);
    roomContentGroup.worldToLocal(SURFACE_POSITION);
    return createDefaultZone(type, SURFACE_POSITION.toArray(), options);
  }

  return defaultZone;
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

const TRIGGER_SAMPLE_OFFSETS = [
  [0, 0, 0],
  [0, -0.35, 0],
  [0, -0.85, 0],
  [0, 0.25, 0],
];

export function isPlayerInTriggerZone(point, zoneGroup) {
  if (!zoneGroup || !point) return false;

  return TRIGGER_SAMPLE_OFFSETS.some(([offsetX, offsetY, offsetZ]) => {
    const sample = point.clone();
    sample.x += offsetX;
    sample.y += offsetY;
    sample.z += offsetZ;
    return isPointInZone(sample, zoneGroup);
  });
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

    const inside = isPlayerInTriggerZone(point, group);
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

export function getActiveTriggerByEventId(zones, activeTriggerIds, eventId) {
  const targetEventId = normalizeZoneEventId(eventId);
  return zones.find(
    (zone) => zone.type === ZONE_TYPES.TRIGGER
      && normalizeZoneEventId(zone.eventId) === targetEventId
      && activeTriggerIds.has(zone.id),
  ) ?? null;
}

export function getActiveInteractEventId(zones, activeTriggerIds) {
  if (getActiveTriggerByEventId(zones, activeTriggerIds, TERMINAL_ZONE_EVENT_ID)) {
    return TERMINAL_ZONE_EVENT_ID;
  }
  if (getActiveTriggerByEventId(zones, activeTriggerIds, WHITEBOARD_ZONE_EVENT_ID)) {
    return WHITEBOARD_ZONE_EVENT_ID;
  }
  if (getActiveTriggerByEventId(zones, activeTriggerIds, PHONE_ZONE_EVENT_ID)) {
    return PHONE_ZONE_EVENT_ID;
  }
  return null;
}

export function isPlayerInTerminalTrigger(point, zones, zoneGroups) {
  return zones.some((zone) => {
    if (zone.type !== ZONE_TYPES.TRIGGER) return false;
    if (normalizeZoneEventId(zone.eventId) !== TERMINAL_ZONE_EVENT_ID) return false;
    return isPlayerInTriggerZone(point, zoneGroups.get(zone.id));
  });
}

export function getActiveWhiteboardTrigger(zones, activeTriggerIds) {
  return getActiveTriggerByEventId(zones, activeTriggerIds, WHITEBOARD_ZONE_EVENT_ID);
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
