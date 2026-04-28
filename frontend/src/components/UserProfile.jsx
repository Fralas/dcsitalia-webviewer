import { useEffect, useMemo, useRef, useState } from 'react';
import { Award, ChevronDown, Loader2, Pencil, Target, Trash2, Trophy, Upload, User as UserIcon } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';
import velcroTextureImg from '../../img/velcrotexture.jpg';

function formatDate(timestamp) {
  if (!Number.isFinite(timestamp)) return '-';
  try {
    return new Date(timestamp).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return '-';
  }
}

function getLeaderboardBadgeClass(position) {
  if (position === 1) return 'border-amber-300/60 bg-amber-300/10 text-amber-200';
  if (position === 2) return 'border-slate-300/60 bg-slate-300/10 text-slate-200';
  if (position === 3) return 'border-orange-300/60 bg-orange-300/10 text-orange-200';
  return 'border-yt-border/80 bg-yt-bg-tertiary/80 text-yt-text-primary';
}

function ProfileStatCard({ label, value, icon: Icon }) {
  return (
    <div className="bg-yt-bg-tertiary/60 rounded-2xl p-4 border border-yt-border/70 shadow-[0_8px_18px_rgba(0,0,0,0.26)]">
      <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-yt-accent/40 bg-yt-accent/15 text-yt-accent">
        <Icon className="h-4 w-4" />
      </div>
      <div className="text-3xl font-black text-yt-text-primary">{value}</div>
      <div className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">{label}</div>
    </div>
  );
}

function normalizeUserName(value, fallback = '') {
  const trimmed = String(value || '').trim();
  if (trimmed) return trimmed;
  return String(fallback || '').trim();
}

const PATCH_DEPTH_STEPS = [-12, -10, -8, -6, -4, -2, 0, 2, 4, 6, 8, 10, 12];

export default function UserProfile() {
  const { user, profile } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loggedInUsers, setLoggedInUsers] = useState([]);

  const [newAchievementName, setNewAchievementName] = useState('');
  const [newAchievementDescription, setNewAchievementDescription] = useState('');
  const [newAchievementImageUrl, setNewAchievementImageUrl] = useState('');
  const [newAchievementImageName, setNewAchievementImageName] = useState('');
  const [creatingAchievement, setCreatingAchievement] = useState(false);
  const [createStatus, setCreateStatus] = useState('');

  const [assignUserId, setAssignUserId] = useState('');
  const [assignUserName, setAssignUserName] = useState('');
  const [assignAchievementId, setAssignAchievementId] = useState('');
  const [assigningAchievement, setAssigningAchievement] = useState(false);
  const [assignStatus, setAssignStatus] = useState('');
  const [managementOpen, setManagementOpen] = useState(false);

  const [editAchievementId, setEditAchievementId] = useState('');
  const [editAchievementName, setEditAchievementName] = useState('');
  const [editAchievementDescription, setEditAchievementDescription] = useState('');
  const [editAchievementImageUrl, setEditAchievementImageUrl] = useState('');
  const [editAchievementImageName, setEditAchievementImageName] = useState('');
  const [editingAchievement, setEditingAchievement] = useState(false);
  const [deletingAchievement, setDeletingAchievement] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [patchViewerAchievement, setPatchViewerAchievement] = useState(null);
  const [patchRotation, setPatchRotation] = useState({ x: -12, y: 18 });
  const [isDraggingPatch, setIsDraggingPatch] = useState(false);
  const patchDragRef = useRef({ active: false, lastX: 0, lastY: 0 });

  const canManageAchievements = Boolean(user?.canEditWiki);
  const displayName = user?.globalName || user?.username || '';
  const avatarUrl = user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

  const knownUsers = useMemo(() => {
    const map = new Map();
    if (user?.id) {
      map.set(String(user.id), {
        id: String(user.id),
        name: normalizeUserName(displayName, String(user.id)),
      });
    }
    (Array.isArray(loggedInUsers) ? loggedInUsers : []).forEach((entry) => {
      const id = String(entry?.id || '').trim();
      if (!id) return;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: normalizeUserName(entry?.globalName || entry?.username, id),
        });
      }
    });
    return Array.from(map.values());
  }, [displayName, loggedInUsers, user?.id]);

  const fetchAchievementData = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      const [catalogResponse, userAchievementsResponse, leaderboardResponse] = await Promise.all([
        api.getAchievementsCatalog(),
        api.getUserAchievements(user.id),
        api.getAchievementsLeaderboard(50),
      ]);
      setCatalog(Array.isArray(catalogResponse?.achievements) ? catalogResponse.achievements : []);
      setUserAchievements(Array.isArray(userAchievementsResponse?.achievements) ? userAchievementsResponse.achievements : []);
      setLeaderboard(Array.isArray(leaderboardResponse?.leaderboard) ? leaderboardResponse.leaderboard : []);

      if (canManageAchievements) {
        try {
          const loggedInUsersResponse = await api.getLoggedInUsers();
          setLoggedInUsers(Array.isArray(loggedInUsersResponse) ? loggedInUsersResponse : []);
        } catch {
          setLoggedInUsers([]);
        }
      } else {
        setLoggedInUsers([]);
      }
    } catch (requestError) {
      setError(requestError?.message || 'Errore durante il caricamento dei riconoscimenti.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    fetchAchievementData();
  }, [user?.id, canManageAchievements]);

  useEffect(() => {
    if (!user?.id) return;
    setAssignUserId(String(user.id));
    setAssignUserName(normalizeUserName(displayName, String(user.id)));
  }, [displayName, user?.id]);

  useEffect(() => {
    if (assignAchievementId) return;
    if (catalog.length > 0) {
      setAssignAchievementId(String(catalog[0].id));
    }
  }, [assignAchievementId, catalog]);

  useEffect(() => {
    if (editAchievementId) return;
    if (catalog.length > 0) {
      setEditAchievementId(String(catalog[0].id));
    }
  }, [editAchievementId, catalog]);

  useEffect(() => {
    const selectedId = String(editAchievementId || '').trim();
    const selected = catalog.find((entry) => String(entry?.id || '') === selectedId);
    if (!selected) {
      setEditAchievementName('');
      setEditAchievementDescription('');
      setEditAchievementImageUrl('');
      setEditAchievementImageName('');
      return;
    }

    setEditAchievementName(String(selected.name || ''));
    setEditAchievementDescription(String(selected.description || ''));
    setEditAchievementImageUrl(String(selected.imageUrl || ''));
    setEditAchievementImageName('');
  }, [editAchievementId, catalog]);

  useEffect(() => {
    if (!patchViewerAchievement) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setPatchViewerAchievement(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [patchViewerAchievement]);

  const openPatchViewer = (achievement) => {
    const imageUrl = String(achievement?.imageUrl || '').trim();
    if (!imageUrl) return;
    setPatchRotation({ x: 0, y: 0 });
    setPatchViewerAchievement({
      name: String(achievement?.name || 'Achievement'),
      imageUrl,
    });
  };

  const closePatchViewer = () => {
    setPatchViewerAchievement(null);
    setIsDraggingPatch(false);
    patchDragRef.current.active = false;
  };

  const handlePatchPointerDown = (event) => {
    patchDragRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
    };
    setIsDraggingPatch(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePatchPointerMove = (event) => {
    if (!patchDragRef.current.active) return;

    const dx = event.clientX - patchDragRef.current.lastX;

    patchDragRef.current.lastX = event.clientX;
    patchDragRef.current.lastY = event.clientY;

    setPatchRotation((prev) => {
      const nextY = prev.y + (dx * 0.45);
      return { x: 0, y: nextY };
    });
  };

  const handlePatchPointerUp = (event) => {
    patchDragRef.current.active = false;
    setIsDraggingPatch(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  if (!user) {
    return (
      <div className="rounded-2xl border border-yt-border bg-yt-bg-secondary/90 p-8 text-center">
        <UserIcon className="w-12 h-12 text-yt-text-secondary mx-auto mb-3" />
        <p className="text-base text-yt-text-primary font-medium">Accedi con Discord per vedere il profilo.</p>
        <p className="text-xs text-yt-text-secondary mt-1">Usa il pulsante di login in alto a destra.</p>
      </div>
    );
  }

  const missionsCompleted = Number.isFinite(profile?.stats?.missionsCompleted) ? profile.stats.missionsCompleted : 0;
  const ordersCompleted = Number.isFinite(profile?.stats?.ordersCompleted) ? profile.stats.ordersCompleted : 0;
  const recognitions = userAchievements.length;

  const totalXp = (missionsCompleted * 100) + (ordersCompleted * 50) + (recognitions * 250);
  const level = Math.max(1, Math.floor(totalXp / 1000) + 1);
  const xpInLevel = totalXp % 1000;
  const targetXp = 1000;
  const progressPercentage = Math.min(100, Math.round((xpInLevel / targetXp) * 100));

  const ownLeaderboardEntry = leaderboard.find((entry) => String(entry?.userId || '') === String(user?.id || ''));

  const handleCreateAchievement = async (event) => {
    event.preventDefault();
    setCreateStatus('');
    const name = String(newAchievementName || '').trim();
    const description = String(newAchievementDescription || '').trim();
    const imageUrl = String(newAchievementImageUrl || '').trim();

    if (!name || !description || !imageUrl) {
      setCreateStatus('Nome, descrizione e immagine sono obbligatori.');
      return;
    }

    setCreatingAchievement(true);
    try {
      const response = await api.createAchievement({ name, description, imageUrl });
      const created = response?.achievement;
      setCreateStatus('Achievement creato con successo.');
      setNewAchievementName('');
      setNewAchievementDescription('');
      setNewAchievementImageUrl('');
      setNewAchievementImageName('');
      if (created?.id) {
        setAssignAchievementId(String(created.id));
        setEditAchievementId(String(created.id));
      }
      await fetchAchievementData();
    } catch (requestError) {
      setCreateStatus(requestError?.message || 'Impossibile creare il nuovo achievement.');
    } finally {
      setCreatingAchievement(false);
    }
  };

  const handleImageFilePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setNewAchievementImageUrl(result);
        setNewAchievementImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleEditImageFilePick = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        setEditAchievementImageUrl(result);
        setEditAchievementImageName(file.name);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleAssignAchievement = async (event) => {
    event.preventDefault();
    setAssignStatus('');

    const targetUserId = String(assignUserId || '').trim();
    const targetAchievementId = String(assignAchievementId || '').trim();
    const targetUserName = normalizeUserName(assignUserName, targetUserId);
    if (!targetUserId || !targetAchievementId) {
      setAssignStatus('Inserisci utente e achievement da assegnare.');
      return;
    }

    setAssigningAchievement(true);
    try {
      await api.assignAchievement({
        userId: targetUserId,
        userName: targetUserName,
        achievementId: targetAchievementId,
      });
      setAssignStatus('Achievement assegnato con successo.');
      await fetchAchievementData();
    } catch (requestError) {
      setAssignStatus(requestError?.message || 'Impossibile assegnare l achievement.');
    } finally {
      setAssigningAchievement(false);
    }
  };

  const handleUpdateAchievement = async (event) => {
    event.preventDefault();
    setEditStatus('');

    const targetAchievementId = String(editAchievementId || '').trim();
    const name = String(editAchievementName || '').trim();
    const description = String(editAchievementDescription || '').trim();
    const imageUrl = String(editAchievementImageUrl || '').trim();

    if (!targetAchievementId || !name || !description || !imageUrl) {
      setEditStatus('ID, nome, descrizione e immagine sono obbligatori.');
      return;
    }

    setEditingAchievement(true);
    try {
      const response = await api.updateAchievement(targetAchievementId, {
        name,
        description,
        imageUrl,
      });
      const updated = response?.achievement;
      setEditStatus('Achievement aggiornato con successo.');
      if (updated?.id) {
        const updatedId = String(updated.id);
        setAssignAchievementId(updatedId);
        setEditAchievementId(updatedId);
      }
      await fetchAchievementData();
    } catch (requestError) {
      setEditStatus(requestError?.message || 'Impossibile aggiornare l achievement.');
    } finally {
      setEditingAchievement(false);
    }
  };

  const handleDeleteAchievement = async () => {
    setEditStatus('');
    const targetAchievementId = String(editAchievementId || '').trim();
    if (!targetAchievementId) {
      setEditStatus('Seleziona un achievement da eliminare.');
      return;
    }

    const selected = catalog.find((entry) => String(entry?.id || '') === targetAchievementId);
    const selectedName = String(selected?.name || targetAchievementId);
    const confirmed = window.confirm(`Confermi eliminazione achievement "${selectedName}"?`);
    if (!confirmed) return;

    setDeletingAchievement(true);
    try {
      const response = await api.deleteAchievement(targetAchievementId);
      const removedAwards = Number(response?.removedAwards || 0);
      setEditStatus(removedAwards > 0
        ? `Achievement eliminato. Rimossi ${removedAwards} riconoscimenti assegnati.`
        : 'Achievement eliminato con successo.');
      setEditAchievementId('');
      setAssignAchievementId('');
      await fetchAchievementData();
    } catch (requestError) {
      setEditStatus(requestError?.message || 'Impossibile eliminare l achievement.');
    } finally {
      setDeletingAchievement(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] space-y-4 pb-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <section className="bg-yt-bg-secondary/85 rounded-3xl border border-yt-border/70 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <div className="text-center">
            <div className="mx-auto mb-4 h-36 w-36 overflow-hidden rounded-full border border-yt-border bg-yt-bg-tertiary p-1">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full rounded-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-full bg-yt-bg-primary">
                  <UserIcon className="h-12 w-12 text-yt-text-secondary" />
                </div>
              )}
            </div>
            <h2 className="text-3xl font-black tracking-tight text-yt-text-primary">{displayName}</h2>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.1em] text-yt-text-secondary">Discord ID: {user.id}</p>
          </div>

          <div className="mt-5 rounded-2xl border border-yt-border/70 bg-yt-bg-tertiary/70 p-4">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-yt-accent/60 bg-yt-accent/15 text-2xl font-black text-yt-accent">
                {level}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-bold uppercase tracking-[0.12em] text-yt-text-secondary">Livello</div>
                <div className="mt-2 h-2.5 rounded-full bg-yt-bg-primary">
                  <div
                    className="h-full rounded-full bg-yt-accent"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <div className="mt-1 text-xs font-semibold text-yt-text-secondary">
                  {xpInLevel.toLocaleString('it-IT')} / {targetXp.toLocaleString('it-IT')} XP
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <ProfileStatCard label="Missioni completate" value={missionsCompleted} icon={Target} />
            <ProfileStatCard label="Ordini completati" value={ordersCompleted} icon={Trophy} />
            <ProfileStatCard label="Riconoscimenti" value={recognitions} icon={Award} />
          </div>
        </section>

        <section className="bg-yt-bg-secondary/85 rounded-3xl border border-yt-border/70 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-3xl font-black uppercase tracking-[0.06em] text-yt-text-primary">Leaderboard Achievement</h3>
              <p className="text-sm text-yt-text-secondary">Classifica utenti per riconoscimenti assegnati.</p>
            </div>
            <div className="inline-flex items-center rounded-lg border border-yt-border/70 bg-yt-bg-tertiary px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-yt-text-primary">
              Totale
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-yt-border/70 bg-yt-bg-tertiary/60">
            <div className="grid grid-cols-[72px_minmax(0,1fr)_120px] border-b border-yt-border/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-yt-text-secondary">
              <span>Pos.</span>
              <span>Pilota</span>
              <span className="text-right">Achievement</span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="px-4 py-4 text-sm text-yt-text-secondary">Nessun dato disponibile.</div>
            ) : (
              leaderboard.slice(0, 12).map((entry) => {
                const isSelf = String(entry?.userId || '') === String(user?.id || '');
                const rowName = normalizeUserName(entry?.displayName, entry?.userId);
                return (
                  <div
                    key={`${entry?.userId || 'user'}-${entry?.position || 0}`}
                    className={`grid grid-cols-[72px_minmax(0,1fr)_120px] items-center border-b border-yt-border/40 px-4 py-2.5 last:border-b-0 ${
                      isSelf ? 'bg-yt-accent/8' : ''
                    }`}
                  >
                    <div className="text-sm font-bold text-yt-text-primary">
                      <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm ${getLeaderboardBadgeClass(Number(entry?.position || 0))}`}>
                        {entry?.position || '-'}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold text-yt-text-primary">{rowName}</p>
                      <p className="text-xs text-yt-text-secondary">{entry?.userId || '-'}</p>
                    </div>
                    <div className="text-right text-3xl font-black tracking-tight text-yt-text-primary">{entry?.achievementCount || 0}</div>
                  </div>
                );
              })
            )}
          </div>

          {ownLeaderboardEntry ? (
            <div className="mt-4 rounded-2xl border border-yt-accent/45 bg-yt-accent/12 px-5 py-3">
              <div className="grid grid-cols-[56px_minmax(0,1fr)_120px] items-center gap-3">
                <div className="text-center text-3xl font-black tracking-tight text-yt-accent">{ownLeaderboardEntry.position}</div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-yt-text-primary">{displayName} (Tu)</p>
                  <p className="text-xs text-yt-text-secondary">{user.id}</p>
                </div>
                <div className="text-right text-4xl font-black tracking-tight text-yt-accent">{ownLeaderboardEntry.achievementCount}</div>
              </div>
            </div>
          ) : null}
        </section>
      </div>

      <section className="bg-yt-bg-secondary/85 rounded-3xl border border-yt-border/70 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-3xl font-black uppercase tracking-[0.04em] text-yt-text-primary">I miei riconoscimenti</h3>
            <p className="text-sm text-yt-text-secondary">Tutti gli achievement assegnati al tuo profilo.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-yt-border/70 bg-yt-bg-tertiary px-3 py-1.5">
            <Trophy className="h-4 w-4 text-yt-accent" />
            <span className="text-xs font-bold uppercase tracking-[0.08em] text-yt-text-secondary">
              {userAchievements.length} totali
            </span>
          </div>
        </div>

        {loading && (
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-yt-border/70 bg-yt-bg-tertiary/70 px-3 py-2 text-sm text-yt-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" />
            Caricamento dati profilo...
          </div>
        )}
        {error && (
          <div className="mb-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        {userAchievements.length === 0 ? (
          <div className="rounded-xl border border-yt-border/70 bg-yt-bg-tertiary/60 px-4 py-5 text-sm text-yt-text-secondary">
            Nessun riconoscimento assegnato.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {userAchievements.map((achievement) => (
              <article key={achievement.awardId || achievement.achievementId} className="group mx-auto w-full max-w-[260px] rounded-2xl border border-yt-border/70 bg-yt-bg-tertiary/65 p-2.5 shadow-[0_8px_18px_rgba(0,0,0,0.24)]">
                <button
                  type="button"
                  onClick={() => openPatchViewer(achievement)}
                  disabled={!achievement.imageUrl}
                  className="mb-2 flex h-24 w-full items-center justify-center overflow-visible disabled:cursor-not-allowed"
                  title={achievement.imageUrl ? 'Apri patch 3D' : 'Patch non disponibile'}
                  aria-label={achievement.imageUrl ? `Apri patch 3D ${achievement.name || ''}` : 'Patch non disponibile'}
                >
                  {achievement.imageUrl ? (
                    <img
                      src={achievement.imageUrl}
                      alt={achievement.name || 'Achievement'}
                      className="h-24 w-24 object-contain transition-all duration-200 ease-out group-hover:h-32 group-hover:w-32"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center transition-all duration-200 ease-out group-hover:h-32 group-hover:w-32">
                      <Award className="h-10 w-10 text-yt-accent" />
                    </div>
                  )}
                </button>
                <h4 className="text-sm font-bold uppercase tracking-[0.06em] text-yt-text-primary">{achievement.name}</h4>
                <p className="mt-1.5 min-h-[42px] text-xs leading-relaxed text-yt-text-secondary">{achievement.description}</p>
                <p className="mt-2 text-[11px] font-semibold text-yt-accent">Assegnato: {formatDate(achievement.awardedAt)}</p>
                <p className="text-[11px] text-yt-text-secondary">Da: {normalizeUserName(achievement?.awardedBy?.name, achievement?.awardedBy?.id || '-')}</p>
              </article>
            ))}
          </div>
        )}
      </section>

      {canManageAchievements && (
        <section className="bg-yt-bg-secondary/85 rounded-3xl border border-yt-border/70 p-5 shadow-[0_14px_30px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-2xl font-black uppercase tracking-[0.06em] text-yt-text-primary">Gestione Achievement</h3>
              <p className="text-sm text-yt-text-secondary">Area riservata agli editor wiki per creare, modificare, eliminare e assegnare achievement.</p>
            </div>
            <button
              type="button"
              onClick={() => setManagementOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded border border-yt-border px-2 py-1 text-xs text-yt-text-primary hover:border-yt-accent"
              title={managementOpen ? 'Chiudi gestione achievement' : 'Apri gestione achievement'}
              aria-label={managementOpen ? 'Chiudi gestione achievement' : 'Apri gestione achievement'}
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${managementOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {managementOpen && (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <form onSubmit={handleCreateAchievement} className="rounded-2xl border border-yt-border/70 bg-yt-bg-tertiary/60 p-4 space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-[0.09em] text-yt-accent">Crea Nuovo Achievement</h4>

                <input
                  type="text"
                  value={newAchievementName}
                  onChange={(event) => setNewAchievementName(event.target.value)}
                  placeholder="Nome achievement"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />
                <textarea
                  rows={3}
                  value={newAchievementDescription}
                  onChange={(event) => setNewAchievementDescription(event.target.value)}
                  placeholder="Descrizione achievement"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />
                <input
                  type="text"
                  value={newAchievementImageUrl}
                  onChange={(event) => setNewAchievementImageUrl(event.target.value)}
                  placeholder="URL immagine o data URL"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />

                <div className="flex flex-wrap items-center gap-3 text-xs text-yt-text-secondary">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-1.5 font-semibold uppercase tracking-[0.08em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent">
                    <Upload className="h-3.5 w-3.5" />
                    Carica
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageFilePick} />
                  </label>
                  {newAchievementImageName && <span className="truncate max-w-[240px]">{newAchievementImageName}</span>}
                </div>

                {newAchievementImageUrl && (
                  <div className="flex h-36 items-center justify-center overflow-visible">
                    <img
                      src={newAchievementImageUrl}
                      alt="Anteprima achievement"
                      className="h-24 w-24 object-contain transition-all duration-200 ease-out hover:h-32 hover:w-32"
                    />
                  </div>
                )}

                {createStatus && (
                  <div className={`rounded border px-3 py-2 text-xs ${createStatus.includes('successo') ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300' : 'border-orange-500/45 bg-orange-500/10 text-orange-200'}`}>
                    {createStatus}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={creatingAchievement}
                  className="inline-flex items-center gap-2 rounded border border-yt-accent/50 bg-yt-accent/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.09em] text-yt-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {creatingAchievement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Crea
                </button>
              </form>

              <form onSubmit={handleAssignAchievement} className="rounded-2xl border border-yt-border/70 bg-yt-bg-tertiary/60 p-4 space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-[0.09em] text-yt-accent">Assegna Achievement</h4>

                <select
                  value={assignAchievementId}
                  onChange={(event) => setAssignAchievementId(event.target.value)}
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                >
                  {catalog.length === 0 ? (
                    <option value="">Nessun achievement disponibile</option>
                  ) : (
                    catalog.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))
                  )}
                </select>

                <input
                  type="text"
                  value={assignUserId}
                  onChange={(event) => setAssignUserId(event.target.value)}
                  placeholder="Discord user ID"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />
                <input
                  type="text"
                  value={assignUserName}
                  onChange={(event) => setAssignUserName(event.target.value)}
                  placeholder="Nome visualizzato utente (opzionale)"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />

                {knownUsers.length > 0 && (
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-yt-text-secondary">Utenti online</p>
                    <div className="flex flex-wrap gap-2">
                      {knownUsers.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => {
                            setAssignUserId(entry.id);
                            setAssignUserName(entry.name);
                          }}
                          className="rounded border border-yt-border/70 bg-yt-bg-secondary px-2.5 py-1 text-[11px] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent"
                        >
                          {entry.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {assignStatus && (
                  <div className={`rounded border px-3 py-2 text-xs ${assignStatus.includes('successo') ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300' : 'border-orange-500/45 bg-orange-500/10 text-orange-200'}`}>
                    {assignStatus}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={assigningAchievement || catalog.length === 0}
                  className="inline-flex items-center gap-2 rounded border border-yt-accent/50 bg-yt-accent/20 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.09em] text-yt-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {assigningAchievement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Assegna
                </button>
              </form>

              <form onSubmit={handleUpdateAchievement} className="rounded-2xl border border-yt-border/70 bg-yt-bg-tertiary/60 p-4 space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-[0.09em] text-yt-accent">Modifica / Elimina</h4>

                <select
                  value={editAchievementId}
                  onChange={(event) => setEditAchievementId(event.target.value)}
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                >
                  {catalog.length === 0 ? (
                    <option value="">Nessun achievement disponibile</option>
                  ) : (
                    catalog.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))
                  )}
                </select>

                <input
                  type="text"
                  value={editAchievementName}
                  onChange={(event) => setEditAchievementName(event.target.value)}
                  placeholder="Nome achievement"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />
                <textarea
                  rows={3}
                  value={editAchievementDescription}
                  onChange={(event) => setEditAchievementDescription(event.target.value)}
                  placeholder="Descrizione achievement"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />
                <input
                  type="text"
                  value={editAchievementImageUrl}
                  onChange={(event) => setEditAchievementImageUrl(event.target.value)}
                  placeholder="URL immagine o data URL"
                  className="w-full rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-2 text-sm text-yt-text-primary outline-none focus:border-yt-accent"
                />

                <div className="flex flex-wrap items-center gap-3 text-xs text-yt-text-secondary">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-yt-border/80 bg-yt-bg-secondary px-3 py-1.5 font-semibold uppercase tracking-[0.08em] text-yt-text-primary hover:border-yt-accent hover:text-yt-accent">
                    <Upload className="h-3.5 w-3.5" />
                    Carica
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditImageFilePick} />
                  </label>
                  {editAchievementImageName && <span className="truncate max-w-[240px]">{editAchievementImageName}</span>}
                </div>

                {editAchievementImageUrl && (
                  <div className="flex h-36 items-center justify-center overflow-visible">
                    <img
                      src={editAchievementImageUrl}
                      alt="Anteprima modifica achievement"
                      className="h-24 w-24 object-contain transition-all duration-200 ease-out hover:h-32 hover:w-32"
                    />
                  </div>
                )}

                {editStatus && (
                  <div className={`rounded border px-3 py-2 text-xs ${editStatus.includes('successo') || editStatus.includes('Rimossi') ? 'border-emerald-500/45 bg-emerald-500/10 text-emerald-300' : 'border-orange-500/45 bg-orange-500/10 text-orange-200'}`}>
                    {editStatus}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="submit"
                    disabled={editingAchievement || deletingAchievement || catalog.length === 0}
                    className="inline-flex items-center gap-2 rounded border border-blue-500/45 bg-blue-500/15 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.09em] text-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {editingAchievement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                    Salva Modifiche
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteAchievement}
                    disabled={editingAchievement || deletingAchievement || catalog.length === 0}
                    className="inline-flex items-center gap-2 rounded border border-red-500/45 bg-red-500/12 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.09em] text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {deletingAchievement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Elimina
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      )}

      {patchViewerAchievement && (
        <div
          className="fixed inset-0 z-[3500] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl"
          onClick={closePatchViewer}
        >
          <div
            className="flex w-full max-w-[900px] flex-col items-center gap-4"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-center text-sm font-semibold text-slate-200">
              {patchViewerAchievement.name}
            </p>
            <p className="text-center text-xs text-slate-300">
              Trascina con mouse o touch per ruotare la patch. Premi ESC o clicca fuori per chiudere.
            </p>

            <div className="[perspective:1400px]">
              <div
                className={`mx-auto h-[min(72vh,72vw)] w-[min(72vh,72vw)] touch-none select-none ${isDraggingPatch ? 'cursor-grabbing' : 'cursor-grab'}`}
                onPointerDown={handlePatchPointerDown}
                onPointerMove={handlePatchPointerMove}
                onPointerUp={handlePatchPointerUp}
                onPointerCancel={handlePatchPointerUp}
                onPointerLeave={handlePatchPointerUp}
              >
                <div
                  className="relative h-full w-full [transform-style:preserve-3d]"
                  style={{
                    transform: `rotateX(${patchRotation.x}deg) rotateY(${patchRotation.y}deg)`,
                    transition: isDraggingPatch ? 'none' : 'transform 120ms ease-out',
                  }}
                >
                  <div className="absolute inset-0 [backface-visibility:hidden] [transform:translateZ(10px)]">
                    <img
                      src={patchViewerAchievement.imageUrl}
                      alt={patchViewerAchievement.name}
                      className="h-full w-full object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)]"
                      draggable={false}
                    />
                  </div>
                  <div
                    className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)_translateZ(10px)]"
                    style={{
                      WebkitMaskImage: `url(${patchViewerAchievement.imageUrl})`,
                      maskImage: `url(${patchViewerAchievement.imageUrl})`,
                      WebkitMaskRepeat: 'no-repeat',
                      maskRepeat: 'no-repeat',
                      WebkitMaskPosition: 'center',
                      maskPosition: 'center',
                      WebkitMaskSize: 'contain',
                      maskSize: 'contain',
                    }}
                  >
                    <img
                      src={velcroTextureImg}
                      alt="Retro patch velcro"
                      className="h-full w-full object-cover drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)]"
                      draggable={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
