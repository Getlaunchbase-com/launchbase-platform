# LaunchBase Preflight System - Complete Backup
**Created:** 2026-01-17 18:31 UTC
**Status:** All 33 tests passing (30 preflight + 3 E2E)

## Files Included

### Core Preflight System
- `server/contracts/preflight.ts` - Zod schemas (IntakeValidationV1, AddonPlanV1, RepairPacketV1, FailurePacketV1, PreflightResultV1)
- `server/ai/orchestration/runPreflight.ts` - Deterministic preflight runner (tier-aware, no LLM)
- `server/utils/fileLog.ts` - File logging + FailurePacket writer with deterministic paths

### Credits System
- `server/db-helpers.ts` - getDefaultIntakeCredits(), validateIntakeCredits()

### Smoke Tests
- `scripts/smoke/runSmokePreflight.mjs` - 30 test cases (all tier + addon combinations)
- `scripts/smoke/runSmokeIntakeE2E.mjs` - 3 E2E intake flow tests
- `scripts/smoke/smokeCreditsInit.mjs` - Credits initialization test
- `scripts/smoke/smokeCreditsConsumption.mjs` - Credits consumption test (10 loops)
- `scripts/smoke/smokePortalMutations.mjs` - Portal mutations test

### Swarm Infrastructure
- `scripts/swarm/prompts/coder_gpt52.md` - GPT-5.2 Coder prompt
- `scripts/swarm/prompts/reviewer_claude.md` - Claude Reviewer prompt
- `scripts/swarm/prompts/arbiter_gpt52.md` - GPT-5.2 Arbiter prompt
- `scripts/swarm/contracts/SwarmTraceV1.json` - Swarm trace contract
- `scripts/swarm/contracts/SwarmScorecardV1.json` - Swarm scorecard contract
- `scripts/swarm/contracts/FailurePacketV1.json` - Failure packet contract

### Documentation
- `docs/swarm_prompts/PREFLIGHT_CODER_PROMPT.md` - Complete implementation spec
- `docs/swarm_prompts/PREFLIGHT_CLAUDE_REVIEWER_PROMPT.md` - Adversarial review spec
- `docs/swarm_prompts/PREFLIGHT_ARBITER_PROMPT.md` - Merger + grader spec
- `docs/swarm_prompts/README.md` - Usage instructions
- `docs/CI_SMOKE_TESTS.md` - CI documentation
- `docs/UNIVERSAL_SMOKE_HARNESS.md` - Universal smoke harness pattern

### CI/CD
- `.github/workflows/smoke-tests.yml` - GitHub Actions workflow

### Project Files
- `todo.md` - Complete task tracking with Phase 3, 3.5, 4
- `package.json` - Updated with smoke test scripts

## Installation Instructions

1. Extract archive:
   ```bash
   tar -xzf launchbase-preflight-system-backup.tar.gz
   ```

2. Copy files to your launchbase project (preserves directory structure)

3. Install dependencies (if not already installed):
   ```bash
   pnpm install
   ```

4. Run smoke tests:
   ```bash
   pnpm smoke:preflight
   pnpm smoke:e2e:intake
   ```

## Test Results (Last Run)
- ✅ 30/30 preflight tests passed
- ✅ 3/3 E2E intake tests passed
- ✅ Credits initialization: Standard (1/1/0), Growth (3/3/0), Premium (10/10/0)
- ✅ Portal mutations: requestChanges + approve working

## Next Steps
1. Wire preflight into `server/routers.ts` intakes.submit
2. Add `portal.submitMissingInfo` mutation
3. Build swarm automation runner (`scripts/swarm/runSwarmFix.ts`)
