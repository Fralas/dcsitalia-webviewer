import { Swords } from 'lucide-react';
import useHidcCampaign from '../../utils/useHidcCampaign';

function regionNumber(id) {
  const match = String(id || '').match(/(\d+)$/);
  return match ? match[1] : '—';
}

function formatRemaining(endsAt) {
  const ms = (Number(endsAt) || 0) - Date.now();
  if (ms <= 0) return 'in chiusura';
  const min = Math.ceil(ms / 60000);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}m`;
}

/**
 * HIDC campaign brief: BLUE attack base vs active RED region, territory control, region vote.
 */
export default function CampaignBrief() {
  const { campaign } = useHidcCampaign();
  if (!campaign) return null;
  const focus = campaign.focus || {};
  const vote = campaign.vote?.status === 'open' ? campaign.vote : null;
  const rules = campaign.rules || {};
  const me = campaign.me || null;
  const regions = Object.values(campaign.regionStatus || {});
  const blue = regions.filter((s) => s === 'blue').length;
  const bluePct = regions.length ? Math.round((blue / regions.length) * 100) : 0;

  let voteLine = focus.target
    ? `Alla conquista di Regione ${regionNumber(focus.target)} la votazione parte da sola.`
    : 'Nessuna votazione in corso.';
  if (vote) {
    voteLine = `Si vota la prossima regione: ${vote.total}/${rules.minVotes ?? 3} voti minimi, chiude tra ${formatRemaining(vote.endsAt)}.`;
  }
  let actionLine = 'Collega l\'account DCS per partecipare.';
  if (me?.linked) {
    if (vote) {
      if (!me.voteLevelOk) actionLine = `Potrai votare dal livello ${rules.minVoterLevel ?? 0}.`;
      else actionLine = vote.myBallot ? 'Il tuo voto è registrato: puoi cambiarlo dalla mappa.' : 'Vota dalla mappa.';
    } else if (me.canStart) actionLine = 'Puoi avviare una votazione per cambiare regione dalla mappa.';
    else if (!me.startLevelOk) actionLine = `Dal livello ${rules.minStartLevel ?? 5} potrai avviare una votazione.`;
    else actionLine = 'Voterai dalla mappa.';
  }

  return (
    <section className="pf-block">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Campagna</h2>
      </div>

      {focus.available && (
        <div className="pf-war">
          <div className="pf-war__side is-blue">
            <span className="pf-war__label">Base d&apos;attacco</span>
            <span className="pf-war__region">Regione {regionNumber(focus.from)}</span>
          </div>
          <div className="pf-war__front" aria-hidden="true">
            <span className="pf-war__line" />
            <Swords className="pf-war__icon" />
            <span className="pf-war__line" />
          </div>
          <div className="pf-war__side is-red">
            <span className="pf-war__label">Regione attiva</span>
            <span className="pf-war__region">Regione {regionNumber(focus.target)}</span>
          </div>
        </div>
      )}

      {regions.length > 0 && (
        <div className="pf-control">
          <div className="pf-control__bar">
            <span className="is-blue" style={{ width: `${bluePct}%` }} />
            <span className="is-red" style={{ width: `${100 - bluePct}%` }} />
          </div>
          <div className="pf-control__legend">
            <span className="is-blue">{blue} regioni blue</span>
            <span>Controllo territorio {bluePct}%</span>
            <span className="is-red">{regions.length - blue} regioni red</span>
          </div>
        </div>
      )}

      <p className="pf-note">
        {voteLine} <span className="pf-note__accent">{actionLine}</span>
      </p>
    </section>
  );
}
