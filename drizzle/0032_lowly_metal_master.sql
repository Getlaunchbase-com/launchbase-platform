CREATE TABLE `email_provider_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`providerEventId` varchar(191) NOT NULL,
	`providerMessageId` varchar(191),
	`emailLogId` int,
	`eventType` varchar(32) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`payloadJson` json NOT NULL,
	CONSTRAINT `email_provider_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `uq_provider_event` UNIQUE(`provider`,`providerEventId`)
);
--> statement-breakpoint
ALTER TABLE `email_logs` ADD `idempotencyHitCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `email_logs` ADD `idempotencyHitAt` timestamp;--> statement-breakpoint
ALTER TABLE `email_logs` ADD `providerMessageId` varchar(191);--> statement-breakpoint
ALTER TABLE `email_logs` ADD `source` varchar(32);--> statement-breakpoint
ALTER TABLE `email_logs` ADD `templateVersion` varchar(64);--> statement-breakpoint
ALTER TABLE `email_logs` ADD `variant` varchar(32);--> statement-breakpoint
ALTER TABLE `email_logs` ADD `durationMs` int;--> statement-breakpoint
ALTER TABLE `email_logs` ADD `errorCode` varchar(64);--> statement-breakpoint
CREATE INDEX `idx_provider_message` ON `email_provider_events` (`provider`,`providerMessageId`);--> statement-breakpoint
CREATE INDEX `idx_email_log_id` ON `email_provider_events` (`emailLogId`);--> statement-breakpoint
CREATE INDEX `idx_occurred_at_type` ON `email_provider_events` (`occurredAt`,`eventType`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_sent_at_type` ON `email_logs` (`sentAt`,`emailType`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_sent_at_provider` ON `email_logs` (`sentAt`,`deliveryProvider`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_tenant_sent_at` ON `email_logs` (`tenant`,`sentAt`);--> statement-breakpoint
CREATE INDEX `idx_email_logs_sent_at_error_code` ON `email_logs` (`sentAt`,`errorCode`);