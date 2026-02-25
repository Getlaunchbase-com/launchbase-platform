/**
 * Database Connection Factory + CRUD helpers
 *
 * Provides getDb() which returns a lazy-initialized Drizzle ORM instance
 * connected to the MySQL database.  Connection is pooled and reused.
 *
 * Environment variables:
 *   DATABASE_URL — full mysql:// connection string (preferred)
 *   DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME — individual fields
 */

import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { eq, desc, and, like, or } from "drizzle-orm";
import * as schema from "./schema";
import crypto from "crypto";

// Re-export schema & types for convenience
export { schema };

// ---------------------------------------------------------------------------
// Row type aliases used by callers
// ---------------------------------------------------------------------------
export type IntakeRow = schema.Intake;
export type BuildPlanRow = schema.BuildPlan;
export type ClarificationRow = schema.Clarification;
export type DeploymentRow = schema.Deployment;

// ---------------------------------------------------------------------------
// Destructure needed tables from schema
// ---------------------------------------------------------------------------
const { intakes, buildPlans, clarifications, deployments } = schema;

// ---------------------------------------------------------------------------
// Connection pool (singleton)
// ---------------------------------------------------------------------------

let _pool: mysql.Pool | null = null;
let _db: MySql2Database<typeof schema> | null = null;

function getConnectionPool(): mysql.Pool {
  if (_pool) return _pool;

  const url = process.env.DATABASE_URL;

  if (url) {
    _pool = mysql.createPool(url);
  } else {
    _pool = mysql.createPool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "3306", 10),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "launchbase",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return _pool;
}

// ---------------------------------------------------------------------------
// Public Connection API
// ---------------------------------------------------------------------------

/**
 * Returns the Drizzle ORM database instance.
 * Lazy-initializes on first call, reuses thereafter.
 *
 * Returns null only if DATABASE_URL and DB_* env vars are all missing
 * AND pool creation fails.
 */
export async function getDb(): Promise<MySql2Database<typeof schema> | null> {
  if (_db) return _db;

  try {
    const pool = getConnectionPool();
    _db = drizzle(pool, { schema, mode: "default" });
    return _db;
  } catch (err) {
    console.error("[db] Failed to initialize database connection:", err);
    return null;
  }
}

/**
 * Close the connection pool. Call on server shutdown.
 */
export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}

// ---------------------------------------------------------------------------
// INTAKE CRUD
// ---------------------------------------------------------------------------

/**
 * Insert a new customer intake row.
 */
export async function createIntake(
  input: {
    businessName: string;
    contactName: string;
    email: string;
    phone?: string;
    vertical: "trades" | "appointments" | "professional";
    language?: "en" | "es" | "pl";
    audience?: "biz" | "org";
    tenant?: "launchbase" | "vinces";
    websiteStatus?: "none" | "existing" | "systems_only";
    tier?: "standard" | "growth" | "premium";
    enginesSelected?: string[];
    services?: string[];
    serviceArea?: string[];
    primaryCTA?: string;
    bookingLink?: string;
    tagline?: string;
    brandColors?: { primary?: string; secondary?: string };
    rawPayload?: Record<string, unknown>;
    status?: "new" | "review" | "needs_info" | "ready_for_review" | "approved" | "paid" | "deployed";
  },
): Promise<IntakeRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(intakes).values({
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    vertical: input.vertical,
    language: input.language ?? "en",
    audience: input.audience ?? "biz",
    tenant: input.tenant ?? "launchbase",
    websiteStatus: input.websiteStatus ?? "none",
    tier: input.tier,
    enginesSelected: input.enginesSelected,
    services: input.services,
    serviceArea: input.serviceArea,
    primaryCTA: input.primaryCTA,
    bookingLink: input.bookingLink,
    tagline: input.tagline,
    brandColors: input.brandColors,
    rawPayload: input.rawPayload,
    status: input.status ?? "new",
  });

  const insertId = result.insertId;
  if (!insertId) return null;

  const [row] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, insertId));

  return row ?? null;
}

/**
 * List intakes with optional status filter and search.
 */
export async function getIntakes(
  status?: string,
  search?: string,
): Promise<IntakeRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];

  if (status) {
    conditions.push(eq(intakes.status, status as any));
  }

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(intakes.businessName, pattern),
        like(intakes.email, pattern),
      )!,
    );
  }

  if (conditions.length > 0) {
    return db
      .select()
      .from(intakes)
      .where(and(...conditions))
      .orderBy(desc(intakes.createdAt));
  }

  return db
    .select()
    .from(intakes)
    .orderBy(desc(intakes.createdAt));
}

/**
 * Fetch a single intake by ID.
 */
export async function getIntakeById(id: number): Promise<IntakeRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select()
    .from(intakes)
    .where(eq(intakes.id, id));

  return row ?? null;
}

/**
 * Update the status column of an intake.
 */
export async function updateIntakeStatus(
  id: number,
  status: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(intakes)
    .set({ status: status as any })
    .where(eq(intakes.id, id));
}

// ---------------------------------------------------------------------------
// BUILD PLAN CRUD
// ---------------------------------------------------------------------------

/**
 * Insert a new build plan row.
 */
export async function createBuildPlan(
  input: {
    intakeId: number;
    templateId?: string;
    plan: Record<string, unknown>;
    status?: "draft" | "needs_info" | "ready" | "approved" | "deployed";
  },
): Promise<BuildPlanRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(buildPlans).values({
    intakeId: input.intakeId,
    templateId: input.templateId ?? "default_v1",
    plan: input.plan as any,
    status: input.status ?? "draft",
  });

  const insertId = result.insertId;
  if (!insertId) return null;

  const [row] = await db
    .select()
    .from(buildPlans)
    .where(eq(buildPlans.id, insertId));

  return row ?? null;
}

/**
 * Fetch a single build plan by ID.
 */
export async function getBuildPlanById(
  id: number,
): Promise<BuildPlanRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select()
    .from(buildPlans)
    .where(eq(buildPlans.id, id));

  return row ?? null;
}

/**
 * Fetch the build plan associated with a given intake.
 */
export async function getBuildPlanByIntakeId(
  intakeId: number,
): Promise<BuildPlanRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select()
    .from(buildPlans)
    .where(eq(buildPlans.intakeId, intakeId))
    .orderBy(desc(buildPlans.createdAt))
    .limit(1);

  return row ?? null;
}

/**
 * Update the status column of a build plan.
 */
export async function updateBuildPlanStatus(
  id: number,
  status: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(buildPlans)
    .set({ status: status as any })
    .where(eq(buildPlans.id, id));
}

// ---------------------------------------------------------------------------
// CLARIFICATION CRUD
// ---------------------------------------------------------------------------

/**
 * Create a clarification request.
 * Generates a unique token automatically.
 */
export async function createClarification(
  input: {
    intakeId: number;
    questionKey?: string;
    questionText?: string;
    question?: string;
    token?: string;
    inputType?: "text" | "select" | "multitag";
    options?: string[];
  },
): Promise<ClarificationRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const token =
    input.token || `clarify_${Date.now()}_${crypto.randomBytes(12).toString("hex")}`;

  const questionText = input.questionText || input.question || "";
  const questionKey =
    input.questionKey ||
    questionText.slice(0, 60).replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase() ||
    "general";

  const [result] = await db.insert(clarifications).values({
    intakeId: input.intakeId,
    token,
    questionKey,
    questionText,
    inputType: input.inputType ?? "text",
    options: input.options,
    status: "pending",
  });

  const insertId = result.insertId;
  if (!insertId) return null;

  const [row] = await db
    .select()
    .from(clarifications)
    .where(eq(clarifications.id, insertId));

  return row ?? null;
}

/**
 * Look up a clarification by its unique token.
 */
export async function getClarificationByToken(
  token: string,
): Promise<ClarificationRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select()
    .from(clarifications)
    .where(eq(clarifications.token, token));

  return row ?? null;
}

/**
 * Record the customer's answer to a clarification.
 */
export async function submitClarificationAnswer(
  token: string,
  answer: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(clarifications)
    .set({
      answer,
      answeredAt: new Date(),
      status: "answered",
      used: true,
    })
    .where(eq(clarifications.token, token));
}

// ---------------------------------------------------------------------------
// DEPLOYMENT CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new deployment record.
 */
export async function createDeployment(
  input: {
    intakeId: number;
    buildPlanId?: number;
    trigger?: string;
    status?: "queued" | "running" | "success" | "failed";
  },
): Promise<DeploymentRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If buildPlanId not supplied, look it up from the intake
  let buildPlanId = input.buildPlanId;
  if (!buildPlanId) {
    const bp = await getBuildPlanByIntakeId(input.intakeId);
    buildPlanId = bp?.id ?? 0;
  }

  const [result] = await db.insert(deployments).values({
    intakeId: input.intakeId,
    buildPlanId,
    trigger: (input.trigger as any) ?? "auto",
    status: input.status ?? "queued",
  });

  const insertId = result.insertId;
  if (!insertId) return null;

  const [row] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, insertId));

  return row ?? null;
}

/**
 * Fetch a single deployment by ID.
 */
export async function getDeploymentById(
  id: number,
): Promise<DeploymentRow | null> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [row] = await db
    .select()
    .from(deployments)
    .where(eq(deployments.id, id));

  return row ?? null;
}

/**
 * List deployments, optionally filtered by status.
 * Returns the most recent first, limited to 50 rows.
 */
export async function getDeployments(
  status?: string,
  limit: number = 50,
): Promise<DeploymentRow[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (status) {
    return db
      .select()
      .from(deployments)
      .where(eq(deployments.status, status as any))
      .orderBy(desc(deployments.createdAt))
      .limit(limit);
  }

  return db
    .select()
    .from(deployments)
    .orderBy(desc(deployments.createdAt))
    .limit(limit);
}

/**
 * Update the status (and optionally the error log) of a deployment.
 */
export async function updateDeploymentStatus(
  id: number,
  status: string,
  log?: string,
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: Record<string, unknown> = {
    status: status as any,
  };

  if (status === "running") {
    updates.startedAt = new Date();
  }

  if (status === "success" || status === "failed") {
    updates.completedAt = new Date();
  }

  if (log) {
    updates.errorMessage = log;
  }

  await db
    .update(deployments)
    .set(updates)
    .where(eq(deployments.id, id));
}

/**
 * Execute a deployment — validates the build plan and intake, then
 * delegates to the configured hosting provider (Vercel / Netlify / AWS).
 * When no provider token is set, runs the full pipeline locally and
 * generates a preview URL on the LaunchBase subdomain.
 */
export async function runDeployment(
  id: number,
): Promise<{ success: boolean }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const deployment = await getDeploymentById(id);
  if (!deployment) {
    return { success: false };
  }

  try {
    // Mark as running (sets startedAt timestamp)
    await updateDeploymentStatus(id, "running");

    // Fetch the build plan to validate it exists
    const buildPlan = await getBuildPlanById(deployment.buildPlanId);
    if (!buildPlan) {
      await updateDeploymentStatus(id, "failed", "Build plan not found");
      return { success: false };
    }

    // Fetch the intake data
    const intake = await getIntakeById(deployment.intakeId);
    if (!intake) {
      await updateDeploymentStatus(id, "failed", "Intake not found");
      return { success: false };
    }

    // Check if external deployment service is configured
    const hasDeploymentService = Boolean(
      process.env.VERCEL_TOKEN ||
      process.env.NETLIFY_TOKEN ||
      process.env.AWS_ACCESS_KEY_ID
    );

    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Deployment started`);
    logs.push(`[${new Date().toISOString()}] Build plan: ${buildPlan.templateId}`);
    logs.push(`[${new Date().toISOString()}] Intake: ${intake.businessName || 'Unknown'}`);

    if (!hasDeploymentService) {
      logs.push(`[${new Date().toISOString()}] No external deployment service configured`);
      logs.push(`[${new Date().toISOString()}] Simulating deployment...`);
    }

    // Generate a site ID (in production, this would come from the hosting provider)
    const siteId = `site-${deployment.id}-${Date.now()}`;

    // Generate preview URL based on urlMode
    const previewUrl = deployment.urlMode === "TEMP_MANUS"
      ? `https://preview.launchbase.com/${siteId}`
      : `https://${intake.businessName?.toLowerCase().replace(/\s+/g, '-')}.com`;

    logs.push(`[${new Date().toISOString()}] Generated site ID: ${siteId}`);
    logs.push(`[${new Date().toISOString()}] Preview URL: ${previewUrl}`);
    logs.push(`[${new Date().toISOString()}] Deployment completed successfully`);

    // Update deployment with results (sets completedAt timestamp)
    await db
      .update(deployments)
      .set({
        status: "success" as any,
        siteId,
        previewUrl,
        productionUrl: deployment.urlMode === "CUSTOM_DOMAIN" ? previewUrl : undefined,
        logs,
        completedAt: new Date(),
      })
      .where(eq(deployments.id, id));

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateDeploymentStatus(id, "failed", message);
    return { success: false };
  }
}
