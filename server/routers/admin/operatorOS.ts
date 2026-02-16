/**
 * Operator OS tRPC Router
 *
 * Admin-only endpoints for the Operator OS v2 dashboard.
 * Provides system-level observability, project management,
 * and security monitoring for platform operators.
 *
 * All procedures use adminProcedure — requires authenticated admin role.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  projects,
  projectCollaborators,
  agentRuns,
  agentArtifacts,
  agentInstances,
  vertexProfiles,
  securityAuditLog,
  rateLimitViolations,
  users,
} from "../../../drizzle/schema";
import { desc, eq, and, gte, sql, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Operator OS Router
// ---------------------------------------------------------------------------

export const operatorOSRouter = router({
  // =========================================================================
  // Project management
  // =========================================================================

  /** List all projects with stats */
  listProjects: adminProcedure
    .input(
      z.object({
        status: z.enum(["active", "archived", "suspended"]).optional(),
        tenant: z.enum(["launchbase", "vinces"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { projects: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(projects.status, input.status));
      if (input.tenant) conditions.push(eq(projects.tenant, input.tenant));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(projects)
        .where(where)
        .orderBy(desc(projects.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(projects)
        .where(where);

      return {
        projects: rows,
        total: countResult?.total ?? 0,
      };
    }),

  /** Get a single project with collaborators */
  getProject: adminProcedure
    .input(z.object({ projectId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);

      if (!project) return null;

      const collabs = await db
        .select({
          id: projectCollaborators.id,
          userId: projectCollaborators.userId,
          role: projectCollaborators.role,
          createdAt: projectCollaborators.createdAt,
          userName: users.name,
          userEmail: users.email,
        })
        .from(projectCollaborators)
        .leftJoin(users, eq(projectCollaborators.userId, users.id))
        .where(eq(projectCollaborators.projectId, input.projectId));

      return { ...project, collaborators: collabs };
    }),

  /** Suspend or reactivate a project */
  updateProjectStatus: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        status: z.enum(["active", "archived", "suspended"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db
        .update(projects)
        .set({ status: input.status })
        .where(eq(projects.id, input.projectId));

      return { success: true, projectId: input.projectId, status: input.status };
    }),

  // =========================================================================
  // Agent run oversight
  // =========================================================================

  /** List agent runs across all projects (admin view) */
  listRuns: adminProcedure
    .input(
      z.object({
        status: z.enum(["running", "success", "failed", "awaiting_approval"]).optional(),
        projectId: z.number().int().optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { runs: [], total: 0 };

      const conditions: any[] = [];
      if (input.status) conditions.push(eq(agentRuns.status, input.status));
      if (input.projectId) conditions.push(eq(agentRuns.projectId, input.projectId));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(agentRuns)
        .where(where)
        .orderBy(desc(agentRuns.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentRuns)
        .where(where);

      return { runs: rows, total: countResult?.total ?? 0 };
    }),

  // =========================================================================
  // Security dashboard
  // =========================================================================

  /** Get recent security audit events */
  recentAuditEvents: adminProcedure
    .input(
      z.object({
        severity: z.enum(["info", "warn", "crit"]).optional(),
        eventType: z.string().optional(),
        limit: z.number().int().min(1).max(200).default(50),
        sinceHoursAgo: z.number().int().min(1).max(168).default(24), // max 7 days
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { events: [], total: 0 };

      const sinceDate = new Date(Date.now() - input.sinceHoursAgo * 60 * 60 * 1000);
      const conditions: any[] = [gte(securityAuditLog.createdAt, sinceDate)];

      if (input.severity) conditions.push(eq(securityAuditLog.severity, input.severity));
      if (input.eventType) conditions.push(eq(securityAuditLog.eventType, input.eventType as any));

      const where = and(...conditions);

      const rows = await db
        .select()
        .from(securityAuditLog)
        .where(where)
        .orderBy(desc(securityAuditLog.createdAt))
        .limit(input.limit);

      const [countResult] = await db
        .select({ total: count() })
        .from(securityAuditLog)
        .where(where);

      return { events: rows, total: countResult?.total ?? 0 };
    }),

  /** Get rate limit violation summary */
  rateLimitSummary: adminProcedure
    .input(
      z.object({
        sinceHoursAgo: z.number().int().min(1).max(168).default(24),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { violations: [], totalViolations: 0 };

      const sinceDate = new Date(Date.now() - input.sinceHoursAgo * 60 * 60 * 1000);

      const rows = await db
        .select({
          limiterKey: rateLimitViolations.limiterKey,
          violationCount: count(),
        })
        .from(rateLimitViolations)
        .where(gte(rateLimitViolations.createdAt, sinceDate))
        .groupBy(rateLimitViolations.limiterKey)
        .orderBy(desc(count()));

      const total = rows.reduce((sum, r) => sum + (r.violationCount as number), 0);
      return { violations: rows, totalViolations: total };
    }),

  /** Get security summary stats (counts by severity, recent critical events) */
  securityOverview: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { bySeverity: [], criticalCount: 0, recentCritical: [] };

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const bySeverity = await db
      .select({
        severity: securityAuditLog.severity,
        count: count(),
      })
      .from(securityAuditLog)
      .where(gte(securityAuditLog.createdAt, last24h))
      .groupBy(securityAuditLog.severity);

    const recentCritical = await db
      .select()
      .from(securityAuditLog)
      .where(
        and(
          eq(securityAuditLog.severity, "crit"),
          gte(securityAuditLog.createdAt, last24h)
        )
      )
      .orderBy(desc(securityAuditLog.createdAt))
      .limit(10);

    const criticalCount = bySeverity.find((r) => r.severity === "crit")?.count ?? 0;

    return { bySeverity, criticalCount, recentCritical };
  }),

  // =========================================================================
  // Artifact management
  // =========================================================================

  /** List artifacts for a project or run */
  listArtifacts: adminProcedure
    .input(
      z.object({
        projectId: z.number().int().optional(),
        runId: z.number().int().optional(),
        type: z.enum(["file", "screenshot", "pr", "log", "report"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { artifacts: [], total: 0 };

      const conditions: any[] = [];
      if (input.projectId) conditions.push(eq(agentArtifacts.projectId, input.projectId));
      if (input.runId) conditions.push(eq(agentArtifacts.runId, input.runId));
      if (input.type) conditions.push(eq(agentArtifacts.type, input.type));

      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const rows = await db
        .select()
        .from(agentArtifacts)
        .where(where)
        .orderBy(desc(agentArtifacts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentArtifacts)
        .where(where);

      return { artifacts: rows, total: countResult?.total ?? 0 };
    }),

  // =========================================================================
  // Instances panel — pick project → pick instance → launch run
  // =========================================================================

  /** List instances for a project (Instances panel) */
  listInstances: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        status: z.enum(["active", "paused", "archived"]).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { instances: [], total: 0 };

      const conditions: any[] = [eq(agentInstances.projectId, input.projectId)];
      if (input.status) conditions.push(eq(agentInstances.status, input.status));

      const where = and(...conditions);

      const rows = await db
        .select({
          id: agentInstances.id,
          projectId: agentInstances.projectId,
          vertexId: agentInstances.vertexId,
          displayName: agentInstances.displayName,
          status: agentInstances.status,
          createdBy: agentInstances.createdBy,
          createdAt: agentInstances.createdAt,
          vertexName: vertexProfiles.name,
        })
        .from(agentInstances)
        .leftJoin(vertexProfiles, eq(agentInstances.vertexId, vertexProfiles.id))
        .where(where)
        .orderBy(desc(agentInstances.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(agentInstances)
        .where(where);

      return { instances: rows, total: countResult?.total ?? 0 };
    }),

  /** Launch a new agent run bound to a specific instance */
  launchInstanceRun: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        agentInstanceId: z.number().int(),
        goal: z.string().min(1),
        model: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify instance exists, is active, and belongs to the project
      const [instance] = await db
        .select()
        .from(agentInstances)
        .where(
          and(
            eq(agentInstances.id, input.agentInstanceId),
            eq(agentInstances.projectId, input.projectId)
          )
        )
        .limit(1);

      if (!instance) throw new Error("Instance not found or does not belong to project");
      if (instance.status !== "active") throw new Error("Instance is not active");

      const userId = (ctx as any).user?.id ?? 0;

      const [result] = await db.insert(agentRuns).values({
        createdBy: userId,
        status: "running",
        goal: input.goal,
        model: input.model ?? null,
        projectId: input.projectId,
        agentInstanceId: input.agentInstanceId,
      });

      return {
        runId: result.insertId,
        projectId: input.projectId,
        agentInstanceId: input.agentInstanceId,
      };
    }),
});

export type OperatorOSRouter = typeof operatorOSRouter;
