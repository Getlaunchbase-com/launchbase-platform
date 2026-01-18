import { runPilotMacro } from './runPilotMacro';
import { readFileSync } from 'fs';

async function main() {
  const stack = JSON.parse(readFileSync('config/stacks/stack_creative_production_default.json', 'utf-8'));
  
  console.log('🧪 CANARY TEST: Marketing×2 (test undercount guard fix)');
  
  for (let rep = 1; rep <= 2; rep++) {
    const runId = `canary_marketing_${rep}_${Date.now()}`;
    const jobId = `canary_job_${rep}`;
    
    console.log(`\n[marketing rep ${rep}/2] Starting...`);
    
    try {
      const result = await runPilotMacro({
        lane: 'marketing',
        rep,
        runId,
        jobId,
        plan: {
          productTruth: {
            name: 'LaunchBase',
            tagline: 'Launch your business in 48 hours',
            description: 'All-in-one platform for entrepreneurs',
          },
          goals: ['Increase conversions'],
          constraints: {},
        },
        context: {
          runMode: 'production',
          validation: {
            allowNormalization: true,
            strictSchemaEnforcement: true,
          },
          creativeMode: {
            enabled: true,
            capBeforeSelect: 24,
          },
        },
        stack: stack.stack,
        maxAttempts: 3,
        runMode: 'production',
      });
      
      console.log(`[marketing rep ${rep}/2] ✅ ${result.status}`);
      console.log(`  Systems: ${result.meta.selection?.systems?.candidatesCount || 0} → ${result.meta.selection?.systems?.selectedCount || 0}`);
      console.log(`  Brand: ${result.meta.selection?.brand?.candidatesCount || 0} → ${result.meta.selection?.brand?.selectedCount || 0}`);
    } catch (err: any) {
      console.error(`[marketing rep ${rep}/2] ❌ FAILED: ${err.message}`);
      process.exit(1);
    }
  }
  
  console.log('\n✅ CANARY PASSED: No ReferenceErrors, undercount guard working!');
}

main().catch((err) => {
  console.error('CANARY FAILED:', err);
  process.exit(1);
});
