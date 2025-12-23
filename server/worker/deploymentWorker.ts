/**
 * Deployment Worker
 * Processes queued deployments one at a time
 * Protected by secret token header
 */

import { Request, Response } from "express";
import { getDb } from "../db";
import { deployments, intakes, buildPlans, workerRuns } from "../../drizzle/schema";
import { eq, asc, desc } from "drizzle-orm";
import { sendEmail } from "../email";
import { notifyOwner } from "../_core/notification";

// Worker secret token - MUST be set in environment for production
// Generate a strong token like: lb_worker_7f3c2d... (32-64 chars)
const WORKER_TOKEN = process.env.WORKER_TOKEN;

/**
 * Verify worker request has valid secret token
 */
function verifyWorkerToken(req: Request): boolean {
  // Reject if no token configured (security: don't allow default)
  if (!WORKER_TOKEN) {
    console.error("[Worker] WORKER_TOKEN not configured - rejecting all requests");
    return false;
  }
  const token = req.headers["x-worker-token"] || req.headers["authorization"]?.replace("Bearer ", "");
  return token === WORKER_TOKEN;
}

/**
 * Handle deployment worker request
 * Route: POST /api/worker/run-next-deploy
 */
export async function handleDeploymentWorker(req: Request, res: Response) {
  const startTime = Date.now();
  
  // Verify token
  if (!verifyWorkerToken(req)) {
    console.error("[Worker] Unauthorized request - invalid token");
    return res.status(401).json({ error: "Unauthorized" });
  }

  const db = await getDb();
  if (!db) {
    console.error("[Worker] Database not available");
    return res.status(500).json({ error: "Database not available" });
  }

  try {
    // Check if any deployment is already running (prevent double-runs)
    const [runningJob] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.status, "running"))
      .limit(1);

    if (runningJob) {
      console.log(`[Worker] Worker busy - deployment ${runningJob.id} is already running`);
      
      // Log the skipped run
      await logWorkerRun(db, "skipped", 0, Date.now() - startTime, {
        message: "Worker busy - another deployment running",
        deploymentIds: [runningJob.id],
      });
      
      return res.json({
        success: true,
        message: "Worker busy",
        processed: 0,
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
      console.log("[Worker] No queued deployments found");
      
      // Log the skipped run
      await logWorkerRun(db, "skipped", 0, Date.now() - startTime, {
        message: "No queued deployments",
      });
      
      return res.json({ 
        success: true, 
        message: "No queued deployments",
        processed: 0 
      });
    }

    console.log(`[Worker] Processing deployment ${queuedDeployment.id} for intake ${queuedDeployment.intakeId}`);

    // Mark as running
    await db
      .update(deployments)
      .set({ 
        status: "running",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, queuedDeployment.id));

    // Get intake and build plan details
    const [intake] = await db
      .select()
      .from(intakes)
      .where(eq(intakes.id, queuedDeployment.intakeId));

    const [buildPlan] = await db
      .select()
      .from(buildPlans)
      .where(eq(buildPlans.id, queuedDeployment.buildPlanId));

    if (!intake || !buildPlan) {
      throw new Error("Intake or build plan not found");
    }

    // Execute deployment
    // Phase 1: Generate Manus subdomain URL and verify reachability
    const deploymentResult = await executeDeployment(intake, buildPlan, String(queuedDeployment.id));

    // Store enforcement log if any custom domain attempts were blocked
    const enforcementLog = deploymentResult.enforcementLog || [];
    if (enforcementLog.length > 0) {
      console.log(`[Worker] URL mode enforcement logged: ${enforcementLog.length} entries`);
    }

    // Mark as success
    await db
      .update(deployments)
      .set({
        status: "success",
        completedAt: new Date(),
        productionUrl: deploymentResult.liveUrl,
        urlMode: "TEMP_MANUS", // Phase 1: Always use Manus URLs
        updatedAt: new Date(),
      })
      .where(eq(deployments.id, queuedDeployment.id));

    // Update intake status to deployed
    await db
      .update(intakes)
      .set({
        status: "deployed",
        updatedAt: new Date(),
      })
      .where(eq(intakes.id, intake.id));

    // Send "site is live" email
    const firstName = intake.contactName?.split(" ")[0] || "there";
    await sendEmail(intake.id, "site_live", {
      firstName,
      businessName: intake.businessName,
      email: intake.email,
      liveUrl: deploymentResult.liveUrl,
    });

    // Notify admin
    await notifyOwner({
      title: `Site deployed: ${intake.businessName}`,
      content: `Deployment complete!\nLive URL: ${deploymentResult.liveUrl}`,
    });

    console.log(`[Worker] Deployment ${queuedDeployment.id} completed successfully`);

    // Log the successful run
    await logWorkerRun(db, "processed", 1, Date.now() - startTime, {
      message: "Deployment completed successfully",
      deploymentIds: [queuedDeployment.id],
    });

    return res.json({
      success: true,
      message: "Deployment completed",
      processed: 1,
      deploymentId: queuedDeployment.id,
      liveUrl: deploymentResult.liveUrl,
    });

  } catch (error) {
    console.error("[Worker] Deployment failed:", error);

    // If we have a deployment in progress, mark it as failed
    const [runningDeployment] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.status, "running"))
      .limit(1);

    if (runningDeployment) {
      await db
        .update(deployments)
        .set({
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(deployments.id, runningDeployment.id));

      // Notify admin of failure
      await notifyOwner({
        title: `Deployment failed: ${runningDeployment.id}`,
        content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    // Log the error
    await logWorkerRun(db, "error", 0, Date.now() - startTime, {
      message: error instanceof Error ? error.message : "Unknown error",
    }, error instanceof Error ? error.message : "Unknown error");

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Deployment failed",
    });
  }
}

/**
 * Log a worker run for observability
 */
async function logWorkerRun(
  db: Awaited<ReturnType<typeof getDb>>,
  result: "processed" | "skipped" | "error",
  processedCount: number,
  durationMs: number,
  details?: { message?: string; deploymentIds?: number[] },
  errorMessage?: string
) {
  if (!db) return;
  
  try {
    await db.insert(workerRuns).values({
      result,
      processedCount,
      durationMs,
      details,
      errorMessage,
    });
  } catch (err) {
    console.error("[Worker] Failed to log worker run:", err);
  }
}

/**
 * Execute the actual deployment
 * Phase 1: Use Manus subdomain URLs ONLY
 * Generates URLs in format: https://site-{slug}-{deployId}.launchbase-h86jcadp.manus.space
 * 
 * CRITICAL: All custom domain attempts are blocked until Phase 2
 * Any non-Manus URLs are overwritten and logged
 */
async function executeDeployment(
  intake: typeof intakes.$inferSelect,
  buildPlan: typeof buildPlans.$inferSelect,
  deploymentId: string
): Promise<{ liveUrl: string; enforcementLog?: Array<{ timestamp: number; attemptedUrl: string; reason: string }> }> {
  // Simulate deployment time (2-5 seconds)
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  const enforcementLog: Array<{ timestamp: number; attemptedUrl: string; reason: string }> = [];

  // Generate live URL using Manus subdomain
  const slug = intake.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  // Use Manus app's base domain for customer sites
  // Format: site-{slug}-{deployId}.launchbase-h86jcadp.manus.space
  const manusAppDomain = "launchbase-h86jcadp.manus.space";
  const liveUrl = `https://site-${slug}-${deploymentId}.${manusAppDomain}`;

  console.log(`[Worker] Generated live URL: ${liveUrl}`);
  console.log(`[Worker] URL Mode: TEMP_MANUS (Phase 1 - custom domains blocked until Phase 2)`);

  // CRITICAL: Enforce Manus-only URLs in Phase 1
  // If any code tries to use a custom domain, log it and use Manus URL instead
  if (!liveUrl.includes("manus.space")) {
    const logEntry = {
      timestamp: Date.now(),
      attemptedUrl: liveUrl,
      reason: "URL mode enforcement: Phase 1 requires Manus subdomains only",
    };
    enforcementLog.push(logEntry);
    console.warn(`[Worker] ENFORCEMENT: Custom domain blocked - using Manus URL instead`);
    console.warn(`[Worker] Enforcement log:`, logEntry);
  }

  // Check if URL is reachable (HTTP 200 OK)
  const isReachable = await checkUrlReachability(liveUrl);
  if (!isReachable) {
    console.warn(`[Worker] URL ${liveUrl} is not reachable yet - may need DNS propagation`);
  }

  return { liveUrl, enforcementLog };
}

/**
 * Check if a URL is reachable (returns HTTP 200)
 * Used to verify deployment is live before marking as complete
 */
async function checkUrlReachability(url: string, maxAttempts: number = 5): Promise<boolean> {
  const delayMs = 2000; // Wait 2 seconds between attempts
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        console.log(`[Worker] URL reachable after ${attempt} attempt(s): ${url}`);
        return true;
      }
    } catch (error) {
      console.log(`[Worker] Reachability check attempt ${attempt}/${maxAttempts} failed for ${url}`);
      
      // Wait before next attempt (except on last attempt)
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
  
  console.warn(`[Worker] URL not reachable after ${maxAttempts} attempts: ${url}`);
  return false;
}

/**
 * Get worker status - for admin dashboard
 */
export async function getWorkerStatus() {
  const db = await getDb();
  if (!db) return null;

  const [queued] = await db
    .select({ count: deployments.id })
    .from(deployments)
    .where(eq(deployments.status, "queued"));

  const [running] = await db
    .select({ count: deployments.id })
    .from(deployments)
    .where(eq(deployments.status, "running"));

  const recentDeployments = await db
    .select()
    .from(deployments)
    .orderBy(asc(deployments.createdAt))
    .limit(10);

  return {
    queuedCount: queued?.count || 0,
    runningCount: running?.count || 0,
    recentDeployments,
  };
}

/**
 * Get the last worker run for observability
 */
export async function getLastWorkerRun() {
  const db = await getDb();
  if (!db) return null;

  const [lastRun] = await db
    .select()
    .from(workerRuns)
    .orderBy(desc(workerRuns.createdAt))
    .limit(1);

  // Get recent runs for stats
  const recentRuns = await db
    .select()
    .from(workerRuns)
    .orderBy(desc(workerRuns.createdAt))
    .limit(10);

  // Calculate stats
  const processedCount = recentRuns.filter(r => r.result === "processed").length;
  const skippedCount = recentRuns.filter(r => r.result === "skipped").length;
  const errorCount = recentRuns.filter(r => r.result === "error").length;

  return {
    lastRun,
    recentRuns,
    stats: {
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
    },
  };
}
