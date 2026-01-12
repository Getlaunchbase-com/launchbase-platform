# AI Drift Protocol v1

> **Purpose:** Detect, contain, and learn from AI drift without amplifying cost or eroding trust.

**Drift is expected. Silent drift is unacceptable.**

---

## 1. Definition of Drift

Drift is any change in AI behavior that alters:

- **Cost per approval** - How much we spend to get a customer "yes"
- **Approval rate** - How often customers accept AI proposals
- **Retry frequency** - How often operations need multiple attempts
- **Human escalation rate** - How often AI escalates to `needsHuman`
- **Output consistency** - Whether similar inputs produce similar outputs

Drift may be caused by:

- Model updates (provider-side changes)
- Prompt changes (our modifications)
- Traffic pattern shifts (new customer segments)
- Customer behavior changes (evolving preferences)

---

## 2. Drift Containment Layers

### Layer 1 — Determinism (Already Enforced)

- Prompt immutability (versioned, no runtime mutation)
- Schema-or-fail (no partial success)
- Versioned contracts (`stopReason` enum)

### Layer 2 — Idempotency (Already Enforced)

- Prevents retry amplification
- Guarantees single execution per intent
- Nonce-based ownership guards

### Layer 3 — Outcome Visibility

All runs emit:
- `stopReason` (why it stopped)
- `needsHuman` (escalation flag)
- `cached` (idempotency hit)
- `attemptCount` (retry counter)

**No silent retries. No hidden fallbacks.**

### Layer 4 — Human Escalation

When uncertainty crosses thresholds:
- AI halts execution
- `needsHuman = true`
- No forced automation

---

## 3. Required Drift Signals

These metrics **MUST** be queryable (read-only):

1. **Cost per approved action** - `SUM(estimatedUsd) / COUNT(approved)`
2. **Approval rate** - `COUNT(approved) / COUNT(proposals)`
3. **needsHuman rate** - `COUNT(needsHuman=true) / COUNT(total)`
4. **stopReason distribution** - Breakdown by `stopReason` value

### Secondary Signals

- **Cache hit rate** - `COUNT(cached=true) / COUNT(total)`
- **Stale takeover rate** - `COUNT(attemptCount > 1) / COUNT(total)`
- **Retry count distribution** - Histogram of `attemptCount`

---

## 4. Drift Detection Rules

| Signal | Threshold | Action |
|--------|-----------|--------|
| Cost ↑ | +25% WoW | Investigate models/prompts |
| Approval ↓ | −15% WoW | Review prompt/schema |
| needsHuman ↑ | +20% WoW | Tighten constraints |
| ajv_failed ↑ | >2% | Immediate rollback |

**WoW = Week over Week**

---

## 5. Drift Response Playbook

When drift is detected:

1. **Freeze prompts** - No edits until root cause identified
2. **Inspect traces** - Review internal trail (models, costs, retries)
3. **Compare against showroom baselines** - Check if drift is universal or localized
4. **Patch via versioned change** - Bump prompt version, test, deploy
5. **Re-run controlled traffic** - Verify fix before full rollout

**No hot-patching. No silent fixes.**

---

## 6. Learning Extraction

Approved customer interactions are:

- **Aggregated** - Grouped by intent, context, vertical
- **De-identified** - No PII, no customer names
- **Analyzed for:**
  - Constraint patterns (what customers consistently approve)
  - Approval heuristics (what predicts "yes")
  - Friction points (what causes rejections)

Learning feeds:

- **Prompt evolution** (versioned updates)
- **Default constraints** (smarter starting points)
- **Tiered offerings** (different quality/cost tiers)

---

## 7. Showroom Strategy

LaunchBase maintains multiple real sites as **digital showrooms**:

- LaunchBase (our own site)
- 3 additional AI-built sites
- Selected beta customers

These act as:

- **Drift baselines** - What "normal" looks like
- **Training signals** - What customers approve
- **Cost/quality comparators** - Different approaches, measured outcomes

---

## 8. Non-Goals

This protocol does **NOT** optimize for:

- Maximum creativity
- Model novelty
- Unbounded exploration

It optimizes for:

- **Trust** - Customers know what to expect
- **Explainability** - We can explain every decision
- **Cost control** - No surprise bills
- **Customer confidence** - Consistent, reliable outcomes

---

## 9. Review Cadence

**Weekly review** (even solo):

1. Check 4 required signals
2. Compare WoW deltas
3. Flag anomalies (>threshold)
4. Investigate if needed
5. Document findings

**Monthly review:**

1. Aggregate learnings from approvals
2. Identify prompt evolution candidates
3. Update showroom baselines
4. Review cost/quality tradeoffs

---

## 10. Field General Governance

Field General is an **orchestrator**, not a creative agent.

**Allowed:**
- Routing (which prompt pack to use)
- Caps enforcement (cost, rounds, time)
- Explanation (trace + prompt version)

**Forbidden:**
- Prompt mutation (no runtime edits)
- Hidden memory (no state outside GitHub + DB)
- Style optimization (no "learning" from feedback)

**Rule:** If a decision can't be explained via `traceId` + prompt version, it's invalid.

---

> **If drift cannot be measured, it cannot be controlled.**

This protocol ensures drift becomes **signal, not surprise**.

---

## References

- Implementation: `server/utils/idempotency.ts`
- Forever Contracts: `docs/FOREVER_CONTRACTS.md`
- Idempotency Keys: `docs/IDEMPOTENCY_KEYS.md`
- AI Tennis: `server/ai/runAiTennis.ts`
