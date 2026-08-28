import abdulRahmanImg from '../../img/characters/AbdulRahman.png';
import viktorSokolovImg from '../../img/characters/ViktorSokolov.png';

export const LIDC_STORYLINE_WHITEBOARD_ITEMS = [
  {
    id: 'abdulRahman',
    type: 'character',
    image: abdulRahmanImg,
    labelKey: 'lidc.storyline.whiteboardItems.abdulRahman.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.abdulRahman.title',
    dossierSections: ['profile', 'personality', 'appearance', 'network', 'resources'],
    x: 22,
    y: 28,
    width: 18,
    rotation: -1.2,
  },
  {
    id: 'viktorSokolov',
    type: 'character',
    image: viktorSokolovImg,
    labelKey: 'lidc.storyline.whiteboardItems.viktorSokolov.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.viktorSokolov.title',
    dossierSections: ['profile', 'personality', 'appearance', 'relationship', 'suppliedMaterial', 'secret', 'treeLink'],
    x: 58,
    y: 30,
    width: 18,
    rotation: 1.4,
  },
];

export const LIDC_STORYLINE_WHITEBOARD_CONNECTIONS = [
  {
    id: 'abdul-viktor',
    from: 'abdulRahman',
    to: 'viktorSokolov',
    fromAnchor: { x: 0.5, y: 0.05 },
    toAnchor: { x: 0.5, y: 0.05 },
  },
];
