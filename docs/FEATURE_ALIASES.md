# Feature Aliases — Provider-Agnostic Capability Resolution

**Version:** 1.0  
**Status:** ✅ Frozen (changes require minor/major version bump)  
**Author:** Manus AI  
**Last Updated:** January 12, 2026

---

## Purpose

The feature alias layer decouples internal capability names (policy language) from vendor-specific feature strings (registry language). This prevents silent breakage when providers rename features or new providers are added.

**Problem Solved:**

During Phase 1.3, the model router failed because policy configuration used internal capability name `"json_schema"` while AIML returned vendor string `"openai/chat-completion.response-format"`. This mismatch caused "No eligible models" errors despite 96 models being available.

**Solution:**

A bidirectional alias mapping layer translates between internal capabilities and vendor feature strings. The layer supports multiple aliases per capability, enabling graceful handling of vendor renames and multi-provider scenarios.

---

## Canonical Capability Names (Internal)

These are the stable names used in policy configurations. They never change unless we add new capabilities or deprecate old ones.

| Capability | Purpose | Required For |
|------------|---------|--------------|
| `json_schema` | Structured JSON output with schema validation | AI Tennis (all phases) |
| `structured_outputs` | Guaranteed JSON structure (stricter than json_schema) | High-confidence proposals |
| `function_calling` | Tool use / function invocation | Future: QuickBooks integration, API calls |
| `vision` | Image understanding | Future: Design critique, screenshot analysis |
| `streaming` | Token-by-token output | Future: Real-time UI updates |
| `embeddings` | Vector representations | Future: Semantic search, clustering |

---

## Vendor Feature Strings (External)

These are the actual strings returned by provider APIs. They vary by vendor and can change without notice.

### AIML / OpenAI-Style Features

| Internal Capability | Vendor Strings (Aliases) |
|---------------------|--------------------------|
| `json_schema` | `"json_schema"`, `"openai/chat-completion.response-format"` |
| `structured_outputs` | `"structured_outputs"`, `"openai/chat-completion.response-format"` |
| `function_calling` | `"function_calling"`, `"openai/chat-completion.tools"` |
| `vision` | `"vision"`, `"openai/chat-completion.vision"` |
| `streaming` | `"streaming"`, `"openai/chat-completion.stream"` |

### Anthropic-Style Features (Future)

| Internal Capability | Vendor Strings (Aliases) |
|---------------------|--------------------------|
| `json_schema` | `"anthropic/structured-output"` |
| `function_calling` | `"anthropic/tool-use"` |
| `vision` | `"anthropic/vision"` |

### Google / Gemini-Style Features (Future)

| Internal Capability | Vendor Strings (Aliases) |
|---------------------|--------------------------|
| `json_schema` | `"google/gemini.json-mode"` |
| `function_calling` | `"google/gemini.function-calling"` |

---

## Resolution Rules

The alias layer resolves capabilities using a three-step process:

### 1. Exact Match

If the model's feature list includes the internal capability name exactly, it matches immediately.

**Example:**
```typescript
// Policy requires: ["json_schema"]
// Model features: ["json_schema", "streaming"]
// Result: ✅ Match (exact)
```

### 2. Alias Match

If no exact match, check if any of the model's features appear in the capability's alias list.

**Example:**
```typescript
// Policy requires: ["json_schema"]
// Model features: ["openai/chat-completion.response-format", "streaming"]
// Alias map: json_schema → ["json_schema", "openai/chat-completion.response-format"]
// Result: ✅ Match (via alias)
```

### 3. Fallback Behavior

If neither exact nor alias match succeeds, the model is ineligible for the task.

**Example:**
```typescript
// Policy requires: ["json_schema", "vision"]
// Model features: ["openai/chat-completion.response-format"]
// Result: ❌ No match (missing "vision")
```

---

## Implementation

### Core Functions

**File:** `server/ai/modelRouting/featureAliases.ts`

```typescript
/**
 * Resolve internal capability names to all known vendor aliases
 */
export function resolveFeatureAliases(capabilities: string[]): string[] {
  const resolved = new Set<string>();
  for (const cap of capabilities) {
    const aliases = FEATURE_ALIAS_MAP[cap] ?? [cap];
    aliases.forEach(a => resolved.add(a));
  }
  return Array.from(resolved);
}

/**
 * Check if model has a specific capability (exact or alias match)
 */
export function hasCapability(
  modelFeatures: string[],
  capability: string
): boolean {
  const aliases = FEATURE_ALIAS_MAP[capability] ?? [capability];
  return aliases.some(alias => modelFeatures.includes(alias));
}

/**
 * Check if model has ALL required capabilities
 */
export function hasAllCapabilities(
  modelFeatures: string[],
  requiredCapabilities: string[]
): boolean {
  return requiredCapabilities.every(cap =>
    hasCapability(modelFeatures, cap)
  );
}
```

### Alias Map

```typescript
const FEATURE_ALIAS_MAP: Record<string, string[]> = {
  json_schema: [
    "json_schema",
    "openai/chat-completion.response-format",
    "anthropic/structured-output",
  ],
  structured_outputs: [
    "structured_outputs",
    "openai/chat-completion.response-format",
  ],
  function_calling: [
    "function_calling",
    "openai/chat-completion.tools",
    "anthropic/tool-use",
    "google/gemini.function-calling",
  ],
  vision: [
    "vision",
    "openai/chat-completion.vision",
    "anthropic/vision",
  ],
  streaming: [
    "streaming",
    "openai/chat-completion.stream",
  ],
};
```

---

## Usage in Policy Configuration

**Before (Brittle):**
```typescript
// server/ai/modelRouting/modelPolicy.config.ts
export const TASK_POLICIES: Record<TaskType, TaskPolicy> = {
  json: {
    type: "chat-completion",
    requiredFeatures: [
      "openai/chat-completion.response-format",  // ❌ Vendor-specific
      "structured_outputs",
    ],
    minContextLength: 16000,
  },
};
```

**After (Resilient):**
```typescript
// server/ai/modelRouting/modelPolicy.config.ts
export const TASK_POLICIES: Record<TaskType, TaskPolicy> = {
  json: {
    type: "chat-completion",
    requiredFeatures: [
      "json_schema",        // ✅ Internal capability name
      "structured_outputs",
    ],
    minContextLength: 16000,
  },
};
```

---

## Change Policy

### Additions (Minor Version)

Adding new aliases to existing capabilities is a **minor** version change. No policy updates required.

**Example:**
```typescript
// v1.1: Add Google Gemini support
json_schema: [
  "json_schema",
  "openai/chat-completion.response-format",
  "anthropic/structured-output",
  "google/gemini.json-mode",  // ✅ New alias added
],
```

### Semantic Changes (Major Version)

Changing the meaning of a capability or removing aliases is a **major** version change. Requires policy review.

**Example:**
```typescript
// v2.0: Split json_schema into basic and strict variants
json_schema_basic: ["json_schema"],
json_schema_strict: ["structured_outputs", "openai/chat-completion.response-format"],
```

### Deprecation Process

1. Add deprecation notice to this doc
2. Update policy configs to use new capability names
3. Keep old aliases for 2 minor versions (6 months minimum)
4. Remove in next major version

---

## Adding New Providers

When integrating a new provider (e.g., Anthropic, Google, Cohere):

1. **Fetch model list** from provider API
2. **Map their feature strings** to our internal capabilities
3. **Add aliases** to `FEATURE_ALIAS_MAP`
4. **Test** with existing policies (should work without changes)
5. **Document** in this file

**Example: Adding Anthropic**

```typescript
// Step 1: Fetch Anthropic models
const models = await anthropicClient.models.list();

// Step 2: Inspect their feature strings
// Anthropic returns: ["anthropic/structured-output", "anthropic/tool-use"]

// Step 3: Add to alias map
json_schema: [
  "json_schema",
  "openai/chat-completion.response-format",
  "anthropic/structured-output",  // ✅ New
],
function_calling: [
  "function_calling",
  "openai/chat-completion.tools",
  "anthropic/tool-use",  // ✅ New
],

// Step 4: Test (no policy changes needed)
// Step 5: Document in this file
```

---

## Testing

### Unit Tests

**File:** `server/ai/modelRouting/featureAliases.test.ts`

Tests verify:
- Exact match works
- Alias match works
- Multiple aliases per capability work
- Unknown capabilities return themselves (no crash)
- `hasAllCapabilities()` requires ALL, not ANY

**Coverage:** 13/13 tests passing

### Integration Tests

**File:** `server/ai/modelRouting/modelPolicy.test.ts`

Tests verify:
- Policy configs use internal capability names
- Model eligibility filtering uses `hasAllCapabilities()`
- No vendor-specific strings in policy layer

**Coverage:** 5/5 tests passing

---

## Troubleshooting

### "No eligible models" despite models being available

**Symptom:** Model router returns empty list even though models exist in registry.

**Cause:** Policy uses internal capability name, but model features don't include any known aliases.

**Fix:**
1. Check model's feature list: `GET /internal/models/:modelId`
2. Check if feature string is in alias map: `FEATURE_ALIAS_MAP[capability]`
3. If missing, add to alias map and test

### Policy changes break after provider update

**Symptom:** Previously working policies suddenly fail after provider API update.

**Cause:** Provider renamed their feature strings.

**Fix:**
1. Fetch updated model list from provider
2. Identify new feature string
3. Add to alias map (minor version bump)
4. Test with existing policies (should work without changes)

### New provider models not appearing

**Symptom:** Added new provider, but models don't match any policies.

**Cause:** Provider uses different feature naming convention.

**Fix:**
1. Inspect provider's feature strings
2. Map to internal capabilities
3. Add aliases to `FEATURE_ALIAS_MAP`
4. Test with existing policies

---

## References

- **Implementation:** `server/ai/modelRouting/featureAliases.ts`
- **Policy Config:** `server/ai/modelRouting/modelPolicy.config.ts`
- **Policy Logic:** `server/ai/modelRouting/modelPolicy.ts`
- **Tests:** `server/ai/modelRouting/featureAliases.test.ts`
- **Phase 1.3 Debugging:** `docs/PR2_DEBUG_SUMMARY.md`
- **Production Hardening:** `docs/PR3_COMPLETE.md`

---

**Contract Owner:** LaunchBase Engineering  
**Next Review:** After adding new provider (Anthropic/Google/Cohere)
