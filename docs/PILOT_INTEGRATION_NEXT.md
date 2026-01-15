# Pilot Integration Next Steps

**Status:** Types + Normalizer Complete (No Behavior Changes Yet)  
**Checkpoint:** Safe foundation for mode-based normalization  
**Next:** Full integration in 3 clean commits

---

## ✅ What's Already Implemented

### 1. Type Definitions (`scripts/pilot/types.ts`)

**Validation Policy Extension:**
```typescript
interface ValidationPolicy {
  // Existing fields...
  runMode: "tournament" | "production";
  allowNormalization: boolean;
  normalizationMode?: "truncate_first_n";
}
```

**Normalization Tracking:**
```typescript
interface NormalizationTracking {
  enabled: boolean;
  applied: boolean;
  mode: "truncate_first_n";
  events: {
    systems: { truncated: boolean; from: number; to: number };
    brand: { truncated: boolean; from: number; to: number };
    critic: { truncated: boolean; from: number; to: number };
  };
}
```

**Per-Role Usage Tracking:**
```typescript
interface UsageTracking {
  systems: { inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number };
  brand: { inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number };
  critic: { inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number };
  totals: { inputTokens: number; outputTokens: number; latencyMs: number; costUsd: number };
}
```

**Updated PilotRun Type:**
- Added `runMode: RunMode`
- Added `meta.normalization: NormalizationTracking`
- Added `meta.usage: UsageTracking`

### 2. Normalizer Function (`scripts/pilot/normalizer.ts`)

**normalizeCraftFastPayload():**
- Truncates proposedChanges to EXACTLY 8 if >8
- Leaves as-is if <=8 (never pads)
- Never reorders, rewrites content, or adds keys
- Returns payload + normalization event

**logNormalizationEvent():**
- Logs truncation: `[NORMALIZE_FAST] systems proposedChanges 10 → 8`

---

## 🔧 Remaining Wiring Steps

### Commit A: runPilotMacro Policy + Normalization Wiring

**Files to modify:**
- `scripts/pilot/runPilotMacro.ts`

**Changes:**
1. Import types and normalizer:
   ```typescript
   import type { ValidationPolicy, PilotRun, NormalizationTracking, UsageTracking } from './types';
   import { createValidationPolicy, createNormalizationTracking, createUsageTracking } from './types';
   import { normalizeCraftFastPayload, logNormalizationEvent } from './normalizer';
   ```

2. Add `runMode` parameter to `runPilotMacro()`:
   ```typescript
   export async function runPilotMacro(
     lane: Lane,
     rep: number,
     stack: PilotStack,
     context: any,
     runMode: RunMode = "tournament" // NEW
   ): Promise<PilotRun>
   ```

3. Create validation policy:
   ```typescript
   const policy = createValidationPolicy(runMode);
   const normalizationTracking = createNormalizationTracking(policy.allowNormalization);
   const usageTracking = createUsageTracking();
   ```

4. Pass policy to specialist calls:
   ```typescript
   context: {
     ...context,
     validation: policy,
   }
   ```

5. Apply normalization AFTER parse, BEFORE schema validation (systems + brand only):
   ```typescript
   let systemsPayload = cleanParseArtifactPayload(systemsOut.artifact);
   
   if (policy.allowNormalization) {
     const result = normalizeCraftFastPayload(systemsPayload);
     systemsPayload = result.payload;
     normalizationTracking.events.systems = result.event;
     if (result.event.truncated) {
       normalizationTracking.applied = true;
       logNormalizationEvent('systems', result.event);
     }
   }
   
   validateDesignSwarmPayloadOrThrow('designer_systems_fast', systemsPayload);
   ```

6. Add normalization tracking to return value:
   ```typescript
   return {
     // ...existing fields
     runMode,
     meta: {
       // ...existing fields
       normalization: normalizationTracking,
     },
   };
   ```

### Commit B: Per-Role Usage Tracking

**Files to modify:**
- `scripts/pilot/runPilotMacro.ts`

**Changes:**
1. Capture specialist output meta for each role:
   ```typescript
   const systemsOut = await callSpecialistWithRetry(...);
   usageTracking.systems = {
     inputTokens: systemsOut.meta.inputTokens,
     outputTokens: systemsOut.meta.outputTokens,
     latencyMs: systemsOut.meta.latencyMs,
     costUsd: systemsOut.meta.costUsd,
   };
   ```

2. Calculate totals:
   ```typescript
   usageTracking.totals = {
     inputTokens: usageTracking.systems.inputTokens + usageTracking.brand.inputTokens + usageTracking.critic.inputTokens,
     outputTokens: usageTracking.systems.outputTokens + usageTracking.brand.outputTokens + usageTracking.critic.outputTokens,
     latencyMs: usageTracking.systems.latencyMs + usageTracking.brand.latencyMs + usageTracking.critic.latencyMs,
     costUsd: usageTracking.systems.costUsd + usageTracking.brand.costUsd + usageTracking.critic.costUsd,
   };
   ```

3. Add usage tracking to return value:
   ```typescript
   return {
     // ...existing fields
     meta: {
       // ...existing fields
       usage: usageTracking,
     },
   };
   ```

### Commit C: Obedience Probes + Dashboard Aggregator

**New files to create:**

1. **`scripts/runObedienceProbe.ts`**
   - Test single model + role + lane with 3 reps
   - Measure: % runs with exactly 8 without normalization, retries required per success
   - Usage: `pnpm tsx scripts/runObedienceProbe.ts --model=gpt-4.1 --role=systems --lane=web --reps=3`

2. **`scripts/aggregateDashboard.ts`**
   - Scan `/runs/**/*.json` for pilot run artifacts
   - Generate `dashboard.json` with:
     - `runs[]` slim rows
     - `rollups.byModelRoleLane[]` weather table
     - `rollups.byLane[]` lane health
     - `rollups.byModel[]` model health
   - Usage: `pnpm tsx scripts/aggregateDashboard.ts --window=last-7-days`

3. **`scripts/renderDashboardCLI.ts`**
   - Read `dashboard.json`
   - Print ASCII table with pass rates, retries, truncation, token drift
   - Usage: `pnpm tsx scripts/renderDashboardCLI.ts`

---

## 🚫 Do Not Change (Invariants)

These contracts MUST remain unchanged during integration:

### Schema Contracts
- ✅ **Fast schemas = EXACTLY 8** (`CraftOutputSchemaFast`)
- ✅ **Ruthless critic = EXACTLY 10** (`CriticOutputSchemaRuthless`)
- ✅ **Schema validation uses routing keys** (`designer_systems_fast`, not `designer_systems`)

### Integrity Contracts
- ✅ **MODEL_LOCK must hard-fail** (no silent fallback)
- ✅ **Truncation must be rejected** (finishReason === "length" → INVALID)
- ✅ **Schema hash mismatch must stop** (drift detection)

### Retry Contracts
- ✅ **invalid_json is retryable** (always)
- ✅ **schema_failed is retryable for craft only** (not critic)
- ✅ **timeout/provider_failed are retryable** (always)

### Validation Order
- ✅ **Parse → Normalize (if production) → Schema → Content** (strict order)
- ✅ **Content validation AFTER schema** (not before)

### Normalization Rules
- ✅ **Tournament mode: allowNormalization = false** (measure obedience)
- ✅ **Production mode: allowNormalization = true** (ship deterministically)
- ✅ **Never pad, never reorder, never rewrite** (only truncate if >8)

---

## 📊 Dashboard Schema (dashboard.json)

### Top-Level Structure
```json
{
  "generatedAt": "2026-01-15T19:05:00.000Z",
  "window": { "start": "...", "end": "..." },
  "runs": [ /* slim run rows */ ],
  "rollups": {
    "byModelRoleLane": [ /* weather table */ ],
    "byLane": [ /* lane health */ ],
    "byModel": [ /* model health */ ]
  },
  "alerts": [],
  "baselines": {}
}
```

### Slim Run Row
```json
{
  "runId": "...",
  "timestamp": "...",
  "lane": "web",
  "rep": 1,
  "status": "VALID",
  "runMode": "tournament",
  "models": { "systems": "...", "brand": "...", "critic": "..." },
  "stopReasons": { "systems": "ok", "brand": "ok", "critic": "ok" },
  "attempts": 1,
  "scores": { "finalScore": 97.8, "truthPenalty": 0.02, "qualityPenalty": 0.01 },
  "usageTotals": { "inputTokens": 1234, "outputTokens": 987, "costUsd": 0.12 },
  "normalization": { "enabled": false, "applied": false }
}
```

### Weather Table Row (byModelRoleLane)
```json
{
  "model": "gpt-4o-2024-08-06",
  "role": "systems",
  "lane": "web",
  "n": 24,
  "validRate": 0.875,
  "truncationRate": 0.0,
  "driftRate": 0.0,
  "avgAttempts": 1.42,
  "stopReasonCounts": { "ok": 21, "schema_failed": 3 },
  "tokens": { "inputP50": 1200, "inputP90": 1700, "outputP50": 900, "outputP90": 1400 },
  "costUsd": { "avg": 0.08, "p90": 0.13 },
  "scores": { "finalScoreAvg": 97.6, "truthPenaltyAvg": 0.022, "qualityPenaltyAvg": 0.010 },
  "normalizationAppliedRate": 0.0
}
```

---

## 🎯 Recommended Order

1. **Checkpoint NOW** ✅ (types + normalizer + this doc)
2. **Commit A** - runPilotMacro policy + normalization wiring
3. **Commit B** - per-role usage tracking
4. **Commit C** - obedience probes + dashboard aggregator

Each commit is small, reviewable, and testable independently.

---

## 🧪 Testing Strategy

### After Commit A (Normalization Wiring)
- Run smoke test in tournament mode (allowNormalization: false)
- Verify GPT-4o fails with >8 changes (expected)
- Run smoke test in production mode (allowNormalization: true)
- Verify truncation to 8 works, schema validation passes

### After Commit B (Usage Tracking)
- Verify meta.usage.totals matches sum of systems + brand + critic
- Verify meta.usage.systems.costUsd > 0

### After Commit C (Dashboard)
- Run aggregator on existing runs
- Verify dashboard.json has correct rollups
- Verify CLI renderer shows pass rates + retries

---

## 📝 Commit Messages (Conventional Commits)

**Checkpoint:**
```
feat(pilot): add types + normalizer for mode-based normalization

- Add ValidationPolicy extension (runMode, allowNormalization)
- Add NormalizationTracking + UsageTracking types
- Add normalizeCraftFastPayload() function (truncate to 8 if >8)
- Add PILOT_INTEGRATION_NEXT.md with wiring steps
- No behavior changes (safe to merge)
```

**Commit A:**
```
feat(pilot): wire normalization policy in runPilotMacro

- Add runMode parameter (tournament vs production)
- Apply normalization AFTER parse, BEFORE schema validation
- Track normalization events in meta.normalization
- Log truncation: [NORMALIZE_FAST] systems proposedChanges 10 → 8
```

**Commit B:**
```
feat(pilot): add per-role usage tracking

- Capture inputTokens/outputTokens/latencyMs/costUsd per role
- Calculate totals across systems + brand + critic
- Add meta.usage to PilotRun artifact
```

**Commit C:**
```
feat(pilot): add obedience probes + dashboard aggregator

- Add runObedienceProbe.ts (test single model/role/lane)
- Add aggregateDashboard.ts (scan runs, generate dashboard.json)
- Add renderDashboardCLI.ts (ASCII table with pass rates)
```
