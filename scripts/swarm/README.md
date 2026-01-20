# Swarm Auto-Repair System

**Status:** ✅ Working and production-ready

## Canonical Entrypoint

```bash
pnpm swarm:fix --from <path/to/failurePacket.json> --max-cost-usd 2 --max-iters 2
```

**Optional flags:**
- `--apply` - Automatically apply the proposed patch
- `--test` - Run tests after applying patch

## Architecture

**Entry Point:** `scripts/swarm/runSwarmFix.mjs`
- Reads FailurePacket from disk
- Normalizes to canonical FailurePacketV1 format via `normalizeFailurePacket()`
- Calls the orchestration engine
- Writes RepairPacket and ScoreCard artifacts

**Orchestration Engine:** `server/ai/orchestration/runRepairSwarm.ts`
- Runs multi-model swarm pipeline:
  1. **Field General** - Diagnoses root cause
  2. **Coder** - Proposes patch
  3. **Reviewer** - Critiques patch
  4. **Arbiter** - Makes final decision
- Enforces constitutional rules:
  - Max 2 iterations per swarm (prevent infinite loops)
  - Max $2 cost per swarm (prevent runaway costs)
  - Always write RepairPacket artifact (even on failure)
  - Never swarm on permission/platform blockers

**Contracts:**
- `scripts/swarm/contracts/FailurePacketV1.json` - Input schema
- `server/contracts/repairPacket.ts` - Output schema
- `server/contracts/scoreCard.ts` - Grading schema

## Output Artifacts

After running `pnpm swarm:fix`, you'll find:

```
runs/repair/<repairId>/
├── repairPacket.json    # Diagnosis + proposed patch
└── scorecard.json       # Grading (coder/reviewer/arbiter scores)
```

## Example Usage

```bash
# Basic repair (proposal only)
pnpm swarm:fix --from runs/smoke/test_123/failurePacket.json

# With auto-apply
pnpm swarm:fix --from runs/smoke/test_123/failurePacket.json --apply

# With custom cost/iteration limits
pnpm swarm:fix --from runs/smoke/test_123/failurePacket.json --max-cost-usd 5 --max-iters 3
```

## Integration with Test Repair Loop

The auto-repair system integrates with the test triage pipeline:

1. Run `./scripts/test/repairLoop.sh` to capture test failures
2. Triage failures into Tier 0/1/2 using `scripts/test/triageFailures.ts`
3. For Tier 0/1 failures, generate FailurePacket
4. Run `pnpm swarm:fix --from <failurePacket.json>` to get proposed fix
5. Review RepairPacket and apply if acceptable

## Related Documentation

- `docs/TEST_REPAIR_WORKFLOW.md` - Manual test repair workflow
- `docs/TEST_FIX_PATTERNS.md` - Copy/paste patterns for common fixes
- `server/ai/orchestration/runRepairSwarm.ts` - Implementation details
