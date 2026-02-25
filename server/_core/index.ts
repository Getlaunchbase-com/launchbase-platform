/**
 * Server Entry Point
 *
 * Express + tRPC server with:
 *   - Health check endpoints (for load balancers / Docker)
 *   - tRPC API at /api/trpc
 *   - Contract handshake at /api/contracts/handshake
 *   - Static file serving for the Vite-built client
 *   - Graceful shutdown
 */

import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { env } from "./env";
import { createContext } from "./trpc";
import { appRouter } from "../routers/_incoming_routers";
import { closeDb } from "../db";
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
// Express app
// ---------------------------------------------------------------------------

const app = express();

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));

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
  // Future: check DB connectivity, external deps
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
      console.error(
        `[handshake] CONTRACT_MISMATCH for agent ${body.agent_id} (v${body.agent_version}):`,
        JSON.stringify(result.mismatches, null, 2)
      );
      // Log mismatch to DB (best-effort, async)
      logHandshakeMismatch(body.agent_id, body.agent_version ?? "unknown", result);
    } else {
      console.log(
        `[handshake] OK for agent ${body.agent_id} (v${body.agent_version})`
      );
    }

    // 503 CONTRACT_MISMATCH on failure — agent must not dispatch tools
    res.status(result.ok ? 200 : 503).json(result);
  } catch (err) {
    console.error("[handshake] Error:", err);
    res.status(500).json({ ok: false, error: "Internal handshake error" });
  }
});

/** GET endpoint for agents to fetch current contract info */
app.get("/api/contracts/info", (_req, res) => {
  try {
    const info = getAllContractInfo();
    res.json(info);
  } catch (err) {
    console.error("[contracts] Error:", err);
    res.status(500).json({ error: "Failed to load contract info" });
  }
});

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
  console.log(`[server] ====================================`);
  console.log(`[server] LaunchBase Platform`);
  console.log(`[server] Commit:  ${BUILD_INFO.gitSha}`);
  console.log(`[server] Built:   ${BUILD_INFO.buildTime}`);
  console.log(`[server] Env:     ${env.NODE_ENV}`);
  console.log(`[server] Port:    ${PORT}`);
  console.log(`[server] ====================================`);
  console.log(`[server] Health:    http://localhost:${PORT}/healthz`);
  console.log(`[server] API:       http://localhost:${PORT}/api/trpc`);
  console.log(`[server] Build:     http://localhost:${PORT}/api/build-info`);
  console.log(
    `[server] Handshake: http://localhost:${PORT}/api/contracts/handshake`
  );

  // Start agent runtime health monitor (polls agent-stack /health every 60s)
  startHealthMonitor();
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received — shutting down gracefully`);

  // Stop health monitor polling
  stopHealthMonitor();

  server.close(async () => {
    await closeDb();
    console.log("[server] Closed database connections");
    process.exit(0);
  });

  // Force exit after 10s
  setTimeout(() => {
    console.error("[server] Forced exit after 10s timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { app, server };
