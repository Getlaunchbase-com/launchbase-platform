/**
 * RepairPacketV1 Contract
 * 
 * Output from the Auto-Swarm Fix Engine.
 * Contains diagnosis, patch plan, and scorecard for the repair attempt.
 * 
 * Constitutional Rules:
 * - Every repair attempt MUST produce a RepairPacket
 * - Include full audit trail (Coder → Reviewer → Arbiter)
 * - Track success/failure for agent trust ranking
 * - Link back to original FailurePacket
 */

import type { FailurePacketV1 } from "./failurePacket";

export type RepairPacketV1 = {
  version: "repairpacket.v1";
  
  meta: {
    timestamp: string; // ISO 8601 timestamp
    repairId: string; // Unique repair ID
    failurePacketId: string; // ID of the FailurePacket being repaired
    sha: string; // Git commit SHA at time of repair
    environment: "dev" | "staging" | "production";
  };
  
  diagnosis: {
    likelyCause: string; // AI-generated root cause analysis
    confidence: number; // 0.0-1.0 confidence in diagnosis
    relatedIssues: string[]; // Related failure patterns
    models: {
      coder: string; // Model used for Coder role
      reviewer: string; // Model used for Reviewer role
      arbiter: string; // Model used for Arbiter role
    };
  };
  
  patchPlan: {
    changes: Array<{
      file: string; // File path to modify
      operation: "edit" | "create" | "delete"; // Type of change
      description: string; // What this change does
      diff?: string; // Unified diff (if applicable)
      rationale: string; // Why this change fixes the issue
    }>;
    testPlan: string[]; // Human-readable test steps (not executed)
    testCommands?: Array<{
      cmd: string; // Command to execute (e.g., "pnpm")
      args: string[]; // Command arguments (e.g., ["typecheck"])
      cwd?: string; // Working directory (optional)
    }>; // Machine-safe test commands (executed with shell:false)
    rollbackPlan: string; // How to undo if fix fails
  };
  
  execution: {
    applied: boolean; // Whether the patch was applied
    testsPassed: boolean; // Whether tests passed after applying
    stopReason: "ok" | "tests_failed" | "patch_failed" | "patch_invalid_format" | "tests_missing_testCommands" | "human_review_required";
    logs: string[]; // Execution logs
    latencyMs: number; // Time taken for repair
    costUsd: number; // Cost of repair swarm
  };
  
  scorecard: {
    coderScore: number; // 0.0-1.0 quality of proposed fix
    reviewerScore: number; // 0.0-1.0 quality of review
    arbiterScore: number; // 0.0-1.0 quality of final decision
    overallScore: number; // 0.0-1.0 overall repair quality
    trustDelta: number; // Change in trust score for this agent
  };
  
  audit: {
    coderProposal: string; // Coder's proposed fix
    reviewerCritique: string; // Reviewer's critique
    arbiterDecision: string; // Arbiter's final decision
    humanOverride?: string; // Human intervention notes (if any)
  };
};

/**
 * Validate RepairPacketV1 structure
 */
export function validateRepairPacket(packet: any): packet is RepairPacketV1 {
  if (packet.version !== "repairpacket.v1") return false;
  if (!packet.meta?.timestamp || !packet.meta?.repairId || !packet.meta?.failurePacketId) return false;
  if (!packet.diagnosis?.likelyCause || typeof packet.diagnosis?.confidence !== "number") return false;
  if (!packet.patchPlan?.changes || !Array.isArray(packet.patchPlan.changes)) return false;
  if (typeof packet.execution?.applied !== "boolean") return false;
  if (!packet.scorecard || typeof packet.scorecard.overallScore !== "number") return false;
  if (!packet.audit?.coderProposal || !packet.audit?.reviewerCritique || !packet.audit?.arbiterDecision) return false;
  
  return true;
}

/**
 * Create a RepairPacket from a repair attempt
 */
export function createRepairPacket(opts: {
  failurePacket: FailurePacketV1;
  diagnosis: RepairPacketV1["diagnosis"];
  patchPlan: RepairPacketV1["patchPlan"];
  execution: RepairPacketV1["execution"];
  scorecard: RepairPacketV1["scorecard"];
  audit: RepairPacketV1["audit"];
}): RepairPacketV1 {
  return {
    version: "repairpacket.v1",
    meta: {
      timestamp: new Date().toISOString(),
      repairId: `repair_${Date.now()}`,
      failurePacketId: `failure_${opts.failurePacket.meta.timestamp}_${opts.failurePacket.meta.sha}`,
      sha: process.env.GIT_SHA || "unknown",
      environment: (process.env.NODE_ENV as any) || "dev",
    },
    diagnosis: opts.diagnosis,
    patchPlan: opts.patchPlan,
    execution: opts.execution,
    scorecard: opts.scorecard,
    audit: opts.audit,
  };
}

/**
 * Example RepairPacket for reference
 */
export const EXAMPLE_REPAIR_PACKET: RepairPacketV1 = {
  version: "repairpacket.v1",
  meta: {
    timestamp: "2026-01-18T06:15:00.000Z",
    repairId: "repair_1768716900000",
    failurePacketId: "failure_2026-01-18T06:00:00.000Z_624931f3",
    sha: "624931f3",
    environment: "dev",
  },
  diagnosis: {
    likelyCause: "aimlSpecialist.ts hardcoded to use critic prompt for all non-craft roles",
    confidence: 0.95,
    relatedIssues: ["prompt_loading", "role_routing"],
    models: {
      coder: "openai/gpt-5-2",
      reviewer: "claude-sonnet-4-20250514",
      arbiter: "openai/gpt-5-2",
    },
  },
  patchPlan: {
    changes: [
      {
        file: "server/ai/engine/specialists/aimlSpecialist.ts",
        operation: "edit",
        description: "Add loadPrompt() function to load prompts from promptPacks/ directory",
        diff: `@@ -110,14 +110,20 @@\n+function loadPrompt(role: string): string {\n+  const promptDir = path.join(__dirname, "promptPacks");\n+  const filePath = path.join(promptDir, \`\${role}.md\`);\n+  if (fs.existsSync(filePath)) {\n+    return fs.readFileSync(filePath, "utf-8");\n+  }\n+  return "Generic fallback prompt";\n+}`,
        rationale: "Loads correct prompt based on role name instead of hardcoded critic prompt",
      },
    ],
    testPlan: [
      "Run smoke test: npx tsx scripts/smoke/smokeCreativeProduction.ts",
      "Verify systems payload has proposedChanges array",
      "Verify selector returns 8 changes",
      "Verify full swarm completes with status VALID",
    ],
    rollbackPlan: "git checkout server/ai/engine/specialists/aimlSpecialist.ts",
  },
  execution: {
    applied: true,
    testsPassed: true,
    stopReason: "ok",
    logs: [
      "[repair_1768716900000] Applying patch to aimlSpecialist.ts",
      "[repair_1768716900000] Running smoke test",
      "[repair_1768716900000] ✅ Smoke test passed",
    ],
    latencyMs: 45000,
    costUsd: 0.12,
  },
  scorecard: {
    coderScore: 0.95,
    reviewerScore: 0.90,
    arbiterScore: 0.92,
    overallScore: 0.92,
    trustDelta: +0.05,
  },
  audit: {
    coderProposal: "Load prompts from promptPacks/ directory using fs.readFileSync()",
    reviewerCritique: "Good approach, but needs __dirname fix for ES modules",
    arbiterDecision: "Approved with reviewer's suggestion to add fileURLToPath for __dirname",
  },
};
