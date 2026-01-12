# Task: Select Best Proposal or Escalate

## Input
- `intentParse`: {{INTENT_PARSE_JSON}}
- `proposal`: {{PROPOSAL_JSON}}
- `critique`: {{CRITIQUE_JSON}}
- `roundLimit`: 2
- `costCapUsd`: 10

## Output Requirements

**CRITICAL:** Return ONLY valid JSON. No explanations. No markdown. No HTML.

Your output MUST match the `decision_collapse` schema (schemaVersion: "v1").

## Schema Contract

```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "selectedProposal": {
    "targetKey": "hero.headline",
    "proposedValue": "Your headline here",
    "rationale": "Why this was chosen"
  },
  "approvalText": "Customer-friendly summary",
  "previewRecommended": true | false,
  "confidence": 0.0 to 1.0,
  "needsHuman": false,
  "escalationReason": null
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
- Set `needsHuman=true` with clear `escalationReason`

### 2. If critique.pass === true

**Select best variant:**
- Highest confidence
- Best rationale
- Fewest risks
- Most aligned with user intent

### 3. Always set

- `requiresApproval=true` (non-negotiable)
- `previewRecommended=true` for meaningful changes
- `approvalText`: Short, customer-friendly summary (1-2 sentences)

## Guidance

1. **Trivial fixes (safe to apply):**
   - Trim whitespace
   - Remove single superlative word
   - Shorten by 1-5 chars
   - Fix capitalization

2. **Non-trivial fixes (escalate):**
   - Rewrite entire sentence
   - Change meaning
   - Multiple violations
   - Unclear how to fix

3. **Confidence scoring:**
   - 0.9+: Very confident, clear winner
   - 0.7-0.9: Confident but some trade-offs
   - <0.7: Uncertain, escalate to human

4. **approvalText guidelines:**
   - Customer-friendly language
   - 1-2 sentences max
   - Explain what changed and why
   - Example: "Made your headline shorter and more direct to improve clarity."

5. **previewRecommended:**
   - `true`: For hero changes, major copy edits, design changes
   - `false`: For minor tweaks (CTA button text, small wording changes)

6. **If unsure:**
   - Set `needsHuman=true`
   - Provide specific `escalationReason`
   - Don't guess or force a decision

## Examples

**Example 1: Clean selection**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "selectedProposal": {
    "targetKey": "hero.headline",
    "proposedValue": "Professional Snow Removal for Chicago Homes",
    "rationale": "Most direct and location-specific. Passed critique with no violations."
  },
  "approvalText": "Made your headline more direct and added your service area (Chicago) for clarity.",
  "previewRecommended": true,
  "confidence": 0.91,
  "needsHuman": false,
  "escalationReason": null
}
```

**Example 2: Trivial fix applied**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "selectedProposal": {
    "targetKey": "hero.headline",
    "proposedValue": "Snow Removal You Can Count On",
    "rationale": "Best variant after removing 'best' superlative. Simple fix, meaning unchanged."
  },
  "approvalText": "Shortened your headline slightly to meet length requirements while keeping the same message.",
  "previewRecommended": true,
  "confidence": 0.87,
  "needsHuman": false,
  "escalationReason": null
}
```

**Example 3: Escalation (non-trivial fix needed)**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "selectedProposal": null,
  "approvalText": null,
  "previewRecommended": false,
  "confidence": 0.62,
  "needsHuman": true,
  "escalationReason": "All variants contain unverified claims ('industry-leading', 'award-winning') not found in businessFacts. Fixing requires complete rewrite, which exceeds AI confidence threshold. Human review needed to clarify which claims are accurate."
}
```

**Example 4: Escalation (ambiguous intent)**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "selectedProposal": null,
  "approvalText": null,
  "previewRecommended": false,
  "confidence": 0.58,
  "needsHuman": true,
  "escalationReason": "User request is ambiguous: 'make it better' could mean headline, subheadline, or entire hero section. Need clarification on which specific element to improve."
}
```

**Example 5: Escalation (multiple violations)**
```json
{
  "schemaVersion": "v1",
  "requiresApproval": true,
  "selectedProposal": null,
  "approvalText": null,
  "previewRecommended": false,
  "confidence": 0.55,
  "needsHuman": true,
  "escalationReason": "Critique found 4 violations: length cap (95 chars), superlatives ('best', '#1'), unverified claim ('20 years experience' not in businessFacts), and unclear service area. Requires human review to determine accurate facts and rewrite."
}
```
