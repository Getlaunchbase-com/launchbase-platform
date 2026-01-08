-- Add Stripe webhook events logging table
-- Tracks all webhook deliveries for observability and idempotency

CREATE TABLE IF NOT EXISTS `stripe_webhook_events` (
  `id` INT NOT NULL AUTO_INCREMENT,
  
  -- Stripe event identity
  `eventId` VARCHAR(255) NOT NULL,
  `eventType` VARCHAR(64) NOT NULL,
  `created` INT NOT NULL COMMENT 'Stripe event.created (unix seconds)',

  -- Receipt + processing
  `receivedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `ok` TINYINT(1) NULL COMMENT 'Nullable until finalized',
  `error` TEXT NULL,

  -- Related entities (nullable)
  `intakeId` INT NULL,
  `userId` INT NULL,

  -- Retry / idempotency
  `idempotencyHit` TINYINT(1) NOT NULL DEFAULT 0,
  `retryCount` INT NOT NULL DEFAULT 0,

  -- Flexible metadata
  `meta` JSON NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_stripe_webhook_events_eventId` (`eventId`),
  KEY `idx_stripe_webhook_events_eventType_receivedAt` (`eventType`, `receivedAt`),
  KEY `idx_stripe_webhook_events_intakeId` (`intakeId`),
  KEY `idx_stripe_webhook_events_userId` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
