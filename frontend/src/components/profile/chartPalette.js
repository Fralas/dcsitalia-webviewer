/**
 * Chart colors for the profile (dark surface #0f0f0f). Categorical slots in fixed order,
 * validated with the dataviz palette checker (lightness band, chroma, CVD, contrast all pass).
 * Text never uses these: values and labels stay in the --profile-* ink tokens.
 */
export const SERIES = Object.freeze({
  blue: '#3987e5',
  orange: '#d95926',
  aqua: '#199e70',
  yellow: '#c98500',
  magenta: '#d55181',
  violet: '#9085e9',
});

/** "Other" / unknown bucket: neutral, never a generated hue. */
export const OTHER = '#5a5a58';

/** Single-series charts use the site accent. */
export const ACCENT = '#ff8c00';

/** Kill / death categories share one mapping so a color always means the same thing. */
export const CATEGORY_COLORS = Object.freeze({
  planes: SERIES.blue,
  helicopters: SERIES.orange,
  sams: SERIES.aqua,
  ground: SERIES.yellow,
  ships: SERIES.magenta,
});

export const AXIS = {
  tick: { fill: '#9a9a9a', fontSize: 11 },
  grid: '#262626',
  line: '#3c3c3c',
};
