/**
 * Express-level Rate Limiter Middleware
 *
 * Sits before tRPC to enforce request-rate ceilings per IP.
 *
 * Backend strategy:
 *   - REDIS_URL set → Redis INCR + EXPIRE (shared across replicas)
 *   - REDIS_URL unset → In-memory sliding window (per-process)
 *
 * The middleware interface is identical regardless of backend.
 */

import type { Request, Response, NextFunction } from "express";

// ---------------------------------------------------------------------------
// Rate-limit result shape (shared by both backends)
// ---------------------------------------------------------------------------

interface RateLimitResult {
  limited: boolean;
  remaining: number;
  resetMs: number;
}

// ---------------------------------------------------------------------------
// Backend interface
// ---------------------------------------------------------------------------

interface RateLimitBackend {
  check(key: string, max: number, windowMs: number): Promise<RateLimitResult>;
}

// ===================================================================
// In-memory backend (single-process, per-instance)
// ===================================================================

interface WindowEntry {
  timestamps: number[];
}

function createInMemoryBackend(): RateLimitBackend {
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

  return {
    async check(key, max, windowMs) {
      const now = Date.now();
      let entry = store.get(key);

      if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
      }

      // Trim timestamps outside the window
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

      if (entry.timestamps.length >= max) {
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
        remaining: max - entry.timestamps.length,
        resetMs: windowMs,
      };
    },
  };
}

// ===================================================================
// Redis backend (shared across replicas via INCR + EXPIRE)
// ===================================================================

function createRedisBackend(redisUrl: string): RateLimitBackend {
  // Dynamic import to avoid hard dependency when Redis is unused
  let redisClient: any = null;
  let connectPromise: Promise<any> | null = null;

  function getClient(): Promise<any> {
    if (redisClient) return Promise.resolve(redisClient);
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
        connectTimeout: 5_000,
      });

      client.on("error", (err: Error) => {
        console.error("[rateLimiter:redis] Connection error:", err.message);
      });

      await client.connect();
      redisClient = client;
      console.log("[rateLimiter] Using Redis backend for rate limiting");
      return client;
    })();

    return connectPromise;
  }

  return {
    async check(key, max, windowMs) {
      const client = await getClient();
      const windowSec = Math.ceil(windowMs / 1000);

      // Atomic: INCR counter, then set TTL if it's a new key
      const count = await client.incr(key);
      if (count === 1) {
        await client.expire(key, windowSec);
      }

      // Fetch TTL for reset header
      const ttl = await client.ttl(key);
      const resetMs = (ttl > 0 ? ttl : windowSec) * 1000;

      if (count > max) {
        return { limited: true, remaining: 0, resetMs };
      }

      return { limited: false, remaining: max - count, resetMs };
    },
  };
}

// ===================================================================
// Active backend selection
// ===================================================================

let _backend: RateLimitBackend | null = null;

function getBackend(): RateLimitBackend {
  if (_backend) return _backend;

  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    _backend = createRedisBackend(redisUrl);
  } else {
    _backend = createInMemoryBackend();
    console.log("[rateLimiter] Using in-memory backend (set REDIS_URL for distributed limiting)");
  }
  return _backend;
}

/**
 * Check if the Redis rate-limit backend is reachable.
 * Returns true if Redis is connected (or if REDIS_URL is not configured).
 * Returns false if Redis is configured but unreachable.
 */
export async function isRedisHealthy(): Promise<boolean> {
  if (!process.env.REDIS_URL) return true; // No Redis = in-memory, always healthy
  try {
    const backend = getBackend() as any;
    // Access internal client to ping
    if (backend && typeof backend === "object") {
      const { default: Redis } = await import("ioredis");
      const client = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3_000,
        lazyConnect: true,
      });
      await client.connect();
      await client.ping();
      await client.quit();
      return true;
    }
    return true;
  } catch {
    return false;
  }
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
 * Automatically uses Redis when REDIS_URL is set, otherwise in-memory.
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

  const backend = getBackend();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = keyExtractor(req);
    const bucketKey = `${keyPrefix}:${clientKey}`;

    backend
      .check(bucketKey, max, windowMs)
      .then((result) => {
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
      })
      .catch(() => {
        // If Redis is down, fail open — allow the request through
        next();
      });
  };
}

/**
 * Per-token (authenticated user) rate limiter.
 * Extracts user ID from JWT in Authorization header for per-user limiting.
 * Falls back to IP-based limiting for unauthenticated requests.
 */
export function perTokenKeyExtractor(req: Request): string {
  // Try to extract user ID from JWT bearer token
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    try {
      // Decode JWT payload (middle segment) to extract user ID
      const payload = auth.split(".")[1];
      if (payload) {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (decoded.sub || decoded.userId || decoded.id) {
          return `user:${decoded.sub ?? decoded.userId ?? decoded.id}`;
        }
      }
    } catch {
      // Fall through to IP-based
    }
  }
  return `ip:${getClientIp(req)}`;
}

/**
 * Pre-configured rate limiters for common use cases.
 *
 * Tiers:
 *   api        — 100 req/min per IP (global baseline)
 *   artifacts  — 30 req/min per IP (file downloads)
 *   auth       — 10 req/min per IP (brute-force prevention)
 *   polling    — 60 req/min per IP (agent run status)
 *   upload     — 10 req/min per IP (file uploads — large payloads)
 *   pipeline   — 5 req/min per user (blueprint parse/detect — expensive)
 *   swarm      — 5 req/min per user (swarm dispatch — expensive)
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

  /** File uploads: 10 req/min per IP (large payload protection) */
  upload: () => rateLimiter({ max: 10, windowMs: 60_000, keyPrefix: "upload" }),

  /** Pipeline operations: 5 req/min per user (blueprint parse + detect) */
  pipeline: () =>
    rateLimiter({
      max: 5,
      windowMs: 60_000,
      keyPrefix: "pipeline",
      keyExtractor: perTokenKeyExtractor,
    }),

  /** Swarm dispatch: 5 req/min per user (agent orchestration) */
  swarm: () =>
    rateLimiter({
      max: 5,
      windowMs: 60_000,
      keyPrefix: "swarm",
      keyExtractor: perTokenKeyExtractor,
    }),
} as const;
