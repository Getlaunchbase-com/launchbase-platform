/**
 * Design job procedures — populated when design generation pipeline is connected.
 */

import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { designJobs, designCandidates, designEvents } from "../db/schema";
import { desc, eq, and, count } from "drizzle-orm";

export const designJobsRouter = router({
  /** List design jobs with optional status filter and pagination */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["created", "generated", "scored", "selected", "rendered", "failed"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { jobs: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(designJobs.status, input.status));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(designJobs)
        .where(where)
        .orderBy(desc(designJobs.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(designJobs)
        .where(where);

      return { jobs: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single design job by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [job] = await db
        .select()
        .from(designJobs)
        .where(eq(designJobs.id, input.id))
        .limit(1);

      return job ?? null;
    }),

  /** List design candidates for a given designJobId, ordered by rank */
  getCandidates: adminProcedure
    .input(z.object({ designJobId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { candidates: [] };

      const candidates = await db
        .select()
        .from(designCandidates)
        .where(eq(designCandidates.designJobId, input.designJobId))
        .orderBy(designCandidates.rank);

      return { candidates };
    }),

  /** List events for a given designJobId, ordered by createdAt desc */
  getEvents: adminProcedure
    .input(z.object({ designJobId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [] };

      const events = await db
        .select()
        .from(designEvents)
        .where(eq(designEvents.designJobId, input.designJobId))
        .orderBy(desc(designEvents.createdAt));

      return { events };
    }),

  /** Count of jobs by status */
  summary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { byStatus: {} };

    const results = await db
      .select({
        status: designJobs.status,
        count: count(),
      })
      .from(designJobs)
      .groupBy(designJobs.status);

    const byStatus: Record<string, number> = {};
    for (const row of results) {
      byStatus[row.status] = row.count;
    }

    return { byStatus };
  }),
});
