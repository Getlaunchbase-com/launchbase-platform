CREATE TABLE `module_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`moduleType` enum('google_ads','quickbooks') NOT NULL,
	`setupFeeCents` int NOT NULL,
	`monthlyFeeCents` int DEFAULT 0,
	`status` enum('pending','paid','setup_in_progress','active','cancelled') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(255),
	`setupNotes` text,
	`setupCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `module_orders_id` PRIMARY KEY(`id`)
);
