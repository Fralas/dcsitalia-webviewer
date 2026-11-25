import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Loader2, Play, Swords } from 'lucide-react';

// Closed / open is a per-viewer preference: remembered in this browser only.
const CLOSED_STORAGE_KEY = 'dcsitalia.hidcVotePanelClosed';

function readClosed() {
  try {
    return window.localStorage.getItem(CLOSED_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeClosed(closed) {
  try {
    window.localStorage.setItem(CLOSED_STORAGE_KEY, closed ? '1' : '0');
  } catch {
    // storage blocked (private window): the panel still works, it just is not remembered
  }
}
import { castHidcRegionBallot, startHidcRegionVote } from '../../services/api';
import './HidcRegionVotePanel.css';

const COPY = {
  it: {
    kicker: 'Campagna',
    title: 'Regione attiva',
    close: 'Chiudi pannello campagna',
    warFrom: 'Base d\'attacco',
    warTarget: 'Regione attiva',
    voteKicker: 'Votazione in corso',
    voteTitle: 'Prossima regione',
    none: 'Nessuna regione attiva.',
    from: 'da',
    conquered: (r) => `${r} conquistata! Scegli dove attaccare ora.`,
    pick: 'Scegli la regione da attaccare e da dove partire.',
    startedBy: (n) => `Avviata da: ${n}`,
    start: 'Avvia votazione',
    startHint: 'Proponi di cambiare la regione attiva: tutti i piloti votano dove attaccare e da dove partire.',
    startLevel: (min, lvl) => `Dal livello ${min} puoi avviare una votazione (tu: ${lvl}).`,
    cooldown: (m) => `Nuova votazione avviabile tra ${m} min.`,
    target: 'Regione da attaccare',
    base: 'Attacca da',
    votes: (n) => (n === 1 ? '1 voto' : `${n} voti`),
    submit: 'Vota',
    change: 'Cambia voto',
    myBallot: 'Il tuo voto',
    myBallotLine: (t, f, src) => `Hai votato ${t} da ${f}${src === 'discord' ? ' su Discord' : ''}: puoi cambiarlo qui o su Discord fino alla chiusura.`,
    endsIn: 'Chiude tra',
    quorum: (n, min) => `${n}/${min} voti minimi`,
    extended: 'Prorogata: non c\'erano ancora abbastanza voti.',
    passed: (t, f) => `Si attacca ${t} da ${f}: in attesa del server DCS.`,
    next: (r) => `Alla conquista di ${r} la votazione parte da sola.`,
    login: 'Accedi con Discord per votare.',
    link: 'Collega il tuo account DCS dal profilo per votare.',
    level: (min, lvl) => `Serve il livello ${min} per votare (tu: ${lvl}).`,
    unavailable: 'Stato campagna non disponibile.',
    last: 'Ultima votazione',
    status: { applied: 'applicata', failed: 'non applicata', cancelled: 'annullata', rejected: 'non valida', passed: 'in attesa' },
  },
  en: {
    kicker: 'Campaign',
    title: 'Active region',
    close: 'Close campaign panel',
    warFrom: 'Attack base',
    warTarget: 'Active region',
    voteKicker: 'Vote in progress',
    voteTitle: 'Next region',
    none: 'No active region.',
    from: 'from',
    conquered: (r) => `${r} captured! Choose where to attack next.`,
    pick: 'Pick the region to attack and where to attack from.',
    startedBy: (n) => `Started by: ${n}`,
    start: 'Start vote',
    startHint: 'Propose a change of active region: every pilot votes where to attack and where from.',
    startLevel: (min, lvl) => `From level ${min} you can start a vote (you: ${lvl}).`,
    cooldown: (m) => `A new vote can be started in ${m} min.`,
    target: 'Region to attack',
    base: 'Attack from',
    votes: (n) => (n === 1 ? '1 vote' : `${n} votes`),
    submit: 'Vote',
    change: 'Change vote',
    myBallot: 'Your vote',
    myBallotLine: (t, f, src) => `You voted ${t} from ${f}${src === 'discord' ? ' on Discord' : ''}: you can change it here or on Discord until it closes.`,
    endsIn: 'Closes in',
    quorum: (n, min) => `${n}/${min} minimum votes`,
    extended: 'Extended: not enough votes yet.',
    passed: (t, f) => `Attacking ${t} from ${f}: waiting for the DCS server.`,
    next: (r) => `When ${r} is captured the vote opens by itself.`,
    login: 'Sign in with Discord to vote.',
    link: 'Link your DCS account from your profile to vote.',
    level: (min, lvl) => `Level ${min} required to vote (you: ${lvl}).`,
    unavailable: 'Campaign state unavailable.',
    last: 'Last vote',
    status: { applied: 'applied', failed: 'not applied', cancelled: 'cancelled', rejected: 'not valid', passed: 'pending' },
  },
};

function regionLabel(regionId) {
  const match = String(regionId || '').match(/^REGION_(\d+)$/);
  return match ? `Region ${match[1]}` : String(regionId || '—');
}

function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0m';
  const totalMin = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  return hours > 0 ? `${hours}h ${String(minutes).padStart(2, '0')}m` : `${minutes}m`;
}

/**
 * HIDC region vote. A round opens by itself after a conquest, or a pilot of level >= 5 starts one to
 * change the active region. Every pilot picks the RED region to attack and the BLUE region to
 * attack from, and can change the ballot until the round closes.
 */
export default function HidcRegionVotePanel({ campaign, onCampaignChange, language = 'it' }) {
  const t = COPY[language] || COPY.it;
  const [collapsed, setCollapsedState] = useState(readClosed);
  const setCollapsed = (next) => {
    setCollapsedState((value) => {
      const resolved = typeof next === 'function' ? next(value) : next;
      writeClosed(resolved);
      return resolved;
    });
  };
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const focus = campaign?.focus;
  const vote = campaign?.vote;
  const me = campaign?.me;
  const rules = campaign?.rules;
  const open = vote?.status === 'open';
  const options = useMemo(() => (open ? vote.options || [] : []), [open, vote]);
  const myBallot = vote?.myBallot || null;
  const minVotes = rules?.minVotes ?? 3;

  // Start from the pilot's own ballot; reset when a new round opens or the ballot changes elsewhere
  // (e.g. voted from the Discord channel: one ballot per pilot, shared with the site).
  useEffect(() => {
    setTarget(myBallot?.target || '');
    setFrom(myBallot?.from || '');
    setError('');
  }, [vote?.id, myBallot?.target, myBallot?.from]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = options.find((option) => option.target === target) || null;
  useEffect(() => {
    if (!selected) {
      if (from) setFrom('');
    } else if (!selected.froms.some((f) => f.id === from)) {
      setFrom(selected.froms.length === 1 ? selected.froms[0].id : '');
    }
  }, [selected, from]);

  const maxVotes = Math.max(1, ...options.map((option) => option.votes));
  const unchanged = myBallot && myBallot.target === target && myBallot.from === from;

  let blocked = '';
  if (!me) blocked = t.login;
  else if (!me.linked) blocked = t.link;
  else if (!me.voteLevelOk) blocked = t.level(rules?.minVoterLevel ?? 0, me.level);

  const startRound = async () => {
    setBusy(true);
    setError('');
    try {
      const next = await startHidcRegionVote();
      if (next) onCampaignChange?.(next);
    } catch (err) {
      setError(err?.message || 'Errore');
    } finally {
      setBusy(false);
    }
  };

  let startBlocked = '';
  if (!me) startBlocked = t.login;
  else if (!me.linked) startBlocked = t.link;
  else if (!me.startLevelOk) startBlocked = t.startLevel(rules?.minStartLevel ?? 5, me.level);
  else if (me.startCooldownUntil) startBlocked = t.cooldown(Math.max(1, Math.ceil((me.startCooldownUntil - now) / 60000)));

  const submit = async () => {
    if (!target || !from || !vote) return;
    setBusy(true);
    setError('');
    try {
      const next = await castHidcRegionBallot(vote.id, target, from);
      if (next) onCampaignChange?.(next);
    } catch (err) {
      setError(err?.message || 'Errore');
    } finally {
      setBusy(false);
    }
  };


  // Closed: only a floating arrow on the map (same as the feed / missions panels); a gold dot while a vote is open.
  if (collapsed) {
    return (
      <button
        type="button"
        className={`hidc-vote-reopen${open ? ' has-vote' : ''}`}
        onClick={() => setCollapsed(false)}
        aria-label={open ? t.voteTitle : t.title}
        title={open ? t.voteTitle : t.title}
      >
        <ChevronRight strokeWidth={3} aria-hidden="true" />
        {open && <span className="hidc-vote-reopen__dot" aria-hidden="true" />}
      </button>
    );
  }

  return (
    <section className={`hidc-vote${open ? ' is-voting' : ''}`} aria-label={open ? t.voteTitle : t.title}>
      <button type="button" className="hidc-vote__head" onClick={() => setCollapsed(true)} aria-label={t.close} title={t.close}>
        <span className="hidc-vote__head-copy">
          <span className="hidc-vote__kicker">{open ? t.voteKicker : t.kicker}</span>
          {!open && focus?.target && focus?.from ? (
            // Same BLUE base vs RED region graphic as the profile campaign block (ProfilePage.css .pf-war).
            <span className="hidc-vote__war">
              <span className="hidc-vote__war-side is-blue">
                <span className="hidc-vote__war-label">{t.warFrom}</span>
                <span className="hidc-vote__war-region">{regionLabel(focus.from)}</span>
              </span>
              <span className="hidc-vote__war-front" aria-hidden="true">
                <span className="hidc-vote__war-line" />
                <Swords className="hidc-vote__war-icon" />
                <span className="hidc-vote__war-line" />
              </span>
              <span className="hidc-vote__war-side is-red">
                <span className="hidc-vote__war-label">{t.warTarget}</span>
                <span className="hidc-vote__war-region">{regionLabel(focus.target)}</span>
              </span>
            </span>
          ) : (
            <span className="hidc-vote__title">
              {open ? t.voteTitle : (focus?.target ? regionLabel(focus.target) : t.title)}
            </span>
          )}
        </span>
        {open && <span className="hidc-vote__time">{formatRemaining(vote.endsAt - now)}</span>}
        <ChevronLeft className="hidc-vote__close" strokeWidth={2.6} aria-hidden="true" />
      </button>

      {(
        <div className="hidc-vote__body">
          {!campaign && <p className="hidc-vote__msg">{t.unavailable}</p>}

          {open && (
            <div className="hidc-vote__ballot">
              <p className="hidc-vote__msg">
                {vote.conquered && t.conquered(regionLabel(vote.conquered))}
                {!vote.conquered && vote.startedBy && t.startedBy(vote.startedBy.name)}
                {!vote.conquered && !vote.startedBy && t.pick}
                {vote.extensions > 0 && <> {t.extended}</>}
              </p>

              <span className="hidc-vote__label">{t.target}</span>
              <ul className="hidc-vote__options">
                {options.map((option) => {
                  const isSel = option.target === target;
                  return (
                    <li key={option.target}>
                      <button
                        type="button"
                        className={`hidc-vote__option${isSel ? ' is-selected' : ''}`}
                        disabled={Boolean(blocked) || busy}
                        aria-pressed={isSel}
                        onClick={() => setTarget(option.target)}
                      >
                        <span className="hidc-vote__option-name">
                          {regionLabel(option.target)}
                          {myBallot?.target === option.target && <Check className="h-3 w-3" aria-label={t.myBallot} />}
                        </span>
                        <span className="hidc-vote__option-count">{t.votes(option.votes)}</span>
                        <span className="hidc-vote__option-bar"><i style={{ width: `${(option.votes / maxVotes) * 100}%` }} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {selected && (
                <>
                  <span className="hidc-vote__label">{t.base}</span>
                  <div className="hidc-vote__chips">
                    {selected.froms.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`hidc-vote__chip${from === f.id ? ' is-selected' : ''}`}
                        disabled={Boolean(blocked) || busy}
                        aria-pressed={from === f.id}
                        onClick={() => setFrom(f.id)}
                      >
                        {regionLabel(f.id)}
                        <small>{f.votes}</small>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {myBallot && !blocked && (
                <p className="hidc-vote__msg">{t.myBallotLine(regionLabel(myBallot.target), regionLabel(myBallot.from), myBallot.source)}</p>
              )}

              {blocked ? (
                <p className="hidc-vote__msg">{blocked}</p>
              ) : (
                <button
                  type="button"
                  className="hidc-vote__btn hidc-vote__btn--primary"
                  disabled={!target || !from || unchanged || busy}
                  onClick={submit}
                >
                  {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {myBallot ? t.change : t.submit}
                </button>
              )}

              <div className="hidc-vote__row hidc-vote__counts">
                <span className={vote.total >= minVotes ? 'is-valid' : ''}>{t.quorum(vote.total, minVotes)}</span>
                <span>{t.endsIn} {formatRemaining(vote.endsAt - now)}</span>
              </div>
            </div>
          )}

          {vote?.status === 'passed' && (
            <p className="hidc-vote__msg">{t.passed(regionLabel(vote.target), regionLabel(vote.from))}</p>
          )}

          {campaign && !open && vote?.status !== 'passed' && (
            <div className="hidc-vote__ballot">
              <p className="hidc-vote__msg">{focus?.target ? t.next(regionLabel(focus.target)) : t.none}</p>
              {me?.canStart ? (
                <>
                  <p className="hidc-vote__msg">{t.startHint}</p>
                  <button type="button" className="hidc-vote__btn hidc-vote__btn--primary" disabled={busy} onClick={startRound}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                    {t.start}
                  </button>
                </>
              ) : (
                startBlocked && focus?.target && <p className="hidc-vote__msg">{startBlocked}</p>
              )}
            </div>
          )}

          {error && <p className="hidc-vote__msg is-warn">{error}</p>}
        </div>
      )}
    </section>
  );
}
