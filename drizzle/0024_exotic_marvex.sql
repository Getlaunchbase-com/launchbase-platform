ALTER TABLE `idempotency_keys` DROP INDEX `idempotency_keys_tenant_scope_key_unique`;--> statement-breakpoint
DROP INDEX `idempotency_keys_lookup_idx` ON `idempotency_keys`;--> statement-breakpoint
ALTER TABLE `idempotency_keys` MODIFY COLUMN `expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD `key_hash` varchar(64) NOT NULL;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD `started_at` timestamp;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD `completed_at` timestamp;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD `attempt_count` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `idempotency_keys` ADD CONSTRAINT `idempotency_keys_tenant_scope_keyhash_unique` UNIQUE(`tenant`,`scope`,`key_hash`);--> statement-breakpoint
CREATE INDEX `idempotency_keys_stale_idx` ON `idempotency_keys` (`status`,`started_at`);--> statement-breakpoint
CREATE INDEX `idempotency_keys_lookup_idx` ON `idempotency_keys` (`tenant`,`scope`,`key_hash`);--> statement-breakpoint
ALTER TABLE `idempotency_keys` DROP COLUMN `key`;