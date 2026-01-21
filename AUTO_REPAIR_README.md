# Auto-Repair System v1.0

Complete auto-repair infrastructure for diagnosing and fixing TypeScript/test failures.

## Components

### 1. Preflight Validation (`server/contracts/preflightValidation.ts`)
- Blocks invalid packets before AI calls ($0 cost)
- Validates file existence, path allowlist/denylist, test commands
- Returns structured errors with stopReason taxonomy

### 2. Fixture Builder (`scripts/fixtures/makeFailurePacket.ts`)
- Generates golden test fixtures with file contents + SHA256
- Auto-fills metadata: timestamp, repoRoot, targets, testCommands
- Usage: `pnpm fixture:make --target <file> --id <id> --test <command>`

### 3. Fixture Runner (`scripts/fixtures/runFixtureTests.ts`)
- Restores fileSnapshots to disk before swarm:fix
- Path guards: rejects .env*, secrets/, drizzle/
- Git cleanup: reset --hard + clean -fd + verify empty
- Usage: `pnpm smoke:repair:fixtures` or `pnpm smoke:repair:fixtures -- --only <id>`

### 4. Swarm Fix (`scripts/swarm/runSwarmFix.ts`)
- Orchestrates Field General → Coder → Reviewer → Arbiter
- Artifact persistence: failurePacket.json + meta.json + repairPacket.json
- Model resolution with alias normalization + fallback chains
- Usage: `pnpm swarm:fix --from <fixture> --apply --test`

## StopReason Taxonomy

- `packet_invalid` - FailurePacket schema validation failed
- `target_missing` - Target file doesn't exist
- `patch_invalid` - Patch format invalid or corrupt
- `apply_failed` - Patch valid but conflicts/wrong target
- `tests_failed` - Patch applied but tests still fail
- `revert_failed` - Git cleanup failed
- `ok` - Success (patch applied + tests passed)

## Verification Chain

```bash
pnpm install
pnpm typecheck
pnpm smoke:repair:fixtures -- --only f1-missing-import
```

## Next Steps

1. Run full fixture suite (10 fixtures)
2. Implement --commit flag for auto-commit to repair/<repairId> branch
3. Add GitHub Actions CI for automated triage
