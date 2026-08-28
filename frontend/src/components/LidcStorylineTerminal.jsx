import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BIOS_SPLASH_DURATION_MS,
  buildBiosProgressBar,
  cwdToPrompt,
  getRatosAsciiBanner,
  getRatosBootLines,
  RATOS_BIOS_LOGO_ART,
  RATOS_BIOS_TITLE_ART,
  RATOS_OS_NAME,
  runRatosCommand,
} from '../config/lidcStorylineTerminal';
import { t } from '../utils/locale';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcStorylineTerminal.css';

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

export default function LidcStorylineTerminal({ onClose }) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('/');
  const [imageViewer, setImageViewer] = useState(null);
  const [bootComplete, setBootComplete] = useState(false);
  const [bootPhase, setBootPhase] = useState('bios');
  const [biosProgress, setBiosProgress] = useState(0);
  const [showExitHint, setShowExitHint] = useState(true);
  const inputRef = useRef(null);
  const outputRef = useRef(null);
  const commandHistoryRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const draftInputRef = useRef('');

  const appendLines = useCallback((nextLines, variant = 'normal') => {
    if (typeof nextLines === 'string') {
      if (!nextLines) return;
      setLines((current) => [...current, { text: nextLines, variant }]);
      return;
    }

    if (!nextLines?.length) return;
    setLines((current) => [
      ...current,
      ...nextLines.map((text) => ({ text, variant })),
    ]);
  }, []);

  useEffect(() => {
    if (bootPhase !== 'bios') return undefined;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(100, Math.floor((elapsed / BIOS_SPLASH_DURATION_MS) * 100));
      setBiosProgress(progress);

      if (elapsed >= BIOS_SPLASH_DURATION_MS) {
        window.clearInterval(timer);
        setBootPhase('terminal');
      }
    }, 50);

    return () => window.clearInterval(timer);
  }, [bootPhase]);

  useEffect(() => {
    if (bootPhase !== 'terminal') return undefined;

    const bootLines = getRatosBootLines();
    let index = 0;

    const timer = window.setInterval(() => {
      if (index >= bootLines.length) {
        window.clearInterval(timer);
        appendLines(getRatosAsciiBanner(), 'banner-block');
        appendLines([t('lidc.storyline.terminal.readyHint')], 'dim');
        setBootComplete(true);
        return;
      }

      appendLines([bootLines[index]], index === 0 ? 'normal' : 'dim');
      index += 1;
    }, 120);

    return () => window.clearInterval(timer);
  }, [appendLines, bootPhase]);

  useEffect(() => {
    if (imageViewer || !bootComplete) return;
    inputRef.current?.focus();
  }, [bootComplete, imageViewer]);

  useEffect(() => {
    if (!outputRef.current) return;
    outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [lines]);

  useEffect(() => {
    const hintTimer = window.setTimeout(() => setShowExitHint(false), 3200);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (imageViewer) {
          setImageViewer(null);
          return;
        }
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(hintTimer);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [imageViewer, onClose]);

  const submitCommand = useCallback((rawValue) => {
    const value = rawValue.trim();
    if (!value) return;

    const history = commandHistoryRef.current;
    if (history.length === 0 || history[history.length - 1] !== value) {
      commandHistoryRef.current = [...history, value];
    }
    historyIndexRef.current = -1;
    draftInputRef.current = '';

    appendLines([`${cwdToPrompt(cwd)} ${value}`]);
    setInput('');

    const result = normalizeCommandResult(runRatosCommand(value, { cwd }));
    if (result.cwd !== undefined) {
      setCwd(result.cwd);
    }

    if (result.clear) {
      setLines([]);
      setImageViewer(null);
      return;
    }

    if (result.closeImageViewer) {
      setImageViewer(null);
      return;
    }

    if (result.imageViewer) {
      setImageViewer(result.imageViewer);
    }

    if (result.exit) {
      onClose();
      return;
    }

    appendLines(result.lines);
  }, [appendLines, cwd, onClose]);

  const onSubmit = (event) => {
    event.preventDefault();
    submitCommand(input);
  };

  const onInputKeyDown = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;

    const history = commandHistoryRef.current;
    if (history.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'ArrowUp') {
      if (historyIndexRef.current === -1) {
        draftInputRef.current = input;
        historyIndexRef.current = history.length - 1;
      } else if (historyIndexRef.current > 0) {
        historyIndexRef.current -= 1;
      }
      setInput(history[historyIndexRef.current]);
      return;
    }

    if (historyIndexRef.current === -1) return;

    if (historyIndexRef.current < history.length - 1) {
      historyIndexRef.current += 1;
      setInput(history[historyIndexRef.current]);
      return;
    }

    historyIndexRef.current = -1;
    setInput(draftInputRef.current);
  };

  return (
    <div className="lidc-ratos-stage" role="dialog" aria-modal="true" aria-label={t('lidc.storyline.terminal.title')}>
      <svg className="lidc-ratos-filters" aria-hidden="true" focusable="false">
        <defs>
          <filter id="lidc-ratos-fisheye" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
            <feImage
              result="dispMap"
              preserveAspectRatio="none"
              href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cdefs%3E%3CradialGradient id='r' cx='50%25' cy='50%25' r='72%25'%3E%3Cstop offset='0%25' stop-color='%23808080'/%3E%3Cstop offset='55%25' stop-color='%23808080'/%3E%3Cstop offset='100%25' stop-color='%23c04040'/%3E%3C/radialGradient%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='72%25'%3E%3Cstop offset='0%25' stop-color='%23808080'/%3E%3Cstop offset='55%25' stop-color='%23808080'/%3E%3Cstop offset='100%25' stop-color='%2340c040'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='256' height='256' fill='url(%23r)'/%3E%3Crect width='256' height='256' fill='url(%23g)' style='mix-blend-mode:screen'/%3E%3C/svg%3E"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale="9"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      <div className="lidc-ratos-workstation">
        <div className="lidc-ratos-screen-frame">
          <div className="lidc-ratos-frame-grime" aria-hidden="true" />
          <div className="lidc-ratos-frame-top">
            <span className="lidc-ratos-brand">DCS / LIDC</span>
            <div className="lidc-ratos-indicators" aria-hidden="true">
              <span className="lidc-ratos-led is-power" title="PWR" />
              <span className="lidc-ratos-led is-hdd" title="HDD" />
            </div>
          </div>

          <div className="lidc-ratos-frame-body">
            <span className="lidc-ratos-screw is-tl" aria-hidden="true" />
            <span className="lidc-ratos-screw is-tr" aria-hidden="true" />
            <span className="lidc-ratos-screw is-bl" aria-hidden="true" />
            <span className="lidc-ratos-screw is-br" aria-hidden="true" />

            <div className="lidc-ratos-screen-aperture">
              <div className="lidc-ratos-screen">
                <div className="lidc-ratos-screen-curve">
                  <div className="lidc-ratos-screen-inner">
                    <div className={`lidc-ratos-body ${imageViewer ? 'is-image-open' : ''} ${bootPhase === 'bios' ? 'is-bios' : ''}`}>
                      <header className={`lidc-ratos-header ${imageViewer || bootPhase === 'bios' ? 'is-hidden' : ''}`}>
                        <span>{RATOS_OS_NAME} v3.11</span>
                        <span>{t('lidc.storyline.terminal.secureShell')}</span>
                      </header>

                      {imageViewer ? (
                        <button
                          type="button"
                          className="lidc-ratos-image-view"
                          onClick={() => setImageViewer(null)}
                          aria-label={t('lidc.storyline.terminal.commands.viewClose')}
                        >
                          <img src={imageViewer.src} alt="" draggable={false} />
                        </button>
                      ) : bootPhase === 'bios' ? (
                        <div className="lidc-ratos-bios" aria-live="polite">
                          <pre className="lidc-ratos-bios-logo" aria-hidden="true">{RATOS_BIOS_LOGO_ART}</pre>
                          <pre className="lidc-ratos-bios-title" aria-hidden="true">{RATOS_BIOS_TITLE_ART}</pre>
                          <p className="lidc-ratos-bios-label">{t('lidc.storyline.terminal.biosLoading')}</p>
                          <pre className="lidc-ratos-bios-progress">{buildBiosProgressBar(biosProgress)}</pre>
                        </div>
                      ) : (
                        <>
                          <div className="lidc-ratos-output" ref={outputRef}>
                            {lines.map((line, index) => (
                              line.variant === 'banner-block' ? (
                                <pre
                                  key={`banner-${index}`}
                                  className="lidc-ratos-banner"
                                  aria-hidden="true"
                                >
                                  {line.text}
                                </pre>
                              ) : (
                                <p
                                  key={`${index}-${line.text.slice(0, 24)}`}
                                  className={`lidc-ratos-line ${line.variant === 'dim' ? 'is-dim' : ''} ${line.variant === 'error' ? 'is-error' : ''}`}
                                >
                                  {line.text}
                                </p>
                              )
                            ))}
                          </div>

                          <form className="lidc-ratos-input-row" onSubmit={onSubmit}>
                            <span className="lidc-ratos-prompt">{cwdToPrompt(cwd)}</span>
                            <input
                              ref={inputRef}
                              className="lidc-ratos-input"
                              type="text"
                              value={input}
                              onChange={(event) => {
                                setInput(event.target.value);
                                historyIndexRef.current = -1;
                              }}
                              onKeyDown={onInputKeyDown}
                              autoComplete="off"
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              disabled={!bootComplete}
                              aria-label={t('lidc.storyline.terminal.inputLabel')}
                            />
                          </form>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="lidc-ratos-vcr" aria-hidden="true">
                  <div className="lidc-ratos-scanlines" />
                  <div className="lidc-ratos-noise" />
                  <div className="lidc-ratos-chroma" />
                  <div className="lidc-ratos-tracking" />
                  <div className="lidc-ratos-glow" />
                  <div className="lidc-ratos-flicker" />
                  <div className="lidc-ratos-glass" />
                  <div className="lidc-ratos-tube-edge" />
                </div>
              </div>
            </div>
          </div>

          <div className="lidc-ratos-frame-bottom">
            <div className="lidc-ratos-floppy-bay" aria-hidden="true">
              <div className="lidc-ratos-floppy-face">
                <div className="lidc-ratos-floppy-slot">
                  <div className="lidc-ratos-floppy-mouth" />
                </div>
                <div className="lidc-ratos-floppy-eject" />
              </div>
            </div>
            <div className="lidc-ratos-frame-labels">
              <span className="lidc-ratos-model">FIELD TERMINAL MK.III</span>
              <span className="lidc-ratos-serial">SN LIDC-0147</span>
            </div>
          </div>
        </div>
      </div>

      {showExitHint && (
        <LidcStorylineHudNotice
          primaryLabel={t('lidc.storyline.backToRoom')}
          secondary={t('lidc.storyline.terminal.exitHint')}
          fadeOut
        />
      )}
    </div>
  );
}
