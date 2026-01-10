/**
 * Action Request Events - Audit Logging
 * 
 * Append-only log of all state transitions and actions.
 * Every transition writes an event. No exceptions.
 */

import { getDb } from "./db";
import { actionRequestEvents, type InsertActionRequestEvent } from "../drizzle/schema";

/**
 * Write an audit event for an action request
 */
export async function writeActionRequestEvent(
  event: Omit<InsertActionRequestEvent, "id" | "createdAt">
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.error("[ActionRequestEvents] Database not available");
    return;
  }

  try {
    await db.insert(actionRequestEvents).values(event);
  } catch (err) {
    console.error("[ActionRequestEvents] Failed to write event:", err);
    // Don't throw - audit logging should never break the main flow
  }
}

/**
 * Get events for an action request
 */
export async function getActionRequestEvents(actionRequestId: number) {
  const db = await getDb();
  if (!db) return [];

  const events = await db
    .select()
    .from(actionRequestEvents)
    .where(eq(actionRequestEvents.actionRequestId, actionRequestId))
    .orderBy(actionRequestEvents.createdAt);

  return events;
}

/**
 * Get events for an intake
 */
export async function getIntakeActionRequestEvents(intakeId: number) {
  const db = await getDb();
  if (!db) return [];

  const events = await db
    .select()
    .from(actionRequestEvents)
    .where(eq(actionRequestEvents.intakeId, intakeId))
    .orderBy(actionRequestEvents.createdAt);

  return events;
}

// Import eq for queries
import { eq } from "drizzle-orm";
