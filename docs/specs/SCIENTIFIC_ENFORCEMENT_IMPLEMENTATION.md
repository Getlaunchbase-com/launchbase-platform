# Scientific Enforcement System Implementation

**Version:** 1.0  
**Last Updated:** January 15, 2026  
**Status:** ✅ Production-Ready

## Overview

The Scientific Enforcement System implements 7 steps to make AI model tournaments audit-proof with deterministic invalidation rules. This transforms the tournament infrastructure from "it kinda worked" ambiguity into "real science" with clean, decision-grade data.

---

## Core Principle: Deterministic Invalidation Rules

```
drift = INVALID
truncation = INVALID
missing artifacts = INVALID
schema mismatch = INVALID
```

**This is what makes it "real science" instead of vibes.**

---

## Step 0: Integrity Kill Switch ✅

**File:** `runs/baseline_truth_v1.2.json`

Added 4 enforcement flags to `integrity` section:

```json
{
  "integrity": {
    "requireSchemaHashMatch": true,
    "rejectSilentModelFallback": true,
    "rejectTruncation": true,
    "rejectMissingArtifacts": true,
    "notes": "Integrity kill switch: tournament runners MUST enforce all 4 flags..."
  }
}
```

**Purpose:** Golden enforcement flag that runners must obey. Makes contamination impossible without an INVALID flag.

---

## Step 1: Runtime Schema Hash Enforcement ✅

**File:** `server/ai/engine/validation/integrityEnforcement.ts`

### Implementation

```typescript
export function enforceSchemaHashMatch(baselinePath: string): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.requireSchemaHashMatch) {
    return { valid: true, violations: [], message: '✅ Schema hash enforcement disabled' };
  }

  const validation = preflightSchemaHashCheck(baselinePath, true);
  
  if (!validation.valid) {
    return {
      valid: false,
      violations: [{ type: 'SCHEMA_HASH_MISMATCH', ... }],
      message: `❌ [INTEGRITY] Schema hash mismatch — refusing to run.`,
    };
  }

  return { valid: true, violations: [], message: '✅ Schema hash match verified' };
}
```

### Enforcement Points

- `scripts/runControlSoakTest.ts` - Line 217
- `scripts/runLaneByLanePilot.ts` - Line 185

### Decision Rule

```typescript
if (baseline.integrity.requireSchemaHashMatch && !hashesMatch) {
  throw new Error("[INTEGRITY] Schema hash mismatch — refusing to run.");
}
```

**Result:** No accidental baseline drift ever gets scored.

---

## Step 2: MODEL_LOCK Binding Enforcement ✅

**File:** `server/ai/engine/validation/integrityEnforcement.ts`

### Implementation

```typescript
export function enforceModelLock(
  requestedModelId: string,
  resolvedModelId: string,
  baselinePath: string
): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.rejectSilentModelFallback) {
    return { valid: true, violations: [], message: '✅ Model fallback enforcement disabled' };
  }

  if (requestedModelId !== resolvedModelId) {
    return {
      valid: false,
      violations: [{ type: 'MODEL_FALLBACK', ... }],
      message: `❌ [INTEGRITY] MODEL_LOCK violation: requested ${requestedModelId}, got ${resolvedModelId}`,
    };
  }

  return { valid: true, violations: [], message: '✅ MODEL_LOCK verified' };
}
```

### Per-Call Check

```typescript
const integrityCheck = enforceIntegrityPerCall(
  requestedModelId,
  resolvedModelId,
  finishReason,
  jsonOutput,
  BASELINE_PATH
);

if (!integrityCheck.valid) {
  return { status: "INVALID_MODEL_DRIFT", ... };
}
```

**Result:** Prevents the single biggest tournament poison: fallback contamination.

---

## Step 3: Global Truncation Rejection ✅

**File:** `server/ai/engine/validation/integrityEnforcement.ts`

### Implementation

```typescript
export function rejectTruncation(
  finishReason: string,
  jsonOutput: any,
  baselinePath: string
): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.rejectTruncation) {
    return { valid: true, violations: [], message: '✅ Truncation rejection disabled' };
  }

  // Check finish reason
  if (finishReason === 'length') {
    return {
      valid: false,
      violations: [{ type: 'TRUNCATION', ... }],
      message: `❌ [INTEGRITY] Truncation detected: finishReason='length'`,
    };
  }

  // Check for JSON truncation (missing closing braces/brackets)
  const jsonStr = JSON.stringify(jsonOutput);
  const openBraces = (jsonStr.match(/{/g) || []).length;
  const closeBraces = (jsonStr.match(/}/g) || []).length;
  const openBrackets = (jsonStr.match(/\[/g) || []).length;
  const closeBrackets = (jsonStr.match(/]/g) || []).length;

  if (openBraces !== closeBraces || openBrackets !== closeBrackets) {
    return {
      valid: false,
      violations: [{ type: 'TRUNCATION', ... }],
      message: `❌ [INTEGRITY] JSON truncation detected`,
    };
  }

  return { valid: true, violations: [], message: '✅ No truncation detected' };
}
```

### Decision Rule

```typescript
if (baseline.integrity.rejectTruncation && finishReason === "length") {
  return { status: "INVALID_TRUNCATION" };
}
```

**Result:** No more "it kinda parsed" runs slipping in.

---

## Step 4: Full Artifact Set Validation ✅

**File:** `server/ai/engine/validation/integrityEnforcement.ts`

### Implementation

```typescript
export function validateArtifacts(
  runDir: string,
  expectedArtifacts: string[],
  baselinePath: string
): IntegrityCheckResult {
  const config = loadIntegrityConfig(baselinePath);
  
  if (!config?.rejectMissingArtifacts) {
    return { valid: true, violations: [], message: '✅ Artifact validation disabled' };
  }

  const missingArtifacts: string[] = [];

  for (const artifact of expectedArtifacts) {
    const artifactPath = path.join(runDir, artifact);
    if (!fs.existsSync(artifactPath)) {
      missingArtifacts.push(artifact);
    }
  }

  if (missingArtifacts.length > 0) {
    return {
      valid: false,
      violations: [{ type: 'MISSING_ARTIFACTS', ... }],
      message: `❌ [INTEGRITY] Missing artifacts: ${missingArtifacts.join(', ')}`,
    };
  }

  return { valid: true, violations: [], message: '✅ All artifacts present' };
}
```

### Expected Artifacts

From `baseline_truth_v1.2.json`:

```json
{
  "artifacts": {
    "expectedPerRunArtifacts": [
      "systems.json",
      "brand.json",
      "critic.json",
      "run_meta.json"
    ]
  }
}
```

**Result:** Prevents "partial runs" from creating fake averages.

---

## Step 5: 24-Run Control Soak Test ✅

**File:** `scripts/runControlSoakTest.ts`

### Configuration

```typescript
const LANES = ['web', 'app', 'marketing', 'artwork'];
const REPS_PER_LANE = 6;
// Total: 4 lanes × 6 reps = 24 runs
```

### Strict Baseline Mode

```typescript
// Integrity enforcement at startup
const integrityCheck = enforceIntegrityAtStartup(BASELINE_PATH);
if (!integrityCheck.valid) {
  console.error('\n❌ INTEGRITY FAILED:', integrityCheck.message);
  process.exit(1);
}
```

### INVALID Handling

```typescript
function calculateLaneStats(results: RunResult[]): LaneStats {
  // Filter to VALID runs only
  const validResults = results.filter(r => r.status === 'VALID');
  const invalidResults = results.filter(r => r.status === 'INVALID');
  
  if (invalidResults.length > 0) {
    console.warn(`\n⚠️  WARNING: ${invalidResults.length} INVALID run(s) detected in lane, excluding from stats:`);
    invalidResults.forEach(r => {
      console.warn(`  - ${r.runId}: ${r.invalidReason}`);
    });
  }
  
  // Calculate stats from VALID runs only
  const truthPenalties = validResults.map(r => r.truthPenalty);
  // ...
}
```

### Outputs

- `SOAK_RESULTS.json` - Raw run data with VALID/INVALID status
- `SOAK_SCORECARD.md` - Human-readable summary
- `baseline_truth_v1.3.json` - Same schema as v1.2, updated stats with percentile bands (P10/P50/P90)

### Pass Criteria

- 24/24 valid runs
- 0 truncations
- 0 model drift
- 0 missing artifacts

**If anything is INVALID → treat as "weather event", log separately, do NOT average in.**

### Run Command

```bash
pnpm tsx scripts/runControlSoakTest.ts
```

---

## Step 6: Model Weather Dashboard (MVP) ✅

**File:** `scripts/generateWeatherDashboard.ts`

### Per Lane × Per Role Metrics

1. **passRate** - % of runs that passed integrity checks
2. **invalidRate** - % of runs marked INVALID (drift + truncation + missing artifacts)
3. **truthPenalty** - mean/median + trigger histogram (unverifiable/invented/vague/strain)
4. **finalScore** - mean/stddev + P10/P50/P90 percentile bands
5. **token + jsonSize drift bands** - mean/stddev for systems/brand/critic roles
6. **costPerValidRun** - average cost per VALID run only

### Insights

- **"Good but verbose" models** - High token counts but good scores (token drift)
- **"Confidently vague" models** - High truthPenalty (>0.10) producing unverifiable outputs
- **"API weather" providers** - invalidRate >5% indicating availability/reliability issues

### Run Command

```bash
pnpm tsx scripts/generateWeatherDashboard.ts \
  runs/2026-01-15/SOAK_RESULTS.json \
  runs/baseline_truth_v1.3.json
```

### Output

- `MODEL_WEATHER_DASHBOARD.md` - Markdown dashboard with all metrics

---

## Step 7: Challenger On-Ramp (Pilot Funnel) ✅

**File:** `scripts/runLaneByLanePilot.ts`

### Phase A: Registry + Token Fit Check

Preflight validation:

```typescript
const stackValidation = validateChallengerStack(pilotConfig.challengerStack, BASELINE_PATH);
if (!stackValidation.passed) {
  console.error('\n❌ PREFLIGHT FAILED: Challenger stack is blocked');
  process.exit(1);
}
```

Checks:

- ✅ Registry exists
- ✅ Recommended maxTokens known
- ✅ Truncation risk flagged

### Phase B: Pilot Gate

**2-lane pilot (Web + Marketing, 2 reps each = 4 runs):**

```typescript
const pilotConfig: PilotConfig = {
  challengerName: 'Claude 3.5 Sonnet',
  challengerStack: {
    name: 'claude-3.5-sonnet',
    models: {
      systems: 'anthropic/claude-3.5-sonnet',
      brand: 'anthropic/claude-3.5-sonnet',
      critic: 'anthropic/claude-3.5-sonnet',
    },
  },
  pilotLanes: ['web', 'marketing'],
  repsPerLane: 2,
};
```

**Pass rules:**

- 4/4 valid
- 0 truncation
- 0 drift
- Beat Control by ≥+3 OR match score with lower truthPenalty

**Only then:**

- Expand to Pilot B (all 4 lanes, 2 reps each = 8 runs)
- Then tournament scale (all 4 lanes, 6 reps each = 24 runs)

### Registry Snapshot Artifact

Per pilot run:

```typescript
interface PilotRunResult {
  // ...
  registrySnapshot: {
    resolvedModelId: string;
    provider: string;
    maxTokensUsed: number;
    temperature: number;
    policyHash: string;
  };
}
```

**Makes later audits dead simple:** "Why did this model win last Tuesday?"

### Run Command

```bash
pnpm tsx scripts/runLaneByLanePilot.ts
```

---

## Challenger Classification

### Grok (xAI)
- **Type:** LLM challenger
- **Eligible Lanes:** web, app, marketing (primarily)
- **Scoring:** TruthPenalty v1.0

### Groq (Hardware Inference)
- **Type:** "Model delivery" + specific model (e.g., Llama variants)
- **Eligible Lanes:** web, app, marketing
- **Integrity:** Drift/fallback prevention critical (hardware-specific routing)
- **Scoring:** TruthPenalty v1.0

### Asset/Image Models (Flux, SD3)
- **Type:** Image generators
- **Eligible Lanes:** artwork ONLY
- **Scoring:** Asset Quality Score (composition/clarity/brand alignment)
- **Note:** No "liar" flags for not producing layout/copy constraints

---

## Files Created

### Core Infrastructure
- `server/ai/engine/validation/integrityEnforcement.ts` - All 4 enforcement checks
- `runs/baseline_truth_v1.2.json` - Updated with integrity kill switch

### Tournament Runners
- `scripts/runControlSoakTest.ts` - Enhanced with strict mode + INVALID handling
- `scripts/runLaneByLanePilot.ts` - Enhanced with registry snapshot artifacts
- `scripts/generateWeatherDashboard.ts` - MVP weather dashboard generator

### Documentation
- `docs/SCIENTIFIC_ENFORCEMENT_IMPLEMENTATION.md` - This document

---

## Execution Order

### Week 1: Control Soak Test

```bash
# 1. Verify strict baseline mode
cat runs/baseline_truth_v1.2.json | jq '.integrity'

# 2. Run Control soak test
pnpm tsx scripts/runControlSoakTest.ts

# 3. Review outputs
cat runs/2026-01-15/SOAK_SCORECARD.md
cat runs/2026-01-15/SOAK_RESULTS.json | jq '.laneStats'

# 4. Generate baseline_truth_v1.3.json (same schema, updated stats)
```

### Week 2: Weather Dashboard

```bash
# 1. Generate weather dashboard
pnpm tsx scripts/generateWeatherDashboard.ts \
  runs/2026-01-15/SOAK_RESULTS.json \
  runs/baseline_truth_v1.3.json

# 2. Review dashboard
cat runs/2026-01-15/MODEL_WEATHER_DASHBOARD.md
```

### Week 3: Challenger Pilots

```bash
# 1. Run 2-lane pilot (Web + Marketing)
pnpm tsx scripts/runLaneByLanePilot.ts

# 2. Review pilot results
cat runs/2026-01-15/PILOT_Claude_3.5_Sonnet.json | jq '.recommendation'

# 3. If passed, expand to 4 lanes
# 4. If passed, run full tournament (24 runs)
```

---

## Next Steps

1. **Run Control Soak Test** to collect 24 runs with strict enforcement
2. **Generate Weather Dashboard** to spot token drift, truthPenalty triggers, and API weather
3. **Launch Challenger Pilots** for Claude 3.5, Grok, Groq, Stitch, SD3, Flux

---

## Success Criteria

✅ **Baseline is enforceable** - All 4 integrity flags active  
✅ **Contamination is impossible** - Without an INVALID flag  
✅ **INVALID runs are logged** - As "weather events", not averaged in  
✅ **Registry snapshots captured** - For audit trail  
✅ **Deterministic invalidation rules** - drift/truncation/missing artifacts/schema mismatch = INVALID

**This is what makes it "real science" instead of vibes.**

---

**Generated by:** Scientific Enforcement System V1.0  
**Contact:** tournament_infrastructure_v1@launchbase.com  
**Last Updated:** 2026-01-15T16:00:00Z
