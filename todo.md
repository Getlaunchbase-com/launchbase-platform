# LaunchBase TODO

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


## Social Media Intelligence Module (LaunchBase Suite)

- [x] Database schema: intelligence_layers table
- [x] Database schema: social_posts table (pending, approved, published)
- [x] Database schema: post_usage tracking
- [ ] Backend service: weather-intelligence.ts (NWS API integration)
- [ ] Backend service: weather-analyzer.ts (AI post classification)
- [ ] Backend service: context-builder.ts (temporal/sports awareness)
- [ ] Backend service: local-intelligence.ts (Google Trends + news)
- [ ] Backend service: post-orchestrator.ts (combines all intelligence)
- [x] tRPC router: intelligence-layers (get/save config, pricing)
- [ ] tRPC router: social-posts (generate, approve, publish)
- [x] Customer UI: Expand LaunchBase page with module cards
- [x] Customer UI: Layer selection modal with depth slider
- [ ] Customer UI: Pending posts approval interface
- [ ] Admin UI: Module subscriptions management
- [ ] Admin UI: Customer intelligence layer overview
- [ ] Stripe products: Setup fees + monthly tiers (Low/Medium/High)


## Expand LaunchBase - Top 1% Polish

### Guided Expertise
- [x] Add "Recommended Setup" strip with industry/location context
- [x] Add "Apply recommendation" one-click button
- [x] Add impact labels (High/Medium/Low) to each context layer

### Billing Clarity
- [x] Add collapsible billing explanation (posts/month, intelligence checks)
- [x] Add "Overages: blocked by default" policy line
- [x] Add "Founder pricing locked for 12 months" badge

### Live Context Preview
- [x] Add "Today's Context Snapshot" to Sample Week modal
- [x] Show weather summary, next local event, posting cadence

### Safety & Guardrails
- [x] Add "Safety Rules" sheet (clean popup with rules list)
- [ ] Add "Quiet hours" preview for Custom mode
- [ ] Show timezone chip + next allowed posting window

### Growth Path
- [x] Add "Most businesses add these next" section below modules
- [x] Position as suite upsell with outcome-focused copy

### Auto Mode Explanation
- [x] Add 2-line explanation when Auto is selected
- [x] Explain why layers were picked/excluded based on vertical

### Critical Unit Tests
- [x] Test: Weather always locked on when Social enabled
- [x] Test: Price updates deterministically for each layer/depth combo
- [x] Test: Mode changes do not alter price unless config changes
- [x] Test: Dirty state triggers Save button
- [ ] Test: Mobile summary bar matches rail totals
- [x] Test: Trends cannot activate if weather gating fails
- [x] Test: Zero scheduled posts is valid without error


## Stripe Wiring - Social Media Intelligence

### Phase 1: Stripe Products
- [x] Create Social Media Intelligence - LOW ($79/mo)
- [x] Create Social Media Intelligence - MEDIUM ($129/mo)
- [x] Create Social Media Intelligence - HIGH ($199/mo)
- [x] Create Local Context - Sports & Events ($29/mo)
- [x] Create Local Context - Community & Schools ($39/mo)
- [x] Create Local Context - Local Trends ($49/mo)
- [x] Create Base Setup Fee ($249 one-time)
- [x] Create Per-Layer Setup Fee ($99 one-time)
- [x] Add metadata to all products (module, type, layer_key, etc.)

### Phase 2: Checkout Flow
- [x] Build tRPC endpoint for creating Stripe checkout session
- [x] Wire "Confirm & Activate" button to checkout
- [x] Pass subscriptions + add-ons + setup fees to checkout
- [x] Handle checkout success redirect

### Phase 3: Webhooks & Activation
- [x] Create webhook endpoint for checkout.session.completed
- [x] Activate intelligence_layers record on payment success
- [x] Send activation confirmation email
- [x] Handle subscription.updated for upgrades/downgrades

### Phase 4: Subscription Management
- [x] Enable Stripe Customer Portal
- [x] Add "Manage Subscription" link to Expand LaunchBase
- [x] Handle layer add/remove mid-cycle

## Facebook Automation (Vince Pilot)

- [ ] Add META_PAGE_TOKEN secret
- [ ] Add META_PAGE_ID secret
- [ ] Build POST /api/facebook/post endpoint
- [ ] Create scheduled task for automated posting
- [ ] Capture screenshot proof of first live post


## Post Approval Queue (Guided Mode Killer Feature) ✅

### Database & Backend
- [x] Update social_posts schema with approval workflow fields
- [x] Add status enum: needs_review, approved, posted, rejected, expired
- [x] Add post_type enum: ALL_CLEAR, MONITORING, ACTIVE_STORM, etc.
- [x] Add reason_chips JSON field (weather, sports, community, trends)
- [x] Add scheduled_for timestamp
- [x] Add why_we_wrote_this text field
- [x] Add suggested_alts JSON field for alternative versions
- [x] Create tRPC router for post queue operations (list, approve, reject, edit)

### UI Components
- [x] Create /dashboard/social/queue page
- [x] Build queue list (left panel) with status pills and preview snippets
- [x] Build review panel (right panel) with editable post text
- [x] Add "Why we wrote this" explanation box
- [x] Add safety gates display
- [x] Add approval controls (Approve & Post, Approve & Schedule, Reject)
- [x] Add "Auto-approve this post type" toggle for advanced users
- [x] Add expiry logic for stale posts in Guided mode

### Unit Tests
- [x] Test: Post approval updates status correctly
- [x] Test: Rejected posts don't get posted
- [x] Test: Expired posts are filtered from queue
- [x] Test: Edit saves changes to post content


## Module Setup Dashboard ✅

### Database & Backend
- [x] Create module_setup_steps table
- [x] Create module_connections table for OAuth tokens
- [x] Create moduleSetupConfig.ts with all module definitions
- [x] Add tRPC router for module setup operations

### UI Components
- [x] Create /dashboard/modules page
- [x] Build module cards with progress bars
- [x] Show steps with completion status
- [x] Add "Start This Step" button for next incomplete step
- [x] Show "What We Already Know" section (from intake)
- [x] Add pricing display per module

### Unit Tests
- [x] Test: Module configs have valid structure
- [x] Test: Progress calculation is correct
- [x] Test: Next incomplete step is identified correctly
- [x] Test: Pricing helpers return correct values

## Documentation
- [x] Create MODULE_SETUP_CHECKLISTS.md with complete customer checklists


## Stripe Product Auto-Creation

- [ ] Create script to auto-create all Stripe products via API
- [ ] Create 3 cadence tier products (Low/Medium/High)
- [ ] Create 3 layer add-on products (Sports/Community/Trends)
- [ ] Create 2 setup fee products (Base/Per-layer)
- [ ] Output Price IDs for env vars

## Facebook Posting Endpoint

- [ ] Create POST /api/facebook/post endpoint
- [ ] Add Meta Graph API integration
- [ ] Handle page token authentication
- [ ] Return post ID and screenshot URL

## Homepage Top 1% Redesign

- [ ] Update hero with "Workflows that give you back your life"
- [ ] Add Live Intelligence panel (context detection)
- [ ] Add "Automation without abdication" section
- [ ] Add "You're Always in Control" 3-column section
- [ ] Add "This is what control looks like" artifacts section
- [ ] Update pricing with approval workflow messaging
- [ ] Add new FAQ questions about approval and control
- [ ] Update CTA language (no "Get Started", use "See how it works")


## Go-Live Checklist (72 Hours)

### Stripe Setup
- [x] Run create-stripe-products.mjs script
- [x] Copy Price IDs to environment variables
- [ ] Test checkout session creation end-to-end

### Facebook Page Posting
- [ ] Add META_PAGE_ID secret
- [ ] Add META_PAGE_ACCESS_TOKEN secret (long-lived)
- [x] Add test connection endpoint
- [ ] Verify publish permissions

### Weather Intelligence Service
- [x] Build NWS API fetcher (conditions, forecast, alerts)
- [x] Create deterministic rule classifier
- [ ] Add AI copy polisher (optional)
- [x] Format final Facebook post output


## Homepage Fix - Core Website First
- [x] Lead with website building (the core product)
- [x] Establish "We build your website" before Suite features
- [x] Add website showcase/preview section
- [x] Position Suite as expansion, not the main product
- [x] Keep trust anchors but contextualize for website first


## Vertical Categories Expansion

### Configuration
- [ ] Create verticals config with categories and industries
- [ ] Define Suite relevance per vertical (which layers matter)
- [ ] Add industry-specific copy/messaging

### Homepage
- [ ] Update hero to show broader verticals (not just trades)
- [ ] Add vertical showcase section with category cards
- [ ] Update copy to be industry-agnostic

### Apply Flow
- [ ] Add vertical category selection step
- [ ] Show relevant industries per category
- [ ] Customize Suite recommendations based on vertical

### Database
- [ ] Add vertical field to intake/applications
- [ ] Store vertical for intelligence recommendations


## Multi-Language Support (Spanish, Polish, English)

### Language Selection
- [ ] Add language preference to /apply flow
- [ ] Store preferred language in database
- [ ] Show language selector in intake form

### Translations
- [ ] Create Spanish translations for intake form
- [ ] Create Polish translations for intake form
- [ ] Add i18n configuration

### Translation Service
- [ ] Build AI translation layer for intake responses
- [ ] Convert customer input to professional English copy
- [ ] Preserve original language in database for reference


## Expanded Verticals & Multi-Language Support

- [x] Update database schema with language and vertical fields
- [x] Add 8 vertical categories (trades, health, beauty, food, cannabis, professional, fitness, automotive)
- [x] Update suiteApply router to accept new fields
- [x] Update Apply.tsx with language selection step (English/Spanish/Polish)
- [x] Add industry sub-selection within each vertical
- [x] Translate intake form labels for Spanish and Polish
- [x] Update homepage to show broader vertical categories
- [x] Update FAQ with expanded vertical list
- [x] Update ApplySuccess.tsx to display vertical instead of businessType
- [x] Create suite_applications table in database
- [x] Create module_setup_steps table in database


## Beta Customer Onboarding - Carpenter

- [x] Add Carpenter as industry under Trades vertical
- [x] Add sub-specialties: Finish Carpenter, Custom Cabinetry, Trim & Molding, Furniture Maker, General Carpentry


## Suite Applications Admin View

- [x] Add tRPC procedures for listing suite applications
- [x] Add tRPC procedure for updating application status
- [x] Add tRPC procedure for admin notes
- [x] Create SuiteApplications admin page with drawer, search, filters
- [x] Add navigation link to admin sidebar
- [x] Add keyboard shortcuts (A=approve, N=review, R=reject, Esc=close)
- [x] Add click-to-copy for email/phone
- [x] Add "New" indicator for < 24 hours
- [x] Add admin_notes and reviewed_by columns to database


## Approve → Generate Build Plan Flow

- [x] Add tRPC mutation to convert Suite Application to Intake
- [x] Link Suite Application to created Intake (add intakeId field)
- [x] Update admin page Approve button to use new flow with modal
- [x] Show intake link if already approved
- [ ] Trigger build plan generation after intake creation (future enhancement)


## Pipeline Enhancement (Beta Ready)

- [x] Audit: Intake → Build Plan connection
- [x] Audit: Build Plan → Preview connection
- [x] Audit: Preview → Stripe connection
- [x] Audit: Payment → Deploy connection
- [x] Enhance approve modal with prefill (business name, city, CTA, phone)
- [x] Add auto-generate build plan checkbox (default ON)
- [x] Add missing-fields safety gate (warn if incomplete)
- [x] Wire build plan auto-generation on approval
- [x] Add Beta/Founding Client toggle
- [x] Update ready_for_review email with Stripe-clean copy
- [ ] Add activity log timeline on application


## Preview Approval & Deploy Flow

- [x] Add approval checkbox on preview page
- [x] Log approval event (timestamp, IP, user agent, build plan hash) - already exists in logApproval mutation
- [x] Disable Pay button until checkbox checked
- [x] Wire deploy trigger from Stripe webhook
- [x] Add deployment safety gates (5 gates: intake exists, build plan exists, preview token exists, approval exists, not already deployed)
- [x] Add deployment progress UI on success page (animated step-by-step progress)
- [x] Add "deployment started" email
- [x] Add "site is live" email template (ready to use when deployment completes)


## Deployment Worker (Cron-based MVP)

- [x] Add /api/worker/run-next-deploy endpoint
- [x] Protect endpoint with secret token header (x-worker-token)
- [x] Process one job at a time (oldest queued first)
- [x] Mark deployment success/failed after execution
- [x] Send "site is live" email on success
- [x] Add manual "Run Next Job" button in admin (AdminDeployments page)
- [x] Set up WORKER_TOKEN environment variable
- [ ] Set up external cron to ping endpoint every 2 minutes (user action)

- [x] Add worker busy safeguard (prevent double-runs)
