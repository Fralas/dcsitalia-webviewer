import { industrialDark } from '../config/industrialDarkTokens';

/**
 * One deterministic gray per country across the industrial-dark globe range.
 */
const GRAY_LIGHT = {
  r: parseInt(industrialDark.globeGrayLight.slice(1, 3), 16),
  g: parseInt(industrialDark.globeGrayLight.slice(3, 5), 16),
  b: parseInt(industrialDark.globeGrayLight.slice(5, 7), 16),
};
const GRAY_DARK = {
  r: parseInt(industrialDark.globeGrayDark.slice(1, 3), 16),
  g: parseInt(industrialDark.globeGrayDark.slice(3, 5), 16),
  b: parseInt(industrialDark.globeGrayDark.slice(5, 7), 16),
};

function toHex(n) {
  return n.toString(16).padStart(2, '0');
}

/** FNV-1a — spreads even short ISO codes across the full range */
function hashToT(id) {
  let h = 2166136261;
  const str = String(id);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff;
}

export function countryToGrayscale(feature) {
  const props = feature.properties || feature;
  const id = props.ISO_A3 || props.ADMIN || props.ISO_A2 || '';
  const t = hashToT(id);

  const r = Math.round(GRAY_DARK.r + t * (GRAY_LIGHT.r - GRAY_DARK.r));
  const g = Math.round(GRAY_DARK.g + t * (GRAY_LIGHT.g - GRAY_DARK.g));
  const b = Math.round(GRAY_DARK.b + t * (GRAY_LIGHT.b - GRAY_DARK.b));

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
