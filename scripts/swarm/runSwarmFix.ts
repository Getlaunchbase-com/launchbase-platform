#!/usr/bin/env tsx
/**
 * runSwarmFix - CLI runner for Auto-Swarm Fix Engine
 *
 * Usage:
 *   pnpm swarm:fix --from runs/smoke/<runId>/failurePacket.json --max-cost-usd 2 --max-iters 2 --apply --test
 *
 * Contract (executor-owned invariants):
 * 1) stopReason MUST be executor-owned
 *    - stopReason="ok" ONLY if patchValid=true AND applied=true AND testsPassed=true
 *    - must overwrite swarm output at end of run
 *
 * 2) patchValid/applied/testsPassed must be consistent
 *    - git apply --check fails → patchValid=false
 *    - apply fails → applied=false
 *    - if apply fails → tests must not run
 *
 * 3) Escalation retry ON apply failure
 *    - Detect with stderr patterns (depends on old contents / patch does not apply / corrupt patch)
 *    - Build escalated packet with fresh disk snapshots
 *    - Retry exactly ONCE
 *    - Write artifacts in runs/repair/<repairId>:
 *        failurePacket.original.json
 *        failurePacket.escalated.json
 *        retryMeta.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import { runRepairSwarm } from "../../server/ai/orchestration/runRepairSwarm.ts";
import { createScoreCard } from "../../server/contracts/index.ts";
import { preflightFailurePacket } from "../../server/contracts/preflightValidation.ts";
import { shouldEscalateOnApplyFailure } from "./shouldEscalateOnApplyFailure";

type ExecutionFacts = {
  preflightOk: boolean;
  patchValid: boolean;
  applied: boolean;
  testsPassed: boolean;
};

function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function flag(name: string) {
  return process.argv.includes(name);
}

function fmtScore(n: unknown) {
  return typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "n/a";
}

/**
 * Normalize FailurePacket to handle both old and new shapes.
 * Reads from any structure and returns the canonical internal format.
 */
function normalizeFailurePacket(fp: any) {
  const version = fp?.version ?? fp?.kind ?? "failurePacket.unknown";

  // Prefer new shape (signal.*), fall back to old shapes
  const command = fp?.signal?.command ?? fp?.command ?? fp?.meta?.command ?? "unknown";

  const errorMessage =
    fp?.signal?.errorMessage ??
    fp?.errorMessage ??
    fp?.error?.message ??
    fp?.error?.causeMessage ??
    fp?.summary ??
    "unknown error";

  const stack = fp?.error?.stack ?? fp?.signal?.stack ?? fp?.extra?.stack ?? undefined;

  const system = fp?.system ?? fp?.source ?? "unknown";

  const summary = fp?.summary ?? fp?.title ?? "failure";

  const extra = fp?.extra ?? fp?.context ?? {};

  // Return the exact structure runRepairSwarm expects
  return {
    version,
    system,
    summary,
    command,
    failure: {
      type: fp?.failure?.type ?? fp?.type ?? "error",
      errorMessage,
      stopReason: fp?.failure?.stopReason ?? fp?.stopReason ?? "unknown",
      stack,
    },
    error: {
      message: errorMessage,
      stack,
    },
    context: {
      ...extra,
      component: extra.component ?? fp?.component ?? "unknown",
      command: fp?.signal?.command ?? fp?.command ?? "unknown",
      logs: extra.logs ?? fp?.logs ?? [],
    },
    meta: {
      jobId: fp?.meta?.jobId ?? fp?.id ?? "repair_job",
      runId: fp?.meta?.runId ?? fp?.id ?? "repair_run",
      sha: fp?.meta?.sha ?? fp?.sha ?? "unknown",
    },
    raw: fp, // keep original for debugging
  };
}

/**
 * Compute final stopReason from execution facts (executor-owned).
 * Hard rule: stopReason="ok" IFF patchValid=true AND applied=true AND testsPassed=true
 */
function computeStopReason(facts: ExecutionFacts): string {
  if (!facts.preflightOk) return "packet_invalid";
  if (!facts.patchValid) return "patch_invalid";
  if (!facts.applied) return "apply_failed";
  if (!facts.testsPassed) return "tests_failed";
  return "ok";
}

function writeJson(path: string, value: any) {
  writeFileSync(path, JSON.stringify(value, null, 2), "utf8");
}

function safeReadFile(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function sanitizePatch(patchContent: string): string {
  let out = patchContent ?? "";
  out = out.replace(/^```diff\s*\n/gm, "").replace(/^```\s*\n/gm, "");
  out = out.trim();
  if (!out.endsWith("\n")) out += "\n";
  return out;
}

function isUnifiedDiff(patchText: string): boolean {
  return patchText.includes("diff --git") && patchText.includes("---") && patchText.includes("+++");
}

function containsUnsupportedPatchFormat(patchText: string): boolean {
  return patchText.includes("*** Begin Patch") || patchText.includes("*** Update File:");
}

function extractPatchTextFromRepairPacket(repairPacket: any): string {
  const changes = repairPacket?.patchPlan?.changes ?? [];
  return changes.map((c: any) => c?.diff ?? "").join("\n");
}

/**
 * Build "fresh disk snapshots" for escalation:
 * - Prefer the same set of files already present in raw.context.fileSnapshots
 * - Also include raw.targets[].path if present
 */
function buildFreshFileSnapshots(raw: any): Record<string, string> {
  const paths = new Set<string>();

  for (const p of Object.keys(raw?.context?.fileSnapshots ?? {})) paths.add(p);
  for (const t of raw?.targets ?? []) {
    if (t?.path && typeof t.path === "string") paths.add(t.path);
  }

  const out: Record<string, string> = {};
  for (const p of paths) {
    const c = safeReadFile(p);
    if (typeof c === "string") out[p] = c;
  }
  return out;
}

function classifyPermissionBlocker(failurePacket: any): boolean {
  const msg = failurePacket?.error?.message?.toLowerCase?.() || "";
  return msg.includes("workflows permission") || msg.includes("insufficient permissions");
}

type ApplyOutcome = {
  patchValid: boolean;
  applied: boolean;
  checkStderr: string;
  applyStderr: string;
  logs: string[];
  patchFilePath?: string;
};

function tryGitApply(outDir: string, patchText: string): ApplyOutcome {
  const logs: string[] = [];
  const sanitized = sanitizePatch(patchText);

  if (!sanitized || sanitized.length < 10) {
    logs.push("Patch text empty or too short");
    return { patchValid: false, applied: false, checkStderr: "empty_patch", applyStderr: "", logs };
  }

  if (containsUnsupportedPatchFormat(sanitized)) {
    logs.push("Invalid patch format: *** Begin Patch style not supported");
    return { patchValid: false, applied: false, checkStderr: "unsupported_patch_format", applyStderr: "", logs };
  }

  if (!isUnifiedDiff(sanitized)) {
    logs.push("Invalid patch format: missing unified diff headers");
    return { patchValid: false, applied: false, checkStderr: "not_unified_diff", applyStderr: "", logs };
  }

  const patchFile = `${outDir}/patch.diff`;
  writeFileSync(patchFile, sanitized, "utf8");
  logs.push(`Wrote patch file: ${patchFile}`);

  // 1) Preflight check
  let checkStderr = "";
  try {
    execSync(`git apply --check --whitespace=nowarn ${patchFile}`, { cwd: process.cwd(), stdio: "pipe" });
    logs.push("git apply --check passed");
  } catch (e: any) {
    checkStderr = e?.stderr?.toString?.() ?? e?.message ?? "";
    logs.push(`git apply --check failed`);
    if (checkStderr) logs.push(`check stderr: ${checkStderr}`);
    return { patchValid: false, applied: false, checkStderr, applyStderr: "", logs, patchFilePath: patchFile };
  }

  // 2) Apply
  let applyStderr = "";
  try {
    execSync(`git apply --whitespace=nowarn ${patchFile}`, { cwd: process.cwd(), stdio: "pipe" });
    logs.push("git apply succeeded");

    const diffStat = execSync(`git diff --stat`, { cwd: process.cwd(), encoding: "utf8" });
    logs.push(`Diff stats:\n${diffStat}`);

    return { patchValid: true, applied: true, checkStderr: "", applyStderr: "", logs, patchFilePath: patchFile };
  } catch (e: any) {
    applyStderr = e?.stderr?.toString?.() ?? e?.message ?? "";
    logs.push("git apply failed");
    if (applyStderr) logs.push(`apply stderr: ${applyStderr}`);
    return { patchValid: true, applied: false, checkStderr: "", applyStderr, logs, patchFilePath: patchFile };
  }
}

type TestOutcome = {
  testsRan: boolean;
  testsPassed: boolean;
  logs: string[];
};

function runTestCommandsFromPacket(repairPacket: any): TestOutcome {
  const logs: string[] = [];
  const testCommands = repairPacket?.patchPlan?.testCommands;

  if (!testCommands || testCommands.length === 0) {
    logs.push("testCommands missing - cannot execute tests");
    return { testsRan: false, testsPassed: false, logs };
  }

  let allPassed = true;

  for (let i = 0; i < testCommands.length; i++) {
    const { cmd, args, cwd } = testCommands[i];
    const cmdStr = `${cmd} ${(args ?? []).join(" ")}`.trim();
    logs.push(`Test ${i + 1}/${testCommands.length}: ${cmdStr}`);

    const testResult = spawnSync(cmd, args, {
      cwd: cwd || process.cwd(),
      shell: false,
      encoding: "utf8",
    });

    if (testResult.status === 0) {
      logs.push(`✅ Passed`);
      if (testResult.stdout?.trim()) logs.push(`stdout: ${testResult.stdout.trim()}`);
    } else {
      logs.push(`❌ Failed (exit ${testResult.status})`);
      if (testResult.stdout) logs.push(`stdout: ${testResult.stdout}`);
      if (testResult.stderr) logs.push(`stderr: ${testResult.stderr}`);
      allPassed = false;
      break; // fail fast
    }
  }

  return { testsRan: true, testsPassed: allPassed, logs };
}

async function main() {
  const from = arg("--from");
  if (!from) {
    console.error(
      "Usage: pnpm swarm:fix --from <failurePacket.json> [--max-cost-usd 2] [--max-iters 2] [--apply] [--test] [--offline --repairPacket <path>]"
    );
    process.exit(1);
  }

  const maxCostUsd = parseFloat(arg("--max-cost-usd") || "2.0");
  const maxIterations = parseInt(arg("--max-iters") || "2", 10);
  const shouldApply = flag("--apply");
  const shouldTest = flag("--test");
  const offline = flag("--offline");
  const repairPacketPath = arg("--repairPacket");

  console.log(`[SwarmFix] Reading FailurePacket from: ${from}`);
  const raw = JSON.parse(readFileSync(from, "utf8"));
  const failurePacket = normalizeFailurePacket(raw);

  // Repair dir created once, shared across retry (same repairId)
  const repairId = `repair_${Date.now()}`;
  const outDir = `runs/repair/${repairId}`;
  mkdirSync(outDir, { recursive: true });

  // Persist canonical + raw for reproducibility
  writeJson(`${outDir}/failurePacket.json`, failurePacket);
  writeJson(`${outDir}/failurePacket.original.json`, raw);

  // meta.json audit trail
  const metaPath = `${outDir}/meta.json`;
  writeJson(metaPath, {
    repairId,
    createdAtIso: new Date().toISOString(),
    gitSha: failurePacket.context?.sha ?? process.env.GIT_SHA ?? null,
    stopReason: null, // overwritten at end
  });

  // Preflight validation (skip in offline mode)
  let preflightOk = true;
  if (!offline) {
    console.log(`[SwarmFix] Running preflight validation...`);
    const preflight = preflightFailurePacket(raw);

    if (!preflight.ok) {
      preflightOk = false;
      console.error(`❌ Preflight validation failed: ${preflight.stopReason}`);
      console.error(`Errors:`);
      for (const error of preflight.errors) console.error(`  - ${error}`);

      // Minimal RepairPacket (executor-owned stopReason)
      const facts: ExecutionFacts = { preflightOk: false, patchValid: false, applied: false, testsPassed: false };
      const stopReason = computeStopReason(facts);

      const failedPacket = {
        version: "repairpacket.v1",
        repairId,
        failurePacketId: raw?.meta?.runId || "unknown",
        diagnosis: {
          likelyCause: "Preflight validation failed",
          confidence: 1.0,
          relatedIssues: preflight.errors,
        },
        patchPlan: null,
        execution: {
          stopReason,
          applied: false,
          testsPassed: false,
          patchValid: false,
          logs: preflight.errors,
          facts,
        },
        meta: {
          createdAt: new Date().toISOString(),
          sha: process.env.GIT_SHA || "unknown",
        },
      };

      writeJson(`${outDir}/repairPacket.json`, failedPacket);
      writeJson(metaPath, {
        repairId,
        createdAtIso: new Date().toISOString(),
        gitSha: failurePacket.context?.sha ?? process.env.GIT_SHA ?? null,
        stopReason,
      });

      process.exit(1);
    }

    console.log(`✅ Preflight validation passed`);
  }

  // Hard stop for permission blockers
  if (classifyPermissionBlocker(failurePacket)) {
    console.error("❌ BLOCKED: GitHub App permission. Do not swarm this.");
    console.error("Manual action required: Fix GitHub App permissions in repo settings.");
    process.exit(2);
  }

  // Shared mutable state across attempt + retry
  let lastResult: any = null;
  let didRetry = false;

  const retryMeta: any = {
    repairId,
    escalationTriggered: false,
    didRetry: false,
    reason: null,
    originalApplyStderr: null,
    originalCheckStderr: null,
    startedAtIso: new Date().toISOString(),
    finishedAtIso: null,
  };

  async function runOneSwarmAttempt(attemptLabel: "original" | "escalated", fpNormalized: any) {
    if (offline) {
      console.log(`[SwarmFix] Offline mode: skipping swarm, loading pre-generated repairPacket...`);
      if (!repairPacketPath) {
        console.error("❌ --offline requires --repairPacket <path>");
        process.exit(1);
      }
      const repairPacket = JSON.parse(readFileSync(repairPacketPath, "utf8"));
      return {
        stopReason: "offline_mode",
        totalCostUsd: 0,
        totalLatencyMs: 0,
        repairPacket,
        attemptLabel,
      };
    }

    console.log(
      `[SwarmFix] Running repair swarm (${attemptLabel}) (max cost: $${maxCostUsd}, max iters: ${maxIterations})...`
    );

    const r = await runRepairSwarm({
      failurePacket: fpNormalized,
      maxCostUsd,
      maxIterations,
      outputDir: outDir,
    });

    return { ...r, attemptLabel };
  }

  // === Attempt 1: original packet
  lastResult = await runOneSwarmAttempt("original", failurePacket);

  // Executor-owned execution facts (defaults)
  const facts: ExecutionFacts = {
    preflightOk,
    patchValid: false,
    applied: false,
    testsPassed: false,
  };

  const logs: string[] = [];

  function printSwarmSummary(result: any) {
    console.log(`\n📊 Swarm Result (${result.attemptLabel}):`);
    console.log(`   Swarm stopReason: ${result.stopReason}`);
    console.log(`   Total Cost: $${Number(result.totalCostUsd ?? 0).toFixed(4)}`);
    console.log(`   Total Latency: ${result.totalLatencyMs}ms`);
    console.log(`   Diagnosis: ${result.repairPacket?.diagnosis?.likelyCause ?? "unknown"}`);
    console.log(`   Confidence: ${result.repairPacket?.diagnosis?.confidence ?? "n/a"}`);
    console.log(`   Changes Proposed: ${(result.repairPacket?.patchPlan?.changes ?? []).length}`);
  }

  printSwarmSummary(lastResult);

  // === Apply + Test pipeline (attempt 1)
  const patchText = extractPatchTextFromRepairPacket(lastResult.repairPacket);

  let applyOutcome: ApplyOutcome | null = null;
  if (shouldApply) {
    console.log(`\n🔧 Applying patch (original)...`);
    applyOutcome = tryGitApply(outDir, patchText);

    facts.patchValid = applyOutcome.patchValid;
    facts.applied = applyOutcome.applied;

    logs.push(...applyOutcome.logs);

    // Escalation trigger decision only on apply failure OR check failure (both are apply-stage failures)
    const stderrForEscalation = applyOutcome.applied ? "" : (applyOutcome.applyStderr || applyOutcome.checkStderr || "");
    if (!applyOutcome.applied && stderrForEscalation && shouldEscalateOnApplyFailure(stderrForEscalation)) {
      retryMeta.escalationTriggered = true;
      retryMeta.reason = "apply_failure_escalation";
      retryMeta.originalApplyStderr = applyOutcome.applyStderr || null;
      retryMeta.originalCheckStderr = applyOutcome.checkStderr || null;
    }
  } else {
    logs.push("Apply skipped (no --apply)");
  }

  let testOutcome: TestOutcome | null = null;
  if (shouldTest) {
    if (!facts.applied) {
      // Invariant: if apply fails, tests must not run
      logs.push("Tests skipped because patch was not applied");
      facts.testsPassed = false;
    } else {
      console.log(`\n🧪 Running tests (original)...`);
      testOutcome = runTestCommandsFromPacket(lastResult.repairPacket);
      logs.push(...testOutcome.logs);
      facts.testsPassed = testOutcome.testsPassed;
    }
  } else {
    logs.push("Tests skipped (no --test)");
  }

  // === Escalation retry (exactly once) if triggered
  if (retryMeta.escalationTriggered && !didRetry) {
    didRetry = true;
    retryMeta.didRetry = true;

    console.log(`\n♻️ Escalation triggered: rebuilding packet with fresh disk snapshots + retrying ONCE...`);

    // Build escalated raw packet:
    // - clone raw
    // - overwrite raw.context.fileSnapshots with fresh disk reads
    // - annotate meta to make it obvious this is escalated
    const escalatedRaw = JSON.parse(JSON.stringify(raw));
    const fresh = buildFreshFileSnapshots(raw);

    if (!escalatedRaw.context) escalatedRaw.context = {};
    escalatedRaw.context.fileSnapshots = fresh;

    if (!escalatedRaw.meta) escalatedRaw.meta = {};
    escalatedRaw.meta.escalation = {
      level: "L2",
      reason: "apply_failure",
      createdAtIso: new Date().toISOString(),
    };

    writeJson(`${outDir}/failurePacket.escalated.json`, escalatedRaw);

    // Run swarm again using escalated packet (normalized)
    const escalatedNormalized = normalizeFailurePacket(escalatedRaw);
    const escalatedResult = await runOneSwarmAttempt("escalated", escalatedNormalized);
    lastResult = escalatedResult;

    printSwarmSummary(lastResult);

    // Reset apply/test facts for final verdict: we care about the end-of-run correctness
    // (Facts are always end-state)
    facts.patchValid = false;
    facts.applied = false;
    facts.testsPassed = false;

    // Apply + Test pipeline (attempt 2)
    const patchText2 = extractPatchTextFromRepairPacket(lastResult.repairPacket);

    let applyOutcome2: ApplyOutcome | null = null;
    if (shouldApply) {
      console.log(`\n🔧 Applying patch (escalated)...`);
      applyOutcome2 = tryGitApply(outDir, patchText2);

      facts.patchValid = applyOutcome2.patchValid;
      facts.applied = applyOutcome2.applied;

      logs.push("----- escalation retry -----");
      logs.push(...applyOutcome2.logs);
    } else {
      logs.push("Apply skipped (no --apply)");
    }

    if (shouldTest) {
      if (!facts.applied) {
        logs.push("Tests skipped because patch was not applied");
        facts.testsPassed = false;
      } else {
        console.log(`\n🧪 Running tests (escalated)...`);
        const testOutcome2 = runTestCommandsFromPacket(lastResult.repairPacket);
        logs.push(...testOutcome2.logs);
        facts.testsPassed = testOutcome2.testsPassed;
      }
    } else {
      logs.push("Tests skipped (no --test)");
    }
  }

  // Write retryMeta.json if escalation triggered (contract)
  if (retryMeta.escalationTriggered) {
    retryMeta.finishedAtIso = new Date().toISOString();
    writeJson(`${outDir}/retryMeta.json`, retryMeta);
  }

  // Executor-owned final stopReason (overwrite anything swarm produced)
  const finalStopReason = computeStopReason(facts);

  // Ensure execution section exists and is consistent
  if (!lastResult.repairPacket.execution) lastResult.repairPacket.execution = {};
  lastResult.repairPacket.execution.logs = logs;
  lastResult.repairPacket.execution.patchValid = facts.patchValid;
  lastResult.repairPacket.execution.applied = facts.applied;
  lastResult.repairPacket.execution.testsPassed = facts.testsPassed;
  lastResult.repairPacket.execution.facts = facts;
  lastResult.repairPacket.execution.stopReason = finalStopReason;

  // Persist RepairPacket
  const outputRepairPacketPath = `${outDir}/repairPacket.json`;
  writeJson(outputRepairPacketPath, lastResult.repairPacket);
  console.log(`\n✅ Wrote RepairPacket: ${outputRepairPacketPath}`);

  // Overwrite meta.json stopReason (audit)
  writeJson(metaPath, {
    repairId,
    createdAtIso: new Date().toISOString(),
    gitSha: failurePacket.context?.sha ?? process.env.GIT_SHA ?? null,
    stopReason: finalStopReason,
  });

  // Create ScoreCard (still useful even if stopReason != ok)
  const scoreCard = createScoreCard({
    repairId,
    failurePacket,
    repairPacket: lastResult.repairPacket,
    testResults: {
      passed: facts.testsPassed,
      regressions: [],
      newFailures: [],
    },
    humanReview: {
      coderAccuracy: lastResult.repairPacket?.scorecard?.coderScore,
      reviewerUseful: lastResult.repairPacket?.scorecard?.reviewerScore,
      arbiterCorrect: lastResult.repairPacket?.scorecard?.arbiterScore,
    },
  });

  const scoreCardPath = `${outDir}/scorecard.json`;
  writeJson(scoreCardPath, scoreCard);
  console.log(`\n📋 Wrote ScoreCard: ${scoreCardPath}`);

  console.log(`\n🎯 Overall Score: ${fmtScore(scoreCard.overallScore)}`);
  console.log(`   Coder: ${fmtScore(scoreCard.agentScores?.coder)}`);
  console.log(`   Reviewer: ${fmtScore(scoreCard.agentScores?.reviewer)}`);
  console.log(`   Arbiter: ${fmtScore(scoreCard.agentScores?.arbiter)}`);
  console.log(`   Trust Delta: ${scoreCard.trustDelta > 0 ? "+" : ""}${fmtScore(scoreCard.trustDelta)}`);

  if (finalStopReason === "ok") {
    console.log(`\n✅ Repair completed successfully (executor-owned ok)`);
    process.exit(0);
  } else {
    console.log(`\n⚠️  Repair stopped: ${finalStopReason}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`\n❌ Swarm fix failed:`, e);
  process.exit(1);
});
