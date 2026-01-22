CREATE TABLE `repo_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`type` enum('local','git') NOT NULL DEFAULT 'local',
	`localPath` varchar(512),
	`repoUrl` varchar(512),
	`branch` varchar(128),
	`authType` enum('token','ssh'),
	`encryptedSecret` text,
	`lastSyncAt` timestamp,
	`lastHeadSha` varchar(64),
	CONSTRAINT `repo_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swarm_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdByUserId` int,
	`isPromoted` boolean NOT NULL DEFAULT false,
	`configJson` json NOT NULL,
	CONSTRAINT `swarm_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swarm_runs` (
	`repairId` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`status` enum('running','finished','failed') NOT NULL DEFAULT 'finished',
	`intention` enum('smoke_test','pressure_test','improve','critic'),
	`fixtureName` varchar(128),
	`stopReason` varchar(64) NOT NULL DEFAULT 'unknown',
	`applied` boolean NOT NULL DEFAULT false,
	`testsPassed` boolean NOT NULL DEFAULT false,
	`patchValid` boolean,
	`modelPrimary` varchar(128),
	`modelFallback` varchar(128),
	`costUsd` float,
	`latencyMs` int,
	`escalationTriggered` boolean,
	`didRetry` boolean,
	`profileId` int,
	`featurePackJson` json,
	`repoSourceId` int,
	`repoHeadSha` varchar(64),
	`pushedBranch` varchar(256),
	`pushedAt` timestamp,
	`pushedHeadSha` varchar(64),
	`artifactPrefix` varchar(256),
	`artifactKeys` json,
	`errorSummary` text,
	CONSTRAINT `swarm_runs_repairId` PRIMARY KEY(`repairId`)
);
--> statement-breakpoint
CREATE INDEX `repo_sources_name_idx` ON `repo_sources` (`name`);--> statement-breakpoint
CREATE INDEX `repo_sources_type_idx` ON `repo_sources` (`type`);--> statement-breakpoint
CREATE INDEX `swarm_profiles_name_idx` ON `swarm_profiles` (`name`);--> statement-breakpoint
CREATE INDEX `swarm_profiles_promoted_idx` ON `swarm_profiles` (`isPromoted`);--> statement-breakpoint
CREATE INDEX `swarm_runs_createdAt_idx` ON `swarm_runs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `swarm_runs_stopReason_idx` ON `swarm_runs` (`stopReason`);--> statement-breakpoint
CREATE INDEX `swarm_runs_modelPrimary_idx` ON `swarm_runs` (`modelPrimary`);--> statement-breakpoint
CREATE INDEX `swarm_runs_fixture_idx` ON `swarm_runs` (`fixtureName`);--> statement-breakpoint
CREATE INDEX `swarm_runs_profile_idx` ON `swarm_runs` (`profileId`);--> statement-breakpoint
CREATE INDEX `swarm_runs_repoSource_idx` ON `swarm_runs` (`repoSourceId`);