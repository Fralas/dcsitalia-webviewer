import { cellsToHexFeature } from './cellsToHexFeature';
import { buildTheaterHexCellSet, getCellsFromCountryFeature } from './buildTheaterHexCells';

const AFGHANISTAN_PAKISTAN_COLOR = '#E32C2C';
const RED_COUNTRY_ISO_A2 = new Set(['AF', 'PK']);

export function prepareGlobeCountryFeatures(rawFeatures) {
  if (!Array.isArray(rawFeatures) || rawFeatures.length === 0) {
    return [];
  }

  const theaterCells = buildTheaterHexCellSet(rawFeatures);
  const redCells = new Set();
  const features = [];

  rawFeatures.forEach((feature) => {
    const isoA2 = String(feature?.properties?.ISO_A2 || '').toUpperCase();
    if (RED_COUNTRY_ISO_A2.has(isoA2)) {
      getCellsFromCountryFeature(feature).forEach((cell) => redCells.add(cell));
    }
  });

  redCells.forEach((cell) => theaterCells.delete(cell));

  rawFeatures.forEach((feature) => {
    const countryCells = getCellsFromCountryFeature(feature);
    const grayCells = countryCells.filter((cell) => !theaterCells.has(cell));
    const grayFeature = cellsToHexFeature(grayCells, feature.properties);
    if (grayFeature) features.push(grayFeature);
  });

  const afPkFeature = cellsToHexFeature(redCells, {
    theaterHighlight: true,
    customHexColor: AFGHANISTAN_PAKISTAN_COLOR,
    ADMIN: 'Afghanistan Pakistan Theater',
    ISO_A3: 'AF_PK',
  });
  if (afPkFeature) features.push(afPkFeature);

  const theaterFeature = cellsToHexFeature(theaterCells, {
    theaterHighlight: true,
    ADMIN: 'Syria Theater',
    ISO_A3: 'THEATER',
    theaterCellIds: [...theaterCells],
  });
  if (theaterFeature) features.push(theaterFeature);

  return features;
}
