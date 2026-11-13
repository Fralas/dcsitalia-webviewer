/**
 * How XP is earned, from the rules DCORE exports with the pilot stats.
 */
export default function XpRules({ rules, minProposerLevel = 5 }) {
  const perMinute = Number(rules?.xp_per_flight_minute) || 1;
  const perSortie = Number(rules?.xp_per_sortie) || 0;
  const sortieMin = Math.round((Number(rules?.sortie_min_sec) || 600) / 60);

  const rows = [
    [rules?.source === 'dcsserverbot' ? 'Minuto in slot' : 'Minuto in volo', `+${perMinute} XP`],
    perSortie ? [rules?.source === 'dcsserverbot' ? 'Sortita (decollo e atterraggio)' : `Sortita (decollo e atterraggio, min ${sortieMin} min)`, `+${perSortie} XP`] : null,
    ['Proposta cambio regione', `Livello ${minProposerLevel}`],
    ['Voto sulle proposte', 'Account collegato'],
  ].filter(Boolean);

  return (
    <section className="pf-block">
      <div className="profile__section-head">
        <h2 className="profile__section-title">Come si sale di grado</h2>
      </div>
      <div className="pf-rules">
        {rows.map(([label, value]) => (
          <div key={label} className="pf-rules__row">
            <span>{label}</span>
            <span className="pf-rules__value">{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
