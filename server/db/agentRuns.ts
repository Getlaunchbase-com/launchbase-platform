/**
 * Agent Runs Domain Model - Database Operations
 * Phase 1: Agent Runs Domain Model (CRUD + event timeline)
 */

import { getDb } from "../db.js";
import { agentRuns, agentEvents, type AgentRun, type AgentEvent, type InsertAgentRun, type InsertAgentEvent } from "../../drizzle/schema.js";
import { eq, desc } from "drizzle-orm";

/**
 * Create a new agent run
 */
export async function createAgentRun(data: {
  createdBy: number;
  goal: string;
  model?: string;
  routerUrl?: string;
  workspaceName?: string;
}): Promise<AgentRun> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [run] = await db
    .insert(agentRuns)
    .values({
      createdBy: data.createdBy,
      goal: data.goal,
      model: data.model,
      routerUrl: data.routerUrl,
      workspaceName: data.workspaceName,
      status: "running",
    })
    .$returningId();

  const [created] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, run.id));

  return created;
}

/**
 * Get agent run by ID
 */
export async function getAgentRun(runId: number): Promise<AgentRun | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [run] = await db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.id, runId));

  return run;
}

/**
 * Get all agent runs for a user (most recent first)
 */
export async function getAgentRunsByUser(userId: number, limit = 50): Promise<AgentRun[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentRuns)
    .where(eq(agentRuns.createdBy, userId))
    .orderBy(desc(agentRuns.createdAt))
    .limit(limit);
}

/**
 * Update agent run status
 */
export async function updateAgentRunStatus(
  runId: number,
  status: "running" | "success" | "failed" | "awaiting_approval",
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updates: Partial<InsertAgentRun> = { status };
  
  if (status === "success" || status === "failed") {
    updates.finishedAt = new Date();
  }
  
  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }

  await db
    .update(agentRuns)
    .set(updates)
    .where(eq(agentRuns.id, runId));
}

/**
 * Append an event to the agent run timeline
 */
export async function appendAgentEvent(
  runId: number,
  type: "message" | "tool_call" | "tool_result" | "approval_request" | "approval_result" | "error" | "artifact",
  payload: Record<string, unknown>
): Promise<AgentEvent> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [event] = await db
    .insert(agentEvents)
    .values({
      runId,
      type,
      payload,
    })
    .$returningId();

  const [created] = await db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.id, event.id));

  return created;
}

/**
 * Get the complete event timeline for a run (chronological order)
 */
export async function getRunTimeline(runId: number): Promise<AgentEvent[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.runId, runId))
    .orderBy(agentEvents.ts);
}

/**
 * Get the latest N events for a run (most recent first)
 */
export async function getRecentEvents(runId: number, limit = 20): Promise<AgentEvent[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db
    .select()
    .from(agentEvents)
    .where(eq(agentEvents.runId, runId))
    .orderBy(desc(agentEvents.ts))
    .limit(limit);
}
