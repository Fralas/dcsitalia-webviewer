import * as THREE from 'three';
import {
  buildBiosProgressBar,
  cwdToPrompt,
  RATOS_BIOS_LOGO_ART,
  RATOS_BIOS_TITLE_ART,
  RATOS_OS_NAME,
} from '../config/lidcStorylineTerminal';
import { t } from './locale';
import { getRatosTerminalSnapshot } from './ratosTerminalStore';
import { drawPhoenixDecryptor, tickPhoenixDecryptor } from './lidcPhoenixDecryptorGame';
import { getWhiteboardSurfaceMapping } from './lidcStorylineWhiteboard3D';
import { applyZoneTransform, ZONE_TYPES } from './lidcStorylineZones';

const SURFACE_INSET = 0.004;
const CANVAS_WIDTH = 512;
const CANVAS_HEIGHT = 384;
const SCREEN_FILL = 0.94;
const PHOENIX_OVERSCAN_X = 0.05;
const PHOENIX_OVERSCAN_Y = 0.05;
const TERMINAL_CAMERA_DISTANCE = 0.42;
const TERMINAL_CAMERA_FRAME_PADDING = 1.08;

const SCREEN_NORMAL = new THREE.Vector3();
const SCREEN_CENTER = new THREE.Vector3();
const TEMP_ZONE_GROUP = new THREE.Group();
const ZONE_WORLD_MATRIX = new THREE.Matrix4();

const COLORS = {
  bg: '#010803',
  text: '#a8ffbf',
  dim: 'rgba(168, 255, 191, 0.78)',
  error: '#ff7b72',
  header: 'rgba(168, 255, 191, 0.92)',
  banner: '#d4ffdc',
};

const textureLoader = new THREE.TextureLoader();

function resolveImageSrc(src) {
  if (!src) return '';
  if (typeof src === 'string') return src;
  if (typeof src === 'object') {
    if (typeof src.default === 'string') return src.default;
    if (typeof src.src === 'string') return src.src;
  }
  return '';
}

function getScreenMesh(root) {
  return root.getObjectByName('terminal-screen-mesh');
}

function restoreTerminalCanvasMap(root) {
  const mesh = getScreenMesh(root);
  if (!mesh || !root.userData.texture) return;

  if (root.userData.imageTexture) {
    root.userData.imageTexture.dispose();
    root.userData.imageTexture = null;
  }

  if (mesh.material.map !== root.userData.texture) {
    mesh.material.map = root.userData.texture;
    mesh.material.needsUpdate = true;
  }

  root.userData.activeImageSrc = null;
}

function applyTerminalImageMap(root, src) {
  const resolvedSrc = resolveImageSrc(src);
  if (!resolvedSrc) {
    restoreTerminalCanvasMap(root);
    return;
  }

  if (root.userData.activeImageSrc === resolvedSrc) {
    if (root.userData.imageTexture) {
      const mesh = getScreenMesh(root);
      if (mesh && mesh.material.map !== root.userData.imageTexture) {
        mesh.material.map = root.userData.imageTexture;
        mesh.material.needsUpdate = true;
      }
    }
    return;
  }

  root.userData.activeImageSrc = resolvedSrc;
  root.userData.imageRequestId = (root.userData.imageRequestId ?? 0) + 1;
  const requestId = root.userData.imageRequestId;

  textureLoader.load(
    resolvedSrc,
    (texture) => {
      if (root.userData.imageRequestId !== requestId) {
        texture.dispose();
        return;
      }

      texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;

      if (root.userData.imageTexture && root.userData.imageTexture !== root.userData.texture) {
        root.userData.imageTexture.dispose();
      }

      root.userData.imageTexture = texture;

      const mesh = getScreenMesh(root);
      if (mesh) {
        mesh.material.map = texture;
        mesh.material.needsUpdate = true;
      }
    },
    undefined,
    () => {
      if (root.userData.imageRequestId !== requestId) return;
      root.userData.activeImageSrc = null;
      restoreTerminalCanvasMap(root);
    },
  );
}

function orientMeshToSurface(mesh, mapping) {
  mesh.rotation.set(0, 0, 0);
  if (mapping.depthAxis === 2) return;
  if (mapping.depthAxis === 0) {
    mesh.rotateY(Math.PI / 2);
    return;
  }
  mesh.rotateX(-Math.PI / 2);
}

function getPlaneSize() {
  // Zone groups are unit cubes; parent scale carries the zone dimensions.
  return {
    width: SCREEN_FILL,
    height: SCREEN_FILL,
  };
}

function positionMeshOnSurface(mesh, mapping) {
  mesh.position.set(0, 0, 0);
  mesh.position.setComponent(
    mapping.depthAxis,
    mapping.depthSign * 0.5 + SURFACE_INSET,
  );
  orientMeshToSurface(mesh, mapping);
}

function drawScanlinePattern(ctx, width, height) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = getScanlinePattern();
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

function drawVignette(ctx, width, height) {
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    height * 0.2,
    width / 2,
    height / 2,
    height * 0.72,
  );
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.55)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

let scanlinePattern = null;

function getScanlinePattern() {
  if (scanlinePattern) return scanlinePattern;

  const tile = document.createElement('canvas');
  tile.width = 4;
  tile.height = 4;
  const tileCtx = tile.getContext('2d');
  tileCtx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  tileCtx.fillRect(0, 2, 4, 1);
  scanlinePattern = tileCtx.createPattern(tile, 'repeat');
  return scanlinePattern;
}

function drawVcrOverlay(ctx, width, height, timeMs) {
  const t = timeMs * 0.001;

  drawScanlinePattern(ctx, width, height);

  ctx.save();
  ctx.globalAlpha = 0.1 + Math.sin(t * 2.1) * 0.035;
  const chroma = ctx.createLinearGradient(0, 0, width, 0);
  chroma.addColorStop(0, 'rgba(255, 70, 70, 0.14)');
  chroma.addColorStop(0.16, 'rgba(0, 0, 0, 0)');
  chroma.addColorStop(0.84, 'rgba(0, 0, 0, 0)');
  chroma.addColorStop(1, 'rgba(70, 190, 255, 0.12)');
  ctx.fillStyle = chroma;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  const trackY = ((timeMs * 0.00014) % 1.15 - 0.08) * height;
  ctx.save();
  ctx.globalAlpha = 0.42;
  const trackGrad = ctx.createLinearGradient(0, trackY, 0, trackY + height * 0.02);
  trackGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
  trackGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.09)');
  trackGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = trackGrad;
  ctx.fillRect(0, trackY, width, height * 0.02);
  ctx.restore();

  drawVignette(ctx, width, height);

  ctx.save();
  ctx.globalAlpha = 0.28;
  const glow = ctx.createRadialGradient(
    width / 2,
    height * 0.05,
    0,
    width / 2,
    height * 0.05,
    height * 0.55,
  );
  glow.addColorStop(0, 'rgba(103, 255, 136, 0.14)');
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  if ((Math.floor(timeMs / 95) % 8) === 0) {
    ctx.save();
    ctx.globalAlpha = 0.03;
    ctx.fillStyle = '#67ff88';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

function buildTerminalContentKey(snapshot, timeMs) {
  if (snapshot.bootPhase === 'terminal' && snapshot.bootComplete) {
    return `${snapshot.version}:${Math.floor(timeMs / 530)}`;
  }
  return String(snapshot.version);
}

function ensureContentCanvas(root) {
  if (root.userData.contentCanvas) return;

  const contentCanvas = document.createElement('canvas');
  contentCanvas.width = CANVAS_WIDTH;
  contentCanvas.height = CANVAS_HEIGHT;
  root.userData.contentCanvas = contentCanvas;
  root.userData.contentCtx = contentCanvas.getContext('2d');
  root.userData.contentKey = null;
}

function compositeTerminalFrame(root, snapshot, timeMs) {
  ensureContentCanvas(root);
  const { ctx, canvas, contentCtx, contentCanvas, texture } = root.userData;
  const { width, height } = canvas;
  const contentKey = buildTerminalContentKey(snapshot, timeMs);

  if (root.userData.contentKey !== contentKey) {
    drawTerminalContent(contentCtx, contentCanvas, snapshot, timeMs);
    root.userData.contentKey = contentKey;
  }

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  const t = timeMs * 0.001;
  const jitterX = Math.sin(t * 1.1) * 0.55 + Math.sin(t * 2.7) * 0.25;
  const jitterY = Math.sin(t * 0.85) * 0.22;
  const skew = Math.sin(t * 0.65) * 0.0011;

  ctx.save();
  ctx.transform(1, 0, skew, 1, jitterX, jitterY);
  ctx.drawImage(contentCanvas, 0, 0);
  ctx.restore();

  drawVcrOverlay(ctx, width, height, timeMs);
  texture.needsUpdate = true;
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let cursorY = y;

  words.forEach((word, index) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, cursorY);
      line = word;
      cursorY += lineHeight;
    } else {
      line = testLine;
    }

    if (index === words.length - 1) {
      ctx.fillText(line, x, cursorY);
    }
  });

  return cursorY + lineHeight;
}

function drawPreScaled(ctx, text, x, y, scale, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    ctx.fillText(line, 0, index * 10);
  });
  ctx.restore();
}

function drawTerminalContent(ctx, canvas, snapshot, timeMs = 0) {
  const { width, height } = canvas;

  if (snapshot.bootPhase === 'idle') {
    ctx.fillStyle = '#020402';
    ctx.fillRect(0, 0, width, height);
    return;
  }

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  if (snapshot.bootPhase === 'bios') {
    ctx.textBaseline = 'top';
    ctx.font = '8px "IBM Plex Mono", "Courier New", monospace';
    ctx.shadowColor = 'rgba(103, 255, 136, 0.32)';
    ctx.shadowBlur = 2.5;
    drawPreScaled(ctx, RATOS_BIOS_LOGO_ART, width * 0.08, height * 0.04, 0.42, COLORS.banner);
    drawPreScaled(ctx, RATOS_BIOS_TITLE_ART, width * 0.1, height * 0.52, 0.72, COLORS.banner);
    ctx.font = '11px "IBM Plex Mono", "Courier New", monospace';
    ctx.fillStyle = COLORS.header;
    ctx.fillText(t('lidc.storyline.terminal.biosLoading'), width * 0.1, height * 0.82);
    ctx.fillStyle = COLORS.text;
    ctx.fillText(buildBiosProgressBar(snapshot.biosProgress), width * 0.1, height * 0.86);
    ctx.shadowBlur = 0;
    return;
  }

  const padX = width * 0.07;
  const padY = height * 0.06;
  const lineHeight = 14;
  const maxWidth = width - padX * 2;
  let cursorY = padY;

  ctx.textBaseline = 'top';
  ctx.font = '11px "IBM Plex Mono", "Courier New", monospace';
  ctx.shadowColor = 'rgba(103, 255, 136, 0.38)';
  ctx.shadowBlur = 3;

  ctx.fillStyle = COLORS.header;
  ctx.fillText(`${RATOS_OS_NAME} v3.11`, padX, cursorY);
  ctx.textAlign = 'right';
  ctx.fillText(t('lidc.storyline.terminal.secureShell'), width - padX, cursorY);
  ctx.textAlign = 'left';
  cursorY += lineHeight * 1.6;

  ctx.strokeStyle = 'rgba(130, 255, 168, 0.35)';
  ctx.beginPath();
  ctx.moveTo(padX, cursorY);
  ctx.lineTo(width - padX, cursorY);
  ctx.stroke();
  cursorY += lineHeight;

  const outputBottom = height - padY - lineHeight * 2.2;
  const visibleLines = [];

  snapshot.lines.forEach((line) => {
    if (line.variant === 'banner-block') {
      visibleLines.push({ type: 'banner', text: line.text });
      return;
    }
    String(line.text).split('\n').forEach((part) => {
      visibleLines.push({
        type: 'line',
        text: part,
        variant: line.variant,
      });
    });
  });

  let startIndex = 0;
  let estimatedHeight = 0;
  for (let i = visibleLines.length - 1; i >= 0; i -= 1) {
    const entry = visibleLines[i];
    estimatedHeight += entry.type === 'banner' ? lineHeight * 6 : lineHeight;
    if (cursorY + estimatedHeight > outputBottom) {
      startIndex = i + 1;
      break;
    }
  }

  for (let i = startIndex; i < visibleLines.length; i += 1) {
    const entry = visibleLines[i];
    if (entry.type === 'banner') {
      drawPreScaled(ctx, entry.text, padX, cursorY, 0.55, COLORS.banner);
      cursorY += lineHeight * 5.5;
      continue;
    }

    ctx.fillStyle = entry.variant === 'error'
      ? COLORS.error
      : entry.variant === 'dim'
        ? COLORS.dim
        : COLORS.text;

    if (ctx.measureText(entry.text).width > maxWidth) {
      cursorY = drawWrappedText(ctx, entry.text, padX, cursorY, maxWidth, lineHeight);
    } else {
      ctx.fillText(entry.text, padX, cursorY);
      cursorY += lineHeight;
    }

    if (cursorY > outputBottom) break;
  }

  ctx.strokeStyle = 'rgba(130, 255, 168, 0.35)';
  ctx.beginPath();
  ctx.moveTo(padX, height - padY - lineHeight * 1.5);
  ctx.lineTo(width - padX, height - padY - lineHeight * 1.5);
  ctx.stroke();

  ctx.fillStyle = COLORS.text;
  const prompt = `${cwdToPrompt(snapshot.cwd)} ${snapshot.input}`;
  const showCursor = snapshot.bootComplete && (Math.floor(timeMs / 530) % 2 === 0);
  const cursor = showCursor ? '_' : ' ';
  ctx.fillText(`${prompt}${cursor}`, padX, height - padY - lineHeight * 0.5);

  ctx.shadowBlur = 0;
}

function disposeScreenRoot(root) {
  if (root.userData.imageTexture && root.userData.imageTexture !== root.userData.texture) {
    root.userData.imageTexture.dispose();
    root.userData.imageTexture = null;
  }

  root.traverse((child) => {
    if (child.isMesh) {
      child.geometry?.dispose();
      child.material?.map?.dispose();
      child.material?.dispose();
    }
  });
}

function createTerminalScreenRoot(zone) {
  const mapping = getWhiteboardSurfaceMapping(zone.scale);
  const { width, height } = getPlaneSize();

  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;

  const contentCanvas = document.createElement('canvas');
  contentCanvas.width = CANVAS_WIDTH;
  contentCanvas.height = CANVAS_HEIGHT;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: texture,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  mesh.name = 'terminal-screen-mesh';
  mesh.renderOrder = 2;

  const root = new THREE.Group();
  root.name = 'terminal-3d-screen';
  root.userData.canvas = canvas;
  root.userData.ctx = canvas.getContext('2d');
  root.userData.contentCanvas = contentCanvas;
  root.userData.contentCtx = contentCanvas.getContext('2d');
  root.userData.contentKey = null;
  root.userData.texture = texture;
  root.userData.mapping = mapping;
  root.userData.zoneScale = [...zone.scale];
  root.userData.planeUsesUnitSpace = true;
  root.userData.activeImageSrc = null;
  root.userData.imageTexture = null;
  root.userData.imageRequestId = 0;
  root.add(mesh);
  positionMeshOnSurface(mesh, mapping);

  return root;
}

function updateTerminalScreenGeometry(root, zone) {
  const mapping = getWhiteboardSurfaceMapping(zone.scale);
  const prevMapping = root.userData.mapping;
  const mappingChanged = !prevMapping
    || prevMapping.uAxis !== mapping.uAxis
    || prevMapping.vAxis !== mapping.vAxis
    || prevMapping.depthAxis !== mapping.depthAxis
    || prevMapping.depthSign !== mapping.depthSign;

  if (!mappingChanged && root.userData.planeUsesUnitSpace) return;

  const { width, height } = getPlaneSize();
  const mesh = root.getObjectByName('terminal-screen-mesh');
  if (!mesh) return;

  mesh.geometry.dispose();
  mesh.geometry = new THREE.PlaneGeometry(width, height);
  positionMeshOnSurface(mesh, mapping);
  root.userData.mapping = mapping;
  root.userData.zoneScale = [...zone.scale];
  root.userData.planeUsesUnitSpace = true;
}

export function findTerminalSurfaceZone(zones = []) {
  return zones.find((zone) => zone.type === ZONE_TYPES.TERMINAL_SURFACE) ?? null;
}

function getZoneWorldMatrix(zone, roomContentGroup, zonesRoot) {
  applyZoneTransform(TEMP_ZONE_GROUP, zone);
  TEMP_ZONE_GROUP.updateMatrixWorld(false);

  if (zonesRoot) {
    zonesRoot.updateMatrixWorld(true);
    return ZONE_WORLD_MATRIX.multiplyMatrices(zonesRoot.matrixWorld, TEMP_ZONE_GROUP.matrix);
  }

  if (roomContentGroup) {
    roomContentGroup.updateMatrixWorld(true);
    return ZONE_WORLD_MATRIX.multiplyMatrices(roomContentGroup.matrixWorld, TEMP_ZONE_GROUP.matrix);
  }

  return ZONE_WORLD_MATRIX.copy(TEMP_ZONE_GROUP.matrix);
}

export function getTerminalScreenCameraView(
  zoneGroups,
  zones = [],
  roomContentGroup = null,
  zonesRoot = null,
  distance = TERMINAL_CAMERA_DISTANCE,
  viewerPosition = null,
  cameraFovDegrees = 70,
) {
  const zone = findTerminalSurfaceZone(zones);
  if (!zone) return null;

  roomContentGroup?.updateMatrixWorld(true);
  zonesRoot?.updateMatrixWorld(true);

  const finishView = (lookAt, normal, frameDistance = distance) => {
    if (normal.lengthSq() < 1e-8) return null;
    normal.normalize();

    if (viewerPosition) {
      const towardViewer = viewerPosition.clone().sub(lookAt);
      if (towardViewer.lengthSq() > 1e-8 && normal.dot(towardViewer) < 0) {
        normal.negate();
      }
    }

    const resolvedDistance = Math.max(distance, frameDistance);

    return {
      lookAt: lookAt.clone(),
      targetPosition: lookAt.clone().addScaledVector(normal, resolvedDistance),
    };
  };

  const group = zoneGroups.get(zone.id)
    ?? [...zoneGroups.values()].find((candidate) => (
      candidate.userData.zoneType === ZONE_TYPES.TERMINAL_SURFACE
    ))
    ?? null;

  if (group) {
    group.updateMatrixWorld(true);

    const lookAt = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const mesh = group.getObjectByName('terminal-3d-screen')?.getObjectByName('terminal-screen-mesh');

    if (mesh) {
      mesh.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(mesh);
      bounds.getCenter(lookAt);
      mesh.localToWorldDirection(normal.set(0, 0, 1));

      const screenSize = new THREE.Vector3();
      bounds.getSize(screenSize);
      const screenSpan = Math.max(screenSize.x, screenSize.y);
      const halfFov = THREE.MathUtils.degToRad(cameraFovDegrees) * 0.5;
      const frameDistance = halfFov > 1e-5
        ? (screenSpan * 0.5 * TERMINAL_CAMERA_FRAME_PADDING) / Math.tan(halfFov)
        : distance;

      return finishView(lookAt, normal, frameDistance);
    }

    const mapping = getWhiteboardSurfaceMapping(zone.scale);
    lookAt.set(0, 0, 0);
    lookAt.setComponent(mapping.uAxis, 0);
    lookAt.setComponent(mapping.vAxis, 0);
    lookAt.setComponent(mapping.depthAxis, mapping.depthSign * 0.5 + SURFACE_INSET);
    lookAt.applyMatrix4(group.matrixWorld);

    normal.set(0, 0, 0);
    normal.setComponent(mapping.depthAxis, mapping.depthSign);
    normal.transformDirection(group.matrixWorld);
    return finishView(lookAt, normal);
  }

  const worldMatrix = getZoneWorldMatrix(zone, roomContentGroup, zonesRoot);
  const mapping = getWhiteboardSurfaceMapping(zone.scale);
  const lookAt = new THREE.Vector3();
  const normal = new THREE.Vector3();

  lookAt.set(0, 0, 0);
  lookAt.setComponent(mapping.uAxis, 0);
  lookAt.setComponent(mapping.vAxis, 0);
  lookAt.setComponent(mapping.depthAxis, mapping.depthSign * 0.5 + SURFACE_INSET);
  lookAt.applyMatrix4(worldMatrix);

  normal.set(0, 0, 0);
  normal.setComponent(mapping.depthAxis, mapping.depthSign);
  normal.transformDirection(worldMatrix);
  return finishView(lookAt, normal);
}

export function attachTerminal3DScreen(zoneGroup, zone) {
  let root = zoneGroup.getObjectByName('terminal-3d-screen');
  if (!root) {
    root = createTerminalScreenRoot(zone);
    zoneGroup.add(root);
  } else {
    updateTerminalScreenGeometry(root, zone);
  }
  return root;
}

export function detachTerminal3DScreen(zoneGroup) {
  const root = zoneGroup?.getObjectByName('terminal-3d-screen');
  if (!root) return;
  zoneGroup.remove(root);
  disposeScreenRoot(root);
}

export function syncTerminal3DDecorations(zones, zoneGroups) {
  const activeZone = findTerminalSurfaceZone(zones);
  let attached = false;

  zones.forEach((zone) => {
    if (zone.type !== ZONE_TYPES.TERMINAL_SURFACE) return;
    const group = zoneGroups.get(zone.id);
    if (!group) return;

    if (activeZone && zone.id === activeZone.id) {
      attached = true;
      attachTerminal3DScreen(group, zone);
      return;
    }

    detachTerminal3DScreen(group);
  });

  if (!attached) {
    zoneGroups.forEach((group) => {
      if (group.userData.zoneType === ZONE_TYPES.TERMINAL_SURFACE) {
        detachTerminal3DScreen(group);
      }
    });
  }
}

export function renderTerminal3DScreens(
  zoneGroups,
  snapshot = getRatosTerminalSnapshot(),
  timeMs = 0,
) {
  if (snapshot.phoenixGame) {
    tickPhoenixDecryptor(timeMs);
  }

  zoneGroups.forEach((group) => {
    if (group.userData.zoneType !== ZONE_TYPES.TERMINAL_SURFACE) return;
    const root = group.getObjectByName('terminal-3d-screen');
    if (!root?.userData?.ctx) return;

    if (snapshot.imageViewer?.src) {
      applyTerminalImageMap(root, snapshot.imageViewer.src);
      return;
    }

    restoreTerminalCanvasMap(root);
    if (snapshot.phoenixGame) {
      ensureContentCanvas(root);
      const { ctx, canvas, contentCtx, contentCanvas, texture } = root.userData;
      drawPhoenixDecryptor(contentCtx, contentCanvas, timeMs);
      ctx.fillStyle = COLORS.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const insetX = Math.round(canvas.width * PHOENIX_OVERSCAN_X);
      const insetY = Math.round(canvas.height * PHOENIX_OVERSCAN_Y);
      ctx.drawImage(
        contentCanvas,
        insetX,
        insetY,
        canvas.width - insetX * 2,
        canvas.height - insetY * 2,
      );
      drawVcrOverlay(ctx, canvas.width, canvas.height, timeMs);
      texture.needsUpdate = true;
      return;
    }

    compositeTerminalFrame(root, snapshot, timeMs);
  });
}

const PICK_RAYCASTER = new THREE.Raycaster();
const PICK_NDC = new THREE.Vector2();

export function pickTerminalScreenUv(zoneGroups, camera, ndcX, ndcY) {
  if (!zoneGroups || !camera) return null;

  PICK_NDC.set(ndcX, ndcY);
  PICK_RAYCASTER.setFromCamera(PICK_NDC, camera);
  const meshes = [];
  zoneGroups.forEach((group) => {
    if (group.userData.zoneType !== ZONE_TYPES.TERMINAL_SURFACE) return;
    const mesh = group.getObjectByName('terminal-3d-screen')?.getObjectByName('terminal-screen-mesh');
    if (mesh) meshes.push(mesh);
  });
  if (!meshes.length) return null;

  const hit = PICK_RAYCASTER.intersectObjects(meshes, false)[0];
  if (!hit?.uv) return null;
  return { u: hit.uv.x, v: hit.uv.y };
}

export function phoenixScreenUvToTunerRatio(u) {
  const inner = 1 - PHOENIX_OVERSCAN_X * 2;
  if (inner <= 0) return 0.5;
  return (u - PHOENIX_OVERSCAN_X) / inner;
}

export function disposeTerminal3DDecorations(root) {
  if (!root) return;
  disposeScreenRoot(root);
}
