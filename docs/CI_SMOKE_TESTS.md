# CI Smoke Tests

## Overview

Automated smoke tests run on every push, PR, and nightly to validate the LaunchBase preflight system and intake flow.

## Test Suites

### 1. Preflight Validation (`pnpm smoke:preflight`)
- **Coverage**: 30 test cases (3 tiers × 10 addon combinations)
- **Runtime**: ~2 seconds
- **What it tests**:
  - Tier-aware validation rules (standard/growth/premium)
  - Addon eligibility by tier
  - Integration readiness detection
  - Minimal question generation

### 2. E2E Intake Flow (`pnpm smoke:e2e:intake`)
- **Coverage**: 3 test cases (standard/growth/premium tiers)
- **Runtime**: ~3 seconds
- **What it tests**:
  - Full intake creation flow
  - Preflight execution and storage
  - ShipPacket creation with preflight data
  - PASS vs NEEDS_INFO status transitions

## CI Workflow

**Triggers:**
- Push to `main`
- Pull requests to `main`
- Nightly at 2 AM UTC
- Manual dispatch

**Steps:**
1. Checkout code
2. Setup Node.js 22 + pnpm
3. Install dependencies
4. Run `pnpm smoke:preflight`
5. Run `pnpm smoke:e2e:intake`
6. Upload failure artifacts (if any)

## Failure Artifacts

When tests fail, artifacts are saved to:
```
runs/smoke/<runId>/
  ├── failurePacket.json    # Structured error info
  ├── swarm_trace.jsonl     # Agent claims (future)
  └── scorecard.json        # Grading report (future)
```

**GitHub Actions**: Artifacts are uploaded with 7-day retention and can be downloaded from the workflow run page.

**Local Development**: Check `runs/smoke/` directory after test failures.

## Running Locally

```bash
# Run all smoke tests
pnpm smoke:preflight
pnpm smoke:e2e:intake

# Run specific test
tsx scripts/smoke/runSmokePreflight.mjs
tsx scripts/smoke/runSmokeIntakeE2E.mjs
```

## Adding New Tests

1. Create test file in `scripts/smoke/`
2. Add script to `package.json` (e.g., `smoke:new-feature`)
3. Update `.github/workflows/smoke-tests.yml` to include new test
4. Update this documentation

## Troubleshooting

### Test fails locally but passes in CI
- Check DATABASE_URL environment variable
- Ensure all dependencies are installed (`pnpm install`)
- Check for stale data in local database

### Failure artifacts not generated
- Verify `runs/smoke/` directory is writable
- Check that `writeFailurePacket()` is called in catch blocks
- Ensure `runs/` is in `.gitignore` (artifacts should not be committed)

### CI workflow not triggering
- Check GitHub Actions is enabled for the repository
- Verify workflow file syntax with `yamllint .github/workflows/smoke-tests.yml`
- Check branch protection rules don't block workflow runs

## Future Enhancements

- [ ] Swarm trace logging (track AI agent claims)
- [ ] Scorecard generation (grade agent accuracy)
- [ ] Automated diagnosis swarm on failure
- [ ] Performance regression detection
- [ ] Integration with Stripe/OAuth test environments
