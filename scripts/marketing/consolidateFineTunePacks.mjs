#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const RUNS = path.join(ROOT, "runs", "marketing");
const OUT = path.join(RUNS, "master-dataset");
fs.mkdirSync(OUT, { recursive: true });

function readJsonl(file) {
  try {
    return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

function writeJsonl(file, rows) {
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n"), "utf8");
}

function hashPair(row) {
  const key = `${row.instruction || ""}|||${row.input || ""}|||${(row.output || "").slice(0, 200)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function hashPref(row) {
  const key = `${row.prompt || ""}|||${(row.chosen || "").slice(0, 200)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function scoreTvs(text, source) {
  const t = String(text || "").toLowerCase();
  const s = String(source || "").toLowerCase();
  let score = 0;
  score += /kpi|conversion|roi|revenue|ctr|cpa|lift/.test(t) ? 23 : 10;
  score += /case|benchmark|result|data|measured|evidence/.test(t) ? 17 : 8;
  score += /step|checklist|execute|experiment|plan|workflow/.test(t) ? 13 : 6;
  score += /ibew|contractor|union|smb|local/.test(t) ? 14 : 7;
  score += /source:|round|reviewer|swarm/.test(t) ? 8 : 4;
  score += /compliance|risk|rollback|stop-loss|guardrail/.test(t) ? 9 : 5;
  score += s ? 5 : 0;
  return clamp(score, 0, 100);
}

function tierFor(tvs) {
  if (tvs >= 85) return "A";
  if (tvs >= 75) return "B";
  return "C";
}

// Find all fine-tune-pack directories
const packs = fs.readdirSync(RUNS, { withFileTypes: true })
  .filter((d) => d.isDirectory() && d.name.startsWith("fine-tune-pack-"))
  .map((d) => path.join(RUNS, d.name))
  .sort();

console.log(`Found ${packs.length} fine-tune packs`);

// Consolidate SFT
const sftSeen = new Set();
const allSft = [];
let sftDupes = 0;
let sftSkippedC = 0;

for (const pack of packs) {
  const rows = readJsonl(path.join(pack, "sft_marketing_examples.jsonl"));
  for (const row of rows) {
    const h = hashPair(row);
    if (sftSeen.has(h)) { sftDupes++; continue; }
    // Skip C-tier examples
    if (row.meta?.tier === "C") { sftSkippedC++; continue; }
    sftSeen.add(h);
    // Re-score TVS for all records (older packs may lack this field)
    row.meta = row.meta || {};
    const tvs = scoreTvs(row.output, row.meta.source || "");
    row.meta.tvs = tvs;
    row.meta.tier = tierFor(tvs);
    // Skip C-tier after re-scoring
    if (row.meta.tier === "C") { sftSkippedC++; continue; }
    row.meta.target_id = `tgt-${String(allSft.length + 1).padStart(5, "0")}`;
    row.meta.consolidated_at = new Date().toISOString();
    row.meta.source_pack = path.basename(pack);
    allSft.push(row);
  }
}

// Consolidate preference pairs
const prefSeen = new Set();
const allPref = [];
let prefDupes = 0;

for (const pack of packs) {
  const rows = readJsonl(path.join(pack, "preference_pairs.jsonl"));
  for (const row of rows) {
    const h = hashPref(row);
    if (prefSeen.has(h)) { prefDupes++; continue; }
    prefSeen.add(h);
    row.meta = row.meta || {};
    row.meta.consolidated_at = new Date().toISOString();
    row.meta.source_pack = path.basename(pack);
    allPref.push(row);
  }
}

// Consolidate eval set (take union by prompt text)
const evalSeen = new Set();
const allEval = [];

for (const pack of packs) {
  const rows = readJsonl(path.join(pack, "eval_set.jsonl"));
  for (const row of rows) {
    if (evalSeen.has(row.prompt)) continue;
    evalSeen.add(row.prompt);
    allEval.push(row);
  }
}

// Compute quality stats
const tvsScores = allSft.map((r) => r.meta?.tvs ?? 0);
const avgTvs = tvsScores.length ? (tvsScores.reduce((a, b) => a + b, 0) / tvsScores.length).toFixed(1) : 0;
const tierA = allSft.filter((r) => r.meta?.tier === "A").length;
const tierB = allSft.filter((r) => r.meta?.tier === "B").length;
const tierAPct = allSft.length ? ((tierA / allSft.length) * 100).toFixed(1) : 0;

// Write outputs
writeJsonl(path.join(OUT, "master_sft.jsonl"), allSft);
writeJsonl(path.join(OUT, "master_preference.jsonl"), allPref);
writeJsonl(path.join(OUT, "master_eval.jsonl"), allEval);

const manifest = {
  consolidatedAt: new Date().toISOString(),
  packsProcessed: packs.length,
  counts: {
    sft: allSft.length,
    sftDuplicatesRemoved: sftDupes,
    sftCTierSkipped: sftSkippedC,
    preference: allPref.length,
    preferenceDuplicatesRemoved: prefDupes,
    eval: allEval.length,
  },
  quality: {
    avgTvs: Number(avgTvs),
    tierA,
    tierB,
    tierAPct: Number(tierAPct),
  },
  outputDir: OUT,
};

fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

console.log(`\nConsolidation complete:`);
console.log(`  SFT examples:     ${allSft.length} (${sftDupes} dupes removed, ${sftSkippedC} C-tier skipped)`);
console.log(`  Preference pairs:  ${allPref.length} (${prefDupes} dupes removed)`);
console.log(`  Eval prompts:      ${allEval.length}`);
console.log(`  Avg TVS:           ${avgTvs}`);
console.log(`  Tier A:            ${tierA} (${tierAPct}%)`);
console.log(`  Tier B:            ${tierB}`);
console.log(`  Output:            ${OUT}`);
