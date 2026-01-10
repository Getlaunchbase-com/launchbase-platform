CREATE TABLE `action_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`intakeId` int NOT NULL,
	`checklistKey` varchar(128) NOT NULL,
	`proposedValue` json,
	`status` enum('pending','sent','responded','applied','confirmed','locked','expired','needs_human') NOT NULL DEFAULT 'pending',
	`token` varchar(64) NOT NULL,
	`messageType` varchar(64),
	`replyChannel` enum('link','email'),
	`confidence` float,
	`rawInbound` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`respondedAt` timestamp,
	`appliedAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `action_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `action_requests_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE INDEX `tenant_intake_key_idx` ON `action_requests` (`tenant`,`intakeId`,`checklistKey`);--> statement-breakpoint
CREATE INDEX `status_created_idx` ON `action_requests` (`status`,`createdAt`);