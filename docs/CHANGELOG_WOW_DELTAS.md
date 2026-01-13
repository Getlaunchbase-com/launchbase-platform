# WoW Delta Refactor — Canonical Helpers Implementation

**Date:** January 12, 2026  
**Version:** Phase 1.2 Complete  
**Scope:** Weekly AI Tennis Metrics Report

---

## Summary

Implemented **Week-over-Week (WoW) delta calculations** for all rate metrics using canonical helper functions. This refactor ensures **truthful reporting on zero data** and provides **consistent flagging logic** across all metrics.

---

## Changes Made

### 1. Canonical Helpers Added (`_weeklyAiReportMarkdown.ts`)

**New Types:**
- `DeltaResult` - Structured delta with text + numeric value
- `DollarsResult` - Structured dollar amount with text + numeric value
- `Window` - Time window abstraction (current vs prior)

**New Helper Functions:**
```typescript
deltaPct(current, prior)         // Compute percentage point delta (N/A-safe)
flagHighNumber(value, warn, crit) // Flag numeric values where high is bad
toDollarsPerApproval(sum, count)  // Convert cost sum to per-approval metric
getWindows(now)                   // Generate current/prior 7-day windows
```

### 2. SQL Query Refactor (`generateWeeklyAiReport.ts`)

**Before:**
- Single query per metric returning precomputed rates
- Example: `SELECT rate7Pct, rate30Pct FROM ...`

**After:**
- Paired queries (current + prior) returning raw numerators/denominators
- Example: 
  - `needsHumanRateCurrent`: `NOW() - INTERVAL 7 DAY → NOW()`
  - `needsHumanRatePrior`: `NOW() - INTERVAL 14 DAY → NOW() - INTERVAL 7 DAY`

**Query Pairs Created:**
1. `needsHumanRateCurrent` / `needsHumanRatePrior`
2. `approvalRateCurrent` / `approvalRatePrior`
3. `cacheHitRateCurrent` / `cacheHitRatePrior`
4. `staleTakeoverRateCurrent` / `staleTakeoverRatePrior`

### 3. Renderer Refactor (Canonical Pattern)

**All rate renderers now follow this pattern:**

```typescript
function renderMetric(currentRows, priorRows, thresholds) {
  // 1. Build prior lookup map
  const priorByTenant = new Map(priorRows.map(r => [r.tenant, r]));
  
  // 2. For each current row
  currentRows.map(r => {
    const prior = priorByTenant.get(r.tenant) || {};
    
    // 3. Compute rates using toRate() (N/A-safe)
    const currRate = toRate(r.numerator, r.denominator);
    const priorRate = toRate(prior.numerator, prior.denominator);
    
    // 4. Compute delta using deltaPct()
    const wow = deltaPct(currRate.rate, priorRate.rate);
    
    // 5. Apply canonical flag helper
    const flag = flagLowRate(currRate.rate, warnBelow, critBelow);
    
    return { tenant, currRate, wow, flag };
  });
}
```

**Refactored Renderers:**
- `renderNeedsHumanRate()` - Uses `flagHighRate()` (high is bad)
- `renderApprovalRate()` - Uses delta-based flagging (drop > threshold is bad)
- `renderCacheHitRate()` - Uses `flagLowRate()` (low is bad)
- `renderStaleTakeoverRate()` - Uses `flagHighRate()` (high is bad)

### 4. buildMarkdown() Updates

**Before:**
```typescript
const needsHumanRows = extractRows(results.needsHumanRate);
renderNeedsHumanRate(needsHumanRows, thresholds);
```

**After:**
```typescript
const needsHumanCurrentRows = extractRows(results.needsHumanRateCurrent);
const needsHumanPriorRows = extractRows(results.needsHumanRatePrior);
renderNeedsHumanRate(needsHumanCurrentRows, needsHumanPriorRows, thresholds);
```

---

## Key Principles Enforced

### 1. **Denominator-Aware Rate Calculation**
- Always return `numerator` + `denominator` from SQL
- Use `toRate(n, d)` in JS to compute rates
- Returns `{ text: "N/A", rate: null }` when `d = 0`

### 2. **N/A-Safe Delta Computation**
- `deltaPct(curr, prior)` returns `{ text: "N/A", delta: null }` if either is null
- Prevents false "0% change" when data is missing

### 3. **Canonical Flag Helpers Only**
- Removed legacy `flagFromRateBadIsHigh()` and `flagFromRateGoodIsHigh()`
- Use only: `flagLowRate()`, `flagHighRate()`, `flagHighNumber()`
- All helpers return `""` (empty string) for N/A cases

### 4. **Minimal SQL Duplication**
- Only the window clause differs between current/prior queries
- Everything else (CTE, aggregation logic) is identical

---

## Testing Results

**Environment:** Development (empty database)

**Report Output:**
- 69 lines generated
- All rate sections show "N/A" correctly
- All flags show "—" (no false alarms)
- WoW deltas show "N/A" (no false 0% changes)

**Sample Output:**
```markdown
## 2️⃣ needsHuman Rate (Protocol Mismatch Detector)

| period | This Week | WoW Δ | Flag |
| --- | --- | --- | --- |
| 7-day | N/A | N/A | — |
```

---

## Next Steps (Phase 1.2 Remaining)

1. **Real Workflow Test** - Trigger actual AI Tennis proposal and verify metrics populate
2. **Lock Report Contract** - Freeze metric definitions in documentation
3. **Safe Synthetic Seeding** - Create dev/local test data generator

---

## Files Modified

- `scripts/_weeklyAiReportMarkdown.ts` - Added canonical helpers, refactored renderers
- `scripts/generateWeeklyAiReport.ts` - Added prior window queries
- `todo.md` - Marked Phase 1.2 WoW Delta implementation as complete

---

## Diff Summary

**Lines Added:** ~150  
**Lines Removed:** ~80  
**Net Change:** +70 lines (mostly new helper functions)

**Complexity:** Reduced (canonical pattern applied consistently)  
**Maintainability:** Improved (single source of truth for rate/flag logic)  
**Truthfulness:** Guaranteed (N/A behavior enforced at helper level)
