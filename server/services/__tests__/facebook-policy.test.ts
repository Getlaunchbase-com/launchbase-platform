/**
 * Unit tests for Facebook posting policy enforcement
 * 
 * Tests the core policy rules:
 * 1. Approval-first for first 7 days
 * 2. Auto-posting allowlist
 * 3. Confidence threshold
 * 4. Quiet hours
 * 5. Daily cap
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkFacebookPostingPolicy, type PolicyPostType } from "../facebook-policy";

// Mock the database module
vi.mock("../../db", () => ({
  getDb: vi.fn(),
}));

// Mock database helpers
const mockGetPostCountLast24Hours = vi.fn();
const mockGetConnectionCreatedAt = vi.fn();

// Mock the internal helper functions by importing and mocking the module
vi.mock("../facebook-policy", async (importOriginal) => {
  const actual = await importOriginal() as any;
  return {
    ...actual,
    // We'll need to export these helpers from the policy module for testing
    // For now, we'll test via the public API
  };
});

describe("Facebook Posting Policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rule 1: Approval-first for first 7 days", () => {
    it("should return DRAFT for auto posts within 7 days of connection", async () => {
      const now = new Date("2026-01-08T12:00:00Z");
      const connectedAt = new Date("2026-01-07T12:00:00Z"); // 1 day ago

      // Mock DB to return recent connection
      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]), // No posts yet (cap check)
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "auto",
        postType: "WEATHER_ALERT",
        confidence: 0.95,
        now,
      });

      expect(result.action).toBe("DRAFT");
      expect(result.requiresApproval).toBe(true);
      expect(result.allowed).toBe(false);
      expect(result.reasons).toContain(`Approval required during first 7 days after Facebook connection.`);
    });

    it("should allow PUBLISH for auto posts after 7 days", async () => {
      const now = new Date("2026-01-16T12:00:00Z");
      const connectedAt = new Date("2026-01-08T12:00:00Z"); // 8 days ago

      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]), // No posts yet
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "auto",
        postType: "OPS_ALERT",
        confidence: 0.95,
        now,
      });

      expect(result.action).toBe("PUBLISH");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Rule 2: Auto-posting allowlist", () => {
    it("should return DRAFT for auto posts with postType OTHER", async () => {
      const now = new Date("2026-01-16T12:00:00Z");
      const connectedAt = new Date("2026-01-08T12:00:00Z"); // 8 days ago

      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "auto",
        postType: "OTHER",
        confidence: 0.95,
        now,
      });

      expect(result.action).toBe("DRAFT");
      expect(result.requiresApproval).toBe(true);
      expect(result.reasons?.[0]).toContain("Auto-posting is limited to");
      expect(result.reasons?.[0]).toContain("requires manual approval");
    });
  });

  describe("Rule 3: Confidence threshold", () => {
    it("should return DRAFT for auto posts with null confidence", async () => {
      const now = new Date("2026-01-16T12:00:00Z");
      const connectedAt = new Date("2026-01-08T12:00:00Z");

      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "auto",
        postType: "WEATHER_ALERT",
        confidence: null,
        now,
      });

      expect(result.action).toBe("DRAFT");
      expect(result.requiresApproval).toBe(true);
      expect(result.reasons).toContain("Confidence below threshold for auto-posting. Manual review recommended.");
    });

    it("should return DRAFT for auto posts with low confidence (< 0.9)", async () => {
      const now = new Date("2026-01-16T12:00:00Z");
      const connectedAt = new Date("2026-01-08T12:00:00Z");

      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "auto",
        postType: "WEATHER_ALERT",
        confidence: 0.89,
        now,
      });

      expect(result.action).toBe("DRAFT");
      expect(result.requiresApproval).toBe(true);
    });
  });

  describe("Rule 4: Quiet hours", () => {
    it("should return QUEUE for auto posts during quiet hours (2 AM Chicago)", async () => {
      // 2 AM Chicago = 8 AM UTC
      const now = new Date("2026-01-16T08:00:00Z");
      const connectedAt = new Date("2026-01-08T12:00:00Z");

      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "auto",
        postType: "WEATHER_ALERT",
        confidence: 0.95,
        now,
      });

      expect(result.action).toBe("QUEUE");
      expect(result.allowed).toBe(false);
      expect(result.retryAt).toBeDefined();
      expect(result.reasons).toContain("Outside business hours (6 AM - 9 PM Chicago time). Post queued for next allowed window.");
    });

    it("should allow PUBLISH for manual posts during quiet hours", async () => {
      // Manual posts bypass quiet hours
      const now = new Date("2026-01-16T08:00:00Z"); // 2 AM Chicago
      const connectedAt = new Date("2026-01-08T12:00:00Z");

      const { getDb } = await import("../../db");
      vi.mocked(getDb).mockResolvedValue({
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ createdAt: connectedAt }]),
            }),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
      } as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "manual",
        postType: "WEATHER_ALERT",
        confidence: null,
        now,
      });

      expect(result.action).toBe("PUBLISH");
      expect(result.allowed).toBe(true);
    });
  });

  describe("Rule 5: Daily cap", () => {
    it("should return BLOCK when daily cap is reached (manual and auto)", async () => {
      const now = new Date("2026-01-16T12:00:00Z");
      const connectedAt = new Date("2026-01-08T12:00:00Z");

      const { getDb } = await import("../../db");
      
      // Mock DB with proper Drizzle query builder chain
      const mockDb = {
        select: vi.fn().mockReturnThis(),
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn(),
      };
      
      // First call: connection query (returns connection)
      // Second call: post count query (returns count = 2)
      mockDb.limit
        .mockResolvedValueOnce([{ createdAt: connectedAt }]) // Connection query
      
      mockDb.where
        .mockReturnValueOnce(mockDb) // Connection query
        .mockResolvedValueOnce([{ count: 2 }]); // Post count query (cap reached)
      
      vi.mocked(getDb).mockResolvedValue(mockDb as any);

      const result = await checkFacebookPostingPolicy({
        customerId: "123",
        pageId: "page123",
        mode: "manual",
        postType: "OTHER",
        confidence: null,
        now,
      });

      expect(result.action).toBe("BLOCK");
      expect(result.allowed).toBe(false);
      expect(result.reasons).toContain("Daily post limit reached (2 posts per 24 hours). Please try again later.");
    });
  });
});
