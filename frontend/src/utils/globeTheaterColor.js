import { industrialDark } from '../config/industrialDarkTokens';
import { countryToGrayscale } from './countryToGrayscale';

export const GLOBE_THEATER_ACCENT = industrialDark.accent;

export function isTheaterHighlightFeature(feature) {
  return Boolean(feature?.properties?.theaterHighlight);
}

export function resolveGlobeHexColor(feature) {
  const customHexColor = feature?.properties?.customHexColor;
  if (customHexColor) return customHexColor;

  if (isTheaterHighlightFeature(feature)) {
    return GLOBE_THEATER_ACCENT;
  }
  return countryToGrayscale(feature);
}

/** Syria theater (orange dots) on the landing globe. */
export function isHidcTheaterFeature(feature) {
  return feature?.properties?.ISO_A3 === 'THEATER' && isTheaterHighlightFeature(feature);
}

export const HIDC_SYRIA_HOVER_LABEL = 'HIDC - MODERN SYRIA';

/** Maps aggregated theater hex features to landing campaign ids. */
export const GLOBE_THEATER_CAMPAIGN = {
  THEATER: 'hidc-modern-syria',
  AF_PK: 'lidc-afghanistan',
};

export function resolveTheaterCampaignId(feature) {
  const isoA3 = feature?.properties?.ISO_A3;
  if (!isoA3 || !isTheaterHighlightFeature(feature)) return null;
  return GLOBE_THEATER_CAMPAIGN[isoA3] || null;
}
