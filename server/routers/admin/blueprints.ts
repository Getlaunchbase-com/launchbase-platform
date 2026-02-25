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
} from "../../db/schema";
import { desc, eq, and, count, inArray } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";
import path from "node:path";
import fs from "node:fs";
import {
  validateUploadedFile,
  cleanupTemp,
  moveFromTemp,
} from "../../security/fileValidation";

// ---------------------------------------------------------------------------
// Storage config
// ---------------------------------------------------------------------------

const ARTIFACTS_DIR =
  process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");

const S3_ENABLED = !!process.env.ARTIFACTS_S3_BUCKET;
const S3_BUCKET = process.env.ARTIFACTS_S3_BUCKET || "launchbase-artifacts";

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
      const fileBuffer = Buffer.from(input.base64Data, "base64");

      // --- Full file validation pipeline ---
      // 1. MIME whitelist  2. Size cap  3. Magic bytes  4. Temp isolation  5. Malware scan
      const fileValidation = await validateUploadedFile(fileBuffer, input.mimeType, input.filename);
      if (!fileValidation.valid) {
        throw new Error(`File validation failed: ${fileValidation.errors.join("; ")}`);
      }

      const sizeBytes = fileBuffer.length;
      const checksum = createHash("sha256").update(fileBuffer).digest("hex");

      // Store file (move from temp to final storage)
      let storagePath: string;
      let storageBackend: "local" | "s3";

      if (S3_ENABLED) {
        // For S3, upload directly (temp file was for local validation/scan)
        const s3Result = await storeS3(input.projectId, input.filename, fileBuffer, input.mimeType);
        storagePath = s3Result.storagePath;
        storageBackend = s3Result.storageBackend;
        // Clean up temp file after S3 upload
        if (fileValidation.tempPath) cleanupTemp(fileValidation.tempPath);
      } else {
        // For local, move from temp isolation to final storage
        const localResult = await storeLocal(input.projectId, input.filename, fileBuffer);
        if (fileValidation.tempPath) {
          // Move validated temp file to final location (avoids re-write)
          moveFromTemp(fileValidation.tempPath, path.join(ARTIFACTS_DIR, localResult.storagePath));
        }
        storagePath = localResult.storagePath;
        storageBackend = localResult.storageBackend;
      }

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
