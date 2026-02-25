/**
 * Agent Runtime Health Monitor
 *
 * Polls GET /health from agent-stack every 60s, persists status to
 * agent_runtime_status, and computes a traffic-light signal:
 *
 *   🟢 healthy     → handshake OK, schema matches, responsive
 *   🟡 warning     → reachable but handshake or schema mismatch
 *   🔴 mismatch    → schema hash mismatch (HARD DISABLE RUNS)
 *   🔴 offline     → unreachable or timed out (HARD DISABLE RUNS)
 *
 * This service is OBSERVE-ONLY. It never executes agent logic, never
 * modifies behavior, never learns. It routes status into the DB for
 * the Operator OS dashboard to consume.
 */

import { getDb } from "../db";
import { agentRuntimeStatus } from "../db/schema";
import { validateHandshake } from "../contracts/handshake";
import { eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000; // 60 seconds
const HEALTH_TIMEOUT_MS = 10_000; // 10 second timeout for /health calls
const AGENT_STACK_URL =
  process.env.AGENT_STACK_URL ?? "http://localhost:4100";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RuntimeStatusRecord {
  vertex: string;
  version: string;
  schemaHash: string | null;
  handshakeOk: boolean;
  status: "healthy" | "warning" | "offline" | "mismatch";
  lastSeen: Date | null;
  violations: Array<{ type: string; message: string; detectedAt: string }>;
  responseTimeMs: number | null;
}

/**
 * Strict schema for agent-stack /health response.
 * No index signature — only known fields accepted.
 */
interface AgentHealthResponse {
  status: "ok" | "degraded" | "error";
  vertex: string;
  version: string;
  schema_hash: string;
  contracts: Array<{ name: string; version: string; schema_hash: string }>;
  uptime_seconds: number;
}

/**
 * Validate raw JSON against the strict AgentHealthResponse shape.
 * Returns null if validation fails (caller handles as warning).
 */
function parseHealthResponse(raw: unknown): AgentHealthResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;

  if (typeof obj.status !== "string") return null;
  if (!["ok", "degraded", "error"].includes(obj.status)) return null;
  if (typeof obj.vertex !== "string") return null;
  if (typeof obj.version !== "string") return null;

  // schema_hash and contracts are required for handshake
  const schemaHash = typeof obj.schema_hash === "string" ? obj.schema_hash : "";
  const contracts = Array.isArray(obj.contracts) ? obj.contracts : [];

  // Validate each contract claim shape
  const validContracts = contracts.filter(
    (c: unknown) =>
      c &&
      typeof c === "object" &&
      typeof (c as any).name === "string" &&
      typeof (c as any).version === "string" &&
      typeof (c as any).schema_hash === "string"
  ) as AgentHealthResponse["contracts"];

  return {
    status: obj.status as AgentHealthResponse["status"],
    vertex: obj.vertex as string,
    version: obj.version as string,
    schema_hash: schemaHash,
    contracts: validContracts,
    uptime_seconds: typeof obj.uptime_seconds === "number" ? obj.uptime_seconds : 0,
  };
}

// ---------------------------------------------------------------------------
// Core: Poll agent-stack /health
// ---------------------------------------------------------------------------

async function pollAgentHealth(): Promise<RuntimeStatusRecord> {
  const startMs = Date.now();
  const violations: Array<{ type: string; message: string; detectedAt: string }> = [];

  let healthData: AgentHealthResponse;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const resp = await fetch(`${AGENT_STACK_URL}/health`, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      return {
        vertex: "unknown",
        version: "unknown",
        schemaHash: null,
        handshakeOk: false,
        status: "offline",
        lastSeen: null,
        violations: [
          {
            type: "http_error",
            message: `Agent stack returned HTTP ${resp.status}`,
            detectedAt: new Date().toISOString(),
          },
        ],
        responseTimeMs: Date.now() - startMs,
      };
    }

    const rawJson = await resp.json();
    const parsed = parseHealthResponse(rawJson);
    if (!parsed) {
      return {
        vertex: "unknown",
        version: "unknown",
        schemaHash: null,
        handshakeOk: false,
        status: "warning" as const,
        lastSeen: new Date(),
        violations: [
          {
            type: "invalid_health_schema",
            message: `Agent /health returned unparseable response: ${JSON.stringify(rawJson).slice(0, 200)}`,
            detectedAt: new Date().toISOString(),
          },
        ],
        responseTimeMs: Date.now() - startMs,
      };
    }
    healthData = parsed;
  } catch (err) {
    return {
      vertex: "unknown",
      version: "unknown",
      schemaHash: null,
      handshakeOk: false,
      status: "offline",
      lastSeen: null,
      violations: [
        {
          type: "unreachable",
          message: `Agent stack unreachable: ${(err as Error).message}`,
          detectedAt: new Date().toISOString(),
        },
      ],
      responseTimeMs: Date.now() - startMs,
    };
  }

  const responseTimeMs = Date.now() - startMs;
  const vertex = healthData.vertex ?? "unknown";
  const version = healthData.version ?? "unknown";
  const schemaHash = healthData.schema_hash ?? null;

  // --- Contract handshake validation ---
  let handshakeOk = false;
  try {
    const result = validateHandshake({
      agent_id: "agent-stack",
      agent_version: version,
      contracts: healthData.contracts,
    });
    handshakeOk = result.ok;

    if (!result.ok) {
      for (const mismatch of result.mismatches) {
        violations.push({
          type: "contract_mismatch",
          message: `Contract "${mismatch.name}" [${mismatch.field}]: expected "${mismatch.expected}", received "${mismatch.received}"`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    violations.push({
      type: "handshake_error",
      message: `Handshake validation failed: ${(err as Error).message}`,
      detectedAt: new Date().toISOString(),
    });
  }

  // --- Agent-reported degraded status ---
  if (healthData.status === "degraded" || healthData.status === "error") {
    violations.push({
      type: "agent_self_report",
      message: `Agent reports status="${healthData.status}"`,
      detectedAt: new Date().toISOString(),
    });
  }

  // --- Determine status ---
  let status: RuntimeStatusRecord["status"] = "healthy";

  if (violations.some((v) => v.type === "contract_mismatch")) {
    status = "mismatch"; // HARD DISABLE
  } else if (healthData.status === "error") {
    status = "offline"; // Agent self-reports error = treat as offline
  } else if (!handshakeOk || healthData.status === "degraded") {
    status = "warning"; // Allow view-only
  }

  return {
    vertex,
    version,
    schemaHash,
    handshakeOk,
    status,
    lastSeen: new Date(),
    violations,
    responseTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Persist to DB
// ---------------------------------------------------------------------------

async function persistStatus(record: RuntimeStatusRecord): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Upsert: find existing row for this vertex, update or insert
  const [existing] = await db
    .select({ id: agentRuntimeStatus.id })
    .from(agentRuntimeStatus)
    .where(eq(agentRuntimeStatus.vertex, record.vertex))
    .limit(1);

  if (existing) {
    await db
      .update(agentRuntimeStatus)
      .set({
        version: record.version,
        schemaHash: record.schemaHash,
        handshakeOk: record.handshakeOk,
        status: record.status,
        lastSeen: record.lastSeen,
        violations: record.violations,
        responseTimeMs: record.responseTimeMs,
        endpointUrl: AGENT_STACK_URL,
      })
      .where(eq(agentRuntimeStatus.id, existing.id));
  } else {
    await db.insert(agentRuntimeStatus).values({
      vertex: record.vertex,
      version: record.version,
      schemaHash: record.schemaHash,
      handshakeOk: record.handshakeOk,
      status: record.status,
      lastSeen: record.lastSeen,
      violations: record.violations,
      endpointUrl: AGENT_STACK_URL,
      responseTimeMs: record.responseTimeMs,
    });
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run one poll cycle: fetch health, validate handshake, persist status.
 * Called by the interval timer and can be called manually for testing.
 */
export async function runHealthCheck(): Promise<RuntimeStatusRecord> {
  const record = await pollAgentHealth();
  await persistStatus(record);
  return record;
}

/**
 * Get the latest runtime status from DB (read-only query for UI).
 */
export async function getLatestRuntimeStatus(): Promise<RuntimeStatusRecord | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(agentRuntimeStatus)
    .orderBy(agentRuntimeStatus.updatedAt)
    .limit(10);

  if (rows.length === 0) return null;

  // Return the most recently updated entry
  const latest = rows[rows.length - 1];
  return {
    vertex: latest.vertex,
    version: latest.version,
    schemaHash: latest.schemaHash,
    handshakeOk: latest.handshakeOk,
    status: latest.status as RuntimeStatusRecord["status"],
    lastSeen: latest.lastSeen,
    violations: latest.violations ?? [],
    responseTimeMs: latest.responseTimeMs,
  };
}

/**
 * Get all runtime status entries (for multi-vertex deployments).
 */
export async function getAllRuntimeStatuses(): Promise<RuntimeStatusRecord[]> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(agentRuntimeStatus)
    .orderBy(agentRuntimeStatus.updatedAt);

  return rows.map((r) => ({
    vertex: r.vertex,
    version: r.version,
    schemaHash: r.schemaHash,
    handshakeOk: r.handshakeOk,
    status: r.status as RuntimeStatusRecord["status"],
    lastSeen: r.lastSeen,
    violations: r.violations ?? [],
    responseTimeMs: r.responseTimeMs,
  }));
}

/**
 * Check if execution should be allowed for a given vertex.
 *
 * Returns:
 *   - "allow"    → 🟢 Healthy, runs are OK
 *   - "view_only" → 🟡 Warning, view-only mode
 *   - "blocked"  → 🔴 Mismatch/Offline, HARD DISABLE RUNS
 */
export async function getExecutionGate(vertex: string): Promise<"allow" | "view_only" | "blocked"> {
  const db = await getDb();
  if (!db) return "blocked"; // No DB = fail closed

  const [record] = await db
    .select({ status: agentRuntimeStatus.status })
    .from(agentRuntimeStatus)
    .where(eq(agentRuntimeStatus.vertex, vertex))
    .limit(1);

  if (!record) return "blocked"; // No status record = unknown = block

  switch (record.status) {
    case "healthy":
      return "allow";
    case "warning":
      return "view_only";
    case "mismatch":
    case "offline":
    default:
      return "blocked";
  }
}

// ---------------------------------------------------------------------------
// Timer — auto-start polling when imported
// ---------------------------------------------------------------------------

let _pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background polling loop (60s interval).
 * Safe to call multiple times — only one timer runs.
 */
export function startHealthMonitor(): void {
  if (_pollTimer) return;

  // Run immediately on start
  runHealthCheck().catch((err) => {
    console.error("[agentHealthMonitor] Initial health check failed:", err);
  });

  _pollTimer = setInterval(() => {
    runHealthCheck().catch((err) => {
      console.error("[agentHealthMonitor] Poll failed:", err);
    });
  }, POLL_INTERVAL_MS);

  // Allow process to exit even if timer is active
  _pollTimer.unref?.();

  console.log(
    `[agentHealthMonitor] Started polling ${AGENT_STACK_URL}/health every ${POLL_INTERVAL_MS / 1000}s`
  );
}

/**
 * Stop the background polling loop.
 */
export function stopHealthMonitor(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
    console.log("[agentHealthMonitor] Stopped polling.");
  }
}
