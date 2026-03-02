#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const RUNS = path.join(ROOT, "runs", "marketing");
const AGENT_RUNS = process.env.AGENT_RUNS_ROOT || "C:\\Users\\Monica Morreale\\agent-runs";

function latestDir(base, startsWith) {
  if (!fs.existsSync(base)) return "";
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name.startsWith(startsWith))
    .map((d) => {
      const p = path.join(base, d.name);
      return { p, m: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.m - a.m)[0]?.p ?? "";
}

function latestFile(base, rx) {
  if (!fs.existsSync(base)) return "";
  return fs
    .readdirSync(base)
    .filter((f) => rx.test(f))
    .map((f) => {
      const p = path.join(base, f);
      return { p, m: fs.statSync(p).mtimeMs };
    })
    .sort((a, b) => b.m - a.m)[0]?.p ?? "";
}

function readIf(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

function toParagraphs(text, min = 90, max = 900) {
  return String(text)
    .split(/\n{2,}/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= min)
    .map((s) => (s.length > max ? `${s.slice(0, max)}...` : s));
}

function writeJsonl(file, rows) {
  const lines = rows.map((r) => JSON.stringify(r));
  fs.writeFileSync(file, lines.join("\n"), "utf8");
}

function main() {
  fs.mkdirSync(RUNS, { recursive: true });
  const ts = Date.now();
  const outDir = path.join(RUNS, `fine-tune-pack-${ts}`);
  fs.mkdirSync(outDir, { recursive: true });

  const latestDaily = latestDir(AGENT_RUNS, "daily-orchestrator-");
  const latestCritique = latestDir(path.join(AGENT_RUNS, "model-critique-loop"), "");
  const claudeDir = latestDaily ? path.join(latestDaily, "claude") : "";
  const geminiReview = latestDaily ? path.join(latestDaily, "gemini", "gemini-review.md") : "";

  const claudeFiles = listFilesRecursive(claudeDir).filter((p) => p.endsWith(".md") || p.endsWith(".txt"));
  const corpora = [
    ...claudeFiles.map((p) => ({ source: p, text: readIf(p) })),
    { source: geminiReview, text: readIf(geminiReview) },
    { source: latestFile(path.join(ROOT, "runs", "ops"), /^swarm-unified-\d+\.md$/), text: readIf(latestFile(path.join(ROOT, "runs", "ops"), /^swarm-unified-\d+\.md$/)) },
    { source: latestFile(path.join(ROOT, "runs", "marketing"), /^swarm-improve-\d+\.md$/), text: readIf(latestFile(path.join(ROOT, "runs", "marketing"), /^swarm-improve-\d+\.md$/)) },
  ].filter((x) => x.text);

  const sft = [];
  for (const c of corpora) {
    const paras = toParagraphs(c.text);
    for (const p of paras.slice(0, 40)) {
      sft.push({
        instruction: "Produce an actionable, compliance-safe marketing execution response for LaunchBase IBEW 134 context.",
        input: `Source: ${path.basename(c.source)}\nTask: Convert this planning context into concrete next steps.`,
        output: p,
        meta: { source: c.source, vertical: "ibew-134", quality: "reviewed_swarm_output" },
      });
    }
  }

  const r2c = readIf(path.join(latestCritique, "round2-codex.txt"));
  const r2a = readIf(path.join(latestCritique, "round2-claude.txt"));
  const r1g = readIf(path.join(latestCritique, "round1-gemini.txt"));
  const pref = [];
  if (r2c && r1g) {
    pref.push({
      prompt: "Generate next-day LaunchBase marketing execution order.",
      chosen: toParagraphs(r2c, 120, 1200)[0] || r2c.slice(0, 1200),
      rejected: toParagraphs(r1g, 120, 1200)[0] || r1g.slice(0, 1200),
      rationale: "Chosen response is more execution-concrete and aligned to operator constraints.",
      meta: { source: "swarm_critique", chosen_model: "codex", rejected_model: "gemini" },
    });
  }
  if (r2a && r1g) {
    pref.push({
      prompt: "Identify what we are doing wrong and how to improve quickly.",
      chosen: toParagraphs(r2a, 120, 1200)[0] || r2a.slice(0, 1200),
      rejected: toParagraphs(r1g, 120, 1200)[0] || r1g.slice(0, 1200),
      rationale: "Chosen response has stronger risk controls and clearer improvement sequencing.",
      meta: { source: "swarm_critique", chosen_model: "claude", rejected_model: "gemini" },
    });
  }

  const evalSet = [
    "Generate a 7-day grassroots plan for IBEW 134 outreach with measurable KPIs.",
    "Write a compliant follow-up email sequence for a new contractor lead.",
    "Propose channel mix adjustments given low response on paid campaigns.",
    "Identify top 5 anti-patterns in current marketing loop and fixes.",
    "Create a low-cost local union-focused referral campaign with stop-loss thresholds.",
    "Summarize yesterday's run outcomes and define today's execution plan.",
    "Draft A/B test hypotheses for creative and offer variants.",
    "Convert swarm critique insights into executable tasks with ownership and deadlines.",
    "Design a sandbox experiment and promotion gate for model updates.",
    "Produce a risk register for outreach by channel and mitigation actions.",
  ].map((prompt, i) => ({
    id: `eval-${String(i + 1).padStart(3, "0")}`,
    prompt,
    rubric: {
      relevance: "0-5",
      actionability: "0-5",
      compliance: "0-5",
      measurable_kpis: "0-5",
    },
  }));

  const sftPath = path.join(outDir, "sft_marketing_examples.jsonl");
  const prefPath = path.join(outDir, "preference_pairs.jsonl");
  const evalPath = path.join(outDir, "eval_set.jsonl");
  writeJsonl(sftPath, sft);
  writeJsonl(prefPath, pref);
  writeJsonl(evalPath, evalSet);

  const manifest = {
    createdAt: new Date().toISOString(),
    outDir,
    counts: { sft: sft.length, preference_pairs: pref.length, eval: evalSet.length },
    sources: corpora.map((c) => c.source),
    notes: [
      "Auto-generated from latest swarm/orchestrator artifacts.",
      "Review before training; remove low-quality or sensitive entries.",
      "Intended for Vertex adapter/fine-tune staging.",
    ],
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(outDir);
  console.log(JSON.stringify(manifest.counts));
}

main();

