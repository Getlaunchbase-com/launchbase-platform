# Swarm Failure Analysis - 19 Failing Tests

**Current Test Status:** 551 passed / 19 failed / 32 skipped (96.7% pass rate)

**Goal:** Use swarm to push pass rate from 96.7% to 98%+ by applying mechanical-first ladder (Tier 0 → Tier 1 → Tier 2)

---

## Failure Inventory (19 tests)

### 1. **server/computePricing.test.ts** (3 failures)
- **Test:** "should override total to $300 when founder promo active"
  - **Error:** `expect(result.notes).toContain("Founder pricing: $300 flat setup for …")` - assertion mismatch
  - **Type:** Copy drift / string mismatch
  
- **Test:** "should count website as 1 service"
  - **Error:** `expected 2 to be 1` - service count logic mismatch
  - **Type:** Logic drift / calculation mismatch
  
- **Test:** "should count all selected services correctly"
  - **Error:** `expected 6 to be 5` - service count logic mismatch
  - **Type:** Logic drift / calculation mismatch

### 2. **server/email.test.ts** (4 failures)
- **Test:** "should generate intake confirmation email"
  - **Error:** `expected 'We\'re building your site from scratch…' to be '✅ We\'re building your website'`
  - **Type:** Copy drift / subject line mismatch
  
- **Test:** "should return default template for unknown type"
  - **Error:** `[emailCopy] Missing copy for language=en audience=biz emailType=unknown_type`
  - **Type:** Test expects fallback, code throws error (behavior change)
  
- **Test:** "should send email and return true on success"
  - **Error:** `No "getIntakeById" export is defined on the "./db" mock`
  - **Type:** Missing mock export
  
- **Test:** "should log email to database"
  - **Error:** `No "getIntakeById" export is defined on the "./db" mock`
  - **Type:** Missing mock export

### 3. **server/__tests__/facebook-mutations.policy.test.ts** (2 failures)
- **Test:** "should return DRAFT response and NOT call Facebook when approval is required"
  - **Error:** `expected undefined to be 'DRAFT'`
  - **Type:** Integration failure - policy logic not returning expected response
  
- **Test:** "should return QUEUE response with retryAt when outside business hours"
  - **Error:** `expected undefined to be 'QUEUE'`
  - **Type:** Integration failure - policy logic not returning expected response

### 4. **server/__tests__/template-versioning.test.ts** (2 failures)
- **Test:** "new deployment gets current template version"
  - **Error:** `Cannot create deployment: buildPlan 1 not found or has no plan`
  - **Type:** DB fixture issue - missing buildPlan
  
- **Test:** "existing deployment templateVersion is immutable"
  - **Error:** (Likely same as above)
  - **Type:** DB fixture issue

### 5. **server/actionRequests/aiTennisCopyRefine.test.ts** (1 failure)
- **Test:** "creates ActionRequest from CopyProposal.variants[0]"
  - **Error:** (Need to see full error)
  - **Type:** Unknown - likely schema/fixture mismatch

### 6. **server/emails/emailCopy.test.ts** (1 failure)
- **Test:** "should return Spanish 'existing' variant"
  - **Error:** (Likely copy mismatch or variant selection logic)
  - **Type:** Copy drift / multilingual variant issue

### 7. **server/__tests__/__meta__/modelRegistry.mock.test.ts** (1 failure)
- **Test:** "returns deterministic models"
  - **Error:** `TypeError: r.getModels is not a function`
  - **Type:** Missing mock method / API change

### 8. **server/ai/__tests__/promptPack.validation.test.ts** (4 failures)
- **Test:** "should produce valid decision_collapse JSON"
  - **Error:** (Likely schema validation failure)
  - **Type:** Fixture/schema drift
  
- **Test:** "should enforce needsHuman escalation path"
  - **Error:** (Likely schema validation failure)
  - **Type:** Fixture/schema drift
  
- **Test:** "should return deterministic JSON"
  - **Error:** (Likely schema validation failure)
  - **Type:** Fixture/schema drift
  
- **Test:** "should never make real API calls"
  - **Error:** (Likely schema validation failure)
  - **Type:** Fixture/schema drift

### 9. **server/ai/modelRouting/__tests__/modelPolicy.test.ts** (1 failure)
- **Test:** "filters by required features"
  - **Error:** (Need to see full error)
  - **Type:** Unknown - likely config/fixture issue

### 10. **Syntax errors in swarm gate tests** (5 failures)
- **Files:**
  - `server/ai/engine/__tests__/swarm.gate2.test.ts`
  - `server/ai/engine/__tests__/swarm.gate3.test.ts`
  - `server/ai/engine/__tests__/swarm.gate4.test.ts`
  - `server/ai/engine/__tests__/swarm.gate5.collapse.test.ts`
  - `server/ai/engine/__tests__/swarm.test.ts`
- **Error:** "Unterminated string literal"
- **Type:** Syntax error (likely from previous edits)

### 11. **server/__tests__/cron-alerts-auth.test.ts** (1 failure)
- **Error:** `ReferenceError: http is not defined`
- **Type:** Missing import

### 12. **server/__tests__/tenant-filtering.test.ts** (1 failure)
- **Error:** `Cannot create deployment: buildPlan 1 not found or has no plan`
- **Type:** DB fixture issue (same as template-versioning)

---

## Bucketing by Tier (for swarm ladder)

### **Tier 0 - Guaranteed Wins (1 iteration, should be APPLY)** - 8 tests
1. ✅ Email subject line mismatch (email.test.ts - intake confirmation)
2. ✅ Spanish email copy variant (emailCopy.test.ts)
3. ✅ Founder pricing notes assertion (computePricing.test.ts)
4. ✅ Missing mock export - getIntakeById (email.test.ts - 2 tests)
5. ✅ ModelRegistry mock - getModels method (modelRegistry.mock.test.ts)
6. ✅ Syntax errors in swarm gate tests (5 tests) - **DO MANUALLY FIRST**
7. ✅ Missing http import (cron-alerts-auth.test.ts)

**Constraints for Tier 0:**
- `mustNotChangeProductionCode: true`
- `allowedPaths: ["server/**/__tests__/**", "**/*.test.ts", "**/*.spec.ts", "**/__mocks__/**"]`
- `maxFilesChanged: 1`
- `maxLinesChanged: 20`
- `maxIterations: 1`

---

### **Tier 1 - Slightly Coupled (may need REVISE→APPLY)** - 6 tests
1. PromptPack validation fixtures (4 tests) - schema/fixture drift
2. Service count calculation (computePricing.test.ts - 2 tests) - logic drift
3. Email template fallback behavior (email.test.ts - unknown_type)

**Constraints for Tier 1:**
- `allowedPaths: ["server/**/__tests__/**", "**/*.test.ts", "**/__mocks__/**", "**/__fixtures__/**"]`
- `maxFilesChanged: 2`
- `maxLinesChanged: 60`
- `maxIterations: 2`

---

### **Tier 2 - Stop and Escalate** - 5 tests
1. Facebook policy integration (2 tests) - DRAFT/QUEUE response logic
2. Template versioning DB fixtures (2 tests) - buildPlan missing
3. Tenant filtering DB fixture (1 test) - buildPlan missing
4. ActionRequest creation (aiTennisCopyRefine.test.ts)
5. ModelPolicy feature filtering (modelPolicy.test.ts)

**Constraints for Tier 2:**
- Require craft to propose diagnosis + minimal reproduction
- Allow changes only in tests + mocks unless explicitly targeting a product bug
- Manual review required before applying

---

## Recommended Execution Order

1. **MANUAL FIX FIRST:** Syntax errors in swarm gate tests (5 tests) - unterminated string literals
2. **Tier 0 Batch 1:** Email copy drift (3 tests) - highest confidence
3. **Tier 0 Batch 2:** Missing mock exports (3 tests) - mechanical
4. **Tier 1:** PromptPack validation (4 tests) - schema drift
5. **Tier 1:** Service count logic (2 tests) - requires understanding business rules
6. **Tier 2:** DB fixture issues (3 tests) - requires buildPlan setup
7. **Tier 2:** Integration failures (2 tests) - policy logic review

---

## ROI Tracking Fields (per swarm run)

- `bucketId`: e.g., "tier0_email_copy_drift"
- `filesChanged`: number
- `linesChanged`: number
- `iterations`: 1 or 2
- `outcome`: "apply" | "needs_human" | "reject"
- `timeSeconds`: swarm execution time
- `testsBefore`: 19
- `testsAfter`: e.g., 16 (if 3 fixed)
- `humanMinutesSavedEstimate`: e.g., 15 (rough estimate)

---

## Next Steps

1. Fix syntax errors manually (swarm gate tests)
2. Generate FailurePackets for Tier 0 batch 1 (email copy drift)
3. Run swarm with Tier 0 constraints
4. Measure ROI and iterate
