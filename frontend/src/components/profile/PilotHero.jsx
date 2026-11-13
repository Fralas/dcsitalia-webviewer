import { Copy, Link2, Loader2, MessageCircle, Unlink, User as UserIcon } from 'lucide-react';

function formatRemaining(expiresAt) {
  const ms = (Number(expiresAt) || 0) - Date.now();
  if (ms <= 0) return 'scaduto';
  return `${Math.ceil(ms / 60000)} min`;
}

function LinkBlock({ pilot }) {
  const { profile, busy, startLink, sendByDiscord, copyCode } = pilot;
  if (profile?.linkSource === 'dcsserverbot') {
    return (
      <div className="pf-link">
        <p className="profile__kicker">Account DCS</p>
        <p className="pf-link__copy">
          Collega il tuo account DCS con il comando <strong>/linkme</strong> del bot sul Discord DCS Italia:
          grado e statistiche compaiono qui entro un minuto.
          Dal livello {profile?.minProposerLevel ?? 5} puoi proporre il cambio della regione attiva.
        </p>
      </div>
    );
  }
  const pending = profile?.pending || null;
  return (
    <div className="pf-link">
      <p className="profile__kicker">Account DCS</p>
      <p className="pf-link__copy">
        Collega il tuo account DCS per salire di grado volando sul server HIDC.
        Dal livello {profile?.minProposerLevel ?? 5} puoi proporre il cambio della regione attiva.
      </p>
      {pending && (
        <div className="pf-code">
          <div className="pf-code__box">
            <span className="pf-code__label">Scrivilo in chat DCS o come marker F10</span>
            <span className="pf-code__value">{pending.code}</span>
            <span className="pf-code__label">Scade tra {formatRemaining(pending.expiresAt)}</span>
          </div>
          <button type="button" className="profile-btn profile-btn--ghost" onClick={copyCode}>
            <Copy className="h-3.5 w-3.5" /> Copia
          </button>
        </div>
      )}
      <div className="profile-actions">
        {!pending && (
          <button type="button" className="profile-btn" disabled={Boolean(busy)} onClick={startLink}>
            {busy === 'start' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
            Collega account DCS
          </button>
        )}
        {profile?.botAvailable && (
          <button type="button" className="profile-btn profile-btn--ghost" disabled={Boolean(busy)} onClick={sendByDiscord}>
            {busy === 'dm' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
            Inviamelo su Discord
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Profile header: identity only. Rank and flight figures live in the Stato di servizio block;
 * the DCS link flow shows here until the account is linked.
 */
export default function PilotHero({ user, displayName, avatarUrl, pilot }) {
  const { profile, loading, busy, message, unlink } = pilot;
  const linked = Boolean(profile?.linked);
  const stats = profile?.stats || null;

  return (
    <header className={`pf-head${linked ? ' is-linked' : ''}`}>
      <div className="pf-head__id">
        <div className="profile__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <div className="profile__avatar-fallback">
              <UserIcon className="h-7 w-7" />
            </div>
          )}
        </div>
        <div className="profile__id-copy">
          <p className="profile__kicker">Profilo</p>
          <h1 className="profile__name">{displayName}</h1>
          <p className="profile__meta">
            {user.username ? `@${user.username}` : user.id}
            {linked && (stats?.name || profile?.link?.name) ? ` · DCS: ${stats?.name || profile?.link?.name}` : ''}
          </p>
        </div>
      </div>

      {loading && !profile ? (
        <div className="profile__status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Caricamento
        </div>
      ) : linked ? (profile?.linkSource === 'dcsserverbot' ? null : (
        <button
          type="button"
          className="pf-unlink"
          disabled={Boolean(busy)}
          onClick={() => {
            if (window.confirm('Scollegare l\'account DCS? L\'esperienza resta legata al tuo UCID.')) unlink();
          }}
        >
          <Unlink className="h-3 w-3" /> Scollega DCS
        </button>
      )) : (
        <div className="pf-head__link">
          <LinkBlock pilot={pilot} />
        </div>
      )}

      {(message.text || (linked && profile && !profile.statsAvailable)) && (
        <p className={`profile-msg pf-head__msg${message.tone ? ` is-${message.tone}` : ''}`}>
          {message.text || 'Statistiche DCS non ancora disponibili: si aggiornano mentre voli sul server.'}
        </p>
      )}
    </header>
  );
}
