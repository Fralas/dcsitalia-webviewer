import {
  clampPhoenixFreq,
  formatPhoenixFreq,
  freqToRatio,
  PHOENIX_CIPHER_MS,
  PHOENIX_FREQ_MAX,
  PHOENIX_FREQ_MIN,
  PHOENIX_GATE_MHZ,
  PHOENIX_INTERCEPTS,
  PHOENIX_LOCK_MS,
  PHOENIX_MAX_DROPS,
  PHOENIX_TARGET_CATCHES,
  ratioToFreq,
} from '../config/lidcStorylinePhoenixDecryptor';
import { savePhoenixDecryptorTranscript } from '../config/lidcStorylineTerminalFs';
import { t } from './locale';

const TUNER_STEP = 14;
const WATERFALL_HEIGHT = 240;

let session = null;
let lastTick = 0;
let logHandler = null;
let audio = null;

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

function createContact(now, kind, intercept, existing) {
  const taken = existing.map((contact) => contact.freq);
  let freq = intercept?.freqMhz ?? (PHOENIX_FREQ_MIN + 40 + Math.random() * 340);
  let guard = 0;
  while (taken.some((value) => Math.abs(value - freq) < 28) && guard < 8) {
    freq = PHOENIX_FREQ_MIN + 40 + Math.random() * 340;
    guard += 1;
  }

  return {
    key: `${kind}-${now}-${Math.random().toString(36).slice(2, 7)}`,
    kind,
    intercept,
    freq: clampPhoenixFreq(freq),
    drift: (Math.random() * 2 - 1) * (kind === 'voice' ? 3.2 : 7.5),
    born: now,
    ttl: kind === 'voice' ? 9200 + Math.random() * 1800 : 5200 + Math.random() * 2400,
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
    phase: 'scan',
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

function failDrop(game) {
  game.drops += 1;
  game.lockMs = 0;
  game.cipher = null;
  audio?.tone(120, 0.2, 0.08);
  game.phase = game.drops >= PHOENIX_MAX_DROPS ? 'fail' : 'scan';
}

function alignedContact(game) {
  return game.contacts.find(
    (contact) => Math.abs(contact.freq - game.tuner) <= PHOENIX_GATE_MHZ,
  );
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
      const sigma = contact.kind === 'voice' ? 4.2 : 6.4;
      const peak = Math.exp(-(delta * delta) / (2 * sigma * sigma));
      energy += peak * (contact.kind === 'voice' ? 0.92 : 0.55);
      if (contact.kind === 'voice') voice += peak;
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

  if (game.phase === 'scan') {
    if (now >= game.spawnAt) {
      const remaining = PHOENIX_INTERCEPTS.filter((item) => !game.caught.includes(item.id));
      const hasVoice = game.contacts.some((contact) => contact.kind === 'voice');
      if (!hasVoice && remaining.length) {
        const next = remaining[Math.floor(Math.random() * remaining.length)];
        game.contacts.push(createContact(now, 'voice', next, game.contacts));
        audio?.noise(0.09);
      } else if (game.contacts.length < 4) {
        game.contacts.push(createContact(now, 'decoy', null, game.contacts));
      }
      game.spawnAt = now + 1600 + Math.random() * 1400;
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

  if (game.phase === 'cipher' && game.cipher && now - game.cipher.startedAt >= PHOENIX_CIPHER_MS) {
    failDrop(game);
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
  if (!session || session.phase === 'win' || session.phase === 'fail') return;
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
  const tuner = session.tuner;
  session = createSession();
  session.tuner = tuner;
  lastTick = performance.now();
}

export function handlePhoenixKeyDown(event) {
  if (!session) return false;

  if (event.key === 'Escape') return false;

  if (session.phase === 'win' || session.phase === 'fail') {
    if (event.key === 'r' || event.key === 'R' || event.key === 'Enter') {
      event.preventDefault();
      restartPhoenixDecryptorSession();
      return true;
    }
    return false;
  }

  if (session.phase === 'scan') {
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
    session.cipher.typed = `${session.cipher.typed}${event.key}`.slice(0, session.cipher.digits.length);
    audio?.tone(420 + Number(event.key) * 40, 0.06, 0.05);

    if (session.cipher.typed === session.cipher.digits) {
      session.caught.push(session.cipher.id);
      session.catches = session.caught.length;
      session.cipher = null;
      audio?.tone(980, 0.16, 0.07);
      if (session.catches >= PHOENIX_TARGET_CATCHES) {
        session.phase = 'win';
        if (!session.logged) {
          session.logged = true;
          const logs = session.caught.flatMap((id) => {
            const item = PHOENIX_INTERCEPTS.find((entry) => entry.id === id);
            return item ? tLines(`lidc.storyline.terminal.phoenix.transcripts.${item.transcriptKey}`) : [];
          });
          const savedNote = t('lidc.storyline.terminal.phoenix.winBody');
          const savedLines = Array.isArray(savedNote) ? savedNote : [savedNote];
          savePhoenixDecryptorTranscript([
            t('lidc.storyline.terminal.phoenix.logHeader'),
            ...logs,
          ]);
          logHandler?.([t('lidc.storyline.terminal.phoenix.logHeader'), ...logs, ...savedLines.slice(1)]);
        }
      } else {
        session.phase = 'scan';
      }
    } else if (session.cipher.typed.length === session.cipher.digits.length) {
      failDrop(session);
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
  ctx.fillText(t('lidc.storyline.terminal.phoenix.live'), width - padX, padY);
  ctx.textAlign = 'left';

  ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
  ctx.fillStyle = 'rgba(168, 255, 191, 0.88)';
  ctx.fillText(
    `${t('lidc.storyline.terminal.phoenix.catches')} ${game.catches}/${PHOENIX_TARGET_CATCHES}  ${t('lidc.storyline.terminal.phoenix.drops')} ${game.drops}/${PHOENIX_MAX_DROPS}`,
    padX,
    padY + 18,
  );
  ctx.fillStyle = '#ffe08a';
  ctx.textAlign = 'right';
  ctx.fillText(formatPhoenixFreq(game.tuner), width - padX, padY + 18);
  ctx.textAlign = 'left';

  const wfX = padX;
  const wfY = padY + 38;
  const wfW = maxTextWidth;
  const wfH = Math.min(Math.round(height * 0.38), height - wfY - logHeight - 18);
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
  ctx.fillStyle = '#0a160d';
  ctx.fillRect(padX, lockY, wfW, 6);
  ctx.strokeStyle = '#35553a';
  ctx.strokeRect(padX, lockY, wfW, 6);
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(padX, lockY, wfW * Math.min(1, game.lockMs / PHOENIX_LOCK_MS), 6);

  const logY = lockY + 14;
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
      const x = padX + 6 + index * 30;
      ctx.strokeStyle = index < game.cipher.typed.length ? '#ffe08a' : '#4d6a40';
      ctx.strokeRect(x, cursorY, 24, 28);
      ctx.fillStyle = index < game.cipher.typed.length ? '#ffe08a' : '#8cff9d';
      ctx.font = '18px "IBM Plex Mono", "Courier New", monospace';
      ctx.fillText(digit, x + 5, cursorY + 5);
    });
    ctx.font = '12px "IBM Plex Mono", "Courier New", monospace';
    const left = Math.max(0, 1 - (timeMs - game.cipher.startedAt) / PHOENIX_CIPHER_MS);
    ctx.fillStyle = '#1a2b1e';
    ctx.fillRect(padX + 6, cursorY + 34, wfW - 12, 4);
    ctx.fillStyle = '#ff7b72';
    ctx.fillRect(padX + 6, cursorY + 34, (wfW - 12) * left, 4);
    cursorY += 44;
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
    ctx.fillText(`${t('lidc.storyline.terminal.phoenix.retry')} [R]   ${t('lidc.storyline.terminal.phoenix.back')} [ESC]`, padX + 6, cursorY + 4);
  }

  ctx.shadowBlur = 0;
}
