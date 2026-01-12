# LaunchBase TODO

**Status:** 🟢 Production Live & Operational  
**Version:** 118331d6  
**Last Updated:** January 11, 2026

> **📖 See WHERE_WE_ARE.md for complete status report and vision**

---

## 🎯 AI TENNIS ORCHESTRATION (In Progress)

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
- [x] Test file created
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

### 📋 Next Steps (Reordered by Priority)
- [ ] **1. Idempotency table** (prevents double-spend on retries)
  - Create `idempotency_keys` table with `(tenant, scope, key)` unique constraint
  - Check key before calling AI Tennis
  - Store result with key after success
- [ ] **2. Wire customer UI** (call endpoint + display proposals)
  - Build inbox view for pending proposals
  - Display proposal + rationale + confidence
  - Approve/Edit buttons
- [ ] **3. Split trails** (internal vs customer in rawInbound - optional)
  - Internal: traceId, models[], requestIds[], costs, usage
  - Customer: sanitized proposal, rationale, confidence
- [ ] **4. Event meta schemas** (structured logging - optional)
  - Define schemas for customer UI display
- [ ] **5. Fix test seeding** (optional if memory provider works deterministically)
  - Update tests to seed complete `refineCopy` result shape

**Docs Created:**
- [x] `docs/TRACE_BASED_SEEDING.md` - Trace-based test seeding pattern
- [ ] `docs/AI_TENNIS_ENDPOINT.md` - Endpoint contract + usage guide
- [ ] `docs/STOP_REASON_CONTRACT.md` - stopReason field standardization (FOREVER CONTRACT)

**Docs to Create:**
- [ ] `docs/AI_TENNIS_ARCHITECTURE.md` - System design and flow
- [ ] `docs/PROMPT_SECRECY.md` - Security hardening rules
- [ ] `docs/MODEL_PHILOSOPHY.md` - Dynamic model discovery approach

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
- [ ] QUICKBOOKS_INTEGRATION.md (technical spec)
- [ ] quickbooks-oauth-flow.md (implementation guide)
- [ ] cash-flow-intelligence.md (decision logic)
- [ ] README.md (update with current architecture)

---

## ✅ RECENTLY COMPLETED

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

**🎯 Focus:** Complete Facebook + Email Automation → Observe Tier 1 → Build QuickBooks Integration

**📖 Full context:** See `WHERE_WE_ARE.md`

### 🚧 Step 2.7 - Production-Grade AI Tennis Infrastructure (In Progress)

**Phase 0: Freeze what's working**
- [ ] Add CHANGELOG.md entry for stopReason contract
  - Dated heading (January 12, 2026)
  - 3 bullets: stopReason standardization, prompt secrecy, trace-based seeding

**Phase 1: Idempotency (CRITICAL - must-have before customer UI)**
- [x] Create idempotency_keys table migration (0023 + 0024)
  - Fields: id, tenant, scope, keyHash (HMAC-SHA256), status (enum), responseJson, timestamps, attemptCount
  - Unique constraint: (tenant, scope, keyHash)
  - Indexes: expiresAt (cleanup), staleIdx (takeover)
  - TTL: expiresAt (24h)
- [x] Implement idempotency wrapper skeleton
  - Scope: "actionRequests.aiProposeCopy"
  - Atomic claim via INSERT + unique constraint
  - Stale takeover logic
  - Failure retry logic
- [x] Write unit tests (8/9 passing, concurrency test has syntax error)

**Phase 1.5: Security & Correctness Fixes (IN PROGRESS)**
- [ ] **Security fixes:**
  - [ ] Require IDEMPOTENCY_SECRET in production (throw if missing)
  - [ ] Hash userText before idempotency key (never include raw text)
  - [ ] No error.message storage (store only fingerprint + stopReason)
- [ ] **Correctness fixes:**
  - [ ] Add getRowsAffected() helper (supports rowsAffected/affectedRows/array)
  - [ ] Ownership guard on commit (track claimStartedAt, guard UPDATE)
  - [ ] Check UPDATE affected rows in takeover (only claim if 1 row updated)
- [ ] **Router fixes:**
  - [ ] Hash userText in router inputs (userTextHash, not raw)
  - [ ] No raw Error throws (return safe contract)
  - [ ] Add "in_progress" to stopReason enum
- [ ] **Tests:**
  - [ ] Fix concurrency test syntax error
  - [ ] Verify all 9 tests passing
  - [ ] Add test for ownership guard

**Phase 2: Two Audit Trails (internal vs customer)** (BLOCKED until Phase 1.5 complete)
- [ ] Define strict schema for rawInbound.aiTennis (job meta only, no prompts)
- [ ] Define customer-safe view model (what customer can see)
- [ ] Add helper: toCustomerAuditTrail(actionRequest, events)
  - Strips internal-only fields
  - Never includes: system prompts, provider errors/stack traces, requestId/model routing internals
- [ ] Write test asserting customer API never returns forbidden fields

**Phase 3: Endpoint Hardening (production sturdy)**
- [ ] Add rate limit per intake for aiProposeCopy mutation
- [ ] Require intakeId ownership (when auth enabled)
- [ ] Ensure router strict mode is mandatory (no bypass flag)
- [ ] Guard against AI_PROVIDER=memory in production
- [ ] Staging test: run AI Tennis against AIML for real intake without logging prompts

**Phase 4: Customer UI (thin shell)**
- [ ] Screen 1: Inbox (ActionRequests by intake)
- [ ] Screen 2: Decision (proposedValue + rationale + confidence + risks + approve/edit)
- [ ] Screen 3: Audit Trail (customer-safe events timeline)
- [ ] Gate: customer can trigger propose-copy, see proposals, approve, see audit trail update

**Phase 5: Documentation (prevent future drift)**
- [ ] Create docs/STOP_REASON_CONTRACT.md
  - Enum values + meaning
  - "Service boundary MUST emit stopReason"
  - Examples of router responses
- [ ] Create docs/AI_AUDIT_TRAILS.md
  - Internal trail (operators) vs Customer trail
  - Where stored (rawInbound.aiTennis, events meta)
  - Explicit "never store" list (prompts, provider errors)
- [ ] Add PR checklist item: "Any AI change updates relevant docs/tests"

**Design Decision:**
- ❌ Don't add proposal tables yet - use ActionRequests + rawInbound.aiTennis
- ✅ Add new table only when hitting real constraint (multiple proposals per key, heavy analytics)



---

## 🧭 AI DRIFT PROTOCOL V1 (Platform Stabilization)

> **Mode:** Stabilization + drift containment + learning extraction  
> **Goal:** Prevent silent AI degradation before adding surface area  
> **Status:** Documentation complete, metrics plumbing next

### ✅ Forever Contracts (COMPLETE)
- [x] `docs/FOREVER_CONTRACTS.md` - Constitutional guarantees
  - stopReason is the only outcome vocabulary
  - Prompt packs are immutable at runtime
  - Schema-or-fail discipline
  - Two audit trails (never cross the streams)
  - Idempotency ownership guards (nonce-based)

### ✅ Drift Protocol Documentation (COMPLETE)
- [x] `docs/AI_DRIFT_PROTOCOL_V1.md` - Operational discipline
  - Drift definition and detection rules
  - 4 containment layers (determinism, idempotency, visibility, escalation)
  - 4 required signals (cost, approval rate, needsHuman, stopReason)
  - Weekly review cadence
  - Field General governance rules

### 📋 Metrics Plumbing (Read-Only)
- [ ] **Create drift metrics queries:**
  - [ ] Cost per approved action: `SUM(estimatedUsd) / COUNT(approved)`
  - [ ] Approval rate: `COUNT(approved) / COUNT(proposals)`
  - [ ] needsHuman rate: `COUNT(needsHuman=true) / COUNT(total)`
  - [ ] stopReason distribution: Breakdown by enum value
  - [ ] Cache hit rate: `COUNT(cached=true) / COUNT(total)`
  - [ ] Stale takeover rate: `COUNT(attemptCount > 1) / COUNT(total)`
- [ ] **Add logging (no behavior change):**
  - [ ] Log drift signals on every AI Tennis run
  - [ ] Store in `drift_metrics` table (weekly aggregates)
  - [ ] No dashboards yet, just queryability
- [ ] **Create weekly review script:**
  - [ ] Compare WoW deltas for 4 required signals
  - [ ] Flag anomalies (>threshold)
  - [ ] Output markdown report

### 📋 Customer UI (Thin Shell)
- [ ] **Inbox view:**
  - [ ] List pending proposals
  - [ ] Show rationale + confidence
  - [ ] Approve/Edit buttons
- [ ] **Decision view:**
  - [ ] Show proposal details
  - [ ] Show AI reasoning (customer trail only)
  - [ ] Show confidence score
- [ ] **Audit trail view:**
  - [ ] Show proposal history
  - [ ] Show approvals/edits timeline
  - [ ] Show confidence evolution
- [ ] **No advanced controls yet** (keep it thin)

### 🚫 Frozen Until Drift Visibility Exists
- [ ] No new AI roles
- [ ] No new prompts
- [ ] No tier expansion
- [ ] No feature expansion

**Rule:** Drift is detected by change over time, never absolute values.

**Docs Created:**
- [x] `docs/FOREVER_CONTRACTS.md`
- [x] `docs/AI_DRIFT_PROTOCOL_V1.md`
- [x] `docs/IDEMPOTENCY_KEYS.md`

**Docs to Create:**
- [ ] `docs/DRIFT_METRICS_QUERIES.md` - SQL queries for drift signals
- [ ] `docs/SHOWROOM_STRATEGY.md` - How to use 4 sites as baselines
