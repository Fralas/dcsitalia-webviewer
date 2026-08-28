import * as THREE from 'three';
import {
  LIDC_STORYLINE_WHITEBOARD_CONNECTIONS,
  LIDC_STORYLINE_WHITEBOARD_ITEMS,
} from '../config/lidcStorylineWhiteboardItems';
import { ZONE_TYPES } from './lidcStorylineZones';

const SURFACE_INSET = 0.004;
const PHOTO_FRAME_PADDING = 0.08;
const CAPTION_HEIGHT_RATIO = 0.22;
const STRING_RADIUS = 0.004;
const STRING_SAG_RATIO = 0.07;
const STRING_SEGMENTS = 20;
const PIN_RADIUS = 0.012;

const STRING_COLOR = 0xc62828;
const PIN_COLOR = 0xd32f2f;
const FRAME_COLOR = 0xf7f4ec;

function loadImageSize(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({
      width: image.naturalWidth || 1,
      height: image.naturalHeight || 1,
    });
    image.onerror = () => resolve({ width: 3, height: 4 });
    image.src = url;
  });
}

export function findWhiteboardSurfaceZone(zones = []) {
  return zones.find((zone) => zone.type === ZONE_TYPES.WHITEBOARD_SURFACE) ?? null;
}

export function getWhiteboardSurfaceMapping(zoneScale = [1, 1, 1]) {
  const absScale = zoneScale.map((value) => Math.abs(value));
  const depthAxis = absScale.indexOf(Math.min(...absScale));
  const planeAxes = [0, 1, 2].filter((axis) => axis !== depthAxis);
  planeAxes.sort((a, b) => absScale[b] - absScale[a]);

  return {
    uAxis: planeAxes[0],
    vAxis: planeAxes[1],
    depthAxis,
    depthSign: Math.sign(zoneScale[depthAxis]) || 1,
  };
}

function percentToLocalPoint(u, v, mapping) {
  const local = new THREE.Vector3();
  local.setComponent(mapping.uAxis, u - 0.5);
  local.setComponent(mapping.vAxis, 0.5 - v);
  local.setComponent(mapping.depthAxis, mapping.depthSign * 0.5 + SURFACE_INSET);
  return local;
}

function getPinLayout(item, imageAspect) {
  const left = item.x / 100;
  const top = item.y / 100;
  const width = item.width / 100;
  const photoHeight = width / Math.max(imageAspect, 0.1);
  const totalHeight = photoHeight * (1 + PHOTO_FRAME_PADDING * 2 + CAPTION_HEIGHT_RATIO);

  return { left, top, width, photoHeight, totalHeight };
}

function getAnchorPercent(item, anchor, imageAspect) {
  const layout = getPinLayout(item, imageAspect);
  return {
    u: layout.left + layout.width * anchor.x,
    v: layout.top + layout.totalHeight * anchor.y,
  };
}

function createPhotoGroup(item, imageAspect, texture, mapping) {
  const layout = getPinLayout(item, imageAspect);
  const photoHeight = layout.photoHeight;
  const frameWidth = layout.width;
  const frameHeight = layout.photoHeight * (1 + PHOTO_FRAME_PADDING * 2);

  const group = new THREE.Group();
  group.name = `whiteboard-pin-${item.id}`;
  group.userData.itemId = item.id;

  const frameGeometry = new THREE.PlaneGeometry(frameWidth, frameHeight);
  const frameMaterial = new THREE.MeshStandardMaterial({
    color: FRAME_COLOR,
    roughness: 0.92,
    metalness: 0,
  });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.y = -frameHeight * 0.5 + photoHeight * 0.5;
  group.add(frame);

  texture.colorSpace = THREE.SRGBColorSpace;
  const photoGeometry = new THREE.PlaneGeometry(
    frameWidth * (1 - PHOTO_FRAME_PADDING),
    photoHeight * (1 - PHOTO_FRAME_PADDING * 0.5),
  );
  const photoMaterial = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.88,
    metalness: 0,
  });
  const photo = new THREE.Mesh(photoGeometry, photoMaterial);
  photo.position.y = -frameHeight * 0.5 + photoHeight * 0.5;
  photo.position.z = 0.001;
  group.add(photo);

  const centerU = layout.left + layout.width * 0.5;
  const centerV = layout.top + layout.photoHeight * 0.5;
  group.position.copy(percentToLocalPoint(centerU, centerV, mapping));
  applySurfaceOrientation(group, mapping, item.rotation);

  return group;
}

function applySurfaceOrientation(group, mapping, rotationDeg) {
  group.rotation.set(0, 0, 0);

  if (mapping.depthAxis === 2) {
    group.rotateZ(THREE.MathUtils.degToRad(rotationDeg));
    return;
  }

  if (mapping.depthAxis === 0) {
    group.rotateY(Math.PI / 2);
    group.rotateZ(THREE.MathUtils.degToRad(rotationDeg));
    return;
  }

  group.rotateX(-Math.PI / 2);
  group.rotateZ(THREE.MathUtils.degToRad(rotationDeg));
}

function createStringMesh(start, end, mapping) {
  const distance = start.distanceTo(end);
  const sag = Math.max(distance * STRING_SAG_RATIO, 0.008);
  const sagDirection = new THREE.Vector3();
  sagDirection.setComponent(mapping.vAxis, -1);
  const points = [];

  for (let i = 0; i <= STRING_SEGMENTS; i += 1) {
    const t = i / STRING_SEGMENTS;
    const point = start.clone().lerp(end, t);
    point.addScaledVector(sagDirection, 4 * t * (1 - t) * sag);
    points.push(point);
  }

  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, STRING_SEGMENTS, STRING_RADIUS, 6, false);
  const material = new THREE.MeshStandardMaterial({
    color: STRING_COLOR,
    roughness: 0.78,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'whiteboard-string';
  return mesh;
}

function createPinMesh(position) {
  const geometry = new THREE.SphereGeometry(PIN_RADIUS, 10, 10);
  const material = new THREE.MeshStandardMaterial({
    color: PIN_COLOR,
    roughness: 0.45,
    metalness: 0.15,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  return mesh;
}

function disposeObject3D(object) {
  object.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((material) => material.dispose());
      } else {
        child.material?.dispose();
      }
    }
  });
}

export function disposeWhiteboard3DDecorations(root) {
  if (!root) return;
  disposeObject3D(root);
}

function rebuildStrings(root, mapping, imageAspects) {
  root.children
    .filter((child) => child.name === 'whiteboard-string' || child.userData.isStringPin)
    .forEach((child) => {
      root.remove(child);
      disposeObject3D(child);
    });

  LIDC_STORYLINE_WHITEBOARD_CONNECTIONS.forEach((connection) => {
    const fromItem = LIDC_STORYLINE_WHITEBOARD_ITEMS.find((item) => item.id === connection.from);
    const toItem = LIDC_STORYLINE_WHITEBOARD_ITEMS.find((item) => item.id === connection.to);
    if (!fromItem || !toItem) return;

    const fromAspect = imageAspects.get(fromItem.id) ?? 0.75;
    const toAspect = imageAspects.get(toItem.id) ?? 0.75;
    const fromAnchor = getAnchorPercent(fromItem, connection.fromAnchor, fromAspect);
    const toAnchor = getAnchorPercent(toItem, connection.toAnchor, toAspect);

    const start = percentToLocalPoint(fromAnchor.u, fromAnchor.v, mapping);
    const end = percentToLocalPoint(toAnchor.u, toAnchor.v, mapping);

    root.add(createStringMesh(start, end, mapping));

    const pinStart = createPinMesh(start);
    pinStart.userData.isStringPin = true;
    root.add(pinStart);

    const pinEnd = createPinMesh(end);
    pinEnd.userData.isStringPin = true;
    root.add(pinEnd);
  });
}

export async function buildWhiteboard3DDecorations(root, zone, mapping) {
  root.clear();
  root.name = 'whiteboard-3d-decor';

  const textureLoader = new THREE.TextureLoader();
  const imageAspects = new Map(
    await Promise.all(
      LIDC_STORYLINE_WHITEBOARD_ITEMS.map(async (item) => {
        const size = await loadImageSize(item.image);
        return [item.id, size.width / size.height];
      }),
    ),
  );

  const textures = await Promise.all(
    LIDC_STORYLINE_WHITEBOARD_ITEMS.map((item) => new Promise((resolve, reject) => {
      textureLoader.load(item.image, resolve, undefined, reject);
    })),
  );

  LIDC_STORYLINE_WHITEBOARD_ITEMS.forEach((item, index) => {
    const imageAspect = imageAspects.get(item.id) ?? 0.75;
    root.add(createPhotoGroup(item, imageAspect, textures[index], mapping));
  });

  root.userData.imageAspects = imageAspects;
  root.userData.mapping = mapping;
  rebuildStrings(root, mapping, imageAspects);
  return root;
}

export function updateWhiteboard3DDecorations(root, zone) {
  if (!root || root.children.length === 0) return;

  const mapping = getWhiteboardSurfaceMapping(zone.scale);
  const imageAspects = root.userData.imageAspects ?? new Map();

  LIDC_STORYLINE_WHITEBOARD_ITEMS.forEach((item) => {
    const pinGroup = root.children.find((child) => child.userData.itemId === item.id);
    if (!pinGroup) return;

    const imageAspect = imageAspects.get(item.id) ?? 0.75;
    const layout = getPinLayout(item, imageAspect);
    const centerU = layout.left + layout.width * 0.5;
    const centerV = layout.top + layout.photoHeight * 0.5;

    pinGroup.position.copy(percentToLocalPoint(centerU, centerV, mapping));
    applySurfaceOrientation(pinGroup, mapping, item.rotation);
  });

  rebuildStrings(root, mapping, imageAspects);
  root.userData.mapping = mapping;
}

export function attachWhiteboard3DDecorations(zoneGroup, zone) {
  let root = zoneGroup.getObjectByName('whiteboard-3d-decor');
  const mapping = getWhiteboardSurfaceMapping(zone.scale);

  if (!root) {
    root = new THREE.Group();
    zoneGroup.add(root);
    return buildWhiteboard3DDecorations(root, zone, mapping).then(() => root);
  }

  updateWhiteboard3DDecorations(root, zone);
  return Promise.resolve(root);
}

export function detachWhiteboard3DDecorations(zoneGroup) {
  const root = zoneGroup?.getObjectByName('whiteboard-3d-decor');
  if (!root) return;
  zoneGroup.remove(root);
  disposeWhiteboard3DDecorations(root);
}

export function syncWhiteboard3DDecorations(zones, zoneGroups) {
  const activeZone = findWhiteboardSurfaceZone(zones);
  let attached = false;

  zones.forEach((zone) => {
    if (zone.type !== ZONE_TYPES.WHITEBOARD_SURFACE) return;
    const group = zoneGroups.get(zone.id);
    if (!group) return;

    if (activeZone && zone.id === activeZone.id) {
      attached = true;
      attachWhiteboard3DDecorations(group, zone);
      return;
    }

    detachWhiteboard3DDecorations(group);
  });

  if (!attached) {
    zoneGroups.forEach((group) => {
      if (group.userData.zoneType === ZONE_TYPES.WHITEBOARD_SURFACE) {
        detachWhiteboard3DDecorations(group);
      }
    });
  }
}
