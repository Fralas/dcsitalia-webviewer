import { useMemo, useState, useEffect } from 'react';
import { Package, Activity, Radio, ClipboardList, Megaphone, ShieldCheck, Target } from 'lucide-react';
import { t } from '../utils/locale';
import { getAirportName } from '../config/airports';
import { isAuthenticated } from '../utils/api';
import { useUser } from '../contexts/UserContext';

/**
 * Stats Card Component - YouTube Style
 */
function StatsCard({ title, value, icon: Icon, color, bgColor }) {
  return (
    <div className="bg-yt-bg-secondary rounded-lg p-4 border border-yt-border hover:border-yt-border/50 transition-all">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded ${bgColor}`}>
          <Icon className={`w-6 h-6 ${color}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-yt-text-secondary uppercase tracking-wide mb-0.5">{title}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

const ANNOUNCEMENTS_KEY = 'dashboard_announcements';

function loadAnnouncements() {
  try {
    const raw = localStorage.getItem(ANNOUNCEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn('Failed to load announcements:', error);
    return [];
  }
}

function formatAnnouncementTime(timestamp) {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return '-';
  }
}

/**
 * Dashboard Component
 */
export default function Dashboard({ airports, missions, combatMissions, stats }) {
  const { user } = useUser();
  const [announcements, setAnnouncements] = useState(loadAnnouncements);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftImageUrl, setDraftImageUrl] = useState('');
  const [draftImageName, setDraftImageName] = useState('');
  const isAdmin = isAuthenticated();

  useEffect(() => {
    try {
      localStorage.setItem(ANNOUNCEMENTS_KEY, JSON.stringify(announcements));
    } catch (error) {
      console.warn('Failed to save announcements:', error);
    }
  }, [announcements]);

  const activeAirports = useMemo(() => {
    return Object.values(airports).filter(airport => airport && airport.name && airport.isActive !== false).length;
  }, [airports]);

  const activeZonesCount = useMemo(() => {
    return (combatMissions || []).filter(mission => mission.is_active).length;
  }, [combatMissions]);

  const activeTaskCounts = useMemo(() => {
    const counts = { SEAD: 0, DEAD: 0, CAS: 0 };
    (combatMissions || [])
      .filter(mission => mission.mission_status !== 'completed' && mission.mission_status !== 'aborted')
      .forEach(mission => {
        (mission.tasks || []).forEach(task => {
          if (counts[task] !== undefined) {
            counts[task] += 1;
          }
        });
      });
    return counts;
  }, [combatMissions]);

  const topOrderAirports = useMemo(() => {
    const totals = {};
    missions.forEach(mission => {
      const orders = Array.isArray(mission.orders) && mission.orders.length > 0
        ? mission.orders
        : mission.weapon_id ? [mission] : [];
      const orderCount = orders.length;
      if (orderCount === 0) return;
      const airportId = mission.airport_id;
      if (!airportId) return;
      totals[airportId] = (totals[airportId] || 0) + orderCount;
    });

    return Object.entries(totals)
      .map(([airportId, count]) => ({
        airportId,
        name: getAirportName(airportId),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
  }, [missions]);

  const acceptedMissions = useMemo(() => {
    const logistics = missions
      .filter(mission => mission.status === 'accepted' && mission.accepted_by)
      .map(mission => ({
        id: mission.id,
        type: 'logistics',
        label: `${getAirportName(mission.source_airport_id)} → ${getAirportName(mission.airport_id)}`,
        users: [mission.accepted_by],
        distance: mission.distance_nm,
        sortTime: mission.created_at || 0,
      }));

    const combat = (combatMissions || [])
      .filter(mission => mission.mission_status === 'assigned')
      .map(mission => ({
        id: mission.id,
        type: 'combat',
        label: mission.zone_name || 'Combat mission',
        users: (mission.assigned_users || []).map(user => user.name).filter(Boolean).length > 0
          ? mission.assigned_users.map(user => user.name).filter(Boolean)
          : mission.assigned_to ? [mission.assigned_to] : [],
        distance: null,
        sortTime: mission.assigned_at || mission.created_at || 0,
      }));

    return [...logistics, ...combat]
      .sort((a, b) => b.sortTime - a.sortTime)
      .slice(0, 8);
  }, [missions, combatMissions]);

  const handleAddAnnouncement = () => {
    const title = draftTitle.trim();
    const body = draftBody.trim();
    const imageUrl = draftImageUrl.trim();
    if (!title || !body) return;

    const author = user?.globalName || user?.username || 'Admin';
    const next = [{
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      body,
      imageUrl: imageUrl || null,
      createdAt: Date.now(),
      author,
    }, ...announcements];

    setAnnouncements(next);
    setDraftTitle('');
    setDraftBody('');
    setDraftImageUrl('');
    setDraftImageName('');
  };

  const handleDeleteAnnouncement = (id) => {
    setAnnouncements(prev => prev.filter(item => item.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="bg-yt-bg-secondary rounded-xl border border-yt-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-yt-text-primary">{t('dashboard.title')}</h2>
            <p className="text-xs text-yt-text-secondary">{t('dashboard.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-yt-text-secondary bg-yt-bg-tertiary border border-yt-border/70 px-3 py-1.5 rounded-full">
            <Radio className="w-3.5 h-3.5 text-green-400" />
            <span>{t('dashboard.status.live')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <StatsCard
          title={t('dashboard.stats.activeAirports')}
          value={activeAirports}
          icon={ShieldCheck}
          color="text-yt-accent"
          bgColor="bg-yt-accent/20"
        />
        <StatsCard
          title={t('dashboard.stats.activeZones')}
          value={activeZonesCount}
          icon={Target}
          color="text-red-400"
          bgColor="bg-red-400/20"
        />
        <StatsCard
          title={t('dashboard.stats.missions')}
          value={stats.activeMissions || 0}
          icon={Package}
          color="text-fuchsia-400"
          bgColor="bg-fuchsia-500/20"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[3fr,2fr] gap-4 items-start">
        <div className="space-y-4">
          <div className="bg-yt-bg-secondary rounded-xl border border-yt-border p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-yt-accent/20 rounded">
                  <Megaphone className="w-4 h-4 text-yt-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-yt-text-primary">{t('dashboard.announcements.title')}</h3>
                  <p className="text-[11px] text-yt-text-secondary">{t('dashboard.announcements.subtitle')}</p>
                </div>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-yt-bg-tertiary/60 border border-yt-border rounded-lg p-3 mb-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder={t('dashboard.announcements.form.title')}
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    className="md:col-span-1 px-3 py-2 bg-yt-bg-secondary border border-yt-border rounded text-xs text-yt-text-primary placeholder-yt-text-secondary focus:outline-none focus:border-yt-accent"
                  />
                  <input
                    type="text"
                    placeholder={t('dashboard.announcements.form.body')}
                    value={draftBody}
                    onChange={(event) => setDraftBody(event.target.value)}
                    className="md:col-span-2 px-3 py-2 bg-yt-bg-secondary border border-yt-border rounded text-xs text-yt-text-primary placeholder-yt-text-secondary focus:outline-none focus:border-yt-accent"
                  />
                  <input
                    type="text"
                    placeholder={t('dashboard.announcements.form.image')}
                    value={draftImageUrl}
                    onChange={(event) => setDraftImageUrl(event.target.value)}
                    className="md:col-span-1 px-3 py-2 bg-yt-bg-secondary border border-yt-border rounded text-xs text-yt-text-primary placeholder-yt-text-secondary focus:outline-none focus:border-yt-accent"
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-yt-text-secondary">
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 bg-yt-bg-secondary border border-yt-border rounded cursor-pointer hover:border-yt-border/80 transition-all">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const result = reader.result;
                          if (typeof result === 'string') {
                            setDraftImageUrl(result);
                            setDraftImageName(file.name);
                          }
                        };
                        reader.readAsDataURL(file);
                        event.target.value = '';
                      }}
                    />
                    {t('dashboard.announcements.form.upload')}
                  </label>
                  {draftImageName && (
                    <span className="truncate max-w-[240px]">{draftImageName}</span>
                  )}
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    type="button"
                    onClick={handleAddAnnouncement}
                    className="px-3 py-1.5 text-xs font-bold bg-yt-accent text-white rounded hover:bg-yt-accent/80 transition-all"
                  >
                    {t('dashboard.announcements.form.publish')}
                  </button>
                </div>
              </div>
            )}

            {announcements.length === 0 ? (
              <div className="text-xs text-yt-text-secondary bg-yt-bg-tertiary/60 border border-yt-border rounded p-4">
                {t('dashboard.announcements.empty')}
              </div>
            ) : (
              <div className="space-y-3">
                {announcements.map(item => (
                  <div key={item.id} className="bg-yt-bg-tertiary/60 border border-yt-border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-yt-text-primary">{item.title}</div>
                        <div className="text-[11px] text-yt-text-secondary mt-1">{item.body}</div>
                        {item.imageUrl && (
                          <div className="mt-2">
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-full max-h-48 object-cover rounded border border-yt-border"
                              loading="lazy"
                            />
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDeleteAnnouncement(item.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          {t('dashboard.announcements.form.remove')}
                        </button>
                      )}
                    </div>
              <div className="flex items-center gap-2 text-[10px] text-yt-text-secondary mt-2">
                <span>{formatAnnouncementTime(item.createdAt)}</span>
                <span>·</span>
                <span>{item.author || t('dashboard.announcements.unknownAuthor')}</span>
              </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-yt-bg-secondary rounded-xl border border-yt-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-yt-accent/20 rounded">
                <ClipboardList className="w-4 h-4 text-yt-accent" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-yt-text-primary">{t('dashboard.acceptedMissions.title')}</h3>
                <p className="text-[11px] text-yt-text-secondary">{t('dashboard.acceptedMissions.subtitle')}</p>
              </div>
            </div>
            {acceptedMissions.length === 0 ? (
              <div className="text-xs text-yt-text-secondary bg-yt-bg-tertiary/60 border border-yt-border rounded p-4">
                {t('dashboard.acceptedMissions.empty')}
              </div>
            ) : (
              <div className="space-y-2">
                {acceptedMissions.map(mission => {
                  const isCombat = mission.type === 'combat';
                  return (
                    <div key={mission.id} className="flex items-center justify-between gap-3 text-xs bg-yt-bg-tertiary/60 border border-yt-border rounded p-2">
                      <div className="min-w-0">
                        <div className="text-yt-text-primary font-medium truncate">
                          {mission.label}
                        </div>
                        <div className="text-[10px] text-yt-text-secondary">
                          {mission.users.length > 0 ? mission.users.join(', ') : t('dashboard.acceptedMissions.noAssignee')}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isCombat ? 'bg-red-400/20 text-red-400' : 'bg-fuchsia-500/20 text-fuchsia-400'
                        }`}>
                          {isCombat ? t('dashboard.acceptedMissions.combat') : t('dashboard.acceptedMissions.logistics')}
                        </span>
                        <span className="text-[10px] text-yt-text-secondary">
                          {mission.distance ? `${mission.distance}nm` : '-'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-yt-bg-secondary rounded-xl border border-yt-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-red-400/20 rounded">
                <Target className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-yt-text-primary">{t('dashboard.activeTasks.title')}</h3>
                <p className="text-[11px] text-yt-text-secondary">{t('dashboard.activeTasks.subtitle')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs bg-yt-bg-tertiary/60 border border-yt-border rounded p-2">
                <span className="text-yt-text-secondary">{t('dashboard.activeTasks.sead')}</span>
                <span className="text-yt-text-primary font-bold">{activeTaskCounts.SEAD}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-yt-bg-tertiary/60 border border-yt-border rounded p-2">
                <span className="text-yt-text-secondary">{t('dashboard.activeTasks.dead')}</span>
                <span className="text-yt-text-primary font-bold">{activeTaskCounts.DEAD}</span>
              </div>
              <div className="flex items-center justify-between text-xs bg-yt-bg-tertiary/60 border border-yt-border rounded p-2">
                <span className="text-yt-text-secondary">{t('dashboard.activeTasks.cas')}</span>
                <span className="text-yt-text-primary font-bold">{activeTaskCounts.CAS}</span>
              </div>
            </div>
          </div>

          <div className="bg-yt-bg-secondary rounded-xl border border-yt-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-fuchsia-500/20 rounded">
                <Package className="w-4 h-4 text-fuchsia-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-yt-text-primary">{t('dashboard.pipeline.title')}</h3>
                <p className="text-[11px] text-yt-text-secondary">{t('dashboard.pipeline.subtitle')}</p>
              </div>
            </div>
            {topOrderAirports.length === 0 ? (
              <div className="text-xs text-yt-text-secondary bg-yt-bg-tertiary/60 border border-yt-border rounded p-4">
                {t('dashboard.pipeline.empty')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {topOrderAirports.map(entry => (
                  <div key={entry.airportId} className="flex items-center justify-between text-xs bg-yt-bg-tertiary/60 border border-yt-border rounded p-2">
                    <span className="text-yt-text-secondary">{entry.name}</span>
                    <span className="text-yt-text-primary font-bold">
                      {t('dashboard.pipeline.orders', { count: entry.count })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
