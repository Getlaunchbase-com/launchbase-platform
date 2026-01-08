CREATE TABLE `intelligence_layers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`depthLevel` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`tuningMode` enum('auto','guided','custom') NOT NULL DEFAULT 'auto',
	`weatherEnabled` boolean NOT NULL DEFAULT true,
	`sportsEnabled` boolean NOT NULL DEFAULT false,
	`communityEnabled` boolean NOT NULL DEFAULT false,
	`trendsEnabled` boolean NOT NULL DEFAULT false,
	`approvalRequired` boolean NOT NULL DEFAULT true,
	`monthlyPriceCents` int NOT NULL DEFAULT 12900,
	`serviceAreaZips` json,
	`status` enum('active','paused','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intelligence_layers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `post_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`periodMonth` int NOT NULL,
	`periodYear` int NOT NULL,
	`postsGenerated` int NOT NULL DEFAULT 0,
	`postsApproved` int NOT NULL DEFAULT 0,
	`postsPublished` int NOT NULL DEFAULT 0,
	`postsRejected` int NOT NULL DEFAULT 0,
	`weatherChecks` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `post_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`content` text NOT NULL,
	`headline` varchar(255),
	`triggerContext` enum('weather_storm','weather_clear','weather_extreme','sports_event','community_event','local_trend','seasonal','manual') NOT NULL,
	`confidenceScore` int DEFAULT 0,
	`decisionReason` text,
	`weatherData` json,
	`status` enum('pending','approved','rejected','published','failed') NOT NULL DEFAULT 'pending',
	`publishedTo` json,
	`facebookPostId` varchar(255),
	`scheduledFor` timestamp,
	`approvedAt` timestamp,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
