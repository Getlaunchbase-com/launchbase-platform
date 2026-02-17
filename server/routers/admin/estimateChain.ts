/**
 * EstimateChainV1 — tRPC Router
 *
 * Deterministic pipeline: mapped detections → takeoff → estimate line items → exports.
 *
 *   - runEstimateChain: execute full chain for a document + symbol pack
 *   - listRuns / getRun: query stored runs
 *   - exportExcel: 3-sheet Excel (Takeoff_Summary, Line_Items, Assumptions)
 *   - exportBluebeamMarkups / exportBluebeamTakeoff: Bluebeam CSVs
 *   - overrides CRUD: project-scoped task library overrides
 *
 * All procedures use adminProcedure — requires authenticated admin role.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  blueprintDocuments,
  blueprintPages,
  blueprintDetectionsRaw,
  blueprintSymbolPacks,
  estimateChainRuns,
  projectTaskOverrides,
} from "../../db/schema";
import { desc, eq, and, count, sql, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";
import { getFreezeStatus } from "../../contracts/freeze_governance";

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
// Schema hash for EstimateChainV1
// ---------------------------------------------------------------------------

let _cachedEstimateSchemaHash: string | null = null;

function getEstimateSchemaHash(): string {
  if (_cachedEstimateSchemaHash) return _cachedEstimateSchemaHash;
  const schemaPath = path.resolve(__dirname, "../../contracts/EstimateChainV1.schema.json");
  const content = fs.readFileSync(schemaPath, "utf-8");
  _cachedEstimateSchemaHash = createHash("sha256").update(content).digest("hex");
  return _cachedEstimateSchemaHash;
}

// ---------------------------------------------------------------------------
// Confidence propagation
// ---------------------------------------------------------------------------

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function computeConfidence(detectionConf: number, mappingApproved: boolean, isStandardTask: boolean): {
  detection: number;
  mapping: number;
  rules: number;
  overall: number;
  reasons: string[];
} {
  const mapping = mappingApproved ? 0.95 : 0.6;
  const rules = isStandardTask ? 0.98 : 0.85;
  const overall = clamp01(detectionConf * mapping * rules);
  const reasons: string[] = [];
  if (overall >= 0.8) reasons.push("OK");
  if (detectionConf < 0.6) reasons.push("LOW_DETECTION_CONF");
  if (!mappingApproved) reasons.push("MAPPING_NOT_APPROVED");
  if (!isStandardTask) reasons.push("NON_STANDARD_TASK");
  return { detection: detectionConf, mapping, rules, overall, reasons };
}

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
   * Run full estimate chain for a document
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

      const mappings = (pack.mappings ?? []) as Array<{ rawClass: string; canonicalType: string }>;
      const rawToCanonical = new Map(mappings.map((m) => [m.rawClass, m.canonicalType]));

      // 3. Load task library
      const taskLib = loadTaskLibrary();

      // 4. Load project overrides if applicable
      const projectId = input.projectId ?? (doc as any).projectId;
      let overrides: Array<{ canonicalType: string; taskCode: string; laborFactorOverride: number | null; wasteFractorOverride: number | null; crewOverride: string | null; materialCostOverrides: Record<string, number> | null; laborRateOverride: number | null }> = [];
      if (projectId) {
        overrides = await db
          .select()
          .from(projectTaskOverrides)
          .where(eq(projectTaskOverrides.projectId, projectId));
      }
      const overrideMap = new Map(overrides.map((o) => [`${o.canonicalType}::${o.taskCode}`, o]));

      // 5. Load all mapped detections for this document
      const detections = await db
        .select()
        .from(blueprintDetectionsRaw)
        .where(
          and(
            eq(blueprintDetectionsRaw.documentId, input.documentId),
            inArray(blueprintDetectionsRaw.status, ["mapped", "verified"])
          )
        );

      // 6. Load pages for sheet labels
      const pages = await db
        .select()
        .from(blueprintPages)
        .where(eq(blueprintPages.documentId, input.documentId));
      const pageMap = new Map(pages.map((p) => [p.id, p]));

      // 7. Create run record
      const schemaHash = getEstimateSchemaHash();
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

      // 8. Build line items
      const lineItems: any[] = [];
      const unmappedClasses = new Set<string>();
      const lowConfItems: any[] = [];
      const errors: any[] = [];
      let lineCounter = 0;

      const globalLaborFactor = input.laborFactor ?? taskLib.defaults.labor_factor;

      for (const det of detections) {
        const canonicalType = det.canonicalType ?? rawToCanonical.get(det.rawClass);
        if (!canonicalType) {
          unmappedClasses.add(det.rawClass);
          continue;
        }

        const canonDef = taskLib.canonical[canonicalType];
        if (!canonDef || canonDef.tasks.length === 0) {
          errors.push({
            code: "NO_TASK_DEF",
            message: `No task definition for canonical type '${canonicalType}'`,
            details: { rawClass: det.rawClass, canonicalType },
          });
          continue;
        }

        const task = canonDef.tasks[0]; // Use first/primary task
        const overrideKey = `${canonicalType}::${task.task_code}`;
        const override = overrideMap.get(overrideKey);

        const laborFactor = override?.laborFactorOverride ?? globalLaborFactor;
        const wasteFactor = override?.wasteFractorOverride ?? input.wasteFactor ?? task.waste_factor;
        const crew = override?.crewOverride ?? task.crew;
        const laborHours = task.base_hours * laborFactor;

        const mappingApproved = det.status === "verified";
        const conf = computeConfidence(det.confidence, mappingApproved, true);

        const page = pageMap.get(det.pageId);
        const lineId = `LI-${String(++lineCounter).padStart(6, "0")}`;

        const materials = task.materials.map((mat) => {
          const qty = mat.qty_per_ea * 1; // count = 1 per detection
          const qtyWithWaste = qty * (1 + wasteFactor);
          return {
            material_code: mat.material_code,
            qty: parseFloat(qty.toFixed(4)),
            uom: mat.uom,
            waste_factor: wasteFactor,
            qty_with_waste: parseFloat(qtyWithWaste.toFixed(4)),
          };
        });

        // Pricing (null unless overrides provide costs)
        const laborRate = override?.laborRateOverride ?? null;
        const materialCostOverrides = override?.materialCostOverrides ?? {};
        let materialCost: number | null = null;
        const hasMaterialCosts = Object.keys(materialCostOverrides).length > 0;
        if (hasMaterialCosts) {
          materialCost = materials.reduce((sum, m) => {
            const unitCost = materialCostOverrides[m.material_code] ?? 0;
            return sum + m.qty_with_waste * unitCost;
          }, 0);
          materialCost = parseFloat(materialCost.toFixed(2));
        }
        const laborCost = laborRate ? parseFloat((laborHours * laborRate).toFixed(2)) : null;
        const total = materialCost !== null && laborCost !== null ? parseFloat((materialCost + laborCost).toFixed(2)) : null;

        const lineItem = {
          line_id: lineId,
          canonical_type: canonicalType,
          task_code: task.task_code,
          location: {
            sheet: (page as any)?.label ?? null,
            page_number: (page as any)?.pageNumber ?? 1,
            zone: null,
            bbox_norm: { x: det.x, y: det.y, w: det.w, h: det.h },
          },
          quantity: { count: 1, uom: "ea" },
          labor: {
            base_hours: task.base_hours,
            factor: laborFactor,
            hours: parseFloat(laborHours.toFixed(4)),
            crew,
            basis: task.basis,
          },
          materials,
          pricing: {
            material_cost: materialCost,
            labor_rate: laborRate,
            total,
          },
          confidence: conf,
          provenance: {
            raw_detection_id: det.id,
            raw_class: det.rawClass,
            detection_model_version: "unknown",
            mapping_version: `symbol_pack:${input.symbolPackId}`,
            rule_version: `${taskLib.library.name}@${taskLib.library.version}`,
          },
        };

        lineItems.push(lineItem);

        if (conf.overall < 0.6) {
          lowConfItems.push({
            line_id: lineId,
            overall: conf.overall,
            reason: conf.reasons.filter((r) => r !== "OK").join(", ") || "LOW_OVERALL",
          });
        }
      }

      // 9. Build rollups
      const byCanonical = new Map<string, { count: number; labor_hours: number }>();
      const materialTotals = new Map<string, { qty_with_waste: number; uom: string }>();

      for (const li of lineItems) {
        const key = li.canonical_type;
        const existing = byCanonical.get(key) ?? { count: 0, labor_hours: 0 };
        existing.count += li.quantity.count;
        existing.labor_hours += li.labor.hours;
        byCanonical.set(key, existing);

        for (const mat of li.materials) {
          const mk = mat.material_code;
          const existingMat = materialTotals.get(mk) ?? { qty_with_waste: 0, uom: mat.uom };
          existingMat.qty_with_waste += mat.qty_with_waste;
          materialTotals.set(mk, existingMat);
        }
      }

      const laborTotalHours = lineItems.reduce((s, li) => s + li.labor.hours, 0);

      // 10. Build gap flags
      const gapFlags: string[] = [];
      if (unmappedClasses.size > 0) gapFlags.push("LEGEND_HAS_UNMAPPED");
      if (lowConfItems.length > lineItems.length * 0.2) gapFlags.push("HIGH_LOW_CONFIDENCE_RATIO");

      // 11. Build assumptions
      const assumptions = [
        {
          id: "A-001",
          title: "Default waste factor",
          value: input.wasteFactor ?? taskLib.defaults.waste_factor,
          source: input.wasteFactor ? "operator_override" : "task_library.default_waste",
          locked: !input.wasteFactor,
        },
        {
          id: "A-002",
          title: "Global labor factor",
          value: globalLaborFactor,
          source: input.laborFactor ? "operator_override" : "task_library.default_labor_factor",
          locked: !input.laborFactor,
        },
        {
          id: "A-003",
          title: "Task library version",
          value: `${taskLib.library.name}@${taskLib.library.version}`,
          source: "system",
          locked: true,
        },
      ];

      // 12. Assemble output
      const output = {
        contract: {
          name: "EstimateChainV1",
          version: "1.0.0",
          schema_hash: schemaHash,
          producer: {
            runtime: "launchbase-platform",
            tool: "estimate_chain_run",
            tool_version: `run:${runId}`,
          },
        },
        context: {
          project_id: String(projectId ?? ""),
          document_id: String(input.documentId),
          symbol_pack_id: String(input.symbolPackId),
          task_library_id: taskLib.library.name,
          currency: "USD",
          units: { length: "ft", time: "hr" },
        },
        assumptions,
        line_items: lineItems,
        rollups: {
          by_canonical_type: Array.from(byCanonical.entries()).map(([k, v]) => ({
            canonical_type: k,
            count: v.count,
            labor_hours: parseFloat(v.labor_hours.toFixed(4)),
          })),
          labor_total_hours: parseFloat(laborTotalHours.toFixed(4)),
          material_totals: Array.from(materialTotals.entries()).map(([k, v]) => ({
            material_code: k,
            qty_with_waste: parseFloat(v.qty_with_waste.toFixed(4)),
            uom: v.uom,
          })),
        },
        quality: {
          unmapped_classes: Array.from(unmappedClasses),
          low_confidence_items: lowConfItems,
          gap_flags: gapFlags,
        },
        errors,
      };

      // 13. Update run record
      await db
        .update(estimateChainRuns)
        .set({
          outputJson: output as any,
          totalLineItems: lineItems.length,
          totalLaborHours: parseFloat(laborTotalHours.toFixed(2)),
          unmappedClassCount: unmappedClasses.size,
          lowConfidenceCount: lowConfItems.length,
          gapFlagCount: gapFlags.length,
          status: "completed",
          completedAt: new Date(),
        })
        .where(eq(estimateChainRuns.id, Number(runId)));

      return { runId: Number(runId), output };
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
