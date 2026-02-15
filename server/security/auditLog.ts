/**
 * Security Audit Logging
 *
 * Append-only audit log for security-relevant events.
 * Writes to the `security_audit_log` table.
 *
 * Best-effort logging: audit writes never throw or block the request.
 * Failures are logged to stderr for ops monitoring.
 *
 * Usage:
 *   await auditLog.authSuccess(ctx, { message: "JWT validated" });
 *   await auditLog.accessDenied(ctx, { resourceType: "intake", resourceId: "42" });
 */

import { getClientIp } from "./rateLimit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventType =
  | "auth_success"
  | "auth_failure"
  | "access_denied"
  | "rate_limit_hit"
  | "rate_limit_warn"
  | "admin_action"
  | "project_access_granted"
  | "project_access_denied"
  | "suspicious_input"
  | "csrf_violation"
  | "session_created"
  | "session_destroyed"
  | "privilege_escalation_attempt";

type Severity = "info" | "warn" | "crit";

interface AuditEntry {
  eventType: EventType;
  severity: Severity;
  actorType: "anonymous" | "user" | "admin" | "system";
  actorId?: string;
  actorIp?: string;
  requestPath?: string;
  requestMethod?: string;
  userAgent?: string;
  tenant?: "launchbase" | "vinces";
  resourceType?: string;
  resourceId?: string;
  message: string;
  meta?: Record<string, unknown>;
  fingerprint?: string;
}

interface RequestContext {
  user?: { id: number; role: string } | null;
  req?: {
    ip?: string;
    path?: string;
    method?: string;
    headers?: Record<string, string | string[] | undefined>;
  };
}

interface AuditOptions {
  message: string;
  resourceType?: string;
  resourceId?: string | number;
  tenant?: "launchbase" | "vinces";
  meta?: Record<string, unknown>;
  fingerprint?: string;
}

// ---------------------------------------------------------------------------
// Internal write function
// ---------------------------------------------------------------------------

/**
 * In-memory buffer for audit entries.
 * Entries are flushed to the database periodically or when the buffer
 * reaches a threshold. This prevents audit logging from adding latency
 * to request handling.
 */
const auditBuffer: AuditEntry[] = [];
const FLUSH_INTERVAL_MS = 5_000;
const FLUSH_THRESHOLD = 50;

let flushTimer: ReturnType<typeof setInterval> | null = null;
let dbWriter: ((entries: AuditEntry[]) => Promise<void>) | null = null;

/**
 * Register a database writer function.
 * Called once during server startup when the DB connection is available.
 *
 * Example:
 *   registerAuditWriter(async (entries) => {
 *     const db = await getDb();
 *     if (!db) return;
 *     await db.insert(securityAuditLog).values(entries);
 *   });
 */
export function registerAuditWriter(
  writer: (entries: AuditEntry[]) => Promise<void>
): void {
  dbWriter = writer;
  ensureFlushTimer();
}

function ensureFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(() => {
    flushBuffer().catch((err) => {
      console.error("[security:audit] flush error:", err);
    });
  }, FLUSH_INTERVAL_MS);
  if (flushTimer && typeof flushTimer === "object" && "unref" in flushTimer) {
    flushTimer.unref();
  }
}

async function flushBuffer(): Promise<void> {
  if (auditBuffer.length === 0 || !dbWriter) return;

  const batch = auditBuffer.splice(0, auditBuffer.length);
  try {
    await dbWriter(batch);
  } catch (err) {
    // Put entries back so they aren't lost (best-effort)
    auditBuffer.unshift(...batch);
    console.error("[security:audit] write failed, will retry:", err);
  }
}

function enqueue(entry: AuditEntry): void {
  auditBuffer.push(entry);
  if (auditBuffer.length >= FLUSH_THRESHOLD) {
    flushBuffer().catch((err) => {
      console.error("[security:audit] threshold flush error:", err);
    });
  }
}

// ---------------------------------------------------------------------------
// Context extraction helpers
// ---------------------------------------------------------------------------

function extractActor(ctx: RequestContext): Pick<AuditEntry, "actorType" | "actorId" | "actorIp"> {
  const actorIp = ctx.req ? getClientIp(ctx.req) : undefined;

  if (!ctx.user) {
    return { actorType: "anonymous", actorId: undefined, actorIp };
  }

  return {
    actorType: ctx.user.role === "admin" ? "admin" : "user",
    actorId: String(ctx.user.id),
    actorIp,
  };
}

function extractRequest(ctx: RequestContext): Pick<AuditEntry, "requestPath" | "requestMethod" | "userAgent"> {
  if (!ctx.req) return {};

  const ua = ctx.req.headers?.["user-agent"];
  return {
    requestPath: ctx.req.path,
    requestMethod: ctx.req.method,
    userAgent: typeof ua === "string" ? ua : Array.isArray(ua) ? ua[0] : undefined,
  };
}

function buildEntry(
  ctx: RequestContext,
  eventType: EventType,
  severity: Severity,
  opts: AuditOptions
): AuditEntry {
  return {
    eventType,
    severity,
    ...extractActor(ctx),
    ...extractRequest(ctx),
    tenant: opts.tenant,
    resourceType: opts.resourceType,
    resourceId: opts.resourceId != null ? String(opts.resourceId) : undefined,
    message: opts.message,
    meta: opts.meta,
    fingerprint: opts.fingerprint,
  };
}

// ---------------------------------------------------------------------------
// Public API — one method per event type
// ---------------------------------------------------------------------------

export const auditLog = {
  authSuccess(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "auth_success", "info", opts));
  },

  authFailure(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "auth_failure", "warn", opts));
  },

  accessDenied(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "access_denied", "warn", opts));
  },

  rateLimitHit(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "rate_limit_hit", "warn", opts));
  },

  rateLimitWarn(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "rate_limit_warn", "info", opts));
  },

  adminAction(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "admin_action", "info", opts));
  },

  projectAccessGranted(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "project_access_granted", "info", opts));
  },

  projectAccessDenied(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "project_access_denied", "warn", opts));
  },

  suspiciousInput(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "suspicious_input", "warn", opts));
  },

  csrfViolation(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "csrf_violation", "crit", opts));
  },

  sessionCreated(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "session_created", "info", opts));
  },

  sessionDestroyed(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "session_destroyed", "info", opts));
  },

  privilegeEscalationAttempt(ctx: RequestContext, opts: AuditOptions) {
    enqueue(buildEntry(ctx, "privilege_escalation_attempt", "crit", opts));
  },
} as const;

/**
 * Force-flush all buffered audit entries (e.g. on server shutdown).
 */
export async function flushAuditLog(): Promise<void> {
  await flushBuffer();
}
