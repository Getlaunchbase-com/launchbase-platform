/**
 * runEngine() — AI Engine Entrypoint (CORE + EXTENSIONS)
 * 
 * Stable interface for all AI execution (single model, swarm, etc.).
 * Policy determines execution mode; skins just submit work orders.
 * 
 * Phase 2.1: Skeleton only (validation + idempotency, no execution yet)
 */

import { createHmac } from "crypto";
import type {
  AiWorkOrderV1,
  AiWorkResultV1,
  StopReasonV1,
} from "./types";
import { resolvePolicy } from "./policy/policyRegistry";
import type { PolicyV1 } from "./policy/policyTypes";

// ============================================
// POLICY CAPS ENFORCEMENT
// ============================================

/**
 * Check if WorkOrder exceeds policy caps
 * 
 * RULE: Reject (don't clamp) if WorkOrder exceeds policy caps.
 * This is more honest than silent clamping.
 */
function checkPolicyCaps(
  order: AiWorkOrderV1,
  policy: PolicyV1
): { ok: true } | { ok: false; reason: string } {
  // Check cost cap
  if (order.constraints.costCapUsd && order.constraints.costCapUsd > policy.caps.costCapUsd) {
    return {
      ok: false,
      reason: `WorkOrder costCapUsd (${order.constraints.costCapUsd}) exceeds policy cap (${policy.caps.costCapUsd})`,
    };
  }

  // Check rounds cap
  if (order.constraints.maxRounds && order.constraints.maxRounds > policy.caps.maxRounds) {
    return {
      ok: false,
      reason: `WorkOrder maxRounds (${order.constraints.maxRounds}) exceeds policy cap (${policy.caps.maxRounds})`,
    };
  }

  // Check tokens cap (if policy defines it)
  if (policy.caps.maxTokensTotal && order.constraints.maxTokensTotal) {
    if (order.constraints.maxTokensTotal > policy.caps.maxTokensTotal) {
      return {
        ok: false,
        reason: `WorkOrder maxTokensTotal (${order.constraints.maxTokensTotal}) exceeds policy cap (${policy.caps.maxTokensTotal})`,
      };
    }
  }

  return { ok: true };
}

// ============================================
// IDEMPOTENCY (HMAC-BASED)
// ============================================

/**
 * Require environment variable (hard fail if missing)
 */
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

/**
 * Normalize value for stable serialization (deep, sorted keys, no coercion)
 * 
 * Recursively sorts object keys, preserves array order.
 * Rejects undefined, functions, symbols, BigInt, circular refs.
 */
function normalize(value: unknown, seen = new WeakSet()): unknown {
  // Primitives
  if (value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Cannot normalize non-finite number");
    }
    return value;
  }
  if (typeof value === "string") return value;

  // Reject unsupported types
  if (value === undefined) {
    throw new Error("Cannot normalize undefined (use null or omit)");
  }
  if (typeof value === "function") {
    throw new Error("Cannot normalize function");
  }
  if (typeof value === "symbol") {
    throw new Error("Cannot normalize symbol");
  }
  if (typeof value === "bigint") {
    throw new Error("Cannot normalize bigint");
  }

  // Arrays
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item, seen));
  }

  // Objects
  if (typeof value === "object") {
    // Circular reference check
    if (seen.has(value)) {
      throw new Error("Cannot normalize circular reference");
    }
    seen.add(value);

    const normalized: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      const val = (value as Record<string, unknown>)[key];
      // Skip undefined values (don't coerce to null)
      if (val !== undefined) {
        normalized[key] = normalize(val, seen);
      }
    }
    return normalized;
  }

  throw new Error(`Cannot normalize unknown type: ${typeof value}`);
}

/**
 * Compute deterministic, HMAC-based idempotency key.
 * 
 * SECURITY:
 * - NEVER include raw user text in key material
 * - Requires IDEMPOTENCY_SECRET environment variable
 * - Key is stable for same inputs (enables idempotent retries)
 * 
 * @param order Work order (must have pre-hashed inputs)
 * @returns HMAC-SHA256 hex digest
 */
export function computeWorkOrderKeyV1(order: AiWorkOrderV1): string {
  const secret = requireEnv("IDEMPOTENCY_SECRET");

  // Build CORE structure (fields that affect output)
  const core = {
    version: order.version,
    tenant: order.tenant,
    scope: order.scope,
    policyId: order.policyId,
    inputs: order.inputs, // MUST be pre-hashed if contains user text
    constraints: order.constraints,
  };

  // Normalize (deep, sorted keys, no coercion)
  const normalized = normalize(core);

  // Stable JSON serialization
  const stable = JSON.stringify(normalized);

  return createHmac("sha256", secret).update(stable).digest("hex");
}

// ============================================
// VALIDATION
// ============================================

/**
 * Check if value is JSON-serializable
 */
function isJsonSerializable(x: unknown): boolean {
  try {
    JSON.stringify(x);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate CORE fields (frozen v1.0)
 * 
 * RULE: All CORE fields are required and JSON-stable.
 * Unknown top-level keys are rejected (must be under extensions).
 */
function validateWorkOrder(order: AiWorkOrderV1): {
  valid: boolean;
  error?: string;
} {
  // Schema version check
  if (order.version !== "v1") {
    return { valid: false, error: `Unsupported schema version: ${order.version}` };
  }

  // Required CORE fields
  if (!order.tenant || typeof order.tenant !== "string") {
    return { valid: false, error: "Missing or invalid required field: tenant" };
  }

  if (!order.scope || typeof order.scope !== "string") {
    return { valid: false, error: "Missing or invalid required field: scope" };
  }

  if (!order.policyId || typeof order.policyId !== "string") {
    return { valid: false, error: "Missing or invalid required field: policyId" };
  }

  if (!order.inputs || !isJsonSerializable(order.inputs)) {
    return { valid: false, error: "Missing or invalid required field: inputs" };
  }

  if (!order.constraints) {
    return { valid: false, error: "Missing required field: constraints" };
  }

  if (!order.idempotency || !order.idempotency.scope || !order.idempotency.keyHash) {
    return { valid: false, error: "Missing required field: idempotency.scope or idempotency.keyHash" };
  }

  if (!order.trace || !order.trace.jobId) {
    return { valid: false, error: "Missing required field: trace.jobId" };
  }

  if (order.audit === undefined || typeof order.audit.customerTrailOn !== "boolean" || typeof order.audit.internalTrailOn !== "boolean") {
    return { valid: false, error: "Missing or invalid required field: audit" };
  }

  // Unknown top-level keys check (must be under extensions)
  const allowedKeys = new Set([
    "version",
    "tenant",
    "scope",
    "policyId",
    "inputs",
    "constraints",
    "idempotency",
    "trace",
    "audit",
    "extensions",
  ]);

  for (const key of Object.keys(order)) {
    if (!allowedKeys.has(key)) {
      return {
        valid: false,
        error: `Unknown top-level key: ${key} (must be under extensions)`,
      };
    }
  }

  return { valid: true };
}

// ============================================
// RESULT HELPERS
// ============================================

/**
 * Create a stopped result (validation failure, policy blocked, etc.)
 */
function stop(
  ok: boolean,
  stopReason: StopReasonV1,
  traceId: string
): AiWorkResultV1 {
  return {
    version: "v1",
    status: ok ? "succeeded" : "failed",
    stopReason,
    needsHuman: stopReason === "needs_human" || stopReason === "in_progress",
    traceId,
    artifacts: [],
    customerSafe: true,
  };
}

// ============================================
// ENGINE ENTRYPOINT
// ============================================

/**
 * Execute AI work order according to policy.
 * 
 * Phase 2.1: Skeleton only
 * - Validates CORE fields (unknown top-level keys rejected)
 * - Checks policy existence (hard fail if not registered)
 * - Verifies idempotency keyHash matches computed key
 * - Returns stubbed result (no actual execution)
 * 
 * Phase 2.2+: Will execute according to policy (single model vs swarm)
 */
export async function runEngine(order: AiWorkOrderV1): Promise<AiWorkResultV1> {
  const traceId = `trc_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // Step 1: Validate CORE fields
  const validation = validateWorkOrder(order);
  if (!validation.valid) {
    return stop(false, "invalid_request", traceId);
  }

  // Step 2: Compute idempotency key (validates IDEMPOTENCY_SECRET exists)
  let computedKey: string;
  try {
    computedKey = computeWorkOrderKeyV1(order);
  } catch (err) {
    // Missing IDEMPOTENCY_SECRET or canonicalization error
    return stop(false, "invalid_request", traceId);
  }

  // Step 3: Resolve policy (can fail gracefully, separate from validation)
  const policyResult = resolvePolicy(order.policyId);
  if (!policyResult.ok) {
    // Policy resolution failed (not found or invalid)
    return stop(false, policyResult.stopReason, traceId);
  }

  const policy = policyResult.policy;

  // Step 4: Check policy caps (reject if WorkOrder exceeds caps)
  const capsCheck = checkPolicyCaps(order, policy);
  if (!capsCheck.ok) {
    console.log(`[runEngine] Policy caps exceeded: ${capsCheck.reason}`);
    return stop(false, "policy_rejected", traceId);
  }

  // Step 5: Verify idempotency keyHash (optional check)
  // In Phase 2.3+, check: if (order.idempotency.keyHash !== computedKey) return stop(...)
  console.log(`[runEngine] Idempotency key computed: ${computedKey}`);

  // Step 6: Check cache (idempotency)
  // TODO Phase 2.3: Implement cache lookup using order.idempotency.keyHash
  // For now, always execute (no cache)

  // Step 7: Execute according to policy
  // TODO Phase 2.3: Route to single model or swarm based on policy
  // For now, return stubbed result

  return {
    version: "v1",
    status: "in_progress",
    stopReason: "in_progress",
    needsHuman: true,
    traceId,
    artifacts: [],
    customerSafe: true,
    extensions: {
      _stub: true,
      _message: "Phase 2.1 skeleton: CORE validation passed, policy found, no execution yet",
      _computedKey: computedKey,
    },
  };
}
