/**
 * Server Entry Point
 *
 * Express + tRPC server with:
 *   - Security headers (helmet), CORS, CSRF via Origin check
 *   - Response compression (gzip/brotli)
 *   - Structured logging (pino)
 *   - Express-level rate limiting on all routes
 *   - Health check endpoints (for load balancers / Docker)
 *   - tRPC API at /api/trpc
 *   - Artifact downloads at /api/artifacts
 *   - Contract handshake at /api/contracts/handshake
 *   - Static file serving for the Vite-built client
 *   - Global error handling + graceful shutdown
 */

import express from "express";
import type { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import pinoHttp from "pino-http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { env, logBootConfig } from "./env";
import log from "./logger";
import { createContext } from "./trpc";
import { appRouter } from "../routers/_incoming_routers";
import { getDb, closeDb } from "../db";
import { createArtifactsRouter } from "../routes/artifactsRouter";
import { rateLimiter, RATE_LIMITERS } from "../middleware/rateLimiter";
import {
  validateHandshake,
  getAllContractInfo,
  logHandshakeMismatch,
  type HandshakeRequest,
} from "../contracts/handshake";
import {
  startHealthMonitor,
  stopHealthMonitor,
} from "../services/agentHealthMonitor";

// ---------------------------------------------------------------------------
// Unhandled rejection / exception handlers (must be first)
// ---------------------------------------------------------------------------

process.on("unhandledRejection", (reason) => {
  log.error({ err: reason }, "Unhandled promise rejection");
});

process.on("uncaughtException", (err) => {
  log.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Build info (deploy drift detection)
// ---------------------------------------------------------------------------

const BUILD_INFO = {
  gitSha:
    process.env.GIT_SHA ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.RENDER_GIT_COMMIT ??
    process.env.RAILWAY_GIT_COMMIT_SHA ??
    "unknown",
  buildTime: process.env.BUILD_TIME ?? new Date().toISOString(),
  nodeEnv: env.NODE_ENV,
};

// ---------------------------------------------------------------------------
// CORS — restrict to known origins in production
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = env.isProduction
  ? [env.PUBLIC_BASE_URL].filter(Boolean)
  : true; // dev: allow all

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// Trust first proxy (needed for correct req.ip behind reverse proxy)
app.set("trust proxy", 1);

// Security headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(
  helmet({
    contentSecurityPolicy: env.isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", env.PUBLIC_BASE_URL, env.AGENT_STACK_URL].filter(Boolean),
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
          },
        }
      : false, // disable CSP in dev (Vite HMR needs inline scripts)
    crossOriginEmbedderPolicy: false, // allow loading external images
  })
);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(compression());
app.use(express.json({ limit: "50mb" }));

// Global rate limiter — 100 req/min per IP on all routes
app.use(RATE_LIMITERS.api());

// Structured request logging (skip health checks to reduce noise)
app.use(
  pinoHttp({
    logger: log,
    autoLogging: {
      ignore: (req) => {
        const url = req.url || "";
        return url === "/healthz" || url === "/readyz";
      },
    },
  })
);

// ---------------------------------------------------------------------------
// CSRF protection — validate Origin header on state-changing requests
// ---------------------------------------------------------------------------

if (env.isProduction) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      return next();
    }

    const origin = req.headers.origin;
    if (!origin) {
      // Allow server-to-server calls (no Origin header)
      return next();
    }

    // Validate origin matches allowed origins
    const allowed = Array.isArray(ALLOWED_ORIGINS)
      ? ALLOWED_ORIGINS.some((o) => origin === o)
      : true;

    if (!allowed) {
      log.warn({ origin, path: req.path }, "CSRF origin rejected");
      res.status(403).json({ error: "Forbidden — origin not allowed" });
      return;
    }

    next();
  });
}

// ---------------------------------------------------------------------------
// Health checks (no auth, no tRPC — for infra probes)
// ---------------------------------------------------------------------------

app.get("/healthz", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    gitSha: BUILD_INFO.gitSha,
    buildTime: BUILD_INFO.buildTime,
  });
});

app.get("/readyz", async (_req, res) => {
  try {
    const db = await getDb();
    if (!db) {
      res.status(503).json({ status: "not_ready", reason: "database_unavailable" });
      return;
    }
    // Verify DB connectivity with a lightweight query
    const { sql } = await import("drizzle-orm");
    await db.execute(sql`SELECT 1`);
    res.json({ status: "ready" });
  } catch (err) {
    log.error(err, "Readiness check failed");
    res.status(503).json({ status: "not_ready", reason: "database_error" });
  }
});

/** Build info endpoint — shows deployed commit SHA + build time */
app.get("/api/build-info", (_req, res) => {
  res.json(BUILD_INFO);
});

// ---------------------------------------------------------------------------
// Contract Handshake Endpoint (for agent startup validation)
// ---------------------------------------------------------------------------

// Stricter rate limit on handshake (10 req/min per IP)
app.post(
  "/api/contracts/handshake",
  rateLimiter({ max: 10, windowMs: 60_000, keyPrefix: "handshake" }),
  (req: Request, res: Response) => {
    try {
      const body = req.body as HandshakeRequest;

      if (!body.agent_id || !Array.isArray(body.contracts)) {
        res.status(400).json({
          ok: false,
          error: "Invalid handshake request. Required: agent_id, contracts[]",
        });
        return;
      }

      const result = validateHandshake(body);

      if (!result.ok) {
        log.error(
          { agentId: body.agent_id, version: body.agent_version, mismatches: result.mismatches },
          "Contract mismatch"
        );
        logHandshakeMismatch(body.agent_id, body.agent_version ?? "unknown", result);
      } else {
        log.info(
          { agentId: body.agent_id, version: body.agent_version },
          "Handshake OK"
        );
      }

      res.status(result.ok ? 200 : 503).json(result);
    } catch (err) {
      log.error(err, "Handshake error");
      res.status(500).json({ ok: false, error: "Internal handshake error" });
    }
  }
);

/** GET endpoint for agents to fetch current contract info */
app.get("/api/contracts/info", (_req, res) => {
  try {
    const info = getAllContractInfo();
    res.json(info);
  } catch (err) {
    log.error(err, "Failed to load contract info");
    res.status(500).json({ error: "Failed to load contract info" });
  }
});

// ---------------------------------------------------------------------------
// Artifacts download router (Express, not tRPC — serves binary files)
// ---------------------------------------------------------------------------

const artifactsRouter = createArtifactsRouter({
  getDb: () => getDb() as Promise<any>,
  getUserFromReq: async (req) => {
    try {
      const ctx = await createContext({ req, res: null as any });
      if (ctx.user) return { id: ctx.user.id, role: ctx.user.role };
    } catch {
      // auth failed
    }
    return null;
  },
});
app.use("/api/artifacts", RATE_LIMITERS.artifacts(), artifactsRouter);

// ---------------------------------------------------------------------------
// tRPC API
// ---------------------------------------------------------------------------

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => createContext({ req, res }),
  })
);

// ---------------------------------------------------------------------------
// Static files (Vite client build) — with cache headers for hashed assets
// ---------------------------------------------------------------------------

const clientDist = path.resolve(process.cwd(), "dist", "public");

// Vite-built assets have content hashes in filenames — cache aggressively
app.use(
  "/assets",
  express.static(path.join(clientDist, "assets"), {
    maxAge: "1y",
    immutable: true,
  })
);

// Other static files (index.html, favicons) — short cache
app.use(express.static(clientDist, { maxAge: "10m" }));

// SPA fallback — serve index.html for all non-API routes
app.get("*", (_req, res) => {
  const indexPath = path.join(clientDist, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send("Not found");
    }
  });
});

// ---------------------------------------------------------------------------
// Global error handler (must be last middleware)
// ---------------------------------------------------------------------------

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  log.error({ err, stack: err.stack }, "Unhandled Express error");

  // Never leak stack traces in production
  const message = env.isProduction
    ? "Internal server error"
    : err.message;

  res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message } });
});

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

const PORT = env.PORT;

const server = app.listen(PORT, () => {
  log.info(
    {
      port: PORT,
      env: env.NODE_ENV,
      gitSha: BUILD_INFO.gitSha,
      buildTime: BUILD_INFO.buildTime,
    },
    "LaunchBase Platform started"
  );

  // Log sanitized config at boot for operational visibility
  logBootConfig();

  startHealthMonitor();
});

// ---------------------------------------------------------------------------
// Graceful shutdown — drain in-flight requests before closing
// ---------------------------------------------------------------------------

let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info({ signal }, "Shutting down gracefully");

  stopHealthMonitor();

  // Stop accepting new connections and wait for in-flight to finish
  server.close(async () => {
    try {
      await closeDb();
      log.info("Database connections closed");
    } catch (err) {
      log.error(err, "Error closing database");
    }
    process.exit(0);
  });

  // Force exit after 30s (enough time for long requests to drain)
  setTimeout(() => {
    log.fatal("Forced exit after 30s timeout");
    process.exit(1);
  }, 30_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
