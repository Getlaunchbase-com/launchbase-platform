/**
 * Selector-only probe runner
 * 
 * Tests selector role in isolation by feeding it a fixed list of 20 proposed changes
 * and verifying it outputs exactly 8 (dedupe, prioritize, no new ideas).
 */

import { generateFixedInput, type ProposedChange } from "./generateFixedInput.js";
// Direct AIML API call using fetch
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

// Selector output schema
const SelectorOutputSchema = z.object({
  selectedChanges: z.array(z.object({
    targetKey: z.string(),
    description: z.string(),
    rationale: z.string(),
    impact: z.enum(["high", "medium", "low"]),
  })).length(8), // MUST be exactly 8
  selectionRationale: z.string().optional(),
});

type SelectorOutput = z.infer<typeof SelectorOutputSchema>;

interface SelectorProbeRun {
  model: string;
  rep: number;
  timestamp: string;
  valid: boolean;
  exact8: boolean;
  introducedNewIdeas: boolean;
  deduped: boolean;
  avoidedUnbuildable: boolean;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  stopReason: string;
  selectedTargetKeys: string[];
}

interface SelectorProbeSummary {
  model: string;
  reps: number;
  validRate: number;
  exact8Rate: number;
  introducedNewIdeasRate: number;
  dedupedRate: number;
  avoidedUnbuildableRate: number;
  avgAttempts: number;
  avgCost: number;
  avgLatency: number;
  avgOutputTokens: number;
}

async function runSelectorProbe(modelId: string, reps: number): Promise<SelectorProbeRun[]> {
  const fixedInput = generateFixedInput();
  const runs: SelectorProbeRun[] = [];

  console.log(`\n[SELECTOR PROBE] Model: ${modelId}, Reps: ${reps}`);
  console.log(`[INPUT] 20 items (18 unique, 2 duplicates, 2 unbuildable)`);

  for (let rep = 1; rep <= reps; rep++) {
    console.log(`\n[REP ${rep}/${reps}] Running...`);
    const startTime = Date.now();

    try {
      // Bui      // Call model
      const prompt = buildSelectorPrompt(fixedInput);

      // Direct AIML API call
      const apiResponse = await fetch("https://api.aimlapi.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.AIML_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 2000,
          temperature: 0.3,
        }),
      });

      if (!apiResponse.ok) {
        throw new Error(`AIML API error: ${apiResponse.status} ${apiResponse.statusText}`);
      }

      const apiData = await apiResponse.json();
      const response = {
        content: apiData.choices[0].message.content,
        usage: {
          prompt_tokens: apiData.usage?.prompt_tokens || 0,
          completion_tokens: apiData.usage?.completion_tokens || 0,
          estimated_cost: (apiData.usage?.prompt_tokens || 0) * 0.0000001 + (apiData.usage?.completion_tokens || 0) * 0.0000003, // rough estimate
        },
      };
      const latencyMs = Date.now() - startTime;

      // Parse JSON
      const rawText = response.content;
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }
      const parsed = JSON.parse(jsonMatch[0]);

      // Validate schema
      const validated = SelectorOutputSchema.parse(parsed);

      // Check metrics
      const selectedTargetKeys = validated.selectedChanges.map((c) => c.targetKey);
      const exact8 = validated.selectedChanges.length === 8;
      const introducedNewIdeas = selectedTargetKeys.some(
        (key) => !fixedInput.some((item) => item.targetKey === key)
      );
      const deduped = new Set(selectedTargetKeys).size === selectedTargetKeys.length;
      const avoidedUnbuildable = !selectedTargetKeys.includes("integration.zapier");

      runs.push({
        model: modelId,
        rep,
        timestamp: new Date().toISOString(),
        valid: true,
        exact8,
        introducedNewIdeas,
        deduped,
        avoidedUnbuildable,
        attempts: 1,
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        latencyMs,
        costUsd: response.usage?.estimated_cost || 0,
        stopReason: "ok",
        selectedTargetKeys,
      });

      console.log(`  ✅ VALID | exact8=${exact8} | deduped=${deduped} | avoidedUnbuildable=${avoidedUnbuildable}`);
    } catch (error: any) {
      const latencyMs = Date.now() - startTime;
      runs.push({
        model: modelId,
        rep,
        timestamp: new Date().toISOString(),
        valid: false,
        exact8: false,
        introducedNewIdeas: false,
        deduped: false,
        avoidedUnbuildable: false,
        attempts: 1,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs,
        costUsd: 0,
        stopReason: error.message.includes("schema") ? "schema_failed" : "unknown",
        selectedTargetKeys: [],
      });

      console.log(`  ❌ FAILED | ${error.message}`);
    }
  }

  return runs;
}

function buildSelectorPrompt(candidateChanges: ProposedChange[]): string {
  return `You are a design change selector. You receive a list of proposed design changes and must select exactly 8 to implement.

**RULES:**
1. Output EXACTLY 8 changes (no more, no less)
2. Deduplicate by targetKey (if multiple changes target the same element, pick the best one)
3. Prioritize high-impact changes over low-impact
4. Avoid unbuildable changes (buildable=false)
5. Do NOT invent new changes—only select from the provided list
6. Output valid JSON matching this schema:

{
  "selectedChanges": [
    {
      "targetKey": "string",
      "description": "string",
      "rationale": "string",
      "impact": "high" | "medium" | "low"
    }
  ]
}

**CANDIDATE CHANGES (${candidateChanges.length} total):**

${JSON.stringify(candidateChanges, null, 2)}

**YOUR TASK:**
Select exactly 8 changes. Output only JSON (no markdown, no prose).`;
}

function aggregateSummary(runs: SelectorProbeRun[]): SelectorProbeSummary {
  const validRuns = runs.filter((r) => r.valid);
  const exact8Runs = runs.filter((r) => r.exact8);
  const introducedNewIdeasRuns = runs.filter((r) => r.introducedNewIdeas);
  const dedupedRuns = runs.filter((r) => r.deduped);
  const avoidedUnbuildableRuns = runs.filter((r) => r.avoidedUnbuildable);

  return {
    model: runs[0]?.model || "unknown",
    reps: runs.length,
    validRate: validRuns.length / runs.length,
    exact8Rate: exact8Runs.length / runs.length,
    introducedNewIdeasRate: introducedNewIdeasRuns.length / runs.length,
    dedupedRate: dedupedRuns.length / runs.length,
    avoidedUnbuildableRate: avoidedUnbuildableRuns.length / runs.length,
    avgAttempts: runs.reduce((sum, r) => sum + r.attempts, 0) / runs.length,
    avgCost: runs.reduce((sum, r) => sum + r.costUsd, 0) / runs.length,
    avgLatency: runs.reduce((sum, r) => sum + r.latencyMs, 0) / runs.length,
    avgOutputTokens: runs.reduce((sum, r) => sum + r.outputTokens, 0) / runs.length,
  };
}

function renderWeatherTable(summaries: SelectorProbeSummary[]): string {
  const header = "Model                              Valid%  Exact8%  NewIdeas%  Deduped%  AvoidUnbuild%  AvgAtt   $Avg    LatAvg  TokOut";
  const separator = "-".repeat(header.length);

  const rows = summaries.map((s) => {
    const model = s.model.padEnd(35);
    const valid = `${(s.validRate * 100).toFixed(0)}%`.padStart(6);
    const exact8 = `${(s.exact8Rate * 100).toFixed(0)}%`.padStart(7);
    const newIdeas = `${(s.introducedNewIdeasRate * 100).toFixed(0)}%`.padStart(9);
    const deduped = `${(s.dedupedRate * 100).toFixed(0)}%`.padStart(8);
    const avoidUnbuild = `${(s.avoidedUnbuildableRate * 100).toFixed(0)}%`.padStart(13);
    const avgAtt = s.avgAttempts.toFixed(2).padStart(6);
    const cost = `$${s.avgCost.toFixed(3)}`.padStart(7);
    const latency = `${(s.avgLatency / 1000).toFixed(1)}s`.padStart(7);
    const tokOut = Math.round(s.avgOutputTokens).toString().padStart(6);

    return `${model} ${valid}  ${exact8}  ${newIdeas}  ${deduped}  ${avoidUnbuild}  ${avgAtt}  ${cost}  ${latency}  ${tokOut}`;
  });

  return `\n${separator}\n${header}\n${separator}\n${rows.join("\n")}\n${separator}\n`;
}

async function main() {
  const models = [
    "Qwen/Qwen2.5-7B-Instruct-Turbo",
    "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
    "google/gemma-3-12b-it",
  ];

  const reps = 10;
  const allRuns: SelectorProbeRun[] = [];
  const summaries: SelectorProbeSummary[] = [];

  for (const model of models) {
    const runs = await runSelectorProbe(model, reps);
    allRuns.push(...runs);
    summaries.push(aggregateSummary(runs));
  }

  // Save runs
  const outputDir = path.join(process.cwd(), "runs/selector_probes");
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(
    path.join(outputDir, `selector_probe_${new Date().toISOString().split("T")[0]}.json`),
    JSON.stringify({ runs: allRuns, summaries }, null, 2)
  );

  // Print weather table
  console.log("\n\n================================================================================");
  console.log("SELECTOR WEATHER TABLE");
  console.log("================================================================================");
  console.log(renderWeatherTable(summaries));

  // Print promotion recommendation
  const promotable = summaries.filter(
    (s) => s.validRate >= 0.95 && s.exact8Rate === 1.0 && s.avgAttempts <= 1.2 && s.introducedNewIdeasRate === 0
  );

  if (promotable.length > 0) {
    const winner = promotable.sort((a, b) => a.avgCost - b.avgCost)[0];
    console.log(`\n🏆 PROMOTION RECOMMENDATION: ${winner.model}`);
    console.log(`   Valid%: ${(winner.validRate * 100).toFixed(0)}% | Exact8%: ${(winner.exact8Rate * 100).toFixed(0)}% | AvgAtt: ${winner.avgAttempts.toFixed(2)} | Cost: $${winner.avgCost.toFixed(3)}`);
  } else {
    console.log(`\n⚠️  NO MODEL MEETS PROMOTION CRITERIA`);
    console.log(`   Required: Valid%≥95%, Exact8%=100%, AvgAtt≤1.2, IntroducedNewIdeas%=0%`);
  }
}

main().catch(console.error);
