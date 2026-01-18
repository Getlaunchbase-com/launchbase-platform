ALTER TABLE `intakes` ADD `creditsIncluded` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `intakes` ADD `creditsRemaining` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `intakes` ADD `creditsConsumed` int DEFAULT 0 NOT NULL;