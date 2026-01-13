# Dev/Staging Snapshot Workflow

**Version:** 1.0  
**Status:** Canonical  
**Last Updated:** January 12, 2026

> **Purpose:** Define the safe workflow to validate AI Tennis metrics and test features without touching production data.  
> **Principle:** Production is read-only for validation. All writes happen in dev/staging.

---

## 0. Hard Rules (Non-Negotiable)

### Production Database Rules

1. **Read-only access only** for metrics validation
2. **No seeding** of test data or synthetic scenarios
3. **No cleanup scripts** (no DELETE, UPDATE, TRUNCATE)
4. **No schema changes** without architectural review
5. **No "test scenarios"** that create ActionRequests or Intakes

### Enforcement

All scripts that write to the database MUST include environment checks:

```typescript
// Example: Hard fail if running against production
const dbName = process.env.DATABASE_URL?.match(/\/([^/?]+)(\?|$)/)?.[1];
const allowedDbNames = ["dev", "staging", "test"];

if (!dbName || !allowedDbNames.includes(dbName)) {
  console.error("❌ ABORT: This script cannot run against production");
  console.error(`   Database: ${dbName}`);
  console.error(`   Allowed: ${allowedDbNames.join(", ")}`);
  process.exit(1);
}
```

---

## 1. Creating a Dev/Staging Snapshot

### Option A: Schema-Only Snapshot (Recommended for Development)

**Use case:** Local development, testing new features, validating SQL queries

**Steps:**

1. **Export production schema (structure only):**
   ```bash
   mysqldump --no-data --routines --triggers \
     -h <prod-host> -u <readonly-user> -p <prod-db> \
     > schema_only.sql
   ```

2. **Create local dev database:**
   ```bash
   mysql -u root -p -e "CREATE DATABASE launchbase_dev;"
   mysql -u root -p launchbase_dev < schema_only.sql
   ```

3. **Seed synthetic data:**
   ```bash
   pnpm tsx scripts/seedDevData.ts
   ```

4. **Verify environment:**
   ```bash
   echo $DATABASE_URL
   # Should point to launchbase_dev, NOT production
   ```

### Option B: Masked Snapshot (For Staging with Realistic Data)

**Use case:** Staging environment, load testing, realistic workflow validation

**Steps:**

1. **Export production data with masking:**
   ```bash
   mysqldump -h <prod-host> -u <readonly-user> -p <prod-db> \
     | sed 's/real-email@example.com/masked-email@example.com/g' \
     | sed 's/555-1234/000-0000/g' \
     > masked_snapshot.sql
   ```

2. **Create staging database:**
   ```bash
   mysql -u root -p -e "CREATE DATABASE launchbase_staging;"
   mysql -u root -p launchbase_staging < masked_snapshot.sql
   ```

3. **Verify masking:**
   ```sql
   SELECT email, phone FROM users LIMIT 10;
   -- Should show masked values, not real customer data
   ```

4. **Update DATABASE_URL:**
   ```bash
   export DATABASE_URL="mysql://user:pass@localhost/launchbase_staging"
   ```

---

## 2. Running Metrics Validation

### Weekly Report Script (Read-Only)

**Safe to run against production:**

```bash
# Production (read-only)
pnpm tsx scripts/generateWeeklyAiReport.ts
```

**Output:** `reports/ai_weekly_<YYYY-MM-DD>.md`

**Guardrails:**
- No writes to database
- No schema changes
- No prompt content logged

### Metrics Validation on Dev/Staging

**Steps:**

1. **Verify environment:**
   ```bash
   echo $DATABASE_URL | grep -E "(dev|staging|test)"
   # Should match one of: dev, staging, test
   ```

2. **Seed test AI Tennis data:**
   ```bash
   pnpm tsx scripts/seedAiTennisTestData.ts
   ```

3. **Run weekly report:**
   ```bash
   pnpm tsx scripts/generateWeeklyAiReport.ts
   ```

4. **Verify output:**
   ```bash
   cat reports/ai_weekly_<date>.md
   # Should show populated metrics, not empty tables
   ```

---

## 3. Running Cleanup Scripts

### Hard Rule: Staging Only

**Never run cleanup scripts against production.**

**Allowed environments:**
- `launchbase_dev`
- `launchbase_staging`
- `launchbase_test`

**Example cleanup script with guardrails:**

```typescript
// scripts/cleanupStaleDrafts.ts
import { getDb } from "../server/db";

async function main() {
  const dbName = process.env.DATABASE_URL?.match(/\/([^/?]+)(\?|$)/)?.[1];
  const allowedDbNames = ["dev", "staging", "test"];

  if (!dbName || !allowedDbNames.includes(dbName)) {
    console.error("❌ ABORT: Cleanup scripts cannot run against production");
    console.error(`   Database: ${dbName}`);
    process.exit(1);
  }

  console.log(`✅ Running cleanup on ${dbName}...`);
  
  const db = await getDb();
  // ... cleanup logic here
}

main();
```

---

## 4. "How to Verify You Are NOT on Prod" Checklist

Before running any write operation, verify:

- [ ] `DATABASE_URL` contains `dev`, `staging`, or `test`
- [ ] Database name is NOT the production database name
- [ ] Script includes hard fail on production detection
- [ ] No `--force` or `--skip-checks` flags used
- [ ] Reviewed script for DELETE/UPDATE/TRUNCATE statements
- [ ] Tested script on local dev first

**Quick verification command:**

```bash
echo $DATABASE_URL | grep -qE "(dev|staging|test)" && echo "✅ Safe" || echo "❌ PRODUCTION - ABORT"
```

---

## 5. Real Workflow Test (Staging)

### Purpose

Validate that AI Tennis → ActionRequest → Metrics pipeline works end-to-end.

### Steps

1. **Verify staging environment:**
   ```bash
   echo $DATABASE_URL | grep staging
   ```

2. **Run one real copy refine request:**
   ```bash
   curl -X POST https://staging.launchbase.com/api/intakes/1/ai-propose-copy \
     -H "Content-Type: application/json" \
     -d '{"userText": "Improve my homepage headline", "targetSection": "hero"}'
   ```

3. **Verify ActionRequest created:**
   ```sql
   SELECT id, checklistKey, proposedValue, messageType, createdAt
   FROM action_requests
   WHERE messageType = 'AI_TENNIS_COPY_REFINE'
   ORDER BY createdAt DESC
   LIMIT 1;
   ```

4. **Verify rawInbound.aiTennis metadata:**
   ```sql
   SELECT
     JSON_EXTRACT(rawInbound, '$.source') AS source,
     JSON_EXTRACT(rawInbound, '$.aiTennis.stopReason') AS stopReason,
     JSON_EXTRACT(rawInbound, '$.aiTennis.costUsd') AS costUsd
   FROM action_requests
   WHERE messageType = 'AI_TENNIS_COPY_REFINE'
   ORDER BY createdAt DESC
   LIMIT 1;
   ```

5. **Re-run weekly report:**
   ```bash
   pnpm tsx scripts/generateWeeklyAiReport.ts
   ```

6. **Verify metrics populated:**
   ```bash
   cat reports/ai_weekly_<date>.md | grep -A 5 "stopReason"
   # Should show real stopReason values, not empty rows
   ```

---

## 6. Incident Response: Accidental Production Write

### If you accidentally ran a write script against production:

1. **STOP immediately** (Ctrl+C if still running)
2. **Document what happened:**
   - What script was run
   - What data was written/modified
   - Approximate timestamp
3. **Notify team immediately**
4. **Review audit logs:**
   ```sql
   SELECT * FROM action_request_events
   WHERE createdAt >= '<incident-timestamp>'
   ORDER BY createdAt DESC;
   ```
5. **Assess impact:**
   - Were customer-facing records modified?
   - Were test records created in production?
6. **Rollback if possible:**
   - Use database backups if available
   - Manual cleanup if small scope
7. **Update this doc** with lessons learned

---

## 7. References

- **FOREVER_CONTRACTS.md** — Constitutional guarantees (§8: No Production Seeding)
- **AI_DRIFT_PROTOCOL_V1.md** — Weekly review cadence and metrics
- **AI_METRICS_QUERIES.md** — Canonical SQL queries (read-only)

---

## 8. Changelog

| Date | Version | Change |
|------|---------|--------|
| 2026-01-12 | 1.0 | Initial version |
