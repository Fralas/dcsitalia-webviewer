import blueCasImg from '../../img/wiki/veh/BLUE_CAS.png';
import bluePatrolImg from '../../img/wiki/veh/BLUE_PATROL.png';
import scoutImg from '../../img/wiki/veh/SCOUT.png';
import shipImg from '../../img/wiki/veh/SHIP.png';

export const LIDC_STORYLINE_WHITEBOARD_ITEMS = [
  {
    id: 'patrol',
    image: bluePatrolImg,
    labelKey: 'lidc.storyline.whiteboardItems.patrol.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.patrol.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.patrol.body',
    x: 8,
    y: 14,
    width: 24,
    rotation: -2.5,
  },
  {
    id: 'cas',
    image: blueCasImg,
    labelKey: 'lidc.storyline.whiteboardItems.cas.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.cas.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.cas.body',
    x: 36,
    y: 10,
    width: 26,
    rotation: 1.8,
  },
  {
    id: 'scout',
    image: scoutImg,
    labelKey: 'lidc.storyline.whiteboardItems.scout.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.scout.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.scout.body',
    x: 68,
    y: 18,
    width: 22,
    rotation: -1.2,
  },
  {
    id: 'naval',
    image: shipImg,
    labelKey: 'lidc.storyline.whiteboardItems.naval.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.naval.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.naval.body',
    x: 22,
    y: 52,
    width: 28,
    rotation: 2.4,
  },
];
