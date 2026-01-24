-- Agent execution system tables (Manus-like agent orchestrator)
-- Phase 1: Agent Runs Domain Model

CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` int NOT NULL,
	`status` enum('running','success','failed','awaiting_approval') NOT NULL DEFAULT 'running',
	`goal` text NOT NULL,
	`model` varchar(128),
	`routerUrl` varchar(512),
	`workspaceName` varchar(128),
	`finishedAt` timestamp,
	`errorMessage` text,
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `agent_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` int NOT NULL,
	`ts` timestamp NOT NULL DEFAULT (now()),
	`type` enum('message','tool_call','tool_result','approval_request','approval_result','error','artifact') NOT NULL,
	`payload` json NOT NULL,
	CONSTRAINT `agent_events_id` PRIMARY KEY(`id`)
);

CREATE INDEX `agent_runs_createdBy_idx` ON `agent_runs` (`createdBy`);
CREATE INDEX `agent_runs_status_idx` ON `agent_runs` (`status`);
CREATE INDEX `agent_runs_createdAt_idx` ON `agent_runs` (`createdAt`);
CREATE INDEX `agent_events_runId_idx` ON `agent_events` (`runId`);
CREATE INDEX `agent_events_ts_idx` ON `agent_events` (`ts`);
CREATE INDEX `agent_events_type_idx` ON `agent_events` (`type`);
