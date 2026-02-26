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
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import path from "node:path";
import { sql } from "drizzle-orm";
import { env } from "./env";
import { createContext } from "./trpc";
import { appRouter } from "../routers/_incoming_routers";
import { closeDb, getDb } from "../db";
import {
  validateHandshake,
  getAllContractInfo,
  type HandshakeRequest,
} from "../contracts/handshake";
import {
  startHealthMonitor,
  stopHealthMonitor,
} from "../services/agentHealthMonitor";
import {
  verifyAgentContracts,
  getAgentContractVerificationStatus,
} from "../startup/verifyAgentContracts";

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

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.header("Access-Control-Allow-Origin", String(origin));
  res.header("Vary", "Origin");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With"
  );
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use(express.json({ limit: "50mb" }));

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
  const checks: Record<string, string> = {
    database: "unknown",
    redis: "skipped",
    agentContracts: "unknown",
  };

  let ready = true;

  try {
    const db = await getDb();
    if (!db) {
      checks.database = "unavailable";
      ready = false;
    } else {
      await db.execute(sql`SELECT 1`);
      checks.database = "ok";
    }
  } catch (err) {
    checks.database = `error:${err instanceof Error ? err.message : String(err)}`;
    ready = false;
  }

  if (process.env.REDIS_URL) {
    try {
      const mod = await import("ioredis");
      const RedisCtor = (mod as any).default ?? (mod as any).Redis;
      const redis = new RedisCtor(process.env.REDIS_URL, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      if (typeof redis.connect === "function") {
        await redis.connect();
      }
      await redis.ping();
      await redis.quit();
      checks.redis = "ok";
    } catch (err) {
      checks.redis = `error:${err instanceof Error ? err.message : String(err)}`;
      ready = false;
    }
  }

  const contractStatus = getAgentContractVerificationStatus();
  if (contractStatus.ok) {
    checks.agentContracts = "ok";
  } else {
    checks.agentContracts = contractStatus.errors.join(";") || "failed";
    ready = false;
  }

  res.status(ready ? 200 : 503).json({
    status: ready ? "ready" : "not_ready",
    checks,
    checkedAt: new Date().toISOString(),
  });
});

app.get("/api/build-info", (_req, res) => {
  res.json(BUILD_INFO);
});

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
        `[handshake] FAILED for agent ${body.agent_id} (v${body.agent_version}):`,
        JSON.stringify(result.mismatches, null, 2)
      );
    } else {
      console.log(
        `[handshake] OK for agent ${body.agent_id} (v${body.agent_version})`
      );
    }

    res.status(result.ok ? 200 : 409).json(result);
  } catch (err) {
    console.error("[handshake] Error:", err);
    res.status(500).json({ ok: false, error: "Internal handshake error" });
  }
});

app.get("/api/contracts/info", (_req, res) => {
  try {
    const info = getAllContractInfo();
    res.json(info);
  } catch (err) {
    console.error("[contracts] Error:", err);
    res.status(500).json({ error: "Failed to load contract info" });
  }
});

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => createContext({ req, res }),
  })
);

const clientDist = path.resolve(process.cwd(), "dist", "public");
app.use(express.static(clientDist));

app.get("*", (_req, res) => {
  const indexPath = path.join(clientDist, "index.html");
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(404).send("Not found");
    }
  });
});

const PORT = env.PORT;
let server: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  try {
    await verifyAgentContracts();
  } catch (err) {
    if (env.NODE_ENV === "development") {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[startup] Development mode: continuing despite contract verification failure: ${msg}`);
    } else {
      throw err;
    }
  }

  server = app.listen(PORT, () => {
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

    startHealthMonitor();
  });
}

startServer().catch((err) => {
  console.error("[server] Startup failed:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received - shutting down gracefully`);

  stopHealthMonitor();

  if (!server) {
    process.exit(0);
    return;
  }

  server.close(async () => {
    await closeDb();
    console.log("[server] Closed database connections");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[server] Forced exit after 10s timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

export { app, server };
