import { Plus, Pencil } from 'lucide-react';
import { formatEventDate } from './dateFormat';

const LABELS = {
  en: {
    title: 'NOE EVENTS',
    registrationEnds: 'Registration ends',
    tacticalDay: 'TACTICAL DAY',
    discord: 'Join our DISCORD',
    empty: 'No upcoming events',
    manage: 'Manage events',
  },
  it: {
    title: 'EVENTI NOE',
    registrationEnds: 'Chiusura iscrizioni',
    tacticalDay: 'TACTICAL DAY',
    discord: 'Entra nel DISCORD',
    empty: 'Nessun evento in programma',
    manage: 'Gestisci eventi',
  },
};

export default function NoeEventsCard({
  event,
  language = 'en',
  canManage = false,
  onManage,
  discordUrl,
}) {
  const L = LABELS[language] || LABELS.en;

  return (
    <section className="noe-card" aria-label={L.title}>
      <div className="noe-card__header">
        <h2 className="noe-card__title">{L.title}</h2>
        {canManage && (
          <button
            type="button"
            className="noe-card__manage"
            onClick={onManage}
            title={L.manage}
            aria-label={L.manage}
          >
            {event ? <Pencil size={15} /> : <Plus size={16} />}
          </button>
        )}
      </div>

      {event ? (
        <>
          <div className="noe-card__date">{formatEventDate(event.missionDate)}</div>

          <div className="noe-card__rows">
            <div className="noe-card__row">
              <span className="noe-card__day">{formatEventDate(event.registrationEndsDate)}</span>
              <span className="noe-card__dash">-</span>
              <span className="noe-card__label">{L.registrationEnds}</span>
            </div>
            <div className="noe-card__row">
              <span className="noe-card__day">{formatEventDate(event.tacticalDayDate)}</span>
              <span className="noe-card__dash">-</span>
              <span className="noe-card__label noe-card__label--accent">{L.tacticalDay}</span>
            </div>
          </div>

          {event.operationName && (
            <div className="noe-card__operation">{event.operationName}</div>
          )}
        </>
      ) : (
        <div className="noe-card__empty">{L.empty}</div>
      )}

      {discordUrl && (
        <a
          className="noe-card__discord"
          href={discordUrl}
          target="_blank"
          rel="noreferrer"
        >
          {L.discord}
        </a>
      )}
    </section>
  );
}
