import { t } from '../utils/locale';

export const RATOS_OS_NAME = 'RatOS';

export function getRatosBootLines() {
  return t('lidc.storyline.terminal.bootLines');
}

export function runRatosCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const [command, ...args] = trimmed.toLowerCase().split(/\s+/);
  const argText = args.join(' ');

  switch (command) {
    case 'help':
      return t('lidc.storyline.terminal.commands.help');
    case 'clear':
      return { clear: true };
    case 'whoami':
      return t('lidc.storyline.terminal.commands.whoami');
    case 'hostname':
      return [RATOS_OS_NAME.toLowerCase() + '-node-07'];
    case 'date':
      return [new Date().toUTCString()];
    case 'ls':
      return t('lidc.storyline.terminal.commands.ls');
    case 'cat':
      if (argText === 'readme.txt') {
        return t('lidc.storyline.terminal.commands.readme');
      }
      return [t('lidc.storyline.terminal.commands.catMissing', { file: argText || '???' })];
    case 'uname':
      return [t('lidc.storyline.terminal.commands.uname')];
    case 'exit':
    case 'quit':
      return { exit: true };
    default:
      return [t('lidc.storyline.terminal.commands.unknown', { command: trimmed.split(/\s+/)[0] })];
  }
}
