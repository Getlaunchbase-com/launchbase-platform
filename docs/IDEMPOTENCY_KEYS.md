# Idempotency Keys

## Purpose

The `idempotency_keys` table implements Stripe-style idempotency protection for expensive AI operations (AI Tennis copy refinement). It prevents double-spend scenarios caused by:

- Duplicate clicks
- Browser refreshes
- Network timeouts and retries
- Race conditions in concurrent requests

## Table Schema

```sql
CREATE TABLE `idempotency_keys` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `tenant` varchar(64) NOT NULL,
  `scope` varchar(255) NOT NULL,  -- e.g., "actionRequests.aiProposeCopy"
  `key_hash` varchar(64) NOT NULL,  -- HMAC-SHA256 hex (prevents key guessing)
  `claim_nonce` varchar(40),  -- Ownership guard (precision-proof)
  `status` enum('started','succeeded','failed') NOT NULL DEFAULT 'started',
  `response_json` json,  -- Customer-safe cached response (no prompts/errors)
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `started_at` timestamp,  -- When operation started (for stale takeover)
  `completed_at` timestamp,  -- When operation completed/failed
  `expires_at` timestamp,  -- TTL for cleanup
  `attempt_count` int NOT NULL DEFAULT 1,  -- Retry counter for stale takeover
  UNIQUE KEY `idempotency_keys_tenant_scope_keyhash_unique` (`tenant`,`scope`,`key_hash`),
  KEY `idempotency_keys_expires_idx` (`expires_at`),
  KEY `idempotency_keys_stale_idx` (`status`,`started_at`)
);
```

## Status Flow

```
┌─────────┐
│ started │ ──(operation succeeds)──> succeeded
└─────────┘
     │
     └──(operation fails)──> failed ──(retry)──> started
```

### Status Meanings

- **started**: Operation claimed and running (or stale)
- **succeeded**: Operation completed successfully, response cached
- **failed**: Operation failed, retry allowed

## TTL Policy

**Default TTL**: 24 hours (recommended for most operations)

**Extended TTL**: 7 days (optional, for operations with longer retry windows)

### Cleanup Job

Run daily to delete expired keys:

```sql
DELETE FROM `idempotency_keys`
WHERE `expires_at` < NOW();
```

**Recommended cron schedule**: Daily at 3 AM

```typescript
// Example cleanup function
export async function cleanupExpiredKeys(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  
  await db
    .delete(idempotencyKeys)
    .where(lt(idempotencyKeys.expiresAt, new Date()));
  
  return 0; // MySQL doesn't return rowsAffected reliably
}
```

## Stale Takeover Policy

**Threshold**: 5 minutes (default)

If an operation is in `started` status for longer than the threshold, another caller can take over:

1. Check if `started_at < (now - staleTakeoverMinutes)`
2. If stale, attempt UPDATE with new `claim_nonce`
3. Only proceed if `affectedRows === 1` (ownership guard)

### Why Stale Takeover?

Prevents permanent "stuck" states caused by:
- Server crashes mid-operation
- Network disconnects
- Unhandled exceptions before commit

## Security

### Key Derivation (HMAC-SHA256)

Idempotency keys are computed using HMAC-SHA256 to prevent key guessing attacks:

```typescript
const keyHash = createHmac("sha256", IDEMPOTENCY_SECRET)
  .update(canonicalInputs)
  .digest("hex");
```

**In production, missing `IDEMPOTENCY_SECRET` must fail fast at startup.**

**CRITICAL**: Never include raw user text in the canonical string. Always hash it first:

```typescript
const userTextHash = createHash("sha256")
  .update(userText.trim().replace(/\s+/g, " "))
  .digest("hex");
```

### Response Sanitization

Only customer-safe fields are stored in `response_json`:

**Allowlist**:
- `ok` (boolean)
- `stopReason` (enum)
- `createdActionRequestIds` (number[])
- `traceId` (string)
- `needsHuman` (boolean)
- `cached` (boolean)
- `data` (JSON-serializable, customer-safe primitives only; no nested objects with semantic meaning)

**Blocklist** (never stored):
- `_internal`, `debug`, `prompt`
- `error.message`, `stack`
- `provider`, `model`, `requestId`
- Raw user text, system prompts

### Ownership Guard (Nonce-Based)

The `claim_nonce` field prevents lost updates during stale takeover:

1. **Claim**: Generate random nonce, INSERT with `claim_nonce`
2. **Takeover**: Generate new nonce, UPDATE with new `claim_nonce` (only if stale)
3. **Commit**: UPDATE with `WHERE claim_nonce = myClaimNonce` (only if we still own it)

**Why not timestamp-based?**

MySQL/TiDB round milliseconds, causing `started_at` equality checks to fail. Nonce-based guards are precision-proof.

## Usage Example

```typescript
import { withIdempotency, hashUserText, computeIdempotencyKey } from "./utils/idempotency";

// In your router/service
const result = await withIdempotency({
  tenant: "launchbase",
  scope: "actionRequests.aiProposeCopy",
  inputs: {
    intakeId: 123,
    actionRequestId: 456,
    userTextHash: hashUserText(userText),
    targetSection: "hero",
  },
  ttlHours: 24,
  staleTakeoverMinutes: 5,
  operation: async () => {
    // Expensive AI operation here
    return await runAiTennis(...);
  },
});

if (result.status === "succeeded") {
  return result.data; // From cache or fresh
} else if (result.status === "in_progress") {
  // No-throw contract: return safe response
  return {
    ok: false,
    stopReason: "in_progress",
    meta: getSystemMeta(),
  };
} else {
  // Handle failure case
  return {
    ok: false,
    stopReason: result.stopReason || "unknown",
    meta: getSystemMeta(),
  };
}
```

## Monitoring

### Key Metrics

- **Cache hit rate**: `succeeded` with `cached=true` / total requests
- **Stale takeover rate**: `attempt_count > 1` / total keys
- **Failure rate**: `failed` status / total keys
- **Average TTL**: `expires_at - created_at`

### Alerts

- **High stale takeover rate** (>5%): Indicates server instability or long-running operations
- **Low cache hit rate** (<30%): Indicates users not retrying or TTL too short
- **High failure rate** (>10%): Indicates AI provider issues or validation failures

## References

- Implementation: `server/utils/idempotency.ts`
- Tests: `server/utils/__tests__/idempotency.test.ts`
- Router integration: `server/routers/actionRequestsRouter.ts`
- Schema: `drizzle/schema.ts` (search for `idempotencyKeys`)
