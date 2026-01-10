CREATE TABLE `confidence_learning` (
	`id` int AUTO_INCREMENT NOT NULL,
	`checklistKey` varchar(128) NOT NULL,
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`totalSent` int NOT NULL DEFAULT 0,
	`totalApproved` int NOT NULL DEFAULT 0,
	`totalRejected` int NOT NULL DEFAULT 0,
	`totalEdited` int NOT NULL DEFAULT 0,
	`totalUnclear` int NOT NULL DEFAULT 0,
	`approvalRate` float NOT NULL DEFAULT 0,
	`editRate` float NOT NULL DEFAULT 0,
	`recommendedThreshold` float NOT NULL DEFAULT 0.9,
	`lastUpdatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `confidence_learning_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `checklistKey_idx` ON `confidence_learning` (`checklistKey`);--> statement-breakpoint
CREATE INDEX `tenant_idx` ON `confidence_learning` (`tenant`);