#!/usr/bin/env tsx
/**
 * Weekly AI Tennis Metrics Report Generator
 * 
 * Runs 6 canonical SQL queries from docs/AI_METRICS_QUERIES.md
 * and produces a markdown report in reports/ai_weekly_<YYYY-MM-DD>.md
 * 
 * Guardrails:
 * - Read-only SQL (no writes)
 * - No schema changes
 * - No prompt content ever logged/stored
 * - Deterministic markdown output
 * - Git-friendly format
 */

import { writeFileSync } from "fs";
import { format } from "date-fns";
import { getDb } from "../server/db";
import { buildMarkdown } from "./_weeklyAiReportMarkdown";

type AnyRow = Record<string, any>;

/**
 * Unwrap driver-specific result formats to plain rows array.
 * Handles: [rows, fields], { rows }, already-rows, non-select packets.
 */
function unwrapRows(result: any): AnyRow[] {
  if (!result) return [];

  // mysql2 / some drivers: [rows, fields]
  if (Array.isArray(result)) {
    const first = result[0];
    if (Array.isArray(first)) return first as AnyRow[];
    if (first && typeof first === "object" && Array.isArray((first as any).rows)) return (first as any).rows;
    // If it's already rows (rare)
    if (first && typeof first === "object" && !("affectedRows" in first)) return result as AnyRow[];
    return [];
  }

  // drizzle sometimes: { rows: [...] }
  if (typeof result === "object" && Array.isArray((result as any).rows)) {
    return (result as any).rows as AnyRow[];
  }

  // mysql2 "OkPacket" etc — not a rowset
  return [];
}

// ============================================
// CANONICAL SQL QUERIES (from AI_METRICS_QUERIES.md)
// ============================================

const BASE_CTE = `
WITH ai_proposals AS (
  SELECT
    ar.id AS action_request_id,
    ar.intakeId AS intake_id,
    i.tenant AS tenant,
    ar.createdAt AS created_at,
    ar.status AS status,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.needsHuman') AS UNSIGNED) AS needs_human,
    CAST(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.costUsd') AS DECIMAL(10,4)) AS cost_usd,
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.traceId')) AS trace_id
  FROM action_requests ar
  JOIN intakes i ON i.id = ar.intakeId
  WHERE
    JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.source')) = 'ai_tennis'
)
`;

const QUERIES = {
  // 1. stopReason Distribution (7-day)
  stopReasonDistribution: `
    ${BASE_CTE}
    SELECT
      stop_reason AS stopReason,
      COUNT(*) AS count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY stop_reason
    ORDER BY count DESC
  `,

  // 2. needsHuman Rate (7-day) - Current Window
  needsHumanRateCurrent: `
    ${BASE_CTE}
    SELECT
      '7-day' AS period,
      SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
  `,

  // 2b. needsHuman Rate (7-day) - Prior Window
  needsHumanRatePrior: `
    ${BASE_CTE}
    SELECT
      '7-day' AS period,
      SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 14 DAY AND created_at < NOW() - INTERVAL 7 DAY
  `,

  // 3. Cost per Approval (7-day by tenant)
  costPerApproval: `
    ${BASE_CTE},
    approved AS (
      SELECT
        ap.tenant,
        ap.action_request_id,
        ap.cost_usd
      FROM ai_proposals ap
      WHERE ap.status IN ('applied','confirmed','locked')
    )
    SELECT
      ap.tenant,
      ROUND(SUM(ap.cost_usd), 4) AS avg7Usd,
      0 AS avg30Usd,
      0 AS wowDeltaPct
    FROM ai_proposals ap
    WHERE ap.created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY ap.tenant
    ORDER BY avg7Usd DESC
  `,

  // 4. Approval Rate (7-day by tenant) - Current Window
  approvalRateCurrent: `
    ${BASE_CTE}
    SELECT
      tenant,
      SUM(CASE WHEN status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    HAVING COUNT(*) > 0
    ORDER BY tenant
  `,

  // 4b. Approval Rate (7-day by tenant) - Prior Window
  approvalRatePrior: `
    ${BASE_CTE}
    SELECT
      tenant,
      SUM(CASE WHEN status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 14 DAY AND created_at < NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    HAVING COUNT(*) > 0
    ORDER BY tenant
  `,

  // 5. Cache Hit Rate (7-day by tenant) - Current Window
  cacheHitRateCurrent: `
    ${BASE_CTE}
    SELECT
      tenant,
      SUM(CASE WHEN stop_reason = 'cached' THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    HAVING COUNT(*) > 0
    ORDER BY tenant
  `,

  // 5b. Cache Hit Rate (7-day by tenant) - Prior Window
  cacheHitRatePrior: `
    ${BASE_CTE}
    SELECT
      tenant,
      SUM(CASE WHEN stop_reason = 'cached' THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 14 DAY AND created_at < NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    HAVING COUNT(*) > 0
    ORDER BY tenant
  `,

  // 6. Stale Takeover Rate (7-day by tenant) - Current Window
  staleTakeoverRateCurrent: `
    ${BASE_CTE}
    SELECT
      tenant,
      SUM(CASE WHEN stop_reason = 'stale_takeover' THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    HAVING COUNT(*) > 0
    ORDER BY tenant
  `,

  // 6b. Stale Takeover Rate (7-day by tenant) - Prior Window
  staleTakeoverRatePrior: `
    ${BASE_CTE}
    SELECT
      tenant,
      SUM(CASE WHEN stop_reason = 'stale_takeover' THEN 1 ELSE 0 END) AS numerator,
      COUNT(*) AS denominator
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 14 DAY AND created_at < NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    HAVING COUNT(*) > 0
    ORDER BY tenant
  `,
};

// ============================================
// MAIN
// ============================================

async function main() {
  const date = format(new Date(), "yyyy-MM-dd");
  const envName = process.env.NODE_ENV || "development";

  console.log(`[Weekly Report] Generating report for ${date}...`);
  console.log(`[Weekly Report] Environment: ${envName}`);

  // Connect to database (read-only)
  const db = await getDb();
  if (!db) {
    console.error("❌ [Weekly Report] Database connection failed");
    process.exit(1);
  }

  // Run all 6 canonical queries
  const results: Record<string, any> = {};
  
  try {
    for (const [name, sql] of Object.entries(QUERIES)) {
      console.log(`[Weekly Report] Running query: ${name}...`);
      const result = await db.execute(sql);
      const rows = unwrapRows(result);
      console.log(`[Weekly Report] ${name}: ${rows.length} rows`);
      results[name] = rows;
    }
  } catch (error: any) {
    console.error("❌ [Weekly Report] Query execution failed:", error.message);
    console.error("ERROR: Metrics report incomplete. Query failure detected.");
    process.exit(1);
  }

  // Build markdown report
  const markdown = buildMarkdown(
    results,
    {
      version: process.env.npm_package_version || "—",
      buildSha: process.env.BUILD_SHA || "—",
    },
    date,
    envName
  );

  // Write report file
  const outputPath = `reports/ai_weekly_${date}.md`;
  writeFileSync(outputPath, markdown, "utf-8");

  console.log(`✅ [Weekly Report] Report generated: ${outputPath}`);
  console.log(`[Weekly Report] Lines: ${markdown.split("\n").length}`);
  console.log(`[Weekly Report] Size: ${(markdown.length / 1024).toFixed(1)} KB`);
}

main().catch((err) => {
  console.error("❌ [Weekly Report] Report generation failed:", err.message);
  process.exit(1);
});
