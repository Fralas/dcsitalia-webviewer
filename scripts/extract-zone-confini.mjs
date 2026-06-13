import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const luaPath = process.argv[2] || 'C:/DCS SERVER/MISSION SCRIPTS/DCORE/src/DMAP/DMAP_Config.lua';
const outputPath = path.join(__dirname, '../frontend/src/config/zoneConfini.json');

const lua = fs.readFileSync(luaPath, 'utf8');
const start = lua.indexOf('local confini = {');
const end = lua.indexOf('-- Template che non devono cercare');
const block = lua.slice(start, end);

const confini = {};
const entryRe = /\["(zone_\d+)"\]\s*=\s*\{([^}]*)\}/g;
let match;

while ((match = entryRe.exec(block)) !== null) {
  const zoneId = match[1];
  const neighbors = [...match[2].matchAll(/"(zone_\d+)"/g)].map((item) => item[1]);
  confini[zoneId] = neighbors;
}

fs.writeFileSync(outputPath, `${JSON.stringify(confini, null, 2)}\n`);
console.log(`Wrote ${Object.keys(confini).length} zones to ${outputPath}`);
