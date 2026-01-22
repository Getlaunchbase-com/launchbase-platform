# Escalation Retry Design (L0→L2)

## Goal
When a patch fails to apply due to missing context (e.g., "depends on old contents", "patch does not apply"), automatically retry **once** with richer context (L2: repoIndex + 1-hop imports).

## Hard Rules
1. **Max 1 retry** - No loops, no multi-level escalation
2. **Trigger only on apply failure** - Not on test failures or other errors
3. **Executor owns stopReason** - No "recommendedStopReason" survives past execution
4. **Persist all artifacts** - Original + escalated packets, both patches, retry metadata

## Architecture

### 1. Retry State (scripts/swarm/retryState.ts)
```typescript
interface RetryState {
  retryCount: number;           // 0 or 1
  escalated: boolean;           // true if L2 was used
  escalationReason: string | null;  // e.g., "depends on old contents"
  contextLevelUsed: "L0" | "L2";
  artifacts: {
    originalFailurePacket?: string;
    escalatedFailurePacket?: string;
    firstPatch?: string;
    retryPatch?: string;
    applyStderr?: string;
  };
}
```

### 2. Trigger Logic (shouldEscalateOnApplyFailure.ts)
Already implemented. Triggers on:
- "depends on old contents"
- "patch does not apply"
- "corrupt patch"
- "rejected hunk"
- "can't find file to patch"
- New file creation (--- /dev/null)

### 3. Context Ladder (server/contracts/contextLadder.ts)
Already implemented:
- **L0**: Target file snapshots only
- **L1**: L0 + repoIndex (file listing)
- **L2**: L1 + 1-hop import expansion (local ./ and ../ imports)

Hard caps:
- maxFiles: 25
- maxBytes: 500KB

### 4. Escalation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Run swarm with L0 context                                │
│    - Build L0 context bundle (target snapshots only)        │
│    - Call runRepairSwarm()                                   │
│    - Write patch.first.diff                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Validate patch                                            │
│    - git apply --check                                       │
│    - If corrupt: retry with --recount                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                   ┌────────┴────────┐
                   │  Apply Success? │
                   └────────┬────────┘
                            │
              ┌─────────────┴─────────────┐
              │ YES                       │ NO
              ▼                           ▼
    ┌─────────────────┐      ┌──────────────────────────────┐
    │ Continue to     │      │ Check escalation trigger     │
    │ tests           │      │ shouldEscalateOnApplyFailure │
    └─────────────────┘      └──────────────────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │ Escalate? AND retryCount === 0?   │
                        └─────────────────┬─────────────────┘
                                          │
                            ┌─────────────┴─────────────┐
                            │ YES                       │ NO
                            ▼                           ▼
              ┌──────────────────────────┐    ┌─────────────────┐
              │ 3. Build L2 context      │    │ stopReason =    │
              │    - repoIndex           │    │ "apply_failed"  │
              │    - 1-hop imports       │    │ Exit            │
              │    - Fresh disk snapshots│    └─────────────────┘
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ 4. Persist artifacts     │
              │    - failurePacket.      │
              │      original.json       │
              │    - failurePacket.      │
              │      escalated.json      │
              │    - patch.first.diff    │
              │    - apply.stderr.txt    │
              │    - retryMeta.json      │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ 5. Rerun swarm with L2   │
              │    - Call runRepairSwarm │
              │    - Write patch.retry.  │
              │      diff                │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ 6. Apply retry patch     │
              │    - git apply --check   │
              │    - git apply           │
              └──────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────┐
              │ Continue to tests        │
              └──────────────────────────┘
```

## Implementation Checklist

### Phase 1: Prepare Infrastructure ✅
- [x] Create `retryState.ts` with state tracker
- [x] Create `swarmInlet.ts` contract
- [x] Create `contextLadder.ts` with L0/L1/L2 builders
- [x] `shouldEscalateOnApplyFailure.ts` already exists

### Phase 2: Wire Escalation in runSwarmFix.ts
- [ ] Add retry state initialization at top of main()
- [ ] Wrap swarm+apply in retry-capable function
- [ ] On apply failure:
  - [ ] Check shouldEscalateOnApplyFailure()
  - [ ] Check retryCount === 0
  - [ ] Persist original artifacts
  - [ ] Build L2 context bundle
  - [ ] Rebuild FailurePacket with L2 context
  - [ ] Rerun swarm
  - [ ] Apply retry patch
- [ ] Write retryMeta.json at end
- [ ] Ensure stopReason is executor-owned (no swarm recommendations)

### Phase 3: Artifact Persistence
All artifacts written to `runs/repair/<repairId>/`:
- `failurePacket.json` (or `failurePacket.original.json` if escalated)
- `failurePacket.escalated.json` (if escalated)
- `patch.diff` (or `patch.first.diff` if escalated)
- `patch.retry.diff` (if escalated)
- `apply.stderr.txt` (if apply failed)
- `retryMeta.json` (if escalated)
- `repairPacket.json` (final result)
- `scorecard.json` (final grading)
- `attempts.jsonl` (model routing log)

### Phase 4: Acceptance Criteria
- [ ] f11-new-file-dep-context shows retryCount=1
- [ ] f11 writes all escalation artifacts
- [ ] f11 either succeeds via escalation OR fails with honest stopReason
- [ ] No INFRA regressions in fixture suite
- [ ] test_commands_invalid ≤ 2% (complete runs)

## TODO Locations in runSwarmFix.ts

### Line 228: Add retry state initialization
```typescript
const retryState = createRetryState();
```

### Line 354-398: Wrap apply failure logic
```typescript
if (checkErr) {
  const stderr = checkErr.stderr?.toString() || "";
  
  // Check escalation trigger
  if (shouldEscalateOnApplyFailure(stderr, patchContent) && shouldRetry(retryState)) {
    // Persist original artifacts
    writeFileSync(`${outDir}/failurePacket.original.json`, 
      JSON.stringify(failurePacket, null, 2));
    writeFileSync(`${outDir}/patch.first.diff`, patchContent);
    writeFileSync(`${outDir}/apply.stderr.txt`, stderr);
    
    // Build L2 context
    const l2Context = buildL2Context(swarmInlet, process.cwd());
    
    // Rebuild FailurePacket with L2 context
    const escalatedPacket = {
      ...failurePacket,
      context: {
        ...failurePacket.context,
        level: "L2",
        repoIndex: l2Context.repoIndex,
        snapshots: l2Context.snapshots,
      },
    };
    
    // Mark escalated
    markEscalated(retryState, `Apply failed: ${stderr.substring(0, 100)}`);
    
    // Rerun swarm with L2
    console.log(`🔄 Escalating to L2 context and retrying...`);
    result = await runRepairSwarm({
      failurePacket: escalatedPacket,
      maxCostUsd,
      maxIterations,
      outputDir: outDir,
    });
    
    // Write escalated artifacts
    writeFileSync(`${outDir}/failurePacket.escalated.json`, 
      JSON.stringify(escalatedPacket, null, 2));
    
    // Retry apply with new patch
    // ... (repeat apply logic)
  } else {
    // No retry, fail with honest stopReason
    result.repairPacket.execution.stopReason = "apply_failed";
    result.repairPacket.execution.applied = false;
  }
}
```

### End of main(): Write retryMeta.json
```typescript
if (retryState.escalated) {
  writeFileSync(`${outDir}/retryMeta.json`, JSON.stringify({
    retryCount: retryState.retryCount,
    escalated: retryState.escalated,
    escalationReason: retryState.escalationReason,
    contextLevelUsed: retryState.contextLevelUsed,
    artifacts: retryState.artifacts,
  }, null, 2));
}
```

## Next Steps
1. Implement Phase 2 (wire escalation in runSwarmFix.ts)
2. Test with f11-new-file-dep-context fixture
3. Verify all artifacts are written
4. Run full fixture suite to ensure no regressions
