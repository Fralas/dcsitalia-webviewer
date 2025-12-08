import { appConfig } from '../config/appConfig';
import en from '../locales/en';
import it from '../locales/it';

const locales = { en, it };

const fallbackLocaleKey = locales[appConfig.fallbackLocale] ? appConfig.fallbackLocale : 'en';
const activeLocaleKey = locales[appConfig.locale] ? appConfig.locale : fallbackLocaleKey;

const activeTranslations = locales[activeLocaleKey];
const fallbackTranslations = locales[fallbackLocaleKey];

function getValue(obj, path) {
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj);
}

function interpolate(value, params = {}) {
  if (typeof value !== 'string') return value;
  return Object.keys(params).reduce(
    (acc, key) => acc.replace(new RegExp(`{{${key}}}`, 'g'), params[key]),
    value,
  );
}

export function t(path, params = {}) {
  const translated = getValue(activeTranslations, path);
  const fallback = getValue(fallbackTranslations, path);
  const value = translated !== undefined ? translated : fallback !== undefined ? fallback : path;
  return interpolate(value, params);
}

export function formatElapsedTime(timestamp, baseKey) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return t(`${baseKey}.seconds`, { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t(`${baseKey}.minutes`, { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t(`${baseKey}.hours`, { count: hours });
  const days = Math.floor(hours / 24);
  return t(`${baseKey}.days`, { count: days });
}

export function formatRemainingTime(timestamp, baseKey) {
  const seconds = Math.floor((timestamp - Date.now()) / 1000);
  if (seconds < 0) return t(`${baseKey}.expired`);
  if (seconds < 60) return t(`${baseKey}.seconds`, { count: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t(`${baseKey}.minutes`, { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t(`${baseKey}.hours`, { count: hours });
  const days = Math.floor(hours / 24);
  return t(`${baseKey}.days`, { count: days });
}

export function getStatusLabel(statusKey) {
  return t(`general.statusLabels.${statusKey}`);
}

export function getActiveLocale() {
  return activeLocaleKey;
}

export function getAvailableLocales() {
  return Object.keys(locales);
}
