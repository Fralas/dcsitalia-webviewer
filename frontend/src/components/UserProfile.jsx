import { useMemo, useState } from 'react';
import {
  Award,
  Bomb,
  Crosshair,
  Plane,
  Shield,
  Star,
  Target,
  Trophy,
  User as UserIcon,
} from 'lucide-react';
import { useUser } from '../contexts/UserContext';

const LEADERBOARD_ENTRIES = [
  { position: 1, pilot: 'Col. Marco De Santis', callsign: 'VIPER 1', achievement: 245, tier: 'gold' },
  { position: 2, pilot: 'Ten. Col. Andrea Bianchi', callsign: 'BANSHEE 2', achievement: 210, tier: 'silver' },
  { position: 3, pilot: 'Mag. Giuseppe Romano', callsign: 'WOLVERINE 3', achievement: 190, tier: 'bronze' },
  { position: 4, pilot: 'Cap. Matteo Conti', callsign: 'DRAGON 6', achievement: 172, tier: 'neutral' },
  { position: 5, pilot: 'Cap. Davide Rinaldi', callsign: 'GHOST 4', achievement: 158, tier: 'neutral' },
];

const FILTERS = ['TUTTI', 'COMBATTIMENTO', 'MISSIONI', 'ABILITA DI VOLO', 'SUPPORTO', 'SPECIALI'];

const ACHIEVEMENTS = [
  {
    id: 'asso',
    title: 'ASSO DEI CIELI',
    description: 'Ottieni 25 kill confermate.',
    date: '12/03/2024',
    category: 'COMBATTIMENTO',
    tier: 'gold',
    Icon: Star,
  },
  {
    id: 'maestro',
    title: 'MAESTRO DELLA MANOVRA',
    description: 'Completa 10 missioni con rating S.',
    date: '28/03/2024',
    category: 'ABILITA DI VOLO',
    tier: 'silver',
    Icon: Plane,
  },
  {
    id: 'cacciatore',
    title: 'CACCIATORE INVISIBILE',
    description: 'Esegui 5 kill senza essere rilevato.',
    date: '05/04/2024',
    category: 'COMBATTIMENTO',
    tier: 'silver',
    Icon: Target,
  },
  {
    id: 'bombardiere',
    title: 'BOMBARDIERE',
    description: 'Distruggi 50 obiettivi a terra.',
    date: '18/04/2024',
    category: 'MISSIONI',
    tier: 'gold',
    Icon: Bomb,
  },
  {
    id: 'scorta',
    title: 'SCORTA FEDELE',
    description: 'Proteggi alleati per 15 missioni.',
    date: '30/04/2024',
    category: 'SUPPORTO',
    tier: 'silver',
    Icon: Shield,
  },
  {
    id: 'missione-compiuta',
    title: 'MISSIONE COMPIUTA',
    description: 'Completa 20 missioni principali.',
    date: '15/05/2024',
    category: 'MISSIONI',
    tier: 'gold',
    Icon: Trophy,
  },
  {
    id: 'occhio',
    title: 'OCCHIO DI FALCO',
    description: 'Effettua 30 headshot in aria.',
    date: '22/05/2024',
    category: 'ABILITA DI VOLO',
    tier: 'gold',
    Icon: Crosshair,
  },
  {
    id: 'ritorno',
    title: 'RITORNO A CASA',
    description: 'Rientra alla base dopo 5 danni critici.',
    date: '02/06/2024',
    category: 'SPECIALI',
    tier: 'bronze',
    Icon: Award,
  },
  {
    id: 'guastafeste',
    title: 'GUASTAFESTE',
    description: 'Distruggi 10 sistemi antiaerei.',
    date: '16/06/2024',
    category: 'COMBATTIMENTO',
    tier: 'silver',
    Icon: Crosshair,
  },
  {
    id: 'veterano',
    title: 'VETERANO DEI CIELI',
    description: 'Raggiungi livello 20.',
    date: '01/07/2024',
    category: 'SPECIALI',
    tier: 'gold',
    Icon: Star,
  },
];

const TIER_BADGE_STYLES = {
  gold: 'border-amber-300/65 bg-amber-300/10 text-amber-200',
  silver: 'border-slate-300/65 bg-slate-300/10 text-slate-200',
  bronze: 'border-orange-300/65 bg-orange-300/10 text-orange-200',
  neutral: 'border-slate-500/60 bg-slate-500/10 text-slate-300',
};

function ProfileStatCard({ label, value, icon: Icon }) {
  return (
    <div className="rounded-2xl border border-yt-border/80 bg-[#0f1826c7] p-4 text-center">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-yt-accent/50 bg-yt-accent/15 text-yt-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-3xl font-black text-yt-text-primary">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">{label}</div>
    </div>
  );
}

export default function UserProfile() {
  const { user, profile } = useUser();
  const [activeFilter, setActiveFilter] = useState('TUTTI');
  const visibleAchievements = useMemo(() => {
    if (activeFilter === 'TUTTI') {
      return ACHIEVEMENTS;
    }
    return ACHIEVEMENTS.filter((achievement) => achievement.category === activeFilter);
  }, [activeFilter]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-yt-border bg-yt-bg-secondary p-8 text-center">
        <UserIcon className="w-12 h-12 text-yt-text-secondary mx-auto mb-3" />
        <p className="text-base text-yt-text-primary font-medium">Accedi con Discord per vedere il profilo.</p>
        <p className="text-xs text-yt-text-secondary mt-1">Usa il pulsante di login in alto a destra.</p>
      </div>
    );
  }

  const displayName = user.globalName || user.username;
  const avatarUrl = user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;
  const missionsCompleted = profile?.stats?.missionsCompleted > 0 ? profile.stats.missionsCompleted : 152;
  const recognitions = 15;
  const level = 28;
  const currentXp = 7250;
  const targetXp = 9000;
  const ownPosition = 12;
  const ownAchievement = 120;
  const progressPercentage = Math.min(100, Math.round((currentXp / targetXp) * 100));

  return (
    <div className="mx-auto w-full max-w-[1360px] space-y-5 pb-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-[#2a4f80]/70 bg-[radial-gradient(circle_at_18%_12%,rgba(78,197,255,0.18),transparent_42%),linear-gradient(145deg,#0a1320_0%,#0e1b2e_56%,#08121f_100%)] p-5 shadow-[0_14px_36px_rgba(0,0,0,0.35)]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-44 w-44 overflow-hidden rounded-full border-2 border-yt-accent/65 bg-[#111e30] p-1 shadow-[0_0_30px_rgba(78,197,255,0.22)]">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0d1827]">
                  <UserIcon className="h-14 w-14 text-yt-text-secondary" />
                </div>
              )}
            </div>

            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-yt-accent">CAPITANO</div>
            <h2 className="mt-1 text-4xl font-black tracking-tight text-yt-text-primary">{displayName}</h2>
            <p className="mt-2 text-sm text-yt-text-secondary">
              Callsign: <span className="font-semibold text-yt-accent">FALCON 1</span>
            </p>
          </div>

          <div className="mt-6 rounded-2xl border border-yt-border/75 bg-[#0c1523cc] p-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-yt-accent/70 bg-yt-accent/15 text-3xl font-black text-yt-accent">
                {level}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-yt-text-secondary">Livello</div>
                <div className="mt-2 h-2.5 rounded-full bg-[#1a2a42]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-yt-accent to-sky-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="mt-1 text-xs font-semibold text-yt-text-secondary">
                  {currentXp.toLocaleString('it-IT')} / {targetXp.toLocaleString('it-IT')} XP
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <ProfileStatCard label="Missioni completate" value={missionsCompleted} icon={Target} />
            <ProfileStatCard label="Riconoscimenti" value={recognitions} icon={Award} />
          </div>
        </section>

        <section className="rounded-3xl border border-yt-border/80 bg-[radial-gradient(circle_at_80%_0%,rgba(78,197,255,0.18),transparent_44%),linear-gradient(160deg,#0b1524_0%,#0e1a2b_58%,#091321_100%)] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.33)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-3xl font-black uppercase tracking-[0.06em] text-yt-text-primary">Leaderboard Totale</h3>
              <p className="text-sm text-yt-text-secondary">Classifica globale di tutti i piloti militari</p>
            </div>
            <div className="inline-flex items-center rounded-lg border border-yt-border/80 bg-[#0d1625] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary">
              Totale
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-yt-border/75 bg-[#0a1320cf]">
            <div className="grid grid-cols-[72px_minmax(0,1fr)_108px] border-b border-yt-border/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-yt-text-secondary">
              <span>Pos.</span>
              <span>Pilota</span>
              <span className="text-right">Achievement</span>
            </div>

            {LEADERBOARD_ENTRIES.map((entry) => (
              <div key={entry.position} className="grid grid-cols-[72px_minmax(0,1fr)_108px] items-center border-b border-yt-border/40 px-4 py-2.5 last:border-b-0">
                <div className="text-sm font-bold text-yt-text-primary">
                  <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm ${TIER_BADGE_STYLES[entry.tier]}`}>
                    {entry.position}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-yt-text-primary">{entry.pilot}</p>
                  <p className="text-xs font-semibold uppercase tracking-[0.07em] text-yt-accent">{entry.callsign}</p>
                </div>
                <div className="text-right text-4xl font-black tracking-tight text-yt-text-primary">{entry.achievement}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-yt-accent/55 bg-yt-accent/10 px-5 py-3">
            <div className="grid grid-cols-[56px_minmax(0,1fr)_100px] items-center gap-3">
              <div className="text-center text-4xl font-black tracking-tight text-yt-accent">{ownPosition}</div>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold text-yt-text-primary">Cap. {displayName} (Tu)</p>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-yt-accent">FALCON 1</p>
              </div>
              <div className="text-right text-5xl font-black tracking-tight text-yt-accent">{ownAchievement}</div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-yt-border/80 bg-[radial-gradient(circle_at_20%_-10%,rgba(78,197,255,0.17),transparent_46%),linear-gradient(165deg,#0a1422_0%,#0e1a2b_55%,#091423_100%)] p-5 shadow-[0_14px_34px_rgba(0,0,0,0.3)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-4xl font-black uppercase tracking-[0.04em] text-yt-text-primary">I miei riconoscimenti</h3>
            <p className="text-sm text-yt-text-secondary">Tutte le medaglie che hai ottenuto</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-yt-border/75 bg-[#0b1523] px-3 py-1.5">
            <Trophy className="h-4 w-4 text-yt-accent" />
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-yt-text-secondary">
              {visibleAchievements.length} visibili
            </span>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((filterName) => {
            const active = filterName === activeFilter;
            return (
              <button
                key={filterName}
                type="button"
                onClick={() => setActiveFilter(filterName)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.08em] transition-all ${
                  active
                    ? 'border-yt-accent bg-yt-accent/20 text-yt-accent'
                    : 'border-yt-border/75 bg-[#0f1928] text-yt-text-secondary hover:border-yt-accent/50 hover:text-yt-text-primary'
                }`}
              >
                {filterName}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {visibleAchievements.map(({ id, Icon, title, description, date, tier }) => (
            <article key={id} className="rounded-2xl border border-yt-border/75 bg-[#0d1726cc] p-3 shadow-[0_8px_18px_rgba(0,0,0,0.24)]">
              <div className="mb-3 flex justify-center">
                <div className={`inline-flex h-20 w-20 items-center justify-center rounded-full border ${TIER_BADGE_STYLES[tier]} shadow-[0_0_18px_rgba(0,0,0,0.28)]`}>
                  <Icon className="h-9 w-9" />
                </div>
              </div>
              <h4 className="text-center text-sm font-bold uppercase tracking-[0.06em] text-yt-text-primary">{title}</h4>
              <p className="mt-1.5 min-h-[42px] text-center text-xs leading-relaxed text-yt-text-secondary">{description}</p>
              <p className="mt-2 text-center text-[11px] font-semibold text-yt-accent">{date}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 text-center text-xs font-semibold text-yt-text-secondary">1 / 4</div>
      </section>
    </div>
  );
}
