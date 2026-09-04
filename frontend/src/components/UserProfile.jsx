import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Award, ChevronDown, Loader2, Pencil, Trash2, Upload, User as UserIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useUser } from '../contexts/UserContext';
import * as api from '../services/api';
import InlineError from './InlineError';
import velcroTextureImg from '../../img/velcrotexture.jpg';
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

const PATCH_DEPTH_STEPS = [-5, -3, -1, 1, 3, 5];
const PATCH_GIMBAL_EPSILON_DEG = 0.05;
const PATCH_TEXTURE_TILE_SIZE_PX = 220;
const PATCH_SPIN_DEG_PER_PX = 0.45;
const PATCH_MOMENTUM_FRICTION_PER_FRAME = 0.94;
const PATCH_MIN_MOMENTUM_DEG_PER_MS = 0.01;
const ACHIEVEMENTS_REFRESH_INTERVAL_MS = 15000;

function getAchievementAwardKey(achievement) {
  const awardId = String(achievement?.awardId || '').trim();
  if (awardId) return `award:${awardId}`;

  const achievementId = String(achievement?.achievementId || '').trim();
  const awardedAt = Number(achievement?.awardedAt || 0);
  const achievementName = String(achievement?.name || '').trim();
  return `fallback:${achievementId}:${awardedAt}:${achievementName}`;
}

function avoidOrthogonalYaw(yawDeg) {
  const normalized = ((yawDeg % 180) + 180) % 180;
  if (Math.abs(normalized - 90) < 0.0001) {
    return yawDeg + PATCH_GIMBAL_EPSILON_DEG;
  }
  return yawDeg;
}

export default function UserProfile() {
  const { user } = useUser();
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
  const [pendingAchievementClaims, setPendingAchievementClaims] = useState([]);
  const [patchRotation, setPatchRotation] = useState({ x: -12, y: 18 });
  const [patchZoom, setPatchZoom] = useState(1);
  const [isDraggingPatch, setIsDraggingPatch] = useState(false);
  const [isPatchMomentumActive, setIsPatchMomentumActive] = useState(false);
  const hasInitialAwardsSnapshotRef = useRef(false);
  const knownAwardKeysRef = useRef(new Set());
  const fetchInFlightRef = useRef(false);
  const patchDragRef = useRef({ active: false, lastX: 0, lastY: 0, lastMoveTs: 0 });
  const patchMomentumRef = useRef({
    velocityDegPerMs: 0,
    lastTs: 0,
    rafId: null,
  });

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
      if (!background) {
        setError(requestError?.message || 'Errore durante il caricamento dei riconoscimenti.');
      }
    } finally {
      fetchInFlightRef.current = false;
      if (!background) {
        setLoading(false);
      }
    }
  }, [canManageAchievements, user?.id]);

  useEffect(() => {
    fetchAchievementData();
  }, [fetchAchievementData]);

  useEffect(() => {
    if (!user?.id) return undefined;
    const intervalId = window.setInterval(() => {
      fetchAchievementData({ background: true });
    }, ACHIEVEMENTS_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [fetchAchievementData, user?.id]);

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
        stopPatchMomentum();
        setIsDraggingPatch(false);
        patchDragRef.current.active = false;
        setPatchViewerAchievement(null);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [patchViewerAchievement]);

  useEffect(() => () => {
    if (patchMomentumRef.current.rafId !== null) {
      window.cancelAnimationFrame(patchMomentumRef.current.rafId);
      patchMomentumRef.current.rafId = null;
    }
  }, []);

  useEffect(() => {
    hasInitialAwardsSnapshotRef.current = false;
    knownAwardKeysRef.current = new Set();
    setPendingAchievementClaims([]);
  }, [user?.id]);

  useEffect(() => {
    const achievements = Array.isArray(userAchievements) ? userAchievements : [];
    const currentKeys = new Set();
    const justUnlocked = [];

    achievements.forEach((achievement) => {
      const key = getAchievementAwardKey(achievement);
      currentKeys.add(key);
      if (hasInitialAwardsSnapshotRef.current && !knownAwardKeysRef.current.has(key)) {
        justUnlocked.push(achievement);
      }
    });

    if (!hasInitialAwardsSnapshotRef.current) {
      knownAwardKeysRef.current = currentKeys;
      hasInitialAwardsSnapshotRef.current = true;
      return;
    }

    knownAwardKeysRef.current = currentKeys;

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
  }, [userAchievements]);

  const stopPatchMomentum = () => {
    if (patchMomentumRef.current.rafId !== null) {
      window.cancelAnimationFrame(patchMomentumRef.current.rafId);
      patchMomentumRef.current.rafId = null;
    }
    patchMomentumRef.current.velocityDegPerMs = 0;
    patchMomentumRef.current.lastTs = 0;
    setIsPatchMomentumActive(false);
  };

  const startPatchMomentum = () => {
    const initialVelocity = patchMomentumRef.current.velocityDegPerMs;
    if (!Number.isFinite(initialVelocity) || Math.abs(initialVelocity) < PATCH_MIN_MOMENTUM_DEG_PER_MS) {
      stopPatchMomentum();
      return;
    }

    if (patchMomentumRef.current.rafId !== null) {
      window.cancelAnimationFrame(patchMomentumRef.current.rafId);
      patchMomentumRef.current.rafId = null;
    }

    patchMomentumRef.current.lastTs = 0;
    setIsPatchMomentumActive(true);

    const tick = (timestamp) => {
      const state = patchMomentumRef.current;
      if (!patchViewerAchievement) {
        stopPatchMomentum();
        return;
      }

      if (!state.lastTs) {
        state.lastTs = timestamp;
      }

      const dtMs = Math.max(0, timestamp - state.lastTs);
      state.lastTs = timestamp;

      if (dtMs > 0) {
        const deltaYaw = state.velocityDegPerMs * dtMs;
        setPatchRotation((prev) => ({ x: 0, y: prev.y + deltaYaw }));

        const friction = Math.pow(PATCH_MOMENTUM_FRICTION_PER_FRAME, dtMs / 16.6667);
        state.velocityDegPerMs *= friction;
      }

      if (Math.abs(state.velocityDegPerMs) < PATCH_MIN_MOMENTUM_DEG_PER_MS) {
        stopPatchMomentum();
        return;
      }

      state.rafId = window.requestAnimationFrame(tick);
    };

    patchMomentumRef.current.rafId = window.requestAnimationFrame(tick);
  };

  const openPatchViewer = (achievement) => {
    const imageUrl = String(achievement?.imageUrl || '').trim();
    if (!imageUrl) return false;
    stopPatchMomentum();
    setPatchRotation({ x: 0, y: 0 });
    setPatchZoom(1);
    setPatchViewerAchievement({
      name: String(achievement?.name || 'Achievement'),
      description: String(achievement?.description || '').trim(),
      imageUrl,
    });
    return true;
  };

  const closePatchViewer = () => {
    stopPatchMomentum();
    setPatchViewerAchievement(null);
    setIsDraggingPatch(false);
    patchDragRef.current.active = false;
  };

  const handlePatchPointerDown = (event) => {
    stopPatchMomentum();
    patchDragRef.current = {
      active: true,
      lastX: event.clientX,
      lastY: event.clientY,
      lastMoveTs: performance.now(),
    };
    patchMomentumRef.current.velocityDegPerMs = 0;
    setIsDraggingPatch(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePatchPointerMove = (event) => {
    if (!patchDragRef.current.active) return;

    const dx = event.clientX - patchDragRef.current.lastX;
    const nowTs = performance.now();
    const dtMs = Math.max(1, nowTs - patchDragRef.current.lastMoveTs);
    const deltaYaw = dx * PATCH_SPIN_DEG_PER_PX;
    const instantVelocity = deltaYaw / dtMs;
    patchMomentumRef.current.velocityDegPerMs = (patchMomentumRef.current.velocityDegPerMs * 0.65) + (instantVelocity * 0.35);

    patchDragRef.current.lastX = event.clientX;
    patchDragRef.current.lastY = event.clientY;
    patchDragRef.current.lastMoveTs = nowTs;

    setPatchRotation((prev) => {
      const nextY = prev.y + deltaYaw;
      return { x: 0, y: nextY };
    });
  };

  const handlePatchPointerUp = (event) => {
    const wasDragging = patchDragRef.current.active;
    patchDragRef.current.active = false;
    setIsDraggingPatch(false);
    if (wasDragging) {
      startPatchMomentum();
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const handlePatchWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY;
    setPatchZoom((prev) => {
      const next = delta < 0 ? prev + 0.12 : prev - 0.12;
      return Math.max(1, Math.min(2.5, next));
    });
  };

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

  const patchViewerModal = patchViewerAchievement ? (
    <div className="profile-viewer" onClick={closePatchViewer}>
      <button type="button" className="profile-viewer__close" onClick={closePatchViewer}>
        Chiudi
      </button>
      <div
        className="profile-viewer__stage"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="profile-viewer__name">{patchViewerAchievement.name}</p>
        <p className="profile-viewer__desc">
          {patchViewerAchievement.description || 'Nessuna descrizione disponibile.'}
        </p>

        <div className="profile-viewer__canvas">
          <div
            className={`profile-viewer__hit${isDraggingPatch ? ' is-dragging' : ''}`}
            onPointerDown={handlePatchPointerDown}
            onPointerMove={handlePatchPointerMove}
            onPointerUp={handlePatchPointerUp}
            onPointerCancel={handlePatchPointerUp}
            onPointerLeave={handlePatchPointerUp}
            onWheel={handlePatchWheel}
          >
            <div
              className="relative h-full w-full [transform-style:preserve-3d]"
              style={{
                transform: `scale(${patchZoom}) rotateX(${patchRotation.x}deg) rotateY(${avoidOrthogonalYaw(patchRotation.y)}deg)`,
                transition: (isDraggingPatch || isPatchMomentumActive) ? 'none' : 'transform 120ms ease-out',
              }}
            >
              {PATCH_DEPTH_STEPS.map((depth) => (
                <div
                  key={`patch-depth-${depth}`}
                  className="absolute inset-0"
                  style={{
                    transform: `translateZ(${depth}px)`,
                    WebkitMaskImage: `url(${patchViewerAchievement.imageUrl})`,
                    maskImage: `url(${patchViewerAchievement.imageUrl})`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    backgroundImage: `url(${velcroTextureImg})`,
                    backgroundRepeat: 'repeat',
                    backgroundPosition: '0 0',
                    backgroundSize: `${PATCH_TEXTURE_TILE_SIZE_PX}px ${PATCH_TEXTURE_TILE_SIZE_PX}px`,
                    opacity: 0.96,
                  }}
                />
              ))}
              <div className="absolute inset-0 [backface-visibility:hidden] [transform:translateZ(7px)]">
                <img
                  src={patchViewerAchievement.imageUrl}
                  alt={patchViewerAchievement.name}
                  className="h-full w-full object-contain drop-shadow-[0_24px_34px_rgba(0,0,0,0.52)]"
                  draggable={false}
                />
              </div>
              <div
                className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)_translateZ(7px)]"
                style={{
                  WebkitMaskImage: `url(${patchViewerAchievement.imageUrl})`,
                  maskImage: `url(${patchViewerAchievement.imageUrl})`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskSize: 'contain',
                  backgroundImage: `url(${velcroTextureImg})`,
                  backgroundRepeat: 'repeat',
                  backgroundPosition: '0 0',
                  backgroundSize: `${PATCH_TEXTURE_TILE_SIZE_PX}px ${PATCH_TEXTURE_TILE_SIZE_PX}px`,
                }}
              >
                <div
                  aria-label="Retro patch velcro"
                  className="h-full w-full drop-shadow-[0_24px_34px_rgba(0,0,0,0.52)]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

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
            <div className="profile__ops-grid">
              <form onSubmit={handleCreateAchievement} className="profile__ops-panel">
                <h4>Crea</h4>
                <input
                  type="text"
                  value={newAchievementName}
                  onChange={(event) => setNewAchievementName(event.target.value)}
                  placeholder="Nome"
                  className="profile-input"
                />
                <textarea
                  rows={3}
                  value={newAchievementDescription}
                  onChange={(event) => setNewAchievementDescription(event.target.value)}
                  placeholder="Descrizione"
                  className="profile-textarea"
                />
                <input
                  type="text"
                  value={newAchievementImageUrl}
                  onChange={(event) => setNewAchievementImageUrl(event.target.value)}
                  placeholder="URL immagine"
                  className="profile-input"
                />
                <label className="profile-file">
                  <Upload className="h-3.5 w-3.5" />
                  Carica
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageFilePick} />
                </label>
                {newAchievementImageName && <span className="profile-file-name">{newAchievementImageName}</span>}
                {newAchievementImageUrl && (
                  <div className="profile-preview">
                    <img src={newAchievementImageUrl} alt="" />
                  </div>
                )}
                {createStatus && (
                  <p className={`profile-msg${createStatus.includes('successo') ? ' is-ok' : ' is-warn'}`}>
                    {createStatus}
                  </p>
                )}
                <button type="submit" disabled={creatingAchievement} className="profile-btn">
                  {creatingAchievement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Crea
                </button>
              </form>

              <form onSubmit={handleAssignAchievement} className="profile__ops-panel">
                <h4>Assegna</h4>
                <select
                  value={assignAchievementId}
                  onChange={(event) => setAssignAchievementId(event.target.value)}
                  className="profile-select"
                >
                  {catalog.length === 0 ? (
                    <option value="">Nessun achievement</option>
                  ) : (
                    catalog.map((entry) => (
                      <option key={entry.id} value={entry.id}>{entry.name}</option>
                    ))
                  )}
                </select>
                <input
                  type="text"
                  value={assignUserId}
                  onChange={(event) => setAssignUserId(event.target.value)}
                  placeholder="Discord user ID"
                  className="profile-input"
                />
                <input
                  type="text"
                  value={assignUserName}
                  onChange={(event) => setAssignUserName(event.target.value)}
                  placeholder="Nome visualizzato"
                  className="profile-input"
                />
                {knownUsers.length > 0 && (
                  <div className="profile-online">
                    {knownUsers.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="profile-chip"
                        onClick={() => {
                          setAssignUserId(entry.id);
                          setAssignUserName(entry.name);
                        }}
                      >
                        {entry.name}
                      </button>
                    ))}
                  </div>
                )}
                {assignStatus && (
                  <p className={`profile-msg${assignStatus.includes('successo') ? ' is-ok' : ' is-warn'}`}>
                    {assignStatus}
                  </p>
                )}
                <button type="submit" disabled={assigningAchievement || catalog.length === 0} className="profile-btn">
                  {assigningAchievement && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Assegna
                </button>
              </form>

              <form onSubmit={handleUpdateAchievement} className="profile__ops-panel">
                <h4>Modifica</h4>
                <select
                  value={editAchievementId}
                  onChange={(event) => setEditAchievementId(event.target.value)}
                  className="profile-select"
                >
                  {catalog.length === 0 ? (
                    <option value="">Nessun achievement</option>
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
                  rows={3}
                  value={editAchievementDescription}
                  onChange={(event) => setEditAchievementDescription(event.target.value)}
                  placeholder="Descrizione"
                  className="profile-textarea"
                />
                <input
                  type="text"
                  value={editAchievementImageUrl}
                  onChange={(event) => setEditAchievementImageUrl(event.target.value)}
                  placeholder="URL immagine"
                  className="profile-input"
                />
                <label className="profile-file">
                  <Upload className="h-3.5 w-3.5" />
                  Carica
                  <input type="file" accept="image/*" className="hidden" onChange={handleEditImageFilePick} />
                </label>
                {editAchievementImageName && <span className="profile-file-name">{editAchievementImageName}</span>}
                {editAchievementImageUrl && (
                  <div className="profile-preview">
                    <img src={editAchievementImageUrl} alt="" />
                  </div>
                )}
                {editStatus && (
                  <p className={`profile-msg${editStatus.includes('successo') || editStatus.includes('Rimossi') ? ' is-ok' : ' is-warn'}`}>
                    {editStatus}
                  </p>
                )}
                <div className="profile-actions">
                  <button
                    type="submit"
                    disabled={editingAchievement || deletingAchievement || catalog.length === 0}
                    className="profile-btn profile-btn--ghost"
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
              </form>
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

      {typeof document !== 'undefined' && patchViewerModal ? createPortal(patchViewerModal, document.body) : null}
    </div>
  );
}
