#!/usr/bin/env node
/**
 * generateSyntheticScenarios.mjs
 * Bulk-generates high-quality SFT training pairs for the marketing 8B model.
 * Uses Claude CLI to generate edge-case SMB marketing scenarios with gold-standard responses.
 *
 * Usage:
 *   node scripts/marketing/generateSyntheticScenarios.mjs [--count 1000] [--vertical all] [--batch 10]
 *
 * Output: Appends to runs/marketing/master-dataset/master_sft.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync, execFileSync, spawnSync, spawn } from "node:child_process";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "runs", "marketing", "master-dataset");
const OUT_FILE = path.join(OUT_DIR, "synthetic_sft.jsonl");
fs.mkdirSync(OUT_DIR, { recursive: true });

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

const TOTAL = Number(getArg("count", "250"));
const VERTICAL = getArg("vertical", "all");
const BATCH_SIZE = Number(getArg("batch", "10"));

const VERTICALS = {
  "quickbooks-integration": {
    label: "QuickBooks Integration",
    scenarios: [
      "sync error troubleshooting", "migration from Desktop to Online", "multi-entity reporting",
      "invoice automation", "expense categorization", "bank feed reconciliation",
      "payroll integration", "tax preparation workflow", "app marketplace listing optimization",
      "ProAdvisor partner outreach", "API rate limit handling", "data backup strategy",
      "custom report building", "class and location tracking", "journal entry automation",
      "accounts receivable aging alerts", "vendor payment automation", "budget vs actual reporting",
      "time tracking integration", "inventory sync with e-commerce",
    ],
  },
  "small-business-websites": {
    label: "SMB Website Marketing",
    scenarios: [
      "local SEO for new business", "landing page optimization", "Google Ads on $200 budget",
      "social media content calendar", "email list building from scratch", "review generation campaign",
      "mobile-first redesign", "competitive analysis framework", "referral program design",
      "content marketing for service business", "retargeting strategy on small budget",
      "Google Business Profile optimization", "website speed optimization", "conversion rate audit",
      "local citation building", "blog content strategy for lead generation", "video marketing plan",
      "seasonal promotion planning", "customer testimonial strategy", "multi-location SEO",
    ],
  },
  "workflow-automation": {
    label: "Workflow Automation",
    scenarios: [
      "lead nurture email sequence", "CRM auto-assignment rules", "invoice reminder automation",
      "customer feedback collection loop", "employee onboarding checklist", "social media scheduling",
      "lead scoring model", "appointment booking flow", "follow-up task automation",
      "document approval workflow", "customer re-engagement campaign", "support ticket routing",
      "weekly report generation", "contract renewal reminders", "referral tracking automation",
      "inventory reorder alerts", "project milestone notifications", "client communication templates",
      "data entry validation", "cross-platform sync workflows",
    ],
  },
  "agents-apps-automation": {
    label: "AI Agents & Apps",
    scenarios: [
      "marketing agent evaluation framework", "model A/B testing design", "swarm critique analysis",
      "anti-pattern detection in campaigns", "automated promotion gates", "risk register creation",
      "cost optimization for AI agents", "content quality scoring pipeline", "feedback loop design",
      "multi-agent orchestration", "sandbox experiment protocol", "model fine-tuning data quality",
      "agent performance dashboards", "compliance monitoring automation", "campaign result attribution",
      "predictive budget allocation", "creative variant generation", "audience segmentation automation",
      "real-time bidding strategy", "cross-channel attribution modeling",
    ],
  },
};

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function scoreTvs(text, source) {
  const t = String(text || "").toLowerCase();
  let score = 0;
  score += /kpi|conversion|roi|revenue|ctr|cpa|lift/.test(t) ? 23 : 10;
  score += /case|benchmark|result|data|measured|evidence/.test(t) ? 17 : 8;
  score += /step|checklist|execute|experiment|plan|workflow/.test(t) ? 13 : 6;
  score += /ibew|contractor|union|smb|local/.test(t) ? 14 : 7;
  score += /source:|round|reviewer|swarm/.test(t) ? 8 : 4;
  score += /compliance|risk|rollback|stop-loss|guardrail/.test(t) ? 9 : 5;
  score += source ? 5 : 0;
  return clamp(score, 0, 100);
}

function tierFor(tvs) {
  if (tvs >= 85) return "A";
  if (tvs >= 75) return "B";
  return "C";
}

function hashPair(instruction, input, output) {
  const key = `${instruction}|||${input}|||${(output || "").slice(0, 200)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 16);
}

async function callClaude(prompt) {
  // Use Claude CLI (included in monthly plan) via stdin to avoid Windows arg length limits
  const env = { ...process.env };
  delete env.CLAUDECODE; // Allow nested invocation

  return new Promise((resolve) => {
    const child = spawn("claude", ["-p", "-", "--output-format", "text"], {
      env,
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 180_000,
      shell: true,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });

    child.on("close", (code) => {
      if (code !== 0 && stderr) {
        console.error(`  CLI stderr: ${stderr.slice(0, 200)}`);
      }
      resolve(stdout.trim());
    });

    child.on("error", (e) => {
      console.error(`  CLI spawn error: ${e.message?.slice(0, 200)}`);
      resolve("");
    });

    // Write prompt to stdin and close
    child.stdin.write(prompt);
    child.stdin.end();
  });
}

async function generateBatch(vertical, scenarios, batchNum, batchSize) {
  const selected = [];
  for (let i = 0; i < batchSize; i++) {
    selected.push(scenarios[(batchNum * batchSize + i) % scenarios.length]);
  }

  const prompt = `You are an expert marketing strategist for small businesses. Generate exactly ${batchSize} training examples for a marketing AI model.

For each example, output a JSON object on its own line (JSONL format). Each object must have:
- "instruction": A specific marketing question or task from a small business owner
- "input": Business context (budget, industry, constraints, current situation)
- "output": A detailed, actionable marketing response (300-800 words) with specific steps, KPIs, timelines, and compliance notes

Vertical: ${VERTICALS[vertical].label}
Scenario themes to cover: ${selected.join(", ")}

Requirements for each output:
- Include specific KPIs and measurable targets
- Include actionable step-by-step plans
- Reference compliance and risk considerations
- Be relevant to small businesses and local markets
- Include timeline and budget considerations

Output ONLY the JSONL lines, no other text. Each line must be valid JSON.`;

  let raw = await callClaude(prompt);
  if (!raw) { console.error("  [DEBUG] Claude returned empty"); return []; }
  if (process.env.DEBUG) console.error(`  [DEBUG] Raw output (${raw.length} chars):\n${raw.slice(0, 500)}`);

  // Strip markdown code fences if present
  raw = raw.replace(/^```(?:jsonl?|json)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");

  const pairs = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("{")) continue;
    try {
      const obj = JSON.parse(trimmed);
      if (obj.instruction && obj.output) {
        pairs.push({
          instruction: obj.instruction,
          input: obj.input || `Vertical: ${vertical}`,
          output: obj.output,
        });
      }
    } catch { /* skip malformed lines */ }
  }
  return pairs;
}

async function main() {
  const activeVerticals = VERTICAL === "all"
    ? Object.keys(VERTICALS)
    : [VERTICAL];

  const perVertical = Math.ceil(TOTAL / activeVerticals.length);
  const batches = Math.ceil(perVertical / BATCH_SIZE);

  console.log(`Generating ${TOTAL} synthetic scenarios`);
  console.log(`  Verticals: ${activeVerticals.join(", ")}`);
  console.log(`  Per vertical: ${perVertical} (${batches} batches of ${BATCH_SIZE})`);
  console.log(`  Output: ${OUT_FILE}\n`);

  const seen = new Set();
  // Load existing hashes to avoid duplicates with master dataset
  try {
    const existing = fs.readFileSync(path.join(OUT_DIR, "master_sft.jsonl"), "utf8");
    for (const line of existing.split("\n").filter(Boolean)) {
      const r = JSON.parse(line);
      seen.add(hashPair(r.instruction, r.input, r.output));
    }
    console.log(`  Loaded ${seen.size} existing hashes for dedup\n`);
  } catch { /* no existing file */ }

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalCTier = 0;
  const stream = fs.createWriteStream(OUT_FILE, { flags: "a" });

  for (const vertical of activeVerticals) {
    const scenarios = VERTICALS[vertical].scenarios;
    console.log(`\n[${VERTICALS[vertical].label}]`);

    for (let b = 0; b < batches && totalGenerated < TOTAL; b++) {
      process.stdout.write(`  Batch ${b + 1}/${batches}... `);
      const pairs = await generateBatch(vertical, scenarios, b, BATCH_SIZE);

      let batchAdded = 0;
      for (const pair of pairs) {
        const h = hashPair(pair.instruction, pair.input, pair.output);
        if (seen.has(h)) { totalSkipped++; continue; }
        seen.add(h);

        const tvs = scoreTvs(pair.output, "synthetic");
        const tier = tierFor(tvs);
        if (tier === "C") { totalCTier++; continue; }

        const row = {
          instruction: pair.instruction,
          input: pair.input,
          output: pair.output,
          meta: {
            target_id: `syn-${String(totalGenerated + 1).padStart(5, "0")}`,
            source: "synthetic-generation",
            source_url: `generateSyntheticScenarios.mjs:${vertical}:batch-${b}`,
            captured_at: new Date().toISOString(),
            license_type: "synthetic_generated",
            vertical,
            channel: "claude_synthetic",
            quality: "synthetic_gold",
            tvs,
            tier,
          },
        };

        stream.write(JSON.stringify(row) + "\n");
        totalGenerated++;
        batchAdded++;
      }
      console.log(`${batchAdded} added (${pairs.length} generated)`);
    }
  }

  stream.end();

  console.log(`\nSynthetic generation complete:`);
  console.log(`  Total generated: ${totalGenerated}`);
  console.log(`  Duplicates skipped: ${totalSkipped}`);
  console.log(`  C-tier filtered: ${totalCTier}`);
  console.log(`  Output: ${OUT_FILE}`);

  // Update manifest
  const manifestPath = path.join(OUT_DIR, "manifest.json");
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    manifest.syntheticGeneration = {
      generatedAt: new Date().toISOString(),
      totalGenerated,
      duplicatesSkipped: totalSkipped,
      cTierFiltered: totalCTier,
      verticals: activeVerticals,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  } catch { /* manifest doesn't exist yet */ }
}

main().catch(console.error);
