# TEST_FIX_PATTERNS.md

A practical copy/paste cookbook for turning failing tests green using the Mechanical-First Ladder.

---

## Pattern A — ALWAYS await createApp()

### Symptom
- `TypeError: app.address is not a function`
- SuperTest failures / request hangs
- app is a Promise

### Fix
```ts
let app: Express;

beforeAll(async () => {
  app = await createApp();
});

it("...", async () => {
  const res = await request(app).get("/health");
  expect(res.status).toBe(200);
});
```

---

## Pattern B — Wrap Express in http.Server for SuperTest

### Symptom
- SuperTest calls `.address()` on an Express instance

### Fix
```ts
import * as http from "node:http";
import request from "supertest";

let server: http.Server;

beforeAll(async () => {
  const app = await createApp();
  server = http.createServer(app);
});

it("...", async () => {
  const res = await request(server).post("/api/stripe/webhook").send("{}");
  expect(res.status).toBe(200);
});
```

✅ **Note:** If you never call `server.listen()`, you do not need to `server.close()`.

---

## Pattern C — Copy drift: update test, not production copy

### Symptom
- Test expects old text / translation

### Fix
```ts
expect(subject).toContain("Actualizamos"); // not Renovamos
```

✅ **Rule:** If product copy changed intentionally, the test must track production.

---

## Pattern D — API return shape drift: boolean → object

### Symptom
- Test expects `true`
- Function now returns `{ ok: true, ... }`

### Fix
```ts
const result = await sendEmail(...);
expect(result.ok).toBe(true);
```

---

## Pattern E — Fail-loud contract: unknown types should throw

### Symptom
- Test expects fallback behavior
- Production intentionally throws

### Fix
```ts
expect(() =>
  getEmailTemplate("unknown_type" as any, baseData)
).toThrow("[emailCopy] Missing copy");
```

---

## Pattern F — Mock export missing

### Symptom
- `No "<fn>" export is defined on the "./db" mock`

### Fix
```ts
vi.mock("../db", () => ({
  getIntakeById: vi.fn(async () => ({ id: 123 })),
}));
```

---

## Pattern G — Vitest mock wiring: hoist mocks + dynamic import

### Symptom
- mocks don't apply
- test hits real module logic
- "classic import order bug"

### Fix template
```ts
import { vi, beforeEach } from "vitest";

vi.mock("../services/foo", () => ({
  foo: vi.fn(),
}));

beforeEach(() => {
  vi.resetModules();
});

it("...", async () => {
  const { subject } = await import("../subject");
});
```

✅ **Rules:**
- **no static import** of `../subject` above `vi.mock`
- use `vi.resetModules()` when multiple tests load different mock configs

---

## Pattern H — Safety gate blocks policy path: mock upstream early-return

### Symptom
- test expects policy output but returns early
- `action`/`stopReason` missing

### Fix
```ts
vi.mock("../services/weather", () => ({
  getWeatherIntelligence: vi.fn(async () => ({ safetyGate: false })),
}));
```

---

## Pattern I — Fixture ID collisions: never reuse 1/2 across suites

### Symptom
- passes in isolation, fails in full suite
- "buildPlan 1 not found" or wrong row returned

### Fix
Use unique IDs per file:

```ts
const BUILDPLAN_ID_1 = 101;
const BUILDPLAN_ID_2 = 102;
```

✅ **Recommended ranges:**
- **100–199** tenant tests
- **200–299** template tests
- **1000+** integration fixtures

---

## Pattern J — Fixture must satisfy existence gates

### Symptom
- `buildPlan not found` or `has no plan`

### Fix
Ensure fixture includes required JSON:

```ts
await db.buildPlans.insert({
  id: 101,
  intakeId,
  templateId,
  status: "ready",
  plan: { steps: [{ name: "a" }] },
});
```

---

## Pattern K — PromptPack / memory fixtures drift: map trace.step → schema

### Symptom
- `validation.ok=false`
- memory provider can't find fixture

### Fix approach
1. Read real schema expected shape (Zod)
2. Update fixture to match required fields only
3. Update `schemaFromTraceOrFallback()` mappings

Example mapping:
```ts
if (step === "test") return "decision_collapse";
```

---

## Pattern L — ModelPolicy mock: model.type must match constraints

### Symptom
- `No eligible models ... requiredFeatures=["json_schema"]`

### Fix
Ensure model type matches:

```ts
type: "chat-completion"
features: ["json_schema"]
```

---

## Pattern Q — Resend deterministic tests (package-level mock)

### When to use
- Tests that assert `provider: "resend"` (happy path) or exercise email delivery routing
- You hit import-order / module-cache issues where `vi.spyOn()` or boundary mocks don't intercept
- You need deterministic behavior without depending on `RESEND_API_KEY` or network

### Why this works
`email.ts` (or downstream code) may instantiate `new Resend()` or import resend early. Mocking the package ensures all call sites see the stub, regardless of internal adapter boundaries.

### Template: happy-path Resend succeeds

```ts
import { describe, it, expect, vi } from "vitest";

describe("email delivery via Resend (deterministic)", () => {
  it("sends via resend and returns provider=resend", async () => {
    // 1) Reset module cache so mocks apply to fresh imports
    await vi.resetModules();

    // 2) Register package mock BEFORE importing module under test
    vi.doMock("resend", () => {
      class Resend {
        emails = {
          send: vi.fn(async () => ({
            data: { id: "email_mock_123" },
            error: null,
          })),
        };
      }
      return { Resend };
    });

    // 3) Import AFTER mocks are in place
    const { sendEmail } = await import("../email"); // adjust path

    // 4) Run
    const res = await sendEmail({
      to: "test@example.com",
      type: "intake_confirmation",
      // ...whatever your call requires
    });

    expect(res.ok).toBe(true);
    expect(res.provider).toBe("resend");
  });
});
```

### Template: force Resend failure (tests fallback behavior)

Use this when you want to assert fallback to "notification" (or whatever your fallback provider is).

```ts
import { describe, it, expect, vi } from "vitest";

describe("email fallback when Resend fails", () => {
  it("falls back to notification provider", async () => {
    await vi.resetModules();

    vi.doMock("resend", () => {
      class Resend {
        emails = {
          send: vi.fn(async () => ({
            data: null,
            error: { message: "daily_quota_exceeded", name: "rate_limit" },
          })),
        };
      }
      return { Resend };
    });

    const { sendEmail } = await import("../email"); // adjust path

    const res = await sendEmail({
      to: "test-fallback@example.com",
      type: "intake_confirmation",
      // ...
    });

    expect(res.ok).toBe(true);
    expect(res.provider).toBe("notification");
  });
});
```

### Rules / gotchas (read this if you've been burned)

1. **Never** `import { sendEmail } ...` at the top of the file if you're mocking resend. You must dynamic import after `vi.doMock`.
2. Prefer `vi.doMock` over `vi.mock` when you need per-test control.
3. Use `await vi.resetModules()` at the start of each test that sets different mock behavior.
4. If multiple tests in the same file need the same mock behavior, you can put `resetModules + doMock` in `beforeEach`, but only if every test in the file expects the mock.
5. Keep the mock surface minimal: only `new Resend().emails.send()` needs to exist for most flows.

### What this pattern proves
- Happy path is deterministic and does not depend on secrets or the network
- Fallback path is deterministic and can be asserted explicitly
- No global mock bleed if you follow: `resetModules → doMock → dynamic import`

---

## Quick Reference Table

| Pattern | Symptom Keyword | Tier | Fix Type |
|---------|----------------|------|----------|
| A | `app.address is not a function` | 0 | await createApp() |
| B | SuperTest `.address()` | 0 | wrap in http.Server |
| C | old text / translation | 0 | update test assertion |
| D | expects `true`, got object | 0 | check `.ok` property |
| E | expects fallback, throws | 0 | assert `.toThrow()` |
| F | mock export missing | 0 | add to vi.mock() |
| G | mock doesn't apply | 1 | hoist + dynamic import |
| H | policy path blocked | 2 | mock upstream gate |
| I | fails in full suite | 2 | unique fixture IDs |
| J | buildPlan not found | 2 | seed required JSON |
| K | validation.ok=false | 1 | update fixture schema |
| L | no eligible models | 1 | fix model type/features |
| Q | Resend mock bleed / import order | 0 | vi.doMock("resend") + dynamic import |

---

## Usage

1. **Identify the symptom** from test output
2. **Find the matching pattern** in this document
3. **Copy/paste the fix template**
4. **Adapt to your specific test file**
5. **Verify with targeted test run**

---

## See Also

- [TEST_REPAIR_WORKFLOW.md](./TEST_REPAIR_WORKFLOW.md) - Complete workflow and ladder approach
- [AI_DRIFT_PROTOCOL_V1.md](./AI_DRIFT_PROTOCOL_V1.md) - Operational discipline for AI systems
