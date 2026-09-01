import samiullahBarakzaiImg from '../../img/characters/SamiullahBarakzai.png';
import rahmatullahHotakImg from '../../img/characters/RahmatullahHotak.png';
import hamidullahSafiImg from '../../img/characters/HamidullahSafi.png';
import zahirPopalzaiImg from '../../img/characters/ZahirPopalzai.png';
import nazarMohammadAlizaiImg from '../../img/characters/NazarMohammadAlizai.png';
import izatullahNoorzaiImg from '../../img/characters/IzatullahNoorzai.png';
import bashirAchakzaiImg from '../../img/characters/BashirAchakzai.png';
import latifIshaqzaiImg from '../../img/characters/LatifIshaqzai.png';
import hajiKhairullahBarechImg from '../../img/characters/HajiKhairullahBarech.png';
import afghanistanChartImg from '../../img/lidc/chart.png';

const PHOTO_WIDTH = 10.4;
const DOSSIER = ['profile', 'personality', 'appearance', 'network', 'relationships', 'weakness', 'treeLink'];

export const LIDC_STORYLINE_WHITEBOARD_ITEMS = [
  {
    id: 'samiullahBarakzai',
    type: 'character',
    image: samiullahBarakzaiImg,
    labelKey: 'lidc.storyline.whiteboardItems.samiullahBarakzai.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.samiullahBarakzai.title',
    dossierSections: DOSSIER,
    x: 10.2,
    y: 1.6,
    width: PHOTO_WIDTH,
    rotation: -0.7,
  },
  {
    id: 'nazarMohammadAlizai',
    type: 'character',
    image: nazarMohammadAlizaiImg,
    labelKey: 'lidc.storyline.whiteboardItems.nazarMohammadAlizai.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.nazarMohammadAlizai.title',
    dossierSections: DOSSIER,
    x: 68.0,
    y: 1.8,
    width: PHOTO_WIDTH,
    rotation: 0.9,
  },
  {
    id: 'rahmatullahHotak',
    type: 'character',
    image: rahmatullahHotakImg,
    labelKey: 'lidc.storyline.whiteboardItems.rahmatullahHotak.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.rahmatullahHotak.title',
    dossierSections: DOSSIER,
    x: 1.6,
    y: 25.2,
    width: PHOTO_WIDTH,
    rotation: 0.6,
  },
  {
    id: 'hamidullahSafi',
    type: 'character',
    image: hamidullahSafiImg,
    labelKey: 'lidc.storyline.whiteboardItems.hamidullahSafi.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.hamidullahSafi.title',
    dossierSections: DOSSIER,
    x: 18.0,
    y: 26.0,
    width: PHOTO_WIDTH,
    rotation: -0.4,
  },
  {
    id: 'afghanistanChart',
    type: 'map',
    image: afghanistanChartImg,
    labelKey: 'lidc.storyline.whiteboardItems.afghanistanChart.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.afghanistanChart.title',
    x: 36.0,
    y: 24.8,
    width: 16.8,
    rotation: -0.5,
  },
  {
    id: 'izatullahNoorzai',
    type: 'character',
    image: izatullahNoorzaiImg,
    labelKey: 'lidc.storyline.whiteboardItems.izatullahNoorzai.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.izatullahNoorzai.title',
    dossierSections: DOSSIER,
    x: 68.2,
    y: 27.8,
    width: PHOTO_WIDTH,
    rotation: -0.9,
  },
  {
    id: 'zahirPopalzai',
    type: 'character',
    image: zahirPopalzaiImg,
    labelKey: 'lidc.storyline.whiteboardItems.zahirPopalzai.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.zahirPopalzai.title',
    dossierSections: DOSSIER,
    x: 1.6,
    y: 61.0,
    width: PHOTO_WIDTH,
    rotation: -0.5,
  },
  {
    id: 'bashirAchakzai',
    type: 'character',
    image: bashirAchakzaiImg,
    labelKey: 'lidc.storyline.whiteboardItems.bashirAchakzai.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.bashirAchakzai.title',
    dossierSections: DOSSIER,
    x: 16.4,
    y: 62.2,
    width: PHOTO_WIDTH,
    rotation: 0.4,
  },
  {
    id: 'latifIshaqzai',
    type: 'character',
    image: latifIshaqzaiImg,
    labelKey: 'lidc.storyline.whiteboardItems.latifIshaqzai.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.latifIshaqzai.title',
    dossierSections: DOSSIER,
    x: 31.4,
    y: 63.0,
    width: PHOTO_WIDTH,
    rotation: -0.7,
  },
  {
    id: 'hajiKhairullahBarech',
    type: 'character',
    image: hajiKhairullahBarechImg,
    labelKey: 'lidc.storyline.whiteboardItems.hajiKhairullahBarech.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.hajiKhairullahBarech.title',
    dossierSections: DOSSIER,
    x: 46.6,
    y: 61.6,
    width: PHOTO_WIDTH,
    rotation: 0.8,
  },
];

const pinTop = { x: 0.5, y: 0.05 };

export const LIDC_STORYLINE_WHITEBOARD_CONNECTIONS = [
  {
    id: 'samiullah-hotak',
    from: 'samiullahBarakzai',
    to: 'rahmatullahHotak',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
  {
    id: 'samiullah-safi',
    from: 'samiullahBarakzai',
    to: 'hamidullahSafi',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
  {
    id: 'hotak-bashir',
    from: 'rahmatullahHotak',
    to: 'bashirAchakzai',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
  {
    id: 'zahir-bashir',
    from: 'zahirPopalzai',
    to: 'bashirAchakzai',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
  {
    id: 'tufan-khatar',
    from: 'nazarMohammadAlizai',
    to: 'izatullahNoorzai',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
  {
    id: 'bashir-latif',
    from: 'bashirAchakzai',
    to: 'latifIshaqzai',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
  {
    id: 'latif-barech',
    from: 'latifIshaqzai',
    to: 'hajiKhairullahBarech',
    fromAnchor: pinTop,
    toAnchor: pinTop,
  },
];
