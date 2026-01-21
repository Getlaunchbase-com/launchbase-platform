# TODO: Context Escalation Ladder Implementation

**Goal:** Escalate context only when needed, keeping runs cheap while ensuring reliability

**Current Status:**
- ✅ Phase 0: Baseline captured (6/10 pass, 60%)
- ✅ Phase 0.5: Preflight error artifacts (preflight.json with errorCode)
- 🔄 Phase 1+2: Implement Context Escalation Ladder

**Key Insight from f1-missing-import:**
- AI correctly created new file + added import
- Patch failed: "new file depends on old contents" (git format issue)
- **Would be fixed by Level 1 escalation** (1-hop imports included upfront)

---

## Context Escalation Ladder

### Level 0 (Always - Baseline)
**What's included:**
- FailurePacket (logs, targets, testCommands)
- fileSnapshots for target file(s) only
- repoIndex (tiny map: paths, sizes, entrypoints)

**Cost:** ~5-10KB overhead
**When:** Every run

### Level 1 (Auto-escalate for TS/import/zod/drizzle errors)
**Trigger conditions:**
- `failure.type === "ts_error"`
- `failure.type === "import_error"`
- `failure.type === "zod_error"`
- `failure.type === "drizzle_error"`
- Error message contains: "Cannot find", "Module not found", "Type", "Schema"

**What to add:**
- `tsconfig.json` (for TS errors)
- `package.json` + `pnpm-lock.yaml` (for import errors)
- 1-hop local imports from targets (parse `./` and `../` imports)

**Caps:**
- Max 10 additional files
- Max 200KB per file
- Max 500KB total added

**Cost:** ~50-200KB overhead

### Level 2 (Auto-escalate on patch/test failure)
**Trigger conditions:**
- Previous run had `stopReason === "patch_invalid"`
- Previous run had `stopReason === "apply_failed"`
- Previous run had `stopReason === "tests_failed"`

**What to add:**
- 2-hop import closure (imports of imports)
- Referenced types/contracts (zod schemas, drizzle schemas, shared types)
- Any files mentioned in error messages

**Caps:**
- Max 25 additional files (total)
- Max 200KB per file
- Max 1MB total snapshots

**Cost:** ~200KB-1MB overhead

### Level 3 (Iterative - swarm requests more files)
**Trigger conditions:**
- Level 2 still failed
- Swarm returns `requestedFiles[]` in RepairPacket

**What to add:**
- Exact files requested by swarm (validated against allowlist)
- Max 2 iterations of this loop

**Caps:**
- Max 10 files per request
- Max 200KB per file
- Max 500KB per iteration

**Cost:** ~500KB per iteration

### Level 4 (Break-glass - full repo bundle)
**Trigger conditions:**
- Manual flag: `--includeRepoBundle`
- Only for internal tooling, never customer-facing

**What to add:**
- Tarball or full file listing + selected snapshots
- No caps (but still respects denylist)

**Cost:** ~5-50MB

---

## Implementation Plan

### Step 1: Create Context Builder
- [ ] Create `scripts/swarm/contextBuilder.ts`:
  - [ ] `buildRepoIndex(root: string): RepoIndex`
  - [ ] `parseImports(filePath: string): string[]`
  - [ ] `resolveImportPath(from: string, importPath: string): string`
  - [ ] `expandSnapshots(targets: string[], level: 0|1|2, failureType?: string): FileSnapshot[]`
  - [ ] `validateAgainstAllowlist(paths: string[]): string[]`
  - [ ] `enforceCapLimits(snapshots: FileSnapshot[], maxFiles: number, maxBytesPerFile: number, maxTotalBytes: number): FileSnapshot[]`

### Step 2: Update FailurePacket Schema
- [ ] Add `repoIndex` field to `server/contracts/failurePacket.ts`
- [ ] Add `contextLevel` field (0, 1, 2, 3, 4)
- [ ] Add `contextBytes` field (total size of fileSnapshots)
- [ ] Add `requestedFiles` field (for Level 3)

### Step 3: Update RepairPacket Schema
- [ ] Add `requestedFiles[]` to output (swarm can ask for more context)
- [ ] Add `contextUsed` field (what level was used)

### Step 4: Update runSwarmFix.ts
- [ ] Add context escalation logic:
  ```typescript
  // Determine initial context level
  let contextLevel = 0;
  if (isTypeScriptError(failurePacket) || isImportError(failurePacket)) {
    contextLevel = 1;
  }
  
  // Build context
  const context = await buildContext(failurePacket, contextLevel);
  
  // Run swarm
  let result = await runRepairSwarm({ ...failurePacket, ...context });
  
  // Escalate if needed (Level 2)
  if (shouldEscalate(result) && contextLevel < 2) {
    contextLevel = 2;
    const expandedContext = await buildContext(failurePacket, contextLevel);
    result = await runRepairSwarm({ ...failurePacket, ...expandedContext });
  }
  
  // Iterative expansion (Level 3)
  let iterations = 0;
  while (result.requestedFiles?.length > 0 && iterations < 2) {
    const additionalFiles = await fetchRequestedFiles(result.requestedFiles);
    result = await runRepairSwarm({ ...failurePacket, ...context, ...additionalFiles });
    iterations++;
  }
  ```

### Step 5: Add Guardrails
- [ ] Strict allowlist: `client/**`, `server/**`, `tsconfig.json`, `package.json`
- [ ] Denylist: `.env*`, `secrets/**`, `drizzle/**`, `node_modules/**`, `.git/**`
- [ ] Size limits enforced at every level
- [ ] Always write context metadata:
  - `contextLevel` used
  - `contextBytes` total
  - `requestedFiles[]` + what got rejected and why

### Step 6: Update Artifacts
- [ ] Write `context.json` in repair run dir:
  ```json
  {
    "level": 1,
    "totalBytes": 45678,
    "filesIncluded": ["server/utils/fixture1.ts", "tsconfig.json", "server/utils/validateEmail.ts"],
    "filesRequested": [],
    "filesRejected": [],
    "escalationReason": "ts_error"
  }
  ```

### Step 7: Test with Failing Fixtures
- [ ] Run f1 with Level 1 context (should pass)
- [ ] Run f2, f6, f9 with appropriate levels
- [ ] Verify pass rate ≥ 8/10 (80%)

---

## Success Criteria

✅ **All must be true:**
1. Context escalation works automatically (no manual flags needed for Levels 0-2)
2. Runs stay cheap (Level 0 for simple fixes, escalate only when needed)
3. Fixture pass rate ≥ 80% (8/10 or better)
4. Context metadata persisted in artifacts
5. Guardrails prevent leaking secrets or overloading context
6. No regressions (6 passing fixtures still pass)

---

## Next Steps

1. ✅ Phase 0.5 complete (preflight.json artifacts)
2. 🔄 Implement Context Builder (Step 1)
3. 🔄 Update schemas (Steps 2-3)
4. 🔄 Integrate into runSwarmFix (Step 4)
5. 🔄 Add guardrails (Step 5)
6. 🔄 Test and validate (Steps 6-7)
7. 🔄 Save checkpoint
