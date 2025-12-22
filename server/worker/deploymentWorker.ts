/**
 * Deployment Worker
 * Processes queued deployments one at a time
 * Protected by secret token header
 */

import { Request, Response } from "express";
import { getDb } from "../db";
import { deployments, intakes, buildPlans } from "../../drizzle/schema";
import { eq, asc } from "drizzle-orm";
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
    // For MVP, this is a placeholder - actual deployment would:
    // 1. Generate static site from build plan
    // 2. Upload to hosting (S3, Vercel, etc.)
    // 3. Configure domain
    // 4. Return live URL
    
    const deploymentResult = await executeDeployment(intake, buildPlan);

    // Mark as success
    await db
      .update(deployments)
      .set({
        status: "success",
        completedAt: new Date(),
        productionUrl: deploymentResult.liveUrl,
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

    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Deployment failed",
    });
  }
}

/**
 * Execute the actual deployment
 * MVP: Generates a placeholder URL
 * Production: Would integrate with hosting provider
 */
async function executeDeployment(
  intake: typeof intakes.$inferSelect,
  buildPlan: typeof buildPlans.$inferSelect
): Promise<{ liveUrl: string }> {
  // Simulate deployment time (2-5 seconds)
  await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000));

  // Generate live URL
  // In production, this would be the actual deployed URL
  const slug = intake.businessName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  
  const liveUrl = `https://${slug}.launchbase.site`;

  console.log(`[Worker] Generated live URL: ${liveUrl}`);

  return { liveUrl };
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
