import { useEffect, useRef, useState } from 'react';
import {
  closeRatosImageViewer,
  getRatosTerminalSnapshot,
  navigateRatosHistory,
  setRatosTerminalExitHandler,
  setRatosTerminalInput,
  submitRatosCommand,
  subscribeRatosTerminal,
} from '../utils/ratosTerminalStore';
import { t } from '../utils/locale';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcStorylineTerminal.css';

export default function LidcStorylineTerminal({ onClose }) {
  const [bootComplete, setBootComplete] = useState(false);
  const [imageViewer, setImageViewer] = useState(null);
  const [input, setInput] = useState('');
  const [showExitHint, setShowExitHint] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    setRatosTerminalExitHandler(onClose);
    return () => setRatosTerminalExitHandler(null);
  }, [onClose]);

  useEffect(() => {
    const unsubscribe = subscribeRatosTerminal((snapshot) => {
      setBootComplete(snapshot.bootComplete);
      setImageViewer(snapshot.imageViewer);
      setInput(snapshot.input);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const focusInput = () => inputRef.current?.focus({ preventScroll: true });
    focusInput();
    const frameId = window.requestAnimationFrame(focusInput);
    const timerId = window.setTimeout(focusInput, 0);
    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timerId);
    };
  }, []);

  useEffect(() => {
    if (imageViewer || !bootComplete) return undefined;
    inputRef.current?.focus({ preventScroll: true });
    return undefined;
  }, [bootComplete, imageViewer]);

  useEffect(() => {
    const hintTimer = window.setTimeout(() => setShowExitHint(false), 3200);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (imageViewer) {
          closeRatosImageViewer();
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

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!bootComplete || imageViewer) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'Escape') return;

      if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        submitRatosCommand(getRatosTerminalSnapshot().input);
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        event.stopPropagation();
        const current = getRatosTerminalSnapshot().input;
        setRatosTerminalInput(current.slice(0, -1));
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        event.stopPropagation();
        navigateRatosHistory(
          event.key === 'ArrowUp' ? 'up' : 'down',
          getRatosTerminalSnapshot().input,
        );
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [bootComplete, imageViewer]);

  useEffect(() => {
    const onKeyPress = (event) => {
      if (!bootComplete || imageViewer) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;

      event.preventDefault();
      event.stopPropagation();
      const current = getRatosTerminalSnapshot().input;
      setRatosTerminalInput(current + event.key);
    };

    document.addEventListener('keypress', onKeyPress, true);
    return () => document.removeEventListener('keypress', onKeyPress, true);
  }, [bootComplete, imageViewer]);

  const onSubmit = (event) => {
    event.preventDefault();
    submitRatosCommand(input);
  };

  const onInputKeyDown = (event) => {
    event.stopPropagation();
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    navigateRatosHistory(event.key === 'ArrowUp' ? 'up' : 'down', input);
  };

  return (
    <div className="lidc-ratos-input-capture" role="presentation">
      <form className="lidc-ratos-input-capture-form" onSubmit={onSubmit}>
        <input
          ref={inputRef}
          className="lidc-ratos-input-capture-field"
          type="text"
          value={input}
          onChange={(event) => setRatosTerminalInput(event.target.value)}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t('lidc.storyline.terminal.inputLabel')}
        />
      </form>

      {showExitHint && (
        <LidcStorylineHudNotice
          primaryLabel={t('lidc.storyline.backToRoom')}
          secondary={bootComplete
            ? t('lidc.storyline.terminal.exitHint')
            : t('lidc.storyline.terminal.biosLoading')}
          fadeOut
        />
      )}
    </div>
  );
}
