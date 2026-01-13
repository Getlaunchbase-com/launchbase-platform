# Model Router Troubleshooting Guide

**Purpose:** Diagnose and fix model routing failures without logging prompts or provider payloads  
**Author:** Manus AI  
**Last Updated:** January 12, 2026

---

## Symptoms & Root Causes We Hit (Phase 1.3)

### 1. Features Array Normalized to Numeric Indices

**Symptom:**
```
[AI] ModelRouter failed {
  task: 'json',
  error: 'No eligible models for task=json'
}
```

**Root Cause:**

When `Object.entries()` was called on an array, features became `["0", "1", "2"]` instead of actual feature names like `["json_schema", "streaming"]`.

**Code Location:** `server/ai/modelRouting/modelRegistry.ts`

**Fix Applied:**
```typescript
// Before (broken)
function normalizeFeatures(raw: unknown): string[] {
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }
  return [];
}

// After (fixed)
function normalizeFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter(f => typeof f === 'string' && f.trim().length > 0);
  }
  if (typeof raw === 'object' && raw !== null) {
    return Object.entries(raw)
      .filter(([, v]) => v)
      .map(([k]) => k);
  }
  return [];
}
```

**Test Coverage:** `server/ai/modelRouting/modelNormalize.test.ts` (17 tests)

---

### 2. "No Eligible Models" Due to Type Mismatch

**Symptom:**
```
[AI] ModelRouter failed {
  task: 'json',
  error: 'No eligible models for task=json constraints={"type":"text",...}'
}
```

**Root Cause:**

Policy configuration specified `type: "text"` but AIML models returned `type: "chat-completion"`. Type filter rejected all models.

**Code Location:** `server/ai/modelRouting/modelPolicy.config.ts`

**Fix Applied:**
```typescript
// Before (broken)
export const TASK_POLICIES: Record<TaskType, TaskPolicy> = {
  json: {
    type: "text",  // ❌ Wrong type
    requiredFeatures: ["json_schema"],
    minContextLength: 16000,
  },
};

// After (fixed)
export const TASK_POLICIES: Record<TaskType, TaskPolicy> = {
  json: {
    type: "chat-completion",  // ✅ Correct type
    requiredFeatures: ["json_schema"],
    minContextLength: 16000,
  },
};
```

**Added to ModelType Enum:**
```typescript
export type ModelType = "chat-completion" | "text" | "embedding" | "image";
```

---

### 3. Schema Validation Failures Due to Prompt/Schema Drift

**Symptom:**
```
[AI Tennis] Round 0 failed: schema_invalid
Error: data must have required property 'value'
```

**Root Cause:**

Prompt template used field name `proposedValue` but validation schema expected `value`. Mismatch caused all proposals to fail validation.

**Code Location:** `server/ai/promptPacks/v1/task_generate_candidates.md`

**Fix Applied:**

Updated prompt to match validation schema exactly:

```markdown
<!-- Before (broken) -->
{
  "targetKey": "hero.headline",
  "proposedValue": "Transform Your Business",
  "variantId": 1
}

<!-- After (fixed) -->
{
  "targetKey": "hero.headline",
  "value": "Transform Your Business",
  "rationale": "Clear value proposition",
  "confidence": 0.9,
  "risks": [],
  "assumptions": []
}
```

**Validation Schema:** `server/ai/validateAiOutput.ts` (CopyProposal schema)

**Test Coverage:** `server/ai/__tests__/promptPack.validation.test.ts` (12 tests)

---

## Quick Checks (Safe Debug Approach)

### 1. Registry Loaded N Models

**Check:**
```bash
# Server logs on startup
[AI] Model registry initialized: { modelCount: 433, stale: false }
[AI] Background refresh started (interval: 10 minutes)
```

**What Good Looks Like:**
- `modelCount > 0` (at least 100+ models expected from AIML)
- `stale: false` (registry successfully fetched from provider)

**What Bad Looks Like:**
- `modelCount: 0` → AIML API key invalid or network issue
- `stale: true` → Using cached models from previous run (acceptable, but investigate if persistent)

**Fix:**
1. Verify `AIML_API_KEY` is set: `env | grep AIML`
2. Test AIML connectivity: `curl -H "Authorization: Bearer $AIML_API_KEY" https://api.aimlapi.com/v1/models`
3. Check server logs for fetch errors

---

### 2. Eligible Models Count

**Check:**
```bash
# Use internal endpoint
curl -X POST http://localhost:3000/api/internal/modelRouting/resolve \
  -H "Content-Type: application/json" \
  -d '{"task": "json"}'
```

**What Good Looks Like:**
```json
{
  "primary": {
    "id": "gpt-4o-mini-2024-07-18",
    "type": "chat-completion",
    "features": ["openai/chat-completion.response-format", "streaming"]
  },
  "fallbacks": [
    {"id": "gpt-4o-2024-08-06", ...},
    {"id": "gpt-4-turbo-2024-04-09", ...}
  ],
  "eligibleCount": 96
}
```

**What Bad Looks Like:**
```json
{
  "error": "No eligible models for task=json constraints={...}",
  "eligibleCount": 0
}
```

**Fix:**
1. Check policy constraints: `server/ai/modelRouting/modelPolicy.config.ts`
2. Verify feature aliases: `server/ai/modelRouting/featureAliases.ts`
3. Relax constraints (e.g., remove `preferPinned: true`)

---

### 3. Selected Primary + Fallbacks

**Check:**

After calling `/internal/modelRouting/resolve`, verify:
- `primary` is not null
- `fallbacks.length >= 3` (recommended for resilience)
- `primary.features` includes required capabilities (via aliases)

**What Good Looks Like:**
```json
{
  "primary": {
    "id": "gpt-4o-mini-2024-07-18",
    "features": ["openai/chat-completion.response-format"]
  },
  "fallbacks": [
    {"id": "gpt-4o-2024-08-06"},
    {"id": "gpt-4-turbo-2024-04-09"},
    {"id": "claude-3-5-sonnet-20241022"}
  ]
}
```

**What Bad Looks Like:**
```json
{
  "primary": {
    "id": "gpt-4o-mini-2024-07-18",
    "features": []  // ❌ No features (normalization bug)
  },
  "fallbacks": []
}
```

**Fix:**
1. Check feature normalization: `server/ai/modelRouting/modelRegistry.ts`
2. Verify AIML API returns features in expected format
3. Run unit tests: `pnpm vitest run server/ai/modelRouting/modelNormalize.test.ts`

---

## Safe Debug Approach (No Prompt Logging)

### ✅ DO: Log Metadata Only

```typescript
console.log("[AI] ModelRouter selecting model", {
  task,
  eligibleCount: eligible.length,
  primaryId: primary?.id,
  fallbackCount: fallbacks.length,
  traceId,
});
```

### ❌ DON'T: Log Prompts or Provider Payloads

```typescript
// ❌ NEVER DO THIS
console.log("[AI] Prompt:", prompt);
console.log("[AI] Provider response:", response);
console.log("[AI] Error details:", error.message);
```

### Safe Error Logging

```typescript
// ✅ Safe: Log error type + trace ID
console.error("[AI] ModelRouter failed", {
  task,
  error: "No eligible models",
  traceId,
  eligibleCount: 0,
});

// ❌ Unsafe: Log error.message (may contain prompt fragments)
console.error("[AI] Error:", error.message);
```

---

## Common Issues & Solutions

### Issue: "No eligible models" despite models in registry

**Diagnosis:**
1. Check policy constraints are not too restrictive
2. Verify feature aliases include vendor-specific strings
3. Check model type matches policy type

**Solution:**
```typescript
// Relax constraints temporarily to test
export const TASK_POLICIES: Record<TaskType, TaskPolicy> = {
  json: {
    type: "chat-completion",
    requiredFeatures: ["json_schema"],  // Remove extra features
    minContextLength: 8000,  // Lower threshold
    preferPinned: false,  // Disable pinned-only filter
  },
};
```

---

### Issue: Schema validation fails on first round

**Diagnosis:**
1. Check prompt template matches validation schema
2. Verify all required fields are present
3. Check field names match exactly (case-sensitive)

**Solution:**
1. Run validation test: `pnpm vitest run server/ai/__tests__/promptPack.validation.test.ts`
2. Compare prompt output to schema: `server/ai/validateAiOutput.ts`
3. Update prompt to match schema (NOT the other way around)

---

### Issue: Model routing works but AI Tennis fails

**Diagnosis:**
1. Check if provider is actually being called (not memory/log transport)
2. Verify `AI_PROVIDER` environment variable
3. Check AIML API credits

**Solution:**
```bash
# Verify provider setting
echo $AI_PROVIDER  # Should be "aiml"

# Check AIML credits
curl -H "Authorization: Bearer $AIML_API_KEY" \
  https://api.aimlapi.com/v1/account/balance

# Test provider connectivity
pnpm tsx scripts/testRealWorkflow.ts
```

---

### Issue: Features normalized to ["0", "1", "2"]

**Diagnosis:**
1. Check if `normalizeFeatures()` handles arrays correctly
2. Verify `Array.isArray()` check happens before `Object.entries()`

**Solution:**

Already fixed in Phase 1.3. Verify fix is applied:

```typescript
// server/ai/modelRouting/modelRegistry.ts
export function normalizeFeatures(raw: unknown): string[] {
  if (Array.isArray(raw)) {  // ✅ Check array first
    return raw.filter(f => typeof f === 'string' && f.trim().length > 0);
  }
  // ... rest of function
}
```

Run regression test:
```bash
pnpm vitest run server/ai/modelRouting/modelNormalize.test.ts
```

---

## Debugging Workflow

### Step 1: Verify Registry Health

```bash
# Check server logs
[AI] Model registry initialized: { modelCount: 433, stale: false }

# If modelCount = 0, check AIML connectivity
curl -H "Authorization: Bearer $AIML_API_KEY" \
  https://api.aimlapi.com/v1/models
```

### Step 2: Test Model Resolution

```bash
# Resolve model for task
curl -X POST http://localhost:3000/api/internal/modelRouting/resolve \
  -H "Content-Type: application/json" \
  -d '{"task": "json"}'

# Expected: primary + fallbacks returned
# If error: check policy constraints + feature aliases
```

### Step 3: Run AI Tennis Workflow

```bash
# Test with realistic prompt
pnpm tsx scripts/testRealWorkflow.ts

# Expected: success: true, actionRequestId returned
# If needsHuman: true, check logs for stopReason
```

### Step 4: Verify DB Write

```sql
SELECT 
  id,
  JSON_EXTRACT(rawInbound, '$.aiTennis.stopReason') AS stopReason,
  JSON_EXTRACT(rawInbound, '$.aiTennis.rounds') AS rounds,
  JSON_EXTRACT(rawInbound, '$.aiTennis.costUsd') AS costUsd
FROM action_requests
ORDER BY createdAt DESC
LIMIT 1;
```

**Expected:** stopReason = "ok", rounds >= 1, costUsd > 0

### Step 5: Generate Weekly Report

```bash
pnpm tsx scripts/generateWeeklyAiReport.ts

# Expected: Non-N/A metrics for all 6 sections
# If N/A persists: check rawInbound.source = "ai_tennis"
```

---

## References

- **Model Registry:** `server/ai/modelRouting/modelRegistry.ts`
- **Model Policy:** `server/ai/modelRouting/modelPolicy.ts`
- **Feature Aliases:** `server/ai/modelRouting/featureAliases.ts`
- **Validation:** `server/ai/validateAiOutput.ts`
- **Phase 1.3 Debugging:** `docs/PR2_DEBUG_SUMMARY.md`
- **Feature Alias Layer:** `docs/FEATURE_ALIASES.md`
- **Real Workflow Test:** `docs/REAL_WORKFLOW_TEST.md`

---

**Contract Owner:** LaunchBase Engineering  
**Next Review:** After adding new provider or task type
