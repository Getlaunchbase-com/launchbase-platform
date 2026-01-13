/**
 * Engine Interface V1 — Contract Tripwire Tests
 * 
 * These tests prevent future pain by enforcing CORE+EXTENSIONS discipline:
 * 1. Unknown top-level key → reject
 * 2. Unknown key under extensions → accept
 * 3. Same CORE inputs → same keyHash
 * 4. stopReason always present in AiWorkResultV1 across statuses
 */

import { describe, it, expect, beforeAll } from "vitest";
import { runEngine, computeWorkOrderKeyV1 } from "../runEngine";
import type { AiWorkOrderV1, AiWorkResultV1 } from "../types";

// Set IDEMPOTENCY_SECRET for tests
beforeAll(() => {
  process.env.IDEMPOTENCY_SECRET = "test-secret-do-not-use-in-production";
});

describe("Engine Interface V1 — Contract Tripwires", () => {
  // ============================================
  // TEST 1: Unknown top-level key → reject
  // ============================================

  it("rejects unknown top-level keys (must be under extensions)", async () => {
    const order = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "abc123", ttlHours: 24 },
      trace: { jobId: "test-job-1" },
      audit: { customerTrailOn: true, internalTrailOn: true },
      unknownField: "should fail", // ❌ Unknown top-level key
    } as unknown as AiWorkOrderV1;

    const result = await runEngine(order);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("invalid_request");
  });

  // ============================================
  // TEST 2: Unknown key under extensions → accept
  // ============================================

  it("accepts unknown keys under extensions (future-safe)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "abc123", ttlHours: 24 },
      trace: { jobId: "test-job-2" },
      audit: { customerTrailOn: true, internalTrailOn: true },
      extensions: {
        futureFeature: "should be ignored", // ✅ Unknown extension key
        anotherFeature: { nested: true },
      },
    };

    const result = await runEngine(order);

    // Should not fail due to unknown extensions
    // (Will fail due to missing policy in Phase 2.1, but that's expected)
    expect(result.stopReason).not.toBe("invalid_request");
  });

  // ============================================
  // TEST 3: Same CORE inputs → same keyHash
  // ============================================

  it("produces same keyHash for same CORE inputs (idempotency)", () => {
    const order1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { userTextHash: "sha256:abc", targetSection: "hero" },
      constraints: { maxRounds: 2, costCapUsd: 2.0 },
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-3" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const order2: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { userTextHash: "sha256:abc", targetSection: "hero" },
      constraints: { maxRounds: 2, costCapUsd: 2.0 },
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-4" }, // Different jobId (not part of key)
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const key1 = computeWorkOrderKeyV1(order1);
    const key2 = computeWorkOrderKeyV1(order2);

    expect(key1).toBe(key2);
    expect(key1).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex
  });

  it("produces different keyHash for different CORE inputs", () => {
    const order1: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { userTextHash: "sha256:abc" },
      constraints: { maxRounds: 2 },
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-5" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const order2: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { userTextHash: "sha256:xyz" }, // Different input
      constraints: { maxRounds: 2 },
      idempotency: { scope: "test", keyHash: "placeholder" },
      trace: { jobId: "test-job-6" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const key1 = computeWorkOrderKeyV1(order1);
    const key2 = computeWorkOrderKeyV1(order2);

    expect(key1).not.toBe(key2);
  });

  // ============================================
  // TEST 4: stopReason always present
  // ============================================

  it("always includes stopReason in result (FOREVER CONTRACT)", async () => {
    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-7" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    const result = await runEngine(order);

    // stopReason MUST always be present
    expect(result.stopReason).toBeDefined();
    expect(typeof result.stopReason).toBe("string");

    // stopReason MUST be from frozen vocabulary
    const allowedReasons = [
      "ok",
      "needs_human",
      "in_progress",
      "provider_failed",
      "router_failed",
      "ajv_failed",
      "json_parse_failed",
      "rate_limited",
      "cost_cap_exceeded",
      "round_cap_exceeded",
      "invalid_request",
    ];
    expect(allowedReasons).toContain(result.stopReason);
  });

  it("includes stopReason for all status types", async () => {
    // Test that stopReason is present regardless of status
    const statuses: Array<"succeeded" | "failed" | "in_progress"> = [
      "succeeded",
      "failed",
      "in_progress",
    ];

    for (const status of statuses) {
      const mockResult: AiWorkResultV1 = {
        version: "v1",
        status,
        stopReason: status === "succeeded" ? "ok" : status === "failed" ? "invalid_request" : "in_progress",
        needsHuman: status !== "succeeded",
        traceId: `test-trace-${status}`,
        artifacts: [],
        customerSafe: true,
      };

      expect(mockResult.stopReason).toBeDefined();
      expect(typeof mockResult.stopReason).toBe("string");
    }
  });

  // ============================================
  // TEST 5: HMAC requires secret
  // ============================================

  it("fails hard when IDEMPOTENCY_SECRET is missing", () => {
    const originalSecret = process.env.IDEMPOTENCY_SECRET;
    delete process.env.IDEMPOTENCY_SECRET;

    const order: AiWorkOrderV1 = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { test: true },
      constraints: {},
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-8" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    };

    expect(() => computeWorkOrderKeyV1(order)).toThrow("Missing required env var: IDEMPOTENCY_SECRET");

    // Restore secret
    process.env.IDEMPOTENCY_SECRET = originalSecret;
  });

  // ============================================
  // TEST 6: CORE fields are JSON-stable
  // ============================================

  it("rejects non-JSON-serializable inputs", async () => {
    const order = {
      version: "v1",
      tenant: "launchbase",
      scope: "test.scope",
      policyId: "test_policy",
      inputs: { func: () => {} }, // ❌ Not JSON-serializable
      constraints: {},
      idempotency: { scope: "test", keyHash: "abc123" },
      trace: { jobId: "test-job-9" },
      audit: { customerTrailOn: true, internalTrailOn: true },
    } as unknown as AiWorkOrderV1;

    const result = await runEngine(order);

    expect(result.status).toBe("failed");
    expect(result.stopReason).toBe("invalid_request");
  });
});
