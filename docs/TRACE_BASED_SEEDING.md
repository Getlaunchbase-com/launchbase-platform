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

### Trace-Based Key (REQUIRED)
```
${schema}:${model}:${jobId}:${round}
```

**Example:**
```
decision_collapse:router:copy-refine-test-1:1
```

**Critical:** Keys NEVER contain prompt content. Only trace metadata.

### Hash-Based Key (DEPRECATED - DO NOT USE)
```
${step}:${model}:${hash}
```

**Warning:** Uses prompt content for keys. Deprecated. Will be removed.

---

## API

### seedMemoryTraceResponse (REQUIRED)

```typescript
import { seedMemoryTraceResponse } from "../ai/providers/providerFactory";

seedMemoryTraceResponse(
  schema: string,    // e.g., "decision_collapse", "copy_proposal", "critique"
  model: string,     // e.g., "router" (ModelRouter resolves actual model)
  jobId: string,     // e.g., "test-job-1" (deterministic test ID)
  round: number,     // e.g., 0, 1, 2 (AI Tennis round number)
  response: string   // JSON string of the AI response
);
```

### seedMemoryResponse (DEPRECATED - DO NOT USE)

```typescript
// @deprecated Uses prompt content for keys - DO NOT USE
// Will be removed in future version
seedMemoryResponse(step, model, userTextHash, response);
```

---

## Testing Approach

### Option 1: Deterministic jobId (PREFERRED)

Inject a deterministic `jobId` into the service call:

```typescript
it("handles needsHuman path", async () => {
  const testJobId = "test-needshuman-1";
  
  // Seed with deterministic jobId
  seedMemoryTraceResponse(
    "decision_collapse",
    "router",
    testJobId,
    1,
    JSON.stringify(needsHumanCollapse)
  );

  // Call service with injected jobId
  const result = await aiTennisService.refineCopy(
    { userText: "...", jobId: testJobId },  // ← Inject deterministic jobId
    "memory"
  );
  
  expect(result.needsHuman).toBe(true);
});
```

### Option 2: Mock Date.now() (ALTERNATIVE)

Mock `Date.now()` to make timestamp-based jobIds predictable:

```typescript
import { vi } from 'vitest';

it("handles needsHuman path", async () => {
  const fixedTime = 1700000000000;
  vi.spyOn(Date, 'now').mockReturnValue(fixedTime);
  
  const expectedJobId = `copy-refine-${fixedTime}`;
  
  seedMemoryTraceResponse(
    "decision_collapse",
    "router",
    expectedJobId,
    1,
    JSON.stringify(needsHumanCollapse)
  );

  const result = await aiTennisService.refineCopy(
    { userText: "..." },
    "memory"
  );
  
  expect(result.needsHuman).toBe(true);
  
  vi.restoreAllMocks();
});
```

### Option 3: Wildcard Matching (TEST-ONLY FALLBACK)

**WARNING:** Only works when `process.env.VITEST === 'true'`. Not available in production.

The memory provider will match any jobId for the same schema/model/round:

```typescript
it("handles needsHuman path", async () => {
  // Seed with ANY jobId (wildcard will match)
  seedMemoryTraceResponse(
    "decision_collapse",
    "router",
    "test-wildcard",  // ← Any jobId works in VITEST
    1,
    JSON.stringify(needsHumanCollapse)
  );

  // Actual jobId will be "copy-refine-1768238332301" (with Date.now())
  // Wildcard matching will find the seeded response
  const result = await aiTennisService.refineCopy(
    { userText: "..." },
    "memory"
  );
  
  expect(result.needsHuman).toBe(true);
});
```

**Wildcard matching is guarded by:**
```typescript
if (process.env.VITEST === 'true') {
  // Wildcard matching allowed
}
```

---

## Lookup Strategy

The memory provider tries keys in this order:

1. **Exact trace match**: `${schema}:${model}:${jobId}:${round}`
2. **Wildcard trace match** (VITEST only): `${schema}:${model}:*:${round}`
3. **Hash-based fallback** (DEPRECATED): `${step}:${model}:${hash}`
4. **Schema-based fixture**: Default fixture for the schema (last resort)

---

## Security Guarantees

### ✅ Trace-Based Keys (SAFE)
- **No prompt content** in keys
- **No prompt duplication** in test code
- **Zero leak risk** in logs or errors

### ⚠️ Hash-Based Keys (UNSAFE - DEPRECATED)
- **Prompt content hashed** for keys
- **Prompt rendering duplicated** in tests
- **Leak risk** if hash function changes

---

## Forever Rules

1. **ALWAYS use trace-based seeding for new tests**
2. **NEVER hash prompt content in tests**
3. **NEVER duplicate prompt rendering logic**
4. **Use deterministic jobIds** (Option 1) or **mock Date.now()** (Option 2)
5. **Wildcard matching is test-only** (guarded by VITEST)
6. **No prompt data in keys** - trace metadata only

---

## Test Results

**Before:** 3/4 tests passing (needsHuman test failing due to hash mismatch)

**After:** 12/12 tests passing
- ✅ 8/8 AI Tennis orchestrator tests
- ✅ 4/4 AI Tennis service tests
- ✅ No prompt content in keys
- ✅ No debug logs in production
- ✅ Wildcard matching guarded by VITEST

---

## Implementation Details

### Memory Provider Key Generation

```typescript
// Trace-based key (PREFERRED - no prompt content)
const schema = traceObj?.schema;
const jobId = traceObj?.jobId;
const round = traceObj?.round ?? 0;
const traceKey = schema && jobId 
  ? `${schema}:${model}:${jobId}:${round}` 
  : null;

// Exact match
rawText = memoryStore.get(traceKey);

// Wildcard match (VITEST only)
if (!rawText && process.env.VITEST === 'true') {
  for (const [key, value] of memoryStore.entries()) {
    if (key.startsWith(`${schema}:${model}:`) && key.endsWith(`:${round}`)) {
      rawText = value;
      break;
    }
  }
}
```

### Hash-Based Fallback (DEPRECATED)

```typescript
// WARNING: Uses prompt content for keys - deprecated
const userMessage = messages.find((m) => m.role === "user")?.content || "";
const hash = simpleHash(userMessage);
const hashKey = `${traceObj?.step || "unknown"}:${model}:${hash}`;
rawText = memoryStore.get(hashKey);
```

---

## Migration Guide

### Before (Hash-Based - DEPRECATED)
```typescript
import { seedMemoryResponse, simpleHash } from "../ai/providers/providerFactory";

const userText = "Complex request";
const hash = simpleHash(userText);  // ← Hashing prompt content
seedMemoryResponse("decision_collapse", "router", hash, JSON.stringify(response));
```

### After (Trace-Based - REQUIRED)
```typescript
import { seedMemoryTraceResponse } from "../ai/providers/providerFactory";

const testJobId = "test-job-1";  // ← Deterministic jobId
seedMemoryTraceResponse("decision_collapse", "router", testJobId, 1, JSON.stringify(response));
```

---

## References

- `server/ai/providers/providerFactory.ts` - Memory provider implementation
- `server/ai/runAiTennis.ts` - Trace generation
- `server/actionRequests/aiTennisCopyRefine.test.ts` - Example usage
- `server/ai/__tests__/runAiTennis.test.ts` - Orchestrator tests
