/**
 * Design Jobs tRPC Router
 * Admin observability for Tier 1 Enhanced Presentation
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { designJobs, designCandidates } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";

export const designJobsRouter = router({
  /**
   * Get design job by intake ID (for admin visibility)
   * Returns null if no job exists
   */
  byIntake: publicProcedure
    .input(z.object({ intakeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Find the most recent completed job for this intake
      const [job] = await db
        .select()
        .from(designJobs)
        .where(eq(designJobs.intakeId, input.intakeId))
        .orderBy(desc(designJobs.createdAt))
        .limit(1);

      if (!job) {
        return null;
      }

      // Get all candidates for this job, ordered by score
      const candidates = await db
        .select()
        .from(designCandidates)
        .where(eq(designCandidates.designJobId, job.id))
        .orderBy(desc(designCandidates.scoreTotal));

      // Find winner candidate
      const winnerCandidate = candidates.find(c => c.id === job.winnerCandidateId);

      return {
        id: job.id,
        tier: job.tier,
        createdAt: job.createdAt,
        winnerVariantKey: winnerCandidate?.variantKey || null,
        winnerScore: winnerCandidate?.scoreTotal || null,
        candidates: candidates.map((c, i) => ({
          variantKey: c.variantKey,
          score: c.scoreTotal,
          rank: c.rank || i + 1,
          isWinner: c.id === job.winnerCandidateId,
        })),
      };
    }),
});
