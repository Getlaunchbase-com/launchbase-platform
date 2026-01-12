/**
 * Idempotency utilities for preventing duplicate expensive operations
 * 
 * Pattern: Stripe-style idempotency with TTL + stale takeover
 * Purpose: Prevent double-spend on retries (double clicks, refreshes, network timeouts)
 * 
 * Race condition handling: claim → run → commit
 * - Atomic INSERT with status="started" claims the job
 * - Duplicate key error → read existing row and decide (cached/in_progress/retry)
 * - Stale takeover: if started > X minutes ago, allow retry
 * 
 * Security: HMAC-SHA256 prevents key guessing (never store raw userText)
 * Ownership: Track claimStartedAt and guard commits to prevent lost updates
 */

import { createHash, createHmac, randomBytes } from "crypto";
import { eq, and, lt } from "drizzle-orm";
import { getDb } from "../db";
import { idempotencyKeys } from "../../drizzle/schema";

/**
 * Generate a random nonce for ownership guard
 * 
 * CRITICAL: Nonce-based ownership guard is precision-proof.
 * Timestamp equality fails due to MySQL/TiDB rounding milliseconds.
 */
function generateClaimNonce(): string {
  return randomBytes(20).toString("hex"); // 40 hex chars
}

export type IdempotencyConfig<T> = {
  tenant: string;
  scope: string;
  inputs: Record<string, unknown>;
  ttlHours: number;
  staleTakeoverMinutes?: number; // Default: 5 minutes
  operation: () => Promise<T>;
};

export type IdempotencyResult<T> =
  | { status: "succeeded"; data: T; cached: boolean }
  | { status: "in_progress"; message: string }
  | { status: "failed"; error: string };

/**
 * Hash user text to prevent storing raw prompts in idempotency keys
 * 
 * Security: Never include raw user text in canonical strings or database.
 * This prevents prompt leakage in logs, forensics, and key derivation.
 */
export function hashUserText(text: string): string {
  // Normalize: trim + collapse whitespace for stability
  const normalized = text.trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized).digest("hex");
}

/**
 * Compute idempotency key from inputs using HMAC-SHA256
 * 
 * Security: HMAC prevents key guessing attacks. Even if attacker knows inputs,
 * they can't compute the key without IDEMPOTENCY_SECRET.
 * 
 * IMPORTANT: Never include raw user text. Use hashUserText() first.
 */
export function computeIdempotencyKey(inputs: Record<string, unknown>): string {
  const secret = process.env.IDEMPOTENCY_SECRET;
  
  // SECURITY: Require secret in production (no fallback)
  if (process.env.NODE_ENV === "production" && !secret) {
    throw new Error(
      "IDEMPOTENCY_SECRET is required in production. Set it in environment variables."
    );
  }
  
  // SECURITY: Require secret in tests (explicit vitest.setup.ts value)
  if (process.env.VITEST === "true" && !secret) {
    throw new Error(
      "IDEMPOTENCY_SECRET must be set in vitest.setup.ts. No fallback allowed."
    );
  }
  
  // Only allow fallback in local development
  const effectiveSecret = secret || "default-secret-dev-only";
  
  // Canonicalize inputs (sorted keys, stable JSON)
  const sortedKeys = Object.keys(inputs).sort();
  const canonical = sortedKeys.map((key) => {
    const value = inputs[key];
    // Handle undefined/null as empty string for stability
    return `${key}=${JSON.stringify(value ?? "")}`;
  }).join("|");
  
  // HMAC-SHA256 (64 hex chars)
  return createHmac("sha256", effectiveSecret).update(canonical).digest("hex");
}

/**
 * Extract affected rows count from Drizzle MySQL update result
 * 
 * Supports multiple return shapes:
 * - { rowsAffected: number } (some Drizzle adapters)
 * - { affectedRows: number } (MySQL2 ResultSetHeader)
 * - [{ affectedRows: number }, null] (Drizzle array-wrapped)
 * 
 * CRITICAL: Returns actual affectedRows value (can be 0).
 * No fallbacks - we need the real value for ownership guard checks.
 * 
 * Internal API (prefixed with _) - not part of stable public API.
 */
export function _getRowsAffected(res: unknown): number {
  if (!res) return 0; // No result = no rows affected

  // Array wrapper: [{ affectedRows: 1 }, null]
  if (Array.isArray(res) && res[0]) {
    return _getRowsAffected(res[0]);
  }

  // { rowsAffected } (some Drizzle adapters)
  if (typeof res === "object" && "rowsAffected" in (res as any)) {
    return Number((res as any).rowsAffected) || 0;
  }

  // { affectedRows } (MySQL2 ResultSetHeader)
  if (typeof res === "object" && "affectedRows" in (res as any)) {
    return Number((res as any).affectedRows) || 0;
  }

  return 0; // Unknown shape = no rows affected
}

/**
 * Sanitize response before storing in database
 * 
 * SECURITY: Remove dangerous fields that could contain prompts, errors, or internal data
 * Allowlist approach: only keep known-safe fields
 */
function sanitizeResponse(response: unknown): Record<string, unknown> {
  if (!response || typeof response !== "object") {
    return { data: response };
  }

  const obj = response as Record<string, unknown>;
  const safe: Record<string, unknown> = {};

  // Allowlist: only these top-level fields are safe to persist
  const allowedFields = [
    "ok",
    "stopReason",
    "createdActionRequestIds",
    "traceId",
    "needsHuman",
    "cached",
    "data", // Generic data field (if it's a primitive)
  ];

  for (const key of allowedFields) {
    if (key in obj) {
      const value = obj[key];
      // Only store primitives and arrays of primitives (no nested objects)
      if (
        value === null ||
        value === undefined ||
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        (Array.isArray(value) && value.every((v) => typeof v !== "object"))
      ) {
        safe[key] = value;
      }
    }
  }

  // NEVER store: _internal, debug, prompt, error.message, stack, provider, model
  return safe;
}

/**
 * Execute operation with idempotency protection
 * 
 * Flow (claim → run → commit):
 * 1. Compute HMAC-SHA256 keyHash from inputs
 * 2. Try INSERT with status="started" (atomic claim)
 * 3. If duplicate key error → read existing row:
 *    - succeeded → return cached response
 *    - started (fresh) → return "in_progress" (409)
 *    - started (stale) → takeover and retry
 *    - failed → allow retry
 * 4. Run operation (only if we own the claim)
 * 5. Commit: update status="succeeded" + store response (with ownership guard)
 * 
 * Race condition safety:
 * - UNIQUE(tenant, scope, keyHash) prevents duplicate inserts
 * - Only one caller gets INSERT success → only one runs AI
 * - Others get duplicate key error → return cached or in_progress
 * - Ownership guard: track claimStartedAt and only commit if startedAt matches
 */
export async function withIdempotency<T>(
  config: IdempotencyConfig<T>,
  _depth = 0 // Prevent infinite recursion
): Promise<IdempotencyResult<T>> {
  const db = await getDb();
  if (!db) {
    return { status: "failed", error: "Database not available" };
  }

  const { tenant, scope, inputs, ttlHours, staleTakeoverMinutes = 5, operation } = config;
  const keyHash = computeIdempotencyKey(inputs);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);
  const staleCutoff = new Date(now.getTime() - staleTakeoverMinutes * 60 * 1000);

  // Track ownership: when we claim, we generate a nonce
  let myClaimNonce: string | null = null;
  let claimed = false;
  let rowId: number | null = null;

  // Step 1: Try to claim the job (atomic INSERT)
  try {
    myClaimNonce = generateClaimNonce();
    await db.insert(idempotencyKeys).values({
      tenant,
      scope,
      keyHash,
      claimNonce: myClaimNonce,
      status: "started",
      startedAt: now,
      expiresAt,
      attemptCount: 1,
    });
    claimed = true;
  } catch (error) {
    // Duplicate key error → job already exists
    claimed = false;
  }

  // Step 2: If we didn't claim it, check existing row
  if (!claimed) {
    const [existing] = await db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenant, tenant),
          eq(idempotencyKeys.scope, scope),
          eq(idempotencyKeys.keyHash, keyHash)
        )
      )
      .limit(1);

    if (!existing) {
      // Race condition: row was deleted between INSERT and SELECT
      // Retry once (max depth 1)
      if (_depth < 1) {
        return withIdempotency(config, _depth + 1);
      }
      return {
        status: "failed",
        error: "Idempotency key disappeared during claim attempt",
      };
    }

    // Store rowId for commit ownership guard
    rowId = existing.id;

    // Handle existing row by status
    if (existing.status === "succeeded" && existing.responseJson) {
      // Fast path: return cached response
      return {
        status: "succeeded",
        data: existing.responseJson as T,
        cached: true,
      };
    }

    if (existing.status === "started") {
      // Check if stale (started > X minutes ago)
      const isStale = existing.startedAt && existing.startedAt < staleCutoff;

      if (isStale) {
        // Stale takeover: generate new nonce and reclaim
        const nonce = generateClaimNonce();
        const upd = await db
          .update(idempotencyKeys)
          .set({
            claimNonce: nonce,
            status: "started",
            startedAt: now,
            attemptCount: (existing.attemptCount ?? 1) + 1,
          })
          .where(
            and(
              eq(idempotencyKeys.id, existing.id),
              eq(idempotencyKeys.status, "started"),
              lt(idempotencyKeys.startedAt, staleCutoff)
            )
          );

        // CORRECTNESS: Only claim if UPDATE actually updated 1 row
        if (_getRowsAffected(upd) === 1) {
          claimed = true;
          myClaimNonce = nonce;
        } else {
          claimed = false;
          myClaimNonce = null; // Explicitly clear loser nonce
        }
      } else {
        // Fresh "started" → operation in progress
        return {
          status: "in_progress",
          message: "Operation already in progress. Please retry in a few seconds.",
        };
      }
    }

    if (existing.status === "failed") {
      // Allow retry: generate new nonce and reclaim
      const nonce = generateClaimNonce();
      const upd = await db
        .update(idempotencyKeys)
        .set({
          claimNonce: nonce,
          status: "started",
          startedAt: now,
          attemptCount: (existing.attemptCount ?? 1) + 1,
          responseJson: null, // Clear old error
        })
        .where(
          and(
            eq(idempotencyKeys.id, existing.id),
            eq(idempotencyKeys.status, "failed")
          )
        );

      // CORRECTNESS: Only claim if UPDATE actually updated 1 row
      if (_getRowsAffected(upd) === 1) {
        claimed = true;
        myClaimNonce = nonce;
      } else {
        claimed = false;
        myClaimNonce = null; // Explicitly clear loser nonce
      }
    }
  }

  // Step 3: If we still don't own the claim, return in_progress
  if (!claimed || !myClaimNonce) {
    return {
      status: "in_progress",
      message: "Operation already in progress. Please retry in a few seconds.",
    };
  }

  // Step 4: Run operation (we own the claim)
  try {
    const result = await operation();

    // Step 5: Commit success (with nonce-based ownership guard)
    // SECURITY: Sanitize response before storing (remove _internal, debug, prompts)
    const commitUpd = await db
      .update(idempotencyKeys)
      .set({
        status: "succeeded",
        responseJson: sanitizeResponse(result),
        completedAt: new Date(),
      })
      .where(
        and(
          rowId ? eq(idempotencyKeys.id, rowId) : eq(idempotencyKeys.keyHash, keyHash),
          eq(idempotencyKeys.claimNonce, myClaimNonce) // OWNERSHIP GUARD (precision-proof)
        )
      );

    // If we lost ownership (another caller took over), return in_progress
    if (_getRowsAffected(commitUpd) !== 1) {
      return {
        status: "in_progress",
        message: "Lost ownership during commit. Another caller may have taken over.",
      };
    }

    return {
      status: "succeeded",
      data: result,
      cached: false,
    };
  } catch (error) {
    // Step 5: Commit failure (store ONLY safe metadata, never stack traces/prompts)
    // SECURITY: Do not store error.message (can contain prompt echoes)
    await db
      .update(idempotencyKeys)
      .set({
        status: "failed",
        responseJson: {
          ok: false,
          stopReason: "provider_failed",
          // Never store: error.message, stack traces, prompts, provider errors
        },
        completedAt: new Date(),
      })
      .where(
        and(
          rowId ? eq(idempotencyKeys.id, rowId) : eq(idempotencyKeys.keyHash, keyHash),
          eq(idempotencyKeys.claimNonce, myClaimNonce) // OWNERSHIP GUARD (precision-proof)
        )
      );

    return {
      status: "failed",
      error: "Operation failed",
    };
  }
}

/**
 * Cleanup expired idempotency keys (run via cron)
 * 
 * Example cron: Run daily at 3 AM
 * ```ts
 * await cleanupExpiredKeys();
 * ```
 */
export async function cleanupExpiredKeys(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, new Date()));

  // MySQL doesn't return rowsAffected reliably
  return 0;
}
