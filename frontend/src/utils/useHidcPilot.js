import { useCallback, useEffect, useState } from 'react';
import * as api from '../services/api';
import socketService from '../services/socket';

const REFRESH_MS = 20000;

/**
 * HIDC pilot profile for the signed-in user: DCS link state, XP/level from DCORE,
 * link actions (chat/marker code, Discord DM, unlink) and the XP leaderboard.
 */
export default function useHidcPilot(userId) {
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ text: '', tone: '' });

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [me, board] = await Promise.all([
        api.getHidcPilotProfile(),
        api.getHidcPilotLeaderboard().catch(() => ({ pilots: [] })),
      ]);
      setProfile(me);
      setLeaderboard(Array.isArray(board?.pilots) ? board.pilots : []);
    } catch (error) {
      setMessage({ text: error?.message || 'Profilo pilota non disponibile.', tone: 'warn' });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    const unsubscribe = socketService.on('hidc:pilot-linked', (payload) => {
      if (!payload?.discordId || payload.discordId === userId) load();
    });
    return () => {
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [load, userId]);

  const run = useCallback(async (key, fn, okText) => {
    setBusy(key);
    setMessage({ text: '', tone: '' });
    try {
      await fn();
      if (okText) setMessage({ text: okText, tone: 'ok' });
      await load();
    } catch (error) {
      setMessage({ text: error?.message || 'Operazione non riuscita.', tone: 'warn' });
    } finally {
      setBusy('');
    }
  }, [load]);

  const startLink = useCallback(() => run('start', api.startHidcPilotLink), [run]);
  const sendByDiscord = useCallback(
    () => run('dm', api.sendHidcPilotLinkByDiscord, 'Codice inviato in DM dal bot Discord.'),
    [run],
  );
  const unlink = useCallback(() => run('unlink', api.unlinkHidcPilot, 'Account DCS scollegato.'), [run]);

  const copyCode = useCallback(async () => {
    const code = profile?.pending?.code;
    if (!code || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(code);
      setMessage({ text: 'Codice copiato.', tone: 'ok' });
    } catch {
      /* clipboard not available */
    }
  }, [profile?.pending?.code]);

  return { profile, leaderboard, loading, busy, message, startLink, sendByDiscord, unlink, copyCode };
}
