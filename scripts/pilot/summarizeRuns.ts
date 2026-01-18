/**
 * Pilot Run Summarizer
 * 
 * Reads pilot run JSON files and computes P50/P90 weather bands.
 * Usage: pnpm tsx scripts/pilot/summarizeRuns.ts <folder_path>
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

interface PilotRun {
  runId: string;
  lane: string;
  rep: number;
  status: 'VALID' | 'RETRIED' | 'FAILED';
  attempts?: number;
  meta?: {
    usage?: {
      totals?: {
        costUsd?: number;
        latencyMs?: number;
      };
      selector?: {
        inputTokens?: number;
        outputTokens?: number;
      };
    };
    selection?: {
      systems?: { fallbackUsed?: boolean };
      brand?: { fallbackUsed?: boolean };
    };
  };
}

function percentile(arr: number[], p: number): number {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.floor(sorted.length * p);
  return sorted[index];
}

function main() {
  const folderPath = process.argv[2];
  if (!folderPath) {
    console.error('Usage: pnpm tsx scripts/pilot/summarizeRuns.ts <folder_path>');
    process.exit(1);
  }

  const files = readdirSync(folderPath).filter(f => f.endsWith('.json'));
  console.log(`\n📊 Found ${files.length} run files in ${folderPath}\n`);

  const runs: PilotRun[] = files.map(f => 
    JSON.parse(readFileSync(join(folderPath, f), 'utf8'))
  );

  // Reliability
  const valid = runs.filter(r => r.status === 'VALID').length;
  const retried = runs.filter(r => r.status === 'RETRIED').length;
  const failed = runs.filter(r => r.status === 'FAILED').length;

  // Costs & Latency
  const costs = runs.map(r => r.meta?.usage?.totals?.costUsd || 0);
  const latencies = runs.map(r => (r.meta?.usage?.totals?.latencyMs || 0) / 1000);

  // Fallback rate
  const fallbackCount = runs.filter(r => 
    r.meta?.selection?.systems?.fallbackUsed || r.meta?.selection?.brand?.fallbackUsed
  ).length;

  // By lane
  const webRuns = runs.filter(r => r.lane === 'web');
  const marketingRuns = runs.filter(r => r.lane === 'marketing');

  console.log('=== RELIABILITY ===');
  console.log(`  VALID:   ${valid}/${runs.length} (${(valid/runs.length*100).toFixed(1)}%)`);
  console.log(`  RETRIED: ${retried}/${runs.length} (${(retried/runs.length*100).toFixed(1)}%)`);
  console.log(`  FAILED:  ${failed}/${runs.length} (${(failed/runs.length*100).toFixed(1)}%)`);
  console.log(`  Fallback: ${fallbackCount}/${runs.length} (${(fallbackCount/runs.length*100).toFixed(1)}%)`);
  console.log('');

  console.log('=== COST ===');
  console.log(`  P50: $${percentile(costs, 0.5).toFixed(4)}`);
  console.log(`  P90: $${percentile(costs, 0.9).toFixed(4)}`);
  console.log(`  Avg: $${(costs.reduce((a,b)=>a+b,0)/costs.length).toFixed(4)}`);
  console.log(`  Min: $${Math.min(...costs).toFixed(4)}`);
  console.log(`  Max: $${Math.max(...costs).toFixed(4)}`);
  console.log('');

  console.log('=== LATENCY ===');
  console.log(`  P50: ${percentile(latencies, 0.5).toFixed(1)}s`);
  console.log(`  P90: ${percentile(latencies, 0.9).toFixed(1)}s`);
  console.log(`  Avg: ${(latencies.reduce((a,b)=>a+b,0)/latencies.length).toFixed(1)}s`);
  console.log(`  Min: ${Math.min(...latencies).toFixed(1)}s`);
  console.log(`  Max: ${Math.max(...latencies).toFixed(1)}s`);
  console.log('');

  console.log('=== BY LANE ===');
  console.log(`  Web:       ${webRuns.filter(r=>r.status==='VALID').length}/${webRuns.length} VALID`);
  console.log(`  Marketing: ${marketingRuns.filter(r=>r.status==='VALID').length}/${marketingRuns.length} VALID`);
  console.log('');

  // Failure tail
  const failedRuns = runs.filter(r => r.status === 'FAILED');
  if (failedRuns.length > 0) {
    console.log('=== FAILURE TAIL ===');
    failedRuns.forEach(r => {
      console.log(`  ${r.runId} (${r.lane} rep ${r.rep})`);
    });
    console.log('');
  }

  // Production gates
  const validPct = (valid / runs.length) * 100;
  const fallbackPct = (fallbackCount / runs.length) * 100;
  const costP90 = percentile(costs, 0.9);
  const latencyP90 = percentile(latencies, 0.9);

  console.log('=== PRODUCTION GATES ===');
  console.log(`  Valid% ≥ 95%:        ${validPct >= 95 ? '✅' : '❌'} (${validPct.toFixed(1)}%)`);
  console.log(`  Fallback% ≤ 10%:     ${fallbackPct <= 10 ? '✅' : '❌'} (${fallbackPct.toFixed(1)}%)`);
  console.log(`  Cost P90 ≤ $0.30:    ${costP90 <= 0.30 ? '✅' : '❌'} ($${costP90.toFixed(4)})`);
  console.log(`  Latency P90 ≤ 95s:   ${latencyP90 <= 95 ? '✅' : '❌'} (${latencyP90.toFixed(1)}s)`);
  console.log('');

  const allPassed = validPct >= 95 && fallbackPct <= 10 && costP90 <= 0.30 && latencyP90 <= 95;
  console.log(allPassed ? '✅ ALL GATES PASSED - READY FOR PRODUCTION' : '⚠️  SOME GATES FAILED - REVIEW REQUIRED');
  console.log('');
}

main();
