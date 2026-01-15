/**
 * Smoke Test: Tournament vs Production Modes
 * 
 * Tests normalization behavior in both modes:
 * - Tournament mode: allowNormalization=false (test obedience, expect failures if >8)
 * - Production mode: allowNormalization=true (guarantee fixed-width, truncate if >8)
 * 
 * Usage: pnpm tsx scripts/runSmokeTest_Modes.ts
 */

import { runPilotMacro } from './pilot/runPilotMacro';
import type { RunMode } from './pilot/types';

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

async function runSmokeTest(mode: RunMode) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`SMOKE TEST: ${mode.toUpperCase()} MODE`);
  console.log(`${'='.repeat(60)}\n`);

  const runId = `smoke_${mode}_${Date.now()}`;
  const jobId = `job_smoke_${Date.now()}`;

  try {
    const result = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId,
      jobId,
      plan: SAMPLE_PLAN,
      context: SAMPLE_CONTEXT,
      stack: CONTROL_STACK,
      maxAttempts: 3,
      runMode: mode,
    });

    console.log(`\n✅ ${mode.toUpperCase()} MODE RESULT:`);
    console.log(`Status: ${result.status}`);
    console.log(`Final Score: ${result.finalScore.toFixed(2)}`);
    console.log(`Truth Penalty: ${result.truthPenalty.toFixed(3)}`);
    console.log(`\nSystems Changes: ${result.systems.changes.length}`);
    console.log(`Brand Changes: ${result.brand.changes.length}`);
    console.log(`Critic Issues: ${result.critic.issues.length}`);
    console.log(`\nNormalization:`);
    console.log(`  Enabled: ${result.meta.normalization.enabled}`);
    console.log(`  Applied: ${result.meta.normalization.applied}`);
    console.log(`  Systems: ${result.meta.normalization.events.systems.from} → ${result.meta.normalization.events.systems.to} (truncated: ${result.meta.normalization.events.systems.truncated})`);
    console.log(`  Brand: ${result.meta.normalization.events.brand.from} → ${result.meta.normalization.events.brand.to} (truncated: ${result.meta.normalization.events.brand.truncated})`);
    console.log(`\nUsage:`);
    console.log(`  Total Input Tokens: ${result.meta.usage.totals.inputTokens}`);
    console.log(`  Total Output Tokens: ${result.meta.usage.totals.outputTokens}`);
    console.log(`  Total Cost: $${result.meta.usage.totals.costUsd.toFixed(4)}`);
    console.log(`  Total Latency: ${result.meta.usage.totals.latencyMs}ms`);

    return result;
  } catch (err: any) {
    console.error(`\n❌ ${mode.toUpperCase()} MODE FAILED:`);
    console.error(`Error: ${err.message}`);
    console.error(`Stop Reason: ${err.stopReason || 'unknown'}`);
    throw err;
  }
}

async function main() {
  console.log('🧪 Starting Smoke Test: Tournament vs Production Modes\n');

  try {
    // Test 1: Tournament mode (strict validation, no normalization)
    console.log('📋 Test 1: Tournament Mode (allowNormalization=false)');
    console.log('Expected: May fail if GPT-4o returns >8 changes (known issue)');
    const tournamentResult = await runSmokeTest('tournament');

    // Test 2: Production mode (with normalization)
    console.log('\n📋 Test 2: Production Mode (allowNormalization=true)');
    console.log('Expected: Should pass even if model returns >8 (truncate to 8)');
    const productionResult = await runSmokeTest('production');

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log('SMOKE TEST SUMMARY');
    console.log(`${'='.repeat(60)}\n`);

    console.log('Tournament Mode:');
    console.log(`  Status: ${tournamentResult.status}`);
    console.log(`  Normalization Applied: ${tournamentResult.meta.normalization.applied}`);
    console.log(`  Systems: ${tournamentResult.systems.changes.length} changes`);
    console.log(`  Brand: ${tournamentResult.brand.changes.length} changes`);

    console.log('\nProduction Mode:');
    console.log(`  Status: ${productionResult.status}`);
    console.log(`  Normalization Applied: ${productionResult.meta.normalization.applied}`);
    console.log(`  Systems: ${productionResult.systems.changes.length} changes (normalized from ${productionResult.meta.normalization.events.systems.from})`);
    console.log(`  Brand: ${productionResult.brand.changes.length} changes (normalized from ${productionResult.meta.normalization.events.brand.from})`);

    console.log('\n✅ All smoke tests completed successfully!');
  } catch (err: any) {
    console.error('\n❌ Smoke test failed:', err.message);
    process.exit(1);
  }
}

main();
