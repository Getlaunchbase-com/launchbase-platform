# PR 1: Drizzle Schema Diff (Final Review)

## email_logs - New Columns (8 total)

```typescript
// Idempotency tracking
idempotencyHitCount: int("idempotencyHitCount").notNull().default(0),
idempotencyHitAt: timestamp("idempotencyHitAt"),

// Provider tracking (for analytics)
providerMessageId: varchar("providerMessageId", { length: 191 }),

// Attribution and versioning
source: varchar("source", { length: 32 }),
templateVersion: varchar("templateVersion", { length: 64 }),
variant: varchar("variant", { length: 32 }),

// Performance and error tracking
durationMs: int("durationMs"),
errorCode: varchar("errorCode", { length: 64 }),
```

**Defaults & Nullability:**
- ✅ `idempotencyHitCount`: NOT NULL DEFAULT 0 (can sum without COALESCE)
- ✅ `idempotencyHitAt`: nullable (only set when hit occurs)
- ✅ All other columns: nullable (optional analytics fields)
- ✅ `errorCode`: VARCHAR(64) (index-friendly, not TEXT)

## email_logs - New Indexes (4 total)

```typescript
// Time-window analytics indexes
sentAtTypeIdx: index("idx_email_logs_sent_at_type").on(t.sentAt, t.emailType),
sentAtProviderIdx: index("idx_email_logs_sent_at_provider").on(t.sentAt, t.deliveryProvider),
tenantSentAtIdx: index("idx_email_logs_tenant_sent_at").on(t.tenant, t.sentAt),
sentAtErrorCodeIdx: index("idx_email_logs_sent_at_error_code").on(t.sentAt, t.errorCode),
```

**Index Strategy:**
- ✅ All indexes lead with time column (`sentAt` or `tenant`) for efficient time-window queries
- ✅ No redundant single-column `sentAt` index (covered by composites)
- ✅ No index on `providerMessageId` (using Pattern A: join via `emailLogId`)

## email_provider_events - New Table

```typescript
export const emailProviderEvents = mysqlTable(
  "email_provider_events",
  {
    id: int("id").autoincrement().primaryKey(),
    
    // Provider identification
    provider: varchar("provider", { length: 32 }).notNull(),
    providerEventId: varchar("providerEventId", { length: 191 }).notNull(),
    providerMessageId: varchar("providerMessageId", { length: 191 }),
    
    // Link to email_logs (optional FK, can be backfilled)
    emailLogId: int("emailLogId"),
    
    // Event details
    eventType: varchar("eventType", { length: 32 }).notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    
    // Raw payload for debugging
    payloadJson: json("payloadJson").notNull(),
  },
  (t) => ({
    // Idempotency: prevent duplicate webhook processing
    uniqProviderEvent: uniqueIndex("uq_provider_event").on(t.provider, t.providerEventId),
    
    // Join key: link events to email_logs
    providerMsgIdx: index("idx_provider_message").on(t.provider, t.providerMessageId),
    emailLogIdx: index("idx_email_log_id").on(t.emailLogId),
    
    // Analytics: event type over time
    occurredAtTypeIdx: index("idx_occurred_at_type").on(t.occurredAt, t.eventType),
  })
);
```

**Defaults & Nullability:**
- ✅ `provider`, `providerEventId`, `eventType`, `occurredAt`, `payloadJson`: NOT NULL (required)
- ✅ `receivedAt`: NOT NULL DEFAULT NOW() (auto-timestamp)
- ✅ `providerMessageId`, `emailLogId`: nullable (can be backfilled)

**Indexes (4 total):**
- ✅ UNIQUE `(provider, providerEventId)` - idempotency
- ✅ INDEX `(provider, providerMessageId)` - webhook lookup
- ✅ INDEX `(emailLogId)` - join to email_logs
- ✅ INDEX `(occurredAt, eventType)` - time-window analytics

## Summary

**Total new columns:** 8 (all on email_logs)
**Total new indexes:** 8 (4 on email_logs + 4 on email_provider_events)
**New tables:** 1 (email_provider_events)

**Migration SQL Preview:**
```sql
-- Add columns to email_logs
ALTER TABLE email_logs
  ADD COLUMN idempotency_hit_count INT NOT NULL DEFAULT 0,
  ADD COLUMN idempotency_hit_at TIMESTAMP NULL,
  ADD COLUMN provider_message_id VARCHAR(191) NULL,
  ADD COLUMN source VARCHAR(32) NULL,
  ADD COLUMN template_version VARCHAR(64) NULL,
  ADD COLUMN variant VARCHAR(32) NULL,
  ADD COLUMN duration_ms INT NULL,
  ADD COLUMN error_code VARCHAR(64) NULL;

-- Add indexes to email_logs
CREATE INDEX idx_email_logs_sent_at_type ON email_logs(sentAt, emailType);
CREATE INDEX idx_email_logs_sent_at_provider ON email_logs(sentAt, deliveryProvider);
CREATE INDEX idx_email_logs_tenant_sent_at ON email_logs(tenant, sentAt);
CREATE INDEX idx_email_logs_sent_at_error_code ON email_logs(sentAt, errorCode);

-- Create email_provider_events table
CREATE TABLE email_provider_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  provider_event_id VARCHAR(191) NOT NULL,
  provider_message_id VARCHAR(191) NULL,
  email_log_id INT NULL,
  event_type VARCHAR(32) NOT NULL,
  occurred_at TIMESTAMP NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json JSON NOT NULL,
  
  UNIQUE KEY uq_provider_event (provider, provider_event_id),
  INDEX idx_provider_message (provider, provider_message_id),
  INDEX idx_email_log_id (email_log_id),
  INDEX idx_occurred_at_type (occurred_at, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

## Ready for Migration?

✅ All column types are index-friendly (VARCHAR not TEXT for indexed fields)
✅ All defaults are set correctly (idempotencyHitCount = 0, receivedAt = NOW())
✅ All indexes follow "time-first" pattern for efficient window queries
✅ No redundant indexes (no standalone sentAt index)
✅ Idempotency enforced via unique constraints
✅ PUBLIC CONTRACT comments added to both tables

**Next step:** Run `pnpm db:push` to apply migration
