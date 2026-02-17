/**
 * Gap Detection — tRPC Router
 *
 * Surfaces potential gaps in blueprint analysis:
 *   - runGapDetection: execute all G1-G6 rules for a document
 *   - getGapHistory: retrieve past gap detection results
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
  blueprintLegendEntries,
  blueprintSymbolPacks,
  estimateChainRuns,
} from "../../db/schema";
import { desc, eq, and } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { runGapDetection, type GapDetectionInput, type GapFlag } from "../../contracts/gap_detection_rules";

export const gapDetectionRouter = router({
  /**
   * Run gap detection for a document
   */
  analyze: adminProcedure
    .input(
      z.object({
        documentId: z.number(),
        symbolPackId: z.number(),
        estimateRunId: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      // Load document
      const [doc] = await db.select().from(blueprintDocuments).where(eq(blueprintDocuments.id, input.documentId)).limit(1);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Load all data in parallel
      const [legendEntries, detections, pages, packRows] = await Promise.all([
        db.select().from(blueprintLegendEntries).where(eq(blueprintLegendEntries.documentId, input.documentId)),
        db.select().from(blueprintDetectionsRaw).where(eq(blueprintDetectionsRaw.documentId, input.documentId)),
        db.select().from(blueprintPages).where(eq(blueprintPages.documentId, input.documentId)),
        db.select().from(blueprintSymbolPacks).where(eq(blueprintSymbolPacks.id, input.symbolPackId)),
      ]);

      const pack = packRows[0];
      if (!pack) throw new TRPCError({ code: "NOT_FOUND", message: "Symbol pack not found" });

      const mappings = (pack.mappings ?? []) as Array<{ rawClass: string; canonicalType: string }>;

      // Load estimate line items if a run is specified
      let estimateLineItems: GapDetectionInput["estimateLineItems"] = undefined;
      if (input.estimateRunId) {
        const [run] = await db
          .select()
          .from(estimateChainRuns)
          .where(eq(estimateChainRuns.id, input.estimateRunId))
          .limit(1);
        if (run?.outputJson) {
          const output = run.outputJson as any;
          estimateLineItems = output.line_items?.map((li: any) => ({
            line_id: li.line_id,
            canonical_type: li.canonical_type,
            confidence: li.confidence,
          }));
        }
      }

      // Load all symbol packs for this project (for G6 drift detection)
      const projectId = (doc as any).projectId;
      let allProjectSymbolPacks: GapDetectionInput["allProjectSymbolPacks"] = undefined;
      if (projectId) {
        // Get all packs that have been used in runs for this project
        const projectRuns = await db
          .select({ symbolPackId: estimateChainRuns.symbolPackId })
          .from(estimateChainRuns)
          .where(eq(estimateChainRuns.projectId, projectId));

        const usedPackIds = [...new Set(projectRuns.map((r) => r.symbolPackId))];
        if (usedPackIds.length >= 2) {
          const allPacks = await db.select().from(blueprintSymbolPacks);
          allProjectSymbolPacks = allPacks
            .filter((p) => usedPackIds.includes(p.id))
            .map((p) => ({
              id: p.id,
              name: p.name,
              mappings: (p.mappings ?? []) as Array<{ rawClass: string; canonicalType: string }>,
            }));
        }
      }

      // Build gap detection input
      const gapInput: GapDetectionInput = {
        legendEntries: legendEntries.map((le) => ({
          id: le.id,
          rawLabel: le.rawLabel,
          canonicalType: le.canonicalType,
          symbolPackId: le.symbolPackId,
        })),
        detections: detections.map((d) => ({
          id: d.id,
          pageId: d.pageId,
          rawClass: d.rawClass,
          confidence: d.confidence,
          canonicalType: d.canonicalType,
          status: d.status,
        })),
        pages: pages.map((p) => ({
          id: p.id,
          pageNumber: p.pageNumber,
          label: p.label,
        })),
        symbolPackMappings: mappings,
        allProjectSymbolPacks,
        estimateLineItems,
      };

      // Run the gap detection engine
      const flags = runGapDetection(gapInput);

      return {
        documentId: input.documentId,
        symbolPackId: input.symbolPackId,
        estimateRunId: input.estimateRunId ?? null,
        analyzedAt: new Date().toISOString(),
        gap_flags: flags,
        summary: {
          total: flags.length,
          high: flags.filter((f) => f.severity === "high").length,
          medium: flags.filter((f) => f.severity === "medium").length,
          low: flags.filter((f) => f.severity === "low").length,
        },
      };
    }),

  /**
   * Quick gap check — lightweight version that only runs G1 and G2
   */
  quickCheck: adminProcedure
    .input(z.object({ documentId: z.number(), symbolPackId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });

      const [legendEntries, detections, packRows] = await Promise.all([
        db.select().from(blueprintLegendEntries).where(eq(blueprintLegendEntries.documentId, input.documentId)),
        db.select().from(blueprintDetectionsRaw).where(eq(blueprintDetectionsRaw.documentId, input.documentId)),
        db.select().from(blueprintSymbolPacks).where(eq(blueprintSymbolPacks.id, input.symbolPackId)),
      ]);

      const pack = packRows[0];
      const mappings = (pack?.mappings ?? []) as Array<{ rawClass: string; canonicalType: string }>;
      const packMap = new Set(mappings.map((m) => m.rawClass));

      const unmappedLegend = legendEntries.filter((le) => !le.canonicalType).length;
      const unmappedDetections = new Set(
        detections.filter((d) => !d.canonicalType && !packMap.has(d.rawClass)).map((d) => d.rawClass)
      ).size;

      return {
        unmapped_legend_count: unmappedLegend,
        unmapped_detection_classes: unmappedDetections,
        total_detections: detections.length,
        total_legend_entries: legendEntries.length,
        has_gaps: unmappedLegend > 0 || unmappedDetections > 0,
      };
    }),
});
