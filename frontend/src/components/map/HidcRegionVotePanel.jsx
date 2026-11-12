import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, ThumbsDown, ThumbsUp, Vote } from 'lucide-react';
import { castHidcRegionBallot, proposeHidcRegionVote } from '../../services/api';
import './HidcRegionVotePanel.css';

const COPY = {
  it: {
    kicker: 'Campagna',
    title: 'Regione attiva',
    none: 'Nessuna regione attiva',
    from: 'da',
    vote: 'Votazione in corso',
    passed: 'Approvata, in attesa di DCS',
    yes: 'A favore',
    no: 'Contro',
    endsIn: 'Chiude tra',
    minVotes: 'voti minimi',
    propose: 'Proponi cambio regione',
    target: 'Regione da attaccare',
    base: 'Regione BLUE di partenza',
    submit: 'Proponi votazione',
    login: 'Accedi con Discord per votare.',
    link: 'Collega il tuo account DCS dal profilo per votare.',
    level: (min, lvl) => `Serve il livello ${min} per proporre (tu: ${lvl}).`,
    noCandidates: 'Nessuna regione attaccabile al momento.',
    unavailable: 'Stato campagna non disponibile.',
    last: 'Ultima votazione',
    proposedBy: 'proposta da',
    status: { applied: 'applicata', rejected: 'respinta', failed: 'fallita', cancelled: 'annullata' },
  },
  en: {
    kicker: 'Campaign',
    title: 'Active region',
    none: 'No active region',
    from: 'from',
    vote: 'Vote in progress',
    passed: 'Passed, waiting for DCS',
    yes: 'For',
    no: 'Against',
    endsIn: 'Closes in',
    minVotes: 'minimum votes',
    propose: 'Propose region change',
    target: 'Region to attack',
    base: 'BLUE staging region',
    submit: 'Start vote',
    login: 'Sign in with Discord to vote.',
    link: 'Link your DCS account from your profile to vote.',
    level: (min, lvl) => `Level ${min} required to propose (you: ${lvl}).`,
    noCandidates: 'No attackable region right now.',
    unavailable: 'Campaign state unavailable.',
    last: 'Last vote',
    proposedBy: 'proposed by',
    status: { applied: 'applied', rejected: 'rejected', failed: 'failed', cancelled: 'cancelled' },
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

export default function HidcRegionVotePanel({ campaign, onCampaignChange, language = 'it' }) {
  const t = COPY[language] || COPY.it;
  const [collapsed, setCollapsed] = useState(false);
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState('');
  const [busy, setBusy] = useState('');
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
  const candidates = useMemo(() => {
    const list = Array.isArray(focus?.candidates) ? focus.candidates : [];
    return list.filter((entry) => !(entry.target === focus?.target && entry.froms.length === 1 && entry.froms[0] === focus?.from));
  }, [focus]);
  const selectedCandidate = candidates.find((entry) => entry.target === target) || null;

  useEffect(() => {
    if (!selectedCandidate) {
      setFrom('');
    } else if (!selectedCandidate.froms.includes(from)) {
      setFrom(selectedCandidate.froms[0] || '');
    }
  }, [selectedCandidate, from]);

  const run = async (key, fn) => {
    setBusy(key);
    setError('');
    try {
      const next = await fn();
      if (next) onCampaignChange?.(next);
      return true;
    } catch (err) {
      setError(err?.message || 'Errore');
      return false;
    } finally {
      setBusy('');
    }
  };

  const handlePropose = (event) => {
    event.preventDefault();
    if (!target || !from) return;
    run('propose', () => proposeHidcRegionVote(target, from)).then((ok) => { if (ok) setTarget(''); });
  };

  const voteOpen = vote?.status === 'open';
  const yesPct = vote?.total ? Math.round((vote.yes / vote.total) * 100) : 0;

  let proposeHint = '';
  if (!me) proposeHint = t.login;
  else if (!me.linked) proposeHint = t.link;
  else if (me.level < (rules?.minProposerLevel || 5)) proposeHint = t.level(rules?.minProposerLevel || 5, me.level);
  else if (candidates.length === 0) proposeHint = t.noCandidates;

  return (
    <section className={`hidc-vote${collapsed ? ' is-collapsed' : ''}`} aria-label={t.title}>
      <button type="button" className="hidc-vote__head" onClick={() => setCollapsed((value) => !value)}>
        <span className="hidc-vote__head-copy">
          <span className="hidc-vote__kicker">{t.kicker}</span>
          <span className="hidc-vote__title">
            {focus?.target ? regionLabel(focus.target) : t.title}
            {focus?.target && focus?.from && (
              <span className="hidc-vote__title-from"> {t.from} {regionLabel(focus.from)}</span>
            )}
          </span>
        </span>
        {(voteOpen || vote?.status === 'passed') && <span className="hidc-vote__badge"><Vote className="h-3 w-3" /></span>}
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="hidc-vote__body">
          {!campaign && <p className="hidc-vote__msg">{t.unavailable}</p>}
          {campaign && !focus?.target && <p className="hidc-vote__msg">{t.none}</p>}

          {vote && (vote.status === 'open' || vote.status === 'passed') && (
            <div className="hidc-vote__ballot">
              <div className="hidc-vote__row">
                <span className="hidc-vote__label">{vote.status === 'open' ? t.vote : t.passed}</span>
                {vote.status === 'open' && (
                  <span className="hidc-vote__time">{t.endsIn} {formatRemaining(vote.endsAt - now)}</span>
                )}
              </div>
              <p className="hidc-vote__proposal">
                <strong>{regionLabel(vote.target)}</strong> {t.from} {regionLabel(vote.from)}
                <span className="hidc-vote__by"> · {t.proposedBy} {vote.proposedBy?.name || '—'}</span>
              </p>
              <div className="hidc-vote__bar" role="img" aria-label={`${vote.yes} / ${vote.no}`}>
                <span className="hidc-vote__bar-yes" style={{ width: `${yesPct}%` }} />
              </div>
              <div className="hidc-vote__row hidc-vote__counts">
                <span>{t.yes} {vote.yes}</span>
                <span>{vote.total}/{rules?.minVotes ?? '—'} {t.minVotes}</span>
                <span>{t.no} {vote.no}</span>
              </div>
              {voteOpen && me?.canVote && (
                <div className="hidc-vote__actions">
                  <button
                    type="button"
                    className={`hidc-vote__btn hidc-vote__btn--yes${vote.myChoice === 'yes' ? ' is-active' : ''}`}
                    disabled={Boolean(busy)}
                    onClick={() => run('yes', () => castHidcRegionBallot(vote.id, 'yes'))}
                  >
                    {busy === 'yes' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsUp className="h-3.5 w-3.5" />}
                    {t.yes}
                  </button>
                  <button
                    type="button"
                    className={`hidc-vote__btn hidc-vote__btn--no${vote.myChoice === 'no' ? ' is-active' : ''}`}
                    disabled={Boolean(busy)}
                    onClick={() => run('no', () => castHidcRegionBallot(vote.id, 'no'))}
                  >
                    {busy === 'no' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
                    {t.no}
                  </button>
                </div>
              )}
              {voteOpen && !me?.canVote && <p className="hidc-vote__msg">{me ? t.link : t.login}</p>}
            </div>
          )}

          {campaign && !(vote && (vote.status === 'open' || vote.status === 'passed')) && (
            me?.canPropose && candidates.length > 0 ? (
              <form className="hidc-vote__form" onSubmit={handlePropose}>
                <span className="hidc-vote__label">{t.propose}</span>
                <label className="hidc-vote__field">
                  <span>{t.target}</span>
                  <select value={target} onChange={(event) => setTarget(event.target.value)}>
                    <option value="">—</option>
                    {candidates.map((entry) => (
                      <option key={entry.target} value={entry.target}>{regionLabel(entry.target)}</option>
                    ))}
                  </select>
                </label>
                <label className="hidc-vote__field">
                  <span>{t.base}</span>
                  <select value={from} onChange={(event) => setFrom(event.target.value)} disabled={!selectedCandidate}>
                    {(selectedCandidate?.froms || []).map((regionId) => (
                      <option key={regionId} value={regionId}>{regionLabel(regionId)}</option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="hidc-vote__btn hidc-vote__btn--primary" disabled={!target || !from || Boolean(busy)}>
                  {busy === 'propose' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t.submit}
                </button>
              </form>
            ) : (
              proposeHint && <p className="hidc-vote__msg">{proposeHint}</p>
            )
          )}

          {error && <p className="hidc-vote__msg is-warn">{error}</p>}

          {campaign?.lastVote && (
            <p className="hidc-vote__last">
              {t.last}: {regionLabel(campaign.lastVote.target)} · {t.status[campaign.lastVote.status] || campaign.lastVote.status}
              {' '}({campaign.lastVote.yes}-{campaign.lastVote.no})
            </p>
          )}
        </div>
      )}
    </section>
  );
}
