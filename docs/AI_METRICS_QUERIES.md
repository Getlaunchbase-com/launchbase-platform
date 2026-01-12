# AI Metrics Queries

**Version:** 1.0  
**Status:** Canonical  
**Last Updated:** January 12, 2026

> **Purpose:** Define the canonical SQL queries for measuring AI Tennis drift and health.  
> **Principle:** Truth before tooling. These queries are the single source of truth for all drift metrics.

---

## 0. Definitions (FROZEN)

These definitions are **constitutional**. Changes require versioning + architectural review.

### Unit of Analysis

**AI Tennis proposal attempt** = one `ActionRequest` with `rawInbound.source = "ai_tennis"`

### Field Definitions

| Field | Canonical Source | Description |
|-------|------------------|-------------|
| **Approval** | `action_requests.status IN ('applied','confirmed','locked')` | Customer approved the AI proposal |
| **Needs Human** | `rawInbound.aiTennis.needsHuman = true` OR `stopReason = 'needs_human'` | AI escalated to human review |
| **Stop Reason** | `rawInbound.aiTennis.stopReason` | Why the AI operation completed/failed |
| **Cost** | `rawInbound.aiTennis.costUsd` | Total cost of the AI Tennis run (USD) |
| **Tenant** | `intakes.tenant` (joined via `action_requests.intakeId`) | Customer tenant identifier |
| **Trace ID** | `rawInbound.aiTennis.traceId` | Opaque trace identifier for debugging |

### Hard Rules

1. **Pick exactly one canonical source** for each field (event meta OR rawInbound)
2. **Do not mix sources** unless using explicit `COALESCE` with documented reason
3. **All queries MUST use the shared base CTE** (`ai_proposals`) for consistency
4. **Time windows** are always relative to `NOW()` (no absolute dates in canonical queries)

---

## Base CTE: `ai_proposals`

**This CTE MUST be used in every query.** All metrics share this definition.

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
```

**Note:** If using `action_request_events` as canonical source, mirror the above but from events where `eventType='AI_PROPOSE_COPY'` and join to `action_requests`/`intakes`. Pick one and stick to it.

---

## 1. stopReason Distribution (Drift Canary)

**Purpose:** Detect AI behavior changes over time.  
**Interpretation:** Any spike in error stopReasons is incident-worthy.

### 7-Day by Tenant

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  tenant,
  stop_reason,
  COUNT(*) AS n
FROM ai_proposals
WHERE created_at >= NOW() - INTERVAL 7 DAY
GROUP BY tenant, stop_reason
ORDER BY tenant, n DESC;
```

### 24-Hour Overall

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  stop_reason,
  COUNT(*) AS n
FROM ai_proposals
WHERE created_at >= NOW() - INTERVAL 24 HOUR
GROUP BY stop_reason
ORDER BY n DESC;
```

### 30-Day Overall

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  stop_reason,
  COUNT(*) AS n
FROM ai_proposals
WHERE created_at >= NOW() - INTERVAL 30 DAY
GROUP BY stop_reason
ORDER BY n DESC;
```

### Interpretation Contract

| stopReason | Meaning | Action |
|------------|---------|--------|
| `router_failed` | Model routing failed | **Incident-worthy** |
| `provider_failed` | AI provider error | **Incident-worthy** |
| `ajv_failed` | Schema validation failed | **Incident-worthy** |
| `json_parse_failed` | JSON parsing failed | **Incident-worthy** |
| `needs_human` | AI escalated to human | Prompt/protocol mismatch OR UX mismatch |
| `ok` | Success | Normal |
| `cached` | Idempotency hit | Normal (good) |

---

## 2. needsHuman Rate (Protocol Mismatch Detector)

**Purpose:** Measure how often AI escalates to human review.  
**Interpretation:** Rising rate indicates prompt/protocol mismatch, not model failure.

### 7-Day Rate by Tenant

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  tenant,
  COUNT(*) AS total,
  SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) AS needs_human_count,
  ROUND(
    SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) / COUNT(*),
    4
  ) AS needs_human_rate
FROM ai_proposals
WHERE created_at >= NOW() - INTERVAL 7 DAY
GROUP BY tenant
ORDER BY needs_human_rate DESC;
```

### 24-Hour Overall

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) AS needs_human_count,
  ROUND(
    SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) / COUNT(*),
    4
  ) AS needs_human_rate
FROM ai_proposals
WHERE created_at >= NOW() - INTERVAL 24 HOUR;
```

---

## 3. Cost per Approval (Only Cost Number That Matters)

**Purpose:** Measure economic efficiency of AI Tennis.  
**Interpretation:** Rising cost per approval indicates drift or inefficiency.

### 7-Day by Tenant

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
),
approved AS (
  SELECT
    ap.tenant,
    ap.action_request_id,
    ap.cost_usd
  FROM ai_proposals ap
  WHERE ap.status IN ('applied','confirmed','locked')
)
SELECT
  ap.tenant,
  COUNT(*) AS proposals,
  ROUND(SUM(ap.cost_usd), 4) AS total_cost_usd,
  (SELECT COUNT(*) FROM approved a WHERE a.tenant = ap.tenant) AS approvals,
  CASE
    WHEN (SELECT COUNT(*) FROM approved a WHERE a.tenant = ap.tenant) = 0 THEN NULL
    ELSE ROUND(
      SUM(ap.cost_usd) / (SELECT COUNT(*) FROM approved a WHERE a.tenant = ap.tenant),
      4
    )
  END AS cost_per_approval_usd
FROM ai_proposals ap
WHERE ap.created_at >= NOW() - INTERVAL 7 DAY
GROUP BY ap.tenant
ORDER BY cost_per_approval_usd DESC;
```

### 30-Day by Tenant

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
),
approved AS (
  SELECT
    ap.tenant,
    ap.action_request_id,
    ap.cost_usd
  FROM ai_proposals ap
  WHERE ap.status IN ('applied','confirmed','locked')
)
SELECT
  ap.tenant,
  COUNT(*) AS proposals,
  ROUND(SUM(ap.cost_usd), 4) AS total_cost_usd,
  (SELECT COUNT(*) FROM approved a WHERE a.tenant = ap.tenant) AS approvals,
  CASE
    WHEN (SELECT COUNT(*) FROM approved a WHERE a.tenant = ap.tenant) = 0 THEN NULL
    ELSE ROUND(
      SUM(ap.cost_usd) / (SELECT COUNT(*) FROM approved a WHERE a.tenant = ap.tenant),
      4
    )
  END AS cost_per_approval_usd
FROM ai_proposals ap
WHERE ap.created_at >= NOW() - INTERVAL 30 DAY
GROUP BY ap.tenant
ORDER BY cost_per_approval_usd DESC;
```

**Note:** This is intentionally "proposal-cost per approvals" not "per customer" — keep it simple until you need cohort modeling.

---

## 4. Approval Rate (Business Friction Detector)

**Purpose:** Measure how often customers approve AI proposals.  
**Interpretation:** Falling approval rate indicates output quality issues or UX friction.

### 7-Day by Tenant

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  ap.tenant,
  COUNT(*) AS total,
  SUM(CASE WHEN ap.status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) AS approved,
  ROUND(
    SUM(CASE WHEN ap.status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) / COUNT(*),
    4
  ) AS approval_rate
FROM ai_proposals ap
WHERE ap.created_at >= NOW() - INTERVAL 7 DAY
GROUP BY ap.tenant
ORDER BY approval_rate ASC;
```

### 30-Day Overall

```sql
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN ap.status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) AS approved,
  ROUND(
    SUM(CASE WHEN ap.status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) / COUNT(*),
    4
  ) AS approval_rate
FROM ai_proposals ap
WHERE ap.created_at >= NOW() - INTERVAL 30 DAY;
```

---

## 5. Cache Hit Rate (Idempotency Health)

**Purpose:** Measure how often idempotency prevents duplicate work.  
**Interpretation:** Low cache hit ≠ bad. Rising cache hit over time = customers trusting + retrying safely.

### 7-Day by Tenant

```sql
SELECT
  tenant,
  COUNT(*) AS total,
  SUM(CASE WHEN JSON_EXTRACT(response_json, '$.cached') = true THEN 1 ELSE 0 END) AS cached_hits,
  ROUND(
    SUM(CASE WHEN JSON_EXTRACT(response_json, '$.cached') = true THEN 1 ELSE 0 END) / COUNT(*),
    4
  ) AS cache_hit_rate
FROM idempotency_keys
WHERE scope = 'actionRequests.aiProposeCopy'
  AND created_at >= NOW() - INTERVAL 7 DAY
GROUP BY tenant
ORDER BY cache_hit_rate DESC;
```

### 30-Day Overall

```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN JSON_EXTRACT(response_json, '$.cached') = true THEN 1 ELSE 0 END) AS cached_hits,
  ROUND(
    SUM(CASE WHEN JSON_EXTRACT(response_json, '$.cached') = true THEN 1 ELSE 0 END) / COUNT(*),
    4
  ) AS cache_hit_rate
FROM idempotency_keys
WHERE scope = 'actionRequests.aiProposeCopy'
  AND created_at >= NOW() - INTERVAL 30 DAY;
```

---

## 6. Stale Takeover Rate (Stability Detector)

**Purpose:** Measure how often idempotency ownership is taken over due to stale claims.  
**Interpretation:** High takeover rate indicates timeout/reliability issues.

### 7-Day by Tenant

```sql
SELECT
  tenant,
  COUNT(*) AS total,
  SUM(CASE WHEN attempt_count > 1 THEN 1 ELSE 0 END) AS takeover_count,
  ROUND(SUM(CASE WHEN attempt_count > 1 THEN 1 ELSE 0 END) / COUNT(*), 4) AS takeover_rate
FROM idempotency_keys
WHERE scope = 'actionRequests.aiProposeCopy'
  AND created_at >= NOW() - INTERVAL 7 DAY
GROUP BY tenant
ORDER BY takeover_rate DESC;
```

### 30-Day Overall

```sql
SELECT
  COUNT(*) AS total,
  SUM(CASE WHEN attempt_count > 1 THEN 1 ELSE 0 END) AS takeover_count,
  ROUND(SUM(CASE WHEN attempt_count > 1 THEN 1 ELSE 0 END) / COUNT(*), 4) AS takeover_rate
FROM idempotency_keys
WHERE scope = 'actionRequests.aiProposeCopy'
  AND created_at >= NOW() - INTERVAL 30 DAY;
```

---

## "Done" Criteria for Step 1

This document is complete when:

- [x] Frozen definitions section exists
- [x] Shared base CTE (`ai_proposals`) is defined
- [x] 4 required signals are documented (stopReason, needsHuman, cost/approval, approval rate)
- [x] Cache hit rate query exists
- [x] Stale takeover rate query exists
- [x] 24h/7d/30d variants exist for at least stopReason + cost/approval
- [ ] All queries tested against real data (JSON paths verified)

---

## Next Steps

1. **Run each query once locally** to confirm JSON paths match real stored shapes
2. **If JSON paths don't match**, fix the data shape at write-time (`rawInbound.aiTennis`) rather than changing query semantics ad hoc
3. **Create weekly review script** (Step 3) that runs these queries and outputs markdown report
4. **Establish weekly learning ritual** (Step 4) to review metrics + pull 5 real ActionRequests

---

## Version History

- **v1.0** (January 12, 2026) - Initial canonical queries
  - 6 metrics defined
  - Base CTE established
  - Time window variants (24h/7d/30d)
  - Frozen definitions section
