import { t } from '../utils/locale';
import { getTerminalImageViewer, isTerminalImageFile } from './lidcStorylineTerminalImages';
import { isRatosPackageInstalled, runRatosAptCommand } from './lidcStorylineTerminalPackages';
import {
  getPhoenixFileBursts,
  getPhoenixTranscriptFileName,
  PHOENIX_INTERCEPTS,
  PHOENIX_PACKAGE_ID,
} from './lidcStorylinePhoenixDecryptor';

const ROOT = '/';

const DIRECTORY_TREE = {
  [ROOT]: {
    type: 'dir',
    entries: ['README.TXT', 'DOCUMENTS', 'PHOTO', 'LOGS', 'COMMS', 'ARCHIVE', 'PHOENIX'],
  },
  '/documents': {
    type: 'dir',
    entries: ['MISSION.TXT', 'PERSONNEL.LOG', 'FIELD_NOTES.TXT'],
  },
  '/photo': {
    type: 'dir',
    entries: ['OP0147.IMG', 'INTERCEPT_032.IMG', 'CONTACT_01.RAW', 'ROOF_CAM.RAW'],
  },
  '/logs': {
    type: 'dir',
    entries: ['ACCESS.LOG', 'SYSTEM.LOG'],
  },
  '/comms': {
    type: 'dir',
    entries: ['FREQ_LIST.TXT', 'LAST_TX.LOG'],
  },
  '/archive': {
    type: 'dir',
    entries: ['CASE_1187.ZIP', 'OLD_MANIFEST.TXT'],
  },
  '/phoenix': {
    type: 'dir',
    entries: ['DECRYPTIONS'],
  },
  '/phoenix/decryptions': {
    type: 'dir',
    entries: [],
  },
};

const DYNAMIC_FILE_CONTENTS = {};

const FILE_CONTENT_KEYS = Object.freeze({
  'README.TXT': 'readme',
  'MISSION.TXT': 'mission',
  'PERSONNEL.LOG': 'personnel',
  'FIELD_NOTES.TXT': 'fieldNotes',
  'OP0147.IMG': 'photoOp0147',
  'INTERCEPT_032.IMG': 'photoIntercept032',
  'CONTACT_01.RAW': 'photoContact01',
  'ROOF_CAM.RAW': 'photoRoofCam',
  'ACCESS.LOG': 'accessLog',
  'SYSTEM.LOG': 'systemLog',
  'FREQ_LIST.TXT': 'freqList',
  'LAST_TX.LOG': 'lastTx',
  'CASE_1187.ZIP': 'caseArchive',
  'OLD_MANIFEST.TXT': 'oldManifest',
});

function normalizeToken(value) {
  return String(value ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '');
}

function normalizeDirPath(path) {
  if (!path || path === ROOT) return ROOT;

  const segments = normalizeToken(path)
    .toLowerCase()
    .split('/')
    .filter(Boolean);

  return segments.length ? `/${segments.join('/')}` : ROOT;
}

function resolvePath(cwd, target = '') {
  const raw = normalizeToken(target);
  if (!raw || raw === '.') return normalizeDirPath(cwd);

  const baseSegments = normalizeDirPath(cwd) === ROOT
    ? []
    : normalizeDirPath(cwd).slice(1).split('/');

  const targetSegments = raw.startsWith('/')
    ? raw.slice(1).split('/').filter(Boolean)
    : raw.split('/').filter(Boolean);

  const combined = [...baseSegments];

  targetSegments.forEach((segment) => {
    const lower = segment.toLowerCase();
    if (lower === '.') return;
    if (lower === '..') {
      combined.pop();
      return;
    }
    combined.push(lower);
  });

  return combined.length ? `/${combined.join('/')}` : ROOT;
}

function resolveFilePath(cwd, target = '') {
  const raw = normalizeToken(target);
  if (!raw) return null;

  let dirPath = normalizeDirPath(cwd);
  let filePart = raw;

  if (raw.includes('/')) {
    const segments = raw.split('/').filter(Boolean);
    filePart = segments.pop();
    dirPath = resolvePath(cwd, segments.join('/'));
  }

  const fileName = filePart.toUpperCase();
  const dir = DIRECTORY_TREE[dirPath];
  if (!dir || !dir.entries.includes(fileName)) return null;

  const nestedDirPath = dirPath === ROOT
    ? normalizeDirPath(`/${fileName.toLowerCase()}`)
    : normalizeDirPath(`${dirPath}/${fileName.toLowerCase()}`);
  if (DIRECTORY_TREE[nestedDirPath]) return null;

  return { dirPath, fileName };
}

function isDirectory(path) {
  return Boolean(DIRECTORY_TREE[normalizeDirPath(path)]);
}

function listDirectory(path) {
  const dirPath = normalizeDirPath(path);
  const dir = DIRECTORY_TREE[dirPath];
  if (!dir) return null;

  return dir.entries.map((entry) => {
    const entryPath = dirPath === ROOT
      ? normalizeDirPath(`/${entry.toLowerCase()}`)
      : normalizeDirPath(`${dirPath}/${entry.toLowerCase()}`);
    if (DIRECTORY_TREE[entryPath]) return `${entry}\\`;
    return entry;
  });
}

function readFileContent(fileName) {
  const upper = fileName.toUpperCase();
  if (DYNAMIC_FILE_CONTENTS[upper]) return DYNAMIC_FILE_CONTENTS[upper];
  const contentKey = FILE_CONTENT_KEYS[upper];
  if (!contentKey) return null;
  return t(`lidc.storyline.terminal.files.${contentKey}`);
}

function ensureDirectory(parentPath, name) {
  const parent = DIRECTORY_TREE[normalizeDirPath(parentPath)];
  if (!parent) return null;

  const entryName = name.toUpperCase();
  if (!parent.entries.includes(entryName)) parent.entries.push(entryName);

  const childPath = normalizeDirPath(parentPath) === ROOT
    ? `/${name.toLowerCase()}`
    : `${normalizeDirPath(parentPath)}/${name.toLowerCase()}`;

  if (!DIRECTORY_TREE[childPath]) {
    DIRECTORY_TREE[childPath] = { type: 'dir', entries: [] };
  }

  return childPath;
}

const PHOENIX_TRANSCRIPTS_STORAGE_KEY = 'lidc-storyline-phoenix-transcripts';
const PHOENIX_DECRYPTED_STORAGE_KEY = 'lidc-storyline-phoenix-decrypted';

function phoenixDecryptionsDir() {
  ensureDirectory(ROOT, 'PHOENIX');
  ensureDirectory('/phoenix', 'DECRYPTIONS');
  return DIRECTORY_TREE['/phoenix/decryptions'];
}

function persistPhoenixTranscripts() {
  const dir = DIRECTORY_TREE['/phoenix/decryptions'];
  const payload = {};
  dir?.entries.forEach((name) => {
    const content = DYNAMIC_FILE_CONTENTS[name];
    if (content) payload[name] = content;
  });
  try {
    window.localStorage.setItem(PHOENIX_TRANSCRIPTS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

function writePhoenixTranscriptFile(fileName, lines) {
  const dir = phoenixDecryptionsDir();
  const upper = String(fileName || 'FILE.TXT').toUpperCase();
  if (dir && !dir.entries.includes(upper)) dir.entries.push(upper);
  DYNAMIC_FILE_CONTENTS[upper] = Array.isArray(lines) ? lines : [String(lines ?? '')];
}

function isLegacyBurstTranscriptName(fileName) {
  const name = String(fileName || '').toUpperCase();
  return name === 'FILE.TXT' || /_[A-E]\.TXT$/.test(name);
}

export function savePhoenixDecryptorTranscript(fileName, lines) {
  writePhoenixTranscriptFile(fileName, lines);
  persistPhoenixTranscripts();
}

export function savePhoenixFrequencyTranscript(file, caughtIds = null) {
  if (!file) return null;
  const bursts = getPhoenixFileBursts(file).filter(
    (burst) => !caughtIds || caughtIds.includes(burst.id),
  );
  const header = t('lidc.storyline.terminal.phoenix.logHeader');
  const sections = bursts.flatMap((burst, index) => {
    const logs = t(`lidc.storyline.terminal.phoenix.transcripts.${burst.transcriptKey}`);
    const lines = Array.isArray(logs) ? logs : [String(logs ?? '')];
    return index === 0 ? lines : ['', ...lines];
  });
  const content = [header, ...sections];
  savePhoenixDecryptorTranscript(getPhoenixTranscriptFileName(file), content);
  return content;
}

function hydratePhoenixTranscripts() {
  phoenixDecryptionsDir();

  try {
    const stored = JSON.parse(window.localStorage.getItem(PHOENIX_TRANSCRIPTS_STORAGE_KEY));
    if (stored && typeof stored === 'object') {
      Object.entries(stored).forEach(([name, content]) => {
        if (isLegacyBurstTranscriptName(name)) return;
        writePhoenixTranscriptFile(name, content);
      });
    }
  } catch {
    /* ignore corrupt storage */
  }

  const dir = DIRECTORY_TREE['/phoenix/decryptions'];
  if (dir) {
    dir.entries = dir.entries.filter((name) => !isLegacyBurstTranscriptName(name));
  }

  try {
    const decrypted = JSON.parse(window.localStorage.getItem(PHOENIX_DECRYPTED_STORAGE_KEY));
    if (Array.isArray(decrypted)) {
      decrypted.forEach((id) => {
        const file = PHOENIX_INTERCEPTS.find((item) => item.id === id);
        if (!file) return;
        const name = getPhoenixTranscriptFileName(file);
        if (DYNAMIC_FILE_CONTENTS[name]) return;
        savePhoenixFrequencyTranscript(file);
      });
    }
  } catch {
    /* ignore */
  }

  persistPhoenixTranscripts();
}

hydratePhoenixTranscripts();

function buildTreeLines(path = ROOT, prefix = '') {
  const dirPath = normalizeDirPath(path);
  const dir = DIRECTORY_TREE[dirPath];
  if (!dir) return [];

  const lines = [];
  const entries = dir.entries.map((entry) => {
    const entryPath = dirPath === ROOT
      ? normalizeDirPath(`/${entry.toLowerCase()}`)
      : normalizeDirPath(`${dirPath}/${entry.toLowerCase()}`);
    return {
      name: entry,
      isDir: Boolean(DIRECTORY_TREE[entryPath]),
      path: entryPath,
    };
  });

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const branch = isLast ? '└── ' : '├── ';
    const label = entry.isDir ? `${entry.name}\\` : entry.name;
    lines.push(`${prefix}${branch}${label}`);

    if (entry.isDir) {
      const nextPrefix = `${prefix}${isLast ? '    ' : '│   '}`;
      lines.push(...buildTreeLines(entry.path, nextPrefix));
    }
  });

  return lines;
}

function buildAllFilesLines() {
  const lines = [t('lidc.storyline.terminal.commands.filesHeader')];

  Object.entries(DIRECTORY_TREE).forEach(([dirPath, dir]) => {
    dir.entries.forEach((entry) => {
      const entryPath = dirPath === ROOT
        ? normalizeDirPath(`/${entry.toLowerCase()}`)
        : `${dirPath}/${entry.toLowerCase()}`;

      if (DIRECTORY_TREE[entryPath]) {
        lines.push(formatDosPath(entryPath));
        return;
      }

      const displayDir = dirPath === ROOT ? ROOT : dirPath;
      lines.push(`${formatDosPath(displayDir)}${entry}`);
    });
  });

  return lines;
}

export function cwdToPrompt(cwd) {
  if (normalizeDirPath(cwd) === ROOT) return 'C:\\>';
  const suffix = normalizeDirPath(cwd)
    .slice(1)
    .split('/')
    .map((segment) => segment.toUpperCase())
    .join('\\');
  return `C:\\${suffix}\\>`;
}

function formatDosPath(path) {
  if (normalizeDirPath(path) === ROOT) return 'C:\\';
  return `C:\\${normalizeDirPath(path).slice(1).split('/').map((segment) => segment.toUpperCase()).join('\\')}\\`;
}

export function runRatosCommand(input, session = { cwd: ROOT }) {
  const trimmed = input.trim();
  if (!trimmed) return { lines: [] };

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const argText = args.join(' ');
  const cwd = normalizeDirPath(session.cwd ?? ROOT);

  switch (command) {
    case 'help':
      return { lines: t('lidc.storyline.terminal.commands.help') };

    case 'clear':
      return { clear: true, lines: [] };

    case 'whoami': {
      const operator = String(session.operator ?? '').trim() || 'operator';
      const template = t('lidc.storyline.terminal.commands.whoami');
      const lines = Array.isArray(template) ? template : [template];
      return {
        lines: lines.map((line) => String(line).replaceAll('{{user}}', operator)),
      };
    }

    case 'hostname':
      return { lines: ['ratos-node-07'] };

    case 'date':
      return { lines: [new Date().toUTCString()] };

    case 'uname':
      return { lines: [t('lidc.storyline.terminal.commands.uname')] };

    case 'apt':
    case 'apt-get':
      return runRatosAptCommand(args, session);

    case 'phoenix':
    case 'phoenix-decryptor':
    case 'decryptor': {
      if (!isRatosPackageInstalled(session.installedPackages, PHOENIX_PACKAGE_ID)) {
        return { lines: t('lidc.storyline.terminal.commands.phoenixMissing') };
      }
      return {
        lines: t('lidc.storyline.terminal.commands.phoenixLaunch'),
        phoenixGame: true,
      };
    }

    case 'exit':
    case 'quit':
      return { exit: true, lines: [] };

    case 'cd': {
      if (!argText) {
        return { cwd: ROOT, lines: [] };
      }

      const nextPath = resolvePath(cwd, argText);
      if (!isDirectory(nextPath)) {
        return { lines: [t('lidc.storyline.terminal.commands.cdMissing', { path: argText.toUpperCase() })] };
      }

      return { cwd: nextPath, lines: [] };
    }

    case 'ls':
    case 'dir': {
      const targetPath = argText ? resolvePath(cwd, argText) : cwd;
      const listing = listDirectory(targetPath);
      if (!listing) {
        return { lines: [t('lidc.storyline.terminal.commands.dirMissing', { path: argText.toUpperCase() || '???' })] };
      }

      return {
        lines: [
          formatDosPath(targetPath),
          ...listing,
        ],
      };
    }

    case 'tree':
      return {
        lines: [
          formatDosPath(ROOT),
          ...buildTreeLines(),
        ],
      };

    case 'files':
      return { lines: buildAllFilesLines() };

    case 'cat': {
      const resolved = resolveFilePath(cwd, argText);
      if (!resolved) {
        return { lines: [t('lidc.storyline.terminal.commands.catMissing', { file: (argText || '???').toUpperCase() })] };
      }

      if (isTerminalImageFile(resolved.fileName)) {
        return {
          lines: t('lidc.storyline.terminal.commands.catImageHint', { file: resolved.fileName }),
        };
      }

      const content = readFileContent(resolved.fileName);
      return { lines: Array.isArray(content) ? content : [content] };
    }

    case 'view':
    case 'display':
    case 'show': {
      const resolved = resolveFilePath(cwd, argText);
      if (!resolved || !isTerminalImageFile(resolved.fileName)) {
        return {
          lines: [t('lidc.storyline.terminal.commands.viewMissing', { file: (argText || '???').toUpperCase() })],
        };
      }

      const viewer = getTerminalImageViewer(resolved.fileName);
      return {
        lines: [],
        imageViewer: {
          src: viewer.src,
        },
      };
    }

    case 'close': {
      return { closeImageViewer: true, lines: [] };
    }

    default:
      return { lines: [t('lidc.storyline.terminal.commands.unknown', { command: parts[0].toUpperCase() })] };
  }
}
