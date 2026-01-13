# Real Workflow Test — AI Tennis End-to-End Validation

**Purpose:** Prove that AI Tennis runs end-to-end, writes `rawInbound.aiTennis` to the database, and populates the weekly report with non-N/A metrics.

**Status:** ⛔ **BLOCKED** - Model router cannot find eligible models for `task=json`

**Last Updated:** January 13, 2026

---

## Current Blocker

**Error:**
```
[AI] ModelRouter failed {
  task: 'json',
  error: 'No eligible models for task=json constraints={"type":"text","requiredFeatures":["json_schema","structured_outputs"],"minContextLength":16000,"preferPinned":true}'
}
```

**Root Cause:**
The ModelRegistry either:
1. Hasn't loaded models from AIML API yet
2. Loaded models don't have `json_schema` + `structured_outputs` features marked
3. `preferPinned: true` filter is too restrictive (no pinned models with required features)

**Required Fix:**
- Verify `AIML_API_KEY` is valid and can fetch model list
- Check ModelRegistry refresh logic
- Verify AIML API returns models with `features: ["json_schema", "structured_outputs"]`
- Consider relaxing `preferPinned: true` constraint for `task=json`

---

## Pre-Flight Checklist

Before running the real workflow test, confirm:

- [ ] Environment is **staging** or **development** (not production)
- [ ] `AI_PROVIDER` is set (check with `echo $AI_PROVIDER`)
- [ ] `AIML_API_KEY` is present (check with `env | grep AIML`)
- [ ] You have an **existing intakeId** in the database (do NOT create a new one)
- [ ] ModelRegistry can fetch models from AIML (run `pnpm tsx scripts/checkModels.ts`)
- [ ] At least one model passes `task=json` constraints

---

## Step-by-Step Workflow

### Step 1: Find Existing Intake

**SQL Query:**
```sql
SELECT id, businessName, email, tenant, status, createdAt
FROM intakes
WHERE tenant = 'launchbase'
ORDER BY createdAt DESC
LIMIT 1;
```

**Expected Output:**
```
id: 1
businessName: "Test Business"
tenant: "launchbase"
status: "new"
```

**Action:** Note the `intakeId` for Step 2.

---

### Step 2: Trigger AI Tennis Copy Refinement

**Method 1: Using Test Script**

```bash
cd /home/ubuntu/launchbase
pnpm tsx scripts/testRealWorkflow.ts
```

**Method 2: Using tRPC Route (via curl)**

```bash
curl -X POST https://your-staging-url.com/api/trpc/aiCopyRefine.refine \
  -H "Content-Type: application/json" \
  -d '{
    "intakeId": 1,
    "userText": "Rewrite the homepage hero headline + subheadline to be clearer and more conversion-focused. Keep it confident, not hype. Provide rationale + risks.",
    "targetSection": "hero",
    "constraints": {
      "maxRounds": 2,
      "costCapUsd": 1.5
    }
  }'
```

**Method 3: Using Node Script**

```typescript
import { aiTennisCopyRefine } from "./server/actionRequests/aiTennisCopyRefine";

const result = await aiTennisCopyRefine(
  {
    tenant: "launchbase",
    intakeId: 1,
    userText: "Rewrite the homepage hero headline + subheadline to be clearer and more conversion-focused. Keep it confident, not hype. Provide rationale + risks.",
    targetSection: "hero",
    constraints: {
      maxRounds: 2,
      costCapUsd: 1.5,
    },
  },
  "aiml" // Use real AIML provider, NOT memory
);

console.log("Result:", result);
```

**Expected Success Output:**
```json
{
  "success": true,
  "actionRequestId": 123,
  "traceId": "ai-copy-1736726400000",
  "stopReason": "ok",
  "meta": {
    "rounds": 2,
    "estimatedUsd": 0.15,
    "calls": 3,
    "models": ["gpt-4o-mini-2024-07-18"]
  }
}
```

**Failure Modes:**

| stopReason | Meaning | Action |
|------------|---------|--------|
| `needs_human` | AI Tennis escalated to human review | Check logs for why (model failure, schema validation, confidence too low) |
| `no_selected_proposal` | decision_collapse didn't return selectedProposal | Check AI Tennis output shape |
| `invalid_selected_proposal` | selectedProposal missing required fields | Check schema validation logic |
| `ai_tennis_failed` | AI Tennis threw an error | Check provider logs (do NOT log prompts) |
| `action_request_create_failed` | DB write failed | Check database connection |

---

### Step 3: Verify DB Write

**SQL Query:**
```sql
SELECT 
  id,
  intakeId,
  status,
  JSON_EXTRACT(rawInbound, '$.source') AS source,
  JSON_EXTRACT(rawInbound, '$.aiTennis.traceId') AS traceId,
  JSON_EXTRACT(rawInbound, '$.aiTennis.stopReason') AS stopReason,
  JSON_EXTRACT(rawInbound, '$.aiTennis.needsHuman') AS needsHuman,
  JSON_EXTRACT(rawInbound, '$.aiTennis.costUsd') AS costUsd,
  JSON_EXTRACT(rawInbound, '$.aiTennis.rounds') AS rounds,
  JSON_EXTRACT(rawInbound, '$.proposal.targetKey') AS targetKey,
  JSON_EXTRACT(rawInbound, '$.proposal.value') AS proposalValue,
  createdAt
FROM action_requests
WHERE intakeId = 1
ORDER BY createdAt DESC
LIMIT 1;
```

**Required Fields (Must Be Present):**

```json
{
  "source": "ai_tennis",
  "aiTennis": {
    "traceId": "ai-copy-1736726400000",
    "jobId": "ai-copy-1736726400000",
    "rounds": 2,
    "models": ["gpt-4o-mini-2024-07-18"],
    "requestIds": ["req_abc123", "req_def456"],
    "usage": {
      "inputTokens": 1500,
      "outputTokens": 300
    },
    "costUsd": 0.15,
    "stopReason": "completed",
    "needsHuman": false
  },
  "proposal": {
    "targetKey": "hero.headline",
    "value": "Transform Your Business with AI",
    "rationale": "Clear value proposition",
    "confidence": 0.9,
    "risks": [],
    "assumptions": []
  }
}
```

**Security Verification (Must NOT Be Present):**
- ❌ No prompts (user input or system prompts)
- ❌ No provider raw errors
- ❌ No stack traces
- ❌ No customer PII beyond what's in the intake

---

### Step 4: Run Weekly Report

**Command:**
```bash
cd /home/ubuntu/launchbase
pnpm tsx scripts/generateWeeklyAiReport.ts
```

**Expected Output:**
```
[Weekly Report] Generating report for 2026-01-13...
[Weekly Report] Environment: development
[Weekly Report] Running query: stopReasonDistribution...
[Weekly Report] Running query: needsHumanRateCurrent...
[Weekly Report] Running query: needsHumanRatePrior...
[Weekly Report] Running query: costPerApproval...
[Weekly Report] Running query: approvalRateCurrent...
[Weekly Report] Running query: approvalRatePrior...
[Weekly Report] Running query: cacheHitRateCurrent...
[Weekly Report] Running query: cacheHitRatePrior...
[Weekly Report] Running query: staleTakeoverRateCurrent...
[Weekly Report] Running query: staleTakeoverRatePrior...
✅ [Weekly Report] Report generated: reports/ai_weekly_2026-01-13.md
```

**Verify Report Sections:**

Open `reports/ai_weekly_2026-01-13.md` and confirm:

1. **stopReason Distribution** - Shows at least 1 row with `completed` or other stopReason
2. **needsHuman Rate** - Shows **numeric value** (0.0% or higher), NOT "N/A"
3. **Cost per Approval** - Shows **$0.000 or higher**, NOT "N/A"
4. **Approval Rate** - Shows **numeric value**, NOT "N/A"
5. **Cache Hit Rate** - Shows **0.0%** (first run, no cache), NOT "N/A"
6. **Stale Takeover Rate** - Shows **0.0%** (first run, no stale), NOT "N/A"

**What Good Looks Like:**

```markdown
## 1️⃣ StopReason Distribution (Drift Canary)

| stopReason | count | pct | WoW Δ | Flag |
| --- | --- | --- | --- | --- |
| completed | 1 | 100.0% | N/A | ✅ |

## 2️⃣ needsHuman Rate (Protocol Mismatch Detector)

| period | This Week | WoW Δ | Flag |
| --- | --- | --- | --- |
| 7-day | 0.0% | N/A | ✅ |

## 3️⃣ Cost per Approval (Efficiency Index)

| tenant | 7-day avg USD | 30-day avg USD | WoW Δ | Flag |
| --- | --- | --- | --- | --- |
| launchbase | $0.150 | $0.150 | N/A | ✅ |
```

**What Bad Looks Like (Still Blocked):**

```markdown
> ⚠️ **No AI Tennis proposals found for this period.**

## 2️⃣ needsHuman Rate (Protocol Mismatch Detector)

| period | This Week | WoW Δ | Flag |
| --- | --- | --- | --- |
| 7-day | N/A | N/A | — |
```

---

## Definition of Done (PR 2)

**Checklist:**

- [ ] One real AI Tennis run completed with `success: true`
- [ ] ActionRequest created with `rawInbound.source = "ai_tennis"`
- [ ] All required `rawInbound.aiTennis.*` fields present
- [ ] All required `rawInbound.proposal.*` fields present
- [ ] No prompts, provider errors, or stack traces in `rawInbound`
- [ ] Weekly report shows **non-N/A** values for all 6 metrics
- [ ] Report committed to `reports/ai_weekly_<date>.md`

**PR Description Template:**

```markdown
## PR 2: Real Workflow Test Complete

**Input:**
- intakeId: 1
- userText: "Rewrite the homepage hero headline..."
- targetSection: "hero"
- constraints: { maxRounds: 2, costCapUsd: 1.5 }

**Output:**
- actionRequestId: 123
- traceId: ai-copy-1736726400000
- stopReason: ok
- rounds: 2
- costUsd: $0.15

**DB Verification:**
```json
{
  "source": "ai_tennis",
  "aiTennis": { ... },
  "proposal": { ... }
}
```

**Weekly Report:**
- File: `reports/ai_weekly_2026-01-13.md`
- All metrics show non-N/A values
- stopReason distribution: 1 completed
- needsHuman rate: 0.0%
- Cost per approval: $0.150
```

---

## Troubleshooting

### Issue: `needsHuman: true` returned

**Possible Causes:**
1. Provider isn't actually running (memory/log transport slipping in)
2. ModelRouter can't pick a model, so orchestration fails
3. Schema validation fails on the first step

**Debug Steps:**
1. Check logs for `[AI] ModelRouter failed` messages
2. Verify `AI_PROVIDER` environment variable
3. Run `pnpm tsx scripts/checkModels.ts` to see eligible models
4. Check if AIML API key is valid

### Issue: `actionRequestId: undefined`

**Cause:** AI Tennis returned early failure (before creating ActionRequest)

**Debug Steps:**
1. Check `stopReason` in result
2. Look for error logs (do NOT log prompts)
3. Verify DB connection is working

### Issue: Weekly report still shows N/A

**Cause:** ActionRequest was created but `rawInbound.source !== "ai_tennis"`

**Debug Steps:**
1. Query `action_requests` table and check `rawInbound.source`
2. Verify `aiTennisCopyRefine` is calling `buildAiTennisMeta()`
3. Check if `createActionRequest` is properly setting `rawInbound`

---

## Next Steps After PR 2

Once PR 2 is complete (real data flowing):

1. **PR 3:** Cost-per-Approval WoW Delta (dollar delta calculation)
2. **PR 4:** Weekly Ritual Setup (human-governed learning loop)
3. **PR 5:** Showrooms Repo Structure (4 tier websites in GitHub)
4. **PR 6:** Swarm Protocol (Field General + Specialists with audit trail)

---

**Contract Owner:** LaunchBase Engineering  
**Last Reviewed:** January 13, 2026  
**Next Review:** After model router fix
