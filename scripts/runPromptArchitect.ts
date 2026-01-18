/**
 * Run Prompt Architect to upgrade specialist prompts
 * 
 * Usage:
 *   pnpm tsx scripts/runPromptArchitect.ts designer_systems
 *   pnpm tsx scripts/runPromptArchitect.ts designer_brand
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { completeJson } from "../server/ai/providers/providerFactory";

const PROMPT_PACKS_DIR = join(process.cwd(), "server/ai/engine/specialists/promptPacks");

async function main() {
  const targetRole = process.argv[2];
  if (!targetRole) {
    console.error("Usage: pnpm tsx scripts/runPromptArchitect.ts <role>");
    console.error("Example: pnpm tsx scripts/runPromptArchitect.ts designer_systems");
    process.exit(1);
  }

  // Load current prompt pack
  const currentPromptPath = join(PROMPT_PACKS_DIR, `${targetRole}.md`);
  const currentPrompt = readFileSync(currentPromptPath, "utf-8");

  // Load Prompt Architect prompt
  const architectPromptPath = join(PROMPT_PACKS_DIR, "prompt_architect.md");
  const architectPrompt = readFileSync(architectPromptPath, "utf-8");

  // Build input for Prompt Architect
  const input = {
    currentPrompt,
    targetRole,
    schema: "CraftOutputSchema (proposedChanges[])",
    allowedTargetKeys: [
      "design.tokens",
      "design.typeScale",
      "design.spacingScale",
      "design.colorSystem",
      "design.buttonSystem",
      "design.sectionLayout.*",
      "design.components.*",
      "design.mobileRules",
      "layout.*",
      "sections.*",
      "cta.*",
      "pricing.*",
      "trust.*",
      "ui.*",
    ],
    knownFailures: [
      "Generic output (vague advice like 'improve UX')",
      "Timeout risk (prompts too long)",
      "Schema drift (adding/removing fields)",
    ],
    qualityGoal: "Enterprise-grade design, highly actionable, system-level recommendations",
  };

  console.log(`\n🏗️  Running Prompt Architect on ${targetRole}...\n`);

  try {
    const result = await completeJson(
      {
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: architectPrompt },
          { role: "user", content: JSON.stringify(input, null, 2) },
        ],
        temperature: 0.3,
        trace: {
          jobId: `architect-${targetRole}`,
          step: "prompt_architect",
          round: Date.now(),
        },
      },
      "aiml",
      { useRouter: false }
    );

    if (!result.ok) {
      console.error(`❌ Prompt Architect failed: ${result.stopReason}`);
      process.exit(1);
    }

    const upgraded = result.parsed as { upgradedPrompt: string; changes: string[]; testPlan: string };

    // Save upgraded prompt as v2
    const v2Path = join(PROMPT_PACKS_DIR, `${targetRole}_v2.md`);
    writeFileSync(v2Path, upgraded.upgradedPrompt, "utf-8");

    console.log(`✅ Upgraded prompt saved to: ${v2Path}`);
    console.log(`\n📝 Changes made:`);
    upgraded.changes?.forEach((change, i) => {
      console.log(`   ${i + 1}. ${change}`);
    });
    console.log(`\n🧪 Test plan:`);
    console.log(upgraded.testPlan);

    console.log(`\n💰 Cost: $${result.costUsd.toFixed(4)}`);
    console.log(`⏱️  Duration: ${result.latencyMs}ms`);
  } catch (error) {
    console.error(`❌ Error:`, error);
    process.exit(1);
  }
}

main();
