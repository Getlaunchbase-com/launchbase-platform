/**
 * Agent run, event, and artifact procedures — runtime-populated by agent-stack.
 * Run lifecycle is managed by the external agent runtime.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { agentRuns, agentEvents, agentArtifacts } from "../../db/schema";
import { desc, eq, and, count, asc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Agent Runs Router
// ---------------------------------------------------------------------------

export const agentRunsRouter = router({
  /** List runs with optional status filter and pagination */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["running", "success", "failed", "awaiting_approval"]).optional(),
        projectId: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { runs: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(agentRuns.status, input.status));
      if (input.projectId) conditions.push(eq(agentRuns.projectId, input.projectId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(agentRuns)
        .where(where)
        .orderBy(desc(agentRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentRuns)
        .where(where);

      return { runs: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single run by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [run] = await db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.id, input.id))
        .limit(1);

      return run ?? null;
    }),

  /** Count of runs by status */
  summary: adminProcedure
    .query(async () => {
      const db = await getDb();
      if (!db) return { running: 0, success: 0, failed: 0, awaiting_approval: 0 };

      const rows = await db.select().from(agentRuns);

      const summary = {
        running: rows.filter((r) => r.status === "running").length,
        success: rows.filter((r) => r.status === "success").length,
        failed: rows.filter((r) => r.status === "failed").length,
        awaiting_approval: rows.filter((r) => r.status === "awaiting_approval").length,
      };

      return summary;
    }),

  /** Cancel a running run by setting status to failed */
  cancel: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(agentRuns)
        .set({
          status: "failed",
          errorMessage: "Cancelled by admin",
          finishedAt: new Date(),
        })
        .where(eq(agentRuns.id, input.id));

      return { success: true, id: input.id };
    }),
});

// ---------------------------------------------------------------------------
// Agent Events Router
// ---------------------------------------------------------------------------

export const agentEventsRouter = router({
  /** List events for a given runId, ordered by ts asc */
  listByRun: adminProcedure
    .input(z.object({ runId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };

      const rows = await db
        .select()
        .from(agentEvents)
        .where(eq(agentEvents.runId, input.runId))
        .orderBy(asc(agentEvents.ts));

      return { events: rows };
    }),

  /** List events filtered by type and optional runId */
  listByType: adminProcedure
    .input(
      z.object({
        type: z.enum([
          "message",
          "tool_call",
          "tool_result",
          "approval_request",
          "approval_result",
          "error",
          "artifact",
        ]),
        runId: z.number().int().optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };

      const conditions: any[] = [eq(agentEvents.type, input.type)];
      if (input.runId) conditions.push(eq(agentEvents.runId, input.runId));

      const where = and(...conditions);

      const rows = await db
        .select()
        .from(agentEvents)
        .where(where)
        .orderBy(asc(agentEvents.ts));

      return { events: rows };
    }),
});

// ---------------------------------------------------------------------------
// Agent Artifacts Router
// ---------------------------------------------------------------------------

export const agentArtifactsRouter = router({
  /** List artifacts for a given runId */
  listByRun: adminProcedure
    .input(z.object({ runId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { artifacts: [] };

      const rows = await db
        .select()
        .from(agentArtifacts)
        .where(eq(agentArtifacts.runId, input.runId))
        .orderBy(desc(agentArtifacts.createdAt));

      return { artifacts: rows };
    }),

  /** List artifacts for a given projectId with pagination */
  listByProject: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { artifacts: [], total: 0 };

      const rows = await db
        .select()
        .from(agentArtifacts)
        .where(eq(agentArtifacts.projectId, input.projectId))
        .orderBy(desc(agentArtifacts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentArtifacts)
        .where(eq(agentArtifacts.projectId, input.projectId));

      return { artifacts: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single artifact by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [artifact] = await db
        .select()
        .from(agentArtifacts)
        .where(eq(agentArtifacts.id, input.id))
        .limit(1);

      return artifact ?? null;
    }),
});
