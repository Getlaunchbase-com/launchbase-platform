ALTER TABLE `action_requests` ADD `proposedPreviewToken` varchar(64);--> statement-breakpoint
ALTER TABLE `action_requests` ADD `proposedPreviewExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `clarifications` ADD `proposedPreviewToken` varchar(64);--> statement-breakpoint
ALTER TABLE `clarifications` ADD `proposedPreviewExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `promo_codes` ADD `proposedPreviewToken` varchar(64);--> statement-breakpoint
ALTER TABLE `promo_codes` ADD `proposedPreviewExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `social_posts` ADD `proposedPreviewToken` varchar(64);--> statement-breakpoint
ALTER TABLE `social_posts` ADD `proposedPreviewExpiresAt` timestamp;--> statement-breakpoint
ALTER TABLE `action_requests` ADD CONSTRAINT `action_requests_proposedPreviewToken_unique` UNIQUE(`proposedPreviewToken`);--> statement-breakpoint
ALTER TABLE `clarifications` ADD CONSTRAINT `clarifications_proposedPreviewToken_unique` UNIQUE(`proposedPreviewToken`);--> statement-breakpoint
ALTER TABLE `promo_codes` ADD CONSTRAINT `promo_codes_proposedPreviewToken_unique` UNIQUE(`proposedPreviewToken`);--> statement-breakpoint
ALTER TABLE `social_posts` ADD CONSTRAINT `social_posts_proposedPreviewToken_unique` UNIQUE(`proposedPreviewToken`);