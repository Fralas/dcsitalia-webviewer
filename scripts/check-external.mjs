import net from 'node:net';

const checks = [
  { label: 'Frontend Vite (0.0.0.0:3000)', host: '0.0.0.0', port: 3000 },
  { label: 'Backend API (127.0.0.1:3001)', host: '127.0.0.1', port: 3001 },
];

function probe(host, port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: 2000 }, () => {
      socket.end();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

console.log('Controllo servizi locali...\n');
let ok = true;

for (const check of checks) {
  const up = await probe(check.host, check.port);
  console.log(`${up ? 'OK' : 'OFF'}  ${check.label}`);
  if (!up) ok = false;
}

console.log('');
if (!ok) {
  console.error('Servizio mancante. Avvia: npm run dev');
  process.exit(1);
}

console.log('URL esterno: http://warehouse.dcs-italia.it:3000');
console.log('Non usare https://warehouse.dcs-italia.it (porta 443 = router Fritz).');
