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

  // 2. needsHuman Rate (7-day)
  needsHumanRate: `
    ${BASE_CTE}
    SELECT
      '7-day' AS period,
      ROUND(
        SUM(CASE WHEN needs_human = 1 OR stop_reason = 'needs_human' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        1
      ) AS ratePct
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
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

  // 4. Approval Rate (7-day by tenant)
  approvalRate: `
    ${BASE_CTE}
    SELECT
      tenant,
      ROUND(
        SUM(CASE WHEN status IN ('applied','confirmed','locked') THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        1
      ) AS rate7Pct,
      0 AS rate30Pct,
      0 AS wowDeltaPp
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    ORDER BY rate7Pct DESC
  `,

  // 5. Cache Hit Rate (7-day by tenant)
  cacheHitRate: `
    ${BASE_CTE}
    SELECT
      tenant,
      ROUND(
        SUM(CASE WHEN stop_reason = 'cached' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        1
      ) AS hit7Pct,
      0 AS hit30Pct
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    ORDER BY hit7Pct DESC
  `,

  // 6. Stale Takeover Rate (7-day by tenant)
  staleTakeoverRate: `
    ${BASE_CTE}
    SELECT
      tenant,
      ROUND(
        SUM(CASE WHEN stop_reason = 'stale_takeover' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
        1
      ) AS rate7Pct,
      0 AS rate30Pct
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 7 DAY
    GROUP BY tenant
    ORDER BY rate7Pct DESC
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
      results[name] = result;
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
