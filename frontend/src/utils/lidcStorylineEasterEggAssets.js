import * as THREE from 'three';
import { EASTER_EGG_KINDS } from '../config/lidcStorylineEasterEggs';

function recenterGroup(group) {
  group.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  group.position.sub(center);
  group.updateMatrixWorld(true);
  return group;
}

export function loadTexturedPlaneGroup(textureUrl, maxSize = 1) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      textureUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;

        const image = texture.image;
        const aspect = image.width / Math.max(image.height, 1);
        const width = aspect >= 1 ? maxSize : maxSize * aspect;
        const height = aspect >= 1 ? maxSize / aspect : maxSize;

        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide,
          transparent: true,
        });
        const mesh = new THREE.Mesh(geometry, material);

        const group = new THREE.Group();
        group.add(mesh);
        recenterGroup(group);
        resolve(group);
      },
      undefined,
      reject,
    );
  });
}

export function loadEasterEggAsset(loader, eggDefinition, onProgress) {
  if (eggDefinition.kind === EASTER_EGG_KINDS.TEXTURED_PLANE) {
    return loadTexturedPlaneGroup(eggDefinition.modelUrl, eggDefinition.planeMaxSize ?? 1)
      .then((group) => {
        if (onProgress) onProgress(1);
        return group;
      });
  }

  return new Promise((resolve, reject) => {
    loader.load(
      eggDefinition.modelUrl,
      (gltf) => {
        const group = new THREE.Group();
        group.add(gltf.scene);
        recenterGroup(group);
        resolve(group);
      },
      (event) => {
        if (event.total > 0 && onProgress) {
          onProgress(event.loaded / event.total);
        }
      },
      reject,
    );
  });
}

export function readEasterEggFromGroup(group, id) {
  return {
    id,
    position: group.position.toArray().map((value) => +value.toFixed(4)),
    rotation: [
      +THREE.MathUtils.radToDeg(group.rotation.x).toFixed(2),
      +THREE.MathUtils.radToDeg(group.rotation.y).toFixed(2),
      +THREE.MathUtils.radToDeg(group.rotation.z).toFixed(2),
    ],
    scale: group.scale.toArray().map((value) => +value.toFixed(4)),
  };
}
