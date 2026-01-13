/**
 * Engine Interface V1 — TypeScript Contracts (CORE + EXTENSIONS)
 * 
 * Stable contract between AI Engine (execution) and Application Skins (presentation).
 * 
 * Design Principle:
 * - CORE: Frozen v1.0, minimal, JSON-stable
 * - EXTENSIONS: Additive, future-proof, safely ignored if unknown
 * 
 * See docs/ENGINE_INTERFACE_V1.md for full specification.
 */

// ============================================
// CORE TYPES (FROZEN V1.0)
// ============================================

/**
 * Engine constraints (execution limits)
 */
export type EngineConstraints = {
  maxRounds?: number;          // 1-6
  costCapUsd?: number;         // Tier-dependent
  maxTokensTotal?: number;     // Safety cap
  timeoutMs?: number;          // Optional timeout
};

/**
 * Idempotency configuration (HMAC-based)
 * 
 * SECURITY: keyHash MUST be HMAC-SHA256 of canonicalized inputs.
 * NEVER include raw user text in key material.
 */
export type IdempotencyConfig = {
  scope: string;               // Execution scope (e.g., "actionRequests.aiProposeCopy")
  keyHash: string;             // HMAC-SHA256 of canonicalized inputs
  ttlHours?: number;           // Cache TTL (default: 24)
};

/**
 * Engine trace (audit trail)
 */
export type EngineTrace = {
  jobId: string;               // Deterministic when possible
  step?: string;               // Execution step (e.g., "generate_candidates")
  requestId?: string;          // ActionRequest ID if exists
  intakeId?: number;           // Intake ID if exists
  actor?: { type: "customer" | "system" | "admin"; id?: string };
};

/**
 * Audit configuration (trail settings)
 */
export type AuditConfig = {
  customerTrailOn: boolean;    // Store customer-safe trail
  internalTrailOn: boolean;    // Store internal-only trail
};

/**
 * Work Order (INPUT) — CORE v1.0
 * 
 * All fields are required and JSON-stable.
 * No optional fields in CORE (use extensions instead).
 */
export type AiWorkOrderV1 = {
  // CORE (frozen v1.0)
  version: "v1";
  tenant: string;
  scope: string;               // e.g., "actionRequests.aiProposeCopy"
  policyId: string;            // Policy reference (no tier branching in code)
  inputs: Record<string, unknown>; // JSON-serializable, no raw prompts
  constraints: EngineConstraints;
  idempotency: IdempotencyConfig;
  trace: EngineTrace;
  audit: AuditConfig;

  // EXTENSIONS (additive, safely ignored if unknown)
  extensions?: Record<string, unknown>;
};

/**
 * StopReason vocabulary (FOREVER CONTRACT §3)
 * 
 * This is the sole outcome signal. Changes require major version bump.
 */
export type StopReasonV1 =
  | "ok"
  | "needs_human"
  | "in_progress"
  | "provider_failed"
  | "router_failed"
  | "ajv_failed"
  | "json_parse_failed"
  | "rate_limited"
  | "cost_cap_exceeded"
  | "round_cap_exceeded"
  | "invalid_request"
  | "policy_not_found"
  | "policy_invalid"
  | "policy_rejected";

/**
 * Artifact (output payload)
 * 
 * Artifacts are the primary output surface.
 * Keep it boring: { kind, payload, customerSafe }
 */
export type AiArtifactV1 = {
  kind: string;                // e.g., "copy_proposal_v1", "design_brief_v1"
  payload: unknown;            // JSON-serializable
  customerSafe: boolean;       // Always true at boundary
};

/**
 * Work Result (OUTPUT) — CORE v1.0
 * 
 * All CORE fields are required and always present.
 * stopReason MUST always be present (FOREVER CONTRACT).
 */
export type AiWorkResultV1 = {
  // CORE (frozen v1.0)
  version: "v1";
  status: "succeeded" | "failed" | "in_progress";
  stopReason: StopReasonV1;    // ALWAYS present (FOREVER CONTRACT)
  needsHuman: boolean;
  traceId: string;
  artifacts: AiArtifactV1[];
  customerSafe: boolean;       // Always true at boundary

  // EXTENSIONS (additive, safely ignored if unknown)
  extensions?: Record<string, unknown>;
};

// ============================================
// EXTENSIONS TYPES (ADDITIVE)
// ============================================

/**
 * Work Order Extensions (optional, typed for convenience)
 * 
 * These are hints/preferences that don't affect CORE execution.
 * Policy can override any extension.
 */
export type AiWorkOrderV1Extensions = {
  intentType?: string;         // e.g., "copy_refine", "landing_page_section"
  presentationMode?: "single_best" | "side_by_side" | "ranked";
  providerHints?: {
    preferred?: string[];      // e.g., ["aiml", "openai"]
    allowFallback?: boolean;   // default: true
  };
  uiSkinHints?: string;        // e.g., "launchbase_portal", "ai_butler"
  [key: string]: unknown;      // Future-safe
};

/**
 * Work Result Extensions (optional, typed for convenience)
 * 
 * Rich metadata for observability and debugging.
 */
export type AiWorkResultV1Extensions = {
  meta?: {
    cached: boolean;
    attemptCount: number;
    rounds: number;
    calls: number;
    models: string[];
    estimatedUsd: number;
    inputTokens?: number;
    outputTokens?: number;
    requestIds?: string[];
  };
  swarm?: {
    fieldGeneralModel?: string;
    specialists: Array<{
      role: string;            // "craft" | "critic" | "compliance"
      model?: string;
      stopReason: StopReasonV1;
      confidence?: number;
    }>;
    swirls: number;
  };
  alternatives?: AiArtifactV1[]; // For side-by-side presentation
  costBreakdown?: {
    byModel: Record<string, { calls: number; costUsd: number }>;
    byProvider: Record<string, { calls: number; costUsd: number }>;
    total: number;
  };
  [key: string]: unknown;      // Future-safe
};

// ============================================
// POLICY TYPES (MINIMAL HOOK)
// ============================================

/**
 * Engine Policy (Phase 2.1 minimal, Phase 2.2 expands)
 * 
 * Policy is a reference, not logic.
 * No tier branching in code; policy resolution returns config.
 */
export type EnginePolicyV1 = {
  id: string;
  version: string;
  tier?: "base" | "pro" | "premium" | string;
  requiredCapabilities?: string[];
  preferredProvider?: string;
};

// ============================================
// ARTIFACT PAYLOAD TYPES (EXAMPLES)
// ============================================

/**
 * Copy Proposal Payload (example artifact type)
 */
export type CopyProposalPayload = {
  targetKey: string;
  value: string | unknown[] | Record<string, unknown>;
  rationale: string;
  confidence: number;
  risks: string[];
  assumptions: string[];
};

/**
 * Design Brief Payload (example artifact type)
 */
export type DesignBriefPayload = {
  title: string;
  description: string;
  constraints: string[];
  references: Array<{ kind: "url" | "fileRef"; ref: string }>;
};
