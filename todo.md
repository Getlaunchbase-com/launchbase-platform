# LaunchBase TODO

**Status:** ✅ Phase 1 BASELINE TAGGED — Phase 2 Authorized  
**Version:** a6a0462d (Stable Baseline v1.0)  
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
- ✅ Model router fixed (AIML provider can route to eligible models)
- ✅ Real AI Tennis proposal created in staging
- ✅ Weekly report shows non-N/A metrics
- ✅ Report committed with verification note
- ✅ Phase 1 baseline tagged (docs/PHASE_1_BASELINE_TAGGED.md)
- ✅ "Prove It" ritual PASSED (Phase 1.3 Gate A/B/C validation accepted)
- ✅ 30/30 tests passing
- ✅ Phase 2 authorized to proceed

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

## PR 3: Production Hardening (Phase 1 Finish Line)

**Goal:** Lock down production readiness with cleanup + resilience (no new behavior)

**Tasks:**

### 1️⃣ Remove Debug Logging ✅ COMPLETE
- [x] Remove temporary console.log from model routing debug
- [x] Remove temporary console.log from schema validation debug (runAiTennis.ts)
- [x] Remove temporary console.log from AIML response inspection (aiTennisCopyRefine.ts)
- [x] Keep: structured error logs, fingerprinted failures, traceId-based logging
- [x] Keep: Weekly report logging (shows query progress + row counts)
- [x] Verify: No prompt/provider payload logging

### 2️⃣ Feature Alias Layer (Provider-Agnostic) ✅ COMPLETE
- [x] Create `server/ai/modelRouting/featureAliases.ts` with alias map
- [x] Map internal capabilities to vendor-specific strings:
  - `json_schema` → `["json_schema", "openai/chat-completion.response-format", "anthropic/structured-output"]`
  - `structured_outputs` → `["structured_outputs", "openai/chat-completion.response-format"]`
  - `function_calling`, `vision` (future-proofed)
- [x] Update `modelPolicy.ts` to use `hasAllCapabilities()` from featureAliases
- [x] Update `modelPolicy.config.ts` to use internal capability names (`json_schema` instead of vendor strings)
- [x] Helpers: `resolveFeatureAliases()`, `hasCapability()`, `hasAllCapabilities()`

### 3️⃣ Micro-Tests (Regression Armor) ✅ COMPLETE
- [x] Extract pure helpers: `normalizeFeatures()`, `inferTypeFromId()` in `modelNormalize.ts`
- [x] Add `server/ai/modelRouting/modelNormalize.test.ts` (17 tests):
  - Feature normalization: array → correct names (filters non-strings, whitespace)
  - Feature normalization: object → correct names (truthy values only)
  - Edge cases: undefined, null, primitives
  - Regression: Phase 1.3 bug (array → numeric indices)
  - Type inference: embedding, audio, image, text (case-insensitive)
- [x] Add `server/ai/modelRouting/featureAliases.test.ts` (13 tests):
  - Alias resolution: json_schema → ["json_schema", "openai/chat-completion.response-format", ...]
  - hasCapability: direct match + vendor alias match
  - hasAllCapabilities: multiple requirements
  - Regression: prevents policy/registry mismatch, vendor rename breakage
- [x] All 30 tests passing (no AIML/env dependencies)
- [ ] Future: Add `server/ai/promptPacks/schemaValidation.test.ts` (optional, for prompt/schema drift detection)

### 4️⃣ PR3 Completion ✅ COMPLETE
- [x] Create `docs/PR3_COMPLETE.md` with:
  - Summary of changes (3 tasks: debug cleanup, alias layer, micro-tests)
  - Verification results (model routing test, 30/30 unit tests passing)
  - Impact assessment (stability, cost reduction, maintainability)
  - Next steps (Phase 2: Swarm Premium)
- [x] Save final checkpoint
- [x] Mark PR3 complete in todo.mdE in todo.md

**Definition of Done:**
- ✅ No debug logs in production code
- ✅ Feature alias layer implemented and tested
- ✅ Micro-tests passing (regression protection)
- ✅ Phase 1 declared COMPLETE
- ✅ Ready for Phase 2 (Swarm Premium)


---

## 🚀 PHASE 2.0: ENGINE INTERFACE V1 (IN PROGRESS)

**Goal:** Establish stable contract layer that enables future app skins without rewrites  
**Mode:** Engine/skin separation, policy-as-config, audit-ready

### Phase 2.1: Engine Interface V1

**Goal:** Create the "Ferrari chassis" — stable interface for all future skins (LaunchBase, AI Butler, etc.)

**Tasks:**
- [x] Create `docs/ENGINE_INTERFACE_V1.md` with:
  - Purpose + non-goals (engine vs skin separation)
  - AiWorkOrderV1 contract (intent, inputs, constraints, policy, trace)
  - AiWorkResultV1 contract (customer-safe + internal meta split)
  - StopReason semantics (FOREVER CONTRACT-aligned)
  - Redaction & security rules (no prompts, hashes only)
  - Change policy (patch/minor/major versioning)
- [x] Create `server/ai/engine/types.ts` with:
  - EngineIntent type (copy_refine, landing_page_section, ad_set, etc.)
  - PresentationMode type (single_best, side_by_side, diff_view)
  - ProviderPreference type (provider hints, policy can override)
  - EngineTrace type (tenant, jobId, requestId, intakeId, actor)
  - EngineConstraints type (maxRounds, costCapUsd, maxTokensTotal, strictMode, timeCapMs)
  - EnginePolicyRef type (policyId, policyVersion)
  - EngineInputs type (userText, targetSection, currentCopy, context, assets)
  - AiWorkOrderV1 type (complete work order contract)
  - StopReason type (reuse from Phase 1, no new vocabulary)
  - CustomerSafeResult type (ok, stopReason, needsHuman, confidence, output, traceId, cached)
  - InternalMeta type (workOrderHash, userTextHash, policyId, roundsRun, usage, swarm, redactionsApplied)
  - AiWorkResultV1 type (customer + internal split)
- [x] Create `server/ai/engine/runEngine.ts` skeleton:
  - Validate order.schemaVersion === "v1"
  - Check policy existence (hard fail if not registered)
  - Derive idempotency key (hash, never store raw userText)
  - Return stubbed AiWorkResultV1 (no execution yet)
- [x] Create checkpoint: Phase 2.1 complete

**Definition of Done:**
- [x] ENGINE_INTERFACE_V1.md committed (source of truth)
- [x] TypeScript types exist and compile
- [x] runEngine() skeleton validates inputs
- [x] 8/8 contract tripwire tests passing
- [x] Deep normalize() with no key collisions
- [x] Validation/policy split (policy resolution after validation)
- [x] No behavior change to Phase 1 (zero risk)
- [x] Checkpoint saved (dc1cbecc)

---

### Phase 2.2: Policy Registry (NEXT)

**Goal:** Policy-as-config system (no branching code, just tier configs)

**Tasks:**
- [ ] Create `server/ai/policies/types.ts` with PolicyConfig type
- [ ] Create `server/ai/policies/registry.ts` with POLICY_REGISTRY
- [ ] Implement 2 initial policies:
  - `launchbase_standard` (single model, basic constraints)
  - `launchbase_swarm_premium` (Field General + specialists, higher caps)
- [ ] Each policy defines:
  - Allowed capabilities (structured_output, json_schema, etc.)
  - Cost caps & retry rules
  - Swarm depth (# of specialists)
  - Approval rules & escalation thresholds
- [ ] Update runEngine() to load and apply policy
- [x] Create checkpoint: Phase 2.2 complete

**Definition of Done:**
- [x] Policies are config-only JSON
- [x] No branching code (policy-driven routing)
- [x] Caps enforced via `policy_rejected`
- [x] Router selection driven by `requiredCaps` / `preferredCaps`
- [x] Zod validation enforced
- [x] Static bundle (no runtime FS reads via policyBundle.ts)
- [x] No-runtime-FS invariant test passes (poisoned fs + node:fs)
- [x] 11/11 tripwire tests passing
- [x] Checkpoint saved

**Frozen Invariants (Phase 2.2):**
- ✅ No filesystem reads in policy registry (serverless-safe)
- ✅ Unknown policy → stopReason: policy_not_found
- ✅ Invalid policy → stopReason: policy_invalid
- ✅ Policy rejects → stopReason: policy_rejected
- ✅ policyId impacts routing decisions but does not change core idempotency key

**Definition of Done:**
- [ ] Policy registry exists with 2 working policies
- [ ] runEngine() applies policy constraints
- [ ] No hard-coded tier logic (all config-driven)
- [ ] Checkpoint saved


---

## 🚀 PHASE 2.2: POLICY REGISTRY ✅ COMPLETE

**Goal:** Policy-as-config with zero branching code, capability-first routing  
**Mode:** Config-driven tier behavior, no provider-specific branching

### Phase 2.2: Policy Registry

**Goal:** Implement policy registry with JSON/YAML configs, capability-first routing, no branching code

**Tasks:**
- [x] Create `server/ai/engine/policy/policyTypes.ts` with:
  - PolicyV1 type (policyId, engineVersion, caps, routing, swarm, presentationDefaults, logging)
  - Capability types (json_output, json_schema, low_latency, low_cost, vision, audio, long_context)
  - Swarm config type (enabled, maxLoops, specialists)
  - Presentation defaults type
  - Logging config type (two-trail guardrails)
- [x] Create `server/ai/engine/policy/policyRegistry.ts` with:
  - `resolvePolicy(policyId)` function (loads from disk, validates, returns {ok, policy} or {ok, stopReason})
  - Policy validation (zod/ajv schema check)
  - Policy caching (deterministic, no re-loads)
- [x] Create `server/ai/engine/policy/policies/` directory
- [x] Create `launchbase_portal_v1.json`:
  - maxRounds: 2, costCapUsd: 1.50
  - requiredCaps: json_schema, json_output
  - swarm.enabled: false
  - presentationDefaults: "customer_portal"
- [x] Create `swarm_premium_v1.json`:
  - maxRounds: 3, costCapUsd: 4.00
  - swarm.enabled: true, maxLoops: 2
  - specialists: ["design_web", "copy_marketing", "code_review"]
  - requiredCaps: json_schema, json_output
  - preferredCaps: low_cost
- [x] Create `ai_butler_consumer_v1.json`:
  - maxRounds: 1, costCapUsd: 0.50
  - presentationDefaults: "side_by_side"
  - allowUserProviderPreference: true
- [x] Add policy stopReasons to StopReasonV1:
  - policy_not_found
  - policy_invalid
  - policy_rejected
- [x] Update runEngine() to use resolvePolicy():
  - Call resolvePolicy(policyId) after validation
  - Return stopReason if policy resolution fails
  - Apply policy caps (reject if WorkOrder exceeds policy caps)
- [x] Create policy tripwire tests (11 total):
  - Unknown policyId → stopReason: policy_not_found
  - Invalid policy file → stopReason: policy_invalid
  - WorkOrder exceeds policy caps → stopReason: policy_rejected
  - Idempotency unaffected by policy contents (only policyId in keyHash)
- [x] Create checkpoint: Phase 2.2 complete

**Definition of Done:**
- [x] Policies are config-only JSON
- [x] No branching code (policy-driven routing)
- [x] Caps enforced via `policy_rejected`
- [x] Router selection driven by `requiredCaps` / `preferredCaps`
- [x] Zod validation enforced
- [x] Static bundle (no runtime FS reads via policyBundle.ts)
- [x] No-runtime-FS invariant test passes (poisoned fs + node:fs)
- [x] 11/11 tripwire tests passing
- [x] Checkpoint saved

**Frozen Invariants (Phase 2.2):**
- ✅ No filesystem reads in policy registry (serverless-safe)
- ✅ Unknown policy → stopReason: policy_not_found
- ✅ Invalid policy → stopReason: policy_invalid
- ✅ Policy rejects → stopReason: policy_rejected
- ✅ policyId impacts routing decisions but does not change core idempotency key

**Definition of Done:**
- [ ] Policies load by policyId from JSON files
- [ ] Router driven by required/preferred capabilities from policy
- [ ] Failures are stopReason'd, not thrown
- [ ] 4 policy tripwire tests pass
- [ ] No swarm logic yet (Phase 2.3)
- [ ] Checkpoint saved

---

### Phase 2.3: Minimal Swarm Loop (NEXT)

**Goal:** Field General + 2 specialists (1 loop), deterministic collapse, full audit trail

**Tasks:**
- [ ] Implement minimal swarm loop (1 round):
  - Field General produces plan
  - Specialist A: "find flaws + missing constraints"
  - Specialist B: "cost/UX risk + simplifications"
  - Field General collapses into final decision artifact
- [ ] Store swarm trail in extensions.swarm.internal (internal-only)
- [ ] Store customer-safe artifact in artifacts[] only
- [ ] All non-CORE variability lives in extensions
- [ ] Create checkpoint: Phase 2.3 complete

**Definition of Done:**
- [ ] Swarm loop executes (Field General + 2 specialists)
- [ ] Audit trail split (customer vs internal)
- [ ] Output only via artifacts[] + stopReason
- [ ] Checkpoint saved


---

## 🚀 PHASE 2.3: MINIMAL SWARM LOOP (IN PROGRESS)

**Goal:** Field General orchestrates 2 specialists (craft + critic) with deterministic collapse and audit artifacts  
**Mode:** Flow-first implementation with memory transport, then provider wiring

### Gate 0: Bootstrap Policy Registration ✅ COMPLETE

**Goal:** Policies exist in-process before any engine call

**Completed:** January 13, 2026

**Tasks:**
- [x] Add policy registration at server startup:
  - Import `registerPolicies` and `ALL_POLICIES`
  - Call `registerPolicies(ALL_POLICIES)` in server bootstrap
  - Location: `server/index.ts` or equivalent entry point
- [x] Create bootstrap tripwire test:
  - Server boot → `resolvePolicy("launchbase_portal_v1")` works
  - No FS access (poisoned-FS test remains as invariant)

**Definition of Done:**
- [x] Server starts with policies loaded
- [x] No runtime FS reads
- [x] 4/4 bootstrap tests passing

---

### Gate 1: Swarm Orchestration Skeleton ✅ COMPLETE

**Goal:** Implement flow first, not "smartness" (memory/log transport only)

**Completed:** January 13, 2026  
**Summary:** Field General orchestration with 4-step swarm flow (plan → craft → critic → collapse). Memory transport only, no provider spend. 7/7 tripwire tests passing.

**Tasks:**
- [x] Update `runEngine()` swarm path:
  - After policy resolution, check `policy.swarm?.enabled`
  - If `false` or undefined → single-pass execution (stub for now)
  - If `true` → swarm loop v0
- [x] Implement swarm loop v0 (4 steps):
  1. Field General "plan" (memory transport returns mock plan)
  2. Specialist: craft (memory transport returns mock proposal)
  3. Specialist: critic (memory transport returns mock critique)
  4. Field General "collapse" (memory transport returns mock decision)
- [x] Emit artifacts in fixed order:
  1. `kind: "swarm.plan"` (customerSafe: false)
  2. `kind: "swarm.specialist.craft"` (customerSafe: false)
  3. `kind: "swarm.specialist.critic"` (customerSafe: false)
  4. `kind: "swarm.collapse"` (customerSafe: true)
- [x] Update `swarm_premium_v1.json` policy:
  - Add `swarm.enabled: true`
  - Add `swarm.specialists: ["craft", "critic"]`
  - Add `swarm.maxSwirlRounds: 1` (v0 hard lock)
  - Add `swarm.collapseStrategy: "field_general"`

**Hard Rules:**
- No new tables
- All non-CORE experimental fields live under `extensions`
- `stopReason` always present (even "ok")
- No AIML spend yet (memory transport only)

**Definition of Done:**
- [x] Swarm runs end-to-end with memory transport
- [x] Deterministic artifacts (4 kinds, fixed order)
- [x] No leakage (customerSafe enforced)
- [x] stopReason always present
- [x] 7/7 swarm tripwire tests passing
- [x] runEngine() behavior unchanged for non-swarm policies

**Frozen Invariants (Gate 1):**
- ✅ Artifact order: plan, craft, critic, collapse (immutable)
- ✅ Only collapse is customerSafe=true
- ✅ stopReason always present ("ok" on success)
- ✅ Idempotency unchanged (same CORE → same keyHash)
- ✅ Policy toggle controls swarm enable/disable

---

### Gate 2: Swarm Tripwire Tests

**Goal:** Lock in behavior like Phase 1 did

**Required Tests:**
- [ ] Test 1: Artifact order + kinds frozen
  - Swarm policy produces exactly 4 artifacts in order
  - Kinds: swarm.plan, swarm.specialist.craft, swarm.specialist.critic, swarm.collapse
- [ ] Test 2: Idempotency stability
  - Same CORE → same keyHash
  - Different CORE → different keyHash
- [ ] Test 3: Policy toggles behavior
  - Non-swarm policy never emits swarm artifacts
  - Swarm policy always emits swarm artifacts
- [ ] Test 4: Cost cap enforcement
  - If estimated cost exceeds cap → stopReason: policy_rejected
- [ ] Test 5: No leakage
  - Artifacts marked customerSafe=true never contain forbidden keys/strings
  - No prompts, no provider payloads, no PII

**Definition of Done:**
- [ ] 5/5 tripwire tests passing
- [ ] Tests use memory/log transport (no AIML spend)
- [ ] Contracts locked (artifact structure frozen)

---

### Gate 3: Provider Wiring

**Goal:** Wire real providers only after contracts frozen

**Tasks:**
- [ ] Field General model routing:
  - Use model router to select structured output model
  - Apply policy caps (costCapUsd, maxRounds)
- [ ] Specialist model routing:
  - Use cheaper models for specialists
  - Keep provider preferences in policy config only
- [ ] Cost accounting:
  - Track inputTokens, outputTokens, estimatedUsd per specialist
  - Aggregate costs across swarm loop
  - Verify cost cap enforcement
- [ ] Real swarm run:
  - Execute at least one real swarm workflow
  - Verify swarm.collapse success
  - Verify safe artifacts + cost accounting

**Definition of Done:**
- [ ] At least one real swarm run produces swarm.collapse success
- [ ] Safe artifacts (no leakage)
- [ ] Cost accounting accurate
- [ ] All tripwire tests still passing with real providers

---

### Phase 2.3 Checkpoint

**Tasks:**
- [ ] Mark all Gate 0-3 tasks complete
- [ ] Run all tests (contract + policy + swarm)
- [ ] Create checkpoint: Phase 2.3 complete

**Definition of Done:**
- [ ] Server bootstraps policies at startup
- [ ] Swarm orchestration works (memory + real providers)
- [ ] 5/5 swarm tripwire tests passing
- [ ] Cost accounting accurate
- [ ] No leakage (customerSafe enforced)
- [ ] Checkpoint saved

---

**Why This Prevents Future Overhaul:**

Engine output becomes "artifacts + final result" regardless of UI skin:
- **LaunchBase Portal** renders single "final proposal" artifact
- **AI Butler** renders side-by-side artifacts per specialist, or provider comparisons
- Same engine, different presentation. No rewrite.


---

### Gate 4: Showrooms Repository ✅ COMPLETE

**Goal:** Create training and regression harness for AI Swarm Protocol

**Completed:** January 13, 2026  
**Repository:** https://github.com/Getlaunchbase-com/launchbase-showrooms  
**Commit:** a843d23

**Tasks:**
- [x] Create repository structure (4 showrooms, protocols, tools)
- [x] Document LaunchBase showroom (SHOWROOM_BRIEF, SUCCESS_CRITERIA, BASELINE_COST, CHANGELOG)
- [x] Create placeholder files for site_gpt, site_manus, site_4
- [x] Write SWARM_PROTOCOL_V1.md
- [x] Write REVIEW_CHECKLIST.md
- [x] Write measure_cost.md methodology
- [x] Initialize git repo and commit
- [x] Push to GitHub (Getlaunchbase-com/launchbase-showrooms)

**Definition of Done:**
- [x] All 4 sites in repo
- [x] Each has brief + success criteria (LaunchBase complete, others placeholders)
- [x] Protocols documented
- [x] Cost measurement methodology defined
- [x] Version control established

---

### Gate 2: Specialist Intelligence (IN PROGRESS)

**Goal:** Replace memory transport with real provider calls for specialists

**Tasks:**
- [ ] Update swarmRunner.ts to call real providers:
  - Craft specialist: real AIML provider call (cheaper model)
  - Critic specialist: real AIML provider call (cheaper model with strict schema)
  - Field General: deterministic orchestration (no provider call yet)
- [ ] Implement cost accounting:
  - Track tokens and USD per specialist
  - Sum costs across all specialists
  - Enforce policy cost cap (stop if exceeded)
- [ ] Implement failure isolation:
  - Specialist failure → controlled collapse (no throw)
  - Return stopReason: "provider_failed" with partial artifacts
  - Log failure details in internal metadata
- [ ] Add Gate 2 tripwire tests:
  - [ ] Craft specialist fails → controlled collapse
  - [ ] Critic specialist fails → controlled collapse
  - [ ] Cost cap hit → policy_rejected or cost_cap_exceeded
  - [ ] Schema validation failure → controlled collapse
  - [ ] Successful run → cost accounting accurate

**Hard Invariants:**
- Artifact order frozen (plan → craft → critic → collapse)
- Only collapse is customerSafe=true
- Idempotency keyHash unchanged
- stopReason always present

**Definition of Done:**
- [ ] 2 specialists call real provider (AIML)
- [ ] Cost accounting sums across specialist calls
- [ ] Cost cap stops further calls and collapses safely
- [ ] Specialist failure → controlled collapse (no throw, no leaked error)
- [ ] New tripwire tests passing (5 tests)
