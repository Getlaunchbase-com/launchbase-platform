# Task: Critique Proposal Against Constraints

## Input
- `draft`: {{DRAFT_JSON}}
- `userText`: {{USER_TEXT}}
- `constraints`: "Credibility > creativity. Clarity > cleverness."

## Output Requirements

**CRITICAL:** Return ONLY valid JSON. No explanations. No markdown. No HTML.

Your output MUST match the `critique` schema (schemaVersion: "v1").

## Schema Contract

```json
{
  "schemaVersion": "v1",
  "pass": true,
  "issues": [
    {
      "severity": "critical",
      "description": "Issue description",
      "affectedKey": "hero.headline"
    }
  ],
  "suggestedFixes": [
    {
      "targetKey": "hero.headline",
      "fix": "Suggested fix",
      "rationale": "Why this helps"
    }
  ],
  "confidence": 0.9,
  "requiresApproval": true
}
```

## Critique Rules

### Critical Issues (pass=false)

1. **Length cap violations:**
   - hero.headline > 120 chars
   - hero.subheadline > 120 chars
   - hero.cta > 120 chars
   - services.items[].line > 120 chars
   - socialProof.reviews[].text > 240 chars
   - trust.items[] > 120 chars

2. **Credibility failures:**
   - Superlatives ("best", "leading", "#1")
   - Unverified claims
   - Marketing hype

3. **Schema violations:**
   - Keys not in whitelist
   - Missing required fields

### Major Issues (pass=true, but note concerns)

1. **Ambiguity:**
   - Vague language
   - Unclear benefit

2. **Tone issues:**
   - Inconsistent voice

### Minor Issues (pass=true, minor notes)

1. **Optimization opportunities:**
   - Could be more direct
   - Could be more specific

## Guidance

1. **Issue severity:**
   - `critical`: Must fix before approval (pass=false)
   - `major`: Should fix but can proceed (pass=true)
   - `minor`: Nice to have (pass=true)

2. **Issues array:**
   - Max 3 items
   - Each must have: severity, description (max 200 chars), affectedKey
   - Empty array if no issues

3. **SuggestedFixes array:**
   - Max 3 items
   - Each must have: targetKey, fix (max 200 chars), rationale (max 150 chars)
   - Empty array if no fixes needed

4. **Confidence scoring:**
   - 0.9+: Very confident in critique
   - 0.7-0.9: Confident but some judgment calls
   - <0.7: Uncertain

5. **Required fields:**
   - `requiresApproval`: Always true
   - All other fields are required

## Examples

**Example 1: Critical issue (pass=false)**
```json
{
  "schemaVersion": "v1",
  "pass": false,
  "issues": [
    {
      "severity": "critical",
      "description": "Headline exceeds 120 character limit (current: 135 chars)",
      "affectedKey": "hero.headline"
    }
  ],
  "suggestedFixes": [
    {
      "targetKey": "hero.headline",
      "fix": "Shorten to 120 chars by removing unnecessary words",
      "rationale": "Meets length requirement while preserving meaning"
    }
  ],
  "confidence": 0.95,
  "requiresApproval": true
}
```

**Example 2: Major issue (pass=true)**
```json
{
  "schemaVersion": "v1",
  "pass": true,
  "issues": [
    {
      "severity": "major",
      "description": "Headline is vague and doesn't communicate business value",
      "affectedKey": "hero.headline"
    }
  ],
  "suggestedFixes": [
    {
      "targetKey": "hero.headline",
      "fix": "Add specific service or benefit to headline",
      "rationale": "Increases clarity and conversion potential"
    }
  ],
  "confidence": 0.82,
  "requiresApproval": true
}
```

**Example 3: Clean pass**
```json
{
  "schemaVersion": "v1",
  "pass": true,
  "issues": [],
  "suggestedFixes": [],
  "confidence": 0.91,
  "requiresApproval": true
}
```
