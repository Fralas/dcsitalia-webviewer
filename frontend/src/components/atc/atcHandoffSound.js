import { ATC_BAYS, OWNER_ROLE } from './atcStripModel';

const SFX_BASE = import.meta.env.VITE_SOCKET_URL
  || (typeof window !== 'undefined' ? window.location.origin : '');

let handoffAudio = null;
let audioPrimed = false;

export function primeHandoffAudio() {
  if (audioPrimed || typeof window === 'undefined') return;

  try {
    if (!handoffAudio) {
      handoffAudio = new Audio(`${SFX_BASE}/sfx/alert_handoff.mp3`);
    }
    const previousVolume = handoffAudio.volume;
    handoffAudio.volume = 0;
    const pending = handoffAudio.play();
    const finish = () => {
      handoffAudio.pause();
      handoffAudio.currentTime = 0;
      handoffAudio.volume = previousVolume || 0.85;
      audioPrimed = true;
    };
    if (pending?.then) pending.then(finish).catch(() => {});
    else finish();
  } catch {
    audioPrimed = true;
  }
}

export function playHandoffAlert() {
  if (typeof window === 'undefined') return;

  try {
    if (!handoffAudio) {
      handoffAudio = new Audio(`${SFX_BASE}/sfx/alert_handoff.mp3`);
      handoffAudio.volume = 0.85;
    }
    handoffAudio.currentTime = 0;
    const pending = handoffAudio.play();
    if (pending?.catch) pending.catch(() => {});
  } catch {
    // Autoplay policy or missing asset — ignore silently.
  }
}

/**
 * Rileva handoff in ingresso per il ruolo claimato.
 * - TOWER: nuova strip in coda TOC (handoff da GROUND)
 * - GROUND: strip restituita da TOWER (fine handoff su baia ground)
 */
export function shouldPlayHandoffAlert(prevStrips, nextStrips, claimedRole, userId, recentHistory = []) {
  if (!claimedRole || !Array.isArray(prevStrips) || !Array.isArray(nextStrips)) return false;

  const lastEntry = recentHistory[0];
  if (lastEntry?.userId && userId && lastEntry.userId === userId) return false;

  const prevById = new Map(prevStrips.map((strip) => [strip.id, strip]));
  let towerIncoming = false;
  let groundIncoming = false;

  nextStrips.forEach((strip) => {
    const prev = prevById.get(strip.id);
    if (!prev) return;

    if (strip.handoffActive && strip.bayId === ATC_BAYS.T_PENDING && !prev.handoffActive) {
      towerIncoming = true;
    }

    if (prev.handoffActive && !strip.handoffActive && strip.bayId?.startsWith('g_')) {
      groundIncoming = true;
    }
  });

  if (claimedRole === OWNER_ROLE.TOWER && towerIncoming) return true;
  if (claimedRole === OWNER_ROLE.GROUND && groundIncoming) return true;
  return false;
}
