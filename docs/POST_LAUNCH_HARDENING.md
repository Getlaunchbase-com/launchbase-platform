# Post-Launch Hardening Checklist

**Status:** Ready to execute after launch  
**Estimated effort:** 1-2 hours total  
**Priority:** High (prevents regressions, improves observability)

---

## Definition of "Repeatable"

A deployment is repeatable when you can run one command / one checklist and get:

1. ✅ E2E flow passes (Apply → Preview → Pay → Deploy → Live)
2. ✅ Cron is wired to canonical endpoints
3. ✅ Worker cannot "go idle" while work exists
4. ✅ You can answer "what happened?" from logs/DB without guessing

---

## The "Never Again + Repeatable" Backlog

### 1. Remove `/api/worker/*` endpoints (finish migration)

**Why:** One contract only. No drift.

**Tasks:**
- [ ] Delete `/api/worker/run-next-deploy` route
- [ ] Delete `/api/worker/auto-advance` route
- [ ] Remove `withDeprecationHeaders` wrapper
- [ ] Remove in-memory `deprecatedWorkerHits` counter
- [ ] Update Vitest: assert `POST /api/worker/*` returns 404 JSON
- [ ] Keep `/api/cron/*` POST-only + health

**✅ Output:** A single canonical cron surface forever.

**Files to modify:**
- `server/_core/index.ts` (remove worker routes)
- `server/worker/deprecation.ts` (delete file)
- `server/cron/*.test.ts` (update tests)

---

### 2. Add durable run logging (minimum viable observability)

**Why:** "Did cron run?" becomes queryable.

**Option A: New `worker_runs` table (recommended)**

```typescript
export const workerRuns = mysqlTable("worker_runs", {
  id: int("id").autoincrement().primaryKey(),
  job: mysqlEnum("job", ["run-next-deploy", "auto-advance"]).notNull(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),
  ok: boolean("ok").notNull(),
  processed: int("processed").default(0).notNull(),
  deploymentId: int("deploymentId"),
  error: text("error"),
});
```

**Option B: Reuse existing logs table**
- Extend `decisionLogs` or `emailLogs` with worker run data
- Less clean but avoids new table

**Where to write:**
- At start of handler (insert with `startedAt`)
- On success/fail (update with `finishedAt`, `ok`, `processed`, `error`)

**✅ Output:** Can query "What deployments were processed in the last hour?" or "Did cron run at 3am?"

**Files to modify:**
- `drizzle/schema.ts` (add table)
- `server/worker/deploymentWorker.ts` (add logging)
- `server/worker/autoAdvance.ts` (add logging)

---

### 3. Add business-critical regression test: "queued deployment gets processed"

**Why:** CI fails if the worker ever stops seeing queued work (prevents NULL status incident).

**Test shape (integration-lite):**

```typescript
describe("Deployment Worker", () => {
  it("processes queued deployments", async () => {
    // Arrange: Insert a queued deployment
    const [deployment] = await db.insert(deployments).values({
      intakeId: 1,
      buildPlanId: 1,
      status: "queued",
    }).$returningId();

    // Act: Run the worker
    const result = await runNextDeploy();

    // Assert
    expect(result.processed).toBe(1);
    expect(result.deploymentId).toBe(deployment.id);
    
    // Verify status changed
    const updated = await db.select()
      .from(deployments)
      .where(eq(deployments.id, deployment.id))
      .limit(1);
    expect(updated[0].status).not.toBe("queued");
  });
});
```

**✅ Output:** CI catches worker query bugs before production.

**Files to create:**
- `server/worker/deploymentWorker.test.ts`

---

### 4. Enforce invariants so bad data can't silently accumulate

**Why:** The system yells early instead of failing silently.

**Add a "DB sanity" check that runs:**
- In dev on boot
- In CI before tests
- Optionally: as a `/api/health/db-sanity` endpoint

**Checks:**
```typescript
async function checkDbSanity() {
  const checks = [];

  // Check 1: No NULL status in deployments
  const [nullStatus] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(deployments)
    .where(isNull(deployments.status));
  checks.push({
    name: "deployments.status not NULL",
    passed: nullStatus.count === 0,
    message: `Found ${nullStatus.count} deployments with NULL status`,
  });

  // Check 2: Paid intakes have deployments (or are intentionally suppressed)
  const [paidWithoutDeployment] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(intakes)
    .leftJoin(deployments, eq(intakes.id, deployments.intakeId))
    .where(and(
      eq(intakes.status, "paid"),
      isNull(deployments.id)
    ));
  checks.push({
    name: "paid intakes have deployments",
    passed: paidWithoutDeployment.count === 0,
    message: `Found ${paidWithoutDeployment.count} paid intakes without deployments`,
  });

  return checks;
}
```

**✅ Output:** Loud warnings in dev/CI when invariants break.

**Files to create:**
- `server/health/dbSanity.ts`
- `server/_core/index.ts` (call on boot in dev)

---

### 5. Make E2E executable as a repeatable script

**Why:** Onboarding + future debugging becomes trivial.

**Create:** `docs/runbooks/e2e-apply-pay-deploy.md`

**Includes:**
- Test email convention (`e2e-test-{date}@launchbase-test.com`)
- Stripe test card (4242 4242 4242 4242)
- Where to look in DB/logs at each gate
- Expected emails & triggers
- "What to do if stuck at Gate X" troubleshooting
- SQL queries to verify each gate
- Expected response from `/api/cron/run-next-deploy`

**✅ Output:** Anyone can run E2E without tribal knowledge.

**Files to create:**
- `docs/runbooks/e2e-apply-pay-deploy.md`

---

## The Smallest "Repeatable Next PR"

If you want one PR that delivers maximum repeatability fast:

1. ✅ Remove `/api/worker/*`
2. ✅ Update Vitest to assert 404 on worker paths
3. ✅ Add minimal `worker_runs` logging table
4. ✅ Add "queued deployment is visible" test

**That's the real "never again" bundle.**

---

## Recommended Execution Order

### Phase 1: Cleanup (30 min)
1. Remove `/api/worker/*` endpoints
2. Update tests to assert 404

### Phase 2: Observability (30 min)
3. Add `worker_runs` table
4. Add logging to worker handlers

### Phase 3: Safety (30 min)
5. Add deployment worker regression test
6. Add DB sanity checks

### Phase 4: Documentation (15 min)
7. Create E2E runbook

---

## Decision Point: Logging Table

**Question:** Should we add a new `worker_runs` table or reuse existing logs?

**Recommendation:** Add new `worker_runs` table because:
- Clean separation of concerns
- Easier to query "what did the worker do?"
- Doesn't pollute `decisionLogs` or `emailLogs` with different schema

**Alternative:** Reuse `decisionLogs` if you want to avoid new table, but add a `type` field to distinguish worker runs.

---

## Success Criteria

After completing this checklist:

- [ ] No deprecated worker endpoints exist
- [ ] Can query "Did cron run?" from database
- [ ] CI catches worker query bugs
- [ ] Bad data is detected early
- [ ] New developers can run E2E without help

**Status:** Ready to execute post-launch
