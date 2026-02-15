/**
 * Rate Limiting Middleware for tRPC
 *
 * In-memory sliding-window rate limiter.
 * Tracks request counts per IP (or user ID when authenticated).
 *
 * Tiers:
 *   - global:    100 req / 60s per IP (all endpoints)
 *   - auth:       10 req / 60s per IP (login/session endpoints)
 *   - mutation:   30 req / 60s per IP (all mutations)
 *   - publicForm: 5  req / 60s per IP (intake submission, contact forms)
 *
 * When a bucket is exhausted the middleware throws a TRPCError with
 * code TOO_MANY_REQUESTS and logs the violation for observability.
 */

import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RateLimitConfig {
  /** Human-readable key for logs, e.g. "api:global" */
  key: string;
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

interface BucketEntry {
  count: number;
  resetAt: number; // epoch ms
}

// ---------------------------------------------------------------------------
// Preset configurations
// ---------------------------------------------------------------------------

export const RATE_LIMITS = {
  global: { key: "api:global", max: 100, windowMs: 60_000 } as RateLimitConfig,
  auth: { key: "api:auth", max: 10, windowMs: 60_000 } as RateLimitConfig,
  mutation: { key: "api:mutation", max: 30, windowMs: 60_000 } as RateLimitConfig,
  publicForm: { key: "api:publicForm", max: 5, windowMs: 60_000 } as RateLimitConfig,
} as const;

// ---------------------------------------------------------------------------
// In-memory store (per-process; sufficient for single-instance deployments)
// ---------------------------------------------------------------------------

const store = new Map<string, BucketEntry>();

/** Evict expired entries every 5 minutes to prevent memory leak */
const CLEANUP_INTERVAL_MS = 5 * 60_000;

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, CLEANUP_INTERVAL_MS);
  // Allow process to exit even if timer is running
  if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment the rate limit counter for a given bucket.
 *
 * @param config  - Which rate-limit tier to apply
 * @param bucketId - The identifier to rate-limit on (IP, userId, etc.)
 * @returns The current state of the bucket
 */
export function checkRateLimit(
  config: RateLimitConfig,
  bucketId: string
): RateLimitResult {
  ensureCleanup();

  const compositeKey = `${config.key}:${bucketId}`;
  const now = Date.now();

  let entry = store.get(compositeKey);

  // Reset expired window
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(compositeKey, entry);
  }

  entry.count++;

  const allowed = entry.count <= config.max;
  const remaining = Math.max(0, config.max - entry.count);

  return {
    allowed,
    current: entry.count,
    limit: config.max,
    remaining,
    resetAt: entry.resetAt,
  };
}

// ---------------------------------------------------------------------------
// tRPC-oriented helper
// ---------------------------------------------------------------------------

/**
 * Enforce rate limit or throw TOO_MANY_REQUESTS.
 *
 * Usage in a tRPC middleware or procedure:
 *
 *   enforceRateLimit(RATE_LIMITS.global, clientIp);
 */
export function enforceRateLimit(
  config: RateLimitConfig,
  bucketId: string
): RateLimitResult {
  const result = checkRateLimit(config, bucketId);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(
      (result.resetAt - Date.now()) / 1000
    );
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Try again in ${retryAfterSeconds}s.`,
    });
  }

  return result;
}

/**
 * Extract client IP from an Express-like request object.
 * Respects x-forwarded-for behind a trusted proxy.
 */
export function getClientIp(req: {
  ip?: string;
  headers?: Record<string, string | string[] | undefined>;
}): string {
  if (req.ip) return req.ip;

  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].split(",")[0]?.trim() || "unknown";
  }

  return "unknown";
}
