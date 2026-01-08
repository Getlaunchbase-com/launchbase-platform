-- Add worker_runs table for observability
CREATE TABLE IF NOT EXISTS `worker_runs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `result` enum('processed', 'skipped', 'error') NOT NULL,
  `processedCount` int NOT NULL DEFAULT 0,
  `errorMessage` text,
  `details` json,
  `durationMs` int,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for querying recent runs
CREATE INDEX `idx_worker_runs_created` ON `worker_runs` (`createdAt` DESC);
