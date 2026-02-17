/**
 * Deployment Worker
 *
 * Manages deployment queue processing, status tracking, and run history.
 * Queries the workerRuns table for persistent history.
 */

import { getDb } from "../db";
import { workerRuns } from "../db/schema";
import { desc, sql, eq } from "drizzle-orm";

// ---------------------------------------------------------------------------
// getLastWorkerRun
// ---------------------------------------------------------------------------

export async function getLastWorkerRun(): Promise<{
  lastRun: { startedAt: string; finishedAt: string; status: string } | null;
  stats: { processed: number; skipped: number; errors: number };
  recentRuns: Array<{ startedAt: string; status: string }>;
} | null> {
  try {
    const db = await getDb();
    if (!db) {
      return null;
    }

    // Get the most recent run
    const [lastRun] = await db
      .select()
      .from(workerRuns)
      .where(eq(workerRuns.job, "run-next-deploy"))
      .orderBy(desc(workerRuns.startedAt))
      .limit(1);

    // Get recent runs (last 20)
    const recentRunRows = await db
      .select({
        startedAt: workerRuns.startedAt,
        ok: workerRuns.ok,
        processed: workerRuns.processed,
        error: workerRuns.error,
        finishedAt: workerRuns.finishedAt,
      })
      .from(workerRuns)
      .where(eq(workerRuns.job, "run-next-deploy"))
      .orderBy(desc(workerRuns.startedAt))
      .limit(20);

    // Aggregate stats from recent runs
    const [statsRow] = await db
      .select({
        totalProcessed: sql<number>`COALESCE(SUM(${workerRuns.processed}), 0)`.as(
          "totalProcessed",
        ),
        totalErrors: sql<number>`SUM(CASE WHEN ${workerRuns.ok} = false THEN 1 ELSE 0 END)`.as(
          "totalErrors",
        ),
        totalSkipped: sql<number>`SUM(CASE WHEN ${workerRuns.processed} = 0 AND ${workerRuns.ok} = true THEN 1 ELSE 0 END)`.as(
          "totalSkipped",
        ),
      })
      .from(workerRuns)
      .where(eq(workerRuns.job, "run-next-deploy"));

    return {
      lastRun: lastRun
        ? {
            startedAt: lastRun.startedAt.toISOString(),
            finishedAt: lastRun.finishedAt
              ? lastRun.finishedAt.toISOString()
              : lastRun.startedAt.toISOString(),
            status: lastRun.ok === true
              ? "success"
              : lastRun.ok === false
                ? "error"
                : "running",
          }
        : null,
      stats: {
        processed: Number(statsRow?.totalProcessed ?? 0),
        skipped: Number(statsRow?.totalSkipped ?? 0),
        errors: Number(statsRow?.totalErrors ?? 0),
      },
      recentRuns: recentRunRows.map((run) => ({
        startedAt: run.startedAt.toISOString(),
        status: run.ok === true
          ? "success"
          : run.ok === false
            ? "error"
            : "running",
      })),
    };
  } catch (err) {
    console.error("[deployment-worker] getLastWorkerRun error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// recordWorkerRun
// ---------------------------------------------------------------------------

export async function recordWorkerRun(
  status: string,
  processed: number,
  skipped: number,
  errors: number,
): Promise<void> {
  try {
    const db = await getDb();
    if (!db) {
      console.warn("[deployment-worker] Database not available, run not recorded");
      return;
    }

    const runKey = crypto.randomUUID
      ? crypto.randomUUID()
      : `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    await db.insert(workerRuns).values({
      runKey,
      job: "run-next-deploy",
      ok: status === "success",
      processed,
      finishedAt: new Date(),
      error: status === "error" ? `Worker run failed with ${errors} errors` : null,
      meta: { skipped, errors, status },
    });
  } catch (err) {
    console.error("[deployment-worker] Failed to record worker run:", err);
  }
}
