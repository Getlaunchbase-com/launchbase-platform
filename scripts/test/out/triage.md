# Test Failure Triage
Generated: 2026-01-20T18:28:48.975Z

## Summary
- Tier 0: 0
- Tier 1: 0
- Tier 2: 11

## Tier 0 (Mechanical)

## Tier 1 (Coupled / fixtures / schema)

## Tier 2 (Integration / pollution / policy)
- [Analytics] Failed to track event: TypeError: db.insert is not a function
-      → expected { ok: true, …(2) } to deeply equal { ok: true, provider: 'resend' }
-      → expected 'notification' to be 'resend' // Object.is equality
-      → expected 2 to be 1 // Object.is equality
-  FAIL  server/email.test.ts > Email Service > sendEmail > should send email and return true on success
- AssertionError: expected { ok: true, …(2) } to deeply equal { ok: true, provider: 'resend' }
-  FAIL  server/__tests__/smoke.email-delivery.test.ts > smoke.email-delivery > sendEmail() succeeds and logs to email_logs
- AssertionError: expected 'notification' to be 'resend' // Object.is equality
-  FAIL  server/__tests__/smoke.email-delivery.test.ts > smoke.email-delivery > enforces Resend routing when RESEND_API_KEY is present
-  FAIL  server/__tests__/smoke.stripe-webhook.test.ts > smoke: stripe webhook boundary > is idempotent for duplicate checkout.session.completed
- AssertionError: expected 2 to be 1 // Object.is equality
