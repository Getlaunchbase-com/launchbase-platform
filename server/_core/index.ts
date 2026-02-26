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
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { createContext } from "./trpc";
import { appRouter } from "../routers/_incoming_routers";
import { closeDb, getDb } from "../db";
import {
  users,
  mobileUserCredentials,
  projects,
  projectCollaborators,
  vertexProfiles,
  agentInstances,
} from "../db/schema";
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

function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    String(raw ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

function secureStringEquals(a: string, b: string): boolean {
  const ah = createHash("sha256").update(a).digest();
  const bh = createHash("sha256").update(b).digest();
  return timingSafeEqual(ah, bh);
}

function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  const [salt, digest] = String(stored).split(":");
  if (!salt || !digest) return false;
  const candidate = scryptSync(plain, salt, 64).toString("hex");
  return secureStringEquals(candidate, digest);
}

let mobileAuthBootstrapPromise: Promise<void> | null = null;

async function ensureMobileAuthBootstrap() {
  if (mobileAuthBootstrapPromise) return mobileAuthBootstrapPromise;

  mobileAuthBootstrapPromise = (async () => {
    const db = await getDb();
    if (!db) throw new Error("Database unavailable for auth bootstrap.");

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS mobile_user_credentials (
        id INT AUTO_INCREMENT PRIMARY KEY,
        userId INT NOT NULL,
        passwordHash VARCHAR(255) NOT NULL,
        createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY muc_user_unique_idx (userId)
      )
    `);

    const seeds = [
      { email: "jjs@titan-elec.com", password: "JamesStege420", role: "admin" as const, name: "James Stege" },
      { email: "vmorre@live.com", password: "Vmorre420", role: "admin" as const, name: "Monica Morreale" },
    ];

    for (const seed of seeds) {
      const email = seed.email.toLowerCase();
      const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      let userId = existingUser?.id;

      if (!existingUser) {
        const openId = `mobile:${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
        const [created] = await db.insert(users).values({
          openId,
          email,
          name: seed.name,
          role: seed.role,
          loginMethod: "mobile_password",
        });
        userId = Number(created.insertId);
      }

      if (!userId) continue;
      const [existingCredential] = await db
        .select()
        .from(mobileUserCredentials)
        .where(eq(mobileUserCredentials.userId, Number(userId)))
        .limit(1);

      if (!existingCredential) {
        await db.insert(mobileUserCredentials).values({
          userId: Number(userId),
          passwordHash: hashPassword(seed.password),
        });
      }
    }
  })();

  return mobileAuthBootstrapPromise;
}

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

app.post("/auth/login", async (req, res) => {
  try {
    const email = String(req.body?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      res.status(400).json({
        ok: false,
        error_code: "INVALID_INPUT",
        message: "Email and password are required.",
      });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({
        ok: false,
        error_code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable.",
      });
      return;
    }

    await ensureMobileAuthBootstrap();

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!existing) {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });
      return;
    }

    const [credential] = await db
      .select()
      .from(mobileUserCredentials)
      .where(eq(mobileUserCredentials.userId, Number(existing.id)))
      .limit(1);

    if (!credential || !verifyPassword(password, credential.passwordHash)) {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });
      return;
    }

    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
    const forcedAdminEmails = new Set(["jjs@titan-elec.com", "vmorre@live.com"]);
    const shouldBeAdmin =
      adminEmails.size === 0 || adminEmails.has(email) || forcedAdminEmails.has(email);
    const userId = Number(existing.id);
    const userRole = shouldBeAdmin ? "admin" : existing.role ?? "user";

    if (existing.role !== userRole) {
      await db.update(users).set({ role: userRole }).where(eq(users.id, userId));
    }

    // Guarantee at least one ACTIVE project visible in Jobs for mobile users.
    const activeOwnedProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.ownerId, Number(userId)), eq(projects.status, "active")))
      .limit(1);

    const activeCollabProjects = await db
      .select({ projectId: projectCollaborators.projectId })
      .from(projectCollaborators)
      .leftJoin(projects, eq(projectCollaborators.projectId, projects.id))
      .where(
        and(
          eq(projectCollaborators.userId, Number(userId)),
          eq(projects.status, "active")
        )
      )
      .limit(1);

    if (activeOwnedProjects.length === 0 && activeCollabProjects.length === 0) {
      const slugBase = `ibew-134-${Number(userId)}`;
      const [newProject] = await db.insert(projects).values({
        name: "IBEW 134 Beta Project",
        slug: slugBase,
        description: "Auto-provisioned beta project for mobile onboarding.",
        ownerId: Number(userId),
        tenant: "launchbase",
        status: "active",
      });

      const newProjectId = Number(newProject.insertId);

      await db.insert(projectCollaborators).values({
        projectId: newProjectId,
        userId: Number(userId),
        role: "owner",
        invitedBy: Number(userId),
      });

      let defaultVertexId: number | null = null;
      const [existingVertex] = await db
        .select({ id: vertexProfiles.id })
        .from(vertexProfiles)
        .where(eq(vertexProfiles.name, "ibew-134-default"))
        .limit(1);

      if (existingVertex) {
        defaultVertexId = Number(existingVertex.id);
      } else {
        const [createdVertex] = await db.insert(vertexProfiles).values({
          name: "ibew-134-default",
          description: "Default beta vertex profile for IBEW mobile flow.",
          configJson: {
            model: "gpt-4o-mini",
            temperature: 0.2,
          },
          toolsAllowlistJson: ["blueprint.parse", "estimate.chain", "gaps.detect"],
        });
        defaultVertexId = Number(createdVertex.insertId);
      }

      await db.insert(agentInstances).values({
        projectId: newProjectId,
        vertexId: Number(defaultVertexId),
        displayName: "IBEW 134 Agent",
        status: "active",
        createdBy: Number(userId),
      });
    }

    const expiresInHours = Math.max(1, Number(env.MOBILE_SESSION_TTL_HOURS || 24));
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    const accessToken = jwt.sign(
      {
        sub: String(userId),
        role: userRole,
        email,
        name: email.split("@")[0],
      },
      env.JWT_SECRET,
      { algorithm: "HS256", expiresIn: `${expiresInHours}h` }
    );

    res.json({
      ok: true,
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      user: {
        id: userId,
        role: userRole,
        email,
      },
    });
  } catch (error) {
    console.error("[auth/login] failed:", error);
    res.status(500).json({
      ok: false,
      error_code: "INTERNAL_SERVER_ERROR",
      message: "Login failed.",
    });
  }
});

app.post("/auth/change-password", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization ?? "");
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Authorization required.",
      });
      return;
    }

    let jwtPayload: jwt.JwtPayload;
    try {
      jwtPayload = jwt.verify(authHeader.slice(7), env.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Invalid session token.",
      });
      return;
    }

    const userId = Number(jwtPayload.sub);
    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");
    if (!userId || !currentPassword || !newPassword) {
      res.status(400).json({
        ok: false,
        error_code: "INVALID_INPUT",
        message: "currentPassword and newPassword are required.",
      });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({
        ok: false,
        error_code: "INVALID_INPUT",
        message: "New password must be at least 8 characters.",
      });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({
        ok: false,
        error_code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable.",
      });
      return;
    }

    await ensureMobileAuthBootstrap();

    const [credential] = await db
      .select()
      .from(mobileUserCredentials)
      .where(eq(mobileUserCredentials.userId, userId))
      .limit(1);

    if (!credential || !verifyPassword(currentPassword, credential.passwordHash)) {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Current password is incorrect.",
      });
      return;
    }

    await db
      .update(mobileUserCredentials)
      .set({ passwordHash: hashPassword(newPassword) })
      .where(eq(mobileUserCredentials.userId, userId));

    res.json({
      ok: true,
      message: "Password updated.",
    });
  } catch (error) {
    console.error("[auth/change-password] failed:", error);
    res.status(500).json({
      ok: false,
      error_code: "INTERNAL_SERVER_ERROR",
      message: "Unable to change password.",
    });
  }
});

app.post("/auth/create-job", async (req, res) => {
  try {
    const authHeader = String(req.headers.authorization ?? "");
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Authorization required.",
      });
      return;
    }

    let jwtPayload: jwt.JwtPayload;
    try {
      jwtPayload = jwt.verify(authHeader.slice(7), env.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as jwt.JwtPayload;
    } catch {
      res.status(401).json({
        ok: false,
        error_code: "UNAUTHORIZED",
        message: "Invalid session token.",
      });
      return;
    }

    const userId = Number(jwtPayload.sub);
    const name = String(req.body?.name ?? "").trim();
    const address = String(req.body?.address ?? "").trim();
    if (!userId || !name) {
      res.status(400).json({
        ok: false,
        error_code: "INVALID_INPUT",
        message: "Job name is required.",
      });
      return;
    }

    const db = await getDb();
    if (!db) {
      res.status(503).json({
        ok: false,
        error_code: "SERVICE_UNAVAILABLE",
        message: "Database unavailable.",
      });
      return;
    }

    const slug = `ibew-134-${userId}-${Date.now().toString().slice(-6)}`;
    const [newProject] = await db.insert(projects).values({
      name,
      slug,
      description: address || "Address not set",
      ownerId: userId,
      tenant: "launchbase",
      status: "active",
    });
    const projectId = Number(newProject.insertId);

    await db.insert(projectCollaborators).values({
      projectId,
      userId,
      role: "owner",
      invitedBy: userId,
    });

    let defaultVertexId: number | null = null;
    const [existingVertex] = await db
      .select({ id: vertexProfiles.id })
      .from(vertexProfiles)
      .where(eq(vertexProfiles.name, "ibew-134-default"))
      .limit(1);

    if (existingVertex) {
      defaultVertexId = Number(existingVertex.id);
    } else {
      const [createdVertex] = await db.insert(vertexProfiles).values({
        name: "ibew-134-default",
        description: "Default beta vertex profile for IBEW mobile flow.",
        configJson: {
          model: "gpt-4o-mini",
          temperature: 0.2,
        },
        toolsAllowlistJson: ["blueprint.parse", "estimate.chain", "gaps.detect"],
      });
      defaultVertexId = Number(createdVertex.insertId);
    }

    await db.insert(agentInstances).values({
      projectId,
      vertexId: Number(defaultVertexId),
      displayName: "IBEW 134 Agent",
      status: "active",
      createdBy: userId,
    });

    res.json({
      ok: true,
      project: {
        id: projectId,
        name,
        address: address || null,
        status: "active",
      },
    });
  } catch (error) {
    console.error("[auth/create-job] failed:", error);
    res.status(500).json({
      ok: false,
      error_code: "INTERNAL_SERVER_ERROR",
      message: "Unable to create job.",
    });
  }
});

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
const shouldRunHealthMonitor =
  env.NODE_ENV === "production" ||
  process.env.ENABLE_AGENT_HEALTH_MONITOR === "true";

async function startServer() {
  await ensureMobileAuthBootstrap();

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

    if (shouldRunHealthMonitor) {
      startHealthMonitor();
    } else {
      console.log(
        "[agentHealthMonitor] Disabled in development (set ENABLE_AGENT_HEALTH_MONITOR=true to enable)"
      );
    }
  });
}

startServer().catch((err) => {
  console.error("[server] Startup failed:", err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`[server] ${signal} received - shutting down gracefully`);

  if (shouldRunHealthMonitor) {
    stopHealthMonitor();
  }

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
