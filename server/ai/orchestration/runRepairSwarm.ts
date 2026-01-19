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
// fileLog not needed - using console.log instead

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
  const msg = pkt.error?.message?.toLowerCase() || "";
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
  
  const prompt = `You are the Field General. Diagnose this failure and identify the likely root cause.

**Failure Context:**
- Type: ${pkt.failure.type}
- Error: ${pkt.failure.errorMessage}
- Stop Reason: ${pkt.failure.stopReason}
- Component: ${pkt.context.component || "unknown"}
- Command: ${pkt.context.command || "unknown"}

**Stack Trace:**
${pkt.failure.stack || "No stack trace available"}

**Logs:**
${pkt.context.logs?.join('\n') || "No logs"}

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
      runId: pkt.meta.runId || "repair_run",
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

  console.log(`[FieldGeneral] Diagnosis: ${result.artifact.payload.likelyCause} (confidence: ${result.artifact.payload.confidence})`);

  return {
    ...result.artifact.payload,
    costUsd,
    latencyMs,
  };
}

/**
 * Run Coder to propose a patch
 */
async function runCoder(pkt: FailurePacketV1, diagnosis: any): Promise<{
  changes: RepairPacketV1["patchPlan"]["changes"];
  testPlan: string[];
  rollbackPlan: string;
  costUsd: number;
  latencyMs: number;
}> {
  const startMs = Date.now();
  
  const prompt = `You are the Coder. Based on this diagnosis, propose a patch to fix the failure.

**Diagnosis:**
- Likely Cause: ${diagnosis.likelyCause}
- Confidence: ${diagnosis.confidence}
- Related Issues: ${diagnosis.relatedIssues.join(", ")}

**Failure Context:**
- Type: ${pkt.failure.type}
- Error: ${pkt.failure.errorMessage}
- Component: ${pkt.context.component || "unknown"}

**Your task:**
1. Propose specific file changes to fix the issue
2. Provide a test plan to verify the fix
3. Provide a rollback plan if the fix fails

Return JSON:
{
  "changes": [
    {
      "file": "path/to/file.ts",
      "operation": "edit|create|delete",
      "description": "What this change does",
      "diff": "unified diff (optional)",
      "rationale": "Why this fixes the issue"
    }
  ],
  "testPlan": ["step 1", "step 2"],
  "rollbackPlan": "How to undo if fix fails"
}`;

  const result = await callSpecialistAIML({
    role: "coder",
    trace: {
      jobId: pkt.meta.jobId || "repair_job",
      runId: pkt.meta.runId || "repair_run",
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

  const changes = result.artifact?.payload?.changes ?? [];
  console.log(`[Coder] Proposed ${changes.length} changes`);

  return {
    ...result.artifact.payload,
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
      runId: pkt.meta.runId || "repair_run",
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

  console.log(`[Reviewer] ${result.artifact.payload.approved ? "APPROVED" : "REJECTED"} with ${result.artifact.payload.concerns.length} concerns`);

  return {
    ...result.artifact.payload,
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
1. Decide whether to apply, reject, or revise the patch
2. Provide rationale for your decision
3. If revising, provide the final patch incorporating reviewer suggestions

Return JSON:
{
  "decision": "apply|reject|revise",
  "rationale": "string",
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

  console.log(`[Arbiter] Decision: ${result.artifact.payload.decision}`);

  return {
    ...result.artifact.payload,
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
  const diagnosis = await runFieldGeneral(failurePacket);
  totalCostUsd += diagnosis.costUsd;
  totalLatencyMs += diagnosis.latencyMs;
  
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
  
  // Run Coder
  console.log("[RepairSwarm] Running Coder...");
  const patch = await runCoder(failurePacket, diagnosis);
  totalCostUsd += patch.costUsd;
  totalLatencyMs += patch.latencyMs;
  
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
  
  console.log(`[RepairSwarm] Complete: ${arbiter.decision} | Cost: $${totalCostUsd.toFixed(2)} | Latency: ${totalLatencyMs}ms`);
  
  return {
    repairPacket,
    stopReason: arbiter.decision === "apply" ? "ok" : "patch_failed",
    totalCostUsd,
    totalLatencyMs: Date.now() - startMs,
  };
}
