import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

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
});

export type Clarification = typeof clarifications.$inferSelect;
export type InsertClarification = typeof clarifications.$inferInsert;

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
  // URL mode: Phase 1 = TEMP_MANUS, Phase 2 = CUSTOM_DOMAIN
  urlMode: varchar("urlMode", { length: 50 }).default("TEMP_MANUS"),
  // Template version (for immutability)
  templateVersion: varchar("templateVersion", { length: 32 }).notNull().default("v1"),
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
 * Email logs for tracking sent emails
 */
export const emailLogs = mysqlTable("email_logs", {
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
    "day7_checkin",
    "day30_value",
    "contact_form_confirmation"
  ]).notNull(),
  recipientEmail: varchar("recipientEmail", { length: 320 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  // Status
  status: mysqlEnum("status", ["sent", "failed", "opened", "clicked"]).default("sent").notNull(),
  // Delivery tracking (forever observability)
  deliveryProvider: mysqlEnum("deliveryProvider", ["resend", "notification"]),
  errorMessage: text("errorMessage"),
  // Timestamps
  sentAt: timestamp("sentAt").defaultNow().notNull(),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

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
