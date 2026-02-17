/**
 * Health Module
 *
 * Returns system health by checking database connectivity,
 * memory usage, and uptime.
 */

import { getDb } from "./db";
import { sql } from "drizzle-orm";

export async function getHealthMetrics(_tenant?: string): Promise<{
  status: string;
  db: string;
  uptime: number;
  memory: NodeJS.MemoryUsage;
  checks: Array<{ name: string; status: string }>;
}> {
  const checks: Array<{ name: string; status: string }> = [];

  // Check database connectivity
  let dbStatus = "disconnected";
  try {
    const db = await getDb();
    if (db) {
      await db.execute(sql`SELECT 1`);
      dbStatus = "connected";
      checks.push({ name: "database", status: "healthy" });
    } else {
      checks.push({ name: "database", status: "unavailable" });
    }
  } catch (err) {
    dbStatus = "error";
    checks.push({
      name: "database",
      status: `error: ${err instanceof Error ? err.message : String(err)}`,
    });
  }

  // Check memory usage
  const memory = process.memoryUsage();
  const heapUsedMB = memory.heapUsed / 1024 / 1024;
  const memoryStatus = heapUsedMB < 512 ? "healthy" : heapUsedMB < 1024 ? "warning" : "critical";
  checks.push({ name: "memory", status: memoryStatus });

  // Check uptime
  const uptime = process.uptime();
  checks.push({ name: "uptime", status: "healthy" });

  // Check environment
  const hasRequiredEnv = !!process.env.DATABASE_URL || !!process.env.DB_HOST;
  checks.push({
    name: "environment",
    status: hasRequiredEnv ? "configured" : "missing_db_config",
  });

  // Overall status
  const hasErrors = checks.some(
    (c) => c.status === "error" || c.status.startsWith("error:") || c.status === "critical",
  );
  const hasWarnings = checks.some((c) => c.status === "warning");
  const overallStatus = hasErrors ? "degraded" : hasWarnings ? "warning" : "ok";

  return {
    status: overallStatus,
    db: dbStatus,
    uptime,
    memory,
    checks,
  };
}
