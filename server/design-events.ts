import { getDb } from "./db";
import { designEvents, type InsertDesignEvent } from "../drizzle/schema";

/**
 * Event types for design operations
 */
export type DesignEventType =
  | "DESIGN_JOB_CREATED"
  | "DESIGN_CANDIDATES_GENERATED"
  | "DESIGN_SCORED"
  | "DESIGN_SELECTED"
  | "DESIGN_RENDERED"
  | "DESIGN_FAILED";

/**
 * Actor types for design events
 */
export type DesignActorType = "system" | "admin" | "customer";

/**
 * Log a design event to the audit trail
 * 
 * @example
 * await logDesignEvent({
 *   intakeId: 123,
 *   designJobId: 456,
 *   eventType: "DESIGN_JOB_CREATED",
 *   actorType: "system",
 *   reason: "Tier 1 Enhanced Presentation Pass triggered",
 *   meta: { tier: "enhanced", engine: "launchbase_rules_v1" }
 * });
 */
export async function logDesignEvent(params: {
  intakeId: number;
  designJobId?: number;
  tenant?: "launchbase" | "vinces";
  eventType: DesignEventType;
  actorType?: DesignActorType;
  reason?: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[Design Events] Database not available, skipping event log");
    return;
  }

  const event: InsertDesignEvent = {
    intakeId: params.intakeId,
    designJobId: params.designJobId,
    tenant: params.tenant || "launchbase",
    eventType: params.eventType,
    actorType: params.actorType || "system",
    reason: params.reason,
    meta: params.meta,
  };

  try {
    await db.insert(designEvents).values(event);
    console.log(`[Design Events] ${params.eventType} logged for intake ${params.intakeId}`);
  } catch (error) {
    console.error(`[Design Events] Failed to log ${params.eventType}:`, error);
  }
}

/**
 * Get design events for an intake (most recent first)
 */
export async function getDesignEvents(intakeId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(designEvents)
    .where(eq(designEvents.intakeId, intakeId))
    .orderBy(desc(designEvents.createdAt))
    .limit(limit);
}

/**
 * Get design events for a specific job
 */
export async function getDesignJobEvents(designJobId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(designEvents)
    .where(eq(designEvents.designJobId, designJobId))
    .orderBy(desc(designEvents.createdAt))
    .limit(limit);
}

// Import missing functions from drizzle-orm
import { eq, desc } from "drizzle-orm";
