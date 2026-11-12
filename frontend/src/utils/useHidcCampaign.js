import { useCallback, useEffect, useState } from 'react';
import { getHidcCampaign } from '../services/api';
import socketService from '../services/socket';

const REFRESH_MS = 30000;

/**
 * Shared HIDC campaign state: active region, attack candidates, region status, region vote.
 * Polls the backend and refreshes on 'hidc:campaign-updated' socket events.
 */
export default function useHidcCampaign() {
  const [state, setState] = useState(null);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const next = await getHidcCampaign();
      setState(next);
      setError('');
      return next;
    } catch (err) {
      setError(err?.message || 'Stato campagna non disponibile');
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = () => { if (!cancelled) refresh(); };
    run();
    const timer = window.setInterval(run, REFRESH_MS);
    const unsubscribe = socketService.on('hidc:campaign-updated', run);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [refresh]);

  return { campaign: state, error, refresh, setCampaign: setState };
}
