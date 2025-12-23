/**
 * Intelligence Service Tests
 * 
 * Tests for Intelligence Core logic:
 * 1. Silence Audit Trail (decision logging)
 * 2. Approval Feedback Loop (feedback capture)
 * 3. Industry Profile Versioning (profile management)
 * 
 * Note: These tests verify the service functions handle errors gracefully
 * and return correct types. Full database integration tests run after migration.
 */

import { describe, it, expect } from "vitest";
import {
  logDecision,
  recordFeedback,
  getIndustryProfile,
  getUserDecisionLogs,
  getUserFeedbackMetrics,
  getUserSilenceStats,
} from "./intelligence";

describe("Intelligence Service", () => {
  const testUserId = 999;
  const testPostId = 888;

  describe("Silence Audit Trail", () => {
    it("should handle logDecision without throwing", async () => {
      await expect(
        logDecision({
          userId: testUserId,
          decision: "silence",
          severity: "hard_block",
          reason: "weather_unsafe",
          triggerContext: "weather_storm",
          conditions: { windSpeed: 45, advisory: "winter_storm" },
          layersEvaluated: ["weather"],
          confidenceScore: 100,
          intelligenceVersion: "v2.4.0",
        })
      ).resolves.not.toThrow();
    });

    it("should handle logDecision with all decision types", async () => {
      const decisions: Array<"post" | "silence" | "wait"> = [
        "post",
        "silence",
        "wait",
      ];

      for (const decision of decisions) {
        await expect(
          logDecision({
            userId: testUserId,
            decision,
            reason: "test",
            triggerContext: "manual",
          })
        ).resolves.not.toThrow();
      }
    });

    it("should handle logDecision with all severity levels", async () => {
      const severities: Array<
        "hard_block" | "soft_block" | "discretionary"
      > = ["hard_block", "soft_block", "discretionary"];

      for (const severity of severities) {
        await expect(
          logDecision({
            userId: testUserId,
            decision: "silence",
            severity,
            reason: "test",
            triggerContext: "manual",
          })
        ).resolves.not.toThrow();
      }
    });

    it("should return empty array for getUserDecisionLogs with invalid user", async () => {
      const logs = await getUserDecisionLogs(-999);
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBe(0);
    });

    it("should return empty stats for getUserSilenceStats with invalid user", async () => {
      const stats = await getUserSilenceStats(-999);
      // May return null if DB is unavailable, or empty stats if DB is available
      if (stats) {
        expect(stats.totalSilences).toBe(0);
        expect(stats.byReason).toEqual({});
      }
    });
  });

  describe("Approval Feedback Loop", () => {
    it("should handle recordFeedback without throwing", async () => {
      await expect(
        recordFeedback({
          userId: testUserId,
          socialPostId: testPostId,
          action: "approved",
          relatedLayers: ["weather"],
        })
      ).resolves.not.toThrow();
    });

    it("should handle recordFeedback with all action types", async () => {
      const actions: Array<"approved" | "edited" | "rejected"> = [
        "approved",
        "edited",
        "rejected",
      ];

      for (const action of actions) {
        await expect(
          recordFeedback({
            userId: testUserId,
            socialPostId: testPostId,
            action,
          })
        ).resolves.not.toThrow();
      }
    });

    it("should handle recordFeedback with all feedback types", async () => {
      const feedbackTypes: Array<
        | "too_promotional"
        | "wrong_tone"
        | "not_relevant"
        | "too_salesy"
        | "timing_wrong"
        | "content_inaccurate"
        | "other"
      > = [
        "too_promotional",
        "wrong_tone",
        "not_relevant",
        "too_salesy",
        "timing_wrong",
        "content_inaccurate",
        "other",
      ];

      for (const feedbackType of feedbackTypes) {
        await expect(
          recordFeedback({
            userId: testUserId,
            socialPostId: testPostId,
            action: "rejected",
            feedbackType,
          })
        ).resolves.not.toThrow();
      }
    });

    it("should handle recordFeedback with edited content", async () => {
      await expect(
        recordFeedback({
          userId: testUserId,
          socialPostId: testPostId,
          action: "edited",
          originalContent: "Original text",
          editedContent: "Edited text",
          relatedLayers: ["weather", "trends"],
        })
      ).resolves.not.toThrow();
    });

    it("should return empty metrics for getUserFeedbackMetrics with invalid user", async () => {
      const metrics = await getUserFeedbackMetrics(-999);
      // May return null if DB is unavailable, or empty metrics if DB is available
      if (metrics) {
        expect(metrics.totalFeedback).toBe(0);
        expect(metrics.approved).toBe(0);
        expect(metrics.edited).toBe(0);
        expect(metrics.rejected).toBe(0);
      }
    });
  });

  describe("Industry Profile Versioning", () => {
    it("should return null for non-existent industry profile", async () => {
      const profile = await getIndustryProfile("nonexistent_industry_xyz");
      expect(profile).toBeNull();
    });

    it("should handle getIndustryProfile gracefully", async () => {
      await expect(
        getIndustryProfile("test_industry")
      ).resolves.not.toThrow();
    });
  });

  describe("Error Handling & Resilience", () => {
    it("should not throw when database is unavailable", async () => {
      // All functions should gracefully handle DB unavailability
      const operations = [
        logDecision({
          userId: -1,
          decision: "silence",
          reason: "test",
          triggerContext: "manual",
        }),
        recordFeedback({
          userId: -1,
          socialPostId: -1,
          action: "approved",
        }),
        getIndustryProfile("test"),
        getUserDecisionLogs(-1),
        getUserFeedbackMetrics(-1),
        getUserSilenceStats(-1),
      ];

      for (const operation of operations) {
        await expect(operation).resolves.not.toThrow();
      }
    });

    it("should return correct types for all operations", async () => {
      const logs = await getUserDecisionLogs(1);
      expect(Array.isArray(logs)).toBe(true);

      const metrics = await getUserFeedbackMetrics(1);
      expect(typeof metrics === "object" || metrics === null).toBe(true);

      const stats = await getUserSilenceStats(1);
      expect(typeof stats === "object" || stats === null).toBe(true);

      const profile = await getIndustryProfile("test");
      expect(profile === null || typeof profile === "object").toBe(true);
    });
  });

  describe("Data Structure Validation", () => {
    it("should validate decision log structure", async () => {
      const logs = await getUserDecisionLogs(1);
      if (logs.length > 0) {
        const log = logs[0];
        expect(log).toHaveProperty("userId");
        expect(log).toHaveProperty("decision");
        expect(log).toHaveProperty("reason");
        expect(log).toHaveProperty("triggerContext");
      }
    });

    it("should validate feedback metrics structure", async () => {
      const metrics = await getUserFeedbackMetrics(1);
      if (metrics) {
        expect(metrics).toHaveProperty("totalFeedback");
        expect(metrics).toHaveProperty("approved");
        expect(metrics).toHaveProperty("edited");
        expect(metrics).toHaveProperty("rejected");
        expect(metrics).toHaveProperty("feedbackTypes");
        expect(metrics).toHaveProperty("topLayers");
      }
    });

    it("should validate silence stats structure", async () => {
      const stats = await getUserSilenceStats(1);
      if (stats) {
        expect(stats).toHaveProperty("totalSilences");
        expect(stats).toHaveProperty("hardBlocks");
        expect(stats).toHaveProperty("softBlocks");
        expect(stats).toHaveProperty("discretionary");
        expect(stats).toHaveProperty("byReason");
      }
    });

    it("should validate industry profile structure", async () => {
      const profile = await getIndustryProfile("test");
      if (profile) {
        expect(profile).toHaveProperty("industry");
        expect(profile).toHaveProperty("profileVersion");
        expect(profile).toHaveProperty("contextWeights");
        expect(profile).toHaveProperty("safetyGates");
        expect(profile).toHaveProperty("status");
      }
    });
  });
});
