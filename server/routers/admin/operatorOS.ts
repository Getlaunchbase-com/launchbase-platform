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
  agentFeedback,
  feedbackImprovementProposals,
  vertexFreezes,
  users,
} from "../../db/schema";
import { desc, eq, and, gte, sql, count, inArray } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import {
  getLatestRuntimeStatus,
  getAllRuntimeStatuses,
  getExecutionGate,
  runHealthCheck,
} from "../../services/agentHealthMonitor";
import { getFreezeStatus } from "../../contracts/freeze_governance";

// ---------------------------------------------------------------------------
// Freeze registry loader
// ---------------------------------------------------------------------------

let _cachedFreezeRegistry: Record<string, unknown> | null = null;

function loadFreezeRegistry(): Record<string, unknown> {
  if (_cachedFreezeRegistry) return _cachedFreezeRegistry;
  const registryPath = path.resolve(__dirname, "../../contracts/vertex_freeze_registry.json");
  const content = fs.readFileSync(registryPath, "utf-8");
  _cachedFreezeRegistry = JSON.parse(content);
  return _cachedFreezeRegistry!;
}

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
        type: z.enum([
          "file", "screenshot", "pr", "log", "report",
          "blueprint_input", "takeoff_json", "takeoff_xlsx", "takeoff_docx",
        ]).optional(),
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

  // =========================================================================
  // Blueprint takeoff — upload → run takeoff → view outputs
  // =========================================================================

  /** Run Takeoff: start an agent run that parses a blueprint artifact */
  runTakeoff: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        agentInstanceId: z.number().int(),
        blueprintArtifactId: z.number().int(),
        model: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify instance belongs to project and is active
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

      // Verify blueprint artifact exists and belongs to project
      const [blueprint] = await db
        .select()
        .from(agentArtifacts)
        .where(
          and(
            eq(agentArtifacts.id, input.blueprintArtifactId),
            eq(agentArtifacts.projectId, input.projectId),
            eq(agentArtifacts.type, "blueprint_input")
          )
        )
        .limit(1);

      if (!blueprint) throw new Error("Blueprint artifact not found or does not belong to project");

      const userId = (ctx as any).user?.id ?? 0;

      // Create the run with blueprint context in stateJson
      const goal =
        `Parse blueprint "${blueprint.filename}" and generate material takeoff. ` +
        `Blueprint artifact id: ${blueprint.id}. ` +
        `Produce outputs: takeoff_json, takeoff_xlsx, takeoff_docx.`;

      const [result] = await db.insert(agentRuns).values({
        createdBy: userId,
        status: "running",
        goal,
        model: input.model ?? null,
        projectId: input.projectId,
        agentInstanceId: input.agentInstanceId,
        stateJson: {
          messages: [],
          stepCount: 0,
          errorCount: 0,
          maxSteps: 30,
          maxErrors: 3,
        } as any,
        pendingActionJson: null,
      });

      const runId = result.insertId;

      // Link the blueprint artifact to this run
      await db
        .update(agentArtifacts)
        .set({ runId, meta: { ...((blueprint.meta as any) ?? {}), linkedToRunId: runId } })
        .where(eq(agentArtifacts.id, blueprint.id));

      return {
        runId,
        projectId: input.projectId,
        agentInstanceId: input.agentInstanceId,
        blueprintArtifactId: blueprint.id,
        goal,
      };
    }),

  /** List artifacts for a specific run, grouped by takeoff output types */
  runArtifacts: adminProcedure
    .input(
      z.object({
        runId: z.number().int(),
        types: z
          .array(
            z.enum([
              "file", "screenshot", "pr", "log", "report",
              "blueprint_input", "takeoff_json", "takeoff_xlsx", "takeoff_docx",
            ])
          )
          .optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { artifacts: [], total: 0 };

      const conditions: any[] = [eq(agentArtifacts.runId, input.runId)];
      if (input.types && input.types.length > 0) {
        conditions.push(inArray(agentArtifacts.type, input.types));
      }

      const where = and(...conditions);

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
  // Feedback panel — quick-glance feedback + proposals for Operator OS
  // =========================================================================

  /** Feedback overview: recent items + summary stats */
  feedbackOverview: adminProcedure
    .input(
      z.object({
        sinceDaysAgo: z.number().int().min(1).max(90).default(7),
        limit: z.number().int().min(1).max(50).default(10),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { recent: [], byStatus: [], bySeverity: [], total: 0, pendingProposals: 0 };

      const sinceDate = new Date(Date.now() - input.sinceDaysAgo * 24 * 60 * 60 * 1000);
      const sinceCond = gte(agentFeedback.createdAt, sinceDate);

      const [recent, byStatus, bySeverity, pendingProposals] = await Promise.all([
        db
          .select({
            id: agentFeedback.id,
            instanceId: agentFeedback.instanceId,
            message: agentFeedback.message,
            category: agentFeedback.category,
            severity: agentFeedback.severity,
            status: agentFeedback.status,
            source: agentFeedback.source,
            createdAt: agentFeedback.createdAt,
            instanceName: agentInstances.displayName,
          })
          .from(agentFeedback)
          .leftJoin(agentInstances, eq(agentFeedback.instanceId, agentInstances.id))
          .where(sinceCond)
          .orderBy(desc(agentFeedback.createdAt))
          .limit(input.limit),
        db
          .select({ status: agentFeedback.status, count: count() })
          .from(agentFeedback)
          .where(sinceCond)
          .groupBy(agentFeedback.status),
        db
          .select({ severity: agentFeedback.severity, count: count() })
          .from(agentFeedback)
          .where(sinceCond)
          .groupBy(agentFeedback.severity),
        db
          .select({ total: count() })
          .from(feedbackImprovementProposals)
          .where(eq(feedbackImprovementProposals.status, "proposed")),
      ]);

      const total = byStatus.reduce((sum, r) => sum + (r.count as number), 0);

      return {
        recent,
        byStatus,
        bySeverity,
        total,
        pendingProposals: pendingProposals[0]?.total ?? 0,
      };
    }),

  /** List proposals awaiting review (promotion gate queue) */
  pendingProposals: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { proposals: [], total: 0 };

      const rows = await db
        .select()
        .from(feedbackImprovementProposals)
        .where(
          inArray(feedbackImprovementProposals.status, ["proposed", "under_review"])
        )
        .orderBy(desc(feedbackImprovementProposals.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(feedbackImprovementProposals)
        .where(
          inArray(feedbackImprovementProposals.status, ["proposed", "under_review"])
        );

      return { proposals: rows, total: countResult?.total ?? 0 };
    }),

  // =========================================================================
  // Vertex Freeze Protocol
  // =========================================================================

  /** Get the current freeze registry (from file) */
  getFreezeRegistry: adminProcedure.query(async () => {
    return loadFreezeRegistry();
  }),

  /** List all vertex freezes from DB */
  listVertexFreezes: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db
      .select()
      .from(vertexFreezes)
      .orderBy(desc(vertexFreezes.createdAt));
  }),

  /** Get a specific vertex freeze */
  getVertexFreeze: adminProcedure
    .input(z.object({ vertex: z.string(), version: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [freeze] = await db
        .select()
        .from(vertexFreezes)
        .where(
          and(
            eq(vertexFreezes.vertex, input.vertex),
            eq(vertexFreezes.version, input.version)
          )
        )
        .limit(1);
      return freeze ?? null;
    }),

  /** Persist a vertex freeze to the database */
  createVertexFreeze: adminProcedure
    .input(
      z.object({
        vertex: z.string(),
        version: z.string(),
        frozenAt: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Load the full registry as the snapshot
      const registry = loadFreezeRegistry();

      const [result] = await db.insert(vertexFreezes).values({
        vertex: input.vertex,
        version: input.version,
        status: "frozen",
        frozenAt: new Date(input.frozenAt),
        registryJson: registry,
        lockedContracts: (registry as any).contracts?.map((c: any) => c.name) ?? [],
        frozenBy: (ctx as any).user?.id ?? null,
        notes: input.notes ?? null,
      });

      return { id: Number(result.insertId) };
    }),

  /** Check if a contract is frozen (governance gate) */
  isContractFrozen: adminProcedure
    .input(z.object({ contractName: z.string() }))
    .query(async ({ input }) => {
      const registry = loadFreezeRegistry();
      const contracts = (registry as any).contracts ?? [];
      const found = contracts.find(
        (c: any) => c.name === input.contractName && c.status === "locked"
      );
      return {
        frozen: !!found,
        vertex: (registry as any).vertex ?? null,
        version: (registry as any).version ?? null,
        frozenAt: (registry as any).frozen_at ?? null,
        governance: (registry as any).governance ?? null,
      };
    }),

  // =========================================================================
  // Runtime Monitoring (Agent Health)
  // =========================================================================

  /** Get the latest runtime status for the agent-stack */
  getRuntimeStatus: adminProcedure.query(async () => {
    const latest = await getLatestRuntimeStatus();
    if (!latest) {
      return {
        status: "offline" as const,
        vertex: null,
        version: null,
        handshakeOk: false,
        lastSeen: null,
        violations: [],
        responseTimeMs: null,
        executionAllowed: false,
      };
    }
    return {
      ...latest,
      executionAllowed: latest.status === "healthy",
    };
  }),

  /** Get all runtime status entries (multi-vertex view) */
  listRuntimeStatuses: adminProcedure.query(async () => {
    return getAllRuntimeStatuses();
  }),

  /** Check if execution is allowed for a vertex */
  getExecutionGate: adminProcedure
    .input(z.object({ vertex: z.string() }))
    .query(async ({ input }) => {
      const gate = await getExecutionGate(input.vertex);
      return {
        vertex: input.vertex,
        gate,
        executionAllowed: gate === "allow",
        viewOnly: gate === "view_only",
        blocked: gate === "blocked",
      };
    }),

  /** Trigger an immediate health check (admin-initiated) */
  triggerHealthCheck: adminProcedure.mutation(async () => {
    const result = await runHealthCheck();
    return {
      ...result,
      executionAllowed: result.status === "healthy",
    };
  }),

  // =========================================================================
  // Read-Only Observability
  // =========================================================================

  /** Get the last 20 audit events (quick-glance observability) */
  recentAuditSnapshot: adminProcedure.query(async () => {
    const db = await getDb();
    if (!db) return { events: [] };

    const events = await db
      .select({
        id: securityAuditLog.id,
        eventType: securityAuditLog.eventType,
        severity: securityAuditLog.severity,
        actorType: securityAuditLog.actorType,
        actorId: securityAuditLog.actorId,
        message: securityAuditLog.message,
        resourceType: securityAuditLog.resourceType,
        resourceId: securityAuditLog.resourceId,
        createdAt: securityAuditLog.createdAt,
      })
      .from(securityAuditLog)
      .orderBy(desc(securityAuditLog.createdAt))
      .limit(20);

    return { events };
  }),

  /** Get freeze status banner data (for dashboard display) */
  freezeStatusBanner: adminProcedure.query(async () => {
    const freeze = getFreezeStatus();
    const registry = loadFreezeRegistry();
    const contracts = (registry as any).contracts ?? [];

    return {
      frozen: freeze.frozen,
      vertex: freeze.vertex,
      version: freeze.version,
      frozenAt: freeze.frozenAt,
      allowedActions: freeze.allowedActions,
      blockedActions: freeze.blockedActions,
      changeRoutes: freeze.changeRoutes,
      contractCount: contracts.length,
      lockedContractCount: contracts.filter(
        (c: any) => c.status === "locked"
      ).length,
    };
  }),
});

export type OperatorOSRouter = typeof operatorOSRouter;
