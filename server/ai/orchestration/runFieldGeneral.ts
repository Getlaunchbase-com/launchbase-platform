// server/ai/orchestration/runFieldGeneral.ts
import type { Intake } from "../../../drizzle/schema";
import type { RunPlanV1, Tier, BuilderGate, RunMode } from "./types";
import { buildSystemsPack, buildBrandPack, buildCriticPack } from "./promptPackBuilders";

function nowIso() {
  return new Date().toISOString();
}

function tierFromIntake(intake: Intake): Tier {
  // Phase 1: if you don't have tier on intake yet, default standard.
  // Later: map from paid Stripe product, promo codes, etc.
  return "standard";
}

function tierLoops(tier: Tier): number {
  switch (tier) {
    case "standard":
      return 1;
    case "growth":
      return 3;
    case "premium":
      return 10;
  }
}

function tierBudgets(tier: Tier): { maxUsd: number; maxLatencyMs: number } {
  // These are guardrails for orchestration + monitoring; tune later.
  switch (tier) {
    case "standard":
      return { maxUsd: 0.50, maxLatencyMs: 2 * 60_000 }; // 2 min
    case "growth":
      return { maxUsd: 1.50, maxLatencyMs: 6 * 60_000 }; // 6 min
    case "premium":
      return { maxUsd: 5.00, maxLatencyMs: 20 * 60_000 }; // 20 min
  }
}

function tierCreativeMode(tier: Tier) {
  // Creative mode is your Creator→Selector pipeline.
  // Keep it ON by default; later you can turn off for certain lanes.
  return {
    enabled: true,
    capBeforeSelect: 24,
  } as const;
}

function tierBuilderGate(tier: Tier): BuilderGate {
  if (tier !== "premium") {
    return { enabled: false, reason: "tier_not_premium" };
  }
  return {
    enabled: true,
    allowedSurfaces: ["homepage_ui", "landing_page_ui", "pricing_ui"],
    maxIterations: 5,
  };
}

export function runFieldGeneral(params: {
  intake: Intake;
  runId: string;
  jobId: string;
  runMode?: RunMode; // default production
}): RunPlanV1 {
  const { intake, runId, jobId } = params;
  const runMode: RunMode = params.runMode ?? "production";

  const tier = tierFromIntake(intake);

  const systems = buildSystemsPack(intake);
  const brand = buildBrandPack(intake);
  const critic = buildCriticPack(intake);

  const plan: RunPlanV1 = {
    version: "runplan.v1",
    runId,
    jobId,

    tier,
    runMode,
    loopsRequested: tierLoops(tier),

    creativeMode: tierCreativeMode(tier),
    builderGate: tierBuilderGate(tier),

    packs: {
      systems: { packId: systems.packId, params: systems.params },
      brand: { packId: brand.packId, params: brand.params },
      critic: { packId: critic.packId, params: critic.params },
    },

    budgets: tierBudgets(tier),

    truth: {
      neverInventClaims: true,
      onlyUseIntakeFacts: true,
      requiresApproval: true,
    },

    createdAtIso: nowIso(),
  };

  return plan;
}
