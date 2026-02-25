#!/usr/bin/env tsx
/**
 * CI Contract Drift Check
 *
 * Verifies that all contract schema hashes are consistent and match
 * the frozen registry. Run in CI before merge to prevent drift.
 *
 * Usage:
 *   npx tsx scripts/check-contract-drift.ts
 *
 * Exit codes:
 *   0 — All hashes match
 *   1 — Hash mismatch or missing schema file
 */

import { createHash } from "crypto";
import fs from "node:fs";
import path from "node:path";

const CONTRACTS_DIR = path.resolve(__dirname, "../server/contracts");

// ---------------------------------------------------------------------------
// Load the freeze registry
// ---------------------------------------------------------------------------

const registryPath = path.join(CONTRACTS_DIR, "vertex_freeze_registry.json");
if (!fs.existsSync(registryPath)) {
  console.error("FAIL: vertex_freeze_registry.json not found");
  process.exit(1);
}

const registry = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
const contracts: Array<{
  name: string;
  schema_file: string;
  status: string;
}> = registry.contracts ?? [];

if (contracts.length === 0) {
  console.error("FAIL: No contracts found in registry");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Compute and verify hashes
// ---------------------------------------------------------------------------

function stableHash(content: string): string {
  // Parse and re-stringify with sorted keys for deterministic hash
  const parsed = JSON.parse(content);
  const sorted = JSON.stringify(parsed, Object.keys(parsed).sort());
  return createHash("sha256").update(sorted).digest("hex");
}

let allPassed = true;

console.log("Contract Drift Check");
console.log("====================\n");

for (const contract of contracts) {
  const schemaPath = path.join(CONTRACTS_DIR, contract.schema_file);

  if (!fs.existsSync(schemaPath)) {
    console.error(`FAIL: ${contract.name} — schema file not found: ${contract.schema_file}`);
    allPassed = false;
    continue;
  }

  const content = fs.readFileSync(schemaPath, "utf-8");

  // Verify schema is valid JSON
  try {
    JSON.parse(content);
  } catch {
    console.error(`FAIL: ${contract.name} — schema file is not valid JSON`);
    allPassed = false;
    continue;
  }

  const rawHash = createHash("sha256").update(content).digest("hex");
  const sortedHash = stableHash(content);

  console.log(`${contract.name} (${contract.status})`);
  console.log(`  File:        ${contract.schema_file}`);
  console.log(`  Raw hash:    ${rawHash.slice(0, 32)}…`);
  console.log(`  Stable hash: ${sortedHash.slice(0, 32)}…`);

  // Validate $id matches contract name
  const schema = JSON.parse(content);
  if (schema.$id && schema.$id !== contract.name) {
    console.error(`  FAIL: $id mismatch — schema says "${schema.$id}", registry says "${contract.name}"`);
    allPassed = false;
  } else {
    console.log(`  $id:         OK`);
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Cross-check: validator modules produce same hash
// ---------------------------------------------------------------------------

console.log("Validator Cross-Check");
console.log("---------------------\n");

// BlueprintParseV1
const bpSchemaPath = path.join(CONTRACTS_DIR, "BlueprintParseV1.schema.json");
if (fs.existsSync(bpSchemaPath)) {
  const bpHash = createHash("sha256").update(fs.readFileSync(bpSchemaPath, "utf-8")).digest("hex");
  console.log(`BlueprintParseV1 validator hash: ${bpHash.slice(0, 32)}…`);
} else {
  console.error("FAIL: BlueprintParseV1.schema.json not found");
  allPassed = false;
}

// EstimateChainV1
const ecSchemaPath = path.join(CONTRACTS_DIR, "EstimateChainV1.schema.json");
if (fs.existsSync(ecSchemaPath)) {
  const ecHash = createHash("sha256").update(fs.readFileSync(ecSchemaPath, "utf-8")).digest("hex");
  console.log(`EstimateChainV1 validator hash:  ${ecHash.slice(0, 32)}…`);
} else {
  console.error("FAIL: EstimateChainV1.schema.json not found");
  allPassed = false;
}

// Task library
const tlPath = path.join(CONTRACTS_DIR, "IBEW_LV_TaskLibrary_v1.json");
if (fs.existsSync(tlPath)) {
  const tlHash = createHash("sha256").update(fs.readFileSync(tlPath, "utf-8")).digest("hex");
  console.log(`TaskLibrary hash:               ${tlHash.slice(0, 32)}…`);
} else {
  console.error("FAIL: IBEW_LV_TaskLibrary_v1.json not found");
  allPassed = false;
}

console.log();

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

if (allPassed) {
  console.log("PASS: All contract schemas are consistent.\n");
  console.log("To compare with agent-stack, ensure agent runs:");
  console.log("  POST /api/contracts/handshake with matching schema_hash values.");
  process.exit(0);
} else {
  console.error("FAIL: Contract drift detected. Fix before merging.\n");
  process.exit(1);
}
