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

function Avatar({ avatarUrl, small = false }) {
  return (
    <div className={`profile__avatar${small ? ' profile__avatar--sm' : ''}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt="" />
      ) : (
        <div className="profile__avatar-fallback">
          <UserIcon className={small ? 'h-5 w-5' : 'h-7 w-7'} />
        </div>
      )}
    </div>
  );
}

function metaLine(user, profile) {
  const handle = user.username ? `@${user.username}` : user.id;
  const dcsName = profile?.stats?.name || profile?.link?.name;
  return profile?.linked && dcsName ? `${handle} · DCS: ${dcsName}` : handle;
}

/**
 * Compact identity for linked pilots: it sits in the Stato di servizio heading instead of a
 * full-width header, so career, combat and history start at the top of the page.
 */
export function PilotIdentity({ user, displayName, avatarUrl, pilot }) {
  const { profile, busy, unlink } = pilot;
  return (
    <div className="pf-ident">
      <Avatar avatarUrl={avatarUrl} small />
      <div className="pf-ident__copy">
        <h1 className="pf-ident__name">{displayName}</h1>
        <p className="pf-ident__meta">{metaLine(user, profile)}</p>
      </div>
      {profile?.linkSource !== 'dcsserverbot' && (
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
      )}
    </div>
  );
}

/**
 * Full-width header only until the DCS account is linked (identity + link flow).
 * Linked pilots get PilotIdentity inside Stato di servizio; here only a status message, if any.
 */
export default function PilotHero({ user, displayName, avatarUrl, pilot }) {
  const { profile, loading, message } = pilot;
  const linked = Boolean(profile?.linked);
  const note = message.text || (linked && profile && !profile.statsAvailable
    ? 'Statistiche DCS non ancora disponibili: si aggiornano mentre voli sul server.'
    : '');
  const toneClass = message.tone ? ` is-${message.tone}` : '';

  if (linked) {
    return note ? <p className={`profile-msg pf-head__note${toneClass}`}>{note}</p> : null;
  }

  return (
    <header className="pf-head">
      <div className="pf-head__id">
        <Avatar avatarUrl={avatarUrl} />
        <div className="profile__id-copy">
          <p className="profile__kicker">Profilo</p>
          <h1 className="profile__name">{displayName}</h1>
          <p className="profile__meta">{metaLine(user, profile)}</p>
        </div>
      </div>

      {loading && !profile ? (
        <div className="profile__status">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Caricamento
        </div>
      ) : (
        <div className="pf-head__link">
          <LinkBlock pilot={pilot} />
        </div>
      )}

      {note && <p className={`profile-msg pf-head__msg${toneClass}`}>{note}</p>}
    </header>
  );
}
