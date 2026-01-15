// scripts/probe/runProbe.ts
//
// Usage:
//   pnpm tsx scripts/probe/runProbe.ts path/to/probe_config.json
//
// What it does:
// 1) Loads probe config JSON
// 2) Loops models × reps
// 3) Calls runPilotMacro in tournament mode (no normalization) and evaluates *target role* obedience
// 4) Writes per-run probe JSON + aggregated summary JSON
// 5) Prints an ASCII "Model Weather" table

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { runPilotMacro } from "../pilot/runPilotMacro";
import type { Lane, PilotRun, PilotStack, RunMode } from "../pilot/types";
import { renderWeatherTable } from "./renderWeatherTable";

type ProbeMode = "tournament" | "production";

type ProbeModelSpec = {
  modelId: string;
  provider: string;
  timeoutMs?: number;
  maxTokens?: number;
  temperature?: number;
};

type ProbeConfig = {
  probeId: string;
  mode: ProbeMode;
  lane: Lane | string;
  role: "designer_systems_fast" | "designer_brand_fast";
  repsPerModel: number;
  models: ProbeModelSpec[];
  workOrder: any;

  // Optional additions
  controlStack?: PilotStack;
  maxAttempts?: number;
  outputDir?: string;
};

type StopReason =
  | "ok"
  | "schema_failed"
  | "invalid_json"
  | "timeout"
  | "provider_failed"
  | "content_noncompliance"
  | "unknown"
  | string;

type ProbeRunJson = {
  probeId: string;
  timestamp: string;
  lane: string;
  role: string;
  model: string;
  rep: number;

  status: "VALID" | "FAILED" | "RETRIED";
  attempts: number;
  stopReason: StopReason;

  counts: {
    proposedChanges: number;
    anchorCount: number;
  };

  obedience: {
    exact8: boolean;
    schemaValid: boolean; // stage-level validity for the probed role (not full macro)
    normalized: boolean;  // should be false in tournament probes
  };

  usage: {
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    costUsd: number;
  };

  meta: {
    models?: any;
    stopReasons?: any;
    normalization?: any;
    usage?: any;
  };

  paths?: {
    rawArtifact?: string;
    parsedPayload?: string;
    runJson?: string;
  };
};

type ProbeSummaryRow = {
  model: string;
  n: number;

  // role-stage metrics (preferred for obedience)
  exact8Rate: number;       // proposedChanges == 8
  schemaValidRate: number;  // stopReason == ok for that role stage
  validRate: number;        // alias of schemaValidRate for probes

  avgAttempts: number;
  stopReasonCounts: Record<string, number>;

  tokens: { inputAvg: number; outputAvg: number };
  latencyMsAvg: number;
  costUsdAvg: number;
};

type ProbeSummaryJson = {
  generatedAt: string;
  scope: {
    lane: string;
    role: string;
    repsPerModel: number;
    mode: ProbeMode;
  };
  results: ProbeSummaryRow[];
};

function slugifyModelId(modelId: string): string {
  return modelId.replaceAll("/", "_").replaceAll(":", "_");
}

async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

async function loadJson<T>(p: string): Promise<T> {
  const raw = await fs.readFile(p, "utf8");
  return JSON.parse(raw) as T;
}

// Extract proposedChanges count in a tolerant way
function getProposedChangesCount(run: any, which: "systems" | "brand"): number {
  const node = run?.[which];
  if (!node) return 0;

  if (Array.isArray(node.changes)) return node.changes.length;
  if (Array.isArray(node.proposedChanges)) return node.proposedChanges.length;
  if (Array.isArray(node?.payload?.proposedChanges)) return node.payload.proposedChanges.length;
  if (Array.isArray(node?.artifact?.payload?.proposedChanges)) return node.artifact.payload.proposedChanges.length;

  return 0;
}

function getAnchorCount(run: any, which: "systems" | "brand"): number {
  const node = run?.[which];
  const v = node?.anchorCount;
  return typeof v === "number" ? v : 0;
}

function getRoleStopReason(run: any, which: "systems" | "brand" | "critic"): StopReason {
  return run?.meta?.stopReasons?.[which] ?? "unknown";
}

function getRoleUsage(run: any, which: "systems" | "brand" | "critic") {
  const u = run?.meta?.usage?.[which];
  return {
    inputTokens: typeof u?.inputTokens === "number" ? u.inputTokens : 0,
    outputTokens: typeof u?.outputTokens === "number" ? u.outputTokens : 0,
    latencyMs: typeof u?.latencyMs === "number" ? u.latencyMs : 0,
    costUsd: typeof u?.costUsd === "number" ? u.costUsd : 0,
  };
}

function sumUsage(us: Array<{ inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number }>) {
  return us.reduce(
    (acc, u) => {
      acc.inputTokens += u.inputTokens;
      acc.outputTokens += u.outputTokens;
      acc.latencyMs += u.latencyMs;
      acc.costUsd += u.costUsd;
      return acc;
    },
    { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 }
  );
}

// Build a PilotStack for this probe run
function buildStackForProbe(params: {
  targetRole: "designer_systems_fast" | "designer_brand_fast";
  model: ProbeModelSpec;
  controlStack?: PilotStack;
}): PilotStack {
  const { targetRole, model, controlStack } = params;

  const mk = (m: ProbeModelSpec, role: string) => ({
    modelId: m.modelId,
    provider: m.provider,
    role,
    maxTokens: m.maxTokens ?? (role === "critic" ? 4000 : 2000),
    temperature: m.temperature ?? 0.7,
    timeoutMs: m.timeoutMs,
  });

  const base: any = controlStack
    ? JSON.parse(JSON.stringify(controlStack))
    : {
        designer_systems_fast: mk(model, "systems"),
        designer_brand_fast: mk(model, "brand"),
        design_critic_ruthless: mk({ ...model, maxTokens: 4000 }, "critic"),
      };

  // Override the targeted craft role with the model under test
  if (targetRole === "designer_systems_fast") {
    base.designer_systems_fast = mk(model, "systems");
  } else {
    base.designer_brand_fast = mk(model, "brand");
  }

  // Ensure critic exists in the stack
  if (!base.design_critic_ruthless) {
    base.design_critic_ruthless = mk({ ...model, maxTokens: 4000 }, "critic");
  }

  return base as PilotStack;
}

function nowIso() {
  return new Date().toISOString();
}

async function writeJson(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function rate(count: number, n: number): number {
  return n === 0 ? 0 : count / n;
}

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    console.error("Usage: pnpm tsx scripts/probe/runProbe.ts path/to/probe_config.json");
    process.exit(1);
  }

  const cfg = await loadJson<ProbeConfig>(configPath);

  const outputDir = cfg.outputDir ?? "runs/probes";
  const probeRoot = path.join(outputDir, cfg.probeId);
  await ensureDir(probeRoot);

  const mode: RunMode = (cfg.mode as RunMode) ?? "tournament";
  const maxAttempts = cfg.maxAttempts ?? 3;

  const targetRoleKey = cfg.role === "designer_systems_fast" ? "systems" : "brand";

  const perRun: ProbeRunJson[] = [];

  for (const model of cfg.models) {
    const modelSlug = slugifyModelId(model.modelId);

    for (let rep = 1; rep <= cfg.repsPerModel; rep++) {
      const runId = `probe_${cfg.probeId}_${cfg.lane}_${cfg.role}_${modelSlug}_rep${rep}_${Date.now()}`;
      const jobId = `job_${cfg.probeId}_${Date.now()}`;

      const stack = buildStackForProbe({
        targetRole: cfg.role,
        model,
        controlStack: cfg.controlStack,
      });

      const plan = cfg.workOrder;
      const context = {
        ...(cfg.workOrder?.inputs ?? {}),
        validation: {
          runMode: mode,
          allowNormalization: mode === "production",
        },
        probe: {
          enabled: true,
          probeId: cfg.probeId,
          targetRole: cfg.role,
        },
      };

      let run: PilotRun;
      try {
        run = await runPilotMacro({
          lane: cfg.lane as Lane,
          rep,
          runId,
          jobId,
          plan,
          context,
          stack,
          maxAttempts,
          runMode: mode,
        });
      } catch (err: any) {
        // Hard failure calling macro – still record a probe run row
        const pr: ProbeRunJson = {
          probeId: cfg.probeId,
          timestamp: nowIso(),
          lane: String(cfg.lane),
          role: cfg.role,
          model: model.modelId,
          rep,
          status: "FAILED",
          attempts: 1,
          stopReason: "provider_failed",
          counts: { proposedChanges: 0, anchorCount: 0 },
          obedience: { exact8: false, schemaValid: false, normalized: false },
          usage: { inputTokens: 0, outputTokens: 0, latencyMs: 0, costUsd: 0 },
          meta: {},
        };
        perRun.push(pr);
        const outPath = path.join(probeRoot, modelSlug, `rep${rep}`, "probe_run.json");
        await writeJson(outPath, pr);
        continue;
      }

      const proposedChanges = getProposedChangesCount(run as any, targetRoleKey);
      const anchorCount = getAnchorCount(run as any, targetRoleKey);
      const stopReason = getRoleStopReason(run as any, targetRoleKey);

      const exact8 = proposedChanges === 8;
      const stageSchemaValid = stopReason === "ok";
      const normalized = Boolean(run?.meta?.normalization?.applied);

      const stageUsage = getRoleUsage(run as any, targetRoleKey);
      const totalUsage =
        run?.meta?.usage?.totals
          ? {
              inputTokens: run.meta.usage.totals.inputTokens,
              outputTokens: run.meta.usage.totals.outputTokens,
              latencyMs: run.meta.usage.totals.latencyMs,
              costUsd: run.meta.usage.totals.costUsd,
            }
          : sumUsage([
              getRoleUsage(run as any, "systems"),
              getRoleUsage(run as any, "brand"),
              getRoleUsage(run as any, "critic"),
            ]);

      const pr: ProbeRunJson = {
        probeId: cfg.probeId,
        timestamp: nowIso(),
        lane: String(cfg.lane),
        role: cfg.role,
        model: model.modelId,
        rep,

        status: run.status,
        attempts: run.attempts,
        stopReason,

        counts: { proposedChanges, anchorCount },

        obedience: {
          exact8,
          schemaValid: stageSchemaValid,
          normalized,
        },

        usage: {
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          latencyMs: totalUsage.latencyMs,
          costUsd: totalUsage.costUsd,
        },

        meta: {
          models: run?.meta?.models,
          stopReasons: run?.meta?.stopReasons,
          normalization: run?.meta?.normalization,
          usage: run?.meta?.usage,
        },
      };

      perRun.push(pr);

      const outPath = path.join(probeRoot, modelSlug, `rep${rep}`, "probe_run.json");
      await writeJson(outPath, pr);
    }
  }

  // Aggregate by model
  const byModel = new Map<string, ProbeRunJson[]>();
  for (const r of perRun) {
    const arr = byModel.get(r.model) ?? [];
    arr.push(r);
    byModel.set(r.model, arr);
  }

  const results: ProbeSummaryRow[] = [];

  for (const [modelId, runs] of byModel.entries()) {
    const n = runs.length;

    const exact8Count = runs.filter((r) => r.obedience.exact8).length;
    const schemaValidCount = runs.filter((r) => r.obedience.schemaValid).length;

    const attemptsAvg = mean(runs.map((r) => r.attempts));

    const stopReasonCounts: Record<string, number> = {};
    for (const r of runs) {
      stopReasonCounts[r.stopReason] = (stopReasonCounts[r.stopReason] ?? 0) + 1;
    }

    const tokensInAvg = mean(runs.map((r) => r.usage.inputTokens));
    const tokensOutAvg = mean(runs.map((r) => r.usage.outputTokens));
    const latencyAvg = mean(runs.map((r) => r.usage.latencyMs));
    const costAvg = mean(runs.map((r) => r.usage.costUsd));

    const schemaFailRate = rate(stopReasonCounts["schema_failed"] ?? 0, n);
    const timeoutRate = rate(stopReasonCounts["timeout"] ?? 0, n);

    results.push({
      model: modelId,
      n,
      exact8Rate: rate(exact8Count, n),
      schemaValidRate: rate(schemaValidCount, n),
      validRate: rate(schemaValidCount, n),
      avgAttempts: attemptsAvg,
      stopReasonCounts,
      tokens: { inputAvg: tokensInAvg, outputAvg: tokensOutAvg },
      latencyMsAvg: latencyAvg,
      costUsdAvg: costAvg,
    });

    // Also write a per-model summary file
    await writeJson(path.join(probeRoot, slugifyModelId(modelId), "probe_model_summary.json"), {
      model: modelId,
      n,
      exact8Rate: rate(exact8Count, n),
      schemaValidRate: rate(schemaValidCount, n),
      avgAttempts: attemptsAvg,
      stopReasonCounts,
      tokens: { inputAvg: tokensInAvg, outputAvg: tokensOutAvg },
      latencyMsAvg: latencyAvg,
      costUsdAvg: costAvg,
      schemaFailRate,
      timeoutRate,
    });
  }

  const summary: ProbeSummaryJson = {
    generatedAt: nowIso(),
    scope: {
      lane: String(cfg.lane),
      role: cfg.role,
      repsPerModel: cfg.repsPerModel,
      mode: cfg.mode,
    },
    results,
  };

  const summaryPath = path.join(probeRoot, "probe_summary.json");
  await writeJson(summaryPath, summary);

  // Render CLI weather table
  const rowsForTable = results.map((r) => ({
    model: r.model,
    n: r.n,
    validRate: r.validRate,
    exact8Rate: r.exact8Rate,
    avgAttempts: r.avgAttempts,
    schemaFailRate: rate(r.stopReasonCounts["schema_failed"] ?? 0, r.n),
    timeoutRate: rate(r.stopReasonCounts["timeout"] ?? 0, r.n),
    costUsdAvg: r.costUsdAvg,
    outputTokensAvg: r.tokens.outputAvg,
  }));

  const table = renderWeatherTable({
    lane: String(cfg.lane),
    role: cfg.role,
    repsPerModel: cfg.repsPerModel,
    mode: cfg.mode,
    rows: rowsForTable,
  });

  console.log(table);
  console.log(`\nWrote probe summary: ${summaryPath}`);
  console.log(`Wrote per-run probe files under: ${probeRoot}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
