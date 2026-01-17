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


---

## Phase 2.3 Gate 3: Provider Wiring + Cost Accounting ✅ COMPLETE

**Goal:** Role-based provider wiring with strict cost tracking and total cap enforcement

**Tripwires (6 tests, write first):**
- [x] Test 1: Field General uses memory transport (no provider call)
- [x] Test 2: Craft/Critic use policy-defined models (gpt-4o-mini)
- [x] Test 3: meta.swarm.roleCostsUsd + totalCostUsd present on every run
- [x] Test 4: Per-role cap triggers correct stopReason
- [x] Test 5: Total cap halts with skipped artifact (preserves 4-artifact frozen order)
- [x] Test 6: CustomerSafe boundary unchanged (only collapse is customerSafe=true)

**Implementation:**
- [x] Add cost accounting to swarmRunner:
  - [x] Track roleCostsUsd per specialist (craft, critic)
  - [x] Sum into totalCostUsd
  - [x] Add to result.extensions.swarm.meta
- [x] Implement total cap halt logic:
  - [x] Check total before calling next specialist
  - [x] If cap exceeded, emit skipped artifact with {skipped: true, reason: "total_cap_exceeded"}
  - [x] Preserve frozen 4-artifact order (plan → craft → critic → collapse)
- [x] Verify frozen layers remain green:
  - [x] Gate 0 (Bootstrap): 4/4
  - [x] Gate 1 (Swarm Skeleton): 7/7
  - [x] Gate 2 (Specialist Intelligence): 8/8
  - [x] Contract Tripwires: 8/8
  - [x] Policy Registry: 11/11

**Hard Invariants (MUST NOT CHANGE):**
- Artifact order frozen (plan → craft → critic → collapse)
- Only collapse is customerSafe=true
- No new stopReason values (use extensions.warnings instead)
- No artifact structure changes
- Gate 1/2 contracts remain intact

**Definition of Done:**
- [x] Gate 3 tripwire tests written (6 tests)
- [x] All tripwire tests passing
- [x] Frozen layers remain green (44/44 tests)
- [x] Checkpoint saved (version: 42ff0603)


---

## Phase 2.3 Gate 4: Showroom Runner + Benchmark Runs

**Goal:** Deterministic output packaging, cost telemetry, and filesystem persistence for repeatable benchmark runs

**Tripwires (7 tests, write first):**
- [x] T1: Stable output envelope (status, stopReason, artifacts always present)
- [x] T2: Frozen artifact ordering preserved (plan → craft → critic → collapse)
- [x] T3: Telemetry required (roleCostsUsd, totalCostUsd, roleModels)
- [x] T4: Cost caps enforced, non-chaotic (per-role + total)
- [x] T5: Run persistence contract (input.json, output.json, summary.md)
- [x] T6: No prompt/provider internals leak (no raw prompts, stack traces, system content)
- [x] T7: Showroom-to-policy mapping deterministic (same keyHash for same inputs)

**Implementation:**
- [x] Build showroom runner script:
  - [x] Create WorkOrder from showroom brief
  - [x] Run engine with policyId: swarm_premium_v1
  - [x] Output run folder structure: runs/<YYYY-MM-DD>/run_<NN>/
  - [x] Write input.json, output.json, summary.md
- [x] Execute 3 coffee shop benchmark runs:
  - [x] Run A: baseline brief ($0.0182, 10.1s)
  - [x] Run B: +audience/tone constraints ($0.0203, 12.2s)
  - [x] Run C: +strict "no claims" constraint ($0.0179, 13.9s)
  - [x] Log: totalCostUsd, needsHuman, keyHash, output summary
- [x] Verify frozen layers remain green:
  - [x] Gate 0 (Bootstrap): 4/4
  - [x] Gate 1 (Swarm Skeleton): 7/7
  - [x] Gate 2 (Specialist Intelligence): 8/8
  - [x] Gate 3 (Cost Accounting): 6/6
  - [x] Gate 4 (Showroom Runner): 7/7

**Hard Invariants (MUST NOT CHANGE):**
- Artifact order frozen (plan → craft → critic → collapse)
- Only collapse is customerSafe=true
- No new stopReason values
- No artifact structure changes
- Gates 0/1/2/3 contracts remain intact

**Definition of Done:**
- [x] Gate 4 tripwire tests written (7 tests)
- [x] All tripwire tests passing
- [x] Showroom runner script complete
- [x] 3 coffee shop benchmark runs executed
- [x] Frozen layers remain green (51/51 tests)
- [x] Checkpoint saved (version: f71eb964)


---

## Phase 2.4: Deterministic Collapse Logic

**Goal:** Synthesize craft + critic outputs into final customer-safe decision without additional provider calls

**Tripwires (8 tests, write first):**
- [x] T1: ok with payload when craft+critic clean
- [x] T2: needs_human when critic fails
- [x] T3: needs_human when no changes exist
- [x] T4: needs_human when craft stopReason not ok
- [x] T5: needs_human when critic stopReason not ok
- [x] T6: forbidden keys never appear in extensions
- [x] T7: deterministic for same inputs
- [x] T8: merges risks and assumptions from craft and critic

**Implementation:**
- [x] Create collapseDeterministic.ts:
  - [x] Pure function (no provider calls)
  - [x] Gates on stopReason BEFORE touching schema fields
  - [x] Reads minimal subset from craft/critic only when stopReason=ok
  - [x] Returns stopReason always (ok or needs_human)
  - [x] If needs_human, payload is null
  - [x] Sanitizes forbidden keys in debug extensions
- [x] Wire into swarmRunner.ts:
  - [x] Import buildDeterministicCollapse
  - [x] Inject payload.stopReason after specialist call (single source of truth)
  - [x] Feed craft + critic stopReason + payload
  - [x] Push collapse artifact (customerSafe=true)
  - [x] Set result.stopReason = collapse.stopReason
  - [x] Put internal details in extensions (NOT customerSafe)
- [x] Write Gate 5 tripwire tests:
  - [x] ok when craft+critic ok and critic passes and has changes
  - [x] needs_human if craft/critic stopReason not ok
  - [x] needs_human if missing changes
  - [x] strips forbidden keys from extensions debug
  - [x] deterministic for same inputs
- [x] Run full test suite and verify coffee shop benchmarks
- [x] Verify frozen layers remain green:
  - [x] Gate 0 (Bootstrap): 4/4
  - [x] Gate 1 (Swarm Skeleton): 7/7
  - [x] Gate 2 (Specialist Intelligence): 8/8
  - [x] Gate 3 (Cost Accounting): 6/6
  - [x] Gate 4 (Showroom Runner): 7/7
  - [x] Gate 5 (Collapse Logic): 8/8

**Hard Invariants (MUST NOT CHANGE):**
- Artifact order frozen (plan → craft → critic → collapse)
- Only collapse is customerSafe=true
- No new stopReason values (use ok or needs_human)
- No artifact structure changes
- Gates 0/1/2/3/4 contracts remain intact

**Definition of Done:**
- [x] collapseDeterministic.ts created (pure function)
- [x] Collapse logic wired into swarmRunner.ts
- [x] Gate 5 tripwire tests written (8 tests)
- [x] All tripwire tests passing (59/59)
- [x] Coffee shop benchmarks re-run with deterministic collapse ($0.0198, 14.4s, needs_human)
- [x] Frozen layers remain green (59/59 tests)
- [x] Checkpoint saved (version: 1b849740)


---

## Homepage Copy Implementation (Tier 2 Premium) ✅ COMPLETE

**Goal:** Implement Pass 3 winner homepage copy to lock in upgraded positioning and establish conversion baseline

**Sections to implement (in exact order):**
- [x] 1. Hero (Stop carrying the system in your head)
- [x] 2. Why this exists (No one owns the system)
- [x] 3. What stops being your job (Before/After mental load)
- [x] 4. How it works (4 steps)
- [x] 5. Observability (Trust section with activity feed)
- [x] 6. Suite (Social Media, Intelligence, GBP, QuickBooks)
- [x] 7. Not for you (Filter section)
- [x] 8. Pricing (Core Website + Example)
- [x] 9. FAQ (5 questions)
- [x] 10. Final CTA (You've been carrying this long enough)

**CTAs (must be consistent):**
- Primary: "Hand It Off" ✅ (used 3 times)
- Supporting: "See your real site before you pay. Cancel anytime." ✅ (used 3 times)

**Hard Rules:**
- [x] No pricing changes (copy updates only)
- [x] Keep existing CTA routing/functionality
- [x] Maintain responsive design
- [x] No new components (use existing UI patterns)

**Definition of Done:**
- [x] All 10 sections implemented in exact order
- [x] CTAs consistent throughout
- [x] No pricing changes
- [x] Homepage tested locally (dev server running, screenshot verified)
- [x] Checkpoint saved (version: f9d313cc)


---

## Phase 2.5: Real Specialist Prompts (Craft + Critic)

**Goal:** Replace specialist stubs with real AIML prompts that produce reliable, validated JSON outputs

**Non-negotiables:**
- Never change frozen contracts (Gates 0-4 + Engine v1 + stopReason vocab)
- All provider output must validate against specialist JSON schemas
- No prompt/system/provider leakage into customerSafe: true artifacts

**2.5.A - Define Specialist Output Schemas:**
- [ ] Create Craft JSON schema:
  - [ ] proposedChanges[] (targetKey, value, rationale, confidence, risks[])
  - [ ] Save to: server/ai/engine/specialists/schemas/craft.schema.ts
- [ ] Create Critic JSON schema:
  - [ ] pass (boolean), issues[], suggestedFixes[], requiresApproval
  - [ ] Save to: server/ai/engine/specialists/schemas/critic.schema.ts

**2.5.B - Write Prompt Packs:**
- [ ] Create craft prompt pack:
  - [ ] Explicit JSON output instruction
  - [ ] "Don't invent facts" + "use provided context only" guardrails
  - [ ] LaunchBase style: responsibility, observability, reversibility
  - [ ] Save to: server/ai/promptPacks/swarm/v1/craft.md
- [ ] Create critic prompt pack:
  - [ ] Explicit JSON output instruction
  - [ ] Same guardrails as craft
  - [ ] Save to: server/ai/promptPacks/swarm/v1/critic.md

**2.5.C - Wiring:**
- [ ] Update aimlSpecialist.ts:
  - [ ] Load prompt pack by role
  - [ ] Inject WorkOrder CORE + showroom brief context
  - [ ] Request JSON output
  - [ ] Validate with Zod → return stopReason (ok, json_parse_failed, ajv_failed, provider_failed, timeout, cost_cap_exceeded)
- [ ] Update policy to include promptPackVersion: "swarm_v1"
- [ ] No changes to swarmRunner.ts (artifact order stays frozen)

**2.5.D - Tripwire Tests:**
- [ ] Prompt pack snapshot tests (files exist + guardrail phrases present)
- [ ] Schema validation tests (known-good/bad JSON samples)
- [ ] Adapter behavior tests (mock AIML response → verify stopReason mapping)
- [ ] No leakage test (collapse payload never contains forbidden keys)

**2.5.E - Benchmark Suite:**
- [ ] Profile 1: Cheap + fast (gpt-4o-mini, $0.05-$0.10 total cap)
- [ ] Profile 2: Balanced (gpt-4o-mini, $0.15-$0.25 total cap)
- [ ] Profile 3: Premium (better models, $0.50 total cap)
- [ ] Success criteria: outputs validate, collapse returns ok or needs_human, cost under cap, 4 artifacts in order

**Definition of Done:**
- [ ] Craft + Critic schemas defined and validated
- [ ] Prompt packs written with guardrails
- [ ] Prompts wired into aimlSpecialist.ts with validation
- [ ] Tripwire tests passing
- [ ] Benchmark suite executed (3 profiles)
- [ ] Frozen layers remain green (59/59 tests)
- [ ] Checkpoint saved with real specialist prompts


---

## 🏆 PHASE 2: WINNING STACK LADDER (Build-on-Previous)

**Status:** Tournament complete, champions selected  
**Budget:** $3.94 spent of $50 allocated (92% remaining)

### Tournament Results ✅ COMPLETE
- [x] 40 tournament runs complete (16 systems + 16 brand + 8 critic)
- [x] Scorecard generated (TOURNAMENT_SCORECARD.md)
- [x] Category champions selected (CATEGORY_CHAMPIONS.json)
- [x] Clear winner: gpt-4o-2024-08-06 (systems + brand), claude-opus-4-1-20250805 (critic)
- [x] Top score: 71.0/100 (5 runs at top score with same stack)

### Winning Stack Lock
- [ ] Update swarm_winning_stack_v1.json with champion models:
  - Systems: gpt-4o-2024-08-06
  - Brand: gpt-4o-2024-08-06
  - Critic: claude-opus-4-1-20250805
- [ ] Document winning stack in WINNING_STACK_V1.md

### 4-Run Build-on-Previous Ladder
- [ ] Create ladder script (scripts/runLadder.ts)
- [ ] Implement build-on-previous logic (inject previous proposedChanges as current state)
- [ ] Run 1: Structure & Hierarchy
  - Goal: Layout/section order, spacing, typography scale, scannability
  - Directive: "Make it feel like Stripe/Linear. Remove friction. Improve flow."
- [ ] Run 2: Conversion & Trust Architecture
  - Goal: CTA placement, trust sequencing, objections, proof strategy
  - Directive: "Increase CTA certainty without hype."
- [ ] Run 3: Components & Interaction Design
  - Goal: Sticky CTA rules, cards, tables, FAQ behavior, micro-interactions
  - Directive: "Make it feel expensive + inevitable."
- [ ] Run 4: Final Polish Pass
  - Goal: Reduce noise, remove redundancy, unify tone, tighten all changes
  - Directive: "Ship-ready. No extra ideas. Only best ones."
- [ ] Check convergence after ladder (scripts/detectConvergence.ts)

---

## 🔬 PHASE 3: MEGA-SCALE TRUTHFULNESS TESTING

**Goal:** 440+ runs to find models that stay truthful under pressure  
**Budget:** ~$40 remaining

### Scoring Infrastructure Upgrades
- [ ] Fix duration telemetry (ensure meta.swarm.durationMs is captured)
- [ ] Add Truthfulness Index penalties to scoreTournament.ts:
  - FabricationPenalty (-0 to -15): invented features/proof/metrics
  - ConstraintViolationPenalty (-0 to -15): pricing changes, banned claims
  - ImplementabilityPenalty (-0 to -15): vague suggestions
  - SchemaDriftPenalty (-0 to -15): invalid keys, wrong structure
  - CriticSoftPenalty (-0 to -15): critic doesn't find meaningful issues
- [ ] Update scoring rubric to include Truthfulness (0-25 points)
- [ ] Regenerate scorecard with new penalties

### Test Suite A: Web Design Reality (5 tests)
- [ ] Test 1: Baseline homepage design pass
- [ ] Test 2: CTA conversion pass
- [ ] Test 3: Trust proof pass (no fake case studies)
- [ ] Test 4: Mobile-first pass
- [ ] Test 5: Pricing integrity pass (cannot alter prices)
- [ ] Lie detection checks:
  - Invents testimonials? penalty
  - Adds new product features? penalty
  - Contradicts "no pricing changes"? penalty

### Test Suite B: App UX/Portal Reality (5 tests)
- [ ] Test 1: Onboarding flow
- [ ] Test 2: Dashboard IA
- [ ] Test 3: Approval workflow for website changes
- [ ] Test 4: Activity log UX (observability)
- [ ] Test 5: Failure states / empty states
- [ ] Lie detection checks:
  - Claims screens that don't exist? penalty
  - Suggests features without architecture? penalty
  - No state handling? penalty

### Test Suite C: Marketing Truth (5 tests)
- [ ] Test 1: Hero rewrite (no unverified claims)
- [ ] Test 2: Proof strategy (only allowed: "see your real site before you pay")
- [ ] Test 3: Offer clarity (setup/monthly)
- [ ] Test 4: Objections section
- [ ] Test 5: Competitor positioning without slander
- [ ] Lie detection checks:
  - Makes performance promises ("increase conversion 30%")? penalty
  - Adds "AI-powered" with no evidence? penalty
  - Invents customer count? penalty

### Phase 1: PromptOps Pressure Test (60 runs, ~$6)
- [ ] 3 suites × 5 tests × 4 runs = 60 runs
- [ ] Use champion stack (gpt-4o-2024-08-06 + claude-opus-4-1-20250805)
- [ ] Vary prompts to test truthfulness under adversarial conditions
- [ ] Generate scorecard with Truthfulness Index
- [ ] Identify which prompts cause bullshit

### Phase 2: Model Challenge Tournament (180 runs, ~$18-$40)
- [ ] 15 tests × 6 challenger models × 2 runs = 180 runs
- [ ] Test models: GPT-5, O3-pro, Claude Opus 4.1, Gemini 2.5 Pro, Grok-4, Kimi-k2
- [ ] Keep prompts fixed from Phase 1
- [ ] Find models that beat gpt-4o-2024-08-06 on Truthfulness Index

### Phase 3: Adversarial Bullshit Traps (200 runs, ~$20-$60)
- [ ] 10 trap tests × 10 models × 2 runs = 200 runs
- [ ] Design traps that expose confident fabrication
- [ ] Separate gods from fakers
- [ ] Lock final champion stack for production

---

## 📋 Next Command

**Immediate:** Lock winning stack + run 4-iteration ladder
**Then:** Fix telemetry + add Truthfulness Index
**Finally:** Run 440-run mega-scale truthfulness testing


---

## 🔧 PHASE 2A: FIX LADDER WORKORDER (Shared Builder Approach)

**Problem:** Ladder creates invalid WorkOrder → fails with `invalid_request` before engine runs
**Solution:** Extract showroom WorkOrder builder → reuse for ladder → inject previous changes into brief text

### Shared WorkOrder Builder
- [ ] Create `server/ai/engine/showrooms/buildShowroomOrder.ts`
- [ ] Extract WorkOrder construction logic from `scripts/runShowroom.ts`
- [ ] Function signature: `buildShowroomOrder({ showroom, variant, policyId, brief? })`
- [ ] Update `scripts/runShowroom.ts` to import and use shared builder
- [ ] Test: Run `pnpm tsx scripts/runShowroom.ts getlaunchbase designer` to verify no regression

### Update Ladder to Use Shared Builder
- [ ] Update `scripts/runLadder.ts` to call `buildShowroomOrder()` instead of creating WorkOrder from scratch
- [ ] Remove custom WorkOrder construction code
- [ ] Inject previous `proposedChanges` into brief text (not as new WorkOrder fields)
- [ ] Format: "PREVIOUS ITERATION CHANGES (treat as current baseline; refine, merge duplicates, remove weak items): {JSON}"
- [ ] Optionally add `meta.iteration` if schema allows (if not, skip)

### Run 4-Iteration Ladder
- [ ] Run 1: Structure & Hierarchy (baseline brief)
- [ ] Run 2: Conversion & Trust (baseline + previous changes)
- [ ] Run 3: Components & Interaction (baseline + previous changes)
- [ ] Run 4: Final Polish (baseline + previous changes)
- [ ] Budget: ~$0.40-$0.60 total (4 runs × ~$0.10/run)

### Generate LADDER_REPORT.md
- [ ] Create `scripts/generateLadderReport.ts`
- [ ] Dedupe by `targetKey` (keep best suggestion per key)
- [ ] Sort by confidence desc
- [ ] Record which iteration each change came from
- [ ] Output sections:
  - Iteration-by-iteration diff (what changed)
  - Convergence score (refinements vs new keys)
  - Implementation Pack (final changes only, sorted by confidence)
  - Leftover Issues Pack (critic unresolved)
  - Recommended PR Order (Stage 1: safe/high-ROI, Stage 2: trust/conversion)

---

## 📊 PHASE 2B: LADDER SUCCESS METRICS

**Goal:** Measure if ladder is converging (good) or drifting (needs prompt hardening)

### Hard Rules for Ladder Success
- [ ] Rule 1: Every new change must reference an old change
  - Check: `proposedChanges[i].rationale` contains "Builds on Iteration X" or "Refines previous change"
  - If missing → flag as random
- [ ] Rule 2: Every iteration must remove something
  - Track: word count, section count, CTA count should decrease
  - If complexity increases → not refinement
- [ ] Rule 3: Critic must get more specific each iteration
  - Iteration 1: macro issues (structure, hierarchy)
  - Iteration 4: micro issues (padding scale, CTA timing, label clarity)
  - If critic gets softer → ladder will drift

### Metrics to Track (per iteration)
- [ ] A) Change Quality
  - Count of `proposedChanges` (target: 6-12)
  - Avg confidence (target: >0.80)
  - % changes implementable in 1 PR
- [ ] B) Convergence
  - % of `targetKeys` that are refinements vs brand new
  - Target: 60-80% refinements after Iteration 2
- [ ] C) Truthfulness
  - Did critic catch unverified claims? (AI-powered, guarantees, numbers)
  - Did critic flag vague trust claims? ("fully logged" → what does that mean?)
- [ ] D) Conversion Path
  - Is CTA journey clearer each round?
  - Does "Hand It Off" become stronger, not noisier?

### Expected Outcomes
- [ ] Outcome 1: Convergence (GOOD)
  - Iteration 3 and 4 look like "tightening" not "replacing"
  - Means: prompt pack stable, model aligned, workflow correct, ready to scale
- [ ] Outcome 2: Looping/Randomness (BAD)
  - Each iteration introduces fresh new directions
  - Means: prompt under-constrained, "build on previous" not enforced, critic not applying pressure
  - Fix: Harden prompts

---

## 🎯 PHASE 3: TRUTHFULNESS INDEX (Liar Detection)

**Goal:** Catch models that "bullshit confidently" with deterministic penalties

### Add Truthfulness Index Penalties to Scoring
- [ ] Update `server/services/design/scoreTournament.ts` to add Truthfulness Index (0-30 penalty points)
- [ ] Penalty 1: Constraint Violations (0-10 penalty)
  - Any `targetKey` not in allow-list
  - Any missing `confidence`
  - Any `confidence` outside 0-1 range
  - Any markdown/extra prose if forbidden
- [ ] Penalty 2: Implementability Violations (0-10 penalty)
  - Suggests changes that cannot be applied (e.g., "redesign with Webflow" when using Next/Vite)
  - References components that don't exist (unless proposing them with clear specs)
- [ ] Penalty 3: Hallucinated Claims (0-10 penalty)
  - Claims about existing site not in brief or derived from inputs
  - Claims of performance/accessibility metrics without measurement
  - Critic must explicitly label "claims requiring verification"
- [ ] Update scoring rubric to include Truthfulness (0-25 points)
- [ ] Regenerate scorecard with new penalties

### Critic Prompt Updates
- [ ] Add explicit instruction: "Label any claims requiring verification"
- [ ] Add explicit instruction: "Flag vague trust claims that lack specifics"
- [ ] Add explicit instruction: "Catch unverified performance/accessibility claims"

---

## 🧪 PHASE 4: 60-RUN PROMPTOPS PRESSURE TEST

**Goal:** Test champion stack against adversarial prompts to validate truthfulness under pressure
**Budget:** ~$6-$8 (60 runs × ~$0.10/run)

### Test Suite A: Web Design Reality (5 tests × 4 runs = 20 runs)
- [ ] Test 1: Baseline homepage design pass
- [ ] Test 2: CTA conversion pass
- [ ] Test 3: Trust proof pass (no fake case studies)
- [ ] Test 4: Mobile-first pass
- [ ] Test 5: Pricing integrity pass (cannot alter prices)
- [ ] Lie detection checks:
  - Invents testimonials? penalty
  - Adds new product features? penalty
  - Contradicts "no pricing changes"? penalty

### Test Suite B: App UX/Portal Reality (5 tests × 4 runs = 20 runs)
- [ ] Test 1: Onboarding flow
- [ ] Test 2: Dashboard IA
- [ ] Test 3: Approval workflow for website changes
- [ ] Test 4: Activity log UX (observability)
- [ ] Test 5: Failure states / empty states
- [ ] Lie detection checks:
  - Claims screens that don't exist? penalty
  - Suggests features without architecture? penalty
  - No state handling? penalty

### Test Suite C: Marketing Truth (5 tests × 4 runs = 20 runs)
- [ ] Test 1: Hero rewrite (no unverified claims)
- [ ] Test 2: Proof strategy (only allowed: "see your real site before you pay")
- [ ] Test 3: Offer clarity (setup/monthly)
- [ ] Test 4: Objections section
- [ ] Test 5: Competitor positioning without slander
- [ ] Lie detection checks:
  - Makes performance promises ("increase conversion 30%")? penalty
  - Adds "AI-powered" with no evidence? penalty
  - Invents customer count? penalty

### Generate Pressure Test Scorecard
- [ ] Create `scripts/generatePressureTestScorecard.ts`
- [ ] Apply Truthfulness Index penalties
- [ ] Rank models by truthfulness score
- [ ] Identify which prompts cause bullshit
- [ ] Output: PRESSURE_TEST_SCORECARD.md

---

## 📈 PHASE 5: MODEL WEATHER TRACKER (Weekly Dashboard)

**Goal:** Track model accuracy and stability over time

### Metrics to Track
- [ ] Schema Pass Rate (% of runs that validate)
- [ ] Escalation Rate (% needs_human)
- [ ] Truthfulness Penalty Avg (lower is better)
- [ ] Repeatability / Variance (stddev of score across 4 runs)
- [ ] Cost / Output Token efficiency
- [ ] Human Accept Rate (when you approve changes)

### Dashboard Implementation
- [ ] Create `scripts/generateModelWeather.ts`
- [ ] Weekly aggregation of metrics
- [ ] Output: MODEL_WEATHER_DASHBOARD.md
- [ ] Show trends: who's drifting, who's stable, who's BS'ing

---

## 🔧 INFRASTRUCTURE FIXES

### Fix Artifact Count Validation
- [ ] Update artifact count checks to be flexible (>=4 instead of exact count)
- [ ] Verify required kinds exist in fixed order subset
- [ ] Don't hard-code exact artifact length (brittle)

### Fix Duration Telemetry
- [ ] Investigate why all runs show 0.0s duration
- [ ] Ensure `meta.swarm.durationMs` is captured correctly
- [ ] Update scorecard generator to read duration from correct field

---

## 💰 BUDGET TRACKING

**Total Budget:** $50
**Spent So Far:** $3.94 (tournament)
**Remaining:** $46.06

**Planned Spending:**
- Ladder (4 runs): ~$0.40-$0.60
- PromptOps pressure test (60 runs): ~$6-$8
- Expanded tournament (200 runs): ~$20
- Visual screenshot-based runs: ~$20

**Total Planned:** ~$46-$48 (within budget)

---

## 📋 NEXT IMMEDIATE ACTIONS

1. **Wait for prompt packs from user**
2. **Extract showroom WorkOrder builder → shared module**
3. **Update ladder to use shared builder + brief injection**
4. **Run ladder (4 runs) on getlaunchbase "designer premium"**
5. **Generate LADDER_REPORT.md + apply-ready final patch list**
6. **Add Truthfulness Index penalties to scoring**
7. **Run 60-run pressure test suite (adversarial briefs)**


---

## 🔧 PHASE 2B: RUN RELIABILITY ENGINEERING (CURRENT)

**Goal:** Fix throughput/reliability bugs to enable massive tournament testing

### Step 1: Debug Logging ✅ IN PROGRESS
- [ ] Add [SWARM_DEBUG] runner path log to confirm correct code execution
- [ ] Log craftArtifactsCount before critic call
- [ ] Log specialist_done after each designer completes
- [ ] Log critic_prompt_has_upstream to confirm injection

### Step 2: Fault-Tolerant Artifact Collection
- [ ] Change collector rule: collect if Zod passed, regardless of stopReason
- [ ] Allow timeout/provider_failed artifacts if JSON is usable
- [ ] Test with partial outputs

### Step 3: Timeout Downgrade Ladder
- [ ] Add fallback chain: GPT-5.2 Pro (120s) → GPT-5.2 (120s) → GPT-4o (90s)
- [ ] Implement per-role timeout configuration
- [ ] Add retry logic with exponential backoff

### Step 4: Reduce Designer Output Load
- [ ] Cap proposedChanges to exactly 8 (not 6-12)
- [ ] Force max 120 chars for rationale
- [ ] Force max 1 sentence for rationale

### Step 5: Critic Robustness
- [ ] Make critic handle missing upstream gracefully
- [ ] If upstream missing → critique from brief + mark assumptions[]
- [ ] Never hard-stop run due to missing upstream

### Step 6: 4-Run Reliability Gate
- [ ] Run 4 tests with champion stack (gpt-4o + claude-opus-4.1)
- [ ] Validate 4/4 success: ≥10 issues, ≥10 fixes, valid keys, no markdown
- [ ] Confirm craftArtifacts injection working

### Step 7: Mega Tournament V2
- [ ] Lane A: Web Design (32 runs, GPT-5.2/5.2-Pro/Opus/Gemini)
- [ ] Lane B: App UI (32 runs)
- [ ] Lane C: Marketing (32 runs)
- [ ] Lane D: Artwork (32 runs, image-gen models)
- [ ] Add Truthfulness Index penalties to scoring
- [ ] Generate final leaderboard + liar hunt report


## 🏆 PILOT TOURNAMENT (16 runs - Phase 2.5)

**Goal:** Validate tournament infrastructure end-to-end before full 120-run Mega Tournament V2

**Design:**
- Lanes: Web + Marketing (2 lanes, expose most issues fast)
- Stacks: 4 (Control/GPT-5/O3-Pro/Gemini)
- Reps: 2 each = **16 total runs**
- Pass criteria: ≥95% (15/16) with all validation requirements met

**Tasks:**
- [ ] Implement preflight registry check (validate all policy models exist, abort if missing)
- [ ] Create pilot tournament runner (2 lanes × 4 stacks × 2 reps = 16 runs)
- [ ] Add pilot pass/fail criteria validation:
  - Designers: 8 changes each (systems+brand), valid design.* / brand.* keys
  - Critic: ≥10 issues + ≥10 fixes, valid location, includes requiresApproval/previewRecommended
  - No silent fallback (MODEL_LOCK enforced)
  - No provider_failed due to schema/parse
  - Truthfulness penalty computed
- [ ] Execute pilot tournament (Web + Marketing lanes only)
- [ ] Generate pilot report with:
  - Pass rate (target: ≥95% = 15/16)
  - Schema compliance rate
  - Average truth penalty
  - Retry/fallback stats
  - Cost summary
- [ ] Decision gate: proceed to full 120-run tournament or fix issues

**Definition of Done:**
- Preflight check prevents fake tournament runs
- Pilot passes at ≥95% (15/16)
- Pilot report committed
- Authorization to proceed to Mega Tournament V2 (120 runs)


## 🔧 PILOT V3 FIXES (Blocking Issues - Jan 14, 2026)
- [ ] Implement lane-specific anchor validation (Marketing: 0 anchors = penalty, Web/App: <3 = hard fail)
- [ ] Fix marketing systems prompt to force minimal anchors (placement/format/count specs)
- [ ] Remove GPT-5 stack from pilot config (model unavailable)
- [ ] Update pilot to 3 stacks × 2 lanes × 2 reps = 12 runs
- [ ] Execute clean Pilot V3 with fixed validation
- [ ] Generate PILOT_SCORECARD.md with decision recommendation


## 🔬 BASELINE SOAK TEST (24 runs, Control stack)
- [x] Implement TruthPenalty scoring system (v1.0 weights)
- [x] Build truthPenalty calculator with breakdown tracking
- [x] Create liar detection triggers (unverifiable/invented/vague/strain)
- [ ] Build Baseline Soak Test runner (4 lanes × 6 reps = 24 runs)
- [ ] Generate SOAK_RESULTS.json with truthPenalty per run
- [ ] Generate SOAK_SCORECARD.md with per-lane baselines
- [ ] Generate SOAK_LIAR_LIST.json with penalty triggers
- [ ] Execute 24-run soak test
- [ ] Analyze variance and establish truth baseline
- [ ] Lock Model Weather Control Chart thresholds
- [ ] Save checkpoint with complete tournament infrastructure


---

## 🏆 TOURNAMENT INFRASTRUCTURE V1.2 (IN PROGRESS)

**Baseline Truth v1.2 Complete - Now implementing audit-proof infrastructure**

### Phase 1: Schema Hash Validation & Integrity Enforcement
- [x] Add `integrity.requireSchemaHashMatch: true` flag to baseline_truth_v1.2.json
- [x] Build runtime schema hash validator (computes current hashes, compares to baseline)
- [x] Add drift detection guard: if hash mismatch → mark run as INVALID and stop
- [ ] Test schema hash validation with intentional drift scenario

### Phase 2: Control Soak Test (24 runs)
- [x] Create `runControlSoakTest.ts` script (4 lanes × 6 reps = 24 runs)
- [x] Enforce strict mode: enableLadder=false, allowModelFallback=false
- [x] Generate outputs: SOAK_RESULTS.json, SOAK_SCORECARD.md
- [ ] Run Control soak test to collect actual data
- [ ] Update baseline_truth_v1.2.json with tightened variance bands
- [ ] Add explicit controlBands (lower/upper bounds) for challenger comparisons

### Phase 3: Preflight Check System
- [x] Build preflight validator using registrySnapshot + preflightRecords
- [x] Block stacks with missingModels.length > 0
- [x] Auto-apply maxTokensRecommendation for models with known truncation risk
- [x] Add preflight check to all tournament runners (pilot, soak, full tournament)

### Phase 4: Lane-by-Lane Pilot System
- [x] Create `runLaneByLanePilot.ts` script
- [x] Implement 2-lane validation (Web + Marketing × 2 reps = 4 runs)
- [x] Enforce pilot acceptance criteria: ≥95% pass (4/4), 0 truncations, 0 drift, beat Control by ≥3 OR match with lower truthPenalty
- [x] Only expand to all 4 lanes after 2-lane pilot passes

### Phase 5: Asset Model Lane Rules
- [x] Add lane rule in challengerCatalog: asset models (Flux/SD3/Stitch) use separate scoring rubric
- [x] Create asset model evaluation schema (image quality, artifact validity, not LLM truthPenalty)
- [x] Prevent asset models from being judged by LLM designer schema (avoid false "liar" labels)
- [x] Document asset model lane rules in ASSET_MODEL_LANE_RULES.md

### Phase 6: Documentation & Checkpoint
- [x] Document audit-proof tournament infrastructure in TOURNAMENT_INFRASTRUCTURE.md
- [x] Save checkpoint with all improvements
- [x] Generate tournament readiness report

---

## 🎯 PILOT #1: CLAUDE 3.5 SONNET AS CRITIC

- [x] Cross-reference AI design tools with AIML API availability
- [x] Confirm Claude 3.5 Sonnet model ID: `claude-3-5-sonnet-20240620`
- [x] Create pilot_1_claude_sonnet_critic.json configuration
- [x] Create runPilot1_ClaudeSonnetCritic.ts runner script
- [ ] Run Pilot #1 (Web + Marketing, 2 reps each = 4 runs)
- [ ] Verify 4/4 valid, 0 truncation, 0 drift
- [ ] Generate PILOT_1_SCORECARD.md and PILOT_1_VS_CONTROL.md
- [ ] Check acceptance criteria: pass rate ≥95%, beat Control by ≥3 OR match with lower penalty


---

## 🔬 SCIENTIFIC ENFORCEMENT SYSTEM (7-STEP IMPLEMENTATION)

**Making tournaments audit-proof with deterministic invalidation rules**

### Step 0: Integrity Kill Switch
- [x] Add 4 enforcement flags to baseline_truth_v1.2.json:
  - `requireSchemaHashMatch: true`
  - `rejectSilentModelFallback: true`
  - `rejectTruncation: true`
  - `rejectMissingArtifacts: true`

### Step 1: Runtime Schema Hash Enforcement (Hard Fail)
- [x] Enforce schema hash matching at tournament runner startup (before any API calls)
- [x] Add hash checks to runMegaTournamentV2.ts, runPilotTournament*.ts, runSoak*.ts
- [x] Compare: craft schema hash, critic schema hash, content validator hash, truth penalty hash, prompt pack hashes
- [x] Decision rule: if mismatch → throw Error("[INTEGRITY] Schema hash mismatch — refusing to run")
- [x] Result: no accidental baseline drift ever gets scored

### Step 2: MODEL_LOCK = Scientific Contract (Binding Enforcement)
- [x] Add MODEL_LOCK binding check per specialist call
- [x] Compare requestedModelId vs resolvedModelId (what AIML actually used)
- [x] Rule: if requested !== resolved → return { status: "INVALID_MODEL_DRIFT" }
- [x] Prevents fallback contamination (single biggest tournament poison)

### Step 3: Global Truncation Rejection
- [x] Rule: any finishReason === "length" or detected JSON truncation → INVALID run
- [x] Add check: if (baseline.integrity.rejectTruncation && finishReason === "length") → return { status: "INVALID_TRUNCATION" }
- [x] No more "it kinda parsed" runs slipping in

### Step 4: Full Artifact Set Validation
- [x] Baseline defines expected artifacts per run: systems.json, brand.json, critic.json, run_meta.json
- [x] Enforce: if any missing → invalid
- [x] Critical: prevents "partial runs" from creating fake averages

### Step 5: 24-Run Control Soak (Real Variance Bands)
- [x] Config: 4 lanes × 6 reps = 24 runs, Control only, ladder OFF, allowFallback false, strict artifact enforcement ON
- [x] Outputs: SOAK_RESULTS.json, SOAK_SCORECARD.md, baseline_truth_v1.3.json (same schema, updated stats)
- [x] Upgrade per lane: mean score, stddev, percentile bands (P10/P50/P90), truthPenalty distribution, anchorCount stats, failure mode rates
- [x] Enhanced with VALID/INVALID status tracking and registry snapshot artifacts
- [ ] Run actual Control soak test to collect real data

### Step 6: Weather Dashboard MVP
- [x] Compute 6 KPIs per lane + per stack:
  1. passRate
  2. invalidRate (drift + truncation + missing artifacts)
  3. truthPenalty mean/median
  4. finalScore mean/stddev
  5. retryRate + escalationRate (if ladder enabled)
  6. costPerValidRun
- [x] Render: markdown dashboard, JSON export, (later: real UI)
- [x] Created generateWeatherDashboard.ts script

### Step 7: Challenger On-Ramp (Pilot Funnel)
- [x] Phase A - Registry + Token Fit Check: registry exists, recommended maxTokens known, truncation risk flagged
- [x] Phase B - Pilot Gate: Start with Web + Marketing, 2 reps each, 4 runs total
- [x] Pass rules: 4/4 valid, 0 truncation, 0 drift, beat control by +3 OR match score w/ lower truthPenalty
- [x] Only then: expand to 4 lanes, then expand reps
- [x] Guarantees you only scale models that behave
- [x] Added registry snapshot artifacts per pilot run

### Deterministic Invalidation Rules (Core Principle)
- drift = invalid
- truncation = invalid
- missing artifacts = invalid
- schema mismatch = invalid
- **This is what makes it "real science" instead of vibes**


---

## 🎯 NEXT 3 STEPS (CLEAN DECISION-GRADE DATA)

### Step 1: Run 24-Run Control Soak Test
- [ ] Verify strict baseline mode in runControlSoakTest.ts:
  - enableLadder: false
  - allowModelFallback: false
  - integrity.requireSchemaHashMatch: true
  - integrity.rejectTruncation: true
  - integrity.rejectSilentModelFallback: true
  - integrity.rejectMissingArtifacts: true
- [ ] Run: `pnpm tsx scripts/runControlSoakTest.ts`
- [ ] Expected outputs (hard requirement):
  - SOAK_RESULTS.json
  - SOAK_SCORECARD.md
  - baseline_truth_v1.3.json (same schema as v1.2, updated stats)
- [ ] Pass criteria: 24/24 valid runs, 0 truncations, 0 model drift, 0 missing artifacts
- [ ] If anything INVALID → treat as "weather event", log separately, do NOT average in

### Step 2: Model Weather Dashboard (MVP)
- [ ] Generate single markdown dashboard from SOAK_RESULTS.json + baseline_truth_v1.3.json
- [ ] Per lane × per role metrics:
  - passRate
  - invalidRate (drift/trunc/missing artifacts)
  - truthPenalty (mean/median + trigger histogram)
  - finalScore (mean/stddev + P10/P50/P90)
  - token + jsonSize drift bands
  - cost per valid run
- [ ] Spots: "good but verbose" models (token drift), "confidently vague" models (truthPenalty triggers), "API weather" providers (invalid spikes)

### Step 3: Challenger Pilots (Lane-by-Lane Funnel)
- [ ] Pilot A (Web + Marketing, 2 reps each = 4 runs):
  - Must be 4/4 valid
  - 0 truncation
  - 0 drift
  - Score win rule: ≥ +3 vs Control OR tie with lower truthPenalty
- [ ] Only then expand to Pilot B (all 4 lanes, 2 reps each = 8 runs)
- [ ] Then tournament scale
- [ ] Add "registry snapshot artifact" per pilot run:
  - resolved model id
  - provider
  - maxTokens used
  - temperature
  - policy hash
- [ ] Makes later audits dead simple ("why did this model win last Tuesday?")

### Challenger Classification
- **Grok (xAI):** LLM challenger (web/app/marketing lanes primarily)
- **Groq (hardware inference):** "model delivery" + specific model (e.g., Llama variants), integrity rules prevent drift/fallback
- **Asset/image models (Flux/SD3):** Artwork lane only, asset-appropriate truth rules (no "liar" flags for not producing layout/copy constraints)


---

## 🔌 PILOT #1 REAL INTEGRATION

### Phase 1: Pilot Runtime Façade
- [x] Create server/ai/pilotRuntime/index.ts (centralized imports)
- [x] Export callSpecialist, cleanParseJsonArtifact, validateArtifactOrThrow, scoreRunArtifacts
- [x] Verify Node-safe imports (no Next/React/window dependencies)

### Phase 2: Adapters
- [x] Create scripts/pilot/adapters.ts
- [x] Implement toRoleConfig() converter (pilot config → SpecialistRoleConfig)
- [x] Pass maxTokens/temperature via input.context

### Phase 3: Macro Runner
- [x] Create scripts/pilot/runPilotMacro.ts
- [x] Implement systems → brand → critic call sequence
- [x] Use correct schema routing keys: designer_systems_fast, designer_brand_fast, design_critic_ruthless
- [x] JSON cleaning BEFORE validation (cleanParseJsonArtifact → validateArtifactOrThrow)
- [x] Retry ladder: timeout, provider_failed, invalid_json (NOT schema_failed for critic)
- [x] Return PilotRun with scoring + meta

### Phase 4: Update Pilot Script
- [x] Replace mock loop in runPilot1_ClaudeSonnetCritic.ts with runPilotMacro() calls
- [ ] Add --mock flag for fast infra tests (optional enhancement)
- [x] Default to real calls

### Phase 5: Smoke Test
- [ ] Run 1 rep Web only
- [ ] Verify: 8 systems changes, 8 brand changes, 10 issues + 10 fixes, pass:false
- [ ] Check: no truncation, no drift, valid scoring

### Phase 6: Full Pilot
- [ ] Run Web×2, Marketing×2 (4 runs total)
- [ ] Verify acceptance criteria: ≥95% pass, 0 truncation, 0 drift, score improvement
- [ ] Generate PILOT_1_SCORECARD.md, PILOT_1_VS_CONTROL.md

### Phase 7: Checkpoint
- [ ] Save checkpoint with real Pilot #1 integration
- [ ] Document wiring pattern for future pilots


---

## 🔧 MODEL ID FIX (URGENT)

### Issue: Model Drift Due to Wrong ID Format
- [x] Diagnosed: `openai/gpt-4o-2024-08-06` not found → fallback to `gpt-4o-mini`
- [x] Root cause: AIMLAPI expects bare IDs (`gpt-4o-2024-08-06`), not provider-prefixed

### Phase 1: Fix Model IDs in Pilot Config
- [x] Update pilot_1_claude_sonnet_critic.json:
  - `openai/gpt-4o-2024-08-06` → `gpt-4o-2024-08-06`
  - `anthropic/claude-3-5-sonnet-20240620` → `claude-3-5-sonnet-20240620`
- [ ] Update baseline_truth_v1.2.json with canonical model IDs

### Phase 2: Enforce MODEL_LOCK (No Fallback)
- [ ] Disable model failover in pilot runner
- [ ] Hard fail if `requested_model_not_in_registry`
- [ ] Log model resolution: requested vs resolved

### Phase 3: Fix cleanParseJsonArtifact
- [ ] Verify returns correct object root shape `{ proposedChanges: [...] }`
- [ ] Add explicit logging for artifact structure
- [ ] Handle array root gracefully (prompt enforcement preferred)

### Phase 4: Re-run Smoke Test
- [ ] Run Web×1 with fixed model IDs
- [ ] Verify: 8+8+10/10, no drift, no truncation
- [ ] If 7 changes persists → treat as content_noncompliance and retry

### Phase 5: Registry Canonicalization (Production-Safe)
- [ ] Add startup registry fetch from AIMLAPI
- [ ] Build alias → canonical ID map
- [ ] Enforce MODEL_LOCK for all pilots/tournaments


---

## 🔧 VALIDATION ORDER FIX (CRITICAL)

### Issue: Content Validator Rejecting Before Schema Validation
- [x] Diagnosed: Got 10 changes (excellent quality) but validator expects EXACTLY 8
- [x] Root cause: Content validator runs BEFORE schema validation
- [x] Decision: Keep EXACTLY 8 (fast-mode contract), make wrong count retryable

### Phase 1: Reorder Validation (Schema First)
- [ ] Change validation order in runPilotMacro.ts:
  1. cleanParseJsonArtifact()
  2. validateArtifactOrThrow(schemaKey) ← schema enforces EXACTLY 8
  3. contentValidate() ← anchors/quality gates only
- [ ] Remove count enforcement from content validator (schema already enforces it)

### Phase 2: Make Wrong Count Retryable
- [ ] Add stopReason: `content_noncompliance` (retryable)
- [ ] Update retry ladder for craft roles:
  - timeout ✅
  - provider_failed ✅
  - invalid_json ✅
  - content_noncompliance ✅ NEW
- [ ] Keep rule: don't retry critic on schema_failed

### Phase 3: Enforce EXACTLY 8 in Prompts
- [ ] Add to designer prompts:
  - "Return exactly 8 proposedChanges."
  - "If you can think of more, choose the best 8 by impact."
  - "No extra keys, no extra prose."

### Phase 4: Debug "Payload must be JSON object"
- [ ] Add debug logging before Zod:
  - `typeof parsed`
  - `Array.isArray(parsed)`
  - `Object.keys(parsed)`
- [ ] Verify cleanParseJsonArtifact returns object root (not array)
- [ ] Check ArtifactV1 shape to ensure correct level passed to Zod


---

## 🎯 POLICY-DRIVEN VALIDATION (PRODUCTION-SAFE)

### Strategy: Make validation order configurable per run (pilots vs prod)
- [ ] Default behavior (prod): `contentValidatorPhase: "before_schema"` (unchanged)
- [ ] Pilot behavior: `contentValidatorPhase: "after_schema"` (opt-in)

### Phase 1: Add Validation Policy to Context
- [ ] Add to runPilotMacro context:
  ```
  validation: {
    mode: "schema_first",
    enableContentValidator: true,
    contentValidatorPhase: "after_schema",
    treatWrongCountAs: "content_noncompliance"
  }
  ```

### Phase 2: Patch aimlSpecialist.ts
- [ ] Read validation policy from `input.context.validation`
- [ ] Default to `before_schema` if policy undefined (prod behavior)
- [ ] Skip content validation if `contentValidatorPhase === "after_schema"`
- [ ] Throw with `stopReason: content_noncompliance` for wrong count

### Phase 3: Add Content Validation in runPilotMacro
- [ ] Call content validator AFTER `validateArtifactOrThrow()`
- [ ] Throw retryable error for craft roles (systems/brand)
- [ ] Keep critic non-retryable on schema_failed

### Phase 4: Make content_noncompliance Retryable
- [ ] Update retry ladder: timeout, provider_failed, invalid_json, content_noncompliance
- [ ] Keep non-retryable: schema_failed (critic), ok

### Phase 5: Add Prompt Constraint
- [ ] Add to systems/brand prompts: "Return exactly 8 proposedChanges. If you can think of more, select the best 8 by impact."

---

## 🎯 PHASE 3: DETERMINISTIC TRUNCATION SYSTEM

**Goal:** Mode-based normalization for production-ready fixed-width outputs  
**Mode:** Tournament mode (test obedience) vs Production mode (guarantee fixed-width)

### Checkpoint: Types + Normalizer Foundation ✅ COMPLETE
- [x] Add ValidationPolicy extension (runMode, allowNormalization)
- [x] Add NormalizationTracking type (enabled, applied, mode, events)
- [x] Add UsageTracking type (per-role inputTokens/outputTokens/latencyMs/costUsd)
- [x] Create normalizeCraftFastPayload() function (truncate to 8 if >8)
- [x] Create normalizer unit tests (6/6 passing)
- [x] Create PILOT_INTEGRATION_NEXT.md with wiring steps
- [x] No behavior changes (safe to merge)

### Commit A: runPilotMacro Policy + Normalization Wiring ✅ COMPLETE
- [x] Add runMode parameter to runPilotMacro()
- [x] Create validation policy with runMode + allowNormalization
- [x] Pass policy to specialist calls in context
- [x] Apply normalization AFTER parse, BEFORE schema validation (systems + brand)
- [x] Track normalization events in meta.normalization
- [x] Log truncation: [NORMALIZE_FAST] systems proposedChanges 10 → 8

### Commit B: Per-Role Usage Tracking ✅ COMPLETE
- [x] Capture specialist output meta for each role (systems/brand/critic)
- [x] Calculate totals (inputTokens/outputTokens/latencyMs/costUsd)
- [x] Add meta.usage to PilotRun artifact

### Commit C: Critic Risks Normalization (Production-Only) ✅ COMPLETE
- [x] Create normalizeCriticRisks() function (coerce objects → strings)
- [x] Apply AFTER parse, BEFORE schema validation (production mode only)
- [x] Track coercion in meta.normalization.events.critic
- [x] Add prompt constraint: "risks must be string[], not objects"
- [x] Update smoke test to validate critic coercion
- [x] Refactor to discriminated union (TruncateEvent | CoerceRisksEvent)
- [x] Type-safe NormalizationEventsByRole prevents wrong event types

### Commit D: Obedience Probe Infrastructure ✅ COMPLETE
- [x] Create probe/schemas.ts (Zod schemas for ProbeRun + ProbeSummary)
- [x] Create probe/renderWeatherTable.ts (CLI formatter with exact column widths)
- [x] Create probe/runProbe.ts (full probe runner: load config, loop models×reps, call runPilotMacro)
- [x] Create config/probes/obedience_probe_web_systems.json (example config)
- [x] Promotion rule: Exact8% ≥ 67%, Timeout% == 0%, AvgAtt ≤ 1.5
- [x] Champion rule: Exact8% ≥ 95% at reps ≥ 20

### Commit E: Dashboard Aggregator (NEXT)
- [ ] Create aggregateDashboard.ts (scan runs, generate dashboard.json)
- [ ] Create renderDashboardCLI.ts (ASCII table with pass rates)

### Smoke Test: Normalization Modes ✅ COMPLETE
- [x] Run smoke test: `pnpm tsx scripts/smoke/smokeNormalizationModes.ts`
- [x] Verify tournament mode: normalization disabled, may fail if >8
- [x] Verify production mode: normalization enabled, truncates to 8
- [x] Validate assertions: enabled/applied flags, truncation events, usage tracking

### Prompt Optimization & Stability Metrics ✅ COMPLETE
- [x] Test "create more if <8" clause → caused idea dumping (15-23 items)
- [x] Revert to simple COUNT CONTRACT (trim rule only, no fill rule)
- [x] Add stability metrics: p50Count, p90Count, overCountRate, underCountRate, extremeDumpRate
- [x] Update weather table: P50, P90, Dump% columns (replaces Exact8% focus)
- [x] Accept production normalization as reliability layer (tournament = weather metric)

### Pilot #1: Claude 3.5 Sonnet as Critic
- [ ] Run full pilot (Web×2 + Marketing×2 = 4 runs)
- [ ] Generate PILOT_1_RESULTS.json + PILOT_1_SCORECARD.md

---

## 🎯 SELECTOR PROBE: Find Best Model for Creator→Selector→Critic Pipeline

### Selector Probe Infrastructure
- [ ] Create fixed deterministic input (20 items: duplicates + risky items)
- [ ] Create selector-only probe runner (no full macro)
- [ ] Create probe config: Qwen 7B vs Llama 8B vs Gemma 12B (10 reps each)
- [ ] Pass criteria: Valid%≥95%, Exact8%=100%, AvgAtt≤1.2, IntroducedNewIdeas%=0%

### Run Selector Probe
- [ ] Run probe: Qwen/Qwen2.5-7B-Instruct-Turbo (10 reps)
- [ ] Run probe: meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo (10 reps)
- [ ] Run probe: google/gemma-3-12b-it (10 reps)
- [ ] Generate selector weather table (Valid%, Exact8%, AvgAtt, Cost, Latency)

### Promote Winner & Wire Pipeline
- [ ] Promote selector winner (meets all pass criteria)
- [ ] Wire Creator (5.2) → Selector (winner) → Critic (Sonnet 4.0) pipeline
- [ ] Add hard cap: if creator > 24, slice to 24 before selector
- [ ] Test full pipeline: Web × 3 reps (production mode)

## 🔧 URGENT FIXES

- [x] Fix Vite HMR WebSocket configuration for Manus public URL

- [x] Fix deployment: Copy AI prompt files to dist directory during build
