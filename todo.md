# LaunchBase TODO

## Session Jan 10, 2026 - EMAIL_TRANSPORT Toggle (SaaS Maturity Step)
- [x] Add EMAIL_TRANSPORT env var to env.ts (resend | log | memory)
- [x] Update sendActionRequestEmail to respect transport mode
- [x] Implement log transport (console + event only)
- [x] Implement memory transport (store in test array)
- [x] Update E2E tests to use memory transport
- [x] Verify all 20 action request tests pass with new transport
- [x] Document transport modes in NEVER_AGAIN.md

## Session Jan 10, 2026 - Email Automation Hardening
- [x] Add Resend message ID tracking to event logging (store in meta field)
- [x] Create docs/email-verification.md with troubleshooting guide
- [ ] Test full loop with real email reply (reply "YES" from phone)
- [ ] Verify CUSTOMER_APPROVED → APPLIED → LOCKED event sequence
- [ ] Verify confirmation email sent after approval

## Session Jan 9, 2026 - Test Database Setup Fix
- [x] Implement robust test database setup with schema rebuild on each test run
- [x] Update vitest.global-setup.ts to DROP/CREATE database before migrations
- [x] Document test database pattern in NEVER_AGAIN.md
- [x] Verify all setIntakeStatus tests pass (4/4 passing)

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
