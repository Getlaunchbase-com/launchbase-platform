/**
 * smokeFastPrompts.ts
 * 
 * Smoke test for fast designer prompts.
 * Pass conditions:
 * - Both designers return ok
 * - Both return EXACTLY 8 changes
 * - Systems uses design.* keys
 * - Brand uses brand.* keys
 */

import { callSpecialistWithRetry } from "../server/ai/engine/specialists/index";

const context = {
  productName: "LaunchBase",
  primaryGoal: "Homepage design improvements",
  audience: "Small business owners",
  brief: "LaunchBase is an operating system for small businesses: ongoing responsibility + visibility/observability. Promise: hand it off without losing control.",
};

const policy = {
  roles: {
    designer_systems_fast: { transport: "aiml" as const, model: "gpt-4o-2024-08-06", capabilities: [], timeoutMs: 90000 },
    designer_brand_fast: { transport: "aiml" as const, model: "gpt-4o-2024-08-06", capabilities: [], timeoutMs: 90000 },
  },
};

async function run(role: "designer_systems_fast" | "designer_brand_fast") {
  const roleConfig = policy.roles[role];
  const res = await callSpecialistWithRetry({
    role: role as any,
    roleConfig,
    input: { plan: { objective: "Improve conversion clarity, trust, premium feel" }, context },
    trace: { traceId: `smoke_${role}`, startedAt: new Date().toISOString() },
    enableLadder: false,
  });

  // callSpecialistWithRetry returns { artifact: { payload: {...} }, ... }
  const payload = (res as any).artifact?.payload || res.payload;
  const changes = payload?.proposedChanges || [];
  const sampleKeys = changes.slice(0, 5).map((c: any) => c.targetKey);
  const expectedPrefix = role.includes("systems") ? "design." : "brand.";
  const allKeysValid = changes.every((c: any) => c.targetKey?.startsWith(expectedPrefix));

  console.log("\n" + "=".repeat(60));
  console.log(`SMOKE TEST: ${role}`);
  console.log("=".repeat(60));
  const ok = res.stopReason === "ok" || (res as any).artifact?.payload != null;
  
  console.log(JSON.stringify({
    ok,
    stopReason: res.stopReason,
    model: res.finalModelUsed || res.modelUsed,
    changes: changes.length,
    sampleKeys,
    allKeysValid,
  }, null, 2));

  const passed = ok && changes.length === 8 && allKeysValid;
  console.log(passed ? "✅ PASS" : "❌ FAIL");
  
  if (!passed) {
    console.error("\nFailure details:");
    if (!res.ok) console.error(`- stopReason: ${res.stopReason}`);
    if (changes.length !== 8) console.error(`- Expected 8 changes, got ${changes.length}`);
    if (!allKeysValid) {
      const invalidKeys = changes.filter((c: any) => !c.targetKey?.startsWith(expectedPrefix)).map((c: any) => c.targetKey);
      console.error(`- Invalid keys (expected ${expectedPrefix}*):`, invalidKeys);
    }
    process.exitCode = 2;
  }

  return passed;
}

(async () => {
  console.log("🔬 Fast Prompt Smoke Test");
  console.log("Testing: designer_systems_fast + designer_brand_fast");
  console.log("Model: gpt-4o-2024-08-06");
  console.log();

  const systemsPass = await run("designer_systems_fast");
  const brandPass = await run("designer_brand_fast");

  console.log("\n" + "=".repeat(60));
  console.log("FINAL RESULT");
  console.log("=".repeat(60));
  console.log(`Systems: ${systemsPass ? "✅ PASS" : "❌ FAIL"}`);
  console.log(`Brand: ${brandPass ? "✅ PASS" : "❌ FAIL"}`);
  console.log();

  if (systemsPass && brandPass) {
    console.log("✅ ALL SMOKE TESTS PASSED - Ready for Gate A");
    process.exit(0);
  } else {
    console.log("❌ SMOKE TESTS FAILED - Fix issues before Gate A");
    process.exit(2);
  }
})().catch((err) => {
  console.error("❌ Smoke test crashed:", err);
  process.exit(1);
});
