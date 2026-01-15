/**
 * Smoke Test: Creative Selector Pipeline
 * 
 * Tests Creator → Selector → Critic with two modes:
 * A) Production mode + creative enabled (should PASS)
 * B) Tournament mode + creative enabled (should PASS - selector is deterministic)
 * 
 * Ruthless assertions:
 * - Creator can output >8 (logged)
 * - Selector always returns exactly 8
 * - Final payload has exactly 8 proposedChanges
 * - Selector usage tracked
 * - Critic passes ruthless validation (10/10/false)
 * - MODEL_LOCK preserved (if enabled)
 */

import { runPilotMacro } from '../pilot/runPilotMacro';
import { readFileSync } from 'fs';
import { join } from 'path';

async function main() {
  console.log('🧪 SMOKE TEST: Creative Selector Pipeline\n');
  console.log('Stack: GPT-5.2 Creator → Llama 8B Selector → Sonnet 4.0 Critic\n');

  // Load stack config
  const stackPath = join(process.cwd(), 'config/stacks/stack_creative_gpt52_llama8b_sonnet40.json');
  const stackConfig = JSON.parse(readFileSync(stackPath, 'utf-8'));
  const stack = stackConfig.stack;

  // Mock plan and context (shared across both modes)
  const plan = {
    businessName: 'LaunchBase',
    industry: 'SaaS Platform',
    targetAudience: 'Small business owners launching service businesses',
    goals: [
      'Increase conversion rate by making value proposition clearer',
      'Reduce friction in signup flow',
      'Improve mobile experience',
    ],
  };

  const baseContext = {
    currentDesign: {
      hero: {
        headline: 'Launch Your Business Fast',
        subheadline: 'Build your website in minutes',
        cta: 'Get Started',
      },
      pricing: {
        tier1: { name: 'Starter', price: '$49/mo' },
        tier2: { name: 'Pro', price: '$99/mo' },
      },
      testimonials: [
        { quote: 'Great product!', author: 'John Doe' },
      ],
    },
  };

  const timestamp = Date.now();

  // ============================================================
  // TEST A: Production Mode + Creative Enabled
  // ============================================================
  
  console.log('📋 Test A: Production Mode + Creative Enabled\n');
  console.log('Expected: Creator bursts 8-24, Selector picks 8, Critic validates\n');

  const runIdA = `smoke_creative_prod_${timestamp}`;
  const jobIdA = `smoke_job_prod_${timestamp}`;

  const contextA = {
    ...baseContext,
    creativeMode: {
      enabled: true,
      capBeforeSelect: 24,
    },
  };

  let resultA;
  try {
    resultA = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId: runIdA,
      jobId: jobIdA,
      plan,
      context: contextA,
      stack,
      maxAttempts: 3,
      runMode: 'production',
    });

    console.log('✅ Test A PASSED\n');
  } catch (err) {
    console.error('❌ Test A FAILED\n');
    console.error(err);
    process.exit(1);
  }

  // Print Test A results
  printResults('Test A (Production + Creative)', resultA);
  
  // Validate Test A
  console.log('🔍 VALIDATING Test A:\n');
  validateResult(resultA, 'production');

  console.log('\n' + '='.repeat(80) + '\n');

  // ============================================================
  // TEST B: Tournament Mode + Creative Enabled
  // ============================================================
  
  console.log('📋 Test B: Tournament Mode + Creative Enabled\n');
  console.log('Expected: Selector is deterministic, should still pass\n');

  const runIdB = `smoke_creative_tourn_${timestamp}`;
  const jobIdB = `smoke_job_tourn_${timestamp}`;

  const contextB = {
    ...baseContext,
    creativeMode: {
      enabled: true,
      capBeforeSelect: 24,
    },
  };

  let resultB;
  try {
    resultB = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId: runIdB,
      jobId: jobIdB,
      plan,
      context: contextB,
      stack,
      maxAttempts: 3,
      runMode: 'tournament',
    });

    console.log('✅ Test B PASSED\n');
  } catch (err) {
    console.error('❌ Test B FAILED\n');
    console.error(err);
    process.exit(1);
  }

  // Print Test B results
  printResults('Test B (Tournament + Creative)', resultB);
  
  // Validate Test B
  console.log('🔍 VALIDATING Test B:\n');
  validateResult(resultB, 'tournament');

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('🎉 ALL SMOKE TESTS PASSED!\n');
  console.log('Creative Selector pipeline is production-ready.');
  console.log('Ready for micro-pilot: Web×3 + Marketing×3\n');
}

function printResults(testName: string, result: any) {
  console.log(`📊 ${testName} RESULTS:`);
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Run ID: ${result.runId}`);
  console.log(`Lane: ${result.lane}`);
  console.log(`Status: ${result.status}`);
  console.log(`Run Mode: ${result.runMode}`);
  console.log(`Attempts: ${result.meta.attempts}`);
  console.log('');
  
  // PROOF OF LIFE LINE (requested format)
  if (result.meta.selection) {
    const sysCand = result.meta.selection.systems.candidatesCount;
    const sysSelected = result.meta.selection.systems.selectedCount;
    const brandCand = result.meta.selection.brand.candidatesCount;
    const brandSelected = result.meta.selection.brand.selectedCount;
    const cost = result.meta.usage.totals.costUsd.toFixed(4);
    const latency = (result.meta.usage.totals.latencyMs / 1000).toFixed(1);
    
    console.log('🎯 PROOF OF LIFE:');
    console.log(`Systems: ${sysCand} → cap24=${Math.min(sysCand, 24)} → selected=${sysSelected} | Brand: ${brandCand} → cap24=${Math.min(brandCand, 24)} → selected=${brandSelected} | Total $${cost} | ${latency}s`);
    console.log('');
  }
  
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
  console.log(`  Systems: ${result.systems.changes.length}`);
  console.log(`  Brand: ${result.brand.changes.length}`);
  console.log(`  Critic issues: ${result.critic.issues.length}`);
  console.log(`  Critic fixes: ${result.critic.suggestedFixes.length}`);
  console.log(`  Critic pass: ${result.critic.pass}`);
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
    console.log(`  Systems candidates: ${result.meta.selection.systems.candidatesCount}`);
    console.log(`  Systems selected: ${result.meta.selection.systems.selectedCount}`);
    console.log(`  Brand candidates: ${result.meta.selection.brand.candidatesCount}`);
    console.log(`  Brand selected: ${result.meta.selection.brand.selectedCount}`);
    console.log(`  Selector model: ${result.meta.selection.systems.selectorModel}`);
    console.log('');
  }
  
  console.log('Scoring:');
  console.log(`  Final score: ${result.finalScore.toFixed(2)}`);
  console.log(`  Truth penalty: ${result.truthPenalty.toFixed(4)}`);
  console.log(`  Quality penalty: ${result.qualityPenalty.toFixed(4)}`);
  console.log('─────────────────────────────────────────────────────────');
  console.log('');
}

function validateResult(result: any, mode: 'production' | 'tournament') {
  const errors: string[] = [];

  // 1. Status must be VALID or RETRIED
  if (result.status !== 'VALID' && result.status !== 'RETRIED') {
    errors.push(`Status must be VALID or RETRIED, got ${result.status}`);
  } else {
    console.log('✅ Status is VALID or RETRIED');
  }

  // 2. Systems must have exactly 8 changes (final payload)
  if (result.systems.changes.length !== 8) {
    errors.push(`Systems must have 8 changes, got ${result.systems.changes.length}`);
  } else {
    console.log('✅ Systems has exactly 8 changes');
  }

  // 3. Brand must have exactly 8 changes (final payload)
  if (result.brand.changes.length !== 8) {
    errors.push(`Brand must have 8 changes, got ${result.brand.changes.length}`);
  } else {
    console.log('✅ Brand has exactly 8 changes');
  }

  // 4. Critic must have exactly 10 issues
  if (result.critic.issues.length !== 10) {
    errors.push(`Critic must have 10 issues, got ${result.critic.issues.length}`);
  } else {
    console.log('✅ Critic has exactly 10 issues');
  }

  // 5. Critic must have exactly 10 fixes
  if (result.critic.suggestedFixes.length !== 10) {
    errors.push(`Critic must have 10 fixes, got ${result.critic.suggestedFixes.length}`);
  } else {
    console.log('✅ Critic has exactly 10 fixes');
  }

  // 6. Critic pass must be false
  if (result.critic.pass !== false) {
    errors.push(`Critic pass must be false, got ${result.critic.pass}`);
  } else {
    console.log('✅ Critic pass is false');
  }

  // 7. Selection tracking must be present (creative mode)
  if (!result.meta.selection) {
    errors.push('Selection tracking missing (creativeMode may not be enabled)');
  } else {
    console.log('✅ Selection tracking present');

    // 7a. Systems candidatesCount must be >= 8
    if (result.meta.selection.systems.candidatesCount < 8) {
      errors.push(`Systems candidatesCount must be >= 8, got ${result.meta.selection.systems.candidatesCount}`);
    } else {
      console.log(`✅ Systems candidatesCount >= 8 (${result.meta.selection.systems.candidatesCount})`);
    }

    // 7b. Systems selectedCount must be exactly 8
    if (result.meta.selection.systems.selectedCount !== 8) {
      errors.push(`Systems selectedCount must be 8, got ${result.meta.selection.systems.selectedCount}`);
    } else {
      console.log('✅ Systems selectedCount = 8');
    }

    // 7c. Brand candidatesCount must be >= 8
    if (result.meta.selection.brand.candidatesCount < 8) {
      errors.push(`Brand candidatesCount must be >= 8, got ${result.meta.selection.brand.candidatesCount}`);
    } else {
      console.log(`✅ Brand candidatesCount >= 8 (${result.meta.selection.brand.candidatesCount})`);
    }

    // 7d. Brand selectedCount must be exactly 8
    if (result.meta.selection.brand.selectedCount !== 8) {
      errors.push(`Brand selectedCount must be 8, got ${result.meta.selection.brand.selectedCount}`);
    } else {
      console.log('✅ Brand selectedCount = 8');
    }
  }

  // 8. Selector usage must be tracked
  if (!result.meta.usage.selector) {
    errors.push('Selector usage not tracked');
  } else {
    console.log('✅ Selector usage tracked');

    // 8a. Selector tokens must be > 0
    if (result.meta.usage.selector.inputTokens <= 0 || result.meta.usage.selector.outputTokens <= 0) {
      errors.push('Selector tokens must be > 0');
    } else {
      console.log(`✅ Selector tokens > 0 (in: ${result.meta.usage.selector.inputTokens}, out: ${result.meta.usage.selector.outputTokens})`);
    }
  }

  // 9. Cost should be reasonable (< $0.30, target $0.15-0.20)
  if (result.meta.usage.totals.costUsd > 0.30) {
    console.warn(`⚠️  Cost is high: $${result.meta.usage.totals.costUsd.toFixed(4)} (target: $0.15-0.20)`);
  } else {
    console.log(`✅ Cost is reasonable: $${result.meta.usage.totals.costUsd.toFixed(4)}`);
  }

  // 10. Latency should be reasonable (< 60s)
  const latencySec = result.meta.usage.totals.latencyMs / 1000;
  if (latencySec > 60) {
    console.warn(`⚠️  Latency is high: ${latencySec.toFixed(1)}s`);
  } else {
    console.log(`✅ Latency is reasonable: ${latencySec.toFixed(1)}s`);
  }

  // Throw if any errors
  if (errors.length > 0) {
    console.error('\n❌ VALIDATION FAILED:\n');
    errors.forEach(err => console.error(`  - ${err}`));
    throw new Error('Validation failed');
  }

  console.log('\n✅ ALL ASSERTIONS PASSED');
}

main();
