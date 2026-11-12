import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Loader2, MessageCircle, Plane, Unlink } from 'lucide-react';
import * as api from '../services/api';
import socketService from '../services/socket';
import './HidcPilotCard.css';

const REFRESH_MS = 20000;

function formatFlightTime(seconds) {
  const totalMin = Math.floor((Number(seconds) || 0) / 60);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

function formatRemaining(expiresAt) {
  const ms = (Number(expiresAt) || 0) - Date.now();
  if (ms <= 0) return 'scaduto';
  return `${Math.ceil(ms / 60000)} min`;
}

/**
 * HIDC pilot profile: DCS account link (chat code / Discord DM), XP and level from DCORE.
 */
export default function HidcPilotCard({ userId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState({ text: '', tone: '' });

  const load = useCallback(async () => {
    try {
      setProfile(await api.getHidcPilotProfile());
    } catch (error) {
      setMessage({ text: error?.message || 'Profilo pilota non disponibile.', tone: 'warn' });
    } finally {
      setLoading(false);
    }
  }, []);

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

  const run = async (key, fn, okText) => {
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
  };

  const pending = profile?.pending || null;
  const level = profile?.level || null;
  const stats = profile?.stats || null;
  const progress = level?.nextLevelXp
    ? Math.min(100, Math.round(((level.xp - level.levelXp) / Math.max(1, level.nextLevelXp - level.levelXp)) * 100))
    : 100;

  const copyCode = async () => {
    if (!pending?.code || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(pending.code);
      setMessage({ text: 'Codice copiato.', tone: 'ok' });
    } catch {
      /* clipboard not available */
    }
  };

  return (
    <section className="pilot-card">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Pilota DCS</h2>
        {profile?.linked && level && <span className="pilot-card__level-tag">Livello {level.level}</span>}
      </div>

      {loading && (
        <div className="profile__status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Caricamento…</span>
        </div>
      )}

      {!loading && profile && !profile.linked && (
        <div className="pilot-card__link">
          <p className="pilot-card__copy">
            Collega il tuo account DCS per guadagnare esperienza volando sul server HIDC.
            Dal livello {profile.minProposerLevel} puoi proporre il cambio della regione attiva.
          </p>
          {pending ? (
            <div className="pilot-card__code-row">
              <div className="pilot-card__code">
                <span className="pilot-card__code-label">Scrivilo in chat DCS o come marker F10</span>
                <span className="pilot-card__code-value">{pending.code}</span>
                <span className="pilot-card__code-label">Scade tra {formatRemaining(pending.expiresAt)}</span>
              </div>
              <button type="button" className="profile-btn profile-btn--ghost" onClick={copyCode}>
                <Copy className="h-3.5 w-3.5" />
                Copia
              </button>
            </div>
          ) : null}
          <div className="profile-actions">
            {!pending && (
              <button
                type="button"
                className="profile-btn"
                disabled={Boolean(busy)}
                onClick={() => run('start', api.startHidcPilotLink)}
              >
                {busy === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Collega account DCS
              </button>
            )}
            {profile.botAvailable && (
              <button
                type="button"
                className="profile-btn profile-btn--ghost"
                disabled={Boolean(busy)}
                onClick={() => run('dm', api.sendHidcPilotLinkByDiscord, 'Codice inviato in DM dal bot Discord.')}
              >
                {busy === 'dm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                Inviamelo su Discord
              </button>
            )}
          </div>
        </div>
      )}

      {!loading && profile?.linked && (
        <div className="pilot-card__linked">
          <div className="pilot-card__ident">
            <Plane className="h-4 w-4" />
            <span className="pilot-card__callsign">{stats?.name || profile.link?.name || 'Pilota'}</span>
          </div>

          <div className="pilot-card__xp">
            <div className="pilot-card__xp-head">
              <span>{level?.xp ?? 0} XP</span>
              <span>{level?.nextLevelXp ? `Livello ${level.level + 1} a ${level.nextLevelXp} XP` : 'Livello massimo'}</span>
            </div>
            <div className="pilot-card__bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="pilot-card__stats">
            <div className="profile__stat">
              <span className="profile__stat-value">{formatFlightTime(stats?.flightSec)}</span>
              <span className="profile__stat-label">In volo</span>
            </div>
            <div className="profile__stat">
              <span className="profile__stat-value">{stats?.sorties ?? 0}</span>
              <span className="profile__stat-label">Sortite</span>
            </div>
            <div className="profile__stat">
              <span className="profile__stat-value">{level?.level ?? 1}</span>
              <span className="profile__stat-label">Livello</span>
            </div>
          </div>

          {!profile.statsAvailable && (
            <p className="profile-msg">Statistiche DCS non ancora disponibili: si aggiornano mentre voli sul server.</p>
          )}

          <div className="profile-actions">
            <button
              type="button"
              className="profile-btn profile-btn--ghost"
              disabled={Boolean(busy)}
              onClick={() => {
                if (window.confirm('Scollegare l\'account DCS? L\'esperienza resta legata al tuo UCID.')) {
                  run('unlink', api.unlinkHidcPilot, 'Account DCS scollegato.');
                }
              }}
            >
              <Unlink className="h-3.5 w-3.5" />
              Scollega
            </button>
          </div>
        </div>
      )}

      {message.text && <p className={`profile-msg pilot-card__msg${message.tone ? ` is-${message.tone}` : ''}`}>{message.text}</p>}
    </section>
  );
}
