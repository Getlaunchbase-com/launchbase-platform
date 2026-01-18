/**
 * runDesignerMacro.ts
 *
 * 3-step sequential macro runner:
 * 1) designer_systems_fast → EXACTLY 8 changes (design.*)
 * 2) designer_brand_fast → EXACTLY 8 changes (brand.*)
 * 3) design_critic_ruthless → ≥10 issues + ≥10 fixes
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index";

type RoleConfig = {
  transport: "aiml";
  model: string;
  capabilities?: string[];
  timeoutMs?: number;
  costCapUsd?: number;
};

function loadPolicy(policyPath: string) {
  return JSON.parse(fs.readFileSync(policyPath, "utf-8"));
}

function getRoleConfig(policy: any, roleName: string): RoleConfig {
  const cfg = policy?.swarm?.roles?.[roleName];
  if (!cfg) throw new Error(`Missing roleConfig for "${roleName}"`);
  if (!cfg.model) throw new Error(`Missing model for "${roleName}"`);
  return cfg as RoleConfig;
}

const RUNS_DIR = "/home/ubuntu/launchbase/runs";
const TODAY = new Date().toISOString().slice(0, 10);

function makeRunId(prefix = "macro") {
  const rand = crypto.randomBytes(3).toString("hex");
  const counter = Date.now().toString().slice(-6);
  return `${prefix}_${counter}_${rand}`;
}

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function writeJson(filePath: string, obj: any) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf-8");
}

function writeText(filePath: string, text: string) {
  fs.writeFileSync(filePath, text, "utf-8");
}

type MacroWorkOrder = {
  inputs: Record<string, any>;
  plan?: any;
};

function buildBaseTrace(meta: Record<string, any> = {}) {
  return {
    traceId: crypto.randomUUID(),
    startedAt: new Date().toISOString(),
    ...meta,
  };
}

function buildCriticInput(params: {
  plan: any;
  workOrderInputs: any;
  systemsCraft?: any;
  brandCraft?: any;
}) {
  const assumptions: string[] = [];
  if (!params.systemsCraft?.proposedChanges?.length) assumptions.push("No systems designer output");
  if (!params.brandCraft?.proposedChanges?.length) assumptions.push("No brand designer output");

  return {
    plan: params.plan,
    context: params.workOrderInputs,
    upstreamDesignerOutputs: {
      systems: params.systemsCraft ?? null,
      brand: params.brandCraft ?? null,
    },
    assumptionsFromRunner: assumptions.length ? assumptions : undefined,
  };
}

export async function runDesignerMacro(workOrder: MacroWorkOrder, opts?: {
  enableLadder?: boolean;
  timeoutMs?: number;
  policyPath?: string;
}) {
  const policyPath = opts?.policyPath ?? "/home/ubuntu/launchbase/server/ai/engine/policy/policies/swarm_gate_a_control.json";
  const policy = loadPolicy(policyPath);
  
  const systemsRoleConfig = getRoleConfig(policy, "designer_systems_fast");
  const brandRoleConfig = getRoleConfig(policy, "designer_brand_fast");
  const criticRoleConfig = getRoleConfig(policy, "design_critic_ruthless");
  
  const runId = makeRunId("designer_macro");
  const runDir = path.join(RUNS_DIR, TODAY, runId);
  ensureDir(runDir);

  const trace = buildBaseTrace({ runId, enableLadder: opts?.enableLadder ?? false });
  writeJson(path.join(runDir, "WORKORDER.json"), workOrder);
  writeJson(path.join(runDir, "TRACE.json"), trace);

  // STEP 1: Systems Designer
  const systemsTrace = { ...trace, step: "designer_systems_fast" };
  const systemsInput = { plan: workOrder.plan, context: workOrder.inputs };

  const systemsRes = await callSpecialistWithRetry({
    role: "designer_systems_fast" as any,
    roleConfig: systemsRoleConfig,
    input: systemsInput,
    trace: systemsTrace,
    enableLadder: opts?.enableLadder ?? false,
  });

  writeJson(path.join(runDir, "systems_result.json"), systemsRes);
  const systemsPayload = (systemsRes as any).artifact?.payload || systemsRes.payload;

  // STEP 2: Brand Designer
  const brandTrace = { ...trace, step: "designer_brand_fast" };
  const brandInput = { plan: workOrder.plan, context: workOrder.inputs };

  const brandRes = await callSpecialistWithRetry({
    role: "designer_brand_fast" as any,
    roleConfig: brandRoleConfig,
    input: brandInput,
    trace: brandTrace,
    enableLadder: opts?.enableLadder ?? false,
  });

  writeJson(path.join(runDir, "brand_result.json"), brandRes);
  const brandPayload = (brandRes as any).artifact?.payload || brandRes.payload;

  // STEP 3: Ruthless Critic
  const criticTrace = { ...trace, step: "design_critic_ruthless" };
  const criticInput = buildCriticInput({
    plan: workOrder.plan,
    workOrderInputs: workOrder.inputs,
    systemsCraft: systemsPayload,
    brandCraft: brandPayload,
  });

  const criticRes = await callSpecialistWithRetry({
    role: "design_critic_ruthless" as any,
    roleConfig: criticRoleConfig,
    input: criticInput,
    trace: criticTrace,
    enableLadder: opts?.enableLadder ?? false,
  });

  writeJson(path.join(runDir, "critic_result.json"), criticRes);
  const criticPayload = (criticRes as any).artifact?.payload || criticRes.payload;

  // SUMMARY
  const summary = {
    runId,
    enableLadder: opts?.enableLadder ?? false,
    ok: systemsRes.stopReason === "ok" && brandRes.stopReason === "ok" && criticRes.stopReason === "ok",
    systems: {
      ok: systemsRes.stopReason === "ok",
      stopReason: systemsRes.stopReason,
      model: systemsRes.finalModelUsed ?? systemsRes.modelUsed,
      costUsd: systemsRes.costUsd,
      tokens: { in: systemsRes.inputTokens, out: systemsRes.outputTokens },
      changes: systemsPayload?.proposedChanges?.length ?? 0,
      attemptCount: systemsRes.attemptCount,
      attemptModels: systemsRes.attemptModels,
    },
    brand: {
      ok: brandRes.stopReason === "ok",
      stopReason: brandRes.stopReason,
      model: brandRes.finalModelUsed ?? brandRes.modelUsed,
      costUsd: brandRes.costUsd,
      tokens: { in: brandRes.inputTokens, out: brandRes.outputTokens },
      changes: brandPayload?.proposedChanges?.length ?? 0,
      attemptCount: brandRes.attemptCount,
      attemptModels: brandRes.attemptModels,
    },
    critic: {
      ok: criticRes.stopReason === "ok",
      stopReason: criticRes.stopReason,
      model: criticRes.finalModelUsed ?? criticRes.modelUsed,
      costUsd: criticRes.costUsd,
      tokens: { in: criticRes.inputTokens, out: criticRes.outputTokens },
      issues: criticPayload?.issues?.length ?? 0,
      fixes: criticPayload?.suggestedFixes?.length ?? 0,
      requiresApproval: criticPayload?.requiresApproval ?? true,
      attemptCount: criticRes.attemptCount,
      attemptModels: criticRes.attemptModels,
    },
    totalCostUsd: (systemsRes.costUsd ?? 0) + (brandRes.costUsd ?? 0) + (criticRes.costUsd ?? 0),
  };

  writeJson(path.join(runDir, "SUMMARY.json"), summary);

  const report = `
# Designer Macro Run

Run: ${runId}
Ladder: ${opts?.enableLadder ? "enabled" : "disabled"}

## Systems
- ok: ${summary.systems.ok}
- stopReason: ${summary.systems.stopReason}
- model: ${summary.systems.model ?? "unknown"}
- changes: ${summary.systems.changes}
- attempts: ${summary.systems.attemptCount ?? 1}

## Brand
- ok: ${summary.brand.ok}
- stopReason: ${summary.brand.stopReason}
- model: ${summary.brand.model ?? "unknown"}
- changes: ${summary.brand.changes}
- attempts: ${summary.brand.attemptCount ?? 1}

## Critic
- ok: ${summary.critic.ok}
- stopReason: ${summary.critic.stopReason}
- model: ${summary.critic.model ?? "unknown"}
- issues: ${summary.critic.issues}
- fixes: ${summary.critic.fixes}
- requiresApproval: ${summary.critic.requiresApproval}
- attempts: ${summary.critic.attemptCount ?? 1}

## Total
- Cost: $${summary.totalCostUsd.toFixed(4)}
- Success: ${summary.ok ? "✅" : "❌"}
`;
  writeText(path.join(runDir, "REPORT.md"), report.trim());

  return { runDir, summary };
}

// CLI entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    const workOrder: MacroWorkOrder = {
      inputs: {
        productName: "LaunchBase",
        primaryGoal: "Homepage design improvements",
        audience: "Small business owners",
        brief: "LaunchBase is an operating system for small businesses: ongoing responsibility + visibility/observability. Promise: hand it off without losing control.",
      },
      plan: {
        objective: "Improve conversion clarity, trust, premium feel",
      },
    };

    const out = await runDesignerMacro(workOrder, {
      enableLadder: false,
      timeoutMs: 90000,
    });

    console.log("✅ Macro run complete:", out.runDir);
    console.log("Summary:", JSON.stringify(out.summary, null, 2));
  })().catch((err) => {
    console.error("❌ Macro run failed:", err);
    process.exit(1);
  });
}
