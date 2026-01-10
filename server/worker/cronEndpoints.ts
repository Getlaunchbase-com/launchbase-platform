/**
 * Cron Endpoints (Canonical Contract)
 * POST endpoints for external cron services (cron-job.org)
 * 
 * These are the ONLY endpoints external cron jobs should use.
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
import { processAlerts, type AlertsRunSummary } from "../_core/alerts";
import { getHealthMetrics } from "../health";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import { checkWorkerSchema, buildMeta } from "../schemaGuard";
import { alertSchemaOutOfDate } from "../schemaOutOfDateAlert";

// Worker secret token - MUST be set in environment for production
const WORKER_TOKEN = process.env.WORKER_TOKEN;

// Rate limiting: track last run time to prevent double-fires
let lastAlertsRun: number = 0;
const MIN_ALERTS_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * Verify worker request has valid secret token
 * Accepts both x-worker-token header and Authorization Bearer header
 */
function verifyWorkerToken(req: Request): boolean {
  // Reject if no token configured (security: don't allow default)
  if (!WORKER_TOKEN) {
    console.error("[Cron] WORKER_TOKEN not configured - rejecting all requests");
    return false;
  }
  const token = req.headers["x-worker-token"] || req.headers["authorization"]?.replace("Bearer ", "");
  return token === WORKER_TOKEN;
}

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
  // Check schema before running worker logic
  const schema = await checkWorkerSchema();
  if (!schema.ok) {
    console.warn("[Cron] Schema out of date, skipping run-next-deploy", schema.missing);
    
    // Send ops alert (deduped)
    const meta = buildMeta();
    await alertSchemaOutOfDate({
      endpoint: "/api/cron/run-next-deploy",
      schemaKey: schema.schemaKey,
      missingColumns: schema.missing,
      buildId: meta.buildId,
      serverTime: meta.serverTime,
    });
    
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: "schema_out_of_date",
      schemaKey: schema.schemaKey,
      missingColumns: schema.missing,
      ...meta,
    });
  }
  
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
  // Check schema before running worker logic
  const schema = await checkWorkerSchema();
  if (!schema.ok) {
    console.warn("[Cron] Schema out of date, skipping auto-advance", schema.missing);
    
    // Send ops alert (deduped)
    const meta = buildMeta();
    await alertSchemaOutOfDate({
      endpoint: "/api/cron/auto-advance",
      schemaKey: schema.schemaKey,
      missingColumns: schema.missing,
      buildId: meta.buildId,
      serverTime: meta.serverTime,
    });
    
    return res.status(200).json({
      success: true,
      skipped: true,
      reason: "schema_out_of_date",
      schemaKey: schema.schemaKey,
      missingColumns: schema.missing,
      ...meta,
    });
  }
  
  // Delegate to the existing worker logic (single code path)
  return handleAutoAdvanceWorker(req, res);
}

/**
 * POST /api/cron/alerts
 * Evaluate health metrics and send alerts
 * Runs every 10-15 minutes to detect issues
 */
export async function handleCronAlerts(req: Request, res: Response) {
  // Verify token first
  if (!verifyWorkerToken(req)) {
    console.error("[Alerts] Unauthorized request - invalid token");
    return res.status(401).json({ 
      success: false, 
      error: "unauthorized",
      message: "Invalid or missing worker token" 
    });
  }
  
  // Rate limiting: prevent double-fires from scheduler
  const now = Date.now();
  const timeSinceLastRun = now - lastAlertsRun;
  if (lastAlertsRun > 0 && timeSinceLastRun < MIN_ALERTS_INTERVAL_MS) {
    const waitSeconds = Math.ceil((MIN_ALERTS_INTERVAL_MS - timeSinceLastRun) / 1000);
    console.log(`[Alerts] Rate limited - last run was ${Math.floor(timeSinceLastRun / 1000)}s ago`);
    return res.status(200).json({
      success: true,
      skipped: true,
      message: `Rate limited - try again in ${waitSeconds}s`,
      timeSinceLastRun: Math.floor(timeSinceLastRun / 1000),
      minInterval: MIN_ALERTS_INTERVAL_MS / 1000,
    });
  }
  
  // Update last run time
  lastAlertsRun = now;
  
  const runId = await startWorkerRun("alerts");
  
  let ok = false;
  let processed = 0;
  let error: string | null = null;
  
  try {
    // Evaluate alerts for both tenants
    const tenants: ("launchbase" | "vinces")[] = ["launchbase", "vinces"];
    
    // Aggregate stats across all tenants
    const aggregateStats: AlertsRunSummary = {
      tenantsProcessed: 0,
      created: 0,
      sent: 0,
      deduped: 0,
      resolved: 0,
      skippedRateLimit: false,
      alerts: [],
    };
    
    for (const tenant of tenants) {
      try {
        // Get health metrics for this tenant
        const metrics = await getHealthMetrics(tenant);
        
        // Process alerts (upsert + send if new)
        const stats = await processAlerts(metrics);
        
        // Aggregate stats
        aggregateStats.tenantsProcessed++;
        aggregateStats.created += stats.created;
        aggregateStats.sent += stats.sent;
        aggregateStats.deduped += stats.deduped;
        aggregateStats.resolved += stats.resolved;
        aggregateStats.alerts.push(...stats.alerts);
        
        processed++;
        console.log(`[Alerts] Processed alerts for tenant: ${tenant}`);
      } catch (tenantError) {
        const msg = tenantError instanceof Error ? tenantError.message : String(tenantError);
        console.error(`[Alerts] Failed to process alerts for ${tenant}:`, msg);
        // Continue to next tenant instead of failing entire job
      }
    }
    
    // Limit alerts array to last 10 for readability
    aggregateStats.alerts = aggregateStats.alerts.slice(-10);
    
    ok = true;
    
    // Add no-cache headers to prevent stale responses
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('CDN-Cache-Control', 'no-store');
    
    res.status(200).json({
      success: true,
      ...buildMeta(),
      ...aggregateStats,
    });
  } catch (e: any) {
    ok = false;
    error = e?.message ?? String(e);
    
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: "alerts_failed",
        message: error,
      });
    }
  } finally {
    await finishWorkerRun(
      runId,
      ok,
      processed,
      undefined,
      error ?? undefined,
      { path: req.path }
    );
  }
}

/**
 * GET /api/cron/health
 * Simple health check endpoint (unauthenticated)
 * Shows database status and last worker run for observability
 */
export async function handleCronHealth(_req: Request, res: Response) {
  const db = await getDb();
  
  let lastWorkerRun: any = null;
  if (db) {
    try {
      const result = await db.execute(sql`
        SELECT runKey, job, startedAt, finishedAt, ok, processed
        FROM worker_runs
        ORDER BY startedAt DESC
        LIMIT 1
      `);
      lastWorkerRun = (result as any)[0] || null;
    } catch (err) {
      console.warn("[Health] Failed to fetch last worker run:", err);
    }
  }
  
  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected",
    lastWorkerRun,
  });
}

/**
 * Handle GET requests to POST-only cron endpoints
 * Returns 405 Method Not Allowed with JSON and Allow header
 */
/**
 * POST /api/cron/action-requests
 * Sequencer for Day 0-3 action request emails
 * Runs every 15 minutes
 */
export async function handleCronActionRequests(req: Request, res: Response) {
  // Verify token first
  if (!verifyWorkerToken(req)) {
    console.error("[ActionRequests] Unauthorized request - invalid token");
    return res.status(401).json({ 
      success: false, 
      error: "unauthorized",
      message: "Invalid WORKER_TOKEN"
    });
  }

  try {
    const { handleActionRequestSequencer } = await import("./actionRequestSequencer.js");
    const result = await handleActionRequestSequencer();
    
    return res.status(200).json({
      success: result.success,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[ActionRequests] Cron error:", err);
    return res.status(500).json({
      success: false,
      error: "internal_error",
      message: err instanceof Error ? err.message : "Unknown error",
    });
  }
}

export function handleCronMethodNotAllowed(_req: Request, res: Response) {
  res.setHeader("Allow", "POST");
  return res.status(405).json({
    ok: false,
    error: "method_not_allowed",
    message: "This endpoint requires POST. Use POST /api/cron/* for cron jobs.",
    allowed: ["POST"],
  });
}
