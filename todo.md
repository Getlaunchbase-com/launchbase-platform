# LaunchBase TODO

## URGENT: Eliminate Sandbox Sleep Issue
- [ ] Diagnose why sandbox goes to sleep (Manus platform setting vs resource hibernation)
- [ ] Implement solution:
  - [ ] Option A: Enable "always-on" in Manus project settings
  - [ ] Option B: Deploy to production (publish via Manus UI)
  - [ ] Option C: Add keep-alive ping from external monitoring
- [ ] Verify 24/7 availability for:
  - [ ] Cron endpoints (/api/cron/run-next-deploy, /api/cron/auto-advance, /api/cron/alerts)
  - [ ] Webhook endpoints (Stripe, Resend, Facebook)
  - [ ] Customer preview links
  - [ ] Admin dashboard access
- [ ] Test all critical paths after fix

## Post-Payment Email Fix
- [x] Add change request instruction to deployment_started email template
- [x] Add itemized service summary to deployment_started email
- [ ] Test email sends correctly after payment

## Service Offerings Enhancement
- [x] Create service catalog (server + client)
- [x] Create service summary builder
- [x] Add service summary to onboarding review UI
- [x] Add service summary to preview approval page
- [x] Add tRPC getServiceSummary query
- [x] Add FOREVER tests for service summary parity (5 tests passing)
- [ ] Add itemized LaunchBase service descriptions:
  - [ ] Facebook ads setup
  - [ ] Google ads setup  
  - [ ] QuickBooks integration
  - [ ] Email service setup
  - [ ] Phone system setup
- [ ] Update service extraction logic or create dedicated service catalog

## Preview UI Fix
- [ ] Make preview expandable/viewable in full screen
- [ ] Find preview modal/iframe component
- [ ] Test preview opens correctly in admin UI

## Database Sync Issue
- [ ] Diagnose why test intakes are missing from production
- [ ] Check if dev database has intakes that production doesn't
- [ ] Identify if DATABASE_URL differs between dev and production
- [ ] Migrate/sync test intake data to production database
- [ ] Verify intakes visible in production dashboard
