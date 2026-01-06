import { execSync } from "node:child_process";

/**
 * Vitest global setup - runs once before all tests
 * Ensures test database has all migrations applied
 * 
 * This prevents "table doesn't exist" failures and makes tests self-healing.
 */
export default async function globalSetup() {
  console.log("[Vitest Setup] Applying migrations to database...");
  try {
    execSync("pnpm -s drizzle-kit migrate", { stdio: "inherit" });
    console.log("[Vitest Setup] Migrations complete ✓");
  } catch (err) {
    console.error("[Vitest Setup] Failed to apply migrations:", err);
    throw err;
  }
}
