# LaunchBase Master TODO

**Last Updated:** January 11, 2026  
**Production URL:** https://www.getlaunchbase.com  
**Version:** 118331d6  
**Status:** 🟢 LIVE & OPERATIONAL

---

## ✅ COMPLETE (Production Ready)

### Core Customer Flow
- [x] Intake form (`/apply`) - 8-step onboarding with service selection
- [x] Email confirmation - Multi-language (EN/ES/PL) × Multi-audience (biz/org)
- [x] Preview generation - Automatic build plan + preview token
- [x] Customer preview (`/preview/:token`) - Mobile-optimized approval page
- [x] Stripe checkout - Service-based pricing with itemized summary
- [x] Payment processing - Idempotent webhook handling with audit trail
- [x] Deployment queue - Worker-based deployment system
- [x] 221 tests passing (including 6 smoke tests)

### Email Automation System
- [x] Action request system (Ask → Understand → Apply → Confirm loop)
- [x] Outbound emails with Approve/Edit buttons
- [x] Inbound webhook with intent classification
- [x] Proposed preview feature ("View Proposed Preview" button)
- [x] Admin mutations (resend/expire/unlock/adminApply)
- [x] Batch approvals
- [x] Confidence learning system (auto-tunes thresholds)
- [x] Resend inbound DNS configured
- [x] Real email reply flow tested ("YES" from phone works)
- [x] Event chain verified: CUSTOMER_APPROVED → APPLIED → LOCKED
- [x] 12 passing tests (4 FOREVER + 3 E2E + 5 preview)

### Cron Automation
- [x] 3 cron endpoints verified and running:
  - [x] `/api/cron/run-next-deploy` (every 2 min)
  - [x] `/api/cron/auto-advance` (every 5 min)
  - [x] `/api/cron/alerts` (every 15 min)
- [x] Worker runs logging with UUID-based updates
- [x] Schema guard prevents 500 spam during deploy/migration timing
- [x] Alert system with fingerprint-based dedupe + auto-resolve

### Admin Infrastructure
- [x] Admin dashboard (`/admin`) - Intake management with status stepper
- [x] Health dashboard (`/admin/health`) - 24h metrics with tenant filtering
- [x] Stripe webhook monitor (`/admin/stripe-webhooks`) - Event tracking with retry visibility
- [x] Email monitor (`/admin/email-monitoring`) - Delivery stats + test sender
- [x] Alerts dashboard (`/admin/alerts`) - Active/resolved incidents with tenant filter
- [x] Deployment controls (`/admin/deployments`) - Queue management + one-click rollback

### Tier 1 Enhanced Presentation
- [x] Design engine with 3-variant generation
- [x] Deterministic scoring system (8 signals)
- [x] Admin observability card (read-only)
- [x] Fail-open architecture (errors never block preview)
- [x] 5 FOREVER tests passing (lock pricing parity)
- [x] Complete documentation suite

### Service Summary System
- [x] Service catalog (server + client)
- [x] Service summary builder with pricing parity
- [x] Itemized display in 3 touchpoints (onboarding, email, preview)
- [x] FOREVER tests lock pricing guarantees
- [x] Single source of truth architecture

---

## 🚧 IN PROGRESS

### Facebook Integration (80% Complete)
**What's Built:**
- [x] Facebook OAuth flow (`/api/facebook/oauth/start`, `/api/facebook/oauth/callback`)
- [x] Page connection system (`module_connections` table)
- [x] Webhook receiver (`/api/facebook/webhook`) with signature verification
- [x] Message notifications (email to vince@vincessnowplow.com)
- [x] Lead form notifications (email to vince@vincessnowplow.com)
- [x] Facebook Settings page (`/settings/facebook`)
- [x] Admin Drafts page (`/admin/drafts`)
- [x] Draft approval flow with safety rules
- [x] Facebook posting policy module (approval-first, daily caps, quiet hours)
- [x] 7 passing tests for webhook verification

**What's Missing:**
- [ ] Configure Facebook App webhook subscription in Developer Console
- [ ] Add webhook URL: `https://www.getlaunchbase.com/api/facebook/webhook`
- [ ] Set verify token: `launchbase_fb_webhook_2026`
- [ ] Subscribe to `messages` and `leadgen` fields
- [ ] Add permissions: `pages_messaging`, `pages_manage_metadata`, `leads_retrieval`
- [ ] Set environment variables: `FB_APP_ID`, `FB_APP_SECRET`
- [ ] Test message notification end-to-end
- [ ] Test lead form notification end-to-end

**Docs:** `docs/FACEBOOK_WEBHOOK_SETUP.md`

### QuickBooks Setup Packet System (60% Complete)
**What's Built:**
- [x] QuickBooks setup packet generation (`checklistEngine.ts`)
- [x] 6 QuickBooks checklist steps:
  - [x] Create or Access QuickBooks Account
  - [x] Set Up Company Profile
  - [x] Add Service Items
  - [x] Customize Invoice Template
  - [x] Set Up Payment Methods
  - [x] Add Customer Types
- [x] Auto-filled fields from intake data:
  - [x] Company name
  - [x] Service items with rates
  - [x] Payment terms
  - [x] Invoice footer
  - [x] Customer types
- [x] Database schema supports QuickBooks packets
- [x] Admin UI for viewing/downloading setup packets (`/expand/integrations`)

**What's Missing (Manual Setup Packet Only - No Live Integration):**
- [ ] Add detailed service descriptions to service catalog
- [ ] Create service-specific onboarding flows
- [ ] Add service activation tracking

**Note:** This is a **manual setup packet system** - we generate instructions for customers to configure QuickBooks themselves. It does NOT connect to their QuickBooks account or sync data.

### Tier 1 Enhanced Presentation Observation
- [x] System built and ready
- [ ] Observe 3-5 real customers (1 week passive observation)
- [ ] Track metrics in `docs/tier1-observation-scorecard.md`:
  - [ ] Time to approval
  - [ ] Edit rate
  - [ ] Preview usage
  - [ ] Approval confidence
  - [ ] Human intervention needed
- [ ] Decide based on data:
  - [ ] If faster + fewer edits → Ship at $149
  - [ ] If same/worse → Kill Tier 1
  - [ ] If unclear → Extend observation

---

## 🚀 NEXT PHASE: QuickBooks Live Integration (The Operating System Layer)

**Vision:** LaunchBase becomes the **operating system for running your business** by connecting to QuickBooks and making intelligent decisions based on real financial data.

**Current State:** Manual setup packets only (no live connection)

**Goal:** Live QuickBooks integration that reads revenue, expenses, and cash flow to drive intelligent posting decisions.

### Phase 1: QuickBooks OAuth & Read-Only Sync
- [ ] **Intuit OAuth Flow:**
  - [ ] Register app in Intuit Developer Portal
  - [ ] Implement OAuth 2.0 flow
  - [ ] Store access tokens securely (encrypted)
  - [ ] Handle token refresh automatically
  - [ ] Add connection status to customer dashboard
  - [ ] Create `quickbooks_connections` table
  - [ ] Create `quickbooks_sync_logs` table

- [ ] **Revenue Data Sync:**
  - [ ] Fetch last 90 days of revenue from QuickBooks API
  - [ ] Store in `quickbooks_revenue` table
  - [ ] Calculate revenue trend (up/down/flat)
  - [ ] Calculate month-over-month change percentage
  - [ ] Display in admin dashboard

- [ ] **Expense Data Sync:**
  - [ ] Fetch last 90 days of expenses from QuickBooks API
  - [ ] Store in `quickbooks_expenses` table
  - [ ] Calculate expense trend (up/down/flat)
  - [ ] Calculate month-over-month change percentage
  - [ ] Display in admin dashboard

- [ ] **Cash Flow Calculation:**
  - [ ] Calculate: Revenue - Expenses = Cash Flow
  - [ ] Classify cash flow health:
    - [ ] Healthy: >30 days runway
    - [ ] Watch: 15-30 days runway
    - [ ] Critical: <15 days runway
  - [ ] Store classification in database
  - [ ] Update daily via cron job

- [ ] **Admin Dashboard UI:**
  - [ ] Add "Business Health" card to admin intake detail
  - [ ] Show revenue trend chart (last 90 days)
  - [ ] Show expense trend chart (last 90 days)
  - [ ] Show cash flow status with color coding
  - [ ] Show last sync timestamp
  - [ ] Add "Sync Now" button

### Phase 2: Intelligence Integration
- [ ] **Cash Flow Context Layer:**
  - [ ] Create `CashFlowLayer` class in Intelligence Core
  - [ ] Integrate into decision pipeline
  - [ ] Add cash flow signals to scoring:
    - [ ] Cash flow critical → boost lead generation posts
    - [ ] Cash flow healthy → maintain normal cadence
    - [ ] Revenue spike → celebrate wins publicly

- [ ] **Decision Logic Based on QB Data:**
  - [ ] Revenue down >10% month-over-month → increase posting frequency by 50%
  - [ ] Revenue up >20% month-over-month → reduce posting frequency by 30%
  - [ ] Cash flow critical → focus on lead generation content
  - [ ] Cash flow healthy → focus on brand building content

- [ ] **Observability:**
  - [ ] Add "Why we posted this" explanations referencing QB data
  - [ ] Show in admin observability panel
  - [ ] Include in customer dashboard
  - [ ] Log all QB-driven decisions in `decision_logs` table

- [ ] **Testing:**
  - [ ] Test with Vince's Snowplow real QuickBooks data
  - [ ] Observe posting decisions for 1 week
  - [ ] Verify decisions align with business conditions
  - [ ] Measure customer satisfaction with QB-driven decisions

### Phase 3: Customer Visibility
- [ ] **Customer Dashboard:**
  - [ ] Add "Business Health" card to customer dashboard
  - [ ] Show revenue trend (last 90 days)
  - [ ] Show cash flow status (healthy/watch/critical)
  - [ ] Show how LaunchBase is responding to business conditions
  - [ ] Add sync status and "Sync Now" button

- [ ] **Transparency Features:**
  - [ ] Show LaunchBase actions based on QB data:
    - [ ] "We increased posting frequency because cash flow dipped 15%"
    - [ ] "We're celebrating your revenue growth this month"
    - [ ] "We're staying quiet because you're in busy season"
  - [ ] Add connection health indicator
  - [ ] Add last sync timestamp
  - [ ] Add disconnect/reconnect controls

### Phase 4: Predictive Actions
- [ ] **Revenue Dip Detection:**
  - [ ] Trigger when revenue down >10% month-over-month
  - [ ] Increase posting frequency by 50%
  - [ ] Focus on lead generation content
  - [ ] Send alert to customer: "We noticed revenue dipped, increasing lead generation"

- [ ] **Busy Season Detection:**
  - [ ] Trigger when revenue up >20% month-over-month
  - [ ] Reduce posting frequency by 30%
  - [ ] Focus on operational updates
  - [ ] Send alert to customer: "We noticed you're busy, reducing posting frequency"

- [ ] **Growth Detection:**
  - [ ] Trigger when revenue up >30% over 3 months
  - [ ] Suggest service expansion (Google Ads, Facebook Ads)
  - [ ] Send expansion opportunity email
  - [ ] Create upsell opportunity in admin dashboard

- [ ] **Monthly Business Review:**
  - [ ] Generate monthly report with QB data
  - [ ] Include LaunchBase actions taken
  - [ ] Show correlation between actions and outcomes
  - [ ] Send via email with PDF attachment
  - [ ] Include recommendations for next month

**Success Metrics:**
- Customer says "LaunchBase knows my business better than I do"
- Posting decisions correlate with business outcomes
- Customers stop manually managing social media
- Churn drops because value is undeniable

**Technical Docs to Create:**
- [ ] `docs/QUICKBOOKS_LIVE_INTEGRATION.md` - Technical specification
- [ ] `docs/quickbooks-oauth-flow.md` - OAuth implementation guide
- [ ] `docs/cash-flow-intelligence.md` - Decision logic documentation
- [ ] `docs/quickbooks-api-reference.md` - API endpoints and data models

---

## 🔵 FUTURE ENHANCEMENTS (After QuickBooks)

### Mobile App
- [ ] Customer dashboard mobile app
- [ ] Push notifications for urgent items
- [ ] Quick approval/edit from phone
- [ ] Business health at a glance

### Additional Integrations
- [ ] Slack integration for admin alerts
- [ ] SMS notifications for customers
- [ ] Zapier integration for custom workflows
- [ ] Public API for third-party integrations

### Performance & Scale
- [ ] Add database indexes (already documented)
- [ ] Implement Redis caching for hot paths
- [ ] Add CDN for static assets
- [ ] Optimize preview generation speed

---

## 🐛 KNOWN ISSUES (Non-Blocking)

### TypeScript Errors (15 errors)
- [ ] Fix scoreDesign.ts type errors (3 errors)
- [ ] Fix actionRequestSequencer.ts resendMessageId type error
- [ ] Run `pnpm tsc --noEmit` to verify fixes

### Console Errors
- [ ] Investigate "Cannot convert undefined or null to object" errors
- [ ] Add null checks in affected code paths
- [ ] Add error boundaries to prevent crashes

---

## 📚 DOCUMENTATION STATUS

### Complete
- [x] WHERE_WE_ARE.md - Complete system status
- [x] NEVER_AGAIN.md - Anti-patterns and forever rules
- [x] SMOKE_TEST.md - Pre-launch checklist
- [x] how-launchbase-works.md - Architecture overview
- [x] FACEBOOK_WEBHOOK_SETUP.md - Facebook integration guide
- [x] email-verification.md - Email troubleshooting guide
- [x] design-contract.md - Design philosophy
- [x] tier1-observation-scorecard.md - Observation metrics

### Needed
- [ ] QUICKBOOKS_LIVE_INTEGRATION.md - Technical specification
- [ ] quickbooks-oauth-flow.md - OAuth implementation guide
- [ ] cash-flow-intelligence.md - Decision logic documentation
- [ ] quickbooks-api-reference.md - API endpoints and data models
- [ ] README.md - Update with current architecture

---

**🎯 Current Focus:** Complete Facebook integration → Observe Tier 1 → Build QuickBooks Live Integration

**📖 Full Context:** See `WHERE_WE_ARE.md` for detailed status report
