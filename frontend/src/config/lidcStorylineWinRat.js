export const WINRAT_PACKAGE_ID = 'winrat';

export const WINRAT_KIND_FOLDERS = Object.freeze({
  img: 'IMG',
  photo: 'PHOTO',
  audio: 'AUDIO',
});

export const WINRAT_GRID_COLS = 10;
export const WINRAT_GRID_ROWS = 8;
export const WINRAT_WINDOW = 4;
export const WINRAT_TIME_LIMIT_MS = 30000;
export const WINRAT_SHUFFLE_MS = 1100;
export const WINRAT_MAX_MISSES = 3;

export const WINRAT_ARCHIVES = Object.freeze([
  {
    id: 'case-1187',
    fileName: 'CASE_1187.ZIP',
    sourceDir: '/archive',
    sizeLabel: '1.4MB',
    files: [
      { kind: 'img', fileName: 'C1187_STILL.IMG' },
      { kind: 'photo', fileName: 'C1187_FIELD.JPG' },
      { kind: 'audio', fileName: 'C1187_WIRE.WAV' },
    ],
  },
  {
    id: 'cache-04',
    fileName: 'CACHE_04.ZIP',
    sourceDir: '/archive',
    sizeLabel: '880kB',
    files: [
      { kind: 'img', fileName: 'CACHE04_FRAME.IMG' },
      { kind: 'photo', fileName: 'CACHE04_STILL.JPG' },
    ],
  },
  {
    id: 'tape-set',
    fileName: 'TAPE_SET.ZIP',
    sourceDir: '/archive',
    sizeLabel: '640kB',
    files: [
      { kind: 'audio', fileName: 'TAPESET_A.WAV' },
      { kind: 'audio', fileName: 'TAPESET_B.WAV' },
    ],
  },
]);

export function getWinRatArchiveById(id) {
  return WINRAT_ARCHIVES.find((item) => item.id === id) ?? null;
}

export function getWinRatArchiveByFileName(fileName) {
  const upper = String(fileName ?? '').toUpperCase();
  return WINRAT_ARCHIVES.find((item) => item.fileName === upper) ?? null;
}

export function getWinRatKindFolder(kind) {
  return WINRAT_KIND_FOLDERS[kind] ?? String(kind ?? 'BIN').toUpperCase();
}

export function getWinRatArchiveKinds(archive) {
  const seen = new Set();
  (archive?.files ?? []).forEach((file) => {
    if (file?.kind) seen.add(file.kind);
  });
  return [...seen];
}

export function formatWinRatTarget(values) {
  return (values ?? []).map((value) => String(value).padStart(2, '0')).join('.');
}
