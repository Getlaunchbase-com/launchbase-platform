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

/**
 * POST /api/cron/run-next-deploy
 * Canonical endpoint for deployment worker
 * Delegates to existing worker logic
 */
export async function handleCronRunNextDeploy(req: Request, res: Response) {
  // Delegate to the existing worker logic (single code path)
  return handleDeploymentWorker(req, res);
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
