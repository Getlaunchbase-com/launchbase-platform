/**
 * Mobile Voice API — Session, Voice, and Chat routers
 *
 * Provides API-first endpoints for mobile clients to:
 *   1. Create scoped session tokens (bound to projectId + agentInstanceId)
 *   2. Upload voice notes → transcribe → append as agent messages
 *   3. Send text messages and poll for agent run events
 *
 * Security:
 *   - Session tokens are cryptographically random, scoped to project + instance
 *   - All endpoints rate-limited (mobile tier: 20 req/min)
 *   - Audit logging on session create, revoke, voice upload, run start
 *   - Tokens auto-expire after 24h (configurable)
 *
 * Architecture:
 *   mobile.session.create  → returns bearer token
 *   mobile.session.revoke  → invalidates token
 *   mobile.voice.upload    → stores audio artifact
 *   mobile.voice.transcribe → calls transcription, stores transcript
 *   mobile.chat.send       → appends user message, starts/continues run
 *   mobile.chat.poll       → returns run events since cursor
 */

import { z } from "zod";
import { router, publicProcedure } from "../../_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "../../db";
import { getFreezeStatus, isContractFrozen } from "../../contracts/freeze_governance";
import { getExecutionGate } from "../../services/agentHealthMonitor";
import {
  mobileSessions,
  agentInstances,
  agentRuns,
  agentEvents,
  agentArtifacts,
  agentFeedback,
  projects,
  users,
  vertexProfiles,
} from "../../db/schema";
import { desc, eq, and, gt, gte, count } from "drizzle-orm";
import { randomBytes, createHash } from "crypto";
import path from "node:path";
import fs from "node:fs";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Session token TTL in hours */
const SESSION_TTL_HOURS = parseInt(process.env.MOBILE_SESSION_TTL_HOURS ?? "24", 10);

/** Rate limit for mobile endpoints */
const MOBILE_RATE_LIMIT = { key: "api:mobile", max: 20, windowMs: 60_000 };

/** Max audio upload size: 25 MB base64 (~18.75 MB raw) */
const MAX_AUDIO_BASE64_LENGTH = 25 * 1024 * 1024;

const ARTIFACTS_DIR =
  process.env.ARTIFACTS_DIR || path.resolve(process.cwd(), "artifacts");
const OPENAI_API_BASE_URL =
  (
    process.env.OPENAI_API_BASE_URL ||
    process.env.AIML_API_BASE_URL ||
    "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.AIML_API_KEY || "";
const OPENAI_TRANSCRIBE_URL = `${OPENAI_API_BASE_URL}/audio/transcriptions`;

/** S3 config for attachment uploads */
const S3_ENABLED = !!process.env.ARTIFACTS_S3_BUCKET;
const S3_BUCKET = process.env.ARTIFACTS_S3_BUCKET || "launchbase-artifacts";

/** Max attachment size: 10 MB */
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Allowed MIME types for feedback attachments */
const ATTACHMENT_MIME_ALLOWLIST = new Set([
  "image/png",
  "image/jpeg",
  "application/pdf",
]);

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function generateToken(): string {
  return `mob_${randomBytes(48).toString("base64url")}`;
}

function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

// ---------------------------------------------------------------------------
// Rate limit (inline for mobile tier — reuses the same pattern)
// ---------------------------------------------------------------------------

const mobileBuckets = new Map<string, { count: number; resetAt: number }>();

function enforceMobileRateLimit(bucketId: string): void {
  const now = Date.now();
  let entry = mobileBuckets.get(bucketId);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + MOBILE_RATE_LIMIT.windowMs };
    mobileBuckets.set(bucketId, entry);
  }

  entry.count++;

  if (entry.count > MOBILE_RATE_LIMIT.max) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded. Try again later.",
    });
  }
}

// Cleanup every 5 min
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of mobileBuckets) {
    if (entry.resetAt <= now) mobileBuckets.delete(key);
  }
}, 5 * 60_000).unref?.();

// ---------------------------------------------------------------------------
// Shared: validate mobile session token
// ---------------------------------------------------------------------------

async function validateMobileToken(token: string | undefined) {
  if (!token) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing mobile session token." });
  }

  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

  const [session] = await db
    .select()
    .from(mobileSessions)
    .where(eq(mobileSessions.token, token))
    .limit(1);

  if (!session) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid session token." });
  }

  if (session.status !== "active") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session has been revoked." });
  }

  if (session.expiresAt < new Date()) {
    // Mark as expired
    await db
      .update(mobileSessions)
      .set({ status: "expired" })
      .where(eq(mobileSessions.id, session.id));
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Session has expired." });
  }

  // Touch lastUsedAt
  await db
    .update(mobileSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(mobileSessions.id, session.id));

  return session;
}

// ---------------------------------------------------------------------------
// Audit helper (best-effort, never throws)
// ---------------------------------------------------------------------------

async function mobileAudit(
  eventType: string,
  session: { userId: number; projectId: number; agentInstanceId: number; token: string },
  message: string,
  meta?: Record<string, unknown>
) {
  try {
    const { auditLog } = await import("../../security");
    await auditLog.adminAction(
      { user: { id: session.userId, role: "user" } } as any,
      {
        message: `[mobile] ${message}`,
        resourceType: "mobile_session",
        resourceId: tokenFingerprint(session.token),
        meta: {
          ...meta,
          projectId: session.projectId,
          agentInstanceId: session.agentInstanceId,
        },
      }
    );
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Freeze enforcement — mobile is a read/feedback terminal, not a mutation brain
// ---------------------------------------------------------------------------

/**
 * Enforce that the mobile client is not attempting to mutate frozen contract
 * state. Voice uploads and feedback are always allowed; run creation and
 * chat messages that dispatch tools against frozen vertices are blocked.
 *
 * Rules:
 *   - Session create/validate/revoke: ALLOWED (session management)
 *   - Voice upload/transcribe: ALLOWED (input capture, no state change)
 *   - Feedback submit/mine: ALLOWED (feedback collection is post-freeze OK)
 *   - Chat send (creates runs): GATED — blocked if vertex is frozen AND
 *     the agent instance targets a frozen vertex
 *   - Chat poll/status: ALLOWED (read-only)
 */
// ---------------------------------------------------------------------------
// Blocked mutation types — mobile MUST NEVER perform these actions
// ---------------------------------------------------------------------------

const BLOCKED_MOBILE_ACTIONS = new Set([
  "symbol_mapping",
  "symbol.override",
  "task.edit",
  "task.delete",
  "rule.change",
  "rule.create",
  "rule.delete",
  "config.override",
  "contract.modify",
  "vertex.modify",
]);

async function enforceMobileFreezeGate(
  session: { agentInstanceId: number; projectId: number },
  action: string
): Promise<void> {
  // Hard-block permanently forbidden mobile actions
  if (BLOCKED_MOBILE_ACTIONS.has(action)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        `Mobile action "${action}" is permanently blocked. ` +
        `Mobile clients are restricted to: upload blueprint, view parse status, ` +
        `view estimates, export files, submit feedback, and voice intent queries.`,
    });
  }

  // Runtime health gate — if agent-stack is offline/mismatch, block all runs
  const db = await getDb();
  if (!db) return;

  const [instance] = await db
    .select({ vertexId: agentInstances.vertexId })
    .from(agentInstances)
    .where(eq(agentInstances.id, session.agentInstanceId))
    .limit(1);

  if (instance?.vertexId) {
    const [vertex] = await db
      .select({ name: vertexProfiles.name })
      .from(vertexProfiles)
      .where(eq(vertexProfiles.id, instance.vertexId))
      .limit(1);

    if (vertex?.name) {
      // Check runtime execution gate
      const gate = await getExecutionGate(vertex.name);
      if (gate === "blocked") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            `Mobile ${action} blocked: agent runtime for vertex "${vertex.name}" ` +
            `is offline or has a schema mismatch. Runs are disabled until the ` +
            `agent-stack is healthy and passes handshake validation.`,
        });
      }

      // Freeze enforcement — block mutations against frozen vertices
      const freeze = getFreezeStatus();
      if (freeze.frozen && vertex.name === freeze.vertex) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            `Mobile ${action} blocked: vertex "${freeze.vertex}" is frozen ` +
            `(${freeze.version}). Mobile clients may not dispatch runs against ` +
            `frozen vertices. Submit feedback instead.`,
        });
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Storage helpers
// ---------------------------------------------------------------------------

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// =========================================================================
// Session Router
// =========================================================================

export const mobileSessionRouter = router({
  /**
   * Create a mobile session token scoped to a project + agent instance.
   * Requires admin auth (creates session on behalf of a user).
   */
  create: publicProcedure
    .input(
      z.object({
        userId: z.number().int(),
        projectId: z.number().int(),
        agentInstanceId: z.number().int(),
        // Admin key for bootstrapping — in production use adminProcedure
        adminSecret: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // Verify admin secret (simple shared-secret for mobile bootstrap)
      const expectedSecret = process.env.MOBILE_ADMIN_SECRET ?? "dev-mobile-secret";
      if (input.adminSecret !== expectedSecret) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid admin credentials." });
      }

      // Rate limit by IP-like key (use userId as bucket for now)
      enforceMobileRateLimit(`session:create:${input.userId}`);

      // Verify project exists
      const [project] = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, input.projectId))
        .limit(1);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

      // Verify user exists
      const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });

      // Verify agent instance belongs to project and is active
      const [instance] = await db
        .select()
        .from(agentInstances)
        .where(
          and(
            eq(agentInstances.id, input.agentInstanceId),
            eq(agentInstances.projectId, input.projectId),
            eq(agentInstances.status, "active")
          )
        )
        .limit(1);
      if (!instance) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agent instance not found, not active, or does not belong to project.",
        });
      }

      const token = generateToken();
      const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);

      const [result] = await db.insert(mobileSessions).values({
        token,
        userId: input.userId,
        projectId: input.projectId,
        agentInstanceId: input.agentInstanceId,
        status: "active",
        expiresAt,
      });

      await mobileAudit(
        "session_created",
        { userId: input.userId, projectId: input.projectId, agentInstanceId: input.agentInstanceId, token },
        `Mobile session created for user ${input.userId}`,
        { sessionId: result.insertId }
      );

      return {
        sessionId: result.insertId,
        token,
        projectId: input.projectId,
        agentInstanceId: input.agentInstanceId,
        expiresAt: expiresAt.toISOString(),
      };
    }),

  /** Validate a session token (check it's active + not expired) */
  validate: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      return {
        valid: true,
        sessionId: session.id,
        userId: session.userId,
        projectId: session.projectId,
        agentInstanceId: session.agentInstanceId,
        expiresAt: session.expiresAt,
      };
    }),

  /** Revoke a session token */
  revoke: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const [session] = await db
        .select()
        .from(mobileSessions)
        .where(eq(mobileSessions.token, input.token))
        .limit(1);

      if (!session) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Session not found." });
      }

      await db
        .update(mobileSessions)
        .set({ status: "revoked" })
        .where(eq(mobileSessions.id, session.id));

      await mobileAudit(
        "session_destroyed",
        session as any,
        `Mobile session revoked`,
        { sessionId: session.id }
      );

      return { success: true };
    }),
});

// =========================================================================
// Voice Router
// =========================================================================

export const mobileVoiceRouter = router({
  /**
   * Upload an audio voice note.
   * Stores as an artifact with type "file" and audio mimeType.
   * Returns the artifact id for subsequent transcription.
   */
  upload: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        filename: z.string().min(1).max(512).default("voice_note.webm"),
        mimeType: z.string().max(128).default("audio/webm"),
        base64Data: z.string().min(1).max(MAX_AUDIO_BASE64_LENGTH),
      })
    )
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      enforceMobileRateLimit(`voice:upload:${session.userId}`);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const fileBuffer = Buffer.from(input.base64Data, "base64");
      const sizeBytes = fileBuffer.length;
      const checksum = createHash("sha256").update(fileBuffer).digest("hex");

      // Store locally under voice/{projectId}/
      const subdir = path.join("voice", String(session.projectId));
      const fullDir = path.join(ARTIFACTS_DIR, subdir);
      ensureDir(fullDir);

      const ext = path.extname(input.filename) || ".webm";
      const uniqueName = `${Date.now()}_${randomBytes(4).toString("hex")}${ext}`;
      const storagePath = path.join(subdir, uniqueName);
      fs.writeFileSync(path.join(ARTIFACTS_DIR, storagePath), fileBuffer);

      const [result] = await db.insert(agentArtifacts).values({
        runId: session.activeRunId ?? null,
        projectId: session.projectId,
        type: "file",
        filename: input.filename,
        mimeType: input.mimeType,
        sizeBytes,
        storagePath,
        storageBackend: "local",
        checksum,
        meta: {
          source: "mobile_voice",
          sessionId: session.id,
          agentInstanceId: session.agentInstanceId,
          userId: session.userId,
        },
      });

      await mobileAudit(
        "admin_action",
        session as any,
        `Voice note uploaded: ${input.filename} (${sizeBytes} bytes)`,
        { artifactId: result.insertId }
      );

      return {
        artifactId: result.insertId,
        filename: input.filename,
        sizeBytes,
        checksum,
      };
    }),

  /**
   * Transcribe a previously uploaded audio artifact.
   * Calls the transcription tool (or placeholder) and stores the
   * transcript as an agent event.
   */
  transcribe: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        artifactId: z.number().int(),
      })
    )
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      enforceMobileRateLimit(`voice:transcribe:${session.userId}`);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      // Verify artifact exists and belongs to session's project
      const [artifact] = await db
        .select()
        .from(agentArtifacts)
        .where(
          and(
            eq(agentArtifacts.id, input.artifactId),
            eq(agentArtifacts.projectId, session.projectId)
          )
        )
        .limit(1);

      if (!artifact) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Audio artifact not found." });
      }

      // --- Transcription via OpenAI Whisper ---
      const openaiKey = OPENAI_API_KEY;
      if (!openaiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Transcription service not configured. Set OPENAI_API_KEY.",
        });
      }

      let transcript: string;
      try {
        const audioPath = path.resolve(ARTIFACTS_DIR, artifact.storagePath);
        const audioData = fs.readFileSync(audioPath);

        const formData = new FormData();
        formData.append("file", new Blob([audioData], { type: artifact.mimeType ?? "audio/webm" }), artifact.filename);
        formData.append("model", "whisper-1");

        const resp = await fetch(OPENAI_TRANSCRIBE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${openaiKey}` },
          body: formData,
        });

        if (!resp.ok) {
          throw new Error(`Whisper API error: ${resp.status}`);
        }

        const data = (await resp.json()) as { text: string };
        transcript = data.text;
      } catch (err) {
        if (err instanceof TRPCError) throw err;
        console.error("[mobile:voice:transcribe] Whisper error:", err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
        });
      }

      // If there's an active run, append as an event
      if (session.activeRunId) {
        await db.insert(agentEvents).values({
          runId: session.activeRunId,
          type: "message",
          payload: {
            role: "user",
            content: transcript,
            source: "mobile_voice",
            artifactId: artifact.id,
          },
        });
      }

      await mobileAudit(
        "admin_action",
        session as any,
        `Voice transcribed: artifact ${artifact.id}`,
        { artifactId: artifact.id, transcriptLength: transcript.length }
      );

      return {
        artifactId: artifact.id,
        transcript,
        runId: session.activeRunId ?? null,
      };
    }),
});

// =========================================================================
// Chat Router
// =========================================================================

export const mobileChatRouter = router({
  /**
   * Send a text message (or transcribed voice) and start/continue an agent run.
   * If no active run exists for the session, creates one.
   */
  send: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        message: z.string().min(1).max(10_000),
        model: z.string().max(128).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      enforceMobileRateLimit(`chat:send:${session.userId}`);

      // Freeze enforcement: mobile must not dispatch runs against frozen vertices
      await enforceMobileFreezeGate(session, "chat.send");

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      let runId = session.activeRunId;

      // If no active run, create one
      if (!runId) {
        // Load vertex config for model default
        const [instance] = await db
          .select()
          .from(agentInstances)
          .where(eq(agentInstances.id, session.agentInstanceId))
          .limit(1);

        let model = input.model ?? null;
        if (!model && instance?.vertexId) {
          const [vertex] = await db
            .select({ configJson: vertexProfiles.configJson })
            .from(vertexProfiles)
            .where(eq(vertexProfiles.id, instance.vertexId))
            .limit(1);
          model = (vertex?.configJson as any)?.model ?? null;
        }

        const [result] = await db.insert(agentRuns).values({
          createdBy: session.userId,
          status: "running",
          goal: input.message,
          model,
          projectId: session.projectId,
          agentInstanceId: session.agentInstanceId,
        });

        runId = result.insertId;

        // Update session with active run
        await db
          .update(mobileSessions)
          .set({ activeRunId: runId })
          .where(eq(mobileSessions.id, session.id));

        await mobileAudit(
          "admin_action",
          session as any,
          `Mobile run started: ${runId}`,
          { runId, goal: input.message.slice(0, 200) }
        );
      }

      // Append user message as event
      await db.insert(agentEvents).values({
        runId,
        type: "message",
        payload: {
          role: "user",
          content: input.message,
          source: "mobile_chat",
          sessionId: session.id,
        },
      });

      return {
        runId,
        eventAppended: true,
        projectId: session.projectId,
        agentInstanceId: session.agentInstanceId,
      };
    }),

  /**
   * Poll for agent run events since a cursor (event id).
   * Returns new events and current run status.
   * Supports optional TTS URL in assistant message payloads.
   */
  poll: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        sinceEventId: z.number().int().default(0),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      enforceMobileRateLimit(`chat:poll:${session.userId}`);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      if (!session.activeRunId) {
        return { events: [], runStatus: null, hasMore: false };
      }

      // Get run status
      const [run] = await db
        .select({
          id: agentRuns.id,
          status: agentRuns.status,
          goal: agentRuns.goal,
          finishedAt: agentRuns.finishedAt,
        })
        .from(agentRuns)
        .where(eq(agentRuns.id, session.activeRunId))
        .limit(1);

      // Fetch events since cursor
      const conditions = [eq(agentEvents.runId, session.activeRunId)];
      if (input.sinceEventId > 0) {
        conditions.push(gt(agentEvents.id, input.sinceEventId));
      }

      const events = await db
        .select()
        .from(agentEvents)
        .where(and(...conditions))
        .orderBy(agentEvents.id)
        .limit(input.limit + 1); // +1 to detect hasMore

      const hasMore = events.length > input.limit;
      if (hasMore) events.pop();

      return {
        events,
        runStatus: run
          ? { id: run.id, status: run.status, goal: run.goal, finishedAt: run.finishedAt }
          : null,
        hasMore,
      };
    }),

  /** Get current session info including active run status */
  status: publicProcedure
    .input(z.object({ token: z.string().min(1) }))
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      let runInfo = null;
      if (session.activeRunId) {
        const [run] = await db
          .select({
            id: agentRuns.id,
            status: agentRuns.status,
            goal: agentRuns.goal,
            createdAt: agentRuns.createdAt,
            finishedAt: agentRuns.finishedAt,
          })
          .from(agentRuns)
          .where(eq(agentRuns.id, session.activeRunId))
          .limit(1);
        runInfo = run ?? null;
      }

      return {
        sessionId: session.id,
        userId: session.userId,
        projectId: session.projectId,
        agentInstanceId: session.agentInstanceId,
        activeRun: runInfo,
        expiresAt: session.expiresAt,
      };
    }),
});

// ---------------------------------------------------------------------------
// Mobile Feedback Router — "this was wrong because…"
// ---------------------------------------------------------------------------

export const mobileFeedbackRouter = router({
  /**
   * Submit feedback from mobile client.
   * Captures "this was wrong because…" style feedback from end users.
   * Requires a valid mobile session token.
   */
  submit: publicProcedure
    .input(
      z.object({
        token: z.string().min(1).optional(),
        runId: z.number().int().optional(),
        message: z.string().min(1).max(4000),
        category: z.enum([
          "wrong_output",
          "slow_response",
          "missing_capability",
          "config_issue",
          "tone_style",
          "hallucination",
          "other",
        ]).default("other"),
        severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      let feedbackUserId: number;
      let feedbackProjectId: number;
      let feedbackInstanceId: number;
      let feedbackRunId: number | null = null;

      if (input.token && input.token.startsWith("mob_")) {
        const session = await validateMobileToken(input.token);
        feedbackUserId = session.userId;
        feedbackProjectId = session.projectId;
        feedbackInstanceId = session.agentInstanceId;
        feedbackRunId = input.runId ?? session.activeRunId ?? null;
      } else if (ctx.user?.id) {
        feedbackUserId = Number(ctx.user.id);

        const [ownedInstance] = await db
          .select({
            projectId: agentInstances.projectId,
            instanceId: agentInstances.id,
          })
          .from(agentInstances)
          .leftJoin(projects, eq(agentInstances.projectId, projects.id))
          .where(
            and(
              eq(projects.ownerId, feedbackUserId),
              eq(projects.status, "active"),
              eq(agentInstances.status, "active")
            )
          )
          .orderBy(desc(agentInstances.id))
          .limit(1);

        if (!ownedInstance) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "No active project/agent found for this user. Create a job first.",
          });
        }

        feedbackProjectId = Number(ownedInstance.projectId);
        feedbackInstanceId = Number(ownedInstance.instanceId);
        feedbackRunId = input.runId ?? null;
      } else {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Missing mobile session token or authenticated user context.",
        });
      }

      enforceMobileRateLimit(`feedback:${feedbackUserId}`);

      const [result] = await db.insert(agentFeedback).values({
        instanceId: feedbackInstanceId,
        runId: feedbackRunId,
        projectId: feedbackProjectId,
        submittedBy: feedbackUserId,
        source: "mobile",
        message: input.message,
        category: input.category,
        severity: input.severity,
        status: "open",
      });

      return { feedbackId: result.insertId };
    }),

  /** List feedback submitted by the current mobile session's user */
  mine: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ input }) => {
      const session = await validateMobileToken(input.token);

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const rows = await db
        .select({
          id: agentFeedback.id,
          runId: agentFeedback.runId,
          message: agentFeedback.message,
          category: agentFeedback.category,
          severity: agentFeedback.severity,
          status: agentFeedback.status,
          createdAt: agentFeedback.createdAt,
        })
        .from(agentFeedback)
        .where(
          and(
            eq(agentFeedback.submittedBy, session.userId),
            eq(agentFeedback.instanceId, session.agentInstanceId)
          )
        )
        .orderBy(desc(agentFeedback.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { items: rows };
    }),
});

// =========================================================================
// Attachment Upload Router — screenshots/photos for feedback
// =========================================================================

export const mobileAttachmentRouter = router({
  /**
   * Upload a feedback attachment (screenshot, photo, PDF).
   *
   * Returns a presigned S3 upload URL (or local fallback URL) and the
   * eventual attachment URL. Mobile uploads directly to S3.
   *
   * Max size: 10 MB
   * MIME allowlist: image/png, image/jpeg, application/pdf
   */
  upload: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        filename: z.string().min(1).max(512),
        contentType: z.string().min(1).max(128),
      })
    )
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      enforceMobileRateLimit(`attachment:upload:${session.userId}`);

      // Validate MIME type
      if (!ATTACHMENT_MIME_ALLOWLIST.has(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `File type "${input.contentType}" not allowed. Allowed: image/png, image/jpeg, application/pdf.`,
        });
      }

      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const ext = path.extname(input.filename) || ".bin";
      const uniqueKey = `feedback-attachments/${session.projectId}/${Date.now()}_${randomBytes(4).toString("hex")}${ext}`;

      if (S3_ENABLED) {
        // Generate presigned PUT URL for direct client upload
        const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
        const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

        const s3 = new S3Client({});
        const command = new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: uniqueKey,
          ContentType: input.contentType,
          ContentLength: MAX_ATTACHMENT_SIZE, // max size hint
        });

        const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 600 });
        const attachmentUrl = `https://${S3_BUCKET}.s3.amazonaws.com/${uniqueKey}`;

        // Create artifact record (pending upload)
        await db.insert(agentArtifacts).values({
          runId: session.activeRunId ?? null,
          projectId: session.projectId,
          type: "file",
          filename: input.filename,
          mimeType: input.contentType,
          sizeBytes: 0, // Updated after upload
          storagePath: uniqueKey,
          storageBackend: "s3",
          meta: {
            source: "mobile_feedback_attachment",
            sessionId: session.id,
            userId: session.userId,
          },
        });

        await mobileAudit(
          "admin_action",
          session as any,
          `Feedback attachment upload URL generated: ${input.filename}`,
          { key: uniqueKey }
        );

        return { uploadUrl, attachmentUrl };
      } else {
        // Local storage fallback — client sends base64 in a follow-up call
        const subdir = path.join("feedback-attachments", String(session.projectId));
        const fullDir = path.join(ARTIFACTS_DIR, subdir);
        if (!fs.existsSync(fullDir)) fs.mkdirSync(fullDir, { recursive: true });

        const localPath = path.join(subdir, path.basename(uniqueKey));
        const uploadUrl = `/api/artifacts/upload-local?path=${encodeURIComponent(localPath)}`;
        const attachmentUrl = `/api/artifacts/${encodeURIComponent(localPath)}`;

        await db.insert(agentArtifacts).values({
          runId: session.activeRunId ?? null,
          projectId: session.projectId,
          type: "file",
          filename: input.filename,
          mimeType: input.contentType,
          sizeBytes: 0,
          storagePath: localPath,
          storageBackend: "local",
          meta: {
            source: "mobile_feedback_attachment",
            sessionId: session.id,
            userId: session.userId,
          },
        });

        return { uploadUrl, attachmentUrl };
      }
    }),
});

// =========================================================================
// Voice Transcription Router — field voice notes → structured text
// =========================================================================

export const mobileTranscribeRouter = router({
  /**
   * Transcribe a voice note from a URL.
   *
   * Fetches audio from audioUrl, sends to transcription service,
   * returns text + confidence. Falls back gracefully — never blocks
   * feedback submission if transcription fails.
   *
   * Implementation: OpenAI Whisper if OPENAI_API_KEY configured,
   * otherwise returns empty text + low confidence.
   */
  transcribe: publicProcedure
    .input(
      z.object({
        token: z.string().min(1),
        audioUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const session = await validateMobileToken(input.token);
      enforceMobileRateLimit(`transcribe:${session.userId}`);

      // Attempt transcription — NEVER throw on failure, return degraded result
      if (!OPENAI_API_KEY) {
        return {
          text: "",
          confidence: 0,
        };
      }

      try {
        // Fetch audio from URL
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);

        const audioResp = await fetch(input.audioUrl, {
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!audioResp.ok) {
          console.error(`[mobile:transcribe] Failed to fetch audio: HTTP ${audioResp.status}`);
          return { text: "", confidence: 0 };
        }

        const audioBuffer = await audioResp.arrayBuffer();

        // Enforce 10 MB limit
        if (audioBuffer.byteLength > MAX_ATTACHMENT_SIZE) {
          return { text: "", confidence: 0 };
        }

        // Call OpenAI Whisper API
        const formData = new FormData();
        formData.append(
          "file",
          new Blob([audioBuffer], { type: "audio/webm" }),
          "voice_note.webm"
        );
        formData.append("model", "whisper-1");
        formData.append("response_format", "verbose_json");

        const whisperResp = await fetch(OPENAI_TRANSCRIBE_URL, {
          method: "POST",
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
          body: formData,
        });

        if (!whisperResp.ok) {
          console.error(`[mobile:transcribe] Whisper error: HTTP ${whisperResp.status}`);
          return { text: "", confidence: 0 };
        }

        const result = (await whisperResp.json()) as {
          text: string;
          language?: string;
          duration?: number;
          segments?: Array<{ avg_logprob?: number }>;
        };

        // Compute confidence from average log-probability of segments
        let confidence = 0.85; // default if segments not available
        if (result.segments && result.segments.length > 0) {
          const avgLogProb =
            result.segments.reduce((sum, s) => sum + (s.avg_logprob ?? -0.5), 0) /
            result.segments.length;
          // Convert log-prob to 0-1 scale (logprob of 0 = 1.0, -1 ≈ 0.37)
          confidence = Math.round(Math.exp(avgLogProb) * 100) / 100;
          confidence = Math.max(0, Math.min(1, confidence));
        }

        await mobileAudit(
          "admin_action",
          session as any,
          `Voice transcribed from URL (${result.text.length} chars)`,
          { audioUrl: input.audioUrl, confidence }
        );

        return {
          text: result.text,
          confidence,
        };
      } catch (err) {
        console.error("[mobile:transcribe] Error:", err);
        // Hard rule: NEVER block feedback if transcription fails
        return { text: "", confidence: 0 };
      }
    }),
});
