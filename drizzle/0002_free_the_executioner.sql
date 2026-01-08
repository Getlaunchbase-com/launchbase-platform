CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventName` varchar(64) NOT NULL,
	`sessionId` varchar(64),
	`intakeId` int,
	`vertical` varchar(32),
	`stepNumber` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`emailType` enum('intake_confirmation','in_progress','ready_for_review','review_nudge','launch_confirmation','preview_followup','testimonial_request','founding_client_lockin','day7_checkin','day30_value') NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`status` enum('sent','failed','opened','clicked') NOT NULL DEFAULT 'sent',
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`openedAt` timestamp,
	`clickedAt` timestamp,
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`userId` int NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_notes_id` PRIMARY KEY(`id`)
);
