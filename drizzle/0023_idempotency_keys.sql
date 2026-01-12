-- Migration: Add idempotency_keys table for preventing duplicate AI Tennis calls
-- Purpose: Prevent double-spend on retries (double clicks, refreshes, network timeouts)
-- Pattern: Stripe-style idempotency with TTL

CREATE TABLE `idempotency_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant` varchar(64) NOT NULL,
	`scope` varchar(255) NOT NULL,
	`key_hash` char(64) NOT NULL COMMENT 'HMAC-SHA256 hex (prevents key guessing)',
	`status` varchar(32) NOT NULL DEFAULT 'started' COMMENT 'started | succeeded | failed',
	`response_json` json COMMENT 'Customer-safe cached response (no prompts/errors)',
	`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
	`started_at` timestamp NULL COMMENT 'When operation started (for stale takeover)',
	`completed_at` timestamp NULL COMMENT 'When operation completed/failed',
	`expires_at` timestamp NULL COMMENT 'TTL for cleanup (24h-7d)',
	`attempt_count` int NOT NULL DEFAULT 1 COMMENT 'Retry counter for stale takeover',
	CONSTRAINT `idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `idempotency_keys_tenant_scope_keyhash_unique` UNIQUE(`tenant`,`scope`,`key_hash`)
);

-- Index for TTL cleanup (find expired rows)
CREATE INDEX `idempotency_keys_expires_idx` ON `idempotency_keys` (`expires_at`);

-- Index for stale takeover (find stuck jobs)
CREATE INDEX `idempotency_keys_stale_idx` ON `idempotency_keys` (`status`,`started_at`);
