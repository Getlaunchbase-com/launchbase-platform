/**
 * AI Copy Refine tRPC Router
 * 
 * Customer-facing endpoint for AI Tennis copy refinement.
 * Creates ActionRequests for approval workflow.
 */

import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { aiTennisCopyRefine } from "../actionRequests/aiTennisCopyRefine";

export const aiCopyRefineRouter = router({
  /**
   * Generate copy proposals using AI Tennis
   * 
   * POST /api/customer/ai/copy-refine
   */
  refine: publicProcedure
    .input(
      z.object({
        intakeId: z.number(),
        userText: z.string().min(1).max(1000),
        targetSection: z.string().optional(),
        currentCopy: z.record(z.string(), z.any()).optional(),
        constraints: z
          .object({
            maxRounds: z.number().min(1).max(6).optional(),
            costCapUsd: z.number().min(0).max(10).optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Add auth check (customer must own this intakeId)
      // TODO: Add rate limiting (per customer)
      // TODO: Add idempotency key support

      const result = await aiTennisCopyRefine(
        {
          tenant: "launchbase", // TODO: Get from auth context
          intakeId: input.intakeId,
          userText: input.userText,
          targetSection: input.targetSection,
          currentCopy: input.currentCopy,
          constraints: input.constraints,
        },
        process.env.AI_PROVIDER === "memory" ? "memory" : "aiml"
      );

      return {
        success: result.success,
        actionRequestIds: result.actionRequestIds,
        traceId: result.traceId,
        needsHuman: result.needsHuman,
        meta: {
          rounds: result.meta.rounds,
          estimatedUsd: result.meta.estimatedUsd,
          calls: result.meta.calls,
        },
        error: result.error,
      };
    }),

  /**
   * Get AI Tennis service health
   */
  health: publicProcedure.query(async () => {
    return {
      available: true,
      transport: process.env.AI_PROVIDER || "aiml",
    };
  }),
});
