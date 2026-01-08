-- Migration: Add referral_events table for badge click tracking and conversion funnel
CREATE TABLE IF NOT EXISTS `referral_events` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `eventType` varchar(32) NOT NULL,
  `siteSlug` varchar(128),
  `siteId` int,
  `referralId` varchar(64),
  `sessionId` varchar(64),
  `visitorHash` varchar(64),
  `userAgent` text,
  `referrer` varchar(512),
  `utmSource` varchar(128),
  `utmMedium` varchar(128),
  `utmCampaign` varchar(128),
  `utmContent` varchar(128),
  `isDuplicate` boolean DEFAULT false NOT NULL,
  `isBot` boolean DEFAULT false NOT NULL,
  `metadata` json,
  `createdAt` timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  INDEX `idx_referral_events_siteId` (`siteId`),
  INDEX `idx_referral_events_sessionId` (`sessionId`),
  INDEX `idx_referral_events_eventType` (`eventType`),
  INDEX `idx_referral_events_createdAt` (`createdAt`)
);
