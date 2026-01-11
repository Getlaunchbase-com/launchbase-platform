# LaunchBase TODO

**Status:** 🟢 Production Live & Operational  
**Version:** 118331d6  
**Last Updated:** January 11, 2026

> **📖 See WHERE_WE_ARE.md for complete status report and vision**

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

### Email Automation (90% → 100%)
- [x] Action request system built (Ask → Understand → Apply → Confirm)
- [x] Outbound emails with Approve/Edit buttons
- [x] Inbound webhook with intent classification
- [x] Proposed preview feature
- [x] Admin mutations (resend/expire/unlock/adminApply)
- [x] Batch approvals
- [x] Confidence learning
- [x] 12 tests passing
- [ ] **Configure Resend inbound DNS:**
  1. [ ] Add MX record for inbound routing
  2. [ ] Verify DNS propagation
  3. [ ] Test inbound webhook receives emails
- [ ] **Test real email reply:**
  - [ ] Send action request to yourself
  - [ ] Reply "YES" from phone
  - [ ] Verify events: CUSTOMER_APPROVED → APPLIED → LOCKED
  - [ ] Check admin UI shows correct status

**Docs:** `docs/resend-inbound-dns-setup.md`, `docs/email-verification.md`

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
