/**
 * Blueprint Ingestion Pipeline — tRPC Router
 *
 * Handles the full lifecycle of blueprint document processing:
 *   1. Upload → create blueprint_documents + blueprint_pages rows
 *   2. Parse  → call VM parse tool → extract text blocks, detect legend entries
 *   3. Detect → run vision model on each page → store raw detections
 *   4. Query  → list documents, pages, text blocks, detections with filters
 *
 * All procedures use adminProcedure — requires authenticated admin role.
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  blueprintDocuments,
  blueprintPages,
  blueprintTextBlocks,
  blueprintDetectionsRaw,
  blueprintLegendEntries,
  agentArtifacts,
  projects,
} from "../../db/schema";
import { desc, eq, and, count, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs";
import { TRPCError } from "@trpc/server";
import {
  validateBlueprintParseV1,
  getSchemaHash,
  type BlueprintParseV1Output,
} from "../../contracts/validateBlueprintParse";

// Storage config
const ARTIFACTS_DIR =
  process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// ---------------------------------------------------------------------------
// Ingestion Pipeline Router
// ---------------------------------------------------------------------------

export const blueprintIngestionRouter = router({
  // =========================================================================
  // 1. Document management
  // =========================================================================

  /** Create a new blueprint document from an uploaded artifact */
  createDocument: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        artifactId: z.number().int().optional(),
        filename: z.string().min(1).max(512),
        mimeType: z.string().max(128).default("application/pdf"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify project exists
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!project) throw new Error("Project not found");

      // If artifactId provided, verify it exists and belongs to project
      if (input.artifactId) {
        const [artifact] = await db
          .select({ id: agentArtifacts.id })
          .from(agentArtifacts)
          .where(
            and(
              eq(agentArtifacts.id, input.artifactId),
              eq(agentArtifacts.projectId, input.projectId)
            )
          )
          .limit(1);
        if (!artifact) throw new Error("Artifact not found or does not belong to project");
      }

      const userId = (ctx as any).user?.id ?? 0;

      const [result] = await db.insert(blueprintDocuments).values({
        projectId: input.projectId,
        artifactId: input.artifactId ?? null,
        filename: input.filename,
        mimeType: input.mimeType,
        pageCount: 0,
        status: "uploaded",
        uploadedBy: userId,
      });

      return { documentId: result.insertId, projectId: input.projectId };
    }),

  /** List blueprint documents for a project */
  listDocuments: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        status: z
          .enum(["uploaded", "parsing", "parsed", "detection_running", "detection_complete", "failed"])
          .optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { documents: [], total: 0 };

      const conditions: any[] = [eq(blueprintDocuments.projectId, input.projectId)];
      if (input.status) conditions.push(eq(blueprintDocuments.status, input.status));

      const where = and(...conditions);

      const rows = await db
        .select()
        .from(blueprintDocuments)
        .where(where)
        .orderBy(desc(blueprintDocuments.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      const [countResult] = await db
        .select({ total: count() })
        .from(blueprintDocuments)
        .where(where);

      return { documents: rows, total: countResult?.total ?? 0 };
    }),

  /** Get a single document with page summary */
  getDocument: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [doc] = await db
        .select()
        .from(blueprintDocuments)
        .where(eq(blueprintDocuments.id, input.documentId))
        .limit(1);

      if (!doc) return null;

      const pages = await db
        .select()
        .from(blueprintPages)
        .where(eq(blueprintPages.documentId, input.documentId))
        .orderBy(blueprintPages.pageNumber);

      // Get detection counts per page
      const detectionCounts = await db
        .select({
          pageId: blueprintDetectionsRaw.pageId,
          count: count(),
        })
        .from(blueprintDetectionsRaw)
        .where(eq(blueprintDetectionsRaw.documentId, input.documentId))
        .groupBy(blueprintDetectionsRaw.pageId);

      const detectionMap = new Map(detectionCounts.map((d) => [d.pageId, d.count]));

      return {
        ...doc,
        pages: pages.map((p) => ({
          ...p,
          detectionCount: detectionMap.get(p.id) ?? 0,
        })),
      };
    }),

  // =========================================================================
  // 2. Page management
  // =========================================================================

  /** Add pages to a document (called after PDF/image parsing) */
  addPages: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        pages: z.array(
          z.object({
            pageNumber: z.number().int().min(1),
            label: z.string().max(255).optional(),
            imageBase64: z.string().optional(), // base64 rendered page image
            imageWidth: z.number().int().optional(),
            imageHeight: z.number().int().optional(),
            meta: z.record(z.unknown()).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify document exists
      const [doc] = await db
        .select()
        .from(blueprintDocuments)
        .where(eq(blueprintDocuments.id, input.documentId))
        .limit(1);
      if (!doc) throw new Error("Document not found");

      const pageIds: number[] = [];

      for (const page of input.pages) {
        let imageStoragePath: string | null = null;

        // Store page image if provided
        if (page.imageBase64) {
          const imgBuffer = Buffer.from(page.imageBase64, "base64");
          const subdir = path.join("blueprints", String(doc.projectId), "pages");
          const fullDir = path.join(ARTIFACTS_DIR, subdir);
          ensureDir(fullDir);

          const imgName = `doc${input.documentId}_page${page.pageNumber}_${randomUUID().slice(0, 8)}.png`;
          imageStoragePath = path.join(subdir, imgName);
          fs.writeFileSync(path.join(ARTIFACTS_DIR, imageStoragePath), imgBuffer);
        }

        const [result] = await db.insert(blueprintPages).values({
          documentId: input.documentId,
          pageNumber: page.pageNumber,
          label: page.label ?? null,
          imageStoragePath,
          imageWidth: page.imageWidth ?? null,
          imageHeight: page.imageHeight ?? null,
          meta: (page.meta as any) ?? null,
        });
        pageIds.push(result.insertId);
      }

      // Update document page count and status
      await db
        .update(blueprintDocuments)
        .set({
          pageCount: input.pages.length,
          status: "parsed",
        })
        .where(eq(blueprintDocuments.id, input.documentId));

      return { documentId: input.documentId, pageIds };
    }),

  /** List pages for a document */
  listPages: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { pages: [] };

      const pages = await db
        .select()
        .from(blueprintPages)
        .where(eq(blueprintPages.documentId, input.documentId))
        .orderBy(blueprintPages.pageNumber);

      return { pages };
    }),

  // =========================================================================
  // 3. Text extraction
  // =========================================================================

  /** Store extracted text blocks for a page */
  addTextBlocks: adminProcedure
    .input(
      z.object({
        pageId: z.number().int(),
        blocks: z.array(
          z.object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            w: z.number().min(0).max(1),
            h: z.number().min(0).max(1),
            text: z.string().min(1),
            confidence: z.number().min(0).max(1).optional(),
            blockType: z
              .enum(["title", "label", "dimension", "note", "legend_text", "other"])
              .default("other"),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.blocks.length === 0) return { count: 0 };

      await db.insert(blueprintTextBlocks).values(
        input.blocks.map((b) => ({
          pageId: input.pageId,
          x: b.x,
          y: b.y,
          w: b.w,
          h: b.h,
          text: b.text,
          confidence: b.confidence ?? null,
          blockType: b.blockType,
        }))
      );

      // Mark page as text-extracted
      await db
        .update(blueprintPages)
        .set({ textExtracted: true })
        .where(eq(blueprintPages.id, input.pageId));

      return { count: input.blocks.length };
    }),

  /** Get text blocks for a page */
  getTextBlocks: adminProcedure
    .input(
      z.object({
        pageId: z.number().int(),
        blockType: z
          .enum(["title", "label", "dimension", "note", "legend_text", "other"])
          .optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { blocks: [] };

      const conditions: any[] = [eq(blueprintTextBlocks.pageId, input.pageId)];
      if (input.blockType) conditions.push(eq(blueprintTextBlocks.blockType, input.blockType));

      const blocks = await db
        .select()
        .from(blueprintTextBlocks)
        .where(and(...conditions))
        .orderBy(blueprintTextBlocks.y, blueprintTextBlocks.x);

      return { blocks };
    }),

  // =========================================================================
  // 4. Detection ingestion — store raw detections from vision model
  // =========================================================================

  /** Store raw detections for a page (from vision model output) */
  addDetections: adminProcedure
    .input(
      z.object({
        pageId: z.number().int(),
        documentId: z.number().int(),
        detections: z.array(
          z.object({
            x: z.number().min(0).max(1),
            y: z.number().min(0).max(1),
            w: z.number().min(0).max(1),
            h: z.number().min(0).max(1),
            rawClass: z.string().min(1).max(255),
            confidence: z.number().min(0).max(1),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.detections.length === 0) return { count: 0 };

      await db.insert(blueprintDetectionsRaw).values(
        input.detections.map((d) => ({
          pageId: input.pageId,
          documentId: input.documentId,
          x: d.x,
          y: d.y,
          w: d.w,
          h: d.h,
          rawClass: d.rawClass,
          confidence: d.confidence,
          status: "raw" as const,
        }))
      );

      // Update document status
      await db
        .update(blueprintDocuments)
        .set({ status: "detection_complete" })
        .where(eq(blueprintDocuments.id, input.documentId));

      return { count: input.detections.length };
    }),

  /** Get detections for a page (for overlay rendering) */
  getDetections: adminProcedure
    .input(
      z.object({
        pageId: z.number().int(),
        status: z.enum(["raw", "mapped", "verified", "rejected"]).optional(),
        minConfidence: z.number().min(0).max(1).optional(),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { detections: [] };

      const conditions: any[] = [eq(blueprintDetectionsRaw.pageId, input.pageId)];
      if (input.status) conditions.push(eq(blueprintDetectionsRaw.status, input.status));

      const rows = await db
        .select()
        .from(blueprintDetectionsRaw)
        .where(and(...conditions))
        .orderBy(blueprintDetectionsRaw.confidence);

      // Filter by confidence in JS (drizzle float comparison is tricky)
      const detections = input.minConfidence
        ? rows.filter((r) => (r.confidence ?? 0) >= input.minConfidence!)
        : rows;

      return { detections };
    }),

  /** Get detection summary for a document (counts per rawClass) */
  detectionSummary: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { classes: [], totalDetections: 0 };

      const classes = await db
        .select({
          rawClass: blueprintDetectionsRaw.rawClass,
          canonicalType: blueprintDetectionsRaw.canonicalType,
          count: count(),
        })
        .from(blueprintDetectionsRaw)
        .where(eq(blueprintDetectionsRaw.documentId, input.documentId))
        .groupBy(blueprintDetectionsRaw.rawClass, blueprintDetectionsRaw.canonicalType)
        .orderBy(desc(count()));

      const totalDetections = classes.reduce((sum, c) => sum + (c.count as number), 0);

      return { classes, totalDetections };
    }),

  // =========================================================================
  // 5. Full pipeline trigger — upload → parse → detect (orchestration)
  // =========================================================================

  /** Run the full ingestion pipeline on a document */
  runPipeline: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // Verify document exists
      const [doc] = await db
        .select()
        .from(blueprintDocuments)
        .where(eq(blueprintDocuments.id, input.documentId))
        .limit(1);
      if (!doc) throw new Error("Document not found");

      // Mark as parsing
      await db
        .update(blueprintDocuments)
        .set({ status: "parsing" })
        .where(eq(blueprintDocuments.id, input.documentId));

      // In production, this would:
      //   1. Call a VM parse tool (e.g. pdf2image, pdfplumber, or cloud vision API)
      //   2. Extract pages → render images → store as blueprint_pages
      //   3. Run OCR/text extraction → store as blueprint_text_blocks
      //   4. Run symbol detection model → store as blueprint_detections_raw
      //   5. Extract legend entries → store as blueprint_legend_entries
      //
      // For now, we create a placeholder pipeline run record and mark as parsed.
      // The actual parse + detection calls are made through the individual
      // addPages, addTextBlocks, addDetections endpoints.

      await db
        .update(blueprintDocuments)
        .set({ status: "parsed" })
        .where(eq(blueprintDocuments.id, input.documentId));

      return {
        documentId: input.documentId,
        status: "parsed",
        message: "Pipeline initialized. Use addPages, addTextBlocks, and addDetections to populate data.",
      };
    }),

  // =========================================================================
  // 6. Contract-validated ingest — accept VM parse output as BlueprintParseV1
  // =========================================================================

  /**
   * Ingest a complete VM parse output, validated against BlueprintParseV1.
   *
   * This is the primary ingestion endpoint. It:
   *   1. Validates the JSON against BlueprintParseV1 schema
   *   2. Enforces contract name = BlueprintParseV1, version = ^1.x.x
   *   3. Rejects invalid payloads with structured error (BAD_REQUEST)
   *   4. Stores pages, text blocks, legend candidates
   *   5. Persists contract metadata on the document for audit trail
   */
  ingestParseOutput: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        parseOutput: z.unknown(), // raw JSON from VM — validated at runtime
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      // --- 1. Validate against BlueprintParseV1 ---
      const validation = validateBlueprintParseV1(input.parseOutput);

      if (!validation.valid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `BlueprintParseV1 contract validation failed: ${validation.errors.length} error(s)`,
          cause: {
            contractName: validation.contractName ?? "unknown",
            contractVersion: validation.contractVersion ?? "unknown",
            errors: validation.errors.slice(0, 20), // cap to prevent oversize responses
          },
        });
      }

      // --- 2. Enforce contract identity ---
      const parsed = input.parseOutput as BlueprintParseV1Output;

      if (parsed.contract.name !== "BlueprintParseV1") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Expected contract "BlueprintParseV1", got "${parsed.contract.name}"`,
        });
      }

      if (!/^1\.\d+\.\d+$/.test(parsed.contract.version)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Contract version must match ^1.x.x, got "${parsed.contract.version}"`,
        });
      }

      if (!parsed.contract.schema_hash) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Contract schema_hash is required",
        });
      }

      // --- 3. Verify document exists ---
      const [doc] = await db
        .select()
        .from(blueprintDocuments)
        .where(eq(blueprintDocuments.id, input.documentId))
        .limit(1);

      if (!doc) throw new Error("Document not found");

      // --- 4. Store pages ---
      const pageIdMap = new Map<number, number>(); // page_number → DB id

      for (const page of parsed.pages) {
        let imageStoragePath: string | null = null;

        if (page.image_artifact_path) {
          imageStoragePath = page.image_artifact_path;
        }

        const [result] = await db.insert(blueprintPages).values({
          documentId: input.documentId,
          pageNumber: page.page_number,
          label: page.label ?? null,
          imageStoragePath,
          imageWidth: page.width_px,
          imageHeight: page.height_px,
          meta: null,
        });
        pageIdMap.set(page.page_number, result.insertId);
      }

      // --- 5. Store text blocks ---
      if (parsed.text_blocks.length > 0) {
        const textBlockValues = parsed.text_blocks.map((tb) => ({
          pageId: pageIdMap.get(tb.page) ?? 0,
          x: tb.bbox.x,
          y: tb.bbox.y,
          w: tb.bbox.w,
          h: tb.bbox.h,
          text: tb.text,
          confidence: tb.confidence,
          blockType: tb.type as "title" | "label" | "dimension" | "note" | "legend_text" | "other",
        }));

        // Insert in batches of 100 to avoid query size limits
        for (let i = 0; i < textBlockValues.length; i += 100) {
          await db.insert(blueprintTextBlocks).values(textBlockValues.slice(i, i + 100));
        }

        // Mark pages as text-extracted
        for (const pageId of pageIdMap.values()) {
          await db
            .update(blueprintPages)
            .set({ textExtracted: true })
            .where(eq(blueprintPages.id, pageId));
        }
      }

      // --- 6. Store legend candidates ---
      if (parsed.legend_candidates.length > 0) {
        await db.insert(blueprintLegendEntries).values(
          parsed.legend_candidates.map((lc) => ({
            documentId: input.documentId,
            pageId: pageIdMap.get(lc.page) ?? null,
            symbolDescription: lc.symbol_description ?? lc.method,
            rawLabel: lc.raw_label ?? "unknown",
            x: lc.bbox.x,
            y: lc.bbox.y,
            w: lc.bbox.w,
            h: lc.bbox.h,
          }))
        );
      }

      // --- 7. Store contract metadata on document ---
      await db
        .update(blueprintDocuments)
        .set({
          pageCount: parsed.document.page_count,
          status: "parsed",
          parseContractName: parsed.contract.name,
          parseContractVersion: parsed.contract.version,
          parseSchemaHash: parsed.contract.schema_hash,
          parseProducerJson: parsed.contract.producer as any,
          parsedAt: new Date(),
        })
        .where(eq(blueprintDocuments.id, input.documentId));

      return {
        documentId: input.documentId,
        contractName: parsed.contract.name,
        contractVersion: parsed.contract.version,
        schemaHash: parsed.contract.schema_hash,
        pagesIngested: parsed.pages.length,
        textBlocksIngested: parsed.text_blocks.length,
        legendCandidatesIngested: parsed.legend_candidates.length,
        scaleCandidatesFound: parsed.scale_candidates.length,
        parseErrors: parsed.errors.length,
        platformSchemaHash: getSchemaHash(),
      };
    }),

  /** Get the platform's current schema hash (for VM to compare) */
  getContractInfo: adminProcedure.query(async () => {
    return {
      contractName: "BlueprintParseV1",
      supportedVersions: "^1.0.0",
      platformSchemaHash: getSchemaHash(),
    };
  }),

  // =========================================================================
  // 7. Legend entries
  // =========================================================================

  /** Add legend entries for a document */
  addLegendEntries: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
        entries: z.array(
          z.object({
            pageId: z.number().int().optional(),
            symbolDescription: z.string().min(1).max(512),
            rawLabel: z.string().min(1).max(512),
            symbolImagePath: z.string().max(1024).optional(),
            x: z.number().min(0).max(1).optional(),
            y: z.number().min(0).max(1).optional(),
            w: z.number().min(0).max(1).optional(),
            h: z.number().min(0).max(1).optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      if (input.entries.length === 0) return { count: 0 };

      await db.insert(blueprintLegendEntries).values(
        input.entries.map((e) => ({
          documentId: input.documentId,
          pageId: e.pageId ?? null,
          symbolDescription: e.symbolDescription,
          rawLabel: e.rawLabel,
          symbolImagePath: e.symbolImagePath ?? null,
          x: e.x ?? null,
          y: e.y ?? null,
          w: e.w ?? null,
          h: e.h ?? null,
        }))
      );

      return { count: input.entries.length };
    }),

  /** List legend entries for a document */
  getLegendEntries: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { entries: [] };

      const entries = await db
        .select()
        .from(blueprintLegendEntries)
        .where(eq(blueprintLegendEntries.documentId, input.documentId))
        .orderBy(blueprintLegendEntries.rawLabel);

      return { entries };
    }),
});

export type BlueprintIngestionRouter = typeof blueprintIngestionRouter;
