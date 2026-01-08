CREATE TABLE `promo_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`setupFeeAmount` int NOT NULL,
	`monthlyDiscountPercent` int,
	`monthlyDiscountMonths` int,
	`maxRedemptions` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promo_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_codes_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `promo_redemptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promoCodeId` int NOT NULL,
	`intakeId` int NOT NULL,
	`status` enum('reserved','redeemed','expired') NOT NULL,
	`founderNumber` int,
	`stripeCustomerId` varchar(255),
	`stripeCheckoutSessionId` varchar(255),
	`reservedAt` timestamp NOT NULL DEFAULT (now()),
	`redeemedAt` timestamp,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `promo_redemptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `unique_founder` UNIQUE(`promoCodeId`,`founderNumber`)
);
