CREATE TABLE `design_candidates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`designJobId` int NOT NULL,
	`variantKey` varchar(128) NOT NULL,
	`designJson` json,
	`scoreTotal` int NOT NULL,
	`scoreBreakdown` json,
	`rank` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `design_candidates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`designJobId` int,
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`eventType` varchar(64) NOT NULL,
	`actorType` enum('system','admin','customer') NOT NULL DEFAULT 'system',
	`reason` text,
	`meta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `design_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `design_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`tier` enum('standard','enhanced','premium') NOT NULL DEFAULT 'standard',
	`status` enum('created','generated','scored','selected','rendered','failed') NOT NULL DEFAULT 'created',
	`engine` varchar(64) NOT NULL DEFAULT 'launchbase_rules_v1',
	`winnerCandidateId` int,
	`inputsHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `design_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `job_score_idx` ON `design_candidates` (`designJobId`,`scoreTotal`);--> statement-breakpoint
CREATE INDEX `job_rank_idx` ON `design_candidates` (`designJobId`,`rank`);--> statement-breakpoint
CREATE INDEX `intake_created_idx` ON `design_events` (`intakeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `job_created_idx` ON `design_events` (`designJobId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `event_type_idx` ON `design_events` (`eventType`,`createdAt`);--> statement-breakpoint
CREATE INDEX `intake_created_idx` ON `design_jobs` (`intakeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `status_created_idx` ON `design_jobs` (`status`,`createdAt`);--> statement-breakpoint
CREATE INDEX `tenant_created_idx` ON `design_jobs` (`tenant`,`createdAt`);