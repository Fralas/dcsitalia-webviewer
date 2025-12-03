/**
 * Simple structured logging utility
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

const currentLogLevel = process.env.NODE_ENV === 'production' ? LOG_LEVELS.INFO : LOG_LEVELS.DEBUG;

function formatLog(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...meta,
  };

  if (process.env.NODE_ENV === 'production') {
    // In production, log as JSON for easier parsing
    return JSON.stringify(logEntry);
  } else {
    // In development, log human-readable format
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  }
}

export const logger = {
  debug: (message, meta) => {
    if (currentLogLevel <= LOG_LEVELS.DEBUG) {
      console.log(formatLog('DEBUG', message, meta));
    }
  },

  info: (message, meta) => {
    if (currentLogLevel <= LOG_LEVELS.INFO) {
      console.log(formatLog('INFO', message, meta));
    }
  },

  warn: (message, meta) => {
    if (currentLogLevel <= LOG_LEVELS.WARN) {
      console.warn(formatLog('WARN', message, meta));
    }
  },

  error: (message, meta) => {
    if (currentLogLevel <= LOG_LEVELS.ERROR) {
      console.error(formatLog('ERROR', message, meta));
    }
  },

  // Security-specific logging
  security: (message, meta) => {
    console.log(formatLog('SECURITY', message, { ...meta, type: 'security' }));
  },

  // HTTP request logging
  http: (req, res, duration) => {
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
    };

    if (res.statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.url}`, logData);
    } else {
      logger.info(`HTTP ${req.method} ${req.url}`, logData);
    }
  },
};

export default logger;
