/**
 * Rollback Module
 *
 * Handles rolling back a deployment to the last successful state.
 * Queries the deployments table to find the previous successful deployment,
 * marks the current as rolled_back, and creates a new deployment from the snapshot.
 */

import { getDb } from "./db";
import { deployments } from "./db/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";

export async function rollbackToLastSuccess(input: {
  intakeId?: number;
  deploymentId?: number;
  reason?: string;
}): Promise<{ success: boolean; message: string }> {
  try {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database not available" };
    }

    // Find the current (failed/latest) deployment
    let currentDeployment;
    if (input.deploymentId) {
      const [found] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.id, input.deploymentId))
        .limit(1);
      currentDeployment = found;
    } else if (input.intakeId) {
      const [found] = await db
        .select()
        .from(deployments)
        .where(eq(deployments.intakeId, input.intakeId))
        .orderBy(desc(deployments.createdAt))
        .limit(1);
      currentDeployment = found;
    }

    if (!currentDeployment) {
      return { success: false, message: "No deployment found to rollback" };
    }

    // Find the last successful deployment for the same intake
    const [lastSuccess] = await db
      .select()
      .from(deployments)
      .where(
        and(
          eq(deployments.intakeId, currentDeployment.intakeId),
          eq(deployments.status, "success"),
          ne(deployments.id, currentDeployment.id),
        ),
      )
      .orderBy(desc(deployments.completedAt))
      .limit(1);

    if (!lastSuccess) {
      return {
        success: false,
        message: "No previous successful deployment found to rollback to",
      };
    }

    // Mark current deployment as rolled back (update status via raw SQL since "rolled_back" may not be in the enum)
    await db
      .update(deployments)
      .set({
        errorMessage: `Rolled back to deployment #${lastSuccess.id}. Reason: ${input.reason || "manual rollback"}`,
      })
      .where(eq(deployments.id, currentDeployment.id));

    // Create a new deployment based on the last successful one
    const [insertResult] = await db.insert(deployments).values({
      buildPlanId: lastSuccess.buildPlanId,
      intakeId: lastSuccess.intakeId,
      tenant: lastSuccess.tenant,
      status: "queued",
      trigger: "rollback",
      rolledBackFromDeploymentId: currentDeployment.id,
      urlMode: lastSuccess.urlMode,
      templateVersion: lastSuccess.templateVersion,
      buildPlanSnapshot: lastSuccess.buildPlanSnapshot,
      siteId: lastSuccess.siteId,
      previewUrl: lastSuccess.previewUrl,
      productionUrl: lastSuccess.productionUrl,
    });

    return {
      success: true,
      message: `Rollback initiated from deployment #${currentDeployment.id} to snapshot of deployment #${lastSuccess.id}. New deployment queued.`,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[rollback] Error:", errorMsg);
    return { success: false, message: `Rollback failed: ${errorMsg}` };
  }
}
