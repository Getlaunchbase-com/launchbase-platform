// server/ai/orchestration/executeRunPlan.ts
import fs from "node:fs";
import path from "node:path";

import type { RunPlanV1, ShipPacketV1 } from "./types";
import {
  getRunPlanByRunId,
  getShipPacketByRunId,
  updateShipPacketStatus,
  updateShipPacketData,
} from "../../db";

type Lane = "web" | "marketing" | "app" | "artwork";

function deriveLaneFromRunPlan(plan: RunPlanV1): Lane {
  // Spec note: default to "web" unless you have a real mapper
  // (you can upgrade later using intake.vertical/industry).
  return "web";
}

function loadProductionStack(): any {
  // Adjust if your runtime CWD differs. This matches the spec path.
  const p = path.resolve(process.cwd(), "config/stacks/stack_creative_production_default.json");
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

export async function executeRunPlan(runId: string): Promise<{
  ok: boolean;
  status: "READY_FOR_REVIEW" | "DRAFT";
  message?: string;
}> {
  const rpRow = await getRunPlanByRunId(runId);
  if (!rpRow) return { ok: false, status: "DRAFT", message: "RunPlan not found" };

  const shipRow = await getShipPacketByRunId(runId);
  if (!shipRow) return { ok: false, status: "DRAFT", message: "ShipPacket not found" };

  const runPlan = rpRow.data as unknown as RunPlanV1;
  const ship = shipRow.data as unknown as ShipPacketV1;

  // Import macro lazily so server boot doesn't pull scripts unless needed.
  const { runPilotMacro } = await import("../../../scripts/pilot/runPilotMacro");

  const stack = loadProductionStack();
  const lane = deriveLaneFromRunPlan(runPlan);

  // "plan" is your work order. Per spec: built from packs.systems.params.
  const plan = {
    runId: runPlan.runId,
    jobId: runPlan.jobId,
    tier: runPlan.tier,
    packs: runPlan.packs,
    truth: runPlan.truth,
    ...(runPlan.packs?.systems?.params ?? {}),
  };

  // "context" comes from RunPlan knobs (creativeMode/runMode).
  const context = {
    creativeMode: runPlan.creativeMode,
    policy: {
      allowNormalization: runPlan.runMode === "production",
      requiresApproval: true,
    },
    budgets: runPlan.budgets,
    builderGate: runPlan.builderGate,
  };

  // Execute one loop (rep=0). Looping belongs in the job runner.
  const result = await runPilotMacro({
    lane,
    rep: 0,
    runId: runPlan.runId,
    jobId: runPlan.jobId,
    plan,
    context,
    stack,
    maxAttempts: 3,
    runMode: runPlan.runMode,
  });

  const nextShip: ShipPacketV1 = {
    ...ship,
    proposal: {
      systems: result.systems,
      brand: result.brand,
      critic: result.critic,
    },
    execution: {
      ...ship.execution,
      // optionally record metrics from meta
      // (keep execution.buildPlanId + builderSnapshotId unchanged here)
      meta: {
        status: result.status,
        pass: Boolean(result.critic?.pass),
        totalCostUsd: result.meta?.totalCostUsd,
        totalLatencyMs: result.meta?.totalLatencyMs,
        models: result.meta?.models,
        attempts: result.meta?.attempts,
      },
    } as any,
  };

  await updateShipPacketData(shipRow.id, nextShip as any);

  // Gate READY_FOR_REVIEW on: VALID + critic.pass true.
  const isReady = result.status === "VALID" && Boolean(result.critic?.pass);
  if (isReady) {
    await updateShipPacketStatus(shipRow.id, "READY_FOR_REVIEW");
    return { ok: true, status: "READY_FOR_REVIEW" };
  }

  return { ok: true, status: "DRAFT", message: "Run completed but did not pass gates" };
}
