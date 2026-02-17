/**
 * Environment Variable Loader
 *
 * Centralizes env access with typed defaults and validation.
 */

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),
  DATABASE_URL: process.env.DATABASE_URL || "",
  PUBLIC_BASE_URL:
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_URL ||
    "http://localhost:3000",

  // Auth
  JWT_SECRET: process.env.JWT_SECRET || "dev-secret-change-in-production",
  SESSION_SECRET: process.env.SESSION_SECRET || "dev-session-secret",

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
