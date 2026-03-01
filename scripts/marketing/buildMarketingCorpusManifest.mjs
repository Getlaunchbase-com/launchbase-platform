#!/usr/bin/env node
/**
 * Build a normalized corpus manifest from curated source lists.
 *
 * Input:
 *  - scripts/marketing/sources/marketing-sources.json
 * Output:
 *  - runs/marketing/corpus-manifest-<ts>.json
 */

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const inFile = path.join(root, "scripts", "marketing", "sources", "marketing-sources.json");
const outDir = path.join(root, "runs", "marketing");
fs.mkdirSync(outDir, { recursive: true });

if (!fs.existsSync(inFile)) {
  console.error(`Missing source file: ${inFile}`);
  process.exit(1);
}

const raw = JSON.parse(fs.readFileSync(inFile, "utf8"));
const now = new Date().toISOString();

const rows = (Array.isArray(raw?.sources) ? raw.sources : []).map((s, i) => ({
  id: s.id ?? `src-${i + 1}`,
  source_url: String(s.source_url ?? "").trim(),
  license_type: String(s.license_type ?? "unknown").trim(),
  vertical: String(s.vertical ?? "general").trim(),
  segment: String(s.segment ?? "all").trim(),
  channel: String(s.channel ?? "multi").trim(),
  intent_stage: String(s.intent_stage ?? "mixed").trim(),
  content_type: String(s.content_type ?? "principle").trim(),
  priority: Number(s.priority ?? 50),
  notes: String(s.notes ?? "").trim(),
  ingested_at: now,
}));

const invalid = rows.filter((r) => !r.source_url || r.license_type === "unknown");
const valid = rows.filter((r) => r.source_url && r.license_type !== "unknown");

const manifest = {
  generatedAt: now,
  inputFile: inFile,
  totals: {
    all: rows.length,
    valid: valid.length,
    invalid: invalid.length,
  },
  invalid,
  valid,
};

const outFile = path.join(outDir, `corpus-manifest-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2), "utf8");
console.log(outFile);
