import { useEffect, useRef, useState } from 'react';
import { ChevronUp, FlaskConical, Loader2 } from 'lucide-react';
import { setHidcTestLevel } from '../../services/api';
import './HidcTestLevelMenu.css';

/**
 * Test only: quick menu to force my pilot level and try level-locked features (votes, CH-47 / C-130J-30, missions).
 * Shown only when the backend allows it (campaign.me.testLevel: dev server + staff/tester account).
 */

const PRESETS = [0, 5, 6, 10, 25, 50, 100];

export default function HidcTestLevelMenu({ campaign, onCampaignChange }) {
  const testLevel = campaign?.me?.testLevel || null;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState('');
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    const onKey = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!testLevel) return null;

  const current = campaign?.me?.level ?? 0;
  const forced = testLevel.forced;

  const apply = async (level) => {
    setBusy(true);
    setError('');
    try {
      const next = await setHidcTestLevel(level);
      if (next) onCampaignChange?.(next);
      setCustom('');
    } catch (err) {
      setError(err?.message || 'Non riuscito');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`hidc-test-level${open ? ' is-open' : ''}`} ref={rootRef}>
      {open && (
        <div className="hidc-test-level__menu" role="dialog" aria-label="Livello di test">
          <div className="hidc-test-level__head">
            <span>Livello di test</span>
            <small>Solo su questo server di sviluppo</small>
          </div>
          <div className="hidc-test-level__presets">
            {PRESETS.map((level) => (
              <button
                key={level}
                type="button"
                className={forced === level ? 'is-active' : ''}
                disabled={busy}
                onClick={() => apply(level)}
              >
                {level}
              </button>
            ))}
          </div>
          <form
            className="hidc-test-level__custom"
            onSubmit={(event) => {
              event.preventDefault();
              if (custom !== '') apply(Number(custom));
            }}
          >
            <input
              type="number"
              min={0}
              max={testLevel.max}
              value={custom}
              placeholder={`0 – ${testLevel.max}`}
              onChange={(event) => setCustom(event.target.value)}
              aria-label="Livello"
            />
            <button type="submit" disabled={busy || custom === ''}>Imposta</button>
          </form>
          <button type="button" className={`hidc-test-level__real${forced == null ? ' is-active' : ''}`} disabled={busy} onClick={() => apply(null)}>
            Usa il livello reale
          </button>
          {error && <p className="hidc-test-level__error">{error}</p>}
        </div>
      )}
      <button type="button" className="hidc-test-level__pill" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {busy ? <Loader2 size={13} className="hidc-test-level__spin" /> : <FlaskConical size={13} aria-hidden="true" />}
        <span>{forced == null ? 'Livello reale' : 'Test'}</span>
        <strong>Liv. {current}</strong>
        <ChevronUp size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
