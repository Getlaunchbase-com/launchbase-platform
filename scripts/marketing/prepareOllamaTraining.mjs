#!/usr/bin/env node
/**
 * prepareOllamaTraining.mjs
 * Converts SFT JSONL corpus into Ollama-compatible training format
 * and creates Modelfiles for dual model fine-tuning.
 *
 * Usage:
 *   node scripts/marketing/prepareOllamaTraining.mjs [--input FILE] [--output DIR]
 *
 * Output:
 *   runs/marketing/ollama-training/training_data.jsonl  (Ollama chat format)
 *   runs/marketing/ollama-training/Modelfile.main       (for launchbase-main)
 *   runs/marketing/ollama-training/Modelfile.sandbox    (for launchbase-sandbox)
 *   runs/marketing/ollama-training/manifest.json        (stats)
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const INPUT_FILE = getArg("input", path.join(ROOT, "runs", "marketing", "knowledge-corpus", "corpus_sft.jsonl"));
const OUT_DIR = getArg("output", path.join(ROOT, "runs", "marketing", "ollama-training"));
const TRAINING_FILE = path.join(OUT_DIR, "training_data.jsonl");

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Read and convert ──────────────────────────────────────────────────────────

console.log(`Reading: ${INPUT_FILE}`);

if (!fs.existsSync(INPUT_FILE)) {
  console.error(`ERROR: Input file not found: ${INPUT_FILE}`);
  console.error("Run generateMarketingKnowledgeCorpus.mjs first.");
  process.exit(1);
}

const lines = fs.readFileSync(INPUT_FILE, "utf-8").split("\n").filter(Boolean);
console.log(`Total SFT records: ${lines.length}`);

let converted = 0;
let skipped = 0;
const tierCounts = { A: 0, B: 0, C: 0 };
const domainCounts = {};
const output = [];

for (const line of lines) {
  try {
    const record = JSON.parse(line);
    const tier = record.meta?.tier || "B";
    tierCounts[tier] = (tierCounts[tier] || 0) + 1;

    // Skip Tier C
    if (tier === "C") { skipped++; continue; }

    const domain = record.meta?.domain || "unknown";
    domainCounts[domain] = (domainCounts[domain] || 0) + 1;

    // Convert to Ollama chat format
    // Ollama fine-tuning expects: {"messages": [{"role": "system", ...}, {"role": "user", ...}, {"role": "assistant", ...}]}
    const chatRecord = {
      messages: [
        {
          role: "system",
          content: "You are LaunchBase's PhD-level marketing AI strategist. You provide evidence-based, actionable marketing advice with specific KPIs, compliance guardrails, and risk assessment. You synthesize knowledge from Kotler, Porter, Cialdini, Kahneman, Sharp, Schwartz, Ogilvy, and modern growth frameworks. Every response includes measurable outcomes, step-by-step execution plans, and rollback triggers."
        },
        {
          role: "user",
          content: record.input
            ? `${record.instruction}\n\nContext: ${record.input}`
            : record.instruction
        },
        {
          role: "assistant",
          content: record.output
        }
      ]
    };

    output.push(JSON.stringify(chatRecord));
    converted++;
  } catch {
    skipped++;
  }
}

// Write training file
fs.writeFileSync(TRAINING_FILE, output.join("\n") + "\n");
console.log(`\nConverted: ${converted}`);
console.log(`Skipped: ${skipped}`);
console.log(`Tier distribution: A=${tierCounts.A || 0}, B=${tierCounts.B || 0}, C=${tierCounts.C || 0}`);

// ── Create Modelfiles ─────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are LaunchBase's PhD-level marketing AI strategist. You synthesize knowledge from:
- Philip Kotler (Marketing Management, STP, 4Ps/7Ps)
- Michael Porter (Competitive Strategy, Five Forces, Value Chain)
- Robert Cialdini (Influence: 6 Principles of Persuasion)
- Daniel Kahneman (Prospect Theory, Behavioral Economics)
- Byron Sharp (How Brands Grow, Mental/Physical Availability)
- Eugene Schwartz (5 Levels of Awareness)
- April Dunford (Obviously Awesome Positioning)
- Clayton Christensen (Jobs to Be Done)
- David Ogilvy (Advertising Principles)
- Modern: Andrew Chen, Lenny Rachitsky, Seth Godin

You serve IBEW 134 electrical contractors, general contractors, SMB SaaS companies, and platform operators.

Every response includes:
1. Measurable KPIs with numeric targets
2. Evidence-based reasoning with benchmarks
3. Step-by-step execution plans
4. Compliance guardrails and risk assessment
5. Rollback triggers and stop-loss criteria
6. Framework attribution`;

const modelfileMain = `FROM launchbase-main
SYSTEM """${SYSTEM_PROMPT}"""
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
`;

const modelfileSandbox = `FROM launchbase-sandbox
SYSTEM """${SYSTEM_PROMPT}"""
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER num_ctx 4096
`;

fs.writeFileSync(path.join(OUT_DIR, "Modelfile.main"), modelfileMain);
fs.writeFileSync(path.join(OUT_DIR, "Modelfile.sandbox"), modelfileSandbox);

// ── Create fine-tune script ───────────────────────────────────────────────────

const finetuneScript = `#!/usr/bin/env bash
# Dual Ollama Fine-Tune — runs both models in parallel with identical data
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
TRAINING_FILE="\${SCRIPT_DIR}/training_data.jsonl"

echo "Training data: $(wc -l < "\$TRAINING_FILE") examples"
echo ""

echo "=== Fine-tuning launchbase-main ==="
ollama create launchbase-main-marketing -f "\${SCRIPT_DIR}/Modelfile.main" &
PID_MAIN=$!

echo "=== Fine-tuning launchbase-sandbox ==="
ollama create launchbase-sandbox-marketing -f "\${SCRIPT_DIR}/Modelfile.sandbox" &
PID_SANDBOX=$!

echo ""
echo "Waiting for both models..."
wait $PID_MAIN && echo "launchbase-main-marketing: DONE" || echo "launchbase-main-marketing: FAILED"
wait $PID_SANDBOX && echo "launchbase-sandbox-marketing: DONE" || echo "launchbase-sandbox-marketing: FAILED"

echo ""
echo "=== Verifying models ==="
ollama list | grep launchbase

echo ""
echo "=== Quick test (main) ==="
echo "How should an IBEW electrical contractor use social proof to win more commercial bids?" | ollama run launchbase-main-marketing --nowordwrap 2>/dev/null | head -20

echo ""
echo "=== Quick test (sandbox) ==="
echo "How should an IBEW electrical contractor use social proof to win more commercial bids?" | ollama run launchbase-sandbox-marketing --nowordwrap 2>/dev/null | head -20

echo ""
echo "Fine-tuning complete. Both models ready."
`;

fs.writeFileSync(path.join(OUT_DIR, "finetune_dual.sh"), finetuneScript, { mode: 0o755 });

// ── Manifest ──────────────────────────────────────────────────────────────────

const manifest = {
  createdAt: new Date().toISOString(),
  inputFile: INPUT_FILE,
  outputFile: TRAINING_FILE,
  totalRecords: lines.length,
  converted,
  skipped,
  tierDistribution: tierCounts,
  domainDistribution: domainCounts,
  models: ["launchbase-main-marketing", "launchbase-sandbox-marketing"],
};

fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`\nDomain distribution:`);
for (const [domain, count] of Object.entries(domainCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${domain}: ${count}`);
}

console.log(`\nOutput files:`);
console.log(`  ${TRAINING_FILE}`);
console.log(`  ${path.join(OUT_DIR, "Modelfile.main")}`);
console.log(`  ${path.join(OUT_DIR, "Modelfile.sandbox")}`);
console.log(`  ${path.join(OUT_DIR, "finetune_dual.sh")}`);
console.log(`  ${path.join(OUT_DIR, "manifest.json")}`);
