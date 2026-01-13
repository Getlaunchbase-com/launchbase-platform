# LaunchBase TODO

**Status:** 🟢 Phase 1.1 Finish + Freeze  
**Version:** e8fbc539  
**Last Updated:** January 13, 2026

> **📖 See WHERE_WE_ARE.md for complete status report and vision**

---

## 🔒 CONSTITUTIONAL LAYER (FROZEN - v1.0)

**These documents are now governance, not code. Changes require versioning + architectural review.**

### ✅ Forever Contracts (COMPLETE - FROZEN)
- [x] `docs/FOREVER_CONTRACTS.md` - 7 constitutional guarantees
  - Contract 1: Prompt Immutability
  - Contract 2: Schema-or-Fail Output
  - Contract 3: stopReason Is the Sole Outcome Signal
  - Contract 4: Two-Trail Audit Model (internal vs customer)
  - Contract 5: Determinism Over Creativity
  - Contract 6: Idempotency Is Mandatory
  - Contract 7: No Silent Failure

### ✅ AI Drift Protocol (COMPLETE - FROZEN)
- [x] `docs/AI_DRIFT_PROTOCOL_V1.md` - Operational discipline
  - Drift definition and detection rules
  - 4 containment layers (determinism, idempotency, visibility, escalation)
  - 4 required signals (cost, approval rate, needsHuman, stopReason)
  - Weekly review cadence
  - Field General governance rules
  - Learning extraction loop

### ✅ Canonical Metrics Queries (COMPLETE - FROZEN)
- [x] `docs/AI_METRICS_QUERIES.md` - Single source of truth for all drift metrics
  - Base CTE: `ai_proposals` (shared across all queries)
  - Query 1: stopReason Distribution (drift canary)
  - Query 2: needsHuman Rate (protocol mismatch detector)
  - Query 3: Cost per Approval (efficiency index)
  - Query 4: Approval Rate (business friction signal)
  - Query 5: Cache Hit Rate (idempotency health)
  - Query 6: Stale Takeover Rate (stability detector)

### ✅ Test Suite Guarantees (Continuously Verified)
- [x] 26 tests passing (18 idempotency + 8 router)
- [x] 4 constitutional tests passing (AI Tennis extraction + needsHuman)
- [x] No silent AI drift (every deviation produces stopReason)
- [x] No cost amplification (retry storms mathematically impossible)
- [x] No prompt/data leakage (verified by tests + grep)
- [x] Deterministic learning surface (same inputs → same outputs or cached)

### ✅ WoW Delta Implementation (COMPLETE)
- [x] Canonical helpers: `deltaPct()`, `flagHighNumber()`, `toDollarsPerApproval()`, `getWindows()`
- [x] SQL queries refactored to return numerator/denominator pairs
- [x] Current/prior window query pairs for all 4 rate metrics
- [x] Renderers use `toRate()` + `deltaPct()` + canonical flag helpers
- [x] Report generation tested: correct N/A behavior on empty data
- [x] Documentation: `docs/CHANGELOG_WOW_DELTAS.md`

---

## 🚀 PHASE 1.1: FINISH + FREEZE

**Goal:** Lock the weekly report contract and validate with real data  
**Mode:** Read-only, no writes, no dashboards, no interpretation  
**Rule:** Observe only. No behavior changes. No auto-tuning.

### PR 1: Weekly Report Contract Freeze ✅ COMPLETE

**Goal:** Lock markdown section order + headings so they can't drift

**Tasks:**
- [x] Create `docs/AI_WEEKLY_REPORT_CONTRACT.md` with:
  - Frozen section order (1-6 + Summary)
  - Frozen metric names (stopReason, needsHuman, costPerApproval, approvalRate, cacheHit, staleTakeover)
  - Frozen denominator rules (N/A when denominator = 0)
  - Frozen flag rules (warn/critical thresholds)
  - Frozen output path (`reports/ai_weekly_<YYYY-MM-DD>.md`)
  - Frozen data source (action_requests.rawInbound.aiTennis)
  - Frozen JSON paths ($.aiTennis.*)
  - Security/redaction rules (no prompts, no provider payloads, no PII)
- [x] Add contract version number (v1.0)
- [x] Add "Changes require versioning + architectural review" clause
- [x] Add change policy (patch/minor/major version semantics)
- [x] Add changelog section
- [x] Link to AI_DRIFT_PROTOCOL_V1.md and AI_METRICS_QUERIES.md

**Definition of Done:**
- ✅ Contract doc committed
- ✅ No code behavior changes required
- ✅ Boring PR (contract-only)

---

### PR 2: Real Workflow Test in Staging ⛔ BLOCKED

**Goal:** Produce one real AI Tennis proposal end-to-end and confirm it shows up in the weekly report

**Status:** ⛔ **BLOCKED** - Model router cannot find eligible models for `task=json`

**Blocker Details:**
- Error: "No eligible models for task=json constraints={type:text, requiredFeatures:[json_schema,structured_outputs], minContextLength:16000, preferPinned:true}"
- Root cause: ModelRegistry either hasn't loaded models from AIML, or loaded models don't have required features, or `preferPinned:true` is too restrictive
- Required fix: Verify AIML_API_KEY, check ModelRegistry refresh logic, verify AIML API returns models with required features

**Tasks:**
- [x] Create `docs/REAL_WORKFLOW_TEST.md` with:
  - Pre-flight checklist (env vars, existing intake, model availability)
  - Step-by-step workflow (find intake, trigger AI Tennis, verify DB, run report)
  - Expected DB fields: `rawInbound.source="ai_tennis"`, `rawInbound.aiTennis.*`, `rawInbound.proposal.*`
  - "What good looks like" (non-N/A metrics, sample report sections)
  - Troubleshooting guide (needsHuman, model routing, N/A persistence)
  - Definition of Done checklist

**Gate A: Debug Model Router Hang** ✅ COMPLETE
- [x] Fixed feature normalization (array + object support)
- [x] Added feature alias mapping (json_schema → openai/chat-completion.response-format)
- [x] Fixed type mismatch (chat-completion vs text)
- [x] Model router now selects gpt-4o-mini successfully (96 eligible models)

**Gate B: Schema Validation Fix** ✅ COMPLETE
- [x] Fixed CopyProposal prompt to match validation schema
- [x] Changed `proposedValue` → `value`, removed `variantId`
- [x] Added required root-level fields (confidence, risks, assumptions)
- [x] Round 0 (generate_candidates) now passes validation
- [x] System progresses to Round 1 (critique phase)

**Gate C: One Real Workflow Run** ✅ COMPLETE
- [x] Model routing works (gpt-4o-mini selected)
- [x] Round 0 (CopyProposal) validation passes
- [x] Round 1 Critique validation passes
- [x] Round 1 DecisionCollapse validation passes
- [x] Complete workflow executes (roundsRun: 1, calls: 3)
- [x] Metrics tracked: inputTokens, outputTokens, estimatedUsd, models, requestIds
- [x] AIML credits restored and workflow tested successfully
- [ ] In staging (or dev), run one real AI Tennis workflow with DB write verification:
  - Use existing intake (do NOT create new one)
  - Trigger `aiTennisCopyRefine` with AIML provider (NOT memory)
  - Verify `success: true` and `actionRequestId` returned
  - Verify new ActionRequest created
  - Verify `rawInbound.aiTennis` has all required fields
  - Verify `rawInbound.proposal` includes rationale/confidence/risks/assumptions
- [ ] Re-run weekly report and confirm:
  - Denominators > 0
  - Flags behave as expected (no false alarms)
  - WoW delta shows real numbers (not N/A)
- [ ] Commit generated report from staging + "first datapoint verified" note

**Definition of Done:**
- ✅ Workflow test doc committed (`docs/REAL_WORKFLOW_TEST.md`)
- ⛔ Model router fixed (AIML provider can route to eligible models)
- ⚠️ Real AI Tennis proposal created in staging
- ⚠️ Weekly report shows non-N/A metrics
- ⚠️ Report committed with verification note

---

## 🔬 PHASE 1.2: OBSERVATION & DRIFT CONTAINMENT

**Goal:** Turn the weekly report into a learning engine (still no UI, no dashboards, no new tables)  
**Mode:** Observe + learn. No automation. Human-governed.

### PR 3: Cost-per-Approval WoW Delta

**Goal:** Same current/prior pair approach for cost metrics

**Tasks:**
- [ ] Refactor `costPerApproval` query to return:
  - `costUsdSum` (numerator)
  - `approvalsCount` (denominator)
- [ ] Create `costPerApprovalCurrent` / `costPerApprovalPrior` query pair
- [ ] Update `renderCostPerApproval()` to:
  - Use `toDollarsPerApproval(costSum, approvals)` for N/A-safe calculation
  - Compute dollar delta: `current.value - prior.value`
  - Use `flagHighNumber()` for flagging (high cost is bad)
- [ ] Test with real data from staging
- [ ] Update `buildMarkdown()` to pass current/prior rows

**Definition of Done:**
- Cost-per-approval shows WoW dollar delta
- N/A behavior preserved when approvals = 0
- Flags use `flagHighNumber()` consistently

---

### PR 4: Weekly Ritual Setup

**Goal:** Establish weekly review cadence (human-governed learning loop)

**Tasks:**
- [ ] Create `docs/WEEKLY_RITUAL.md` with:
  - Schedule: Every Monday 9am (or chosen time)
  - Process:
    1. Run `pnpm tsx scripts/generateWeeklyAiReport.ts`
    2. Review 5 ActionRequests (what customers approve/decline, why, friction points)
    3. Note any anomalies (flags, stopReason spikes, cost jumps)
    4. Extract learnings (prompt improvements, protocol mismatches, model drift)
    5. Update `docs/LEARNINGS.md` with findings
  - Escalation rules: When to investigate vs when to wait
- [ ] Add calendar reminder or cron job (optional)
- [ ] Create `docs/LEARNINGS.md` template

**Definition of Done:**
- Ritual doc committed
- First weekly review completed
- Learnings doc initialized

---

## 🌐 PHASE 2: SWARM PREMIUM WORKFLOW

**Goal:** Multi-AI collaboration for showroom websites (design + code across AIs)  
**Mode:** Field General orchestrates specialists. All decisions audited.

### PR 5: Showrooms Repo Structure

**Goal:** Source of truth for all 4 showroom websites

**Tasks:**
- [ ] Create GitHub repo: `launchbase-showrooms`
- [ ] Structure:
  ```
  showrooms/
    site-1-basic/
      README.md (goals, constraints, tier, success criteria)
      launchbase.yaml (scope + guardrails + budgets)
      src/ (HTML/CSS/JS)
    site-2-standard/
      README.md
      launchbase.yaml
      src/
    site-3-premium/
      README.md
      launchbase.yaml
      src/
    site-4-enterprise/
      README.md
      launchbase.yaml
      src/
  ```
- [ ] Each `README.md` includes:
  - Business goals (conversion, trust, speed)
  - Design constraints (colors, fonts, layout)
  - Tier features (Basic: 3 pages, Standard: 5 pages, Premium: 10 pages, Enterprise: unlimited)
  - "What success looks like" (metrics, user feedback)
- [ ] Each `launchbase.yaml` includes:
  - Scope (pages, components, integrations)
  - Guardrails (no external dependencies, accessibility standards)
  - Budgets (max file size, max load time)

**Definition of Done:**
- Repo created and structured
- All 4 sites have README + launchbase.yaml
- First site committed (Basic tier)

---

### PR 6: Swarm Protocol (Field General + Specialists)

**Goal:** Deterministic multi-AI collaboration with audit trail

**Tasks:**
- [ ] Create `docs/SWARM_PROTOCOL.md` with:
  - Roles:
    - **Field General (FG)**: GPT-5.2 — writes task + constraints + acceptance tests
    - **Specialist A**: Proposes solution
    - **Specialist B**: Critiques proposal
    - **FG**: Collapses to decision + next action
  - Decision trail storage:
    - Use existing `ActionRequest` + `events` pattern
    - New `rawInbound.source = "swarm"`
    - Store: task, proposal, critique, decision, rationale
  - Escalation rules: When FG needs human input
- [ ] Implement swarm router in `server/routers/swarm.ts`
- [ ] Add swarm tests in `server/swarm.test.ts`
- [ ] Run first swarm workflow: "Design Basic tier homepage"

**Definition of Done:**
- Swarm protocol doc committed
- Swarm router implemented and tested
- First swarm decision trail stored in DB
- First showroom site generated via swarm

---

## 🎯 MOMENTUM RULE

**One PR at a time with a single goal:**

1. ✅ Weekly report contract freeze
2. ✅ Real workflow test in staging
3. ✅ Cost-per-approval WoW
4. ✅ Weekly ritual setup
5. ✅ Showrooms repo structure
6. ✅ Swarm protocol implementation

**Every PR must end in one of these artifacts:**
1. **Passing tests summary** (e.g., "23/23 tests passing")
2. **Generated report markdown** (committed or pasted)
3. **Doc update that freezes a contract** (e.g., FOREVER_CONTRACTS.md)

**No "invisible progress."**

---

## 🚫 BLOCKED UNTIL PHASE 2 COMPLETE

**These items are explicitly blocked and must not be started:**

### ❌ No Dashboards / UI Expansion
- Dashboard for AI Tennis metrics
- Admin UI for ActionRequest management
- Batch approval UI
- Confidence learning metrics UI
- Action request history UI

### ❌ No New Features / Integrations
- QuickBooks OAuth flow
- Revenue/expense data reading
- Cash flow calculations
- Business health cards
- Slack/SMS/Zapier integrations
- Mobile app
- API for third-party integrations

### ❌ No Optimization Work
- Database indexes
- Redis caching
- CDN for static assets
- Preview generation speed

### ⚠️ TypeScript Errors (Not Blocking Constitutional Work)
- [ ] Fix scoreDesign.ts type errors (3 errors)
- [ ] Fix actionRequestSequencer.ts resendMessageId type error
- [ ] Run `pnpm tsc --noEmit` to verify fixes

**Note:** These errors do not block Phase 1.1/1.2/2 work. Fix only if time permits.

---

## 📋 Next Command

When ready to proceed:
- `"Implement PR 1: Weekly Report Contract Freeze"`
- `"Implement PR 2: Real Workflow Test in Staging"`
- `"Implement PR 3: Cost-per-Approval WoW Delta"`

We proceed one clean PR at a time.

## Phase 1.3: Realistic Prompt Testing & Weekly Report Validation

**Gate A: Run 5 Realistic Prompts (Success-Path Testing)** ✅ COMPLETE
- [x] Prompt 1: Specific rewrite + constraints → ESCALATED (vague terms)
- [x] Prompt 2: Value prop with audience + outcome → SUCCESS (confidence: 0.9)
- [x] Prompt 3: Compare/contrast → ESCALATED (unverified claims)
- [x] Prompt 4: High specificity + structure → SUCCESS (confidence: 0.85)
- [x] Prompt 5: Tight directive → ESCALATED (unverified "26/26 tests" claim)
- [x] Result: 2/5 succeeded (target: ≥2) ✅ PASS
- [x] Total cost: $0.34, Total time: 71s

**Gate B: Verify Success Outcomes (Definition of Done)**
- [ ] At least 2/5 prompts succeed with:
  - `needsHuman: false`
  - `stopReason: "ok"`
  - `roundsRun >= 1`
  - `createdActionRequestIds.length >= 1`
  - `rawInbound.aiTennis.costUsd` populated
  - `rawInbound.proposal.*` populated (targetKey, value, rationale, confidence, risks, assumptions)

**Gate C: Weekly Report Validation** ✅ COMPLETE
- [x] Run weekly report script
- [x] Confirm non-N/A metrics for:
  - stopReason distribution (3 records, 100% "ok")
  - needsHuman rate (0.0%, denominator: 3)
  - cost per approval ($0.156 avg)
  - cache hit rate (0.0% - expected for service-only)
  - stale takeover rate (0.0%)
- [x] Report artifact saved: `reports/ai_weekly_2026-01-12.md`
- [x] All metrics showing real data (no N/A except WoW deltas)

**Bonus: Idempotency Proof**
- [ ] Pick best successful prompt and call twice with identical inputs
- [ ] Verify second call returns cached result
- [ ] Verify weekly report shows cache hit numerator/denominator > 0
