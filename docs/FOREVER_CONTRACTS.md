# Forever Contracts

> **These are constitutional. They do not change without versioning + migration.**

LaunchBase is built on infrastructure guarantees that enable trust, explainability, and cost control. These contracts are non-negotiable and must be treated as foundational.

---

## 1. stopReason is the Only Outcome Vocabulary

**Contract:**
- Every AI operation returns a `stopReason` enum value
- `stopReason` is the single source of truth for why an operation completed, failed, or escalated
- No silent failures, no partial success, no hidden fallbacks

**Allowed values:**
- `ok` - Operation succeeded
- `needs_human` - Escalated to human review
- `provider_failed` - AI provider error
- `ajv_failed` - Schema validation failed
- `in_progress` - Operation still running (idempotency)

**Forbidden:**
- Returning success when validation failed
- Hiding errors in nested fields
- Using provider-specific error codes in customer responses

---

## 2. Prompt Packs are Immutable at Runtime

**Contract:**
- Prompts are versioned in `promptPacks/` directory
- No runtime mutation, no dynamic prompt generation
- Every AI call references a specific prompt version
- Rollback is instant (change version reference)

**Allowed:**
- Loading prompts from versioned files
- Injecting variables into prompt templates
- Switching between prompt versions via configuration

**Forbidden:**
- Modifying prompts based on AI feedback
- Concatenating prompts from multiple sources
- Storing prompts in database or memory

---

## 3. Schema-or-Fail Discipline

**Contract:**
- AI output must conform to declared schema
- Invalid output = `stopReason: "ajv_failed"`
- No partial parsing, no "best effort" extraction

**Enforcement:**
- Zod/AJV validation on every AI response
- Validation failure triggers escalation, not silent degradation
- Schema changes require version bump

**Forbidden:**
- Accepting malformed JSON
- Inferring structure from unstructured output
- Falling back to default values on validation failure

---

## 4. Two Audit Trails (Never Cross the Streams)

**Contract:**
- **Internal trail** (operators): models, retries, costs, stopReasons, prompt versions, ownership/takeover data
- **Customer trail**: proposals, rationale, confidence, approvals, timeline

**Separation enforced by:**
- Response sanitization (allowlist-based)
- No prompts in `response_json`
- No error messages in customer-facing responses
- No provider metadata in customer trail

**Forbidden:**
- Exposing internal trace data to customers
- Storing customer decisions in internal-only tables
- Mixing operational metrics with customer-facing audit logs

---

## 5. Idempotency Ownership Guards (Nonce-Based)

**Contract:**
- Every expensive operation protected by idempotency key
- Ownership proven by `claim_nonce` (40-char random hex)
- Commit guarded by `WHERE claim_nonce = myClaimNonce`
- `affectedRows === 1` enforced (loser cannot commit)

**Guarantees:**
- One execution per intent (no double-spend)
- No retry amplification
- Precision-proof (no timestamp rounding issues)
- Stale takeover safe (loser cannot overwrite winner)

**Forbidden:**
- Timestamp-based ownership guards
- Optimistic locking without nonce verification
- Committing without checking `affectedRows`

---

## Why These Contracts Matter

These five contracts create a **trust foundation**:

1. **stopReason** → Explainability (we always know why)
2. **Prompt immutability** → Determinism (same input = same behavior)
3. **Schema-or-fail** → Reliability (no silent degradation)
4. **Two trails** → Transparency (customers see rationale, ops see mechanics)
5. **Nonce-based guards** → Safety (no lost updates, no retry storms)

Without these, AI systems drift silently, costs explode, and customer trust erodes.

---

## Enforcement

- **Code reviews** must verify contract compliance
- **Tests** must prove contract guarantees (canary tests, ownership tests, sanitization tests)
- **Incidents** caused by contract violations require postmortem + permanent test

---

## Evolution

These contracts **do not change** without:
1. Versioned migration plan
2. Backward compatibility guarantee
3. Customer communication (if customer-facing)
4. Updated tests proving new contract

**Rationale:** These are infrastructure guarantees, not features. Breaking them breaks trust.

---

> If you can't explain a decision via `stopReason` + `traceId` + prompt version, it's invalid.
