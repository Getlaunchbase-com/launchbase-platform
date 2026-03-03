#!/usr/bin/env node
/**
 * autoPromoteModel.mjs
 * Automated promotion gate for fine-tuned marketing model.
 * Compares candidate adapter against baseline on frozen eval set.
 * Promotes to main-8b-governed if quality improves, otherwise holds.
 *
 * Usage:
 *   node scripts/marketing/autoPromoteModel.mjs [--dry-run]
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const PROJECT = "engaged-style-456320-t4";
const BUCKET = "gs://lb-ai-models-engaged-style-456320-t4-us";
const ROOT = process.cwd();
const RUNS_DIR = path.join(ROOT, "runs", "marketing", "promotions");
fs.mkdirSync(RUNS_DIR, { recursive: true });

const DRY_RUN = process.argv.includes("--dry-run");

function gcloud(cmd) {
  try {
    return execSync(`gcloud ${cmd}`, { encoding: "utf8", timeout: 30_000 }).trim();
  } catch (e) {
    console.error(`  gcloud error: ${e.message?.slice(0, 200)}`);
    return "";
  }
}

function main() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  console.log("=== Marketing Model Promotion Gate ===");
  console.log(`  Time:    ${ts}`);
  console.log(`  Mode:    ${DRY_RUN ? "DRY-RUN" : "LIVE"}`);
  console.log("");

  // Step 1: Check if candidate adapter exists
  console.log("[1/4] Checking candidate adapter...");
  const candidateCheck = gcloud(`storage ls ${BUCKET}/adapters/marketing-v1/ 2>&1`);
  if (!candidateCheck || candidateCheck.includes("matched no objects")) {
    console.log("  No candidate adapter found. Nothing to promote.");
    process.exit(0);
  }
  console.log("  Candidate adapter found.");

  // Step 2: Check latest eval results
  console.log("[2/4] Checking eval results...");
  const evalResults = gcloud(`storage ls ${BUCKET}/metadata/training-runs/ 2>&1`);

  // Step 3: Read current baseline manifest
  console.log("[3/4] Reading baseline manifest...");
  let baselineVersion = "v1";
  try {
    const manifest = gcloud(`storage cat ${BUCKET}/main-8b-governed/manifests/model.manifest.json 2>&1`);
    const parsed = JSON.parse(manifest);
    baselineVersion = parsed.version || "v1";
    console.log(`  Baseline: ${parsed.lane} ${parsed.model_family} ${baselineVersion}`);
  } catch {
    console.log("  Could not read baseline manifest, using defaults.");
  }

  // Step 4: Make promotion decision
  console.log("[4/4] Making promotion decision...");

  // For now, create a "hold" decision requiring manual review
  // Once eval scoring is automated, this will auto-promote
  const decision = {
    decisionId: `promo-${ts}`,
    timestamp: new Date().toISOString(),
    candidateVersion: "marketing-v1",
    baselineVersion,
    decision: "hold",
    reason: "Awaiting automated eval scoring. Manual review required for first promotion.",
    metrics: {
      qualityDelta: null,
      complianceCriticalCount: 0,
      costDeltaUsd: null,
      winRate: null,
    },
    approvedBy: "auto-promote-gate",
    promotionRules: {
      minQualityDelta: 0.05,
      maxComplianceCritical: 0,
      requiredEvalPass: true,
    },
  };

  const decisionPath = path.join(RUNS_DIR, `promotion-${ts}.json`);
  fs.writeFileSync(decisionPath, JSON.stringify(decision, null, 2), "utf8");
  console.log(`  Decision: ${decision.decision}`);
  console.log(`  Reason: ${decision.reason}`);
  console.log(`  Saved: ${decisionPath}`);

  // Upload to GCS
  if (!DRY_RUN) {
    const gcsPath = `${BUCKET}/metadata/promotion/promotion-${ts}.json`;
    try {
      execSync(`gcloud storage cp "${decisionPath}" "${gcsPath}"`, { encoding: "utf8", timeout: 30_000 });
      console.log(`  Uploaded: ${gcsPath}`);
    } catch (e) {
      console.error(`  Upload error: ${e.message?.slice(0, 100)}`);
    }
  }

  console.log("\n=== Promotion gate complete ===");
  if (decision.decision === "promote") {
    console.log("ACTION: Adapter promoted to main-8b-governed.");
  } else {
    console.log("ACTION: Adapter held in sandbox. Manual review or next eval cycle will re-evaluate.");
  }
}

main();
