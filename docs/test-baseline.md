# Test Baseline - Post Stripe Webhook Fixes

**Date:** 2026-01-19 20:00 UTC  
**Checkpoint:** bbae633d  
**Command:** `pnpm test`

## Summary

- **Test Files:** 19 failed | 46 passed | 3 skipped (68 total)
- **Tests:** 89 failed | 463 passed | 32 skipped (584 total)
- **Duration:** 45.72s
- **Pass Rate:** 79.3% (463/584)

## Top Failure Buckets (by count)

### 1. Email Copy Missing Parameters (9 failures)
**Error:** `[emailCopy] Missing copy for language=undefined audience=undefined emailType=undefined`  
**Files:** `server/emails/emailCopy.test.ts`  
**Root Cause:** Test not passing required parameters to getEmailCopy()  
**Fix Type:** Test harness bug (cheap fix)

### 2. Boolean Assertion Failures (12 failures)
**Error:** `expected undefined/false to be true // Object.is equality`  
**Files:** Various (promptPack validation, modelPolicy, etc.)  
**Root Cause:** Missing fixtures or schema validation failures  
**Fix Type:** Mock gaps / determinism issues

### 3. app.address is not a function (5 failures)
**Error:** `TypeError: app.address is not a function`  
**Files:** `server/api-routing-guardrails.test.ts`  
**Root Cause:** Test calling app.address() on Express app without server.listen()  
**Fix Type:** Test harness bug (same pattern as Stripe webhook fix)

### 4. Transform failed with 1 error (5 failures)
**Error:** `Transform failed with 1 error:`  
**Files:** Build/compilation errors  
**Root Cause:** Likely esbuild or TypeScript compilation issues  
**Fix Type:** Build configuration

### 5. Cannot create deployment (3 failures)
**Error:** `Cannot create deployment: buildPlan X not found or has no plan`  
**Files:** Deployment tests  
**Root Cause:** Missing test fixtures  
**Fix Type:** Mock gaps

### 6. Missing mock exports (2 failures)
**Error:** `No "getIntakeById" export is defined on the "./db" mock`  
**Files:** Tests with vi.mock()  
**Root Cause:** Incomplete mock definitions  
**Fix Type:** Mock gaps

## Recommended Fix Order

1. **app.address failures (5 tests)** - Same pattern as Stripe webhook fix, mechanical
2. **Email copy missing parameters (9 tests)** - Test harness bug, pass correct params
3. **Missing mock exports (2 tests)** - Add missing exports to vi.mock()
4. **Cannot create deployment (3 tests)** - Add missing fixtures
5. **Boolean assertion failures (12 tests)** - Requires triage by file

## Network-Gated Tests

26 tests properly skipped (ALLOW_NETWORK_TESTS not set)

## Notes

- Stripe webhook tests: 4/4 passing ✅
- TypeCheck: 0 errors ✅ (4 stale LSP errors in swarmRunner.ts)
- All fixes should maintain 100% type safety
