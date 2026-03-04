#!/usr/bin/env npx tsx
/**
 * Training Data Export Script
 *
 * Exports voted shadow responses from the database as JSON Lines format
 * suitable for Vertex AI fine-tuning.
 *
 * Usage:
 *   npx tsx scripts/export-training-data.ts [--since YYYY-MM-DD] [--output path]
 *
 * Output format (JSON Lines):
 *   {"instruction": "...", "input": "...", "output": "..."}
 *
 * Cron (nightly at 2:10 AM UTC):
 *   10 2 * * * cd /home/info/launchbase-platform-publish && npx tsx scripts/export-training-data.ts --output /tmp/training-export.jsonl
 */

import { getDb } from "../server/db";
import { exportTrainingData, enrichTrainingInput, getTrainingStats } from "../server/services/trainingCollector";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const args = process.argv.slice(2);
  let sinceDate: string | undefined;
  let outputPath = `/tmp/launchbase-training-${new Date().toISOString().slice(0, 10)}.jsonl`;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--since" && args[i + 1]) {
      sinceDate = args[i + 1];
      i++;
    }
    if (args[i] === "--output" && args[i + 1]) {
      outputPath = args[i + 1];
      i++;
    }
  }

  console.log("[export] Starting training data export...");
  if (sinceDate) console.log(`[export] Since: ${sinceDate}`);

  // Get stats first
  const stats = await getTrainingStats();
  console.log("[export] Training stats:", stats);

  if (stats.votedPairs === 0) {
    console.log("[export] No voted pairs to export. Exiting.");
    process.exit(0);
  }

  // Export data
  const rawData = await exportTrainingData(1000, sinceDate);
  console.log(`[export] Exported ${rawData.length} raw training examples`);

  if (rawData.length === 0) {
    console.log("[export] No data to export. Exiting.");
    process.exit(0);
  }

  // Enrich with user messages
  const enrichedData = await enrichTrainingInput(rawData);
  console.log(`[export] Enriched ${enrichedData.length} examples`);

  // Write JSON Lines
  const lines = enrichedData.map((item) => JSON.stringify(item)).join("\n");
  fs.writeFileSync(outputPath, lines + "\n", "utf8");
  console.log(`[export] Written to ${outputPath} (${enrichedData.length} lines, ${Buffer.byteLength(lines)} bytes)`);

  // Summary
  console.log("[export] Export complete!");
  console.log(`[export] Total pairs: ${stats.totalPairs}`);
  console.log(`[export] Voted pairs: ${stats.votedPairs}`);
  console.log(`[export] Shadow preferred: ${stats.shadowPreferred}`);
  console.log(`[export] Primary preferred: ${stats.primaryPreferred}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("[export] Fatal error:", err);
  process.exit(1);
});
