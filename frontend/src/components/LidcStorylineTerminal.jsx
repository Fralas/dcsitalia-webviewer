import { useCallback, useEffect, useRef, useState } from 'react';
import { cwdToPrompt, getRatosAsciiBanner, getRatosBootLines, RATOS_OS_NAME, runRatosCommand } from '../config/lidcStorylineTerminal';
import { t } from '../utils/locale';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcStorylineTerminal.css';

function normalizeCommandResult(result) {
  if (!result) return { lines: [], clear: false, exit: false, cwd: undefined };
  if (Array.isArray(result)) return { lines: result, clear: false, exit: false, cwd: undefined };
  return {
    lines: result.lines ?? [],
    clear: Boolean(result.clear),
    exit: Boolean(result.exit),
    cwd: result.cwd,
  };
}

export default function LidcStorylineTerminal({ onClose }) {
  const [lines, setLines] = useState([]);
  const [input, setInput] = useState('');
  const [cwd, setCwd] = useState('/');
  const [bootComplete, setBootComplete] = useState(false);
  const [showExitHint, setShowExitHint] = useState(true);
  const inputRef = useRef(null);
  const outputRef = useRef(null);

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
  }, [appendLines]);

  useEffect(() => {
    if (!bootComplete) return;
    inputRef.current?.focus();
  }, [bootComplete]);

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
        onClose();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(hintTimer);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [onClose]);

  const submitCommand = useCallback((rawValue) => {
    const value = rawValue.trim();
    if (!value) return;

    appendLines([`${cwdToPrompt(cwd)} ${value}`]);
    setInput('');

    const result = normalizeCommandResult(runRatosCommand(value, { cwd }));
    if (result.cwd !== undefined) {
      setCwd(result.cwd);
    }

    if (result.clear) {
      setLines([]);
      return;
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

  return (
    <div className="lidc-ratos-stage" role="dialog" aria-modal="true" aria-label={t('lidc.storyline.terminal.title')}>
      <div className="lidc-ratos-monitor">
        <div className="lidc-ratos-screen">
          <div className="lidc-ratos-screen-inner">
            <div className="lidc-ratos-body">
              <header className="lidc-ratos-header">
                <span>{RATOS_OS_NAME} v3.11</span>
                <span>{t('lidc.storyline.terminal.secureShell')}</span>
              </header>

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
                  onChange={(event) => setInput(event.target.value)}
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  disabled={!bootComplete}
                  aria-label={t('lidc.storyline.terminal.inputLabel')}
                />
              </form>
            </div>
          </div>

          <div className="lidc-ratos-vcr" aria-hidden="true">
            <div className="lidc-ratos-scanlines" />
            <div className="lidc-ratos-noise" />
            <div className="lidc-ratos-chroma" />
            <div className="lidc-ratos-tracking" />
            <div className="lidc-ratos-glow" />
            <div className="lidc-ratos-flicker" />
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
