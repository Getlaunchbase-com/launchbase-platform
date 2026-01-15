/**
 * Debug script to inspect callSpecialistWithRetry return shape
 */

import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";
import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_PLAN = {
  businessBrief: "LaunchBase: Professional, trustworthy, calm, transparent operating system for small businesses.",
  targetAudience: "Small business owners who need clarity and control over their operations.",
  primaryGoal: "Build trust through visual clarity and transparency metaphors.",
  constraints: ["Professional tone", "Modern but not trendy", "Clarity over decoration"]
};

async function debugReturn() {
  console.log("🔍 Debugging callSpecialistWithRetry return shape...\n");
  
  // Load policy
  const policyPath = join(__dirname, "../server/ai/engine/policy/policies/swarm_gate_a_control.json");
  const policy = JSON.parse(readFileSync(policyPath, "utf-8"));
  
  const systemsRole = "designer_systems_fast";
  const systemsRoleConfig = policy.swarm.roles[systemsRole];
  
  const result = await callSpecialistWithRetry({
    role: `${systemsRole}_artwork`,
    input: { plan: TEST_PLAN },
    roleConfig: systemsRoleConfig,
    trace: { traceId: "debug_test", startedAt: new Date().toISOString() },
    enableLadder: false
  });
  
  console.log("📦 Result keys:", Object.keys(result));
  console.log("\n📦 Result structure:");
  console.log(JSON.stringify({
    keys: Object.keys(result),
    stopReason: result.stopReason,
    hasJson: !!result.json,
    hasMeta: !!result.meta,
    hasModelUsed: !!result.modelUsed,
    hasFinishReason: !!result.finishReason,
    metaKeys: result.meta ? Object.keys(result.meta) : null,
    jsonKeys: result.json ? Object.keys(result.json) : null
  }, null, 2));
  
  console.log("\n📦 Full result.meta:");
  console.log(JSON.stringify(result.meta, null, 2));
  
  console.log("\n📦 Model info:");
  console.log("result.modelUsed:", result.modelUsed);
  console.log("result.meta?.model:", result.meta?.model);
  console.log("result.meta?.modelUsed:", result.meta?.modelUsed);
  
  console.log("\n📦 Artifact structure:");
  console.log("artifact keys:", result.artifact ? Object.keys(result.artifact) : null);
  console.log("artifact.payload keys:", result.artifact?.payload ? Object.keys(result.artifact.payload) : null);
  console.log("artifact.finishReason:", result.artifact?.finishReason);
}

debugReturn().catch(console.error);
