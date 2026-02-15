import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean, uniqueIndex, index, float, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Customer intakes from onboarding flow
 */
export const intakes = mysqlTable("intakes", {
  id: int("id").autoincrement().primaryKey(),
  // Business info
  businessName: varchar("businessName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  // Localization + audience
  language: mysqlEnum("language", ["en", "es", "pl"]).default("en").notNull(),
  audience: mysqlEnum("audience", ["biz", "org"]).default("biz").notNull(),
  // Tenant (for multi-tenant filtering)
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
  // Website status (customer entry state)
  websiteStatus: mysqlEnum("websiteStatus", ["none", "existing", "systems_only"]).notNull().default("none"),
  phone: varchar("phone", { length: 32 }),
  // AI-inferred vertical
  vertical: mysqlEnum("vertical", ["trades", "appointments", "professional"]).notNull(),
  // Tier selection (Standard / Growth / Premium)
  tier: mysqlEnum("tier", ["standard", "growth", "premium"]),
  // Selected engines (optional add-ons)
  enginesSelected: json("enginesSelected").$type<string[]>(),
  // Business details
  services: json("services").$type<string[]>(),
  serviceArea: json("serviceArea").$type<string[]>(),
  primaryCTA: varchar("primaryCTA", { length: 64 }),
  bookingLink: varchar("bookingLink", { length: 512 }),
  // Branding
  tagline: text("tagline"),
  brandColors: json("brandColors").$type<{ primary?: string; secondary?: string }>(),
  // Raw payload from onboarding
  rawPayload: json("rawPayload").$type<Record<string, unknown>>(),
  // Status workflow
  status: mysqlEnum("status", ["new", "review", "needs_info", "ready_for_review", "approved", "paid", "deployed"]).default("new").notNull(),
  // Preview and feedback
  previewToken: varchar("previewToken", { length: 64 }),
  previewUrl: varchar("previewUrl", { length: 512 }),
  internalNotes: text("internalNotes"),
  // Payment tracking
  stripeSessionId: varchar("stripeSessionId", { length: 255 }).unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Intake = typeof intakes.$inferSelect;
export type InsertIntake = typeof intakes.$inferInsert;

/**
 * Build plans generated from intakes
 */
export const buildPlans = mysqlTable("build_plans", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // Template selection
  templateId: varchar("templateId", { length: 64 }).notNull(),
  // Generated plan JSON
  plan: json("plan").$type<{
    pages: Array<{ id: string; title: string; slug: string; sections: unknown[] }>;
    brand: { primaryColor: string; secondaryColor: string; fontFamily: string };
    copy: { heroHeadline: string; heroSubheadline: string; ctaText: string };
    features: string[];
  }>(),
  // Status
  status: mysqlEnum("status", ["draft", "needs_info", "ready", "approved", "deployed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BuildPlan = typeof buildPlans.$inferSelect;
export type InsertBuildPlan = typeof buildPlans.$inferInsert;

/**
 * Clarification requests for missing info
 */
export const clarifications = mysqlTable("clarifications", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // One-time token
  token: varchar("token", { length: 64 }).notNull().unique(),
  // Question details
  questionKey: varchar("questionKey", { length: 64 }).notNull(),
  questionText: text("questionText").notNull(),
  inputType: mysqlEnum("inputType", ["text", "select", "multitag"]).default("text").notNull(),
  options: json("options").$type<string[]>(),
  // Response
  answer: text("answer"),
  answeredAt: timestamp("answeredAt"),
  // Status
  status: mysqlEnum("status", ["pending", "answered", "expired"]).default("pending").notNull(),
  used: boolean("used").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  // Proposed preview token (for View Proposed Preview link)
  proposedPreviewToken: varchar("proposedPreviewToken", { length: 64 }).unique(),
  proposedPreviewExpiresAt: timestamp("proposedPreviewExpiresAt"),
});

export type Clarification = typeof clarifications.$inferSelect;
export type InsertClarification = typeof clarifications.$inferInsert;

/**
 * Action requests for automated Ask → Understand → Apply → Confirm loop
 * (Different from clarifications which are manual/admin-driven)
 */
export const actionRequests = mysqlTable("action_requests", {
  id: int("id").autoincrement().primaryKey(),
  // Tenant (for multi-tenant filtering)
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
  intakeId: int("intakeId").notNull(),
  // Checklist key (e.g. homepage.headline, cta.primary, gmb.category)
  checklistKey: varchar("checklistKey", { length: 128 }).notNull(),
  // Proposed value to apply
  proposedValue: json("proposedValue").$type<unknown>(),
  // State machine
  status: mysqlEnum("status", [
    "pending",      // created
    "sent",         // email sent
    "responded",    // customer replied
    "applied",      // change applied
    "confirmed",    // confirmation sent
    "locked",       // done forever
    "expired",      // too old
    "needs_human"   // unclear/conflicting
  ]).default("pending").notNull(),
  // One-time token for links
  token: varchar("token", { length: 64 }).notNull().unique(),
  // Message type (e.g. DAY0_HEADLINE)
  messageType: varchar("messageType", { length: 64 }),
  // Reply channel (link | email)
  replyChannel: mysqlEnum("replyChannel", ["link", "email"]),
  // Confidence score (0-1)
  confidence: float("confidence"),
  // Raw inbound payload
  rawInbound: json("rawInbound").$type<unknown>(),
  // Send tracking
  sendCount: int("sendCount").default(0).notNull(),
  lastSentAt: timestamp("lastSentAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  respondedAt: timestamp("respondedAt"),
  appliedAt: timestamp("appliedAt"),
  expiresAt: timestamp("expiresAt"),
  // Proposed preview token (for View Proposed Preview link)
  proposedPreviewToken: varchar("proposedPreviewToken", { length: 64 }).unique(),
  proposedPreviewExpiresAt: timestamp("proposedPreviewExpiresAt"),
}, (table) => ({
  // Indexes for efficient queries
  tenantIntakeKeyIdx: index("tenant_intake_key_idx").on(table.tenant, table.intakeId, table.checklistKey),
  statusCreatedIdx: index("status_created_idx").on(table.status, table.createdAt),
}));

export type ActionRequest = typeof actionRequests.$inferSelect;
export type InsertActionRequest = typeof actionRequests.$inferInsert;

/**
 * Action request events (audit log)
 * Append-only log of all state transitions and actions
 */
export const actionRequestEvents = mysqlTable("action_request_events", {
  id: int("id").autoincrement().primaryKey(),
  actionRequestId: int("actionRequestId").notNull(),
  intakeId: int("intakeId").notNull(),
  // Event type
  eventType: mysqlEnum("eventType", [
    "SENT",
    "CUSTOMER_APPROVED",
    "CUSTOMER_EDITED",
    "CUSTOMER_UNCLEAR",
    "APPLIED",
    "LOCKED",
    "EXPIRED",
    "RESENT",
    "ADMIN_APPLY",
    "ADMIN_UNLOCK",
    "ADMIN_EXPIRE",
    "ESCALATED",
    "SEND_FAILED",
    "PREVIEW_VIEWED",
    "PROPOSED_PREVIEW_RENDER_FAILED",
    "AI_PROPOSE_COPY",
  ]).notNull(),
  // Actor
  actorType: mysqlEnum("actorType", ["system", "customer", "admin"]).notNull(),
  actorId: varchar("actorId", { length: 64 }),
  // Reason (for admin actions)
  reason: text("reason"),
  // Metadata (JSON)
  meta: json("meta").$type<Record<string, unknown>>(),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Indexes for efficient queries
  actionRequestCreatedIdx: index("action_request_created_idx").on(table.actionRequestId, table.createdAt),
  intakeCreatedIdx: index("intake_created_idx").on(table.intakeId, table.createdAt),
}));

export type ActionRequestEvent = typeof actionRequestEvents.$inferSelect;
export type InsertActionRequestEvent = typeof actionRequestEvents.$inferInsert;

/**
 * Deployment jobs
 */
export const deployments = mysqlTable("deployments", {
  id: int("id").autoincrement().primaryKey(),
  buildPlanId: int("buildPlanId").notNull(),
  intakeId: int("intakeId").notNull(),
  // Tenant (for multi-tenant filtering)
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
  // Job status
  status: mysqlEnum("status", ["queued", "running", "success", "failed"]).default("queued").notNull(),
  // Rollback tracking
  trigger: mysqlEnum("trigger", ["auto", "manual", "rollback"]).notNull().default("auto"),
  rolledBackFromDeploymentId: int("rolledBackFromDeploymentId"),
  // URL mode: Phase 1 = TEMP_MANUS, Phase 2 = CUSTOM_DOMAIN
  urlMode: varchar("urlMode", { length: 50 }).default("TEMP_MANUS"),
  // Template version (for immutability)
  templateVersion: varchar("templateVersion", { length: 32 }).notNull().default("v1"),
  // Build plan snapshot (for rollback reproducibility)
  buildPlanSnapshot: json("buildPlanSnapshot").$type<{
    templateId: string;
    plan: {
      pages: Array<{ id: string; title: string; slug: string; sections: unknown[] }>;
      brand: { primaryColor: string; secondaryColor: string; fontFamily: string };
      copy: { heroHeadline: string; heroSubheadline: string; ctaText: string };
      features: string[];
    };
  }>(),
  // Output
  siteId: varchar("siteId", { length: 64 }),
  previewUrl: varchar("previewUrl", { length: 512 }),
  productionUrl: varchar("productionUrl", { length: 512 }),
  // Logs
  logs: json("logs").$type<string[]>(),
  errorMessage: text("errorMessage"),
  // URL enforcement: track if custom domain was attempted in TEMP_MANUS mode
  urlModeEnforcementLog: json("urlModeEnforcementLog").$type<Array<{ timestamp: number; attemptedUrl: string; reason: string }>>(),
  // Timestamps
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Deployment = typeof deployments.$inferSelect;
export type InsertDeployment = typeof deployments.$inferInsert;

/**
 * Analytics events for funnel tracking
 */
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  // Event identification
  eventName: varchar("eventName", { length: 64 }).notNull(),
  sessionId: varchar("sessionId", { length: 64 }),
  // Context
  intakeId: int("intakeId"),
  vertical: varchar("vertical", { length: 32 }),
  stepNumber: int("stepNumber"),
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type InsertAnalyticsEvent = typeof analyticsEvents.$inferInsert;

/**
 * PUBLIC CONTRACT: email_logs is the system-of-record for outbound email delivery attempts.
 *
 * Why this exists:
 * - Prevents duplicate emails under webhook retry storms / concurrent workers.
 * - Provides auditability: what we tried, what provider we used, what happened.
 *
 * Idempotency rules:
 * - `idempotencyKey` is OPTIONAL for general email sends, but REQUIRED for event-driven sends
 *   (e.g., Stripe webhooks) to guarantee exactly-once delivery behavior.
 * - The database enforces uniqueness on `idempotencyKey` (unique index).
 * - MySQL allows multiple NULLs, so "non-idempotent" sends (no key) are permitted.
 *
 * Canonical key format (recommendation):
 * - `${sourceEventId}:${emailType}`
 *   Example: `evt_123:intake_confirmation`
 *
 * Concurrency guarantee:
 * - If two processes attempt the same `idempotencyKey`, at most ONE row is inserted.
 * - Callers must treat duplicate-key insert errors as a successful no-op ("already sent").
 *
 * DO NOT weaken this contract:
 * - Do NOT remove the unique index on idempotencyKey.
 * - Do NOT "pre-check then insert" for idempotency (race-prone). Use insert-first.
 */
export const emailLogs = mysqlTable(
  "email_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    intakeId: int("intakeId").notNull(),
    // Tenant (for multi-tenant filtering)
    tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
    // Email details
    emailType: mysqlEnum("emailType", [
      "intake_confirmation",
      "in_progress",
      "ready_for_review",
      "review_nudge",
      "launch_confirmation",
      "deployment_started",
      "site_live",
      "preview_followup",
      "testimonial_request",
      "founding_client_lockin",
      "founder_welcome",
      "day7_checkin",
      "day30_value",
      "contact_form_confirmation",
      "ops_alert"
    ]).notNull(),
    recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
    subject: varchar("subject", { length: 255 }).notNull(),
    // Status
    status: mysqlEnum("status", ["sent", "failed", "opened", "clicked"]).default("sent").notNull(),
    // Delivery tracking (forever observability)
    deliveryProvider: mysqlEnum("deliveryProvider", ["resend", "notification"]),
    errorMessage: text("errorMessage"),
    // Idempotency (Stripe event-based deduplication)
    idempotencyKey: varchar("idempotencyKey", { length: 255 }),
    idempotencyHitCount: int("idempotencyHitCount").notNull().default(0),
    idempotencyHitAt: timestamp("idempotencyHitAt"),
    // Provider tracking (for analytics)
    providerMessageId: varchar("providerMessageId", { length: 191 }),
    // Attribution and versioning
    source: varchar("source", { length: 32 }),
    templateVersion: varchar("templateVersion", { length: 64 }),
    variant: varchar("variant", { length: 32 }),
    // Performance and error tracking
    durationMs: int("durationMs"),
    errorCode: varchar("errorCode", { length: 64 }),
    // Timestamps
    sentAt: timestamp("sentAt").defaultNow().notNull(),
    openedAt: timestamp("openedAt"),
    clickedAt: timestamp("clickedAt"),
  },
  (t) => ({
    // Idempotency
    idempotencyKeyUq: uniqueIndex("email_logs_idempotency_key_uq").on(t.idempotencyKey),
    // Time-window analytics indexes
    sentAtTypeIdx: index("idx_email_logs_sent_at_type").on(t.sentAt, t.emailType),
    sentAtProviderIdx: index("idx_email_logs_sent_at_provider").on(t.sentAt, t.deliveryProvider),
    tenantSentAtIdx: index("idx_email_logs_tenant_sent_at").on(t.tenant, t.sentAt),
    sentAtErrorCodeIdx: index("idx_email_logs_sent_at_error_code").on(t.sentAt, t.errorCode),
  })
);

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

/**
 * PUBLIC CONTRACT: email_provider_events stores webhook callbacks from email providers.
 *
 * Why this exists:
 * - Durable audit trail of provider-reported events (delivered, bounced, complained, opened, clicked).
 * - Enables bounce/complaint rate analytics and deliverability monitoring.
 * - Idempotent webhook ingestion via unique (provider, providerEventId).
 *
 * Linking strategy:
 * - Primary join: via `emailLogId` (stable FK to email_logs.id).
 * - Secondary lookup: via `providerMessageId` (provider's message identifier).
 * - Webhooks often provide `providerMessageId` first; we backfill `emailLogId` during ingestion.
 *
 * Idempotency rules:
 * - `(provider, providerEventId)` must be unique to prevent duplicate event processing.
 * - Webhook handlers MUST check for duplicate events before processing.
 *
 * DO NOT weaken this contract:
 * - Do NOT remove the unique index on (provider, providerEventId).
 * - Do NOT process webhooks without signature verification.
 */
export const emailProviderEvents = mysqlTable(
  "email_provider_events",
  {
    id: int("id").autoincrement().primaryKey(),
    // Provider identification
    provider: varchar("provider", { length: 32 }).notNull(),
    providerEventId: varchar("providerEventId", { length: 191 }).notNull(),
    providerMessageId: varchar("providerMessageId", { length: 191 }),
    // Link to email_logs (optional FK, can be backfilled)
    emailLogId: int("emailLogId"),
    // Event details
    eventType: varchar("eventType", { length: 32 }).notNull(),
    occurredAt: timestamp("occurredAt").notNull(),
    receivedAt: timestamp("receivedAt").defaultNow().notNull(),
    // Raw payload for debugging
    payloadJson: json("payloadJson").notNull(),
  },
  (t) => ({
    // Idempotency: prevent duplicate webhook processing
    uniqProviderEvent: uniqueIndex("uq_provider_event").on(t.provider, t.providerEventId),
    // Join key: link events to email_logs
    providerMsgIdx: index("idx_provider_message").on(t.provider, t.providerMessageId),
    emailLogIdx: index("idx_email_log_id").on(t.emailLogId),
    // Analytics: event type over time
    occurredAtTypeIdx: index("idx_occurred_at_type").on(t.occurredAt, t.eventType),
  })
);

export type EmailProviderEvent = typeof emailProviderEvents.$inferSelect;
export type InsertEmailProviderEvent = typeof emailProviderEvents.$inferInsert;

/**
 * Internal notes for admin operators
 */
export const internalNotes = mysqlTable("internal_notes", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  userId: int("userId").notNull(),
  note: text("note").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InternalNote = typeof internalNotes.$inferSelect;
export type InsertInternalNote = typeof internalNotes.$inferInsert;

/**
 * Payments for tracking Stripe transactions
 */
export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // Stripe IDs
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }).notNull(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  // Payment type
  paymentType: mysqlEnum("paymentType", ["setup", "monthly"]).default("setup").notNull(),
  // Amount in cents
  amountCents: int("amountCents").notNull(),
  // Status
  status: mysqlEnum("status", ["pending", "succeeded", "failed", "refunded"]).default("pending").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  paidAt: timestamp("paidAt"),
});

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = typeof payments.$inferInsert;

/**
 * Business module orders (Google Ads, QuickBooks, etc.)
 */
export const moduleOrders = mysqlTable("module_orders", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // Module type
  moduleType: mysqlEnum("moduleType", ["google_ads", "quickbooks"]).notNull(),
  // Pricing
  setupFeeCents: int("setupFeeCents").notNull(),
  monthlyFeeCents: int("monthlyFeeCents").default(0),
  // Status
  status: mysqlEnum("status", ["pending", "paid", "setup_in_progress", "active", "cancelled"]).default("pending").notNull(),
  // Stripe
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  // Setup details
  setupNotes: text("setupNotes"),
  setupCompletedAt: timestamp("setupCompletedAt"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModuleOrder = typeof moduleOrders.$inferSelect;
export type InsertModuleOrder = typeof moduleOrders.$inferInsert;

/**
 * Approval logs for legal protection
 * Tracks when customers approve build plans with version hash
 */
export const approvals = mysqlTable("approvals", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  buildPlanId: int("buildPlanId").notNull(),
  // Build plan version hash for verification
  buildPlanHash: varchar("buildPlanHash", { length: 64 }).notNull(),
  // Legal details
  userAgent: text("userAgent"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  // Timestamps
  approvedAt: timestamp("approvedAt").defaultNow().notNull(),
});

export type Approval = typeof approvals.$inferSelect;
export type InsertApproval = typeof approvals.$inferInsert;

/**
 * Referrals for tracking referral program
 */
export const referrals = mysqlTable("referrals", {
  id: int("id").autoincrement().primaryKey(),
  // Referrer info
  referrerIntakeId: int("referrerIntakeId").notNull(),
  referrerEmail: varchar("referrerEmail", { length: 320 }).notNull(),
  // Referral code
  code: varchar("code", { length: 16 }).notNull().unique(),
  // Referee tracking
  refereeIntakeId: int("refereeIntakeId"),
  refereeEmail: varchar("refereeEmail", { length: 320 }),
  // Rewards
  referrerDiscountCents: int("referrerDiscountCents").default(5000), // $50
  refereeDiscountCents: int("refereeDiscountCents").default(5000), // $50
  referrerRewardApplied: boolean("referrerRewardApplied").default(false),
  refereeRewardApplied: boolean("refereeRewardApplied").default(false),
  // Status
  status: mysqlEnum("status", ["pending", "used", "expired"]).default("pending").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  usedAt: timestamp("usedAt"),
});

export type Referral = typeof referrals.$inferSelect;
export type InsertReferral = typeof referrals.$inferInsert;


/**
 * Intelligence layers configuration for Social Media Intelligence module
 * Controls visibility depth and context layers per customer
 */
export const intelligenceLayers = mysqlTable("intelligence_layers", {
  id: int("id").autoincrement().primaryKey(),
  // Link to user (for logged-in customers) or intake (for legacy)
  userId: int("userId"),
  intakeId: int("intakeId"),
  // Cadence controls posting frequency (renamed from depthLevel)
  cadence: mysqlEnum("cadence", ["low", "medium", "high"]).default("medium").notNull(),
  // Message tuning mode
  tuningMode: mysqlEnum("tuningMode", ["auto", "guided", "custom"]).default("auto").notNull(),
  // Context layers (weather is always on)
  weatherEnabled: boolean("weatherEnabled").default(true).notNull(),
  sportsEnabled: boolean("sportsEnabled").default(false).notNull(),
  communityEnabled: boolean("communityEnabled").default(false).notNull(),
  trendsEnabled: boolean("trendsEnabled").default(false).notNull(),
  // Approval mode
  approvalRequired: boolean("approvalRequired").default(true).notNull(),
  // Pricing (in cents) - calculated from cadence + layers
  monthlyPriceCents: int("monthlyPriceCents").default(12900).notNull(),
  // Service area for weather monitoring
  serviceAreaZips: json("serviceAreaZips").$type<string[]>(),
  // Stripe integration
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  // Module status (tracks subscription state)
  moduleStatus: mysqlEnum("moduleStatus", ["pending_activation", "active", "past_due", "canceled", "pending_cancellation"]).default("pending_activation").notNull(),
  // Founder pricing flag
  isFounder: boolean("isFounder").default(false).notNull(),
  // Billing period tracking
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  lastInvoiceStatus: varchar("lastInvoiceStatus", { length: 32 }),
  // Legacy status (for backward compatibility)
  status: mysqlEnum("status", ["active", "paused", "cancelled"]).default("active").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntelligenceLayer = typeof intelligenceLayers.$inferSelect;
export type InsertIntelligenceLayer = typeof intelligenceLayers.$inferInsert;

/**
 * Social posts generated by the intelligence system
 * Tracks pending, approved, and published posts
 */
export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Post content
  content: text("content").notNull(),
  headline: varchar("headline", { length: 255 }),
  // Post type for categorization
  postType: mysqlEnum("postType", [
    "ALL_CLEAR",
    "MONITORING",
    "ACTIVE_STORM",
    "WEATHER_UPDATE",
    "GAME_DAY",
    "COMMUNITY_EVENT",
    "LOCAL_TREND",
    "SEASONAL",
    "MANUAL"
  ]).default("MANUAL").notNull(),
  // Context that triggered this post
  triggerContext: mysqlEnum("triggerContext", [
    "weather_storm",
    "weather_clear",
    "weather_extreme",
    "sports_event",
    "community_event",
    "local_trend",
    "seasonal",
    "manual"
  ]).notNull(),
  // Reason chips (which layers contributed)
  reasonChips: json("reasonChips").$type<string[]>(), // ['weather', 'sports', 'community', 'trends']
  // Why we wrote this (AI explanation)
  whyWeWroteThis: text("whyWeWroteThis"),
  // Suggested alternative versions
  suggestedAlts: json("suggestedAlts").$type<string[]>(),
  // Confidence score (0-100)
  confidenceScore: int("confidenceScore").default(0),
  // Decision reasoning (internal)
  decisionReason: text("decisionReason"),
  // Weather data snapshot (if weather-triggered)
  weatherData: json("weatherData").$type<{
    condition?: string;
    temperature?: number;
    alerts?: string[];
    forecast?: string;
  }>(),
  // Status workflow
  status: mysqlEnum("status", ["needs_review", "approved", "rejected", "published", "failed", "expired"]).default("needs_review").notNull(),
  // Auto-approve settings
  autoApproveType: boolean("autoApproveType").default(false),
  // Image attachment (optional)
  imageUrl: varchar("imageUrl", { length: 512 }),
  // Publishing details
  publishedTo: json("publishedTo").$type<string[]>(), // ['facebook', 'website']
  facebookPostId: varchar("facebookPostId", { length: 255 }),
  // Timestamps
  scheduledFor: timestamp("scheduledFor"),
  expiresAt: timestamp("expiresAt"), // For Guided mode expiry
  // Proposed preview token (for View Proposed Preview link)
  proposedPreviewToken: varchar("proposedPreviewToken", { length: 64 }).unique(),
  proposedPreviewExpiresAt: timestamp("proposedPreviewExpiresAt"),
  approvedAt: timestamp("approvedAt"),
  approvedBy: int("approvedBy"), // User ID who approved
  publishedAt: timestamp("publishedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

/**
 * Decision log for Intelligence Core - tracks all decisions including silence
 * Provides audit trail, explainability, and learning signal
 */
export const decisionLogs = mysqlTable("decision_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Decision type
  decision: mysqlEnum("decision", ["post", "silence", "wait"]).notNull(),
  // Silence severity classification
  severity: mysqlEnum("severity", ["hard_block", "soft_block", "discretionary"]),
  // Reason for decision
  reason: varchar("reason", { length: 128 }).notNull(),
  // Context that triggered evaluation
  triggerContext: mysqlEnum("triggerContext", [
    "weather_storm",
    "weather_clear",
    "weather_extreme",
    "sports_event",
    "community_event",
    "local_trend",
    "seasonal",
    "manual",
    "scheduled"
  ]).notNull(),
  // Raw conditions that led to decision
  conditions: json("conditions").$type<Record<string, unknown>>(),
  // Which layers evaluated this
  layersEvaluated: json("layersEvaluated").$type<string[]>(),
  // Confidence score (0-100)
  confidenceScore: int("confidenceScore").default(0),
  // Intelligence version used
  intelligenceVersion: varchar("intelligenceVersion", { length: 16 }).default("v2.4.0").notNull(),
  // Link to generated post (if decision was "post")
  socialPostId: int("socialPostId"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DecisionLog = typeof decisionLogs.$inferSelect;
export type InsertDecisionLog = typeof decisionLogs.$inferInsert;

/**
 * Post usage tracking for billing and analytics
 */
export const postUsage = mysqlTable("post_usage", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  // Period tracking
  periodMonth: int("periodMonth").notNull(), // 1-12
  periodYear: int("periodYear").notNull(),
  // Usage counts
  postsGenerated: int("postsGenerated").default(0).notNull(),
  postsApproved: int("postsApproved").default(0).notNull(),
  postsPublished: int("postsPublished").default(0).notNull(),
  postsRejected: int("postsRejected").default(0).notNull(),
  // Weather checks
  weatherChecks: int("weatherChecks").default(0).notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PostUsage = typeof postUsage.$inferSelect;
export type InsertPostUsage = typeof postUsage.$inferInsert;

/**
 * Approval feedback loop - captures customer feedback on generated posts
 * Enables continuous improvement and learning
 */
export const approvalFeedback = mysqlTable("approval_feedback", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  socialPostId: int("socialPostId").notNull(),
  // Action taken
  action: mysqlEnum("action", ["approved", "edited", "rejected"]).notNull(),
  // Feedback type (normalized enum)
  feedbackType: mysqlEnum("feedbackType", [
    "too_promotional",
    "wrong_tone",
    "not_relevant",
    "too_salesy",
    "timing_wrong",
    "content_inaccurate",
    "other"
  ]),
  // Freeform feedback
  freeformNote: text("freeformNote"),
  // If edited, capture the changes
  originalContent: text("originalContent"),
  editedContent: text("editedContent"),
  // Which layer(s) the feedback relates to
  relatedLayers: json("relatedLayers").$type<string[]>(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ApprovalFeedback = typeof approvalFeedback.$inferSelect;
export type InsertApprovalFeedback = typeof approvalFeedback.$inferInsert;

/**
 * Industry profiles - versioned intelligence configuration per industry
 * Enables safe rollouts, A/B testing, and continuous improvement
 */
export const industryProfiles = mysqlTable("industry_profiles", {
  id: int("id").autoincrement().primaryKey(),
  // Industry identifier
  industry: varchar("industry", { length: 64 }).notNull(),
  // Profile version
  profileVersion: varchar("profileVersion", { length: 16 }).notNull(),
  // Context weights for decision making
  contextWeights: json("contextWeights").$type<{
    weather: number;
    sports: number;
    community: number;
    trends: number;
  }>().notNull(),
  // Safety gates that apply
  safetyGates: json("safetyGates").$type<string[]>().notNull(),
  // Tone guardrails
  toneGuardrails: json("toneGuardrails").$type<{
    conservative?: boolean;
    professional?: boolean;
    energetic?: boolean;
  }>(),
  // Allowed post types for this industry
  allowedPostTypes: json("allowedPostTypes").$type<string[]>().notNull(),
  // When this profile becomes effective
  effectiveFrom: timestamp("effectiveFrom").notNull(),
  // Migration strategy for existing customers
  migrationStrategy: mysqlEnum("migrationStrategy", ["auto", "opt_in", "frozen"]).default("auto").notNull(),
  // Description for internal use
  description: text("description"),
  // Status
  status: mysqlEnum("status", ["draft", "active", "deprecated"]).default("draft").notNull(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IndustryProfile = typeof industryProfiles.$inferSelect;
export type InsertIndustryProfile = typeof industryProfiles.$inferInsert;


/**
 * Module setup steps - tracks customer progress through each module's setup
 * Each module has specific steps that need to be completed
 */
export const moduleSetupSteps = mysqlTable("module_setup_steps", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Which module this belongs to
  moduleKey: mysqlEnum("moduleKey", [
    "social_media_intelligence",
    "quickbooks_sync",
    "google_business"
  ]).notNull(),
  // Step identification
  stepKey: varchar("stepKey", { length: 64 }).notNull(), // e.g., "connect_facebook", "set_preferences"
  stepOrder: int("stepOrder").notNull(), // 1, 2, 3...
  // Step details
  stepTitle: varchar("stepTitle", { length: 255 }).notNull(),
  stepDescription: text("stepDescription"),
  // Completion status
  isCompleted: boolean("isCompleted").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  // Data collected at this step (JSON)
  stepData: json("stepData").$type<Record<string, unknown>>(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModuleSetupStep = typeof moduleSetupSteps.$inferSelect;
export type InsertModuleSetupStep = typeof moduleSetupSteps.$inferInsert;

/**
 * Module connections - stores OAuth tokens and connection details per module
 */
export const moduleConnections = mysqlTable("module_connections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  // Which module
  moduleKey: mysqlEnum("moduleKey", [
    "social_media_intelligence",
    "quickbooks_sync",
    "google_business"
  ]).notNull(),
  // Connection type
  connectionType: mysqlEnum("connectionType", [
    "facebook_page",
    "quickbooks_oauth",
    "google_business_profile"
  ]).notNull(),
  // Connection details (encrypted in production)
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  // External IDs
  externalId: varchar("externalId", { length: 255 }), // Page ID, QB Company ID, etc.
  externalName: varchar("externalName", { length: 255 }), // Page name, Company name
  // Connection status
  status: mysqlEnum("status", ["active", "expired", "revoked", "error"]).default("active").notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  lastError: text("lastError"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ModuleConnection = typeof moduleConnections.$inferSelect;
export type InsertModuleConnection = typeof moduleConnections.$inferInsert;


/**
 * Suite applications - new customer applications from /apply flow
 * Captures all configuration choices before payment
 */
export const suiteApplications = mysqlTable("suite_applications", {
  id: int("id").autoincrement().primaryKey(),
  // Contact info
  contactName: varchar("contactName", { length: 255 }).notNull(),
  contactEmail: varchar("contactEmail", { length: 320 }).notNull(),
  contactPhone: varchar("contactPhone", { length: 64 }).notNull(),
  // Language preference (intake language - website is always English)
  language: mysqlEnum("language", ["en", "es", "pl"]).default("en").notNull(),
  // Business info - expanded verticals
  vertical: mysqlEnum("vertical", [
    "trades", "health", "beauty", "food", "cannabis", "professional", "fitness", "automotive"
  ]).notNull(),
  industry: varchar("industry", { length: 64 }), // specific industry within vertical
  // Legacy field - keeping for backward compatibility
  businessType: mysqlEnum("businessType", ["TRADES", "FOOD", "RETAIL", "PRO", "OTHER"]),
  cityZip: varchar("cityZip", { length: 128 }).notNull(),
  radiusMiles: int("radiusMiles").notNull(),
  // Module configuration
  cadence: mysqlEnum("cadence", ["LOW", "MEDIUM", "HIGH"]).notNull(),
  mode: mysqlEnum("mode", ["AUTO", "GUIDED", "CUSTOM"]).notNull(),
  layers: json("layers").$type<{
    weather: true;
    sports: boolean;
    community: boolean;
    trends: boolean;
  }>().notNull(),
  // Pricing snapshot (what they agreed to at submit time)
  pricing: json("pricing").$type<{
    cadenceMonthly: number;
    layersMonthly: number;
    monthlyTotal: number;
    setupFee: number;
    enabledLayers: Array<"sports" | "community" | "trends">;
  }>().notNull(),
  // Start timing
  startTiming: mysqlEnum("startTiming", ["NOW", "TWO_WEEKS", "EXPLORING"]).notNull(),
  // Lifecycle status
  status: mysqlEnum("status", [
    "submitted",
    "ready_for_review",
    "preview_ready",
    "approved",
    "paid",
    "active",
    "rejected"
  ]).default("submitted").notNull(),
  // Preview token for customer link
  previewToken: varchar("previewToken", { length: 64 }),
  // Admin fields
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by", { length: 255 }),
  // Link to created intake (after approval)
  intakeId: int("intake_id"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SuiteApplication = typeof suiteApplications.$inferSelect;
export type InsertSuiteApplication = typeof suiteApplications.$inferInsert;


/**
 * Referral events from badge clicks and conversion funnel
 * Tracks: badge_click → landing_view → apply_start → apply_submit
 * Also tracks share events: share_opened, share_copy_link, share_qr_shown, share_social_clicked
 */
export const referralEvents = mysqlTable("referral_events", {
  id: int("id").autoincrement().primaryKey(),
  // Event type in the funnel
  eventType: varchar("eventType", { length: 32 }).notNull(),
  // Site identification
  siteSlug: varchar("siteSlug", { length: 128 }),
  siteId: int("siteId"),
  // Referral tracking
  referralId: varchar("referralId", { length: 64 }),
  // Session tracking
  sessionId: varchar("sessionId", { length: 64 }),
  // Visitor tracking (privacy-safe hash)
  visitorHash: varchar("visitorHash", { length: 64 }),
  // User agent and referrer
  userAgent: text("userAgent"),
  referrer: varchar("referrer", { length: 512 }),
  // UTM parameters
  utmSource: varchar("utmSource", { length: 128 }),
  utmMedium: varchar("utmMedium", { length: 128 }),
  utmCampaign: varchar("utmCampaign", { length: 128 }),
  utmContent: varchar("utmContent", { length: 128 }),
  // Dedupe and bot flags
  isDuplicate: boolean("isDuplicate").default(false).notNull(),
  isBot: boolean("isBot").default(false).notNull(),
  // Metadata
  metadata: json("metadata").$type<Record<string, unknown>>(),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReferralEvent = typeof referralEvents.$inferSelect;
export type InsertReferralEvent = typeof referralEvents.$inferInsert;


/**
 * Worker Runs - Durable execution telemetry for cron handlers
 * Tracks every cron job execution for observability and debugging
 * Logging is best-effort and never blocks worker execution
 */
export const workerRuns = mysqlTable("worker_runs", {
  id: int("id").autoincrement().primaryKey(),
  runKey: varchar("runKey", { length: 36 }).notNull().unique(), // UUID for safe updates

  job: varchar("job", { length: 32 }).notNull(), // "run-next-deploy" | "auto-advance"
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  finishedAt: timestamp("finishedAt"),

  ok: boolean("ok"),
  processed: int("processed").notNull().default(0),

  deploymentId: int("deploymentId"),
  error: text("error"),

  meta: json("meta").$type<Record<string, unknown>>(),
});
export type WorkerRun = typeof workerRuns.$inferSelect;
export type InsertWorkerRun = typeof workerRuns.$inferInsert;


/**
 * LaunchBase Rule:
 * We prepare first.
 * We automate second.
 * We always show our work.
 */

/**
 * Integration Setup Packets - Pre-generated setup data for external integrations
 * Each packet contains everything needed to set up an integration (Google, Meta, QuickBooks)
 * Packets are deterministic and versioned for reproducibility
 */
export const integrationSetupPackets = mysqlTable("integration_setup_packets", {
  id: int("id").autoincrement().primaryKey(),
  // Customer/account identification
  customerId: int("customerId"), // Links to user if logged in
  intakeId: int("intakeId"), // Links to intake
  suiteApplicationId: int("suiteApplicationId"), // Links to suite_application if created before intake
  // Source tracking
  sourceType: mysqlEnum("sourceType", ["suite_application", "intake"]).notNull(),
  // Integration type
  integration: mysqlEnum("integration", ["google_business", "meta", "quickbooks"]).notNull(),
  // Status workflow
  status: mysqlEnum("status", ["ready", "in_progress", "connected", "blocked"]).default("ready").notNull(),
  // Version tracking for reproducibility
  packetVersion: varchar("packetVersion", { length: 16 }).default("v1.0.0").notNull(),
  // The actual packet data (JSON)
  packetJson: json("packetJson").$type<{
    integration: string;
    business: {
      name: string;
      phone: string;
      website: string;
      address: string;
      serviceArea: string;
      hours: Record<string, string>;
    };
    positioning: {
      tone: "professional" | "friendly" | "direct";
      primaryCta: string;
      oneLiner: string;
    };
    services: Array<{
      name: string;
      description: string;
      priceHint: string;
    }>;
    assetsNeeded: Array<{
      item: string;
      priority: "high" | "medium" | "low";
      note: string;
    }>;
    setupSteps: Array<{
      step: number;
      title: string;
      instructions: string;
      deepLink?: string;
    }>;
    // Integration-specific fields
    googleBusiness?: {
      primaryCategory: string;
      secondaryCategories: string[];
      shortDescription: string;
      longDescription: string;
      servicesFormatted: string[];
      suggestedPhotos: string[];
      reviewRequestTemplate: string;
    };
    meta?: {
      pageBio: string;
      aboutText: string;
      ctaButton: { text: string; url: string };
      starterPosts: Array<{ content: string; type: string }>;
      hashtags: string[];
      coverPhotoGuidance: string;
    };
    quickbooks?: {
      customerTypeTags: string[];
      serviceItems: Array<{ name: string; slug: string; rate: number }>;
      invoiceDefaults: { terms: string; depositRules: string; lateFeePolicy: string };
      estimateTemplateNotes: string;
      paymentMethodsRecommended: string[];
    };
  }>().notNull(),
  // Snapshot of inputs used to generate this packet (for debugging/regeneration)
  generatedFrom: json("generatedFrom").$type<{
    businessName: string;
    services: string[];
    location: string;
    tone: string;
    vertical: string;
    generatedAt: string;
  }>(),
  // Tracking timestamps
  lastOpenedAt: timestamp("lastOpenedAt"),
  connectedAt: timestamp("connectedAt"),
  // Internal notes
  notes: text("notes"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationSetupPacket = typeof integrationSetupPackets.$inferSelect;
export type InsertIntegrationSetupPacket = typeof integrationSetupPackets.$inferInsert;

/**
 * Integration Connections - Tracks OAuth connections to external services
 * Separate from packets because connection state is independent of packet readiness
 */
export const integrationConnections = mysqlTable("integration_connections", {
  id: int("id").autoincrement().primaryKey(),
  customerId: int("customerId").notNull(),
  // Integration type
  integration: mysqlEnum("integration", ["google_business", "meta", "quickbooks"]).notNull(),
  // Connection status
  connectionStatus: mysqlEnum("connectionStatus", ["not_connected", "connected", "error"]).default("not_connected").notNull(),
  // External account identifiers
  externalAccountId: varchar("externalAccountId", { length: 255 }), // Page ID, QBO realmId, etc.
  externalAccountName: varchar("externalAccountName", { length: 255 }), // Display name
  // OAuth tokens (encrypted in production)
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  // Sync tracking
  lastSyncAt: timestamp("lastSyncAt"),
  lastSyncStatus: mysqlEnum("lastSyncStatus", ["success", "partial", "failed"]),
  lastSyncError: text("lastSyncError"),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type IntegrationConnection = typeof integrationConnections.$inferSelect;
export type InsertIntegrationConnection = typeof integrationConnections.$inferInsert;


/**
 * Facebook OAuth Sessions - Ephemeral sessions for OAuth flow
 * Auto-expire after 15 minutes. Used to bridge callback → page selection → connect
 */
export const facebookOAuthSessions = mysqlTable("facebook_oauth_sessions", {
  id: varchar("id", { length: 36 }).primaryKey(), // UUID connectSessionId
  customerId: int("customerId").notNull(),
  userId: int("userId").notNull(),
  // Status workflow
  status: mysqlEnum("status", ["pending", "pages_ready", "connected", "failed", "expired"]).default("pending").notNull(),
  // User access token (short-lived, encrypted in production)
  userAccessToken: text("userAccessToken"),
  // Scopes granted by user
  scopesGranted: json("scopesGranted").$type<string[]>(),
  // Pages available for connection (cached from FB API)
  pages: json("pages").$type<Array<{ pageId: string; pageName: string; accessToken: string }>>(),
  // Error message if failed
  error: text("error"),
  // Return URL after connect
  returnTo: varchar("returnTo", { length: 512 }),
  // Timestamps
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(), // 15 min from creation
});

export type FacebookOAuthSession = typeof facebookOAuthSessions.$inferSelect;
export type InsertFacebookOAuthSession = typeof facebookOAuthSessions.$inferInsert;

/**
 * Alert events for real-time ops monitoring
 * Fingerprint-based dedupe: one row per unique (tenant, alertKey, fingerprint)
 */
export const alertEvents = mysqlTable("alert_events", {
  id: int("id").autoincrement().primaryKey(),

  // tenant isolation
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull(),

  // e.g. "health:webhooks_stale", "health:email_failures"
  alertKey: varchar("alertKey", { length: 64 }).notNull(),

  // dedupe key: e.g. "launchbase|health:webhooks_stale|2h"
  fingerprint: varchar("fingerprint", { length: 128 }).notNull(),

  severity: mysqlEnum("severity", ["info", "warn", "crit"]).notNull(),

  // human readable
  title: varchar("title", { length: 160 }).notNull(),
  message: text("message").notNull(),

  status: mysqlEnum("status", ["active", "resolved"]).notNull().default("active"),

  // timestamps
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  sentAt: timestamp("sentAt"),
  resolvedAt: timestamp("resolvedAt"),

  // delivery tracking
  deliveryProvider: varchar("deliveryProvider", { length: 32 }),
  deliveryMessageId: varchar("deliveryMessageId", { length: 128 }),
  lastError: text("lastError"),

  // structured context for debugging
  meta: json("meta").$type<Record<string, unknown> | null>(),
});

export type AlertEvent = typeof alertEvents.$inferSelect;
export type InsertAlertEvent = typeof alertEvents.$inferInsert;

/**
 * Stripe webhook events log
 * Tracks all webhook deliveries for observability and idempotency
 */
export const stripeWebhookEvents = mysqlTable("stripe_webhook_events", {
  id: int("id").autoincrement().primaryKey(),
  // Stripe event details
  eventId: varchar("eventId", { length: 255 }).notNull().unique(),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  created: int("created").notNull(), // Stripe event created timestamp (Unix seconds)
  // Processing details
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  ok: boolean("ok"), // Nullable - set after processing completes
  error: text("error"),
  // Related entities
  intakeId: int("intakeId"),
  userId: int("userId"),
  // Idempotency tracking
  idempotencyHit: boolean("idempotencyHit").default(false).notNull(),
  retryCount: int("retryCount").default(0).notNull(),
  // Flexible metadata storage
  meta: json("meta").$type<Record<string, unknown>>(),
});
export type StripeWebhookEvent = typeof stripeWebhookEvents.$inferSelect;
export type InsertStripeWebhookEvent = typeof stripeWebhookEvents.$inferInsert;


/**
 * Promo codes (Beta Founders, etc)
 */
export const promoCodes = mysqlTable("promo_codes", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 100 }).notNull().unique(),
  setupFeeAmount: int("setupFeeAmount").notNull(),
  monthlyDiscountPercent: int("monthlyDiscountPercent"),
  monthlyDiscountMonths: int("monthlyDiscountMonths"),
  maxRedemptions: int("maxRedemptions").notNull(),
  active: boolean("active").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  // Proposed preview token (for View Proposed Preview link)
  proposedPreviewToken: varchar("proposedPreviewToken", { length: 64 }).unique(),
  proposedPreviewExpiresAt: timestamp("proposedPreviewExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Promo redemptions (reservations + actual redemptions)
 */
export const promoRedemptions = mysqlTable("promo_redemptions", {
  id: int("id").autoincrement().primaryKey(),
  promoCodeId: int("promoCodeId").notNull(),
  intakeId: int("intakeId").notNull(),
  status: mysqlEnum("status", ["reserved", "redeemed", "expired"]).notNull(),
  founderNumber: int("founderNumber"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 255 }),
  reservedAt: timestamp("reservedAt").defaultNow().notNull(),
  redeemedAt: timestamp("redeemedAt"),
  expiresAt: timestamp("expiresAt").notNull(),
}, (table) => ({
  uniqueFounder: uniqueIndex("unique_founder").on(table.promoCodeId, table.founderNumber),
}));

/**
 * Intake status change audit log (append-only)
 */
export const intakeStatusEvents = mysqlTable(
  "intake_status_events",
  {
    id: int("id").autoincrement().primaryKey(),
    intakeId: int("intakeId").notNull(),

    fromStatus: mysqlEnum("fromStatus", [
      "new",
      "review",
      "needs_info",
      "ready_for_review",
      "approved",
      "paid",
      "deployed",
    ]).notNull(),

    toStatus: mysqlEnum("toStatus", [
      "new",
      "review",
      "needs_info",
      "ready_for_review",
      "approved",
      "paid",
      "deployed",
    ]).notNull(),

    actorType: mysqlEnum("actorType", ["system", "admin", "customer"]).notNull(),
    actorId: varchar("actorId", { length: 191 }), // nullable; e.g. admin user id/email

    reason: varchar("reason", { length: 512 }).notNull(),
    override: int("override").notNull().default(0), // 0/1 for mysql friendliness
    meta: json("meta").$type<Record<string, unknown>>(), // optional extra context (ip, ui surface, etc.)

    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    intakeCreatedIdx: index("idx_intake_status_events_intake_created").on(
      t.intakeId,
      t.createdAt
    ),
    toStatusIdx: index("idx_intake_status_events_toStatus_created").on(
      t.toStatus,
      t.createdAt
    ),
  })
);
export type IntakeStatusEvent = typeof intakeStatusEvents.$inferSelect;
export type InsertIntakeStatusEvent = typeof intakeStatusEvents.$inferInsert;

/**
 * Confidence Learning: Track approval/rejection patterns by checklist key
 * System uses this to auto-tune confidence thresholds over time
 */
export const confidenceLearning = mysqlTable("confidence_learning", {
  id: int("id").autoincrement().primaryKey(),
  checklistKey: varchar("checklistKey", { length: 128 }).notNull(),
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
  
  // Counters
  totalSent: int("totalSent").notNull().default(0),
  totalApproved: int("totalApproved").notNull().default(0),
  totalRejected: int("totalRejected").notNull().default(0),
  totalEdited: int("totalEdited").notNull().default(0),
  totalUnclear: int("totalUnclear").notNull().default(0),
  
  // Computed metrics
  approvalRate: float("approvalRate").notNull().default(0.0), // 0.0 to 1.0
  editRate: float("editRate").notNull().default(0.0),
  
  // Recommended confidence threshold (learned)
  recommendedThreshold: float("recommendedThreshold").notNull().default(0.9), // Start at 0.9
  
  // Metadata
  lastUpdatedAt: timestamp("lastUpdatedAt").defaultNow().onUpdateNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  checklistKeyIdx: index("checklistKey_idx").on(table.checklistKey),
  tenantIdx: index("tenant_idx").on(table.tenant),
}));

export type ConfidenceLearning = typeof confidenceLearning.$inferSelect;
export type InsertConfidenceLearning = typeof confidenceLearning.$inferInsert;

/**
 * Design Jobs: Track each "presentation pass" for an intake
 * One row per presentation run (tier, status, winner, timings)
 */
export const designJobs = mysqlTable("design_jobs", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
  
  // Tier selection
  tier: mysqlEnum("tier", ["standard", "enhanced", "premium"]).notNull().default("standard"),
  
  // Status workflow
  status: mysqlEnum("status", ["created", "generated", "scored", "selected", "rendered", "failed"]).notNull().default("created"),
  
  // Engine used
  engine: varchar("engine", { length: 64 }).notNull().default("launchbase_rules_v1"),
  
  // Winner selection
  winnerCandidateId: int("winnerCandidateId"),
  
  // Input hash (to detect if re-run needed)
  inputsHash: varchar("inputsHash", { length: 64 }).notNull(),
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  intakeCreatedIdx: index("intake_created_idx").on(table.intakeId, table.createdAt),
  statusCreatedIdx: index("status_created_idx").on(table.status, table.createdAt),
  tenantCreatedIdx: index("tenant_created_idx").on(table.tenant, table.createdAt),
}));

export type DesignJob = typeof designJobs.$inferSelect;
export type InsertDesignJob = typeof designJobs.$inferInsert;

/**
 * Design Candidates: Store each variant, its score, and why it won
 * 3-5 rows per job (one per variant)
 */
export const designCandidates = mysqlTable("design_candidates", {
  id: int("id").autoincrement().primaryKey(),
  designJobId: int("designJobId").notNull(),
  
  // Variant identification
  variantKey: varchar("variantKey", { length: 128 }).notNull(), // e.g., "hero_left_trust_above_cta_solid"
  
  // Design output (normalized JSON)
  designJson: json("designJson").$type<{
    hero: {
      layoutType: string;
      headlineSize: string;
      imageTreatment: string;
      ctaPosition: string;
      trustIndicatorsVisible: boolean;
    };
    sections: Array<{
      type: string;
      order: number;
      layout: string;
      emphasis: string;
    }>;
    typography: {
      scale: string;
      weightContrast: string;
      maxFonts: number;
      headingFont: string;
      bodyFont: string;
    };
    spacing: {
      verticalRhythm: string;
      sectionDensity: string;
      containerMaxWidth: number;
    };
    colors: {
      primary: string;
      secondary?: string;
      neutral: string;
      maxAccentColors: number;
    };
    mobile: {
      tapTargetScore: number;
      foldClarity: number;
      stackOrder: string;
    };
    meta: {
      generatedBy: string;
      variantId: string;
      generatedAt: string;
    };
  }>(),
  
  // Scoring
  scoreTotal: int("scoreTotal").notNull(), // 0-1000
  scoreBreakdown: json("scoreBreakdown").$type<{
    readability: number;
    hierarchy: number;
    mobileClarity: number;
    conversionClarity: number;
    brandNeutrality: number;
    signals: Record<string, number>;
    violations: string[];
  }>(),
  
  // Ranking
  rank: int("rank").notNull(), // 1 = winner
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  jobScoreIdx: index("job_score_idx").on(table.designJobId, table.scoreTotal),
  jobRankIdx: index("job_rank_idx").on(table.designJobId, table.rank),
}));

export type DesignCandidate = typeof designCandidates.$inferSelect;
export type InsertDesignCandidate = typeof designCandidates.$inferInsert;

/**
 * Design Events: Audit trail for design operations
 * Tracks all design-related events (created, generated, scored, selected, etc.)
 */
export const designEvents = mysqlTable("design_events", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  designJobId: int("designJobId"),
  tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
  
  // Event classification
  eventType: varchar("eventType", { length: 64 }).notNull(), // DESIGN_JOB_CREATED, DESIGN_CANDIDATES_GENERATED, etc.
  actorType: mysqlEnum("actorType", ["system", "admin", "customer"]).notNull().default("system"),
  
  // Context
  reason: text("reason"), // Human-readable reason
  meta: json("meta").$type<Record<string, unknown>>(), // Additional context
  
  // Metadata
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  intakeCreatedIdx: index("intake_created_idx").on(table.intakeId, table.createdAt),
  jobCreatedIdx: index("job_created_idx").on(table.designJobId, table.createdAt),
  eventTypeIdx: index("event_type_idx").on(table.eventType, table.createdAt),
}));

export type DesignEvent = typeof designEvents.$inferSelect;
export type InsertDesignEvent = typeof designEvents.$inferInsert;

/**
 * Idempotency keys for preventing duplicate AI Tennis calls
 * Pattern: Stripe-style idempotency with TTL
 * Purpose: Prevent double-spend on retries (double clicks, refreshes, network timeouts)
 */
export const idempotencyKeys = mysqlTable("idempotency_keys", {
  id: int("id").autoincrement().primaryKey(),
  tenant: varchar("tenant", { length: 64 }).notNull(),
  scope: varchar("scope", { length: 255 }).notNull(), // e.g., "actionRequests.aiProposeCopy"
  keyHash: varchar("key_hash", { length: 64 }).notNull(), // HMAC-SHA256 hex (prevents key guessing)
  claimNonce: varchar("claim_nonce", { length: 40 }), // Ownership guard (precision-proof, replaces timestamp equality)
  status: mysqlEnum("status", ["started", "succeeded", "failed"]).notNull().default("started"),
  responseJson: json("response_json").$type<Record<string, unknown>>(), // Customer-safe cached response (no prompts/errors)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
  startedAt: timestamp("started_at"), // When operation started (for stale takeover)
  completedAt: timestamp("completed_at"), // When operation completed/failed
  expiresAt: timestamp("expires_at"), // TTL for cleanup (24h-7d)
  attemptCount: int("attempt_count").notNull().default(1), // Retry counter for stale takeover
}, (table) => ({
  expiresIdx: index("idempotency_keys_expires_idx").on(table.expiresAt),
  staleIdx: index("idempotency_keys_stale_idx").on(table.status, table.startedAt),
  uniqueKey: uniqueIndex("idempotency_keys_tenant_scope_keyhash_unique").on(table.tenant, table.scope, table.keyHash),
}));

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = typeof idempotencyKeys.$inferInsert;


/**
 * Run Plans: Deterministic execution plans for AI swarm
 * Created by runFieldGeneral from intake data
 */
export const runPlans = mysqlTable("run_plans", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  tier: mysqlEnum("tier", ["standard", "growth", "premium"]).notNull(),
  status: mysqlEnum("status", ["PENDING", "RUNNING", "COMPLETED", "FAILED"]).notNull().default("PENDING"),
  data: json("data").$type<{
    version: "runplan.v1";
    runId: string;
    jobId: string;
    tier: string;
    runMode: string;
    loopsRequested: number;
    creativeMode: { enabled: boolean; capBeforeSelect: number };
    builderGate: unknown;
    packs: unknown;
    budgets: { maxUsd: number; maxLatencyMs: number };
    truth: { neverInventClaims: boolean; onlyUseIntakeFacts: boolean; requiresApproval: boolean };
    createdAtIso: string;
  }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  intakeIdx: index("run_plans_intake_idx").on(table.intakeId),
  runIdIdx: index("run_plans_runid_idx").on(table.runId),
}));
export type RunPlan = typeof runPlans.$inferSelect;
export type InsertRunPlan = typeof runPlans.$inferInsert;

/**
 * Ship Packets: AI swarm execution results
 * Contains proposal data (systems, brand, critic) and preview info
 */
export const shipPackets = mysqlTable("ship_packets", {
  id: int("id").autoincrement().primaryKey(),
  intakeId: int("intakeId").notNull(),
  runPlanId: int("runPlanId").notNull(),
  runId: varchar("runId", { length: 64 }).notNull(),
  tier: mysqlEnum("tier", ["standard", "growth", "premium"]).notNull(),
  status: mysqlEnum("status", ["DRAFT", "RUNNING", "READY_FOR_REVIEW", "APPROVED", "REJECTED"]).notNull().default("DRAFT"),
  data: json("data").$type<{
    version: "shippacket.v1";
    intakeId: number;
    runPlanId: number;
    runId: string;
    tier: string;
    proposal: {
      systems: unknown | null;
      brand: unknown | null;
      critic: unknown | null;
    };
    preview: {
      url?: string;
      token?: string;
      screenshots: string[];
    };
    execution: {
      buildPlanId: number | null;
      builderSnapshotId: string | null;
      meta?: unknown;
    };
    createdAtIso: string;
  }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  intakeIdx: index("ship_packets_intake_idx").on(table.intakeId),
  runIdIdx: index("ship_packets_runid_idx").on(table.runId),
  statusIdx: index("ship_packets_status_idx").on(table.status),
}));
export type ShipPacket = typeof shipPackets.$inferSelect;
export type InsertShipPacket = typeof shipPackets.$inferInsert;

// ============ SWARM CONSOLE TABLES ============

export const swarmRuns = mysqlTable(
  "swarm_runs",
  {
    // DB: repairId int auto_increment primary key
    repairId: int("repairId").primaryKey().autoincrement(),

    // External string identifier from swarm system
    repairKey: varchar("repair_key", { length: 64 }).unique(),

    // DB snake_case columns
    createdAt: timestamp("created_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),

    // DB enum: pending,running,completed,failed,timeout
    status: mysqlEnum("status", ["pending", "running", "completed", "failed", "timeout"])
      .notNull()
      .default("pending"),

    // DB: text
    intention: text("intention"),

    fixtureName: varchar("fixture_name", { length: 64 }),

    stopReason: varchar("stop_reason", { length: 64 }),

    applied: boolean("applied"),
    testsPassed: boolean("tests_passed"),
    patchValid: boolean("patch_valid"),

    modelPrimary: varchar("model_primary", { length: 128 }),
    modelFallback: varchar("model_fallback", { length: 128 }),

    // DB: decimal(10,6)
    costUsd: decimal("cost_usd", { precision: 10, scale: 6 }),
    latencyMs: int("latency_ms"),

    // DB tinyint(1) NOT NULL default 0
    escalationTriggered: boolean("escalation_triggered").notNull().default(false),
    didRetry: boolean("did_retry").notNull().default(false),

    profileId: int("profile_id"),

    featurePackJson: json("feature_pack_json"),

    repoSourceId: int("repo_source_id"),
    repoHeadSha: varchar("repo_head_sha", { length: 64 }),

    pushedBranch: varchar("pushed_branch", { length: 128 }),
    pushedAt: timestamp("pushed_at"),
    pushedHeadSha: varchar("pushed_head_sha", { length: 64 }),

    // Missing in DB - will add via ALTER TABLE
    artifactPrefix: varchar("artifact_prefix", { length: 512 }),
    artifactKeys: json("artifact_keys"),
    errorSummary: text("error_summary"),
  },
  (table) => ({
    repairKeyIdx: uniqueIndex("uq_swarm_runs_repair_key").on(table.repairKey),
    createdAtIdx: index("swarm_runs_createdAt_idx").on(table.createdAt),
    stopReasonIdx: index("swarm_runs_stopReason_idx").on(table.stopReason),
    modelPrimaryIdx: index("swarm_runs_modelPrimary_idx").on(table.modelPrimary),
    fixtureIdx: index("swarm_runs_fixture_idx").on(table.fixtureName),
    profileIdx: index("swarm_runs_profile_idx").on(table.profileId),
    repoSourceIdx: index("swarm_runs_repoSource_idx").on(table.repoSourceId),
  })
);
export type SwarmRun = typeof swarmRuns.$inferSelect;
export type InsertSwarmRun = typeof swarmRuns.$inferInsert;

export const swarmProfiles = mysqlTable("swarm_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  createdByUserId: int("createdByUserId"),
  isPromoted: boolean("isPromoted").default(false).notNull(),
  configJson: json("configJson").notNull(), // FeaturePackV1 (JSON)
}, (table) => ({
  nameIdx: index("swarm_profiles_name_idx").on(table.name),
  promotedIdx: index("swarm_profiles_promoted_idx").on(table.isPromoted),
}));
export type SwarmProfile = typeof swarmProfiles.$inferSelect;
export type InsertSwarmProfile = typeof swarmProfiles.$inferInsert;

export const repoSources = mysqlTable("repo_sources", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  type: mysqlEnum("type", ["local", "git"]).default("local").notNull(),
  localPath: varchar("localPath", { length: 512 }),
  repoUrl: varchar("repoUrl", { length: 512 }),
  branch: varchar("branch", { length: 128 }),
  authType: mysqlEnum("authType", ["token", "ssh"]),
  encryptedSecret: text("encryptedSecret"),
  lastSyncAt: timestamp("lastSyncAt"),
  lastHeadSha: varchar("lastHeadSha", { length: 64 }),
}, (table) => ({
  nameIdx: index("repo_sources_name_idx").on(table.name),
  typeIdx: index("repo_sources_type_idx").on(table.type),
}));
export type RepoSource = typeof repoSources.$inferSelect;
export type InsertRepoSource = typeof repoSources.$inferInsert;
/**
 * Agent execution runs (Manus-like agent system)
 * Separate from swarm_runs - this is for the autonomous agent orchestrator
 */
export const agentRuns = mysqlTable("agent_runs", {
  id: int("id").autoincrement().primaryKey(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  createdBy: int("createdBy").notNull(), // user ID
  status: mysqlEnum("status", ["running", "success", "failed", "awaiting_approval"]).default("running").notNull(),
  goal: text("goal").notNull(), // user's original goal/prompt
  model: varchar("model", { length: 128 }), // GPT-5.2, etc.
  routerUrl: varchar("routerUrl", { length: 512 }), // agent-stack URL
  workspaceName: varchar("workspaceName", { length: 128 }), // sandbox workspace identifier
  finishedAt: timestamp("finishedAt"),
  errorMessage: text("errorMessage"),
  // State persistence for resume after approval
  stateJson: json("stateJson").$type<{
    messages: Array<{
      role: "system" | "user" | "assistant" | "tool";
      content: string;
      tool_call_id?: string;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    }>;
    stepCount: number;
    errorCount: number;
    maxSteps: number;
    maxErrors: number;
  }>(),
  pendingActionJson: json("pendingActionJson").$type<{
    approvalId: string;
    toolName: string;
    toolArgs: Record<string, unknown>;
    toolCallId: string;
    requestedAt: string;
    riskTier: number;
  }>(),
  approvedAt: timestamp("approvedAt"),
  // Project isolation: links this run to a project scope
  projectId: int("projectId"), // FK to projects.id — nullable for backward compat
  // Agent instance binding: links this run to a specific agent instance
  agentInstanceId: int("agentInstanceId"), // FK to agent_instances.id — nullable for backward compat
}, (table) => ({
  createdByIdx: index("agent_runs_createdBy_idx").on(table.createdBy),
  statusIdx: index("agent_runs_status_idx").on(table.status),
  createdAtIdx: index("agent_runs_createdAt_idx").on(table.createdAt),
  projectIdIdx: index("agent_runs_projectId_idx").on(table.projectId),
  agentInstanceIdIdx: index("agent_runs_agentInstanceId_idx").on(table.agentInstanceId),
}));
export type AgentRun = typeof agentRuns.$inferSelect;
export type InsertAgentRun = typeof agentRuns.$inferInsert;

/**
 * Agent event timeline (messages, tool calls, artifacts, approvals)
 * Append-only event log for each agent run
 */
export const agentEvents = mysqlTable("agent_events", {
  id: int("id").autoincrement().primaryKey(),
  runId: int("runId").notNull(), // FK to agent_runs
  ts: timestamp("ts").defaultNow().notNull(),
  type: mysqlEnum("type", [
    "message",           // user or assistant message
    "tool_call",         // agent requested tool execution
    "tool_result",       // tool execution result
    "approval_request",  // agent needs approval
    "approval_result",   // user approved/denied
    "error",             // error occurred
    "artifact"           // file/PR/screenshot artifact
  ]).notNull(),
  payload: json("payload").$type<Record<string, unknown>>().notNull(), // flexible JSON payload
}, (table) => ({
  runIdIdx: index("agent_events_runId_idx").on(table.runId),
  tsIdx: index("agent_events_ts_idx").on(table.ts),
  typeIdx: index("agent_events_type_idx").on(table.type),
}));
export type AgentEvent = typeof agentEvents.$inferSelect;
export type InsertAgentEvent = typeof agentEvents.$inferInsert;

// ============================================================================

// ============================================================================
// MARKETING INBOX
// ============================================================================

export const marketingInboxItem = mysqlTable(
  "marketing_inbox_item",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    status: varchar("status", { length: 24 }).notNull().default("new"),
    priority: varchar("priority", { length: 16 }).notNull().default("normal"),
    score: int("score").notNull().default(0),
    title: varchar("title", { length: 512 }).notNull(),
    url: varchar("url", { length: 2048 }),
    source: varchar("source", { length: 64 }).notNull(),
    sourceKey: varchar("source_key", { length: 256 }),
    summary: text("summary"),
    payload: json("payload").$type<Record<string, any>>().notNull(),
    assignedTo: varchar("assigned_to", { length: 128 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    byStatusCreated: index("mii_status_created_idx").on(t.status, t.createdAt),
    bySourceKey: index("mii_source_sourcekey_idx").on(t.source, t.sourceKey),
    byAssigned: index("mii_assigned_idx").on(t.assignedTo),
  })
);

export const marketingRunLog = mysqlTable(
  "marketing_run_log",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    agent: varchar("agent", { length: 64 }).notNull(),
    job: varchar("job", { length: 128 }).notNull(),
    status: varchar("status", { length: 24 }).notNull().default("ok"),
    message: text("message"),
    meta: json("meta").$type<Record<string, any>>().notNull(),
    startedAt: timestamp("started_at", { mode: "date" }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { mode: "date" }),
  },
  (t) => ({
    byAgentTime: index("mrl_agent_time_idx").on(t.agent, t.startedAt),
  })
);

// ============================================================================
// MARKETING SIGNALS - Enterprise Hybrid Signal Pipeline
// ============================================================================

export const marketingSignals = mysqlTable(
  "marketing_signals",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    sourceType: varchar("source_type", { length: 64 }).notNull(), // llc_filing, trademark, domain, job_post
    jurisdiction: varchar("jurisdiction", { length: 64 }).notNull(), // DE, CA, TX, USPTO, etc.
    entityName: varchar("entity_name", { length: 512 }).notNull(),
    eventDate: timestamp("event_date", { mode: "date" }).notNull(),
    canonicalKey: varchar("canonical_key", { length: 64 }).notNull().unique(), // sha256 dedupe key
    rawJson: json("raw_json").$type<Record<string, any>>().notNull(),
    score: int("score").notNull().default(0), // 0-100
    reasons: json("reasons").$type<string[]>(), // Scoring justification
    status: varchar("status", { length: 32 }).notNull().default("new"), // new, triaged, qualified, rejected, converted
    assignedTo: varchar("assigned_to", { length: 128 }),
    notes: text("notes"),
    tags: json("tags").$type<string[]>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    canonicalKeyIdx: uniqueIndex("ms_canonical_key_idx").on(t.canonicalKey),
    sourceTypeIdx: index("ms_source_type_idx").on(t.sourceType),
    statusIdx: index("ms_status_idx").on(t.status),
    scoreIdx: index("ms_score_idx").on(t.score),
    eventDateIdx: index("ms_event_date_idx").on(t.eventDate),
  })
);

export type MarketingSignal = typeof marketingSignals.$inferSelect;
export type InsertMarketingSignal = typeof marketingSignals.$inferInsert;


// ============================================================================
// MARKETING HYPOTHESES - Strategy output from Signals (PhD marketer layer)
// ============================================================================
export const marketingHypotheses = mysqlTable(
  "marketing_hypotheses",
  {
    id: varchar("id", { length: 32 }).primaryKey(),

    // Link back to the signals that inspired this hypothesis
    signalIds: json("signal_ids").$type<string[]>().notNull(),

    // Human-readable summary
    title: varchar("title", { length: 256 }).notNull(),
    hypothesis: text("hypothesis").notNull(),

    // Routing / targeting
    segment: varchar("segment", { length: 128 }).notNull().default("smb"),
    channel: varchar("channel", { length: 64 }).notNull().default("unknown"),

    // Scoring
    confidence: int("confidence").notNull().default(50), // 0-100
    impact: int("impact").notNull().default(50),         // 0-100
    effort: int("effort").notNull().default(50),         // 0-100

    // Explainability + execution
    reasons: json("reasons").$type<string[]>().notNull(),
    risks: json("risks").$type<string[]>().notNull(),
    nextSteps: json("next_steps").$type<string[]>().notNull(),

    status: varchar("status", { length: 32 }).notNull().default("new"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow().onUpdateNow(),
  },
  (t) => ({
    statusIdx: index("mh_status_idx").on(t.status),
    segmentIdx: index("mh_segment_idx").on(t.segment),
    channelIdx: index("mh_channel_idx").on(t.channel),
  })
);

export type MarketingHypothesis = typeof marketingHypotheses.$inferSelect;
export type InsertMarketingHypothesis = typeof marketingHypotheses.$inferInsert;


// ============================================================================
// PROJECT ISOLATION TABLES
// ============================================================================

/**
 * Projects — top-level isolation boundary for multi-tenant agent work.
 * Each project belongs to an owner (user) and a tenant.
 * Agent runs, artifacts, and collaborators are scoped to a project.
 */
export const projects = mysqlTable(
  "projects",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 128 }).notNull(),
    description: text("description"),
    ownerId: int("ownerId").notNull(), // FK to users.id
    tenant: mysqlEnum("tenant", ["launchbase", "vinces"]).notNull().default("launchbase"),
    status: mysqlEnum("status", ["active", "archived", "suspended"]).notNull().default("active"),
    settings: json("settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    slugIdx: uniqueIndex("projects_slug_idx").on(t.slug),
    ownerIdx: index("projects_owner_idx").on(t.ownerId),
    tenantIdx: index("projects_tenant_idx").on(t.tenant),
    statusIdx: index("projects_status_idx").on(t.status),
  })
);

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Project Collaborators — grants users access to a project with a specific role.
 * Enforces the principle of least privilege: users only see projects they belong to.
 */
export const projectCollaborators = mysqlTable(
  "project_collaborators",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(), // FK to projects.id
    userId: int("userId").notNull(), // FK to users.id
    role: mysqlEnum("role", ["owner", "editor", "viewer"]).notNull().default("viewer"),
    invitedBy: int("invitedBy"), // FK to users.id — who added this collaborator
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    projectUserIdx: uniqueIndex("pc_project_user_idx").on(t.projectId, t.userId),
    userIdx: index("pc_user_idx").on(t.userId),
  })
);

export type ProjectCollaborator = typeof projectCollaborators.$inferSelect;
export type InsertProjectCollaborator = typeof projectCollaborators.$inferInsert;

/**
 * Agent Artifacts — files, PRs, screenshots, and other outputs from agent runs.
 * Scoped to a project + run for access control.
 * Actual file content lives on disk (ARTIFACTS_DIR) or S3; this table stores metadata.
 */
export const agentArtifacts = mysqlTable(
  "agent_artifacts",
  {
    id: int("id").autoincrement().primaryKey(),
    runId: int("runId").notNull(), // FK to agent_runs.id
    projectId: int("projectId").notNull(), // FK to projects.id (denormalized for fast queries)
    type: mysqlEnum("type", ["file", "screenshot", "pr", "log", "report"]).notNull(),
    filename: varchar("filename", { length: 512 }).notNull(),
    mimeType: varchar("mimeType", { length: 128 }),
    sizeBytes: int("sizeBytes"),
    storagePath: varchar("storagePath", { length: 1024 }).notNull(), // relative path in ARTIFACTS_DIR or S3 key
    storageBackend: mysqlEnum("storageBackend", ["local", "s3"]).notNull().default("local"),
    checksum: varchar("checksum", { length: 128 }), // SHA-256 integrity check
    meta: json("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    runIdx: index("aa_run_idx").on(t.runId),
    projectIdx: index("aa_project_idx").on(t.projectId),
    typeIdx: index("aa_type_idx").on(t.type),
  })
);

export type AgentArtifact = typeof agentArtifacts.$inferSelect;
export type InsertAgentArtifact = typeof agentArtifacts.$inferInsert;

// ============================================================================
// SECURITY HARDENING TABLES
// ============================================================================

/**
 * Security Audit Log - Append-only log of security-relevant events
 * Tracks authentication, authorization, rate limiting, and access control events
 *
 * DO NOT weaken this contract:
 * - This table is append-only. Never update or delete rows.
 * - All security-relevant actions must be logged here.
 * - eventType + fingerprint provide dedupe capability.
 */
export const securityAuditLog = mysqlTable(
  "security_audit_log",
  {
    id: int("id").autoincrement().primaryKey(),

    // Event classification
    eventType: mysqlEnum("eventType", [
      "auth_success",
      "auth_failure",
      "access_denied",
      "rate_limit_hit",
      "rate_limit_warn",
      "admin_action",
      "project_access_granted",
      "project_access_denied",
      "suspicious_input",
      "csrf_violation",
      "session_created",
      "session_destroyed",
      "privilege_escalation_attempt",
    ]).notNull(),

    // Severity for alerting
    severity: mysqlEnum("severity", ["info", "warn", "crit"]).notNull().default("info"),

    // Actor identification
    actorType: mysqlEnum("actorType", ["anonymous", "user", "admin", "system"]).notNull().default("anonymous"),
    actorId: varchar("actorId", { length: 191 }), // user ID, IP, or system identifier
    actorIp: varchar("actorIp", { length: 45 }), // IPv4 or IPv6

    // Request context
    requestPath: varchar("requestPath", { length: 512 }),
    requestMethod: varchar("requestMethod", { length: 10 }),
    userAgent: text("userAgent"),

    // Tenant isolation
    tenant: mysqlEnum("tenant", ["launchbase", "vinces"]),

    // Target resource
    resourceType: varchar("resourceType", { length: 64 }), // "intake", "deployment", "build_plan", etc.
    resourceId: varchar("resourceId", { length: 191 }),

    // Human-readable description
    message: text("message").notNull(),

    // Structured metadata
    meta: json("meta").$type<Record<string, unknown>>(),

    // Dedupe fingerprint (optional)
    fingerprint: varchar("fingerprint", { length: 128 }),

    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    eventTypeIdx: index("sal_event_type_idx").on(t.eventType, t.createdAt),
    actorIpIdx: index("sal_actor_ip_idx").on(t.actorIp, t.createdAt),
    severityIdx: index("sal_severity_idx").on(t.severity, t.createdAt),
    tenantIdx: index("sal_tenant_idx").on(t.tenant, t.createdAt),
    resourceIdx: index("sal_resource_idx").on(t.resourceType, t.resourceId),
  })
);

export type SecurityAuditLog = typeof securityAuditLog.$inferSelect;
export type InsertSecurityAuditLog = typeof securityAuditLog.$inferInsert;

/**
 * Rate Limit Violations - Tracks rate limit enforcement for observability
 * Aggregated by window for efficient querying
 */
export const rateLimitViolations = mysqlTable(
  "rate_limit_violations",
  {
    id: int("id").autoincrement().primaryKey(),

    // Limiter identification
    limiterKey: varchar("limiterKey", { length: 128 }).notNull(), // e.g., "api:global", "api:auth", "api:mutation"
    bucketKey: varchar("bucketKey", { length: 256 }).notNull(), // e.g., IP address or user ID

    // Violation details
    requestCount: int("requestCount").notNull(), // how many requests in window
    limitMax: int("limitMax").notNull(), // what the limit was
    windowMs: int("windowMs").notNull(), // window duration in ms

    // Request context
    actorIp: varchar("actorIp", { length: 45 }),
    actorId: varchar("actorId", { length: 191 }),
    requestPath: varchar("requestPath", { length: 512 }),

    // Tenant
    tenant: mysqlEnum("tenant", ["launchbase", "vinces"]),

    // Timestamps
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    limiterKeyIdx: index("rlv_limiter_key_idx").on(t.limiterKey, t.createdAt),
    actorIpIdx: index("rlv_actor_ip_idx").on(t.actorIp, t.createdAt),
    bucketKeyIdx: index("rlv_bucket_key_idx").on(t.bucketKey, t.createdAt),
  })
);

export type RateLimitViolation = typeof rateLimitViolations.$inferSelect;
export type InsertRateLimitViolation = typeof rateLimitViolations.$inferInsert;

// ---------------------------------------------------------------------------
// Vertex Profiles — reusable agent configuration templates
// ---------------------------------------------------------------------------

export const vertexProfiles = mysqlTable("vertex_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  // JSON config: model settings, system prompt, temperature, etc.
  configJson: json("configJson").$type<Record<string, unknown>>(),
  // JSON allowlist of tools this vertex may use
  toolsAllowlistJson: json("toolsAllowlistJson").$type<string[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VertexProfile = typeof vertexProfiles.$inferSelect;
export type InsertVertexProfile = typeof vertexProfiles.$inferInsert;

// ---------------------------------------------------------------------------
// Agent Instances — per-customer agent deployment bound to a project + vertex
// ---------------------------------------------------------------------------

export const agentInstances = mysqlTable(
  "agent_instances",
  {
    id: int("id").autoincrement().primaryKey(),
    projectId: int("projectId").notNull(), // FK to projects.id
    vertexId: int("vertexId").notNull(), // FK to vertex_profiles.id
    displayName: varchar("displayName", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["active", "paused", "archived"]).default("active").notNull(),
    createdBy: int("createdBy").notNull(), // FK to users.id
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    projectIdx: index("ai_project_idx").on(t.projectId),
    vertexIdx: index("ai_vertex_idx").on(t.vertexId),
    statusIdx: index("ai_status_idx").on(t.status),
    createdByIdx: index("ai_createdBy_idx").on(t.createdBy),
  })
);

export type AgentInstance = typeof agentInstances.$inferSelect;
export type InsertAgentInstance = typeof agentInstances.$inferInsert;

// ---------------------------------------------------------------------------
// Agent Instance Secrets — encrypted key/value pairs per instance
// Never return raw values through the API — only confirm existence.
// ---------------------------------------------------------------------------

export const agentInstanceSecrets = mysqlTable(
  "agent_instance_secrets",
  {
    id: int("id").autoincrement().primaryKey(),
    instanceId: int("instanceId").notNull(), // FK to agent_instances.id
    key: varchar("key", { length: 255 }).notNull(),
    encryptedValue: text("encryptedValue").notNull(), // encrypted blob
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (t) => ({
    instanceIdx: index("ais_instance_idx").on(t.instanceId),
    instanceKeyUniq: uniqueIndex("ais_instance_key_uniq").on(t.instanceId, t.key),
  })
);

export type AgentInstanceSecret = typeof agentInstanceSecrets.$inferSelect;
export type InsertAgentInstanceSecret = typeof agentInstanceSecrets.$inferInsert;
