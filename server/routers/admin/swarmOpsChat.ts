/**
 * Swarm operations chat — runtime-populated by agent-stack.
 * Real-time agent communication is managed by the external swarm process.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { agentEvents, agentRuns } from "../../db/schema";
import { desc, eq, and } from "drizzle-orm";

export const swarmOpsChatRouter = router({
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
