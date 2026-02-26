/**
 * Environment Variable Loader — Strict Validation + Fail-Fast
 *
 * Production-grade env handling:
 *   1. Zod-based schema validation for ALL env vars
 *   2. Hard crash on missing required vars (fail-fast)
 *   3. Format validation (URLs, secrets length, port range)
 *   4. Rejection of insecure defaults in production
 *   5. Sanitized config logged at boot (secrets masked)
 */

import { z } from "zod";
import "dotenv/config";

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Zod schema — single source of truth for env shape + validation
// ---------------------------------------------------------------------------

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PUBLIC_BASE_URL: z.string().url().optional(),

  // Auth — required in production
  JWT_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(1),

  // Agent stack
  AGENT_STACK_URL: z.string().url().default("http://localhost:4100"),

  // Redis (optional — enables distributed rate limiting + BullMQ queues)
  REDIS_URL: z.string().optional(),

  // External services
  AIML_API_BASE_URL: z.string().url().optional(),
  AIML_API_KEY: z.string().default(""),
  OPENAI_API_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  OPENAI_API_KEY: z.string().default(""),
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),

  // Mobile
  MOBILE_ADMIN_SECRET: z.string().min(1).optional(),
  MOBILE_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(24),

  // Feature flags
  ALLOW_STAGING_BYPASS: z
    .enum(["true", "false", ""])
    .default("")
    .transform((v) => v === "true"),

  // Presentation
  PRESENTATION_TIER: z.string().default("standard"),

  // Storage
  ARTIFACTS_DIR: z.string().optional(),
  ARTIFACTS_S3_BUCKET: z.string().optional(),

  // Agent secret
  AGENT_SECRET_KEY: z.string().optional(),

  // Malware scanner (optional external command)
  MALWARE_SCANNER_CMD: z.string().optional(),

  // Resend email
  RESEND_API_KEY: z.string().default(""),
  EMAIL_FROM: z.string().default(""),

  // Facebook
  FACEBOOK_PAGE_ID: z.string().default(""),
  FACEBOOK_PAGE_ACCESS_TOKEN: z.string().default(""),

  // Notifications
  ADMIN_WEBHOOK_URL: z.string().default(""),
  NOTIFICATION_WEBHOOK_URL: z.string().default(""),

  // CI-injected
  GIT_SHA: z.string().default(""),
  BUILD_TIME: z.string().default(""),
});

// ---------------------------------------------------------------------------
// Parse + validate
// ---------------------------------------------------------------------------

const parseResult = envSchema.safeParse(process.env);

if (!parseResult.success) {
  const formatted = parseResult.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  console.error(`[env] FATAL: Environment validation failed:\n${formatted}`);
  console.error("[env] Platform cannot boot with invalid configuration. Exiting.");
  process.exit(1);
}

const parsed = parseResult.data;

// ---------------------------------------------------------------------------
// Production-specific enforcement
// ---------------------------------------------------------------------------

if (isProduction) {
  const fatalErrors: string[] = [];

  // Required vars in production
  const requiredInProd: Array<{ key: keyof typeof parsed; label: string }> = [
    { key: "DATABASE_URL", label: "DATABASE_URL" },
    { key: "JWT_SECRET", label: "JWT_SECRET" },
    { key: "SESSION_SECRET", label: "SESSION_SECRET" },
  ];

  for (const { key, label } of requiredInProd) {
    if (!parsed[key]) {
      fatalErrors.push(`${label} is required in production`);
    }
  }

  // Reject insecure defaults
  if (parsed.JWT_SECRET === "dev-secret-change-in-production") {
    fatalErrors.push("JWT_SECRET is set to the default dev value");
  }
  if (parsed.SESSION_SECRET === "dev-session-secret") {
    fatalErrors.push("SESSION_SECRET is set to the default dev value");
  }

  // Secret length enforcement
  if (parsed.JWT_SECRET.length < 32) {
    fatalErrors.push("JWT_SECRET must be at least 32 characters in production");
  }
  if (parsed.SESSION_SECRET.length < 16) {
    fatalErrors.push("SESSION_SECRET must be at least 16 characters in production");
  }

  if (fatalErrors.length > 0) {
    console.error(`[env] FATAL: Production environment checks failed:`);
    for (const err of fatalErrors) {
      console.error(`  - ${err}`);
    }
    console.error("[env] Platform cannot boot in partial/insecure config. Exiting.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Sanitized boot log — mask secrets, show config shape
// ---------------------------------------------------------------------------

function maskSecret(val: string | undefined): string {
  if (!val) return "(not set)";
  if (val.length <= 8) return "****";
  return val.slice(0, 4) + "****" + val.slice(-4);
}

/**
 * Log the current configuration at boot (secrets masked).
 * Called from server startup to ensure config visibility in logs.
 */
export function logBootConfig(): void {
  const config = {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    DATABASE_URL: maskSecret(parsed.DATABASE_URL),
    PUBLIC_BASE_URL: parsed.PUBLIC_BASE_URL ?? "(not set)",
    AGENT_STACK_URL: parsed.AGENT_STACK_URL,
    JWT_SECRET: maskSecret(parsed.JWT_SECRET),
    SESSION_SECRET: maskSecret(parsed.SESSION_SECRET),
    OPENAI_API_KEY: (parsed.OPENAI_API_KEY || parsed.AIML_API_KEY)
      ? maskSecret(parsed.OPENAI_API_KEY || parsed.AIML_API_KEY)
      : "(not set)",
    OPENAI_API_BASE_URL: parsed.OPENAI_API_BASE_URL || parsed.AIML_API_BASE_URL || "https://api.openai.com/v1",
    STRIPE_SECRET_KEY: parsed.STRIPE_SECRET_KEY ? maskSecret(parsed.STRIPE_SECRET_KEY) : "(not set)",
    MOBILE_ADMIN_SECRET: maskSecret(parsed.MOBILE_ADMIN_SECRET),
    MOBILE_SESSION_TTL_HOURS: parsed.MOBILE_SESSION_TTL_HOURS,
    ALLOW_STAGING_BYPASS: parsed.ALLOW_STAGING_BYPASS,
    ARTIFACTS_DIR: parsed.ARTIFACTS_DIR ?? "(default: ./artifacts)",
    ARTIFACTS_S3_BUCKET: parsed.ARTIFACTS_S3_BUCKET ?? "(not set — local storage)",
    REDIS_URL: parsed.REDIS_URL ? maskSecret(parsed.REDIS_URL) : "(not set — in-memory rate limiting)",
    MALWARE_SCANNER_CMD: parsed.MALWARE_SCANNER_CMD ?? "(not configured)",
    PRESENTATION_TIER: parsed.PRESENTATION_TIER,
  };

  console.info("[env] Boot configuration (secrets masked):");
  for (const [key, val] of Object.entries(config)) {
    console.info(`  ${key}: ${val}`);
  }
}

// ---------------------------------------------------------------------------
// Export — typed env object
// ---------------------------------------------------------------------------

export const env = {
  NODE_ENV: parsed.NODE_ENV,
  PORT: parsed.PORT,
  DATABASE_URL: parsed.DATABASE_URL,
  PUBLIC_BASE_URL:
    parsed.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000",

  // Auth
  JWT_SECRET: parsed.JWT_SECRET || "dev-secret-change-in-production",
  SESSION_SECRET: parsed.SESSION_SECRET || "dev-session-secret",

  // Agent stack
  AGENT_STACK_URL: parsed.AGENT_STACK_URL,

  // External services
  OPENAI_API_KEY: parsed.OPENAI_API_KEY || parsed.AIML_API_KEY,
  OPENAI_API_BASE_URL: parsed.OPENAI_API_BASE_URL || parsed.AIML_API_BASE_URL || "https://api.openai.com/v1",
  STRIPE_SECRET_KEY: parsed.STRIPE_SECRET_KEY,

  // Mobile
  MOBILE_ADMIN_SECRET: parsed.MOBILE_ADMIN_SECRET ?? "",
  MOBILE_SESSION_TTL_HOURS: parsed.MOBILE_SESSION_TTL_HOURS,

  // Feature flags
  ALLOW_STAGING_BYPASS: parsed.ALLOW_STAGING_BYPASS,

  // Presentation
  presentationTier: parsed.PRESENTATION_TIER,

  get isProduction() {
    return this.NODE_ENV === "production";
  },
  get isDevelopment() {
    return this.NODE_ENV === "development";
  },
} as const;

export { env as ENV };
