const MONTHS = {
  en: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'],
  it: ['GEN', 'FEB', 'MAR', 'APR', 'MAG', 'GIU', 'LUG', 'AGO', 'SET', 'OTT', 'NOV', 'DIC'],
};

/**
 * Parse a date value into a local Date, treating a plain YYYY-MM-DD string as a
 * local calendar date (no timezone shift).
 */
function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  const str = String(value);
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const [, y, m, d] = match;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a date as "27 SET" (day + localized 3-letter uppercase month).
 */
export function formatEventDate(value, language = 'en') {
  const date = parseLocalDate(value);
  if (!date) return '';
  const months = MONTHS[language] || MONTHS.en;
  return `${date.getDate()} ${months[date.getMonth()]}`;
}
