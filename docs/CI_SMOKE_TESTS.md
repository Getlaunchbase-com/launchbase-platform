# CI Smoke Tests

This document describes the automated smoke test system for LaunchBase.

## Overview

The smoke test suite validates core functionality:
- **Preflight validation**: Tier-aware intake validation (30 test cases)
- **E2E intake flow**: Complete intake submission flow (3 test cases)

## Running Locally

```bash
# Run all smoke tests
pnpm smoke:preflight && pnpm smoke:e2e:intake

# Run individual suites
pnpm smoke:preflight
pnpm smoke:e2e:intake
```

## CI Integration

Tests run automatically on:
- Push to `main`
- Pull requests
- Nightly at 2 AM UTC
- Manual workflow dispatch

## Failure Artifacts

On failure, test artifacts are saved to `runs/smoke/<runId>/failurePacket.json` and uploaded to GitHub Actions artifacts (7-day retention).

## Adding New Tests

1. Create test file in `scripts/smoke/`
2. Add script to `package.json`
3. Update CI workflow to include new test
4. Document test purpose in this file
