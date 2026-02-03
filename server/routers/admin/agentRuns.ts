import { router, adminProcedure } from "../../_core/trpc";
import { z } from "zod";

export const agentRunsRouter = router({
  create: adminProcedure
    .input(z.object({
      goal: z.string(),
      model: z.string().optional(),
      maxSteps: z.number().optional(),
      maxErrors: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // Generate a unique run ID
      const runId = `run_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      // In a real implementation, this would create an agent run
      // For now, return the runId so the UI can poll for events
      return { runId };
    }),

  list: adminProcedure.query(async () => {
    return [];
  }),
});

export const agentEventsRouter = router({
  list: adminProcedure
    .input(z.object({
      runId: z.string(),
      limit: z.number().optional(),
    }))
    .query(async ({ input }) => {
      // In a real implementation, this would fetch events for a run
      // For now, return an empty array
      return [];
    }),
});

export const agentArtifactsRouter = router({
  list: adminProcedure.query(async () => {
    return [];
  }),
});
