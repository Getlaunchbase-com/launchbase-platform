# Test Failure Triage
Generated: 2026-01-20T17:22:17.823Z

## Summary
- Tier 0: 0
- Tier 1: 0
- Tier 2: 4

## Tier 0 (Mechanical)

## Tier 1 (Coupled / fixtures / schema)

## Tier 2 (Integration / pollution / policy)
- [Analytics] Failed to track event: TypeError: db.insert is not a function
-      → expected 'notification' to be 'resend' // Object.is equality
-  FAIL  server/__tests__/smoke.email-delivery.test.ts > smoke.email-delivery > enforces Resend routing when RESEND_API_KEY is present
- AssertionError: expected 'notification' to be 'resend' // Object.is equality
