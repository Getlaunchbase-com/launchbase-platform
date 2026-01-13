# Engine Interface V1 — CORE + EXTENSIONS

**Version:** v1.0  
**Status:** 🔒 **FROZEN CORE** — Extensions additive only  
**Author:** Manus AI  
**Date:** January 13, 2026

---

## Purpose

This document defines the stable contract between the **AI Engine** (execution layer) and **Application Skins** (presentation layer). The engine executes AI workflows according to policy constraints and returns results in a standardized format.

**Core Principle:**

> The engine never knows which UI is calling it. The UI never knows which models are executing.

This separation enables horizontal scaling across multiple products (LaunchBase portal, AI Butler, mobile apps, APIs) without rewrites or forks.

---

## CORE + EXTENSIONS Design

To prevent "v1 becomes v0.9 forever" syndrome, the contract is split into two layers:

### CORE (Frozen v1.0)
- Minimal, stable fields required for all executions
- Changes require major version bump (v2.0.0)
- No optional fields in CORE (use EXTENSIONS instead)

### EXTENSIONS (Additive)
- Future-proof hooks for rich features (AI Butler, swarm details, presentation modes)
- New extensions are backward-compatible (minor version bump)
- Unknown extensions are safely ignored by engine

**Rule:** All new fields MUST go into `extensions`, never into CORE.

---

## Contract: AiWorkOrderV1

A work order represents a single AI execution request.

### CORE Fields (Frozen v1.0)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"v1"` | Yes | Contract version |
| `tenant` | `string` | Yes | Tenant identifier (e.g., "launchbase", "vinces") |
| `scope` | `string` | Yes | Execution scope (e.g., "actionRequests.aiProposeCopy") |
| `policyId` | `string` | Yes | Policy identifier (e.g., "launchbase_standard") |
| `inputs` | `Record<string, unknown>` | Yes | Customer-safe inputs (JSON-serializable, no raw prompts) |
| `constraints` | `EngineConstraints` | Yes | Execution limits (cost, rounds, tokens, time) |
| `idempotency` | `IdempotencyConfig` | Yes | Idempotency settings (keyHash, ttlHours) |
| `trace` | `EngineTrace` | Yes | Audit trail (jobId, step) |
| `audit` | `AuditConfig` | Yes | Trail configuration (customerTrailOn, internalTrailOn) |

### EXTENSIONS Fields (Additive)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `intentType` | `string?` | No | Rich intent classification (copy_refine, landing_page_section, etc.) |
| `presentationMode` | `string?` | No | Output format hint (single_best, side_by_side, ranked) |
| `providerHints` | `ProviderHints?` | No | Provider/model preferences (policy can override) |
| `uiSkinHints` | `string?` | No | UI context (launchbase_portal, ai_butler, api) |

**TypeScript Definition:**

```typescript
export type AiWorkOrderV1 = {
  // CORE (frozen v1.0)
  version: "v1";
  tenant: string;
  scope: string;
  policyId: string;
  inputs: Record<string, unknown>;
  constraints: EngineConstraints;
  idempotency: IdempotencyConfig;
  trace: EngineTrace;
  audit: AuditConfig;

  // EXTENSIONS (additive)
  extensions?: {
    intentType?: string;
    presentationMode?: "single_best" | "side_by_side" | "ranked";
    providerHints?: ProviderHints;
    uiSkinHints?: string;
    [key: string]: unknown; // future-safe
  };
};
```

---

## Contract: AiWorkResultV1

The engine's response, split into CORE (always present) and EXTENSIONS (optional).

### CORE Fields (Frozen v1.0)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `version` | `"v1"` | Yes | Contract version |
| `status` | `"succeeded" \| "failed" \| "in_progress"` | Yes | Execution status |
| `stopReason` | `StopReasonV1` | Yes | Why execution stopped (FOREVER CONTRACT §3) |
| `needsHuman` | `boolean` | Yes | Whether human review is required |
| `traceId` | `string` | Yes | Trace identifier for debugging |
| `artifacts` | `AiArtifactV1[]` | Yes | Customer-safe output artifacts |
| `customerSafe` | `boolean` | Yes | Always `true` at boundary (no internal leakage) |

### EXTENSIONS Fields (Additive)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `swarm` | `SwarmMeta?` | No | Swarm execution details (specialists, critiques, swirls) |
| `alternatives` | `AiArtifactV1[]?` | No | Alternative proposals (for side-by-side presentation) |
| `costBreakdown` | `CostBreakdown?` | No | Internal-only cost attribution |
| `meta` | `ExecutionMeta?` | No | Execution stats (rounds, calls, models, tokens, cost) |

**TypeScript Definition:**

```typescript
export type AiWorkResultV1 = {
  // CORE (frozen v1.0)
  version: "v1";
  status: "succeeded" | "failed" | "in_progress";
  stopReason: StopReasonV1;
  needsHuman: boolean;
  traceId: string;
  artifacts: AiArtifactV1[];
  customerSafe: boolean; // always true

  // EXTENSIONS (additive)
  extensions?: {
    swarm?: SwarmMeta;
    alternatives?: AiArtifactV1[];
    costBreakdown?: CostBreakdown;
    meta?: ExecutionMeta;
    [key: string]: unknown; // future-safe
  };
};
```

---

## Supporting Types

### EngineConstraints

```typescript
export type EngineConstraints = {
  maxRounds?: number;          // 1-6 (default: policy-defined)
  costCapUsd?: number;         // Tier-dependent
  maxTokensTotal?: number;     // Safety cap
  timeoutMs?: number;          // Optional timeout
};
```

### IdempotencyConfig

**HMAC-based idempotency (non-negotiable):**

```typescript
export type IdempotencyConfig = {
  keyHash: string;             // HMAC-SHA256 of canonicalized inputs
  ttlHours?: number;           // Cache TTL (default: 24)
};
```

**Key Derivation:**

```typescript
// NEVER include raw user text in key material
const canonical = JSON.stringify({
  version: order.version,
  tenant: order.tenant,
  scope: order.scope,
  policyId: order.policyId,
  inputs: order.inputs, // must be pre-hashed if contains user text
  constraints: order.constraints,
});

const keyHash = createHmac("sha256", IDEMPOTENCY_SECRET)
  .update(canonical)
  .digest("hex");
```

**Security Rules:**
- Requires `IDEMPOTENCY_SECRET` environment variable
- Raw user text MUST be hashed before inclusion in `inputs`
- Key is stable for same inputs (enables idempotent retries)

### EngineTrace

```typescript
export type EngineTrace = {
  jobId: string;               // Deterministic when possible
  step?: string;               // Execution step (e.g., "generate_candidates")
  requestId?: string;          // ActionRequest ID if exists
  intakeId?: number;           // Intake ID if exists
  actor?: { type: "customer" | "system" | "admin"; id?: string };
};
```

### AuditConfig

```typescript
export type AuditConfig = {
  customerTrailOn: boolean;    // Store customer-safe trail
  internalTrailOn: boolean;    // Store internal-only trail
};
```

### ProviderHints (EXTENSIONS)

```typescript
export type ProviderHints = {
  preferred?: string[];        // e.g., ["aiml", "openai"]
  allowFallback?: boolean;     // default: true
};
```

---

## StopReason Vocabulary (FOREVER CONTRACT §3)

The `stopReason` field is the **sole outcome signal**. It uses a frozen vocabulary that never changes without a major version bump.

**Vocabulary (v1.0):**

| StopReason | Meaning | Customer-Safe? |
|------------|---------|----------------|
| `ok` | Execution succeeded | Yes |
| `needs_human` | AI escalated to human review | Yes |
| `in_progress` | Execution still running (async) | Yes |
| `provider_failed` | Provider returned error | No (map to `needs_human`) |
| `router_failed` | Model router found no eligible models | No (map to `needs_human`) |
| `ajv_failed` | Schema validation failed | No (map to `needs_human`) |
| `json_parse_failed` | JSON parsing failed | No (map to `needs_human`) |
| `rate_limited` | Provider rate limit hit | Yes (abstracted) |
| `cost_cap_exceeded` | Cost cap reached | Yes |
| `round_cap_exceeded` | Round cap reached | Yes |
| `invalid_request` | Work order validation failed | Yes |

**Customer-Safe Mapping:**

Internal stopReasons are mapped to customer-safe equivalents:

- `provider_failed` → `needs_human` (message: "Temporary issue, we'll handle it")
- `router_failed` → `needs_human` (message: "We're reviewing your request")
- `ajv_failed` → `needs_human` (message: "We need to review this manually")
- `json_parse_failed` → `needs_human` (message: "We need to review this manually")

---

## Artifacts

Artifacts are typed outputs returned to the customer.

**TypeScript Definition:**

```typescript
export type AiArtifactV1 =
  | {
      kind: "copy_proposal_v1";
      payload: {
        targetKey: string;
        value: string | unknown[] | Record<string, unknown>;
        rationale: string;
        confidence: number;
        risks: string[];
        assumptions: string[];
      };
    }
  | {
      kind: string; // future-safe
      payload: Record<string, unknown>;
    };
```

**Adding New Artifact Types:**

New artifact types are **minor version** changes:
1. Add new `kind` value (e.g., `"design_brief_v1"`)
2. Define payload schema
3. Update documentation
4. No breaking changes to existing artifacts

---

## EXTENSIONS Details

### SwarmMeta (EXTENSIONS)

```typescript
export type SwarmMeta = {
  fieldGeneralModel?: string;
  specialists: Array<{
    role: string;              // "craft" | "critic" | "compliance"
    model?: string;
    stopReason: StopReasonV1;
    confidence?: number;
  }>;
  swirls: number;              // How many swirl rounds executed
};
```

### ExecutionMeta (EXTENSIONS)

```typescript
export type ExecutionMeta = {
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
```

### CostBreakdown (EXTENSIONS, Internal-Only)

```typescript
export type CostBreakdown = {
  byModel: Record<string, { calls: number; costUsd: number }>;
  byProvider: Record<string, { calls: number; costUsd: number }>;
  total: number;
};
```

---

## Policy Hook

The engine loads policy by `policyId`. **No tier branching in code.**

**Minimal Policy Type (Phase 2.1):**

```typescript
export type EnginePolicyV1 = {
  id: string;
  version: string;
  tier?: "base" | "pro" | "premium" | string;
  requiredCapabilities?: string[];
  preferredProvider?: string;
};
```

**Policy Resolution:**

1. Engine looks up `policyId` in `POLICY_REGISTRY`
2. If not found, engine returns `stopReason: "invalid_request"`
3. Policy defines routing, constraints, escalation rules (Phase 2.2)

---

## Idempotency Guarantees

The engine guarantees idempotent execution: **same work order → same result (or cached)**.

**How It Works:**

1. Caller derives `idempotency.keyHash` using HMAC-SHA256
2. Engine checks cache for existing result with same `keyHash`
3. If found and not stale (within `ttlHours`), engine returns cached result
4. If not found, engine executes and caches result

**Cache Invalidation:**

- Cache entries expire after `ttlHours` (default: 24)
- Cache entries are invalidated if policy version changes
- Cache entries are invalidated if schema version changes

**Security:**

- `keyHash` is HMAC-based (requires `IDEMPOTENCY_SECRET`)
- Raw user text is **never** in key material (must be hashed first)
- Cache keys are tenant-scoped (no cross-tenant leakage)

---

## Redaction Rules

The engine applies strict redaction rules before storing any data.

**Always Redacted:**

- Raw prompts (user-provided or templated)
- Provider API keys or credentials
- Provider error messages (fingerprinted instead)
- Stack traces (fingerprinted instead)
- Internal system state

**Always Stored:**

- Hashes and fingerprints (SHA-256 or HMAC-SHA256)
- Schema version IDs
- Trace IDs and request IDs
- Token counts and cost estimates
- Model names and provider names

---

## Change Policy

This contract follows semantic versioning:

### Patch (v1.0.x)
- Bug fixes in documentation
- Clarifications that don't change behavior
- No code changes required

### Minor (v1.x.0)
- New EXTENSIONS fields added
- New artifact `kind` types added
- New optional fields in EXTENSIONS
- Backward-compatible changes

### Major (v2.0.0)
- Breaking changes to CORE fields
- Removed CORE fields
- Changed stopReason vocabulary
- Non-backward-compatible changes

**Deprecation Policy:**

- Minor version changes: no deprecation needed
- Major version changes: 90-day deprecation notice
- Deprecated versions: supported for 180 days after major release

---

## Examples

### Example 1: LaunchBase Standard (Minimal CORE)

**Work Order:**

```json
{
  "version": "v1",
  "tenant": "launchbase",
  "scope": "actionRequests.aiProposeCopy",
  "policyId": "launchbase_standard",
  "inputs": {
    "intakeId": 42,
    "actionRequestId": 123,
    "userTextHash": "sha256:abc123...",
    "targetSection": "hero",
    "currentCopy": { "headline": "Stop carrying the system in your head" }
  },
  "constraints": {
    "maxRounds": 2,
    "costCapUsd": 2.0,
    "maxTokensTotal": 12000,
    "timeoutMs": 30000
  },
  "idempotency": {
    "keyHash": "hmac-sha256:def456...",
    "ttlHours": 24
  },
  "trace": {
    "jobId": "copy-refine-abc123",
    "step": "generate_candidates"
  },
  "audit": {
    "customerTrailOn": true,
    "internalTrailOn": true
  }
}
```

**Result:**

```json
{
  "version": "v1",
  "status": "succeeded",
  "stopReason": "ok",
  "needsHuman": false,
  "traceId": "trc_1234567890",
  "artifacts": [
    {
      "kind": "copy_proposal_v1",
      "payload": {
        "targetKey": "hero.headline",
        "value": "Your website exists. Your tools work. But no one owns the system.",
        "rationale": "Emphasizes the problem more directly",
        "confidence": 0.87,
        "risks": ["May be too negative"],
        "assumptions": ["Target audience feels this pain"]
      }
    }
  ],
  "customerSafe": true,
  "extensions": {
    "meta": {
      "cached": false,
      "attemptCount": 1,
      "rounds": 1,
      "calls": 3,
      "models": ["gpt-4o-mini"],
      "estimatedUsd": 0.06,
      "inputTokens": 1200,
      "outputTokens": 300
    }
  }
}
```

---

### Example 2: LaunchBase Swarm Premium (CORE + EXTENSIONS)

**Work Order:**

```json
{
  "version": "v1",
  "tenant": "launchbase",
  "scope": "actionRequests.aiProposeCopy",
  "policyId": "launchbase_swarm_premium",
  "inputs": {
    "intakeId": 43,
    "userTextHash": "sha256:xyz789...",
    "targetSection": "hero",
    "context": {
      "industry": "software",
      "audience": "product managers"
    }
  },
  "constraints": {
    "maxRounds": 3,
    "costCapUsd": 5.0,
    "maxTokensTotal": 16000
  },
  "idempotency": {
    "keyHash": "hmac-sha256:ghi012...",
    "ttlHours": 24
  },
  "trace": {
    "jobId": "landing-hero-def456",
    "step": "swarm_execute"
  },
  "audit": {
    "customerTrailOn": true,
    "internalTrailOn": true
  },
  "extensions": {
    "intentType": "landing_page_section",
    "presentationMode": "single_best"
  }
}
```

**Result:**

```json
{
  "version": "v1",
  "status": "succeeded",
  "stopReason": "ok",
  "needsHuman": false,
  "traceId": "trc_9876543210",
  "artifacts": [
    {
      "kind": "copy_proposal_v1",
      "payload": {
        "targetKey": "hero.headline",
        "value": "Stop Losing Context in Slack Threads",
        "rationale": "Addresses pain point directly, implies automation benefit",
        "confidence": 0.92,
        "risks": ["May be too specific to Slack users"],
        "assumptions": ["Target audience uses Slack"]
      }
    }
  ],
  "customerSafe": true,
  "extensions": {
    "swarm": {
      "fieldGeneralModel": "gpt-4o",
      "specialists": [
        {
          "role": "craft",
          "model": "gpt-4o-mini",
          "stopReason": "ok",
          "confidence": 0.88
        },
        {
          "role": "critic",
          "model": "claude-3-5-sonnet",
          "stopReason": "ok",
          "confidence": 0.90
        }
      ],
      "swirls": 2
    },
    "meta": {
      "cached": false,
      "attemptCount": 1,
      "rounds": 2,
      "calls": 5,
      "models": ["gpt-4o", "gpt-4o-mini", "claude-3-5-sonnet"],
      "estimatedUsd": 1.23,
      "inputTokens": 4500,
      "outputTokens": 800
    }
  }
}
```

---

### Example 3: AI Butler (Side-by-Side Presentation)

**Work Order:**

```json
{
  "version": "v1",
  "tenant": "butler",
  "scope": "consumer.copyRefine",
  "policyId": "butler_basic",
  "inputs": {
    "userTextHash": "sha256:jkl345...",
    "currentCopy": { "subject": "Weekly Newsletter #42" }
  },
  "constraints": {
    "maxRounds": 1,
    "costCapUsd": 0.10
  },
  "idempotency": {
    "keyHash": "hmac-sha256:mno678...",
    "ttlHours": 6
  },
  "trace": {
    "jobId": "email-subject-ghi789",
    "actor": { "type": "customer", "id": "user-12345" }
  },
  "audit": {
    "customerTrailOn": true,
    "internalTrailOn": false
  },
  "extensions": {
    "intentType": "copy_refine",
    "presentationMode": "side_by_side",
    "providerHints": {
      "preferred": ["openai", "anthropic"],
      "allowFallback": true
    },
    "uiSkinHints": "ai_butler"
  }
}
```

**Result:**

```json
{
  "version": "v1",
  "status": "succeeded",
  "stopReason": "ok",
  "needsHuman": false,
  "traceId": "trc_1122334455",
  "artifacts": [
    {
      "kind": "copy_proposal_v1",
      "payload": {
        "targetKey": "email.subject",
        "value": "Your Weekly Insights: 5 Ideas You Can Use Today",
        "rationale": "Creates urgency and value proposition",
        "confidence": 0.85,
        "risks": [],
        "assumptions": []
      }
    }
  ],
  "customerSafe": true,
  "extensions": {
    "alternatives": [
      {
        "kind": "copy_proposal_v1",
        "payload": {
          "targetKey": "email.subject",
          "value": "This Week's Must-Read: Practical Tips Inside",
          "rationale": "Emphasizes practicality and exclusivity",
          "confidence": 0.82,
          "risks": [],
          "assumptions": []
        }
      }
    ],
    "meta": {
      "cached": false,
      "attemptCount": 1,
      "rounds": 1,
      "calls": 2,
      "models": ["gpt-4o-mini", "claude-3-5-sonnet"],
      "estimatedUsd": 0.06
    }
  }
}
```

---

## Integration with Phase 1

This interface builds on Phase 1 foundations:

### Reused Concepts
- **stopReason vocabulary** — Same as Phase 1 (FOREVER CONTRACT §3)
- **needsHuman escalation** — Same logic as Phase 1
- **Idempotency** — Enhanced with HMAC (Phase 1 used simple hashing)
- **Audit trail split** — Customer vs internal (same as rawInbound.aiTennis)

### New Concepts
- **CORE + EXTENSIONS** — Prevents contract bloat
- **Policy-as-config** — Tier behavior is config, not code
- **Artifacts array** — Flexible, typed outputs
- **HMAC idempotency** — Requires secret, more secure

---

## Acceptance Criteria

Phase 2.1 is complete when:

1. ✅ ENGINE_INTERFACE_V1.md exists with CORE+EXTENSIONS design
2. ✅ TypeScript types compile and match documentation
3. ✅ runEngine() skeleton validates CORE fields
4. ✅ runEngine() safely ignores unknown extensions
5. ✅ stopReason always present in result
6. ✅ Idempotency key is HMAC-based and stable
7. ✅ Test proves unknown fields must live under extensions

---

## References

- **Phase 1 Baseline:** `docs/PHASE_1_BASELINE_TAGGED.md`
- **Forever Contracts:** `docs/FOREVER_CONTRACTS.md`
- **AI Drift Protocol:** `docs/AI_DRIFT_PROTOCOL_V1.md`
- **Feature Aliases:** `docs/FEATURE_ALIASES.md`

---

**Contract Owner:** LaunchBase Engineering  
**Next Review:** After Phase 2.2 (Policy Registry) implementation
