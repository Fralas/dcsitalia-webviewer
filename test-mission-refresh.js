import * as combatMissionDispatch from './backend/src/services/combatMissionDispatch.js';

console.log('🧪 Testing intelligent mission refresh...\n');

// Step 1: Generate initial missions
console.log('📝 Step 1: Generate initial missions');
const initialMissions = combatMissionDispatch.generateCombatMissions();
console.log(`   Generated ${initialMissions.length} missions\n`);

// Step 2: Simulate assigning a mission
console.log('📝 Step 2: Assign a mission to a pilot');
const availableMissions = combatMissionDispatch.getAvailableCombatMissions();
if (availableMissions.length > 0) {
  const mission = availableMissions[0];
  console.log(`   Assigning mission ${mission.id} (${mission.zone_name}) to TestPilot`);
  combatMissionDispatch.assignCombatMission(mission.id, 'TestPilot', 'F-16C');
  console.log(`   ✅ Mission assigned\n`);
} else {
  console.log(`   ⚠️  No available missions to assign\n`);
}

// Step 3: Show current state
console.log('📝 Step 3: Current mission state before refresh');
const allMissions = combatMissionDispatch.getAllCombatMissions();
const assigned = allMissions.filter(m => m.mission_status === 'assigned').length;
const available = allMissions.filter(m => m.mission_status === 'available').length;
console.log(`   Total: ${allMissions.length}, Assigned: ${assigned}, Available: ${available}\n`);

// Step 4: Refresh missions (simulate Lua file change)
console.log('📝 Step 4: Refresh missions (simulating Lua update)');
const refreshedMissions = combatMissionDispatch.refreshCombatMissions();
console.log('');

// Step 5: Verify results
console.log('📝 Step 5: Verify mission state after refresh');
const allMissionsAfter = combatMissionDispatch.getAllCombatMissions();
const assignedAfter = allMissionsAfter.filter(m => m.mission_status === 'assigned');
const availableAfter = allMissionsAfter.filter(m => m.mission_status === 'available');

console.log(`   Total: ${allMissionsAfter.length}, Assigned: ${assignedAfter.length}, Available: ${availableAfter.length}`);

if (assignedAfter.length > 0) {
  console.log(`\n   ✅ SUCCESS: Assigned missions preserved!`);
  assignedAfter.forEach(m => {
    console.log(`      - ${m.zone_name} (assigned to ${m.assigned_to})`);
  });
} else {
  console.log(`\n   ❌ FAILURE: Assigned missions were lost!`);
}

console.log('\n🎯 Test complete!');
