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
