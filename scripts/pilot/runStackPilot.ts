/**
 * Stack Pilot Runner: Compare model stacks on identical inputs
 * 
 * Runs multiple stacks (B1: GPT-5.2 builders + Sonnet critic, B2: all GPT-5.2)
 * on the same lane with tournament mode to measure raw stability.
 * 
 * Metrics: Valid%, P50/P90 count, Dump% (>=15), AvgAttempts, Cost, Drift
 * 
 * Usage: pnpm tsx scripts/pilot/runStackPilot.ts web 3
 */

import fs from "node:fs";
import path from "node:path";

import { runPilotMacro, type PilotRun } from "./runPilotMacro";

type Lane = "web" | "marketing";
type RunMode = "tournament" | "production";

type StackConfig = {
  name: string;
  description: string;
  stack: any;
};

type RunRecord = {
  stackId: string;
  lane: Lane;
  rep: number;
  runId: string;
  status: "VALID" | "FAILED" | "RETRIED";
  attempts: number;
  models: any;
  stopReasons: any;
  usage: any;
  normalization: any;
  counts: {
    systemsCount: number;
    brandCount: number;
    criticIssues: number;
  };
  drift: {
    systems: boolean;
    brand: boolean;
    critic: boolean;
  };
};

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function mean(nums: number[]): number {
  const xs = nums.filter(n => Number.isFinite(n));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const w = idx - lo;
  return sorted[lo] * (1 - w) + sorted[hi] * w;
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return n / d;
}

function getPreNormCount(run: PilotRun, role: "systems" | "brand"): number {
  // Prefer normalization event 'from' when truncation applied; else actual payload length.
  const ev = run?.meta?.normalization?.events?.[role];
  if (ev?.kind === "truncate" && ev.applied && Number.isFinite(ev.from)) return ev.from;

  const changes = run?.[role]?.changes;
  if (Array.isArray(changes)) return changes.length;

  return 0;
}

function detectDrift(run: PilotRun, requested: any) {
  const resolved = run?.meta?.models ?? {};
  return {
    systems: !!(requested?.designer_systems_fast?.modelId && resolved.systems && resolved.systems !== requested.designer_systems_fast.modelId),
    brand:   !!(requested?.designer_brand_fast?.modelId && resolved.brand && resolved.brand !== requested.designer_brand_fast.modelId),
    critic:  !!(requested?.design_critic_ruthless?.modelId && resolved.critic && resolved.critic !== requested.design_critic_ruthless.modelId),
  };
}

function summarize(records: RunRecord[]) {
  const byStack = new Map<string, RunRecord[]>();
  for (const r of records) {
    const k = r.stackId;
    byStack.set(k, [...(byStack.get(k) ?? []), r]);
  }

  const rows = [];
  for (const [stackId, rs] of byStack.entries()) {
    const n = rs.length;

    const valid = rs.filter(r => r.status === "VALID" || r.status === "RETRIED").length;
    const avgAtt = mean(rs.map(r => r.attempts || 1));

    const sysLens = rs.map(r => r.counts.systemsCount).filter(Boolean).sort((a,b)=>a-b);
    const dumpSys = rs.filter(r => r.counts.systemsCount >= 15).length;

    rows.push({
      stack: stackId,
      n,
      validRate: pct(valid, n),
      avgAttempts: avgAtt,
      systemsP50: quantile(sysLens, 0.5),
      systemsP90: quantile(sysLens, 0.9),
      systemsDumpRate: pct(dumpSys, n),
      driftRuns: rs.filter(r => r.drift.systems || r.drift.brand || r.drift.critic).length,
      avgCostUsd: mean(rs.map(r => Number(r.usage?.totals?.costUsd ?? 0))),
      avgTokOut: mean(rs.map(r => Number(r.usage?.totals?.outputTokens ?? 0))),
    });
  }

  rows.sort((a, b) =>
    (b.validRate - a.validRate) ||
    (a.systemsDumpRate - b.systemsDumpRate) ||
    (a.avgCostUsd - b.avgCostUsd)
  );

  return rows;
}

async function runStack(configPath: string, lane: Lane, reps: number, runMode: RunMode) {
  const cfg = readJson<StackConfig>(configPath);
  const stackId = path.basename(configPath, ".json");
  const outDir = path.join("runs", "stack_pilots", stackId, lane, new Date().toISOString().replace(/[:.]/g, "-"));
  fs.mkdirSync(outDir, { recursive: true });

  const records: RunRecord[] = [];

  // Shared plan for all runs (identical input)
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

  for (let rep = 1; rep <= reps; rep++) {
    const runId = `${stackId}_${lane}_rep${rep}_${Date.now()}`;
    const jobId = `stack_pilot_${stackId}_${lane}`;

    console.log(`\n[RUN START] ${cfg.name} | ${lane} | rep ${rep}/${reps}`);

    const run = await runPilotMacro({
      lane,
      rep,
      runId,
      jobId,
      plan: SAMPLE_PLAN,
      context: SAMPLE_CONTEXT,
      stack: cfg.stack,
      maxAttempts: 3,
      runMode
    });

    const drift = detectDrift(run, cfg.stack);

    // HARD FAIL ON DRIFT (tournament mode)
    if (runMode === "tournament" && (drift.systems || drift.brand || drift.critic)) {
      console.warn(`⚠️  [DRIFT DETECTED] ${runId}`, drift, run?.meta?.models);
    }

    const rec: RunRecord = {
      stackId,
      lane,
      rep,
      runId,
      status: run.status,
      attempts: run.meta.attempts,
      models: run.meta?.models,
      stopReasons: run.meta?.stopReasons,
      usage: run.meta?.usage,
      normalization: run.meta?.normalization,
      counts: {
        systemsCount: getPreNormCount(run, "systems"),
        brandCount: getPreNormCount(run, "brand"),
        criticIssues: Array.isArray(run?.critic?.issues) ? run.critic.issues.length : 0,
      },
      drift,
    };

    fs.writeFileSync(path.join(outDir, `${runId}.json`), JSON.stringify(run, null, 2));
    fs.writeFileSync(path.join(outDir, `${runId}.summary.json`), JSON.stringify(rec, null, 2));
    records.push(rec);

    console.log(`[RUN DONE] status=${run.status} attempts=${rec.attempts} sysCount=${rec.counts.systemsCount} brandCount=${rec.counts.brandCount} cost=$${run.meta.usage.totals.costUsd.toFixed(3)}`);
  }

  fs.writeFileSync(path.join(outDir, `records.json`), JSON.stringify(records, null, 2));

  return { cfg, outDir, records, stackId };
}

async function main() {
  const args = process.argv.slice(2);
  const lane = (args[0] as Lane) ?? "web";
  const reps = Number(args[1] ?? 3);
  const runMode = (args[2] as RunMode) ?? "tournament";

  console.log(`\n${'='.repeat(80)}`);
  console.log(`STACK PILOT: ${lane.toUpperCase()} × ${reps} reps (${runMode} mode)`);
  console.log(`${'='.repeat(80)}\n`);

  const stacks = [
    "config/stacks/stack_b1_gpt52_builders_sonnet45_critic.json",
    "config/stacks/stack_b2_all_gpt52.json"
  ];

  const all: RunRecord[] = [];
  for (const sp of stacks) {
    const { records, outDir, cfg, stackId } = await runStack(sp, lane, reps, runMode);
    console.log(`\n✅ [STACK COMPLETE] ${cfg.name}`);
    console.log(`   Output: ${outDir}\n`);
    all.push(...records);
  }

  const rows = summarize(all);

  console.log(`\n${'='.repeat(80)}`);
  console.log(`STABILITY SUMMARY`);
  console.log(`${'='.repeat(80)}\n`);

  console.table(rows.map(r => ({
    Stack: r.stack,
    N: r.n,
    Valid: `${Math.round(r.validRate * 100)}%`,
    P50: Math.round(r.systemsP50),
    P90: Math.round(r.systemsP90),
    Dump: `${Math.round(r.systemsDumpRate * 100)}%`,
    AvgAtt: r.avgAttempts.toFixed(2),
    Cost: `$${r.avgCostUsd.toFixed(3)}`,
    TokOut: Math.round(r.avgTokOut),
    DriftRuns: r.driftRuns,
  })));

  console.log(`\nLegend:`);
  console.log(`  P50/P90 = proposedChanges count distribution (pre-normalization)`);
  console.log(`  Dump% = rate(count>=15) - "idea dumping" failure mode`);
  console.log(`  DriftRuns = runs where resolved model != requested model`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
