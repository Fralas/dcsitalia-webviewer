import path from 'path';
import crypto from 'crypto';
import { DOC, loadJson, saveJson } from '../db/jsonStore.js';

const EVENTS_FILE = path.resolve(process.cwd(), 'data/noe/events.json');

function sanitizeText(value, maxLen = 200) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

/** Accept an empty string or a YYYY-MM-DD calendar date. */
function sanitizeDate(value) {
  const text = sanitizeText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeEvent(event) {
  const createdAt = Number.isFinite(event?.createdAt) ? event.createdAt : Date.now();
  return {
    id: sanitizeText(event?.id, 80) || `noe_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
    missionDate: sanitizeDate(event?.missionDate),
    registrationEndsDate: sanitizeDate(event?.registrationEndsDate),
    tacticalDayDate: sanitizeDate(event?.tacticalDayDate),
    operationName: sanitizeText(event?.operationName, 120),
    createdAt,
    updatedAt: Number.isFinite(event?.updatedAt) ? event.updatedAt : createdAt,
  };
}

function readEvents() {
  const events = loadJson(DOC.NOE_EVENTS, [], EVENTS_FILE);
  return Array.isArray(events) ? events.map(normalizeEvent) : [];
}

function writeEvents(events) {
  saveJson(DOC.NOE_EVENTS, events.map(normalizeEvent));
}

export function getEvents() {
  return readEvents().sort((a, b) => String(a.missionDate).localeCompare(String(b.missionDate)));
}

function validateEventInput(input) {
  const missionDate = sanitizeDate(input?.missionDate);
  if (!missionDate) {
    throw new Error('A valid mission date (YYYY-MM-DD) is required');
  }
  const operationName = sanitizeText(input?.operationName, 120);
  if (!operationName) {
    throw new Error('operationName is required');
  }
  return {
    missionDate,
    registrationEndsDate: sanitizeDate(input?.registrationEndsDate),
    tacticalDayDate: sanitizeDate(input?.tacticalDayDate),
    operationName,
  };
}

export function createEvent(input) {
  const fields = validateEventInput(input);
  const events = readEvents();
  const createdAt = Date.now();
  const event = normalizeEvent({
    id: `noe_${createdAt}_${crypto.randomBytes(4).toString('hex')}`,
    ...fields,
    createdAt,
    updatedAt: createdAt,
  });
  events.push(event);
  writeEvents(events);
  return event;
}

export function updateEvent(eventId, input) {
  const targetId = sanitizeText(eventId, 80);
  if (!targetId) {
    throw new Error('eventId is required');
  }
  const fields = validateEventInput(input);
  const events = readEvents();
  const index = events.findIndex((event) => event.id === targetId);
  if (index < 0) {
    throw new Error('Event not found');
  }
  const updated = normalizeEvent({
    ...events[index],
    ...fields,
    updatedAt: Date.now(),
  });
  events[index] = updated;
  writeEvents(events);
  return updated;
}

export function removeEvent(eventId) {
  const targetId = sanitizeText(eventId, 80);
  if (!targetId) return false;
  const events = readEvents();
  const next = events.filter((event) => event.id !== targetId);
  if (next.length === events.length) {
    return false;
  }
  writeEvents(next);
  return true;
}
