import crypto from 'crypto';
import path from 'path';
import { getAirportById } from '../config/airports.config.js';
import { optionalPath } from '../config/envPaths.js';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';
import { writeJsonAtomic } from './lidcDcsBridge.js';
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
const ORDER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ORDER_CODE_LENGTH = 6;

function resolveDcoreOrdersFile() {
  const explicit = optionalPath('HIDC_LOGISTICS_ORDERS_FILE');
  if (explicit) return explicit;

  const scoreFile = optionalPath('DSCORE_SCORE_FILE');
  if (scoreFile) return path.join(path.dirname(scoreFile), 'Export_WebLogistics_Orders.json');

  const productionPoints = optionalPath('PRODUCTION_POINTS_FILE');
  if (productionPoints) return path.join(path.dirname(productionPoints), 'Export_WebLogistics_Orders.json');

  const webCommands = optionalPath('WEB_COMMANDS_FILE');
  if (webCommands) return path.join(path.dirname(webCommands), 'Export_WebLogistics_Orders.json');

  return null;
}

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
  exportHidcLogisticsOrders();
}

function getOrCreateBaseLogistics(baseId) {
  const airport = getAirportById(baseId);
  if (!airport) return null;

  const store = readBaseLogisticsStore();
  const existing = store.bases[airport.id];
  const { orders, changed: codesAssigned } = ensureOrderCodes(existing?.orders);
  const next = {
    baseId: airport.id,
    credits: 0,
    fuel: normalizeLogisticsStock(existing?.fuel, LOGISTICS_FUEL_CATALOG),
    armament: normalizeLogisticsStock(existing?.armament, LOGISTICS_ARMAMENT_CATALOG),
    orders,
  };

  store.bases[airport.id] = next;
  if (!existing || codesAssigned) {
    writeBaseLogisticsStore(store);
    if (codesAssigned) exportHidcLogisticsOrders();
  }

  return next;
}

function listUsedOrderCodes(store = readBaseLogisticsStore()) {
  const used = new Set();
  Object.values(store.bases || {}).forEach((base) => {
    normalizeBaseOrders(base?.orders).forEach((order) => {
      const code = sanitizeText(order?.code, 12).toUpperCase();
      if (code) used.add(code);
    });
  });
  return used;
}

function generateOrderCode(used = listUsedOrderCodes()) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const bytes = crypto.randomBytes(ORDER_CODE_LENGTH);
    let code = '';
    for (let i = 0; i < ORDER_CODE_LENGTH; i += 1) {
      code += ORDER_CODE_ALPHABET[bytes[i] % ORDER_CODE_ALPHABET.length];
    }
    if (!used.has(code)) return code;
  }
  throw new Error('Could not allocate an order code');
}

function ensureOrderCodes(rawOrders, used = listUsedOrderCodes()) {
  let changed = false;
  const orders = normalizeBaseOrders(rawOrders).map((order) => {
    if (sanitizeText(order.code, 12)) return order;
    const code = generateOrderCode(used);
    used.add(code);
    changed = true;
    return { ...order, code };
  });
  return { orders, changed };
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

function toDcoreOrderItem(line, catalogById) {
  const catalogItem = catalogById.get(sanitizeText(line?.itemId, 80));
  return {
    item_id: sanitizeText(line?.itemId, 80),
    name: sanitizeText(line?.name || catalogItem?.name, 120),
    kind: sanitizeText(line?.kind || catalogItem?.kind, 40),
    destination: sanitizeText(line?.destination || catalogItem?.destination, 40),
    quantity: Math.max(0, Math.floor(Number(line?.quantity) || 0)),
    cost: Math.max(0, Math.floor(Number(line?.cost) || 0)),
    contents: Array.isArray(catalogItem?.contents)
      ? catalogItem.contents.map((entry) => ({
        label: sanitizeText(entry?.label, 80),
        quantity: Math.max(0, Math.floor(Number(entry?.quantity) || 0)),
      }))
      : [],
  };
}

function toDcoreOrder(airport, order, catalogById) {
  return {
    code: sanitizeText(order?.code, 12).toUpperCase(),
    id: sanitizeText(order?.id, 120),
    status: sanitizeText(order?.status, 20).toLowerCase() || 'pending',
    airport_id: airport.id,
    airport_name: airport.displayName || airport.name,
    icao: airport.icao || '',
    lat: Number.isFinite(airport.coordinates?.lat) ? airport.coordinates.lat : null,
    lon: Number.isFinite(airport.coordinates?.lon) ? airport.coordinates.lon : null,
    cost: Math.max(0, Math.floor(Number(order?.cost) || 0)),
    created_at: Number(order?.createdAt) || Date.now(),
    created_by: sanitizeText(order?.createdByUserName || order?.squadronName, 120),
    created_by_id: sanitizeText(order?.createdByUserId, 80),
    accepted_at: Number(order?.acceptedAt) || 0,
    accepted_by_id: sanitizeText(order?.acceptedByUserId, 80),
    items: (Array.isArray(order?.items) ? order.items : []).map((line) => toDcoreOrderItem(line, catalogById)),
  };
}

export function exportHidcLogisticsOrders() {
  const targetPath = resolveDcoreOrdersFile();
  if (!targetPath) return null;

  const store = readBaseLogisticsStore();
  const catalogById = new Map(listLogisticsShop().map((item) => [item.id, item]));
  const orders = [];
  Object.entries(store.bases || {}).forEach(([baseId, logistics]) => {
    const airport = getAirportById(baseId);
    if (!airport) return;
    normalizeBaseOrders(logistics?.orders)
      .filter((order) => order.status !== 'completed' && sanitizeText(order.code, 12))
      .forEach((order) => orders.push(toDcoreOrder(airport, order, catalogById)));
  });

  orders.sort((a, b) => (Number(b.created_at) || 0) - (Number(a.created_at) || 0));

  try {
    writeJsonAtomic(targetPath, {
      orders,
      updatedAt: Date.now(),
    });
  } catch (error) {
    console.error('Failed to export HIDC logistics orders for DCORE:', error.message);
  }

  return targetPath;
}

export function getAirportOccupancy(baseId, actorUserId = '', options = {}) {
  const airport = getAirportById(baseId);
  if (!airport) return null;

  const logistics = getOrCreateBaseLogistics(airport.id) || createDefaultBaseLogistics(airport.id);
  const actorId = sanitizeText(actorUserId, 80);
  const bluePoints = options.bluePoints;
  const actorName = options.actorName || options.userName;

  return {
    airport: occupancyAirport(airport),
    squadrons: [],
    logistics,
    resources: summarizeLogistics(logistics),
    shop: listLogisticsShop(),
    shopper: toShopper(actorId, actorName, bluePoints),
    orders: listVisibleAirportOrders(logistics.orders, actorId, bluePoints),
    economy: 'faction',
  };
}

export function purchaseAirportLogistics({
  baseId,
  itemId,
  quantity,
  items,
  userId,
  userName,
  bluePoints,
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

  const logistics = getOrCreateBaseLogistics(airport.id);
  const displayName = sanitizeText(userName, 120) || actorId;
  const order = {
    id: `order_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    code: generateOrderCode(),
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
