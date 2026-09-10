import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const source = process.argv[2];
if (!source) {
  console.error('Usage: npm run data:restore -- /path/to/app-YYYY-MM-DD.sqlite');
  process.exit(1);
}

const sourcePath = path.resolve(source);
if (!fs.existsSync(sourcePath)) {
  console.error(`Backup not found: ${sourcePath}`);
  process.exit(1);
}

const dest = process.env.SQLITE_PATH
  ? path.resolve(process.env.SQLITE_PATH)
  : path.resolve(process.cwd(), 'data/app.sqlite');

console.warn('Stop the Node server before restoring. This overwrites the live database.');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(sourcePath, dest);

for (const suffix of ['-wal', '-shm']) {
  const extra = `${dest}${suffix}`;
  if (fs.existsSync(extra)) {
    fs.unlinkSync(extra);
  }
}

console.log(`Restored ${sourcePath} -> ${dest}`);
