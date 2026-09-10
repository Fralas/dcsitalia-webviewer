import {
  extractWinRatArchive,
  getWinRatExtractFolder,
} from '../config/lidcStorylineTerminalFs';
import {
  formatWinRatTarget,
  getWinRatArchiveKinds,
  getWinRatKindFolder,
  WINRAT_ARCHIVES,
  WINRAT_GRID_COLS,
  WINRAT_GRID_ROWS,
  WINRAT_MAX_MISSES,
  WINRAT_SHUFFLE_MS,
  WINRAT_TIME_LIMIT_MS,
  WINRAT_WINDOW,
} from '../config/lidcStorylineWinRat';
import { t } from './locale';

const TOTAL_CELLS = WINRAT_GRID_COLS * WINRAT_GRID_ROWS;
const DECRYPTED_STORAGE_KEY = 'lidc-storyline-winrat-decrypted';

let session = null;
let lastTick = 0;
let logHandler = null;
let audio = null;

function loadDecryptedIds() {
  const fromFs = WINRAT_ARCHIVES
    .filter((item) => getWinRatExtractFolder(item.id))
    .map((item) => item.id);
  try {
    const raw = JSON.parse(window.localStorage.getItem(DECRYPTED_STORAGE_KEY));
    const valid = new Set(WINRAT_ARCHIVES.map((item) => item.id));
    const fromStorage = Array.isArray(raw) ? raw.filter((id) => valid.has(id)) : [];
    return [...new Set([...fromStorage, ...fromFs])];
  } catch {
    return fromFs;
  }
}

function persistDecryptedIds(ids) {
  try {
    window.localStorage.setItem(DECRYPTED_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / private mode */
  }
}

function tLines(path) {
  const value = t(path);
  return (Array.isArray(value) ? value : [value]).map((line) => String(line));
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function wrapIndex(index) {
  return ((index % TOTAL_CELLS) + TOTAL_CELLS) % TOTAL_CELLS;
}

function windowIndices(start) {
  return Array.from({ length: WINRAT_WINDOW }, (_, offset) => wrapIndex(start + offset));
}

function valuesUnderCursor(game) {
  return windowIndices(game.cursor).map((index) => game.cells[index]);
}

function sequencesMatch(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function createAudio() {
  let context = null;
  const ensure = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  };

  return {
    tone(freq, duration = 0.06, gainValue = 0.045) {
      const ctx = ensure();
      if (!ctx) return;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(gainValue, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + duration);
    },
    dispose() {
      context?.close?.().catch(() => {});
      context = null;
    },
  };
}

function randomCells() {
  return Array.from({ length: TOTAL_CELLS }, () => pad2(Math.floor(Math.random() * 100)));
}

function plantTarget(cells, target, avoidStart = null) {
  let start = Math.floor(Math.random() * TOTAL_CELLS);
  let guard = 0;
  while (avoidStart !== null && start === avoidStart && guard < 16) {
    start = Math.floor(Math.random() * TOTAL_CELLS);
    guard += 1;
  }
  windowIndices(start).forEach((index, offset) => {
    cells[index] = target[offset];
  });
  return start;
}

function scrambleCells(target, avoidStart = null) {
  const cells = randomCells();
  plantTarget(cells, target, avoidStart);
  return cells;
}

function randomBoard() {
  const cells = randomCells();
  const targetStart = Math.floor(Math.random() * TOTAL_CELLS);
  const target = windowIndices(targetStart).map((index) => cells[index]);
  let cursor = wrapIndex(targetStart + 23 + Math.floor(Math.random() * 31));
  let guard = 0;
  while (sequencesMatch(windowIndices(cursor).map((index) => cells[index]), target) && guard < 40) {
    cursor = wrapIndex(cursor + 7);
    guard += 1;
  }
  return { cells, target, cursor };
}

function createSession() {
  return {
    phase: 'menu',
    selectedIndex: 0,
    decryptedIds: loadDecryptedIds(),
    targetArchive: null,
    extractFolder: null,
    cells: [],
    target: [],
    cursor: 0,
    shuffleAcc: 0,
    misses: 0,
    failReason: null,
    startedAt: 0,
    elapsedMs: 0,
    logged: false,
    menuRows: [],
    gridLayout: null,
  };
}

function returnToWinRatMenu() {
  if (!session) return;
  session.phase = 'menu';
  session.targetArchive = null;
  session.extractFolder = null;
  session.cells = [];
  session.target = [];
  session.cursor = 0;
  session.shuffleAcc = 0;
  session.misses = 0;
  session.failReason = null;
  session.startedAt = 0;
  session.elapsedMs = 0;
  session.logged = false;
  session.gridLayout = null;
}

function beginSelectedArchive() {
  if (!session) return;
  const archive = WINRAT_ARCHIVES[session.selectedIndex];
  if (!archive) return;
  const board = randomBoard();
  session.phase = 'hack';
  session.targetArchive = archive;
  session.extractFolder = getWinRatExtractFolder(archive.id);
  session.cells = board.cells;
  session.target = board.target;
  session.cursor = board.cursor;
  session.shuffleAcc = 0;
  session.misses = 0;
  session.failReason = null;
  session.startedAt = performance.now();
  session.elapsedMs = 0;
  session.logged = false;
  audio?.tone(520, 0.08, 0.04);
}

function completeHack() {
  if (!session || !session.targetArchive) return;
  const archive = session.targetArchive;
  const folder = extractWinRatArchive(archive.id);
  if (folder && !session.decryptedIds.includes(archive.id)) {
    session.decryptedIds = [...session.decryptedIds, archive.id];
    persistDecryptedIds(session.decryptedIds);
  }
  session.extractFolder = folder;
  session.phase = 'win';
  if (!session.logged) {
    session.logged = true;
    const kinds = getWinRatArchiveKinds(archive)
      .map((kind) => getWinRatKindFolder(kind))
      .join(', ');
    logHandler?.([
      ...tLines('lidc.storyline.terminal.winrat.logExtracted').map((line) => line
        .replaceAll('{{file}}', archive.fileName)
        .replaceAll('{{path}}', `C:\\WINRAT\\${folder}\\`)
        .replaceAll('{{kinds}}', kinds)),
    ]);
  }
  audio?.tone(880, 0.12, 0.05);
  audio?.tone(1240, 0.18, 0.04);
}

function failHack(reason = 'timeout') {
  if (!session || session.phase !== 'hack') return;
  session.failReason = reason;
  session.phase = 'fail';
  audio?.tone(140, 0.22, 0.06);
}

function tryConfirmSelection() {
  if (!session || session.phase !== 'hack') return;
  if (sequencesMatch(valuesUnderCursor(session), session.target)) {
    completeHack();
    return;
  }
  session.misses += 1;
  audio?.tone(180, 0.08, 0.05);
  if (session.misses >= WINRAT_MAX_MISSES) {
    failHack('misses');
  }
}

function moveCursor(delta) {
  if (!session || session.phase !== 'hack') return;
  session.cursor = wrapIndex(session.cursor + delta);
  audio?.tone(410, 0.03, 0.025);
}

export function setWinRatSessionLogHandler(handler) {
  logHandler = handler;
}

export function startWinRatSession() {
  stopWinRatSession();
  audio = createAudio();
  session = createSession();
  lastTick = performance.now();
}

export function stopWinRatSession() {
  audio?.dispose();
  audio = null;
  session = null;
}

export function isWinRatRunning() {
  return Boolean(session);
}

export function restartWinRatSession() {
  if (!session) {
    startWinRatSession();
    return;
  }
  if (session.targetArchive || session.phase === 'fail' || session.phase === 'win') {
    beginSelectedArchive();
    lastTick = performance.now();
    return;
  }
  returnToWinRatMenu();
}

export function handleWinRatPointerMove(x, y) {
  if (!session) return;
  if (session.phase === 'menu') {
    const hit = session.menuRows.find((row) => y >= row.y0 && y < row.y1);
    if (hit) session.selectedIndex = hit.index;
  }
}

export function handleWinRatPointerDown(x, y) {
  if (!session) return;
  if (session.phase === 'menu') {
    const hit = session.menuRows.find((row) => y >= row.y0 && y < row.y1);
    if (hit) {
      session.selectedIndex = hit.index;
      beginSelectedArchive();
    }
    return;
  }
  if (session.phase !== 'hack' || !session.gridLayout) return;
  const layout = session.gridLayout;
  if (x < layout.x0 || x > layout.x1 || y < layout.y0 || y > layout.y1) return;
  const col = Math.min(
    WINRAT_GRID_COLS - 1,
    Math.max(0, Math.floor(((x - layout.x0) / (layout.x1 - layout.x0)) * WINRAT_GRID_COLS)),
  );
  const row = Math.min(
    WINRAT_GRID_ROWS - 1,
    Math.max(0, Math.floor(((y - layout.y0) / (layout.y1 - layout.y0)) * WINRAT_GRID_ROWS)),
  );
  session.cursor = row * WINRAT_GRID_COLS + col;
  audio?.tone(410, 0.03, 0.025);
}

export function handleWinRatKeyDown(event) {
  if (!session) return false;
  if (event.key === 'Escape') return false;

  if (session.phase === 'menu') {
    if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      session.selectedIndex = Math.max(0, session.selectedIndex - 1);
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
      event.preventDefault();
      session.selectedIndex = Math.min(WINRAT_ARCHIVES.length - 1, session.selectedIndex + 1);
      return true;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      beginSelectedArchive();
      return true;
    }
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (WINRAT_ARCHIVES[index]) {
        event.preventDefault();
        session.selectedIndex = index;
        beginSelectedArchive();
        return true;
      }
    }
    return false;
  }

  if (session.phase === 'win' || session.phase === 'fail') {
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      restartWinRatSession();
      return true;
    }
    if (
      event.key === 'm'
      || event.key === 'M'
      || event.key === 'Backspace'
      || (session.phase === 'win' && event.key === 'Enter')
    ) {
      event.preventDefault();
      returnToWinRatMenu();
      return true;
    }
    if (session.phase === 'fail' && event.key === 'Enter') {
      event.preventDefault();
      restartWinRatSession();
      return true;
    }
    return false;
  }

  if (session.phase === 'hack') {
    if (event.key === 'm' || event.key === 'M' || event.key === 'Backspace') {
      event.preventDefault();
      returnToWinRatMenu();
      return true;
    }
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      moveCursor(-1);
      return true;
    }
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      moveCursor(1);
      return true;
    }
    if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      moveCursor(-WINRAT_GRID_COLS);
      return true;
    }
    if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
      event.preventDefault();
      moveCursor(WINRAT_GRID_COLS);
      return true;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      tryConfirmSelection();
      return true;
    }
  }

  return false;
}

export function tickWinRat(now) {
  if (!session) return;
  const dt = Math.min(0.05, Math.max(0, (now - lastTick) / 1000));
  lastTick = now;
  if (session.phase !== 'hack') return;
  session.elapsedMs += dt * 1000;
  session.shuffleAcc += dt * 1000;
  if (session.shuffleAcc >= WINRAT_SHUFFLE_MS) {
    session.shuffleAcc = 0;
    session.cells = scrambleCells(session.target, session.cursor);
    audio?.tone(260, 0.02, 0.018);
  }
  if (session.elapsedMs >= WINRAT_TIME_LIMIT_MS) {
    failHack('timeout');
  }
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  });
  if (current) lines.push(current);
  return lines;
}

function formatTimer(ms) {
  const clamped = Math.max(0, ms);
  const minutes = Math.floor(clamped / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = Math.floor(clamped % 1000);
  return `${pad2(minutes)}:${pad2(seconds)}:${String(millis).padStart(3, '0')}`;
}

function drawSignalBars(ctx, x, y) {
  for (let i = 0; i < 5; i += 1) {
    const barH = 4 + i * 3;
    ctx.fillStyle = '#3ee7ff';
    ctx.fillRect(x + i * 5, y + 16 - barH, 3, barH);
  }
}

function drawWindowChrome(ctx, width, height) {
  ctx.fillStyle = '#020205';
  ctx.fillRect(0, 0, width, height);

  const inset = 8;
  const winX = inset;
  const winY = inset;
  const winW = width - inset * 2;
  const winH = height - inset * 2;

  ctx.fillStyle = '#07070c';
  ctx.fillRect(winX, winY, winW, winH);
  ctx.strokeStyle = '#1f7dff';
  ctx.lineWidth = 2;
  ctx.strokeRect(winX + 0.5, winY + 0.5, winW - 1, winH - 1);

  ctx.fillStyle = '#1a5cff';
  ctx.fillRect(winX, winY, winW, 34);

  ctx.beginPath();
  ctx.arc(winX + 16, winY + 17, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#0b1b3a';
  ctx.fill();
  ctx.strokeStyle = '#d8f4ff';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#f4fbff';
  ctx.fillRect(winX + 13, winY + 14, 6, 7);
  ctx.beginPath();
  ctx.arc(winX + 16, winY + 14, 2.2, Math.PI, 0);
  ctx.strokeStyle = '#f4fbff';
  ctx.stroke();

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = '11px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = '#f4fbff';
  ctx.fillText(t('lidc.storyline.terminal.winrat.hostTitle'), winX + 30, winY + 6);
  ctx.font = '8px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = 'rgba(220, 240, 255, 0.78)';
  ctx.fillText(t('lidc.storyline.terminal.winrat.hostTagline'), winX + 30, winY + 20);

  drawSignalBars(ctx, winX + winW - 36, winY + 8);

  return { winX, winY, winW, winH, bodyY: winY + 34 };
}

export function drawWinRat(ctx, canvas, timeMs) {
  if (!session) return;

  const { width, height } = canvas;
  const chrome = drawWindowChrome(ctx, width, height);
  const padX = chrome.winX + 10;
  const bodyW = chrome.winW - 20;
  const game = session;

  if (game.phase === 'menu') {
    ctx.font = '11px "IBM Plex Mono", "Courier New", monospace';
    ctx.fillStyle = '#3ee7ff';
    ctx.textAlign = 'left';
    ctx.fillText(
      `${t('lidc.storyline.terminal.winrat.menuOpen')} ${game.decryptedIds.length}/${WINRAT_ARCHIVES.length}`,
      padX,
      chrome.bodyY + 8,
    );
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff4d4d';
    ctx.fillText('C:\\WINRAT\\QUEUE', chrome.winX + chrome.winW - 10, chrome.bodyY + 8);
    ctx.textAlign = 'left';

    const listY = chrome.bodyY + 26;
    const listH = Math.max(80, chrome.winH - 92);
    ctx.strokeStyle = 'rgba(31, 125, 255, 0.55)';
    ctx.strokeRect(padX, listY, bodyW, listH);

    const rowH = Math.floor(listH / Math.max(3, WINRAT_ARCHIVES.length));
    game.menuRows = WINRAT_ARCHIVES.map((item, index) => {
      const rowY = listY + index * rowH;
      const selected = index === game.selectedIndex;
      const opened = game.decryptedIds.includes(item.id);
      if (selected) {
        ctx.fillStyle = 'rgba(255, 48, 48, 0.18)';
        ctx.fillRect(padX + 2, rowY + 2, bodyW - 4, rowH - 4);
      }
      ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
      ctx.fillStyle = selected ? '#ff5a5a' : '#e8f6ff';
      const marker = selected ? '>' : ' ';
      ctx.fillText(`${marker} ${index + 1}  ${item.fileName}`, padX + 8, rowY + 8);
      ctx.font = '10px "IBM Plex Mono", "Courier New", monospace';
      ctx.fillStyle = opened ? '#ffe08a' : '#3ee7ff';
      ctx.textAlign = 'right';
      const status = opened
        ? t('lidc.storyline.terminal.winrat.menuOpen')
        : t('lidc.storyline.terminal.winrat.menuLocked');
      ctx.fillText(`${item.sizeLabel}  ${status}`, padX + bodyW - 8, rowY + 10);
      ctx.textAlign = 'left';
      return { index, y0: rowY / height, y1: (rowY + rowH) / height };
    });

    ctx.font = '10px "IBM Plex Mono", "Courier New", monospace';
    ctx.fillStyle = '#c8e8ff';
    ctx.fillText(t('lidc.storyline.terminal.winrat.menuHint'), padX, listY + listH + 8);
    ctx.fillStyle = 'rgba(62, 231, 255, 0.85)';
    ctx.fillText(`${t('lidc.storyline.terminal.winrat.exitHint')} [ESC]`, padX, listY + listH + 22);
    return;
  }

  game.menuRows = [];
  ctx.textAlign = 'center';
  ctx.font = '22px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = '#ff2d2d';
  ctx.fillText(formatWinRatTarget(game.target), width / 2, chrome.bodyY + 10);

  ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
  const remaining = Math.max(0, WINRAT_TIME_LIMIT_MS - game.elapsedMs);
  ctx.textAlign = 'left';
  ctx.fillStyle = game.misses > 0 ? '#ff5a5a' : '#3ee7ff';
  ctx.fillText(
    `${t('lidc.storyline.terminal.winrat.misses')} ${game.misses}/${WINRAT_MAX_MISSES}`,
    padX,
    chrome.bodyY + 34,
  );
  ctx.textAlign = 'center';
  ctx.fillStyle = remaining <= 5000 ? '#ff2d2d' : '#3cff6a';
  ctx.fillText(formatTimer(remaining), width / 2, chrome.bodyY + 34);

  const gridTop = chrome.bodyY + 54;
  const gridBottomPad = 36;
  const gridH = chrome.winY + chrome.winH - gridTop - gridBottomPad;
  const gridW = bodyW;
  const cellW = gridW / WINRAT_GRID_COLS;
  const cellH = gridH / WINRAT_GRID_ROWS;
  const gridX = padX;
  const gridY = gridTop;

  game.gridLayout = {
    x0: gridX / width,
    x1: (gridX + gridW) / width,
    y0: gridY / height,
    y1: (gridY + gridH) / height,
  };

  const selected = new Set(windowIndices(game.cursor));
  ctx.font = '11px "IBM Plex Mono", "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < TOTAL_CELLS; i += 1) {
    const col = i % WINRAT_GRID_COLS;
    const row = Math.floor(i / WINRAT_GRID_COLS);
    const x = gridX + col * cellW;
    const y = gridY + row * cellH;
    if (selected.has(i)) {
      ctx.fillStyle = 'rgba(255, 40, 40, 0.16)';
      ctx.fillRect(x + 1, y + 1, cellW - 2, cellH - 2);
      ctx.strokeStyle = '#ff2a2a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);
    }
    ctx.fillStyle = selected.has(i) ? '#ffd0d0' : '#f3f6ff';
    ctx.fillText(game.cells[i], x + cellW / 2, y + cellH / 2);
  }

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = '9px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = '#d9ecff';
  ctx.fillText(t('lidc.storyline.terminal.winrat.hackHint'), padX, gridY + gridH + 6);

  if (game.phase === 'win' || game.phase === 'fail') {
    const overlayY = gridY + 18;
    const overlayH = Math.min(110, gridH - 24);
    ctx.fillStyle = 'rgba(4, 6, 12, 0.82)';
    ctx.fillRect(gridX + 8, overlayY, gridW - 16, overlayH);
    ctx.strokeStyle = game.phase === 'win' ? '#3cff6a' : '#ff2d2d';
    ctx.strokeRect(gridX + 8.5, overlayY + 0.5, gridW - 17, overlayH - 1);

    ctx.font = '13px "IBM Plex Mono", "Courier New", monospace';
    ctx.fillStyle = game.phase === 'win' ? '#3cff6a' : '#ff5a5a';
    ctx.fillText(
      t(game.phase === 'win'
        ? 'lidc.storyline.terminal.winrat.winTitle'
        : 'lidc.storyline.terminal.winrat.failTitle'),
      gridX + 16,
      overlayY + 8,
    );

    ctx.font = '10px "IBM Plex Mono", "Courier New", monospace';
    ctx.fillStyle = '#e8f6ff';
    let cursorY = overlayY + 26;
    const failKey = game.failReason === 'misses'
      ? 'lidc.storyline.terminal.winrat.failMisses'
      : 'lidc.storyline.terminal.winrat.failBody';
    const body = t(game.phase === 'win'
      ? 'lidc.storyline.terminal.winrat.winBody'
      : failKey);
    const bodyLines = Array.isArray(body) ? body : [body];
    const folder = game.extractFolder || 'DECRYPT_?';
    bodyLines.forEach((line) => {
      const resolved = String(line)
        .replaceAll('{{path}}', `C:\\WINRAT\\${folder}\\`)
        .replaceAll('{{file}}', game.targetArchive?.fileName ?? '');
      wrapCanvasText(ctx, resolved, gridW - 36).forEach((wrapped) => {
        ctx.fillText(wrapped, gridX + 16, cursorY);
        cursorY += 12;
      });
    });
    ctx.fillStyle = 'rgba(62, 231, 255, 0.9)';
    ctx.fillText(
      `${t('lidc.storyline.terminal.winrat.retry')} [R]   ${t('lidc.storyline.terminal.winrat.menuBack')}   ${t('lidc.storyline.terminal.winrat.back')} [ESC]`,
      gridX + 16,
      overlayY + overlayH - 16,
    );
  }

  void timeMs;
}
