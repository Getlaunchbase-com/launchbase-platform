CREATE TABLE `build_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`templateId` varchar(64) NOT NULL,
	`plan` json,
	`status` enum('draft','needs_info','ready','approved','deployed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `build_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clarifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`questionKey` varchar(64) NOT NULL,
	`questionText` text NOT NULL,
	`inputType` enum('text','select','multitag') NOT NULL DEFAULT 'text',
	`options` json,
	`answer` text,
	`answeredAt` timestamp,
	`status` enum('pending','answered','expired') NOT NULL DEFAULT 'pending',
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `clarifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `clarifications_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buildPlanId` int NOT NULL,
	`intakeId` int NOT NULL,
	`status` enum('queued','running','success','failed') NOT NULL DEFAULT 'queued',
	`siteId` varchar(64),
	`previewUrl` varchar(512),
	`productionUrl` varchar(512),
	`logs` json,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intakes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(32),
	`vertical` enum('trades','appointments','professional') NOT NULL,
	`services` json,
	`serviceArea` json,
	`primaryCTA` varchar(64),
	`bookingLink` varchar(512),
	`tagline` text,
	`brandColors` json,
	`rawPayload` json,
	`status` enum('new','review','needs_info','ready','approved') NOT NULL DEFAULT 'new',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intakes_id` PRIMARY KEY(`id`)
);
