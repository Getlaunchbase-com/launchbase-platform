# ✅ Test Repair Workflow (Mechanical-First Ladder)

This project uses a mechanical-first repair ladder that consistently turns red test suites into deterministic, high-signal CI runs — without accidental product behavior changes.

This workflow is optimized for:

- **fast progress with bounded patches**
- **avoiding "fix one thing, break three things"**
- **preventing test pollution / fixture collisions**
- **enabling deterministic swarm-based repairs with replay + record**

---

## 🧭 The Ladder: Tier 0 → Tier 1 → Tier 2

We don't treat all failures equally. We bucket them by repair risk + coupling + ROI.

### Tier 0 — Guaranteed Wins (Mechanical)

**Definition:** Fix is deterministic, bounded, and almost certainly test-only.

✅ **Examples:**

- **copy drift:** assertion string mismatch ("Renovamos" → "Actualizamos")
- **API contract drift:** `expect(true)` but function now returns `{ ok: true, ... }`
- **missing import:** `http is not defined`
- **wrong await:** `createApp()` pattern (SuperTest / server init)
- **syntax errors** from previous edits (unterminated strings)
- **missing mock export:** `No "getIntakeById" export is defined`

**Rules:**

- 1 file ideally, 2 max
- tests-only preferred
- no schema redesign, no refactors
- expect green in < 2 minutes

---

### Tier 1 — Coupled but Bounded

**Definition:** Fix requires understanding a local API lifecycle or schema evolution, but still contained.

✅ **Examples:**

- **PromptPack schema drift:** fixture shape mismatch with Zod schema
- **memory transport routing mismatches** (trace.step mapping → schema)
- **service count expectation drift** (email now counts separately)
- **deterministic mock seeding fixes**

**Rules:**

- 1–3 files
- allow local helper changes if they reduce future failures
- prefer "update fixture or expectation" over changing production behavior
- verify with targeted suite reruns

---

### Tier 2 — Integration / Behavior Drift (Stop & Decide)

**Definition:** Fix may require product behavior decisions, multi-module coordination, or integration-specific fixtures.

✅ **Examples:**

- **buildPlan fixture missing** across multiple integration tests
- **policy gates (Facebook)** returning early before mocked policy check
- **DB fixture lifecycle** and tenant filtering interactions
- **tests that pass in isolation but fail in full suite** (pollution)

**Rules:**

- isolate whether it's test bug or real behavior drift
- fix by fixture isolation first
- avoid broad product changes
- add guardrails so it can't regress

---

## 🔥 The Core Strategy: Fix Mechanical Buckets First

A stable CI comes from eliminating "noise failures" first:

1. **Test harness / bootstrapping**
2. **Mock wiring and isolation**
3. **Fixture collisions**
4. **Assertion drift**
5. **Only then: deeper integration logic**

This is how we reliably climb from ~80% → ~97% → ~100% pass rate without thrash.

---

## ✅ High-Leverage Patterns Library

These are the patterns that cleared huge buckets quickly.

---

### Pattern A — Async app factory: ALWAYS await createApp()

**Symptom:**

- `app.address is not a function`
- SuperTest crashes
- request handlers never attach correctly

**Fix:**

```typescript
let app: Express;

beforeAll(async () => {
  app = await createApp();
});
```

---

### Pattern B — SuperTest expects http.Server in some versions

If Express app is being treated like a server:

```typescript
import * as http from "node:http";
const server = http.createServer(app);
await request(server).post(...);
```

(If using this, don't close the server unless you call `.listen()`.)

---

### Pattern C — Copy drift: Update tests to match production copy

**Symptom:**

- assertion expects old text
- production copy changed intentionally

**Fix type:**

- Update test assertion, not email copy content

✅ **Example:**

```typescript
expect(subject).toContain("Actualizamos");
```

---

### Pattern D — Fail-loud by design: unknown email type should throw

If email copy lookup is intentionally strict, tests should assert throw:

```typescript
expect(() =>
  getEmailTemplate("unknown_type" as any, data)
).toThrow("[emailCopy] Missing copy");
```

---

### Pattern E — Mock wiring: Hoist vi.mock() + no static imports

Classic failure mode: mock never applies because module was imported before mock registered.

✅ **Rules:**

- **No static import** of the mocked module in the test file
- **Hoist vi.mock()** at top-level
- **Use vi.resetModules()** before dynamic imports

✅ **Template:**

```typescript
import { vi, beforeEach } from "vitest";

vi.mock("../services/facebook-policy", () => ({
  checkFacebookPostingPolicy: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
});

it("...", async () => {
  const { appRouter } = await import("../routers");
});
```

---

### Pattern F — Safety gate bypass: mock upstream blockers to hit policy branch

If a "safety gate" returns early (e.g. severe weather), the policy mock never runs.

✅ **Fix:** Mock the upstream intelligence provider so code reaches policy check.

```typescript
vi.mock("../services/weather", () => ({
  getWeatherIntelligence: vi.fn(() => ({
    safetyGate: false,
  })),
}));
```

---

### Pattern G — Fixture ID collisions: never use global IDs like 1/2

This caused full-suite-only failures.

**Rule:** every test file uses unique ID ranges. Example:

- `template-versioning` uses IDs 1/2
- `tenant-filtering` must use 101/102 (or 1001/1002)

✅ **Fix:**

```typescript
const BUILDPLAN_ID_1 = 101;
const BUILDPLAN_ID_2 = 102;
```

---

### Pattern H — Integration fixtures: "exists + has plan" gate

If code checks:

```typescript
if (!buildPlan || !buildPlan.plan) throw ...
```

Then tests must seed `buildPlan.plan` as non-null JSON.

---

## 🧼 Fixture Isolation Rules (Non-Negotiable)

These rules prevent "passes in isolation, fails in suite" problems.

### ✅ 1) Unique ID ranges per test file

Use 100+ offsets or per-suite ID blocks.

**Recommended ranges:**

- **100–199:** tenant filtering / tenant isolation tests
- **200–299:** template versioning tests
- **1000–1999:** large integration fixtures

### ✅ 2) Prefer truncate/reset in beforeEach for DB tests

If tests mutate DB state:

- truncate tables
- reset sequences if needed
- isolate tenants explicitly

### ✅ 3) Never share mutable singleton state across tests

If using provider singletons (e.g. replay provider), add a test reset hook.

**Example:**

```typescript
__resetReplayProviderForTests();
```

---

## 🧪 How This Connects to Swarm Repair Infrastructure

Swarm is only useful once tests are:

- **deterministic**
- **isolated**
- **network-safe**
- **replayable**

This workflow is designed to build that runway first.

### ✅ Swarm Tools We Use

- **Replay mode:** deterministic, no network
- **Record mode:** capture real AIML output into fixtures
- **Golden transcripts:** CI trust anchors enforced by invariant tests

### ✅ Core Swarm Env Vars

- `AI_PROVIDER=replay`
- `SWARM_REPLAY_RUN_ID=<scenario_id>`
- `SWARM_RECORD=1` (recording mode)
- `SWARM_RECORD_ALLOW_OVERWRITE=1` (explicit overwrite guard)

### ✅ Why Golden Transcripts Matter

They turn swarm from "cool" into infrastructure:

- **deterministic behavior in CI**
- **measurable success/failure conditions**
- **regression protection** for APPLY / REVISE / REJECT behavior

### ✅ Canonical Golden Scenarios (Example Set)

- **Clean APPLY:** pass=true, single iteration
- **Iteration loop:** revise → revise → needs_human (maxIterations exhaustion)
- **Hard REJECT:** no edits allowed / constraint violation

---

## ✅ Execution Checklist: Burn Down a Failing Suite

### Step 0 — Baseline snapshot

**Run:**

```bash
pnpm test
```

**Write down:**

- passed / failed / skipped
- top 3 error signatures

---

### Step 1 — Tier 0 sweep (fastest ROI)

**Fix:**

- syntax errors
- missing imports
- copy drift
- mock export gaps
- async app boot issues
- obvious contract drift

**Goal:** remove "noise failures."

---

### Step 2 — Tier 1 sweep (fixtures + schema drift)

**Fix:**

- schema mismatches in fixtures
- step → schema routing for memory provider
- expectation drift for service counts / new behaviors
- missing feature flags in mocks (json_schema, model types)

---

### Step 3 — Tier 2 decision fixes

**Resolve:**

- integration fixtures
- policy middleware behavior
- "fails only in suite" pollution issues
- consistent early-return behavior

---

### Step 4 — Lock in guardrails

**Add:**

- invariant tests (if behavior matters)
- fixture ID isolation rules
- mock wiring templates
- golden transcript coverage if swarm-related

---

## 📈 ROI Tracking Template (Optional but Useful)

Use this to quantify value (especially for swarm repairs):

- **Bucket:** Tier0/Tier1/Tier2
- **Failure signature:**
- **Fix type:**
- **Swarm involvement:** propose / iterate / apply / rejected
- **Files changed:**
- **Lines changed:**
- **Iterations:**
- **Time to green:**
- **Tests fixed:**
- **Notes / learned invariant:**

---

## ✅ "Do Not Do" List (Prevents Regressions)

- ❌ Don't disable tests to make CI green unless explicitly marking network-gated behavior
- ❌ Don't "fix" production copy to satisfy tests unless product wants that copy reverted
- ❌ Don't seed fixtures with global IDs shared across files (1/2/etc.)
- ❌ Don't use static imports in tests when mocking that same module
- ❌ Don't rely on real providers in CI (network gating + replay exist for a reason)

---

## ✅ Summary

This workflow consistently delivers:

- **deterministic CI signal**
- **stable tests at high pass rates**
- **bounded changes with low regression risk**
- **swarm repairs that are measurable + replayable**

When applied in order: **Tier 0 → Tier 1 → Tier 2** …we can rapidly climb from red to fully green without thrash.

---

## 🚀 Real-World Success Story

**Starting Point:** 551/570 tests passing (96.7%)

**Ending Point:** 573/573 tests passing (100%)

**Key Fixes Applied:**

1. **ModelPolicy mock** (Tier 1): Changed model type from "text" to "chat-completion"
2. **buildPlan fixtures** (Tier 2): Added fixtures with correct insertId access pattern
3. **Facebook DRAFT/QUEUE** (Tier 2): Fixed mock wiring + weather intelligence bypass
4. **Tenant-filtering pollution** (Tier 2): Changed buildPlan IDs from 1/2 to 101/102

**Time to 100%:** ~3 hours of focused mechanical repairs

**Files Modified:** 4 test files, 0 production behavior changes

**Guardrails Added:** Fixture ID isolation rules, mock wiring templates, safety gate bypass patterns
