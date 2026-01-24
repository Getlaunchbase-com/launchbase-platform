/**
 * Agent Runs tRPC Router
 * Phase 3A: API endpoints for agent execution UI
 */

import { z } from "zod";
import { adminProcedure, router } from "../../_core/trpc.js";
import {
  createAgentRun,
  getAgentRun,
  getAgentRunsByUser,
  updateAgentRunStatus,
  appendAgentEvent,
  getRunTimeline,
} from "../../db/agentRuns.js";
import { runOrchestrator, resumeAfterApproval } from "../../agent/orchestrator.js";

export const agentRunsRouter = router({
  /**
   * List recent agent runs (filterable by status)
   */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["running", "success", "failed", "awaiting_approval"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const runs = await getAgentRunsByUser(userId, input.limit);

      // Filter by status if provided
      if (input.status) {
        return runs.filter((r) => r.status === input.status);
      }

      return runs;
    }),

  /**
   * Get single run by ID
   */
  get: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const run = await getAgentRun(input.runId);
      if (!run) {
        throw new Error("Run not found");
      }
      return run;
    }),

  /**
   * Create and start a new agent run
   */
  create: adminProcedure
    .input(
      z.object({
        goal: z.string().min(1),
        model: z.string().optional().default("gpt-5.2"),
        maxSteps: z.number().optional().default(20),
        maxErrors: z.number().optional().default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Start orchestrator in background (non-blocking)
      const result = await runOrchestrator({
        userId,
        goal: input.goal,
        maxSteps: input.maxSteps,
        maxErrors: input.maxErrors,
      });

      return {
        runId: result.runId,
        status: result.status,
      };
    }),

  /**
   * Update run status (pause/resume/cancel)
   */
  updateStatus: adminProcedure
    .input(
      z.object({
        runId: z.number(),
        status: z.enum(["running", "success", "failed", "awaiting_approval"]),
        errorMessage: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await updateAgentRunStatus(input.runId, input.status, input.errorMessage);
      return { success: true };
    }),

  /**
   * Approve a pending action
   */
  approve: adminProcedure
    .input(
      z.object({
        runId: z.number(),
        approved: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const result = await resumeAfterApproval(input.runId, input.approved);
      return result;
    }),
});

export const agentEventsRouter = router({
  /**
   * List events for a run (timeline feed)
   */
  list: adminProcedure
    .input(
      z.object({
        runId: z.number(),
        limit: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      const events = await getRunTimeline(input.runId);

      // Return as DTO with serialized payload
      return events.slice(0, input.limit).map((e) => ({
        id: e.id,
        runId: e.runId,
        ts: e.ts.toISOString(),
        type: e.type,
        payload: e.payload,
      }));
    }),
});

export const agentArtifactsRouter = router({
  /**
   * List artifacts (filtered events)
   */
  list: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const events = await getRunTimeline(input.runId);

      // Filter to artifact-like events
      const artifactTypes = ["artifact", "tool_result"];
      const artifacts = events.filter((e) => artifactTypes.includes(e.type));

      return artifacts.map((e) => ({
        id: e.id,
        runId: e.runId,
        ts: e.ts.toISOString(),
        type: e.type,
        payload: e.payload,
      }));
    }),
});
