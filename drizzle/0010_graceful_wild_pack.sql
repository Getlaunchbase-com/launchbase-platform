CREATE TABLE `alert_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`tenant` enum('launchbase','vinces') NOT NULL,
	`alertKey` varchar(64) NOT NULL,
	`fingerprint` varchar(128) NOT NULL,
	`severity` enum('info','warn','crit') NOT NULL,
	`title` varchar(160) NOT NULL,
	`message` text NOT NULL,
	`status` enum('active','resolved') NOT NULL DEFAULT 'active',
	`firstSeenAt` timestamp NOT NULL DEFAULT (now()),
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`resolvedAt` timestamp,
	`deliveryProvider` varchar(32),
	`deliveryMessageId` varchar(128),
	`lastError` text,
	`meta` json,
	CONSTRAINT `alert_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventName` varchar(64) NOT NULL,
	`sessionId` varchar(64),
	`intakeId` int,
	`vertical` varchar(32),
	`stepNumber` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_feedback` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`socialPostId` int NOT NULL,
	`action` enum('approved','edited','rejected') NOT NULL,
	`feedbackType` enum('too_promotional','wrong_tone','not_relevant','too_salesy','timing_wrong','content_inaccurate','other'),
	`freeformNote` text,
	`originalContent` text,
	`editedContent` text,
	`relatedLayers` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_feedback_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`buildPlanId` int NOT NULL,
	`buildPlanHash` varchar(64) NOT NULL,
	`userAgent` text,
	`ipAddress` varchar(45),
	`approvedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `build_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`templateId` varchar(64) NOT NULL,
	`plan` json,
	`status` enum('draft','needs_info','ready','approved','deployed') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `build_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clarifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`token` varchar(64) NOT NULL,
	`questionKey` varchar(64) NOT NULL,
	`questionText` text NOT NULL,
	`inputType` enum('text','select','multitag') NOT NULL DEFAULT 'text',
	`options` json,
	`answer` text,
	`answeredAt` timestamp,
	`status` enum('pending','answered','expired') NOT NULL DEFAULT 'pending',
	`used` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `clarifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `clarifications_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `decision_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`decision` enum('post','silence','wait') NOT NULL,
	`severity` enum('hard_block','soft_block','discretionary'),
	`reason` varchar(128) NOT NULL,
	`triggerContext` enum('weather_storm','weather_clear','weather_extreme','sports_event','community_event','local_trend','seasonal','manual','scheduled') NOT NULL,
	`conditions` json,
	`layersEvaluated` json,
	`confidenceScore` int DEFAULT 0,
	`intelligenceVersion` varchar(16) NOT NULL DEFAULT 'v2.4.0',
	`socialPostId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `decision_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buildPlanId` int NOT NULL,
	`intakeId` int NOT NULL,
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`status` enum('queued','running','success','failed') NOT NULL DEFAULT 'queued',
	`trigger` enum('auto','manual','rollback') NOT NULL DEFAULT 'auto',
	`rolledBackFromDeploymentId` int,
	`urlMode` varchar(50) DEFAULT 'TEMP_MANUS',
	`templateVersion` varchar(32) NOT NULL DEFAULT 'v1',
	`buildPlanSnapshot` json,
	`siteId` varchar(64),
	`previewUrl` varchar(512),
	`productionUrl` varchar(512),
	`logs` json,
	`errorMessage` text,
	`urlModeEnforcementLog` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`emailType` enum('intake_confirmation','in_progress','ready_for_review','review_nudge','launch_confirmation','deployment_started','site_live','preview_followup','testimonial_request','founding_client_lockin','day7_checkin','day30_value','contact_form_confirmation','ops_alert') NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`status` enum('sent','failed','opened','clicked') NOT NULL DEFAULT 'sent',
	`deliveryProvider` enum('resend','notification'),
	`errorMessage` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	`openedAt` timestamp,
	`clickedAt` timestamp,
	CONSTRAINT `email_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `facebook_oauth_sessions` (
	`id` varchar(36) NOT NULL,
	`customerId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('pending','pages_ready','connected','failed','expired') NOT NULL DEFAULT 'pending',
	`userAccessToken` text,
	`scopesGranted` json,
	`pages` json,
	`error` text,
	`returnTo` varchar(512),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `facebook_oauth_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `industry_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`industry` varchar(64) NOT NULL,
	`profileVersion` varchar(16) NOT NULL,
	`contextWeights` json NOT NULL,
	`safetyGates` json NOT NULL,
	`toneGuardrails` json,
	`allowedPostTypes` json NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`migrationStrategy` enum('auto','opt_in','frozen') NOT NULL DEFAULT 'auto',
	`description` text,
	`status` enum('draft','active','deprecated') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `industry_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intakes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`businessName` varchar(255) NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`language` enum('en','es','pl') NOT NULL DEFAULT 'en',
	`audience` enum('biz','org') NOT NULL DEFAULT 'biz',
	`tenant` enum('launchbase','vinces') NOT NULL DEFAULT 'launchbase',
	`websiteStatus` enum('none','existing','systems_only') NOT NULL DEFAULT 'none',
	`phone` varchar(32),
	`vertical` enum('trades','appointments','professional') NOT NULL,
	`services` json,
	`serviceArea` json,
	`primaryCTA` varchar(64),
	`bookingLink` varchar(512),
	`tagline` text,
	`brandColors` json,
	`rawPayload` json,
	`status` enum('new','review','needs_info','ready_for_review','approved','paid','deployed') NOT NULL DEFAULT 'new',
	`previewToken` varchar(64),
	`previewUrl` varchar(512),
	`internalNotes` text,
	`stripeSessionId` varchar(255),
	`stripeCustomerId` varchar(255),
	`stripePaymentIntentId` varchar(255),
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intakes_id` PRIMARY KEY(`id`),
	CONSTRAINT `intakes_stripeSessionId_unique` UNIQUE(`stripeSessionId`)
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int NOT NULL,
	`integration` enum('google_business','meta','quickbooks') NOT NULL,
	`connectionStatus` enum('not_connected','connected','error') NOT NULL DEFAULT 'not_connected',
	`externalAccountId` varchar(255),
	`externalAccountName` varchar(255),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`lastSyncAt` timestamp,
	`lastSyncStatus` enum('success','partial','failed'),
	`lastSyncError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_setup_packets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` int,
	`intakeId` int,
	`suiteApplicationId` int,
	`sourceType` enum('suite_application','intake') NOT NULL,
	`integration` enum('google_business','meta','quickbooks') NOT NULL,
	`status` enum('ready','in_progress','connected','blocked') NOT NULL DEFAULT 'ready',
	`packetVersion` varchar(16) NOT NULL DEFAULT 'v1.0.0',
	`packetJson` json NOT NULL,
	`generatedFrom` json,
	`lastOpenedAt` timestamp,
	`connectedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_setup_packets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `intelligence_layers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`intakeId` int,
	`cadence` enum('low','medium','high') NOT NULL DEFAULT 'medium',
	`tuningMode` enum('auto','guided','custom') NOT NULL DEFAULT 'auto',
	`weatherEnabled` boolean NOT NULL DEFAULT true,
	`sportsEnabled` boolean NOT NULL DEFAULT false,
	`communityEnabled` boolean NOT NULL DEFAULT false,
	`trendsEnabled` boolean NOT NULL DEFAULT false,
	`approvalRequired` boolean NOT NULL DEFAULT true,
	`monthlyPriceCents` int NOT NULL DEFAULT 12900,
	`serviceAreaZips` json,
	`stripeSubscriptionId` varchar(255),
	`stripeCustomerId` varchar(255),
	`moduleStatus` enum('pending_activation','active','past_due','canceled','pending_cancellation') NOT NULL DEFAULT 'pending_activation',
	`isFounder` boolean NOT NULL DEFAULT false,
	`currentPeriodEnd` timestamp,
	`lastInvoiceStatus` varchar(32),
	`status` enum('active','paused','cancelled') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `intelligence_layers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `internal_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`userId` int NOT NULL,
	`note` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `internal_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `module_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleKey` enum('social_media_intelligence','quickbooks_sync','google_business') NOT NULL,
	`connectionType` enum('facebook_page','quickbooks_oauth','google_business_profile') NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` timestamp,
	`externalId` varchar(255),
	`externalName` varchar(255),
	`status` enum('active','expired','revoked','error') NOT NULL DEFAULT 'active',
	`lastSyncAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `module_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `module_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`moduleType` enum('google_ads','quickbooks') NOT NULL,
	`setupFeeCents` int NOT NULL,
	`monthlyFeeCents` int DEFAULT 0,
	`status` enum('pending','paid','setup_in_progress','active','cancelled') NOT NULL DEFAULT 'pending',
	`stripePaymentIntentId` varchar(255),
	`setupNotes` text,
	`setupCompletedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `module_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `module_setup_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`moduleKey` enum('social_media_intelligence','quickbooks_sync','google_business') NOT NULL,
	`stepKey` varchar(64) NOT NULL,
	`stepOrder` int NOT NULL,
	`stepTitle` varchar(255) NOT NULL,
	`stepDescription` text,
	`isCompleted` boolean NOT NULL DEFAULT false,
	`completedAt` timestamp,
	`stepData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `module_setup_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`intakeId` int NOT NULL,
	`stripePaymentIntentId` varchar(255) NOT NULL,
	`stripeCustomerId` varchar(255),
	`paymentType` enum('setup','monthly') NOT NULL DEFAULT 'setup',
	`amountCents` int NOT NULL,
	`status` enum('pending','succeeded','failed','refunded') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
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
CREATE TABLE `referral_events` (
	`id` int AUTO_INCREMENT NOT NULL,
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
	`isDuplicate` boolean NOT NULL DEFAULT false,
	`isBot` boolean NOT NULL DEFAULT false,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `referral_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `referrals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referrerIntakeId` int NOT NULL,
	`referrerEmail` varchar(320) NOT NULL,
	`code` varchar(16) NOT NULL,
	`refereeIntakeId` int,
	`refereeEmail` varchar(320),
	`referrerDiscountCents` int DEFAULT 5000,
	`refereeDiscountCents` int DEFAULT 5000,
	`referrerRewardApplied` boolean DEFAULT false,
	`refereeRewardApplied` boolean DEFAULT false,
	`status` enum('pending','used','expired') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`usedAt` timestamp,
	CONSTRAINT `referrals_id` PRIMARY KEY(`id`),
	CONSTRAINT `referrals_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `social_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`content` text NOT NULL,
	`headline` varchar(255),
	`postType` enum('ALL_CLEAR','MONITORING','ACTIVE_STORM','WEATHER_UPDATE','GAME_DAY','COMMUNITY_EVENT','LOCAL_TREND','SEASONAL','MANUAL') NOT NULL DEFAULT 'MANUAL',
	`triggerContext` enum('weather_storm','weather_clear','weather_extreme','sports_event','community_event','local_trend','seasonal','manual') NOT NULL,
	`reasonChips` json,
	`whyWeWroteThis` text,
	`suggestedAlts` json,
	`confidenceScore` int DEFAULT 0,
	`decisionReason` text,
	`weatherData` json,
	`status` enum('needs_review','approved','rejected','published','failed','expired') NOT NULL DEFAULT 'needs_review',
	`autoApproveType` boolean DEFAULT false,
	`imageUrl` varchar(512),
	`publishedTo` json,
	`facebookPostId` varchar(255),
	`scheduledFor` timestamp,
	`expiresAt` timestamp,
	`approvedAt` timestamp,
	`approvedBy` int,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `social_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `stripe_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(255) NOT NULL,
	`eventType` varchar(64) NOT NULL,
	`created` int NOT NULL,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`ok` boolean,
	`error` text,
	`intakeId` int,
	`userId` int,
	`idempotencyHit` boolean NOT NULL DEFAULT false,
	`retryCount` int NOT NULL DEFAULT 0,
	`meta` json,
	CONSTRAINT `stripe_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `stripe_webhook_events_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `suite_applications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`contactName` varchar(255) NOT NULL,
	`contactEmail` varchar(320) NOT NULL,
	`contactPhone` varchar(64) NOT NULL,
	`language` enum('en','es','pl') NOT NULL DEFAULT 'en',
	`vertical` enum('trades','health','beauty','food','cannabis','professional','fitness','automotive') NOT NULL,
	`industry` varchar(64),
	`businessType` enum('TRADES','FOOD','RETAIL','PRO','OTHER'),
	`cityZip` varchar(128) NOT NULL,
	`radiusMiles` int NOT NULL,
	`cadence` enum('LOW','MEDIUM','HIGH') NOT NULL,
	`mode` enum('AUTO','GUIDED','CUSTOM') NOT NULL,
	`layers` json NOT NULL,
	`pricing` json NOT NULL,
	`startTiming` enum('NOW','TWO_WEEKS','EXPLORING') NOT NULL,
	`status` enum('submitted','ready_for_review','preview_ready','approved','paid','active','rejected') NOT NULL DEFAULT 'submitted',
	`previewToken` varchar(64),
	`admin_notes` text,
	`reviewed_by` varchar(255),
	`intake_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suite_applications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `worker_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runKey` varchar(36) NOT NULL,
	`job` varchar(32) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	`ok` boolean,
	`processed` int NOT NULL DEFAULT 0,
	`deploymentId` int,
	`error` text,
	`meta` json,
	CONSTRAINT `worker_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `worker_runs_runKey_unique` UNIQUE(`runKey`)
);
