#!/usr/bin/env node
/**
 * generateMarketingKnowledgeCorpus.mjs
 * PhD-level marketing knowledge corpus generator using Anthropic API.
 *
 * Generates diverse, high-quality SFT training pairs across 12 academic/practical
 * marketing domains, 156 topics, 5 content types, and 4 verticals (3,120 unique slots).
 *
 * Usage:
 *   node scripts/marketing/generateMarketingKnowledgeCorpus.mjs [options]
 *
 * Options:
 *   --model haiku|sonnet   Model to use (default: haiku)
 *   --count N              Max examples to generate this run (default: 500)
 *   --batch N              Concurrent API calls (default: 5)
 *   --resume               Resume from progress file (default: true)
 *   --domain NAME          Only generate for this domain ID
 *   --phase N              Run specific phase: 1=bulk, 2=extended, 3=quality, 4=pref, 5=eval
 *   --dry-run              Print prompts without calling API
 *
 * Output:
 *   runs/marketing/knowledge-corpus/corpus_sft.jsonl
 *   runs/marketing/knowledge-corpus/corpus_preference.jsonl
 *   runs/marketing/knowledge-corpus/corpus_eval.jsonl
 *   runs/marketing/knowledge-corpus/progress.json
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "runs", "marketing", "knowledge-corpus");
const SFT_FILE = path.join(OUT_DIR, "corpus_sft.jsonl");
const PREF_FILE = path.join(OUT_DIR, "corpus_preference.jsonl");
const EVAL_FILE = path.join(OUT_DIR, "corpus_eval.jsonl");
const PROGRESS_FILE = path.join(OUT_DIR, "progress.json");
const TAXONOMY_FILE = path.join(ROOT, "scripts", "marketing", "sources", "knowledge-taxonomy.json");

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── CLI Args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
function getArg(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
function hasFlag(name) { return args.includes(`--${name}`); }

const MODEL_KEY = getArg("model", "haiku");
const MAX_COUNT = Number(getArg("count", "500"));
const BATCH_SIZE = Number(getArg("batch", "5"));
const DOMAIN_FILTER = getArg("domain", "");
const PHASE = Number(getArg("phase", "1"));
const DRY_RUN = hasFlag("dry-run");

const MODELS = {
  haiku: "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-5-20241022",
};
const MODEL_ID = MODELS[MODEL_KEY] || MODELS.haiku;

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY && !DRY_RUN) {
  console.error("ERROR: ANTHROPIC_API_KEY not set");
  process.exit(1);
}

// ── Load Taxonomy ─────────────────────────────────────────────────────────────

const taxonomy = JSON.parse(fs.readFileSync(TAXONOMY_FILE, "utf-8"));
const { domains, verticals, contentTypes } = taxonomy;

// ── Scoring (matches buildFineTunePack.mjs exactly) ───────────────────────────

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

// ── Progress Tracking ─────────────────────────────────────────────────────────

function loadProgress() {
  try { return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf-8")); }
  catch { return { generated: {}, stats: { total: 0, tierA: 0, tierB: 0, tierC: 0, errors: 0 } }; }
}

function saveProgress(progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// ── Anthropic API Client ──────────────────────────────────────────────────────

let requestCount = 0;
let totalInputTokens = 0;
let totalOutputTokens = 0;

async function callAnthropic(systemPrompt, userMessage, maxTokens = 2000) {
  if (DRY_RUN) {
    console.log(`[DRY RUN] System: ${systemPrompt.slice(0, 100)}...`);
    console.log(`[DRY RUN] User: ${userMessage.slice(0, 100)}...`);
    return null;
  }

  const body = JSON.stringify({
    model: MODEL_ID,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body,
      });

      if (res.status === 429) {
        const wait = Math.pow(2, attempt + 1) * 5000;
        console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }

      const data = await res.json();

      if (data.error) {
        console.error(`  API error: ${data.error.message}`);
        if (data.error.type === "invalid_request_error" && data.error.message.includes("credit")) {
          console.error("FATAL: Out of API credits. Saving progress.");
          return null;
        }
        return null;
      }

      requestCount++;
      if (data.usage) {
        totalInputTokens += data.usage.input_tokens || 0;
        totalOutputTokens += data.usage.output_tokens || 0;
      }

      return data.content?.[0]?.text || "";
    } catch (err) {
      console.error(`  Network error (attempt ${attempt + 1}): ${err.message}`);
      await sleep(3000 * (attempt + 1));
    }
  }
  return null;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Slot Generation ───────────────────────────────────────────────────────────

function buildAllSlots() {
  const slots = [];
  for (const domain of domains) {
    if (DOMAIN_FILTER && domain.id !== DOMAIN_FILTER) continue;
    for (const topic of domain.topics) {
      for (const ct of contentTypes) {
        for (const vert of verticals) {
          slots.push({
            key: `${domain.id}:${topic.slice(0, 40)}:${ct.id}:${vert.id}`,
            domain,
            topic,
            contentType: ct,
            vertical: vert,
          });
        }
      }
    }
  }
  return slots;
}

// ── Prompt Building ───────────────────────────────────────────────────────────

function buildSystemPrompt(slot) {
  return `You are a PhD-level marketing strategist synthesizing knowledge from ${slot.domain.sourceFrameworks}.

You are generating a training example for a marketing AI assistant serving ${slot.vertical.label} businesses (${slot.vertical.context}).

Your response MUST include ALL of the following quality dimensions:
1. Specific measurable KPIs with numeric targets (conversion rates, ROI percentages, CPA targets, CTR benchmarks, revenue lift projections)
2. Evidence-based reasoning citing benchmarks, case study results, measured data from real-world marketing evidence
3. Step-by-step execution plans with numbered checklists, experiment designs, and workflow descriptions
4. Vertical-specific context mentioning the specific industry (use terms like: contractor, SMB, local, union, IBEW where relevant)
5. Compliance notes, risk assessment, rollback triggers, stop-loss guardrails for budget protection
6. Source attribution: reference the theoretical framework being applied (e.g., "Applying Kotler's STP framework..." or "Based on Cialdini's principle of social proof...")

CRITICAL: Every response must naturally contain words from these categories:
- Business metrics: kpi, conversion, roi, revenue, ctr, cpa, lift
- Evidence: case, benchmark, result, data, measured, evidence
- Actions: step, checklist, execute, experiment, plan, workflow
- Audience: contractor, smb, local (or industry-specific terms)
- Risk controls: compliance, risk, rollback, stop-loss, guardrail

Format: Output ONLY a single JSON object (no markdown fences, no extra text) with these fields:
- "instruction": A specific question from a ${slot.vertical.label} business owner about ${slot.topic} (40-80 words)
- "input": Business context including budget range, current situation, constraints, and goals (60-120 words)
- "output": Expert marketing response (400-900 words) incorporating all 6 quality dimensions above`;
}

function buildUserPrompt(slot) {
  const ct = slot.contentType;
  return ct.prompt
    .replace("{vertical}", slot.vertical.label)
    .replace("{topic}", slot.topic)
    + `\n\nDOMAIN: ${slot.domain.name}\nTOPIC: ${slot.topic}\nFRAMEWORK: ${slot.domain.sourceFrameworks}\n\nOutput ONLY the JSON object.`;
}

// ── Parse Response ────────────────────────────────────────────────────────────

function parseResponse(raw) {
  if (!raw) return null;
  // Strip markdown fences
  let cleaned = raw.replace(/^```(?:json|jsonl)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "").trim();

  // Attempt 1: direct parse
  try {
    const obj = JSON.parse(cleaned);
    if (obj.instruction && obj.output) return obj;
  } catch { /* try other methods */ }

  // Attempt 2: extract JSON block from mixed output
  const match = cleaned.match(/\{[\s\S]*"instruction"[\s\S]*"output"[\s\S]*\}/);
  if (match) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.instruction && obj.output) return obj;
    } catch { /* try relaxed parse */ }
  }

  // Attempt 3: find instruction/input/output fields via regex and reconstruct
  try {
    const instrMatch = cleaned.match(/"instruction"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    const inputMatch = cleaned.match(/"input"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
    const outputMatch = cleaned.match(/"output"\s*:\s*"((?:[^"\\]|\\[\s\S])*)"\s*\}?\s*$/s);
    if (instrMatch && outputMatch) {
      return {
        instruction: instrMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
        input: inputMatch ? inputMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : "",
        output: outputMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'),
      };
    }
  } catch { /* fall through */ }

  return null;
}

// ── Phase 1-2: SFT Generation ────────────────────────────────────────────────

async function generateSFT() {
  const allSlots = buildAllSlots();
  const progress = loadProgress();
  const seenHashes = new Set();

  // Load existing hashes from output file
  if (fs.existsSync(SFT_FILE)) {
    const lines = fs.readFileSync(SFT_FILE, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        seenHashes.add(hashPair(obj.instruction, obj.input, obj.output));
      } catch { /* skip bad lines */ }
    }
  }

  // Filter to ungenerated slots
  const pending = allSlots.filter(s => !progress.generated[s.key]);
  console.log(`\nTotal slots: ${allSlots.length}`);
  console.log(`Already generated: ${allSlots.length - pending.length}`);
  console.log(`Pending: ${pending.length}`);
  console.log(`Target this run: ${Math.min(MAX_COUNT, pending.length)}`);
  console.log(`Model: ${MODEL_ID}\n`);

  let generated = 0;
  const toGenerate = pending.slice(0, MAX_COUNT);

  // Process in batches
  for (let i = 0; i < toGenerate.length; i += BATCH_SIZE) {
    const batch = toGenerate.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(toGenerate.length / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches} (${generated}/${toGenerate.length} done, ${progress.stats.tierA}A/${progress.stats.tierB}B/${progress.stats.tierC}C skipped)`);

    const promises = batch.map(async (slot) => {
      const systemPrompt = buildSystemPrompt(slot);
      const userPrompt = buildUserPrompt(slot);
      const raw = await callAnthropic(systemPrompt, userPrompt, 4000);
      return { slot, raw };
    });

    const results = await Promise.all(promises);

    for (const { slot, raw } of results) {
      if (DRY_RUN) {
        progress.generated[slot.key] = "dry-run";
        generated++;
        continue;
      }

      const parsed = parseResponse(raw);
      if (!parsed) {
        console.log(`  SKIP (parse fail): ${slot.key.slice(0, 60)}`);
        progress.stats.errors++;
        continue;
      }

      const tvs = scoreTvs(parsed.output, slot.domain.sourceFrameworks);
      const tier = tierFor(tvs);

      if (tier === "C") {
        console.log(`  SKIP (TVS=${tvs}, Tier C): ${slot.key.slice(0, 60)}`);
        progress.stats.tierC++;
        progress.generated[slot.key] = `skip-tierC-${tvs}`;
        continue;
      }

      const h = hashPair(parsed.instruction, parsed.input, parsed.output);
      if (seenHashes.has(h)) {
        console.log(`  SKIP (duplicate): ${slot.key.slice(0, 60)}`);
        progress.generated[slot.key] = "skip-dup";
        continue;
      }

      const record = {
        instruction: parsed.instruction,
        input: parsed.input || "",
        output: parsed.output,
        meta: {
          target_id: `kg-${String(progress.stats.total + 1).padStart(5, "0")}`,
          source: `knowledge-taxonomy/${slot.domain.id}`,
          source_url: `taxonomy://${slot.domain.id}/${slot.contentType.id}`,
          captured_at: new Date().toISOString(),
          license_type: "synthetic_knowledge_synthesis",
          vertical: slot.vertical.id,
          channel: slot.contentType.id,
          quality: "knowledge_corpus_generation",
          tvs,
          tier,
          domain: slot.domain.id,
          topic: slot.topic,
          content_type: slot.contentType.id,
          model: MODEL_KEY,
          framework: slot.domain.sourceFrameworks.slice(0, 100),
        },
      };

      fs.appendFileSync(SFT_FILE, JSON.stringify(record) + "\n");
      seenHashes.add(h);
      progress.generated[slot.key] = `ok-${tier}-${tvs}`;
      progress.stats.total++;
      if (tier === "A") progress.stats.tierA++;
      else progress.stats.tierB++;
      generated++;

      console.log(`  OK (TVS=${tvs}, Tier ${tier}): ${slot.domain.name} → ${slot.topic.slice(0, 30)}`);
    }

    saveProgress(progress);

    // Brief pause between batches to respect rate limits
    if (i + BATCH_SIZE < toGenerate.length) {
      await sleep(1500);
    }
  }

  return { generated, progress };
}

// ── Phase 4: Preference Pair Generation ──────────────────────────────────────

async function generatePreferencePairs() {
  console.log("\n=== Phase 4: Preference Pair Generation ===\n");

  const progress = loadProgress();
  let pairCount = 0;

  // Pick 200 diverse topics (one per unique domain+topic combo)
  const topicPairs = [];
  for (const domain of domains) {
    for (const topic of domain.topics) {
      if (topicPairs.length >= 200) break;
      topicPairs.push({ domain, topic });
    }
    if (topicPairs.length >= 200) break;
  }

  const vert = verticals[0]; // IBEW primary

  for (let i = 0; i < topicPairs.length; i += BATCH_SIZE) {
    const batch = topicPairs.slice(i, i + BATCH_SIZE);
    console.log(`Pref batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(topicPairs.length / BATCH_SIZE)}`);

    for (const { domain, topic } of batch) {
      const prompt = `You are a marketing AI. A ${vert.label} business owner asks: How should I apply ${topic} to grow my business? Provide a detailed, actionable response with KPIs, steps, benchmarks, compliance notes, and risk guardrails. (400-600 words)`;

      // Generate two responses with different temperatures via system prompts
      const [chosen, rejected] = await Promise.all([
        callAnthropic(
          `You are an elite PhD-level marketing strategist applying ${domain.sourceFrameworks}. Provide the BEST possible response with evidence, data, benchmarks, measurable KPIs, step-by-step execution plans, compliance guardrails, and risk assessment. Be specific to ${vert.label} businesses.`,
          prompt, 1500
        ),
        callAnthropic(
          `You are a helpful marketing assistant. Provide a good response about ${topic} for a small business. Include some practical tips.`,
          prompt, 1000
        ),
      ]);

      if (!chosen || !rejected) continue;

      const chosenTvs = scoreTvs(chosen, domain.sourceFrameworks);
      const rejectedTvs = scoreTvs(rejected, "");

      // Only keep if chosen is genuinely better
      if (chosenTvs <= rejectedTvs) continue;

      const pair = {
        prompt,
        chosen: chosen.slice(0, 2000),
        rejected: rejected.slice(0, 2000),
        rationale: `Chosen (TVS=${chosenTvs}) has stronger evidence, KPIs, compliance, and actionability than rejected (TVS=${rejectedTvs}).`,
        meta: {
          source: "knowledge_corpus_preference",
          chosen_model: MODEL_KEY,
          chosen_tvs: chosenTvs,
          rejected_model: `${MODEL_KEY}-basic`,
          rejected_tvs: rejectedTvs,
          domain: domain.id,
          topic,
          vertical: vert.id,
        },
      };

      fs.appendFileSync(PREF_FILE, JSON.stringify(pair) + "\n");
      pairCount++;
    }

    await sleep(2000);
  }

  console.log(`\nGenerated ${pairCount} preference pairs`);
  return pairCount;
}

// ── Phase 5: Eval Set Expansion ──────────────────────────────────────────────

async function generateEvalSet() {
  console.log("\n=== Phase 5: Golden Eval Set Expansion ===\n");

  const evalCategories = [
    { count: 10, focus: "Academic marketing theory application", domains: ["marketing-strategy-foundations", "behavioral-economics-persuasion"] },
    { count: 10, focus: "IBEW and electrical contractor marketing", domains: ["ibew-electrical-contractor"] },
    { count: 10, focus: "Anti-pattern identification and failure prevention", domains: ["anti-patterns-failure-studies"] },
    { count: 10, focus: "Cross-vertical campaign comparison", domains: ["campaign-operations-attribution", "digital-channels-tactics"] },
    { count: 10, focus: "Budget-constrained campaign optimization", domains: ["growth-marketing-modern", "measurement-analytics-experimentation"] },
  ];

  let evalCount = 0;

  for (const cat of evalCategories) {
    const systemPrompt = `You are designing evaluation scenarios for a marketing AI. Generate ${cat.count} diverse evaluation prompts focused on: ${cat.focus}. Each prompt should test the AI's ability to provide actionable, evidence-based, compliance-aware marketing advice.

Output EXACTLY ${cat.count} JSON objects, one per line (JSONL format). Each object must have:
- "id": "eval-${String(evalCount + 51).padStart(3, "0")}" (incrementing from eval-051)
- "prompt": A specific, challenging marketing question (50-100 words)
- "rubric": {"relevance": "0-5 scoring criteria", "actionability": "0-5 scoring criteria", "compliance": "0-5 scoring criteria", "measurable_kpis": "0-5 scoring criteria"}
- "tags": ["category1", "category2"]
- "vertical": primary vertical this applies to
- "difficulty": "standard" or "advanced"

Output ONLY the JSONL lines.`;

    const raw = await callAnthropic(systemPrompt, `Generate ${cat.count} eval scenarios for: ${cat.focus}`);
    if (!raw) continue;

    const cleaned = raw.replace(/^```(?:json|jsonl)?\s*\n?/gm, "").replace(/\n?```\s*$/gm, "");
    const lines = cleaned.split("\n").filter(Boolean);

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        if (obj.prompt) {
          obj.id = `eval-${String(evalCount + 51).padStart(3, "0")}`;
          fs.appendFileSync(EVAL_FILE, JSON.stringify(obj) + "\n");
          evalCount++;
        }
      } catch { /* skip bad lines */ }
    }

    console.log(`  ${cat.focus}: ${evalCount} total evals`);
    await sleep(2000);
  }

  console.log(`\nGenerated ${evalCount} eval scenarios`);
  return evalCount;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   LaunchBase Marketing Knowledge Corpus Generator       ║");
  console.log("╚══════════════════════════════════════════════════════════╝");
  console.log(`Model: ${MODEL_KEY} (${MODEL_ID})`);
  console.log(`Phase: ${PHASE}`);
  console.log(`Max count: ${MAX_COUNT}`);
  console.log(`Batch size: ${BATCH_SIZE}`);
  console.log(`Output: ${OUT_DIR}`);
  if (DRY_RUN) console.log("*** DRY RUN — no API calls ***");

  const startTime = Date.now();

  if (PHASE <= 2) {
    // Phase 1 & 2: SFT generation (same logic, just run with different --count)
    const { generated, progress } = await generateSFT();

    console.log("\n── Results ─────────────────────────────────────────────");
    console.log(`Generated: ${generated}`);
    console.log(`Total corpus: ${progress.stats.total}`);
    console.log(`Tier A: ${progress.stats.tierA}`);
    console.log(`Tier B: ${progress.stats.tierB}`);
    console.log(`Tier C (skipped): ${progress.stats.tierC}`);
    console.log(`Parse errors: ${progress.stats.errors}`);
  }

  if (PHASE === 4) {
    await generatePreferencePairs();
  }

  if (PHASE === 5) {
    await generateEvalSet();
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n── Cost ────────────────────────────────────────────────`);
  console.log(`API calls: ${requestCount}`);
  console.log(`Input tokens: ${totalInputTokens.toLocaleString()}`);
  console.log(`Output tokens: ${totalOutputTokens.toLocaleString()}`);

  const isHaiku = MODEL_KEY === "haiku";
  const inputCost = totalInputTokens * (isHaiku ? 0.80 : 3.0) / 1_000_000;
  const outputCost = totalOutputTokens * (isHaiku ? 4.0 : 15.0) / 1_000_000;
  console.log(`Estimated cost: $${(inputCost + outputCost).toFixed(2)}`);
  console.log(`Time: ${elapsed} minutes`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
