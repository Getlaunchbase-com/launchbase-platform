CREATE TABLE `run_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`runId` varchar(64) NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`tier` enum('standard','growth','premium') NOT NULL,
	`status` enum('PENDING','RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
	`data` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `run_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `run_plans_runId_unique` UNIQUE(`runId`)
);
--> statement-breakpoint
CREATE TABLE `ship_packets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`runPlanId` int NOT NULL,
	`runId` varchar(64) NOT NULL,
	`tier` enum('standard','growth','premium') NOT NULL,
	`status` enum('DRAFT','RUNNING','READY_FOR_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'DRAFT',
	`data` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ship_packets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `run_plans_intake_idx` ON `run_plans` (`intakeId`);--> statement-breakpoint
CREATE INDEX `run_plans_runid_idx` ON `run_plans` (`runId`);--> statement-breakpoint
CREATE INDEX `ship_packets_intake_idx` ON `ship_packets` (`intakeId`);--> statement-breakpoint
CREATE INDEX `ship_packets_runid_idx` ON `ship_packets` (`runId`);--> statement-breakpoint
CREATE INDEX `ship_packets_status_idx` ON `ship_packets` (`status`);