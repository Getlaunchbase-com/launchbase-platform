CREATE TABLE `intake_status_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`fromStatus` enum('new','review','needs_info','ready_for_review','approved','paid','deployed') NOT NULL,
	`toStatus` enum('new','review','needs_info','ready_for_review','approved','paid','deployed') NOT NULL,
	`actorType` enum('system','admin','customer') NOT NULL,
	`actorId` varchar(191),
	`reason` varchar(512) NOT NULL,
	`override` int NOT NULL DEFAULT 0,
	`meta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `intake_status_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `idx_intake_status_events_intake_created` ON `intake_status_events` (`intakeId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `idx_intake_status_events_toStatus_created` ON `intake_status_events` (`toStatus`,`createdAt`);