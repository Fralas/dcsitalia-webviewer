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
    x: 10,
    y: 16,
    width: 18,
    rotation: -2.5,
  },
  {
    id: 'cas',
    image: blueCasImg,
    labelKey: 'lidc.storyline.whiteboardItems.cas.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.cas.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.cas.body',
    x: 34,
    y: 12,
    width: 19,
    rotation: 1.8,
  },
  {
    id: 'scout',
    image: scoutImg,
    labelKey: 'lidc.storyline.whiteboardItems.scout.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.scout.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.scout.body',
    x: 62,
    y: 20,
    width: 17,
    rotation: -1.2,
  },
  {
    id: 'naval',
    image: shipImg,
    labelKey: 'lidc.storyline.whiteboardItems.naval.label',
    detailTitleKey: 'lidc.storyline.whiteboardItems.naval.title',
    detailBodyKey: 'lidc.storyline.whiteboardItems.naval.body',
    x: 24,
    y: 54,
    width: 20,
    rotation: 2.4,
  },
];
