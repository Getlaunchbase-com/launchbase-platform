# GPT-5.2 CODER PROMPT

## SYSTEM
You are a senior engineer implementing production-grade orchestration in a TypeScript/Drizzle/MySQL codebase.
Produce drop-in code changes with minimal surface area, strong typing, defensive error handling, and deterministic behavior.
Never rely on console logs (proxy may swallow); use file-based logs. Any failure must write a FailurePacket JSON artifact.

## USER
Implement an automated preflight + "ultimate smoke test" harness for LaunchBase.

## GOALS
1) Add deterministic Preflight/Intake Validation that runs on every intake before any expensive AI macro runs.
2) Preflight generates:
   - IntakeValidationV1
   - AddonPlanV1 (tier-aware addons: email, call forwarding, auto social posts, email campaigns, Google Ads, QuickBooks OAuth)
   - RepairPacketV1 (minimal missing questions + why each matters)
3) If Preflight != PASS:
   - DO NOT enqueue creative macro
   - DO NOT consume credits
   - set ShipPacket status NEEDS_INFO (or keep DRAFT but include preflight.status)
   - return payload including repair questions
4) If PASS:
   - create/keep RunPlan + ShipPacket
   - enqueue executeRunPlan normally
5) Add smoke-test runner:
   - pnpm smoke:preflight
   - pnpm smoke:e2e:intake

## STORAGE
Store preflight outputs under ship_packets.data.preflight (no new DB tables). Version everything.

## DELIVERABLES

### A) Contracts (new file)
Create server/contracts/preflight.ts exporting zod schemas + TS types:
- IntakeValidationV1:
  - status: PASS | NEEDS_INFO | BLOCKED
  - tier: standard|growth|premium
  - confidence 0..1
  - derived: vertical, websiteStatus, audience, language
  - detectedCapabilities flags
- AddonPlanV1:
  - addonsRequested: string[]
  - addonsEligibleByTier: record
  - integrationReadiness per addon: READY|NEEDS_OAUTH|NEEDS_ACCESS|NOT_APPLICABLE
  - recommendedAddons tier-aware
- RepairPacketV1:
  - questions: [{ key, question, whyItMatters, requiredForAddons?, requiredForTier? }]
  - minimal=true
- FailurePacketV1 (shared):
  - runId, intakeId, step, errorName, errorMessage, stack, timestampIso, context snapshot

### B) Preflight runner (new file)
Create server/ai/orchestration/runPreflight.ts:
- Input: { intake, tier }
- Output: { validation, addonPlan, repairPacket }
- Deterministic rules only (NO LLM)
- Tier-aware question sets:
  - Standard: essentials for showroom + basic plan
  - Growth: adds trust/proof + conversion questions
  - Premium: adds Builder readiness + design system + addon readiness

### C) Wiring into intakes.submit
In server/routers.ts, intakes.submit:
- After createIntake:
  1) derive tier (existing tierFromIntake default standard; allow promo/stripe override if present)
  2) runPreflight
  3) create ShipPacket if not exists; store preflight under ShipPacket.data.preflight
  4) if PASS: continue runFieldGeneral → createRunPlan → enqueue job
  5) else: return success + ids + repair questions (NO enqueue)

### D) Portal endpoints
In server/routers/portal.ts:
- Add portal.submitMissingInfo mutation:
  - Input: runId, answers map
  - update intake.rawPayload (or existing additional info field)
  - re-run preflight and update ShipPacket.data.preflight
  - if PASS: enqueue run
Keep requestChanges/approve behavior; credits decrement only when a loop is enqueued.

### E) File-based logging + FailurePacket artifacts
Create server/utils/fileLog.ts:
- appendJsonLine(path, obj)
- write FailurePacket to /tmp/launchbase_failures/<runId>.json on any caught error
Use /tmp/launchbase_smoke.log for smoke runs.

### F) Smoke tests (new scripts)
Create scripts/smoke/runSmokePreflight.ts:
- Run preflight on synthetic inputs for each tier + each major addon combo:
  quickbooks, google ads, email automation, call forwarding
- Ensure question set minimal but sufficient.
Create scripts/smoke/runSmokeIntakeE2E.ts:
- Create 3 synthetic intakes (std/growth/premium) via same createIntake path or tRPC helper.
- Verify ShipPacket exists, preflight stored.
- If PASS: verify enqueue marker written
- If NEEDS_INFO: repair questions non-empty
Exit non-zero on any failure; print a CLI table.

## Builder gate rules must be enforced and exposed in preflight output:
- Premium only, surfaces: homepage_ui, landing_page_ui, pricing_ui
- Allowed folders: client/src/pages/**, client/src/components/marketing/**, client/src/styles/**
- Forbidden: server/**, drizzle/**, scripts/**, package.json, .env

## OUTPUT FORMAT
1) Short plan (files to add/change)
2) Full file contents for each new/changed file
3) How to run the smoke tests
No TODOs in critical paths.
