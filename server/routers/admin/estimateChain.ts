/**
 * EstimateChainV1 — tRPC Router
 *
 * Agent-delegated pipeline: platform sends context to agent-stack,
 * agent computes estimates, platform validates + stores result.
 *
 *   - runEstimateChain: dispatch to agent-stack POST /tools/estimate-chain
 *   - listRuns / getRun: query stored runs
 *   - exportExcel: 3-sheet Excel (Takeoff_Summary, Line_Items, Assumptions)
 *   - exportBluebeamMarkups / exportBluebeamTakeoff: Bluebeam CSVs
 *   - overrides CRUD: project-scoped task library overrides
 *
 * All procedures use adminProcedure — requires authenticated admin role.
 *
 * IMPORTANT: The platform NEVER computes estimates. All math lives in the
 * agent-stack. Platform is control plane: route, validate, store, export.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  blueprintDocuments,
  blueprintDetectionsRaw,
  blueprintSymbolPacks,
  estimateChainRuns,
  projectTaskOverrides,
} from "../../db/schema";
import { desc, eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import fs from "node:fs";
import path from "node:path";
import { getFreezeStatus } from "../../contracts/freeze_governance";
import { computeSchemaHash } from "../../contracts/handshake";
import { env } from "../../_core/env";

// ---------------------------------------------------------------------------
// Task library loader
// ---------------------------------------------------------------------------

interface TaskMaterial {
  material_code: string;
  qty_per_ea: number;
  uom: string;
}

interface TaskDef {
  task_code: string;
  basis: string;
  base_hours: number;
  crew: string;
  materials: TaskMaterial[];
  waste_factor: number;
  notes?: string[];
}

interface CanonicalDef {
  category: string;
  description: string;
  tasks: TaskDef[];
}

interface TaskLibrary {
  library: { name: string; version: string };
  defaults: { waste_factor: number; labor_factor: number; crew_profiles: Record<string, { description: string; multiplier: number }> };
  canonical: Record<string, CanonicalDef>;
}

let _cachedTaskLibrary: TaskLibrary | null = null;

function loadTaskLibrary(): TaskLibrary {
  if (_cachedTaskLibrary) return _cachedTaskLibrary;
  const libPath = path.resolve(__dirname, "../../contracts/IBEW_LV_TaskLibrary_v1.json");
  const content = fs.readFileSync(libPath, "utf-8");
  _cachedTaskLibrary = JSON.parse(content) as TaskLibrary;
  return _cachedTaskLibrary;
}

// ---------------------------------------------------------------------------
// Schema hash for EstimateChainV1 (uses stable hash from handshake module)
// ---------------------------------------------------------------------------

function getEstimateSchemaHash(): string {
  return computeSchemaHash("EstimateChainV1.schema.json");
}

// ---------------------------------------------------------------------------
// Agent-stack URL
// ---------------------------------------------------------------------------

const AGENT_URL = env.AGENT_STACK_URL;
const AGENT_TIMEOUT_MS = 180_000; // 3 minutes for full estimate chain

// ---------------------------------------------------------------------------
// CSV helpers
// ---------------------------------------------------------------------------

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCSVRow(values: unknown[]): string {
  return values.map(escapeCSV).join(",");
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const estimateChainRouter = router({
  /**
   * Run full estimate chain for a document.
   *
   * PLATFORM = CONTROL PLANE. All estimate computation is delegated to
   * agent-stack via POST /tools/estimate-chain. Platform validates the
   * response against EstimateChainV1 schema and stores the result.
   */
  runEstimateChain: adminProcedure
    .input(
      z.object({
        documentId: z.number(),
        symbolPackId: z.number(),
        projectId: z.number().optional(),
        laborFactor: z.number().optional(),
        wasteFactor: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // 1. Load document
      const [doc] = await db.select().from(blueprintDocuments).where(eq(blueprintDocuments.id, input.documentId)).limit(1);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // 2. Load symbol pack
      const [pack] = await db.select().from(blueprintSymbolPacks).where(eq(blueprintSymbolPacks.id, input.symbolPackId)).limit(1);
      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Symbol pack not found" });

      // 3. Load all mapped/verified detections for this document
      const detections = await db
        .select()
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            inArray(blueprintDetectionsRaw.status, ["mapped", "verified"])
          )
        );

      // 4. Load project overrides if applicable
      const projectId = input.projectId ?? (doc as any).projectId;
      let overrides: Array<Record<string, unknown>> = [];
      if (projectId) {
        overrides = await db
          .select()
          .from(projectTaskOverrides)
          .where(eq(projectTaskOverrides.projectId, projectId));
      }

      // 5. Create run record (status: running)
      const schemaHash = getEstimateSchemaHash();
      const taskLib = loadTaskLibrary();
      const [runResult] = await db.insert(estimateChainRuns).values({
        documentId: input.documentId,
        projectId: projectId ?? null,
        symbolPackId: input.symbolPackId,
        taskLibraryId: taskLib.library.name,
        contractName: "EstimateChainV1",
        contractVersion: "1.0.0",
        schemaHash,
        status: "running",
        runByUserId: (ctx as any).user?.id ?? null,
      });
      const runId = runResult.insertId;

      // 6. Dispatch to agent-stack — ALL math lives there
      const agentPayload = {
        document_id: input.documentId,
        project_id: projectId ?? null,
        symbol_pack_id: input.symbolPackId,
        symbol_pack_mappings: pack.mappings ?? [],
        detections: detections.map((d) => ({
          id: d.id,
          raw_class: d.rawClass,
          canonical_type: d.canonicalType ?? null,
          status: d.status,
          confidence: d.confidence,
          page_id: d.pageId,
          bbox: { x: d.x, y: d.y, w: d.w, h: d.h },
        })),
        overrides,
        params: {
          labor_factor: input.laborFactor ?? null,
          waste_factor: input.wasteFactor ?? null,
        },
        run_id: Number(runId),
      };

      let agentOutput: any;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT_MS);

        const resp = await fetch(`${AGENT_URL}/tools/estimate-chain`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(agentPayload),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!resp.ok) {
          const errBody = await resp.text().catch(() => "");
          throw new Error(`Agent returned HTTP ${resp.status}: ${errBody.slice(0, 500)}`);
        }

        agentOutput = await resp.json();
      } catch (err) {
        // Mark run as failed
        await db
          .update(estimateChainRuns)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(estimateChainRuns.id, Number(runId)));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent estimate-chain call failed: ${(err as Error).message}`,
        });
      }

      // 7. Validate contract identity from agent response
      const contract = agentOutput?.contract;
      if (!contract || contract.name !== "EstimateChainV1") {
        await db
          .update(estimateChainRuns)
          .set({ status: "failed", completedAt: new Date() })
          .where(eq(estimateChainRuns.id, Number(runId)));

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent returned invalid contract: expected EstimateChainV1, got ${contract?.name ?? "none"}`,
        });
      }

      // 8. Extract summary metrics from agent output
      const lineItems = agentOutput.line_items ?? [];
      const rollups = agentOutput.rollups ?? {};
      const quality = agentOutput.quality ?? {};

      const totalLineItems = lineItems.length;
      const totalLaborHours = rollups.labor_total_hours ?? 0;
      const unmappedClassCount = (quality.unmapped_classes ?? []).length;
      const lowConfidenceCount = (quality.low_confidence_items ?? []).length;
      const gapFlagCount = (quality.gap_flags ?? []).length;

      // 9. Store validated output
      await db
        .update(estimateChainRuns)
        .set({
          outputJson: agentOutput as any,
          totalLineItems,
          totalLaborHours: parseFloat(totalLaborHours.toFixed(2)),
          unmappedClassCount,
          lowConfidenceCount,
          gapFlagCount,
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(estimateChainRuns.id, Number(runId)));

      return { runId: Number(runId), output: agentOutput };
    }),

  /**
   * List runs for a document
   */
  listRuns: adminProcedure
    .input(z.object({ documentId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      return db
        .select({
          id: estimateChainRuns.id,
          documentId: estimateChainRuns.documentId,
          symbolPackId: estimateChainRuns.symbolPackId,
          taskLibraryId: estimateChainRuns.taskLibraryId,
          contractVersion: estimateChainRuns.contractVersion,
          totalLineItems: estimateChainRuns.totalLineItems,
          totalLaborHours: estimateChainRuns.totalLaborHours,
          unmappedClassCount: estimateChainRuns.unmappedClassCount,
          lowConfidenceCount: estimateChainRuns.lowConfidenceCount,
          gapFlagCount: estimateChainRuns.gapFlagCount,
          status: estimateChainRuns.status,
          startedAt: estimateChainRuns.startedAt,
          completedAt: estimateChainRuns.completedAt,
        })
        .from(estimateChainRuns)
        .where(eq(estimateChainRuns.documentId, input.documentId))
        .orderBy(desc(estimateChainRuns.createdAt));
    }),

  /**
   * Get a single run with full output JSON
   */
  getRun: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [run] = await db.select().from(estimateChainRuns).where(eq(estimateChainRuns.id, input.runId)).limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      return run;
    }),

  // -------------------------------------------------------------------------
  // Export Endpoints
  // -------------------------------------------------------------------------

  /**
   * Excel-style export — returns 3 sheet payloads as JSON
   * (actual .xlsx generation delegated to client or a future library)
   */
  exportExcel: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [run] = await db.select().from(estimateChainRuns).where(eq(estimateChainRuns.id, input.runId)).limit(1);
      if (!run) throw new TRPCError({ code: "NOT_FOUND", message: "Run not found" });
      if (run.status !== "completed") throw new TRPCError({ code: "BAD_REQUEST", message: "Run not completed" });

      const output = run.outputJson as any;
      if (!output) throw new TRPCError({ code: "BAD_REQUEST", message: "No output data" });

      // Sheet 1: Takeoff_Summary
      const takeoffSummary = (output.rollups?.by_canonical_type ?? []).map((r: any) => {
        const canonDef = loadTaskLibrary().canonical[r.canonical_type];
        const task = canonDef?.tasks?.[0];
        return {
          canonical_type: r.canonical_type,
          description: canonDef?.description ?? "",
          count: r.count,
          labor_hours: r.labor_hours,
          waste_pct: task ? (task.waste_factor * 100).toFixed(0) + "%" : "",
          adjusted_qty: r.count, // ea items; adjusted qty = count for discrete
          confidence: "",
          notes: "",
        };
      });

      // Sheet 2: Line_Items
      const lineItemsSheet = (output.line_items ?? []).map((li: any) => ({
        line_id: li.line_id,
        canonical_type: li.canonical_type,
        task_code: li.task_code,
        sheet: li.location?.sheet ?? "",
        page: li.location?.page_number ?? "",
        zone: li.location?.zone ?? "",
        count: li.quantity?.count ?? 1,
        base_hours: li.labor?.base_hours ?? 0,
        labor_factor: li.labor?.factor ?? 1,
        labor_hours: li.labor?.hours ?? 0,
        material_code: li.materials?.[0]?.material_code ?? "",
        material_qty: li.materials?.[0]?.qty ?? 0,
        waste_pct: li.materials?.[0]?.waste_factor ? (li.materials[0].waste_factor * 100).toFixed(0) + "%" : "",
        qty_with_waste: li.materials?.[0]?.qty_with_waste ?? 0,
        detection_conf: li.confidence?.detection ?? "",
        mapping_conf: li.confidence?.mapping ?? "",
        overall_conf: li.confidence?.overall ?? "",
        raw_class: li.provenance?.raw_class ?? "",
        detection_model: li.provenance?.detection_model_version ?? "",
        symbol_pack_version: li.provenance?.mapping_version ?? "",
      }));

      // Sheet 3: Assumptions
      const assumptionsSheet = (output.assumptions ?? []).map((a: any) => ({
        assumption_id: a.id,
        title: a.title,
        value: a.value,
        source: a.source,
        locked: a.locked ? "Yes" : "No",
        notes: "",
      }));

      return {
        takeoff_summary: takeoffSummary,
        line_items: lineItemsSheet,
        assumptions: assumptionsSheet,
      };
    }),

  /**
   * Bluebeam markups CSV — for visual verification overlay
   */
  exportBluebeamMarkups: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [run] = await db.select().from(estimateChainRuns).where(eq(estimateChainRuns.id, input.runId)).limit(1);
      if (!run || run.status !== "completed") throw new TRPCError({ code: "NOT_FOUND", message: "Completed run not found" });

      const output = run.outputJson as any;
      const header = ["page_number", "subject", "comment", "x_norm", "y_norm", "w_norm", "h_norm", "color", "confidence"];
      const rows = [toCSVRow(header)];

      for (const li of output.line_items ?? []) {
        rows.push(
          toCSVRow([
            li.location?.page_number ?? "",
            li.canonical_type,
            `${li.task_code} ${li.confidence?.reasons?.join("; ") ?? ""}`.trim(),
            li.location?.bbox_norm?.x ?? "",
            li.location?.bbox_norm?.y ?? "",
            li.location?.bbox_norm?.w ?? "",
            li.location?.bbox_norm?.h ?? "",
            "", // color (optional)
            li.confidence?.overall ?? "",
          ])
        );
      }

      return { csv: rows.join("\n"), filename: `bluebeam_markups_run_${input.runId}.csv` };
    }),

  /**
   * Bluebeam takeoff CSV — for estimating import
   */
  exportBluebeamTakeoff: adminProcedure
    .input(z.object({ runId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [run] = await db.select().from(estimateChainRuns).where(eq(estimateChainRuns.id, input.runId)).limit(1);
      if (!run || run.status !== "completed") throw new TRPCError({ code: "NOT_FOUND", message: "Completed run not found" });

      const output = run.outputJson as any;
      const header = ["canonical_type", "count", "labor_hours", "waste_factor", "adjusted_qty", "notes"];
      const rows = [toCSVRow(header)];

      for (const r of output.rollups?.by_canonical_type ?? []) {
        const canonDef = loadTaskLibrary().canonical[r.canonical_type];
        const task = canonDef?.tasks?.[0];
        rows.push(
          toCSVRow([
            r.canonical_type,
            r.count,
            r.labor_hours,
            task?.waste_factor ?? "",
            r.count, // discrete items
            canonDef?.description ?? "",
          ])
        );
      }

      return { csv: rows.join("\n"), filename: `bluebeam_takeoff_run_${input.runId}.csv` };
    }),

  // -------------------------------------------------------------------------
  // Task Library Info
  // -------------------------------------------------------------------------

  /**
   * Get the loaded task library info + canonical types
   */
  getTaskLibrary: adminProcedure.query(async () => {
    const lib = loadTaskLibrary();
    return {
      name: lib.library.name,
      version: lib.library.version,
      canonicalTypes: Object.entries(lib.canonical).map(([key, def]) => ({
        type: key,
        category: def.category,
        description: def.description,
        taskCount: def.tasks.length,
        primaryTask: def.tasks[0]?.task_code ?? null,
      })),
      defaults: lib.defaults,
    };
  }),

  /**
   * Get schema hash for EstimateChainV1
   */
  getContractInfo: adminProcedure.query(async () => {
    const freeze = getFreezeStatus();
    return {
      contractName: "EstimateChainV1",
      contractVersion: "1.0.0",
      schemaHash: getEstimateSchemaHash(),
      taskLibrary: loadTaskLibrary().library,
      freeze: {
        frozen: freeze.frozen,
        vertex: freeze.vertex,
        version: freeze.version,
        frozenAt: freeze.frozenAt,
      },
    };
  }),

  // -------------------------------------------------------------------------
  // Project Task Overrides CRUD
  // -------------------------------------------------------------------------

  listOverrides: adminProcedure
    .input(z.object({ projectId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      return db.select().from(projectTaskOverrides).where(eq(projectTaskOverrides.projectId, input.projectId));
    }),

  createOverride: adminProcedure
    .input(
      z.object({
        projectId: z.number(),
        documentId: z.number().optional(),
        canonicalType: z.string(),
        taskCode: z.string(),
        laborFactorOverride: z.number().optional(),
        wasteFractorOverride: z.number().optional(),
        crewOverride: z.string().optional(),
        materialCostOverrides: z.record(z.string(), z.number()).optional(),
        laborRateOverride: z.number().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [result] = await db.insert(projectTaskOverrides).values({
        projectId: input.projectId,
        documentId: input.documentId ?? null,
        canonicalType: input.canonicalType,
        taskCode: input.taskCode,
        laborFactorOverride: input.laborFactorOverride ?? null,
        wasteFractorOverride: input.wasteFractorOverride ?? null,
        crewOverride: input.crewOverride ?? null,
        materialCostOverrides: input.materialCostOverrides ?? null,
        laborRateOverride: input.laborRateOverride ?? null,
        notes: input.notes ?? null,
        createdBy: (ctx as any).user?.id ?? 0,
      });

      return { id: Number(result.insertId) };
    }),

  deleteOverride: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(projectTaskOverrides).where(eq(projectTaskOverrides.id, input.id));
      return { deleted: true };
    }),
});
