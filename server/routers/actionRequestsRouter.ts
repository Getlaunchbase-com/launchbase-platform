/**
 * Action Requests tRPC Router
 * Admin panel visibility for Ask → Understand → Apply → Confirm loop
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { actionRequests, intakes } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendActionRequestEmail } from "../email";

export const actionRequestsRouter = router({
  /**
   * List all action requests for an intake
   */
  listByIntake: publicProcedure
    .input(z.object({ intakeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const requests = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.intakeId, input.intakeId))
        .orderBy(desc(actionRequests.createdAt));

      return requests;
    }),

  /**
   * Get action request details
   */
  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const [request] = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      return request || null;
    }),

  /**
   * Resend an action request email
   */
  resend: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Load action request
      const [request] = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      if (!request) {
        throw new Error("Action request not found");
      }

      // Load intake
      const [intake] = await db
        .select()
        .from(intakes)
        .where(eq(intakes.id, request.intakeId))
        .limit(1);

      if (!intake) {
        throw new Error("Intake not found");
      }

      // Resend email
      const result = await sendActionRequestEmail({
        to: intake.email,
        businessName: intake.businessName,
        firstName: intake.contactName.split(" ")[0],
        questionText: `Re: ${request.checklistKey}`,
        proposedValue: typeof request.proposedValue === "string" 
          ? request.proposedValue 
          : JSON.stringify(request.proposedValue),
        token: request.token,
        checklistKey: request.checklistKey,
      });

      if (result.success) {
        // Update sentAt
        await db.update(actionRequests).set({
          sentAt: new Date(),
        }).where(eq(actionRequests.id, input.id));
      }

      return { success: result.success, error: result.error };
    }),

  /**
   * Override and manually apply an action request
   */
  overrideApply: publicProcedure
    .input(z.object({ 
      id: z.number(),
      proposedValue: z.unknown(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Update proposed value
      await db.update(actionRequests).set({
        proposedValue: input.proposedValue as any,
        status: "responded",
        respondedAt: new Date(),
        replyChannel: "link",
        confidence: 1.0, // Admin override = 100% confidence
        rawInbound: { method: "admin_override" } as any,
      }).where(eq(actionRequests.id, input.id));

      // Apply
      const { applyActionRequest, confirmAndLockActionRequest } = await import("../action-requests");
      const result = await applyActionRequest(input.id);

      if (result.success) {
        await confirmAndLockActionRequest(input.id);
      }

      return { success: result.success, error: result.error };
    }),

  /**
   * Mark action request as resolved (human handled it manually)
   */
  markResolved: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      await db.update(actionRequests).set({
        status: "locked",
      }).where(eq(actionRequests.id, input.id));

      return { success: true };
    }),

  /**
   * Get summary stats for an intake
   */
  getStats: publicProcedure
    .input(z.object({ intakeId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      const requests = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.intakeId, input.intakeId));

      const stats = {
        total: requests.length,
        pending: requests.filter(r => r.status === "pending" || r.status === "sent").length,
        needsHuman: requests.filter(r => r.status === "needs_human").length,
        locked: requests.filter(r => r.status === "locked").length,
        responded: requests.filter(r => r.status === "responded").length,
      };

      return stats;
    }),
});
