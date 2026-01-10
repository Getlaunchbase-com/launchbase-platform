ALTER TABLE `action_requests` ADD `sendCount` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `action_requests` ADD `lastSentAt` timestamp;