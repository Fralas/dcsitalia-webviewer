import { useEffect, useRef, useState } from 'react';
import {
  closeRatosImageViewer,
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
    if (imageViewer || !bootComplete) return;
    inputRef.current?.focus();
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

  const onSubmit = (event) => {
    event.preventDefault();
    submitRatosCommand(input);
  };

  const onInputKeyDown = (event) => {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    event.stopPropagation();
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
          disabled={!bootComplete}
          aria-label={t('lidc.storyline.terminal.inputLabel')}
        />
      </form>

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
