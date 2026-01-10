// Tier 1 Enhanced Presentation - End-to-End Test
// Tests determinism, fail-open, and persistence

import { getDb, createIntake } from './server/db';
import { intakes, designJobs, designCandidates, designEvents } from './drizzle/schema';
import { eq } from 'drizzle-orm';
import { runPresentationPass } from './server/services/design/runPresentationPass';

async function main() {
  const db = await getDb();
  console.log('🧪 Tier 1 End-to-End Test\n');
  
  // Step 1: Create test intake
  console.log('Step 1: Creating test intake...');
  const intake = await createIntake({
    businessName: 'Tier 1 Test Company',
    contactName: 'Test User',
    email: 'tier1test@vincessnowplow.com',
    phone: '555-1111',
    vertical: 'trades',
    tenant: 'vinces',
    rawPayload: {
      businessDescription: 'Professional snow removal and plowing services',
      serviceArea: 'Chicago',
      customerType: 'homeowners',
      websiteGoals: ['get_calls'],
      contactPreference: 'phone',
      brandFeel: 'professional'
    },
  });
  
  if (!intake) {
    throw new Error('Failed to create intake');
  }
  
  console.log(`✅ Created intake ${intake.id}\n`);
  
  // Step 2: Run presentation pass
  console.log('Step 2: Running presentation pass...');
  const intakeData = {
    businessName: intake.businessName,
    businessDescription: 'Professional snow removal and plowing services',
    customerType: 'homeowners',
    websiteGoals: ['get_calls'],
    contactPreference: 'phone',
    serviceArea: 'Chicago',
    phone: intake.phone,
    email: intake.email,
    brandFeel: 'professional'
  };
  
  const buildPlan = {
    vertical: 'trades',
    tone: 'professional',
    primaryCTA: 'Get Quote',
    confidence: 0.9
  };
  
  const result1 = await runPresentationPass({
    intakeId: intake.id,
    tenant: 'vinces',
    intakeData,
    buildPlan,
    tier: 'enhanced'
  });
  
  console.log(`✅ Presentation pass completed`);
  console.log(`   Winner: ${result1.variantKey}`);
  console.log(`   Score: ${result1.score}\n`);
  
  // Step 3: Verify exactly 1 design_job
  console.log('Step 3: Verifying design_job...');
  const jobs = await db.select().from(designJobs).where(eq(designJobs.intakeId, intake.id));
  if (jobs.length !== 1) {
    throw new Error(`Expected 1 design_job, got ${jobs.length}`);
  }
  console.log(`✅ Exactly 1 design_job created (id: ${jobs[0].id})\n`);
  
  // Step 4: Verify exactly 3 candidates
  console.log('Step 4: Verifying candidates...');
  const candidates = await db.select().from(designCandidates).where(eq(designCandidates.designJobId, jobs[0].id));
  if (candidates.length !== 3) {
    throw new Error(`Expected 3 candidates, got ${candidates.length}`);
  }
  console.log(`✅ Exactly 3 candidates created`);
  candidates.forEach(c => {
    console.log(`   - ${c.variantKey}: ${c.scoreTotal} (rank: ${c.rank})`);
  });
  console.log('');
  
  // Step 5: Verify scores differ
  console.log('Step 5: Verifying scores differ...');
  const scores = candidates.map(c => c.scoreTotal);
  const uniqueScores = new Set(scores);
  if (uniqueScores.size < 2) {
    throw new Error(`Expected different scores, got: ${scores.join(', ')}`);
  }
  console.log(`✅ Scores differ: ${scores.join(', ')}\n`);
  
  // Step 6: Verify winner stable across reloads
  console.log('Step 6: Testing persistence (reload)...');
  const result2 = await runPresentationPass({
    intakeId: intake.id,
    tenant: 'vinces',
    intakeData,
    buildPlan,
    tier: 'enhanced'
  });
  
  if (result1.variantKey !== result2.variantKey) {
    throw new Error(`Winner changed: ${result1.variantKey} → ${result2.variantKey}`);
  }
  if (result1.score !== result2.score) {
    throw new Error(`Score changed: ${result1.score} → ${result2.score}`);
  }
  console.log(`✅ Winner stable: ${result2.variantKey} (${result2.score})\n`);
  
  // Step 7: Verify no duplicate jobs
  console.log('Step 7: Verifying no duplicate jobs...');
  const jobsAfter = await db.select().from(designJobs).where(eq(designJobs.intakeId, intake.id));
  if (jobsAfter.length !== 1) {
    throw new Error(`Expected still 1 job, got ${jobsAfter.length}`);
  }
  console.log(`✅ No duplicate jobs created\n`);
  
  // Step 8: Verify events logged
  console.log('Step 8: Verifying events...');
  const events = await db.select().from(designEvents).where(eq(designEvents.designJobId, jobs[0].id));
  const eventTypes = events.map(e => e.eventType);
  const requiredEvents = ['DESIGN_JOB_CREATED', 'DESIGN_CANDIDATES_GENERATED', 'DESIGN_SCORED', 'DESIGN_SELECTED'];
  const missing = requiredEvents.filter(e => !eventTypes.includes(e));
  if (missing.length > 0) {
    throw new Error(`Missing events: ${missing.join(', ')}`);
  }
  console.log(`✅ All required events logged: ${eventTypes.join(', ')}\n`);
  
  console.log('🎉 All tests passed!\n');
  console.log('Summary:');
  console.log(`  - Intake: ${intake.id}`);
  console.log(`  - Job: ${jobs[0].id}`);
  console.log(`  - Winner: ${result1.variantKey}`);
  console.log(`  - Score: ${result1.score}`);
  console.log(`  - Candidates: ${candidates.length}`);
  console.log(`  - Events: ${events.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
