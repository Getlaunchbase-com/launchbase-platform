/**
 * Express-level Rate Limiter Middleware
 *
 * Sits before tRPC to enforce request-rate ceilings per IP.
 * Uses an in-memory sliding window (same algorithm as server/security/rateLimit.ts)
 * but operates at the HTTP layer so it catches ALL requests, not just tRPC calls.
 *
 * Redis upgrade path: when REDIS_URL is set, swap the in-memory store for
 * an ioredis-backed store. The interface is identical.
 */

import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Sliding-window store (in-memory, per-process)
// ---------------------------------------------------------------------------

interface WindowEntry {
  timestamps: number[];
}

const store = new Map<string, WindowEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 120_000);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
if (cleanupTimer && typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
  cleanupTimer.unref();
}

// ---------------------------------------------------------------------------
// Rate check logic
// ---------------------------------------------------------------------------

function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Trim timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0]!;
    return {
      limited: true,
      remaining: 0,
      resetMs: oldestInWindow + windowMs - now,
    };
  }

  entry.timestamps.push(now);
  return {
    limited: false,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]!.trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

// ---------------------------------------------------------------------------
// Middleware factory
// ---------------------------------------------------------------------------

export interface RateLimiterOptions {
  /** Maximum requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Optional key prefix to separate limit pools (default: "rl") */
  keyPrefix?: string;
  /** Optional custom key extractor (default: client IP) */
  keyExtractor?: (req: Request) => string;
  /** Optional custom message on limit exceeded */
  message?: string;
}

/**
 * Create an Express middleware that enforces rate limiting.
 *
 * Usage:
 *   app.use("/api/artifacts", rateLimiter({ max: 30, windowMs: 60_000 }));
 *   app.use("/trpc", rateLimiter({ max: 100, windowMs: 60_000, keyPrefix: "trpc" }));
 */
export function rateLimiter(opts: RateLimiterOptions) {
  const {
    max,
    windowMs,
    keyPrefix = "rl",
    keyExtractor = getClientIp,
    message = "Too many requests. Please try again later.",
  } = opts;

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = keyExtractor(req);
    const bucketKey = `${keyPrefix}:${clientKey}`;

    const result = isRateLimited(bucketKey, max, windowMs);

    // Always set rate-limit headers
    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(result.remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(result.resetMs / 1000)));

    if (result.limited) {
      res.setHeader("Retry-After", String(Math.ceil(result.resetMs / 1000)));
      res.status(429).json({
        error: {
          code: "TOO_MANY_REQUESTS",
          message,
        },
      });
      return;
    }

    next();
  };
}

/**
 * Pre-configured rate limiters for common use cases.
 */
export const RATE_LIMITERS = {
  /** General API: 100 req/min per IP */
  api: () => rateLimiter({ max: 100, windowMs: 60_000, keyPrefix: "api" }),

  /** Artifact downloads: 30 req/min per IP */
  artifacts: () => rateLimiter({ max: 30, windowMs: 60_000, keyPrefix: "artifacts" }),

  /** Auth endpoints: 10 req/min per IP */
  auth: () => rateLimiter({ max: 10, windowMs: 60_000, keyPrefix: "auth" }),

  /** Polling endpoints (agent runs, events): 60 req/min per IP */
  polling: () => rateLimiter({ max: 60, windowMs: 60_000, keyPrefix: "poll" }),
} as const;
