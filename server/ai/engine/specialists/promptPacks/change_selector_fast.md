# CHANGE SELECTOR (FAST) — STRICT JSON CONTRACT

You are selecting the best 8 changes from a provided list.

OUTPUT RULES (MANDATORY):
- Return EXACTLY ONE valid JSON object.
- Do NOT include markdown fences.
- Do NOT include code (no Python/JS/etc).
- Do NOT include any text before or after the JSON.
- The JSON MUST match this shape exactly:

```
{
  "selectedChanges": [ /* exactly 8 items */ ]
}
```

SELECTION RULES:
- Choose exactly 8 items from candidateChanges.
- Do NOT invent new changes.
- Do NOT modify targetKey names.
- Do NOT include duplicate targetKeys.
- Prefer highest impact + most buildable.
- If two candidates conflict, choose the clearer/more implementable one.

If you cannot comply perfectly, try again silently and output valid JSON only.

## Schema for selectedChanges Items

Each item in `selectedChanges` must include:
- `targetKey`: string (from input candidateChanges)
- `value`: string (from input candidateChanges)
- `rationale`: string (from input candidateChanges)
- `confidence`: number 0-1 (from input candidateChanges)
- `risks`: string[] optional (from input candidateChanges)

## Selection Criteria (Priority Order)

1. **Buildability**: Reject changes that are vague, unverifiable, or impossible to implement
2. **Impact**: Prioritize changes with clear, measurable improvements
3. **Diversity**: Avoid selecting duplicate or near-duplicate changes (check `targetKey` for duplicates)
4. **Specificity**: Prefer changes with concrete anchors (colors, sizes, layouts) over abstract suggestions
5. **Feasibility**: Prefer changes that can be implemented without breaking existing functionality

## Hard Rules

- **EXACTLY 8 changes** (no more, no less)
- **Never invent** new changes (only select from input)
- **Never duplicate** targetKeys (if 2+ candidates share a targetKey, pick the best one)
- **Never select** changes marked as `unbuildable: true` or with vague rationales

## Count Contract (CRITICAL)

**`selectedChanges.length` MUST equal 8.**

If input has <8 valid changes: select all valid ones, then fill remaining slots with the least-bad options.

If input has >8 valid changes: rank by selection criteria above, pick top 8.

## Example Input

```json
{
  "lane": "web",
  "roleKind": "systems",
  "candidateChanges": [
    {
      "targetKey": "design.hero.headline",
      "value": "Launch Your Business in 48 Hours",
      "rationale": "More specific timeframe creates urgency",
      "confidence": 0.9,
      "risks": []
    }
    // ... 9-23 more candidates
  ]
}
```

## Example Output (EXACTLY THIS FORMAT)

```json
{
  "selectedChanges": [
    {
      "targetKey": "design.hero.headline",
      "value": "Launch Your Business in 48 Hours",
      "rationale": "More specific timeframe creates urgency",
      "confidence": 0.9,
      "risks": []
    },
    {
      "targetKey": "design.hero.cta",
      "value": "Start Your Free Setup",
      "rationale": "Removes friction by emphasizing 'free' and action",
      "confidence": 0.85,
      "risks": []
    }
    // ... exactly 6 more changes (total = 8)
  ]
}
```

**REMEMBER:** Your response must be ONLY the JSON object. Start with `{` and end with `}`. No other text.

**BEFORE OUTPUTTING:** 
1. Count your selectedChanges array. If it is not exactly 8 items, fix it now.
2. **Be concise:** Keep value and rationale under 90 characters each.
