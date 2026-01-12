import { getDb } from '../server/db';

async function main() {
  const db = await getDb();

  console.log('🔍 Step 1: Verify seeded rows before deletion\n');
  console.log('═══════════════════════════════════════════════\n');

  // Verify ActionRequests
  const verifyAR = await db.execute(`
    SELECT id, intakeId, checklistKey, 
           JSON_UNQUOTE(JSON_EXTRACT(rawInbound, '$.aiTennis.stopReason')) AS stop_reason
    FROM action_requests
    WHERE id IN (10, 11, 12);
  `);

  console.log('ActionRequests to delete:', JSON.stringify(verifyAR[0], null, 2));

  // Verify intake
  const verifyIntake = await db.execute(`
    SELECT id, businessName, email, tenant
    FROM intakes
    WHERE id = 10;
  `);

  console.log('\nIntake to delete:', JSON.stringify(verifyIntake[0], null, 2));

  // Check if intake has other dependencies
  const intakeUsage = await db.execute(`
    SELECT COUNT(*) AS count
    FROM action_requests
    WHERE intakeId = 10;
  `);

  const usageCount = (intakeUsage[0] as any[])[0].count;
  console.log(`\nIntake 10 usage count: ${usageCount} action_requests`);

  if (usageCount !== 3) {
    console.error('\n❌ ERROR: Expected exactly 3 action_requests for intake 10, found', usageCount);
    console.error('Aborting cleanup to prevent accidental deletion.');
    process.exit(1);
  }

  console.log('\n🗑️  Step 2: Delete seeded rows\n');
  console.log('═══════════════════════════════════════════════\n');

  // Delete ActionRequests
  const deleteAR = await db.execute(`
    DELETE FROM action_requests
    WHERE id IN (10, 11, 12);
  `);

  console.log('Deleted ActionRequests:', (deleteAR[0] as any).affectedRows, 'rows');

  // Delete intake
  const deleteIntake = await db.execute(`
    DELETE FROM intakes
    WHERE id = 10;
  `);

  console.log('Deleted Intake:', (deleteIntake[0] as any).affectedRows, 'rows');

  console.log('\n✅ Step 3: Verify deletion\n');
  console.log('═══════════════════════════════════════════════\n');

  // Verify ActionRequests deleted
  const verifyARDeleted = await db.execute(`
    SELECT COUNT(*) AS count
    FROM action_requests
    WHERE id IN (10, 11, 12);
  `);

  const arCount = (verifyARDeleted[0] as any[])[0].count;
  console.log('ActionRequests remaining (should be 0):', arCount);

  // Verify intake deleted
  const verifyIntakeDeleted = await db.execute(`
    SELECT COUNT(*) AS count
    FROM intakes
    WHERE id = 10;
  `);

  const intakeCount = (verifyIntakeDeleted[0] as any[])[0].count;
  console.log('Intakes remaining (should be 0):', intakeCount);

  if (arCount === 0 && intakeCount === 0) {
    console.log('\n✅ Cleanup complete! All seeded test data removed from production.');
  } else {
    console.error('\n❌ ERROR: Cleanup incomplete. Please investigate.');
    process.exit(1);
  }
}

main().catch(console.error);
