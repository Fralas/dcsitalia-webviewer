import net from 'node:net';

const port = Number.parseInt(process.argv[2] || '3001', 10);
const host = process.argv[3] || '127.0.0.1';
const timeoutMs = Number.parseInt(process.argv[4] || '60000', 10);

function tryConnect() {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ port, host }, () => {
      socket.end();
      resolve();
    });
    socket.on('error', reject);
  });
}

const startedAt = Date.now();

while (Date.now() - startedAt < timeoutMs) {
  try {
    await tryConnect();
    process.exit(0);
  } catch {
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
  }
}

console.error(`Timed out waiting for ${host}:${port}`);
process.exit(1);
