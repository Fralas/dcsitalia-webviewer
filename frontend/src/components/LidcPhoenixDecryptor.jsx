import { useEffect, useRef, useState } from 'react';
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
import { t } from '../utils/locale';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcPhoenixDecryptor.css';

const TUNER_STEP = 18;

function tLines(path, params = {}) {
  const value = t(path);
  const lines = Array.isArray(value) ? value : [value];
  const keys = Object.keys(params);
  return lines.map((line) => {
    if (typeof line !== 'string' || !keys.length) return String(line);
    return keys.reduce(
      (acc, key) => acc.replaceAll(`{{${key}}}`, String(params[key])),
      line,
    );
  });
}

function createPhoenixAudio() {
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
      const audio = ensure();
      if (!audio) return;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'square';
      oscillator.frequency.value = freq;
      gain.gain.setValueAtTime(gainValue, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + duration);
    },
    noise(duration = 0.12) {
      const audio = ensure();
      if (!audio) return;
      const length = Math.floor(audio.sampleRate * duration);
      const buffer = audio.createBuffer(1, length, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (length * 0.35));
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const filter = audio.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      const gain = audio.createGain();
      gain.gain.value = 0.08;
      source.connect(filter).connect(gain).connect(audio.destination);
      source.start();
    },
    dispose() {
      context?.close?.().catch(() => {});
      context = null;
    },
  };
}

function createContact(now, kind, intercept = null, existing = []) {
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

function initialHud() {
  return {
    phase: 'scan',
    freq: 241.02,
    lock: 0,
    catches: 0,
    drops: 0,
    contactLabel: '',
    digits: '',
    typed: '',
    cipherLeft: 1,
    outcome: null,
  };
}

export default function LidcPhoenixDecryptor({ onClose, onSessionLog }) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const audioRef = useRef(null);
  const onSessionLogRef = useRef(onSessionLog);
  const gameRef = useRef({
    tuner: 241.02,
    contacts: [],
    holding: false,
    dragging: false,
    lockMs: 0,
    phase: 'scan',
    cipher: null,
    caught: [],
    catches: 0,
    drops: 0,
    spawnAt: 0,
    logged: false,
  });
  const [hud, setHud] = useState(initialHud);

  onSessionLogRef.current = onSessionLog;

  useEffect(() => {
    audioRef.current = createPhoenixAudio();
    return () => audioRef.current?.dispose();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const ctx = canvas.getContext('2d', { alpha: false });
    const offscreen = document.createElement('canvas');
    offscreenRef.current = offscreen;
    const game = gameRef.current;
    let frameId = 0;
    let last = performance.now();
    let lastHudAt = 0;
    game.spawnAt = last + 400;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width * window.devicePixelRatio));
      const height = Math.max(140, Math.floor(rect.height * window.devicePixelRatio));
      canvas.width = width;
      canvas.height = height;
      offscreen.width = width;
      offscreen.height = height;
      ctx.fillStyle = '#03140a';
      ctx.fillRect(0, 0, width, height);
    };

    resize();
    window.addEventListener('resize', resize);

    const setTunerFromClientX = (clientX) => {
      const rect = canvas.getBoundingClientRect();
      const ratio = (clientX - rect.left) / Math.max(1, rect.width);
      game.tuner = clampPhoenixFreq(ratioToFreq(ratio));
    };

    const onPointerDown = (event) => {
      game.dragging = true;
      if (game.phase === 'scan') game.holding = true;
      canvas.setPointerCapture?.(event.pointerId);
      setTunerFromClientX(event.clientX);
    };
    const onPointerMove = (event) => {
      if (!game.dragging) return;
      setTunerFromClientX(event.clientX);
    };
    const onPointerUp = (event) => {
      game.dragging = false;
      game.holding = false;
      if (canvas.hasPointerCapture?.(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    const failDrop = () => {
      game.drops += 1;
      game.lockMs = 0;
      game.cipher = null;
      audioRef.current?.tone(120, 0.2, 0.08);
      if (game.drops >= PHOENIX_MAX_DROPS) {
        game.phase = 'fail';
      } else {
        game.phase = 'scan';
      }
    };

    const drawSpectrumRow = (target, y) => {
      const { width } = canvas;
      const image = target.createImageData(width, 1);
      const { data } = image;

      for (let x = 0; x < width; x += 1) {
        const freq = ratioToFreq(x / (width - 1));
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
        }
        const glow = Math.min(1, energy);
        const offset = x * 4;
        data[offset] = Math.floor(8 + glow * 40 + Math.min(1, voice) * 90);
        data[offset + 1] = Math.floor(28 + glow * 210);
        data[offset + 2] = Math.floor(18 + glow * 70);
        data[offset + 3] = 255;
      }
      target.putImageData(image, 0, y);
    };

    const publishHud = (now) => {
      const aligned = game.contacts.find(
        (contact) => Math.abs(contact.freq - game.tuner) <= PHOENIX_GATE_MHZ,
      );
      let contactLabel = t('lidc.storyline.terminal.phoenix.scanIdle');
      if (game.cipher) contactLabel = t('lidc.storyline.terminal.phoenix.locked');
      else if (aligned) {
        contactLabel = t(aligned.kind === 'voice'
          ? 'lidc.storyline.terminal.phoenix.voiceContact'
          : 'lidc.storyline.terminal.phoenix.decoyContact');
      }

      setHud({
        phase: game.phase,
        freq: game.tuner,
        lock: Math.min(1, game.lockMs / PHOENIX_LOCK_MS),
        catches: game.catches,
        drops: game.drops,
        contactLabel,
        digits: game.cipher?.digits ?? '',
        typed: game.cipher?.typed ?? '',
        cipherLeft: game.cipher
          ? Math.max(0, 1 - (now - game.cipher.startedAt) / PHOENIX_CIPHER_MS)
          : 1,
        outcome: game.phase === 'win' || game.phase === 'fail' ? game.phase : null,
      });
    };

    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (game.phase === 'scan') {
        if (now >= game.spawnAt) {
          const caughtIds = new Set(game.caught);
          const remaining = PHOENIX_INTERCEPTS.filter((item) => !caughtIds.has(item.id));
          const hasVoice = game.contacts.some((contact) => contact.kind === 'voice');
          if (!hasVoice && remaining.length) {
            const next = remaining[Math.floor(Math.random() * remaining.length)];
            game.contacts.push(createContact(now, 'voice', next, game.contacts));
            audioRef.current?.noise(0.09);
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

        const aligned = game.contacts.find(
          (contact) => Math.abs(contact.freq - game.tuner) <= PHOENIX_GATE_MHZ,
        );

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
              audioRef.current?.tone(880, 0.12, 0.07);
            } else {
              game.contacts = game.contacts.filter((contact) => contact.key !== aligned.key);
              failDrop();
            }
          }
        } else {
          game.lockMs = Math.max(0, game.lockMs - dt * 1400);
        }
      }

      if (game.phase === 'cipher' && game.cipher) {
        if (now - game.cipher.startedAt >= PHOENIX_CIPHER_MS) {
          failDrop();
        }
      }

      const { width, height } = canvas;
      const off = offscreenRef.current;
      const offCtx = off.getContext('2d');
      offCtx.drawImage(canvas, 0, 0);
      ctx.drawImage(off, 0, 1);
      drawSpectrumRow(ctx, 0);

      const tunerX = freqToRatio(game.tuner) * (width - 1);
      const gatePx = (PHOENIX_GATE_MHZ / (PHOENIX_FREQ_MAX - PHOENIX_FREQ_MIN)) * width;
      ctx.fillStyle = 'rgba(255, 196, 72, 0.08)';
      ctx.fillRect(tunerX - gatePx, 0, gatePx * 2, height);
      ctx.strokeStyle = 'rgba(255, 210, 96, 0.85)';
      ctx.lineWidth = Math.max(1, window.devicePixelRatio);
      ctx.beginPath();
      ctx.moveTo(tunerX, 0);
      ctx.lineTo(tunerX, height);
      ctx.stroke();

      if (now - lastHudAt > 80) {
        lastHudAt = now;
        publishHud(now);
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event) => {
      const game = gameRef.current;

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (game.phase === 'win' || game.phase === 'fail') return;

      if (game.phase === 'scan') {
        if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
          event.preventDefault();
          game.tuner = clampPhoenixFreq(game.tuner - TUNER_STEP);
        }
        if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
          event.preventDefault();
          game.tuner = clampPhoenixFreq(game.tuner + TUNER_STEP);
        }
        if (event.key === ' ' || event.code === 'Space') {
          event.preventDefault();
          game.holding = true;
        }
      }

      if (game.phase === 'cipher' && game.cipher && /^\d$/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        game.cipher.typed = `${game.cipher.typed}${event.key}`.slice(0, game.cipher.digits.length);
        audioRef.current?.tone(420 + Number(event.key) * 40, 0.06, 0.05);

        if (game.cipher.typed === game.cipher.digits) {
          game.caught.push(game.cipher.id);
          game.catches = game.caught.length;
          game.cipher = null;
          audioRef.current?.tone(980, 0.16, 0.07);
          if (game.catches >= PHOENIX_TARGET_CATCHES) {
            game.phase = 'win';
            if (!game.logged) {
              game.logged = true;
              const logs = game.caught.flatMap((id) => {
                const item = PHOENIX_INTERCEPTS.find((entry) => entry.id === id);
                return item
                  ? tLines(`lidc.storyline.terminal.phoenix.transcripts.${item.transcriptKey}`)
                  : [];
              });
              onSessionLogRef.current?.([
                t('lidc.storyline.terminal.phoenix.logHeader'),
                ...logs,
              ]);
            }
          } else {
            game.phase = 'scan';
          }
        } else if (game.cipher.typed.length === game.cipher.digits.length) {
          game.drops += 1;
          game.cipher = null;
          audioRef.current?.tone(120, 0.2, 0.08);
          game.phase = game.drops >= PHOENIX_MAX_DROPS ? 'fail' : 'scan';
        }
      }
    };

    const onKeyUp = (event) => {
      if (event.key === ' ' || event.code === 'Space') {
        gameRef.current.holding = false;
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, [onClose]);

  const restart = () => {
    const game = gameRef.current;
    game.contacts = [];
    game.holding = false;
    game.lockMs = 0;
    game.phase = 'scan';
    game.cipher = null;
    game.caught = [];
    game.catches = 0;
    game.drops = 0;
    game.spawnAt = performance.now() + 400;
    game.logged = false;
    setHud({ ...initialHud(), freq: game.tuner });
  };

  return (
    <div className="lidc-phoenix-stage" role="dialog" aria-modal="true" aria-label={t('lidc.storyline.terminal.phoenix.title')}>
      <div className="lidc-phoenix-console">
        <header className="lidc-phoenix-top">
          <span className="lidc-phoenix-brand">{t('lidc.storyline.terminal.phoenix.title')}</span>
          <span className="lidc-phoenix-live">{t('lidc.storyline.terminal.phoenix.live')}</span>
        </header>

        <div className="lidc-phoenix-meters">
          <span>{t('lidc.storyline.terminal.phoenix.catches')} {hud.catches}/{PHOENIX_TARGET_CATCHES}</span>
          <span>{t('lidc.storyline.terminal.phoenix.drops')} {hud.drops}/{PHOENIX_MAX_DROPS}</span>
          <span className="lidc-phoenix-freq">{formatPhoenixFreq(hud.freq)}</span>
        </div>

        <div className="lidc-phoenix-screen">
          <canvas ref={canvasRef} className="lidc-phoenix-waterfall" />
          <div className="lidc-phoenix-scale">
            <span>{PHOENIX_FREQ_MIN}</span>
            <span>MHz</span>
            <span>{PHOENIX_FREQ_MAX}</span>
          </div>
        </div>

        <div className="lidc-phoenix-lock">
          <div className="lidc-phoenix-lock-bar" style={{ width: `${Math.round(hud.lock * 100)}%` }} />
        </div>

        <p className="lidc-phoenix-status">{hud.contactLabel}</p>

        {hud.phase === 'cipher' && (
          <div className="lidc-phoenix-cipher">
            <p>{t('lidc.storyline.terminal.phoenix.cipherHint')}</p>
            <div className="lidc-phoenix-digits" aria-hidden="true">
              {hud.digits.split('').map((digit, index) => (
                <span
                  key={`${digit}-${index}`}
                  className={index < hud.typed.length ? 'is-typed' : ''}
                >
                  {digit}
                </span>
              ))}
            </div>
            <div className="lidc-phoenix-cipher-time">
              <div style={{ width: `${Math.round(hud.cipherLeft * 100)}%` }} />
            </div>
          </div>
        )}

        {hud.outcome && (
          <div className="lidc-phoenix-outcome">
            <h2>{t(hud.outcome === 'win'
              ? 'lidc.storyline.terminal.phoenix.winTitle'
              : 'lidc.storyline.terminal.phoenix.failTitle')}</h2>
            <p>{t(hud.outcome === 'win'
              ? 'lidc.storyline.terminal.phoenix.winBody'
              : 'lidc.storyline.terminal.phoenix.failBody')}</p>
            <div className="lidc-phoenix-actions">
              <button type="button" onClick={restart}>
                {t('lidc.storyline.terminal.phoenix.retry')}
              </button>
              <button type="button" className="is-ghost" onClick={onClose}>
                {t('lidc.storyline.terminal.phoenix.back')}
              </button>
            </div>
          </div>
        )}
      </div>

      <LidcStorylineHudNotice
        primaryLabel={t('lidc.storyline.terminal.phoenix.exitHint')}
        secondary={t('lidc.storyline.terminal.phoenix.controls')}
      />
    </div>
  );
}
