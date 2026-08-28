import {
  BIOS_SPLASH_DURATION_MS,
  cwdToPrompt,
  getRatosAsciiBanner,
  getRatosBootLines,
  runRatosCommand,
} from '../config/lidcStorylineTerminal';
import { t } from './locale';

function normalizeCommandResult(result) {
  if (!result) {
    return {
      lines: [], clear: false, exit: false, cwd: undefined, imageViewer: null, closeImageViewer: false,
    };
  }
  if (Array.isArray(result)) {
    return {
      lines: result, clear: false, exit: false, cwd: undefined, imageViewer: null, closeImageViewer: false,
    };
  }
  return {
    lines: result.lines ?? [],
    clear: Boolean(result.clear),
    exit: Boolean(result.exit),
    cwd: result.cwd,
    imageViewer: result.imageViewer ?? null,
    closeImageViewer: Boolean(result.closeImageViewer),
  };
}

const listeners = new Set();
const commandHistory = [];
let historyIndex = -1;
let draftInput = '';
let biosTimer = null;
let bootTimer = null;
let initialized = false;
let exitHandler = null;

let state = {
  lines: [],
  input: '',
  cwd: '/',
  imageViewer: null,
  bootComplete: false,
  bootPhase: 'idle',
  biosProgress: 0,
  version: 0,
};

function emit() {
  state = { ...state, version: state.version + 1 };
  listeners.forEach((listener) => listener(getRatosTerminalSnapshot()));
}

function patch(partial) {
  state = { ...state, ...partial };
  emit();
}

function appendLines(nextLines, variant = 'normal') {
  if (typeof nextLines === 'string') {
    if (!nextLines) return;
    patch({ lines: [...state.lines, { text: nextLines, variant }] });
    return;
  }
  if (!nextLines?.length) return;
  patch({
    lines: [
      ...state.lines,
      ...nextLines.map((text) => ({ text, variant })),
    ],
  });
}

function clearTimers() {
  if (biosTimer) {
    window.clearInterval(biosTimer);
    biosTimer = null;
  }
  if (bootTimer) {
    window.clearInterval(bootTimer);
    bootTimer = null;
  }
}

function startBiosPhase() {
  patch({ bootPhase: 'bios', biosProgress: 0 });
  const startedAt = Date.now();
  biosTimer = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(100, Math.floor((elapsed / BIOS_SPLASH_DURATION_MS) * 100));
    patch({ biosProgress: progress });
    if (elapsed >= BIOS_SPLASH_DURATION_MS) {
      window.clearInterval(biosTimer);
      biosTimer = null;
      startBootPhase();
    }
  }, 50);
}

function startBootPhase() {
  patch({ bootPhase: 'terminal', lines: [] });
  const bootLines = getRatosBootLines();
  let index = 0;

  bootTimer = window.setInterval(() => {
    if (index >= bootLines.length) {
      window.clearInterval(bootTimer);
      bootTimer = null;
      appendLines(getRatosAsciiBanner(), 'banner-block');
      appendLines([t('lidc.storyline.terminal.readyHint')], 'dim');
      patch({ bootComplete: true });
      return;
    }

    appendLines([bootLines[index]], index === 0 ? 'normal' : 'dim');
    index += 1;
  }, 120);
}

export function getRatosTerminalSnapshot() {
  return state;
}

export function subscribeRatosTerminal(listener) {
  listeners.add(listener);
  listener(getRatosTerminalSnapshot());
  return () => listeners.delete(listener);
}

export function initRatosTerminal() {
  if (initialized) return;
  initialized = true;
  startBiosPhase();
}

export function disposeRatosTerminal() {
  clearTimers();
  initialized = false;
  exitHandler = null;
  commandHistory.length = 0;
  historyIndex = -1;
  draftInput = '';
  state = {
    lines: [],
    input: '',
    cwd: '/',
    imageViewer: null,
    bootComplete: false,
    bootPhase: 'idle',
    biosProgress: 0,
    version: 0,
  };
  emit();
}

export function setRatosTerminalExitHandler(handler) {
  exitHandler = handler;
}

export function setRatosTerminalInput(value) {
  patch({ input: value });
  historyIndex = -1;
}

export function closeRatosImageViewer() {
  patch({ imageViewer: null });
}

export function navigateRatosHistory(direction, currentInput) {
  if (commandHistory.length === 0) return state.input;

  if (direction === 'up') {
    if (historyIndex === -1) {
      draftInput = currentInput;
      historyIndex = commandHistory.length - 1;
    } else if (historyIndex > 0) {
      historyIndex -= 1;
    }
    patch({ input: commandHistory[historyIndex] });
    return commandHistory[historyIndex];
  }

  if (historyIndex === -1) return state.input;

  if (historyIndex < commandHistory.length - 1) {
    historyIndex += 1;
    patch({ input: commandHistory[historyIndex] });
    return commandHistory[historyIndex];
  }

  historyIndex = -1;
  patch({ input: draftInput });
  return draftInput;
}

export function submitRatosCommand(rawValue) {
  const value = rawValue.trim();
  if (!value) return;

  if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== value) {
    commandHistory.push(value);
  }
  historyIndex = -1;
  draftInput = '';

  appendLines([`${cwdToPrompt(state.cwd)} ${value}`]);
  patch({ input: '' });

  const result = normalizeCommandResult(runRatosCommand(value, { cwd: state.cwd }));
  let nextCwd = state.cwd;
  if (result.cwd !== undefined) {
    nextCwd = result.cwd;
  }

  if (result.clear) {
    patch({ lines: [], cwd: nextCwd, imageViewer: null });
    return;
  }

  if (result.closeImageViewer) {
    patch({ cwd: nextCwd, imageViewer: null });
    return;
  }

  if (result.imageViewer) {
    patch({ cwd: nextCwd, imageViewer: result.imageViewer });
    return;
  }

  if (result.exit) {
    patch({ cwd: nextCwd });
    exitHandler?.();
    return;
  }

  patch({ cwd: nextCwd });
  appendLines(result.lines);
}
