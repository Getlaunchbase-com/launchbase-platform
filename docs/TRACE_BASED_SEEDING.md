# Trace-Based Seeding for AI Tennis Tests

## Problem Solved

**Before:** Memory provider seeding relied on hashing the rendered prompt content, which was:
- **Brittle**: Tests broke when prompt templates changed
- **Leak-prone**: Required duplicating prompt rendering logic in tests
- **Unpredictable**: Hash values changed with any prompt modification

**After:** Trace-based seeding uses deterministic metadata from the AI Tennis orchestrator:
- **Stable**: Independent of prompt content
- **Secure**: No prompt duplication in test code
- **Predictable**: Keys based on schema, model, jobId, and round

---

## Key Format

### Trace-Based Key (PREFERRED)
```
${schema}:${model}:${jobId}:${round}
```

**Example:**
```
decision_collapse:router:copy-refine-test-1:1
```

### Hash-Based Key (LEGACY - Deprecated)
```
${step}:${model}:${hash}
```

**Example:**
```
decision_collapse:router:5xzxjq
```

---

## API

### seedMemoryTraceResponse (PREFERRED)

```typescript
import { seedMemoryTraceResponse } from "../ai/providers/providerFactory";

seedMemoryTraceResponse(
  schema: string,    // e.g., "decision_collapse", "copy_proposal", "critique"
  model: string,     // e.g., "router" (ModelRouter resolves actual model)
  jobId: string,     // e.g., "copy-refine-test-1" (deterministic test ID)
  round: number,     // e.g., 0, 1, 2 (AI Tennis round number)
  response: string   // JSON string of the AI response
);
```

### seedMemoryResponse (LEGACY - Deprecated)

```typescript
import { seedMemoryResponse } from "../ai/providers/providerFactory";

// @deprecated Use seedMemoryTraceResponse instead
seedMemoryResponse(
  step: string,
  model: string,
  userTextHash: string,
  response: string
);
```

---

## Lookup Strategy

The memory provider tries keys in this order:

1. **Exact trace match**: `${schema}:${model}:${jobId}:${round}`
2. **Wildcard trace match**: `${schema}:${model}:*:${round}` (for unpredictable jobIds)
3. **Hash-based fallback**: `${step}:${model}:${hash}` (legacy compatibility)
4. **Schema-based fixture**: Default fixture for the schema (last resort)

---

## Example: Testing needsHuman Path

```typescript
it("handles needsHuman path with structured failure", async () => {
  // Seed a needsHuman decision_collapse response
  const needsHumanCollapse = {
    schemaVersion: "v1",
    selectedProposal: null,
    reason: "Needs human review.",
    needsHuman: true,
    confidence: 0.4,
    requiresApproval: true,
    roundLimit: 1,
    costCapUsd: 1,
  };

  // Seed using trace-based key (deterministic, no prompt dependency)
  const testJobId = "copy-refine-test-needshuman";
  seedMemoryTraceResponse(
    "decision_collapse",  // schema
    "router",             // model
    testJobId,            // jobId (test-specific, predictable)
    1,                    // round
    JSON.stringify(needsHumanCollapse)
  );

  const result = await aiTennisCopyRefine(
    {
      tenant: "launchbase",
      intakeId: 2,
      userText: "Complex request requiring human review",
      constraints: { maxRounds: 1, costCapUsd: 0.0001 },
    },
    "memory"
  );

  // Wildcard matching will find the seeded response even if the actual
  // jobId is "copy-refine-1768238332301" (with timestamp)
  expect(result.success).toBe(false);
  expect(result.reason).toBe("needs_human");
});
```

---

## Wildcard Matching

When the exact `jobId` can't be predicted (e.g., contains `Date.now()`), the memory provider uses wildcard matching:

**Seeded key:**
```
decision_collapse:router:copy-refine-test-needshuman:1
```

**Actual runtime key:**
```
decision_collapse:router:copy-refine-1768238332301:1
```

**Match logic:**
```typescript
// Matches any key with same schema, model, and round
if (key.startsWith(`${schema}:${model}:`) && key.endsWith(`:${round}`)) {
  return value;
}
```

---

## Benefits

1. **No Prompt Duplication**: Tests don't need to know how prompts are rendered
2. **Stable Tests**: Prompt template changes don't break tests
3. **Zero Leak Risk**: No prompt content in test code
4. **Deterministic**: Same inputs always produce same results
5. **Backward Compatible**: Legacy hash-based tests still work

---

## Migration Guide

### Before (Hash-Based)
```typescript
import { seedMemoryResponse, simpleHash } from "../ai/providers/providerFactory";

const userText = "Complex request";
const hash = simpleHash(userText);
seedMemoryResponse("decision_collapse", "router", hash, JSON.stringify(response));
```

### After (Trace-Based)
```typescript
import { seedMemoryTraceResponse } from "../ai/providers/providerFactory";

const testJobId = "test-job-1";
seedMemoryTraceResponse("decision_collapse", "router", testJobId, 1, JSON.stringify(response));
```

---

## Forever Rules

1. **Always use trace-based seeding for new tests**
2. **Never hash prompt content in tests**
3. **Never duplicate prompt rendering logic**
4. **Use predictable jobIds in tests** (e.g., "test-job-1", not timestamps)
5. **Rely on wildcard matching for unpredictable jobIds**

---

## Test Results

**Before:** 3/4 tests passing (needsHuman test failing due to hash mismatch)

**After:** 12/12 tests passing
- ✅ 8/8 AI Tennis orchestrator tests
- ✅ 4/4 AI Tennis service tests

---

## References

- `server/ai/providers/providerFactory.ts` - Memory provider implementation
- `server/ai/runAiTennis.ts` - Trace generation
- `server/actionRequests/aiTennisCopyRefine.test.ts` - Example usage
- `server/ai/__tests__/runAiTennis.test.ts` - Orchestrator tests
