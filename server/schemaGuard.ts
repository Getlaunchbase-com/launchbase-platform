/**
 * Schema Guard - Prevents worker endpoints from failing when schema is behind
 * 
 * Problem: If code deploys before migrations run, workers query columns that don't exist yet → 500s
 * Solution: Check for critical columns before running worker logic → skip with 200 if schema is behind
 * 
 * This is "cheap insurance" that prevents 2am incidents from deploy/migration timing issues.
 */

import { sql } from "drizzle-orm";
import { getDb } from "./db";

export type SchemaGuardResult =
  | { ok: true; schemaKey: string }
  | { ok: false; schemaKey: string; missing: string[] };

/**
 * Critical columns that must exist in deployments table for workers to function
 * If any are missing, schema is behind and workers should skip
 */
const REQUIRED_DEPLOYMENTS_COLUMNS = [
  "trigger",
  "rolledBackFromDeploymentId",
  "urlMode",
  "buildPlanSnapshot",
  "urlModeEnforcementLog",
  "templateVersion",
] as const;

/**
 * Cache schema check results for 1 minute to avoid hammering information_schema
 */
let cache: { at: number; result: SchemaGuardResult } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

/**
 * Check if deployments table has all required columns
 * Returns { ok: true } if schema is up-to-date, { ok: false, missing: [...] } if behind
 * 
 * Cached for 1 minute to avoid performance impact
 */
export async function checkWorkerSchema(): Promise<SchemaGuardResult> {
  const now = Date.now();
  
  // Return cached result if still fresh
  if (cache && now - cache.at < CACHE_TTL_MS) {
    return cache.result;
  }

  const db = await getDb();
  if (!db) {
    // If DB not available, return "not ok" to skip worker logic
    return {
      ok: false,
      schemaKey: "deployments:v_rollback",
      missing: ["DB_NOT_AVAILABLE"],
    };
  }

  // Query information_schema for deployments columns
  const rows = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'deployments'
  `);

  // Normalize column names (MySQL returns different cases)
  const cols = new Set(
    (rows as any[]).map((r: any) => r.column_name ?? r.COLUMN_NAME).filter(Boolean)
  );

  // Check which required columns are missing
  const missing = REQUIRED_DEPLOYMENTS_COLUMNS.filter((c) => !cols.has(c));

  const result: SchemaGuardResult =
    missing.length === 0
      ? { ok: true, schemaKey: "deployments:v_rollback" }
      : { ok: false, schemaKey: "deployments:v_rollback", missing };

  // Cache result
  cache = { at: now, result };
  return result;
}

/**
 * Build metadata for worker responses (buildId, serverTime)
 * Helps correlate cron failures with specific deploys
 */
export function buildMeta() {
  const now = new Date().toISOString();
  return {
    buildId: process.env.BUILD_ID ?? now,
    serverTime: now,
  };
}
