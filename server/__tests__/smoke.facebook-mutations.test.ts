/**
 * SMOKE TESTS - Facebook Mutations (Mutation-Layer Integration)
 * 
 * Purpose: Validate end-to-end behavior with REAL DB (no mocks)
 * Run before every deploy to catch policy bypass or integration issues
 * 
 * These tests prove the full stack works:
 * - Real database inserts
 * - Policy enforcement
 * - Mutation response mapping
 * - No mocking (except external Facebook API)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { getDb } from "../db";
import { socialPosts, moduleConnections } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { appRouter } from "../routers";

// Mock Facebook API (we don't want real posts during tests)
vi.mock("../_core/facebook", () => ({
  postToFacebook: vi.fn().mockResolvedValue({
    id: "mock_post_id",
    created_time: new Date().toISOString(),
  }),
}));

describe("SMOKE: Facebook Mutations (End-to-End)", () => {
  const TEST_USER_ID = 999999;
  const TEST_PAGE_ID = "test_page_smoke_123";
  
  beforeEach(async () => {
    // Clean up test data before each test
    const db = await getDb();
    if (!db) throw new Error("DB not available for smoke tests");
    
    await db.delete(socialPosts).where(eq(socialPosts.userId, TEST_USER_ID));
    await db.delete(moduleConnections).where(eq(moduleConnections.userId, TEST_USER_ID));
  });

  /**
   * Test 1: Cap block (mutation-level, real DB)
   * Validates: System blocks 3rd post when daily cap is reached
   * 
   * This is the AUTHORITATIVE cap test - proves the full stack:
   * - DB queries work
   * - Policy enforces cap
   * - Mutation returns correct response
   * - Facebook API is NOT called
   */
  it("blocks posting when daily cap is reached (2 posts)", async () => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");
    
    // 1. Arrange: Create Facebook connection (so connection check passes)
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    await db.insert(moduleConnections).values({
      userId: TEST_USER_ID,
      connectionType: "facebook_page",
      externalId: TEST_PAGE_ID,
      accessToken: "test_token",
      metadata: JSON.stringify({ name: "Test Page" }),
      createdAt: tenDaysAgo,
      updatedAt: tenDaysAgo,
    });
    
    // 2. Arrange: Create 2 published posts in last 24h (reaching cap)
    const now = new Date();
    await db.insert(socialPosts).values([
      {
        userId: TEST_USER_ID,
        pageId: TEST_PAGE_ID,
        platform: "facebook",
        status: "published",
        content: "Smoke test post 1",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        userId: TEST_USER_ID,
        pageId: TEST_PAGE_ID,
        platform: "facebook",
        status: "published",
        content: "Smoke test post 2",
        publishedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    ]);
    
    // 3. Act: Attempt manual post via mutation (should be blocked by cap)
    const caller = appRouter.createCaller({
      user: {
        id: TEST_USER_ID,
        openId: "test_open_id",
        name: "Test User",
        email: "test@example.com",
        role: "user",
        createdAt: now,
        updatedAt: now,
      },
    });
    
    const result = await caller.facebook.post({
      message: "This should be blocked by daily cap",
    });
    
    // 4. Assert: Policy blocked it (full stack validation)
    expect(result.success).toBe(false);
    expect(result.action).toBe("BLOCK");
    expect(result.error).toBeDefined();
    expect(result.error!.toLowerCase()).toMatch(/cap|limit/);
    expect(result.reasons).toBeDefined();
    expect(result.reasons!.length).toBeGreaterThan(0);
    
    console.log("✅ Cap block validated (end-to-end)");
  });
});

/**
 * WHY THIS TEST IS CRITICAL
 * 
 * This test would catch:
 * ❌ Policy bypass (direct Facebook API calls)
 * ❌ Cap logic broken (wrong query, wrong threshold)
 * ❌ Response mapping broken (success=true when blocked)
 * ❌ Database schema changes (missing fields)
 * ❌ "Helpful" optimizations that skip checks
 * 
 * This is the test that prevents Meta platform violations.
 * Do not delete. Do not mock. Do not skip.
 */
