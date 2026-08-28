import { t } from '../utils/locale';

const ROOT = '/';

const DIRECTORY_TREE = Object.freeze({
  [ROOT]: {
    type: 'dir',
    entries: ['README.TXT', 'DOCUMENTS', 'PHOTO', 'LOGS', 'COMMS', 'ARCHIVE'],
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
});

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
  const contentKey = FILE_CONTENT_KEYS[fileName.toUpperCase()];
  if (!contentKey) return null;
  return t(`lidc.storyline.terminal.files.${contentKey}`);
}

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

    case 'whoami':
      return { lines: t('lidc.storyline.terminal.commands.whoami') };

    case 'hostname':
      return { lines: ['ratos-node-07'] };

    case 'date':
      return { lines: [new Date().toUTCString()] };

    case 'uname':
      return { lines: [t('lidc.storyline.terminal.commands.uname')] };

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

      const content = readFileContent(resolved.fileName);
      return { lines: Array.isArray(content) ? content : [content] };
    }

    default:
      return { lines: [t('lidc.storyline.terminal.commands.unknown', { command: parts[0].toUpperCase() })] };
  }
}
