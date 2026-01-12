# LaunchBase TODO

**Status:** 🟢 Production Live & Operational  
**Version:** 11a16467  
**Last Updated:** January 12, 2026

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

### ✅ Test Suite Guarantees (Continuously Verified)
- [x] 26 tests passing (18 idempotency + 8 router)
- [x] No silent AI drift (every deviation produces stopReason)
- [x] No cost amplification (retry storms mathematically impossible)
- [x] No prompt/data leakage (canary tests prove clean trails)
- [x] Deterministic learning surface (same inputs → same outputs or cached)

**Strategic Insight:**
> **You've separated learning from execution.**
> - Execution = Deterministic, safe, boring (good)
> - Learning = Slow, deliberate, human-governed
> 
> This enables scaling trust and cost efficiency simultaneously.

---

## 🚀 PHASE 5: Learning-Ready, Drift-Safe Execution

**Goal:** Start learning from real usage without changing AI behavior  
**Mode:** SQL-first using existing tables/logs before adding any new metrics table  
**Rule:** Observe only. No behavior changes. No auto-tuning.

**Enterprise Principle:** Truth before tooling. Dashboards lie before schemas stabilize.

### 🚫 What We Do NOT Do Yet
- ❌ No auto-optimizing prompts
- ❌ No reinforcement learning
- ❌ No silent retries
- ❌ No "AI decides to change itself"
- ❌ No new `drift_metrics` table (until SQL-first proves we need it)

### Step 1: Canonical Metrics Queries (SQL-First) ✅ COMPLETE

**Status:** Schema-Correct, Pending Data Emission

**Marching orders:** Produce `docs/AI_METRICS_QUERIES.md` first; everything else depends on it.

- [x] **Create `docs/AI_METRICS_QUERIES.md`** with 4 required signals:
  
  - [ ] **1. stopReason distribution** (drift canary)
    ```sql
    SELECT
      JSON_EXTRACT(rawInbound, '$.aiTennis.stopReason') AS stopReason,
      COUNT(*) as count
    FROM action_requests
    WHERE messageType = 'AI_TENNIS_COPY_REFINE'
    GROUP BY stopReason;
    ```
  
  - [ ] **2. needsHuman rate** (protocol mismatch detector)
    ```sql
    SELECT
      COUNT(*) AS total,
      SUM(JSON_EXTRACT(rawInbound, '$.aiTennis.needsHuman') = true) AS needs_human
    FROM action_requests
    WHERE messageType = 'AI_TENNIS_COPY_REFINE';
    ```
    > If this climbs, you have protocol mismatch, not model failure.
  
  - [ ] **3. Cost per approval** (only cost number that matters)
    ```sql
    SELECT
      AVG(JSON_EXTRACT(rawInbound, '$.aiTennis.costUsd')) AS avg_cost
    FROM action_requests
    WHERE status IN ('applied','confirmed');
    ```
  
  - [ ] **4. Cache hit rate** (idempotency health)
    ```sql
    SELECT
      COUNT(*) AS total,
      SUM(JSON_EXTRACT(response_json, '$.cached') = true) AS cache_hits
    FROM idempotency_keys
    WHERE scope = 'actionRequests.aiProposeCopy'
      AND status = 'succeeded';
    ```
    > Low cache hit ≠ bad. Rising cache hit over time = customers trusting + retrying safely.
  
  - [x] Include time window variants (24h / 7d / 30d)
  - [x] Include "by tenant" variants

**Hard rule:** No new `drift_metrics` table unless SQL-first proves we cannot reliably compute signals from existing data.

**✅ Queries are frozen by contract and will be validated once AI Tennis endpoint emits `rawInbound.aiTennis`.**

**Dependency:** Metrics queries cannot be executed until AI Tennis endpoint writes `rawInbound.aiTennis`. This is an intentional dependency that prevents:
- Dashboard-driven definition drift
- Mocking metrics with fake data
- Premature aggregation tables
- Learning from test data instead of real customer interactions

### Step 2: Minimal Safe Event Emission (NEXT - Wire AI Tennis Endpoint)

**Status:** Ready to implement

**Goal:** Wire AI Tennis endpoint to emit `rawInbound.aiTennis` (minimum viable emission)

**Scope Boundaries (DO NOT EXPAND):**
- ❌ No new tables
- ❌ No dashboards
- ❌ No aggregation
- ❌ No metrics table
- ✅ Just correct, immutable facts in existing `action_requests` table

#### 2.1: Wire AI Tennis Endpoint ✅ COMPLETE

**Status:** Endpoint emits metrics-complete, customer-safe `rawInbound.aiTennis`. stopReason derivation temporary; propagation deferred to Step 2.2.

- [x] **Confirm `actionRequests.aiProposeCopy` mutation exists:**
  - [x] tRPC mutation exists in `actionRequestsRouter`
  - [x] Loads ActionRequest + Intake for tenant
  - [x] Calls `aiTennisCopyRefine()` service
  - [x] Creates ActionRequest(s) with `rawInbound` containing:
    - `rawInbound.aiTennis` (job-level meta)
    - `rawInbound.proposal` (customer-facing)
  - [x] Logs `AI_PROPOSE_COPY` event
  - [x] Returns customer-safe response (no prompts, no provider errors)

- [x] **ActionRequest includes `rawInbound.aiTennis`:**
  - [x] `traceId` (string) - opaque trace identifier
  - [x] `jobId` (string) - job identifier
  - [x] `rounds` (number) - number of AI Tennis rounds
  - [x] `models` (string[]) - models used
  - [x] `requestIds` (string[]) - provider request IDs
  - [x] `usage` (object) - `{ inputTokens, outputTokens }`
  - [x] `costUsd` (number) - total cost in USD
  - [x] `stopReason` (string) - canonical outcome signal (derived from success state)
  - [x] `needsHuman` (boolean) - escalation flag
  - [x] `confidence` (number, optional) - confidence score

- [x] **ActionRequest includes `rawInbound.proposal`:**
  - [x] `targetKey` (string) - checklist key being updated
  - [x] `value` (string) - proposed value
  - [x] `rationale` (string) - why this value
  - [x] `confidence` (number) - confidence score
  - [x] `risks` (string[]) - **MUST be array**
  - [x] `assumptions` (string[]) - **MUST be array**

- [x] **Security contracts guaranteed:**
  - [x] No prompts stored
  - [x] No provider errors stored
  - [x] No stack traces stored
  - [x] `stopReason` used everywhere (no "reason" field)

- [x] **Unit tests passing (9/9):**
  - [x] Router returns customer-safe contract
  - [x] Idempotency works (cached response)
  - [x] No internal details leaked
  - [x] Test aligned to responsibility boundaries (unit-style, not integration)

#### 2.2: Validate Metrics Queries Against Real Data

- [ ] **Run canonical SQL queries against real rows:**
  - [ ] At least one succeeded run (`stopReason = 'ok'`)
  - [ ] At least one failed run (`stopReason = 'provider_failed'` or similar)
  - [ ] At least one `needsHuman = true` scenario
  - [ ] At least one cached/idempotency hit

- [ ] **Confirm JSON paths work:**
  - [ ] `$.aiTennis.stopReason` extracts correctly
  - [ ] `$.aiTennis.costUsd` extracts correctly
  - [ ] `$.aiTennis.needsHuman` extracts correctly
  - [ ] `$.aiTennis.rounds` extracts correctly
  - [ ] `$.aiTennis.traceId` extracts correctly
  - [ ] Idempotency fields (`response_json.cached`, `attempt_count`) work

- [ ] **Fix any JSON path mismatches:**
  - [ ] If paths don't match, fix data shape at write-time
  - [ ] Do NOT change query semantics ad hoc
  - [ ] Update `buildAiTennisMeta()` if needed

### Step 3: Weekly Review Script (ONLY AFTER Step 2 Complete)

**Status:** Blocked until endpoint emits real data

**Goal:** Automate query execution with WoW comparison and threshold-based anomaly flagging

- [ ] **Create weekly review script:**
  - [ ] Run 6 canonical queries from `AI_METRICS_QUERIES.md`
  - [ ] Compare WoW (Week over Week) deltas for 4 required signals
  - [ ] Flag anomalies (>threshold from `AI_DRIFT_PROTOCOL_V1.md`):
    - Cost ↑ +25% WoW → Investigate models/prompts
    - Approval ↓ −15% WoW → Review prompt/schema
    - needsHuman ↑ +20% WoW → Tighten constraints
    - ajv_failed ↑ >2% → Immediate rollback
  - [ ] Output markdown report for manual review
  - [ ] **No dashboard** - just script output
  - [ ] Store script in `server/scripts/weeklyDriftReview.ts`

### Step 4: Weekly Learning Ritual (Human-in-the-Loop)

**This is where Field General earns their keep.**

- [ ] **Establish weekly review process:**
  - [ ] Review 4 metrics from script output
  - [ ] Pull 5 real ActionRequests
  - [ ] Ask for each:
    1. Why did this need human?
    2. What assumption failed?
    3. Was the prompt wrong — or the constraint?
  - [ ] Output:
    - 1 learning note
    - 0 or 1 proposed change
  - [ ] If change proposed → new version, new tests, explicit diff
  - [ ] **No silent edits. Ever.**

### Step 5: Showroom Learning (4 Sites Strategy)

**Use real sites as learning surface - this is gold:**
- LaunchBase site (our own)
- 3 GPT/Manus-built showroom sites
- Beta customers (when available)

- [ ] **For each site, run same task across:**
  - [ ] Base tier
  - [ ] Upgraded tier
  - [ ] Compare:
    - stopReason
    - rounds
    - approvals
    - human overrides

- [ ] **This becomes:**
  - Customer-facing truth
  - Internal tuning evidence
  - Sales proof without marketing lies

- [ ] **Answer key questions:**
  - [ ] Where do humans override AI proposals?
  - [ ] Where do approvals stall?
  - [ ] Which sections trigger needsHuman?
  - [ ] What patterns predict approval?

- [ ] **Document learnings:**
  - [ ] Create `docs/AI_LEARNING_NOTES.md` (non-binding, observational)
  - [ ] Propose prompt pack changes (versioned)
  - [ ] Propose protocol updates (versioned)
  - [ ] Test changes before deployment

### Step 6: Thin Internal Metrics Page (LAST - Only After SQL Feels Boring)

**Rules for this page:**
- Internal only
- Read-only
- No filters that change meaning
- No live updates
- No "AI score"
- If the page breaks, the system must still be trustworthy

**Just:**
- [ ] Charts over time
- [ ] Counts
- [ ] Percentages
- [ ] Links to underlying ActionRequests

### Step 7: Customer UI (Thin Shell - AFTER Showroom Learning)

**Rule:** Purely reflective. No hidden logic. Customer trail only.

- [ ] **Inbox view:**
  - [ ] List pending proposals
  - [ ] Show rationale + confidence
  - [ ] Approve/Edit buttons
- [ ] **Decision view:**
  - [ ] Show proposal details
  - [ ] Show AI reasoning (customer trail only, never internal)
  - [ ] Show confidence score
- [ ] **Audit trail view:**
  - [ ] Show proposal history
  - [ ] Show approvals/edits timeline
  - [ ] Show confidence evolution
- [ ] **No advanced controls** (keep it thin)

---

### 🎯 Where You Are Now (Reality Check)

You now have:
- ✅ A constitutional AI platform
- ✅ A cost-safe learning loop
- ✅ A trust-preserving audit trail
- ✅ A system that can grow without eating itself

**Most teams never get here.**

### 🚫 Frozen Until Drift Visibility Exists

**No new AI behavior until real usage is observed:**
- ❌ No new AI roles
- ❌ No new prompts (without versioning)
- ❌ No tier expansion
- ❌ No feature expansion
- ❌ No auto-tuning or model switching

**Rule:** Drift is detected by change over time, never absolute values.

---

## 📚 Documentation Status

### Constitutional Layer (FROZEN - v1.0)
- [x] `docs/FOREVER_CONTRACTS.md` - 7 constitutional guarantees
- [x] `docs/AI_DRIFT_PROTOCOL_V1.md` - Operational discipline
- [x] `docs/IDEMPOTENCY_KEYS.md` - Idempotency implementation

### To Create (Next Phase)
- [x] `docs/AI_METRICS_QUERIES.md` - Canonical SQL queries for 4 required signals ✅ **COMPLETE (Schema-Correct, Pending Data Emission)**
- [ ] `docs/AI_LEARNING_NOTES.md` - Non-binding observational learnings
- [ ] `docs/SHOWROOM_STRATEGY.md` - How to use 4 sites as baselines

---

## 🎯 AI TENNIS ORCHESTRATION (Complete)

### ✅ Step 2.2 - PromptPack Registry (COMPLETE)
- [x] PromptPack registry with versioning (v1)
- [x] 4 task types: intent_parse, generate_candidates, critique, decision_collapse
- [x] JSON-only enforcement in all prompts
- [x] Schema validation with Ajv
- [x] Memory transport fixtures for testing
- [x] 12/12 validation tests passing

### ✅ Step 2.3 - ModelRouter (COMPLETE)
- [x] ModelRegistry with TTL cache (433 models loaded)
- [x] Background refresh every 10 minutes
- [x] ModelPolicy with task-based filtering
- [x] Automatic failover routing
- [x] Express endpoints: /internal/models, /internal/resolve-model, /admin/models/refresh
- [x] 13/13 tests passing (registry, policy, router)

### ✅ Step 2.4 - AI Tennis Orchestrator (COMPLETE)
- [x] `runAiTennis.ts` implemented with generate → critique → collapse
- [x] Token budget enforcement (maxTokensTotal, maxTokensPerCall)
- [x] Cost cap enforcement (costCapUsd)
- [x] needsHuman early exit
- [x] Schema validation at every phase
- [x] Strict ModelRouter mode (no silent fallback)
- [x] **Trace-based seeding implemented** (no prompt-hash brittleness)
- [x] **All 12 tests passing** (8 orchestrator + 4 service tests)
- [x] **Wildcard matching for unpredictable jobIds**

### ✅ Step 2.5 - Prompt Secrecy Hardening (COMPLETE)
- [x] `server/ai/security/redaction.ts` - Safe error/preview utilities
- [x] `completeJson()` patched with strict router mode + safe error handling
- [x] `buildCompleteJsonResult()` patched to remove rawTextPreview
- [x] `aimlProvider.ts` patched with sanitized error logging
- [x] Zero prompt leakage in logs/errors
- [x] Trace IDs are opaque (no user content)

### ✅ Step 2.6 - First Use Case Wiring (COMPLETE)
- [x] **Add `aiProposeCopy` mutation to actionRequestsRouter**
  - Loads ActionRequest + Intake for tenant
  - Calls `aiTennisCopyRefine()` service
  - Logs `AI_PROPOSE_COPY` event
  - Returns customer-safe response (no prompts, no provider errors)
- [x] **Add response contract** (`AiProposeCopyResponseSchema`)
  - `ok`, `createdActionRequestIds`, `traceId`, `needsHuman`, `stopReason`
  - Zod-validated enum for stopReason
  - No prompt content ever included
- [x] **Add `AI_PROPOSE_COPY` to event types enum**
- [x] **Database migration applied** (0022_boring_nocturne.sql)
- [x] **Standardized on `stopReason` field** (FOREVER CONTRACT)
  - Updated `AiCopyRefineResult` type to use `stopReason` instead of `reason`
  - All service return statements now use `stopReason`
  - Router reads `service.stopReason` directly (no fallback needed)
  - Added `needsHuman` to failure branch of type
  - Rule: "All AI orchestration outcomes MUST surface as stopReason at the service boundary. reason is forbidden in exported types."

### ✅ Step 2.7 - Enterprise-Grade Idempotency (COMPLETE)
- [x] **Nonce-based ownership guard** (precision-proof, prevents lost updates)
- [x] **Response sanitization** (allowlist-based, no prompts/errors leaked)
- [x] **Stale takeover policy** (5-minute threshold, prevents stuck operations)
- [x] **HMAC-SHA256 key derivation** (prevents key guessing attacks)
- [x] **TTL-based cleanup** (24-hour default, documented cleanup job)
- [x] **26/26 tests passing** (18 idempotency + 8 router)
- [x] **Red-team security review passed**
- [x] **Documentation complete** (`docs/IDEMPOTENCY_KEYS.md`)

**Docs Created:**
- [x] `docs/TRACE_BASED_SEEDING.md` - Trace-based test seeding pattern
- [x] `docs/FOREVER_CONTRACTS.md` - Constitutional guarantees
- [x] `docs/AI_DRIFT_PROTOCOL_V1.md` - Operational discipline
- [x] `docs/IDEMPOTENCY_KEYS.md` - Idempotency implementation

---

## 🔥 CRITICAL (Do First)

### Production Stability Verification
- [x] Verify intake form works (tested, working)
- [x] Verify database storage (intake ID 2 exists)
- [x] Verify email delivery (2 confirmation emails received)
- [ ] Monitor production for 24 hours:
  - [ ] Check `/admin/health` for errors
  - [ ] Check `/admin/alerts` for incidents  
  - [ ] Verify cron jobs running (cron-job.org)
  - [ ] Verify Stripe webhooks arriving (`/admin/stripe-webhooks`)

### Facebook Integration (80% → 100%)
- [x] Facebook OAuth flow built
- [x] Webhook receiver built with signature verification
- [x] Message/lead form notifications built
- [x] Facebook Settings page built
- [x] Admin Drafts page built
- [x] 7 tests passing
- [ ] **Configure Facebook App webhook subscription:**
  1. [ ] Go to Facebook Developers Console
  2. [ ] Add webhook URL: `https://www.getlaunchbase.com/api/facebook/webhook`
  3. [ ] Set verify token: `launchbase_fb_webhook_2026`
  4. [ ] Subscribe to `messages` and `leadgen` fields
  5. [ ] Add permissions: `pages_messaging`, `pages_manage_metadata`, `leads_retrieval`
- [ ] **Set environment variables:**
  - [ ] `FB_APP_ID` (from Facebook App)
  - [ ] `FB_APP_SECRET` (from Facebook App)
  - [ ] `FB_WEBHOOK_VERIFY_TOKEN=launchbase_fb_webhook_2026`
- [ ] **Test end-to-end:**
  - [ ] Send message to Facebook Page → verify email arrives
  - [ ] Submit lead form → verify email arrives
  - [ ] Check server logs for errors

**Docs:** `docs/FACEBOOK_WEBHOOK_SETUP.md`

### ✅ Email Automation (COMPLETE)
- [x] Action request system built (Ask → Understand → Apply → Confirm)
- [x] Outbound emails with Approve/Edit buttons
- [x] Inbound webhook with intent classification
- [x] Proposed preview feature
- [x] Admin mutations (resend/expire/unlock/adminApply)
- [x] Batch approvals
- [x] Confidence learning
- [x] 12 tests passing
- [x] **Resend inbound DNS configured**
- [x] **Real email reply tested ("YES" from phone works)**
- [x] **Event chain verified: CUSTOMER_APPROVED → APPLIED → LOCKED**
- [x] **All 3 cron jobs verified and running**

**Status:** ✅ Production-ready, monitoring confidence learning metrics

---

## 🟢 IMPORTANT (Do Soon)

### Tier 1 Enhanced Presentation Observation
- [x] Design engine built (3 variants, deterministic scoring)
- [x] Admin observability card built
- [x] 5 FOREVER tests passing
- [ ] **Observe 3-5 real customers:**
  - [ ] Track metrics in `docs/tier1-observation-scorecard.md`
  - [ ] Measure: time to approval, edit rate, preview usage, confidence, human intervention
  - [ ] Duration: 1 week passive observation
- [ ] **Decide based on data:**
  - [ ] If faster + fewer edits → Ship at $149
  - [ ] If same/worse → Kill Tier 1
  - [ ] If unclear → Extend observation

**Docs:** `docs/tier1-observation-scorecard.md`, `docs/design-contract.md`

### Service Catalog Expansion (60% → 100%)
- [x] Service catalog infrastructure
- [x] Service summary builder
- [x] Itemized display (onboarding, email, preview)
- [x] FOREVER tests (pricing parity)
- [ ] **Add detailed service descriptions:**
  - [ ] Facebook Ads setup (what's included, timeline, deliverables)
  - [ ] Google Ads setup (what's included, timeline, deliverables)
  - [ ] QuickBooks integration (sync frequency, data types, automation)
  - [ ] Email service setup (provider, templates, automation)
  - [ ] Phone system setup (provider, features, call routing)
- [ ] **Create service-specific onboarding flows:**
  - [ ] Facebook Ads: ad account connection, budget, targeting
  - [ ] Google Ads: ad account connection, budget, keywords
  - [ ] QuickBooks: OAuth flow, data permissions, sync settings
- [ ] **Add service activation tracking:**
  - [ ] Track when each service goes live
  - [ ] Send activation confirmation emails
  - [ ] Update customer dashboard with service status

### Admin UI Polish
- [x] Health dashboard with tenant filtering
- [x] Stripe webhook monitor
- [x] Email monitoring
- [x] Alerts dashboard
- [x] Deployment controls with rollback
- [ ] **Add batch approval UI to Admin Drafts page:**
  - [ ] Checkbox selection for multiple drafts
  - [ ] "Approve Selected" button
  - [ ] Success/failure summary
- [ ] **Add confidence learning metrics to admin dashboard:**
  - [ ] Approval rate by checklist key
  - [ ] Edit rate by checklist key
  - [ ] Current confidence thresholds
  - [ ] Threshold adjustment history
- [ ] **Add action request history to intake detail:**
  - [ ] Show all action requests for intake
  - [ ] Show event timeline (SENT → APPROVED → APPLIED → LOCKED)
  - [ ] Show customer responses (approve/edit/unclear)

---

## 🚀 NEXT BIG THING: QuickBooks Integration

**Vision:** LaunchBase becomes the operating system for running your business by syncing with QuickBooks as the source of truth.

### Phase 1: Read-Only Sync (Week 1)
- [ ] **QuickBooks OAuth flow:**
  - [ ] Add QuickBooks OAuth routes
  - [ ] Store access tokens securely
  - [ ] Handle token refresh
  - [ ] Add connection status to customer dashboard
- [ ] **Read revenue data:**
  - [ ] Fetch last 90 days of revenue
  - [ ] Store in `quickbooks_sync` table
  - [ ] Calculate revenue trend (up/down/flat)
- [ ] **Read expense data:**
  - [ ] Fetch last 90 days of expenses
  - [ ] Store in `quickbooks_sync` table
  - [ ] Calculate expense trend
- [ ] **Calculate cash flow:**
  - [ ] Revenue - Expenses = Cash Flow
  - [ ] Classify: healthy (>30 days), watch (15-30 days), critical (<15 days)
  - [ ] Store classification in database
- [ ] **Display in admin dashboard:**
  - [ ] Add "Business Health" card
  - [ ] Show revenue trend chart
  - [ ] Show cash flow status
  - [ ] Show last sync timestamp

### Phase 2: Intelligence Integration (Week 2)
- [ ] **Add cash flow context layer to Intelligence Core:**
  - [ ] Create `CashFlowLayer` class
  - [ ] Integrate into decision pipeline
  - [ ] Add cash flow signals to scoring
- [ ] **Modify posting decisions based on cash flow:**
  - [ ] Cash flow critical → increase lead generation posts
  - [ ] Cash flow healthy → maintain normal cadence
  - [ ] Revenue spike → celebrate wins publicly
- [ ] **Add "Why we posted this" explanations:**
  - [ ] Reference QB data in decision logs
  - [ ] Show in admin observability panel
  - [ ] Include in customer dashboard
- [ ] **Test with Vince's Snowplow real data:**
  - [ ] Connect Vince's QuickBooks
  - [ ] Observe posting decisions for 1 week
  - [ ] Verify decisions align with business conditions

### Phase 3: Customer Visibility (Week 3)
- [ ] **Add "Business Health" card to customer dashboard:**
  - [ ] Revenue trend (last 90 days)
  - [ ] Cash flow status (healthy/watch/critical)
  - [ ] How LaunchBase is responding
- [ ] **Show LaunchBase actions based on QB data:**
  - [ ] "We increased posting frequency because cash flow dipped 15%"
  - [ ] "We're celebrating your revenue growth this month"
  - [ ] "We're staying quiet because you're in busy season"
- [ ] **Add sync status and controls:**
  - [ ] Last sync timestamp
  - [ ] "Sync Now" button
  - [ ] Connection health indicator

### Phase 4: Predictive Actions (Week 4)
- [ ] **Detect revenue dips → increase lead generation:**
  - [ ] Trigger when revenue down >10% month-over-month
  - [ ] Increase posting frequency by 50%
  - [ ] Focus on lead generation content
- [ ] **Detect busy seasons → reduce posting:**
  - [ ] Trigger when revenue up >20% month-over-month
  - [ ] Reduce posting frequency by 30%
  - [ ] Focus on operational updates
- [ ] **Detect growth → suggest service expansion:**
  - [ ] Trigger when revenue up >30% over 3 months
  - [ ] Suggest Google Ads or Facebook Ads
  - [ ] Send expansion opportunity email
- [ ] **Automated monthly business review:**
  - [ ] Generate monthly report with QB data
  - [ ] Include LaunchBase actions taken
  - [ ] Show correlation between actions and outcomes
  - [ ] Send via email with PDF attachment

**Success Metrics:**
- Customer says "LaunchBase knows my business better than I do"
- Posting decisions correlate with business outcomes
- Customers stop manually managing social media
- Churn drops because value is undeniable

**Docs to Create:**
- [ ] `docs/QUICKBOOKS_INTEGRATION.md` - Technical spec
- [ ] `docs/quickbooks-oauth-flow.md` - OAuth implementation guide
- [ ] `docs/cash-flow-intelligence.md` - Decision logic documentation

---

## 🔵 NICE TO HAVE (Do Later)

### Mobile App
- [ ] Customer dashboard mobile app
- [ ] Push notifications for urgent items
- [ ] Quick approval/edit from phone
- [ ] Business health at a glance

### Integrations
- [ ] Slack integration for admin alerts
- [ ] SMS notifications for customers
- [ ] Zapier integration for custom workflows
- [ ] API for third-party integrations

### Performance & Scale
- [ ] Add database indexes (already documented)
- [ ] Implement Redis caching for hot paths
- [ ] Add CDN for static assets
- [ ] Optimize preview generation speed

---

## 🐛 BUGS TO FIX

### TypeScript Errors (Non-Blocking)
- [ ] Fix scoreDesign.ts type errors (3 errors)
- [ ] Fix actionRequestSequencer.ts resendMessageId type error
- [ ] Run `pnpm tsc --noEmit` to verify fixes

### Console Errors (Non-Blocking)
- [ ] Investigate "Cannot convert undefined or null to object" errors
- [ ] Add null checks in affected code paths
- [ ] Add error boundaries to prevent crashes

---

## 📚 DOCUMENTATION NEEDED

- [x] WHERE_WE_ARE.md (complete status report)
- [x] NEVER_AGAIN.md (anti-patterns and rules)
- [x] SMOKE_TEST.md (pre-launch checklist)
- [x] how-launchbase-works.md (architecture overview)
- [x] FOREVER_CONTRACTS.md (constitutional guarantees)
- [x] AI_DRIFT_PROTOCOL_V1.md (operational discipline)
- [x] IDEMPOTENCY_KEYS.md (idempotency implementation)
- [ ] AI_METRICS_QUERIES.md (canonical SQL queries - FIRST)
- [ ] AI_LEARNING_NOTES.md (non-binding observational learnings)
- [ ] SHOWROOM_STRATEGY.md (how to use 4 sites as baselines)
- [ ] QUICKBOOKS_INTEGRATION.md (technical spec)
- [ ] quickbooks-oauth-flow.md (implementation guide)
- [ ] cash-flow-intelligence.md (decision logic)
- [ ] README.md (update with current architecture)

---

## ✅ RECENTLY COMPLETED

### Constitutional Layer (January 12, 2026)
- ✅ FOREVER_CONTRACTS.md - 7 constitutional guarantees (FROZEN v1.0)
- ✅ AI_DRIFT_PROTOCOL_V1.md - Operational discipline (FROZEN v1.0)
- ✅ Strategic shift to stabilization mode
- ✅ Test suite guarantees (26/26 passing)
- ✅ Separated learning from execution

### Enterprise-Grade Idempotency (January 12, 2026)
- ✅ Nonce-based ownership guards
- ✅ HMAC-SHA256 key derivation
- ✅ Response sanitization (allowlist-based)
- ✅ Stale takeover policy (5-minute threshold)
- ✅ 26 tests passing (18 idempotency + 8 router)
- ✅ Red-team security review passed

### AI Tennis Orchestration (January 12, 2026)
- ✅ PromptPack registry with versioning
- ✅ ModelRouter with automatic failover
- ✅ Trace-based seeding (no prompt-hash brittleness)
- ✅ Prompt secrecy hardening (zero leakage)
- ✅ stopReason standardization (FOREVER CONTRACT)
- ✅ 12 tests passing (orchestrator + service)

### Tier 1 Enhanced Presentation (January 11, 2026)
- ✅ Design engine with 3-variant generation
- ✅ Deterministic scoring system (8 signals)
- ✅ Admin observability card
- ✅ Fail-open architecture
- ✅ 5 FOREVER tests passing
- ✅ Complete documentation suite

### Service Summary System (January 11, 2026)
- ✅ Service catalog (server + client)
- ✅ Service summary builder
- ✅ Itemized display in 3 touchpoints
- ✅ FOREVER tests lock pricing parity
- ✅ Single source of truth architecture

### Production Verification (January 11, 2026)
- ✅ Intake form submission working
- ✅ Database storage verified (intake ID 2)
- ✅ Email delivery verified (2 confirmations)
- ✅ Diagnostic endpoint working
- ✅ Production URL: https://www.getlaunchbase.com

---

**🎯 Current Focus:** Phase 5 - SQL-first metrics plumbing → Weekly learning ritual → Showroom strategy

**📖 Full context:** See `WHERE_WE_ARE.md`
