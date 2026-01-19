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
import { aiTennisCopyRefine } from "../actionRequests/aiTennisCopyRefine";
import { withIdempotency, hashUserText } from "../utils/idempotency";

// Response contract for AI Tennis copy proposal
const AiProposeCopyResponseSchema = z.object({
  ok: z.boolean(),
  createdActionRequestIds: z.array(z.number()).optional(),
  traceId: z.string().optional(),
  needsHuman: z.boolean().optional(),
  stopReason: z.enum([
    "ok",
    "token_cap",
    "cost_cap",
    "round_cap",
    "stop_condition_met",
    "json_parse_failed",
    "ajv_failed",
    "router_failed",
    "provider_failed",
    "needs_human",
    "in_progress", // Idempotency: operation already running
    "unknown",
  ]).optional(),
  meta: z.object({
    version: z.string().optional(),
    buildSha: z.string().optional(),
  }).optional(),
});

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
        proposedPreviewToken: request.proposedPreviewToken || undefined,
        checklistKey: request.checklistKey,
      });

      if (result.success) {
        // Update sendCount and lastSentAt
        await db.update(actionRequests).set({
          sendCount: request.sendCount + 1,
          lastSentAt: new Date(),
        }).where(eq(actionRequests.id, input.id));
        
        // Log resend event with Resend message ID
        await logActionEvent({
          actionRequestId: request.id,
          intakeId: request.intakeId,
          eventType: "RESENT",
          actorType: "admin",
          reason: "Manual resend from admin panel",
          meta: {
            resendMessageId: result.resendMessageId,
            to: intake.email,
            provider: result.provider,
          },
        });
      }

      return { ok: true, success: result.success, error: result.error, ...getSystemMeta() };
    }),

  /**
   * AI Tennis copy proposal generation
   * Calls AI Tennis service to generate copy proposals for an action request
   * 
   * Idempotency: Prevents duplicate AI calls on retry (double clicks, refreshes, timeouts)
   */
  aiProposeCopy: publicProcedure
    .input(z.object({
      id: z.number(),
      userText: z.string().min(1),
      targetSection: z.string().optional(),
      currentCopy: z.record(z.string(), z.any()).optional(),
      constraints: z.object({
        maxRounds: z.number().int().min(1).max(6).optional(),
        costCapUsd: z.number().min(0).max(10).optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // 1) Load ActionRequest
      const [request] = await db
        .select()
        .from(actionRequests)
        .where(eq(actionRequests.id, input.id))
        .limit(1);

      if (!request) throw new Error("Action request not found");

      // 2) Load Intake (tenant + email)
      const [intake] = await db
        .select()
        .from(intakes)
        .where(eq(intakes.id, request.intakeId))
        .limit(1);

      if (!intake) throw new Error("Intake not found");

      // 3) Wrap AI Tennis call with idempotency protection
      const transport =
        process.env.AI_PROVIDER === "memory" || process.env.AI_PROVIDER === "log"
          ? (process.env.AI_PROVIDER as "memory" | "log")
          : ("aiml" as const);

      const idempotencyResult = await withIdempotency({
        tenant: intake.tenant,
        scope: "actionRequests.aiProposeCopy",
        inputs: {
          intakeId: request.intakeId,
          actionRequestId: input.id,
          userTextHash: hashUserText(input.userText), // SECURITY: Never include raw text
          targetSection: input.targetSection,
          constraints: input.constraints,
        },
        ttlHours: 24,
        operation: async () => {
          // Run AI Tennis service
          const service = await aiTennisCopyRefine(
            {
              tenant: intake.tenant as any,
              intakeId: request.intakeId,
              userText: input.userText,
              targetSection: input.targetSection,
              currentCopy: input.currentCopy,
              constraints: input.constraints,
            },
            transport
          );

          // Map service result to response contract
          const stopReason = service.stopReason;
          const needsHuman = service.success ? false : (service.needsHuman ?? false);

          // Log event on the original ActionRequest (customer-safe meta only)
          await logActionEvent({
            actionRequestId: request.id,
            intakeId: request.intakeId,
            eventType: "AI_PROPOSE_COPY",
            actorType: "system",
            reason: "AI Tennis copy proposal requested",
            meta: {
              ok: service.success,
              createdActionRequestIds: service.success ? [service.actionRequestId] : [],
              traceId: service.traceId,
              needsHuman,
              stopReason,
            },
          });

          // Return strict, customer-safe contract
          return AiProposeCopyResponseSchema.parse({
            ok: service.success,
            createdActionRequestIds: service.success ? [service.actionRequestId] : [],
            traceId: service.traceId,
            needsHuman,
            stopReason,
            meta: getSystemMeta(),
          });
        },
      });

      // 4) Handle idempotency result (no throws, return safe contract)
      if (idempotencyResult.status === "in_progress") {
        return AiProposeCopyResponseSchema.parse({
          ok: false,
          stopReason: "in_progress",
          traceId: undefined,
          needsHuman: false,
          meta: getSystemMeta(),
        });
      }

      if (idempotencyResult.status === "failed") {
        return AiProposeCopyResponseSchema.parse({
          ok: false,
          stopReason: "provider_failed",
          traceId: undefined,
          needsHuman: true,
          meta: getSystemMeta(),
        });
      }

      // Return cached or fresh result (succeeded)
      return idempotencyResult.data;
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
   * Batch approve multiple action requests at once
   * Reduces friction when customer trusts multiple proposals
   */
  batchApprove: publicProcedure
    .input(z.object({
      ids: z.array(z.number()).min(1, "At least one ID required"),
      reason: z.string().min(1, "Reason is required"),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }
      
      const results: Array<{ id: number; success: boolean; error?: string }> = [];
      
      // Process each request sequentially (transaction-like)
      for (const id of input.ids) {
        try {
          // Load action request
          const [request] = await db
            .select()
            .from(actionRequests)
            .where(eq(actionRequests.id, id))
            .limit(1);

          if (!request) {
            results.push({ id, success: false, error: "Not found" });
            continue;
          }
          
          // Skip if already locked
          if (request.status === "locked") {
            results.push({ id, success: false, error: "Already locked" });
            continue;
          }

          // Update to responded status
          await db.update(actionRequests).set({
            status: "responded",
            respondedAt: new Date(),
            replyChannel: "link",
            confidence: 1.0, // Admin batch approval = 100% confidence
            rawInbound: { method: "batch_admin_approve" } as any,
          }).where(eq(actionRequests.id, id));
          
          // Log admin apply event
          await logActionEvent({
            actionRequestId: request.id,
            intakeId: request.intakeId,
            eventType: "ADMIN_APPLY",
            actorType: "admin",
            reason: `Batch approval: ${input.reason}`,
            meta: {
              batchSize: input.ids.length,
              batchIds: input.ids,
            },
          });

          // Apply through same path as bot
          const { applyActionRequest, confirmAndLockActionRequest } = await import("../action-requests");
          const result = await applyActionRequest(id);

          if (result.success) {
            await confirmAndLockActionRequest(id);
            results.push({ id, success: true });
          } else {
            results.push({ id, success: false, error: result.error });
          }
        } catch (err: any) {
          results.push({ id, success: false, error: err.message || "Unknown error" });
        }
      }
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;
      
      return { 
        ok: true,
        results,
        summary: {
          total: input.ids.length,
          success: successCount,
          failed: failureCount,
        },
        ...getSystemMeta() 
      };
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
