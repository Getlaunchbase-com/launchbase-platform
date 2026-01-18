# LaunchBase Swarm Prompts

This directory contains the exact prompts for running the **Build Swarm Automation** (Coder → Reviewer → Arbiter loop) to implement the Intake Preflight system.

## Files

1. **`PREFLIGHT_CODER_PROMPT.md`** - GPT-5.2 Coder (primary implementer)
2. **`PREFLIGHT_CLAUDE_REVIEWER_PROMPT.md`** - Claude Sonnet (adversarial reviewer)
3. **`PREFLIGHT_ARBITER_PROMPT.md`** - GPT-5.2 Arbiter (merger + grader)

## How to Use

### Option 1: Manual Execution (Copy/Paste)

1. **Run Coder:**
   - Copy entire content of `PREFLIGHT_CODER_PROMPT.md`
   - Paste to GPT-5.2 in a new conversation
   - Save output as `coder_patch.md`

2. **Run Reviewer:**
   - Copy entire content of `PREFLIGHT_CLAUDE_REVIEWER_PROMPT.md`
   - Paste to Claude Sonnet in a new conversation
   - Include the `coder_patch.md` output
   - Save output as `claude_review.md`

3. **Run Arbiter:**
   - Copy entire content of `PREFLIGHT_ARBITER_PROMPT.md`
   - Paste to GPT-5.2 in a new conversation
   - Include both `coder_patch.md` and `claude_review.md`
   - Save output as `final_patch.md`

4. **Apply Patch:**
   - Follow the "How to Run" checklist in `final_patch.md`
   - Run smoke tests to validate

### Option 2: Automated via Manus (Future)

Tell Manus:

> "Use GPT-5.2 Coder to implement preflight + smoke harness per prompt in `docs/swarm_prompts/PREFLIGHT_CODER_PROMPT.md`; then Claude reviews using `PREFLIGHT_CLAUDE_REVIEWER_PROMPT.md`; then GPT-5.2 Arbiter merges using `PREFLIGHT_ARBITER_PROMPT.md` and outputs final patch + grading."

## Implementation Decisions

**Storage:** Store preflight data in `ship_packets.data.preflight` (no new tables)

**CLI Tests:** Place in `scripts/smoke/` (consolidate with existing smoke tests)

**Tier Packaging:**
- **Standard (Polish Pass)**: 1 loop, credible site + clear CTA + basic trust
- **Growth (Conversion Pass)**: 3 loops, proof blocks + funnel clarity + lead capture
- **Premium (Automation Pass)**: 10 loops, Builder UI + integrations + workflows

**Add-On Engines:**
- Inbox Engine (email + SMS follow-up)
- Phone Engine (call forwarding + missed-call capture)
- Social Engine (auto-post 2-5x/week)
- Ads Engine (Google Ads setup + reporting)
- Books Engine (QuickBooks invoices + sync)

**Add-On Packs:**
- Comms Pack = Inbox + Phone
- Marketing Pack = Social + email campaigns
- Ads Pack = Ads Engine
- Ops Pack = Books Engine

## Hard Gates (Must Pass)

- [ ] No expensive swarm run if preflight != PASS
- [ ] Credits never decrement on intake submit
- [ ] BuilderGate never allows server/db/auth folders
- [ ] Repair questions are tier-aware and addon-aware
- [ ] All outputs are schema-valid JSON

## Soft Gates (Quality)

- [ ] Questions are minimal (no 50-question forms)
- [ ] Clear "whyItMatters" per question
- [ ] Good default tier suggestions

## Expected Deliverables

After running the full swarm loop, you should have:

1. ✅ **Contracts** (`server/contracts/preflight.ts`)
   - IntakeValidationV1
   - AddonPlanV1
   - RepairPacketV1
   - GoNoGoDecisionV1
   - FailurePacketV1

2. ✅ **Preflight Runner** (`server/ai/orchestration/runPreflight.ts`)
   - Deterministic validation (no LLM)
   - Tier-aware question sets
   - Addon readiness checks

3. ✅ **Wiring** (`server/routers.ts`)
   - Preflight runs on every intake submit
   - Enqueue only on PASS
   - Credits never decremented on submit

4. ✅ **Portal Endpoints** (`server/routers/portal.ts`)
   - `portal.submitMissingInfo` (re-run preflight)
   - `portal.requestChanges` (unchanged, credits on enqueue)
   - `portal.approve` (unchanged, no credits)

5. ✅ **File Logging** (`server/utils/fileLog.ts`)
   - `/tmp/launchbase_smoke.log`
   - `/tmp/launchbase_failures/<runId>.json`

6. ✅ **Smoke Tests** (`scripts/smoke/`)
   - `runSmokeIntakeE2E.ts` (3 tiers end-to-end)
   - `runSmokePreflight.ts` (tier + addon combinations)

7. ✅ **Package Scripts** (`package.json`)
   - `pnpm smoke:preflight`
   - `pnpm smoke:e2e:intake`

## Next Steps After Implementation

1. Run smoke tests: `pnpm smoke:preflight && pnpm smoke:e2e:intake`
2. Manual testing via portal
3. Save checkpoint
4. Add to CI/CD pipeline
5. Monitor preflight metrics (PASS rate, NEEDS_INFO rate, question count)
