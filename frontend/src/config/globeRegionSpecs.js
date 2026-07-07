/**
 * Globe theater regions per campaign.
 *
 * - `countries`: full ISO_A2 country polygons (Natural Earth GeoJSON).
 * - `zones`: partial areas clipped from a country via [west, south, east, north] bbox.
 *
 * Bboxes are approximate theater boundaries at 1:110m scale.
 */
export const GLOBE_REGION_SPECS = {
  'hidc-2000-balkans': {
    countries: ['IT', 'SI', 'HR', 'BA', 'RS', 'ME', 'XK', 'MK', 'AL'],
    zones: [
      // Western Romania
      { countries: ['RO'], bbox: [20.5, 43.6, 25.8, 48.2] },
      // Southern Hungary
      { countries: ['HU'], bbox: [16.0, 45.8, 22.9, 47.9] },
      // Western Bulgaria
      { countries: ['BG'], bbox: [22.0, 41.2, 25.5, 44.2] },
    ],
  },

  'hidc-modern-syria': {
    countries: ['LB', 'SY', 'IL', 'JO', 'PS'],
    zones: [
      // Southern Turkey (east of Gazipaşa, border with Syria)
      { countries: ['TR'], bbox: [32.3, 36.0, 44.5, 39.1] },
      // Western Iraq (border strip with Syria and Jordan)
      { countries: ['IQ'], bbox: [38.8, 32.2, 42.8, 35.8] },
    ],
  },

  'lidc-persian-gulf': {
    countries: ['AE', 'QA', 'BH', 'KW'],
    zones: [
      // Iran — slight trim on west and north (Gulf-facing theater)
      { countries: ['IR'], bbox: [46.5, 25.5, 63.5, 37.5] },
      // Oman — north of center only (southern half excluded)
      { countries: ['OM'], bbox: [52.0, 21.2, 59.6, 26.5] },
    ],
  },

  'lidc-afghanistan': {
    countries: ['AF'],
    zones: [
      // Pakistan border corridor
      { countries: ['PK'], bbox: [60.5, 29.5, 71.5, 36.5] },
      // Turkmenistan border corridor
      { countries: ['TM'], bbox: [58.0, 35.2, 63.5, 38.2] },
    ],
  },

  'hidc-cw84-germany': {
    countries: ['DE'],
    zones: [
      // Southern Denmark
      { countries: ['DK'], bbox: [8.0, 54.4, 15.3, 57.7] },
      // Southern Sweden (Göteborg area down toward the German border via Denmark)
      { countries: ['SE'], bbox: [10.8, 55.3, 17.5, 57.9] },
    ],
  },
};
