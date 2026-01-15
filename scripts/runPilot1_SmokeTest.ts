/**
 * Pilot #1 Smoke Test: 1 rep Web only
 * 
 * Verifies integration contracts before full pilot run:
 * - Systems: EXACTLY 8 design.* changes
 * - Brand: EXACTLY 8 brand.* changes  
 * - Critic: EXACTLY 10 issues + 10 fixes, pass:false
 * - No truncation/invalid_json
 * - Schema routing correct
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runPilotMacro } from './pilot/runPilotMacro';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '../config/pilot_1_claude_sonnet_critic.json');
const OUTPUT_DIR = path.join(__dirname, '../runs/pilot_1_smoke');

async function runSmokeTest() {
  console.log('🧪 Pilot #1 Smoke Test: 1 rep Web only\n');

  // Load config
  const pilotConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Run 1 rep Web only
  const runId = `smoke_test_web_${Date.now()}`;
  const jobId = `smoke_test_job_${Date.now()}`;

  console.log(`[${runId}] Starting smoke test...`);
  console.log(`  Lane: web`);
  console.log(`  Models:`);
  console.log(`    Systems: ${pilotConfig.stack.designer_systems_fast.modelId}`);
  console.log(`    Brand: ${pilotConfig.stack.designer_brand_fast.modelId}`);
  console.log(`    Critic: ${pilotConfig.stack.design_critic_ruthless.modelId} (CHALLENGER)`);
  console.log('');

  const startTime = Date.now();

  try {
    const pilotRun = await runPilotMacro({
      lane: 'web',
      rep: 1,
      runId,
      jobId,
      plan: {
        goal: 'Design a web page for a SaaS startup',
        constraints: [],
      },
      context: {
        lane: 'web',
        mode: 'smoke_test',
        pilotId: 'pilot_1_claude_sonnet_critic',
      },
      stack: pilotConfig.stack,
      maxAttempts: 3,
    });

    const duration = (Date.now() - startTime) / 1000;

    // Log results
    console.log(`\n✅ Run completed in ${duration.toFixed(1)}s`);
    console.log('');
    console.log('📊 Results:');
    console.log(`  Status: ${pilotRun.status}`);
    console.log(`  Final Score: ${pilotRun.finalScore.toFixed(2)}`);
    console.log(`  Truth Penalty: ${pilotRun.truthPenalty.toFixed(4)}`);
    console.log(`  Quality Penalty: ${pilotRun.qualityPenalty.toFixed(4)}`);
    console.log('');
    console.log('🔍 Validation Counts:');
    console.log(`  Systems changes: ${pilotRun.systems.changes.length} (expected: 8)`);
    console.log(`  Brand changes: ${pilotRun.brand.changes.length} (expected: 8)`);
    console.log(`  Critic issues: ${pilotRun.critic.issues.length} (expected: 10)`);
    console.log(`  Critic fixes: ${pilotRun.critic.suggestedFixes.length} (expected: 10)`);
    console.log(`  Critic pass: ${pilotRun.critic.pass} (expected: false)`);
    console.log('');
    console.log('🎯 Model Resolution:');
    console.log(`  Systems: ${pilotRun.meta.models.systems}`);
    console.log(`  Brand: ${pilotRun.meta.models.brand}`);
    console.log(`  Critic: ${pilotRun.meta.models.critic}`);
    console.log('');
    console.log('⚡ Stop Reasons:');
    console.log(`  Systems: ${pilotRun.meta.stopReasons.systems}`);
    console.log(`  Brand: ${pilotRun.meta.stopReasons.brand}`);
    console.log(`  Critic: ${pilotRun.meta.stopReasons.critic}`);
    console.log('');
    console.log('💰 Cost & Performance:');
    console.log(`  Total cost: $${pilotRun.meta.totalCostUsd.toFixed(4)}`);
    console.log(`  Total latency: ${(pilotRun.meta.totalLatencyMs / 1000).toFixed(1)}s`);
    console.log(`  Attempts: ${pilotRun.meta.attempts}`);
    console.log('');

    // Verify contracts
    const checks = {
      systemsCount: pilotRun.systems.changes.length === 8,
      brandCount: pilotRun.brand.changes.length === 8,
      criticIssuesCount: pilotRun.critic.issues.length === 10,
      criticFixesCount: pilotRun.critic.suggestedFixes.length === 10,
      criticPassFalse: pilotRun.critic.pass === false,
      noTruncation: !Object.values(pilotRun.meta.stopReasons).includes('length'),
      validStatus: pilotRun.status === 'VALID' || pilotRun.status === 'RETRIED',
    };

    console.log('✅ Contract Verification:');
    console.log(`  Systems: EXACTLY 8 changes - ${checks.systemsCount ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Brand: EXACTLY 8 changes - ${checks.brandCount ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Critic: EXACTLY 10 issues - ${checks.criticIssuesCount ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Critic: EXACTLY 10 fixes - ${checks.criticFixesCount ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Critic: pass=false - ${checks.criticPassFalse ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  No truncation - ${checks.noTruncation ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Valid status - ${checks.validStatus ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    const allPassed = Object.values(checks).every(v => v);

    if (allPassed) {
      console.log('🎉 SMOKE TEST PASSED - Ready for full pilot run');
      
      // Save smoke test results
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'smoke_test_results.json'),
        JSON.stringify(pilotRun, null, 2)
      );
      
      process.exit(0);
    } else {
      console.log('❌ SMOKE TEST FAILED - Contract violations detected');
      console.log('');
      console.log('📝 Debug artifacts saved to:', OUTPUT_DIR);
      
      // Save full run for debugging
      fs.writeFileSync(
        path.join(OUTPUT_DIR, 'smoke_test_failed.json'),
        JSON.stringify(pilotRun, null, 2)
      );
      
      process.exit(1);
    }
  } catch (err) {
    console.error('\n❌ SMOKE TEST CRASHED');
    console.error('Error:', (err as Error).message);
    console.error('Stack:', (err as Error).stack);
    
    // Save error for debugging
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'smoke_test_error.json'),
      JSON.stringify({
        error: (err as Error).message,
        stack: (err as Error).stack,
        timestamp: new Date().toISOString(),
      }, null, 2)
    );
    
    process.exit(1);
  }
}

runSmokeTest();
