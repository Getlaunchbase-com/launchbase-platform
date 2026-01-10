# LaunchBase TODO

## Session Jan 10, 2026 - Design Engine Interface Foundation
- [x] Draft DesignInput + DesignOutput schema (tool-agnostic contract)
- [x] Formalize PresentationScore rubric (deterministic scoring)
- [x] Create docs/design-engines.md (philosophy + architecture)
- [x] Implement design_jobs table and tracking
- [x] Build candidate generator (3-5 variants per tier)
- [x] Implement scoring engine (evaluate candidates against rubric)
- [x] Add tier routing logic (standard/enhanced/premium)
- [x] Wire into existing preview + approval flow
- [x] Add HTML comment + data attribute to preview for Tier 1 verification
- [x] Remove customer-facing tier badge from preview
- [x] End-to-end test: 1 job, 3 candidates, scores differ
- [x] End-to-end test: Winner stable across reloads (persistence)
- [x] End-to-end test: No duplicate jobs created
- [x] End-to-end test: All required events logged
- [ ] Document foundation for future premium engines (Framer/Lovable)

## Session Jan 10, 2026 - Batch Approvals & Confidence Learning
- [x] Design batch approval mutation (approve multiple action requests at once)
- [x] Implement batchApprove mutation in actionRequestsRouter
- [x] Add batch approval logic with transaction support
- [x] Log ADMIN_APPLY + APPLIED + LOCKED events for each request
- [ ] Add batch approval UI in Admin panel (checkbox selection) - SKIPPED (no UI yet)
- [x] Write tests for batch approval (3 requests → all locked)
- [x] Design confidence_learning table schema
- [x] Implement confidence learning tracker (track approve/reject by key)
- [x] Add confidence learning to webhook handler
- [x] Write tests for confidence learning

## Session Jan 10, 2026 - Architecture Documentation
- [x] Create docs/how-launchbase-works.md with 3-layer architecture
- [x] Document Core Engine (Layer 1): action_requests + events
- [x] Document Channels (Layer 2): Email, Admin UI, Cron
- [x] Document Website Output (Layer 3): Previews + deployments
- [x] Document canonical workflow: Ask → Understand → Apply → Confirm
- [x] Document operational guardrails and "Do Not Break" rules

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
- [ ] Add Design section to intake admin view (tier, winner, score, candidates table)
