/**
 * Environment Variable Loader
 *
 * Centralizes env access with typed defaults and validation.
 * In production, crashes on missing required vars — do not boot partial.
 */

const NODE_ENV = process.env.NODE_ENV || "development";
const isProduction = NODE_ENV === "production";

// ---------------------------------------------------------------------------
// Required env validation — crash if missing in production
// ---------------------------------------------------------------------------

const REQUIRED_IN_PRODUCTION = [
  "DATABASE_URL",
  "JWT_SECRET",
  "SESSION_SECRET",
  "MOBILE_ADMIN_SECRET",
] as const;

if (isProduction) {
  const missing: string[] = [];
  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!process.env[key]) missing.push(key);
  }
  if (missing.length > 0) {
    console.error(
      `[env] FATAL: Missing required environment variables in production: ${missing.join(", ")}`
    );
    console.error("[env] Platform cannot boot in partial config. Exiting.");
    process.exit(1);
  }

  // Reject insecure defaults
  if (process.env.JWT_SECRET === "dev-secret-change-in-production") {
    console.error("[env] FATAL: JWT_SECRET is set to the default dev value in production.");
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Env export
// ---------------------------------------------------------------------------

export const env = {
  NODE_ENV,
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: process.env.DATABASE_URL || "",
  PUBLIC_BASE_URL:
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-in-production",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev-session-secret",

  // Agent stack
  AGENT_STACK_URL: process.env.AGENT_STACK_URL || "http://localhost:4100",

  // External services
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY || "",

  // Mobile
  MOBILE_ADMIN_SECRET: process.env.MOBILE_ADMIN_SECRET || "",
  MOBILE_SESSION_TTL_HOURS: parseInt(
    process.env.MOBILE_SESSION_TTL_HOURS || "24",
    10
  ),

  // Feature flags
  ALLOW_STAGING_BYPASS: process.env.ALLOW_STAGING_BYPASS === "true",

  // Presentation
  presentationTier: process.env.PRESENTATION_TIER || "standard",

  get isProduction() {
    return this.NODE_ENV === "production";
  },
  get isDevelopment() {
    return this.NODE_ENV === "development";
  },
} as const;

export { env as ENV };
