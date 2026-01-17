// server/jobs/runPlanQueue.ts
import { executeRunPlan } from "../ai/orchestration/executeRunPlan";

const queue: string[] = [];
let running = false;

export function enqueueExecuteRunPlan(runId: string) {
  console.log(`[runPlanQueue] Enqueuing runId: ${runId}`);
  queue.push(runId);
  void pump();
}

async function pump() {
  if (running) return;
  running = true;

  try {
    while (queue.length) {
      const runId = queue.shift()!;
      console.log(`[runPlanQueue] Executing runId: ${runId}`);
      try {
        const result = await executeRunPlan(runId);
        console.log(`[runPlanQueue] Completed runId: ${runId}`, result);
      } catch (err) {
        console.error("[runPlanQueue] executeRunPlan failed", { runId, err });
      }
    }
  } finally {
    running = false;
  }
}
