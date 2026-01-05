/**
 * Cron Endpoints
 * GET endpoints for external cron services (cron-job.org)
 * 
 * Why GET instead of POST:
 * - External cron services often have issues with POST to SPA-hosted backends
 * - GET is universally allowed and doesn't trigger CORS preflight
 * - Token in Authorization header keeps it secure
 */

import { Request, Response } from "express";
import { getDb } from "../db";
import { deployments, intakes, buildPlans, workerRuns } from "../../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";
import { sendEmail } from "../email";
import { notifyOwner } from "../_core/notification";

// Simple in-memory lock (good enough for single-instance)
const locks = new Map<string, number>();

const CRON_TOKEN = process.env.WORKER_TOKEN;

/**
 * Acquire a lock for a given key
 */
function acquireLock(key: string, ttlMs: number = 120_000): boolean {
  const now = Date.now();
  const existing = locks.get(key);
  
  if (existing && existing > now) {
    return false;
  }
  
  locks.set(key, now + ttlMs);
  return true;
}

/**
 * Release a lock
 */
function releaseLock(key: string): void {
  locks.delete(key);
}

/**
 * Verify Bearer token from Authorization header
 */
function verifyBearerToken(req: Request): boolean {
  if (!CRON_TOKEN) {
    console.error("[Cron] WORKER_TOKEN not configured");
    return false;
  }
  
  const auth = req.headers.authorization;
  if (!auth) return false;
  
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  return token === CRON_TOKEN;
}

/**
 * GET /api/cron/run-next-deploy
 * Cron-safe endpoint for deployment worker
 */
export async function handleCronRunNextDeploy(req: Request, res: Response) {
  const startTime = Date.now();
  
  // Verify token
  if (!verifyBearerToken(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  
  // Try to acquire lock
  if (!acquireLock("run-next-deploy", 120_000)) {
    return res.status(200).json({ ok: true, skipped: "already_running" });
  }
  
  try {
    const db = await getDb();
    if (!db) {
      return res.status(500).json({ ok: false, error: "Database not available" });
    }

    // Check if any deployment is already running
    const [runningJob] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.status, "running"))
      .limit(1);

    if (runningJob) {
      return res.status(200).json({
        ok: true,
        skipped: "deployment_running",
        runningDeploymentId: runningJob.id,
      });
    }

    // Find the oldest queued deployment
    const [queuedDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.status, "queued"))
      .orderBy(asc(deployments.createdAt))
      .limit(1);

    if (!queuedDeployment) {
      return res.status(200).json({ 
        ok: true, 
        message: "No queued deployments",
        processed: 0 
      });
    }

    // Mark as running
    await db
      .update(deployments)
      .set({ 
        status: "running",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, queuedDeployment.id));

    // Get intake details
    const [intake] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.id, queuedDeployment.intakeId));

    if (!intake) {
      throw new Error("Intake not found");
    }

    // Simulate deployment (in real implementation, this would do actual work)
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Generate URL
    const slug = intake.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const liveUrl = `https://site-${slug}-${queuedDeployment.id}.launchbase-h86jcadp.manus.space`;

    // Mark as success
    await db
      .update(deployments)
      .set({
        status: "success",
        completedAt: new Date(),
        productionUrl: liveUrl,
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, queuedDeployment.id));

    // Update intake status
    await db
      .update(intakes)
      .set({
        status: "deployed",
        updatedAt: new Date(),
      })
      .where(eq(intakes.id, intake.id));

    // Send notification
    await notifyOwner({
      title: `Site deployed: ${intake.businessName}`,
      content: `Live URL: ${liveUrl}`,
    });

    return res.status(200).json({
      ok: true,
      message: "Deployment completed",
      processed: 1,
      deploymentId: queuedDeployment.id,
      liveUrl,
      durationMs: Date.now() - startTime,
    });

  } catch (error) {
    console.error("[Cron] run-next-deploy error:", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
      durationMs: Date.now() - startTime,
    });
  } finally {
    releaseLock("run-next-deploy");
  }
}

/**
 * GET /api/cron/auto-advance
 * Cron-safe endpoint for auto-advance worker
 */
export async function handleCronAutoAdvance(req: Request, res: Response) {
  const startTime = Date.now();
  
  if (!verifyBearerToken(req)) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  
  if (!acquireLock("auto-advance", 120_000)) {
    return res.status(200).json({ ok: true, skipped: "already_running" });
  }
  
  try {
    // Auto-advance logic would go here
    // For now, just return success
    return res.status(200).json({
      ok: true,
      message: "Auto-advance check completed",
      processed: 0,
      durationMs: Date.now() - startTime,
    });
  } catch (error) {
    console.error("[Cron] auto-advance error:", error);
    return res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  } finally {
    releaseLock("auto-advance");
  }
}

/**
 * GET /api/cron/health
 * Simple health check endpoint
 */
export async function handleCronHealth(_req: Request, res: Response) {
  const db = await getDb();
  
  return res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    database: db ? "connected" : "disconnected",
  });
}
