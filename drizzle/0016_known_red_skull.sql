CREATE TABLE `action_request_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actionRequestId` int NOT NULL,
	`intakeId` int NOT NULL,
	`eventType` enum('SENT','CUSTOMER_APPROVED','CUSTOMER_EDITED','CUSTOMER_UNCLEAR','APPLIED','LOCKED','EXPIRED','RESENT','ADMIN_APPLY','ADMIN_UNLOCK','ADMIN_EXPIRE','ESCALATED') NOT NULL,
	`actorType` enum('system','customer','admin') NOT NULL,
	`actorId` varchar(64),
	`reason` text,
	`meta` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `action_request_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `action_request_created_idx` ON `action_request_events` (`actionRequestId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `intake_created_idx` ON `action_request_events` (`intakeId`,`createdAt`);