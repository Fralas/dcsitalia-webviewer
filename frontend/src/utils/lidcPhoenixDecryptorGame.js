import { savePhoenixFrequencyTranscript } from '../config/lidcStorylineTerminalFs';
import {
  clampPhoenixFreq,
  formatPhoenixFreq,
  freqToRatio,
  getPhoenixFileBursts,
  PHOENIX_CIPHER_MS,
  PHOENIX_FILE_CATCHES,
  PHOENIX_FREQ_MAX,
  PHOENIX_FREQ_MIN,
  PHOENIX_GATE_MHZ,
  PHOENIX_INTERCEPTS,
  PHOENIX_LOCK_MS,
  PHOENIX_MAX_DROPS,
  PHOENIX_TARGET_CATCHES,
  ratioToFreq,
} from '../config/lidcStorylinePhoenixDecryptor';
import { t } from './locale';

const TUNER_STEP = 14;
const WATERFALL_HEIGHT = 240;

const DECRYPTED_STORAGE_KEY = 'lidc-storyline-phoenix-decrypted';

let session = null;
let lastTick = 0;
let logHandler = null;
let audio = null;

function loadDecryptedIds() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(DECRYPTED_STORAGE_KEY));
    if (!Array.isArray(raw)) return [];
    const valid = new Set(PHOENIX_INTERCEPTS.map((item) => item.id));
    return raw.filter((id) => valid.has(id));
  } catch {
    return [];
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
    tone(freq, duration = 0.08, gainValue = 0.05) {
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
    noise(duration = 0.1) {
      const ctx = ensure();
      if (!ctx) return;
      const length = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      const gain = ctx.createGain();
      gain.gain.value = 0.07;
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
    },
    dispose() {
      context?.close?.().catch(() => {});
      context = null;
    },
  };
}

function remainingBursts(game) {
  const bursts = game.liveBursts?.length
    ? game.liveBursts
    : getPhoenixFileBursts(game.targetIntercept);
  if (bursts.length) {
    return bursts.filter((burst) => !game.caught.includes(burst.id));
  }
  return PHOENIX_INTERCEPTS.filter((item) => !game.caught.includes(item.id));
}

function randomBurstDigits(length = 5) {
  let digits = '';
  while (digits.length < length) {
    digits += Math.floor(Math.random() * 10);
  }
  return digits;
}

function randomBandFreq(taken = [], minGap = 24) {
  const low = PHOENIX_FREQ_MIN + 10;
  const high = PHOENIX_FREQ_MAX - 10;
  let freq = low + Math.random() * (high - low);
  let guard = 0;
  while (taken.some((value) => Math.abs(value - freq) < minGap) && guard < 12) {
    freq = low + Math.random() * (high - low);
    guard += 1;
  }
  return clampPhoenixFreq(freq);
}

function createLiveBursts(file) {
  return getPhoenixFileBursts(file).map((burst) => ({
    ...burst,
    digits: randomBurstDigits(),
    freqMhz: null,
  }));
}

function createContact(now, kind, intercept, existing) {
  const freq = randomBandFreq(existing.map((contact) => contact.freq));
  const wander = 4.8 + Math.random() * 3.4;

  return {
    key: `${kind}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    intercept,
    freq,
    drift: (Math.random() * 2 - 1) * wander,
    born: now,
    ttl: 6200 + Math.random() * 4200,
    sigma: 5.1 + Math.random() * 1.6,
    peak: 0.58 + Math.random() * 0.22,
  };
}

function createSession() {
  const waterfall = document.createElement('canvas');
  waterfall.width = 512;
  waterfall.height = WATERFALL_HEIGHT;
  const wfCtx = waterfall.getContext('2d', { alpha: false });
  wfCtx.fillStyle = '#03140a';
  wfCtx.fillRect(0, 0, waterfall.width, waterfall.height);

  return {
    tuner: 241.02,
    contacts: [],
    holding: false,
    lockMs: 0,
    phase: 'menu',
    selectedIndex: 0,
    decryptedIds: loadDecryptedIds(),
    targetIntercept: null,
    liveBursts: [],
    targetCount: PHOENIX_FILE_CATCHES,
    menuRows: [],
    cipher: null,
    caught: [],
    catches: 0,
    drops: 0,
    spawnAt: performance.now() + 400,
    logged: false,
    waterfall,
    wfCtx,
    wfShift: document.createElement('canvas'),
  };
}

function returnToPhoenixMenu() {
  if (!session) return;
  session.phase = 'menu';
  session.contacts = [];
  session.holding = false;
  session.lockMs = 0;
  session.cipher = null;
  session.caught = [];
  session.catches = 0;
  session.drops = 0;
  session.logged = false;
  session.targetIntercept = null;
  session.liveBursts = [];
  session.spawnAt = performance.now() + 400;
}

function beginSelectedIntercept() {
  if (!session) return;
  const item = PHOENIX_INTERCEPTS[session.selectedIndex];
  if (!item) return;

  const liveBursts = createLiveBursts(item);
  session.tuner = (PHOENIX_FREQ_MIN + PHOENIX_FREQ_MAX) / 2;
  session.contacts = [];
  session.holding = false;
  session.lockMs = 0;
  session.phase = 'scan';
  session.cipher = null;
  session.caught = [];
  session.catches = 0;
  session.drops = 0;
  session.spawnAt = performance.now() + 180;
  session.logged = false;
  session.targetIntercept = item;
  session.liveBursts = liveBursts;
  session.targetCount = Math.max(PHOENIX_FILE_CATCHES, liveBursts.length);
}

function failDrop(game) {
  game.drops += 1;
  game.lockMs = 0;
  game.cipher = null;
  audio?.tone(120, 0.2, 0.08);
  game.phase = game.drops >= PHOENIX_MAX_DROPS ? 'fail' : 'scan';
}

function alignedContact(game) {
  let best = null;
  let bestDelta = PHOENIX_GATE_MHZ;
  game.contacts.forEach((contact) => {
    const delta = Math.abs(contact.freq - game.tuner);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = contact;
    }
  });
  return best;
}

function drawSpectrumRow(game, width) {
  const image = game.wfCtx.createImageData(width, 1);
  const { data } = image;

  for (let x = 0; x < width; x += 1) {
    const freq = ratioToFreq(x / Math.max(1, width - 1));
    let energy = 0.08 + Math.random() * 0.12;
    let voice = 0;
    game.contacts.forEach((contact) => {
      const delta = Math.abs(freq - contact.freq);
      const sigma = contact.sigma || 5.6;
      const peak = Math.exp(-(delta * delta) / (2 * sigma * sigma));
      energy += peak * (contact.peak || 0.68);
      if (contact.kind === 'voice') voice += peak * 0.18;
    });
    if (game.cipher) {
      const delta = Math.abs(freq - game.cipher.freq);
      energy += Math.exp(-(delta * delta) / 8) * 1.15;
      voice += 0.6;
    }
    const glow = Math.min(1, energy);
    const offset = x * 4;
    data[offset] = Math.floor(8 + glow * 40 + Math.min(1, voice) * 90);
    data[offset + 1] = Math.floor(28 + glow * 210);
    data[offset + 2] = Math.floor(18 + glow * 70);
    data[offset + 3] = 255;
  }

  game.wfCtx.putImageData(image, 0, 0);
}

function tickGame(now) {
  const game = session;
  if (!game) return;

  const dt = Math.min(0.05, (now - lastTick) / 1000 || 0.016);
  lastTick = now;

  if (game.phase === 'menu' || game.phase === 'win' || game.phase === 'fail') {
    return;
  }

  if (game.phase === 'scan') {
    if (now >= game.spawnAt) {
      const remaining = remainingBursts(game);
      const liveVoiceIds = new Set(
        game.contacts
          .filter((contact) => contact.kind === 'voice' && contact.intercept?.id)
          .map((contact) => contact.intercept.id),
      );
      const unspawned = remaining.filter((burst) => !liveVoiceIds.has(burst.id));
      const decoys = game.contacts.filter((contact) => contact.kind === 'decoy').length;
      const voices = game.contacts.filter((contact) => contact.kind === 'voice').length;
      const spawnVoice = unspawned.length && (decoys >= 2 || voices === 0 || Math.random() < 0.45);
      if (spawnVoice) {
        const next = unspawned[Math.floor(Math.random() * unspawned.length)];
        game.contacts.push(createContact(now, 'voice', next, game.contacts));
        audio?.noise(0.08);
        game.spawnAt = now + 420 + Math.random() * 380;
      } else if (decoys < 6) {
        game.contacts.push(createContact(now, 'decoy', null, game.contacts));
        game.spawnAt = now + 380 + Math.random() * 520;
      } else {
        game.spawnAt = now + 900 + Math.random() * 800;
      }
    }

    game.contacts = game.contacts.filter((contact) => {
      contact.freq = clampPhoenixFreq(contact.freq + contact.drift * dt);
      if (contact.freq <= PHOENIX_FREQ_MIN + 4 || contact.freq >= PHOENIX_FREQ_MAX - 4) {
        contact.drift *= -1;
      }
      return now - contact.born < contact.ttl;
    });

    const aligned = alignedContact(game);
    if (game.holding && aligned) {
      game.lockMs += dt * 1000;
      if (game.lockMs >= PHOENIX_LOCK_MS) {
        game.lockMs = 0;
        game.holding = false;
        if (aligned.kind === 'voice' && aligned.intercept) {
          game.phase = 'cipher';
          game.cipher = {
            ...aligned.intercept,
            freq: aligned.freq,
            startedAt: now,
            typed: '',
          };
          game.contacts = game.contacts.filter((contact) => contact.key !== aligned.key);
          audio?.tone(880, 0.12, 0.07);
        } else {
          game.contacts = game.contacts.filter((contact) => contact.key !== aligned.key);
          failDrop(game);
        }
      }
    } else {
      game.lockMs = Math.max(0, game.lockMs - dt * 1400);
    }
  }

  if (game.phase === 'cipher' && game.cipher) {
    if (game.cipher.failAt && now >= game.cipher.failAt) {
      failDrop(game);
    } else if (!game.cipher.failAt && now - game.cipher.startedAt >= PHOENIX_CIPHER_MS) {
      failDrop(game);
    }
  }

  const { waterfall, wfCtx, wfShift } = game;
  if (wfShift.width !== waterfall.width || wfShift.height !== waterfall.height) {
    wfShift.width = waterfall.width;
    wfShift.height = waterfall.height;
  }
  const shiftCtx = wfShift.getContext('2d');
  shiftCtx.drawImage(waterfall, 0, 0);
  wfCtx.drawImage(wfShift, 0, 1);
  drawSpectrumRow(game, waterfall.width);
}

export function setPhoenixSessionLogHandler(handler) {
  logHandler = handler;
}

export function startPhoenixDecryptorSession() {
  audio?.dispose();
  audio = createAudio();
  session = createSession();
  lastTick = performance.now();
}

export function stopPhoenixDecryptorSession() {
  audio?.dispose();
  audio = null;
  session = null;
}

export function isPhoenixDecryptorRunning() {
  return Boolean(session);
}

export function setPhoenixTunerRatio(ratio) {
  if (!session || (session.phase !== 'scan' && session.phase !== 'cipher')) return;
  session.tuner = clampPhoenixFreq(ratioToFreq(Math.min(1, Math.max(0, ratio))));
}

export function setPhoenixHolding(holding) {
  if (!session || session.phase !== 'scan') {
    if (session) session.holding = false;
    return;
  }
  session.holding = Boolean(holding);
}

export function restartPhoenixDecryptorSession() {
  if (!session) {
    startPhoenixDecryptorSession();
    return;
  }
  if (session.targetIntercept || session.phase === 'fail' || session.phase === 'win') {
    beginSelectedIntercept();
    lastTick = performance.now();
    return;
  }
  returnToPhoenixMenu();
}

export function handlePhoenixPointerMove(x, y, dragging) {
  if (!session) return;
  if (session.phase === 'menu') {
    const hit = session.menuRows.find((row) => y >= row.y0 && y < row.y1);
    if (hit) session.selectedIndex = hit.index;
    return;
  }
  if (dragging && session.phase === 'scan') {
    setPhoenixTunerRatio(x);
  }
}

export function handlePhoenixPointerDown(x, y) {
  if (!session) return;
  if (session.phase === 'menu') {
    const hit = session.menuRows.find((row) => y >= row.y0 && y < row.y1);
    if (hit) {
      session.selectedIndex = hit.index;
      beginSelectedIntercept();
    }
    return;
  }
  if (session.phase === 'scan') {
    setPhoenixTunerRatio(x);
    setPhoenixHolding(true);
  }
}

export function handlePhoenixKeyDown(event) {
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
      session.selectedIndex = Math.min(PHOENIX_INTERCEPTS.length - 1, session.selectedIndex + 1);
      return true;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      beginSelectedIntercept();
      return true;
    }
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (PHOENIX_INTERCEPTS[index]) {
        event.preventDefault();
        session.selectedIndex = index;
        beginSelectedIntercept();
        return true;
      }
    }
    return false;
  }

  if (session.phase === 'win' || session.phase === 'fail') {
    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      restartPhoenixDecryptorSession();
      return true;
    }
    if (
      event.key === 'm'
      || event.key === 'M'
      || event.key === 'Backspace'
      || (session.phase === 'win' && event.key === 'Enter')
    ) {
      event.preventDefault();
      returnToPhoenixMenu();
      return true;
    }
    if (session.phase === 'fail' && event.key === 'Enter') {
      event.preventDefault();
      restartPhoenixDecryptorSession();
      return true;
    }
    return false;
  }

  if (session.phase === 'scan') {
    if (event.key === 'm' || event.key === 'M' || event.key === 'Backspace') {
      event.preventDefault();
      returnToPhoenixMenu();
      return true;
    }
    if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
      event.preventDefault();
      session.tuner = clampPhoenixFreq(session.tuner - TUNER_STEP);
      return true;
    }
    if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      session.tuner = clampPhoenixFreq(session.tuner + TUNER_STEP);
      return true;
    }
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault();
      session.holding = true;
      return true;
    }
  }

  if (session.phase === 'cipher' && session.cipher && /^\d$/.test(event.key)) {
    event.preventDefault();
    if (session.cipher.failAt) return true;

    session.cipher.typed = `${session.cipher.typed}${event.key}`.slice(0, session.cipher.digits.length);
    audio?.tone(420 + Number(event.key) * 40, 0.06, 0.05);

    if (session.cipher.typed === session.cipher.digits) {
      const burst = session.cipher;
      session.caught.push(burst.id);
      session.catches = session.caught.length;
      const targetCount = session.targetCount || PHOENIX_TARGET_CATCHES;
      const file = session.targetIntercept;
      const burstLogs = burst.transcriptKey
        ? tLines(`lidc.storyline.terminal.phoenix.transcripts.${burst.transcriptKey}`)
        : [];
      const fileLines = savePhoenixFrequencyTranscript(file, session.caught);
      logHandler?.(burstLogs.length ? burstLogs : fileLines);
      session.cipher = null;
      audio?.tone(980, 0.16, 0.07);
      if (session.catches >= targetCount) {
        session.phase = 'win';
        const fileId = file?.id;
        if (fileId && !session.decryptedIds.includes(fileId)) {
          session.decryptedIds = [...session.decryptedIds, fileId];
          persistDecryptedIds(session.decryptedIds);
        }
        session.logged = true;
      } else {
        session.phase = 'scan';
      }
    } else if (session.cipher.typed.length === session.cipher.digits.length) {
      session.cipher.failAt = performance.now() + 750;
      audio?.tone(120, 0.2, 0.08);
    }
    return true;
  }

  return false;
}

export function handlePhoenixKeyUp(event) {
  if (!session) return;
  if (event.key === ' ' || event.code === 'Space') session.holding = false;
}

export function tickPhoenixDecryptor(now) {
  if (session) tickGame(now);
}

function wrapCanvasText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let current = '';

  words.forEach((word) => {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
      return;
    }
    current = next;
  });

  if (current) lines.push(current);
  return lines;
}

function drawAsciiProgress(ctx, x, y, ratio, size = 22) {
  const count = Math.max(1, Math.min(48, Math.floor(Number(size) || 22)));
  const filled = Math.max(0, Math.min(count, Math.round(Math.min(1, Math.max(0, Number(ratio) || 0)) * count)));
  ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = '#c4b48a';
  ctx.fillText('[', x, y);
  const bracket = ctx.measureText('[').width;
  const hashWidth = ctx.measureText('#').width || 7;
  ctx.fillStyle = '#ffe08a';
  ctx.fillText('#'.repeat(filled), x + bracket, y);
  ctx.fillStyle = '#6a6248';
  ctx.fillText('-'.repeat(count - filled), x + bracket + hashWidth * filled, y);
  ctx.fillStyle = '#c4b48a';
  ctx.fillText(']', x + bracket + hashWidth * count, y);
}

export function drawPhoenixDecryptor(ctx, canvas, timeMs) {
  if (!session) return;

  const game = session;
  const { width, height } = canvas;
  const padX = Math.round(width * 0.06);
  const padY = Math.round(height * 0.045);
  const maxTextWidth = width - padX * 2;
  const logHeight = Math.round(height * 0.34);

  ctx.fillStyle = '#010803';
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = 'top';
  ctx.font = '13px "IBM Plex Mono", "Courier New", monospace';
  ctx.shadowColor = 'rgba(103, 255, 136, 0.24)';
  ctx.shadowBlur = 1.5;

  ctx.fillStyle = '#ffe08a';
  ctx.fillText('PHOENIX DECRYPTOR v0.9.1', padX, padY);
  ctx.textAlign = 'right';
  ctx.fillText(
    game.phase === 'menu'
      ? t('lidc.storyline.terminal.phoenix.menuTitle')
      : t('lidc.storyline.terminal.phoenix.live'),
    width - padX,
    padY,
  );
  ctx.textAlign = 'left';

  const targetCount = game.targetCount || PHOENIX_TARGET_CATCHES;
  ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = 'rgba(168, 255, 191, 0.88)';

  const wfX = padX;
  const wfY = padY + 38;
  const wfW = maxTextWidth;
  const wfH = Math.min(Math.round(height * 0.38), height - wfY - logHeight - 18);

  if (game.phase === 'menu') {
    ctx.fillText(
      `${t('lidc.storyline.terminal.phoenix.menuDecrypted')} ${game.decryptedIds.length}/${PHOENIX_INTERCEPTS.length}`,
      padX,
      padY + 18,
    );
    ctx.fillStyle = '#ffe08a';
    ctx.textAlign = 'right';
    ctx.fillText('C:\\PHOENIX\\QUEUE', width - padX, padY + 18);
    ctx.textAlign = 'left';

    ctx.strokeStyle = 'rgba(77, 106, 64, 0.55)';
    ctx.strokeRect(wfX, wfY, wfW, wfH);

    const rowH = Math.floor(wfH / Math.max(3, PHOENIX_INTERCEPTS.length));
    game.menuRows = PHOENIX_INTERCEPTS.map((item, index) => {
      const rowY = wfY + index * rowH;
      const selected = index === game.selectedIndex;
      const decrypted = game.decryptedIds.includes(item.id);
      if (selected) {
        ctx.fillStyle = 'rgba(255, 196, 72, 0.16)';
        ctx.fillRect(wfX + 2, rowY + 2, wfW - 4, rowH - 4);
      }
      ctx.font = '13px "IBM Plex Mono", "Courier New", monospace';
      ctx.fillStyle = selected ? '#ffe08a' : '#c8f5d0';
      const marker = selected ? '>' : ' ';
      const status = decrypted
        ? t('lidc.storyline.terminal.phoenix.menuDecrypted')
        : t('lidc.storyline.terminal.phoenix.menuPending');
      ctx.fillText(`${marker} ${index + 1}  ${item.fileName}`, wfX + 10, rowY + 8);
      ctx.fillStyle = decrypted ? '#ffe08a' : 'rgba(168, 255, 191, 0.75)';
      ctx.textAlign = 'right';
      ctx.fillText(`${formatPhoenixFreq(item.freqMhz)}  ${status}`, wfX + wfW - 10, rowY + 8);
      ctx.textAlign = 'left';
      return { index, y0: rowY / height, y1: (rowY + rowH) / height };
    });

    const logY = wfY + wfH + 20;
    const logBoxH = height - padY - logY;
    ctx.strokeStyle = 'rgba(77, 106, 64, 0.45)';
    ctx.strokeRect(padX, logY, wfW, logBoxH);
    ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
    ctx.fillStyle = '#c8f5d0';
    let cursorY = logY + 8;
    wrapCanvasText(ctx, t('lidc.storyline.terminal.phoenix.menuHint'), maxTextWidth - 12).forEach((line) => {
      ctx.fillText(line, padX + 6, cursorY);
      cursorY += 15;
    });
    ctx.fillStyle = 'rgba(168, 255, 191, 0.82)';
    ctx.fillText(`${t('lidc.storyline.terminal.phoenix.exitHint')} [ESC]`, padX + 6, cursorY + 4);
    ctx.shadowBlur = 0;
    return;
  }

  game.menuRows = [];
  ctx.fillText(
    `${t('lidc.storyline.terminal.phoenix.catches')} ${game.catches}/${targetCount}  ${t('lidc.storyline.terminal.phoenix.drops')} ${game.drops}/${PHOENIX_MAX_DROPS}`,
    padX,
    padY + 18,
  );
  ctx.fillStyle = '#ffe08a';
  ctx.textAlign = 'right';
  ctx.fillText(formatPhoenixFreq(game.tuner), width - padX, padY + 18);
  ctx.textAlign = 'left';

  ctx.drawImage(game.waterfall, wfX, wfY, wfW, wfH);

  const tunerX = wfX + freqToRatio(game.tuner) * wfW;
  const gatePx = (PHOENIX_GATE_MHZ / (PHOENIX_FREQ_MAX - PHOENIX_FREQ_MIN)) * wfW;
  ctx.fillStyle = 'rgba(255, 196, 72, 0.1)';
  ctx.fillRect(tunerX - gatePx, wfY, gatePx * 2, wfH);
  ctx.strokeStyle = 'rgba(255, 210, 96, 0.95)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tunerX, wfY);
  ctx.lineTo(tunerX, wfY + wfH);
  ctx.stroke();

  ctx.fillStyle = 'rgba(127, 186, 140, 0.88)';
  ctx.font = '11px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillText(`${PHOENIX_FREQ_MIN}`, wfX, wfY + wfH + 5);
  ctx.textAlign = 'center';
  ctx.fillText('MHz', width / 2, wfY + wfH + 5);
  ctx.textAlign = 'right';
  ctx.fillText(`${PHOENIX_FREQ_MAX}`, wfX + wfW, wfY + wfH + 5);
  ctx.textAlign = 'left';

  const lockY = wfY + wfH + 20;
  drawAsciiProgress(ctx, padX, lockY, game.lockMs / PHOENIX_LOCK_MS, 28);

  const logY = lockY + 18;
  const logBoxH = height - padY - logY;
  ctx.strokeStyle = 'rgba(77, 106, 64, 0.45)';
  ctx.strokeRect(padX, logY, wfW, logBoxH);

  ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = '#c8f5d0';
  const aligned = alignedContact(game);
  let status = t('lidc.storyline.terminal.phoenix.scanIdle');
  if (game.phase === 'cipher') status = t('lidc.storyline.terminal.phoenix.locked');
  else if (game.phase === 'win') status = t('lidc.storyline.terminal.phoenix.winTitle');
  else if (game.phase === 'fail') status = t('lidc.storyline.terminal.phoenix.failTitle');
  else if (aligned) {
    status = t(aligned.kind === 'voice'
      ? 'lidc.storyline.terminal.phoenix.voiceContact'
      : 'lidc.storyline.terminal.phoenix.decoyContact');
  }

  let cursorY = logY + 8;
  wrapCanvasText(ctx, status, maxTextWidth - 12).forEach((line) => {
    ctx.fillText(line, padX + 6, cursorY);
    cursorY += 15;
  });

  if (game.phase === 'cipher' && game.cipher) {
    ctx.fillStyle = '#ffe08a';
    wrapCanvasText(ctx, t('lidc.storyline.terminal.phoenix.cipherHint'), maxTextWidth - 12).forEach((line) => {
      ctx.fillText(line, padX + 6, cursorY);
      cursorY += 15;
    });
    game.cipher.digits.split('').forEach((digit, index) => {
      const typedChar = game.cipher.typed[index];
      const x = padX + 6 + index * 30;
      const isTyped = typedChar !== undefined;
      const isWrong = isTyped && typedChar !== digit;
      ctx.strokeStyle = isWrong ? '#ff7b72' : isTyped ? '#ffe08a' : '#4d6a40';
      ctx.strokeRect(x, cursorY, 24, 28);
      ctx.fillStyle = isWrong ? '#ff7b72' : isTyped ? '#ffe08a' : '#8cff9d';
      ctx.font = '18px "IBM Plex Mono", "Courier New", monospace';
      ctx.fillText(isTyped ? typedChar : digit, x + 5, cursorY + 5);
    });
    ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
    const left = Math.max(0, 1 - (timeMs - game.cipher.startedAt) / PHOENIX_CIPHER_MS);
    drawAsciiProgress(ctx, padX + 6, cursorY + 34, left, 26);
    cursorY += 50;
  }

  if (game.phase === 'win' || game.phase === 'fail') {
    const body = t(game.phase === 'win'
      ? 'lidc.storyline.terminal.phoenix.winBody'
      : 'lidc.storyline.terminal.phoenix.failBody');
    const bodyLines = Array.isArray(body) ? body : [body];
    ctx.fillStyle = '#ffe08a';
    bodyLines.forEach((line) => {
      wrapCanvasText(ctx, line, maxTextWidth - 12).forEach((wrapped) => {
        ctx.fillText(wrapped, padX + 6, cursorY);
        cursorY += 15;
      });
    });
    ctx.fillStyle = 'rgba(168, 255, 191, 0.82)';
    ctx.fillText(
      `${t('lidc.storyline.terminal.phoenix.retry')} [R]   ${t('lidc.storyline.terminal.phoenix.menuBack')}   ${t('lidc.storyline.terminal.phoenix.back')} [ESC]`,
      padX + 6,
      cursorY + 4,
    );
  }

  ctx.shadowBlur = 0;
}
