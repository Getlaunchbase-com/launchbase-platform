/**
 * Smoke Test: Normalization Modes (Tournament vs Production)
 * 
 * Validates that:
 * - Tournament mode: normalization OFF, model obedience tested (expected to fail if >8)
 * - Production mode: normalization ON, fixed-width guaranteed (truncate to 8)
 * 
 * Assertions:
 * - Tournament: status=FAILED/RETRIED, enabled=false, applied=false, attempts>=2
 * - Production: status=VALID, enabled=true, applied=true (if >8), exactly 8 changes
 * 
 * Usage: pnpm tsx scripts/smoke/smokeNormalizationModes.ts
 */

import { runPilotMacro, type PilotRun } from '../pilot/runPilotMacro';

const CONTROL_STACK = {
  designer_systems_fast: {
    modelId: 'gpt-4o-2024-08-06',
    provider: 'openai',
    maxTokens: 2000,
    temperature: 0.7,
  },
  designer_brand_fast: {
    modelId: 'gpt-4o-2024-08-06',
    provider: 'openai',
    maxTokens: 2000,
    temperature: 0.7,
  },
  design_critic_ruthless: {
    modelId: 'claude-opus-4-20250514',
    provider: 'anthropic',
    maxTokens: 4000,
    temperature: 0.3,
    timeoutMs: 240000, // 4 minutes for critic (needs more time than designers)
  },
};

const SAMPLE_PLAN = {
  businessName: 'Acme Consulting',
  industry: 'Professional Services',
  targetAudience: 'Small business owners',
  primaryGoal: 'Generate leads',
};

const SAMPLE_CONTEXT = {
  tier: 'premium',
  pages: ['home', 'services', 'about', 'contact'],
};

function printRunSummary(run: PilotRun, label: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${label}`);
  console.log(`${'─'.repeat(60)}`);
  console.log(`Run ID: ${run.runId}`);
  console.log(`Lane: ${run.lane}`);
  console.log(`Status: ${run.status}`);
  console.log(`Attempts: ${run.meta.attempts}`);
  console.log(`\nModels:`);
  console.log(`  Systems: ${run.meta.models.systems}`);
  console.log(`  Brand: ${run.meta.models.brand}`);
  console.log(`  Critic: ${run.meta.models.critic}`);
  console.log(`\nStop Reasons:`);
  console.log(`  Systems: ${run.meta.stopReasons.systems}`);
  console.log(`  Brand: ${run.meta.stopReasons.brand}`);
  console.log(`  Critic: ${run.meta.stopReasons.critic}`);
  console.log(`\nNormalization:`);
  console.log(`  Enabled: ${run.meta.normalization.enabled}`);
  console.log(`  Applied: ${run.meta.normalization.applied}`);
  console.log(`  Systems: ${run.meta.normalization.events.systems.kind === 'truncate' ? `${run.meta.normalization.events.systems.from} → ${run.meta.normalization.events.systems.to} (truncated: ${run.meta.normalization.events.systems.applied})` : 'N/A'}`);
  console.log(`  Brand: ${run.meta.normalization.events.brand.kind === 'truncate' ? `${run.meta.normalization.events.brand.from} → ${run.meta.normalization.events.brand.to} (truncated: ${run.meta.normalization.events.brand.applied})` : 'N/A'}`);
  console.log(`  Critic: ${run.meta.normalization.events.critic.kind === 'coerce_risks' ? `coerced ${run.meta.normalization.events.critic.coercedCount} objects → strings` : 'N/A'}`);
  console.log(`\nUsage Totals:`);
  console.log(`  Input Tokens: ${run.meta.usage.totals.inputTokens}`);
  console.log(`  Output Tokens: ${run.meta.usage.totals.outputTokens}`);
  console.log(`  Cost: $${run.meta.usage.totals.costUsd.toFixed(4)}`);
  console.log(`  Latency: ${run.meta.usage.totals.latencyMs}ms`);
  console.log(`\nPayload Counts:`);
  console.log(`  Systems Changes: ${run.systems.changes.length}`);
  console.log(`  Brand Changes: ${run.brand.changes.length}`);
  console.log(`  Critic Issues: ${run.critic.issues.length}`);
}

function assertTournamentMode(run: PilotRun) {
  console.log(`\n✓ Asserting tournament mode behavior...`);
  
  const errors: string[] = [];
  
  // 1. Normalization must be disabled
  if (run.meta.normalization.enabled !== false) {
    errors.push(`❌ normalization.enabled should be false, got ${run.meta.normalization.enabled}`);
  }
  
  // 2. Normalization must not be applied
  if (run.meta.normalization.applied !== false) {
    errors.push(`❌ normalization.applied should be false, got ${run.meta.normalization.applied}`);
  }
  
  // 3. Systems/brand events should not be applied
  if (run.meta.normalization.events.systems.applied) {
    errors.push(`❌ systems normalization should not be applied in tournament mode`);
  }
  if (run.meta.normalization.events.brand.applied) {
    errors.push(`❌ brand normalization should not be applied in tournament mode`);
  }
  if (run.meta.normalization.events.critic.applied) {
    errors.push(`❌ critic normalization should not be applied in tournament mode`);
  }
  
  // (truncation checks already covered by applied checks above)
  
  // 4. Usage totals must be > 0 (prove model was called)
  if (run.meta.usage.totals.inputTokens === 0) {
    errors.push(`❌ inputTokens should be > 0, got ${run.meta.usage.totals.inputTokens}`);
  }
  
  // 5. Expected behavior: FAILED or RETRIED (GPT-4o known to return >8)
  // NOTE: This is a "soft" assertion - if GPT-4o happens to return exactly 8, it's still valid
  if (run.status === 'VALID') {
    console.log(`⚠️  WARNING: Tournament run passed (status=VALID). This is rare but valid if model returned exactly 8.`);
    console.log(`   Systems: ${run.systems.changes.length}, Brand: ${run.brand.changes.length}`);
  } else {
    // If failed, verify retry ladder engaged
    if (run.meta.attempts < 2) {
      errors.push(`❌ Expected attempts >= 2 (retry ladder), got ${run.meta.attempts}`);
    }
    
    // Verify stop reason indicates schema failure
    const hasSchemaFailure = 
      run.meta.stopReasons.systems.includes('schema_failed') ||
      run.meta.stopReasons.systems.includes('content_noncompliance') ||
      run.meta.stopReasons.brand.includes('schema_failed') ||
      run.meta.stopReasons.brand.includes('content_noncompliance');
    
    if (!hasSchemaFailure) {
      console.log(`⚠️  WARNING: Expected schema_failed or content_noncompliance, got:`);
      console.log(`   Systems: ${run.meta.stopReasons.systems}`);
      console.log(`   Brand: ${run.meta.stopReasons.brand}`);
    }
  }
  
  if (errors.length > 0) {
    console.error(`\n❌ Tournament mode assertions FAILED:\n${errors.join('\n')}`);
    throw new Error('Tournament mode validation failed');
  }
  
  console.log(`✅ Tournament mode assertions PASSED`);
}

function assertProductionMode(run: PilotRun) {
  console.log(`\n✓ Asserting production mode behavior...`);
  
  const errors: string[] = [];
  
  // 1. Normalization must be enabled
  if (run.meta.normalization.enabled !== true) {
    errors.push(`❌ normalization.enabled should be true, got ${run.meta.normalization.enabled}`);
  }
  
  // 2. Status must be VALID or RETRIED (production guarantees fixed-width, may need retries)
  if (run.status !== 'VALID' && run.status !== 'RETRIED') {
    errors.push(`❌ status should be VALID or RETRIED, got ${run.status}`);
  }
  
  // 3. Systems changes must be exactly 8
  if (run.systems.changes.length !== 8) {
    errors.push(`❌ systems.changes.length should be 8, got ${run.systems.changes.length}`);
  }
  
  // 4. Brand changes must be exactly 8
  if (run.brand.changes.length !== 8) {
    errors.push(`❌ brand.changes.length should be 8, got ${run.brand.changes.length}`);
  }
  
  // 5. Usage totals must be > 0 (prove model was called)
  if (run.meta.usage.totals.inputTokens === 0) {
    errors.push(`❌ inputTokens should be > 0, got ${run.meta.usage.totals.inputTokens}`);
  }
  
  // 6. Conditional: If normalization was applied, verify events
  if (run.meta.normalization.applied === true) {
    console.log(`  ℹ️  Normalization was applied`);
    
    // At least one role should have normalization applied
    const anyApplied = 
      run.meta.normalization.events.systems.applied ||
      run.meta.normalization.events.brand.applied ||
      run.meta.normalization.events.critic.applied;
    
    if (!anyApplied) {
      errors.push(`❌ normalization.applied=true but no role events applied`);
    }
    
    // Verify truncation events are valid (from > to, to === 8)
    if (run.meta.normalization.events.systems.applied) {
      if (run.meta.normalization.events.systems.from <= run.meta.normalization.events.systems.to) {
        errors.push(`❌ systems truncation invalid: from=${run.meta.normalization.events.systems.from} should be > to=${run.meta.normalization.events.systems.to}`);
      }
      if (run.meta.normalization.events.systems.to !== 8) {
        errors.push(`❌ systems truncation invalid: to should be 8, got ${run.meta.normalization.events.systems.to}`);
      }
    }
    
    if (run.meta.normalization.events.brand.applied) {
      if (run.meta.normalization.events.brand.from <= run.meta.normalization.events.brand.to) {
        errors.push(`❌ brand truncation invalid: from=${run.meta.normalization.events.brand.from} should be > to=${run.meta.normalization.events.brand.to}`);
      }
      if (run.meta.normalization.events.brand.to !== 8) {
        errors.push(`❌ brand truncation invalid: to should be 8, got ${run.meta.normalization.events.brand.to}`);
      }
    }
    
    // Verify critic coercion if applied
    if (run.meta.normalization.events.critic.applied) {
      if (run.meta.normalization.events.critic.coercedCount === 0) {
        errors.push(`❌ critic coercion applied but coercedCount=0`);
      }
    }
  } else {
    console.log(`  ℹ️  Normalization was NOT applied (model returned exactly 8)`);
  }
  
  if (errors.length > 0) {
    console.error(`\n❌ Production mode assertions FAILED:\n${errors.join('\n')}`);
    throw new Error('Production mode validation failed');
  }
  
  console.log(`✅ Production mode assertions PASSED`);
}

async function main() {
  console.log('🧪 SMOKE TEST: Normalization Modes (Tournament vs Production)\n');
  
  const timestamp = Date.now();
  const jobId = `smoke_job_${timestamp}`;
  
  try {
    // Test 1: Tournament Mode (normalization OFF)
    console.log('📋 Test 1: Tournament Mode (allowNormalization=false)');
    console.log('Expected: May fail if GPT-4o returns >8 changes (known issue)');
    
    const tournamentRun = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId: `smoke_tournament_${timestamp}`,
      jobId,
      plan: SAMPLE_PLAN,
      context: SAMPLE_CONTEXT,
      stack: CONTROL_STACK,
      maxAttempts: 3,
      runMode: 'tournament',
    });
    
    printRunSummary(tournamentRun, '📊 TOURNAMENT MODE RESULT');
    assertTournamentMode(tournamentRun);
    
    // Test 2: Production Mode (normalization ON)
    console.log('\n📋 Test 2: Production Mode (allowNormalization=true)');
    console.log('Expected: Should pass even if model returns >8 (truncate to 8)');
    
    const productionRun = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId: `smoke_production_${timestamp}`,
      jobId,
      plan: SAMPLE_PLAN,
      context: SAMPLE_CONTEXT,
      stack: CONTROL_STACK,
      maxAttempts: 3,
      runMode: 'production',
    });
    
    printRunSummary(productionRun, '📊 PRODUCTION MODE RESULT');
    assertProductionMode(productionRun);
    
    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('✅ SMOKE TEST PASSED');
    console.log(`${'='.repeat(60)}`);
    console.log(`\nTournament Mode: ${tournamentRun.status} (normalization disabled)`);
    console.log(`Production Mode: ${productionRun.status} (normalization enabled)`);
    console.log(`\nNormalization Applied:`);
    console.log(`  Tournament: ${tournamentRun.meta.normalization.applied}`);
    console.log(`  Production: ${productionRun.meta.normalization.applied}`);
    console.log(`\nPayload Counts:`);
    console.log(`  Tournament Systems: ${tournamentRun.systems.changes.length}`);
    console.log(`  Tournament Brand: ${tournamentRun.brand.changes.length}`);
    console.log(`  Production Systems: ${productionRun.systems.changes.length} (from ${productionRun.meta.normalization.events.systems.from})`);
    console.log(`  Production Brand: ${productionRun.brand.changes.length} (from ${productionRun.meta.normalization.events.brand.from})`);
    console.log(`\n✅ Both modes validated successfully!`);
    
  } catch (err: any) {
    console.error(`\n❌ SMOKE TEST FAILED: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
