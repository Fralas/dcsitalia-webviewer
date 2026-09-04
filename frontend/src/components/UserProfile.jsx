import { useCallback, useEffect, useRef, useState } from 'react';
import { Award, ChevronDown, Loader2, Pencil, Trash2, Upload, User as UserIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';
import InlineError from './InlineError';
import PatchViewer from './PatchViewer';
import { loadSeenAwards, rememberAwardKeys } from '../utils/achievementSeen';
import './UserProfile.css';

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

function normalizeUserName(value, fallback = '') {
  const trimmed = String(value || '').trim();
  if (trimmed) return trimmed;
  return String(fallback || '').trim();
}

const ACHIEVEMENTS_REFRESH_INTERVAL_MS = 15000;

function getAchievementAwardKey(achievement) {
  const awardId = String(achievement?.awardId || '').trim();
  if (awardId) return `award:${awardId}`;

  const achievementId = String(achievement?.achievementId || '').trim();
  const awardedAt = Number(achievement?.awardedAt || 0);
  const achievementName = String(achievement?.name || '').trim();
  return `fallback:${achievementId}:${awardedAt}:${achievementName}`;
}

export default function UserProfile() {
  const { user } = useUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [userAchievements, setUserAchievements] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [guildMembers, setGuildMembers] = useState([]);
  const [guildMembersLoading, setGuildMembersLoading] = useState(false);
  const [guildMembersError, setGuildMembersError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedAssignIds, setSelectedAssignIds] = useState([]);

  const [newAchievementName, setNewAchievementName] = useState('');
  const [newAchievementDescription, setNewAchievementDescription] = useState('');
  const [newAchievementImageUrl, setNewAchievementImageUrl] = useState('');
  const [newAchievementImageName, setNewAchievementImageName] = useState('');
  const [creatingAchievement, setCreatingAchievement] = useState(false);
  const [createStatus, setCreateStatus] = useState('');

  const [assignAchievementId, setAssignAchievementId] = useState('');
  const [assigningAchievement, setAssigningAchievement] = useState(false);
  const [assignStatus, setAssignStatus] = useState('');
  const [managementOpen, setManagementOpen] = useState(false);
  const [opsMode, setOpsMode] = useState('assign');

  const [editAchievementId, setEditAchievementId] = useState('');
  const [editAchievementName, setEditAchievementName] = useState('');
  const [editAchievementDescription, setEditAchievementDescription] = useState('');
  const [editAchievementImageUrl, setEditAchievementImageUrl] = useState('');
  const [editAchievementImageName, setEditAchievementImageName] = useState('');
  const [editingAchievement, setEditingAchievement] = useState(false);
  const [deletingAchievement, setDeletingAchievement] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [patchViewerAchievement, setPatchViewerAchievement] = useState(null);
  const [pendingAchievementClaims, setPendingAchievementClaims] = useState([]);
  const [awardsReady, setAwardsReady] = useState(false);
  const hasInitialAwardsSnapshotRef = useRef(false);
  const knownAwardKeysRef = useRef(new Set());
  const fetchInFlightRef = useRef(false);
  const patchViewerOpenRef = useRef(false);
  const awardsReadyForUserRef = useRef(null);

  const canManageAchievements = Boolean(user?.canEditWiki);
  const displayName = user?.globalName || user?.username || '';
  const avatarUrl = user?.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` : null;

  const fetchAchievementData = useCallback(async ({ background = false } = {}) => {
    if (!user?.id || fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;
    if (!background) {
      setLoading(true);
      setError('');
    }
    try {
      const [catalogResponse, userAchievementsResponse, leaderboardResponse] = await Promise.all([
        api.getAchievementsCatalog(),
        api.getUserAchievements(user.id),
        api.getAchievementsLeaderboard(50),
      ]);
      setCatalog(Array.isArray(catalogResponse?.achievements) ? catalogResponse.achievements : []);
      setUserAchievements(Array.isArray(userAchievementsResponse?.achievements) ? userAchievementsResponse.achievements : []);
      setLeaderboard(Array.isArray(leaderboardResponse?.leaderboard) ? leaderboardResponse.leaderboard : []);
      awardsReadyForUserRef.current = user.id;
      setAwardsReady(true);
    } catch (requestError) {
      if (!background) {
        setError(requestError?.message || 'Errore durante il caricamento dei riconoscimenti.');
      }
    } finally {
      fetchInFlightRef.current = false;
      if (!background) {
        setLoading(false);
      }
    }
  }, [user?.id]);

  useEffect(() => {
    fetchAchievementData();
  }, [fetchAchievementData]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const intervalId = window.setInterval(() => {
      if (patchViewerOpenRef.current) return;
      fetchAchievementData({ background: true });
    }, ACHIEVEMENTS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchAchievementData, user?.id]);

  useEffect(() => {
    if (!canManageAchievements || !managementOpen) return undefined;
    let cancelled = false;
    setGuildMembersLoading(true);
    setGuildMembersError('');
    api.getDiscordGuildMembers()
      .then((response) => {
        if (cancelled) return;
        setGuildMembers(Array.isArray(response?.members) ? response.members : []);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setGuildMembers([]);
        setGuildMembersError(requestError?.message || 'Impossibile caricare i membri Discord.');
      })
      .finally(() => {
        if (!cancelled) setGuildMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canManageAchievements, managementOpen]);

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
    patchViewerOpenRef.current = Boolean(patchViewerAchievement);
  }, [patchViewerAchievement]);

  useEffect(() => {
    hasInitialAwardsSnapshotRef.current = false;
    knownAwardKeysRef.current = new Set();
    setPendingAchievementClaims([]);
    setAwardsReady(false);
    awardsReadyForUserRef.current = null;
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || !awardsReady || awardsReadyForUserRef.current !== user.id) return;

    const achievements = Array.isArray(userAchievements) ? userAchievements : [];
    const currentKeys = new Set(achievements.map((achievement) => getAchievementAwardKey(achievement)));
    const stored = loadSeenAwards(user.id);

    if (!hasInitialAwardsSnapshotRef.current) {
      if (!stored.seeded) {
        knownAwardKeysRef.current = rememberAwardKeys(user.id, currentKeys);
      } else {
        knownAwardKeysRef.current = new Set(stored.keys);
        const unseen = achievements.filter((achievement) => {
          const key = getAchievementAwardKey(achievement);
          return Boolean(key) && !stored.keys.has(key);
        });
        if (unseen.length > 0) {
          const sortedUnlocked = [...unseen].sort(
            (a, b) => (Number(b?.awardedAt) || 0) - (Number(a?.awardedAt) || 0),
          );
          setPendingAchievementClaims(sortedUnlocked);
          unseen.forEach((achievement) => {
            knownAwardKeysRef.current.add(getAchievementAwardKey(achievement));
          });
        }
      }
      hasInitialAwardsSnapshotRef.current = true;
      return;
    }

    const justUnlocked = achievements.filter((achievement) => {
      const key = getAchievementAwardKey(achievement);
      return key && !knownAwardKeysRef.current.has(key);
    });
    justUnlocked.forEach((achievement) => {
      knownAwardKeysRef.current.add(getAchievementAwardKey(achievement));
    });

    if (justUnlocked.length === 0) return;

    const sortedUnlocked = [...justUnlocked].sort(
      (a, b) => (Number(b?.awardedAt) || 0) - (Number(a?.awardedAt) || 0),
    );
    setPendingAchievementClaims((prev) => {
      const existing = new Set(prev.map((entry) => getAchievementAwardKey(entry)));
      const additions = sortedUnlocked.filter((entry) => {
        const key = getAchievementAwardKey(entry);
        if (existing.has(key)) return false;
        existing.add(key);
        return true;
      });
      if (additions.length === 0) return prev;
      return [...additions, ...prev];
    });
  }, [awardsReady, user?.id, userAchievements]);

  const rememberSeenAward = (achievement) => {
    if (!user?.id) return;
    const key = getAchievementAwardKey(achievement);
    if (!key) return;
    knownAwardKeysRef.current.add(key);
    rememberAwardKeys(user.id, [key]);
  };

  const openPatchViewer = (achievement) => {
    const imageUrl = String(achievement?.imageUrl || '').trim();
    if (!imageUrl) return false;
    rememberSeenAward(achievement);
    setPatchViewerAchievement({
      name: String(achievement?.name || 'Achievement'),
      description: String(achievement?.description || '').trim(),
      imageUrl,
    });
    return true;
  };

  const closePatchViewer = useCallback(() => {
    setPatchViewerAchievement(null);
  }, []);

  const pendingClaim = pendingAchievementClaims[0] || null;

  const handleClaimAchievement = () => {
    if (!pendingClaim) return;
    openPatchViewer(pendingClaim);
    setPendingAchievementClaims((prev) => prev.slice(1));
  };

  if (!user) {
    return (
      <div className="profile">
        <div className="profile__gate">
          <p className="profile__gate-kicker">Profilo</p>
          <p>Accedi con Discord per vedere il profilo.</p>
        </div>
      </div>
    );
  }

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

    const targetAchievementId = String(assignAchievementId || '').trim();
    const selectedIds = selectedAssignIds.map((id) => String(id || '').trim()).filter(Boolean);
    if (!targetAchievementId || selectedIds.length === 0) {
      setAssignStatus('Seleziona una patch e almeno un pilota.');
      return;
    }

    const membersById = new Map(guildMembers.map((entry) => [String(entry.id), entry]));
    const recipients = selectedIds.map((id) => {
      const member = membersById.get(id);
      return {
        userId: id,
        userName: normalizeUserName(member?.name || member?.username, id),
      };
    });

    setAssigningAchievement(true);
    try {
      const result = await api.assignAchievement({
        achievementId: targetAchievementId,
        recipients,
      });
      const assignedCount = Array.isArray(result?.assigned) ? result.assigned.length : 0;
      const skippedCount = Array.isArray(result?.skipped) ? result.skipped.length : 0;
      if (assignedCount === 0 && skippedCount > 0) {
        setAssignStatus('Nessuna nuova assegnazione: i piloti selezionati hanno già questa patch.');
      } else if (skippedCount > 0) {
        setAssignStatus(`Assegnata a ${assignedCount} pilota/i. ${skippedCount} già in possesso.`);
      } else {
        setAssignStatus(`Assegnata a ${assignedCount} pilota/i.`);
      }
      setSelectedAssignIds([]);
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

  const toggleAssignMember = (memberId) => {
    const id = String(memberId || '').trim();
    if (!id) return;
    setSelectedAssignIds((prev) => (
      prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]
    ));
  };

  const memberQuery = String(memberSearch || '').trim().toLowerCase();
  const visibleMembers = guildMembers.filter((entry) => {
    if (!memberQuery) return true;
    const name = String(entry?.name || '').toLowerCase();
    const username = String(entry?.username || '').toLowerCase();
    const id = String(entry?.id || '');
    return name.includes(memberQuery) || username.includes(memberQuery) || id.includes(memberQuery);
  });
  const visibleMemberIds = visibleMembers.map((entry) => String(entry.id));
  const allVisibleSelected = visibleMemberIds.length > 0
    && visibleMemberIds.every((id) => selectedAssignIds.includes(id));

  return (
    <div className="profile">
      <header className="profile__id">
        <div className="profile__avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <div className="profile__avatar-fallback">
              <UserIcon className="h-7 w-7" />
            </div>
          )}
        </div>
        <div className="profile__id-copy">
          <p className="profile__kicker">Profilo</p>
          <h1 className="profile__name">{displayName}</h1>
          <p className="profile__meta">{user.username ? `@${user.username}` : user.id}</p>
        </div>
        <div className="profile__stats">
          <div className="profile__stat">
            <span className="profile__stat-value">{userAchievements.length}</span>
            <span className="profile__stat-label">Patch</span>
          </div>
          <div className="profile__stat">
            <span className="profile__stat-value">{ownLeaderboardEntry?.position || '—'}</span>
            <span className="profile__stat-label">Classifica</span>
          </div>
        </div>
      </header>

      <div className="profile__layout">
        <section className="profile__board">
          <div className="profile__section-head">
            <h2 className="profile__section-title">Riconoscimenti</h2>
            <p className="profile__section-note">Clicca una patch per ruotarla</p>
          </div>

          {loading && (
            <div className="profile__status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Caricamento
            </div>
          )}
          <InlineError message={error} className="mb-3" />

          {userAchievements.length === 0 && !loading ? (
            <p className="profile__empty">Nessuna patch assegnata.</p>
          ) : (
            <div className="profile__patches">
              {userAchievements.map((achievement) => (
                <button
                  key={achievement.awardId || achievement.achievementId}
                  type="button"
                  className="profile__patch"
                  onClick={() => openPatchViewer(achievement)}
                  disabled={!achievement.imageUrl}
                  title={achievement.imageUrl ? 'Apri patch' : 'Patch non disponibile'}
                  aria-label={achievement.imageUrl ? `Apri patch ${achievement.name || ''}` : 'Patch non disponibile'}
                >
                  {achievement.imageUrl ? (
                    <img
                      src={achievement.imageUrl}
                      alt=""
                      className="profile__patch-art"
                      loading="lazy"
                    />
                  ) : (
                    <span className="profile__patch-fallback">
                      <Award className="h-8 w-8" />
                    </span>
                  )}
                  <p className="profile__patch-name">{achievement.name}</p>
                  <p className="profile__patch-date">{formatDate(achievement.awardedAt)}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="profile__standings">
          <div className="profile__section-head">
            <h2 className="profile__section-title">Classifica</h2>
          </div>
          {leaderboard.length === 0 ? (
            <p className="profile__empty">Nessun dato.</p>
          ) : (
            <div className="profile__standings-list">
              {leaderboard.slice(0, 12).map((entry) => {
                const isSelf = String(entry?.userId || '') === String(user?.id || '');
                const rowName = normalizeUserName(entry?.displayName, entry?.userId);
                const position = Number(entry?.position || 0);
                return (
                  <div
                    key={`${entry?.userId || 'user'}-${entry?.position || 0}`}
                    className={`profile__standings-row${isSelf ? ' is-self' : ''}`}
                  >
                    <span className={`profile__standings-pos${position > 0 && position <= 3 ? ' is-top' : ''}`}>
                      {entry?.position || '—'}
                    </span>
                    <span className="profile__standings-name">{isSelf ? `${rowName} · tu` : rowName}</span>
                    <span className="profile__standings-count">{entry?.achievementCount || 0}</span>
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {canManageAchievements && (
        <section className="profile__ops">
          <button
            type="button"
            className="profile__ops-toggle"
            onClick={() => setManagementOpen((prev) => !prev)}
            aria-expanded={managementOpen}
          >
            Gestione
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${managementOpen ? 'rotate-180' : ''}`} />
          </button>

          {managementOpen && (
            <div className="profile-ops">
              <div className="profile-ops__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={opsMode === 'assign'}
                  className={`profile-ops__tab${opsMode === 'assign' ? ' is-active' : ''}`}
                  onClick={() => setOpsMode('assign')}
                >
                  Assegna
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={opsMode === 'create'}
                  className={`profile-ops__tab${opsMode === 'create' ? ' is-active' : ''}`}
                  onClick={() => setOpsMode('create')}
                >
                  Nuova
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={opsMode === 'edit'}
                  className={`profile-ops__tab${opsMode === 'edit' ? ' is-active' : ''}`}
                  onClick={() => setOpsMode('edit')}
                >
                  Modifica
                </button>
              </div>

              {opsMode === 'assign' && (
                <form onSubmit={handleAssignAchievement} className="profile-ops__form">
                  <label className="profile-ops__label">
                    Patch
                    <select
                      value={assignAchievementId}
                      onChange={(event) => setAssignAchievementId(event.target.value)}
                      className="profile-input"
                    >
                      {catalog.length === 0 ? (
                        <option value="">Nessuna patch</option>
                      ) : (
                        catalog.map((entry) => (
                          <option key={entry.id} value={entry.id}>{entry.name}</option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="profile-ops__label">
                    Piloti
                    <input
                      type="search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Cerca nome o username"
                      className="profile-input"
                    />
                  </label>
                  <div className="profile-member-toolbar">
                    <span>{selectedAssignIds.length} selezionati</span>
                    <button
                      type="button"
                      className="profile-member-link"
                      disabled={visibleMemberIds.length === 0}
                      onClick={() => {
                        if (allVisibleSelected) {
                          setSelectedAssignIds((prev) => prev.filter((id) => !visibleMemberIds.includes(id)));
                          return;
                        }
                        setSelectedAssignIds((prev) => Array.from(new Set([...prev, ...visibleMemberIds])));
                      }}
                    >
                      {allVisibleSelected ? 'Deseleziona visibili' : 'Seleziona visibili'}
                    </button>
                    <button
                      type="button"
                      className="profile-member-link"
                      disabled={selectedAssignIds.length === 0}
                      onClick={() => setSelectedAssignIds([])}
                    >
                      Nessuno
                    </button>
                  </div>
                  <div className="profile-member-list" role="listbox" aria-multiselectable="true">
                    {guildMembersLoading && (
                      <p className="profile-msg">Caricamento membri Discord…</p>
                    )}
                    {!guildMembersLoading && guildMembersError && (
                      <p className="profile-msg is-warn">{guildMembersError}</p>
                    )}
                    {!guildMembersLoading && !guildMembersError && visibleMembers.length === 0 && (
                      <p className="profile-msg">Nessun membro trovato.</p>
                    )}
                    {!guildMembersLoading && visibleMembers.map((entry) => {
                      const selected = selectedAssignIds.includes(entry.id);
                      return (
                        <label
                          key={entry.id}
                          className={`profile-member${selected ? ' is-selected' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleAssignMember(entry.id)}
                          />
                          <span className="profile-member__name">{entry.name}</span>
                          {entry.username ? (
                            <span className="profile-member__user">@{entry.username}</span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                  {assignStatus && (
                    <p className={`profile-msg${assignStatus.startsWith('Assegnata') || assignStatus.includes('successo') ? ' is-ok' : ' is-warn'}`}>
                      {assignStatus}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={assigningAchievement || catalog.length === 0 || selectedAssignIds.length === 0}
                    className="profile-btn"
                  >
                    {assigningAchievement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {selectedAssignIds.length > 1
                      ? `Assegna a ${selectedAssignIds.length}`
                      : 'Assegna'}
                  </button>
                </form>
              )}

              {opsMode === 'create' && (
                <form onSubmit={handleCreateAchievement} className="profile-ops__form profile-ops__form--split">
                  <label className="profile-file profile-file--drop">
                    {newAchievementImageUrl ? (
                      <img src={newAchievementImageUrl} alt="" />
                    ) : (
                      <span>
                        <Upload className="h-4 w-4" />
                        Immagine
                      </span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageFilePick} />
                  </label>
                  <div className="profile-ops__fields">
                    <input
                      type="text"
                      value={newAchievementName}
                      onChange={(event) => setNewAchievementName(event.target.value)}
                      placeholder="Nome"
                      className="profile-input"
                    />
                    <textarea
                      rows={2}
                      value={newAchievementDescription}
                      onChange={(event) => setNewAchievementDescription(event.target.value)}
                      placeholder="Descrizione"
                      className="profile-textarea"
                    />
                    {createStatus && (
                      <p className={`profile-msg${createStatus.includes('successo') ? ' is-ok' : ' is-warn'}`}>
                        {createStatus}
                      </p>
                    )}
                    <button type="submit" disabled={creatingAchievement} className="profile-btn">
                      {creatingAchievement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Crea
                    </button>
                  </div>
                </form>
              )}

              {opsMode === 'edit' && (
                <form onSubmit={handleUpdateAchievement} className="profile-ops__form profile-ops__form--split">
                  <label className="profile-file profile-file--drop">
                    {editAchievementImageUrl ? (
                      <img src={editAchievementImageUrl} alt="" />
                    ) : (
                      <span>
                        <Upload className="h-4 w-4" />
                        Immagine
                      </span>
                    )}
                    <input type="file" accept="image/*" className="hidden" onChange={handleEditImageFilePick} />
                  </label>
                  <div className="profile-ops__fields">
                    <select
                      value={editAchievementId}
                      onChange={(event) => setEditAchievementId(event.target.value)}
                      className="profile-input"
                    >
                      {catalog.length === 0 ? (
                        <option value="">Nessuna patch</option>
                      ) : (
                        catalog.map((entry) => (
                          <option key={entry.id} value={entry.id}>{entry.name}</option>
                        ))
                      )}
                    </select>
                    <input
                      type="text"
                      value={editAchievementName}
                      onChange={(event) => setEditAchievementName(event.target.value)}
                      placeholder="Nome"
                      className="profile-input"
                    />
                    <textarea
                      rows={2}
                      value={editAchievementDescription}
                      onChange={(event) => setEditAchievementDescription(event.target.value)}
                      placeholder="Descrizione"
                      className="profile-textarea"
                    />
                    {editStatus && (
                      <p className={`profile-msg${editStatus.includes('successo') || editStatus.includes('Rimossi') ? ' is-ok' : ' is-warn'}`}>
                        {editStatus}
                      </p>
                    )}
                    <div className="profile-actions">
                      <button
                        type="submit"
                        disabled={editingAchievement || deletingAchievement || catalog.length === 0}
                        className="profile-btn"
                      >
                        {editingAchievement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
                        Salva
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteAchievement}
                        disabled={editingAchievement || deletingAchievement || catalog.length === 0}
                        className="profile-btn profile-btn--danger"
                      >
                        {deletingAchievement ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Elimina
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          )}
        </section>
      )}

      {pendingClaim && (
        <div className="profile-claim">
          <p className="profile-claim__kicker">Nuovo riconoscimento</p>
          <p className="profile-claim__name">{pendingClaim.name || 'Achievement'}</p>
          <button type="button" onClick={handleClaimAchievement} className="profile-btn">
            Apri patch
          </button>
        </div>
      )}

      {typeof document !== 'undefined' && patchViewerAchievement ? createPortal(
        <PatchViewer achievement={patchViewerAchievement} onClose={closePatchViewer} />,
        document.body,
      ) : null}
    </div>
  );
}
