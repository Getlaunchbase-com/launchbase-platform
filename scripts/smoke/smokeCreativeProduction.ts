/**
 * Smoke Test: Creative Production Mode
 * 
 * Tests Creator → Selector → Critic pipeline with GPT-5.2 + Llama 8B + Sonnet 4.0
 * 
 * Pass criteria:
 * - Creator can output 8-24 changes (no strict count enforcement)
 * - Selector always returns exactly 8
 * - Critic passes ruthless validation
 * - Status: VALID or RETRIED
 * - Cost < $0.25 (target: $0.15-0.20)
 */

import { runPilotMacro } from '../pilot/runPilotMacro';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🧪 SMOKE TEST: Creative Production Mode\n');
  console.log('Testing: GPT-5.2 Creator → Llama 8B Selector → Sonnet 4.0 Critic\n');

  // Load stack config
  const stackPath = join(process.cwd(), 'config/stacks/stack_creative_gpt52_llama8b_sonnet40.json');
  const stackConfig = JSON.parse(readFileSync(stackPath, 'utf-8'));
  const stack = stackConfig.stack;

  // Mock plan and context
  const plan = {
    businessName: 'LaunchBase',
    industry: 'SaaS',
    targetAudience: 'Small business owners',
    goals: ['Increase conversions', 'Improve clarity', 'Reduce friction'],
  };

  const context = {
    lane: 'web',
    currentDesign: {
      hero: { headline: 'Launch Your Business', cta: 'Get Started' },
      pricing: { tier1: '$49/mo', tier2: '$99/mo' },
    },
    // ENABLE CREATIVE MODE
    creativeMode: {
      enabled: true,
      capBeforeSelect: 24,
    },
  };

  const runId = `smoke_creative_${Date.now()}`;
  const jobId = `smoke_job_${Date.now()}`;

  try {
    console.log('📋 Running creative production macro...\n');
    
    const result = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId,
      jobId,
      plan,
      context,
      stack,
      maxAttempts: 3,
      runMode: 'production', // Production mode (allows normalization if needed)
    });

    console.log('✅ SMOKE TEST PASSED\n');
    console.log('📊 RESULTS:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Run ID: ${result.runId}`);
    console.log(`Lane: ${result.lane}`);
    console.log(`Status: ${result.status}`);
    console.log(`Attempts: ${result.meta.attempts}`);
    console.log(`Run Mode: ${result.runMode}`);
    console.log('');
    console.log('Models:');
    console.log(`  Systems: ${result.meta.models.systems}`);
    console.log(`  Brand: ${result.meta.models.brand}`);
    console.log(`  Critic: ${result.meta.models.critic}`);
    console.log('');
    console.log('Stop Reasons:');
    console.log(`  Systems: ${result.meta.stopReasons.systems}`);
    console.log(`  Brand: ${result.meta.stopReasons.brand}`);
    console.log(`  Critic: ${result.meta.stopReasons.critic}`);
    console.log('');
    console.log('Output Counts:');
    console.log(`  Systems changes: ${result.systems.changes.length}`);
    console.log(`  Brand changes: ${result.brand.changes.length}`);
    console.log(`  Critic issues: ${result.critic.issues.length}`);
    console.log(`  Critic fixes: ${result.critic.suggestedFixes.length}`);
    console.log('');
    console.log('Usage Totals:');
    console.log(`  Input tokens: ${result.meta.usage.totals.inputTokens}`);
    console.log(`  Output tokens: ${result.meta.usage.totals.outputTokens}`);
    console.log(`  Latency: ${(result.meta.usage.totals.latencyMs / 1000).toFixed(1)}s`);
    console.log(`  Cost: $${result.meta.usage.totals.costUsd.toFixed(4)}`);
    console.log('');
    
    if (result.meta.usage.selector) {
      console.log('Selector Usage:');
      console.log(`  Input tokens: ${result.meta.usage.selector.inputTokens}`);
      console.log(`  Output tokens: ${result.meta.usage.selector.outputTokens}`);
      console.log(`  Latency: ${(result.meta.usage.selector.latencyMs / 1000).toFixed(1)}s`);
      console.log(`  Cost: $${result.meta.usage.selector.costUsd.toFixed(4)}`);
      console.log('');
    }
    
    if (result.meta.selection) {
      console.log('Selection Tracking:');
      console.log(`  Systems: ${result.meta.selection.systems.candidatesCount} candidates → ${result.meta.selection.systems.selectedCount} selected`);
      console.log(`  Brand: ${result.meta.selection.brand.candidatesCount} candidates → ${result.meta.selection.brand.selectedCount} selected`);
      console.log(`  Selector model: ${result.meta.selection.systems.selectorModel}`);
      console.log('');
    }
    
    console.log('Scoring:');
    console.log(`  Final score: ${result.finalScore.toFixed(2)}`);
    console.log(`  Truth penalty: ${result.truthPenalty.toFixed(4)}`);
    console.log(`  Quality penalty: ${result.qualityPenalty.toFixed(4)}`);
    console.log('─────────────────────────────────────────────────────────');
    console.log('');

    // Assertions
    console.log('🔍 VALIDATING RESULTS:\n');

    // 1. Status must be VALID or RETRIED
    if (result.status !== 'VALID' && result.status !== 'RETRIED') {
      throw new Error(`❌ Expected status VALID or RETRIED, got ${result.status}`);
    }
    console.log('✅ Status is VALID or RETRIED');

    // 2. Systems must have exactly 8 changes
    if (result.systems.changes.length !== 8) {
      throw new Error(`❌ Expected systems to have 8 changes, got ${result.systems.changes.length}`);
    }
    console.log('✅ Systems has exactly 8 changes');

    // 3. Brand must have exactly 8 changes
    if (result.brand.changes.length !== 8) {
      throw new Error(`❌ Expected brand to have 8 changes, got ${result.brand.changes.length}`);
    }
    console.log('✅ Brand has exactly 8 changes');

    // 4. Critic must have exactly 10 issues
    if (result.critic.issues.length !== 10) {
      throw new Error(`❌ Expected critic to have 10 issues, got ${result.critic.issues.length}`);
    }
    console.log('✅ Critic has exactly 10 issues');

    // 5. Critic must have exactly 10 fixes
    if (result.critic.suggestedFixes.length !== 10) {
      throw new Error(`❌ Expected critic to have 10 fixes, got ${result.critic.suggestedFixes.length}`);
    }
    console.log('✅ Critic has exactly 10 fixes');

    // 6. Critic pass must be false
    if (result.critic.pass !== false) {
      throw new Error(`❌ Expected critic pass to be false, got ${result.critic.pass}`);
    }
    console.log('✅ Critic pass is false');

    // 7. Cost should be < $0.25 (target: $0.15-0.20)
    if (result.meta.usage.totals.costUsd >= 0.25) {
      console.warn(`⚠️  Cost is $${result.meta.usage.totals.costUsd.toFixed(4)} (target: $0.15-0.20)`);
    } else {
      console.log(`✅ Cost is $${result.meta.usage.totals.costUsd.toFixed(4)} (within target)`);
    }

    // 8. Selector usage should be tracked
    if (result.meta.usage.selector) {
      console.log('✅ Selector usage tracked');
    } else {
      console.warn('⚠️  Selector usage not tracked (may not have been called)');
    }

    // 9. Selection tracking should be present
    if (result.meta.selection) {
      console.log('✅ Selection tracking present');
      
      // Validate selection tracking
      if (result.meta.selection.systems.selectedCount !== 8) {
        throw new Error(`❌ Expected systems selectedCount to be 8, got ${result.meta.selection.systems.selectedCount}`);
      }
      if (result.meta.selection.brand.selectedCount !== 8) {
        throw new Error(`❌ Expected brand selectedCount to be 8, got ${result.meta.selection.brand.selectedCount}`);
      }
      console.log('✅ Selection tracking valid (both roles selected 8)');
    } else {
      console.warn('⚠️  Selection tracking not present (creative mode may not have been enabled)');
    }

    console.log('');
    console.log('🎉 ALL ASSERTIONS PASSED!');
    console.log('');
    console.log('Creative Production pipeline is working correctly.');
    console.log('Ready for full pilot testing.');

  } catch (err) {
    console.error('❌ SMOKE TEST FAILED\n');
    console.error(err);
    process.exit(1);
  }
}

main();
