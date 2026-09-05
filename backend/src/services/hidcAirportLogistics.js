import crypto from 'crypto';
import { getAirportById } from '../config/airports.config.js';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';
import {
  buildShopPurchaseLines,
  createDefaultBaseLogistics,
  listLogisticsShop,
  LOGISTICS_ARMAMENT_CATALOG,
  LOGISTICS_FUEL_CATALOG,
  normalizeBaseOrders,
  normalizeLogisticsStock,
  summarizeLogistics,
} from './lidcService.js';

const MAX_BASE_ORDERS = 80;

function sanitizeText(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function readBaseLogisticsStore() {
  const raw = loadJson(DOC.HIDC_BASE_LOGISTICS, { bases: {}, updatedAt: Date.now() });
  return {
    bases: raw?.bases && typeof raw.bases === 'object' ? raw.bases : {},
    updatedAt: Number.isFinite(raw?.updatedAt) ? raw.updatedAt : Date.now(),
  };
}

function writeBaseLogisticsStore(store) {
  saveJson(DOC.HIDC_BASE_LOGISTICS, {
    bases: store?.bases || {},
    updatedAt: Date.now(),
  });
}

function persistBaseLogistics(airportId, logistics) {
  const store = readBaseLogisticsStore();
  store.bases[airportId] = logistics;
  writeBaseLogisticsStore(store);
}

function getOrCreateBaseLogistics(baseId) {
  const airport = getAirportById(baseId);
  if (!airport) return null;

  const store = readBaseLogisticsStore();
  const existing = store.bases[airport.id];
  const next = {
    baseId: airport.id,
    credits: 0,
    fuel: normalizeLogisticsStock(existing?.fuel, LOGISTICS_FUEL_CATALOG),
    armament: normalizeLogisticsStock(existing?.armament, LOGISTICS_ARMAMENT_CATALOG),
    orders: normalizeBaseOrders(existing?.orders),
  };

  store.bases[airport.id] = next;
  if (!existing) {
    writeBaseLogisticsStore(store);
  }

  return next;
}

function toPublicAirportOrder(order, actorId, bluePoints) {
  const status = sanitizeText(order?.status, 20).toLowerCase() || 'pending';
  const logged = Boolean(sanitizeText(actorId, 80));
  return {
    ...order,
    status,
    squadronCredits: Number.isFinite(Number(bluePoints)) ? Math.max(0, Math.floor(Number(bluePoints))) : 0,
    canEdit: logged && status === 'pending',
    canAccept: logged && status === 'pending',
    canUnaccept: logged && status === 'accepted',
    canComplete: logged && status === 'accepted',
  };
}

function listVisibleAirportOrders(rawOrders, actorId, bluePoints) {
  return normalizeBaseOrders(rawOrders)
    .filter((order) => order.status !== 'completed')
    .map((order) => toPublicAirportOrder(order, actorId, bluePoints));
}

function toShopper(actorId, actorName, bluePoints) {
  if (!sanitizeText(actorId, 80)) return null;
  return {
    squadronId: 'blue',
    squadronName: 'BLUE',
    actorName: sanitizeText(actorName, 120),
    credits: Number.isFinite(Number(bluePoints)) ? Math.max(0, Math.floor(Number(bluePoints))) : null,
  };
}

function occupancyAirport(airport) {
  return {
    id: airport.id,
    name: airport.displayName || airport.name,
    subtitle: airport.isCarrier ? 'CARRIER' : (airport.isHeliport ? 'HELIPORT' : 'AIRPORT'),
    lat: airport.coordinates?.lat,
    lon: airport.coordinates?.lon,
    icao: airport.icao || '',
  };
}

function assertBluePoints(bluePoints, totalCost) {
  if (!Number.isFinite(Number(bluePoints))) return;
  if (Math.max(0, Math.floor(Number(bluePoints))) < totalCost) {
    throw new Error('Insufficient BLUE faction points');
  }
}

export function getAirportOccupancy(baseId, actorUserId = '', options = {}) {
  const airport = getAirportById(baseId);
  if (!airport) return null;

  const logistics = getOrCreateBaseLogistics(airport.id) || createDefaultBaseLogistics(airport.id);
  const actorId = sanitizeText(actorUserId, 80);
  const bluePoints = options.bluePoints;

  return {
    airport: occupancyAirport(airport),
    squadrons: [],
    logistics,
    resources: summarizeLogistics(logistics),
    shop: listLogisticsShop(),
    shopper: toShopper(actorId, options.actorName, bluePoints),
    orders: listVisibleAirportOrders(logistics.orders, actorId, bluePoints),
    economy: 'faction',
  };
}

export function quoteAirportLogisticsItems({ itemId, quantity, items }) {
  const rawLines = Array.isArray(items) && items.length > 0
    ? items
    : [{ itemId, quantity: quantity || 1 }];
  return buildShopPurchaseLines(rawLines);
}

export function purchaseAirportLogistics({
  baseId,
  itemId,
  quantity,
  items,
  userId,
  userName,
  bluePoints,
  skipBalanceCheck = false,
}) {
  const actorId = sanitizeText(userId, 80);
  if (!actorId) {
    throw new Error('Authentication required');
  }

  const airport = getAirportById(baseId);
  if (!airport) {
    throw new Error('Airport not found');
  }

  const rawLines = Array.isArray(items) && items.length > 0
    ? items
    : [{ itemId, quantity: quantity || 1 }];
  const { purchaseLines, totalCost } = buildShopPurchaseLines(rawLines);
  if (!skipBalanceCheck) assertBluePoints(bluePoints, totalCost);

  const logistics = getOrCreateBaseLogistics(airport.id);
  const displayName = sanitizeText(userName, 120) || actorId;
  const order = {
    id: `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    createdAt: Date.now(),
    createdByUserId: actorId,
    createdByUserName: displayName,
    squadronId: 'blue',
    squadronName: displayName,
    status: 'pending',
    items: purchaseLines,
    cost: totalCost,
  };
  logistics.orders = normalizeBaseOrders([order, ...(Array.isArray(logistics.orders) ? logistics.orders : [])])
    .slice(0, MAX_BASE_ORDERS);
  persistBaseLogistics(airport.id, logistics);

  return {
    shop: listLogisticsShop(),
    shopper: toShopper(actorId, displayName, bluePoints),
    orders: listVisibleAirportOrders(logistics.orders, actorId, bluePoints),
    purchase: {
      items: purchaseLines,
      cost: totalCost,
      order,
    },
  };
}

export function updateAirportOrderStatus({ baseId, orderId, action, userId, userName, bluePoints }) {
  const actorId = sanitizeText(userId, 80);
  if (!actorId) {
    throw new Error('Authentication required');
  }

  const actionKey = sanitizeText(action, 20).toLowerCase();
  if (!['accept', 'unaccept', 'complete'].includes(actionKey)) {
    throw new Error('Invalid order action');
  }

  const airport = getAirportById(baseId);
  if (!airport) {
    throw new Error('Airport not found');
  }

  const logistics = getOrCreateBaseLogistics(airport.id);
  const orders = normalizeBaseOrders(logistics.orders);
  const targetId = sanitizeText(orderId, 120);
  const orderIndex = orders.findIndex((entry) => entry.id === targetId);
  if (orderIndex < 0) {
    throw new Error('Order not found');
  }

  const order = orders[orderIndex];
  const status = sanitizeText(order.status, 20).toLowerCase();

  if (actionKey === 'accept') {
    if (status !== 'pending') {
      throw new Error('Order cannot be accepted');
    }
    orders[orderIndex] = {
      ...order,
      status: 'accepted',
      acceptedAt: Date.now(),
      acceptedByUserId: actorId,
    };
  } else if (actionKey === 'unaccept') {
    if (status !== 'accepted') {
      throw new Error('Order cannot be cancelled');
    }
    orders[orderIndex] = {
      ...order,
      status: 'pending',
      acceptedAt: 0,
      acceptedByUserId: '',
    };
  } else {
    if (status !== 'accepted') {
      throw new Error('Order cannot be completed');
    }
    orders[orderIndex] = {
      ...order,
      status: 'completed',
      completedAt: Date.now(),
      completedByUserId: actorId,
    };
  }

  logistics.orders = orders;
  persistBaseLogistics(airport.id, logistics);

  return {
    shop: listLogisticsShop(),
    shopper: toShopper(actorId, userName, bluePoints),
    orders: listVisibleAirportOrders(logistics.orders, actorId, bluePoints),
  };
}

export function updateAirportOrder({
  baseId,
  orderId,
  items,
  userId,
  userName,
  bluePoints,
  skipBalanceCheck = false,
}) {
  const actorId = sanitizeText(userId, 80);
  if (!actorId) {
    throw new Error('Authentication required');
  }

  const airport = getAirportById(baseId);
  if (!airport) {
    throw new Error('Airport not found');
  }

  const { purchaseLines, totalCost } = buildShopPurchaseLines(items);
  const logistics = getOrCreateBaseLogistics(airport.id);
  const orders = normalizeBaseOrders(logistics.orders);
  const targetId = sanitizeText(orderId, 120);
  const orderIndex = orders.findIndex((entry) => entry.id === targetId);
  if (orderIndex < 0) {
    throw new Error('Order not found');
  }

  const order = orders[orderIndex];
  if (sanitizeText(order.status, 20).toLowerCase() !== 'pending') {
    throw new Error('Not allowed to edit this order');
  }

  const extraCost = Math.max(0, totalCost - Number(order.cost || 0));
  if (!skipBalanceCheck) assertBluePoints(bluePoints, extraCost);

  orders[orderIndex] = {
    ...order,
    items: purchaseLines,
    cost: totalCost,
  };
  logistics.orders = orders;
  persistBaseLogistics(airport.id, logistics);

  return {
    shop: listLogisticsShop(),
    shopper: toShopper(actorId, userName, bluePoints),
    orders: listVisibleAirportOrders(logistics.orders, actorId, bluePoints),
  };
}
