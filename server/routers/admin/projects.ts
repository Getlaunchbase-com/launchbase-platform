/**
 * Projects Router (Mobile-Facing)
 *
 * Read-only project endpoints for the mobile Jobs screen and
 * Job Overview screen. These are OBSERVE-ONLY — no mutations,
 * no computation, no AI, no estimation logic.
 *
 * Endpoints:
 *   admin.projects.list       → Jobs landing (real project data)
 *   admin.projects.getOverview → Job Overview with Next Best Action data
 */

import { z } from "zod";
import { router, protectedProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import {
  projects,
  projectCollaborators,
  blueprintDocuments,
  estimateChainRuns,
  blueprintDetectionsRaw,
  agentFeedback,
} from "../../db/schema";
import { desc, eq, and, sql, count, gte } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const projectsRouter = router({
  /**
   * List projects accessible by the current user.
   *
   * Populates the mobile Jobs screen with real data.
   * Auth required — user must have project access via collaborators table
   * or be project owner.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["active", "archived"]).optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .optional()
    )
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { items: [], total: 0 };

      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Auth required." });
      }

      const { status, limit = 50, offset = 0 } = input ?? {};

      // Get project IDs the user can access (owner OR collaborator)
      const ownedProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.ownerId, userId));

      const collabProjects = await db
        .select({ projectId: projectCollaborators.projectId })
        .from(projectCollaborators)
        .where(eq(projectCollaborators.userId, userId));

      const accessibleIds = new Set([
        ...ownedProjects.map((p) => p.id),
        ...collabProjects.map((c) => c.projectId),
      ]);

      if (accessibleIds.size === 0) return { items: [], total: 0 };

      // Build conditions
      const idList = Array.from(accessibleIds);
      const conditions: any[] = [sql`${projects.id} IN (${sql.join(idList.map((id) => sql`${id}`), sql`, `)})`];
      if (status) conditions.push(eq(projects.status, status));

      const where = and(...conditions);

      const rows = await db
        .select({
          projectId: projects.id,
          name: projects.name,
          address: projects.description,
          status: projects.status,
          lastUpdated: projects.updatedAt,
        })
        .from(projects)
        .where(where)
        .orderBy(desc(projects.updatedAt))
        .limit(limit)
        .offset(offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(projects)
        .where(where);

      return {
        items: rows.map((r) => ({
          projectId: String(r.projectId),
          name: r.name,
          address: r.address ?? null,
          status: r.status === "active" ? ("active" as const) : ("archived" as const),
          lastUpdated: r.lastUpdated?.toISOString() ?? new Date().toISOString(),
        })),
        total: countResult?.total ?? 0,
      };
    }),

  /**
   * Get project overview for the Job Overview / Next Best Action screen.
   *
   * Aggregates read-only data from:
   *   - Blueprint documents (upload/parse status)
   *   - Estimate chain runs (estimate status)
   *   - Detections with low confidence (attention items)
   *
   * This is pure aggregation. No AI, no inference, no computation.
   */
  getOverview: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });
      }

      const userId = ctx.user?.id;
      if (!userId) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Auth required." });
      }

      const pid = parseInt(input.projectId, 10);
      if (isNaN(pid)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid projectId." });
      }

      // Verify access
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, pid))
        .limit(1);

      if (!project) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
      }

      // Check user has access (owner or collaborator)
      if (project.ownerId !== userId) {
        const [collab] = await db
          .select({ id: projectCollaborators.id })
          .from(projectCollaborators)
          .where(
            and(
              eq(projectCollaborators.projectId, pid),
              eq(projectCollaborators.userId, userId)
            )
          )
          .limit(1);

        if (!collab) {
          throw new TRPCError({ code: "FORBIDDEN", message: "No access to this project." });
        }
      }

      // --- Blueprint status ---
      const blueprintDocs = await db
        .select({
          id: blueprintDocuments.id,
          status: blueprintDocuments.status,
          pageCount: blueprintDocuments.pageCount,
          createdAt: blueprintDocuments.createdAt,
        })
        .from(blueprintDocuments)
        .where(eq(blueprintDocuments.projectId, pid))
        .orderBy(desc(blueprintDocuments.createdAt))
        .limit(1);

      let blueprint: { status: "none" | "processing" | "ready"; pageCount?: number; lastUploadedAt?: string };

      if (blueprintDocs.length === 0) {
        blueprint = { status: "none" };
      } else {
        const doc = blueprintDocs[0];
        const readyStatuses = ["parsed", "detection_complete"];
        const processingStatuses = ["uploaded", "parsing", "detection_running"];

        if (readyStatuses.includes(doc.status)) {
          blueprint = {
            status: "ready",
            pageCount: doc.pageCount ?? undefined,
            lastUploadedAt: doc.createdAt?.toISOString(),
          };
        } else if (processingStatuses.includes(doc.status)) {
          blueprint = {
            status: "processing",
            pageCount: doc.pageCount ?? undefined,
            lastUploadedAt: doc.createdAt?.toISOString(),
          };
        } else {
          // "failed" → treat as none for mobile
          blueprint = { status: "none" };
        }
      }

      // --- Estimate status ---
      const estimateRuns = await db
        .select({
          id: estimateChainRuns.id,
          status: estimateChainRuns.status,
          totalLineItems: estimateChainRuns.totalLineItems,
          totalLaborHours: estimateChainRuns.totalLaborHours,
          lowConfidenceCount: estimateChainRuns.lowConfidenceCount,
        })
        .from(estimateChainRuns)
        .where(eq(estimateChainRuns.projectId, pid))
        .orderBy(desc(estimateChainRuns.createdAt))
        .limit(1);

      let estimate: {
        status: "none" | "running" | "ready";
        totalDevices?: number;
        totalLaborHours?: number;
        confidence?: number;
      };

      if (estimateRuns.length === 0) {
        estimate = { status: "none" };
      } else {
        const run = estimateRuns[0];
        if (run.status === "completed") {
          // Compute confidence: ratio of high-confidence items to total
          const total = run.totalLineItems ?? 0;
          const lowConf = run.lowConfidenceCount ?? 0;
          const confidence = total > 0 ? Math.round(((total - lowConf) / total) * 100) : 0;

          estimate = {
            status: "ready",
            totalDevices: total,
            totalLaborHours: run.totalLaborHours ?? undefined,
            confidence,
          };
        } else if (run.status === "running") {
          estimate = { status: "running" };
        } else {
          estimate = { status: "none" };
        }
      }

      // --- Attention items (gap detection / low confidence detections) ---
      // Count detections with confidence < 0.5 (medium+ severity equivalent)
      const [attentionCount] = await db
        .select({ total: count() })
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId,
              blueprintDocs[0]?.id ?? 0),
            sql`${blueprintDetectionsRaw.confidence} < 0.5`
          )
        );

      const [highSevCount] = await db
        .select({ total: count() })
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId,
              blueprintDocs[0]?.id ?? 0),
            sql`${blueprintDetectionsRaw.confidence} < 0.3`
          )
        );

      const attention = {
        count: attentionCount?.total ?? 0,
        highSeverity: highSevCount?.total ?? 0,
      };

      return {
        projectId: String(project.id),
        name: project.name,
        address: project.description ?? null,
        blueprint,
        estimate,
        attention,
        lastUpdated: project.updatedAt?.toISOString() ?? new Date().toISOString(),
      };
    }),
});
