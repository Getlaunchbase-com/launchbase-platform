# Task: Generate Candidate Proposals

## Input
- `userText`: {{USER_TEXT}}
- `targetSection`: {{TARGET_SECTION}}
- `currentCopy`: {{CURRENT_COPY_JSON}}
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
      "targetKey": "hero.headline",
      "value": "Your headline here",
      "rationale": "Why this works",
      "confidence": 0.85,
      "risks": ["potential concern"]
    }
  ],
  "confidence": 0.85,
  "risks": ["overall risk 1", "overall risk 2"],
  "assumptions": ["assumption 1", "assumption 2"]
}
```

## Guidance

1. **Generate 1-3 variants:**
   - Each variant must be meaningfully different
   - Variants should explore different angles (direct, trust-first, benefit-focused)
   - Never generate duplicate variants

2. **Each variant must include:**
   - `targetKey`: Must be from allowedKeys
   - `value`: The actual content (respects caps)
   - `rationale`: Why this works (1-2 sentences, max 200 chars)
   - `confidence`: 0.0 to 1.0 (be honest)
   - `risks`: Array of potential concerns (optional, max 3 items, 120 chars each)

3. **Root-level fields (required):**
   - `confidence`: Overall confidence across all variants (0.0 to 1.0)
   - `risks`: Overall risks across all variants (max 5 items, 120 chars each)
   - `assumptions`: Assumptions made during generation (max 5 items, 120 chars each)

4. **Strict length caps (enforced by LaunchBase):**
   - `hero.headline`: ≤ 120 chars
   - `hero.subheadline`: ≤ 120 chars
   - `hero.cta`: ≤ 120 chars
   - `services.items[].line`: ≤ 120 chars
   - `socialProof.reviews[].text`: ≤ 240 chars
   - `trust.items[]`: ≤ 120 chars

5. **Content rules:**
   - No hype. No superlatives. No marketing fluff.
   - Keep it scannable and credible.
   - Avoid "we're the best" or "industry-leading"

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
      "targetKey": "hero.headline",
      "value": "Professional Snow Removal for Chicago Homes",
      "rationale": "Direct and location-specific. Emphasizes professionalism.",
      "confidence": 0.88,
      "risks": ["May be too generic"]
    },
    {
      "targetKey": "hero.headline",
      "value": "Snow Removal You Can Count On",
      "rationale": "Trust-first approach. Short and memorable.",
      "confidence": 0.82,
      "risks": ["Less specific about service area"]
    },
    {
      "targetKey": "hero.headline",
      "value": "Keep Your Driveway Clear All Winter",
      "rationale": "Benefit-focused. Speaks to customer outcome.",
      "confidence": 0.79,
      "risks": ["Doesn't mention business type"]
    }
  ],
  "confidence": 0.83,
  "risks": ["All variants are relatively generic", "No specific differentiation from competitors"],
  "assumptions": ["Business operates in Chicago area", "Target audience is residential homeowners", "Service is year-round or winter-focused"]
}
```

**Example 2: Simple single variant**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "variants": [
    {
      "targetKey": "hero.headline",
      "value": "Welcome",
      "rationale": "Short and inviting as requested",
      "confidence": 0.9
    }
  ],
  "confidence": 0.9,
  "risks": [],
  "assumptions": ["User wants maximum brevity"]
}
```
