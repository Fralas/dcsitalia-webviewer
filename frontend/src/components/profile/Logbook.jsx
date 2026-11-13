const fmt = (n) => (Number(n) || 0).toLocaleString('it-IT');

// DCS unit type -> readable name; unknown types fall back to the raw name without underscores.
const AIRCRAFT_NAMES = {
  'F-16C_50': 'F-16C Viper',
  'FA-18C_hornet': 'F/A-18C Hornet',
  'F-14B': 'F-14B Tomcat',
  'F-14A-135-GR': 'F-14A Tomcat',
  'F-15ESE': 'F-15E Strike Eagle',
  'F-15C': 'F-15C Eagle',
  'A-10C_2': 'A-10C II',
  'A-10C': 'A-10C',
  'AV8BNA': 'AV-8B Harrier',
  'AH-64D_BLK_II': 'AH-64D Apache',
  'Ka-50_3': 'Ka-50 III',
  'Mi-24P': 'Mi-24P Hind',
  'Mi-8MT': 'Mi-8MTV2',
  'UH-1H': 'UH-1H Huey',
  'OH58D': 'OH-58D Kiowa',
  'CH-47Fbl1': 'CH-47F Chinook',
  'M-2000C': 'Mirage 2000C',
  'JF-17': 'JF-17 Thunder',
  'MiG-29 Fulcrum': 'MiG-29',
  'Su-25T': 'Su-25T',
  'AJS37': 'AJS37 Viggen',
  'F-5E-3': 'F-5E Tiger II',
  'C-130J-30': 'C-130J',
};

function aircraftName(type) {
  return AIRCRAFT_NAMES[type] || String(type || '?').replace(/_/g, ' ');
}

function formatHours(sec) {
  const totalMin = Math.round((Number(sec) || 0) / 60);
  if (totalMin < 60) return `${totalMin}m`;
  return `${Math.floor(totalMin / 60)}h ${String(totalMin % 60).padStart(2, '0')}m`;
}

/**
 * Right-column logbook from DCSServerBot: aircraft flown (time bars), weapons (hit rate), carrier traps.
 */
export default function Logbook({ combat }) {
  if (!combat) return null;
  const aircraft = (combat.aircraft || []).filter((a) => a.sec > 0).slice(0, 6);
  const weapons = (combat.weapons || []).slice(0, 6);
  const maxSec = aircraft.reduce((m, a) => Math.max(m, a.sec), 0) || 1;
  const traps = combat.traps;

  return (
    <>
      <section className="pf-block">
        <div className="profile__section-head">
          <h2 className="profile__section-title">Velivoli</h2>
        </div>
        {aircraft.length === 0 ? (
          <p className="profile__empty">Nessun volo registrato.</p>
        ) : (
          <div className="pf-bars">
            {aircraft.map((a) => (
              <div key={a.type} className="pf-bars__row">
                <div className="pf-bars__head">
                  <span className="pf-bars__name">{aircraftName(a.type)}</span>
                  <span className="pf-bars__value">{formatHours(a.sec)}</span>
                </div>
                <div className="pf-bars__track">
                  <span style={{ width: `${Math.max(2, Math.round((a.sec / maxSec) * 100))}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {weapons.length > 0 && (
        <section className="pf-block">
          <div className="profile__section-head">
            <h2 className="profile__section-title">Armi</h2>
            <span className="pf-hint">Colpi a segno</span>
          </div>
          <div className="pf-bars">
            {weapons.map((w) => {
              const rate = w.shots ? Math.min(100, Math.round((w.hits / w.shots) * 100)) : 0;
              return (
                <div key={w.weapon} className="pf-bars__row">
                  <div className="pf-bars__head">
                    <span className="pf-bars__name">{w.weapon}</span>
                    <span className="pf-bars__value">{fmt(w.hits)} / {fmt(w.shots)} · {rate}%</span>
                  </div>
                  <div className="pf-bars__track is-rate">
                    <span style={{ width: `${rate}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {traps?.traps > 0 && (
        <section className="pf-block">
          <div className="profile__section-head">
            <h2 className="profile__section-title">Appontaggi</h2>
          </div>
          <dl className="pf-figures pf-figures--flat">
            <div><dt>Appontaggi</dt><dd>{fmt(traps.traps)}</dd></div>
            <div><dt>Media LSO</dt><dd>{traps.avgPoints != null ? traps.avgPoints.toLocaleString('it-IT', { maximumFractionDigits: 1 }) : '—'}</dd></div>
            <div><dt>Cavo 3</dt><dd>{fmt(traps.wire3)}</dd></div>
          </dl>
        </section>
      )}
    </>
  );
}
