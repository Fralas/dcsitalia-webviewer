import * as luaZoneSync from './backend/src/services/luaZoneSync.js';

console.log('🧪 Testing Lua Zone Sync...\n');

const result = luaZoneSync.syncLuaToJson();

console.log('\n📊 Sync Result:');
console.log(`  Success: ${result.success}`);
console.log(`  Zones count: ${result.count || 0}`);

if (result.success) {
  console.log('\n✅ Sync successful!');
  console.log('\n🔍 Sample zones:');
  result.zones.slice(0, 5).forEach(zone => {
    console.log(`  - ${zone.name}: ${zone.status}, Tasks: [${zone.tasks.join(', ')}]`);
  });
} else {
  console.log('\n❌ Sync failed:', result.error);
}

process.exit(result.success ? 0 : 1);
