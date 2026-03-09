import { appConfig } from '../config/appConfig';
import en from '../locales/en';
import it from '../locales/it';

const locales = { en, it };
const fallbackLocaleKey = locales[appConfig.fallbackLocale] ? appConfig.fallbackLocale : 'en';
const localeStorageKey = appConfig.localeStorageKey || 'dcsitalia.locale';
const italianRegions = new Set((appConfig.italianRegions || ['IT', 'SM', 'VA']).map(code => String(code).toUpperCase()));

function normalizeLocaleKey(localeLike) {
  if (!localeLike) {
    return null;
  }

  const base = String(localeLike).toLowerCase().split(/[-_]/)[0];
  return locales[base] ? base : null;
}

function detectRegionFromLocaleTag(localeTag) {
  if (!localeTag) {
    return null;
  }

  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Locale === 'function') {
      const region = new Intl.Locale(localeTag).region;
      if (region) {
        return String(region).toUpperCase();
      }
    }
  } catch (_) {
    // Ignore and fallback to regex parsing.
  }

  const match = String(localeTag).match(/[-_]([a-zA-Z]{2}|\d{3})(?:[-_]|$)/);
  return match ? match[1].toUpperCase() : null;
}

function detectRegionFromTimezone() {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone === 'Europe/Rome') return 'IT';
    if (timezone === 'Europe/San_Marino') return 'SM';
    if (timezone === 'Europe/Vatican') return 'VA';
  } catch (_) {
    // Ignore timezone detection failures.
  }

  return null;
}

function getNavigatorLocaleCandidates() {
  if (typeof navigator === 'undefined') {
    return [];
  }

  const list = Array.isArray(navigator.languages) && navigator.languages.length > 0
    ? navigator.languages
    : [navigator.language];

  return list.filter(Boolean);
}

function getStoredLocalePreference() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  try {
    return normalizeLocaleKey(window.localStorage.getItem(localeStorageKey));
  } catch (_) {
    return null;
  }
}

function detectLocaleFromBrowser() {
  const localeCandidates = getNavigatorLocaleCandidates();

  const hasItalianLanguage = localeCandidates.some(candidate => normalizeLocaleKey(candidate) === 'it');
  if (hasItalianLanguage) {
    return 'it';
  }

  const hasItalianRegion = localeCandidates
    .map(detectRegionFromLocaleTag)
    .filter(Boolean)
    .some(region => italianRegions.has(region));

  if (hasItalianRegion) {
    return 'it';
  }

  const timezoneRegion = detectRegionFromTimezone();
  if (timezoneRegion && italianRegions.has(timezoneRegion)) {
    return 'it';
  }

  return 'en';
}

function resolveInitialLocale() {
  const storedPreference = getStoredLocalePreference();
  if (storedPreference) {
    return storedPreference;
  }

  if (appConfig.locale === 'auto') {
    return detectLocaleFromBrowser();
  }

  const configured = normalizeLocaleKey(appConfig.locale);
  return configured || fallbackLocaleKey;
}

let activeLocaleKey = resolveInitialLocale();

function getActiveTranslations() {
  return locales[activeLocaleKey] || locales[fallbackLocaleKey];
}

function updateDocumentLang(localeKey) {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = localeKey;
  }
}

updateDocumentLang(activeLocaleKey);

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
  const translated = getValue(getActiveTranslations(), path);
  const fallback = getValue(locales[fallbackLocaleKey], path);
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

export function setActiveLocale(localeKey, { persist = true } = {}) {
  const normalized = normalizeLocaleKey(localeKey) || fallbackLocaleKey;
  activeLocaleKey = normalized;
  updateDocumentLang(activeLocaleKey);

  if (persist && typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(localeStorageKey, normalized);
    } catch (_) {
      // Ignore storage errors.
    }
  }

  return activeLocaleKey;
}

export function clearLocalePreference() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.removeItem(localeStorageKey);
  } catch (_) {
    // Ignore storage errors.
  }
}
