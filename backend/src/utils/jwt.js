import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_TIMEOUT = process.env.SESSION_TIMEOUT || '24h';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

/**
 * Generate a JWT token for authenticated users
 * @param {Object} payload - The payload to include in the token
 * @returns {string} JWT token
 */
export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: SESSION_TIMEOUT,
    issuer: 'dcs-warehouse-viewer',
  });
}

/**
 * Verify and decode a JWT token
 * @param {string} token - The JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'dcs-warehouse-viewer',
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - The Authorization header value
 * @returns {string|null} The token or null if not found
 */
export function extractToken(authHeader) {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}
