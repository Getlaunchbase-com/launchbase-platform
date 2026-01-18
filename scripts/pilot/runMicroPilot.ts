/**
 * Micro-Pilot Runner: Web×3 + Marketing×3 (Production Mode)
 * 
 * Validates Creative Production pipeline stability across lanes.
 * Records: status, attempts, selector fallback, tokens, cost, latency
 */

import { runPilotMacro } from './runPilotMacro';
import type { Lane, PilotRun } from './types';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MicroPilotResult {
  lane: Lane;
  rep: number;
  status: string;
  attempts: number;
  selectorFallback: boolean;
  selectorTokensIn: number;
  selectorTokensOut: number;
  selectorCost: number;
  totalTokensIn: number;
  totalTokensOut: number;
  totalCost: number;
  latency: number;
  systemsCandidates: number;
  systemsSelected: number;
  brandCandidates: number;
  brandSelected: number;
}

async function main() {
  const stackPath = process.argv[2] || 'config/stacks/stack_creative_gpt52_llama8b_sonnet40.json';
  
  // Note: Each run takes ~110-125s, so 6 runs = ~12-15 minutes
  // Timeout is handled by shell wrapper (900s = 15 min)
  const stack = JSON.parse(readFileSync(stackPath, 'utf-8'));
  
  console.log('🚀 MICRO-PILOT: Web×3 + Marketing×3 (Production Mode)');
  console.log('Expected duration: ~12-15 minutes for 6 runs');
  console.log(`Stack: ${stack.stackName}`);
  console.log('');
  
  const lanes: Lane[] = ['web', 'marketing'];
  const reps = 3;
  const results: MicroPilotResult[] = [];
  
  for (const lane of lanes) {
    console.log(`\n📋 Running ${lane.toUpperCase()} × ${reps}`);
    console.log('─'.repeat(60));
    
    for (let rep = 1; rep <= reps; rep++) {
      const runId = `micropilot_${lane}_${rep}_${Date.now()}`;
      const jobId = `job_${lane}_${rep}_${Date.now()}`;
      
      console.log(`\n[${lane} rep ${rep}/${reps}] Starting...`);
      const startTime = Date.now();
      
      try {
        const result = await runPilotMacro({
          lane,
          rep,
          runId,
          jobId,
          plan: {
            productTruth: {
              name: 'LaunchBase',
              tagline: 'Launch your business in 48 hours',
              description: 'All-in-one platform for entrepreneurs',
            },
            goals: ['Increase conversions', 'Improve clarity'],
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
        
        const latency = (Date.now() - startTime) / 1000;
        
        // Extract metrics
        const selectorMeta = result.meta?.usage?.selector || {};
        const totalMeta = result.meta?.usage?.totals || {};
        const selectionTracking = result.meta?.selection || {};
        
        const microResult: MicroPilotResult = {
          lane,
          rep,
          status: result.status,
          attempts: result.meta?.attempts || 1,
          selectorFallback: result.meta?.selection?.systems?.selectorModel?.includes('Qwen') || 
                           result.meta?.selection?.brand?.selectorModel?.includes('Qwen') || false,
          selectorTokensIn: selectorMeta.inputTokens || 0,
          selectorTokensOut: selectorMeta.outputTokens || 0,
          selectorCost: selectorMeta.costUsd || 0,
          totalTokensIn: totalMeta.inputTokens || 0,
          totalTokensOut: totalMeta.outputTokens || 0,
          totalCost: totalMeta.costUsd || 0,
          latency,
          systemsCandidates: selectionTracking.systems?.candidatesCount || 0,
          systemsSelected: selectionTracking.systems?.selectedCount || 0,
          brandCandidates: selectionTracking.brand?.candidatesCount || 0,
          brandSelected: selectionTracking.brand?.selectedCount || 0,
        };
        
        results.push(microResult);
        
        console.log(`[${lane} rep ${rep}/${reps}] ✅ ${result.status}`);
        console.log(`  Systems: ${microResult.systemsCandidates} → ${microResult.systemsSelected}`);
        console.log(`  Brand: ${microResult.brandCandidates} → ${microResult.brandSelected}`);
        console.log(`  Selector: $${microResult.selectorCost.toFixed(4)} (${microResult.selectorTokensIn} in, ${microResult.selectorTokensOut} out)`);
        console.log(`  Total: $${microResult.totalCost.toFixed(4)} | ${latency.toFixed(1)}s`);
        console.log(`  Fallback: ${microResult.selectorFallback ? 'YES (Qwen)' : 'NO (Llama)'}`);
        
      } catch (err: any) {
        console.error(`[${lane} rep ${rep}/${reps}] ❌ FAILED: ${err.message}`);
        results.push({
          lane,
          rep,
          status: 'FAILED',
          attempts: 3,
          selectorFallback: false,
          selectorTokensIn: 0,
          selectorTokensOut: 0,
          selectorCost: 0,
          totalTokensIn: 0,
          totalTokensOut: 0,
          totalCost: 0,
          latency: (Date.now() - startTime) / 1000,
          systemsCandidates: 0,
          systemsSelected: 0,
          brandCandidates: 0,
          brandSelected: 0,
        });
      }
    }
  }
  
  // Summary
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 MICRO-PILOT RESULTS SUMMARY');
  console.log('='.repeat(80));
  
  const validCount = results.filter(r => r.status === 'VALID').length;
  const retriedCount = results.filter(r => r.status === 'RETRIED').length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;
  const fallbackCount = results.filter(r => r.selectorFallback).length;
  
  console.log(`\n✅ Valid: ${validCount}/${results.length} (${(validCount/results.length*100).toFixed(1)}%)`);
  console.log(`🔄 Retried: ${retriedCount}/${results.length}`);
  console.log(`❌ Failed: ${failedCount}/${results.length}`);
  console.log(`🔀 Selector Fallback: ${fallbackCount}/${results.length} (${(fallbackCount/results.length*100).toFixed(1)}%)`);
  
  // Cost/latency averages
  const validResults = results.filter(r => r.status === 'VALID' || r.status === 'RETRIED');
  if (validResults.length > 0) {
    const avgSelectorCost = validResults.reduce((sum, r) => sum + r.selectorCost, 0) / validResults.length;
    const avgTotalCost = validResults.reduce((sum, r) => sum + r.totalCost, 0) / validResults.length;
    const avgLatency = validResults.reduce((sum, r) => sum + r.latency, 0) / validResults.length;
    const avgSelectorIn = validResults.reduce((sum, r) => sum + r.selectorTokensIn, 0) / validResults.length;
    const avgSelectorOut = validResults.reduce((sum, r) => sum + r.selectorTokensOut, 0) / validResults.length;
    
    console.log(`\n💰 Average Selector Cost: $${avgSelectorCost.toFixed(4)}`);
    console.log(`💰 Average Total Cost: $${avgTotalCost.toFixed(4)}`);
    console.log(`⏱️  Average Latency: ${avgLatency.toFixed(1)}s`);
    console.log(`📊 Average Selector Tokens: ${avgSelectorIn.toFixed(0)} in / ${avgSelectorOut.toFixed(0)} out`);
  }
  
  // Detailed table
  console.log('\n\n📋 DETAILED RESULTS TABLE');
  console.log('─'.repeat(120));
  console.log('Lane       | Rep | Status  | Attempts | Fallback | Selector $  | Total $    | Latency | Sys C→S | Brand C→S');
  console.log('─'.repeat(120));
  
  for (const r of results) {
    const fallback = r.selectorFallback ? 'YES' : 'NO ';
    console.log(
      `${r.lane.padEnd(10)} | ${r.rep}   | ${r.status.padEnd(7)} | ${r.attempts}        | ${fallback}      | $${r.selectorCost.toFixed(4).padStart(7)} | $${r.totalCost.toFixed(4).padStart(7)} | ${r.latency.toFixed(1).padStart(6)}s | ${r.systemsCandidates}→${r.systemsSelected}     | ${r.brandCandidates}→${r.brandSelected}`
    );
  }
  console.log('─'.repeat(120));
  
  // Pass condition check
  console.log('\n\n🎯 PASS CONDITIONS');
  const validPct = validCount / results.length * 100;
  const fallbackPct = fallbackCount / results.length * 100;
  
  console.log(`✅ Valid% ≥ 95%: ${validPct.toFixed(1)}% ${validPct >= 95 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`✅ Fallback rate < 10%: ${fallbackPct.toFixed(1)}% ${fallbackPct < 10 ? '✅ PASS' : '⚠️  WARNING'}`);
  
  const allCorrectCounts = validResults.every(r => 
    r.systemsSelected === 8 && r.brandSelected === 8
  );
  console.log(`✅ All runs: 8/8 selected: ${allCorrectCounts ? '✅ PASS' : '❌ FAIL'}`);
  
  if (validPct >= 95 && allCorrectCounts) {
    console.log('\n🎉 MICRO-PILOT PASSED! Ready for production.');
  } else {
    console.log('\n⚠️  MICRO-PILOT NEEDS ATTENTION');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
