/**
 * Feedback-driven Improvement Loop — tRPC Router
 *
 * Admin-only endpoints for the feedback → swarm → improvement cycle:
 *   1. CRUD for agent_feedback items (logged from Operator OS, mobile, API)
 *   2. Cluster & report: weekly swarm playbook that groups feedback and proposes patches
 *   3. Promotion gate: review/approve/reject/apply proposed improvements
 *
 * All procedures use adminProcedure — requires authenticated admin role.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  agentFeedback,
  feedbackImprovementProposals,
  agentInstances,
  swarmRuns,
  vertexProfiles,
  users,
} from "../../db/schema";
import { desc, eq, and, gte, sql, count, inArray, isNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Zod schemas shared across procedures
// ---------------------------------------------------------------------------

const feedbackCategoryEnum = z.enum([
  "wrong_output",
  "slow_response",
  "missing_capability",
  "config_issue",
  "tone_style",
  "hallucination",
  "other",
]);

const feedbackSeverityEnum = z.enum(["low", "medium", "high", "critical"]);

const feedbackStatusEnum = z.enum([
  "open",
  "triaged",
  "in_review",
  "resolved",
  "wont_fix",
]);

const proposalStatusEnum = z.enum([
  "proposed",
  "under_review",
  "approved",
  "rejected",
  "applied",
  "rolled_back",
]);

// ---------------------------------------------------------------------------
// Feedback Router
// ---------------------------------------------------------------------------

export const feedbackRouter = router({
  // =========================================================================
  // 1. Feedback CRUD
  // =========================================================================

  /** Create a feedback item (from Operator OS) */
  create: adminProcedure
    .input(
      z.object({
        instanceId: z.number().int(),
        runId: z.number().int().optional(),
        projectId: z.number().int(),
        message: z.string().min(1).max(4000),
        category: feedbackCategoryEnum,
        severity: feedbackSeverityEnum.default("medium"),
        source: z.enum(["operator_os", "mobile", "api"]).default("operator_os"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;

      const [result] = await db.insert(agentFeedback).values({
        instanceId: input.instanceId,
        runId: input.runId ?? null,
        projectId: input.projectId,
        submittedBy: userId,
        source: input.source,
        message: input.message,
        category: input.category,
        severity: input.severity,
        status: "open",
      });

      return { feedbackId: result.insertId };
    }),

  /** List feedback items with filters */
  list: adminProcedure
    .input(
      z.object({
        instanceId: z.number().int().optional(),
        projectId: z.number().int().optional(),
        runId: z.number().int().optional(),
        status: feedbackStatusEnum.optional(),
        severity: feedbackSeverityEnum.optional(),
        category: feedbackCategoryEnum.optional(),
        limit: z.number().int().min(1).max(200).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const conditions: any[] = [];
      if (input.instanceId) conditions.push(eq(agentFeedback.instanceId, input.instanceId));
      if (input.projectId) conditions.push(eq(agentFeedback.projectId, input.projectId));
      if (input.runId) conditions.push(eq(agentFeedback.runId, input.runId));
      if (input.status) conditions.push(eq(agentFeedback.status, input.status));
      if (input.severity) conditions.push(eq(agentFeedback.severity, input.severity));
      if (input.category) conditions.push(eq(agentFeedback.category, input.category));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select({
          id: agentFeedback.id,
          instanceId: agentFeedback.instanceId,
          runId: agentFeedback.runId,
          projectId: agentFeedback.projectId,
          submittedBy: agentFeedback.submittedBy,
          source: agentFeedback.source,
          message: agentFeedback.message,
          category: agentFeedback.category,
          severity: agentFeedback.severity,
          status: agentFeedback.status,
          createdAt: agentFeedback.createdAt,
          updatedAt: agentFeedback.updatedAt,
          submitterName: users.name,
        })
        .from(agentFeedback)
        .leftJoin(users, eq(agentFeedback.submittedBy, users.id))
        .where(where)
        .orderBy(desc(agentFeedback.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentFeedback)
        .where(where);

      return { items: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single feedback item by ID */
  getById: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select({
          id: agentFeedback.id,
          instanceId: agentFeedback.instanceId,
          runId: agentFeedback.runId,
          projectId: agentFeedback.projectId,
          submittedBy: agentFeedback.submittedBy,
          source: agentFeedback.source,
          message: agentFeedback.message,
          category: agentFeedback.category,
          severity: agentFeedback.severity,
          status: agentFeedback.status,
          resolvedAt: agentFeedback.resolvedAt,
          resolvedBy: agentFeedback.resolvedBy,
          createdAt: agentFeedback.createdAt,
          updatedAt: agentFeedback.updatedAt,
          submitterName: users.name,
          instanceName: agentInstances.displayName,
        })
        .from(agentFeedback)
        .leftJoin(users, eq(agentFeedback.submittedBy, users.id))
        .leftJoin(agentInstances, eq(agentFeedback.instanceId, agentInstances.id))
        .where(eq(agentFeedback.id, input.id))
        .limit(1);

      return row ?? null;
    }),

  /** Update feedback status (triage, resolve, etc.) */
  updateStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: feedbackStatusEnum,
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;
      const updates: Record<string, unknown> = { status: input.status };

      if (input.status === "resolved" || input.status === "wont_fix") {
        updates.resolvedAt = new Date();
        updates.resolvedBy = userId;
      }

      await db
        .update(agentFeedback)
        .set(updates)
        .where(eq(agentFeedback.id, input.id));

      return { success: true, id: input.id, status: input.status };
    }),

  /** Dashboard summary: counts by status, severity, category */
  summary: adminProcedure
    .input(
      z.object({
        projectId: z.number().int().optional(),
        instanceId: z.number().int().optional(),
        sinceDaysAgo: z.number().int().min(1).max(90).default(7),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { byStatus: [], bySeverity: [], byCategory: [], total: 0 };

      const sinceDate = new Date(Date.now() - input.sinceDaysAgo * 24 * 60 * 60 * 1000);
      const conditions: any[] = [gte(agentFeedback.createdAt, sinceDate)];
      if (input.projectId) conditions.push(eq(agentFeedback.projectId, input.projectId));
      if (input.instanceId) conditions.push(eq(agentFeedback.instanceId, input.instanceId));

      const where = and(...conditions);

      const [byStatus, bySeverity, byCategory] = await Promise.all([
        db
          .select({ status: agentFeedback.status, count: count() })
          .from(agentFeedback)
          .where(where)
          .groupBy(agentFeedback.status),
        db
          .select({ severity: agentFeedback.severity, count: count() })
          .from(agentFeedback)
          .where(where)
          .groupBy(agentFeedback.severity),
        db
          .select({ category: agentFeedback.category, count: count() })
          .from(agentFeedback)
          .where(where)
          .groupBy(agentFeedback.category),
      ]);

      const total = byStatus.reduce((sum, r) => sum + (r.count as number), 0);
      return { byStatus, bySeverity, byCategory, total };
    }),

  // =========================================================================
  // 2. Swarm Improvement Playbook — cluster feedback → propose changes
  // =========================================================================

  /**
   * Trigger the weekly improvement swarm.
   * Clusters open/triaged feedback, generates improvement proposals,
   * and stores them with status "proposed" for review.
   */
  triggerImprovementSwarm: adminProcedure
    .input(
      z.object({
        // Scope: which feedback to include
        projectId: z.number().int().optional(),
        instanceId: z.number().int().optional(),
        sinceDaysAgo: z.number().int().min(1).max(90).default(7),
        // Only process these statuses
        includeStatuses: z
          .array(feedbackStatusEnum)
          .default(["open", "triaged"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;
      const sinceDate = new Date(Date.now() - input.sinceDaysAgo * 24 * 60 * 60 * 1000);

      // 1. Gather feedback items in scope
      const conditions: any[] = [
        gte(agentFeedback.createdAt, sinceDate),
        inArray(agentFeedback.status, input.includeStatuses),
      ];
      if (input.projectId) conditions.push(eq(agentFeedback.projectId, input.projectId));
      if (input.instanceId) conditions.push(eq(agentFeedback.instanceId, input.instanceId));

      const feedbackItems = await db
        .select()
        .from(agentFeedback)
        .where(and(...conditions))
        .orderBy(desc(agentFeedback.createdAt))
        .limit(500); // cap to prevent oversize payloads

      if (feedbackItems.length === 0) {
        return { swarmRunId: null, message: "No feedback items in scope", proposalCount: 0 };
      }

      // 2. Create a swarm run to track this improvement analysis
      const [swarmResult] = await db.insert(swarmRuns).values({
        repairId: `feedback-improvement-${Date.now()}`,
        status: "running",
        model: "gpt-4o",
        promptTokens: 0,
        completionTokens: 0,
        costUsd: "0",
        latencyMs: 0,
      });

      const swarmRunId = swarmResult.insertId;

      // 3. Cluster feedback by category + severity
      const clusters = new Map<string, typeof feedbackItems>();
      for (const item of feedbackItems) {
        const key = `${item.category}__${item.severity}`;
        if (!clusters.has(key)) clusters.set(key, []);
        clusters.get(key)!.push(item);
      }

      // 4. Generate proposals per cluster
      const proposals: Array<{
        title: string;
        description: string;
        changeType: "config_update" | "prompt_edit" | "tool_change" | "code_patch" | "workflow_change";
        feedbackIds: number[];
        clusterSummary: { totalItems: number; topCategories: string[]; severityBreakdown: Record<string, number> };
        targetInstanceId: number | null;
        targetProjectId: number | null;
      }> = [];

      // Map category → likely change type
      const categoryToChangeType: Record<string, "config_update" | "prompt_edit" | "tool_change" | "code_patch" | "workflow_change"> = {
        wrong_output: "prompt_edit",
        slow_response: "config_update",
        missing_capability: "tool_change",
        config_issue: "config_update",
        tone_style: "prompt_edit",
        hallucination: "prompt_edit",
        other: "workflow_change",
      };

      for (const [key, items] of clusters) {
        const [category, severity] = key.split("__");
        const feedbackIds = items.map((i) => i.id);

        // Build severity breakdown for this cluster
        const severityBreakdown: Record<string, number> = {};
        for (const item of items) {
          severityBreakdown[item.severity] = (severityBreakdown[item.severity] ?? 0) + 1;
        }

        // Summarize the feedback messages for the proposal description
        const sampleMessages = items.slice(0, 5).map((i) => `- ${i.message}`).join("\n");
        const moreCount = items.length > 5 ? `\n... and ${items.length - 5} more items` : "";

        proposals.push({
          title: `[${severity.toUpperCase()}] ${category.replace(/_/g, " ")} — ${items.length} report(s)`,
          description:
            `Cluster of ${items.length} feedback item(s) in category "${category}" ` +
            `with severity "${severity}".\n\nSample reports:\n${sampleMessages}${moreCount}\n\n` +
            `Recommended action: review and apply a ${categoryToChangeType[category] ?? "workflow_change"} ` +
            `to address these issues.`,
          changeType: categoryToChangeType[category] ?? "workflow_change",
          feedbackIds,
          clusterSummary: {
            totalItems: items.length,
            topCategories: [category],
            severityBreakdown,
          },
          targetInstanceId: input.instanceId ?? null,
          targetProjectId: input.projectId ?? null,
        });
      }

      // 5. Insert proposals into the database
      if (proposals.length > 0) {
        await db.insert(feedbackImprovementProposals).values(
          proposals.map((p) => ({
            swarmRunId,
            title: p.title,
            description: p.description,
            changeType: p.changeType,
            patchPayload: null,
            feedbackIds: p.feedbackIds,
            clusterSummary: p.clusterSummary,
            status: "proposed" as const,
            targetInstanceId: p.targetInstanceId,
            targetProjectId: p.targetProjectId,
          }))
        );
      }

      // 6. Mark the feedback items as "triaged" so they aren't re-processed
      await db
        .update(agentFeedback)
        .set({ status: "triaged" })
        .where(
          and(
            inArray(
              agentFeedback.id,
              feedbackItems.map((i) => i.id)
            ),
            eq(agentFeedback.status, "open")
          )
        );

      // 7. Mark swarm run as completed
      await db
        .update(swarmRuns)
        .set({ status: "completed" })
        .where(eq(swarmRuns.id, swarmRunId));

      return {
        swarmRunId,
        feedbackProcessed: feedbackItems.length,
        proposalCount: proposals.length,
        clusterCount: clusters.size,
      };
    }),

  // =========================================================================
  // 3. Improvement Proposals — list, review, approve, apply
  // =========================================================================

  /** List improvement proposals */
  listProposals: adminProcedure
    .input(
      z.object({
        status: proposalStatusEnum.optional(),
        swarmRunId: z.number().int().optional(),
        changeType: z.enum(["config_update", "prompt_edit", "tool_change", "code_patch", "workflow_change"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { proposals: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(feedbackImprovementProposals.status, input.status));
      if (input.swarmRunId) conditions.push(eq(feedbackImprovementProposals.swarmRunId, input.swarmRunId));
      if (input.changeType) conditions.push(eq(feedbackImprovementProposals.changeType, input.changeType));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(feedbackImprovementProposals)
        .where(where)
        .orderBy(desc(feedbackImprovementProposals.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(feedbackImprovementProposals)
        .where(where);

      return { proposals: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single proposal by ID */
  getProposal: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(feedbackImprovementProposals)
        .where(eq(feedbackImprovementProposals.id, input.id))
        .limit(1);

      if (!row) return null;

      // Also fetch the related feedback items
      const relatedFeedback = row.feedbackIds && (row.feedbackIds as number[]).length > 0
        ? await db
            .select()
            .from(agentFeedback)
            .where(inArray(agentFeedback.id, row.feedbackIds as number[]))
        : [];

      return { ...row, relatedFeedback };
    }),

  /**
   * Review a proposal — approve or reject.
   * This is the PROMOTION GATE: no proposal can be applied without review.
   */
  reviewProposal: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        decision: z.enum(["approved", "rejected"]),
        reviewNote: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;

      // Verify proposal exists and is in reviewable state
      const [proposal] = await db
        .select()
        .from(feedbackImprovementProposals)
        .where(eq(feedbackImprovementProposals.id, input.id))
        .limit(1);

      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "proposed" && proposal.status !== "under_review") {
        throw new Error(`Cannot review proposal in status "${proposal.status}"`);
      }

      await db
        .update(feedbackImprovementProposals)
        .set({
          status: input.decision,
          reviewedBy: userId,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote ?? null,
        })
        .where(eq(feedbackImprovementProposals.id, input.id));

      // If rejected, mark related feedback as resolved/wont_fix
      if (input.decision === "rejected" && proposal.feedbackIds) {
        await db
          .update(agentFeedback)
          .set({ status: "wont_fix", resolvedAt: new Date(), resolvedBy: userId })
          .where(inArray(agentFeedback.id, proposal.feedbackIds as number[]));
      }

      return { success: true, id: input.id, status: input.decision };
    }),

  /**
   * Apply an approved proposal.
   * Only proposals with status "approved" can be applied.
   * Marks feedback items as resolved upon successful application.
   */
  applyProposal: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;

      // Verify proposal exists and is approved
      const [proposal] = await db
        .select()
        .from(feedbackImprovementProposals)
        .where(eq(feedbackImprovementProposals.id, input.id))
        .limit(1);

      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "approved") {
        throw new Error(
          `Cannot apply proposal in status "${proposal.status}". ` +
          `Only "approved" proposals can be applied. This is the promotion gate.`
        );
      }

      // Mark as applied
      await db
        .update(feedbackImprovementProposals)
        .set({
          status: "applied",
          appliedAt: new Date(),
          appliedBy: userId,
        })
        .where(eq(feedbackImprovementProposals.id, input.id));

      // Mark related feedback items as resolved
      if (proposal.feedbackIds && (proposal.feedbackIds as number[]).length > 0) {
        await db
          .update(agentFeedback)
          .set({ status: "resolved", resolvedAt: new Date(), resolvedBy: userId })
          .where(inArray(agentFeedback.id, proposal.feedbackIds as number[]));
      }

      return {
        success: true,
        id: input.id,
        status: "applied",
        changeType: proposal.changeType,
        patchPayload: proposal.patchPayload,
      };
    }),

  /**
   * Roll back a previously applied proposal.
   */
  rollbackProposal: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        reason: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const userId = (ctx as any).user?.id ?? 0;

      const [proposal] = await db
        .select()
        .from(feedbackImprovementProposals)
        .where(eq(feedbackImprovementProposals.id, input.id))
        .limit(1);

      if (!proposal) throw new Error("Proposal not found");
      if (proposal.status !== "applied") {
        throw new Error(`Cannot roll back proposal in status "${proposal.status}"`);
      }

      await db
        .update(feedbackImprovementProposals)
        .set({
          status: "rolled_back",
          reviewNote: input.reason
            ? `${proposal.reviewNote ?? ""}\n[ROLLBACK] ${input.reason}`.trim()
            : proposal.reviewNote,
        })
        .where(eq(feedbackImprovementProposals.id, input.id));

      // Re-open related feedback items for re-processing
      if (proposal.feedbackIds && (proposal.feedbackIds as number[]).length > 0) {
        await db
          .update(agentFeedback)
          .set({ status: "open", resolvedAt: null, resolvedBy: null })
          .where(inArray(agentFeedback.id, proposal.feedbackIds as number[]));
      }

      return { success: true, id: input.id, status: "rolled_back" };
    }),

  /** Proposals dashboard: counts by status + recent proposals */
  proposalsSummary: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { byStatus: [], recentProposed: [], total: 0 };

    const byStatus = await db
      .select({
        status: feedbackImprovementProposals.status,
        count: count(),
      })
      .from(feedbackImprovementProposals)
      .groupBy(feedbackImprovementProposals.status);

    const recentProposed = await db
      .select()
      .from(feedbackImprovementProposals)
      .where(eq(feedbackImprovementProposals.status, "proposed"))
      .orderBy(desc(feedbackImprovementProposals.createdAt))
      .limit(10);

    const total = byStatus.reduce((sum, r) => sum + (r.count as number), 0);
    return { byStatus, recentProposed, total };
  }),
});

export type FeedbackRouter = typeof feedbackRouter;
