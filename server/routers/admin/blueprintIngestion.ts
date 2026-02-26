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
const AGENT_ROUTER_TOKEN =
  process.env.AGENT_ROUTER_TOKEN || process.env.AGENT_STACK_TOKEN || "";
const AGENT_WORKSPACE_ID = process.env.AGENT_WORKSPACE_ID || "launchbase-platform";

/** Clamp a bbox coordinate to normalized 0-1 range */
function clampNorm(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Mark a document as failed with an error message */
async function markFailed(db: any, documentId: number, errorMessage: string) {
  try {
    await db
      .update(blueprintDocuments)
      .set({ status: "failed", errorMessage })
      .where(eq(blueprintDocuments.id, documentId));
  } catch {
    // best-effort
  }
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

type AgentToolResponse = Record<string, unknown>;

function unwrapToolPayload(body: AgentToolResponse): AgentToolResponse {
  if (body.result && typeof body.result === "object") return body.result as AgentToolResponse;
  if (body.data && typeof body.data === "object") return body.data as AgentToolResponse;
  if (body.json && typeof body.json === "object") return body.json as AgentToolResponse;
  return body;
}

async function callAgentTool(
  agentUrl: string,
  name: string,
  argumentsPayload: Record<string, unknown>,
  timeoutMs = 120_000
): Promise<AgentToolResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${agentUrl.replace(/\/+$/, "")}/tool`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(AGENT_ROUTER_TOKEN ? { "x-router-token": AGENT_ROUTER_TOKEN } : {}),
      },
      body: JSON.stringify({ name, arguments: argumentsPayload }),
    });

    const body = (await resp.json().catch(() => ({}))) as AgentToolResponse;
    if (!resp.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Agent tool ${name} failed with HTTP ${resp.status}`,
        cause: body,
      });
    }

    if (body.ok === false) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: typeof body.message === "string" ? body.message : `Agent tool ${name} returned failure`,
        cause: body,
      });
    }

    return unwrapToolPayload(body);
  } catch (err) {
    if (err instanceof TRPCError) throw err;
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: `Agent tool ${name} request failed`,
      cause: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timeout);
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
            meta: z.record(z.string(), z.unknown()).optional(),
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

  /**
   * Run the full ingestion pipeline on a document.
   *
   * Orchestration flow:
   *   1. Mark document as "parsing"
   *   2. Call agent-stack POST /tools/blueprint-parse with document artifact
   *   3. Validate agent response against BlueprintParseV1 schema
   *   4. Store pages (with rendered images if provided)
   *   5. Store text blocks with normalized bboxes
   *   6. Call agent-stack POST /tools/blueprint-detect for symbol detection
   *   7. Store raw detections with normalized bboxes
   *   8. Store legend candidates
   *   9. Persist contract metadata on the document
   *  10. Mark document as "detection_complete" (ready)
   *
   * Platform does NOT compute — it orchestrates agent tool calls
   * and validates + stores the results.
   */
  runPipeline: adminProcedure
    .input(
      z.object({
        documentId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const AGENT_URL = process.env.AGENT_STACK_URL ?? "http://localhost:4100";
      const AGENT_TIMEOUT = 120_000; // 2 min per tool call

      // --- 1. Load and validate document ---
      const [doc] = await db
        .select()
        .from(blueprintDocuments)
        .where(eq(blueprintDocuments.id, input.documentId))
        .limit(1);

      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
      }

      if (!doc.artifactId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document has no linked artifact. Upload a file first.",
        });
      }

      // Load artifact to get storage path
      const [artifact] = await db
        .select()
        .from(agentArtifacts)
        .where(eq(agentArtifacts.id, doc.artifactId))
        .limit(1);

      if (!artifact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Linked artifact not found" });
      }

      // --- 2. Mark as parsing ---
      await db
        .update(blueprintDocuments)
        .set({ status: "parsing" })
        .where(eq(blueprintDocuments.id, input.documentId));

      try {
        // --- 3. Call agent-stack: parse ---
        const parseOutput = await callAgentTool(
          AGENT_URL,
          "blueprint_parse_document",
          {
            workspace: AGENT_WORKSPACE_ID,
            pdf_path: artifact.storagePath,
          },
          AGENT_TIMEOUT
        );

        // --- 4. Validate against BlueprintParseV1 schema ---
        const validation = validateBlueprintParseV1(parseOutput);
        if (!validation.valid) {
          await markFailed(db, input.documentId,
            `BlueprintParseV1 validation failed: ${validation.errors.map((e) => e.message).join("; ")}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Agent output failed BlueprintParseV1 validation: ${validation.errors.length} error(s)`,
            cause: { errors: validation.errors.slice(0, 20) },
          });
        }

        const parsed = parseOutput as BlueprintParseV1Output;

        // Enforce contract identity
        if (parsed.contract.name !== "BlueprintParseV1") {
          await markFailed(db, input.documentId, `Wrong contract name: ${parsed.contract.name}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Expected contract "BlueprintParseV1", got "${parsed.contract.name}"`,
          });
        }

        if (!/^1\.\d+\.\d+$/.test(parsed.contract.version)) {
          await markFailed(db, input.documentId, `Bad contract version: ${parsed.contract.version}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Contract version must match ^1.x.x, got "${parsed.contract.version}"`,
          });
        }

        // --- 4b. Verify schema hash matches platform (drift detection) ---
        const platformHash = getSchemaHash();
        if (parsed.contract.schema_hash !== platformHash) {
          await markFailed(db, input.documentId,
            `Schema hash mismatch: agent=${parsed.contract.schema_hash.slice(0, 16)}… platform=${platformHash.slice(0, 16)}…`);
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Contract schema hash mismatch — agent and platform schemas have drifted. Redeploy or update contracts.",
          });
        }

        // --- 5. Store pages ---
        const pageIdMap = new Map<number, number>();

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

        // --- 6. Store text blocks (normalized bboxes 0-1) ---
        if (parsed.text_blocks.length > 0) {
          const textBlockValues = parsed.text_blocks.map((tb) => ({
            pageId: pageIdMap.get(tb.page) ?? 0,
            x: clampNorm(tb.bbox.x),
            y: clampNorm(tb.bbox.y),
            w: clampNorm(tb.bbox.w),
            h: clampNorm(tb.bbox.h),
            text: tb.text,
            confidence: tb.confidence,
            blockType: tb.type as "title" | "label" | "dimension" | "note" | "legend_text" | "other",
          }));

          for (let i = 0; i < textBlockValues.length; i += 100) {
            await db.insert(blueprintTextBlocks).values(textBlockValues.slice(i, i + 100));
          }

          for (const pageId of pageIdMap.values()) {
            await db
              .update(blueprintPages)
              .set({ textExtracted: true })
              .where(eq(blueprintPages.id, pageId));
          }
        }

        // --- 7. Store legend candidates ---
        if (parsed.legend_candidates.length > 0) {
          await db.insert(blueprintLegendEntries).values(
            parsed.legend_candidates.map((lc) => ({
              documentId: input.documentId,
              pageId: pageIdMap.get(lc.page) ?? null,
              symbolDescription: lc.symbol_description ?? lc.method,
              rawLabel: lc.raw_label ?? "unknown",
              x: clampNorm(lc.bbox.x),
              y: clampNorm(lc.bbox.y),
              w: clampNorm(lc.bbox.w),
              h: clampNorm(lc.bbox.h),
            }))
          );
        }

        // --- 8. Update document status to "parsed" + store contract metadata ---
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

        // --- 9. Call agent-stack: symbol detection ---
        let detections: Array<{
          page_number: number;
          x: number; y: number; w: number; h: number;
          raw_class: string;
          confidence: number;
        }> = [];

        const detectData = await callAgentTool(
          AGENT_URL,
          "blueprint_detect_symbols",
          {
            workspace: AGENT_WORKSPACE_ID,
            pdf_path: artifact.storagePath,
          },
          AGENT_TIMEOUT
        );

        // --- 9b. Validate detection output structure ---
        const detectList = (detectData as any)?.detections;
        if (!Array.isArray(detectList)) {
          await markFailed(db, input.documentId, "Detection output missing 'detections' array");
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Agent detection output is invalid — missing 'detections' array",
          });
        }

        for (let i = 0; i < Math.min(detectList.length, 10); i++) {
          const d = detectList[i];
          if (typeof d.page_number !== "number" || typeof d.x !== "number" ||
              typeof d.y !== "number" || typeof d.w !== "number" ||
              typeof d.h !== "number" || typeof d.raw_class !== "string" ||
              typeof d.confidence !== "number") {
            await markFailed(db, input.documentId,
              `Detection[${i}] has invalid structure — missing required fields`);
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: `Agent detection output[${i}] is malformed — required: page_number, x, y, w, h, raw_class, confidence`,
            });
          }
        }

        detections = detectList as typeof detections;

        // --- 10. Store raw detections with normalized bboxes ---
        if (detections.length > 0) {
          await db
            .update(blueprintDocuments)
            .set({ status: "detection_running" })
            .where(eq(blueprintDocuments.id, input.documentId));

          const detectionValues = detections.map((d) => ({
            pageId: pageIdMap.get(d.page_number) ?? 0,
            documentId: input.documentId,
            x: clampNorm(d.x),
            y: clampNorm(d.y),
            w: clampNorm(d.w),
            h: clampNorm(d.h),
            rawClass: d.raw_class,
            confidence: Math.max(0, Math.min(1, d.confidence)),
            status: "raw" as const,
          }));

          for (let i = 0; i < detectionValues.length; i += 100) {
            await db.insert(blueprintDetectionsRaw).values(detectionValues.slice(i, i + 100));
          }

          await db
            .update(blueprintDocuments)
            .set({ status: "detection_complete" })
            .where(eq(blueprintDocuments.id, input.documentId));
        }

        // --- 11. Mark document ready — verify completeness ---
        const finalPageCount = pageIdMap.size;
        const finalDetectionCount = detections.length;
        const finalStatus = finalDetectionCount > 0 ? "detection_complete" : "parsed";

        // Readiness check: pages must exist, contract metadata must be set
        if (finalPageCount === 0) {
          await markFailed(db, input.documentId, "Pipeline completed but no pages were stored");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Pipeline integrity check failed: zero pages stored",
          });
        }

        return {
          documentId: input.documentId,
          status: finalStatus,
          contractName: parsed.contract.name,
          contractVersion: parsed.contract.version,
          schemaHash: parsed.contract.schema_hash,
          pagesIngested: parsed.pages.length,
          textBlocksIngested: parsed.text_blocks.length,
          legendCandidatesIngested: parsed.legend_candidates.length,
          detectionsIngested: detections.length,
          platformSchemaHash: getSchemaHash(),
        };
      } catch (err) {
        // If it's already a TRPCError, rethrow
        if (err instanceof TRPCError) throw err;

        // Unexpected error — mark as failed
        await markFailed(db, input.documentId, `Pipeline error: ${(err as Error).message}`);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Pipeline failed: ${(err as Error).message}`,
        });
      }
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

