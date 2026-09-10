import djogoImg from '../../3D/LIDC/eeggs/djogoimmagine.png';
import abdulRahmanImg from '../../img/characters/AbdulRahman.png';
import faisalNoorImg from '../../img/characters/FaisalNoor.png';
import faridKhanImg from '../../img/characters/FaridKhan.png';
import omarHakimiImg from '../../img/characters/OmarHakimi.png';

function assetUrl(module) {
  if (typeof module === 'string') return module;
  if (module && typeof module.default === 'string') return module.default;
  return '';
}

export const TERMINAL_IMAGE_FILES = Object.freeze({
  'OP0147.IMG': {
    src: assetUrl(omarHakimiImg),
    captionKey: 'photoOp0147Caption',
  },
  'INTERCEPT_032.IMG': {
    src: assetUrl(faisalNoorImg),
    captionKey: 'photoIntercept032Caption',
  },
  'CONTACT_01.RAW': {
    src: assetUrl(faridKhanImg),
    captionKey: 'photoContact01Caption',
  },
  'ROOF_CAM.RAW': {
    src: assetUrl(djogoImg),
    captionKey: 'photoRoofCamCaption',
  },
});

export function isTerminalImageFile(fileName) {
  return Boolean(TERMINAL_IMAGE_FILES[String(fileName ?? '').toUpperCase()]);
}

export function getTerminalImageViewer(fileName) {
  const entry = TERMINAL_IMAGE_FILES[String(fileName ?? '').toUpperCase()];
  if (!entry) return null;

  return {
    src: entry.src,
    fileName: String(fileName).toUpperCase(),
    captionKey: entry.captionKey,
  };
}
