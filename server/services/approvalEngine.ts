/**
 * Tier-Gated Approval Enforcement Engine
 *
 * Enterprise governance: certain operations require explicit approval
 * before execution. This module provides:
 *
 *   1. Tier classification — categorize operations by risk/cost
 *   2. Approval gate — block execution until approval is recorded
 *   3. Durable approval store — persist approvals in DB (survives restarts)
 *   4. Policy enforcement — reject unapproved operations at dispatch time
 *
 * Tiers:
 *   tier_0 (auto)    — No approval needed (queries, status checks)
 *   tier_1 (notify)  — Approval not required, but admin is notified
 *   tier_2 (approve) — Requires explicit admin approval before execution
 *   tier_3 (dual)    — Requires two independent approvals (future)
 *
 * Integration points:
 *   - Blueprint pipeline: runPipeline → tier_1
 *   - Estimate chain:     runEstimateChain → tier_1
 *   - Swarm dispatch:     agent runs → tier_2
 *   - Contract changes:   freeze overrides → tier_2
 *   - Data deletion:      artifact/document deletion → tier_2
 */

import { getDb } from "../../db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  pipelineApprovals,
} from "../../db/schema";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Tier definitions
// ---------------------------------------------------------------------------

export type ApprovalTier = "tier_0" | "tier_1" | "tier_2" | "tier_3";

export interface TierPolicy {
  tier: ApprovalTier;
  requiresApproval: boolean;
  requiresDualApproval: boolean;
  notifyAdmin: boolean;
  description: string;
}

const TIER_POLICIES: Record<ApprovalTier, TierPolicy> = {
  tier_0: {
    tier: "tier_0",
    requiresApproval: false,
    requiresDualApproval: false,
    notifyAdmin: false,
    description: "Auto — no approval needed",
  },
  tier_1: {
    tier: "tier_1",
    requiresApproval: false,
    requiresDualApproval: false,
    notifyAdmin: true,
    description: "Notify — admin notified, no approval gate",
  },
  tier_2: {
    tier: "tier_2",
    requiresApproval: true,
    requiresDualApproval: false,
    notifyAdmin: true,
    description: "Approve — requires explicit admin approval",
  },
  tier_3: {
    tier: "tier_3",
    requiresApproval: true,
    requiresDualApproval: true,
    notifyAdmin: true,
    description: "Dual — requires two independent approvals",
  },
};

// ---------------------------------------------------------------------------
// Operation → Tier mapping
// ---------------------------------------------------------------------------

export type OperationType =
  | "blueprint.runPipeline"
  | "blueprint.deletDocument"
  | "estimate.runChain"
  | "swarm.dispatch"
  | "contract.freezeOverride"
  | "artifact.delete"
  | "admin.dataExport";

const OPERATION_TIERS: Record<OperationType, ApprovalTier> = {
  "blueprint.runPipeline": "tier_1",
  "blueprint.deletDocument": "tier_2",
  "estimate.runChain": "tier_1",
  "swarm.dispatch": "tier_2",
  "contract.freezeOverride": "tier_2",
  "artifact.delete": "tier_2",
  "admin.dataExport": "tier_1",
};

export function getOperationTier(operation: OperationType): TierPolicy {
  const tier = OPERATION_TIERS[operation] ?? "tier_0";
  return TIER_POLICIES[tier];
}

// ---------------------------------------------------------------------------
// Approval record types
// ---------------------------------------------------------------------------

export interface ApprovalRequest {
  operation: OperationType;
  resourceType: string;
  resourceId: number;
  requestedBy: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface ApprovalRecord {
  id: number;
  operation: string;
  resourceType: string;
  resourceId: number;
  tier: ApprovalTier;
  status: "pending" | "approved" | "denied" | "expired";
  requestedBy: number;
  approvedBy: number | null;
  reason: string;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Approval gate — check if operation is allowed
// ---------------------------------------------------------------------------

/**
 * Check whether an operation is approved. For tier_0 and tier_1, always
 * returns allowed=true. For tier_2+, checks the durable approval store.
 *
 * Usage in procedures:
 *   const gate = await checkApprovalGate("swarm.dispatch", "agentRun", runId, userId);
 *   if (!gate.allowed) throw new TRPCError({ code: "FORBIDDEN", message: gate.reason });
 */
export async function checkApprovalGate(
  operation: OperationType,
  resourceType: string,
  resourceId: number,
  requestedBy: number
): Promise<{ allowed: boolean; reason: string; approvalId?: number }> {
  const policy = getOperationTier(operation);

  // Tier 0 and 1: always allowed (tier 1 just notifies)
  if (!policy.requiresApproval) {
    return { allowed: true, reason: `${policy.tier}: ${policy.description}` };
  }

  // Tier 2+: check durable approval store
  const db = await getDb();
  if (!db) {
    return { allowed: false, reason: "Database unavailable — cannot verify approval" };
  }

  try {
    const [approval] = await db
      .select()
      .from(pipelineApprovals)
      .where(
        and(
          eq(pipelineApprovals.operation, operation),
          eq(pipelineApprovals.resourceType, resourceType),
          eq(pipelineApprovals.resourceId, resourceId),
          eq(pipelineApprovals.status, "approved")
        )
      )
      .orderBy(desc(pipelineApprovals.createdAt))
      .limit(1);

    if (!approval) {
      return {
        allowed: false,
        reason: `Operation "${operation}" requires ${policy.tier} approval. No approved record found.`,
      };
    }

    // Check expiration (approvals expire after 24 hours)
    const APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;
    const age = Date.now() - new Date(approval.createdAt).getTime();
    if (age > APPROVAL_TTL_MS) {
      // Mark as expired
      await db
        .update(pipelineApprovals)
        .set({ status: "expired" })
        .where(eq(pipelineApprovals.id, approval.id));

      return {
        allowed: false,
        reason: `Approval expired (${Math.round(age / 3600000)}h old, max 24h). Re-approval required.`,
      };
    }

    // Tier 3: check for second independent approver
    if (policy.requiresDualApproval) {
      const approvals = await db
        .select()
        .from(pipelineApprovals)
        .where(
          and(
            eq(pipelineApprovals.operation, operation),
            eq(pipelineApprovals.resourceType, resourceType),
            eq(pipelineApprovals.resourceId, resourceId),
            eq(pipelineApprovals.status, "approved")
          )
        )
        .orderBy(desc(pipelineApprovals.createdAt))
        .limit(10);

      // Need two different approvers
      const uniqueApprovers = new Set(approvals.map((a) => a.approvedBy).filter(Boolean));
      if (uniqueApprovers.size < 2) {
        return {
          allowed: false,
          reason: `Operation requires dual approval (tier_3). Only ${uniqueApprovers.size}/2 approvers recorded.`,
        };
      }
    }

    return { allowed: true, reason: "Approved", approvalId: approval.id };
  } catch {
    return { allowed: false, reason: "Failed to check approval status" };
  }
}

// ---------------------------------------------------------------------------
// Request approval — create a pending approval record
// ---------------------------------------------------------------------------

export async function requestApproval(req: ApprovalRequest): Promise<{
  approvalId: number;
  tier: ApprovalTier;
}> {
  const policy = getOperationTier(req.operation);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const [result] = await db.insert(pipelineApprovals).values({
    operation: req.operation,
    resourceType: req.resourceType,
    resourceId: req.resourceId,
    tier: policy.tier,
    status: "pending",
    requestedBy: req.requestedBy,
    approvedBy: null,
    reason: req.reason,
    metadata: req.metadata ?? null,
  });

  return { approvalId: Number(result.insertId), tier: policy.tier };
}

// ---------------------------------------------------------------------------
// Grant or deny approval
// ---------------------------------------------------------------------------

export async function resolveApproval(
  approvalId: number,
  decision: "approved" | "denied",
  approvedBy: number,
  notes?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

  const [existing] = await db
    .select()
    .from(pipelineApprovals)
    .where(eq(pipelineApprovals.id, approvalId))
    .limit(1);

  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Approval record not found" });
  }

  if (existing.status !== "pending") {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Approval already resolved: ${existing.status}`,
    });
  }

  // Prevent self-approval
  if (existing.requestedBy === approvedBy) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Cannot approve your own request",
    });
  }

  // Atomic conditional update — only resolves if still "pending".
  // Prevents race condition where two admins approve simultaneously.
  const [updateResult] = await db
    .update(pipelineApprovals)
    .set({
      status: decision,
      approvedBy,
      resolvedAt: new Date(),
      notes: notes ?? null,
    })
    .where(
      and(
        eq(pipelineApprovals.id, approvalId),
        eq(pipelineApprovals.status, "pending")
      )
    );

  // If no rows updated, another request resolved it first
  if ((updateResult as any).affectedRows === 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: "Approval was already resolved by another admin (race condition prevented)",
    });
  }
}

// ---------------------------------------------------------------------------
// Enforce gate (throws if not approved) — convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Enforce the approval gate for an operation. Throws FORBIDDEN if not approved.
 * For tier_0/tier_1 operations, this is a no-op.
 *
 * Usage:
 *   await enforceApprovalGate("swarm.dispatch", "agentRun", runId, ctx.user.id);
 *   // ... proceed with operation
 */
export async function enforceApprovalGate(
  operation: OperationType,
  resourceType: string,
  resourceId: number,
  requestedBy: number
): Promise<void> {
  const gate = await checkApprovalGate(operation, resourceType, resourceId, requestedBy);
  if (!gate.allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: gate.reason,
    });
  }
}
