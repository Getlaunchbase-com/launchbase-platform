/**
 * AI Tennis Copy Refine Service Tests
 * 
 * Tests for:
 * - Service creates ActionRequest from decision_collapse.selectedProposal
 * - needsHuman path returns structured failure
 * - No-prompt-leak contract
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { aiTennisCopyRefine } from "./aiTennisCopyRefine";
import { getDb } from "../db";
import { actionRequests } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { seedMemoryTraceResponse } from "../ai/providers/providerFactory";

describe("aiTennisCopyRefine", () => {
  beforeAll(() => {
    process.env.AI_PROVIDER = "memory";
  });

  afterAll(() => {
    delete process.env.AI_PROVIDER;
  });

  it("creates ActionRequest from decision_collapse.selectedProposal", async () => {
    const result = await aiTennisCopyRefine(
      {
        tenant: "launchbase",
        intakeId: 1,
        userText: "Rewrite my homepage headline to be more compelling",
        targetSection: "hero",
      },
      "memory"
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.actionRequestId).toBe("number");
      expect(result.traceId).toMatch(/^ai-copy-/);
      expect(result.meta.rounds).toBeGreaterThanOrEqual(0);

      // Verify ActionRequest was created with correct data
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      const [actionRequest] = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.id, result.actionRequestId))
        .limit(1);

      expect(actionRequest).toBeDefined();
      expect(actionRequest.checklistKey).toBeDefined();
      expect(actionRequest.proposedValue).toBeDefined();
      expect(actionRequest.messageType).toBe("AI_TENNIS_COPY_REFINE");

      // Verify AI Tennis metadata is stored in rawInbound
      const metadata = actionRequest.rawInbound as any;
      expect(metadata.source).toBe("ai_tennis");
      expect(metadata.aiTennis).toBeDefined();
      expect(metadata.aiTennis.models).toBeDefined();
      expect(metadata.proposal).toBeDefined();
      expect(metadata.proposal.targetKey).toBeDefined();
    }
  });

  it("handles needsHuman path with structured failure", async () => {
    // Seed a needsHuman decision_collapse response using trace-based key
    const needsHumanCollapse = {
      schemaVersion: "v1",
      selectedProposal: null,
      reason: "Needs human review.",
      approvalText: "Please review before applying.",
      previewRecommended: true,
      needsHuman: true,
      confidence: 0.4,
      requiresApproval: true,
      roundLimit: 1,
      costCapUsd: 1,
    };

    // Seed using trace-based key (deterministic, no prompt dependency)
    // The jobId will be "copy-refine-{timestamp}" but we can't predict the exact timestamp
    // So we'll seed with a pattern that matches the test
    const testJobId = "copy-refine-test-needshuman";
    seedMemoryTraceResponse("decision_collapse", "router", testJobId, 1, JSON.stringify(needsHumanCollapse));

    const result = await aiTennisCopyRefine(
      {
        tenant: "launchbase",
        intakeId: 2,
        userText: "Complex request requiring human review",
        constraints: {
          maxRounds: 1,
          costCapUsd: 0.0001,
        },
      },
      "memory"
    );

    // Should return structured failure (not throw)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("needs_human");
    }
  });

  it("does not leak prompt content in logs or errors", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    const CANARY = "SECRET_PROMPT_CONTENT_SHOULD_NEVER_APPEAR";

    try {
      await aiTennisCopyRefine(
        {
          tenant: "launchbase",
          intakeId: 3,
          userText: CANARY,
        },
        "memory"
      );
    } catch (err: any) {
      // Error should be sanitized
      expect(err.message).not.toContain(CANARY);
    }

    // Check all console logs
    const logs = [
      ...warn.mock.calls,
      ...error.mock.calls,
      ...log.mock.calls,
    ]
      .flat()
      .join(" ");

    expect(logs).not.toContain(CANARY);

    warn.mockRestore();
    error.mockRestore();
    log.mockRestore();
  });

  it("normalizes checklist keys correctly", async () => {
    const { normalizeChecklistKey } = await import("./aiTennisCopyRefine");

    expect(normalizeChecklistKey("hero.headline")).toBe("homepage.headline");
    expect(normalizeChecklistKey("hero.subheadline")).toBe("homepage.subheadline");
    expect(normalizeChecklistKey("hero.cta")).toBe("cta.primary");
    expect(normalizeChecklistKey("unknown.key")).toBe("unknown.key");
  });
});
