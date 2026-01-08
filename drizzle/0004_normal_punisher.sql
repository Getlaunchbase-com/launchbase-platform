ALTER TABLE `intakes` MODIFY COLUMN `status` enum('new','review','needs_info','ready_for_review','approved','paid','deployed') NOT NULL DEFAULT 'new';--> statement-breakpoint
ALTER TABLE `intakes` ADD `previewToken` varchar(64);--> statement-breakpoint
ALTER TABLE `intakes` ADD `previewUrl` varchar(512);--> statement-breakpoint
ALTER TABLE `intakes` ADD `internalNotes` text;