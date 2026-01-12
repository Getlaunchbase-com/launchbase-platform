# Task: Critique Proposal Against Constraints

## Input
- `proposal`: {{PROPOSAL_JSON}}
- `sectionCaps`: {{SECTION_CAPS_SUMMARY}}
- `constraints`: "Credibility > creativity. Clarity > cleverness."

## Output Requirements

**CRITICAL:** Return ONLY valid JSON. No explanations. No markdown. No HTML.

Your output MUST match the `critique` schema (schemaVersion: "v1").

## Schema Contract

```json
{
  "schemaVersion": "v1",
  "pass": true | false,
  "violations": [
    {
      "severity": "hard_reject" | "soft_warning",
      "rule": "rule name",
      "detail": "explanation"
    }
  ],
  "suggestedFixes": ["fix 1", "fix 2"],
  "confidence": 0.0 to 1.0
}
```

## Critique Rules

### Hard Reject Conditions (pass=false)

1. **Length cap violations:**
   - hero.headline > 80 chars
   - hero.subheadline > 140 chars
   - hero.cta > 60 chars
   - services.items[].line > 120 chars
   - socialProof.reviews[].text > 240 chars
   - trust.items[] > 100 chars

2. **Credibility failures:**
   - Superlatives ("best", "leading", "#1")
   - Unverified claims
   - Marketing hype
   - Invented features not in businessFacts

3. **Schema violations:**
   - Keys not in whitelist
   - Missing required fields
   - Wrong data types

4. **Safety violations:**
   - URLs (unless explicitly allowed)
   - HTML/scripts
   - Personal data

### Soft Warning Conditions (pass=true, but note concerns)

1. **Ambiguity:**
   - Vague language
   - Unclear benefit
   - Jargon

2. **Tone issues:**
   - Too casual
   - Too formal
   - Inconsistent voice

3. **Optimization opportunities:**
   - Could be more direct
   - Could be more specific
   - Could be more scannable

## Guidance

1. **Be strict on hard rules:**
   - Any length cap violation → `pass=false`
   - Any credibility failure → `pass=false`
   - Any schema violation → `pass=false`

2. **Be helpful on soft warnings:**
   - Identify issues but allow to proceed
   - Provide specific suggestedFixes
   - Stay within whitelisted keys

3. **Confidence scoring:**
   - 0.9+: Very confident in critique
   - 0.7-0.9: Confident but some judgment calls
   - <0.7: Uncertain, may need human review

4. **If unsure:**
   - Set `confidence < 0.7`
   - Add violation with severity="soft_warning"
   - Suggest human review in suggestedFixes

## Examples

**Example 1: Hard reject (length violation)**
```json
{
  "schemaVersion": "v1",
  "pass": false,
  "violations": [
    {
      "severity": "hard_reject",
      "rule": "headline_length_cap",
      "detail": "Headline is 95 characters, exceeds 80 char limit"
    }
  ],
  "suggestedFixes": [
    "Shorten headline to 80 chars or less",
    "Remove unnecessary adjectives",
    "Use more direct language"
  ],
  "confidence": 0.95
}
```

**Example 2: Hard reject (credibility failure)**
```json
{
  "schemaVersion": "v1",
  "pass": false,
  "violations": [
    {
      "severity": "hard_reject",
      "rule": "no_superlatives",
      "detail": "Headline contains 'best' which is a superlative"
    },
    {
      "severity": "hard_reject",
      "rule": "no_unverified_claims",
      "detail": "'Industry-leading' is an unverified claim not in businessFacts"
    }
  ],
  "suggestedFixes": [
    "Remove 'best' and 'industry-leading'",
    "Use specific facts from businessFacts instead",
    "Focus on concrete benefits"
  ],
  "confidence": 0.98
}
```

**Example 3: Pass with soft warnings**
```json
{
  "schemaVersion": "v1",
  "pass": true,
  "violations": [
    {
      "severity": "soft_warning",
      "rule": "clarity",
      "detail": "Subheadline could be more specific about service area"
    }
  ],
  "suggestedFixes": [
    "Add location to subheadline (e.g., 'Serving Chicago')",
    "Specify service radius if available in businessFacts"
  ],
  "confidence": 0.82
}
```

**Example 4: Clean pass**
```json
{
  "schemaVersion": "v1",
  "pass": true,
  "violations": [],
  "suggestedFixes": [],
  "confidence": 0.91
}
```
