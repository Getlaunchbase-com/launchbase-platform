/**
 * runRepairSwarm - Auto-Swarm Fix Engine
 * 
 * Orchestrates a multi-model swarm to diagnose and fix code failures.
 * 
 * Flow: FailurePacket → Field General (diagnosis) → Coder (patch) → Reviewer (critique) → Arbiter (decision) → RepairPacket
 * 
 * Constitutional Rules:
 * - Never swarm on permission/platform blockers (exit with FailurePacket)
 * - Max 2 iterations per swarm (prevent infinite loops)
 * - Max $2 cost per swarm (prevent runaway costs)
 * - Always write RepairPacket artifact (even on failure)
 * - Always grade the repair (ScoreCard)
 */

import type { FailurePacketV1 } from "../../contracts/failurePacket";
import type { RepairPacketV1 } from "../../contracts/repairPacket";
import { createRepairPacket } from "../../contracts/repairPacket";
import { callSpecialistAIML } from "../engine/specialists/aimlSpecialist";
import { normalizeTestCommands } from "../../contracts/normalizeTestCommands";
// fileLog not needed - using console.log instead

/**
 * Helper: safely normalize unknown payload to Record
 */
function payloadAsRecord(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  return x as Record<string, unknown>;
}

/**
 * Quote-aware command line tokenizer for fixture testCommands.
 * Supports '...' and "...", preserves spaces inside quotes.
 */
function splitCommandLine(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (quote) {
      if (ch === quote) {
        quote = null;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      quote = ch as any;
      continue;
    }

    if (/\s/.test(ch)) {
      if (cur.length) {
        out.push(cur);
        cur = "";
      }
      continue;
    }

    cur += ch;
  }

  if (cur.length) out.push(cur);
  return out;
}

export type RepairSwarmOpts = {
  failurePacket: FailurePacketV1;
  maxIterations?: number; // Default: 2
  maxCostUsd?: number; // Default: 2.0
  outputDir?: string; // Default: runs/repair/<repairId>
};

export type RepairSwarmResult = {
  repairPacket: RepairPacketV1;
  stopReason: "ok" | "blocked" | "max_cost" | "max_iters" | "patch_failed" | "tests_failed";
  totalCostUsd: number;
  totalLatencyMs: number;
};

/**
 * Check if failure is a permission/platform blocker
 */
function isPermissionBlocker(pkt: FailurePacketV1): boolean {
  const msg = (pkt.failure?.errorMessage ?? "").toLowerCase();
  return (
    msg.includes("workflows permission") ||
    msg.includes("insufficient permissions") ||
    msg.includes("github app permission") ||
    msg.includes("missing permission")
  );
}

/**
 * Run Field General to diagnose the failure
 */
async function runFieldGeneral(pkt: FailurePacketV1): Promise<{
  likelyCause: string;
  confidence: number;
  relatedIssues: string[];
  costUsd: number;
  latencyMs: number;
}> {
  const startMs = Date.now();
  
  // Extract component from FailurePacket
  const component =
    (pkt as any)?.context?.component ??
    (pkt as any)?.component ??
    (pkt as any)?.failure?.component ??
    "unknown";
  
  const prompt = `You are the Field General. Diagnose this failure and identify the likely root cause.

**Failure Context:**
- Type: ${pkt.failure.type}
- Error: ${pkt.failure.errorMessage}
- Stop Reason: ${pkt.failure.stopReason}
- Component: ${component || "unknown"}
- Command: ${pkt.context.command || "unknown"}

**Stack Trace:**
${pkt.failure.stack || "No stack trace available"}

**Logs:**
${Array.isArray(pkt.context.logs) ? pkt.context.logs.join('\n') : typeof pkt.context.logs === 'string' ? pkt.context.logs : "No logs"}

**File Contents:**
${pkt.context.fileSnapshots ? Object.entries(pkt.context.fileSnapshots).map(([path, content]) => `--- ${path} ---\n${content}`).join('\n\n') : "No file snapshots available"}

**Your task:**
1. Identify the likely root cause
2. Rate your confidence (0.0-1.0)
3. List related issues that might be connected

Return JSON:
{
  "likelyCause": "string",
  "confidence": number,
  "relatedIssues": ["string"]
}`;

  const result = await callSpecialistAIML({
    role: "field_general",
    trace: {
      jobId: pkt.meta.jobId || "repair_job",
      runId: pkt.meta.runId || pkt.meta.jobId || "repair_job",
    },
    input: {
      plan: { failurePacket: pkt, goal: "diagnose_and_fix" },
      context: { repoSha: pkt.meta.sha, env: process.env.NODE_ENV },
      systemPromptOverride: "You are a Field General AI that diagnoses code failures.",
      userPromptOverride: prompt,
    },
    roleConfig: {
      transport: "aiml" as const,
      model: "openai/gpt-5-2",
      capabilities: ["diagnosis"],
      timeoutMs: 30000,
    },
  });

  const latencyMs = Date.now() - startMs;
  const costUsd = result.meta.costUsd || 0;

  const payload = payloadAsRecord(result.artifact.payload);
  console.log(`[FieldGeneral] Diagnosis: ${payload.likelyCause} (confidence: ${payload.confidence})`);

  return {
    likelyCause: typeof payload.likelyCause === "string" ? payload.likelyCause : "(unknown)",
    confidence: typeof payload.confidence === "number" ? payload.confidence : 0,
    relatedIssues: Array.isArray(payload.relatedIssues) ? payload.relatedIssues : [],
    costUsd,
    latencyMs,
  };
}

/**
 * Run Coder to propose a patch
 */
async function runCoder(pkt: FailurePacketV1, diagnosis: any, reviseNotes: string = ""): Promise<{
  changes: RepairPacketV1["patchPlan"]["changes"];
  testPlan: string[];
  testCommands?: RepairPacketV1["patchPlan"]["testCommands"];
  rollbackPlan: string;
  costUsd: number;
  latencyMs: number;
}> {
  const startMs = Date.now();
  
  // Extract component from FailurePacket
  const component =
    (pkt as any)?.context?.component ??
    (pkt as any)?.component ??
    (pkt as any)?.failure?.component ??
    "unknown";
  
  const reviseSectionPrompt = reviseNotes ? `

**REVISIONS REQUESTED:**
${reviseNotes}

You MUST address the concerns and rationale above in your revised patch.
` : "";
  
  const prompt = `You are the Coder. Based on this diagnosis, propose a patch to fix the failure.

**Diagnosis:**
- Likely Cause: ${diagnosis.likelyCause}
- Confidence: ${diagnosis.confidence}
- Related Issues: ${diagnosis.relatedIssues.join(", ")}

**Failure Context:**
- Type: ${pkt.failure.type}
- Error: ${pkt.failure.errorMessage}
- Component: ${component || "unknown"}

**Logs:**
${Array.isArray(pkt.context.logs) ? pkt.context.logs.join('\n') : "No logs"}

**File Contents:**
${pkt.context.fileSnapshots ? Object.entries(pkt.context.fileSnapshots).map(([path, content]) => `--- ${path} ---\n${content}`).join('\n\n') : "No file snapshots available"}${reviseSectionPrompt}

**Your task:**
1. Propose specific file changes to fix the issue
2. Provide machine-executable test commands
3. Provide a rollback plan if the fix fails

**CRITICAL: git apply COMPATIBLE DIFFS ONLY**
The executor runs \`git apply --check\` and rejects malformed diffs. Your diff MUST pass that gate.

**Required diff structure for EVERY file:**
1. \`diff --git a/path b/path\`
2. For MODIFIED files: \`index <old_hash>..<new_hash> <mode>\` (e.g., \`index abc1234..def5678 100644\`)
3. For NEW files: \`new file mode 100644\` then \`index 0000000..<hash>\`
4. For DELETED files: \`deleted file mode 100644\` then \`index <hash>..0000000\`
5. \`--- a/path\` (or \`--- /dev/null\` for new files)
6. \`+++ b/path\` (or \`+++ /dev/null\` for deleted files)
7. \`@@ -start,count +start,count @@\` hunk headers with EXACT line counts

**INVALID (will be rejected):**
- Missing \`index\` line → corrupt patch error
- Wrong hunk counts → patch does not apply
- \`*** Begin Patch\` format → unsupported
- Markdown fences around diff → parse failure

**testCommands:** MUST be structured {cmd, args} - NO prose

Return JSON:
{
  "changes": [
    {
      "file": "path/to/file.ts",
      "operation": "edit|create|delete",
      "description": "What this change does",
      "diff": "diff --git a/path/to/file.ts b/path/to/file.ts\nindex abc1234..def5678 100644\n--- a/path/to/file.ts\n+++ b/path/to/file.ts\n@@ -1,3 +1,3 @@\n-old line\n+new line",
      "rationale": "Why this fixes the issue"
    }
  ],
  "testPlan": ["Human-readable step 1", "Human-readable step 2"],
  "testCommands": [
    {"cmd": "pnpm", "args": ["typecheck"]},
    {"cmd": "pnpm", "args": ["test", "--run", "path/to/test.ts"]}
  ],
  "rollbackPlan": "How to undo if fix fails"
}`;

  const result = await callSpecialistAIML({
    role: "coder",
    trace: {
      jobId: pkt.meta.jobId || "repair_job",
      runId: pkt.meta.runId || pkt.meta.jobId || "repair_job",
    },
    input: {
      plan: { failurePacket: pkt, diagnosis, goal: "generate_patch" },
      context: { repoSha: pkt.meta.sha, env: process.env.NODE_ENV },
      systemPromptOverride: "You are a Coder AI that proposes patches to fix code failures.",
      userPromptOverride: prompt,
    },
    roleConfig: {
      transport: "aiml" as const,
      model: "openai/gpt-5-2",
      capabilities: ["coding"],
      timeoutMs: 30000,
    },
  });

  const latencyMs = Date.now() - startMs;
  const costUsd = result.meta.costUsd || 0;

  const payload = payloadAsRecord(result.artifact.payload);
  const changes = Array.isArray(payload.changes) ? payload.changes : [];
  console.log(`[Coder] Proposed ${changes.length} changes`);

  return {
    changes,
    testPlan: Array.isArray(payload.testPlan) ? payload.testPlan : [],
    testCommands: Array.isArray(payload.testCommands) ? payload.testCommands : undefined,
    rollbackPlan: typeof payload.rollbackPlan === "string" ? payload.rollbackPlan : "",
    costUsd,
    latencyMs,
  };
}

/**
 * Run Reviewer (Claude) to critique the patch
 */
async function runReviewer(pkt: FailurePacketV1, patch: any): Promise<{
  approved: boolean;
  concerns: string[];
  suggestions: string[];
  costUsd: number;
  latencyMs: number;
}> {
  const startMs = Date.now();
  
  const prompt = `You are the Reviewer. Critique this proposed patch for fixing the failure.

**Proposed Patch:**
${JSON.stringify(patch.changes, null, 2)}

**Test Plan:**
${(patch.testPlan ?? []).join("\n")}

**Your task:**
1. Identify any concerns or risks with the patch
2. Suggest improvements
3. Approve or reject the patch

Return JSON:
{
  "approved": boolean,
  "concerns": ["concern 1", "concern 2"],
  "suggestions": ["suggestion 1", "suggestion 2"]
}`;

  const result = await callSpecialistAIML({
    role: "reviewer",
    trace: {
      jobId: pkt.meta.jobId || "repair_job",
      runId: pkt.meta.runId || pkt.meta.jobId || "repair_job",
    },
    input: {
      plan: { patch, goal: "review_patch" },
      context: { repoSha: pkt.meta.sha, env: process.env.NODE_ENV },
      systemPromptOverride: "You are a Reviewer AI that critiques code patches.",
      userPromptOverride: prompt,
    },
    roleConfig: {
      transport: "aiml" as const,
      model: "anthropic/claude-sonnet-4-20250514",
      capabilities: ["review"],
      timeoutMs: 30000,
    },
  });

  const latencyMs = Date.now() - startMs;
  const costUsd = result.meta.costUsd || 0;

  const payload = payloadAsRecord(result.artifact.payload);
  const approved = !!payload.approved;
  const concerns = Array.isArray(payload.concerns) ? payload.concerns : [];
  console.log(`[Reviewer] ${approved ? "APPROVED" : "REJECTED"} with ${concerns.length} concerns`);

  return {
    approved,
    concerns,
    suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
    costUsd,
    latencyMs,
  };
}

/**
 * Run Arbiter to make final decision
 */
async function runArbiter(diagnosis: any, patch: any, review: any): Promise<{
  decision: "apply" | "reject" | "revise";
  rationale: string;
  finalPatch: any;
  costUsd: number;
  latencyMs: number;
}> {
  const startMs = Date.now();
  
  const prompt = `You are the Arbiter. Make the final decision on whether to apply this patch.

**Diagnosis:**
${JSON.stringify(diagnosis, null, 2)}

**Proposed Patch:**
${JSON.stringify(patch, null, 2)}

**Reviewer Critique:**
- Approved: ${review.approved}
- Concerns: ${review.concerns.join(", ")}
- Suggestions: ${review.suggestions.join(", ")}

**Your task:**
1. Validate patch format (MUST be unified diff starting with "diff --git")
2. Validate testCommands exist and are structured {cmd, args}
3. Decide whether to apply, reject, or revise the patch
4. Provide rationale for your decision
5. If revising, provide the final patch incorporating reviewer suggestions

**REJECTION CRITERIA:**
- REJECT if any diff does NOT start with "diff --git a/... b/..."
- REJECT if any diff contains "*** Begin Patch" or "*** Update File:"
- REJECT if testCommands is missing or empty
- REJECT if testCommands contains prose instead of {cmd, args} structure
- REJECT if patch would fail 'git apply --check' due to malformed hunks
- REJECT if patch touches JSON/config files or files with 30 lines or fewer without using full-file replacement
- If rejected, instruct Coder to regenerate with correct format

Return JSON:
{
  "decision": "apply|reject|revise",
  "rationale": "string (include specific format violations if rejecting)",
  "finalPatch": { ... } // Only if decision is "apply" or "revise"
}`;

  const result = await callSpecialistAIML({
    role: "arbiter",
    trace: {
      jobId: "repair_job",
      runId: "repair_run",
    },
    input: {
      plan: { diagnosis, patch, review, goal: "make_decision" },
      context: { env: process.env.NODE_ENV },
      systemPromptOverride: "You are an Arbiter AI that makes final decisions on code patches.",
      userPromptOverride: prompt,
    },
    roleConfig: {
      transport: "aiml" as const,
      model: "openai/gpt-5-2",
      capabilities: ["decision"],
      timeoutMs: 30000,
    },
  });

  const latencyMs = Date.now() - startMs;
  const costUsd = result.meta.costUsd || 0;

  const payload = payloadAsRecord(result.artifact.payload);
  const decision = typeof payload.decision === "string" ? payload.decision as ("apply" | "reject" | "revise") : "reject";
  console.log(`[Arbiter] Decision: ${decision}`);

  return {
    decision,
    rationale: typeof payload.rationale === "string" ? payload.rationale : "",
    finalPatch: payload.finalPatch ?? null,
    costUsd,
    latencyMs,
  };
}

/**
 * Main orchestrator for repair swarm
 */
export async function runRepairSwarm(opts: RepairSwarmOpts): Promise<RepairSwarmResult> {
  const { failurePacket, maxIterations = 2, maxCostUsd = 2.0 } = opts;
  
  let totalCostUsd = 0;
  let totalLatencyMs = 0;
  const startMs = Date.now();
  
  // Check for permission blockers
  if (isPermissionBlocker(failurePacket)) {
    console.log("[RepairSwarm] BLOCKED: Permission/platform blocker detected. Not swarming.");
    
    const repairPacket = createRepairPacket({
      failurePacket,
      diagnosis: {
        likelyCause: "Permission/platform blocker (not a code bug)",
        confidence: 1.0,
        relatedIssues: ["github_permissions", "platform_configuration"],
        models: { coder: "none", reviewer: "none", arbiter: "none" },
      },
      patchPlan: {
        changes: [],
        testPlan: [],
        rollbackPlan: "N/A - no patch applied",
      },
      execution: {
        applied: false,
        testsPassed: false,
        stopReason: "human_review_required",
        logs: ["Permission blocker detected - requires manual intervention"],
        latencyMs: Date.now() - startMs,
        costUsd: 0,
      },
      scorecard: {
        coderScore: 0,
        reviewerScore: 0,
        arbiterScore: 0,
        overallScore: 0,
        trustDelta: 0,
      },
      audit: {
        coderProposal: "N/A - blocked by permissions",
        reviewerCritique: "N/A - blocked by permissions",
        arbiterDecision: "BLOCKED: Requires human to fix GitHub App permissions",
      },
    });
    
    return {
      repairPacket,
      stopReason: "blocked",
      totalCostUsd: 0,
      totalLatencyMs: Date.now() - startMs,
    };
  }
  
  // Run Field General
  console.log("[RepairSwarm] Running Field General...");
  const fieldGeneralResult = await runFieldGeneral(failurePacket);
  totalCostUsd += fieldGeneralResult.costUsd;
  totalLatencyMs += fieldGeneralResult.latencyMs;
  
  // Guard against undefined/partial model outputs
  const diagnosis = {
    likelyCause: typeof fieldGeneralResult.likelyCause === "string" ? fieldGeneralResult.likelyCause : "(Field General returned undefined diagnosis)",
    confidence: typeof fieldGeneralResult.confidence === "number" ? fieldGeneralResult.confidence : 0,
    relatedIssues: Array.isArray(fieldGeneralResult.relatedIssues) ? fieldGeneralResult.relatedIssues : [],
    costUsd: fieldGeneralResult.costUsd,
    latencyMs: fieldGeneralResult.latencyMs,
  };
  
  if (totalCostUsd > maxCostUsd) {
    console.log(`[RepairSwarm] Cost limit exceeded: $${totalCostUsd.toFixed(2)} > $${maxCostUsd.toFixed(2)}`);
    
    const repairPacket = createRepairPacket({
      failurePacket,
      diagnosis: {
        likelyCause: diagnosis.likelyCause,
        confidence: diagnosis.confidence,
        relatedIssues: diagnosis.relatedIssues,
        models: { coder: "none", reviewer: "none", arbiter: "none" },
      },
      patchPlan: {
        changes: [],
        testPlan: [],
        rollbackPlan: "N/A - cost limit exceeded",
      },
      execution: {
        applied: false,
        testsPassed: false,
        stopReason: "human_review_required",
        logs: [`Cost limit exceeded: $${totalCostUsd.toFixed(2)}`],
        latencyMs: Date.now() - startMs,
        costUsd: totalCostUsd,
      },
      scorecard: {
        coderScore: 0,
        reviewerScore: 0,
        arbiterScore: 0,
        overallScore: 0,
        trustDelta: 0,
      },
      audit: {
        coderProposal: "N/A - cost limit exceeded",
        reviewerCritique: "N/A - cost limit exceeded",
        arbiterDecision: "BLOCKED: Cost limit exceeded",
      },
    });
    
    return {
      repairPacket,
      stopReason: "max_cost",
      totalCostUsd,
      totalLatencyMs: Date.now() - startMs,
    };
  }
  
  // Iteration loop: Coder → Reviewer → Arbiter
  let reviseNotes = "";
  let finalPatch: any = null;
  let finalReview: any = null;
  let finalArbiter: any = null;
  let stopReason: "ok" | "patch_failed" | "max_iters" = "patch_failed";
  
  for (let iter = 0; iter < maxIterations; iter++) {
    console.log(`[RepairSwarm] Iteration ${iter + 1}/${maxIterations}`);
    
    // Run Coder
    console.log("[RepairSwarm] Running Coder...");
    const patch = await runCoder(failurePacket, diagnosis, reviseNotes);
    totalCostUsd += patch.costUsd;
    totalLatencyMs += patch.latencyMs;
    
    if (totalCostUsd > maxCostUsd) {
      console.log(`[RepairSwarm] Cost limit exceeded: $${totalCostUsd.toFixed(2)} > $${maxCostUsd.toFixed(2)}`);
      stopReason = "patch_failed";
      break;
    }
    
    // Run Reviewer
    console.log("[RepairSwarm] Running Reviewer...");
    const review = await runReviewer(failurePacket, patch);
    totalCostUsd += review.costUsd;
    totalLatencyMs += review.latencyMs;
    
    // Run Arbiter
    console.log("[RepairSwarm] Running Arbiter...");
    const arbiter = await runArbiter(diagnosis, patch, review);
    totalCostUsd += arbiter.costUsd;
    totalLatencyMs += arbiter.latencyMs;
    
    finalPatch = patch;
    finalReview = review;
    finalArbiter = arbiter;
    
    // Termination rules
    if (arbiter.decision === "apply") {
      console.log("[RepairSwarm] Arbiter approved patch - stopping");
      stopReason = "ok";
      break;
    }
    
    if (arbiter.decision === "reject") {
      console.log("[RepairSwarm] Arbiter rejected patch - stopping");
      stopReason = "patch_failed";
      break;
    }
    
    if (arbiter.decision === "revise" && iter < maxIterations - 1) {
      console.log("[RepairSwarm] Arbiter requested revisions - continuing to next iteration");
      
      // Build revise notes for next iteration
      reviseNotes = [
        reviseNotes && `Previous notes:\n${reviseNotes}`,
        (review?.concerns ?? []).length ? `Reviewer concerns:\n- ${(review.concerns ?? []).join("\n- ")}` : "",
        arbiter?.rationale ? `Arbiter rationale:\n${arbiter.rationale}` : "",
      ]
        .filter(Boolean)
        .join("\n\n");
      
      continue;
    }
    
    // revise but out of iterations, or unknown decision
    console.log(`[RepairSwarm] Max iterations reached or unknown decision - stopping`);
    stopReason = "max_iters";
    break;
  }
  
  const patch = finalPatch;
  const review = finalReview;
  const arbiter = finalArbiter;
  
  // Create RepairPacket
  const repairPacket = createRepairPacket({
    failurePacket,
    diagnosis: {
      likelyCause: diagnosis.likelyCause,
      confidence: diagnosis.confidence,
      relatedIssues: diagnosis.relatedIssues,
      models: {
        coder: "openai/gpt-5-2",
        reviewer: "claude-sonnet-4-20250514",
        arbiter: "openai/gpt-5-2",
      },
    },
    patchPlan: {
      changes: arbiter.finalPatch?.changes || patch.changes,
      testPlan: patch.testPlan,
      // Use fixture's testCommands if provided, otherwise use AI-generated ones
      testCommands: failurePacket.testCommands && failurePacket.testCommands.length > 0
        ? normalizeTestCommands(failurePacket.testCommands).map(cmd => {
            // Convert string command to structured format
            const parts = splitCommandLine(cmd);
            return { cmd: parts[0], args: parts.slice(1) };
          })
        : patch.testCommands,
      rollbackPlan: patch.rollbackPlan,
    },
    execution: {
      applied: arbiter.decision === "apply",
      testsPassed: false, // Will be updated after tests run
      stopReason: arbiter.decision === "apply" ? "ok" : "human_review_required",
      logs: [
        `Field General: ${diagnosis.likelyCause}`,
        `Coder: ${(patch.changes ?? []).length} changes proposed`,
        `Reviewer: ${review.approved ? "APPROVED" : "REJECTED"}`,
        `Arbiter: ${arbiter.decision.toUpperCase()}`,
      ],
      latencyMs: Date.now() - startMs,
      costUsd: totalCostUsd,
    },
    scorecard: {
      coderScore: review.approved ? 0.9 : 0.5,
      reviewerScore: (review.concerns ?? []).length === 0 ? 0.9 : 0.7,
      arbiterScore: arbiter.decision === "apply" ? 0.9 : 0.5,
      overallScore: arbiter.decision === "apply" ? 0.85 : 0.5,
      trustDelta: arbiter.decision === "apply" ? +0.05 : -0.02,
    },
    audit: {
      coderProposal: JSON.stringify(patch.changes, null, 2),
      reviewerCritique: JSON.stringify({ approved: review.approved, concerns: review.concerns, suggestions: review.suggestions }, null, 2),
      arbiterDecision: `${arbiter.decision.toUpperCase()}: ${arbiter.rationale}`,
    },
  });
  
  console.log(`[RepairSwarm] Complete: ${stopReason} | Cost: $${totalCostUsd.toFixed(2)} | Latency: ${totalLatencyMs}ms`);
  
  return {
    repairPacket,
    stopReason: stopReason === "ok" ? "ok" : "patch_failed",
    totalCostUsd,
    totalLatencyMs: Date.now() - startMs,
  };
}
// Auto-repair pipeline stabilization - Thu Jan 22 05:41:28 EST 2026
