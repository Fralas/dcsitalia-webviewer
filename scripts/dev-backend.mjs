import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const child = spawn(
  process.execPath,
  ['--watch-path=backend/src', '--watch', 'backend/src/server.js'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '3001',
      LISTEN_HOST: '127.0.0.1',
    },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
