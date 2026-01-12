import { getDb } from '../server/db';

async function main() {
  const db = await getDb();

  console.log('🔍 Validating Metrics Queries Against Real Data\n');
  console.log('═══════════════════════════════════════════════\n');

  // Query 1: stopReason Distribution (24-Hour Overall)
  console.log('📊 Query 1: stopReason Distribution (24-Hour Overall)');
  console.log('─────────────────────────────────────────────────\n');

  const query1 = `
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
    SELECT
      stop_reason,
      COUNT(*) AS n
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 24 HOUR
    GROUP BY stop_reason
    ORDER BY n DESC;
  `;

  const result1 = await db.execute(query1);
  console.log('Result:', JSON.stringify(result1[0], null, 2));
  console.log('\n');

  // Query 2: needsHuman Rate (24-Hour Overall)
  console.log('📊 Query 2: needsHuman Rate (24-Hour Overall)');
  console.log('─────────────────────────────────────────────────\n');

  const query2 = `
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
    SELECT
      SUM(needs_human) AS needs_human_count,
      COUNT(*) AS total,
      ROUND(100.0 * SUM(needs_human) / COUNT(*), 2) AS needs_human_rate
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 24 HOUR;
  `;

  const result2 = await db.execute(query2);
  console.log('Result:', JSON.stringify(result2[0], null, 2));
  console.log('\n');

  // Query 3: Cost per Approval (24-Hour Overall)
  console.log('📊 Query 3: Cost per Approval (24-Hour Overall)');
  console.log('─────────────────────────────────────────────────\n');

  const query3 = `
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
    SELECT
      COUNT(*) AS approved_count,
      SUM(cost_usd) AS total_cost,
      ROUND(SUM(cost_usd) / COUNT(*), 4) AS cost_per_approval
    FROM ai_proposals
    WHERE
      created_at >= NOW() - INTERVAL 24 HOUR
      AND status IN ('applied', 'confirmed', 'locked');
  `;

  const result3 = await db.execute(query3);
  console.log('Result:', JSON.stringify(result3[0], null, 2));
  console.log('\n');

  // Query 4: Approval Rate (24-Hour Overall)
  console.log('📊 Query 4: Approval Rate (24-Hour Overall)');
  console.log('─────────────────────────────────────────────────\n');

  const query4 = `
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
    SELECT
      SUM(CASE WHEN status IN ('applied', 'confirmed', 'locked') THEN 1 ELSE 0 END) AS approved_count,
      COUNT(*) AS total,
      ROUND(100.0 * SUM(CASE WHEN status IN ('applied', 'confirmed', 'locked') THEN 1 ELSE 0 END) / COUNT(*), 2) AS approval_rate
    FROM ai_proposals
    WHERE created_at >= NOW() - INTERVAL 24 HOUR;
  `;

  const result4 = await db.execute(query4);
  console.log('Result:', JSON.stringify(result4[0], null, 2));
  console.log('\n');

  // Verify rawInbound structure for each scenario
  console.log('🔍 Verifying rawInbound Structure for Each Scenario');
  console.log('─────────────────────────────────────────────────\n');

  const verifyQuery = `
    SELECT
      ar.id,
      JSON_UNQUOTE(JSON_EXTRACT(ar.rawInbound, '$.aiTennis.stopReason')) AS stop_reason,
      ar.rawInbound
    FROM action_requests ar
    WHERE ar.id IN (10, 11, 12)
    ORDER BY ar.id;
  `;

  const verifyResult = await db.execute(verifyQuery);
  const rows = verifyResult[0] as any[];

  for (const row of rows) {
    console.log(`\n📋 ActionRequest ID: ${row.id}`);
    console.log(`   stopReason: ${row.stop_reason}`);
    console.log(`   rawInbound:`, JSON.stringify(row.rawInbound, null, 2));
  }

  console.log('\n\n✅ Validation Complete!\n');
}

main().catch(console.error);
