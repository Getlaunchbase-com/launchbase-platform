# Task: Generate Candidate Proposals

## Input
- `intentParse`: {{INTENT_PARSE_JSON}}
- `businessFacts`: {{BUSINESS_FACTS_JSON}}
- `currentContent`: {{CURRENT_CONTENT_JSON}}
- `constraints`: "No hype. Credible. Scannable. Contract-limited."
- `allowedKeys`: {{WHITELISTED_KEYS}}

## Output Requirements

**CRITICAL:** Return ONLY valid JSON. No explanations. No markdown. No HTML.

Your output MUST match the `copy_proposal` schema (schemaVersion: "v1").

## Schema Contract

```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "variants": [
    {
      "variantId": "v1",
      "targetKey": "hero.headline",
      "proposedValue": "Your headline here",
      "rationale": "Why this works",
      "confidence": 0.85,
      "risks": ["potential concern"]
    }
  ],
  "needsHuman": false,
  "escalationReason": null
}
```

## Guidance

1. **Generate ≤ 3 variants:**
   - Each variant must be meaningfully different
   - Variants should explore different angles (direct, trust-first, benefit-focused)
   - Never generate duplicate variants

2. **Each variant must include:**
   - `variantId`: "v1", "v2", "v3"
   - `targetKey`: Must be from allowedKeys
   - `proposedValue`: The actual content (respects caps)
   - `rationale`: Why this works (1-2 sentences)
   - `confidence`: 0.0 to 1.0 (be honest)
   - `risks`: Array of potential concerns

3. **Strict length caps (enforced by LaunchBase):**
   - `hero.headline`: ≤ 80 chars
   - `hero.subheadline`: ≤ 140 chars
   - `hero.cta`: ≤ 60 chars
   - `services.items[].line`: ≤ 120 chars
   - `socialProof.reviews[].text`: ≤ 240 chars
   - `trust.items[]`: ≤ 100 chars

4. **Content rules:**
   - No hype. No superlatives. No marketing fluff.
   - Use only facts from businessFacts. Never invent claims.
   - Keep it scannable and credible.
   - Avoid "we're the best" or "industry-leading"

5. **If unsure or constraints conflict:**
   - Set `needsHuman=true`
   - Set `confidence < 0.7`
   - Provide explanation in `escalationReason`

6. **Hard caps (enforced by LaunchBase):**
   - rounds ≤ 2
   - variants ≤ 3
   - costCapUsd ≤ 10

## Examples

**Example 1: Hero headline variants**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "variants": [
    {
      "variantId": "v1",
      "targetKey": "hero.headline",
      "proposedValue": "Professional Snow Removal for Chicago Homes",
      "rationale": "Direct and location-specific. Emphasizes professionalism.",
      "confidence": 0.88,
      "risks": ["May be too generic"]
    },
    {
      "variantId": "v2",
      "targetKey": "hero.headline",
      "proposedValue": "Snow Removal You Can Count On",
      "rationale": "Trust-first approach. Short and memorable.",
      "confidence": 0.82,
      "risks": ["Less specific about service area"]
    },
    {
      "variantId": "v3",
      "targetKey": "hero.headline",
      "proposedValue": "Keep Your Driveway Clear All Winter",
      "rationale": "Benefit-focused. Speaks to customer outcome.",
      "confidence": 0.79,
      "risks": ["Doesn't mention business type"]
    }
  ],
  "needsHuman": false,
  "escalationReason": null
}
```

**Example 2: Escalation needed**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "variants": [],
  "needsHuman": true,
  "escalationReason": "User wants to add pricing information, but pricing is not in allowedKeys. Need clarification on whether to add pricing section or focus on existing content."
}
```
