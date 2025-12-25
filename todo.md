# LaunchBase TODO

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


## Real Hosting Integration (Customer Sites)

- [x] Research hosting APIs (Vercel, Netlify, Cloudflare Pages)
- [x] Select best option for programmatic site deployment (Manus subdomains Phase 1)
- [x] Implement deployment integration in LaunchBase
- [x] Update deployment worker to use Manus subdomains
- [x] Add reachability verification before marking Live
- [x] Update deployment status UI (Provisioning Link)
- [x] Add comprehensive tests for URL generation
- [x] Create hosting integration documentation
- [ ] Test end-to-end deployment with cabinet maker beta
- [ ] Plan Phase 2 custom domain support


## Deployment Worker Cron Automation

- [x] Create CRON_SETUP.md documentation
- [ ] Choose external cron service (EasyCron recommended)
- [ ] Configure cron to POST to /api/worker/run-next-deploy every 2 minutes
- [ ] Test cron endpoint with curl
- [ ] Monitor admin dashboard for 24 hours
- [ ] Set up alerts for cron failures (if service supports)


## Facebook Integration (Vince Pilot)

- [x] Create FACEBOOK_INTEGRATION.md documentation
- [ ] Get Vince's Facebook page ID
- [ ] Generate long-lived page access token
- [ ] Add META_PAGE_ID secret to LaunchBase
- [ ] Add META_PAGE_ACCESS_TOKEN secret to LaunchBase
- [ ] Implement POST /api/facebook/post endpoint
- [ ] Create facebook.ts helper functions
- [ ] Test endpoint with curl
- [ ] Verify post appears on Vince's page
- [ ] Wire to Social Media Intelligence module (auto-post approved posts)


## Cabinet Maker Beta Smoke Test

- [ ] Run full end-to-end flow (Apply → Approve → Deploy)
- [ ] Verify generated URL resolves
- [ ] Check page loads on mobile and desktop
- [ ] Confirm content matches intake (name/services/CTA)
- [ ] Verify no mixed-content or blocked assets
- [ ] Test "Powered by LaunchBase" footer link


## Phase 2 Custom Domain Planning

- [ ] Confirm *.getlaunchbase.com wildcard DNS setup
- [ ] Test wildcard subdomain routing
- [ ] Plan customer site domain migration
- [ ] Update deployment worker for getlaunchbase.com URLs


## Intelligence Core Architecture (Locked Foundation)

- [x] Create INTELLIGENCE_CORE.md specification
- [x] Define non-negotiable safety rules
- [x] Define canonical intelligence schema
- [x] Define versioning system (MAJOR/MINOR/PATCH)
- [x] Define intelligence pipeline (10-step locked order)
- [x] Define layer interface and capabilities
- [ ] Add intelligence_version field to social_posts table
- [ ] Add intelligence_version field to deployments table
- [ ] Create IntelligenceCore service class
- [ ] Implement Intelligence Pipeline (steps 1-10)
- [ ] Implement Safety Gates module
- [ ] Implement Industry Matrix
- [ ] Implement Layer evaluation
- [ ] Create audit trail logging
- [ ] Add version migration tests
- [ ] Document all layers
- [ ] Create rollback procedures
- [ ] Set up version monitoring


## Control UI (Customer-Facing Layer)

- [x] Create CONTROL_UI_SPEC.md specification
- [x] Define three modes (Auto/Guided/Custom)
- [x] Define controls (cadence, layers, boosts)
- [x] Define approval workflow
- [x] Define pricing UX
- [x] Define mobile app upsell
- [ ] Create /suite/social/controls page
- [ ] Implement cadence selector (radio cards)
- [ ] Implement layer toggles and sliders
- [ ] Implement seasonal boost toggles
- [ ] Implement sample week preview modal
- [ ] Implement pricing rail
- [ ] Create /suite/social/queue page
- [ ] Implement post approval workflow
- [ ] Implement edit and rewrite buttons
- [ ] Implement feedback collection
- [ ] Create mobile-responsive layout
- [ ] Add mobile app shell (approval only)
- [ ] Write unit tests for all controls
- [ ] Write integration tests for approval workflow
- [ ] Create user documentation
- [ ] Create admin documentation


## Intelligence Implementation (Three Locked Additions)

### Phase 1: Silence Audit Trail
- [x] Create decision_logs table (additive, no existing changes)
- [x] Create logDecision() service function
- [x] Log all Intelligence Pipeline decisions (post/silence/wait)
- [x] Classify silence severity (hard_block/soft_block/discretionary)
- [x] Create getUserDecisionLogs() for Activity tab
- [x] Create getUserSilenceStats() for dashboard
- [x] Write unit tests (all passing)
- [ ] Surface in Admin Activity tab
- [ ] Show summary in customer dashboard
- [ ] Test with pilot customer

### Phase 2: Approval Feedback Loop
- [x] Create approval_feedback table
- [x] Create recordFeedback() service function
- [x] Capture feedback on every approval/rejection/edit
- [x] Normalize feedback types (too_promotional, wrong_tone, etc.)
- [x] Create getUserFeedbackMetrics() for analytics
- [x] Write unit tests (all passing)
- [ ] Build aggregate metrics dashboard
- [ ] Analyze feedback by layer and industry
- [ ] Use feedback to improve industry profiles

### Phase 3: Industry Profile Versioning
- [x] Create industry_profiles table
- [x] Create getIndustryProfile() service function
- [x] Create createIndustryProfile() for admin
- [x] Create activateIndustryProfile() for rollouts
- [x] Implement version management (MAJOR/MINOR/PATCH)
- [x] Add migration strategies (auto/opt_in/frozen)
- [x] Write unit tests (all passing)
- [ ] Build version management UI
- [ ] Test with 2-3 industries
- [ ] Enable instant new industry launches


## Onboarding Form Error Handling (P0 Fix)

- [x] Replace raw validation error messages with user-friendly text
- [x] Add field-level inline error display (no JSON blobs)
- [x] Implement error clearing when user starts typing
- [x] Add global error banner for submission failures
- [x] Map all Zod validation errors to friendly messages
- [x] Test error handling with invalid inputs


## Phase 1 URL Mode Enforcement (P0 - Critical Fix)

- [x] Add urlMode field to deployments table (TEMP_MANUS | CUSTOM_DOMAIN)
- [x] Add urlModeEnforcementLog field to track custom domain attempts
- [x] Update deployment worker to enforce Manus-only URLs
- [x] Add URL mode enforcement logging to intelligence service
- [x] Replace old MVP launchbase.site URL generation with Manus URLs
- [x] Update routers.ts manual deployment trigger to use Manus URLs
- [x] Update DeploymentStatus UI to show "Temporary Site" language
- [x] Add Phase 2 blocking message to deployment success state
- [x] Update button labels: "Open Live Site" → "Open Temporary Site"
- [x] Update button labels: "Copy URL" → "Copy Temporary URL"
- [x] Add Phase 2 blocking banner: "Custom domain coming soon"
- [x] All 145 tests passing
- [ ] Verify cabinet maker deployment #30001 shows correct Manus URL
- [ ] Test URL copy functionality
- [ ] Test temporary site access


## "Powered by LaunchBase" Footer Badge

- [x] Add footer badge component to preview templates
- [x] Include LaunchBase branding with star icon
- [x] Link to https://getlaunchbase.com for organic discovery
- [x] Style badge to match all three verticals (trades, appointments, professional)
- [x] Test badge appears on all customer sites
- [x] Verify link functionality and styling
- [x] All 145 tests passing


## Admin Navigation & Share Features

- [ ] Create ReferralAnalytics page with KPI strip and top sites table
- [ ] Add Referral Analytics link to admin sidebar with 7d clicks badge
- [ ] Add "Top Referrers This Week" card to main admin dashboard
- [ ] Create Share My Site modal component (copy link, QR code, social share, caption templates)
- [ ] Add share event tracking (share_opened, share_copy_link, share_qr_shown, share_social_clicked)
- [ ] Update badge link to use /r/{siteSlug} for attribution
- [ ] Integrate Share modal into customer preview pages


## Referral Analytics & Share System (Growth Loop)

- [x] Create referral_events database table with dedupe and bot filtering fields
- [x] Build /r/{siteSlug} redirect endpoint with UTM tracking
- [x] Implement logReferralEvent service with bot filtering and 30-min dedupe
- [x] Create ReferralAnalytics page with KPI strip and top sites table
- [x] Add Referral Analytics link to admin sidebar with 7d clicks badge
- [x] Add "Top Referrers This Week" card to main admin dashboard
- [x] Create Share My Site modal component (copy link, QR code, social share, caption templates)
- [x] Add share event tracking (share_opened, share_copy_link, share_qr_shown, share_social_clicked)
- [x] Update badge link to use /r/{siteSlug} for attribution
- [x] Integrate Share modal into customer preview pages (after payment)


## Worker Observability & Test Deployment

- [ ] Create worker_runs table (timestamp, result, processed_count, error_message)
- [ ] Add logging to deployment worker endpoint
- [ ] Add "Last Worker Run" card to admin dashboard
- [ ] Create test deployment to validate cron automation
- [ ] Verify test deployment auto-processes within 2 minutes


## Worker Observability & Cron Automation

- [x] Create worker_runs table for observability
- [x] Add worker run logging to deployment worker
- [x] Add "Worker Status" card to admin dashboard
- [x] Set up external cron (cron-job.org) every 2 minutes
- [x] Create test deployment to validate cron automation
- [x] Verify end-to-end cron processing (deployment #60001 → live)


## Founder Narrative System

- [x] Update homepage hero with "Workflows that give you back your life"
- [x] Add "Why We Exist" section below the fold
- [x] Add "What Makes LaunchBase Different" section
- [x] Create /why page with origin story and philosophy
- [x] Update onboarding apply page intro
- [x] Update confirmation copy after apply
- [x] Update preview approval language


## Observability Panel

- [x] Create observability data queries (last intelligence decision, last deployment, posts approved, silence decisions)
- [x] Build status card with "LaunchBase is running" green dot
- [x] Add activity metrics (last intelligence decision, last deployment, posts/silence this week)
- [x] Add silence tooltip explaining why silence is a feature
- [x] Show current industry profile + version
- [x] Show intelligence version and mode
- [x] Add Recent Decisions section (last 3 decisions with human-readable explanations)
- [x] Integrate panel into admin dashboard
- [ ] Integrate panel into customer Expand page


## Trust Copy & Control Language (Observability-Enabled)

### Expand LaunchBase Page Trust Copy
- [x] Add reassurance block near top: "Nothing here is permanent..."
- [x] Add "Turn on/off anytime" to module cards
- [x] Add "No contracts. No penalties." to module cards
- [x] Add pricing philosophy: "You're not buying software. You're deciding how much responsibility to hand off."
- [x] Add "You can always see what LaunchBase is doing — and change it anytime."

### Auto/Guided/Custom Mode Language
- [x] Update Auto mode: "LaunchBase decides for you. You can review everything."
- [x] Update Guided mode: "LaunchBase recommends. You approve."
- [x] Update Custom mode: "You fine-tune relevance. Safety is still enforced."
- [x] Add "Controls change relevance — not safety." everywhere
- [x] Add "Weather, safety, and brand protection are always enforced."


## Internal Contract & How It Works Trust Language

### Internal Contract Document
- [x] Write INTERNAL_CONTRACT.md with philosophical and legal backing
- [x] Define what LaunchBase commits to
- [x] Define what customers can expect
- [x] Document escalation paths
- [x] Include safety guarantees and observability promises

### How It Works Page Trust Language
- [x] Add "Controls change relevance — not safety" messaging
- [x] Add observability messaging ("You can always see what LaunchBase is doing")
- [x] Mirror trust language from Expand page


## Public Trust Page & Observability Panel

### Public Trust Page
- [x] Create /trust route with customer-facing commitments
- [x] Surface key promises from Internal Contract
- [x] Add navigation link to trust page

### Observability Panel
- [x] Create ObservabilityPanel component
- [x] Show decision logs (posts published, silenced, reasons)
- [x] Show upcoming scheduled posts
- [x] Show silence reasons with context
- [x] Integrate into customer-facing Expand page


## Footer Trust Link & Observability Seeding

### Footer Navigation
- [x] Add /trust link to footer ("Trust & Commitments")
- [x] Ensure link is visible on all public pages (Home, HowItWorks, WhatsIncluded, Why, Referrals)

### Observability Seeding
- [x] Create seed script for decision logs
- [x] Add system initialization events
- [x] Add weather check events
- [x] Add silence decision events
- [x] Label as "Recent system activity"


## "What LaunchBase Is Doing Right Now" Panel Enhancement

### ObservabilityPanel Reframe
- [x] Update panel title to "What LaunchBase Is Doing Right Now"
- [x] Add subtitle: "Live system status for your business. Updated automatically."
- [x] Add "Active Responsibilities" section with human language bullets
- [x] Add "Last Decision" block with reason and timestamp
- [x] Add "Next scheduled check" countdown
- [x] Add guardrail footer: "You can change relevance anytime. Safety rules are always enforced."
- [x] Add "Silence is a valid decision. We log it to protect your brand." helper text


## Seed Real Intelligence Decisions
- [x] Create script to run intelligence pipeline
- [x] Seed weather check decisions
- [x] Seed silence decisions with real reasons
- [x] Seed post approval decisions
- [x] Verify decisions appear in ObservabilityPanel


## Admin UI State-Machine Buttons
- [ ] Test status transition enforcement via admin UI
- [ ] Update IntakeDetail.tsx with state-machine driven buttons
- [ ] Show "Send Preview" instead of generic status dropdown
- [ ] Show "Awaiting Customer Approval" when in ready_for_review
- [ ] Show "Awaiting Payment" when in approved
- [ ] Show "Deploy Site" when in paid
- [ ] Display clear error messages for invalid transitions


## Admin Support Features (Dec 23, 2025)

- [x] Add "Resend Preview Email" button to admin intake detail
- [x] Add 60-second cooldown to prevent spam
- [x] Add "Copy Preview Link" button for easy sharing
- [x] Log email sends in email_logs table for audit trail
- [x] Add unit tests for resend preview email functionality


## CRITICAL BUGS - Payment Flow 100% Broken (Dec 24)
- [ ] BUG: Preview page shows "Payment Confirmed" for deployed status even when no payment was made
- [ ] BUG: Customer preview email not being received (Resend delivery issue)
- [ ] BUG: Preview page not showing actual website preview with Approve & Pay button
- [ ] BUG: Status can be manually set to deployed without payment (bypasses entire flow)
- [ ] FIX: Preview page must check intake.status and show correct UI for each state
- [ ] FIX: Test Stripe checkout end-to-end
- [ ] FIX: Verify Resend email delivery is working


## CRITICAL: Auto-Intake Flow (Dec 24)
- [ ] Save Larre Lannert - create intake for stuck suite_application ID 90001
- [ ] Make suiteApply.submit auto-create intake immediately
- [ ] Auto-generate preview token on submit
- [ ] Auto-send preview email on submit
- [ ] Test complete automatic flow end-to-end
- [ ] Add owner notification when new applications come in


## Backlog: External Services Setup
- [ ] Set up launchbase.dev email domain in Resend
- [ ] Verify DNS records for email delivery
- [ ] Create hello@launchbase.dev sender
- [ ] Set up Facebook Page for automated posting
- [ ] Add META_PAGE_ID secret
- [ ] Add META_PAGE_ACCESS_TOKEN secret
- [ ] Test Facebook posting endpoint


## CRITICAL FIX: Auto-Intake Flow (Dec 24, 2024)

- [x] Auto-create intake when suite application is submitted (no manual admin step)
- [x] Send owner notification on new application via Manus notification service
- [x] Save Larre's stuck application (intake_id: 120001, preview token generated)
- [x] Fix CustomerPreview to sync isApproved state with database status
- [ ] Set up launchbase.dev email domain in Resend for customer emails
- [ ] Verify DNS records for email delivery


## Setup & Integrations Page (Setup Packet System)

### Phase 1: UI Skeleton
- [ ] Create /expand/integrations page with three integration cards
- [ ] Google Business Profile card (Ready/In Progress/Connected states)
- [ ] Facebook & Instagram card (Ready/In Progress/Connected states)
- [ ] QuickBooks Online card (Ready/In Progress/Connected states)
- [ ] Add navigation from Expand LaunchBase page

### Phase 2: Setup Packet Generator
- [ ] Create generateSetupPacket() function
- [ ] Generate copy blocks from business data
- [ ] Generate service lists
- [ ] Generate AI-written descriptions
- [ ] Add one-click copy buttons
- [ ] Add downloadable PDF/ZIP packet

### Phase 3: Integration-Specific Content
- [ ] Google Business Profile: name, address, hours, description, categories, photos
- [ ] Meta Business Suite: page bio, CTA, about section, pinned post, images
- [ ] QuickBooks Online: customer types, service items, invoice templates, payment terms

### Phase 4: OAuth (Future)
- [ ] QuickBooks OAuth integration
- [ ] Meta/Facebook OAuth integration
- [ ] Google Ads suggestions (not execution)


## Setup & Integrations System (Prepared Intelligence)

> Philosophy: "LaunchBase prepares everything first — then you decide how much you want automated."
> Rule: We prepare first. We automate second. We always show our work.

### Step 1: /expand/integrations Page UI
- [ ] Create /expand/integrations route
- [ ] Three integration cards (Google Business Profile, Meta, QuickBooks)
- [ ] Card states: Ready → In Progress → Connected
- [ ] "View Setup Packet" button (works without OAuth)
- [ ] Status badges for each state
- [ ] "What's included" preview (3-4 bullets per card)
- [ ] Primary CTA: "View Setup Packet" or "Connect Account"
- [ ] Secondary CTA: "Learn more"
- [ ] Link from ExpandLaunchBase page

### Step 2: Setup Packet Generator (Backend) - DETAILED SPEC

#### Database Schema
- [x] Create integration_setup_packets table
  - id, customer_id, intake_id, source_type, integration, status, packet_version
  - packet_json (jsonb), generated_from (jsonb), created_at, updated_at
  - last_opened_at, connected_at, notes
- [x] Create integration_connections table
  - id, customer_id, integration, connection_status, external_account_id, last_sync_at

#### Packet JSON Schema (Common Base)
- [x] business: name, phone, website, address, service_area, hours
- [x] positioning: tone, primary_cta, one_liner
- [x] services: name, description, price_hint
- [x] assets_needed: item, priority, note
- [x] setup_steps: step, title, instructions

#### Generation Rules
- [x] Deterministic by default (no creative randomness)
- [x] If AI used, strict formatting and stored as output
- [x] Always produce something (placeholders + assets_needed if missing data)
- [x] status = blocked only if truly impossible

#### tRPC Endpoints
- [x] setupPackets.generate (intakeId)
- [x] setupPackets.getForIntake (intakeId)
- [x] setupPackets.getByType (intakeId, integration)
- [x] setupPackets.markInProgress (intakeId, integration)
- [x] setupPackets.markConnected (intakeId, integration)

#### Auto-Triggers
- [ ] On Admin "Approve & Create Intake" → generate 3 packets (Google, Meta, QB)
- [ ] On Intake "ready_for_review" → refresh packets if build plan changed

#### Acceptance Criteria
- [x] Creating intake auto-creates 3 packets within 2 seconds
- [x] Packets contain: business identity, services, CTA/tone, integration-specific steps
- [x] Missing inputs produce placeholders + assets_needed
- [x] Packet is versioned and re-generatable safely
- [x] No customer can access another customer's packet (protected procedures)

#### Integration-Specific Content:

#### Google Business Profile Packet
- [ ] Business name (formatted)
- [ ] Address (formatted for GBP)
- [ ] Business hours (GBP format)
- [ ] AI-written description (compliant, 750 char)
- [ ] Primary + secondary categories
- [ ] Service list with descriptions
- [ ] Photos/logos bundle paths
- [ ] Review reply templates (5 templates)
- [ ] Deep links to GBP setup screens

#### Meta Business Suite Packet (Facebook/Instagram)
- [ ] Page bio (160 char)
- [ ] CTA button text + URL
- [ ] About section (full)
- [ ] Initial pinned post copy
- [ ] Profile image specs + path
- [ ] Cover image specs + path
- [ ] Posting tone + cadence notes
- [ ] First week content calendar
- [ ] Deep links to Meta Business setup

#### QuickBooks Online Packet
- [ ] Customer types list
- [ ] Service items with prices
- [ ] Invoice template defaults
- [ ] Payment terms (Net 30, etc.)
- [ ] Chart of accounts starter
- [ ] Tax categories mapping
- [ ] Deep links to QBO setup screens

### Step 3: Auto-Generate Packets on Approval
- [ ] Trigger packet generation when intake approved
- [ ] Store packets in database (setup_packets table?)
- [ ] Customer sees "Ready" state immediately after approval
- [ ] Packet available even without OAuth connection

### Step 4: Setup Packet Viewer UI
- [ ] Modal or page to view full packet
- [ ] One-click copy buttons for every field
- [ ] Downloadable PDF version
- [ ] Downloadable ZIP with all assets
- [ ] Human checklist ("5 minutes if you follow this order")
- [ ] Direct deep links to correct setup screens

### Step 5: OAuth Integration (Future - Not Now)
- [ ] QuickBooks OAuth (customers + items sync)
- [ ] Meta OAuth (posting)
- [ ] Google Ads suggestions (not execution)
- [ ] OAuth reads from packet (never guesses)

### Backlog: External Services Setup
- [ ] Set up launchbase.dev email domain in Resend
- [ ] Verify DNS records for email delivery
- [ ] Facebook API integration for auto-posting
- [ ] Google Business Profile API
- [ ] QuickBooks API integration


## 72-Hour No-Regret Plan (Dec 25, 2024)

### P0: Auto-Advance Safety Net (HIGHEST PRIORITY)
> Goal: No customer can ever get stuck after submitting onboarding

#### Trigger Condition
- [ ] suite_application.status === "submitted" AND intake_id IS NULL AND created_at < now() - 5 min

#### Auto-Advance Actions
- [x] Create intake (source: suite_application, status: review, autoAdvanced: true)
- [x] Generate build plan
- [x] Generate preview token
- [ ] Send preview email ("Your site preview is ready") - requires email domain setup
- [x] Log decision: auto_advance_triggered (via console + notifyOwner)

#### Admin UI
- [x] Badge: "Auto-advanced" on suite applications table
- [x] Tooltip: "LaunchBase prepared the preview automatically after no admin action"
- [x] Intake detail banner: "This intake was auto-advanced to prevent delays"

#### Safety Rules (Non-Negotiable)
- [ ] Auto-advance never skips preview
- [ ] Auto-advance never deploys
- [ ] Auto-advance never charges
- [ ] Customer approval always required
- [ ] Admin can still intervene at any point

#### Test Cases
- [ ] Admin does nothing → preview sent automatically
- [ ] Admin acts before delay → auto-advance does NOT fire
- [ ] Customer receives preview email
- [ ] Observability shows auto-advance event
- [ ] No duplicate intakes created
- [ ] Idempotent if cron runs twice

### P1: Multi-Trade Support
- [ ] Change trades from string to trades: string[]
- [ ] Add primary_trade: string
- [ ] Max 3 trades allowed
- [ ] Primary drives tone + industry profile

### P2: Finish Setup Packets
- [ ] Complete Google Business Profile packet generator
- [ ] Complete Meta (Facebook/Instagram) packet generator
- [ ] Complete QuickBooks Online packet generator

### P3: Customer Control - Relevance Bias
- [ ] Add single slider: Conservative ← Balanced → Opportunistic
- [ ] Adjusts thresholds internally
- [ ] Never touches safety rules


## Checklist Engine - Complete Requirements (from 7 pastes)

### Core Data Model
- [ ] Create `checklistEngine.ts` service file
- [ ] EvidencedField type with: value, confidence (0-100), source, lastComputedAt, version
- [ ] Lock semantics: isLocked, lockedBy (user/admin/system), lockedAt
- [ ] Evidence string for each field (e.g., "from onboarding Q3")

### Blockers Model
- [ ] Blocker type: code (machine-readable), message (human), fix (CTA), severity (warning/blocking)
- [ ] createdAt / resolvedAt timestamps on blockers
- [ ] Add blockers column to integration_setup_packets table

### Checklist Steps
- [ ] Step type: stepId, title, instructionsMarkdown, requires (prereqs), validation rules
- [ ] Step completion: pending | complete | skipped | needs_attention
- [ ] completedAt, completedBy fields
- [ ] Validation rules per step (e.g., GBP description 250-750 chars)

### API Endpoints
- [ ] GET /api/setupPackets/:intakeId/checklist - all integrations + steps + blockers
- [ ] POST /api/setupPackets/:intakeId/:integration/steps/:stepId/complete
- [ ] POST /api/setupPackets/:intakeId/:integration/steps/:stepId/reset (with cascade option)
- [ ] POST /api/setupPackets/:intakeId/:integration/recompute (with mode: safe|full)
- [ ] POST /api/setupPackets/:intakeId/:integration/blockers/:code/resolve

### Recompute Endpoint Rules
- [ ] Never overwrite admin_override / user_override fields
- [ ] Don't reset completed steps unless they no longer validate
- [ ] Return diff summary: updatedFields, updatedSteps, addedBlockers, resolvedBlockers
- [ ] Safe mode (default): preserves overrides + completion unless invalid
- [ ] Full mode: regenerates everything except hard overrides

### Reset Step Rules
- [ ] Reset single step to pending by default
- [ ] cascade option to reset dependent auto-completed steps
- [ ] Clear completedAt, completedBy, validationResults
- [ ] Don't clear fields that are user overrides

### UI Updates
- [ ] "Refresh suggestions" button on each integration card
- [ ] "Reset step" in step detail / kebab menu
- [ ] "Last computed: 12m ago" timestamp display
- [ ] Toast after recompute: "Updated: 12 fields, 1 blocker found (View)"
- [ ] Blocker display with "Fix" button
- [ ] "Why we think this" tooltip on AI-generated values
- [ ] Next step CTA (single clear action)
- [ ] Top 3 prefilled fields preview on card
- [ ] Copy All button per integration
- [ ] ZIP download with all packets + images

### Platform Guardrails
- [ ] GBP: description 250-750 chars, category required
- [ ] Meta: bio 255 chars max, about 2000 chars max
- [ ] QuickBooks: item name 100 chars max, description 4000 chars max

### Season-Aware Content
- [ ] Detect season (winter/spring/summer/fall)
- [ ] Adjust content mode (seasonal_urgency/early_booking/peak_season/prep_mode)
- [ ] Apply to generated descriptions and CTAs

### Observability
- [ ] Log CHECKLIST_RECOMPUTE_RUN with counts + reason + actor
- [ ] Log CHECKLIST_STEP_RESET with step + reason + actor
- [ ] Decision log entries for auto-completions


## Execution Order (from paste)

- [ ] Step 0: Checkpoint current state (baseline)
- [ ] Step 1: Restore checklistEngine.ts (single source of truth)
- [ ] Step 2: Lock semantics (isLocked, lockedBy, lockedAt, overrideValue vs suggestedValue)
- [ ] Step 3: Diff summary for recompute (updatedFields[], blockersAdded[], counts)
- [ ] Step 4: Cascade reset (prereq graph, downstream auto-completed steps only)
- [ ] Step 5: Guardrails enforcement (GBP 750, Meta 255, QBO 100)
- [ ] Step 6: Season-aware content (seasonContext object, adjust descriptions)
- [ ] Step 7: UI polish (Refresh button, Reset menu, Blocker panel, tooltips, Copy All, ZIP)
- [ ] Step 8: Observability hooks (CHECKLIST_RECOMPUTE_RUN, CHECKLIST_STEP_RESET, BLOCKER_RESOLVED)
