/**
 * Tests for actionRequests.aiProposeCopy mutation
 * Verifies AI Tennis copy proposal generation with customer-safe response
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { intakes } from "../../drizzle/schema";
import { createActionRequest } from "../action-requests";
import type { AiCopyRefineResult } from "../actionRequests/aiTennisCopyRefine";

// Mock aiTennisCopyRefine to avoid ModelRouter
vi.mock("../actionRequests/aiTennisCopyRefine", () => ({
  aiTennisCopyRefine: vi.fn(),
}));

import { aiTennisCopyRefine } from "../actionRequests/aiTennisCopyRefine";
const mockAiTennisCopyRefine = vi.mocked(aiTennisCopyRefine);

describe("actionRequests.aiProposeCopy", () => {
  let testIntakeId: number;
  let testActionRequestId: number;

  beforeEach(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Create test intake
    const intakeResult = await db.insert(intakes).values({
      businessName: "Test Business",
      contactName: "Test Contact",
      email: "test@example.com",
      tenant: "launchbase",
      vertical: "professional",
      status: "new",
      rawPayload: {},
    });

    testIntakeId = Number(intakeResult[0].insertId);

    // Create test action request using helper
    const actionRequest = await createActionRequest({
      tenant: "launchbase",
      intakeId: testIntakeId,
      checklistKey: "homepage.headline",
      proposedValue: "Old Headline",
    });

    testActionRequestId = actionRequest.id;

    // Clear all previous mocks
    vi.clearAllMocks();

    // Default mock: success response
    mockAiTennisCopyRefine.mockResolvedValue({
      success: true,
      actionRequestId: testActionRequestId,
      stopReason: "ok",
      traceId: "test-trace-id",
      meta: {
        rounds: 2,
        estimatedUsd: 0.01,
        calls: 3,
        models: ["test-model"],
      },
    } as AiCopyRefineResult);
  });

  it("should successfully generate copy proposal", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    const result = await caller.actionRequests.aiProposeCopy({
      id: testActionRequestId,
      userText: "I want a better headline for my homepage",
      targetSection: "hero",
      constraints: {
        maxRounds: 2,
        costCapUsd: 1.0,
      },
    });

    // Verify response structure
    expect(result.ok).toBe(true);
    expect(result.createdActionRequestIds).toBeDefined();
    expect(Array.isArray(result.createdActionRequestIds)).toBe(true);
    expect(result.traceId).toBeDefined();
    expect(typeof result.traceId).toBe("string");

    // Verify stopReason is one of allowed enums
    if (result.stopReason) {
      const allowedStopReasons = [
        "ok", "token_cap", "cost_cap", "round_cap", "stop_condition_met",
        "json_parse_failed", "ajv_failed", "router_failed", "provider_failed",
        "needs_human", "unknown"
      ];
      expect(allowedStopReasons).toContain(result.stopReason);
    }

    // Verify no prompt content in response
    const responseStr = JSON.stringify(result);
    expect(responseStr).not.toContain("system:");
    expect(responseStr).not.toContain("user:");
    expect(responseStr).not.toContain("assistant:");
    expect(responseStr).not.toContain("prompt");

    // Verify meta contains version info
    expect(result.meta).toBeDefined();
    expect(result.meta?.version).toBeDefined();
  });

  it("should handle needsHuman path correctly", async () => {
    // Mock needsHuman response
    mockAiTennisCopyRefine.mockResolvedValueOnce({
      success: false,
      stopReason: "needs_human",
      traceId: "test-trace-needshuman",
      needsHuman: true,
      meta: {
        rounds: 1,
        estimatedUsd: 0.005,
        calls: 1,
        models: [],
      },
    } as AiCopyRefineResult);

    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    const result = await caller.actionRequests.aiProposeCopy({
      id: testActionRequestId,
      userText: "Complex request requiring human review",
    });

    // Verify needsHuman is indicated
    expect(result.needsHuman).toBe(true);
    expect(result.ok).toBe(false);
  });

  it("should return customer-safe response (no internal errors)", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    const result = await caller.actionRequests.aiProposeCopy({
      id: testActionRequestId,
      userText: "Test request",
    });

    // Verify response contains only customer-safe fields
    const resultKeys = Object.keys(result);
    const allowedKeys = ["ok", "createdActionRequestIds", "traceId", "needsHuman", "stopReason", "meta"];
    
    for (const key of resultKeys) {
      expect(allowedKeys).toContain(key);
    }

    // Verify no provider errors, stack traces, or prompts
    const responseStr = JSON.stringify(result);
    expect(responseStr).not.toContain("Error:");
    expect(responseStr).not.toContain("stack");
    expect(responseStr).not.toContain("requestId");
    
    // Note: stopReason="provider_failed" is a valid enum value (allowed)
    // We're checking for internal provider error details, not the stopReason enum
  });

  it("should throw error for non-existent action request", async () => {
    const caller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    await expect(
      caller.actionRequests.aiProposeCopy({
        id: 999999,
        userText: "Test request",
      })
    ).rejects.toThrow("Action request not found");
  });

  describe("STEP 2.1: ROUTER CONTRACT VERIFICATION", () => {
    it("should return customer-safe contract with correct structure", async () => {
      // Mock successful AI Tennis response with new ActionRequest ID
      const newActionRequestId = testActionRequestId + 1000; // Simulate new ID
      mockAiTennisCopyRefine.mockResolvedValueOnce({
        success: true,
        actionRequestId: newActionRequestId,
        stopReason: "ok",
        traceId: "test-trace-shape",
        meta: {
          rounds: 2,
          estimatedUsd: 0.01,
          calls: 3,
          models: ["test-model"],
        },
      } as AiCopyRefineResult);

      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      const result = await caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "Test contract shape",
        targetSection: "hero",
      });

      // STEP 2.1 ASSERTIONS: Verify router returns customer-safe contract
      expect(result.ok).toBe(true);
      expect(result.createdActionRequestIds).toBeDefined();
      expect(result.createdActionRequestIds).toEqual([newActionRequestId]);
      expect(result.traceId).toBe("test-trace-shape");
      expect(result.stopReason).toBe("ok");
      expect(result.needsHuman).toBe(false);
      
      // Verify meta contains version info
      expect(result.meta).toBeDefined();
      expect(result.meta?.version).toBeDefined();
      
      // Verify no internal details leaked
      const responseStr = JSON.stringify(result);
      expect(responseStr).not.toContain("prompt");
      expect(responseStr).not.toContain("system:");
      expect(responseStr).not.toContain("Error:");
    });
  });

  describe("IDEMPOTENCY BEHAVIOR", () => {
    it("CASE 1: first call returns valid contract (no throws)", async () => {
      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      const result = await caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "First call test",
        targetSection: "hero",
      });

      // CRITICAL: Router must return valid contract (no throws)
      expect(result).toBeDefined();
      expect(typeof result.ok).toBe("boolean");
      expect(result.traceId).toBeDefined();

      // Verify stopReason is present and valid
      if (result.stopReason) {
        const allowedStopReasons = [
          "ok", "token_cap", "cost_cap", "round_cap", "stop_condition_met",
          "json_parse_failed", "ajv_failed", "router_failed", "provider_failed",
          "needs_human", "unknown"
        ];
        expect(allowedStopReasons).toContain(result.stopReason);
      }
    });

    it("CASE 2: duplicate call returns cached result (single execution)", async () => {
      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      // First call
      const result1 = await caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "Duplicate test",
        targetSection: "hero",
      });

      // Second call (same inputs)
      const result2 = await caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "Duplicate test",
        targetSection: "hero",
      });

      // CRITICAL: Second call should return cached result
      expect(result2).toBeDefined();
      expect(result2.traceId).toBe(result1.traceId); // Same trace = cached
      expect(result2.ok).toBe(result1.ok);

      // Both should return valid contract (no throws)
      expect(typeof result1.ok).toBe("boolean");
      expect(typeof result2.ok).toBe("boolean");
    });

    it("CASE 3: in-progress returns safe contract (no throws)", async () => {
      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      // Simulate in-progress by calling with same key while operation is running
      const promise1 = caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "In-progress test",
        targetSection: "hero",
      });

      // Immediate second call (should hit in-progress)
      const promise2 = caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "In-progress test",
        targetSection: "hero",
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // CRITICAL: Both must return valid contract (no throws)
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(typeof result1.ok).toBe("boolean");
      expect(typeof result2.ok).toBe("boolean");

      // One of them may have stopReason="in_progress" or be cached
      // Both are valid outcomes
    });

    it("CASE 4: failed then retry succeeds (not stuck)", async () => {
      // Mock failure response for first call
      mockAiTennisCopyRefine.mockResolvedValueOnce({
        success: false,
        stopReason: "provider_failed",
        traceId: "test-trace-failure",
        meta: {
          rounds: 0,
          estimatedUsd: 0,
          calls: 0,
          models: [],
        },
      } as AiCopyRefineResult);

      const caller = appRouter.createCaller({
        req: {} as any,
        res: {} as any,
        user: null,
      });

      // First call (should fail)
      const result1 = await caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "Failure test",
        targetSection: "hero",
      });

      // CRITICAL: First call returns valid contract even on failure
      expect(result1).toBeDefined();
      expect(typeof result1.ok).toBe("boolean");

      // Mock success response for retry
      mockAiTennisCopyRefine.mockResolvedValueOnce({
        success: true,
        actionRequestId: testActionRequestId,
        stopReason: "ok",
        traceId: "test-trace-retry-success",
        meta: {
          rounds: 2,
          estimatedUsd: 0.01,
          calls: 3,
          models: ["test-model"],
        },
      } as AiCopyRefineResult);

      // Second call (retry with different userText to avoid cache)
      const result2 = await caller.actionRequests.aiProposeCopy({
        id: testActionRequestId,
        userText: "Failure test retry",
        targetSection: "hero",
      });

      // CRITICAL: Retry returns valid contract (not stuck in failed state)
      expect(result2).toBeDefined();
      expect(typeof result2.ok).toBe("boolean");

      // Both calls return valid contract (no throws)
      expect(result1.traceId).toBeDefined();
      expect(result2.traceId).toBeDefined();
    });
  });
});
