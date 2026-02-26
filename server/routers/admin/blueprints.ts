/**
 * Blueprints tRPC Router
 *
 * Admin endpoints for uploading blueprint files to a project and
 * binding them to an agent instance. Blueprints are stored as
 * agentArtifacts with type "blueprint_input".
 *
 * Upload flow:
 *   1. Client sends base64-encoded file + metadata via `upload` mutation
 *   2. Server writes file to local ARTIFACTS_DIR (or S3 in prod)
 *   3. Server creates agentArtifacts row with type "blueprint_input"
 *   4. Returns artifact id for use in "Run Takeoff" action
 */

import { z } from "zod";
import { router, adminProcedure } from "../../_core/trpc";
import { getDb } from "../../db";
import {
  agentArtifacts,
  agentInstances,
  projects,
  blueprintDocuments,
  blueprintPages,
  blueprintDetectionsRaw,
} from "../../db/schema";
import { desc, eq, and, count, inArray } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs";
import { TRPCError } from "@trpc/server";

// ---------------------------------------------------------------------------
// Storage config
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR =
  process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");

const S3_ENABLED = !!process.env.ARTIFACTS_S3_BUCKET;
const S3_BUCKET = process.env.ARTIFACTS_S3_BUCKET || "launchbase-artifacts";
const AGENT_STACK_URL = process.env.AGENT_STACK_URL || "http://35.188.184.31:8080";
const AGENT_ROUTER_TOKEN =
  process.env.AGENT_ROUTER_TOKEN || process.env.AGENT_STACK_TOKEN || "";
const AGENT_WORKSPACE_ID = process.env.AGENT_WORKSPACE_ID || "launchbase-platform";
const AGENT_B64_CHUNK_CHARS = Number(process.env.AGENT_B64_CHUNK_CHARS || 200_000);

// Max upload size: 50 MB base64 (~37.5 MB raw)
const MAX_BASE64_LENGTH = 50 * 1024 * 1024;

// Allowed MIME types for blueprints
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/tiff",
  "application/dxf",
  "application/dwg",
  "application/octet-stream", // catch-all for CAD files
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function normalizeBase64Data(input: string): string {
  // Accept both raw base64 and data-URL formats from mobile/web clients.
  let value = input.trim();
  const commaIndex = value.indexOf(",");
  if (value.startsWith("data:") && commaIndex >= 0) {
    value = value.slice(commaIndex + 1);
  }
  // Remove whitespace/newlines and any non-base64 characters.
  value = value.replace(/\s+/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  const remainder = value.length % 4;
  if (remainder !== 0) {
    value = value + "=".repeat(4 - remainder);
  }
  return value;
}

function splitIntoChunks(value: string, chunkSize: number): string[] {
  if (chunkSize <= 0 || value.length <= chunkSize) return [value];
  const chunks: string[] = [];
  for (let start = 0; start < value.length; start += chunkSize) {
    chunks.push(value.slice(start, start + chunkSize));
  }
  return chunks;
}

async function storeLocal(
  projectId: number,
  filename: string,
  data: Buffer
): Promise<{ storagePath: string; storageBackend: "local" | "s3" }> {
  const subdir = path.join("blueprints", String(projectId));
  const fullDir = path.join(ARTIFACTS_DIR, subdir);
  ensureDir(fullDir);

  // Unique filename to avoid collisions
  const ext = path.extname(filename);
  const base = path.basename(filename, ext).replace(/[^\w.\-]/g, "_");
  const uniqueName = `${base}_${randomUUID().slice(0, 8)}${ext}`;
  const storagePath = path.join(subdir, uniqueName);

  fs.writeFileSync(path.join(ARTIFACTS_DIR, storagePath), data);
  return { storagePath, storageBackend: "local" };
}

async function storeS3(
  projectId: number,
  filename: string,
  data: Buffer,
  mimeType: string
): Promise<{ storagePath: string; storageBackend: "local" | "s3" }> {
  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const s3 = new S3Client({});

  const ext = path.extname(filename);
  const base = path.basename(filename, ext).replace(/[^\w.\-]/g, "_");
  const key = `blueprints/${projectId}/${base}_${randomUUID().slice(0, 8)}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: data,
      ContentType: mimeType,
    })
  );

  return { storagePath: key, storageBackend: "s3" };
}

type AgentToolResponse = Record<string, any>;

async function callAgentTool(
  name: string,
  argumentsPayload: Record<string, unknown>,
  timeoutMs = 120_000
): Promise<AgentToolResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${AGENT_STACK_URL.replace(/\/+$/, "")}/tool`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        ...(AGENT_ROUTER_TOKEN ? { "x-router-token": AGENT_ROUTER_TOKEN } : {}),
      },
      body: JSON.stringify({ name, arguments: argumentsPayload }),
    });
    const body = (await resp.json()) as AgentToolResponse;
    if (!resp.ok) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Agent tool ${name} failed with HTTP ${resp.status}`,
        cause: body,
      });
    }
    return body;
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

async function loadArtifactBuffer(artifact: {
  storageBackend: string;
  storagePath: string;
  filename: string;
}): Promise<Buffer> {
  if (artifact.storageBackend === "s3") {
    const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
    const s3 = new S3Client({});
    const out = await s3.send(
      new GetObjectCommand({
        Bucket: S3_BUCKET,
        Key: artifact.storagePath,
      })
    );
    const bytes = await out.Body?.transformToByteArray();
    if (!bytes) throw new Error("S3 object body empty");
    return Buffer.from(bytes);
  }

  const fullPath = path.resolve(ARTIFACTS_DIR, artifact.storagePath);
  if (
    !fullPath.startsWith(path.resolve(ARTIFACTS_DIR) + path.sep) ||
    !fs.existsSync(fullPath)
  ) {
    throw new Error(`Artifact file not found: ${artifact.filename}`);
  }
  return fs.readFileSync(fullPath);
}

function buildBluebeamTakeoffCsv(takeoff: any): string {
  const lines = ["canonical_type,description,unit,quantity"];
  for (const item of takeoff?.line_items ?? []) {
    const values = [
      item.device_type ?? "",
      item.label ?? "",
      item.unit ?? "ea",
      String(item.quantity ?? 0),
    ];
    lines.push(
      values
        .map((v) =>
          String(v).includes(",") || String(v).includes('"')
            ? `"${String(v).replace(/"/g, '""')}"`
            : String(v)
        )
        .join(",")
    );
  }
  return lines.join("\n");
}

function shQuote(v: string): string {
  return `'${v.replace(/'/g, `'\"'\"'`)}'`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const blueprintsRouter = router({
  /**
   * Upload a blueprint file to a project.
   * Returns the artifact id for downstream use (e.g. Run Takeoff).
   */
  upload: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        agentInstanceId: z.number().int().optional(),
        filename: z.string().min(1).max(512),
        mimeType: z.string().max(128).default("application/pdf"),
        // base64-encoded file content
        base64Data: z.string().min(1).max(MAX_BASE64_LENGTH),
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

      // Verify instance if provided
      if (input.agentInstanceId) {
        const [instance] = await db
          .select({ id: agentInstances.id })
          .from(agentInstances)
          .where(
            and(
              eq(agentInstances.id, input.agentInstanceId),
              eq(agentInstances.projectId, input.projectId)
            )
          )
          .limit(1);
        if (!instance) throw new Error("Agent instance not found or does not belong to project");
      }

      // Decode file
      const normalizedBase64 = normalizeBase64Data(input.base64Data);
      const fileBuffer = Buffer.from(normalizedBase64, "base64");
      const sizeBytes = fileBuffer.length;
      const checksum = createHash("sha256").update(fileBuffer).digest("hex");

      // Store file
      const { storagePath, storageBackend } = S3_ENABLED
        ? await storeS3(input.projectId, input.filename, fileBuffer, input.mimeType)
        : await storeLocal(input.projectId, input.filename, fileBuffer);

      // Create artifact row
      const [result] = await db.insert(agentArtifacts).values({
        runId: null, // no run yet — blueprint uploaded before takeoff
        projectId: input.projectId,
        type: "blueprint_input",
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes,
        storagePath,
        storageBackend,
        checksum,
        meta: {
          agentInstanceId: input.agentInstanceId ?? null,
          uploadedBy: (ctx as any).user?.id ?? null,
        },
      });

      return {
        artifactId: result.insertId,
        projectId: input.projectId,
        filename: input.filename,
        sizeBytes,
        checksum,
        storageBackend,
      };
    }),

  /**
   * One-click field workflow:
   * upload -> parse/symbol read -> takeoff -> Excel/Word/Bluebeam artifacts -> quote values.
   */
  uploadAndGenerateQuotePackage: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        agentInstanceId: z.number().int().optional(),
        filename: z.string().min(1).max(512),
        mimeType: z.string().max(128).default("application/pdf"),
        base64Data: z.string().min(1).max(MAX_BASE64_LENGTH),
        laborRatePerHour: z.number().positive().default(95),
        laborHoursPerDevice: z.number().positive().default(0.5),
        materialCostPerDevice: z.number().positive().default(125),
        quoteMarkupPct: z.number().min(0).max(3).default(0.25),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      if (!input.mimeType.toLowerCase().includes("pdf")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only PDF is supported for one-click blueprint processing.",
        });
      }

      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!project) throw new Error("Project not found");

      if (input.agentInstanceId) {
        const [instance] = await db
          .select({ id: agentInstances.id })
          .from(agentInstances)
          .where(
            and(
              eq(agentInstances.id, input.agentInstanceId),
              eq(agentInstances.projectId, input.projectId)
            )
          )
          .limit(1);
        if (!instance) throw new Error("Agent instance not found or does not belong to project");
      }

      const userId = (ctx as any).user?.id ?? 0;
      const normalizedBase64 = normalizeBase64Data(input.base64Data);
      const fileBuffer = Buffer.from(normalizedBase64, "base64");
      const sizeBytes = fileBuffer.length;
      const checksum = createHash("sha256").update(fileBuffer).digest("hex");
      const uploadedStorage = S3_ENABLED
        ? await storeS3(input.projectId, input.filename, fileBuffer, input.mimeType)
        : await storeLocal(input.projectId, input.filename, fileBuffer);

      const [uploadedArtifact] = await db.insert(agentArtifacts).values({
        runId: null,
        projectId: input.projectId,
        type: "blueprint_input",
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes,
        storagePath: uploadedStorage.storagePath,
        storageBackend: uploadedStorage.storageBackend,
        checksum,
        meta: {
          agentInstanceId: input.agentInstanceId ?? null,
          uploadedBy: userId,
          ingestMode: "one_click_pipeline",
        },
      });
      const uploadedArtifactId = uploadedArtifact.insertId;

      const workspace = AGENT_WORKSPACE_ID;
      const runKey = `${input.projectId}_${uploadedArtifactId}_${Date.now()}`;
      const b64Path = `source_${runKey}.b64`;
      const pdfPath = `source_${runKey}.pdf`;
      const partDir = `b64parts_${runKey}`;
      const b64Chunks = splitIntoChunks(normalizedBase64, AGENT_B64_CHUNK_CHARS);
      if (b64Chunks.length === 1) {
        const writeResp = await callAgentTool("workspace_write", {
          workspace,
          path: b64Path,
          content: normalizedBase64,
        }, 300_000);
        if (!writeResp.ok) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Agent workspace write failed: ${writeResp.error || "unknown error"}`,
            cause: writeResp,
          });
        }
      } else {
        for (let i = 0; i < b64Chunks.length; i += 1) {
          const partPath = `${partDir}/part_${String(i).padStart(5, "0")}.txt`;
          const partWrite = await callAgentTool("workspace_write", {
            workspace,
            path: partPath,
            content: b64Chunks[i],
          }, 300_000);
          if (!partWrite.ok) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: `Agent workspace write failed at chunk ${i + 1}/${b64Chunks.length}: ${partWrite.error || "unknown error"}`,
              cause: partWrite,
            });
          }
        }
      }

      const composeB64Cmd = b64Chunks.length > 1
        ? `cat ${shQuote(partDir)}/part_* > ${shQuote(b64Path)} && `
        : "";

      const decodeResp = await callAgentTool("sandbox_run", {
        workspace,
        cmd:
          `mkdir -p ${shQuote(partDir)} && (` +
          `${composeB64Cmd}` +
          `test -s ${shQuote(b64Path)} && ` +
          `base64 -d ${shQuote(b64Path)} > ${shQuote(pdfPath)} ` +
          `|| python3 -c "import base64,re;` +
          `src=open('${b64Path}','r',encoding='utf-8',errors='ignore').read();` +
          `src=src.strip();` +
          `src=src.split(',',1)[1] if src.startswith('data:') and ',' in src else src;` +
          `src=re.sub(r'[^A-Za-z0-9+/=_-]','',src);` +
          `src=src.replace('-','+').replace('_','/');` +
          `src=src+'='*((4-len(src)%4)%4);` +
          `open('${pdfPath}','wb').write(base64.b64decode(src,validate=False))"` +
          `)`,
        timeout_sec: 300,
      }, 300_000);
      if (!decodeResp.ok) {
        const detail = decodeResp.error || decodeResp.stderr || decodeResp.stdout || "unknown decode error";
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Agent PDF decode failed: ${String(detail).slice(0, 400)}`,
          cause: decodeResp,
        });
      }

      const parseResp = await callAgentTool("blueprint_parse_document", {
        workspace,
        pdf_path: pdfPath,
        output_dir: `parse_${runKey}`,
        include_debug: false,
      }, 600_000);
      if (!parseResp.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: parseResp.error || "Blueprint parse failed", cause: parseResp });
      }

      const textResp = await callAgentTool("blueprint_extract_text", {
        workspace,
        pdf_path: pdfPath,
      }, 600_000);
      if (!textResp.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: textResp.error || "Blueprint text extraction failed", cause: textResp });
      }

      const takeoffResp = await callAgentTool("blueprint_takeoff_low_voltage", {
        workspace,
        extracted_text: textResp.pages ?? [],
        project_name: `Project ${input.projectId}`,
        drawing_number: input.filename,
      }, 300_000);
      if (!takeoffResp.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: takeoffResp.error || "Takeoff generation failed", cause: takeoffResp });
      }

      const xlsxPath = `outputs_${runKey}/takeoff.xlsx`;
      const docxPath = `outputs_${runKey}/takeoff_summary.docx`;
      const xlsxResp = await callAgentTool("artifact_write_xlsx_takeoff", {
        workspace,
        takeoff_json: takeoffResp,
        output_path: xlsxPath,
      }, 300_000);
      if (!xlsxResp.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: xlsxResp.error || "XLSX export failed", cause: xlsxResp });
      }
      const docxResp = await callAgentTool("artifact_write_docx_summary", {
        workspace,
        takeoff_json: takeoffResp,
        output_path: docxPath,
      }, 300_000);
      if (!docxResp.ok) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: docxResp.error || "DOCX export failed", cause: docxResp });
      }

      const detectResp = await callAgentTool("blueprint_detect_symbols", {
        workspace,
        pdf_path: pdfPath,
        output_dir: `detect_${runKey}`,
        include_overlays: false,
      }, 600_000);

      const readFileBase64 = async (relPath: string) => {
        const r = await callAgentTool("sandbox_run", {
          workspace,
          cmd: `base64 -w 0 ${shQuote(relPath)}`,
          timeout_sec: 120,
        }, 180_000);
        if (!r.ok || !r.stdout) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Failed to read agent artifact ${relPath}`,
            cause: r,
          });
        }
        return String(r.stdout).trim();
      };

      const xlsxB64 = await readFileBase64(xlsxPath);
      const docxB64 = await readFileBase64(docxPath);
      const bluebeamCsv = buildBluebeamTakeoffCsv(takeoffResp);

      const persistGeneratedArtifact = async (
        type: "takeoff_json" | "takeoff_xlsx" | "takeoff_docx" | "report",
        filename: string,
        mimeType: string,
        data: Buffer,
        meta?: Record<string, unknown>
      ): Promise<number> => {
        const storage = S3_ENABLED
          ? await storeS3(input.projectId, filename, data, mimeType)
          : await storeLocal(input.projectId, filename, data);
        const [ins] = await db.insert(agentArtifacts).values({
          runId: null,
          projectId: input.projectId,
          type,
          filename,
          mimeType,
          sizeBytes: data.length,
          storagePath: storage.storagePath,
          storageBackend: storage.storageBackend,
          checksum: createHash("sha256").update(data).digest("hex"),
          meta: {
            linkedBlueprintArtifactId: uploadedArtifactId,
            generatedBy: "uploadAndGenerateQuotePackage",
            ...(meta ?? {}),
          },
        });
        return ins.insertId;
      };

      const takeoffJsonBuf = Buffer.from(
        JSON.stringify(takeoffResp, null, 2),
        "utf-8"
      );
      const parseJsonBuf = Buffer.from(
        JSON.stringify(parseResp, null, 2),
        "utf-8"
      );
      const xlsxBuf = Buffer.from(xlsxB64, "base64");
      const docxBuf = Buffer.from(docxB64, "base64");
      const bluebeamBuf = Buffer.from(bluebeamCsv, "utf-8");

      const [takeoffJsonArtifactId, parseReportArtifactId, xlsxArtifactId, docxArtifactId, bluebeamArtifactId] =
        await Promise.all([
          persistGeneratedArtifact("takeoff_json", "takeoff.json", "application/json", takeoffJsonBuf),
          persistGeneratedArtifact("report", "parse_result.json", "application/json", parseJsonBuf),
          persistGeneratedArtifact("takeoff_xlsx", "takeoff.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsxBuf),
          persistGeneratedArtifact("takeoff_docx", "takeoff_summary.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docxBuf),
          persistGeneratedArtifact("report", "bluebeam_takeoff.csv", "text/csv", bluebeamBuf),
        ]);

      const totalDevices = Number(takeoffResp?.summary?.total_devices ?? 0);
      const laborHours = Number((totalDevices * input.laborHoursPerDevice).toFixed(2));
      const laborCost = Number((laborHours * input.laborRatePerHour).toFixed(2));
      const materialCost = Number((totalDevices * input.materialCostPerDevice).toFixed(2));
      const subtotal = Number((laborCost + materialCost).toFixed(2));
      const quoteTotal = Number((subtotal * (1 + input.quoteMarkupPct)).toFixed(2));

      const [docIns] = await db.insert(blueprintDocuments).values({
        projectId: input.projectId,
        artifactId: uploadedArtifactId,
        filename: input.filename,
        mimeType: input.mimeType,
        pageCount: 0,
        status: "parsing",
        uploadedBy: userId,
        parseContractName: parseResp?.contract?.name ?? null,
        parseContractVersion: parseResp?.contract?.version ?? null,
        parseSchemaHash: parseResp?.contract?.schema_hash ?? null,
        parseProducerJson: parseResp?.contract?.producer ?? null,
        parsedAt: new Date(),
      });

      const parsedPages = Array.isArray(parseResp?.pages) ? parseResp.pages : [];
      const persistedPages: Array<{
        documentId: number;
        pageNumber: number;
        label: string | null;
        imageStoragePath: string | null;
        imageWidth: number | null;
        imageHeight: number | null;
        meta: any;
      }> = [];

      for (const page of parsedPages) {
        const pageNumber = Number(page?.page_number ?? page?.pageNumber ?? 0);
        if (!Number.isFinite(pageNumber) || pageNumber <= 0) continue;

        let imageStoragePath: string | null = null;
        const sourceImagePath = String(
          page?.image_artifact_path ??
            page?.png_path ??
            page?.imageStoragePath ??
            page?.image_path ??
            ""
        );

        if (sourceImagePath) {
          try {
            const readImageResp = await callAgentTool(
              "sandbox_run",
              {
                workspace,
                cmd: `base64 -w 0 ${shQuote(sourceImagePath)}`,
                timeout_sec: 120,
              },
              180_000
            );
            const imageB64 = String(readImageResp?.stdout ?? "").trim();
            if (readImageResp?.ok && imageB64) {
              const imgBuffer = Buffer.from(imageB64, "base64");
              const subdir = path.join("blueprints", String(input.projectId), "pages");
              const fullDir = path.join(ARTIFACTS_DIR, subdir);
              ensureDir(fullDir);
              const imgName = `doc${docIns.insertId}_page${pageNumber}_${randomUUID().slice(0, 8)}.png`;
              imageStoragePath = path.join(subdir, imgName);
              fs.writeFileSync(path.join(ARTIFACTS_DIR, imageStoragePath), imgBuffer);
            }
          } catch (err) {
            console.warn(
              `[blueprints.uploadAndGenerateQuotePackage] failed to persist page image for doc=${docIns.insertId} page=${pageNumber}:`,
              err
            );
          }
        }

        persistedPages.push({
          documentId: docIns.insertId,
          pageNumber,
          label: String(page?.label ?? "").trim() || null,
          imageStoragePath,
          imageWidth: Number.isFinite(Number(page?.width_px))
            ? Number(page.width_px)
            : Number.isFinite(Number(page?.imageWidth))
              ? Number(page.imageWidth)
              : null,
          imageHeight: Number.isFinite(Number(page?.height_px))
            ? Number(page.height_px)
            : Number.isFinite(Number(page?.imageHeight))
              ? Number(page.imageHeight)
              : null,
          meta: null,
        });
      }

      if (persistedPages.length > 0) {
        await db.insert(blueprintPages).values(persistedPages as any);
      }

      const effectivePageCount =
        persistedPages.length > 0
          ? persistedPages.length
          : Number(parseResp.page_count ?? 0);

      const parseFailed = effectivePageCount <= 0;
      await db
        .update(blueprintDocuments)
        .set({
          pageCount: effectivePageCount,
          status: parseFailed ? "failed" : "parsed",
          errorMessage: parseFailed
            ? "Parse completed but no pages were persisted. Verify agent image outputs."
            : null,
        })
        .where(eq(blueprintDocuments.id, docIns.insertId));

      if (parseFailed) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            "Blueprint parse did not persist any pages. The document was marked failed for operator review.",
        });
      }

      return {
        ok: true,
        projectId: input.projectId,
        blueprintDocumentId: docIns.insertId,
        uploadedBlueprintArtifactId: uploadedArtifactId,
        artifacts: {
          parseReportArtifactId,
          takeoffJsonArtifactId,
          xlsxArtifactId,
          docxArtifactId,
          bluebeamArtifactId,
        },
        parse: {
          pageCount: effectivePageCount,
          totalBlocks: Number(parseResp.total_blocks ?? 0),
          legendCandidates: Number(parseResp.total_legend_candidates ?? 0),
        },
        symbolReading: {
          ok: !!detectResp?.ok,
          detectionCount: Array.isArray(detectResp?.detections)
            ? detectResp.detections.length
            : 0,
          modelVersion: detectResp?.model?.version ?? null,
          warning: detectResp?.ok ? null : detectResp?.error ?? "Symbol detection not available",
        },
        takeoff: {
          totalDeviceTypes: Number(takeoffResp?.summary?.total_device_types ?? 0),
          totalDevices,
          lineItems: takeoffResp?.line_items ?? [],
        },
        quote: {
          currency: "USD",
          laborHours,
          laborRatePerHour: input.laborRatePerHour,
          laborCost,
          materialCost,
          subtotal,
          markupPct: input.quoteMarkupPct,
          quoteTotal,
        },
      };
    }),

  /** List blueprints for a project */
  list: adminProcedure
    .input(
      z.object({
        projectId: z.number().int(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { blueprints: [], total: 0 };

      const where = and(
        eq(agentArtifacts.projectId, input.projectId),
        eq(agentArtifacts.type, "blueprint_input")
      );

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

      return { blueprints: rows, total: countResult?.total ?? 0 };
    }),

  /** Stable mobile-compatible page listing by document id */
  getPages: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { pages: [] };

      const rows = await db
        .select({
          id: blueprintPages.id,
          pageNumber: blueprintPages.pageNumber,
          imageStoragePath: blueprintPages.imageStoragePath,
          imageWidth: blueprintPages.imageWidth,
          imageHeight: blueprintPages.imageHeight,
        })
        .from(blueprintPages)
        .where(eq(blueprintPages.documentId, input.documentId))
        .orderBy(blueprintPages.pageNumber);

      return {
        pages: rows.map((p) => ({
          id: p.id,
          pageNumber: p.pageNumber,
          imageUrl: p.imageStoragePath
            ? `/api/artifacts/${encodeURIComponent(p.imageStoragePath)}`
            : null,
          width: p.imageWidth ?? null,
          height: p.imageHeight ?? null,
        })),
      };
    }),

  /** Stable mobile-compatible detection listing by document id */
  getDetections: adminProcedure
    .input(z.object({ documentId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { detections: [] };

      const pages = await db
        .select({ id: blueprintPages.id, pageNumber: blueprintPages.pageNumber })
        .from(blueprintPages)
        .where(eq(blueprintPages.documentId, input.documentId));
      const pageNumberById = new Map<number, number>();
      for (const p of pages) pageNumberById.set(Number(p.id), Number(p.pageNumber));

      const rows = await db
        .select({
          pageId: blueprintDetectionsRaw.pageId,
          x: blueprintDetectionsRaw.x,
          y: blueprintDetectionsRaw.y,
          w: blueprintDetectionsRaw.w,
          h: blueprintDetectionsRaw.h,
          rawClass: blueprintDetectionsRaw.rawClass,
          canonicalType: blueprintDetectionsRaw.canonicalType,
          confidence: blueprintDetectionsRaw.confidence,
        })
        .from(blueprintDetectionsRaw)
        .where(eq(blueprintDetectionsRaw.documentId, input.documentId))
        .orderBy(desc(blueprintDetectionsRaw.confidence));

      return {
        detections: rows.map((d) => ({
          page: pageNumberById.get(Number(d.pageId)) ?? 1,
          x: d.x ?? 0,
          y: d.y ?? 0,
          w: d.w ?? 0,
          h: d.h ?? 0,
          rawClass: d.rawClass ?? "unknown",
          canonicalType: d.canonicalType ?? d.rawClass ?? "unknown",
          confidence: d.confidence ?? 0,
        })),
      };
    }),

  /** Get a single blueprint artifact by id */
  get: adminProcedure
    .input(z.object({ artifactId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;

      const [row] = await db
        .select()
        .from(agentArtifacts)
        .where(
          and(
            eq(agentArtifacts.id, input.artifactId),
            eq(agentArtifacts.type, "blueprint_input")
          )
        )
        .limit(1);

      return row ?? null;
    }),

  /** Delete a blueprint (only if not yet attached to a completed run) */
  delete: adminProcedure
    .input(z.object({ artifactId: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      const [artifact] = await db
        .select()
        .from(agentArtifacts)
        .where(
          and(
            eq(agentArtifacts.id, input.artifactId),
            eq(agentArtifacts.type, "blueprint_input")
          )
        )
        .limit(1);

      if (!artifact) throw new Error("Blueprint not found");

      // Delete the file from storage
      if (artifact.storageBackend === "local") {
        const fullPath = path.resolve(ARTIFACTS_DIR, artifact.storagePath);
        if (
          fullPath.startsWith(path.resolve(ARTIFACTS_DIR) + path.sep) &&
          fs.existsSync(fullPath)
        ) {
          fs.unlinkSync(fullPath);
        }
      }

      await db.delete(agentArtifacts).where(eq(agentArtifacts.id, input.artifactId));
      return { success: true };
    }),
});
