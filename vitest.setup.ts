/**
 * Vitest setup file - runs in the same process as tests, BEFORE any test imports
 * 
 * This ensures migrations and runtime DB client use the exact same DATABASE_URL.
 * 
 * CRITICAL: This must run before any code imports server/db.ts, otherwise the
 * connection pool will be created with the wrong URL and frozen.
 */

function pickTestDbUrl(): string {
  // Manus platform may provide different env vars for test vs prod
  // Priority: TEST_DATABASE_URL > DATABASE_URL_TEST > DATABASE_URL
  const url = 
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL_TEST ||
    process.env.DATABASE_URL;
  
  if (!url) {
    throw new Error("No DATABASE_URL available in test environment");
  }
  
  return url;
}

// Get the canonical test DB URL
const testDbUrl = pickTestDbUrl();

// Parse URL to extract DB name for logging
const parsedUrl = new URL(testDbUrl);
const dbName = parsedUrl.pathname.replace(/^\//, ''); // Remove leading slash

console.log("[Vitest Setup] Canonical DATABASE_URL set");
console.log("[Vitest Setup] DB name:", dbName);

// Force everything in this process to use the same URL
// This ensures drizzle-kit migrations and server/db.ts connect to the same database
process.env.DATABASE_URL = testDbUrl;

// Force memory transport for deterministic tests (no real emails)
process.env.EMAIL_TRANSPORT = "memory";
console.log("[Vitest Setup] EMAIL_TRANSPORT set to 'memory' (deterministic tests)");

// Set explicit test secret for idempotency (prevents accidental fallback reliance)
process.env.IDEMPOTENCY_SECRET = "test-secret-deterministic-vitest";
console.log("[Vitest Setup] IDEMPOTENCY_SECRET set to test value (deterministic tests)");

// Force memory AI provider (prevents ModelRouter invocation in tests)
process.env.NODE_ENV = "test";
process.env.VITEST = "true"; // Standardized to "true" (not "1") for consistency
process.env.AI_PROVIDER = "memory";
process.env.AIML_API_KEY = "test";
process.env.AIML_BASE_URL = "http://test";
console.log("[Vitest Setup] AI_PROVIDER set to 'memory' (prevents ModelRouter in tests)");

// Export for debugging if needed
export const TEST_DB_NAME = dbName;
