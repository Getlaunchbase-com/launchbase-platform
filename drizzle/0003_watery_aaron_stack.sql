CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`stripePaymentIntentId` varchar(255) NOT NULL,
	`stripeCustomerId` varchar(255),
	`paymentType` enum('setup','monthly') NOT NULL DEFAULT 'setup',
	`amountCents` int NOT NULL,
	`status` enum('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `intakes` MODIFY COLUMN `status` enum('new','review','needs_info','ready','approved','paid','deployed') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `intakes` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `intakes` ADD `stripePaymentIntentId` varchar(255);--> statement-breakpoint
ALTER TABLE `intakes` ADD `paidAt` timestamp;