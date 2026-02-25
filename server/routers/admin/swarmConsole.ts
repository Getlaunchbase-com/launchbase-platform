/**
 * Swarm console procedures — runtime-populated by agent-stack swarm orchestration layer.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { swarmRuns, swarmProfiles, repoSources } from "../../db/schema";
import { desc, eq, and, count, sql } from "drizzle-orm";

export const swarmConsoleRouter = router({
  /** List swarm runs with optional status filter and pagination */
  listRuns: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "running", "completed", "failed", "timeout"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { runs: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(swarmRuns.status, input.status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(swarmRuns)
        .where(where)
        .orderBy(desc(swarmRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(swarmRuns)
        .where(where);

      return { runs: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single swarm run by repairId */
  getRunById: adminProcedure
    .input(z.object({ repairId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(swarmRuns)
        .where(eq(swarmRuns.repairId, input.repairId))
        .limit(1);

      return row ?? null;
    }),

  /** List all swarm profiles */
  listProfiles: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { profiles: [] };

      const rows = await db
        .select()
        .from(swarmProfiles)
        .orderBy(desc(swarmProfiles.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { profiles: rows };
    }),

  /** List all repo sources */
  listRepoSources: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { sources: [] };

      const rows = await db
        .select()
        .from(repoSources)
        .orderBy(desc(repoSources.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { sources: rows };
    }),

  /** Aggregate: count by status, count by stopReason, total cost */
  runSummary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { countByStatus: [], countByStopReason: [], totalCost: 0 };

    // Count by status
    const statusCounts = await db
      .select({
        status: swarmRuns.status,
        count: count(),
      })
      .from(swarmRuns)
      .groupBy(swarmRuns.status);

    // Count by stopReason
    const stopReasonCounts = await db
      .select({
        stopReason: swarmRuns.stopReason,
        count: count(),
      })
      .from(swarmRuns)
      .where(sql`${swarmRuns.stopReason} IS NOT NULL`)
      .groupBy(swarmRuns.stopReason);

    // Total cost
    const [costResult] = await db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${swarmRuns.costUsd}), 0)`,
      })
      .from(swarmRuns);

    return {
      countByStatus: statusCounts,
      countByStopReason: stopReasonCounts,
      totalCost: costResult?.totalCost ?? 0,
    };
  }),
});
