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

export const BAY_META = Object.freeze({
  [ATC_BAYS.G_INACTIVE]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gInactive', order: 0 },
  [ATC_BAYS.G_ACTIVE]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gActive', order: 1 },
  [ATC_BAYS.G_STAND]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gStand', order: 2 },
  [ATC_BAYS.G_TAXI]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gTaxi', order: 3 },
  [ATC_BAYS.G_HP]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gHp', order: 4 },
  [ATC_BAYS.G_HANDOFF]: { role: OWNER_ROLE.GROUND, labelKey: 'atc.bays.gHandoff', order: 5 },
  [ATC_BAYS.T_HANDOFF]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tHandoff', order: 6 },
  [ATC_BAYS.T_PENDING]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tPending', order: 7 },
  [ATC_BAYS.T_ACTIVE]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tActive', order: 8 },
  [ATC_BAYS.T_FINAL]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tFinal', order: 9 },
  [ATC_BAYS.T_RUNWAY]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tRunway', order: 10 },
  [ATC_BAYS.T_AIRBORNE]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tAirborne', order: 11 },
  [ATC_BAYS.T_LANDED]: { role: OWNER_ROLE.TOWER, labelKey: 'atc.bays.tLanded', order: 12 },
  [ATC_BAYS.ARCHIVE]: { role: null, labelKey: 'atc.bays.archive', order: 13 },
});

export const ENAV_ACTIONS = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  S_UP: 'S/UP',
  TXI: 'TXI',
  HP: 'HP',
  TOC: 'TOC',
  AOC: 'AOC',
  TOG: 'TOG',
  AOG: 'AOG',
  CANCEL_HANDOFF: 'CANCEL_HANDOFF',
  L_UP: 'L/UP',
  L_W: 'L/W',
  TO: 'TO',
  FIN: 'FIN',
  L: 'L',
  RV: 'RV',
  ARCHIVE: 'ARCHIVE',
});

export const GROUND_BAY_IDS = new Set([
  ATC_BAYS.G_INACTIVE,
  ATC_BAYS.G_ACTIVE,
  ATC_BAYS.G_STAND,
  ATC_BAYS.G_TAXI,
  ATC_BAYS.G_HP,
  ATC_BAYS.G_HANDOFF,
]);

export const TOWER_BAY_IDS = new Set([
  ATC_BAYS.T_HANDOFF,
  ATC_BAYS.T_PENDING,
  ATC_BAYS.T_ACTIVE,
  ATC_BAYS.T_FINAL,
  ATC_BAYS.T_RUNWAY,
  ATC_BAYS.T_AIRBORNE,
  ATC_BAYS.T_LANDED,
  ATC_BAYS.ARCHIVE,
]);

const DEPARTURE_FLOW = [
  { bay: ATC_BAYS.G_INACTIVE, action: null, state: 'planned' },
  { bay: ATC_BAYS.G_ACTIVE, action: ENAV_ACTIONS.ACTIVATE, state: 'active' },
  { bay: ATC_BAYS.G_STAND, action: ENAV_ACTIONS.S_UP, state: 'startup' },
  { bay: ATC_BAYS.G_TAXI, action: ENAV_ACTIONS.TXI, state: 'taxi' },
  { bay: ATC_BAYS.G_HP, action: ENAV_ACTIONS.HP, state: 'holding' },
  { bay: ATC_BAYS.T_PENDING, action: ENAV_ACTIONS.TOC, state: 'pending_tower', handoff: true },
  { bay: ATC_BAYS.T_ACTIVE, action: ENAV_ACTIONS.AOC, state: 'tower_active' },
  { bay: ATC_BAYS.T_RUNWAY, action: ENAV_ACTIONS.L_UP, state: 'runway' },
  { bay: ATC_BAYS.T_AIRBORNE, action: ENAV_ACTIONS.TO, state: 'airborne' },
  { bay: ATC_BAYS.ARCHIVE, action: ENAV_ACTIONS.ARCHIVE, state: 'archived' },
];

const ARRIVAL_FLOW = [
  { bay: ATC_BAYS.G_INACTIVE, action: null, state: 'planned' },
  { bay: ATC_BAYS.T_PENDING, action: null, state: 'inbound_pending' },
  { bay: ATC_BAYS.T_ACTIVE, action: ENAV_ACTIONS.AOC, state: 'tower_active' },
  { bay: ATC_BAYS.T_FINAL, action: ENAV_ACTIONS.FIN, state: 'final' },
  { bay: ATC_BAYS.T_RUNWAY, action: ENAV_ACTIONS.L, state: 'runway' },
  { bay: ATC_BAYS.T_LANDED, action: ENAV_ACTIONS.RV, state: 'landed' },
  { bay: ATC_BAYS.G_HP, action: ENAV_ACTIONS.TOG, state: 'pending_ground', handoffToGround: true },
  { bay: ATC_BAYS.G_TAXI, action: ENAV_ACTIONS.TXI, state: 'taxi_in' },
  { bay: ATC_BAYS.G_STAND, action: null, state: 'parked' },
  { bay: ATC_BAYS.ARCHIVE, action: ENAV_ACTIONS.ARCHIVE, state: 'archived' },
];

const RUNWAY_SUB_STEPS = [
  { action: ENAV_ACTIONS.L_UP, state: 'lineup' },
  { action: ENAV_ACTIONS.L_W, state: 'lineup_wait' },
  { action: ENAV_ACTIONS.TO, state: 'takeoff_cleared' },
];

export function getFlowForDirection(direction) {
  return direction === STRIP_DIRECTION.ARR ? ARRIVAL_FLOW : DEPARTURE_FLOW;
}

export function getDefaultBayForDirection(direction) {
  return ATC_BAYS.G_INACTIVE;
}

export function getDefaultBayForCreate(role, direction) {
  if (role === OWNER_ROLE.TOWER) {
    return direction === STRIP_DIRECTION.ARR ? ATC_BAYS.T_PENDING : ATC_BAYS.T_ACTIVE;
  }
  return ATC_BAYS.G_INACTIVE;
}

export function getDefaultOwnerForCreate(role) {
  return role === OWNER_ROLE.TOWER ? OWNER_ROLE.TOWER : OWNER_ROLE.GROUND;
}

export function getDefaultModelForDirection(direction) {
  return direction === STRIP_DIRECTION.ARR ? STRIP_MODEL.ARRIVAL : STRIP_MODEL.DEPARTURE;
}

export function getOwnerRoleForBay(bayId) {
  return BAY_META[bayId]?.role || null;
}

export function findFlowIndex(direction, bayId) {
  const flow = getFlowForDirection(direction);
  return flow.findIndex((step) => step.bay === bayId);
}

export function isGroundStorageBay(bayId) {
  return GROUND_BAY_IDS.has(bayId) && bayId !== ATC_BAYS.G_HANDOFF;
}

export function isTowerBay(bayId) {
  return TOWER_BAY_IDS.has(bayId);
}

export function isHandoffToTower(strip) {
  if (!strip?.handoffActive) return false;
  return strip.handoffTarget !== HANDOFF_TARGET.GROUND;
}

export function isHandoffToGround(strip) {
  return Boolean(strip?.handoffActive && strip.handoffTarget === HANDOFF_TARGET.GROUND);
}

export function enterHandoffQueue(strip, fromBay = strip.bayId) {
  return {
    ok: true,
    strip: {
      ...strip,
      bayId: ATC_BAYS.T_PENDING,
      operationalState: 'pending_tower',
      coordinationStatus: COORDINATION_STATUS.PENDING_TOC,
      handoffActive: true,
      handoffTarget: HANDOFF_TARGET.TOWER,
      handoffFromBay: fromBay,
      ownerRole: OWNER_ROLE.TOWER,
      flags: { ...strip.flags, highlighted: true, unread: true },
    },
    fromBay: strip.bayId,
    toBay: ATC_BAYS.T_PENDING,
    action: ENAV_ACTIONS.TOC,
    enqueue: true,
  };
}

export function enterGroundHandoffQueue(strip, fromBay = strip.bayId) {
  return {
    ok: true,
    strip: {
      ...strip,
      bayId: ATC_BAYS.G_HP,
      operationalState: 'pending_ground',
      coordinationStatus: COORDINATION_STATUS.PENDING_AOG,
      handoffActive: true,
      handoffTarget: HANDOFF_TARGET.GROUND,
      handoffFromBay: fromBay,
      ownerRole: OWNER_ROLE.GROUND,
      flags: { ...strip.flags, highlighted: true, unread: true },
    },
    fromBay: strip.bayId,
    toBay: ATC_BAYS.G_HP,
    action: ENAV_ACTIONS.TOG,
    enqueue: true,
  };
}

export function cancelHandoff(strip, targetBay) {
  if (!strip.handoffActive) {
    return { ok: false, error: 'NOT_IN_HANDOFF' };
  }

  if (isHandoffToGround(strip)) {
    const fallbackBay = targetBay || strip.handoffFromBay || ATC_BAYS.T_LANDED;
    if (!isTowerBay(fallbackBay) || fallbackBay === ATC_BAYS.T_HANDOFF) {
      return { ok: false, error: 'INVALID_CANCEL_TARGET' };
    }

    const flow = getFlowForDirection(strip.direction);
    const step = flow.find((s) => s.bay === fallbackBay);

    return {
      ok: true,
      strip: {
        ...strip,
        bayId: fallbackBay,
        operationalState: step?.state || 'landed',
        coordinationStatus: null,
        handoffActive: false,
        handoffTarget: null,
        handoffFromBay: null,
        queuePosition: null,
        ownerRole: OWNER_ROLE.TOWER,
        flags: { ...strip.flags, highlighted: false, unread: false },
      },
      fromBay: ATC_BAYS.G_HP,
      toBay: fallbackBay,
      action: ENAV_ACTIONS.CANCEL_HANDOFF,
      dequeue: true,
      enqueue: false,
    };
  }

  const fallbackBay = targetBay || strip.handoffFromBay || ATC_BAYS.G_HP;
  if (!isGroundStorageBay(fallbackBay)) {
    return { ok: false, error: 'INVALID_CANCEL_TARGET' };
  }

  const flow = getFlowForDirection(strip.direction);
  const step = flow.find((s) => s.bay === fallbackBay);

  return {
    ok: true,
    strip: {
      ...strip,
      bayId: fallbackBay,
      operationalState: step?.state || 'holding',
      coordinationStatus: null,
      handoffActive: false,
      handoffTarget: null,
      handoffFromBay: null,
      queuePosition: null,
      ownerRole: OWNER_ROLE.GROUND,
      flags: { ...strip.flags, highlighted: false, unread: false },
    },
    fromBay: ATC_BAYS.T_PENDING,
    toBay: fallbackBay,
    action: ENAV_ACTIONS.CANCEL_HANDOFF,
    dequeue: true,
    enqueue: false,
  };
}

export function getNextStep(strip) {
  if (strip.handoffActive) {
    return null;
  }

  const direction = strip.direction;
  const flow = getFlowForDirection(direction);

  if (direction === STRIP_DIRECTION.DEP && strip.bayId === ATC_BAYS.T_RUNWAY) {
    const runwayIdx = RUNWAY_SUB_STEPS.findIndex((s) => s.state === strip.operationalState);
    if (runwayIdx >= 0 && runwayIdx < RUNWAY_SUB_STEPS.length - 1) {
      const next = RUNWAY_SUB_STEPS[runwayIdx + 1];
      return { bay: ATC_BAYS.T_RUNWAY, action: next.action, state: next.state };
    }
    if (runwayIdx === -1 || strip.operationalState === 'tower_active') {
      return { bay: ATC_BAYS.T_RUNWAY, action: ENAV_ACTIONS.L_UP, state: 'lineup' };
    }
    return flow.find((step) => step.bay === ATC_BAYS.T_AIRBORNE) || null;
  }

  const idx = findFlowIndex(direction, strip.bayId);
  if (idx < 0 || idx >= flow.length - 1) return null;
  return flow[idx + 1];
}

export function isBayTransitionAllowed(strip, targetBayId, role) {
  if (strip.handoffActive) {
    return false;
  }

  if (targetBayId === ATC_BAYS.G_HANDOFF) {
    return role === OWNER_ROLE.GROUND && strip.bayId === ATC_BAYS.G_HP && !isHandoffToGround(strip);
  }

  if (targetBayId === ATC_BAYS.T_HANDOFF) {
    return role === OWNER_ROLE.TOWER && strip.bayId === ATC_BAYS.T_LANDED && !isHandoffToTower(strip);
  }

  if (targetBayId === ATC_BAYS.ARCHIVE) return true;

  const next = getNextStep(strip);
  if (!next) return false;
  if (next.bay === targetBayId) return true;
  if (next.handoff && targetBayId === ATC_BAYS.T_PENDING) return false;

  const flow = getFlowForDirection(strip.direction);
  const currentIdx = findFlowIndex(strip.direction, strip.bayId);
  const targetIdx = flow.findIndex((step) => step.bay === targetBayId);
  if (currentIdx < 0 || targetIdx < 0) return false;

  return targetIdx <= currentIdx + 1;
}

export function applyAction(strip, actionCode) {
  if (actionCode === ENAV_ACTIONS.CANCEL_HANDOFF) {
    return cancelHandoff(strip);
  }

  const next = getNextStep(strip);
  if (!next || (next.action && next.action !== actionCode)) {
    return { ok: false, error: 'INVALID_ACTION' };
  }

  if (next.handoff && actionCode === ENAV_ACTIONS.TOC) {
    const result = enterHandoffQueue(strip, strip.bayId);
    if (actionCode !== ENAV_ACTIONS.ACTIVATE) {
      const stamp = formatEnavTime(Date.now(), strip);
      result.strip.instructions = appendInstruction(result.strip.instructions, `${actionCode} ${stamp}`);
    }
    return result;
  }

  if (next.handoffToGround && actionCode === ENAV_ACTIONS.TOG) {
    const result = enterGroundHandoffQueue(strip, strip.bayId);
    const stamp = formatEnavTime(Date.now(), strip);
    result.strip.remarks = appendInstruction(result.strip.remarks, `${actionCode} ${stamp}`);
    return result;
  }

  const updated = { ...strip };
  updated.bayId = next.bay;
  updated.operationalState = next.state;
  updated.ownerRole = getOwnerRoleForBay(next.bay);

  if (next.action === ENAV_ACTIONS.AOC) {
    updated.coordinationStatus = COORDINATION_STATUS.ACCEPTED;
    updated.flags = { ...updated.flags, unread: false, highlighted: false };
  }

  if (actionCode && actionCode !== ENAV_ACTIONS.ACTIVATE) {
    const stamp = formatEnavTime(Date.now(), strip);
    if (strip.direction === STRIP_DIRECTION.DEP) {
      updated.instructions = appendInstruction(updated.instructions, `${actionCode} ${stamp}`);
    } else {
      updated.remarks = appendInstruction(updated.remarks, `${actionCode} ${stamp}`);
    }
  }

  return { ok: true, strip: updated, action: actionCode, fromBay: strip.bayId, toBay: next.bay };
}

export function applyMove(strip, targetBayId, role, options = {}) {
  if (targetBayId === ATC_BAYS.G_HANDOFF) {
    if (role !== OWNER_ROLE.GROUND || strip.bayId !== ATC_BAYS.G_HP || isHandoffToGround(strip)) {
      return { ok: false, error: 'INVALID_BAY_TRANSITION' };
    }
    return enterHandoffQueue(strip, strip.bayId);
  }

  if (targetBayId === ATC_BAYS.T_HANDOFF) {
    if (role !== OWNER_ROLE.TOWER || strip.bayId !== ATC_BAYS.T_LANDED || isHandoffToTower(strip)) {
      return { ok: false, error: 'INVALID_BAY_TRANSITION' };
    }
    return enterGroundHandoffQueue(strip, strip.bayId);
  }

  if (!isBayTransitionAllowed(strip, targetBayId, role)) {
    return { ok: false, error: 'INVALID_BAY_TRANSITION' };
  }

  const flow = getFlowForDirection(strip.direction);
  const step = flow.find((s) => s.bay === targetBayId);
  let operationalState = step?.state || strip.operationalState;
  if (targetBayId === ATC_BAYS.T_ACTIVE && options.operationalState) {
    operationalState = options.operationalState;
  }
  const updated = {
    ...strip,
    bayId: targetBayId,
    operationalState,
    ownerRole: getOwnerRoleForBay(targetBayId),
  };

  return { ok: true, strip: updated, fromBay: strip.bayId, toBay: targetBayId };
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

export function canEditStrip(strip, role) {
  if (!role || !strip) return false;

  if (role === OWNER_ROLE.GROUND) {
    if (isHandoffToGround(strip)) return true;
    if (isHandoffToTower(strip)) return true;
    if (strip.ownerRole === OWNER_ROLE.TOWER) return false;
    if (strip.bayId?.startsWith('t_')) return false;
    return isGroundStorageBay(strip.bayId);
  }

  if (role === OWNER_ROLE.TOWER) {
    if (isHandoffToTower(strip)) return true;
    if (isHandoffToGround(strip)) return false;
    if (strip.bayId === ATC_BAYS.G_HP) return false;
    if (isTowerBay(strip.bayId) && strip.bayId !== ATC_BAYS.T_HANDOFF) return true;
    if (strip.bayId === ATC_BAYS.ARCHIVE) return true;
    return false;
  }

  return false;
}

export function acceptGroundCoordination(strip) {
  if (strip.coordinationStatus !== COORDINATION_STATUS.PENDING_AOG || !isHandoffToGround(strip)) {
    return { ok: false, error: 'NO_PENDING_COORDINATION' };
  }

  const targetBay = ATC_BAYS.G_HP;
  return {
    ok: true,
    strip: {
      ...strip,
      bayId: targetBay,
      operationalState: 'holding',
      coordinationStatus: COORDINATION_STATUS.ACCEPTED,
      handoffActive: false,
      handoffTarget: null,
      handoffFromBay: null,
      queuePosition: null,
      ownerRole: OWNER_ROLE.GROUND,
      flags: { ...strip.flags, unread: false, highlighted: false },
    },
    fromBay: strip.bayId,
    toBay: targetBay,
    action: ENAV_ACTIONS.AOG,
    dequeue: true,
  };
}

export function rejectGroundCoordination(strip, note = '') {
  if (strip.coordinationStatus !== COORDINATION_STATUS.PENDING_AOG || !isHandoffToGround(strip)) {
    return { ok: false, error: 'NO_PENDING_COORDINATION' };
  }

  return cancelHandoff(strip, strip.handoffFromBay || ATC_BAYS.T_LANDED);
}

export function acceptCoordination(strip) {
  if (strip.coordinationStatus !== COORDINATION_STATUS.PENDING_TOC) {
    return { ok: false, error: 'NO_PENDING_COORDINATION' };
  }

  const targetBay = ATC_BAYS.T_ACTIVE;
  return {
    ok: true,
    strip: {
      ...strip,
      bayId: targetBay,
      operationalState: 'tower_active',
      coordinationStatus: COORDINATION_STATUS.ACCEPTED,
      handoffActive: false,
      handoffTarget: null,
      handoffFromBay: null,
      queuePosition: null,
      ownerRole: OWNER_ROLE.TOWER,
      flags: { ...strip.flags, unread: false, highlighted: false },
    },
    fromBay: strip.bayId,
    toBay: targetBay,
    action: ENAV_ACTIONS.AOC,
    dequeue: Boolean(strip.handoffActive),
  };
}

export function rejectCoordination(strip, note = '') {
  if (strip.coordinationStatus !== COORDINATION_STATUS.PENDING_TOC) {
    return { ok: false, error: 'NO_PENDING_COORDINATION' };
  }

  if (strip.handoffActive) {
    return cancelHandoff(strip, strip.handoffFromBay);
  }

  const fallbackBay = strip.direction === STRIP_DIRECTION.DEP ? ATC_BAYS.G_HP : ATC_BAYS.G_INACTIVE;
  return {
    ok: true,
    strip: {
      ...strip,
      bayId: fallbackBay,
      operationalState: strip.direction === STRIP_DIRECTION.DEP ? 'holding' : 'planned',
      coordinationStatus: COORDINATION_STATUS.REJECTED,
      ownerRole: OWNER_ROLE.GROUND,
      flags: { ...strip.flags, highlighted: true },
      remarks: appendInstruction(strip.remarks, note ? `REJ ${note}` : 'REJ'),
    },
    fromBay: strip.bayId,
    toBay: fallbackBay,
    action: 'REJECT_TOC',
  };
}

function appendInstruction(current, line) {
  const base = String(current || '').trim();
  return base ? `${base} | ${line}` : line;
}

export function formatEnavTime(timestamp, strip) {
  const date = new Date(timestamp);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ref = strip.eta || strip.eobt || '';
  if (ref && ref.length === 4 && ref.slice(0, 2) === hh) {
    return mm;
  }
  return `${hh}${mm}`;
}

export function sortStripsForBay(strips, bayId, manualSort) {
  if (manualSort) {
    return [...strips].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }

  const arrivals = strips.filter((s) => s.direction === STRIP_DIRECTION.ARR);
  const departures = strips.filter((s) => s.direction === STRIP_DIRECTION.DEP);

  const sortByTime = (list, field) => [...list].sort((a, b) => {
    const av = String(a[field] || '9999');
    const bv = String(b[field] || '9999');
    return av.localeCompare(bv);
  });

  if ([ATC_BAYS.G_INACTIVE, ATC_BAYS.T_PENDING, ATC_BAYS.T_ACTIVE, ATC_BAYS.T_FINAL].includes(bayId)) {
    return [...sortByTime(arrivals, 'eta'), ...sortByTime(departures, 'eobt')];
  }

  return sortByTime(strips, strips[0]?.direction === STRIP_DIRECTION.ARR ? 'eta' : 'eobt');
}

export function createEmptyStripFields(direction) {
  if (direction === STRIP_DIRECTION.ARR) {
    return {
      eta: '',
      flightRule: 'I',
      origin: '',
      aircraftType: '',
      wakeCategory: 'M',
      callsign: '',
      tas: '',
      ata: '',
      pilotEstimate: '',
      previousFix: '',
      ato: '',
      atl: '',
      destination: '',
      stand: '',
      standAcknowledged: false,
      ata: '',
      ataAcknowledged: false,
      pilotEstimate: '',
      missedApproach: '',
      localJ: '',
      localK: '',
      remarks: '',
    };
  }

  return {
    eobt: '',
    flightRule: 'I',
    callsign: '',
    aircraftType: '',
    destination: '',
    runway: '',
    sid: '',
    levelPlanned: '',
    level: '',
    startup: '',
    taxiAuth: '',
    clearanceTimes: '',
    ssr: '',
    delay: '',
    route: '',
    clearanceText: '',
    instructions: '',
    remarks: '',
  };
}

export function buildDemoStrips(airportId) {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const baseEta = (offsetMin) => {
    const d = new Date(now.getTime() + offsetMin * 60000);
    return `${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return [
    {
      direction: STRIP_DIRECTION.ARR,
      model: STRIP_MODEL.ARRIVAL,
      bayId: ATC_BAYS.T_PENDING,
      operationalState: 'inbound_pending',
      ownerRole: OWNER_ROLE.TOWER,
      coordinationStatus: COORDINATION_STATUS.PENDING_TOC,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.ARR),
        eta: baseEta(12),
        flightRule: 'I',
        origin: 'LIMC',
        aircraftType: 'A321',
        wakeCategory: 'M',
        callsign: 'AZA471',
        tas: '280',
        destination: 'OSAP',
        previousFix: 'TIR',
        remarks: 'INBOUND ESTIMATE',
      },
      flags: { highlighted: true, unread: true, dynamic: true },
    },
    {
      direction: STRIP_DIRECTION.ARR,
      model: STRIP_MODEL.ARRIVAL,
      bayId: ATC_BAYS.T_ACTIVE,
      operationalState: 'tower_active',
      ownerRole: OWNER_ROLE.TOWER,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.ARR),
        eta: baseEta(25),
        flightRule: 'I',
        origin: 'LIRF',
        aircraftType: 'B738',
        wakeCategory: 'M',
        callsign: 'ITY204',
        destination: 'OSAP',
        stand: 'A04',
        remarks: 'B MHP',
      },
      flags: { highlighted: false, unread: false, dynamic: true },
    },
    {
      direction: STRIP_DIRECTION.ARR,
      model: STRIP_MODEL.ARRIVAL,
      bayId: ATC_BAYS.G_INACTIVE,
      operationalState: 'planned',
      ownerRole: OWNER_ROLE.GROUND,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.ARR),
        eta: baseEta(45),
        flightRule: 'V',
        origin: 'OS72',
        aircraftType: 'C172',
        wakeCategory: 'L',
        callsign: 'GAO12F',
        destination: 'OSAP',
      },
      flags: { highlighted: false, unread: false, dynamic: false },
    },
    {
      direction: STRIP_DIRECTION.DEP,
      model: STRIP_MODEL.DEPARTURE,
      bayId: ATC_BAYS.G_STAND,
      operationalState: 'startup',
      ownerRole: OWNER_ROLE.GROUND,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.DEP),
        eobt: baseEta(8),
        callsign: 'DCORE01',
        aircraftType: 'F16C',
        destination: 'OS72',
        runway: '09L',
        sid: 'OSAP1A',
        level: 'FL150',
        startup: 'PD',
        ssr: '4521',
      },
      flags: { highlighted: false, unread: false, dynamic: true },
    },
    {
      direction: STRIP_DIRECTION.DEP,
      model: STRIP_MODEL.DEPARTURE,
      bayId: ATC_BAYS.G_TAXI,
      operationalState: 'taxi',
      ownerRole: OWNER_ROLE.GROUND,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.DEP),
        eobt: baseEta(15),
        callsign: 'REACH33',
        aircraftType: 'C130',
        destination: 'OSDZ',
        runway: '09L',
        instructions: 'TXI 14',
        ssr: '1200',
      },
      flags: { highlighted: false, unread: false, dynamic: true },
    },
    {
      direction: STRIP_DIRECTION.DEP,
      model: STRIP_MODEL.DEPARTURE,
      bayId: ATC_BAYS.G_HP,
      operationalState: 'holding',
      ownerRole: OWNER_ROLE.GROUND,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.DEP),
        eobt: baseEta(18),
        callsign: 'SPAR11',
        aircraftType: 'A10C',
        destination: 'OS58',
        runway: '09L',
        instructions: 'TXI 16 | HP 18',
      },
      flags: { highlighted: false, unread: false, dynamic: true },
    },
    {
      direction: STRIP_DIRECTION.DEP,
      model: STRIP_MODEL.DEPARTURE,
      bayId: ATC_BAYS.T_PENDING,
      operationalState: 'pending_tower',
      ownerRole: OWNER_ROLE.TOWER,
      coordinationStatus: COORDINATION_STATUS.PENDING_TOC,
      handoffActive: true,
      handoffFromBay: ATC_BAYS.G_HP,
      fields: {
        ...createEmptyStripFields(STRIP_DIRECTION.DEP),
        eobt: baseEta(20),
        callsign: 'TOCQUE1',
        aircraftType: 'F15E',
        destination: 'OS72',
        runway: '09L',
        instructions: 'TXI 18 | HP 20 | TOC 21',
      },
      flags: { highlighted: true, unread: true, dynamic: true },
    },
  ].map((entry, index) => {
    const { fields, ...rest } = entry;
    return {
      id: `demo_${airportId}_${index + 1}`,
      airportId,
      position: index,
      coordinationStatus: entry.coordinationStatus || null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: 'system',
      ...rest,
      ...fields,
    };
  });
}
