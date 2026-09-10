import session from 'express-session';
import db from './client.js';

const Store = session.Store;

const selectStmt = db.prepare('SELECT sess, expired FROM sessions WHERE sid = ?');
const upsertStmt = db.prepare(`
  INSERT INTO sessions (sid, sess, expired)
  VALUES (?, ?, ?)
  ON CONFLICT(sid) DO UPDATE SET
    sess = excluded.sess,
    expired = excluded.expired
`);
const deleteStmt = db.prepare('DELETE FROM sessions WHERE sid = ?');
const touchStmt = db.prepare('UPDATE sessions SET expired = ? WHERE sid = ?');
const purgeStmt = db.prepare('DELETE FROM sessions WHERE expired <= ?');

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function expiryFromSession(sess) {
  const maxAge = sess?.cookie?.maxAge;
  if (Number.isFinite(maxAge) && maxAge > 0) {
    return Date.now() + maxAge;
  }
  return Date.now() + DEFAULT_TTL_MS;
}

export class SqliteSessionStore extends Store {
  constructor(options = {}) {
    super(options);
    const intervalMs = Number.isFinite(options.ttlCleanupMs) ? options.ttlCleanupMs : 60 * 60 * 1000;
    this._cleanup = setInterval(() => {
      try {
        purgeStmt.run(Date.now());
      } catch {
        // Ignore periodic cleanup errors; next request will still expire rows.
      }
    }, intervalMs);
    this._cleanup.unref();
  }

  get(sid, callback) {
    try {
      const row = selectStmt.get(sid);
      if (!row) {
        callback(null, null);
        return;
      }
      if (row.expired <= Date.now()) {
        deleteStmt.run(sid);
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      upsertStmt.run(sid, JSON.stringify(sess), expiryFromSession(sess));
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback) {
    try {
      deleteStmt.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, sess, callback) {
    try {
      touchStmt.run(expiryFromSession(sess), sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}
