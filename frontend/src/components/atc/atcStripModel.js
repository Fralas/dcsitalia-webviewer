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
    if (isHandoffToTower(strip) && strip.bayId === ATC_BAYS.G_HP) {
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
  if (!role || !strip) return false;

  if (role === OWNER_ROLE.GROUND) {
    if (isHandoffToGround(strip)) return true;
    if (isHandoffToTower(strip)) return true;
    if (strip.ownerRole === OWNER_ROLE.TOWER) return false;
    if (strip.bayId?.startsWith('t_')) return false;
    return strip.bayId?.startsWith('g_') && strip.bayId !== ATC_BAYS.G_HANDOFF;
  }

  if (role === OWNER_ROLE.TOWER) {
    if (isHandoffToTower(strip)) return true;
    if (isHandoffToGround(strip)) return false;
    if (strip.bayId === ATC_BAYS.G_HP) return false;
    return (strip.bayId?.startsWith('t_') && strip.bayId !== ATC_BAYS.T_HANDOFF)
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

export const STRIP_CATEGORY = Object.freeze({
  ATZ: 'atz',
  DOWNWIND: 'downwind',
  BASE: 'base',
  FINAL: 'final',
  RUNWAY: 'runway',
  HP: 'hp',
  TAXI: 'taxi',
  STAND: 'stand',
  INACTIVE: 'inactive',
});

export const CATEGORY_CODES = Object.freeze({
  [STRIP_CATEGORY.ATZ]: 'Z',
  [STRIP_CATEGORY.DOWNWIND]: 'D',
  [STRIP_CATEGORY.BASE]: 'B',
  [STRIP_CATEGORY.FINAL]: 'F',
  [STRIP_CATEGORY.RUNWAY]: 'R',
  [STRIP_CATEGORY.HP]: 'H',
  [STRIP_CATEGORY.TAXI]: 'T',
  [STRIP_CATEGORY.STAND]: 'S',
  [STRIP_CATEGORY.INACTIVE]: '',
});

export const TOWER_CATEGORY_ORDER = [
  STRIP_CATEGORY.ATZ,
  STRIP_CATEGORY.DOWNWIND,
  STRIP_CATEGORY.BASE,
  STRIP_CATEGORY.FINAL,
];

export const GROUND_CATEGORY_ORDER = [
  STRIP_CATEGORY.HP,
  STRIP_CATEGORY.TAXI,
  STRIP_CATEGORY.STAND,
];

const BAY_TO_CATEGORY = Object.freeze({
  [ATC_BAYS.T_AIRBORNE]: STRIP_CATEGORY.ATZ,
  [ATC_BAYS.T_PENDING]: STRIP_CATEGORY.ATZ,
  [ATC_BAYS.T_FINAL]: STRIP_CATEGORY.FINAL,
  [ATC_BAYS.T_RUNWAY]: STRIP_CATEGORY.RUNWAY,
  [ATC_BAYS.T_LANDED]: STRIP_CATEGORY.HP,
  [ATC_BAYS.G_HP]: STRIP_CATEGORY.HP,
  [ATC_BAYS.G_TAXI]: STRIP_CATEGORY.TAXI,
  [ATC_BAYS.G_STAND]: STRIP_CATEGORY.STAND,
  [ATC_BAYS.G_ACTIVE]: STRIP_CATEGORY.STAND,
  [ATC_BAYS.G_INACTIVE]: STRIP_CATEGORY.INACTIVE,
});

export const CATEGORY_OWNER = Object.freeze({
  [STRIP_CATEGORY.ATZ]: OWNER_ROLE.TOWER,
  [STRIP_CATEGORY.DOWNWIND]: OWNER_ROLE.TOWER,
  [STRIP_CATEGORY.BASE]: OWNER_ROLE.TOWER,
  [STRIP_CATEGORY.FINAL]: OWNER_ROLE.TOWER,
  [STRIP_CATEGORY.RUNWAY]: OWNER_ROLE.TOWER,
  [STRIP_CATEGORY.HP]: null,
  [STRIP_CATEGORY.TAXI]: OWNER_ROLE.GROUND,
  [STRIP_CATEGORY.STAND]: OWNER_ROLE.GROUND,
  [STRIP_CATEGORY.INACTIVE]: OWNER_ROLE.GROUND,
});

export function getStripCategory(strip) {
  if (!strip) return null;
  if (strip.bayId === ATC_BAYS.ARCHIVE) return null;

  if (isHandoffToTower(strip) || isHandoffToGround(strip)) return STRIP_CATEGORY.HP;

  if (strip.bayId === ATC_BAYS.T_ACTIVE) {
    if (strip.operationalState === 'downwind') return STRIP_CATEGORY.DOWNWIND;
    if (strip.operationalState === 'base') return STRIP_CATEGORY.BASE;
    return strip.direction === STRIP_DIRECTION.ARR
      ? STRIP_CATEGORY.DOWNWIND
      : STRIP_CATEGORY.BASE;
  }

  return BAY_TO_CATEGORY[strip.bayId] || STRIP_CATEGORY.STAND;
}

export function getStripStateCode(strip) {
  const category = getStripCategory(strip);
  return category ? (CATEGORY_CODES[category] || '') : '';
}

export function getTargetBayForCategory(strip, categoryId) {
  if (categoryId === STRIP_CATEGORY.ATZ) {
    if (strip.bayId === ATC_BAYS.T_AIRBORNE) return ATC_BAYS.T_AIRBORNE;
    return ATC_BAYS.T_PENDING;
  }
  if (categoryId === STRIP_CATEGORY.DOWNWIND || categoryId === STRIP_CATEGORY.BASE) {
    return ATC_BAYS.T_ACTIVE;
  }
  if (categoryId === STRIP_CATEGORY.HP) {
    if (strip.bayId === ATC_BAYS.T_LANDED) return ATC_BAYS.T_LANDED;
    return ATC_BAYS.G_HP;
  }
  const map = {
    [STRIP_CATEGORY.FINAL]: ATC_BAYS.T_FINAL,
    [STRIP_CATEGORY.RUNWAY]: ATC_BAYS.T_RUNWAY,
    [STRIP_CATEGORY.TAXI]: ATC_BAYS.G_TAXI,
    [STRIP_CATEGORY.STAND]: ATC_BAYS.G_STAND,
    [STRIP_CATEGORY.INACTIVE]: ATC_BAYS.G_INACTIVE,
  };
  return map[categoryId] || strip.bayId;
}

export function getOperationalStateForCategory(categoryId) {
  if (categoryId === STRIP_CATEGORY.DOWNWIND) return 'downwind';
  if (categoryId === STRIP_CATEGORY.BASE) return 'base';
  return null;
}

export function isCategoryOwnedByRole(categoryId, role) {
  if (!role) return false;
  const owner = CATEGORY_OWNER[categoryId];
  if (!owner) return true;
  return owner === role;
}

const TOWER_DROP_CATEGORIES = [...TOWER_CATEGORY_ORDER, STRIP_CATEGORY.RUNWAY];

export function isCategoryDropAllowed(categoryId, role) {
  if (!role) return false;
  if (categoryId === STRIP_CATEGORY.HP) return true;
  if (role === OWNER_ROLE.GROUND) {
    return GROUND_CATEGORY_ORDER.includes(categoryId) || categoryId === STRIP_CATEGORY.INACTIVE
      || TOWER_DROP_CATEGORIES.includes(categoryId);
  }
  if (role === OWNER_ROLE.TOWER) {
    return TOWER_DROP_CATEGORIES.includes(categoryId);
  }
  return false;
}

export function groupStripsByCategory(strips = []) {
  const groups = {};
  [...TOWER_CATEGORY_ORDER, STRIP_CATEGORY.RUNWAY, ...GROUND_CATEGORY_ORDER, STRIP_CATEGORY.INACTIVE].forEach((cat) => {
    groups[cat] = [];
  });

  strips.forEach((strip) => {
    const category = getStripCategory(strip);
    if (!category || !groups[category]) return;
    groups[category].push(strip);
  });

  const sortKey = (strip) => strip.position ?? strip.createdAt ?? 0;
  Object.keys(groups).forEach((cat) => {
    groups[cat].sort((a, b) => sortKey(a) - sortKey(b));
  });

  return groups;
}

export function defaultRunwayConfig() {
  return {
    end1: '05',
    end2: '23',
    activeEnd: '1',
    qnh: '1013',
    wind: '270/08',
    qfu: '',
    cloud: 'SCT040',
  };
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
