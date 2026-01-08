/**
 * Rollback FOREVER Tests
 * 
 * Locks rollback safety rails to prevent footguns:
 * - Block if deploy in flight
 * - Throw if no successful deployment
 * - Tenant isolation
 * - Clone from snapshot (exact equality)
 */

import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { getDb, createIntake, createBuildPlan, createDeployment } from "../db";
import { rollbackToLastSuccess } from "../rollback";
import { intakes, buildPlans, deployments } from "../../drizzle/schema";
import { eq, and, or, desc } from "drizzle-orm";

describe("Rollback Safety Rails", () => {
  let testIntakeId: number;
  let testBuildPlanId: number;
  let successDeploymentId: number;

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test intake
    const intake = await createIntake({
      businessName: "Rollback Test Co",
      contactName: "Test User",
      email: "rollback@test.com",
      vertical: "professional",
      tenant: "launchbase",
    });

    if (!intake) throw new Error("Failed to create test intake");
    testIntakeId = intake.id;

    // Create test build plan with plan data
    const [buildPlanResult] = await db.insert(buildPlans).values({
      intakeId: testIntakeId,
      templateId: "test-template",
      status: "ready",
      plan: {
        pages: [{ id: "home", title: "Home", slug: "/", sections: [] }],
        brand: { primaryColor: "#FF6A00", secondaryColor: "#000000", fontFamily: "Inter" },
        copy: { heroHeadline: "Test", heroSubheadline: "Test", ctaText: "Get Started" },
        features: ["feature1", "feature2"],
      },
    });

    testBuildPlanId = Number(buildPlanResult.insertId);

    // Create successful deployment
    const successDeploy = await createDeployment({
      buildPlanId: testBuildPlanId,
      intakeId: testIntakeId,
      status: "success",
      trigger: "auto",
    });

    if (!successDeploy) throw new Error("Failed to create success deployment");
    successDeploymentId = successDeploy.id;

    // Mark it as completed
    await db
      .update(deployments)
      .set({ completedAt: new Date() })
      .where(eq(deployments.id, successDeploymentId));
  });

  afterEach(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up any in-flight deployments created by this test
    // Mark queued/running as failed so they don't block subsequent tests
    await db
      .update(deployments)
      .set({ 
        status: "failed", 
        completedAt: new Date(),
        errorMessage: "Test cleanup" 
      })
      .where(
        and(
          eq(deployments.intakeId, testIntakeId),
          or(
            eq(deployments.status, "queued"),
            eq(deployments.status, "running")
          )
        )
      );
  });

  afterAll(async () => {
    const db = await getDb();
    if (!db) return;

    // Clean up test data
    await db.delete(deployments).where(eq(deployments.intakeId, testIntakeId));
    await db.delete(buildPlans).where(eq(buildPlans.id, testBuildPlanId));
    await db.delete(intakes).where(eq(intakes.id, testIntakeId));
  });

  it("should clone templateVersion and buildPlanSnapshot exactly", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get source deployment
    const [sourceDeploy] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, successDeploymentId));

    // Perform rollback
    const result = await rollbackToLastSuccess({
      intakeId: testIntakeId,
      reason: "Test exact clone",
    });

    // Get new deployment
    const [newDeploy] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, result.newDeploymentId));

    // Verify exact cloning
    expect(newDeploy.templateVersion).toBe(sourceDeploy.templateVersion);
    expect(JSON.stringify(newDeploy.buildPlanSnapshot)).toBe(
      JSON.stringify(sourceDeploy.buildPlanSnapshot)
    );
    expect(newDeploy.buildPlanId).toBe(sourceDeploy.buildPlanId);
    expect(newDeploy.intakeId).toBe(sourceDeploy.intakeId);
    expect(newDeploy.tenant).toBe(sourceDeploy.tenant);
  });

  it("should set trigger=rollback and rolledBackFromDeploymentId", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await rollbackToLastSuccess({
      intakeId: testIntakeId,
      reason: "Test trigger fields",
    });

    const [newDeploy] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, result.newDeploymentId));

    expect(newDeploy.trigger).toBe("rollback");
    expect(newDeploy.rolledBackFromDeploymentId).toBe(result.sourceDeploymentId);
    expect(newDeploy.status).toBe("queued");
  });

  it("should throw when no successful deployment exists", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create intake with no successful deployments
    const intake = await createIntake({
      businessName: "No Success Test",
      contactName: "Test",
      email: "nosuccess@test.com",
      vertical: "professional",
      tenant: "launchbase",
    });

    if (!intake) throw new Error("Failed to create intake");

    try {
      await rollbackToLastSuccess({
        intakeId: intake.id,
        reason: "Should fail",
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toContain("No successful deployment found");
    } finally {
      // Clean up
      await db.delete(intakes).where(eq(intakes.id, intake.id));
    }
  });

  it("should throw when deployment is queued or running", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create queued deployment
    const queuedDeploy = await createDeployment({
      buildPlanId: testBuildPlanId,
      intakeId: testIntakeId,
      status: "queued",
      trigger: "auto",
    });

    if (!queuedDeploy) throw new Error("Failed to create queued deployment");

    try {
      await rollbackToLastSuccess({
        intakeId: testIntakeId,
        reason: "Should fail - in flight",
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toContain("in flight");
    } finally {
      // Clean up queued deployment
      await db.delete(deployments).where(eq(deployments.id, queuedDeploy.id));
    }
  });

  it("should enforce tenant isolation", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create vinces intake with successful deployment
    const vincesIntake = await createIntake({
      businessName: "Vinces Test",
      contactName: "Vince",
      email: "test@vincessnowplow.com",
      vertical: "trades",
      tenant: "vinces",
    });

    if (!vincesIntake) throw new Error("Failed to create vinces intake");

    const [vincesBuildPlan] = await db.insert(buildPlans).values({
      intakeId: vincesIntake.id,
      templateId: "test-template",
      status: "ready",
      plan: {
        pages: [{ id: "home", title: "Home", slug: "/", sections: [] }],
        brand: { primaryColor: "#FF6A00", secondaryColor: "#000000", fontFamily: "Inter" },
        copy: { heroHeadline: "Test", heroSubheadline: "Test", ctaText: "Get Started" },
        features: [],
      },
    });

    const vincesDeploy = await createDeployment({
      buildPlanId: Number(vincesBuildPlan.insertId),
      intakeId: vincesIntake.id,
      status: "success",
      trigger: "auto",
    });

    if (!vincesDeploy) throw new Error("Failed to create vinces deployment");

    await db
      .update(deployments)
      .set({ completedAt: new Date() })
      .where(eq(deployments.id, vincesDeploy.id));

    try {
      // Try to rollback vinces intake as launchbase user
      await rollbackToLastSuccess({
        intakeId: vincesIntake.id,
        requestingUserTenant: "launchbase",
        reason: "Should fail - cross-tenant",
      });
      expect.fail("Should have thrown error");
    } catch (error: any) {
      expect(error.message).toContain("Cannot rollback across tenants");
    } finally {
      // Clean up
      await db.delete(deployments).where(eq(deployments.intakeId, vincesIntake.id));
      await db.delete(buildPlans).where(eq(buildPlans.intakeId, vincesIntake.id));
      await db.delete(intakes).where(eq(intakes.id, vincesIntake.id));
    }
  });

  it("should return correct deployment IDs", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const result = await rollbackToLastSuccess({
      intakeId: testIntakeId,
      reason: "Test return values",
    });

    expect(result.newDeploymentId).toBeTypeOf("number");
    expect(result.sourceDeploymentId).toBeTypeOf("number");
    expect(result.newDeploymentId).not.toBe(result.sourceDeploymentId);
    expect(result.sourceDeploymentId).toBe(successDeploymentId);
  });

  it("should allow multiple rollbacks in sequence", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // First rollback
    const result1 = await rollbackToLastSuccess({
      intakeId: testIntakeId,
      reason: "First rollback",
    });

    // Mark first rollback as completed
    await db
      .update(deployments)
      .set({ status: "success", completedAt: new Date() })
      .where(eq(deployments.id, result1.newDeploymentId));

    // Second rollback (should succeed without errors)
    const result2 = await rollbackToLastSuccess({
      intakeId: testIntakeId,
      reason: "Second rollback",
    });

    // Get both rollback deployments
    const [rollback1] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, result1.newDeploymentId));

    const [rollback2] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, result2.newDeploymentId));

    // Verify both rollbacks were created successfully
    expect(rollback1.trigger).toBe("rollback");
    expect(rollback1.status).toBe("success");
    expect(rollback2.trigger).toBe("rollback");
    expect(rollback2.status).toBe("queued");
    
    // Verify second rollback references a successful deployment
    expect(rollback2.rolledBackFromDeploymentId).toBeTypeOf("number");
    const [sourceDeploy] = await db
      .select()
      .from(deployments)
      .where(eq(deployments.id, rollback2.rolledBackFromDeploymentId!));
    expect(sourceDeploy.status).toBe("success");
  });
});
