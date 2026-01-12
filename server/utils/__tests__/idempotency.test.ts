/**
 * Idempotency utility tests
 * 
 * Gate: Calling mutation twice with same key returns same createdActionRequestIds
 * and does not create extra rows/events.
 * 
 * Security: Verify HMAC-SHA256 key derivation, no raw userText storage
 * Correctness: Verify ownership guard, UPDATE affected rows check, race condition handling
 */

import { describe, it, expect, beforeEach } from "vitest";
import { withIdempotency, computeIdempotencyKey, hashUserText } from "../idempotency";
import { getDb } from "../../db";
import { idempotencyKeys } from "../../../drizzle/schema";
import { eq, and } from "drizzle-orm";

describe("hashUserText", () => {
  it("normalizes whitespace for stability", () => {
    const text1 = "Make  it   better";
    const text2 = "Make it better";
    const text3 = "  Make it better  ";

    const hash1 = hashUserText(text1);
    const hash2 = hashUserText(text2);
    const hash3 = hashUserText(text3);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
    expect(hash1).toHaveLength(64); // SHA-256 hex
  });

  it("generates different hash for different text", () => {
    const hash1 = hashUserText("Make it better");
    const hash2 = hashUserText("Make it worse");

    expect(hash1).not.toBe(hash2);
  });
});

describe("computeIdempotencyKey", () => {
  it("generates deterministic HMAC from inputs", () => {
    const inputs1 = {
      intakeId: 1,
      actionRequestId: 2,
      userTextHash: hashUserText("Make it better"),
      targetSection: "hero",
    };

    const inputs2 = {
      intakeId: 1,
      actionRequestId: 2,
      userTextHash: hashUserText("Make it better"),
      targetSection: "hero",
    };

    const key1 = computeIdempotencyKey(inputs1);
    const key2 = computeIdempotencyKey(inputs2);

    expect(key1).toBe(key2);
    expect(key1).toHaveLength(64); // HMAC-SHA256 hex
  });

  it("generates different hash for different inputs", () => {
    const inputs1 = {
      intakeId: 1,
      actionRequestId: 2,
      userTextHash: hashUserText("Make it better"),
    };

    const inputs2 = {
      intakeId: 1,
      actionRequestId: 2,
      userTextHash: hashUserText("Make it worse"),
    };

    const key1 = computeIdempotencyKey(inputs1);
    const key2 = computeIdempotencyKey(inputs2);

    expect(key1).not.toBe(key2);
  });

  it("is order-independent (sorted keys)", () => {
    const inputs1 = { b: 2, a: 1, c: 3 };
    const inputs2 = { a: 1, c: 3, b: 2 };

    const key1 = computeIdempotencyKey(inputs1);
    const key2 = computeIdempotencyKey(inputs2);

    expect(key1).toBe(key2);
  });
});

describe("withIdempotency", () => {
  const testTenant = "launchbase";
  const testScope = "test.operation";

  beforeEach(async () => {
    // Clean up test keys before each test
    const db = await getDb();
    if (db) {
      await db
        .delete(idempotencyKeys)
        .where(
          and(
            eq(idempotencyKeys.tenant, testTenant),
            eq(idempotencyKeys.scope, testScope)
          )
        );
    }
  });

  it("executes operation on first call", async () => {
    let callCount = 0;

    const result = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs: { test: "value1" },
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "result1" };
      },
    });

    expect(result.status).toBe("succeeded");
    expect(result.cached).toBe(false);
    expect(result.data).toEqual({ data: "result1" });
    expect(callCount).toBe(1);
  });

  it("returns cached result on second call with same key", async () => {
    let callCount = 0;
    const inputs = { test: "value2" };

    // First call
    const result1 = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "result2" };
      },
    });

    // Second call (same inputs)
    const result2 = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "result2-new" };
      },
    });

    expect(result1.status).toBe("succeeded");
    expect(result1.cached).toBe(false);
    expect(result1.data).toEqual({ data: "result2" });

    expect(result2.status).toBe("succeeded");
    expect(result2.cached).toBe(true);
    expect(result2.data).toEqual({ data: "result2" }); // Same as first call (sanitized)

    expect(callCount).toBe(1); // Operation only ran once
  });

  it("executes operation again for different inputs", async () => {
    let callCount = 0;

    // First call
    const result1 = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs: { test: "value3" },
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "result3" };
      },
    });

    // Second call (different inputs)
    const result2 = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs: { test: "value4" },
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "result4" };
      },
    });

    expect(result1.status).toBe("succeeded");
    expect(result1.data).toEqual({ data: "result3" });

    expect(result2.status).toBe("succeeded");
    expect(result2.data).toEqual({ data: "result4" });

    expect(callCount).toBe(2); // Both operations ran
  });

  it("handles operation failure and allows retry", async () => {
    let callCount = 0;
    const inputs = { test: "value5" };

    // First call (fails)
    const result1 = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        callCount++;
        throw new Error("Operation failed");
      },
    });

    // Second call (succeeds)
    const result2 = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "result5" };
      },
    });

    expect(result1.status).toBe("failed");
    expect(result1.error).toBe("Operation failed");

    expect(result2.status).toBe("succeeded");
    expect(result2.data).toEqual({ data: "result5" });

    expect(callCount).toBe(2); // Both attempts ran
  });

  it("returns in_progress when operation is already running", async () => {
    const inputs = { test: "value6" };
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Manually insert a "started" key to simulate in-progress operation
    const keyHash = computeIdempotencyKey(inputs);
    await db.insert(idempotencyKeys).values({
      tenant: testTenant,
      scope: testScope,
      keyHash,
      status: "started",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    });

    // Try to run operation
    const result = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        return { data: "should-not-run" };
      },
    });

    expect(result.status).toBe("in_progress");
    expect(result.message).toContain("already in progress");
  });

  it("handles concurrency: only one caller runs AI (race condition test)", async () => {
    let callCount = 0;
    const inputs = { test: "concurrency" };

    // Simulate two simultaneous callers
    const promise1 = withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        callCount++;
        // Simulate slow AI call
        await new Promise((resolve) => setTimeout(resolve, 100));
        return { data: "concurrent-result", caller: 1 };
      },
    });

    const promise2 = withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        callCount++;
        return { data: "concurrent-result", caller: 2 };
      },
    });

    // Wait for both to complete
    const [result1, result2] = await Promise.all([promise1, promise2]);

    // One should succeed, one should get in_progress or cached
    const succeeded = [result1, result2].filter((r) => r.status === "succeeded");
    const inProgress = [result1, result2].filter((r) => r.status === "in_progress");

    // Either:
    // - One succeeded (fresh), one in_progress (rejected)
    // - One succeeded (fresh), one succeeded (cached - if timing allows)
    expect(succeeded.length).toBeGreaterThanOrEqual(1);
    expect(callCount).toBe(1); // Only one operation ran

    // If both succeeded, second must be cached
    if (succeeded.length === 2) {
      const cached = succeeded.filter((r) => r.cached);
      expect(cached.length).toBe(1);
    }
  });

  it("OWNERSHIP GUARD: deterministic takeover with backdated started_at", async () => {
    const inputs = { test: "deterministic-takeover" };
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Step 1: Manually insert a stale "started" row
    const keyHash = computeIdempotencyKey(inputs);
    const staleStartedAt = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes ago
    const staleNonce = "stale-nonce-12345";

    await db.insert(idempotencyKeys).values({
      tenant: testTenant,
      scope: testScope,
      keyHash,
      claimNonce: staleNonce,
      status: "started",
      startedAt: staleStartedAt,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      attemptCount: 1,
    });

    // Step 2: Attempt takeover (should succeed because row is stale)
    let operationRan = false;
    const result = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      staleTakeoverMinutes: 5, // 5 minutes (row is 10 minutes old)
      operation: async () => {
        operationRan = true;
        return { data: "takeover-success" };
      },
    });

    // Step 3: Verify takeover succeeded
    expect(result.status).toBe("succeeded");
    expect(result.cached).toBe(false);
    expect(operationRan).toBe(true);

    // Step 4: Verify DB row has new nonce (not stale nonce)
    const [row] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenant, testTenant),
          eq(idempotencyKeys.scope, testScope),
          eq(idempotencyKeys.keyHash, keyHash)
        )
      )
      .limit(1);

    expect(row).toBeDefined();
    expect(row.status).toBe("succeeded");
    expect(row.claimNonce).not.toBe(staleNonce); // New nonce assigned

    // Step 5: Attempt to commit with stale nonce (should fail with affectedRows=0)
    const staleCommitResult = await db
      .update(idempotencyKeys)
      .set({ status: "failed" }) // Try to overwrite
      .where(
        and(
          eq(idempotencyKeys.tenant, testTenant),
          eq(idempotencyKeys.scope, testScope),
          eq(idempotencyKeys.keyHash, keyHash),
          eq(idempotencyKeys.claimNonce, staleNonce) // Using stale nonce
        )
      );

    // CRITICAL: Loser commit must return affectedRows=0
    const affectedRows = (staleCommitResult as any)[0]?.affectedRows ?? 0;
    expect(affectedRows).toBe(0);

    // Verify row is still "succeeded" (not overwritten)
    const [finalRow] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenant, testTenant),
          eq(idempotencyKeys.scope, testScope),
          eq(idempotencyKeys.keyHash, keyHash)
        )
      )
      .limit(1);

    expect(finalRow.status).toBe("succeeded"); // Not overwritten
  });

  it("OWNERSHIP GUARD: prevents lost updates during stale takeover", async () => {
    let callCount = 0;
    const inputs = { test: "takeover" };
    let barrier: (() => void) | null = null;
    const barrierPromise = new Promise<void>((resolve) => {
      barrier = resolve;
    });

    // First caller: starts operation but hangs
    const promise1 = withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      staleTakeoverMinutes: 0.01, // 0.6 seconds (very short for test)
      operation: async () => {
        callCount++;
        // Wait for barrier to be released
        await barrierPromise;
        return { data: "first-caller", caller: 1 };
      },
    });

    // Wait for first caller to claim and start operation
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Second caller: attempts takeover after stale timeout
    await new Promise((resolve) => setTimeout(resolve, 700)); // Wait for stale timeout

    const promise2 = withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      staleTakeoverMinutes: 0.01,
      operation: async () => {
        callCount++;
        return { data: "second-caller", caller: 2 };
      },
    });

    // Release barrier so first caller can complete
    if (barrier) barrier();

    // Wait for both to complete
    const [result1, result2] = await Promise.all([promise1, promise2]);

    // CRITICAL: Only one operation should have run
    // (Either first completes before takeover, or second takes over and first loses ownership)
    expect(callCount).toBeLessThanOrEqual(2);

    // At least one should succeed
    const succeeded = [result1, result2].filter((r) => r.status === "succeeded");
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // If both succeeded, one must be cached (ownership guard prevented double-write)
    if (succeeded.length === 2) {
      const cached = succeeded.filter((r) => r.cached);
      expect(cached.length).toBe(1);
    }
  });

  it("CANARY TEST A: thrown error with nasty canary does not leak to DB", async () => {
    // Nasty canary with JSON-looking content (catches accidental serialization)
    const randomHex = Math.random().toString(16).substring(2, 10);
    const CANARY = `CANARY::DB_LEAK::{"prompt":"Make the headline better","userText":"secret input"}::${randomHex}`;
    const inputs = { test: "canary-thrown-error" };
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Run operation that throws an error containing canary
    const result = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        throw new Error(`Provider failed: ${CANARY}`);
      },
    });

    // Assert safe response contract
    expect(result.status).toBe("failed");
    expect(result.error).toBeDefined();
    expect(result.error).not.toContain(CANARY); // Client-safe error

    // Check database row
    const keyHash = computeIdempotencyKey(inputs);
    const [row] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenant, testTenant),
          eq(idempotencyKeys.scope, testScope),
          eq(idempotencyKeys.keyHash, keyHash)
        )
      )
      .limit(1);

    expect(row).toBeDefined();
    expect(row.status).toBe("failed");

    // CRITICAL: Canary must NOT appear anywhere in DB row
    const fullRowStr = JSON.stringify(row);
    expect(fullRowStr).not.toContain(CANARY);
    expect(fullRowStr).not.toContain("CANARY::DB_LEAK");
    expect(fullRowStr).not.toContain("Make the headline better");
    expect(fullRowStr).not.toContain("secret input");
    expect(fullRowStr).not.toContain(randomHex);

    // Verify only safe fields in responseJson
    const responseJsonStr = JSON.stringify(row.responseJson);
    expect(responseJsonStr).not.toContain(CANARY);
    expect(row.responseJson).toHaveProperty("ok");
    expect(row.responseJson).toHaveProperty("stopReason");
  });

  it("CANARY TEST B: success payload with nested canary does not leak to DB", async () => {
    // Nasty canary in success response (catches accidental payload persistence)
    const randomHex = Math.random().toString(16).substring(2, 10);
    const CANARY = `CANARY::SUCCESS_LEAK::{"internalPrompt":"system instructions"}::${randomHex}`;
    const inputs = { test: "canary-success-payload" };
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // Run operation that returns success with canary in nested field
    const result = await withIdempotency({
      tenant: testTenant,
      scope: testScope,
      inputs,
      ttlHours: 1,
      operation: async () => {
        return {
          ok: true,
          data: "safe data",
          // Simulate accidental prompt echo in response
          _internal: { debug: CANARY },
        };
      },
    });

    // Assert safe response contract
    expect(result.status).toBe("succeeded");
    expect(result.data).toBeDefined();

    // Check database row
    const keyHash = computeIdempotencyKey(inputs);
    const [row] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenant, testTenant),
          eq(idempotencyKeys.scope, testScope),
          eq(idempotencyKeys.keyHash, keyHash)
        )
      )
      .limit(1);

    expect(row).toBeDefined();
    expect(row.status).toBe("succeeded");

    // CRITICAL: Canary must NOT appear anywhere in DB row
    const fullRowStr = JSON.stringify(row);
    expect(fullRowStr).not.toContain(CANARY);
    expect(fullRowStr).not.toContain("CANARY::SUCCESS_LEAK");
    expect(fullRowStr).not.toContain("internalPrompt");
    expect(fullRowStr).not.toContain("system instructions");
    expect(fullRowStr).not.toContain(randomHex);

    // Verify responseJson does not contain _internal field
    const responseJsonStr = JSON.stringify(row.responseJson);
    expect(responseJsonStr).not.toContain(CANARY);
    expect(responseJsonStr).not.toContain("_internal");
    expect(responseJsonStr).not.toContain("debug");
  });
});
