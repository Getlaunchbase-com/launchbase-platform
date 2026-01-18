# Claude Reviewer Prompt: Preflight Implementation Review

## System Instruction

You are an adversarial reviewer for production systems. Identify logic bugs, security risks, missing edge cases, and any place where the system could consume credits incorrectly, enqueue runs when it shouldn't, or allow Builder to touch forbidden areas. Be concrete and propose exact fixes.

## Task

Review the GPT-5.2 Coder patch implementing Preflight + AddonPlan + RepairPacket + Smoke tests.

## Focus Areas

### 1. Credit Decrement Correctness
- [ ] Credits NEVER decrement on intake submit
- [ ] Credits NEVER decrement on preflight run
- [ ] Credits ONLY decrement in `portal.requestChanges` when a loop is actually enqueued
- [ ] No race conditions that could double-decrement
- [ ] `validateIntakeCredits()` called before any credit operations

### 2. Preflight Gating Correctness
- [ ] NEVER enqueue expensive macro when status is NEEDS_INFO or BLOCKED
- [ ] PASS status is the ONLY condition that allows enqueue
- [ ] No bypass paths that skip preflight validation
- [ ] Preflight results stored in `ship_packets.data.preflight` correctly
- [ ] Idempotency: re-running preflight doesn't create duplicate jobs

### 3. Builder Gate Enforcement
- [ ] Builder access ONLY allowed for Premium tier
- [ ] Builder ONLY allowed on surfaces: `homepage_ui`, `landing_page_ui`, `pricing_ui`
- [ ] Builder FORBIDDEN from folders: `server/**`, `drizzle/**`, `scripts/**`, `package.json`, `.env`
- [ ] Allowed folders: `client/src/pages/**`, `client/src/components/marketing/**`, `client/src/styles/**`
- [ ] Builder constraints visible and auditable in preflight output

### 4. Minimal Intake Questions (No Bloat)
- [ ] Standard tier: only essentials (no addon questions)
- [ ] Growth tier: adds trust/proof + conversion (minimal)
- [ ] Premium tier: adds Builder readiness + addon readiness (minimal)
- [ ] Each question has clear "whyItMatters" explanation
- [ ] No 50-question forms
- [ ] Questions are tier-aware and addon-aware

### 5. File Logging + FailurePacket Completeness
- [ ] All logs written to files (not console.log)
- [ ] FailurePacket written on ANY exception in preflight/enqueue/executeRunPlan
- [ ] FailurePacket includes: runId, intakeId, step, errorName, errorMessage, stack, timestampIso, context
- [ ] Log files: `/tmp/launchbase_smoke.log`, `/tmp/launchbase_failures/<runId>.json`

### 6. Race Conditions / Double-Enqueue / Idempotency
- [ ] No race condition between preflight and enqueue
- [ ] No double-enqueue if user submits missing info twice quickly
- [ ] Idempotent: same intake → same preflight result
- [ ] Queue depth tracking correct

### 7. Security
- [ ] Portal endpoints properly authenticated (`protectedProcedure`)
- [ ] No secrets leaked in preflight output
- [ ] No SQL injection in intake field processing
- [ ] No XSS in repair questions (sanitized)
- [ ] OAuth tokens never stored in plaintext
- [ ] `submitMissingInfo` validates answers before updating intake

## Output Format

Return:

### Must Fix (Critical Issues)
- List each critical issue with:
  - File/line guidance
  - Exact code change needed
  - Why it's critical

### Should Fix (Quality/Edge Cases)
- List each quality issue with:
  - File/line guidance
  - Suggested improvement
  - Impact if not fixed

### Specific Code Changes
- Provide exact diffs or code snippets for each fix
- Prioritize by severity (critical first)

## Example Output Structure

```markdown
## Must Fix

### 1. Credits decremented on intake submit (CRITICAL)
**File:** `server/routers.ts` line 1125
**Issue:** `decrementIntakeCredit()` called before preflight check
**Fix:** Move credit decrement to AFTER preflight PASS check
**Code:**
\`\`\`diff
- await decrementIntakeCredit(intake.id, 1);
  const preflight = await runPreflight({ intake, tier });
+ if (preflight.validation.status === 'PASS') {
+   await decrementIntakeCredit(intake.id, 1);
+ }
\`\`\`

### 2. Builder gate not enforced (CRITICAL)
**File:** `server/ai/orchestration/runPreflight.ts` line 89
**Issue:** No check for forbidden folders
**Fix:** Add forbidden folder validation
**Code:**
\`\`\`typescript
const forbiddenFolders = ['server/', 'drizzle/', 'scripts/', 'package.json', '.env'];
if (tier === 'premium' && builderRequested) {
  // validate allowed surfaces only
}
\`\`\`

## Should Fix

### 1. Missing "whyItMatters" for some questions
**File:** `server/ai/orchestration/runPreflight.ts` line 145
**Issue:** Question "What's your monthly ad budget?" has no explanation
**Fix:** Add clear explanation
**Code:**
\`\`\`typescript
{
  key: 'adBudget',
  question: 'What's your monthly ad budget?',
  whyItMatters: 'We use this to set spending limits and prevent overspend.',
  requiredForAddons: ['ads_pack'],
}
\`\`\`
```
