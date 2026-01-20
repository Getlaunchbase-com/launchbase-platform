# PR 1: Email Analytics Schema - Draft for Review

## Current State

**Existing `email_logs` columns:**
- id (PK), intakeId, tenant, emailType, recipientEmail, subject, status, deliveryProvider, errorMessage, idempotencyKey, sentAt, openedAt, clickedAt

**Existing indexes:**
- PRIMARY KEY (id)
- UNIQUE KEY email_logs_idempotency_key_uq (idempotencyKey)

**⚠️ Problem:** No indexes on `sentAt`, `emailType`, or `deliveryProvider` - time-window queries will be slow!

---

## Proposed Changes

### A) `email_logs` - New Columns

```typescript
// Add to existing email_logs table
providerMessageId: varchar("provider_message_id", { length: 191 }),  // nullable, Resend message ID
source: varchar("source", { length: 32 }),                            // nullable, "stripe" | "admin" | "system"
templateVersion: varchar("template_version", { length: 64 }),         // nullable, version hash
variant: varchar("variant", { length: 32 }),                          // nullable, "A" | "B" for A/B tests

durationMs: int("duration_ms"),                                       // nullable, send duration
errorCode: varchar("error_code", { length: 64 }),                    // nullable, provider error code
// errorMessage already exists as text

idempotencyHitCount: int("idempotency_hit_count").notNull().default(0),  // NOT NULL, default 0
idempotencyHitAt: timestamp("idempotency_hit_at"),                       // nullable, first hit time
```

### B) `email_logs` - New Indexes

**Critical for time-window queries:**
```typescript
idx_email_logs_sent_at: index("idx_email_logs_sent_at").on(t.sentAt)
idx_email_logs_type_sent: index("idx_email_logs_type_sent").on(t.emailType, t.sentAt)
idx_email_logs_provider_sent: index("idx_email_logs_provider_sent").on(t.deliveryProvider, t.sentAt)
```

**For analytics queries:**
```typescript
idx_email_logs_provider_msg: index("idx_email_logs_provider_msg").on(t.providerMessageId)  // join with provider events
idx_email_logs_error_code: index("idx_email_logs_error_code").on(t.errorCode, t.sentAt)    // failure analysis
idx_email_logs_source: index("idx_email_logs_source").on(t.source, t.sentAt)               // attribution
```

**Total: 6 new indexes**

---

### C) `email_provider_events` - New Table

```typescript
export const emailProviderEvents = mysqlTable(
  "email_provider_events",
  {
    id: int("id").autoincrement().primaryKey(),
    
    // Provider identification
    provider: varchar("provider", { length: 32 }).notNull(),              // "resend"
    providerEventId: varchar("provider_event_id", { length: 191 }).notNull(),  // unique per provider
    providerMessageId: varchar("provider_message_id", { length: 191 }),   // nullable, links to email_logs
    
    // Optional FK (can backfill later)
    emailLogId: int("email_log_id"),                                      // nullable, FK to email_logs.id
    
    // Event details
    eventType: varchar("event_type", { length: 32 }).notNull(),           // delivered, bounced, complaint, opened, clicked
    occurredAt: timestamp("occurred_at").notNull(),                       // provider's event time
    receivedAt: timestamp("received_at").notNull().defaultNow(),          // our ingestion time
    
    // Raw payload for debugging
    payloadJson: json("payload_json").notNull(),
  },
  (t) => ({
    // Idempotency: prevent duplicate webhook processing
    uniqProviderEvent: uniqueIndex("uq_provider_event").on(t.provider, t.providerEventId),
    
    // Join key: link events to email_logs
    providerMsgIdx: index("idx_provider_message").on(t.provider, t.providerMessageId),
    
    // Analytics: event type over time
    typeOccurredIdx: index("idx_event_type_occurred").on(t.eventType, t.occurredAt),
    
    // Optional FK lookup
    emailLogIdx: index("idx_email_log_id").on(t.emailLogId),
  })
);
```

**Indexes: 4 (1 unique + 3 regular)**

---

## Migration SQL (MySQL)

```sql
-- Add new columns to email_logs
ALTER TABLE email_logs
  ADD COLUMN provider_message_id VARCHAR(191) NULL,
  ADD COLUMN source VARCHAR(32) NULL,
  ADD COLUMN template_version VARCHAR(64) NULL,
  ADD COLUMN variant VARCHAR(32) NULL,
  ADD COLUMN duration_ms INT NULL,
  ADD COLUMN error_code VARCHAR(64) NULL,
  ADD COLUMN idempotency_hit_count INT NOT NULL DEFAULT 0,
  ADD COLUMN idempotency_hit_at TIMESTAMP NULL;

-- Add indexes to email_logs (critical for performance!)
CREATE INDEX idx_email_logs_sent_at ON email_logs(sentAt);
CREATE INDEX idx_email_logs_type_sent ON email_logs(emailType, sentAt);
CREATE INDEX idx_email_logs_provider_sent ON email_logs(deliveryProvider, sentAt);
CREATE INDEX idx_email_logs_provider_msg ON email_logs(provider_message_id);
CREATE INDEX idx_email_logs_error_code ON email_logs(error_code, sentAt);
CREATE INDEX idx_email_logs_source ON email_logs(source, sentAt);

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
  INDEX idx_event_type_occurred (event_type, occurred_at),
  INDEX idx_email_log_id (email_log_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
```

---

## Questions for Review

1. **Index redundancy**: Are any of the 6 new indexes on `email_logs` redundant?
2. **Composite index order**: Is `(emailType, sentAt)` the right order, or should it be `(sentAt, emailType)`?
3. **varchar(191) vs varchar(255)**: I used 191 for indexed strings (utf8mb4 safe). Is this correct?
4. **errorMessage**: Already exists as `text` - should I change it to `varchar(255)` for consistency?
5. **deliveryProvider enum**: Should I keep it as enum or change to varchar for future providers?

---

## Expected Query Patterns

**Time-window filter (all metrics):**
```sql
WHERE sentAt >= (NOW() - INTERVAL ? DAY)
```

**Delivery success rate:**
```sql
WHERE sentAt >= ... GROUP BY emailType, deliveryProvider
```

**Fallback rate:**
```sql
WHERE status = 'sent' AND sentAt >= ... GROUP BY emailType
```

**Idempotency hit rate:**
```sql
WHERE sentAt >= ... GROUP BY emailType ORDER BY idempotency_hit_count DESC
```

**Top failure codes:**
```sql
WHERE status = 'failed' AND sentAt >= ... GROUP BY deliveryProvider, error_code
```

**Provider events (bounces/complaints):**
```sql
SELECT ... FROM email_provider_events WHERE occurredAt >= ... GROUP BY event_type
```

**Join: email_logs ↔ provider_events:**
```sql
JOIN email_provider_events epe ON epe.provider_message_id = el.provider_message_id
WHERE el.sentAt >= ... AND epe.occurredAt >= ...
```
