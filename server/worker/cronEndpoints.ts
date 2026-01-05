/**
 * Cron Endpoints (Canonical Contract)
 * POST endpoints for external cron services (cron-job.org)
 * 
 * These are the ONLY endpoints external cron jobs should use.
 * /api/worker/* endpoints exist only for back-compat and will be removed.
 * 
 * Contract:
 * - Method: POST (except /health which is GET)
 * - Auth: Bearer token in Authorization header OR x-worker-token header
 * - Response: Always JSON
 * - Idempotent: Safe to call multiple times (lock prevents concurrent runs)
 * 
 * Implementation:
 * - Cron endpoints delegate to existing worker handlers (single code path)
 * - Import direction: cronEndpoints → worker (never the reverse)
 */

import type { Request, Response } from "express";
import { handleDeploymentWorker } from "./deploymentWorker";
import { handleAutoAdvanceWorker } from "./autoAdvanceWorker";
import { getDb } from "../db";
import { getDeprecatedHits } from "../_core/app";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * Start a worker run (best-effort logging)
 * Returns runKey (UUID) for later update, or null if logging fails
 */
async function startWorkerRun(job: string): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    
    const runKey = randomUUID();
    
    // Raw SQL to bypass type inference issues
    await db.execute(sql`
      INSERT INTO worker_runs (runKey, job, startedAt, processed)
      VALUES (${runKey}, ${job}, ${new Date()}, 0)
    `);
    
    console.log('[Cron] Started worker run:', runKey);
    return runKey;
  } catch (err) {
    console.warn("[Cron] Failed to start worker run log:", err);
    return null;
  }
}

/**
 * Finish a worker run (best-effort logging)
 * Updates the run with completion data using runKey
 */
async function finishWorkerRun(
  runKey: string | null,
  ok: boolean,
  processed: number,
  deploymentId?: number,
  error?: string,
  meta?: Record<string, unknown>
) {
  if (!runKey) {
    console.warn("[Cron] finishWorkerRun: no runKey, skipping");
    return;
  }
  
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[Cron] finishWorkerRun: no db connection");
      return;
    }
    
    // Raw SQL to bypass type inference issues - UPDATE by runKey
    await db.execute(sql`
      UPDATE worker_runs
      SET finishedAt = ${new Date()},
          ok = ${ok ? 1 : 0},
          processed = ${processed},
          deploymentId = ${deploymentId ?? null},
          error = ${error ?? null},
          meta = ${meta ? JSON.stringify(meta) : null}
      WHERE runKey = ${runKey}
    `);
    
    console.log(`[Cron] Finished worker run: ${runKey}`);
  } catch (err) {
    console.warn("[Cron] Failed to finish worker run log:", err);
  }
}

/**
 * POST /api/cron/run-next-deploy
 * Canonical endpoint for deployment worker
 * Delegates to existing worker logic with best-effort logging
 */
export async function handleCronRunNextDeploy(req: Request, res: Response) {
  const db = await getDb();
  
  const runId = await startWorkerRun("run-next-deploy");
  
  let ok = false;
  let processed = 0;
  let deploymentId: number | undefined;
  let error: string | null = null;
  
  try {
    await handleDeploymentWorker(req, res);
    ok = true;
  } catch (e: any) {
    ok = false;
    error = e?.message ?? String(e);
    
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: "worker_failed", 
        message: error 
      });
    }
  } finally {
    console.log(`[Cron] Finally block executing: runId=${runId}, ok=${ok}`);
    await finishWorkerRun(
      runId,
      ok,
      processed,
      deploymentId,
      error ?? undefined,
      { path: req.path }
    );
    console.log(`[Cron] Finally block completed`);
  }
}

/**
 * POST /api/cron/auto-advance
 * Canonical endpoint for auto-advance worker
 * Delegates to existing worker logic
 */
export async function handleCronAutoAdvance(req: Request, res: Response) {
  // Delegate to the existing worker logic (single code path)
  return handleAutoAdvanceWorker(req, res);
}

/**
 * GET /api/cron/health
 * Simple health check endpoint (unauthenticated)
 */
export async function handleCronHealth(_req: Request, res: Response) {
  const db = await getDb();
  
  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected",
    deprecatedWorkerHits: getDeprecatedHits(),
  });
}

/**
 * Handle GET requests to POST-only cron endpoints
 * Returns 405 Method Not Allowed with JSON and Allow header
 */
export function handleCronMethodNotAllowed(_req: Request, res: Response) {
  res.setHeader("Allow", "POST");
  return res.status(405).json({
    ok: false,
    error: "method_not_allowed",
    message: "This endpoint requires POST. Use POST /api/cron/* for cron jobs.",
    allowed: ["POST"],
  });
}
