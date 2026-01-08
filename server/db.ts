import { eq, like, and, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users,
  intakes, InsertIntake, Intake,
  buildPlans, InsertBuildPlan, BuildPlan,
  clarifications, InsertClarification, Clarification,
  deployments, InsertDeployment, Deployment,
  intelligenceLayers, InsertIntelligenceLayer, IntelligenceLayer,
  socialPosts, InsertSocialPost, SocialPost,
  postUsage, InsertPostUsage, PostUsage,
} from "../drizzle/schema";
import { TEMPLATE_VERSION_CURRENT } from "../shared/templateVersion";
import { ENV } from './_core/env';
import { randomBytes } from 'crypto';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ INTAKE FUNCTIONS ============

export async function createIntake(data: {
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  vertical: "trades" | "appointments" | "professional";
  language?: "en" | "es" | "pl";
  audience?: "biz" | "org";
  websiteStatus?: "none" | "existing" | "systems_only";
  tenant?: "launchbase" | "vinces";
  services?: string[];
  serviceArea?: string[];
  primaryCTA?: string;
  bookingLink?: string;
  tagline?: string;
  brandColors?: { primary?: string; secondary?: string };
  rawPayload?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create intake: database not available");
    return null;
  }

  // Build rawPayload: merge provided rawPayload with canonical + non-nullish fields (no undefined overwrites)
  const mergedRawPayload: Record<string, unknown> = {
    ...(data.rawPayload ?? {}),
    // Canonical fields (always present)
    businessName: data.businessName,
    contactName: data.contactName,
    email: data.email,
    vertical: data.vertical,
    language: data.language ?? "en",
    audience: data.audience ?? "biz",
    websiteStatus: data.websiteStatus ?? "none",
  };

  // Optional fields: only set if non-nullish (prevents clobber/noise)
  if (data.phone != null) mergedRawPayload.phone = data.phone;
  if (data.services != null) mergedRawPayload.services = data.services;
  if (data.serviceArea != null) mergedRawPayload.serviceArea = data.serviceArea;
  if (data.primaryCTA != null) mergedRawPayload.primaryCTA = data.primaryCTA;
  if (data.bookingLink != null) mergedRawPayload.bookingLink = data.bookingLink;
  if (data.tagline != null) mergedRawPayload.tagline = data.tagline;
  if (data.brandColors != null) mergedRawPayload.brandColors = data.brandColors;

  // Derive tenant: priority order = explicit > email domain > fallback
  const { deriveTenantFromEmail } = await import("./_core/tenant");
  const tenant = data.tenant ?? deriveTenantFromEmail(data.email);

  const values: InsertIntake = {
    businessName: data.businessName,
    contactName: data.contactName,
    email: data.email,
    language: data.language ?? "en",
    audience: data.audience ?? "biz",
    // websiteStatus stored in both column + rawPayload (duplicated intentionally for querying + immutable audit trail)
    websiteStatus: data.websiteStatus ?? "none",
    tenant,
    phone: data.phone || null,
    vertical: data.vertical,
    services: data.services || null,
    serviceArea: data.serviceArea || null,
    primaryCTA: data.primaryCTA || null,
    bookingLink: data.bookingLink || null,
    tagline: data.tagline || null,
    brandColors: data.brandColors || null,
    rawPayload: mergedRawPayload,
    status: "new" as const,
  };

  const result = await db.insert(intakes).values(values);
  const insertId = result[0].insertId;
  
  return { id: insertId, ...values };
}

export async function setIntakeStatus(intakeId: number, status: Intake['status']) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update intake status: database not available");
    return null;
  }

  await db.update(intakes)
    .set({ status, updatedAt: new Date() })
    .where(eq(intakes.id, intakeId));

  return { id: intakeId, status };
}

export async function getIntakes(status?: string, search?: string): Promise<Intake[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get intakes: database not available");
    return [];
  }

  const conditions = [];
  if (status) {
    conditions.push(eq(intakes.status, status as Intake['status']));
  }
  if (search) {
    conditions.push(like(intakes.businessName, `%${search}%`));
  }

  const query = conditions.length > 0
    ? db.select().from(intakes).where(and(...conditions)).orderBy(desc(intakes.createdAt))
    : db.select().from(intakes).orderBy(desc(intakes.createdAt));

  return await query;
}

export async function getIntakeById(id: number): Promise<Intake | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get intake: database not available");
    return null;
  }

  const result = await db.select().from(intakes).where(eq(intakes.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateIntakeStatus(id: number, status: Intake['status']) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update intake: database not available");
    return;
  }

  await db.update(intakes).set({ status }).where(eq(intakes.id, id));
}

// ============ BUILD PLAN FUNCTIONS ============

export async function createBuildPlan(data: {
  intakeId: number;
  templateId: string;
  plan: BuildPlan['plan'];
  status?: BuildPlan['status'];
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create build plan: database not available");
    return null;
  }

  const values: InsertBuildPlan = {
    intakeId: data.intakeId,
    templateId: data.templateId,
    plan: data.plan,
    status: data.status || "draft",
  };

  const result = await db.insert(buildPlans).values(values);
  const insertId = result[0].insertId;
  
  return { id: insertId, ...values };
}

export async function getBuildPlanById(id: number): Promise<BuildPlan | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get build plan: database not available");
    return null;
  }

  const result = await db.select().from(buildPlans).where(eq(buildPlans.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getBuildPlanByIntakeId(intakeId: number): Promise<BuildPlan | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get build plan: database not available");
    return null;
  }

  const result = await db.select().from(buildPlans).where(eq(buildPlans.intakeId, intakeId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateBuildPlanStatus(id: number, status: BuildPlan['status']) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update build plan: database not available");
    return;
  }

  await db.update(buildPlans).set({ status }).where(eq(buildPlans.id, id));
}

// ============ CLARIFICATION FUNCTIONS ============

function generateToken(): string {
  return randomBytes(32).toString('hex');
}

export async function createClarification(data: {
  intakeId: number;
  questionKey: string;
  questionText: string;
  inputType?: "text" | "select" | "multitag";
  options?: string[];
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create clarification: database not available");
    return null;
  }

  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const values: InsertClarification = {
    intakeId: data.intakeId,
    token,
    questionKey: data.questionKey,
    questionText: data.questionText,
    inputType: data.inputType || "text",
    options: data.options || null,
    status: "pending",
    used: false,
    expiresAt,
  };

  const result = await db.insert(clarifications).values(values);
  const insertId = result[0].insertId;
  
  return { id: insertId, ...values };
}

export async function getClarificationByToken(token: string): Promise<Clarification | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get clarification: database not available");
    return null;
  }

  const result = await db.select().from(clarifications).where(eq(clarifications.token, token)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function submitClarificationAnswer(token: string, answer: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot submit clarification: database not available");
    return { success: false, error: "Database not available" };
  }

  // Get the clarification
  const clar = await getClarificationByToken(token);
  if (!clar) {
    return { success: false, error: "Clarification not found" };
  }

  // Check if already used (one-time token)
  if (clar.used) {
    return { success: false, error: "This link has already been used" };
  }

  // Check if expired
  if (clar.expiresAt && new Date(clar.expiresAt) < new Date()) {
    return { success: false, error: "This link has expired" };
  }

  // Update the clarification
  await db.update(clarifications).set({
    answer,
    answeredAt: new Date(),
    status: "answered",
    used: true,
  }).where(eq(clarifications.token, token));

  return { success: true };
}

// ============ DEPLOYMENT FUNCTIONS ============

export async function createDeployment(data: {
  buildPlanId: number;
  intakeId: number;
  status?: Deployment['status'];
  trigger?: "auto" | "manual" | "rollback";
  rolledBackFromDeploymentId?: number;
}) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create deployment: database not available");
    return null;
  }

  // Get tenant from linked intake
  const intake = await getIntakeById(data.intakeId);
  const tenant = intake?.tenant ?? "launchbase";

  // Get buildPlan snapshot for rollback reproducibility
  const buildPlan = await getBuildPlanById(data.buildPlanId);
  
  // Safety guard: throw if buildPlan doesn't exist or has no plan
  if (!buildPlan || !buildPlan.plan) {
    throw new Error(`Cannot create deployment: buildPlan ${data.buildPlanId} not found or has no plan`);
  }
  
  const buildPlanSnapshot = {
    templateId: buildPlan.templateId,
    plan: buildPlan.plan,
  };

  // Safety guard: throw if TEMPLATE_VERSION_CURRENT missing
  if (!TEMPLATE_VERSION_CURRENT) {
    throw new Error("Cannot create deployment: TEMPLATE_VERSION_CURRENT is not set");
  }

  const values: InsertDeployment = {
    buildPlanId: data.buildPlanId,
    intakeId: data.intakeId,
    tenant,
    status: data.status || "queued",
    trigger: data.trigger || "auto",
    rolledBackFromDeploymentId: data.rolledBackFromDeploymentId || null,
    templateVersion: TEMPLATE_VERSION_CURRENT,
    buildPlanSnapshot,
    logs: [],
  };

  const result = await db.insert(deployments).values(values);
  const insertId = result[0].insertId;
  
  return { id: insertId, ...values };
}

export async function getDeploymentById(id: number): Promise<Deployment | null> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get deployment: database not available");
    return null;
  }

  const result = await db.select().from(deployments).where(eq(deployments.id, id)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function getDeployments(status?: string): Promise<Deployment[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get deployments: database not available");
    return [];
  }

  const query = status
    ? db.select().from(deployments).where(eq(deployments.status, status as Deployment['status'])).orderBy(desc(deployments.createdAt))
    : db.select().from(deployments).orderBy(desc(deployments.createdAt));

  return await query;
}

export async function updateDeploymentStatus(
  id: number, 
  status: Deployment['status'],
  extra?: Partial<Pick<Deployment, 'siteId' | 'previewUrl' | 'productionUrl' | 'logs' | 'errorMessage' | 'startedAt' | 'completedAt'>>
) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update deployment: database not available");
    return;
  }

  await db.update(deployments).set({ status, ...extra }).where(eq(deployments.id, id));
}

export async function runDeployment(id: number) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database not available" };
  }

  // Get deployment
  const deployment = await getDeploymentById(id);
  if (!deployment) {
    return { success: false, error: "Deployment not found" };
  }

  // Get build plan
  const buildPlan = await getBuildPlanById(deployment.buildPlanId);
  if (!buildPlan) {
    return { success: false, error: "Build plan not found" };
  }

  // Get intake
  const intake = await getIntakeById(deployment.intakeId);
  if (!intake) {
    return { success: false, error: "Intake not found" };
  }

  // Update status to running
  await updateDeploymentStatus(id, "running", { startedAt: new Date() });

  try {
    // Simulate deployment process
    const logs: string[] = [];
    logs.push(`[${new Date().toISOString()}] Starting deployment for ${intake.businessName}`);
    logs.push(`[${new Date().toISOString()}] Using template: ${buildPlan.templateId}`);
    logs.push(`[${new Date().toISOString()}] Generating site files...`);
    
    // Generate a unique site ID
    const siteId = `site-${intake.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    // Use Manus subdomain for preview URL
    const manusAppDomain = "launchbase-h86jcadp.manus.space";
    const previewUrl = `https://${siteId}.${manusAppDomain}`;
    
    logs.push(`[${new Date().toISOString()}] Site generated successfully on Manus infrastructure`);
    logs.push(`[${new Date().toISOString()}] Preview URL: ${previewUrl}`);

    // Update deployment with success
    await updateDeploymentStatus(id, "success", {
      siteId,
      previewUrl,
      productionUrl: previewUrl,
      logs,
      completedAt: new Date(),
    });

    // Update build plan and intake status
    await updateBuildPlanStatus(deployment.buildPlanId, "deployed");
    await updateIntakeStatus(deployment.intakeId, "deployed");

    // Update intake status
    await updateIntakeStatus(deployment.intakeId, "approved");

    return { 
      success: true, 
      siteId,
      previewUrl,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateDeploymentStatus(id, "failed", {
      errorMessage,
      completedAt: new Date(),
    });
    return { success: false, error: errorMessage };
  }
}
