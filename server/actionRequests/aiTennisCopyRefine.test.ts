/**
 * AI Tennis Copy Refine Service Tests
 * 
 * Tests for:
 * - Service creates ActionRequest from CopyProposal.variants[0] (or DecisionCollapse.selectedProposal)
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

  it("creates ActionRequest from CopyProposal.variants[0]", async () => {
    // Seed all three phases for complete AI Tennis flow
    // Use wildcard jobId (any string works with wildcard matching)
    const testJobId = "*";
    
    // Phase 1: copy_proposal (round 0 - generate)
    const copyProposal = {
      schemaVersion: "v1",
      variants: [
        {
          targetKey: "hero.headline",
          value: "Transform Your Business with AI",
          rationale: "Clear value proposition",
          confidence: 0.9,
          risks: [],
        },
      ],
      requiresApproval: true,
      confidence: 0.9,
      risks: [],
      assumptions: [],
    };
    seedMemoryTraceResponse("copy_proposal", "router", testJobId, 0, JSON.stringify(copyProposal));

    // Phase 2: critique (round 1)
    const critique = {
      schemaVersion: "v1",
      pass: true,
      issues: [],
      suggestedFixes: [],
      confidence: 0.9,
      requiresApproval: true,
      evaluationCriteria: {
        clarity: 0.9,
        trust: 0.85,
        scanability: 0.88,
        mobileFold: 0.9,
        sectionContractCompliance: 0.9,
      },
    };
    seedMemoryTraceResponse("critique", "router", testJobId, 1, JSON.stringify(critique));

    // Phase 3: decision_collapse (round 1)
    const decisionCollapse = {
      schemaVersion: "v1",
      selectedProposal: {
        type: "copy" as const,
        targetKey: "hero.headline" as const,
        value: "Transform Your Business with AI",
      },
      reason: "Approved after review",
      approvalText: "This looks good",
      previewRecommended: false,
      needsHuman: false,
      confidence: 0.9,
      requiresApproval: true,
      roundLimit: 2,
      costCapUsd: 10,
    };
    seedMemoryTraceResponse("decision_collapse", "router", testJobId, 1, JSON.stringify(decisionCollapse));

    const result = await aiTennisCopyRefine(
      {
        tenant: "launchbase",
        intakeId: 1,
        userText: "Rewrite my homepage headline to be more compelling",
        targetSection: "hero",
        constraints: {
          maxRounds: 1, // Clamp to 1 to guarantee only round 0 + round 1
        },
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
    // Seed all three phases with needsHuman decision_collapse
    const testJobId = "*";
    
    // Phase 1: copy_proposal (round 0 - generate)
    const copyProposal = {
      schemaVersion: "v1",
      variants: [
        {
          targetKey: "hero.headline",
          value: "Complex Headline Needs Review",
          rationale: "Uncertain",
          confidence: 0.5,
          risks: ["Low confidence"],
        },
      ],
      requiresApproval: true,
      confidence: 0.5,
      risks: ["Low confidence"],
      assumptions: [],
    };
    seedMemoryTraceResponse("copy_proposal", "router", testJobId, 0, JSON.stringify(copyProposal));

    // Phase 2: critique (round 1)
    const critique = {
      schemaVersion: "v1",
      pass: false,
      issues: [
        {
          severity: "major" as const,
          description: "Low confidence in proposal",
          affectedKey: "hero.headline",
        },
      ],
      suggestedFixes: [
        {
          targetKey: "hero.headline",
          fix: "Needs human review",
          rationale: "Uncertain proposal quality",
        },
      ],
      confidence: 0.5,
      requiresApproval: true,
      evaluationCriteria: {
        clarity: 0.5,
        trust: 0.5,
        scanability: 0.5,
        mobileFold: 0.5,
        sectionContractCompliance: 0.5,
      },
    };
    seedMemoryTraceResponse("critique", "router", testJobId, 1, JSON.stringify(critique));

    // Phase 3: decision_collapse with needsHuman=true
    const needsHumanCollapse = {
      schemaVersion: "v1",
      selectedProposal: null,
      reason: "Needs human review.",
      approvalText: "Please review before applying.",
      previewRecommended: true,
      needsHuman: true,
      needsHumanReason: "Low confidence in proposal quality",
      confidence: 0.4,
      requiresApproval: true,
      roundLimit: 1,
      costCapUsd: 1,
    };

    seedMemoryTraceResponse("decision_collapse", "router", testJobId, 1, JSON.stringify(needsHumanCollapse));

    const result = await aiTennisCopyRefine(
      {
        tenant: "launchbase",
        intakeId: 2,
        userText: "Complex request requiring human review",
        constraints: {
          maxRounds: 1,
          // No costCapUsd - memory provider has zero cost
        },
      },
      "memory"
    );

    // Should return structured failure (not throw)
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.stopReason).toBe("needs_human");
      expect(result.needsHuman).toBe(true);
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

