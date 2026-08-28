import { t } from '../utils/locale';

export const RATOS_OS_NAME = 'RatOS';

export {
  BIOS_SPLASH_DURATION_MS,
  buildBiosProgressBar,
  RATOS_BIOS_LOGO_ART,
  RATOS_BIOS_TITLE_ART,
} from './lidcStorylineTerminalBiosArt';

export const RATOS_ASCII_BANNER = [
  '    ____        __  ____  _____',
  '   / __ \\____ _/ /_/ __ \\/ ___/',
  '  / /_/ / __ `/ __/ / / /\\__ \\ ',
  ' / _, _/ /_/ / /_/ /_/ /___/ / ',
  '/_/ |_|\\__,_/\\__/\\____//____/  ',
  '                               ',
  '                               ',
  '',
  '              _..----.._    _',
  '            .\'  .--.    "-.(0)_',
  '\'-.__.-\'"\'=:|   ,  _)_ \\__ . c\\\'-..',
  '             \'\'\'------\'---\'\'---\'-"',
].join('\n');

export function getRatosBootLines() {
  return t('lidc.storyline.terminal.bootLines');
}

export function getRatosAsciiBanner() {
  return RATOS_ASCII_BANNER;
}

export { cwdToPrompt, runRatosCommand } from './lidcStorylineTerminalFs';
