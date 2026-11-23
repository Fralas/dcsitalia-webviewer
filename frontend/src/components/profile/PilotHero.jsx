import { Copy, Link2, Loader2, MessageCircle, Unlink, User as UserIcon } from 'lucide-react';
import RankInsignia from './RankInsignia';
import { getNextTier, getPilotRank, getRankTier, PILOT_MAX_LEVEL } from '../../config/pilotRanks';

const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

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
          Dal livello {profile?.minStartLevel ?? 5} puoi avviare la votazione per cambiare la regione attiva.
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
        Dal livello {profile?.minStartLevel ?? 5} puoi avviare la votazione per cambiare la regione attiva.
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

function metaLine(user, profile) {
  const handle = user.username ? `@${user.username}` : user.id;
  const dcsName = profile?.stats?.name || profile?.link?.name;
  return profile?.linked && dcsName ? `${handle} · DCS: ${dcsName}` : handle;
}

/** Road to the next rank: one notch per level of the current rank, current level partly filled. */
function RankProgress({ levelInfo }) {
  const level = levelInfo.level;
  const tier = getRankTier(level);
  const next = getNextTier(level);
  const inLevel = levelInfo.nextLevelXp
    ? Math.min(1, (levelInfo.xp - levelInfo.levelXp) / Math.max(1, levelInfo.nextLevelXp - levelInfo.levelXp))
    : 1;
  const toNextLevel = levelInfo.nextLevelXp ? levelInfo.nextLevelXp - levelInfo.xp : 0;

  const levels = [];
  for (let l = tier.from; l < (next ? next.from : tier.to + 1); l += 1) levels.push(l);

  let caption = 'Grado massimo raggiunto';
  if (next) {
    const left = next.from - level;
    caption = `Livello ${level + 1} tra ${fmt(toNextLevel)} XP · ${left === 1 ? 'ultimo livello' : `${left} livelli`} a ${next.name}`;
  }

  return (
    <div className="pf-hero__progress">
      <div className="pf-track__line">
        {levels.map((l) => {
          const fill = l < level ? 1 : l === level ? inLevel : 0;
          return (
            <span key={l} className={`pf-track__seg${l === level ? ' is-current' : ''}`} title={`Livello ${l}`}>
              <i style={{ width: `${Math.round(fill * 100)}%` }} />
            </span>
          );
        })}
      </div>
      <div className="pf-hero__caption">
        <span>{caption}</span>
        {next && (
          <span className="pf-hero__next" title={`Prossimo grado: ${next.name}`}>
            <RankInsignia level={next.from} size={22} />
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Account footer for linked pilots: unlinking is destructive, so it sits at the bottom of the
 * page instead of next to the pilot name.
 */
export function AccountFooter({ user, pilot }) {
  const { profile, busy, unlink } = pilot;
  if (!profile?.linked) return null;
  return (
    <section className="pf-section pf-account">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Account DCS</h2>
      </div>
      <p className="pf-account__meta">{metaLine(user, profile)}</p>
      {profile.linkSource === 'dcsserverbot' ? (
        <p className="pf-account__meta">Collegato con /linkme di DCSServerBot.</p>
      ) : (
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
    </section>
  );
}

/**
 * One header block: avatar with the rank insignia on it, rank as the kicker, name, and the road to
 * the next rank right under the name. Before the DCS link, the link flow takes the progress' place.
 */
export default function PilotHero({ user, displayName, avatarUrl, pilot }) {
  const { profile, loading, message } = pilot;
  const linked = Boolean(profile?.linked);
  const levelInfo = profile?.level || { level: 0, xp: 0 };
  const rank = linked ? getPilotRank(levelInfo.level) : null;
  const note = message.text || (linked && profile && !profile.statsAvailable
    ? 'Statistiche DCS non ancora disponibili: si aggiornano mentre voli sul server.'
    : '');
  const toneClass = message.tone ? ` is-${message.tone}` : '';

  return (
    <header className="pf-hero">
      <div className="pf-hero__avatar">
        <div className="profile__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <div className="profile__avatar-fallback"><UserIcon className="h-8 w-8" /></div>
          )}
        </div>
        {rank && (
          <span className="pf-hero__insignia" title={rank.fullName}>
            <RankInsignia level={levelInfo.level} size={40} />
          </span>
        )}
      </div>

      <div className="pf-hero__body">
        <p className="profile__kicker">
          {rank ? `${rank.fullName} · Livello ${levelInfo.level} / ${levelInfo.maxLevel ?? PILOT_MAX_LEVEL}` : 'Profilo'}
        </p>
        <h1 className="pf-hero__name">{displayName}</h1>
        <p className="profile__meta">{metaLine(user, profile)}</p>

        {loading && !profile && (
          <div className="profile__status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Caricamento
          </div>
        )}
        {linked && <RankProgress levelInfo={levelInfo} />}
        {!linked && profile && <div className="pf-hero__link"><LinkBlock pilot={pilot} /></div>}
        {note && <p className={`profile-msg pf-hero__msg${toneClass}`}>{note}</p>}
      </div>
    </header>
  );
}
