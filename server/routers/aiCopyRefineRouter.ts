/**
 * AI copy refinement procedures — populated when AI copy service is connected via external provider.
 */

import { z } from "zod";
import { router, adminProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { actionRequests, actionRequestEvents } from "../db/schema";
import { desc, eq, count, or, like } from "drizzle-orm";

export const aiCopyRefineRouter = router({
  /**
   * List copy refinement proposals
   */
  listCopyProposals: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { proposals: [], total: 0 };

      // Find action requests related to copy (messageType contains 'copy' or has AI_PROPOSE_COPY event)
      const proposals = await db
        .select()
        .from(actionRequests)
        .where(
          or(
            like(actionRequests.messageType, "%copy%"),
            like(actionRequests.messageType, "%COPY%")
          )
        )
        .orderBy(desc(actionRequests.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(actionRequests)
        .where(
          or(
            like(actionRequests.messageType, "%copy%"),
            like(actionRequests.messageType, "%COPY%")
          )
        );

      return { proposals, total: countResult?.total ?? 0 };
    }),

  /**
   * Get a single copy proposal with its events
   */
  getCopyProposal: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [proposal] = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      if (!proposal) return null;

      // Get copy-related events for this action request
      const events = await db
        .select()
        .from(actionRequestEvents)
        .where(eq(actionRequestEvents.actionRequestId, input.id))
        .orderBy(desc(actionRequestEvents.createdAt));

      return { ...proposal, events };
    }),

  /**
   * Approve and apply a copy proposal
   */
  approveCopy: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Update the action request status to "applied"
      await db
        .update(actionRequests)
        .set({
          status: "applied",
          appliedAt: new Date(),
        })
        .where(eq(actionRequests.id, input.id));

      // Get the intakeId for the event
      const [request] = await db
        .select({ intakeId: actionRequests.intakeId })
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      if (!request) throw new Error("Action request not found");

      // Add an ADMIN_APPLY event
      await db.insert(actionRequestEvents).values({
        actionRequestId: input.id,
        intakeId: request.intakeId,
        eventType: "ADMIN_APPLY",
        actorType: "admin",
        actorId: ctx.user?.id.toString() ?? "unknown",
        reason: input.reason ?? "Copy approved via admin interface",
        createdAt: new Date(),
      });

      return { success: true, id: input.id };
    }),
});
