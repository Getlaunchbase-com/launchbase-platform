import fs from "node:fs";
import path from "node:path";

type StopReason =
  | "ok"
  | "packet_invalid"
  | "target_missing"
  | "tests_missing_testCommands"
  | "test_commands_invalid"
  | "patch_invalid"
  | "apply_failed"
  | "tests_failed"
  | "human_review_required"
  | "error"
  | null;

type RunClassification = "complete" | "in_progress" | "incomplete" | "legacy";

type RunSummary = {
  runDir: string;
  runId: string;
  createdAt: string | null;
  updatedAt: string | null;

  classification: RunClassification;
  stopReason: StopReason;

  applied: boolean | null;
  testsPassed: boolean | null;

  costUsd: number | null;
  latencyMs: number | null;

  hasFailurePacket: boolean;
  hasRepairPacket: boolean;
  hasPatch: boolean;
  hasScorecard: boolean;
  hasAttempts: boolean;

  infraFailure: boolean;
  infraReason: string | null;
};

const RUNS_ROOT = path.join(process.cwd(), "runs", "repair");

// Heuristic: if a dir was touched in the last N minutes and stopReason is null / missing,
// treat as "in_progress" (fixture suite still running, hung test, killed process, etc.)
const IN_PROGRESS_MINUTES = 20;

function safeReadJson<T>(p: string): T | null {
  try {
    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function exists(p: string): boolean {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function statTimeISO(p: string): string | null {
  try {
    const s = fs.statSync(p);
    return s.mtime.toISOString();
  } catch {
    return null;
  }
}

function dirUpdatedISO(dir: string): string | null {
  try {
    const entries = fs.readdirSync(dir);
    let newest = 0;
    for (const e of entries) {
      const p = path.join(dir, e);
      try {
        const s = fs.statSync(p);
        newest = Math.max(newest, s.mtimeMs);
      } catch {}
    }
    if (newest === 0) return null;
    return new Date(newest).toISOString();
  } catch {
    return null;
  }
}

function minutesSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / 60000;
}

/**
 * Conservative INFRA classifier:
 * - A run is INFRA-failure if it did NOT reach a meaningful stopReason
 *   and/or cost is 0 with "error" and no repairPacket.
 * - We explicitly *exclude* in_progress runs from INFRA.
 */
function computeInfraFailure(r: RunSummary): { infraFailure: boolean; infraReason: string | null } {
  // Never count in-progress as INFRA
  if (r.classification === "in_progress") return { infraFailure: false, infraReason: null };

  // If we have a repair packet and a stopReason that is not "error", it's not INFRA
  if (r.hasRepairPacket && r.stopReason && r.stopReason !== "error") {
    return { infraFailure: false, infraReason: null };
  }

  // If cost is null, we can't prove infra.
  // If cost is 0 and stopReason is error or missing repairPacket => likely infra / early crash.
  if ((r.costUsd === 0 || r.costUsd === 0.0) && (!r.hasRepairPacket || r.stopReason === "error")) {
    return { infraFailure: true, infraReason: "cost_usd_0_and_no_repairPacket_or_error" };
  }

  // If there is no repairPacket at all and stopReason is null, but it's not recent => incomplete/infra-ish.
  if (!r.hasRepairPacket && r.stopReason === null) {
    return { infraFailure: true, infraReason: "missing_repairPacket_and_stopReason_null" };
  }

  return { infraFailure: false, infraReason: null };
}

function classifyRun(args: {
  hasRepairPacket: boolean;
  stopReason: StopReason;
  updatedAt: string | null;
  hasAttempts: boolean;
}): RunClassification {
  const mins = minutesSince(args.updatedAt);

  // If no repairPacket or stopReason null, but updated recently => in progress
  if ((!args.hasRepairPacket || args.stopReason === null) && mins !== null && mins <= IN_PROGRESS_MINUTES) {
    return "in_progress";
  }

  // If we have repairPacket + stopReason => complete
  if (args.hasRepairPacket && args.stopReason !== null) return "complete";

  // If attempts missing and it looks older, treat as legacy (created before attempts.jsonl existed)
  if (!args.hasAttempts && mins !== null && mins > 6 * 60) return "legacy";

  // Otherwise incomplete (killed process, crashed before write, etc.)
  return "incomplete";
}

function extractRunId(dirName: string): string {
  // dirs look like repair_1769039507230 or fixture_f1-missing-import or repair_run etc.
  return dirName;
}

function main() {
  if (!exists(RUNS_ROOT)) {
    console.error(`[summarizeRepairRuns] Missing ${RUNS_ROOT}`);
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(RUNS_ROOT)
    .map((d) => path.join(RUNS_ROOT, d))
    .filter((p) => fs.statSync(p).isDirectory());

  const runs: RunSummary[] = [];

  for (const dir of dirs) {
    const dirName = path.basename(dir);
    const runId = extractRunId(dirName);

    const failurePacketPath = path.join(dir, "failurePacket.json");
    const repairPacketPath = path.join(dir, "repairPacket.json");
    const patchPath = path.join(dir, "patch.diff");
    const scorecardPath = path.join(dir, "scorecard.json");
    const attemptsPath = path.join(dir, "attempts.jsonl");
    const metaPath = path.join(dir, "meta.json");

    const hasFailurePacket = exists(failurePacketPath);
    const hasRepairPacket = exists(repairPacketPath);
    const hasPatch = exists(patchPath);
    const hasScorecard = exists(scorecardPath);
    const hasAttempts = exists(attemptsPath);

    const meta = safeReadJson<any>(metaPath);
    const repairPkt = safeReadJson<any>(repairPacketPath);

    const stopReason: StopReason =
      (repairPkt?.execution?.stopReason as StopReason) ??
      (repairPkt?.repairPacket?.execution?.stopReason as StopReason) ??
      null;

    const applied: boolean | null =
      typeof repairPkt?.execution?.applied === "boolean"
        ? repairPkt.execution.applied
        : typeof repairPkt?.repairPacket?.execution?.applied === "boolean"
          ? repairPkt.repairPacket.execution.applied
          : null;

    const testsPassed: boolean | null =
      typeof repairPkt?.execution?.testsPassed === "boolean"
        ? repairPkt.execution.testsPassed
        : typeof repairPkt?.repairPacket?.execution?.testsPassed === "boolean"
          ? repairPkt.repairPacket.execution.testsPassed
          : null;

    // Try multiple possible shapes for cost/latency
    const costUsd: number | null =
      typeof repairPkt?.meta?.costUsd === "number"
        ? repairPkt.meta.costUsd
        : typeof repairPkt?.costUsd === "number"
          ? repairPkt.costUsd
          : typeof meta?.costUsd === "number"
            ? meta.costUsd
            : null;

    const latencyMs: number | null =
      typeof repairPkt?.meta?.latencyMs === "number"
        ? repairPkt.meta.latencyMs
        : typeof repairPkt?.latencyMs === "number"
          ? repairPkt.latencyMs
          : typeof meta?.latencyMs === "number"
            ? meta.latencyMs
            : null;

    const createdAt = statTimeISO(dir);
    const updatedAt = dirUpdatedISO(dir);

    const classification = classifyRun({ hasRepairPacket, stopReason, updatedAt, hasAttempts });

    const run: RunSummary = {
      runDir: dirName,
      runId,
      createdAt,
      updatedAt,
      classification,
      stopReason,
      applied,
      testsPassed,
      costUsd,
      latencyMs,
      hasFailurePacket,
      hasRepairPacket,
      hasPatch,
      hasScorecard,
      hasAttempts,
      infraFailure: false,
      infraReason: null,
    };

    const infra = computeInfraFailure(run);
    run.infraFailure = infra.infraFailure;
    run.infraReason = infra.infraReason;

    runs.push(run);
  }

  // Sort newest first by updatedAt
  runs.sort((a, b) => {
    const am = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bm = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bm - am;
  });

  const complete = runs.filter((r) => r.classification === "complete");
  const infraFailures = complete.filter((r) => r.infraFailure);

  const stopReasonCounts: Record<string, number> = {};
  for (const r of complete) {
    const k = r.stopReason ?? "null";
    stopReasonCounts[k] = (stopReasonCounts[k] ?? 0) + 1;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    totals: {
      totalDirs: runs.length,
      complete: complete.length,
      in_progress: runs.filter((r) => r.classification === "in_progress").length,
      incomplete: runs.filter((r) => r.classification === "incomplete").length,
      legacy: runs.filter((r) => r.classification === "legacy").length,
    },
    gateA_infra: {
      infraFailures: infraFailures.length,
      infraFailureRunIds: infraFailures.slice(0, 50).map((r) => r.runId),
      note: "Gate A computed ONLY from complete runs (in_progress excluded).",
    },
    stopReasonCounts_completeOnly: stopReasonCounts,
    runs,
  };

  const summaryPath = path.join(process.cwd(), "runs", "repair", "summary.json");
  fs.writeFileSync(summaryPath, JSON.stringify(out, null, 2), "utf8");
  console.log(`[summarizeRepairRuns] wrote ${summaryPath}`);
  console.log(
    `[summarizeRepairRuns] complete=${complete.length} infraFailures=${infraFailures.length} gateA=${infraFailures.length === 0 ? "PASS" : "FAIL"}`
  );
}

main();
