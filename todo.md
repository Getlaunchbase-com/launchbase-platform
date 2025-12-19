# LaunchBase TODO

## Core Features

- [x] Landing page with LaunchBase brand (#0B0B0C, #FF6A00, #1ED760)
- [x] 13-step onboarding flow with AI vertical inference
- [x] LocalStorage draft saving during onboarding
- [x] Admin dashboard for intake management
- [x] Search and filtering for intakes
- [x] Intake detail panel
- [x] Build plan generation from intake data
- [x] Template selection based on vertical
- [x] Clarification request system with one-time tokens
- [x] Customer clarification page
- [x] Deployment pipeline with job queue
- [x] Status tracking (queued, running, success, failed)
- [x] Live polling on deployment status page
- [x] Local publisher for static site generation (simulated)
- [ ] trades_v1 template (Call Now CTA) - template files not yet integrated
- [ ] appointment_v2 template (Book Online CTA) - template files not yet integrated
- [x] Approve and deploy buttons in admin
- [x] Auto-redirect after deploy action

## Database Schemas

- [x] intakes table
- [x] build_plans table
- [x] clarifications table
- [x] deployments table

## API Routes

- [x] POST /api/trpc/intake.submit
- [x] GET /api/trpc/admin.intakes.list
- [x] GET /api/trpc/admin.intakes.detail
- [x] POST /api/trpc/admin.buildPlan.generate
- [x] POST /api/trpc/admin.clarify.create
- [x] GET /api/trpc/clarify.get
- [x] POST /api/trpc/clarify.submit
- [x] POST /api/trpc/admin.buildPlan.approve
- [x] POST /api/trpc/admin.deploy.start
- [x] POST /api/trpc/admin.deploy.run
- [x] GET /api/trpc/admin.deploy.status
- [x] GET /api/trpc/admin.deploy.list

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
