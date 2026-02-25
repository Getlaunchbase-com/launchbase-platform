/**
 * Pipeline Approvals — tRPC Router
 *
 * Admin CRUD for the tier-gated approval system.
 * Provides endpoints to:
 *   - List pending/resolved approvals
 *   - Approve or deny a pending request
 *   - Request approval for a gated operation
 *   - View approval policy for any operation
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import { pipelineApprovals } from "../../db/schema";
import { desc, eq, and, count } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  requestApproval,
  resolveApproval,
  getOperationTier,
  type OperationType,
} from "../../services/approvalEngine";

const operationEnum = z.enum([
  "blueprint.runPipeline",
  "blueprint.deletDocument",
  "estimate.runChain",
  "swarm.dispatch",
  "contract.freezeOverride",
  "artifact.delete",
  "admin.dataExport",
]);

export const pipelineApprovalsRouter = router({
  /** List approvals with optional status filter */
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(["pending", "approved", "denied", "expired"]).optional(),
        operation: operationEnum.optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { approvals: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(pipelineApprovals.status, input.status));
      if (input.operation) conditions.push(eq(pipelineApprovals.operation, input.operation));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(pipelineApprovals)
        .where(where)
        .orderBy(desc(pipelineApprovals.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(pipelineApprovals)
        .where(where);

      return { approvals: rows, total: countResult?.total ?? 0 };
    }),

  /** Request approval for a gated operation */
  request: adminProcedure
    .input(
      z.object({
        operation: operationEnum,
        resourceType: z.string().min(1).max(128),
        resourceId: z.number().int(),
        reason: z.string().min(1).max(1000),
        metadata: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = (ctx as any).user?.id ?? 0;
      return requestApproval({
        operation: input.operation as OperationType,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        requestedBy: userId,
        reason: input.reason,
        metadata: input.metadata,
      });
    }),

  /** Approve or deny a pending approval */
  resolve: adminProcedure
    .input(
      z.object({
        approvalId: z.number().int(),
        decision: z.enum(["approved", "denied"]),
        notes: z.string().max(1000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const userId = (ctx as any).user?.id ?? 0;
      await resolveApproval(input.approvalId, input.decision, userId, input.notes);
      return { success: true, decision: input.decision };
    }),

  /** Get policy info for an operation */
  getPolicy: adminProcedure
    .input(z.object({ operation: operationEnum }))
    .query(({ input }) => {
      return getOperationTier(input.operation as OperationType);
    }),
});
