ALTER TABLE `intakes` ADD `tier` enum('standard','growth','premium');--> statement-breakpoint
ALTER TABLE `intakes` ADD `enginesSelected` json DEFAULT ('[]');