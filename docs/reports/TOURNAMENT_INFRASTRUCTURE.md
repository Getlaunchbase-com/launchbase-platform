# Tournament Infrastructure V1.2

**Version:** 1.2.0  
**Last Updated:** January 15, 2026  
**Status:** Production-Ready

## Overview

The Tournament Infrastructure is an audit-proof, contamination-resistant system for evaluating AI models across 4 design lanes (web, app, marketing, artwork) using a 3-specialist workflow (systems designer → brand designer → critic). The goal is to establish baseline "truth" metrics for a Control stack and then run challenger tournaments to identify the best models per lane while detecting "liar models" that produce unverifiable or vague outputs.

## Architecture

### Core Components

1. **Baseline Truth v1.2** (`baseline_truth_v1.2.json`)
   - Immutable ground-truth baseline for Control stack (gpt-4o + claude-opus-4-1)
   - Schema metadata with SHA-256 hashes for drift detection
   - Lane-specific integrity counters (truncations, model drift, invalid runs)
   - Truth vs quality penalty split
   - Role-level stats (jsonSize, tokens, stopReason distribution)
   - Challenger catalog with preflight records

2. **Schema Hash Validator** (`schemaHashValidator.ts`)
   - Computes SHA-256 hashes of implementation files
   - Validates current hashes against baseline
   - Marks entire run batch as INVALID if mismatch detected
   - Prevents contamination from silent schema changes

3. **Preflight Check System** (`preflightCheck.ts`)
   - Validates tournament readiness using registrySnapshot + preflightRecords
   - Blocks stacks with missing models
   - Auto-applies maxTokens recommendations for truncation-risk models
   - Prevents wasted runs

4. **Control Soak Test** (`runControlSoakTest.ts`)
   - 24-run test (4 lanes × 6 reps) with strict mode
   - Tightens variance bands for reliable challenger comparison
   - Generates SOAK_RESULTS.json + SOAK_SCORECARD.md
   - Updates baseline with explicit controlBands

5. **Lane-by-Lane Pilot** (`runLaneByLanePilot.ts`)
   - 2-lane validation (Web + Marketing × 2 reps = 4 runs)
   - Enforces pilot acceptance criteria (≥95% pass, 0 truncations, 0 drift, beat Control by ≥3)
   - Only expands to all 4 lanes after 2-lane pilot passes

6. **Asset Model Lane Rules** (`ASSET_MODEL_LANE_RULES.md`)
   - Separate scoring rubrics for image generators (SD3, Flux) and UI builders (Stitch)
   - Prevents false "liar" labels for visual artifacts
   - Hybrid scoring for mixed artifact types (code + visual)

## Baseline Truth V1.2 Schema

### Key Sections

```json
{
  "schemaId": "launchbase.baseline_truth",
  "schemaVersion": "1.2.0",
  "generatedAt": "2026-01-15T00:00:00Z",
  "updatedAt": "2026-01-15T16:00:00Z",
  
  "provenance": {
    "baselineGeneratedAt": "2026-01-15T00:00:00Z",
    "baselineRunsCompleted": "2026-01-14T23:45:00Z",
    "author": "tournament_infrastructure_v1"
  },
  
  "compat": {
    "minRunnerVersion": ">=0.9.0",
    "minReaderVersion": "1.1.0"
  },
  
  "build": {
    "gitCommit": "45c8f41b...",
    "branch": "main",
    "dirty": false
  },
  
  "inputs": {
    "schemaHashes": {
      "craftOutputSchemaFast": "e410cd4b...",
      "craftOutputSchema": "e410cd4b...",
      "criticOutputSchema": "e410cd4b...",
      "contentValidator": "823132a2...",
      "truthPenalty": "5b41900e..."
    }
  },
  
  "integrity": {
    "requireSchemaHashMatch": true,
    "notes": "If true, tournament runners MUST validate current schema hashes..."
  },
  
  "evalConfig": {
    "baselineMode": {
      "enableLadder": false,
      "allowModelFallback": false,
      "concurrency": { "openai": 3, "anthropic": 3, "google": 1 }
    },
    "roleConfigsAssumed": {
      "designer_systems_fast": { "maxTokens": 2000, "timeoutMs": 90000 },
      "designer_brand_fast": { "maxTokens": 2000, "timeoutMs": 90000 },
      "design_critic_ruthless": { "maxTokens": 4000, "timeoutMs": 120000 }
    },
    "contentValidatorPolicy": {
      "hardFailBelowAnchorsByLane": { "web": 3, "app": 3, "marketing": 0, "artwork": 0 },
      "qualityPenaltyBand": { "anchors_0_2": 0.3, "anchors_3_4": 0.2, "anchors_5_plus": 0.1 }
    }
  },
  
  "challengerCatalog": {
    "registrySnapshot": {
      "verifiedAvailable": ["openai/gpt-4o-2024-08-06", "anthropic/claude-opus-4-1-20250805"],
      "knownUnavailable": ["openai/gpt-5-2025-08-07", "openai/o3-pro"],
      "knownTruncationRisk": ["google/gemini-2.5-pro"]
    },
    "preflightRecords": {
      "missingModels": ["openai/gpt-5-2025-08-07", "openai/o3-pro"],
      "blockedStacks": ["gpt-5.2-pro", "gpt-5.2", "o3-pro"],
      "truncationFailures": [
        {
          "modelId": "google/gemini-2.5-pro",
          "failureRate": 100.0,
          "maxTokensTested": 3000,
          "recommendation": "Increase maxTokens to 4500-6000 or add char caps to prompts"
        }
      ]
    },
    "challengers": [
      {
        "id": "anthropic/claude-3.5-sonnet",
        "provider": "anthropic",
        "status": "pending_pilot",
        "laneEligibility": ["web", "app", "marketing", "artwork"]
      }
    ]
  }
}
```

## Workflow

### 1. Preflight Checks

Before any tournament run:

```typescript
// Schema hash validation
const schemaValidation = preflightSchemaHashCheck(BASELINE_PATH, true);
if (!schemaValidation.valid) {
  throw new Error('SCHEMA DRIFT DETECTED');
}

// Challenger stack validation
const stackValidation = validateChallengerStack(challengerStack, BASELINE_PATH);
if (!stackValidation.passed) {
  throw new Error('CHALLENGER STACK BLOCKED');
}
```

### 2. Control Soak Test (24 runs)

Establishes tightened variance bands:

```bash
pnpm tsx scripts/runControlSoakTest.ts
```

**Outputs:**
- `runs/<date>/SOAK_RESULTS.json` - Raw run data
- `runs/<date>/SOAK_SCORECARD.md` - Human-readable summary

**Updates baseline with:**
- Per-lane finalScore mean/stdDev
- Per-lane truthPenalty mean/median/stdDev
- Per-lane truncation + retry distributions
- Explicit controlBands (lower/upper bounds)

### 3. Lane-by-Lane Pilot

Validates challengers before full tournament:

```bash
pnpm tsx scripts/runLaneByLanePilot.ts
```

**2-lane pilot (Web + Marketing × 2 reps = 4 runs):**
- ≥95% pass rate (4/4)
- 0 truncations
- 0 model drift
- Beat Control by ≥3 points OR match score with lower truthPenalty

**If pilot passes:**
- Expand to all 4 lanes (web, app, marketing, artwork)
- Run full tournament (6 reps per lane = 24 runs)

**If pilot fails:**
- Review failure causes
- Tune model configuration (maxTokens, temperature)
- Re-run pilot after fixes

### 4. Full Tournament

After pilot passes:

```bash
pnpm tsx scripts/runFullTournament.ts --challenger claude-3.5-sonnet
```

**Outputs:**
- `runs/<date>/TOURNAMENT_RESULTS.json` - Raw run data
- `runs/<date>/TOURNAMENT_SCORECARD.md` - Human-readable summary
- `runs/<date>/CATEGORY_CHAMPIONS_BY_LANE.json` - Lane-specific champions
- `runs/<date>/LIAR_LIST.json` - Models with high truthPenalty

## Scoring System

### TruthPenalty v1.0

Detects unverifiable claims, invented features, vagueness, confidence inflation:

- **Unverifiable** (0.10 per instance, cap 0.30): Claims without evidence
- **Invented** (0.125 per instance, cap 0.25): Non-existent features/APIs
- **Vague** (0.05 per instance, cap 0.25): Generic fluff without mechanism
- **Strain** (0.10 per instance, cap 0.20): Confidence inflation

**Formula:**
```
FinalScore = BaseScore - TruthPenalty - QualityPenalty
```

### QualityPenalty

Based on anchor count (concrete specs):

- **0-2 anchors:** 0.3 penalty
- **3-4 anchors:** 0.2 penalty
- **≥5 anchors:** 0.1 penalty

**Lane-specific thresholds:**
- **Web/App:** Hard fail if <3 anchors (requires implementable specs)
- **Marketing/Artwork:** Allow 0 anchors with penalty (strategic changes naturally less concrete)

### Asset Quality Score (Image Generators)

For artwork lane only:

- **Composition** (0-40 points): Layout, balance, visual hierarchy
- **Clarity** (0-30 points): Resolution, sharpness, color accuracy
- **Brand Alignment** (0-30 points): Matches brand guidelines, style consistency

**No truthPenalty applied** (images cannot "lie" like text LLMs)

## Challenger Acceptance Rules

1. **Reliability:** passRate ≥ 95% (≥5/6 or ≥19/20)
2. **No Truncation:** finishReason never 'length'
3. **No Drift:** requested model == resolved model (MODEL_LOCK)
4. **Score Improvement:** finalScore_mean ≥ control_mean + 3.0 OR (finalScore_mean ≥ control_mean AND (truthPenalty_mean + qualityPenalty_mean) ≤ (control_truth + control_quality) - 0.02)
5. **No Vague Wins:** Cannot win solely by higher qualityPenalty or lower anchorCount without real score gain
6. **Lane Eligibility:** Must be approved for specific lane (text LLMs for web/app/marketing, image models for artwork only)

## Model Weather Thresholds

### Pass Rate
- **Red:** <95%
- **Yellow:** 95-98%
- **Green:** ≥98%

### TruthPenalty Median
- **Red:** ≥0.20
- **Yellow:** 0.10-0.19
- **Green:** <0.10

### QualityPenalty Median
- **Red:** ≥0.30
- **Yellow:** 0.15-0.29
- **Green:** <0.15

### Truncations
- **Red:** >0
- **Green:** =0

### Model Drift
- **Red:** >0
- **Green:** =0

### Retry Rate
- **Red:** >10%
- **Yellow:** 5-10%
- **Green:** <5%

## Files

### Core Infrastructure
- `runs/baseline_truth_v1.2.json` - Immutable baseline with schema hashes
- `server/ai/engine/validation/schemaHashValidator.ts` - Schema drift detector
- `server/ai/engine/validation/preflightCheck.ts` - Model availability validator
- `server/ai/engine/scoring/truthPenalty.ts` - TruthPenalty v1.0 scorer
- `server/ai/engine/specialists/contentValidator.ts` - Anchor counter + quality penalty

### Tournament Runners
- `scripts/runControlSoakTest.ts` - 24-run Control soak test
- `scripts/runLaneByLanePilot.ts` - 2-lane pilot validator
- `scripts/runFullTournament.ts` - Full 4-lane tournament runner

### Documentation
- `docs/TOURNAMENT_INFRASTRUCTURE.md` - This document
- `docs/ASSET_MODEL_LANE_RULES.md` - Asset model scoring rules

## Next Steps

1. **Run Control Soak Test** (24 runs) to tighten variance bands
2. **Build Model Weather Dashboard** with real-time pass rate tracking, truthPenalty trends, token drift detection
3. **Launch Preflight Validation** for pending challengers (Claude 3.5, Grok, Groq, Stitch, SD3, Flux)
4. **Run Lane-by-Lane Pilots** for approved challengers
5. **Launch Full Tournament** once ≥2 challengers pass pilot validation

## Changelog

### v1.2.0 (2026-01-15)
- Added schema hash validation with `integrity.requireSchemaHashMatch` flag
- Added preflight check system with model availability and truncation risk validation
- Added lane-by-lane pilot system with 2-lane validation gates
- Added asset model lane rules with separate scoring rubrics
- Added Control soak test script (24 runs)
- Updated baseline with provenance, evalConfig, artifacts, challengerCatalog sections

### v1.1.0 (2026-01-14)
- Added 4-lane baseline (web, app, marketing, artwork)
- Added TruthPenalty v1.0 scoring system
- Added lane-specific anchor validation
- Fixed schema routing bug (prefix-based role matching)
- Fixed critic prompt contract drift

### v1.0.0 (2026-01-13)
- Initial tournament infrastructure with Gate A/B validation
- Control stack baseline (gpt-4o + claude-opus-4-1)
- 3-specialist workflow (systems → brand → critic)
