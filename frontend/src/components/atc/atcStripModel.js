export const STRIP_MODEL = Object.freeze({
  ARRIVAL: 'A',
  DEPARTURE: 'B',
  LOCAL: 'C',
});

export const STRIP_DIRECTION = Object.freeze({
  ARR: 'arr',
  DEP: 'dep',
});

export const OWNER_ROLE = Object.freeze({
  GROUND: 'GROUND',
  TOWER: 'TOWER',
});

export const COORDINATION_STATUS = Object.freeze({
  PENDING_TOC: 'pending_toc',
  PENDING_AOG: 'pending_aog',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
});

export const HANDOFF_TARGET = Object.freeze({
  TOWER: 'tower',
  GROUND: 'ground',
});

export const ATC_BAYS = Object.freeze({
  G_INACTIVE: 'g_inactive',
  G_ACTIVE: 'g_active',
  G_STAND: 'g_stand',
  G_TAXI: 'g_taxi',
  G_HP: 'g_hp',
  G_HANDOFF: 'g_handoff',
  T_HANDOFF: 't_handoff',
  T_PENDING: 't_pending',
  T_ACTIVE: 't_active',
  T_FINAL: 't_final',
  T_RUNWAY: 't_runway',
  T_AIRBORNE: 't_airborne',
  T_LANDED: 't_landed',
  ARCHIVE: 'archive',
});

export const GROUND_BAYS = [
  ATC_BAYS.G_INACTIVE,
  ATC_BAYS.G_ACTIVE,
  ATC_BAYS.G_STAND,
  ATC_BAYS.G_TAXI,
  ATC_BAYS.G_HP,
  ATC_BAYS.G_HANDOFF,
];

export const TOWER_BAYS = [
  ATC_BAYS.T_HANDOFF,
  ATC_BAYS.T_PENDING,
  ATC_BAYS.T_ACTIVE,
  ATC_BAYS.T_FINAL,
  ATC_BAYS.T_RUNWAY,
  ATC_BAYS.T_AIRBORNE,
  ATC_BAYS.T_LANDED,
  ATC_BAYS.ARCHIVE,
];

export const BAY_META = Object.freeze({
  [ATC_BAYS.G_INACTIVE]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gInactive' },
  [ATC_BAYS.G_ACTIVE]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gActive' },
  [ATC_BAYS.G_STAND]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gStand' },
  [ATC_BAYS.G_TAXI]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gTaxi' },
  [ATC_BAYS.G_HP]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gHp' },
  [ATC_BAYS.G_HANDOFF]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gHandoff' },
  [ATC_BAYS.T_HANDOFF]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tHandoff' },
  [ATC_BAYS.T_PENDING]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tPending' },
  [ATC_BAYS.T_ACTIVE]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tActive' },
  [ATC_BAYS.T_FINAL]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tFinal' },
  [ATC_BAYS.T_RUNWAY]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tRunway' },
  [ATC_BAYS.T_AIRBORNE]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tAirborne' },
  [ATC_BAYS.T_LANDED]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tLanded' },
  [ATC_BAYS.ARCHIVE]: { role: null, labelKey: 'atc.bays.archive' },
});

export function isHandoffToTower(strip) {
  if (!strip?.handoffActive) return false;
  return strip.handoffTarget !== HANDOFF_TARGET.GROUND;
}

export function isHandoffToGround(strip) {
  return Boolean(strip?.handoffActive && strip.handoffTarget === HANDOFF_TARGET.GROUND);
}

export function groupStripsByBay(strips = []) {
  const grouped = {};
  Object.values(ATC_BAYS).forEach((bayId) => {
    grouped[bayId] = [];
  });
  strips.forEach((strip) => {
    if (!grouped[strip.bayId]) grouped[strip.bayId] = [];
    grouped[strip.bayId].push(strip);
  });
  return grouped;
}

export function getBaysForRole(role) {
  return role === OWNER_ROLE.GROUND ? GROUND_BAYS : TOWER_BAYS;
}

function sortPendingQueue(strips = []) {
  return [...strips].sort((a, b) => {
    if (a.handoffActive && b.handoffActive) {
      return (a.queuePosition ?? 999) - (b.queuePosition ?? 999);
    }
    if (a.handoffActive) return -1;
    if (b.handoffActive) return 1;
    return String(a.eobt || a.eta || '').localeCompare(String(b.eobt || b.eta || ''));
  });
}

/** Raggruppa tutte le strip per baia (vista completa GROUND + TOWER). */
export function groupStripsForFullBoard(strips = []) {
  const grouped = groupStripsByBay(strips);
  grouped[ATC_BAYS.G_HANDOFF] = [];
  grouped[ATC_BAYS.T_HANDOFF] = [];

  strips.forEach((strip) => {
    if (isHandoffToTower(strip) && strip.bayId === ATC_BAYS.T_PENDING) {
      grouped[ATC_BAYS.G_HANDOFF].push(strip);
    }
    if (isHandoffToGround(strip) && strip.bayId === ATC_BAYS.G_HP) {
      grouped[ATC_BAYS.T_HANDOFF].push(strip);
    }
  });

  if (grouped[ATC_BAYS.T_PENDING]?.length) {
    grouped[ATC_BAYS.T_PENDING] = sortPendingQueue(grouped[ATC_BAYS.T_PENDING]);
  }

  return grouped;
}

export function isBayOwnedByRole(bayId, role) {
  if (!role) return false;
  if (bayId === ATC_BAYS.ARCHIVE) return role === OWNER_ROLE.TOWER;
  return BAY_META[bayId]?.role === role;
}

export function resolveClaimedRole(roleSlots, userId) {
  if (!userId || !roleSlots) return null;
  if (roleSlots.GROUND?.userId === userId) return OWNER_ROLE.GROUND;
  if (roleSlots.TOWER?.userId === userId) return OWNER_ROLE.TOWER;
  return null;
}

export function canEditStrip(strip, role) {
  if (!role) return false;
  if (role === OWNER_ROLE.GROUND) {
    if (isHandoffToGround(strip)) return true;
    if (isHandoffToTower(strip)) return true;
    return strip.bayId?.startsWith('g_') && strip.bayId !== ATC_BAYS.G_HANDOFF;
  }
  if (role === OWNER_ROLE.TOWER) {
    if (isHandoffToGround(strip)) return true;
    if (isHandoffToTower(strip)) return true;
    return strip.bayId?.startsWith('t_') && strip.bayId !== ATC_BAYS.T_HANDOFF
      || strip.bayId === ATC_BAYS.ARCHIVE;
  }
  return false;
}

export function isPendingTowerCoordination(strip) {
  return strip?.coordinationStatus === COORDINATION_STATUS.PENDING_TOC && isHandoffToTower(strip);
}

export function isPendingGroundCoordination(strip) {
  return strip?.coordinationStatus === COORDINATION_STATUS.PENDING_AOG && isHandoffToGround(strip);
}

export function getStripModelClass(model) {
  if (model === STRIP_MODEL.ARRIVAL) return 'atc-strip--arrival';
  if (model === STRIP_MODEL.LOCAL) return 'atc-strip--local';
  return 'atc-strip--departure';
}

export function createEmptyForm(direction) {
  if (direction === STRIP_DIRECTION.ARR) {
    return {
      direction,
      callsign: '',
      flightRule: 'I',
      eta: '',
      origin: '',
      destination: '',
      aircraftType: '',
      wakeCategory: 'M',
      tas: '',
      ata: '',
      ataAcknowledged: false,
      pilotEstimate: '',
      previousFix: '',
      ato: '',
      atl: '',
      missedApproach: '',
      localJ: '',
      localK: '',
      stand: '',
      standAcknowledged: false,
      remarks: '',
    };
  }
  return {
    direction,
    callsign: '',
    flightRule: 'I',
    eobt: '',
    aircraftType: '',
    destination: '',
    runway: '',
    sid: '',
    levelPlanned: '',
    level: '',
    ssr: '',
    delay: '',
    startup: '',
    taxiAuth: '',
    clearanceTimes: '',
    route: '',
    clearanceText: '',
    instructions: '',
    remarks: '',
  };
}
