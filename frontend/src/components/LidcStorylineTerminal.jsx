import { useEffect, useRef, useState } from 'react';
import {
  closeRatosImageViewer,
  closeRatosPhoenixGame,
  closeRatosWinRatGame,
  getRatosTerminalSnapshot,
  navigateRatosHistory,
  setRatosTerminalExitHandler,
  setRatosTerminalInput,
  submitRatosCommand,
  subscribeRatosTerminal,
} from '../utils/ratosTerminalStore';
import {
  handlePhoenixKeyDown,
  handlePhoenixKeyUp,
} from '../utils/lidcPhoenixDecryptorGame';
import { handleWinRatKeyDown } from '../utils/lidcWinRatGame';
import { t } from '../utils/locale';
import { LidcStorylineHudNotice } from './LidcStorylineHud';
import './LidcStorylineTerminal.css';

export default function LidcStorylineTerminal({ onClose }) {
  const [bootComplete, setBootComplete] = useState(false);
  const [imageViewer, setImageViewer] = useState(null);
  const [phoenixGame, setPhoenixGame] = useState(false);
  const [winratGame, setWinratGame] = useState(false);
  const [input, setInput] = useState('');
  const [showExitHint, setShowExitHint] = useState(true);
  const inputRef = useRef(null);

  const overlayGame = phoenixGame || winratGame;

  useEffect(() => {
    setRatosTerminalExitHandler(onClose);
    return () => setRatosTerminalExitHandler(null);
  }, [onClose]);

  useEffect(() => {
    const unsubscribe = subscribeRatosTerminal((snapshot) => {
      setBootComplete(snapshot.bootComplete);
      setImageViewer(snapshot.imageViewer);
      setPhoenixGame(Boolean(snapshot.phoenixGame));
      setWinratGame(Boolean(snapshot.winratGame));
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
    if (imageViewer || overlayGame || !bootComplete) return undefined;
    inputRef.current?.focus({ preventScroll: true });
    return undefined;
  }, [bootComplete, imageViewer, overlayGame]);

  useEffect(() => {
    const hintTimer = window.setTimeout(() => setShowExitHint(false), 3200);

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (phoenixGame) {
          closeRatosPhoenixGame();
          return;
        }
        if (winratGame) {
          closeRatosWinRatGame();
          return;
        }
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
  }, [imageViewer, phoenixGame, winratGame, onClose]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (!bootComplete || imageViewer) return;
      if (phoenixGame) {
        if (handlePhoenixKeyDown(event)) {
          event.stopPropagation();
        }
        return;
      }
      if (winratGame) {
        if (handleWinRatKeyDown(event)) {
          event.stopPropagation();
        }
        return;
      }
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

    const onKeyUp = (event) => {
      if (phoenixGame) handlePhoenixKeyUp(event);
    };

    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('keyup', onKeyUp, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keyup', onKeyUp, true);
    };
  }, [bootComplete, imageViewer, phoenixGame, winratGame]);

  useEffect(() => {
    const onKeyPress = (event) => {
      if (!bootComplete || imageViewer || overlayGame) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.length !== 1) return;

      event.preventDefault();
      event.stopPropagation();
      const current = getRatosTerminalSnapshot().input;
      setRatosTerminalInput(current + event.key);
    };

    document.addEventListener('keypress', onKeyPress, true);
    return () => document.removeEventListener('keypress', onKeyPress, true);
  }, [bootComplete, imageViewer, overlayGame]);

  const onSubmit = (event) => {
    event.preventDefault();
    if (overlayGame) return;
    submitRatosCommand(input);
  };

  const onInputKeyDown = (event) => {
    if (overlayGame) {
      event.preventDefault();
      return;
    }
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
          value={overlayGame ? '' : input}
          onChange={(event) => {
            if (overlayGame) return;
            setRatosTerminalInput(event.target.value);
          }}
          onKeyDown={onInputKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          aria-label={t('lidc.storyline.terminal.inputLabel')}
        />
      </form>

      {showExitHint && !overlayGame && (
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
