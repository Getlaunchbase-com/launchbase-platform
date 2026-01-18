// server/ai/orchestration/executeRunPlan.ts
import fs from "node:fs";
import path from "node:path";

import type { RunPlanV1, ShipPacketV1 } from "./types";

const LOG_FILE = "/tmp/launchbase_jobs.log";

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}
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
  const parsed = JSON.parse(raw);
  // Return just the stack property (not the wrapper with stackId/stackName)
  return parsed.stack;
}

export async function executeRunPlan(runId: string): Promise<{
  ok: boolean;
  status: "READY_FOR_REVIEW" | "DRAFT";
  message?: string;
}> {
  log(`[executeRunPlan] start runId=${runId}`);
  
  const rpRow = await getRunPlanByRunId(runId);
  if (!rpRow) {
    log(`[executeRunPlan] ERROR: RunPlan not found for runId=${runId}`);
    return { ok: false, status: "DRAFT", message: "RunPlan not found" };
  }
  log(`[executeRunPlan] loaded runPlanId=${rpRow.id} intakeId=${rpRow.intakeId} tier=${rpRow.tier}`);

  const shipRow = await getShipPacketByRunId(runId);
  if (!shipRow) {
    log(`[executeRunPlan] ERROR: ShipPacket not found for runId=${runId}`);
    return { ok: false, status: "DRAFT", message: "ShipPacket not found" };
  }
  log(`[executeRunPlan] loaded shipPacketId=${shipRow.id} status=${shipRow.status}`);

  const runPlan = rpRow.data as unknown as RunPlanV1;
  const ship = shipRow.data as unknown as ShipPacketV1;

  // Import macro lazily so server boot doesn't pull scripts unless needed.
  const { runPilotMacro } = await import("../../../scripts/pilot/runPilotMacro");
  log(`[executeRunPlan] runPilotMacro imported successfully`);

  const stack = loadProductionStack();
  log(`[executeRunPlan] stack loaded with ${Object.keys(stack).length} keys`);
  
  const lane = deriveLaneFromRunPlan(runPlan);
  log(`[executeRunPlan] lane=${lane}`);

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
  const t0 = Date.now();
  log(`[executeRunPlan] PROOF_OF_LIFE starting macro lane=${lane} runMode=${runPlan.runMode} creativeMode=${JSON.stringify(runPlan.creativeMode)} stackKeys=${JSON.stringify(Object.keys(stack))} t0=${t0}`);
  
  let result;
  try {
    result = await runPilotMacro({
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
  
    const dtMs = Date.now() - t0;
    log(`[executeRunPlan] PROOF_OF_LIFE macro finished runId=${runPlan.runId} dtMs=${dtMs} status=${result.status} totalUsd=${result.meta?.totalCostUsd?.toFixed(5)} latencySec=${(result.meta?.totalLatencyMs / 1000).toFixed(1)}`);
  } catch (err) {
    const dtMs = Date.now() - t0;
    const errMsg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : '';
    log(`[executeRunPlan] ERROR: runPilotMacro threw after ${dtMs}ms: ${errMsg}`);
    log(`[executeRunPlan] stack: ${stack}`);
    throw err;
  }

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

  // Gate READY_FOR_REVIEW on: proposal completeness (8 systems + 8 brand + critic with issues/fixes)
  // critic.pass is stored separately in execution.meta.pass for UI/portal logic
  const proposalComplete =
    result.systems?.changes?.length === 8 &&
    result.brand?.changes?.length === 8 &&
    result.critic?.issues?.length === 10 &&
    result.critic?.suggestedFixes?.length === 10;

  const nextStatus = proposalComplete ? "READY_FOR_REVIEW" : "DRAFT";
  
  if (nextStatus === "READY_FOR_REVIEW") {
    log(`[executeRunPlan] proposal complete (8/8/10/10), setting READY_FOR_REVIEW (critic.pass=${result.critic?.pass})`);
    await updateShipPacketStatus(shipRow.id, "READY_FOR_REVIEW");
    return { ok: true, status: "READY_FOR_REVIEW" };
  }

  log(`[executeRunPlan] proposal incomplete, staying DRAFT (systems=${result.systems?.changes?.length}, brand=${result.brand?.changes?.length}, critic.issues=${result.critic?.issues?.length})`);
  return { ok: true, status: "DRAFT", message: "Run completed but proposal incomplete" };
}
