/**
 * Artifacts Express Router
 *
 * Serves agent-generated artifacts (files, screenshots, logs) with:
 *   - Authentication check (session cookie → user)
 *   - Project-level access control (must be owner/collaborator)
 *   - Directory traversal prevention
 *   - Rate limiting (applied at mount point)
 *   - Content-Disposition for safe downloads
 *
 * Mount at: app.use("/api/artifacts", rateLimiter(...), artifactsRouter)
 *
 * Routes:
 *   GET /api/artifacts/:artifactId          — download by artifact DB id
 *   GET /api/artifacts/:artifactId/meta     — metadata only (no file body)
 */

import { Router } from "express";
import type { Request, Response } from "express";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Root directory for local artifact storage. Defaults to ./artifacts */
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Prevent directory traversal: resolved path must start with ARTIFACTS_DIR.
 */
function isSafePath(filePath: string): boolean {
  const resolved = path.resolve(ARTIFACTS_DIR, filePath);
  return resolved.startsWith(path.resolve(ARTIFACTS_DIR) + path.sep) ||
    resolved === path.resolve(ARTIFACTS_DIR);
}

/**
 * Map file extension to a safe Content-Type. Only serve known types.
 */
function safeContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".txt": "text/plain",
    ".log": "text/plain",
    ".json": "application/json",
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".ts": "text/plain",
    ".tsx": "text/plain",
    ".jsx": "text/plain",
    ".md": "text/markdown",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".tar": "application/x-tar",
    ".gz": "application/gzip",
  };
  return types[ext] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Router factory
// ---------------------------------------------------------------------------

/**
 * Create the artifacts router.
 *
 * @param deps.getDb        Function returning the Drizzle DB instance
 * @param deps.getUserFromReq  Extracts authenticated user from request (session cookie)
 *
 * Usage:
 *   import { createArtifactsRouter } from "./routes/artifactsRouter";
 *   const artifactsRouter = createArtifactsRouter({ getDb, getUserFromReq });
 *   app.use("/api/artifacts", RATE_LIMITERS.artifacts(), artifactsRouter);
 */
export function createArtifactsRouter(deps: {
  getDb: () => Promise<any>;
  getUserFromReq: (req: Request) => Promise<{ id: number; role: string } | null>;
}) {
  const router = Router();

  // ---- Auth middleware for this router ----
  router.use(async (req: Request, res: Response, next) => {
    try {
      const user = await deps.getUserFromReq(req);
      if (!user) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
        return;
      }
      // Attach user to request for downstream handlers
      (req as any).__user = user;
      next();
    } catch {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid session." } });
    }
  });

  // ---- GET /:artifactId/meta — metadata only ----
  router.get("/:artifactId/meta", async (req: Request, res: Response) => {
    try {
      const db = await deps.getDb();
      if (!db) {
        res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable." } });
        return;
      }

      const artifactId = parseInt(req.params.artifactId!, 10);
      if (isNaN(artifactId)) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid artifact ID." } });
        return;
      }

      // Look up artifact
      const [artifact] = await db.query.agentArtifacts?.findMany?.({
        where: (t: any, { eq }: any) => eq(t.id, artifactId),
        limit: 1,
      }) ?? [];

      if (!artifact) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Artifact not found." } });
        return;
      }

      const user = (req as any).__user;

      // Admin bypass
      if (user.role !== "admin") {
        // Check project access
        const [collab] = await db.query.projectCollaborators?.findMany?.({
          where: (t: any, { and: a, eq: e }: any) =>
            a(e(t.projectId, artifact.projectId), e(t.userId, user.id)),
          limit: 1,
        }) ?? [];

        const [project] = await db.query.projects?.findMany?.({
          where: (t: any, { eq }: any) => eq(t.id, artifact.projectId),
          limit: 1,
        }) ?? [];

        if (!project || (project.ownerId !== user.id && !collab)) {
          res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied to this artifact." } });
          return;
        }
      }

      res.json({
        id: artifact.id,
        runId: artifact.runId,
        projectId: artifact.projectId,
        type: artifact.type,
        filename: artifact.filename,
        mimeType: artifact.mimeType,
        sizeBytes: artifact.sizeBytes,
        storageBackend: artifact.storageBackend,
        createdAt: artifact.createdAt,
      });
    } catch (err) {
      console.error("[artifacts] meta error:", err);
      res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to retrieve artifact metadata." } });
    }
  });

  // ---- GET /:artifactId — download file ----
  router.get("/:artifactId", async (req: Request, res: Response) => {
    try {
      const db = await deps.getDb();
      if (!db) {
        res.status(503).json({ error: { code: "SERVICE_UNAVAILABLE", message: "Database unavailable." } });
        return;
      }

      const artifactId = parseInt(req.params.artifactId!, 10);
      if (isNaN(artifactId)) {
        res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid artifact ID." } });
        return;
      }

      // Look up artifact
      const [artifact] = await db.query.agentArtifacts?.findMany?.({
        where: (t: any, { eq }: any) => eq(t.id, artifactId),
        limit: 1,
      }) ?? [];

      if (!artifact) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Artifact not found." } });
        return;
      }

      const user = (req as any).__user;

      // Admin bypass
      if (user.role !== "admin") {
        // Check project access
        const [collab] = await db.query.projectCollaborators?.findMany?.({
          where: (t: any, { and: a, eq: e }: any) =>
            a(e(t.projectId, artifact.projectId), e(t.userId, user.id)),
          limit: 1,
        }) ?? [];

        const [project] = await db.query.projects?.findMany?.({
          where: (t: any, { eq }: any) => eq(t.id, artifact.projectId),
          limit: 1,
        }) ?? [];

        if (!project || (project.ownerId !== user.id && !collab)) {
          res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied to this artifact." } });
          return;
        }
      }

      // ---- S3 backend: redirect to presigned URL ----
      if (artifact.storageBackend === "s3") {
        // Lazy-load S3 presigner only when needed
        try {
          const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
          const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

          const s3 = new S3Client({});
          const command = new GetObjectCommand({
            Bucket: process.env.ARTIFACTS_S3_BUCKET || "launchbase-artifacts",
            Key: artifact.storagePath,
          });
          const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
          res.redirect(302, presignedUrl);
        } catch (err) {
          console.error("[artifacts] S3 presign error:", err);
          res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to generate download URL." } });
        }
        return;
      }

      // ---- Local backend: serve from disk ----
      if (!isSafePath(artifact.storagePath)) {
        console.error("[artifacts] directory traversal attempt:", artifact.storagePath);
        res.status(403).json({ error: { code: "FORBIDDEN", message: "Invalid artifact path." } });
        return;
      }

      const filePath = path.resolve(ARTIFACTS_DIR, artifact.storagePath);

      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: { code: "NOT_FOUND", message: "Artifact file not found on disk." } });
        return;
      }

      const contentType = artifact.mimeType || safeContentType(artifact.filename);
      const safeFilename = path.basename(artifact.filename).replace(/[^\w.\-]/g, "_");

      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${safeFilename}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");

      const stream = fs.createReadStream(filePath);
      stream.on("error", (err) => {
        console.error("[artifacts] stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to read artifact." } });
        }
      });
      stream.pipe(res);
    } catch (err) {
      console.error("[artifacts] download error:", err);
      res.status(500).json({ error: { code: "INTERNAL_SERVER_ERROR", message: "Failed to download artifact." } });
    }
  });

  return router;
}
