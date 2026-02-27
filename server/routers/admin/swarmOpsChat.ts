/**
 * Swarm operations chat — runtime-populated by agent-stack.
 * Real-time agent communication is managed by the external swarm process.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { agentEvents, agentInstances, agentRuns, vertexProfiles } from "../../db/schema";
import { desc, eq, and } from "drizzle-orm";

export const swarmOpsChatRouter = router({
  /**
   * Append an operator message and start/continue a run.
   * This is the admin-side bridge from chat intent to runtime tool execution.
   */
  sendMessage: adminProcedure
    .input(
      z.object({
        message: z.string().min(1).max(10_000),
        runId: z.number().int().optional(),
        projectId: z.number().int().optional(),
        agentInstanceId: z.number().int().optional(),
        model: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      let runId = input.runId ?? null;

      if (!runId) {
        if (!input.projectId || !input.agentInstanceId) {
          throw new Error("projectId and agentInstanceId are required when runId is not provided");
        }

        const [instance] = await db
          .select()
          .from(agentInstances)
          .where(
            and(
              eq(agentInstances.id, input.agentInstanceId),
              eq(agentInstances.projectId, input.projectId)
            )
          )
          .limit(1);

        if (!instance) throw new Error("Instance not found or does not belong to project");
        if (instance.status !== "active") throw new Error("Instance is not active");

        let model = input.model ?? null;
        if (!model && instance.vertexId) {
          const [vertex] = await db
            .select({ configJson: vertexProfiles.configJson })
            .from(vertexProfiles)
            .where(eq(vertexProfiles.id, instance.vertexId))
            .limit(1);
          model = (vertex?.configJson as any)?.model ?? null;
        }

        const [created] = await db.insert(agentRuns).values({
          createdBy: (ctx as any).user?.id ?? 0,
          status: "running",
          goal: input.message,
          model,
          projectId: input.projectId,
          agentInstanceId: input.agentInstanceId,
        });
        runId = Number(created.insertId);
      } else {
        const [existing] = await db
          .select({ id: agentRuns.id })
          .from(agentRuns)
          .where(eq(agentRuns.id, runId))
          .limit(1);
        if (!existing) throw new Error("Run not found");
      }

      const [eventInserted] = await db.insert(agentEvents).values({
        runId,
        type: "message",
        payload: {
          role: "user",
          content: input.message,
          source: "admin_ops_chat",
          by: (ctx as any).user?.email ?? "admin",
        },
      });

      return {
        runId,
        eventId: Number(eventInserted.insertId),
        eventAppended: true,
      };
    }),

  /** List agent events where type = "message", optionally filtered by runId */
  listMessages: adminProcedure
    .input(
      z.object({
        runId: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { messages: [] };

      const conditions: any[] = [eq(agentEvents.type, "message")];
      if (input.runId) conditions.push(eq(agentEvents.runId, input.runId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(agentEvents)
        .where(where)
        .orderBy(desc(agentEvents.ts))
        .limit(input.limit)
        .offset(input.offset);

      return { messages: rows };
    }),

  /** For a given runId, return the run details plus its latest events */
  getRunContext: adminProcedure
    .input(
      z.object({
        runId: z.number().int(),
        eventLimit: z.number().int().min(1).max(100).default(20),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      // Get the run details
      const [run] = await db
        .select()
        .from(agentRuns)
        .where(eq(agentRuns.id, input.runId))
        .limit(1);

      if (!run) return null;

      // Get latest events for this run
      const events = await db
        .select()
        .from(agentEvents)
        .where(eq(agentEvents.runId, input.runId))
        .orderBy(desc(agentEvents.ts))
        .limit(input.eventLimit);

      return {
        run,
        events,
      };
    }),
});
