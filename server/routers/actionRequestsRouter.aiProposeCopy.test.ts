/**
 * Tests for actionRequests.aiProposeCopy mutation
 * Verifies AI Tennis copy proposal generation with customer-safe response
 */

import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "../routers";
import { getDb } from "../db";
import { intakes } from "../../drizzle/schema";
import { createActionRequest } from "../action-requests";
import { seedMemoryTraceResponse } from "../ai/providers/providerFactory";

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

    // Seed memory provider with trace-based responses
    const validDecisionCollapse = {
      schemaVersion: "v1",
      selectedProposal: {
        targetKey: "hero.headline",
        value: "Transform Your Business Today",
        rationale: "Clear, action-oriented headline",
        confidence: 0.9,
        risks: [],
      },
      reason: "High confidence proposal",
      confidence: 0.9,
      requiresApproval: true,
      needsHuman: false,
    };

    seedMemoryTraceResponse(
      "decision_collapse",
      "router",
      "copy-refine-test-success",
      1,
      JSON.stringify(validDecisionCollapse)
    );
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
    // Seed needsHuman response
    const needsHumanCollapse = {
      schemaVersion: "v1",
      selectedProposal: null,
      reason: "Requires human review",
      confidence: 0.4,
      requiresApproval: true,
      needsHuman: true,
    };

    seedMemoryTraceResponse(
      "decision_collapse",
      "router",
      "copy-refine-test-needshuman",
      1,
      JSON.stringify(needsHumanCollapse)
    );

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
    expect(responseStr).not.toContain("provider");
    expect(responseStr).not.toContain("requestId");
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
});
