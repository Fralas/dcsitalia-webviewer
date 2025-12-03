import { verifyToken, extractToken } from '../utils/jwt.js';

/**
 * Middleware to verify JWT token and authenticate requests
 */
export function authenticateToken(req, res, next) {
  try {
    const token = extractToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.',
      });
    }

    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      error: error.message || 'Invalid token',
    });
  }
}

/**
 * Middleware to verify admin role
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin role required.',
    });
  }
  next();
}
