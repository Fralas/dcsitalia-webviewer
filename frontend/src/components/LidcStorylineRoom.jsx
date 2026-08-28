import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Loader2, Settings2, X } from 'lucide-react';
import roomModelUrl from '../../3D/LIDC/room.glb';
import whiteboardModelUrl from '../../3D/LIDC/whiteboard.glb';
import LidcStorylineDebugPanel from './LidcStorylineDebugPanel';
import { t } from '../utils/locale';
import {
  applyLinkedScaleChange,
  applyObjectTransform,
  cloneTransform,
  DEBUG_TARGETS,
  downloadTransformJson,
  enforceUniformScaleFromDrag,
  getDefaultTransform,
  LIDC_STORYLINE_TRANSFORM_STORAGE_KEY,
  loadSavedTransform,
  readObjectTransform,
  readSceneTransform,
  saveTransformToStorage,
} from '../utils/lidcStorylineTransform';
import './LidcStorylineRoom.css';

const MOVE_SPEED = 1.8;
const FLOOR_RAY_START_OFFSET = 2;
const ROOM_WALL_MARGIN = 0.8;
const PLAYER_COLLISION_RADIUS = 0.35;
const PLAYER_BODY_RAY_HEIGHT = 1;
const WALL_NORMAL_MAX_Y = 0.55;
const LOOK_SENSITIVITY = 0.002;
const MAX_PITCH = Math.PI / 2.2;
const WHITEBOARD_TARGET_WIDTH = 1.75;
const WHITEBOARD_TARGET_HEIGHT = 1.2;
const WHITEBOARD_BOTTOM_HEIGHT = 0.95;
const WHITEBOARD_WALL_INSET = 0.06;
const CLICK_DRAG_THRESHOLD_PX = 4;

function loadGltf(loader, url, onProgress) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => resolve(gltf),
      (event) => {
        if (event.total > 0 && onProgress) {
          onProgress(event.loaded / event.total);
        }
      },
      reject,
    );
  });
}

function getFloorYAt(x, z, roomBounds, floorMeshes, raycaster, floorRayOrigin, floorNormal) {
  if (!roomBounds || floorMeshes.length === 0) return roomBounds?.min.y ?? 0;

  floorRayOrigin.set(x, roomBounds.max.y + FLOOR_RAY_START_OFFSET, z);
  raycaster.set(floorRayOrigin, new THREE.Vector3(0, -1, 0));
  const hits = raycaster.intersectObjects(floorMeshes, true);

  let bestY = null;
  for (const hit of hits) {
    if (hit.normal) {
      floorNormal.copy(hit.normal);
    } else if (hit.face?.normal) {
      floorNormal.copy(hit.face.normal);
      hit.object.localToWorldDirection(floorNormal);
    } else {
      continue;
    }

    if (floorNormal.y < 0.45) continue;
    if (bestY === null || hit.point.y < bestY) {
      bestY = hit.point.y;
    }
  }

  if (bestY === null && hits.length > 0) {
    bestY = hits.reduce((lowest, hit) => Math.min(lowest, hit.point.y), hits[0].point.y);
  }

  return bestY ?? roomBounds.min.y;
}

function getWorldNormal(hit, target) {
  if (hit.normal) {
    target.copy(hit.normal);
    return target;
  }

  if (hit.face?.normal) {
    target.copy(hit.face.normal);
    hit.object.localToWorldDirection(target);
    return target;
  }

  return null;
}

function resolveHorizontalCollision(from, to, collisionMeshes, raycaster, normalScratch) {
  const movement = to.clone().sub(from);
  movement.y = 0;
  if (movement.lengthSq() < 1e-8 || collisionMeshes.length === 0) {
    return to;
  }

  const direction = movement.clone().normalize();
  const distance = movement.length();
  const origin = from.clone();
  origin.y -= PLAYER_BODY_RAY_HEIGHT;

  raycaster.set(origin, direction);
  raycaster.far = distance + PLAYER_COLLISION_RADIUS;
  const hits = raycaster.intersectObjects(collisionMeshes, true);

  for (const hit of hits) {
    const normal = getWorldNormal(hit, normalScratch);
    if (!normal || Math.abs(normal.y) > WALL_NORMAL_MAX_Y) continue;

    if (hit.distance <= distance + PLAYER_COLLISION_RADIUS) {
      const allowed = Math.max(0, hit.distance - PLAYER_COLLISION_RADIUS);
      return from.clone().add(direction.multiplyScalar(allowed));
    }
  }

  return to;
}

function recenterObject(object) {
  object.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(object);
  const center = bounds.getCenter(new THREE.Vector3());
  object.position.sub(center);
  object.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(object);
}

function setupRoomLighting(parent, roomLocalBounds) {
  const center = roomLocalBounds.getCenter(new THREE.Vector3());
  const size = roomLocalBounds.getSize(new THREE.Vector3());
  const lightHeight = roomLocalBounds.max.y - 0.25;

  parent.add(new THREE.HemisphereLight(0xf2f6ff, 0x3a2f24, 1.1));
  parent.add(new THREE.AmbientLight(0xffffff, 0.45));

  const sun = new THREE.DirectionalLight(0xfff1dd, 1.35);
  sun.position.set(center.x + size.x * 0.2, lightHeight, center.z + size.z * 0.35);
  sun.target.position.copy(center);
  parent.add(sun);
  parent.add(sun.target);

  const fill = new THREE.PointLight(0xffe7c8, 0.7, size.length() * 2.5, 1.4);
  fill.position.set(center.x - size.x * 0.15, lightHeight - 0.4, center.z - size.z * 0.1);
  parent.add(fill);
}

function createWhiteboardGroup(whiteboardScene, roomLocalBounds) {
  const group = new THREE.Group();
  const whiteboard = whiteboardScene;

  whiteboard.position.set(0, 0, 0);
  whiteboard.rotation.set(0, 0, 0);
  whiteboard.scale.set(1, 1, 1);
  whiteboard.updateMatrixWorld(true);

  const whiteboardBounds = new THREE.Box3().setFromObject(whiteboard);
  const whiteboardSize = whiteboardBounds.getSize(new THREE.Vector3());
  const whiteboardCenter = whiteboardBounds.getCenter(new THREE.Vector3());
  whiteboard.position.sub(whiteboardCenter);

  const roomSize = roomLocalBounds.getSize(new THREE.Vector3());
  const roomCenter = roomLocalBounds.getCenter(new THREE.Vector3());
  const targetWidth = Math.min(WHITEBOARD_TARGET_WIDTH, roomSize.x * 0.38);
  const targetHeight = Math.min(WHITEBOARD_TARGET_HEIGHT, roomSize.y * 0.32);
  const scale = Math.min(
    targetWidth / Math.max(whiteboardSize.x, 0.001),
    targetHeight / Math.max(whiteboardSize.y, 0.001),
  );

  group.add(whiteboard);
  group.scale.setScalar(scale);

  const scaledHeight = whiteboardSize.y * scale;
  const scaledDepth = whiteboardSize.z * scale;
  const wallZ = roomLocalBounds.min.z + scaledDepth * 0.5 + WHITEBOARD_WALL_INSET;
  const floorY = roomLocalBounds.min.y;

  group.position.set(
    roomCenter.x,
    floorY + WHITEBOARD_BOTTOM_HEIGHT + scaledHeight * 0.5,
    wallZ,
  );

  return group;
}

export default function LidcStorylineRoom({ onClose }) {
  const containerRef = useRef(null);
  const sceneApiRef = useRef(null);
  const transformRef = useRef(loadSavedTransform());
  const debugOpenRef = useRef(false);
  const whiteboardOpenRef = useRef(false);
  const debugTargetRef = useRef(DEBUG_TARGETS.WHITEBOARD);
  const scaleLinkedRef = useRef(true);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadProgress, setLoadProgress] = useState(0);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugTarget, setDebugTarget] = useState(DEBUG_TARGETS.WHITEBOARD);
  const [scaleLinked, setScaleLinked] = useState(true);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [transform, setTransform] = useState(() => loadSavedTransform());
  const [transformMode, setTransformMode] = useState('translate');
  const [cameraPosition, setCameraPosition] = useState([0, 0, 0]);
  const [saveStatus, setSaveStatus] = useState('');

  useEffect(() => {
    debugOpenRef.current = debugOpen;
  }, [debugOpen]);

  useEffect(() => {
    whiteboardOpenRef.current = whiteboardOpen;
  }, [whiteboardOpen]);

  useEffect(() => {
    debugTargetRef.current = debugTarget;
  }, [debugTarget]);

  useEffect(() => {
    scaleLinkedRef.current = scaleLinked;
  }, [scaleLinked]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    sceneApiRef.current?.setTransformMode(transformMode);
  }, [transformMode]);

  useEffect(() => {
    sceneApiRef.current?.setDebugEnabled(debugOpen);
  }, [debugOpen]);

  useEffect(() => {
    sceneApiRef.current?.setDebugTarget(debugTarget);
  }, [debugTarget]);

  const applyTargetTransformUpdate = useCallback((targetKey, patch) => {
    setTransform((current) => {
      const next = cloneTransform(current);
      next[targetKey] = { ...next[targetKey], ...patch };
      transformRef.current = next;
      sceneApiRef.current?.applySceneTransform(next);
      return next;
    });
  }, []);

  const applyTargetVectorUpdate = useCallback((targetKey, field, values) => {
    applyTargetTransformUpdate(targetKey, { [field]: values });
  }, [applyTargetTransformUpdate]);

  const applyTargetScaleAxisUpdate = useCallback((axisIndex, nextValue) => {
    const targetKey = debugTargetRef.current === DEBUG_TARGETS.WHITEBOARD ? 'whiteboard' : 'room';

    setTransform((current) => {
      const next = cloneTransform(current);
      const currentScale = next[targetKey].scale;
      const newScale = scaleLinkedRef.current
        ? applyLinkedScaleChange(currentScale, axisIndex, nextValue)
        : currentScale.map((value, index) => (index === axisIndex ? nextValue : value));

      next[targetKey] = { ...next[targetKey], scale: newScale };
      transformRef.current = next;
      sceneApiRef.current?.applySceneTransform(next);
      return next;
    });
  }, []);

  const applyPlayerUpdate = useCallback((playerPatch) => {
    setTransform((current) => {
      const next = cloneTransform(current);
      next.player = { ...next.player, ...playerPatch };
      transformRef.current = next;
      sceneApiRef.current?.applyPlayerTransform(next);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    const api = sceneApiRef.current;
    const nextTransform = api?.readSceneTransform?.() ?? transformRef.current;

    saveTransformToStorage(nextTransform);
    setTransform(nextTransform);
    setSaveStatus(t('lidc.storyline.debug.saved'));
    window.setTimeout(() => setSaveStatus(''), 2200);
  }, []);

  const handleDownload = useCallback(() => {
    const api = sceneApiRef.current;
    const payload = api?.readSceneTransform?.() ?? transformRef.current;

    downloadTransformJson(payload);
    setSaveStatus(t('lidc.storyline.debug.downloaded'));
    window.setTimeout(() => setSaveStatus(''), 2200);
  }, []);

  const handleReset = useCallback(() => {
    const defaults = getDefaultTransform();
    const api = sceneApiRef.current;

    if (api?.roomContentGroup) {
      applyObjectTransform(api.roomContentGroup, defaults.room);
    }
    api?.resetWhiteboardPlacement?.();

    const next = api?.readSceneTransform?.() ?? defaults;
    next.player = { ...defaults.player };
    transformRef.current = next;
    setTransform(next);
    api?.applyPlayerTransform?.(next);

    setSaveStatus(t('lidc.storyline.debug.resetDone'));
    window.setTimeout(() => setSaveStatus(''), 2200);
  }, []);

  const handleCopy = useCallback(async () => {
    const api = sceneApiRef.current;
    const payload = api?.readSceneTransform?.() ?? transformRef.current;

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      setSaveStatus(t('lidc.storyline.debug.copied'));
    } catch {
      setSaveStatus(t('lidc.storyline.debug.copyFailed'));
    }
    window.setTimeout(() => setSaveStatus(''), 2200);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let frameId = 0;
    let disposed = false;
    let isTransformDragging = false;
    let lastMouseX = null;
    let lastMouseY = null;
    let pointerDownX = 0;
    let pointerDownY = 0;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(70, 1, 0.05, 100);
    camera.rotation.order = 'YXZ';

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    const resize = () => {
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    const roomRoot = new THREE.Group();
    scene.add(roomRoot);

    const roomContentGroup = new THREE.Group();
    roomRoot.add(roomContentGroup);

    let whiteboardGroup = null;
    let autoWhiteboardTransform = null;
    let debugTargetActive = debugTargetRef.current;

    const transformControls = new TransformControls(camera, renderer.domElement);
    transformControls.setMode('translate');
    transformControls.setSpace('world');
    scene.add(transformControls.getHelper());

    const keys = {
      forward: false,
      backward: false,
      left: false,
      right: false,
    };

    const movement = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const right = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const floorRayOrigin = new THREE.Vector3();
    const floorNormal = new THREE.Vector3();
    const floorMeshes = [];
    const collisionMeshes = [];
    const whiteboardMeshes = [];
    let roomBounds = null;

    const syncCollisionMeshes = () => {
      collisionMeshes.length = 0;
      collisionMeshes.push(...floorMeshes, ...whiteboardMeshes);
    };

    const refreshRoomBounds = () => {
      roomContentGroup.updateMatrixWorld(true);
      whiteboardGroup?.updateMatrixWorld(true);
      roomBounds = new THREE.Box3().setFromObject(roomContentGroup);
      if (whiteboardGroup) {
        roomBounds.union(new THREE.Box3().setFromObject(whiteboardGroup));
      }
      if (!roomBounds.isEmpty()) {
        const roomSize = roomBounds.getSize(new THREE.Vector3());
        scene.fog = new THREE.Fog(0x1a1a1a, roomSize.length() * 0.8, roomSize.length() * 3.5);
      }
      return roomBounds;
    };

    const getActiveTransformTarget = () => (
      debugTargetActive === DEBUG_TARGETS.WHITEBOARD ? whiteboardGroup : roomContentGroup
    );

    const applySceneTransform = (config) => {
      if (!roomContentGroup.children.length || !whiteboardGroup) return;
      applyObjectTransform(roomContentGroup, config.room);
      applyObjectTransform(whiteboardGroup, config.whiteboard);
      refreshRoomBounds();
    };

    const applyLoadedSceneTransform = (config) => {
      applyObjectTransform(roomContentGroup, config.room);
      if (whiteboardGroup) {
        applyObjectTransform(whiteboardGroup, config.whiteboard);
      }
      refreshRoomBounds();
    };

    const readSceneTransformFromGroups = () => readSceneTransform(
      roomContentGroup,
      whiteboardGroup,
      transformRef.current.player,
    );

    const resetWhiteboardPlacement = () => {
      if (!whiteboardGroup || !autoWhiteboardTransform) return;
      applyObjectTransform(whiteboardGroup, autoWhiteboardTransform);
      refreshRoomBounds();
      syncCollisionMeshes();
    };

    const applyPlayerTransform = (config) => {
      if (!roomBounds || roomBounds.isEmpty()) return;

      roomContentGroup.updateMatrixWorld(true);
      const center = roomBounds.getCenter(new THREE.Vector3());
      const spawnX = THREE.MathUtils.clamp(
        center.x + config.player.spawnOffset[0],
        roomBounds.min.x + ROOM_WALL_MARGIN,
        roomBounds.max.x - ROOM_WALL_MARGIN,
      );
      const spawnZ = THREE.MathUtils.clamp(
        center.z + config.player.spawnOffset[2],
        roomBounds.min.z + ROOM_WALL_MARGIN,
        roomBounds.max.z - ROOM_WALL_MARGIN,
      );

      let spawnY = config.player.spawnOffset[1];
      if (config.player.snapToFloor) {
        const floorY = getFloorYAt(
          spawnX,
          spawnZ,
          roomBounds,
          floorMeshes,
          raycaster,
          floorRayOrigin,
          floorNormal,
        );
        spawnY = floorY + config.player.heightOffset;
      } else {
        spawnY += config.player.heightOffset;
      }

      camera.position.set(spawnX, spawnY, spawnZ);
      camera.lookAt(spawnX, spawnY, center.z);
      camera.rotation.order = 'YXZ';
    };

    const snapPlayerToFloor = () => {
      const config = transformRef.current;
      if (!config.player.snapToFloor || !roomBounds) return;

      roomContentGroup.updateMatrixWorld(true);
      const floorY = getFloorYAt(
        camera.position.x,
        camera.position.z,
        roomBounds,
        floorMeshes,
        raycaster,
        floorRayOrigin,
        floorNormal,
      );

      camera.position.y = floorY + config.player.heightOffset;
    };

    const tryInteractWithWhiteboard = (clientX, clientY) => {
      if (debugOpenRef.current || whiteboardMeshes.length === 0) return false;

      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(whiteboardMeshes, true);
      if (hits.length === 0) return false;

      setWhiteboardOpen(true);
      return true;
    };

    sceneApiRef.current = {
      roomContentGroup,
      whiteboardGroup: () => whiteboardGroup,
      transformControls,
      applySceneTransform,
      applyPlayerTransform,
      resetWhiteboardPlacement,
      setDebugEnabled: (enabled) => {
        if (enabled) {
          const target = getActiveTransformTarget();
          if (target) transformControls.attach(target);
        } else {
          transformControls.detach();
        }
      },
      setDebugTarget: (target) => {
        debugTargetActive = target;
        if (debugOpenRef.current) {
          const activeTarget = getActiveTransformTarget();
          if (activeTarget) transformControls.attach(activeTarget);
        }
      },
      setTransformMode: (mode) => {
        transformControls.setMode(mode);
      },
      snapPlayerToRoom: () => {
        applyPlayerTransform(transformRef.current);
      },
      readSceneTransform: readSceneTransformFromGroups,
      readCameraPosition: () => [
        +camera.position.x.toFixed(3),
        +camera.position.y.toFixed(3),
        +camera.position.z.toFixed(3),
      ],
    };

    let lastCameraReadoutAt = 0;

    let scaleAtDragStart = null;

    transformControls.addEventListener('dragging-changed', (event) => {
      isTransformDragging = Boolean(event.value);

      if (!event.value) {
        scaleAtDragStart = null;
        return;
      }

      if (transformControls.mode === 'scale') {
        const target = getActiveTransformTarget();
        scaleAtDragStart = target ? target.scale.clone() : null;
      }
    });

    transformControls.addEventListener('objectChange', () => {
      if (disposed) return;

      if (
        scaleLinkedRef.current
        && transformControls.mode === 'scale'
        && scaleAtDragStart
      ) {
        const target = getActiveTransformTarget();
        if (target) {
          enforceUniformScaleFromDrag(target, scaleAtDragStart);
        }
      }

      refreshRoomBounds();
      const next = readSceneTransformFromGroups();
      transformRef.current = next;
      setTransform(next);
    });

    const loader = new GLTFLoader();
    const progress = { room: 0, whiteboard: 0 };
    const syncProgress = () => setLoadProgress((progress.room + progress.whiteboard) / 2);

    Promise.all([
      loadGltf(loader, roomModelUrl, (value) => {
        progress.room = value;
        syncProgress();
      }),
      loadGltf(loader, whiteboardModelUrl, (value) => {
        progress.whiteboard = value;
        syncProgress();
      }),
    ])
      .then(([roomGltf, whiteboardGltf]) => {
        if (disposed) return;

        const room = roomGltf.scene;
        room.traverse((child) => {
          if (child.isMesh) {
            floorMeshes.push(child);
          }
        });

        recenterObject(room);
        const roomLocalBounds = new THREE.Box3().setFromObject(room);
        roomContentGroup.add(room);

        whiteboardGroup = createWhiteboardGroup(whiteboardGltf.scene, roomLocalBounds);
        autoWhiteboardTransform = readObjectTransform(whiteboardGroup);
        whiteboardGroup.traverse((child) => {
          if (child.isMesh) {
            child.userData.isWhiteboard = true;
            whiteboardMeshes.push(child);
          }
        });
        roomRoot.add(whiteboardGroup);
        syncCollisionMeshes();

        refreshRoomBounds();
        if (!roomBounds || roomBounds.isEmpty()) {
          throw new Error('Room model has empty bounds');
        }

        setupRoomLighting(roomContentGroup, roomLocalBounds);

        let storedTransform = null;
        try {
          const raw = localStorage.getItem(LIDC_STORYLINE_TRANSFORM_STORAGE_KEY);
          storedTransform = raw ? JSON.parse(raw) : null;
        } catch {
          storedTransform = null;
        }

        const initialTransform = loadSavedTransform();

        if (storedTransform?.whiteboard) {
          applyLoadedSceneTransform(initialTransform);
        } else {
          applyObjectTransform(roomContentGroup, initialTransform.room);
          initialTransform.whiteboard = readObjectTransform(whiteboardGroup);
          refreshRoomBounds();
        }

        transformRef.current = initialTransform;
        applyPlayerTransform(initialTransform);
        setTransform(initialTransform);

        if (debugOpenRef.current) {
          const target = getActiveTransformTarget();
          if (target) transformControls.attach(target);
        }

        resize();
        setLoading(false);
      })
      .catch((error) => {
        if (disposed) return;
        console.error('[LidcStorylineRoom] Failed to load 3D assets', error);
        setLoadError(t('lidc.storyline.loadFailed'));
        setLoading(false);
      });

    const onKeyDown = (event) => {
      if (event.target?.tagName === 'INPUT') return;

      if (debugOpenRef.current) {
        if (event.code === 'KeyG') {
          setTransformMode('translate');
          return;
        }
        if (event.code === 'KeyR') {
          setTransformMode('rotate');
          return;
        }
        if (event.code === 'KeyE') {
          setTransformMode('scale');
          return;
        }
        if (event.code === 'KeyT') {
          setDebugTarget((current) => (
            current === DEBUG_TARGETS.ROOM ? DEBUG_TARGETS.WHITEBOARD : DEBUG_TARGETS.ROOM
          ));
          return;
        }
      }

      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.forward = true;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.backward = true;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.left = true;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.right = true;
          break;
        default:
          break;
      }
    };

    const onKeyUp = (event) => {
      switch (event.code) {
        case 'KeyW':
        case 'ArrowUp':
          keys.forward = false;
          break;
        case 'KeyS':
        case 'ArrowDown':
          keys.backward = false;
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keys.left = false;
          break;
        case 'KeyD':
        case 'ArrowRight':
          keys.right = false;
          break;
        default:
          break;
      }
    };

    const onMouseDown = (event) => {
      if (event.button !== 0 || isTransformDragging || debugOpenRef.current || whiteboardOpenRef.current) {
        return;
      }

      pointerDownX = event.clientX;
      pointerDownY = event.clientY;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    };

    const onMouseUp = (event) => {
      if (event.button !== 0 || isTransformDragging || debugOpenRef.current || whiteboardOpenRef.current) {
        return;
      }

      const dragDistance = Math.hypot(event.clientX - pointerDownX, event.clientY - pointerDownY);
      if (dragDistance <= CLICK_DRAG_THRESHOLD_PX) {
        tryInteractWithWhiteboard(event.clientX, event.clientY);
      }
    };

    const onMouseMove = (event) => {
      if (isTransformDragging || debugOpenRef.current || whiteboardOpenRef.current) return;

      if (lastMouseX === null || lastMouseY === null) {
        lastMouseX = event.clientX;
        lastMouseY = event.clientY;
        return;
      }

      const deltaX = event.clientX - lastMouseX;
      const deltaY = event.clientY - lastMouseY;
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;

      if (deltaX === 0 && deltaY === 0) return;

      camera.rotation.y -= deltaX * LOOK_SENSITIVITY;
      camera.rotation.x -= deltaY * LOOK_SENSITIVITY;
      camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x, -MAX_PITCH, MAX_PITCH);
    };

    const onMouseEnter = (event) => {
      lastMouseX = event.clientX;
      lastMouseY = event.clientY;
    };

    const onContextMenu = (event) => {
      event.preventDefault();
    };

    const clock = new THREE.Clock();

    const wallNormalScratch = new THREE.Vector3();

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (roomBounds && !debugOpenRef.current && !isTransformDragging && !whiteboardOpenRef.current) {
        direction.set(0, 0, -1).applyQuaternion(camera.quaternion);
        direction.y = 0;
        if (direction.lengthSq() > 0) direction.normalize();

        right.crossVectors(direction, camera.up).normalize();
        movement.set(0, 0, 0);

        if (keys.forward) movement.add(direction);
        if (keys.backward) movement.sub(direction);
        if (keys.left) movement.sub(right);
        if (keys.right) movement.add(right);

        if (movement.lengthSq() > 0) {
          movement.normalize().multiplyScalar(MOVE_SPEED * delta);
          roomContentGroup.updateMatrixWorld(true);
          whiteboardGroup?.updateMatrixWorld(true);

          const from = camera.position.clone();
          const desired = from.clone().add(movement);
          const resolved = resolveHorizontalCollision(
            from,
            desired,
            collisionMeshes,
            raycaster,
            wallNormalScratch,
          );

          camera.position.copy(resolved);
        }

        camera.position.x = THREE.MathUtils.clamp(
          camera.position.x,
          roomBounds.min.x + ROOM_WALL_MARGIN,
          roomBounds.max.x - ROOM_WALL_MARGIN,
        );
        camera.position.z = THREE.MathUtils.clamp(
          camera.position.z,
          roomBounds.min.z + ROOM_WALL_MARGIN,
          roomBounds.max.z - ROOM_WALL_MARGIN,
        );

        snapPlayerToFloor();
      }

      const now = performance.now();
      if (now - lastCameraReadoutAt > 120) {
        lastCameraReadoutAt = now;
        setCameraPosition(sceneApiRef.current?.readCameraPosition?.() ?? [0, 0, 0]);
      }

      renderer.render(scene, camera);
    };

    animate();

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseenter', onMouseEnter);
    renderer.domElement.addEventListener('contextmenu', onContextMenu);

    return () => {
      disposed = true;
      sceneApiRef.current = null;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      transformControls.detach();
      transformControls.dispose();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mouseenter', onMouseEnter);
      renderer.domElement.removeEventListener('contextmenu', onContextMenu);

      scene.traverse((child) => {
        if (child.isMesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((material) => material.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    const toggleDebug = () => {
      setDebugOpen((value) => !value);
    };

    const onKeyDown = (event) => {
      if (event.target?.tagName === 'INPUT' || event.target?.tagName === 'TEXTAREA') return;

      if (event.code === 'KeyL' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        toggleDebug();
        return;
      }

      if (event.key === '`') {
        event.preventDefault();
        toggleDebug();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        if (whiteboardOpen) {
          setWhiteboardOpen(false);
          return;
        }
        if (debugOpen) {
          setDebugOpen(false);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [debugOpen, whiteboardOpen, onClose]);

  useEffect(() => {
    document.body.classList.add('lidc-storyline-open');
    return () => document.body.classList.remove('lidc-storyline-open');
  }, []);

  const activeTargetKey = debugTarget === DEBUG_TARGETS.WHITEBOARD ? 'whiteboard' : 'room';

  return (
    <div className={`lidc-storyline-root ${debugOpen ? 'is-debug-open' : ''}`} role="dialog" aria-modal="true" aria-label={t('lidc.storyline.title')}>
      <div ref={containerRef} className="lidc-storyline-canvas" />

      {loading && (
        <div className="lidc-storyline-overlay-panel">
          <Loader2 size={28} className="spin" aria-hidden="true" />
          <p>{t('lidc.storyline.loading')}</p>
          <div className="lidc-storyline-progress" aria-hidden="true">
            <span style={{ width: `${Math.round(loadProgress * 100)}%` }} />
          </div>
        </div>
      )}

      {!loading && loadError && (
        <div className="lidc-storyline-overlay-panel is-error">
          <p>{loadError}</p>
          <button type="button" className="lidc-storyline-btn" onClick={onClose}>
            {t('lidc.general.back')}
          </button>
        </div>
      )}

      {!loading && !loadError && !debugOpen && !whiteboardOpen && (
        <div className="lidc-storyline-hint">
          <p>{t('lidc.storyline.controlsHint')}</p>
        </div>
      )}

      {!loading && !loadError && (
        <button
          type="button"
          className={`lidc-storyline-debug-toggle ${debugOpen ? 'is-active' : ''}`}
          onClick={() => setDebugOpen((value) => !value)}
          title={t('lidc.storyline.debug.toggle')}
          aria-label={t('lidc.storyline.debug.toggle')}
          aria-pressed={debugOpen}
        >
          <Settings2 size={16} />
          <span className="lidc-storyline-debug-toggle-label">L</span>
        </button>
      )}

      {!loading && !loadError && debugOpen && (
        <LidcStorylineDebugPanel
          transform={transform}
          transformMode={transformMode}
          debugTarget={debugTarget}
          scaleLinked={scaleLinked}
          cameraPosition={cameraPosition}
          saveStatus={saveStatus}
          onDebugTargetChange={setDebugTarget}
          onScaleLinkedChange={setScaleLinked}
          onTransformModeChange={setTransformMode}
          onTargetPositionChange={(position) => applyTargetVectorUpdate(activeTargetKey, 'position', position)}
          onTargetRotationChange={(rotation) => applyTargetVectorUpdate(activeTargetKey, 'rotation', rotation)}
          onTargetScaleAxisChange={applyTargetScaleAxisUpdate}
          onPlayerChange={applyPlayerUpdate}
          onSave={handleSave}
          onDownload={handleDownload}
          onReset={handleReset}
          onCopy={handleCopy}
          onSnapPlayerToRoom={() => sceneApiRef.current?.snapPlayerToRoom()}
          onClose={() => setDebugOpen(false)}
        />
      )}

      {whiteboardOpen && (
        <div className="lidc-storyline-whiteboard-panel">
          <header className="lidc-storyline-whiteboard-head">
            <h2>{t('lidc.storyline.whiteboardTitle')}</h2>
            <button
              type="button"
              className="lidc-storyline-whiteboard-close"
              onClick={() => setWhiteboardOpen(false)}
              aria-label={t('lidc.storyline.closePanel')}
            >
              <X size={16} />
            </button>
          </header>
          <div className="lidc-storyline-whiteboard-body">
            <p>{t('lidc.storyline.whiteboardBody')}</p>
          </div>
          <footer className="lidc-storyline-whiteboard-foot">
            <button type="button" className="lidc-storyline-btn" onClick={() => setWhiteboardOpen(false)}>
              {t('lidc.storyline.backToRoom')}
            </button>
          </footer>
        </div>
      )}

      <button
        type="button"
        className="lidc-storyline-close"
        onClick={onClose}
        aria-label={t('lidc.storyline.close')}
        title={t('lidc.storyline.close')}
      >
        <X size={18} />
      </button>
    </div>
  );
}
