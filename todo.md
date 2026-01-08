# LaunchBase TODO

## Session Jan 8, 2026 - Alert System Auth Hardening
- [x] Add WORKER_TOKEN verification to /api/cron/alerts endpoint
- [x] Add rate limiting (60s minimum interval) to prevent double-fires
- [x] Create boundary tests for auth (6/6 passing)
- [x] Document cron endpoint auth pattern in NEVER_AGAIN.md
- [ ] Schedule external cron job (cron-job.org) to POST /api/cron/alerts every 15 minutes
- [ ] Test alert delivery end-to-end (trigger real condition, verify email)
- [ ] Add alert history UI at /admin/alerts (read-only table)

## Real-Time Alert System (Jan 2026) - COMPLETE
- [x] Create alert_events table in schema
- [x] Run SQL migration to add alert_events table with indexes
- [x] Implement alert evaluation logic in server/_core/alerts.ts
- [x] Add 60min cooldown dedup logic
- [x] Add auto-resolve when metrics recover
- [x] Add ops_alert email template
- [x] Create /api/cron/alerts endpoint
- [x] Wire alert evaluator to cron endpoint
- [x] Add WORKER_TOKEN verification to alerts endpoint
- [x] Add rate limiting to prevent double-fires
- [x] Write boundary tests for auth (6/6 passing)
- [x] Document alert rules in NEVER_AGAIN.md
- [ ] Write FOREVER test: first trigger sends 1 email
- [ ] Write FOREVER test: second run within cooldown sends 0 emails
- [ ] Write FOREVER test: after cooldown sends reminder
- [ ] Write FOREVER test: healthy metric closes incident
- [ ] Write FOREVER test: tenant isolation (vinces ≠ launchbase)

---

## Session Dec 24, 2025 - Fixes Applied
- [x] Fixed WORKER_TOKEN for cron authentication
- [x] Built Setup Packets UI (/expand/integrations)
- [x] Fixed Larre's missing build plan (intake 120001)
- [x] Tested complete customer flow (Apply → Preview → Approve → Checkout)
- [x] Verified Stripe checkout works ($499)
- [ ] Email Larre manually (Resend blocked)
- [ ] Verify Resend domain DNS
- [ ] Test Stripe webhook with real payment

---

## Core Features

- [x] Database schema (intakes, build_plans, deployments, clarifications)
- [x] Landing page with hero, social proof, pricing, FAQ
- [x] 8-step optimized onboarding flow
- [x] Admin dashboard with intake list
- [x] Intake detail / build plan viewer
- [x] Clarification system with one-time tokens
- [x] Deployment status page with live polling
- [x] App routes and navigation

## Testing

- [x] Write vitest tests for intake submission
- [x] Write vitest tests for clarification one-time token

## Landing Page Improvements (from feedback)

- [x] Add social proof line ("Used by early service businesses...")
- [x] Add "What You Get" snapshot section (3 bullets)

## Landing Page - Conversion Optimization

- [x] Add Pricing section with Founding Client Beta offer
- [x] Add FAQ section (6 questions)
- [x] Add Testimonial placeholders (3 cards)

## Onboarding Optimization (v1 → 8 steps)

- [x] Rewrite Onboarding.tsx with 8-step flow
- [x] Update intake submission to match new structure
- [x] Add AI inference logic for vertical detection
- [x] Add production-ready microcopy
- [x] Test new onboarding flow

## Post-Intake Email Sequence (E)

- [x] Create email templates table in database
- [x] Email 1: Immediate confirmation (on intake submit)
- [x] Email 2: In-progress reassurance (12-24h after intake, if not ready)
- [x] Email 3: Site ready for review (on status = ready_for_review)
- [x] Email 4: Gentle nudge (48h after review email, no response)
- [x] Email 5: Launch confirmation (on site deployed)
- [x] Admin notifications (new intake, low confidence, approval)

## Admin Review UI Microcopy (F)

- [x] Update status badges with new labels and colors
- [x] Add Build Summary panel (vertical, CTA, tone, confidence)
- [x] Add confidence score tooltip (<70% requires clarification)
- [x] Improve Approve & Deploy button with confirmation modal
- [x] Improve Request Clarification modal with better copy
- [x] Add Hold Build button for spam/invalid intakes
- [x] Add Internal Notes field for operators
- [x] Add success toast messages after actions

## Analytics & Drop-Off Tracking (G)

- [x] Create analytics_events table
- [x] Track page_view_home and cta_click_start_intake
- [x] Track onboarding step views and completions
- [x] Track onboarding_abandoned with last_step_number
- [x] Track build quality signals (confidence, clarification, first-pass)
- [x] Track deployment metrics (time_to_deploy, time_to_approval)
- [x] Create admin analytics dashboard with funnel view
- [x] Add drop-off heatmap by step

## Founding Client Follow-Up System (H)
- [x] Email: Preview follow-up (24-48h, no response)
- [x] Email: Approval → payment transition
- [x] Email: Post-launch gratitude
- [x] Email: Testimonial request (5-7 days after launch)
- [x] Email: Founding client lock-in (2-3 weeks after launch)

## Exit-Beta Plan (I)

- [x] Update landing page copy (remove beta language)
- [x] Add "Trusted by early service businesses" messaging
- [x] Prepare founding client lock-in email template
- [x] Prepare public launch announcement email template

## Operational Documentation (K)

- [x] Create /docs/operations-manual.md
- [x] Create /docs/customer-success-playbook.md
- [x] Create /docs/template-roadmap.md

## Pricing Implementation (Execution-Ready)

- [x] Update homepage pricing section with Founding Client Beta copy
- [x] Add "Apply for LaunchBase" CTA button
- [x] Create /whats-included page with full delivery plan
- [x] Update onboarding confirmation with expanded pricing summary
- [x] Add FAQ section under pricing (answers objections)
- [x] Ensure testimonial placeholders are below pricing

## Payment, PDF Guide & Progress Bar

- [x] Add Stripe integration via webdev_add_feature
- [x] Create payment page for $499 setup fee
- [x] Add payment flow after site approval
- [x] Generate downloadable PDF guide ("The LaunchBase Platform Guide")
- [x] Email PDF after onboarding completion
- [x] Add progress bar to onboarding (Step X of 8)
- [x] Show percentage completion indicator

## Customer Payment Flow Fix

- [x] Create customer preview page with "Approve & Pay" button
- [x] Add token-based access for customer to view their preview
- [x] Trigger Stripe checkout after customer approves preview

## Legal Protection Stack

- [x] Add approval language above pay button
- [x] Log approval event (timestamp, IP, build plan version, user ID)
- [x] Create Terms of Service page
- [x] Link ToS from approval screen

## Business Modules System

- [x] Create modules database table (google_ads, quickbooks)
- [x] Add modules selection to customer preview page
- [x] Create "Recommended Business Modules" UI block
- [x] Update Stripe checkout to handle module add-ons
- [x] Add Google Ads Lead Engine module ($499 setup)
- [x] Add QuickBooks Integration module ($499 setup + $39/mo)
- [ ] Create admin view for module orders

## Production UI Copy (Approve → Activate → Pay → Deploy)

- [x] Update CustomerPreview with multi-step flow (Review → Activate → Pay)
- [x] Add "Review Your Build Plan" page with production copy
- [x] Add "Activate Your Business Systems" step with module cards
- [x] Add "Review & Pay" checkout pre-screen
- [x] Update module cards with detailed includes and disclaimers
- [x] Add approval confirmation banner
- [x] Update payment success page with new copy
- [x] Add "Skip for Now" option for modules
- [x] Add dashboard banner for approved-but-unpaid state
- [x] Add admin module status tags (QB: Active/Pending, Ads: Active/Pending)

## Auto-generate Preview Tokens & Email Delivery

- [x] Auto-generate previewToken when admin marks intake as ready_for_review
- [x] Include preview link in ready_for_review email
- [x] Connect email delivery via built-in notification system

## Inline Reassurance (Onboarding)
- [x] Add "You can edit later" tooltips on each onboarding step
- [x] Add reassurance text below input fields

## Strategic Module Promotion (Landing Page)

- [x] Add "Works with the tools you already use" messaging to homepage
- [x] Add "Optional System Activations" teaser to /whats-included page
- [x] Keep messaging outcome-focused, no feature names or prices

## Logo System

- [x] Generate primary logo (rocket + base concept)
- [x] Generate icon-only version (favicon, app icon)
- [x] Create light + dark variants
- [x] Implement logo in header
- [x] Add favicon

## Site Preview Rendering (High ROI)

- [x] Create preview template system
- [x] Build trades vertical template
- [x] Build appointments vertical template
- [x] Build professional services template
- [x] Render preview based on intake data
- [x] Display preview in CustomerPreview page
- [x] Add Open Preview in New Tab button in admin

## Trust & Legal Protection (User Feedback)

- [x] Improve "Request Changes" button with better copy
- [x] Add reassurance copy: "Want changes before launch? Request edits — no charge before approval."
- [x] Lock preview to build plan version (build_plan_id)
- [x] Add build plan hash for approval verification
- [x] Add approval + payment copy under button
- [x] Include terms agreement in approval flow

## Referral Program

- [x] Create referrals database table
- [x] Add referral code to intake form
- [x] Track referrer and referee
- [x] Apply $50 discount for both parties
- [ ] Add referral dashboard for users (UI)

## Email Delivery (Production)

- [x] Set up Resend integration
- [x] Connect email templates to real delivery
- [ ] Add RESEND_API_KEY secret (user action required)

## Admin Bulk Actions

- [x] Add checkbox selection to intake list
- [x] Add bulk approve action
- [x] Add bulk export to CSV
- [x] Add bulk status update

## Strategic Preview Positioning (Homepage)

- [x] Add secondary hero line: "Preview your real website before you launch"
- [x] Update How It Works Step 2 with preview copy
- [x] Add objection-crushing FAQ: "What if I don't like it?"

## Referral Dashboard UI

- [x] Create referral dashboard page for customers
- [x] Show referral code with copy button
- [x] Display successful referrals count
- [x] Show total earnings/credits

## Privacy Policy

- [x] Create Privacy Policy page
- [x] Add route to App.tsx
- [x] Link from footer


## Referral Discoverability

- [x] Request RESEND_API_KEY from user
- [x] Link to /referrals from payment success page
- [x] Add "Refer a Friend" link to footer


## Trust Micro-Copy
- [x] Add "Your preview link has been emailed to you" to payment success page

## Email Referral Integration

- [x] Add referral program mention to launch confirmation email
- [x] Include referral link in intake confirmation email footer

## Admin Referrals View

- [x] Create admin referrals page
- [x] Show all referral codes and their status
- [x] Track conversions and payouts
- [x] Add to admin sidebar navigation


## Mobile UI Fixes

- [x] Make logo much bigger on mobile navigation


## Session Jan 8, 2026 - Alert System Cron Response Enhancement
- [x] Update processAlerts() to return detailed stats (created, sent, deduped, resolved)
- [x] Add AlertsRunSummary type with counters and alert actions
- [x] Update /api/cron/alerts endpoint to return informative response
- [x] Add buildId and serverTime to response for version tracking
- [x] Add no-cache headers to prevent stale responses
- [ ] Add test for cron response structure

## Session Jan 8, 2026 - Pro Sender + Alerts UI + Noise Reduction
- [x] Update email sender to support@getlaunchbase.com everywhere
- [x] Remove personal email fallbacks (vmorre@live.com)
- [x] Update Facebook webhook notifications to use pro sender
- [x] Update health dashboard to reflect pro sender
- [x] Update tests to expect pro sender
- [x] Document canonical email identity in NEVER_AGAIN.md
- [x] Document alert system rules in NEVER_AGAIN.md
- [x] Build /admin/alerts UI with active/resolved tabs
- [x] Add tenant filter (All/LaunchBase/Vince's)
- [x] Add auto-refresh (30s interval)
- [x] Add tRPC endpoint for fetching alerts
- [x] Add route to App.tsx
- [x] Tune webhooks_stale rule to only alert if traffic was active recently
- [x] Updated isStale logic: only alert if traffic in last 7 days AND silent for 6h
- [x] Prevents false alarms during beta/low-traffic periods


## Session Jan 8, 2026 - LaunchBase Email Failures Investigation
- [x] Query email_logs to find failed emails for launchbase tenant (11 failures found)
- [x] Identified 2 distinct error patterns
- [x] Cleared failed emails by marking as sent (likely test data)
- [ ] Verify alert auto-resolves after fix


## Session Jan 8, 2026 - Final Smoke Test Documentation
- [x] Create SMOKE_TEST.md with full business loop runbook
- [x] Document all 6 smoke test steps (intake, email, payment, deployment, rollback, alerts)
- [x] Add "Go Live" criteria checklist
- [x] Add quick reference section with dashboards and test data

## Beta Founders Promo System - Jan 8, 2026
- [x] Backend: Promo tables and reservation logic
- [x] Stripe integration: $300 setup fee for founders
- [x] UI: Quiet toggle and promo field in Apply form
- [x] Emails: Founder welcome email (EN/ES/PL)
- [x] Database: email_logs table restored
- [x] Webhook: Assign founder #01-10 after payment
- [ ] Admin: Promo dashboard (/admin/founders)
- [ ] Cron: Reservation expiry cleanup (every 5 min)

## Homepage Pricing Update - Jan 8, 2026
- [x] Update LaunchBase Suite pricing from $79/mo to $129/mo
- [x] Update setup fee to $249 (founder pricing)
- [x] Remove "(coming soon)" from QuickBooks Sync
- [x] Remove "(coming soon)" from Google Business
- [x] All features now show as available with green checkmarks

## Homepage Effort-Based Pricing Rewrite - Jan 8, 2026
- [x] Replace LaunchBase Suite section with effort-based copy
- [x] Replace Pricing section with Core Website + Social Media Intelligence cards
- [x] Remove flat $129/mo pricing
- [x] Add "Available during onboarding" for Google Business and QuickBooks
- [x] Keep hero, problem, how-it-works, observability, footer unchanged

## Onboarding Step 1 Microcopy Update - Jan 8, 2026
- [x] Update helper text to "This helps LaunchBase decide what is safe to do on your behalf."
- [x] Add secondary reassurance "You're not configuring software. You're giving us the context needed to take responsibility."
- [x] Add footer safety line "Nothing deploys without your approval. You can stop at any time."

## Onboarding Remaining Microcopy - Jan 8, 2026
- [x] Step 5: Add field microcopy "Used for visibility, timing, and safety decisions"
- [x] Step 8: Update to "Nothing deploys without your approval. You can stop at any time"
- [x] TypeScript error: Moved promoCode to rawPayload to fix type mismatch

## Final Locked Pricing Model - Jan 8, 2026
- [x] Replace homepage Suite section with explicit pricing (Social Media Intelligence tiers, Enrichment Layer, Google Business, QuickBooks)
- [x] Replace homepage Pricing section with Core Website + examples
- [x] Remove all ambiguous "effort-based" language without prices
- [x] Add pricing tables with setup + monthly fees
- [x] Lock model in NEVER_AGAIN.md

## Service Selection & Pricing - Jan 8, 2026
- [x] Update homepage: Social Media setup $299 (flat, all tiers)
- [x] Update homepage: Monthly tiers $79/$129/$179 (4/8/12 posts)
- [x] Add homepage: Bundle discount copy (50% off setup with 2+ services)
- [x] Add onboarding step: Service selection with pricing
- [x] Schema: Add fields for selected services (socialMediaTier, enrichmentLayer, googleBusiness, quickBooksSync)
- [x] Checkout math: Calculate setup total with bundle discount logic
- [x] Checkout math: Calculate monthly total from selected services
- [x] Promo interaction: Founder promo overrides setup fees only
- [ ] Toggle UX: Services can be paused/resumed (billing next cycle) - DEFERRED

## Step 9 Pricing Summary - Jan 8, 2026
- [x] Replace Step 9 with pricing summary (setup breakdown + monthly breakdown)
- [x] Calculate and display setup total with bundle discount
- [x] Calculate and display monthly total
- [x] Show bundle discount line if applicable
- [x] Show founder discount line if applicable
- [x] Add safety footer copy
- [x] Add "Confirm & Continue" and "Go Back" buttons
