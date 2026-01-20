# Swarm Recording Mode

**Status:** ✅ Production-Ready  
**Version:** 1.0  
**Last Updated:** January 19, 2026

## Overview

The swarm replay provider supports **bidirectional operation**:

1. **REPLAY mode** (default): Read fixtures from disk deterministically
2. **RECORD mode** (`SWARM_RECORD=1`): Write AI responses to fixture folder

This enables a **continuous learning loop**: capture real AI responses as golden transcripts, then replay them deterministically in tests without network calls or cost.

---

## Architecture

### Replay Provider Modes

```typescript
// REPLAY MODE (default)
AI_PROVIDER=replay REPLAY_ID=apply_ok pnpm vitest

// RECORD MODE
AI_PROVIDER=replay SWARM_RECORD=1 REPLAY_ID=golden_1 pnpm tsx scripts/swarm/captureGolden.ts
```

### Fixture Storage

All fixtures are stored in:
```
server/ai/engine/__tests__/fixtures/swarm/replays/
  apply_ok/           # Synthetic contract test (pass scenario)
    craft.json
    critic.json
  reject_ok/          # Synthetic contract test (revise scenario)
    craft.json
    critic.json
  revise_then_apply/  # Synthetic contract test (iteration scenario)
    craft.json        # Array with 2 entries
    critic.json       # Array with 2 entries
  golden_1/           # Real golden transcript (captured from production)
    craft.json
    critic.json
```

### Naming Convention

- **Role-based**: Fixtures are named by role (`craft.json`, `critic.json`)
- **Iteration support**: Single object for one call, array for multiple calls
- **Counter isolation**: Per-instance counters keyed by `${replayRunId}:${role}`

---

## Usage

### 1. Capture Golden Transcript

Run a real swarm workflow and save AI responses as fixtures:

```bash
# Set scenario name
export REPLAY_ID=golden_ts_bucket

# Enable recording mode
export AI_PROVIDER=replay
export SWARM_RECORD=1

# Run capture script
pnpm tsx scripts/swarm/captureGolden.ts
```

**Output:**
```
🎬 Capturing Golden Transcript
   REPLAY_ID: golden_ts_bucket
   AI_PROVIDER: replay
   SWARM_RECORD: 1

[replay:record] id=golden_ts_bucket run=capture-golden_ts_bucket role=craft idx=0
[replay:record] Wrote fixture: server/ai/engine/__tests__/fixtures/swarm/replays/golden_ts_bucket/craft.json (entry 0)
[replay:record] id=golden_ts_bucket run=capture-golden_ts_bucket role=critic idx=0
[replay:record] Wrote fixture: server/ai/engine/__tests__/fixtures/swarm/replays/golden_ts_bucket/critic.json (entry 0)

✅ Swarm completed successfully
   Status: succeeded
   StopReason: ok
   NeedsHuman: false
   Artifacts: 4

📁 Fixtures saved to:
   server/ai/engine/__tests__/fixtures/swarm/replays/golden_ts_bucket/

🧪 To replay this scenario:
   AI_PROVIDER=replay REPLAY_ID=golden_ts_bucket pnpm vitest server/ai/engine/__tests__/swarm.replay.invariants.test.ts
```

### 2. Replay Golden Transcript

Run tests using the captured fixtures (no network calls, no cost):

```bash
AI_PROVIDER=replay REPLAY_ID=golden_ts_bucket pnpm vitest server/ai/engine/__tests__/swarm.replay.invariants.test.ts
```

**Output:**
```
[replay] id=golden_ts_bucket run=test-apply-ok role=craft idx=0
[replay] id=golden_ts_bucket run=test-apply-ok role=critic idx=0

✓ server/ai/engine/__tests__/swarm.replay.invariants.test.ts (3 tests) 10ms
  ✓ apply_ok: produces APPLY decision
  ✓ reject_ok: produces REJECT decision
  ✓ revise_then_apply: triggers iteration loop
```

### 3. Validate Captured Transcript

Ensure the captured transcript works correctly:

```bash
# Create a test for the new scenario
AI_PROVIDER=replay REPLAY_ID=golden_ts_bucket pnpm vitest server/ai/engine/__tests__/swarm.replay.invariants.test.ts
```

---

## Fixture Structure

### Single Call (No Iteration)

```json
{
  "ok": true,
  "stopReason": "ok",
  "artifact": {
    "kind": "swarm.specialist.craft",
    "payload": {
      "draft": "Fixed TypeScript error by adding null check",
      "notes": ["Added optional chaining", "Preserved existing logic"],
      "stopReason": "ok"
    },
    "customerSafe": false
  }
}
```

### Multiple Calls (Iteration)

```json
[
  {
    "ok": true,
    "stopReason": "ok",
    "artifact": {
      "kind": "swarm.specialist.craft",
      "payload": {
        "draft": "First attempt with type assertion",
        "notes": ["Quick fix"],
        "stopReason": "ok"
      },
      "customerSafe": false
    }
  },
  {
    "ok": true,
    "stopReason": "ok",
    "artifact": {
      "kind": "swarm.specialist.craft",
      "payload": {
        "draft": "Second attempt with proper null check",
        "notes": ["Added if statement", "Safer approach"],
        "stopReason": "ok"
      },
      "customerSafe": false
    }
  }
]
```

---

## Best Practices

### 1. Keep Synthetic Fixtures as Contract Tests

Do **not** delete synthetic fixtures (`apply_ok`, `reject_ok`, `revise_then_apply`). They serve as:

- **Contract tests**: Validate swarm plumbing works correctly
- **Regression tests**: Ensure swarm behavior doesn't break
- **Fast tests**: No network calls, instant feedback

### 2. Add Golden Transcripts as Realism Tests

Capture real scenarios that cover actual value:

- **TS bucket**: Bounded, mechanical edits (type errors, missing imports)
- **Test bucket**: Fixture + gating style changes
- **Migration bucket**: Drizzle/TiDB schema mismatches

### 3. Capture Minimum Required Fields

Per role per iteration, capture:

- **Input prompt hash/id** (optional, for traceability)
- **Assistant JSON output** (the artifact payload)
- **Verdict fields** used by deterministic collapse (e.g., `verdict: "pass"` or `"revise"`)

### 4. Version Control Fixtures

Commit fixtures to git:

```bash
git add server/ai/engine/__tests__/fixtures/swarm/replays/golden_*
git commit -m "feat(swarm): add golden transcript for TS bucket scenario"
```

### 5. Document Scenario Context

Add a README in each scenario folder:

```
server/ai/engine/__tests__/fixtures/swarm/replays/golden_ts_bucket/
  README.md          # What this scenario tests, why it matters
  craft.json
  critic.json
```

---

## Troubleshooting

### Error: "missing trace.role"

**Cause:** The replay provider requires `trace.role` to determine which fixture to load.

**Fix:** Ensure `aimlSpecialist.ts` passes `role` in the trace object:

```typescript
trace: {
  jobId: trace.jobId,
  step: `swarm.specialist.${role}`,
  round: 0,
  role, // explicit role for replay provider
  replayRunId: trace.jobId, // stable per job
}
```

### Error: "Fixture not found"

**Cause:** The replay provider cannot find the fixture file for the specified role.

**Fix:** Ensure the fixture file exists:

```bash
ls server/ai/engine/__tests__/fixtures/swarm/replays/${REPLAY_ID}/${role}.json
```

### Error: "upstreamProvider required for record mode"

**Cause:** Record mode requires a real AI provider to call.

**Fix:** The `providerFactory.ts` automatically uses `aimlProvider` in record mode. No action needed.

---

## Future Enhancements

### 1. Automatic Fixture Rotation

Capture multiple golden transcripts per scenario and rotate through them in tests.

### 2. Fixture Diff Tool

Compare captured fixtures with existing ones to detect AI drift.

### 3. Fixture Validation

Validate captured fixtures match the expected schema before saving.

### 4. CI Integration

Run `captureGolden.ts` in CI on a schedule to keep fixtures fresh.

---

## Related Documents

- [SWARM_PROTOCOL.md](./SWARM_PROTOCOL.md) - Swarm orchestration design
- [FOREVER_CONTRACTS.md](./FOREVER_CONTRACTS.md) - AI constitutional guarantees
- [AI_DRIFT_PROTOCOL_V1.md](./AI_DRIFT_PROTOCOL_V1.md) - Drift detection and containment

---

**Key Achievement:** Swarm is now a deterministic system with a continuous learning loop. Capture real AI responses, replay them deterministically, and validate behavior without network calls or cost.
