/**
 * Smoke Test: Schema Routing with Role Suffixes
 * 
 * Tests that roles with suffixes (_web, _app) are correctly routed to the right schema:
 * - designer_systems_fast_web → CraftOutputSchemaFast (EXACTLY 8)
 * - designer_brand_fast_web → CraftOutputSchemaFast (EXACTLY 8)
 * - design_critic_ruthless_web → CriticOutputSchema (≥10 issues/fixes)
 */

import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index";

const TEST_PLAN = {
  projectId: "test_schema_routing",
  businessName: "Acme Corp",
  industry: "SaaS",
  targetAudience: "B2B software teams",
  goals: ["Test schema routing with role suffixes"],
};

async function smokeTest() {
  console.log("🧪 SMOKE TEST: Schema Routing with Role Suffixes\n");

  // Inline policy (gpt-4o for designers, opus for critic)
  const policy = {
    roles: {
      designer_systems_fast_web: { transport: "aiml" as const, model: "gpt-4o-2024-08-06", capabilities: [], timeoutMs: 90000, maxTokens: 2000 },
      designer_brand_fast_web: { transport: "aiml" as const, model: "gpt-4o-2024-08-06", capabilities: [], timeoutMs: 90000, maxTokens: 2000 },
      design_critic_ruthless_web: { transport: "aiml" as const, model: "claude-opus-4-1-20250805", capabilities: [], timeoutMs: 90000, maxTokens: 4000 },
    },
  };

  const results: any[] = [];

  // Test 1: designer_systems_fast_web
  console.log("📝 Test 1/3: designer_systems_fast_web (should use CraftOutputSchemaFast)");
  try {
    const result1 = await callSpecialistWithRetry({
      role: "designer_systems_fast_web" as any,
      roleConfig: policy.roles.designer_systems_fast_web,
      input: { plan: TEST_PLAN },
      trace: { traceId: "smoke_schema_routing_test1", startedAt: new Date().toISOString() },
      enableLadder: false,
    });

    const changeCount = result1.artifact.payload.proposedChanges?.length ?? 0;
    const pass1 = result1.stopReason === "ok" && changeCount === 8;
    
    console.log(`  ✅ stopReason: ${result1.stopReason}`);
    console.log(`  ✅ changeCount: ${changeCount} (expected: 8)`);
    console.log(`  ${pass1 ? "✅ PASS" : "❌ FAIL"}\n`);
    
    results.push({ role: "designer_systems_fast_web", pass: pass1, changeCount });
  } catch (err: any) {
    console.log(`  ❌ FAIL: ${err.message}\n`);
    results.push({ role: "designer_systems_fast_web", pass: false, error: err.message });
  }

  // Test 2: designer_brand_fast_web
  console.log("📝 Test 2/3: designer_brand_fast_web (should use CraftOutputSchemaFast)");
  try {
    const result2 = await callSpecialistWithRetry({
      role: "designer_brand_fast_web" as any,
      roleConfig: policy.roles.designer_brand_fast_web,
      input: { plan: TEST_PLAN },
      trace: { traceId: "smoke_schema_routing_test2", startedAt: new Date().toISOString() },
      enableLadder: false,
    });

    const changeCount = result2.artifact.payload.proposedChanges?.length ?? 0;
    const pass2 = result2.stopReason === "ok" && changeCount === 8;
    
    console.log(`  ✅ stopReason: ${result2.stopReason}`);
    console.log(`  ✅ changeCount: ${changeCount} (expected: 8)`);
    console.log(`  ${pass2 ? "✅ PASS" : "❌ FAIL"}\n`);
    
    results.push({ role: "designer_brand_fast_web", pass: pass2, changeCount });
  } catch (err: any) {
    console.log(`  ❌ FAIL: ${err.message}\n`);
    results.push({ role: "designer_brand_fast_web", pass: false, error: err.message });
  }

  // Test 3: design_critic_ruthless_web
  console.log("📝 Test 3/3: design_critic_ruthless_web (should use CriticOutputSchema)");
  try {
    // Provide mock craft artifacts for critic
    const mockCraftArtifacts = [
      {
        role: "designer_systems_fast_web",
        output: {
          proposedChanges: [
            { key: "design.hero.headline", value: "Test headline" },
          ],
        },
      },
    ];

    const result3 = await callSpecialistWithRetry({
      role: "design_critic_ruthless_web" as any,
      roleConfig: policy.roles.design_critic_ruthless_web,
      input: { plan: TEST_PLAN, craftArtifacts: mockCraftArtifacts },
      trace: { traceId: "smoke_schema_routing_test3", startedAt: new Date().toISOString() },
      enableLadder: false,
    });

    const issueCount = result3.artifact.payload.issues?.length ?? 0;
    const fixCount = result3.artifact.payload.suggestedFixes?.length ?? 0;
    const pass3 = result3.stopReason === "ok" && issueCount >= 10 && fixCount >= 10;
    
    console.log(`  ✅ stopReason: ${result3.stopReason}`);
    console.log(`  ✅ issueCount: ${issueCount} (expected: ≥10)`);
    console.log(`  ✅ fixCount: ${fixCount} (expected: ≥10)`);
    console.log(`  ${pass3 ? "✅ PASS" : "❌ FAIL"}\n`);
    
    results.push({ role: "design_critic_ruthless_web", pass: pass3, issueCount, fixCount });
  } catch (err: any) {
    console.log(`  ❌ FAIL: ${err.message}\n`);
    results.push({ role: "design_critic_ruthless_web", pass: false, error: err.message });
  }

  // Summary
  const passCount = results.filter(r => r.pass).length;
  const totalCount = results.length;
  
  console.log("📊 SUMMARY");
  console.log(`  Passed: ${passCount}/${totalCount}`);
  console.log(`  Success rate: ${((passCount / totalCount) * 100).toFixed(0)}%`);
  
  if (passCount === totalCount) {
    console.log("\n✅ ALL TESTS PASSED - Schema routing working correctly!");
    process.exit(0);
  } else {
    console.log("\n❌ SOME TESTS FAILED - Check schema routing logic");
    process.exit(1);
  }
}

smokeTest().catch((err) => {
  console.error("💥 Smoke test crashed:", err);
  process.exit(1);
});
