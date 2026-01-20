/**
 * Template Versioning Tests
 * 
 * Ensures that:
 * 1. New deployments get the current template version
 * 2. Existing deployments remain frozen (immutability)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { getDb, createDeployment, getDeploymentById } from "../db";
import { TEMPLATE_VERSION_CURRENT, TEMPLATE_VERSION_BASELINE } from "../../shared/templateVersion";
import { buildPlans, intakes } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Template Versioning", () => {
  beforeAll(async () => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available for testing");
    }

    // Ensure buildPlan fixture exists
    const existing = await db.select().from(buildPlans).where(eq(buildPlans.id, 1));
    if (existing.length === 0) {
      // Create test intake first
      const [testIntake] = await db.insert(intakes).values({
        businessName: "Test Business",
        contactName: "Test User",
        email: "test@example.com",
        vertical: "professional",
        tenant: "launchbase",
      });
      
      await db.insert(buildPlans).values({
        id: 1,
        intakeId: Number(testIntake.insertId),
        templateId: "default",
        plan: {
          pages: [],
          brand: { primaryColor: "#000", secondaryColor: "#fff", fontFamily: "Inter" },
          copy: { heroHeadline: "Test", heroSubheadline: "Test", ctaText: "Test" },
          features: [],
        },
        status: "ready",
      });
    }
  });

  it("new deployment gets current template version", async () => {
    // Create a test deployment
    const deployment = await createDeployment({
      buildPlanId: 1,
      intakeId: 1,
      status: "queued",
    });

    expect(deployment).not.toBeNull();
    expect(deployment!.templateVersion).toBe(TEMPLATE_VERSION_CURRENT);
  });

  it("existing deployment templateVersion is immutable", async () => {
    // Create a deployment
    const deployment = await createDeployment({
      buildPlanId: 1,
      intakeId: 1,
      status: "queued",
    });

    expect(deployment).not.toBeNull();
    const originalVersion = deployment!.templateVersion;

    // Fetch it again (simulating a rebuild or re-fetch)
    const fetched = await getDeploymentById(deployment!.id);

    expect(fetched).not.toBeNull();
    expect(fetched!.templateVersion).toBe(originalVersion);
    expect(fetched!.templateVersion).toBe(TEMPLATE_VERSION_CURRENT);
  });

  it("baseline version is recognized as valid", () => {
    // This test ensures the baseline version is in the registry
    expect(TEMPLATE_VERSION_BASELINE).toBe("v1");
  });

  it("current version is not empty", () => {
    expect(TEMPLATE_VERSION_CURRENT).toBeTruthy();
    expect(TEMPLATE_VERSION_CURRENT.length).toBeGreaterThan(0);
  });
});
