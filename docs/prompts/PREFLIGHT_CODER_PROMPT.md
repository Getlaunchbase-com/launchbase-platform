# GPT-5.2 Coder Prompt: Intake Preflight Implementation

## System Instruction

You are a senior engineer implementing production-grade orchestration in a TypeScript/Drizzle/MySQL codebase. Produce drop-in code changes with minimal surface area, strong typing, defensive error handling, and deterministic behavior. Never rely on console logs (proxy may swallow); write file-based logs. Any failure must write a FailurePacket JSON artifact.

## Task

Implement an automated smoke/preflight + "ultimate smoke test" harness for LaunchBase.

## Goals

1. Add a deterministic Preflight/Intake Validation stage that runs on every intake before any expensive AI macro runs.

2. Preflight generates:
   - `IntakeValidationV1`
   - `AddonPlanV1` (tier-aware addons: email, call forwarding, auto social posts, email campaigns, Google Ads, QuickBooks OAuth, etc.)
   - `RepairPacketV1` (minimal missing questions + why each matters)

3. If Preflight != PASS, do NOT enqueue the creative macro, do NOT consume credits, set ShipPacket status to NEEDS_INFO (or keep DRAFT but include preflight.status) and send appropriate response payload for portal/email.

4. If PASS, create/keep RunPlan + ShipPacket and enqueue executeRunPlan normally.

5. Add a smoke-test runner that can run locally/CI: `pnpm smoke:e2e:intake` and `pnpm smoke:preflight`.

## Storage (Fast Path)

Store preflight outputs under `ship_packets.data.preflight` (no new DB tables). Keep it versioned.

## Required Deliverables

### A) Contracts (new file)

Create `server/contracts/preflight.ts` exporting zod schemas + TS types:

**IntakeValidationV1:**
- `status`: PASS | NEEDS_INFO | BLOCKED
- `tier`: standard | growth | premium
- `confidence`: 0..1
- `derived`: vertical, websiteStatus, audience, language, etc.
- `detectedCapabilities`: { hasWebsiteUrl?, hasBookingLink?, hasBrandColors?, ... }

**AddonPlanV1:**
- `addonsRequested`: string[]
- `addonsEligibleByTier`: record
- `integrationReadiness`: per addon: READY | NEEDS_OAUTH | NEEDS_ACCESS | NOT_APPLICABLE
- `recommendedAddons`: tier-aware

**RepairPacketV1:**
- `questions`: array of { key, question, whyItMatters, requiredForAddons?: string[], requiredForTier?: string[] }
- `minimal`: true (avoid long forms)

**FailurePacketV1 (shared):**
- `runId`, `intakeId`, `step`, `errorName`, `errorMessage`, `stack`, `timestampIso`, context snapshot

### B) Preflight runner (new file)

Create `server/ai/orchestration/runPreflight.ts`:

- **Input**: { intake, tier }
- **Output**: { validation, addonPlan, repairPacket }
- **Deterministic rules**: no LLM required.
- **Tier-aware question sets**:
  - Standard: only essentials for showroom + basic site plan
  - Growth: adds trust/proof + conversion questions
  - Premium: adds Builder readiness + design system questions + addon readiness

### C) Wiring into intakes.submit

In `server/routers.ts` in `intakes.submit`:

After `createIntake` returns intake (id, previewToken, etc.):

1. Derive tier (use existing `tierFromIntake()` default standard; allow override if promo/stripe indicates tier)
2. `runPreflight`
3. Create ShipPacket if not exists, store preflight into `ShipPacket.data.preflight`
4. If preflight PASS: continue to `runFieldGeneral` → `createRunPlan` → enqueue job
5. If not PASS: return success + intakeId + shipPacketId + repair questions (no enqueue)

### D) Portal endpoints

In `server/routers/portal.ts` (or portal router):

Add `portal.submitMissingInfo` mutation:
- **Input**: runId, answers map
- Update `intake.rawPayload` or a new `intake.additionalInfo` field (use existing rawPayload)
- Re-run preflight and update `ShipPacket.data.preflight`
- If PASS, enqueue run

Keep `requestChanges` and `approve` unchanged except ensure credits are only decremented in `requestChanges` and only when a loop is enqueued.

### E) File-based logging + FailurePacket artifacts

Create `server/utils/fileLog.ts`:
- `appendJsonLine(path, obj)`
- Use under `/tmp/launchbase_smoke.log` and `/tmp/launchbase_failures/<runId>.json`
- On any catch in preflight, runFieldGeneral wiring, enqueue, executeRunPlan: write FailurePacket.

### F) Smoke test harness (new scripts)

**Create `scripts/smoke/runSmokeIntakeE2E.ts`:**
- Creates 3 synthetic intakes (standard/growth/premium) using the same createIntake path or via tRPC call helper.
- For each intake:
  - Ensures ShipPacket exists
  - Ensures preflight stored
  - If PASS: ensures job enqueued marker written (or queue depth increments)
  - If NEEDS_INFO: ensures repair questions non-empty
- Output a CLI table and exit non-zero on any failure.

**Create `scripts/smoke/runSmokePreflight.ts`:**
- Runs preflight on synthetic inputs for each tier + each major addon combination (quickbooks, google ads, email automation, call forwarding).
- Ensures the question set is minimal but complete.

**Add package.json scripts:**
- `"smoke:preflight"`
- `"smoke:e2e:intake"`

## Builder Gate Rules (Must Enforce)

**Premium only, allowed surfaces:**
- `homepage_ui`, `landing_page_ui`, `pricing_ui`

**Allowed folders:**
- `client/src/pages/**`
- `client/src/components/marketing/**`
- `client/src/styles/**`

**Forbidden:**
- `server/**`
- `drizzle/**`
- `scripts/**`
- `package.json`
- `.env`

Include these constraints in preflight output so it's visible and auditable.

## Output Format

Return:

1. A short plan (files to add/change)
2. Full code diffs or full file contents for each new/changed file
3. Notes on how to run the smoke tests

**Do not leave TODOs for critical paths.**
