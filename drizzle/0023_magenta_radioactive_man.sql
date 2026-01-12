CREATE TABLE `idempotency_keys` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant` varchar(64) NOT NULL,
	`scope` varchar(255) NOT NULL,
	`key` varchar(255) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'started',
	`response_json` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `idempotency_keys_id` PRIMARY KEY(`id`),
	CONSTRAINT `idempotency_keys_tenant_scope_key_unique` UNIQUE(`tenant`,`scope`,`key`)
);
--> statement-breakpoint
CREATE INDEX `idempotency_keys_lookup_idx` ON `idempotency_keys` (`tenant`,`scope`,`key`);--> statement-breakpoint
CREATE INDEX `idempotency_keys_expires_idx` ON `idempotency_keys` (`expires_at`);