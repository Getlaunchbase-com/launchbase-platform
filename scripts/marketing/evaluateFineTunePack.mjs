#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RUNS = path.join(ROOT, "runs", "marketing");
const outDir = path.join(RUNS, "gates");
fs.mkdirSync(outDir, { recursive: true });

function latestDir(base, prefix) {
  if (!fs.existsSync(base)) return "";
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(prefix))
    .map((d) => ({ p: path.join(base, d.name), m: fs.statSync(path.join(base, d.name)).mtimeMs }))
    .sort((a, b) => b.m - a.m)[0]?.p ?? "";
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function jsonlCount(file) {
  try {
    const t = fs.readFileSync(file, "utf8");
    return t.split(/\r?\n/).filter(Boolean).length;
  } catch {
    return 0;
  }
}

const pack = latestDir(RUNS, "fine-tune-pack-");
if (!pack) {
  console.error("No fine-tune-pack found");
  process.exit(1);
}

const manifest = readJson(path.join(pack, "manifest.json")) ?? {};
const sft = jsonlCount(path.join(pack, "sft_marketing_examples.jsonl"));
const pref = jsonlCount(path.join(pack, "preference_pairs.jsonl"));
const evalRows = jsonlCount(path.join(pack, "eval_set.jsonl"));

const rules = {
  minSft: Number(process.env.GATE_MIN_SFT ?? 100),
  minPref: Number(process.env.GATE_MIN_PREF ?? 50),
  minEval: Number(process.env.GATE_MIN_EVAL ?? 50),
  minTvsAvg: Number(process.env.GATE_MIN_TVS_AVG ?? 80),
  minTierAPct: Number(process.env.GATE_TIER_A_PCT ?? 30),
};

// Compute TVS stats from SFT file
let tvsAvg = 0;
let tierAPct = 0;
try {
  const sftLines = fs.readFileSync(path.join(pack, "sft_marketing_examples.jsonl"), "utf8")
    .split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
  const scores = sftLines.map((r) => r.meta?.tvs ?? 0);
  tvsAvg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const tierACount = sftLines.filter((r) => r.meta?.tier === "A").length;
  tierAPct = sftLines.length ? (tierACount / sftLines.length) * 100 : 0;
} catch { /* SFT file missing or malformed */ }

const passVolume = sft >= rules.minSft && pref >= rules.minPref && evalRows >= rules.minEval;
const passQuality = tvsAvg >= rules.minTvsAvg && tierAPct >= rules.minTierAPct;
const pass = passVolume && passQuality;
const result = {
  createdAt: new Date().toISOString(),
  pack,
  manifest,
  counts: { sft, pref, eval: evalRows },
  quality: { tvsAvg: Math.round(tvsAvg * 10) / 10, tierAPct: Math.round(tierAPct * 10) / 10 },
  rules,
  passVolume,
  passQuality,
  pass,
  classification: pass ? "done" : `blocked(${!passVolume ? "volume" : "quality"})`,
};

const outFile = path.join(outDir, `fine-tune-gate-${Date.now()}.json`);
fs.writeFileSync(outFile, JSON.stringify(result, null, 2), "utf8");
console.log(outFile);
if (!pass) process.exit(2);
