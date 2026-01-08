CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`buildPlanId` int NOT NULL,
	`buildPlanHash` varchar(64) NOT NULL,
	`userAgent` text,
	`ipAddress` varchar(45),
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerIntakeId` int NOT NULL,
	`referrerEmail` varchar(320) NOT NULL,
	`code` varchar(16) NOT NULL,
	`refereeIntakeId` int,
	`refereeEmail` varchar(320),
	`referrerDiscountCents` int DEFAULT 5000,
	`refereeDiscountCents` int DEFAULT 5000,
	`referrerRewardApplied` boolean DEFAULT false,
	`refereeRewardApplied` boolean DEFAULT false,
	`status` enum('pending','used','expired') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`usedAt` timestamp,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_code_unique` UNIQUE(`code`)
);
