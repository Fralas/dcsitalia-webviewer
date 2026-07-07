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
 * Format a date as DD/MM/YYYY (local calendar).
 */
export function formatEventDate(value) {
  const date = parseLocalDate(value);
  if (!date) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Parse a DD/MM/YYYY (or D/M/YYYY) string into YYYY-MM-DD for the API.
 */
export function parseEventDateInput(value) {
  const str = String(value || '').trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1000) return '';

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return '';
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Convert an optional date field to API format (empty string if blank/invalid).
 */
export function toApiDateField(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return parseEventDateInput(text);
}
