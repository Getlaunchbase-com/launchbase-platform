# Task: Parse User Intent

## Input
- `userText`: {{USER_TEXT}}
- `allowedKeys`: {{WHITELISTED_KEYS}}
- `contextSummary`: {{CONTEXT_SUMMARY}}

## Output Requirements

**CRITICAL:** Return ONLY valid JSON. No explanations. No markdown. No HTML.

Your output MUST match the `intent_parse` schema (schemaVersion: "v1").

## Schema Contract

```json
{
  "intentType": "copy_change" | "design_change" | "clarification",
  "targetKeys": ["hero.headline", ...],
  "userTextSummary": "brief summary of what user wants",
  "confidence": 0.0 to 1.0,
  "needsHuman": true | false,
  "proposeDirection": "clarifying question if needsHuman=true"
}
```

## Guidance

1. **Choose the smallest intentType that fits:**
   - `copy_change`: User wants to change text content
   - `design_change`: User wants to change colors, layout, fonts
   - `clarification`: User's request is unclear or ambiguous

2. **targetKeys MUST be a subset of allowedKeys:**
   - Only use keys from the provided whitelist
   - Never invent new keys
   - If user wants something outside allowedKeys → set `needsHuman=true`

3. **If unsure or ambiguous:**
   - Set `needsHuman=true`
   - Set `confidence < 0.7`
   - Provide a clarifying question in `proposeDirection`

4. **Hard caps (enforced by LaunchBase):**
   - rounds ≤ 2
   - variants ≤ 3
   - costCapUsd ≤ 10

## Examples

**Example 1: Clear request**
```json
{
  "intentType": "copy_change",
  "targetKeys": ["hero.headline"],
  "userTextSummary": "Make headline shorter and more direct",
  "confidence": 0.92,
  "needsHuman": false,
  "proposeDirection": null
}
```

**Example 2: Ambiguous request**
```json
{
  "intentType": "clarification",
  "targetKeys": [],
  "userTextSummary": "User wants 'better design' but unclear what aspect",
  "confidence": 0.45,
  "needsHuman": true,
  "proposeDirection": "Which part of the design would you like to improve? The colors, layout, or something else?"
}
```

**Example 3: Request outside whitelist**
```json
{
  "intentType": "clarification",
  "targetKeys": [],
  "userTextSummary": "User wants to add blog section (not in allowedKeys)",
  "confidence": 0.80,
  "needsHuman": true,
  "proposeDirection": "Adding a blog section isn't available in the current system. Would you like to focus on improving the existing sections instead?"
}
```
