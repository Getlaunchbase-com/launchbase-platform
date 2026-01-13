# LaunchBase TODO

**Status:** 🟢 Constitutional Layer Frozen — Phase 1.1 In Progress  
**Version:** b930c6cf  
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

### ✅ Extraction Logic Hardened (COMPLETE)
- [x] Shape-tolerant extraction (DecisionCollapse.selectedProposal OR CopyProposal.variants[0])
- [x] Strict validation (rejects null/undefined, allows falsy-valid values)
- [x] No error logging that could leak prompts/provider errors
- [x] Customer-safe stopReason vocabulary enforced

---

## 🚀 PHASE 1.1: Weekly Metrics Report (Read-Only)

**Goal:** Produce a single, immutable markdown report that reflects the truth of system behavior  
**Mode:** SQL-first, read-only, no writes, no dashboards, no interpretation  
**Rule:** Observe only. No behavior changes. No auto-tuning.

**Enterprise Principle:** Truth before tooling. Dashboards lie before schemas stabilize.

### 🔐 Hard Guardrails (Non-Negotiable)
- ❌ No writes to DB
- ❌ No schema changes
- ❌ No new tables
- ❌ No dashboards
- ❌ No interpretation text
- ❌ No prompt content ever

- ✅ Read-only SQL
- ✅ Deterministic markdown
- ✅ Human-readable
- ✅ Git-friendly

### Gate 1: Missing Test Coverage ✅ COMPLETE
- [x] Extracted proposal selection into pure helper functions
- [x] Created unit tests for both extraction paths (DecisionCollapse + CopyProposal)
- [x] 19 unit tests passing for extraction logic
- [x] 4 service tests passing for aiTennisCopyRefine
- [x] Verified customer-safe contract (no prompt leakage)
- [x] Total: 23 tests passing

### Gate 2: Weekly Report Script ✅ COMPLETE
- [x] Created `scripts/generateWeeklyAiReport.ts`
- [x] Created `scripts/_weeklyAiReportMarkdown.ts` (markdown builder)
- [x] Wired up 6 canonical SQL queries from `AI_METRICS_QUERIES.md`
- [x] Implemented WoW delta calculations (placeholders for now)
- [x] Applied anomaly thresholds (warn/critical flags)
- [x] Generated markdown report: `reports/ai_weekly_2026-01-12.md`
- [x] Tested locally on development database
- [x] First report artifact produced (71 lines, 2.0 KB)
- [x] Ready for human review and commit

**Report Structure (Frozen - Do Not Reorder):**
1. Header (metadata: version, build SHA, timestamp, environment)
2. Executive Snapshot (numbers only, no commentary)
3. stopReason Distribution (drift canary)
4. needsHuman Rate (protocol fit)
5. Cost per Approval (primary cost signal)
6. Approval Rate (business friction)
7. Idempotency Health (cache hit + stale takeover)
8. Raw Query Provenance (link to AI_METRICS_QUERIES.md)

**Anomaly Thresholds (Frozen):**
| Metric | Warn | Critical |
|--------|------|----------|
| provider_failed rate | > 5% | > 10% |
| ajv_failed rate | > 2% | > 5% |
| needsHuman rate | > 15% | > 25% |
| cost per approval Δ | > +10% | > +20% |
| approval rate drop | > -5pp | > -10pp |
| cache hit rate | < 85% | < 75% |
| stale takeover | > 3% | > 5% |

### Gate 3: Dev/### Gate 3: Snapshot Workflow Doc ✅ COMPLETE
- [x] Created `docs/DEV_STAGING_SNAPSHOT_WORKFLOW.md`
- [x] Documented schema-only and masked snapshot workflows
- [x] Defined read-only rules for production (no seeding, no cleanup)
- [x] Added hard guardrails (env checks) that abort in prod
- [x] Included incident response protocol
- [x] Referenced FOREVER CONTRACT §8 (No Production Seeding)# ✅ Completion Criteria for Phase 1.1
This phase is complete only when:
- [ ] Gate 1: Missing test coverage added and passing
- [ ] Gate 2: Script runs successfully and produces markdown report
- [ ] Gate 2: First report reviewed by human
- [ ] Gate 2: Report committed to repo
- [ ] Gate 3: Snapshot workflow doc created and reviewed
- [ ] No follow-up actions taken (observe only)

**Only then do we proceed to Phase 2 (Learning Loop).**

---

## 🚫 BLOCKED UNTIL PHASE 1.1 COMPLETE

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

**Note:** These errors do not block Phase 1.1 work. Fix only if time permits.

---

## 🧠 Strategic Insight

**You've separated learning from execution.**

- **Execution** = Deterministic, safe, boring (good)
- **Learning** = Slow, deliberate, human-governed

This enables scaling trust and cost efficiency simultaneously.

**The weekly report is the keel of the ship.**

Before dashboards. Before optimization. Before pricing changes. Before swarm AI. Before customer UI changes.

**Truth first. Always.**

---

## 📋 Next Command

When ready to proceed:
- `"Implement Gate 1: Add DecisionCollapse.selectedProposal test"`
- `"Implement Gate 2: Generate weekly report script"`
- `"Implement Gate 3: Create snapshot workflow doc"`

We proceed one clean gate at a time.


---

## ✅ Phase 1.1 Progress Update (January 12, 2026)

### Empty-Data Fix COMPLETE
- [x] Added denominators to SQL queries (totalRequests)
- [x] Added HAVING clauses to filter empty periods  
- [x] Implemented denominator checks in markdown builder
- [x] Show "N/A" when denominator is 0 (no false flags)
- [x] Added canonical helper functions: `toRate()`, `flagLowRate()`, `flagHighRate()`
- [x] No-data banner shows when no AI Tennis proposals found
- [x] Cache hit rate: N/A with "—" flag (not 0% with 🚨)
- [x] Approval rate: N/A with "—" flag (not 0% with 🚨)
- [x] Stale takeover rate: N/A with "—" flag

### Next: Real Workflow Test
- [ ] Run 1 real copy refine request on staging
- [ ] Verify ActionRequest created with rawInbound.aiTennis metadata
- [ ] Re-run weekly report and confirm metrics populate correctly
- [ ] Commit final checkpoint with all Phase 1.1 gates complete

---

## 📋 Phase 1.2: WoW Deltas + Report Contract Lock

**Status:** Ready to start (Phase 1.1 complete)

**Goal:** Turn the weekly report into a learning engine using real data and WoW deltas. Still no UI, no dashboards, no new tables.

### 1. Real Workflow Test on Staging (First "Live" Datapoint)
**Goal:** Produce one real AI Tennis proposal end-to-end and confirm it shows up in the weekly report.

**Checklist:**
- [ ] Trigger `actionRequests.aiProposeCopy` with a real-ish prompt
- [ ] Verify new ActionRequest is created
- [ ] Verify `rawInbound.aiTennis` has all required fields (traceId, jobId, rounds, models, requestIds, usage, costUsd, stopReason, needsHuman, confidence)
- [ ] Verify `rawInbound.proposal` includes rationale/confidence/risks/assumptions
- [ ] Run weekly report script → confirm non-empty denominators + no false flags
- [ ] Commit the generated report from staging (or paste output) + "first datapoint verified" note

**Deliverable:** Generated report from staging + verification note

### 2. WoW Delta Calculations (Replace Placeholders) ✅ COMPLETE
**Goal:** Same 6 metrics, two windows: Current 7d (now-7d → now) + Prior 7d (now-14d → now-7d)

**Implementation:**
- [x] Add prior 7d window queries to `generateWeeklyAiReport.ts`
- [x] Compute absolute delta (pp for rates, $ for cost)
- [x] Compute relative delta (optional)
- [x] Update section renderers to show: this week, last week, delta
- [x] Apply anomaly flags using deltas + absolute thresholds (per Drift Protocol)
- [x] Added canonical helpers: `deltaPct()`, `flagHighNumber()`, `toDollarsPerApproval()`, `getWindows()`
- [x] Refactored SQL queries to return numerator/denominator instead of precomputed rates
- [x] Created current/prior query pairs for all 4 rate metrics
- [x] Updated renderers to use `toRate()` + `deltaPct()` + canonical flag helpers
- [x] Tested report generation: produces correct N/A behavior on empty data

**Deliverable:** Report sections show real WoW deltas with proper flags ✅

### 3. Lock "Report Contract" (Prevent Drift)
**Goal:** Freeze metric definitions so they can't drift accidentally

**Add Report Contract section:**
- [ ] Metric names frozen (6 canonical metrics)
- [ ] Denominator rules frozen (N/A when denominator = 0)
- [ ] Flag rules frozen (warn/critical thresholds)
- [ ] Output path frozen (`reports/ai_weekly_<YYYY-MM-DD>.md`)

**Deliverable:** Doc block at top of script OR `docs/AI_WEEKLY_REPORT_CONTRACT.md`

### 4. Safe Synthetic Seeding for Local/Dev (Optional but High Leverage)
**Goal:** Devs can validate report formatting without touching prod/staging

**Implementation:**
- [ ] Create `scripts/seedAiTennisTestData.ts` that refuses production (env check)
- [ ] Generate N proposals across 3 stopReasons with realistic distributions
- [ ] Ensure denominators > 0 so flags can be seen/tested
- [ ] Create `scripts/cleanupAiTennisTestData.ts` for cleanup
- [ ] Add doc snippet explaining safe seeding workflow

**Deliverable:** Seed script + cleanup script + doc snippet

---

## 🎯 Momentum Rule (Prevent Invisible Progress)

Every change must end in one of these artifacts:
1. **Passing tests summary** (e.g., "23/23 tests passing")
2. **Generated report markdown** (committed or pasted)
3. **Doc update that freezes a contract** (e.g., FOREVER_CONTRACTS.md)

**No "invisible progress."**
