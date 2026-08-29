import { t } from '../utils/locale';

export const RATOS_PACKAGES = Object.freeze([
  {
    id: 'winrat',
    aliases: ['win-rat', 'winrar'],
    name: 'WinRat',
    version: '1.4.2',
    size: '312kB',
    descriptionKey: 'winrat',
  },
  {
    id: 'phoenix-decryptor',
    aliases: ['phoenix', 'phoenixdecryptor', 'phoenix_decryptor'],
    name: 'Phoenix Decryptor',
    version: '0.9.1',
    size: '1.1MB',
    descriptionKey: 'phoenixDecryptor',
  },
]);

const PACKAGES_BY_TOKEN = new Map();

RATOS_PACKAGES.forEach((pkg) => {
  const tokens = [pkg.id, pkg.name, ...(pkg.aliases ?? [])];
  tokens.forEach((token) => {
    PACKAGES_BY_TOKEN.set(String(token).trim().toLowerCase(), pkg);
  });
});

function tLines(path, params = {}) {
  const value = t(path);
  const lines = Array.isArray(value) ? value : [value];
  const keys = Object.keys(params);

  return lines.map((line) => {
    if (typeof line !== 'string' || keys.length === 0) return String(line);
    return keys.reduce(
      (acc, key) => acc.replaceAll(`{{${key}}}`, String(params[key])),
      line,
    );
  });
}

export function findRatosPackage(token) {
  const key = String(token ?? '').trim().toLowerCase();
  if (!key) return null;
  return PACKAGES_BY_TOKEN.get(key) ?? null;
}

export function isRatosPackageInstalled(installedIds, packageId) {
  return (installedIds ?? []).includes(packageId);
}

export function runRatosAptCommand(args = [], session = {}) {
  const installedIds = Array.isArray(session.installedPackages)
    ? session.installedPackages
    : [];
  const subcommand = String(args[0] ?? '').trim().toLowerCase();
  const rest = args.slice(1);

  if (!subcommand || subcommand === 'help' || subcommand === '-h' || subcommand === '--help') {
    return { lines: t('lidc.storyline.terminal.commands.aptUsage') };
  }

  if (subcommand === 'update') {
    return { lines: t('lidc.storyline.terminal.commands.aptUpdate') };
  }

  if (subcommand === 'list' || subcommand === 'search') {
    return { lines: buildPackageListLines(rest.join(' '), installedIds) };
  }

  if (subcommand === 'install') {
    return installPackage(rest.join(' '), installedIds);
  }

  return {
    lines: tLines('lidc.storyline.terminal.commands.aptUnknown', { command: subcommand }),
  };
}

function packageMatchesQuery(pkg, query) {
  if (!query) return true;
  const haystack = [pkg.id, pkg.name, ...(pkg.aliases ?? [])]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function buildPackageListLines(rawQuery, installedIds) {
  const query = String(rawQuery ?? '').trim().toLowerCase();
  const matches = RATOS_PACKAGES.filter((pkg) => packageMatchesQuery(pkg, query));
  const header = t('lidc.storyline.terminal.commands.aptListHeader');
  const lines = [header];

  if (!matches.length) {
    lines.push(...tLines('lidc.storyline.terminal.commands.aptListEmpty', { query: rawQuery || '?' }));
    return lines;
  }

  matches.forEach((pkg) => {
    const installed = isRatosPackageInstalled(installedIds, pkg.id);
    const status = t(installed
      ? 'lidc.storyline.terminal.commands.aptStatusInstalled'
      : 'lidc.storyline.terminal.commands.aptStatusAvailable');
    const description = t(`lidc.storyline.terminal.packages.${pkg.descriptionKey}`);
    lines.push(`${pkg.id}/${status} ${pkg.version} [${pkg.size}]`);
    lines.push(`  ${pkg.name} — ${description}`);
  });

  lines.push(t('lidc.storyline.terminal.commands.aptListHint'));
  return lines;
}

function installPackage(rawName, installedIds) {
  const token = String(rawName ?? '').trim();
  if (!token) {
    return { lines: t('lidc.storyline.terminal.commands.aptInstallMissing') };
  }

  const pkg = findRatosPackage(token);
  if (!pkg) {
    return {
      lines: tLines('lidc.storyline.terminal.commands.aptInstallUnknown', { package: token }),
    };
  }

  if (isRatosPackageInstalled(installedIds, pkg.id)) {
    return {
      lines: tLines('lidc.storyline.terminal.commands.aptAlreadyInstalled', {
        package: pkg.id,
        version: pkg.version,
      }),
    };
  }

  return {
    installedPackages: [...installedIds, pkg.id],
    lines: tLines('lidc.storyline.terminal.commands.aptInstall', {
      package: pkg.id,
      name: pkg.name,
      version: pkg.version,
      size: pkg.size,
    }),
  };
}
