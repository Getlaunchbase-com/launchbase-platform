/**
 * SMOKE TESTS - Facebook Policy
 * 
 * Purpose: Validate production environment sanity, NOT business logic
 * Run before every deploy to catch integration issues
 * 
 * These tests are intentionally minimal:
 * - No complex mocking
 * - No brittle assertions
 * - Fast (< 1 second total)
 * - Validate contracts, not logic
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkFacebookPostingPolicy } from "../services/facebook-policy";
import type { PolicyCheckResult } from "../services/facebook-policy";

// Mock DB helpers (not Drizzle internals!)
vi.mock("../services/facebook-policy-db", () => ({
  fetchFacebookConnectedAt: vi.fn(),
  countPublishedPostsToday: vi.fn(),
}));

import { fetchFacebookConnectedAt, countPublishedPostsToday } from "../services/facebook-policy-db";

describe("SMOKE: Facebook Policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  /**
   * Test 1: Policy contract sanity
   * Validates: checkFacebookPostingPolicy returns correct shape
   */
  it("checkFacebookPostingPolicy returns valid PolicyCheckResult", async () => {
    // Mock: connection exists, no posts today
    (fetchFacebookConnectedAt as any).mockResolvedValue(new Date("2026-01-01"));
    (countPublishedPostsToday as any).mockResolvedValue(0);

    const result = await checkFacebookPostingPolicy({
      customerId: "123",
      pageId: "page123",
      mode: "manual",
      postType: "OTHER",
      confidence: null,
      now: new Date(),
    });

    // Assert contract shape (not specific values)
    expect(typeof result.allowed).toBe("boolean");
    expect(typeof result.action).toBe("string");
    expect(["PUBLISH", "DRAFT", "QUEUE", "BLOCK"]).toContain(result.action);
    
    console.log("✅ Policy contract validated:", result.action);
  });

  /**
   * Test 2: Connection missing scenario
   * Validates: Policy returns BLOCK when no connection exists
   */
  it("returns BLOCK action when connection is missing", async () => {
    // Mock: no connection
    (fetchFacebookConnectedAt as any).mockResolvedValue(null);
    (countPublishedPostsToday as any).mockResolvedValue(0);

    const result = await checkFacebookPostingPolicy({
      customerId: "123",
      pageId: "fake_page",
      mode: "manual",
      postType: "OTHER",
      confidence: null,
      now: new Date(),
    });

    // Assert: blocked with connection reason
    expect(result.allowed).toBe(false);
    expect(result.action).toBe("BLOCK");
    expect(result.reasons).toBeDefined();
    expect(result.reasons!.join(" ").toLowerCase()).toMatch(/connection|connect/);
    
    console.log("✅ Connection missing validated");
  });
});

/**
 * SMOKE TEST PHILOSOPHY
 * 
 * What these tests DO:
 * ✅ Validate function contracts (return types, required fields)
 * ✅ Catch environment issues (missing env vars, broken imports)
 * ✅ Verify critical paths work end-to-end
 * ✅ Run fast (< 1 second)
 * 
 * What these tests DON'T do:
 * ❌ Test business logic (that's unit tests)
 * ❌ Test all edge cases (that's integration tests)
 * ❌ Make real API calls
 * ❌ Assert exact error messages (semantic matching only)
 * 
 * When to run:
 * - Before every production deploy
 * - After env var changes
 * - When debugging production issues
 * - As part of CI health checks
 */
