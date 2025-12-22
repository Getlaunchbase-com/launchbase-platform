ALTER TABLE `intelligence_layers` MODIFY COLUMN `intakeId` int;--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `cadence` enum('low','medium','high') DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `stripeSubscriptionId` varchar(255);--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `moduleStatus` enum('pending_activation','active','past_due','canceled','pending_cancellation') DEFAULT 'pending_activation' NOT NULL;--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `isFounder` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `currentPeriodEnd` timestamp;--> statement-breakpoint
ALTER TABLE `intelligence_layers` ADD `lastInvoiceStatus` varchar(32);--> statement-breakpoint
ALTER TABLE `intelligence_layers` DROP COLUMN `depthLevel`;