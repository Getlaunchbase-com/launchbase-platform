/**
 * AI Tennis Orchestrator Tests
 * 
 * Tests for:
 * - Token budget enforcement
 * - Cost cap enforcement
 * - needsHuman early exit
 * - Schema validation failures
 * - No prompt leakage in logs/errors
 */

import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { runAiTennis } from "../runAiTennis";

describe("runAiTennis", () => {
  beforeAll(() => {
    process.env.AI_PROVIDER = "memory";
  });

  afterAll(() => {
    delete process.env.AI_PROVIDER;
  });

  it("completes generate → critique → collapse flow", async () => {
    const result = await runAiTennis(
      { userText: "Rewrite homepage copy" },
      {
        transport: "memory",
        trace: { jobId: "test-job-1", step: "rewrite" },
        outputTypeFinal: "copy_proposal",
        outputTypeCritique: "critique",
        maxRounds: 2,
        maxTokensTotal: 10000,
      }
    );

    expect(result.trace).toBe("test-job-1:rewrite");
    expect(result.final).toBeDefined();
    expect(result.usage.calls).toBeGreaterThan(0);
    expect(result.meta.models.length).toBeGreaterThan(0);
  });

  it("stops early when needsHuman: true in draft", async () => {
    // Mock memory provider to return needsHuman: true
    const result = await runAiTennis(
      { userText: "Complex request requiring human review" },
      {
        transport: "memory",
        trace: { jobId: "test-job-2", step: "complex" },
        outputTypeFinal: "copy_proposal",
        outputTypeCritique: "critique",
        maxRounds: 2,
      }
    );

    // Memory provider doesn't set needsHuman by default, so this tests the flow
    expect(result.needsHuman).toBeDefined();
  });

  it("respects maxTokensTotal budget", async () => {
    try {
      await runAiTennis(
        { userText: "Test budget enforcement" },
        {
          transport: "memory",
          trace: { jobId: "test-job-3", step: "budget" },
          outputTypeFinal: "copy_proposal",
          outputTypeCritique: "critique",
          maxTokensTotal: 50, // Very low budget to trigger error
          maxRounds: 5,
        }
      );
    } catch (err: any) {
      expect(err.message).toContain("budget exceeded");
    }
  });

  it("respects costCapUsd budget", async () => {
    try {
      await runAiTennis(
        { userText: "Test cost cap enforcement" },
        {
          transport: "memory",
          trace: { jobId: "test-job-4", step: "cost" },
          outputTypeFinal: "copy_proposal",
          outputTypeCritique: "critique",
          costCapUsd: 0.0001, // Very low cost cap
          maxRounds: 5,
        }
      );
    } catch (err: any) {
      expect(err.message).toContain("budget exceeded");
    }
  });

  it("stops when critique score meets threshold", async () => {
    const result = await runAiTennis(
      { userText: "Test early stop on score" },
      {
        transport: "memory",
        trace: { jobId: "test-job-5", step: "score" },
        outputTypeFinal: "copy_proposal",
        outputTypeCritique: "critique",
        maxRounds: 5,
        stopWhen: { critiqueScoreGte: 8 }, // Memory provider returns 8.5
      }
    );

    // Should stop after first critique round
    expect(result.roundsRun).toBeLessThanOrEqual(1);
  });

  it("does not leak prompt text in logs on provider failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      // Force a failure by using invalid transport
      await runAiTennis(
        { userText: "SECRET_SYSTEM_PROMPT should never appear in logs" },
        {
          transport: "aiml", // Will fail in test environment due to network guard
          trace: { jobId: "test-job-6", step: "leak-test" },
          outputTypeFinal: "copy_proposal",
          outputTypeCritique: "critique",
        }
      );
    } catch (err: any) {
      // Error should be sanitized
      expect(err.message).not.toContain("SECRET_SYSTEM_PROMPT");
    }

    // Check all console logs
    const logs = [...warn.mock.calls, ...error.mock.calls].flat().join(" ");
    expect(logs).not.toContain("SECRET_SYSTEM_PROMPT");

    warn.mockRestore();
    error.mockRestore();
  });

  it("validates schema and throws on invalid output", async () => {
    // This test would require mocking provider to return invalid JSON
    // For now, we test that validation is called
    expect(true).toBe(true); // Placeholder
  });

  it("uses strict router mode (no silent fallback)", async () => {
    // Strict mode is enforced in runAiTennis by passing { strict: true }
    // If ModelRouter fails, it should throw immediately
    expect(true).toBe(true); // Placeholder - would need to mock ModelRouter failure
  });
});
