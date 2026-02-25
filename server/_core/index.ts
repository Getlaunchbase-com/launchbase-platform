/**
 * Server Entry Point
 *
 * Express + tRPC server with:
 *   - Security headers (helmet) + CORS
 *   - Structured logging (pino)
 *   - Health check endpoints (for load balancers / Docker)
 *   - tRPC API at /api/trpc
 *   - Artifact downloads at /api/artifacts
 *   - Contract handshake at /api/contracts/handshake
 *   - Static file serving for the Vite-built client
 *   - Graceful shutdown
 */

import express from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { env } from "./env";
import log from "./logger";
import { createContext } from "./trpc";
import { appRouter } from "../routers/_incoming_routers";
import { getDb, closeDb } from "../db";
import { createArtifactsRouter } from "../routes/artifactsRouter";
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
app.use(express.json({ limit: "50mb" }));

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

app.get("/readyz", (_req, res) => {
  res.json({ status: "ready" });
});

/** Build info endpoint — shows deployed commit SHA + build time */
app.get("/api/build-info", (_req, res) => {
  res.json(BUILD_INFO);
});

// ---------------------------------------------------------------------------
// Contract Handshake Endpoint (for agent startup validation)
// ---------------------------------------------------------------------------

app.post("/api/contracts/handshake", (req, res) => {
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
});

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
    // Extract user from JWT or session cookie
    // The auth check is the same one tRPC uses — reuse createContext
    try {
      const ctx = await createContext({ req, res: null as any });
      if (ctx.user) return { id: ctx.user.id, role: ctx.user.role };
    } catch {
      // auth failed
    }
    return null;
  },
});
app.use("/api/artifacts", artifactsRouter);

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
// Static files (Vite client build)
// ---------------------------------------------------------------------------

const clientDist = path.resolve(process.cwd(), "dist", "public");
app.use(express.static(clientDist));

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
  log.info({ url: `http://localhost:${PORT}/healthz` }, "Health endpoint");
  log.info({ url: `http://localhost:${PORT}/api/trpc` }, "tRPC endpoint");
  log.info({ url: `http://localhost:${PORT}/api/artifacts` }, "Artifacts endpoint");
  log.info({ url: `http://localhost:${PORT}/api/contracts/handshake` }, "Handshake endpoint");

  startHealthMonitor();
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  log.info({ signal }, "Shutting down gracefully");

  stopHealthMonitor();

  server.close(async () => {
    await closeDb();
    log.info("Database connections closed");
    process.exit(0);
  });

  setTimeout(() => {
    log.fatal("Forced exit after 10s timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
