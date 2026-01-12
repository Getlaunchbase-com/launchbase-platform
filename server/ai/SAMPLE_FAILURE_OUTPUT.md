# Sample Validation Failure Responses

This document shows example validation failure responses from `validateAiOutput()`.

## Example 1: Extra Field (additionalProperties Violation)

**Input:**
```json
{
  "schemaVersion": "v1",
  "variants": [
    {
      "targetKey": "hero.headline",
      "value": "Test headline",
      "rationale": "Test",
      "confidence": 0.8,
      "extraField": "not allowed"
    }
  ],
  "requiresApproval": true,
  "confidence": 0.8,
  "risks": [],
  "assumptions": []
}
```

**Output:**
```json
{
  "ok": false,
  "code": "schema_violation",
  "errors": [
    "/variants/0: additionalProperty 'extraField' is not allowed"
  ]
}
```

---

## Example 2: Invalid targetKey (Not Whitelisted)

**Input:**
```json
{
  "schemaVersion": "v1",
  "variants": [
    {
      "targetKey": "invalid.key",
      "value": "Test",
      "rationale": "Test",
      "confidence": 0.8
    }
  ],
  "requiresApproval": true,
  "confidence": 0.8,
  "risks": [],
  "assumptions": []
}
```

**Output:**
```json
{
  "ok": false,
  "code": "schema_violation",
  "errors": [
    "/variants/0/targetKey: must be one of [hero.headline, hero.subheadline, hero.cta, trust.items, services.items, socialProof.reviews, socialProof.outcomes]"
  ]
}
```

---

## Example 3: Missing Required Fields

**Input:**
```json
{
  "schemaVersion": "v1",
  "variants": [
    {
      "targetKey": "hero.headline",
      "value": "Test"
    }
  ],
  "requiresApproval": true,
  "confidence": 0.8,
  "risks": [],
  "assumptions": []
}
```

**Output:**
```json
{
  "ok": false,
  "code": "schema_violation",
  "errors": [
    "/variants/0: missing required property 'rationale'",
    "/variants/0: missing required property 'confidence'"
  ]
}
```

---

## Example 4: Over-Length String

**Input:**
```json
{
  "schemaVersion": "v1",
  "variants": [
    {
      "targetKey": "hero.headline",
      "value": "A".repeat(121),
      "rationale": "Test",
      "confidence": 0.8
    }
  ],
  "requiresApproval": true,
  "confidence": 0.8,
  "risks": [],
  "assumptions": []
}
```

**Output:**
```json
{
  "ok": false,
  "code": "schema_violation",
  "errors": [
    "/variants/0/value: must be <= 120 chars"
  ]
}
```

---

## Example 5: requiresApproval = false (Must Be True)

**Input:**
```json
{
  "schemaVersion": "v1",
  "variants": [
    {
      "targetKey": "hero.headline",
      "value": "Test",
      "rationale": "Test",
      "confidence": 0.8
    }
  ],
  "requiresApproval": false,
  "confidence": 0.8,
  "risks": [],
  "assumptions": []
}
```

**Output:**
```json
{
  "ok": false,
  "code": "schema_violation",
  "errors": [
    "/requiresApproval: must be true"
  ]
}
```

---

## Example 6: roundLimit > 2 (Hard Cap Violation)

**Input:**
```json
{
  "schemaVersion": "v1",
  "selectedProposal": null,
  "reason": "Test",
  "approvalText": "Test",
  "previewRecommended": false,
  "needsHuman": true,
  "confidence": 0.8,
  "requiresApproval": true,
  "roundLimit": 3,
  "costCapUsd": 10
}
```

**Output:**
```json
{
  "ok": false,
  "code": "schema_violation",
  "errors": [
    "/roundLimit: must be <= 2"
  ]
}
```

---

## Example 7: Invalid JSON (Not an Object)

**Input:**
```json
"not an object"
```

**Output:**
```json
{
  "ok": false,
  "code": "invalid_json",
  "errors": [
    "Payload must be a JSON object"
  ]
}
```

---

## Key Patterns

1. **Path notation**: Errors use JSON path notation (`/variants/0/targetKey`)
2. **Readable messages**: Errors are human-readable, not raw Ajv output
3. **Multiple errors**: `allErrors: true` means all violations are reported
4. **Structured response**: Always `{ ok, code, errors }` for easy handling
5. **No customer data**: Errors never include customer text, only structure violations
