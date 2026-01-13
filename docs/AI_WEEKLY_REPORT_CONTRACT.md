# AI Weekly Report Contract — v1.0

**Status:** Frozen  
**Effective Date:** January 13, 2026  
**Owner:** LaunchBase Engineering  
**Related:** `docs/AI_DRIFT_PROTOCOL_V1.md`, `docs/AI_METRICS_QUERIES.md`

---

## Purpose

This document is the **single source of truth** for the semantics, format, and stability guarantees of the weekly AI Tennis metrics report. It defines the output contract so the report behaves like a stable API: predictable, versioned, and change-controlled.

After this contract is frozen, any change to section order, metric definitions, thresholds, or N/A rules requires a deliberate version bump and changelog entry.

---

## Output Contract

### File Path
```
reports/ai_weekly_<YYYY-MM-DD>.md
```

**Example:** `reports/ai_weekly_2026-01-12.md`

### Timezone
**UTC** (server default)

### Time Windows

| Window | Definition |
|--------|------------|
| **Current** | Last 7 days ending "now" (`NOW() - INTERVAL 7 DAY` → `NOW()`) |
| **Prior** | 7 days immediately before current (`NOW() - INTERVAL 14 DAY` → `NOW() - INTERVAL 7 DAY`) |

### Generation Frequency
**Weekly** (manual or scheduled via cron)

### Format
**Markdown** (GitHub-flavored, git-friendly, human-readable)

---

## Frozen Section Order

**DO NOT REORDER** these sections without a v2.0 version bump.

1. **Header** (title, system metadata, generation timestamp, environment)
2. **No-Data Banner** (conditional: only shown when no AI Tennis proposals found)
3. **1️⃣ StopReason Distribution (Drift Canary)**
4. **2️⃣ needsHuman Rate (Protocol Mismatch Detector)**
5. **3️⃣ Cost per Approval (Efficiency Index)**
6. **4️⃣ Approval Rate (Business Friction Signal)**
7. **5️⃣ Cache Hit Rate (Idempotency Health)**
8. **6️⃣ Stale Takeover Rate (Stability Detector)**
9. **📊 Summary** (worst-of flags across all metrics)
10. **Footer** (generation script reference, SQL source link)

---

## Metric Definitions (Frozen)

### 1. StopReason Distribution

**What it detects:** AI model/protocol failures and drift canaries

**Numerator:** `COUNT(*)` per `stopReason`

**Denominator:** `SUM(COUNT(*))` across all stopReasons

**Output format:** Table with columns: `stopReason`, `count`, `pct`, `WoW Δ`, `Flag`

**Flagging rules:**
- `provider_failed`: Warn > 5%, Critical > 10%
- `ajv_failed`: Warn > 2%, Critical > 5%
- `router_failed`: Warn > 5%, Critical > 10%
- `json_parse_failed`: Warn > 5%, Critical > 10%
- All other stopReasons: ✅ (no flag)

**Interpretation:** Spikes in error stopReasons are incident-worthy.

---

### 2. needsHuman Rate

**What it detects:** Prompt/protocol mismatch (not necessarily model failure)

**Numerator:** `SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END)`

**Denominator:** `COUNT(*)` (total AI proposals)

**Output format:** Table with columns: `period`, `This Week`, `WoW Δ`, `Flag`

**Flagging rules:**
- High is bad (flagHighRate)
- Warn > 15%
- Critical > 25%

**Interpretation:** Rising rate indicates prompt/protocol mismatch.

---

### 3. Cost per Approval

**What it detects:** Drift or inefficiency in AI costs

**Numerator:** `SUM(cost_usd)` for approved proposals

**Denominator:** `COUNT(*)` of approved proposals (status IN `applied`, `confirmed`, `locked`)

**Output format:** Table with columns: `tenant`, `7-day avg USD`, `30-day avg USD`, `WoW Δ`, `Flag`

**Flagging rules:**
- High is bad (flagHighNumber)
- Warn > +10% WoW delta
- Critical > +20% WoW delta

**Interpretation:** Rising cost per approval indicates drift or inefficiency.

---

### 4. Approval Rate

**What it detects:** UX friction or quality degradation

**Numerator:** `SUM(CASE WHEN status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END)`

**Denominator:** `COUNT(*)` (total AI proposals)

**Output format:** Table with columns: `tenant`, `This Week`, `WoW Δ`, `Flag`

**Flagging rules:**
- Low is bad (delta-based flagging)
- Warn if drop > 5pp (percentage points)
- Critical if drop > 10pp

**Interpretation:** Falling approval rate indicates UX friction or quality degradation.

---

### 5. Cache Hit Rate

**What it detects:** Idempotency health

**Numerator:** `SUM(CASE WHEN stop_reason = 'cached' THEN 1 ELSE 0 END)`

**Denominator:** `COUNT(*)` (total AI proposals)

**Output format:** Table with columns: `tenant`, `This Week`, `WoW Δ`, `Flag`

**Flagging rules:**
- Low is bad (flagLowRate)
- Warn < 85%
- Critical < 75%

**Interpretation:** Low cache hit rate can indicate missing idempotency usage or too-short TTL.

---

### 6. Stale Takeover Rate

**What it detects:** Cache invalidation issues or race conditions

**Numerator:** `SUM(CASE WHEN stop_reason = 'stale_takeover' THEN 1 ELSE 0 END)`

**Denominator:** `COUNT(*)` (total AI proposals)

**Output format:** Table with columns: `tenant`, `This Week`, `WoW Δ`, `Flag`

**Flagging rules:**
- High is bad (flagHighRate)
- Warn > 3%
- Critical > 5%

**Interpretation:** Rising stale takeover rate indicates cache invalidation issues or race conditions.

---

## N/A Rules (Hard Guarantees)

These rules are **non-negotiable** and prevent false alarms on empty data.

### Rule 1: Denominator-Based N/A
```
IF denominator <= 0 THEN
  rate = N/A
  flag = "—" (em dash, not empty string)
  WoW delta = N/A
END IF
```

### Rule 2: WoW Delta N/A Propagation
```
IF current_rate = N/A OR prior_rate = N/A THEN
  WoW delta = N/A
END IF
```

### Rule 3: No Flags on N/A
```
IF rate = N/A THEN
  flag = "—"
  DO NOT show ✅, ⚠️, or 🚨
END IF
```

### Rule 4: Zero vs N/A Distinction
```
0/10 = 0.0% (valid, can be flagged)
0/0  = N/A (invalid, no flag)
```

---

## Threshold Table (Frozen)

| Metric | Direction | Warn | Critical | Notes |
|--------|-----------|------|----------|-------|
| `provider_failed` rate | High is bad | > 5% | > 10% | Incident-worthy |
| `ajv_failed` rate | High is bad | > 2% | > 5% | Schema validation failure |
| `router_failed` rate | High is bad | > 5% | > 10% | Model routing failure |
| `json_parse_failed` rate | High is bad | > 5% | > 10% | JSON parsing failure |
| needsHuman rate | High is bad | > 15% | > 25% | Prompt/protocol mismatch |
| Cost per approval WoW Δ | High is bad | > +10% | > +20% | Relative percent change |
| Approval rate drop | Drop is bad | > 5pp | > 10pp | Percentage points (absolute) |
| Cache hit rate | Low is bad | < 85% | < 75% | Idempotency health |
| Stale takeover rate | High is bad | > 3% | > 5% | Cache invalidation issues |

---

## Data Source & JSON Paths (Frozen)

### Primary Table
```sql
action_requests
```

### Required Joins
```sql
action_requests.intakeId → intakes.tenant
```

### Filter Condition
```sql
JSON_UNQUOTE(JSON_EXTRACT(action_requests.rawInbound, '$.source')) = 'ai_tennis'
```

### JSON Paths (Frozen)
```
$.aiTennis.stopReason       → stop_reason
$.aiTennis.needsHuman       → needs_human (BOOLEAN)
$.aiTennis.costUsd          → cost_usd (DECIMAL)
$.aiTennis.traceId          → trace_id (STRING)
$.aiTennis.jobId            → job_id (STRING)
$.aiTennis.rounds           → rounds (INT)
$.aiTennis.models           → models (JSON ARRAY)
$.aiTennis.requestIds       → request_ids (JSON ARRAY)
$.aiTennis.usage            → usage (JSON OBJECT)
```

### Canonical Timestamp
```sql
action_requests.createdAt
```

**Note:** This is the "proposal creation moment" for all metrics. Do not mix with `sentAt` or `appliedAt`.

---

## Security / Redaction Rules

### NEVER Include in Reports
- ❌ Prompts (user input or system prompts)
- ❌ Provider payloads (raw API responses)
- ❌ Stack traces or error messages
- ❌ Customer PII (names, emails, addresses)

### Safe to Include
- ✅ `traceId` (internal correlation ID)
- ✅ `stopReason` (enum value only)
- ✅ Aggregate metrics (counts, rates, costs)
- ✅ Tenant identifiers (if anonymized)

### Internal-Only (Not in Customer-Facing Reports)
- ⚠️ `requestIds` (may expose provider details)
- ⚠️ `jobId` (internal workflow ID)

---

## Change Policy

### Version Semantics

**v1.0.x (Patch):**
- Typos, grammar, clarity improvements
- No semantic changes
- No threshold changes
- No section reordering

**v1.x.0 (Minor):**
- New metric added (append to end, do not reorder)
- Threshold adjustment (requires changelog entry)
- New column added to existing table
- Requires: changelog entry + drift protocol review

**v2.0.0 (Major):**
- Section order changed
- Metric removed or renamed
- Breaking semantic change (e.g., denominator definition)
- Requires: changelog entry + architectural review + migration plan

### Required Steps for Change

1. **Propose change** in GitHub issue or RFC
2. **Review with Field General** (AI Drift Protocol owner)
3. **Update version number** in this doc
4. **Add changelog entry** at top of this doc
5. **Update `AI_DRIFT_PROTOCOL_V1.md`** if thresholds change
6. **Commit contract change first**, then code changes in separate PR

### Changelog Location
Append to top of this document under `## Changelog` heading.

---

## Changelog

### v1.0.0 — January 13, 2026
- Initial contract freeze
- Locked section order (1-6 + Summary)
- Locked metric definitions (6 canonical metrics)
- Locked N/A rules (denominator-based, no false flags)
- Locked thresholds (warn/critical per metric)
- Locked data source (action_requests.rawInbound.aiTennis)

---

## Appendix: Example Output

See `reports/ai_weekly_2026-01-12.md` for a reference implementation of this contract.

---

**Contract Owner:** LaunchBase Engineering  
**Last Reviewed:** January 13, 2026  
**Next Review:** After first real workflow test (Phase 1.3 Gate A)
