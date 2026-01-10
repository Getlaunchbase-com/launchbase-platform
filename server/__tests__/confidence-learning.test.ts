/**
 * Confidence Learning Tests
 * 
 * Verify that the system learns from approval patterns:
 * - Records outcomes correctly
 * - Calculates approval/edit rates
 * - Adjusts recommended thresholds
 */

import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "../db";
import { confidenceLearning } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import {
  recordConfidenceOutcome,
  getRecommendedThreshold,
  getConfidenceStats,
} from "../confidence-learning";

describe("Confidence Learning", () => {
  const testKey = "test.confidence.key";
  const tenant = "launchbase";

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Clean up test records
    await db
      .delete(confidenceLearning)
      .where(
        and(
          eq(confidenceLearning.checklistKey, testKey),
          eq(confidenceLearning.tenant, tenant)
        )
      );
  });

  it("should create new record on first outcome", async () => {
    await recordConfidenceOutcome({
      checklistKey: testKey,
      tenant,
      outcome: "approved",
    });

    const stats = await getConfidenceStats(testKey, tenant);
    expect(stats).toBeDefined();
    expect(stats!.totalSent).toBe(1);
    expect(stats!.approvalRate).toBe(1.0);
    expect(stats!.recommendedThreshold).toBe(0.9);
  });

  it("should update counters on subsequent outcomes", async () => {
    // Record 3 approvals
    await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });

    const stats = await getConfidenceStats(testKey, tenant);
    expect(stats!.totalSent).toBe(3);
    expect(stats!.approvalRate).toBe(1.0); // 3/3 = 100%
  });

  it("should calculate approval rate correctly", async () => {
    // Record 7 approvals, 3 rejections
    for (let i = 0; i < 7; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    }
    for (let i = 0; i < 3; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "rejected" });
    }

    const stats = await getConfidenceStats(testKey, tenant);
    expect(stats!.totalSent).toBe(10);
    expect(stats!.approvalRate).toBeCloseTo(0.7, 2); // 7/10 = 70%
  });

  it("should calculate edit rate correctly", async () => {
    // Record 6 approvals, 2 edits, 2 rejections
    for (let i = 0; i < 6; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    }
    for (let i = 0; i < 2; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "edited" });
    }
    for (let i = 0; i < 2; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "rejected" });
    }

    const stats = await getConfidenceStats(testKey, tenant);
    expect(stats!.totalSent).toBe(10);
    expect(stats!.editRate).toBeCloseTo(0.2, 2); // 2/10 = 20%
  });

  it("should lower threshold when approval rate > 90%", async () => {
    // Record 10 approvals (100% approval rate)
    for (let i = 0; i < 10; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    }

    const threshold = await getRecommendedThreshold(testKey, tenant);
    expect(threshold).toBe(0.85); // Should be lowered from 0.9
  });

  it("should raise threshold when approval rate < 70%", async () => {
    // Record 6 approvals, 4 rejections (60% approval rate)
    for (let i = 0; i < 6; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    }
    for (let i = 0; i < 4; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "rejected" });
    }

    const threshold = await getRecommendedThreshold(testKey, tenant);
    expect(threshold).toBe(0.95); // Should be raised from 0.9
  });

  it("should keep threshold at 0.9 for moderate approval rate", async () => {
    // Record 8 approvals, 2 rejections (80% approval rate)
    for (let i = 0; i < 8; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "approved" });
    }
    for (let i = 0; i < 2; i++) {
      await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "rejected" });
    }

    const threshold = await getRecommendedThreshold(testKey, tenant);
    expect(threshold).toBe(0.9); // Should stay at default
  });

  it("should return default threshold for unknown key", async () => {
    const threshold = await getRecommendedThreshold("unknown.key", tenant);
    expect(threshold).toBe(0.9); // Default
  });

  it("should handle unclear outcomes", async () => {
    await recordConfidenceOutcome({ checklistKey: testKey, tenant, outcome: "unclear" });

    const stats = await getConfidenceStats(testKey, tenant);
    expect(stats!.totalSent).toBe(1);
    expect(stats!.approvalRate).toBe(0.0); // No approvals
  });
});
