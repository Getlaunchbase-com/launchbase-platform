-- Facebook OAuth Sessions Table
-- Ephemeral sessions for OAuth flow (15 min expiry)
-- Used to bridge: callback → page selection → connect

CREATE TABLE IF NOT EXISTS `facebook_oauth_sessions` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,  -- UUID connectSessionId
  `customerId` INT NOT NULL,
  `userId` INT NOT NULL,
  `status` ENUM('pending', 'pages_ready', 'connected', 'failed', 'expired') NOT NULL DEFAULT 'pending',
  `userAccessToken` TEXT,  -- Short-lived, encrypted in production, deleted after connect
  `scopesGranted` JSON,    -- Array of granted scopes
  `pages` JSON,            -- Array of {pageId, pageName, accessToken}
  `error` TEXT,            -- Error message if failed
  `returnTo` VARCHAR(512), -- Return URL after connect
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `expiresAt` TIMESTAMP NOT NULL,
  
  -- Indexes for cleanup and lookup
  INDEX `idx_user_expires` (`userId`, `expiresAt`),
  INDEX `idx_expires` (`expiresAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cleanup job helper: DELETE FROM facebook_oauth_sessions WHERE expiresAt < NOW();
