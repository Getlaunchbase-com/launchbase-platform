/**
 * Phase 1.3 Gate A: Test 5 realistic prompts designed for success outcomes
 * 
 * Goal: At least 2/5 should succeed with needsHuman=false
 */

import { refineCopy } from "../server/ai/aiTennisService.js";

// Test prompts from user specification
const PROMPTS = [
  {
    id: 1,
    name: "Specific rewrite + constraints",
    userText: 'Rewrite the hero headline + subheadline to be clearer and more specific. Keep headline ≤ 7 words, subheadline ≤ 18 words. Maintain confident, modern tone. Must mention "LaunchBase" and "multi-AI".',
  },
  {
    id: 2,
    name: "Value prop with audience + outcome",
    userText: 'For a landing page hero, write a headline/subheadline aimed at founders launching in 30 days. Emphasize speed, quality, and cost control. Avoid generic words like "welcome" or "hello".',
  },
  {
    id: 3,
    name: "Compare/contrast",
    userText: 'Rewrite hero copy to clearly differentiate us from "DIY ChatGPT prompts". Mention: audit trail, idempotency, tiered specialists. No hype words like "revolutionary".',
  },
  {
    id: 4,
    name: "High specificity + structure",
    userText: "Produce 3 variants: one punchy, one professional, one playful. Each must include a measurable benefit (time saved, fewer revisions, lower cost). Keep it human and concrete.",
  },
  {
    id: 5,
    name: "Tight directive",
    userText: 'Replace vague hero copy with specific promise + proof: mention "26/26 tests passing", "weekly drift report", and "stopReason contract". Keep it readable to non-technical users.',
  },
];

// Current copy baseline (same for all tests)
const CURRENT_COPY = {
  "hero.headline": "Welcome to Our Business",
  "hero.subheadline": "We help you succeed",
};

async function main() {
  console.log("=".repeat(80));
  console.log("Phase 1.3 Gate A: Realistic Prompt Testing");
  console.log("=".repeat(80));
  console.log(`\nRunning ${PROMPTS.length} prompts designed for success outcomes...\n`);

  const results: Array<{
    id: number;
    name: string;
    success: boolean;
    needsHuman: boolean;
    stopReason?: string;
    roundsRun: number;
    costUsd: number;
    calls: number;
    elapsed: number;
    proposal?: any;
    error?: string;
  }> = [];

  for (const prompt of PROMPTS) {
    console.log(`\n${"─".repeat(80)}`);
    console.log(`[${prompt.id}/5] ${prompt.name}`);
    console.log(`${"─".repeat(80)}`);
    console.log(`Prompt: "${prompt.userText.substring(0, 100)}..."`);
    console.log(`Current: ${JSON.stringify(CURRENT_COPY)}`);
    console.log(`\nExecuting...`);

    const startTime = Date.now();

    try {
      const result = await refineCopy(
        {
          userText: prompt.userText,
          targetSection: "hero",
          currentCopy: CURRENT_COPY,
          constraints: {
            maxRounds: 1,
            costCapUsd: 1,
          },
        },
        "aiml"
      );

      const elapsed = Date.now() - startTime;

      console.log(`\n✓ Completed in ${(elapsed / 1000).toFixed(2)}s`);
      console.log(`  Success: ${result.success}`);
      console.log(`  NeedsHuman: ${result.needsHuman}`);
      console.log(`  Rounds: ${result.meta.roundsRun}`);
      console.log(`  Cost: $${result.meta.estimatedUsd.toFixed(4)}`);
      console.log(`  Calls: ${result.meta.calls}`);

      if (result.success && result.proposal) {
        console.log(`  Proposal:`);
        console.log(`    Target: ${result.proposal.targetKey}`);
        console.log(`    Value: "${result.proposal.value}"`);
        console.log(`    Confidence: ${result.proposal.confidence}`);
      }

      results.push({
        id: prompt.id,
        name: prompt.name,
        success: result.success,
        needsHuman: result.needsHuman,
        roundsRun: result.meta.roundsRun,
        costUsd: result.meta.estimatedUsd,
        calls: result.meta.calls,
        elapsed: elapsed / 1000,
        proposal: result.proposal,
      });
    } catch (error: any) {
      const elapsed = Date.now() - startTime;
      console.log(`\n✗ Failed in ${(elapsed / 1000).toFixed(2)}s`);
      console.log(`  Error: ${error.message}`);

      results.push({
        id: prompt.id,
        name: prompt.name,
        success: false,
        needsHuman: true,
        roundsRun: 0,
        costUsd: 0,
        calls: 0,
        elapsed: elapsed / 1000,
        error: error.message,
      });
    }
  }

  // Summary
  console.log(`\n${"=".repeat(80)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(80)}\n`);

  const successCount = results.filter((r) => r.success && !r.needsHuman).length;
  const needsHumanCount = results.filter((r) => r.needsHuman).length;
  const totalCost = results.reduce((sum, r) => sum + r.costUsd, 0);
  const totalTime = results.reduce((sum, r) => sum + r.elapsed, 0);

  console.log(`Total Prompts: ${results.length}`);
  console.log(`Success (needsHuman=false): ${successCount}/${results.length}`);
  console.log(`Escalated (needsHuman=true): ${needsHumanCount}/${results.length}`);
  console.log(`Total Cost: $${totalCost.toFixed(4)}`);
  console.log(`Total Time: ${totalTime.toFixed(2)}s`);

  console.log(`\nDetailed Results:\n`);

  results.forEach((r) => {
    const status = r.success && !r.needsHuman ? "✅ SUCCESS" : r.needsHuman ? "⚠️  ESCALATED" : "❌ FAILED";
    console.log(`[${r.id}] ${status} - ${r.name}`);
    console.log(`    Rounds: ${r.roundsRun}, Cost: $${r.costUsd.toFixed(4)}, Time: ${r.elapsed.toFixed(2)}s`);
    if (r.proposal) {
      console.log(`    Proposal: "${r.proposal.value}" (confidence: ${r.proposal.confidence})`);
    }
    if (r.error) {
      console.log(`    Error: ${r.error}`);
    }
  });

  console.log(`\n${"=".repeat(80)}`);
  console.log("GATE A RESULT");
  console.log(`${"=".repeat(80)}\n`);

  if (successCount >= 2) {
    console.log(`✅ PASS: ${successCount}/5 prompts succeeded (target: ≥2)`);
    console.log(`\nNext: Verify ActionRequest DB writes (Gate B)`);
  } else {
    console.log(`⚠️  PARTIAL: ${successCount}/5 prompts succeeded (target: ≥2)`);
    console.log(`\nAnalysis needed:`);
    console.log(`- If 0/5 success: collapse policy may be too strict`);
    console.log(`- If 1/5 success: prompt pack may need stronger "must be specific" constraints`);
    console.log(`- Check critique/collapse outputs to diagnose escalation reasons`);
  }

  process.exit(successCount >= 2 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nFatal error:", err.message);
  process.exit(1);
});
