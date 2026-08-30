import bcrypt from 'bcrypt';
import express from 'express';
import helmet from 'helmet';
import logger from '../utils/logger.js';

const PLACEHOLDER_SECRET = /change-me|change-this|your-super-secret|dcs-italia-secret/i;
const BCRYPT_ROUNDS = 12;

export function isProduction() {
  return String(process.env.NODE_ENV || '').toLowerCase() === 'production';
}

export function isBcryptHash(value) {
  return typeof value === 'string' && /^\$2[aby]\$\d{2}\$/.test(value);
}

function secretLooksWeak(value) {
  const text = String(value || '');
  return text.length < 32 || PLACEHOLDER_SECRET.test(text);
}

export function assertRuntimeSecrets() {
  if (isProduction() && String(process.env.AUTH_BYPASS_LOCAL || '').toLowerCase() === 'true') {
    throw new Error('AUTH_BYPASS_LOCAL cannot be enabled when NODE_ENV=production');
  }

  const jwtSecret = String(process.env.JWT_SECRET || '').trim();
  const sessionSecret = String(process.env.SESSION_SECRET || '').trim();

  if (!jwtSecret) {
    throw new Error('JWT_SECRET is required');
  }
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET is required');
  }

  if (isProduction()) {
    if (secretLooksWeak(jwtSecret)) {
      throw new Error('JWT_SECRET is too short or looks like a placeholder (min 32 characters)');
    }
    if (secretLooksWeak(sessionSecret)) {
      throw new Error('SESSION_SECRET is too short or looks like a placeholder (min 32 characters)');
    }
  }
}

export function resolveAdminPasswordHash() {
  const fromHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim();
  const fromPassword = String(process.env.ADMIN_PASSWORD || '').trim();

  if (fromHash) {
    if (!isBcryptHash(fromHash)) {
      throw new Error('ADMIN_PASSWORD_HASH must be a bcrypt hash (npm run security:hash-password)');
    }
    return fromHash;
  }

  if (isBcryptHash(fromPassword)) {
    return fromPassword;
  }

  if (fromPassword) {
    if (isProduction()) {
      throw new Error('Plain ADMIN_PASSWORD is not allowed in production. Set ADMIN_PASSWORD_HASH (npm run security:hash-password).');
    }
    logger.warn('ADMIN_PASSWORD is plaintext; hashing in memory. Use ADMIN_PASSWORD_HASH in production.');
    return bcrypt.hashSync(fromPassword, BCRYPT_ROUNDS);
  }

  if (isProduction()) {
    throw new Error('ADMIN_PASSWORD_HASH is required in production');
  }

  logger.warn('Admin login disabled: set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD');
  return null;
}

export function createJsonBodyParser() {
  const defaultLimit = process.env.JSON_BODY_LIMIT || '1mb';
  const largeLimit = process.env.JSON_BODY_LARGE_LIMIT || '16mb';
  const largePrefixes = [
    '/api/wiki/media',
    '/api/changelogs/media',
    '/api/achievements/catalog',
    '/api/lidc/squadrons',
  ];

  return (req, res, next) => {
    const url = String(req.originalUrl || req.url || '').split('?')[0];
    const limit = largePrefixes.some((prefix) => url === prefix || url.startsWith(`${prefix}/`))
      ? largeLimit
      : defaultLimit;
    return express.json({ limit })(req, res, next);
  };
}

export function createHelmetMiddleware() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'ws:', 'wss:', 'https:', 'http://localhost:*', 'http://127.0.0.1:*'],
        fontSrc: ["'self'", 'data:'],
        workerSrc: ["'self'", 'blob:'],
        childSrc: ["'self'", 'blob:'],
        mediaSrc: ["'self'", 'blob:', 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}
