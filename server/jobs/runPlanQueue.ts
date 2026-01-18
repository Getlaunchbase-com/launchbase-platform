// server/jobs/runPlanQueue.ts
import fs from "node:fs";
import { executeRunPlan } from "../ai/orchestration/executeRunPlan";

const LOG_FILE = "/tmp/launchbase_jobs.log";
const queue: string[] = [];
let running = false;

function log(msg: string) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(msg);
}

export function enqueueExecuteRunPlan(runId: string) {
  log(`[runPlanQueue] Enqueuing runId: ${runId}`);
  queue.push(runId);
  void pump();
}

async function pump() {
  if (running) {
    log(`[runPlanQueue] pump already running, skipping`);
    return;
  }
  running = true;
  log(`[runPlanQueue] pump started, queue length=${queue.length}`);

  try {
    while (queue.length) {
      const runId = queue.shift()!;
      const startTime = Date.now();
      log(`[QUEUE] start runId=${runId}`);
      
      try {
        const result = await executeRunPlan(runId);
        const latency = Date.now() - startTime;
        log(`[QUEUE] done runId=${runId} status=${result?.status || 'unknown'} latency=${latency}ms`);
      } catch (err) {
        const latency = Date.now() - startTime;
        const errMsg = err instanceof Error ? err.message : String(err);
        const stack = err instanceof Error ? err.stack : '';
        log(`[QUEUE] failed runId=${runId} latency=${latency}ms error=${errMsg}`);
        log(`[QUEUE] stack: ${stack}`);
      }
    }
  } finally {
    running = false;
    log(`[runPlanQueue] pump finished`);
  }
}
