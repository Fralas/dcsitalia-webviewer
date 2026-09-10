import fs from 'fs';
import path from 'path';
import db, { getSqlitePath } from './client.js';

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function resolveBackupPath(input) {
  if (!input) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.resolve(process.cwd(), 'data/backups', `app-${stamp}.sqlite`);
  }

  const resolved = path.resolve(input);
  if (resolved.endsWith('.sqlite') || resolved.endsWith('.db')) {
    return resolved;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return path.join(resolved, `app-${stamp}.sqlite`);
}

const dest = resolveBackupPath(process.argv[2]);
fs.mkdirSync(path.dirname(dest), { recursive: true });

if (fs.existsSync(dest)) {
  fs.unlinkSync(dest);
}

db.exec(`VACUUM INTO ${sqlLiteral(dest)}`);

const source = getSqlitePath();
const bytes = fs.statSync(dest).size;
console.log(`SQLite backup written (${bytes} bytes)`);
console.log(`  source: ${source}`);
console.log(`  dest:   ${dest}`);
