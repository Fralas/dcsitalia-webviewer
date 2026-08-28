import abdulRahmanImg from '../../img/characters/AbdulRahman.png';
import viktorSokolovImg from '../../img/characters/ViktorSokolov.png';
import faridKhanImg from '../../img/characters/FaridKhan.png';
import faisalNoorImg from '../../img/characters/FaisalNoor.png';
import omarHakimiImg from '../../img/characters/OmarHakimi.png';

export const LIDC_STORYLINE_WHITEBOARD_ITEMS = [
  {
    id: 'abdulRahman',
    type: 'character',
    image: abdulRahmanImg,
    labelKey: 'lidc.storyline.whiteboardItems.abdulRahman.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.abdulRahman.title',
    dossierSections: ['profile', 'personality', 'appearance', 'network', 'resources'],
    x: 16,
    y: 48,
    width: 13,
    rotation: -1.2,
  },
  {
    id: 'viktorSokolov',
    type: 'character',
    image: viktorSokolovImg,
    labelKey: 'lidc.storyline.whiteboardItems.viktorSokolov.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.viktorSokolov.title',
    dossierSections: ['profile', 'personality', 'appearance', 'relationship', 'suppliedMaterial', 'secret', 'treeLink'],
    x: 76,
    y: 12,
    width: 13,
    rotation: 1.4,
  },
  {
    id: 'faridKhan',
    type: 'character',
    image: faridKhanImg,
    labelKey: 'lidc.storyline.whiteboardItems.faridKhan.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.faridKhan.title',
    dossierSections: ['profile', 'personality', 'appearance', 'relationship', 'suppliedMaterial', 'secret', 'treeLink'],
    x: 42,
    y: 62,
    width: 13,
    rotation: 0.6,
  },
  {
    id: 'faisalNoor',
    type: 'character',
    image: faisalNoorImg,
    labelKey: 'lidc.storyline.whiteboardItems.faisalNoor.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.faisalNoor.title',
    dossierSections: ['profile', 'personality', 'appearance', 'network', 'transmissions', 'weakness', 'relationships', 'treeLink'],
    x: 3,
    y: 6,
    width: 12,
    rotation: -0.4,
  },
  {
    id: 'omarHakimi',
    type: 'character',
    image: omarHakimiImg,
    labelKey: 'lidc.storyline.whiteboardItems.omarHakimi.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.omarHakimi.title',
    dossierSections: ['profile', 'personality', 'appearance', 'network', 'resources', 'relationships', 'weakness', 'treeLink'],
    x: 42,
    y: 10,
    width: 13,
    rotation: 0.5,
  },
];

export const LIDC_STORYLINE_WHITEBOARD_CONNECTIONS = [
  {
    id: 'abdul-faisal',
    from: 'abdulRahman',
    to: 'faisalNoor',
    fromAnchor: { x: 0.5, y: 0.05 },
    toAnchor: { x: 0.5, y: 0.05 },
  },
  {
    id: 'abdul-omar',
    from: 'abdulRahman',
    to: 'omarHakimi',
    fromAnchor: { x: 0.5, y: 0.05 },
    toAnchor: { x: 0.5, y: 0.05 },
  },
  {
    id: 'omar-viktor',
    from: 'omarHakimi',
    to: 'viktorSokolov',
    fromAnchor: { x: 0.5, y: 0.05 },
    toAnchor: { x: 0.5, y: 0.05 },
  },
  {
    id: 'omar-farid',
    from: 'omarHakimi',
    to: 'faridKhan',
    fromAnchor: { x: 0.5, y: 0.05 },
    toAnchor: { x: 0.5, y: 0.05 },
  },
];
