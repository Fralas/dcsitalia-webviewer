import { useEffect, useRef, useState } from 'react';
import { CircleAlert } from 'lucide-react';
import './InlineError.css';

const ERROR_ANIM_MS = 320;

export default function InlineError({
  message = '',
  className = '',
  compact = false,
  align = 'center',
}) {
  const [displayed, setDisplayed] = useState('');
  const [phase, setPhase] = useState('closed');
  const hideTimerRef = useRef(null);

  useEffect(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }

    if (message) {
      setDisplayed(message);
      setPhase('open');
      return undefined;
    }

    setPhase((current) => (current === 'closed' ? 'closed' : 'closing'));
    hideTimerRef.current = window.setTimeout(() => {
      setDisplayed('');
      setPhase('closed');
      hideTimerRef.current = null;
    }, ERROR_ANIM_MS);

    return () => {
      if (hideTimerRef.current) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [message]);

  const slotClass = [
    'app-inline-error-slot',
    phase === 'open' ? 'is-open' : '',
    phase === 'closing' ? 'is-closing' : '',
    compact ? 'is-compact' : '',
    align === 'start' ? 'is-start' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      className={slotClass}
      role="status"
      aria-live="polite"
      aria-hidden={phase !== 'open'}
    >
      <div className="app-inline-error-clip">
        {displayed ? (
          <div className="app-inline-error" title={displayed}>
            <CircleAlert size={16} aria-hidden="true" />
            <span>{displayed}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
