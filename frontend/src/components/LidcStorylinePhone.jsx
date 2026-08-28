import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../utils/locale';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcStorylinePhone.css';

const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const START_ANGLE = 0;
const STEP_ANGLE = (-30 * Math.PI) / 180;
const HOLE_DIST = 0.72;
const HOLE_R = 0.17;
const CAP_R = 22;
const GOV_SPEED = 280;
const MAX_DIGITS = 16;
const LETTERS = {
  1: './:-',
  2: 'ABC',
  3: 'DEF',
  4: 'GHI',
  5: 'JKL',
  6: 'MNO',
  7: 'PQRS',
  8: 'TUV',
  9: 'WXYZ',
  0: '?&=+',
};

const FINGER_STOP_PATH = 'M 77.94,89.03 A 48,48 0 0,1 71.49,92.92 Q 60.27,82.36 60.99,69.06 A 22,22 0 0,0 61.73,68.61 Q 67.89,81.30 77.94,89.03 Z';

function holeCenter(index) {
  const angle = START_ANGLE + index * STEP_ANGLE;
  return {
    x: HOLE_DIST * 100 * Math.cos(angle),
    y: HOLE_DIST * 100 * Math.sin(angle),
  };
}

function generateWheelPath() {
  let path = `M 0,-100 A 100,100 0 1,1 0,100 A 100,100 0 1,1 0,-100 `;
  path += `M 0,-${CAP_R} A ${CAP_R},${CAP_R} 0 1,0 0,${CAP_R} A ${CAP_R},${CAP_R} 0 1,0 0,-${CAP_R} `;
  NUMBERS.forEach((_, index) => {
    const { x, y } = holeCenter(index);
    const radius = HOLE_R * 100;
    path += `M ${(x + radius).toFixed(2)},${y.toFixed(2)} A ${radius.toFixed(2)},${radius.toFixed(2)} 0 1,0 ${(x - radius).toFixed(2)},${y.toFixed(2)} A ${radius.toFixed(2)},${radius.toFixed(2)} 0 1,0 ${(x + radius).toFixed(2)},${y.toFixed(2)} `;
  });
  return path;
}

const WHEEL_PATH = generateWheelPath();

function createClickAudio() {
  let context = null;

  const ensure = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') context.resume().catch(() => {});
    return context;
  };

  return {
    click(loud) {
      const audio = ensure();
      if (!audio) return;
      const duration = audio.sampleRate * 0.015;
      const buffer = audio.createBuffer(1, duration, audio.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < duration; i += 1) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (duration * 0.15));
      }
      const source = audio.createBufferSource();
      source.buffer = buffer;
      const highpass = audio.createBiquadFilter();
      highpass.type = 'highpass';
      highpass.frequency.value = 1600;
      const lowpass = audio.createBiquadFilter();
      lowpass.type = 'lowpass';
      lowpass.frequency.value = 6000;
      const gain = audio.createGain();
      gain.gain.value = loud ? 0.35 : 0.15;
      source.connect(highpass).connect(lowpass).connect(gain).connect(audio.destination);
      source.start(audio.currentTime);
    },
    dispose() {
      context?.close?.().catch(() => {});
      context = null;
    },
  };
}

export default function LidcStorylinePhone({ onClose }) {
  const [digits, setDigits] = useState('');
  const [showExitHint, setShowExitHint] = useState(true);

  const wheelRef = useRef(null);
  const stopRef = useRef(null);
  const digitsRef = useRef('');
  const audioRef = useRef(null);
  const rafRef = useRef(0);
  const physicsRef = useRef({
    dragging: false,
    returning: false,
    prevAngle: 0,
    currentDeg: 0,
    targetDeg: 0,
    lastWindDeg: 0,
    hitStop: false,
    hole: null,
  });

  const setWheelRotation = useCallback((deg) => {
    const wheel = wheelRef.current;
    if (wheel) wheel.style.transform = `rotate(${deg}deg)`;
  }, []);

  const setStopRotation = useCallback((deg) => {
    const stop = stopRef.current;
    if (stop) stop.style.transform = `rotate(${deg}deg)`;
  }, []);

  const stopAnimation = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const appendDigit = useCallback((digit) => {
    const next = `${digitsRef.current}${digit}`.slice(0, MAX_DIGITS);
    digitsRef.current = next;
    setDigits(next);
  }, []);

  const clearLast = useCallback(() => {
    if (physicsRef.current.dragging || physicsRef.current.returning) return;
    const next = digitsRef.current.slice(0, -1);
    digitsRef.current = next;
    setDigits(next);
  }, []);

  const getAngle = useCallback((clientX, clientY) => {
    const rect = wheelRef.current.getBoundingClientRect();
    return Math.atan2(
      clientY - (rect.top + rect.height / 2),
      clientX - (rect.left + rect.width / 2),
    ) * (180 / Math.PI);
  }, []);

  const getClickedHole = useCallback((clientX, clientY) => {
    const rect = wheelRef.current.getBoundingClientRect();
    const radius = rect.width / 2;
    const scale = 100 / radius;
    const svgX = (clientX - (rect.left + radius)) * scale;
    const svgY = (clientY - (rect.top + radius)) * scale;
    const hitRadius = HOLE_R * 100 * 1.15;
    let best = null;
    let bestDistance = Infinity;

    NUMBERS.forEach((num, index) => {
      const { x, y } = holeCenter(index);
      const distance = Math.hypot(svgX - x, svgY - y);
      if (distance < hitRadius && distance < bestDistance) {
        bestDistance = distance;
        best = { num, idx: index };
      }
    });

    return best;
  }, []);

  const springReturn = useCallback((from, onDone) => {
    stopAnimation();
    const duration = Math.max((from / GOV_SPEED) * 1000, 200);
    const startedAt = performance.now();
    const pulses = physicsRef.current.hole ? physicsRef.current.hole.idx + 1 : 0;
    const clickEvery = duration / (pulses + 1);
    let clicks = 0;
    let lastClick = startedAt;

    const tick = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      physicsRef.current.currentDeg = from * (1 - progress);
      setWheelRotation(physicsRef.current.currentDeg);
      if (now - lastClick >= clickEvery && clicks < pulses) {
        audioRef.current?.click(true);
        clicks += 1;
        lastClick = now;
      }
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      physicsRef.current.currentDeg = 0;
      physicsRef.current.returning = false;
      physicsRef.current.hole = null;
      setWheelRotation(0);
      rafRef.current = 0;
      onDone?.();
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [setWheelRotation, stopAnimation]);

  useEffect(() => {
    audioRef.current = createClickAudio();
    const wheel = wheelRef.current;
    if (!wheel) return undefined;

    const physics = physicsRef.current;

    const onStart = (x, y) => {
      if (physics.returning) {
        stopAnimation();
        physics.returning = false;
        physics.currentDeg = 0;
        setWheelRotation(0);
      }

      const hole = getClickedHole(x, y);
      if (!hole) return;
      if (digitsRef.current.length >= MAX_DIGITS) return;

      audioRef.current?.click(true);
      physics.dragging = true;
      physics.hole = hole;
      physics.hitStop = false;
      physics.prevAngle = getAngle(x, y);
      physics.currentDeg = 0;
      physics.lastWindDeg = 0;
      physics.targetDeg = 60 + hole.idx * 30;
      wheel.classList.add('is-grabbed');
    };

    const onMove = (x, y) => {
      if (!physics.dragging) return;
      const angle = getAngle(x, y);
      let delta = angle - physics.prevAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      physics.prevAngle = angle;
      physics.currentDeg += delta;
      if (physics.currentDeg < 0) physics.currentDeg = 0;

      const maxDeg = physics.targetDeg + 5;
      if (physics.currentDeg > maxDeg) physics.currentDeg = maxDeg;

      let displayDeg = physics.currentDeg;
      if (physics.currentDeg >= physics.targetDeg) {
        if (!physics.hitStop && physics.hole) {
          physics.hitStop = true;
          appendDigit(physics.hole.num);
        }
        const over = physics.currentDeg - physics.targetDeg;
        displayDeg = physics.targetDeg + over * 0.4;
        setStopRotation(over * 0.3);
      } else {
        setStopRotation(0);
      }

      setWheelRotation(displayDeg);
      if (physics.currentDeg - physics.lastWindDeg >= 15) {
        physics.lastWindDeg += 15;
        audioRef.current?.click(false);
      }
    };

    const onEnd = () => {
      if (!physics.dragging) return;
      physics.dragging = false;
      wheel.classList.remove('is-grabbed');
      setStopRotation(0);
      if (physics.currentDeg > physics.targetDeg) physics.currentDeg = physics.targetDeg;

      if (physics.hole && physics.currentDeg >= physics.targetDeg * 0.5) {
        physics.returning = true;
        physics.currentDeg = physics.targetDeg;
        setWheelRotation(physics.currentDeg);
        springReturn(physics.currentDeg);
        return;
      }

      const from = physics.currentDeg;
      physics.hole = null;
      if (from > 1) {
        physics.returning = true;
        springReturn(from, () => {
          physics.returning = false;
        });
        return;
      }

      physics.currentDeg = 0;
      setWheelRotation(0);
    };

    const onPointerDown = (event) => {
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      onStart(event.clientX, event.clientY);
    };

    const onPointerMove = (event) => {
      if (!physics.dragging) return;
      event.preventDefault();
      onMove(event.clientX, event.clientY);
    };

    wheel.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    window.addEventListener('blur', onEnd);

    return () => {
      stopAnimation();
      audioRef.current?.dispose();
      wheel.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
      window.removeEventListener('blur', onEnd);
    };
  }, [appendDigit, getAngle, getClickedHole, setStopRotation, setWheelRotation, springReturn, stopAnimation]);

  useEffect(() => {
    const hintTimer = window.setTimeout(() => setShowExitHint(false), 3200);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        clearLast();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(hintTimer);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [clearLast, onClose]);

  return (
    <div className="lidc-phone-stage" role="dialog" aria-modal="true" aria-label={t('lidc.storyline.phone.title')}>
      <div className="lidc-phone-dial" aria-label={t('lidc.storyline.phone.dial')}>
        <div className="lidc-phone-base" />
        <div className="lidc-phone-bezel" />

        <div className="lidc-phone-card">
          <svg viewBox="-102 -102 204 204" className="lidc-phone-card-svg" aria-hidden="true">
            {NUMBERS.map((num, index) => {
              const { x, y } = holeCenter(index);
              return (
                <g key={num} transform={`translate(${x.toFixed(2)},${y.toFixed(2)})`}>
                  <text
                    x="0"
                    y="-3"
                    fontSize="19"
                    fontFamily="IBM Plex Sans, Helvetica Neue, sans-serif"
                    fontWeight="600"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#121714"
                  >
                    {num}
                  </text>
                  <text
                    x="0"
                    y="10"
                    fontSize="5.8"
                    fontFamily="IBM Plex Sans, Helvetica Neue, sans-serif"
                    fontWeight="500"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#3a423c"
                    letterSpacing="0.8"
                  >
                    {LETTERS[num]}
                  </text>
                </g>
              );
            })}
            <circle cx="0" cy="0" r="22.5" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
          </svg>
        </div>

        <div ref={wheelRef} className="lidc-phone-wheel">
          <svg viewBox="-102 -102 204 204" className="lidc-phone-wheel-svg" aria-hidden="true">
            <defs>
              <radialGradient id="lidc-phone-smoky" cx="40%" cy="38%" r="65%">
                <stop offset="0%" stopColor="rgba(70,120,82,0.42)" />
                <stop offset="35%" stopColor="rgba(36,78,50,0.38)" />
                <stop offset="70%" stopColor="rgba(18,48,30,0.40)" />
                <stop offset="100%" stopColor="rgba(8,28,16,0.52)" />
              </radialGradient>
              <linearGradient id="lidc-phone-glare" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(255,255,255,0.6)" />
                <stop offset="8%" stopColor="rgba(255,255,255,0.15)" />
                <stop offset="25%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                <stop offset="52%" stopColor="rgba(255,255,255,0.08)" />
                <stop offset="55%" stopColor="rgba(255,255,255,0)" />
                <stop offset="85%" stopColor="rgba(255,255,255,0)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0.25)" />
              </linearGradient>
            </defs>
            <path d={WHEEL_PATH} fill="url(#lidc-phone-smoky)" fillRule="evenodd" />
            <path d={WHEEL_PATH} fill="url(#lidc-phone-glare)" fillRule="evenodd" />
            <path d={WHEEL_PATH} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="1.2" />
            <path d={WHEEL_PATH} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6" />
          </svg>
        </div>

        <div className="lidc-phone-stop-wrap" aria-hidden="true">
          <svg viewBox="0 0 100 100">
            <defs>
              <linearGradient id="lidc-phone-metal" x1="0.3" y1="0" x2="0.7" y2="1">
                <stop offset="0%" stopColor="#888" />
                <stop offset="15%" stopColor="#d8d8d8" />
                <stop offset="35%" stopColor="#f4f4f4" />
                <stop offset="55%" stopColor="#b0b0b0" />
                <stop offset="75%" stopColor="#e0e0e0" />
                <stop offset="100%" stopColor="#707070" />
              </linearGradient>
            </defs>
            <g ref={stopRef}>
              <path d={FINGER_STOP_PATH} fill="url(#lidc-phone-metal)" stroke="#aaa" strokeWidth="0.3" />
            </g>
          </svg>
        </div>

        <button
          type="button"
          className="lidc-phone-cap"
          onClick={clearLast}
          aria-label={t('lidc.storyline.phone.clear')}
        >
          <span>LIDC</span>
        </button>
      </div>

      <div
        className="lidc-phone-readout"
        aria-live="polite"
        aria-label={t('lidc.storyline.phone.composed', { number: digits || t('lidc.storyline.phone.empty') })}
      >
        <span className={digits ? 'has-number' : ''}>
          {digits || t('lidc.storyline.phone.empty')}
          <i className="lidc-phone-cursor" />
        </span>
      </div>

      {showExitHint && (
        <LidcStorylineHudNotice
          primaryLabel={t('lidc.storyline.backToRoom')}
          secondary={t('lidc.storyline.phone.hint')}
          fadeOut
        />
      )}
    </div>
  );
}
