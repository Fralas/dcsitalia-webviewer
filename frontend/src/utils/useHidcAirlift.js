import { useCallback, useEffect, useState } from 'react';
import { getHidcAirlift } from '../services/api';
import socketService from '../services/socket';

const REFRESH_MS = 20000;

/**
 * HIDC AI logistics missions (CH-47 / C-130) and crash sites to recover.
 * Polls the backend and refreshes on 'hidc:airlift-updated' socket events.
 */
export default function useHidcAirlift(enabled = true) {
  const [state, setState] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const next = await getHidcAirlift();
      setState(next);
      return next;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    const run = () => { if (!cancelled) refresh(); };
    run();
    const timer = window.setInterval(run, REFRESH_MS);
    const unsubscribe = socketService.on('hidc:airlift-updated', run);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [enabled, refresh]);

  return { airlift: state, refresh, setAirlift: setState };
}
