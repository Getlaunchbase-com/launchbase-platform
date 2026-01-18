# Task: Select Best Proposal or Escalate

## Input
- `draft`: {{DRAFT_JSON}}
- `critique`: {{CRITIQUE_JSON}}
- `userText`: {{USER_TEXT}}
- `roundLimit`: {{ROUND_LIMIT}}
- `costCapUsd`: {{COST_CAP_USD}}

## Output Requirements

**CRITICAL:** Return ONLY valid JSON. No explanations. No markdown. No HTML.

Your output MUST match the `decision_collapse` schema (schemaVersion: "v1").

## Schema Contract

```json
{
  "schemaVersion": "v1",
  "selectedProposal": {
    "type": "copy",
    "targetKey": "hero.headline",
    "value": "Your headline here"
  },
  "reason": "Why this proposal was selected",
  "approvalText": "Customer-friendly summary",
  "previewRecommended": true,
  "needsHuman": false,
  "confidence": 0.9,
  "requiresApproval": true,
  "roundLimit": 2,
  "costCapUsd": 10
}
```

## Decision Logic

### 1. If critique.pass === false

**Option A: Apply trivial fix (if safe)**
- Fix is simple (e.g., trim 5 chars, remove one word)
- Fix doesn't change meaning
- Confidence remains high (>0.85)
- Return selectedProposal with fix applied

**Option B: Escalate (if uncertain)**
- Fix is non-trivial
- Multiple violations
- Confidence drops below 0.7
- Set `needsHuman=true` with clear `needsHumanReason`

### 2. If critique.pass === true

**Select best variant:**
- Highest confidence
- Best rationale
- Fewest risks
- Most aligned with user intent

### 3. Always set

- `requiresApproval=true` (non-negotiable)
- `previewRecommended=true` for meaningful changes
- `approvalText`: Short, customer-friendly summary (max 200 chars)
- `reason`: Why this proposal was selected (max 300 chars)
- `roundLimit` and `costCapUsd`: Echo from input

## Required Fields

**Always required:**
- `schemaVersion`: "v1"
- `selectedProposal`: Object with `type`, `targetKey`, `value` OR null if needsHuman=true
- `reason`: Why selected (max 300 chars)
- `approvalText`: Customer summary (max 200 chars)
- `previewRecommended`: boolean
- `needsHuman`: boolean
- `confidence`: 0.0 to 1.0
- `requiresApproval`: true (always)
- `roundLimit`: Echo from input
- `costCapUsd`: Echo from input

**Optional:**
- `needsHumanReason`: Required if needsHuman=true (max 200 chars)
- `assumptions`: Array of strings (max 5 items, 120 chars each)

## Guidance

1. **selectedProposal structure:**
   - Must have `type: "copy"` for copy proposals
   - Must have `targetKey` from allowed keys
   - Must have `value` (not `proposedValue`)
   - Set to `null` if needsHuman=true

2. **Trivial fixes (safe to apply):**
   - Trim whitespace
   - Remove single superlative word
   - Shorten by 1-5 chars
   - Fix capitalization

3. **Non-trivial fixes (escalate):**
   - Rewrite entire sentence
   - Change meaning
   - Multiple violations
   - Unclear how to fix

4. **Confidence scoring:**
   - 0.9+: Very confident, clear winner
   - 0.7-0.9: Confident but some trade-offs
   - <0.7: Uncertain, escalate to human

5. **approvalText guidelines:**
   - Customer-friendly language
   - Max 200 chars
   - Explain what changed and why
   - Example: "Made your headline shorter and more direct to improve clarity."

6. **previewRecommended:**
   - `true`: For hero changes, major copy edits
   - `false`: For minor tweaks

7. **If unsure:**
   - Set `needsHuman=true`
   - Provide specific `needsHumanReason`
   - Set `selectedProposal=null`
   - Don't guess or force a decision

## Examples

**Example 1: Clean selection**
```json
{
  "schemaVersion": "v1",
  "selectedProposal": {
    "type": "copy",
    "targetKey": "hero.headline",
    "value": "Professional Snow Removal for Chicago Homes"
  },
  "reason": "Most direct and location-specific. Passed critique with no violations.",
  "approvalText": "Made your headline more direct and added your service area (Chicago) for clarity.",
  "previewRecommended": true,
  "needsHuman": false,
  "confidence": 0.91,
  "requiresApproval": true,
  "roundLimit": 2,
  "costCapUsd": 10
}
```

**Example 2: Escalation (non-trivial fix needed)**
```json
{
  "schemaVersion": "v1",
  "selectedProposal": null,
  "reason": "All variants contain unverified claims not found in business facts. Fixing requires complete rewrite.",
  "approvalText": "We need your input to clarify which claims are accurate before proceeding.",
  "previewRecommended": false,
  "needsHuman": true,
  "needsHumanReason": "All variants contain unverified claims ('industry-leading', 'award-winning') not found in businessFacts. Human review needed.",
  "confidence": 0.62,
  "requiresApproval": true,
  "roundLimit": 2,
  "costCapUsd": 10
}
```

**Example 3: Simple selection**
```json
{
  "schemaVersion": "v1",
  "selectedProposal": {
    "type": "copy",
    "targetKey": "hero.headline",
    "value": "Welcome"
  },
  "reason": "Shortest and most direct option. Meets all requirements.",
  "approvalText": "Shortened your headline to be more concise and inviting.",
  "previewRecommended": true,
  "needsHuman": false,
  "confidence": 0.9,
  "requiresApproval": true,
  "roundLimit": 1,
  "costCapUsd": 1
}
```
