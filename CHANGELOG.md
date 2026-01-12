# LaunchBase Changelog

All notable changes to this project will be documented in this file.

---

## January 12, 2026

### AI Tennis Infrastructure - Production Readiness

- **stopReason standardized end-to-end (service boundary contract)**: All AI orchestration outcomes now surface as `stopReason` at the service boundary. The `reason` field is forbidden in exported types. This FOREVER CONTRACT prevents field name drift between service layer and router/client.

- **Prompt secrecy: no raw prompts/errors in logs or responses**: Zero prompt content leakage in logs, errors, or API responses. All provider errors are sanitized. Trace IDs are opaque (no user content). Customer-facing responses never include system prompts or internal routing details.

- **Trace-based seeding is test-only (VITEST guarded)**: Test seeding uses trace-based pattern with wildcard matching for unpredictable jobIds. Memory transport fixtures ensure deterministic tests without prompt-hash brittleness. All 12 tests passing (8 orchestrator + 4 service).

- **Metrics queries validated against real data**: All 4 canonical SQL queries from `AI_METRICS_QUERIES.md` validated successfully. JSON paths extract correctly (`$.aiTennis.stopReason`, `$.aiTennis.costUsd`, `$.aiTennis.needsHuman`, `$.aiTennis.rounds`, `$.aiTennis.traceId`). Data shape from Step 2.1 is correct.

- **Incident: Prod seeding + immediate cleanup**: Metrics validation briefly used seeded AI Tennis rows in production (ActionRequest IDs 10-12, Intake ID 10). All seeded rows removed immediately via `scripts/cleanup-test-data.ts`. No customer data affected. Hard guardrails added to `scripts/seed-ai-tennis-test-data.ts` to forbid future prod seeding. New FOREVER CONTRACT added: "Production is Read-Only for Metrics Validation" (see `docs/FOREVER_CONTRACTS.md` §8).

---

## Previous Work

See `docs/WHERE_WE_ARE.md` for complete project history and architecture overview.
