import adlerkopfModelUrl from '../../3D/LIDC/eeggs/adlerkopf_eagle_head.glb';
import battleFoxModelUrl from '../../3D/LIDC/eeggs/battle_fox.glb';
import fancyPictureFrameModelUrl from '../../3D/LIDC/eeggs/fancy_picture_frame.glb';
import djogoImmagineTextureUrl from '../../3D/LIDC/eeggs/djogoimmagine.png';
import pioneerDjConsoleModelUrl from '../../3D/LIDC/eeggs/pioneer_dj_console.glb';
import ratModelUrl from '../../3D/LIDC/eeggs/rat.glb';
import snowyOwlModelUrl from '../../3D/LIDC/eeggs/snowy_owl.glb';

export const EASTER_EGG_KINDS = Object.freeze({
  GLTF: 'gltf',
  TEXTURED_PLANE: 'texturedPlane',
});

export const LIDC_STORYLINE_EASTER_EGGS = Object.freeze([
  {
    id: 'adlerkopf',
    labelKey: 'lidc.storyline.debug.easterEggs.adlerkopf',
    kind: EASTER_EGG_KINDS.GLTF,
    modelUrl: adlerkopfModelUrl,
  },
  {
    id: 'battleFox',
    labelKey: 'lidc.storyline.debug.easterEggs.battleFox',
    kind: EASTER_EGG_KINDS.GLTF,
    modelUrl: battleFoxModelUrl,
  },
  {
    id: 'fancyPictureFrame',
    labelKey: 'lidc.storyline.debug.easterEggs.fancyPictureFrame',
    kind: EASTER_EGG_KINDS.GLTF,
    modelUrl: fancyPictureFrameModelUrl,
  },
  {
    id: 'djogoImmagine',
    labelKey: 'lidc.storyline.debug.easterEggs.djogoImmagine',
    kind: EASTER_EGG_KINDS.TEXTURED_PLANE,
    modelUrl: djogoImmagineTextureUrl,
    planeMaxSize: 0.75,
  },
  {
    id: 'pioneerDjConsole',
    labelKey: 'lidc.storyline.debug.easterEggs.pioneerDjConsole',
    kind: EASTER_EGG_KINDS.GLTF,
    modelUrl: pioneerDjConsoleModelUrl,
  },
  {
    id: 'rat',
    labelKey: 'lidc.storyline.debug.easterEggs.rat',
    kind: EASTER_EGG_KINDS.GLTF,
    modelUrl: ratModelUrl,
  },
  {
    id: 'snowyOwl',
    labelKey: 'lidc.storyline.debug.easterEggs.snowyOwl',
    kind: EASTER_EGG_KINDS.GLTF,
    modelUrl: snowyOwlModelUrl,
  },
]);

export function createDefaultEasterEggTransform(id) {
  return {
    id,
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

export function getDefaultEasterEggTransforms() {
  return LIDC_STORYLINE_EASTER_EGGS.map((egg) => createDefaultEasterEggTransform(egg.id));
}

export function mergeEasterEggTransforms(savedEggs = []) {
  const savedById = new Map(
    (Array.isArray(savedEggs) ? savedEggs : []).map((egg) => [egg.id, egg]),
  );

  return LIDC_STORYLINE_EASTER_EGGS.map((egg) => {
    const defaults = createDefaultEasterEggTransform(egg.id);
    const saved = savedById.get(egg.id);
    if (!saved) return defaults;

    return {
      id: egg.id,
      position: saved.position ?? defaults.position,
      rotation: saved.rotation ?? defaults.rotation,
      scale: saved.scale ?? defaults.scale,
    };
  });
}
