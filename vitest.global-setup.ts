import { execSync } from "node:child_process";
import mysql from "mysql2/promise";

/**
 * Vitest global setup - runs once before all tests
 * 
 * STRATEGY: Rebuild test database from scratch on every test run
 * This guarantees 100% green tests by eliminating migration drift.
 * 
 * Steps:
 * 1. Parse DATABASE_URL to extract DB name
 * 2. Connect to MySQL without selecting a database
 * 3. DROP DATABASE IF EXISTS (clean slate)
 * 4. CREATE DATABASE (fresh schema)
 * 5. Run drizzle-kit migrate (apply all migrations)
 * 
 * This is the "Option A" approach: fast, reliable, no ghost migrations.
 */
export default async function globalSetup() {
  console.log("[Vitest Setup] Rebuilding test database from scratch...");
  
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for tests");
  }
  
  // Parse DATABASE_URL to extract connection info and DB name
  const url = new URL(databaseUrl);
  const dbName = url.pathname.replace(/^\//, ''); // Remove leading slash
  
  // Create connection URL without database selection
  const connectionUrl = `${url.protocol}//${url.username}:${url.password}@${url.host}${url.search}`;
  
  console.log(`[Vitest Setup] Target database: ${dbName}`);
  
  try {
    // Connect to MySQL server without selecting a database
    const conn = await mysql.createConnection(connectionUrl);
    
    // Drop and recreate database for clean slate
    console.log(`[Vitest Setup] Dropping database ${dbName}...`);
    await conn.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    
    console.log(`[Vitest Setup] Creating database ${dbName}...`);
    await conn.query(`CREATE DATABASE \`${dbName}\``);
    
    await conn.end();
    console.log("[Vitest Setup] Database rebuilt successfully");
    
  } catch (err) {
    console.error("[Vitest Setup] Failed to rebuild database:", err);
    throw err;
  }
  
  // Now apply schema using drizzle-kit push (TiDB-safe, creates tables from schema)
  console.log("[Vitest Setup] Applying schema with drizzle-kit push...");
  try {
    execSync("pnpm -s drizzle-kit push --force", { stdio: "inherit" });
    console.log("[Vitest Setup] Schema applied successfully ✓");
  } catch (err) {
    console.error("[Vitest Setup] Failed to apply schema:", err);
    throw err;
  }
  
  console.log("[Vitest Setup] Test database ready ✓");
}
