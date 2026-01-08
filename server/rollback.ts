/**
 * One-Click Rollback
 * 
 * Enterprise safety rails:
 * - Block if any deploy is queued/running for that intake
 * - Throw if no successful deployment exists
 * - Tenant isolation (can't rollback across tenants)
 * - Clone from snapshot (never mutate past deployments)
 */

import { TRPCError } from "@trpc/server";
import { getDb, getIntakeById, createDeployment } from "./db";
import { deployments } from "../drizzle/schema";
import { eq, and, desc, or } from "drizzle-orm";

export async function rollbackToLastSuccess(params: {
  intakeId: number;
  reason?: string;
  requestingUserTenant?: "launchbase" | "vinces";
}): Promise<{ newDeploymentId: number; sourceDeploymentId: number }> {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Database not available",
    });
  }

  // 1. Tenant isolation: verify intake belongs to requesting user's tenant
  const intake = await getIntakeById(params.intakeId);
  if (!intake) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Intake not found",
    });
  }

  if (params.requestingUserTenant && intake.tenant !== params.requestingUserTenant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot rollback across tenants",
    });
  }

  // 2. Safety rail: block if any deploy is queued/running for this intake
  const inFlightDeploys = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.intakeId, params.intakeId),
        or(
          eq(deployments.status, "queued"),
          eq(deployments.status, "running")
        )
      )
    );

  if (inFlightDeploys.length > 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: `Cannot rollback: ${inFlightDeploys.length} deployment(s) in flight. Wait for them to complete.`,
    });
  }

  // 3. Find last successful deployment for this intake
  const lastSuccessful = await db
    .select()
    .from(deployments)
    .where(
      and(
        eq(deployments.intakeId, params.intakeId),
        eq(deployments.status, "success")
      )
    )
    .orderBy(desc(deployments.completedAt))
    .limit(1);

  if (lastSuccessful.length === 0) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "No successful deployment found to rollback to",
    });
  }

  const sourceDeploy = lastSuccessful[0];

  // 4. Create new deployment cloning from source
  const newDeploy = await createDeployment({
    buildPlanId: sourceDeploy.buildPlanId,
    intakeId: params.intakeId,
    trigger: "rollback",
    rolledBackFromDeploymentId: sourceDeploy.id,
    status: "queued",
  });

  if (!newDeploy) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create rollback deployment",
    });
  }

  console.log(`[Rollback] Created deployment ${newDeploy.id} from source ${sourceDeploy.id} for intake ${params.intakeId}${params.reason ? ` (reason: ${params.reason})` : ""}`);

  return {
    newDeploymentId: newDeploy.id,
    sourceDeploymentId: sourceDeploy.id,
  };
}
