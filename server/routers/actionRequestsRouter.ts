/**
 * Action Requests tRPC Router
 * Admin panel visibility for Ask → Understand → Apply → Confirm loop
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { getSystemMeta } from "../_core/version";
import { actionRequests, intakes } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { sendActionRequestEmail } from "../email";
import { logActionEvent } from "../action-request-events";

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
   * Resend an action request email (with 10-minute rate limit)
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
      
      // Safety: Only allow resend if status is pending
      if (request.status !== "pending") {
        return { 
          ok: false, 
          code: "invalid_status", 
          message: "Can only resend pending requests" 
        };
      }
      
      // Rate limit: 10 minutes minimum between sends
      if (request.lastSentAt) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        if (request.lastSentAt > tenMinutesAgo) {
          const retryAt = new Date(request.lastSentAt.getTime() + 10 * 60 * 1000);
          return { 
            ok: false, 
            code: "rate_limited", 
            message: "Must wait 10 minutes between sends",
            retryAt: retryAt.toISOString(),
            ...getSystemMeta(),
          };
        }
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
        // Update sendCount and lastSentAt
        await db.update(actionRequests).set({
          sendCount: request.sendCount + 1,
          lastSentAt: new Date(),
        }).where(eq(actionRequests.id, input.id));
        
        // Log resend event
        await logActionEvent({
          actionRequestId: request.id,
          intakeId: request.intakeId,
          eventType: "RESENT",
          actorType: "admin",
          reason: "Manual resend from admin panel",
        });
      }

      return { ok: true, success: result.success, error: result.error, ...getSystemMeta() };
    }),

  /**
   * Admin manually apply an action request (renamed from overrideApply)
   */
  adminApply: publicProcedure
    .input(z.object({ 
      id: z.number(),
      finalValue: z.unknown(),
      reason: z.string().min(1, "Reason is required"),
    }))
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

      // Update proposed value
      await db.update(actionRequests).set({
        proposedValue: input.finalValue as any,
        status: "responded",
        respondedAt: new Date(),
        replyChannel: "link",
        confidence: 1.0, // Admin override = 100% confidence
        rawInbound: { method: "admin_override" } as any,
      }).where(eq(actionRequests.id, input.id));
      
      // Log admin apply event
      await logActionEvent({
        actionRequestId: request.id,
        intakeId: request.intakeId,
        eventType: "ADMIN_APPLY",
        actorType: "admin",
        reason: input.reason,
        meta: {
          finalValue: input.finalValue,
        },
      });

      // Apply through same path as bot
      const { applyActionRequest, confirmAndLockActionRequest } = await import("../action-requests");
      const result = await applyActionRequest(input.id);

      if (result.success) {
        await confirmAndLockActionRequest(input.id);
      }

      return { success: result.success, error: result.error, ...getSystemMeta() };
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
   * Expire an action request (admin decision to not pursue)
   */
  expire: publicProcedure
    .input(z.object({ 
      id: z.number(),
      reason: z.string().min(1, "Reason is required"),
    }))
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
      
      // Safety: Only allow expire from pending or needs_human
      if (request.status !== "pending" && request.status !== "needs_human") {
        return { 
          ok: false, 
          message: "Can only expire pending or needs_human requests" 
        };
      }

      // Mark as expired
      await db.update(actionRequests).set({
        status: "expired",
      }).where(eq(actionRequests.id, input.id));
      
      // Log expire event
      await logActionEvent({
        actionRequestId: request.id,
        intakeId: request.intakeId,
        eventType: "ADMIN_EXPIRE",
        actorType: "admin",
        reason: input.reason,
      });

      return { ok: true, ...getSystemMeta() };
    }),
  
  /**
   * Unlock an action request (allow re-processing)
   */
  unlock: publicProcedure
    .input(z.object({ 
      id: z.number(),
      reason: z.string().min(1, "Reason is required"),
    }))
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
      
      // Safety: Only allow unlock from locked or applied
      if (request.status !== "locked" && request.status !== "applied") {
        return { 
          ok: false, 
          message: "Can only unlock locked or applied requests" 
        };
      }

      // Mark as needs_human (safer than pending - forces human review before re-asking)
      await db.update(actionRequests).set({
        status: "needs_human",
      }).where(eq(actionRequests.id, input.id));
      
      // Log unlock event
      await logActionEvent({
        actionRequestId: request.id,
        intakeId: request.intakeId,
        eventType: "ADMIN_UNLOCK",
        actorType: "admin",
        reason: input.reason,
      });

      return { ok: true, ...getSystemMeta() };
    }),

  /**
   * Get recent events for an action request
   */
  getEvents: publicProcedure
    .input(z.object({ actionRequestId: z.number(), limit: z.number().optional().default(5) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      const { actionRequestEvents } = await import("../../drizzle/schema");
      
      const events = await db
        .select()
        .from(actionRequestEvents)
        .where(eq(actionRequestEvents.actionRequestId, input.actionRequestId))
        .orderBy(desc(actionRequestEvents.createdAt))
        .limit(input.limit);

      return events;
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
